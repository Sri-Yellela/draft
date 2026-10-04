// ── D20 · the slug harvest, as part of the daily manual sweep ──────────────────────────────────
//
// The owner sweeps the enrichment influx by hand once a day; the slug harvest rides in the same pass.
// ⛔ No extension, no cron, no model call (D17). A sweep is started by a person, runs a few SerpApi
// google_jobs searches, and leaves a POOL of (ats_type, slug) pairs for the owner to review:
//
//   sweep      → POST /api/admin/slug-harvest/sweep            (dry first: the queries and the quota)
//   export     → GET  /api/admin/slug-harvest/export           (JSONL: one undecided pair per line)
//   review     → the owner sets "decision": "add" | "skip" and the company name
//   import     → POST /api/admin/slug-harvest/import           (dry first; whole file or nothing)
//   revert     → POST /api/admin/slug-harvest/imports/:id/revert (dry first; disables, never deletes)
//
// ⛔ WHY THE SEARCHES AND NOT THE BOARD. A board row came from a board we already crawl, so its URL
// points back at a company we already have. The aggregator results are the only input that can name a
// company we have never crawled — D4's 20-search measurement found 50 distinct ATS pairs, all new.
//
// ⛔ A POOL, NEVER A PAIRING. Google clusters similar postings: one result's apply_options belong to
// different employers (job 1's Ashby link was Coder's, its Workday link Western Alliance Bank's). So
// the job a link was found under is DISCARDED here — nothing records "slug X came from job Y", which
// is the "Localhost" / "Physical Superintelligence → Intel" mis-attribution class.
//
// ⚠ BUDGET. SerpApi is on the free plan: 250 searches a month. DAILY_SEARCH_CAP is the ~8 a day that
// fits, enforced from the sweeps table, and the account's own remaining count is read (free) before
// any search is spent. A role family whose last EXHAUSTED_AFTER searches found nothing new is dropped
// from the default plan — the conversion rate is the stopping rule.
//
// ⛔ Nothing here enables a board on its own. An "add" goes through validateBoard (dead / empty /
// live / no_descriptions) at import time and is refused when the board changed since the export.
import crypto from "node:crypto";
import axios from "axios";
import { detectKnownAtsMatch } from "./jobs/importJob.js";
import { googleJobs } from "./jobs/sources/serpapi.js";
import { validateBoard, addCompany, setCompanyActive, ATS_FETCHERS } from "./companyList.js";

export const DAILY_SEARCH_CAP = 8;
export const EXHAUSTED_AFTER = 3;
export const EXPORT_FORMAT = "draft.slug-harvest.v1";
export const DECISIONS = Object.freeze(["add", "skip"]);
const STALE_SWEEP_SECONDS = 15 * 60;

/**
 * The searches a sweep chooses from: the 20 D4 measured, one or more per role family
 * (services/jobs/jobTaxonomy.js). Their yield is docs/SERPAPI_SLUG_YIELD.md.
 */
export const HARVEST_QUERIES = Object.freeze([
  { q: "software engineer", family: "engineering" },
  { q: "backend engineer", family: "engineering" },
  { q: "frontend engineer", family: "engineering" },
  { q: "full stack engineer", family: "engineering" },
  { q: "site reliability engineer devops", family: "engineering" },
  { q: "security engineer", family: "engineering" },
  { q: "mobile engineer ios android", family: "engineering" },
  { q: "new grad software engineer", family: "engineering" },
  { q: "machine learning engineer", family: "data" },
  { q: "data scientist", family: "data" },
  { q: "data analyst", family: "data" },
  { q: "data engineer", family: "data" },
  { q: "product manager", family: "product" },
  { q: "technical program manager", family: "product" },
  { q: "embedded firmware engineer", family: "embedded_firmware" },
  { q: "product designer", family: "design" },
  { q: "marketing manager", family: "marketing" },
  { q: "account executive", family: "sales" },
  { q: "financial analyst", family: "finance" },
  { q: "technical recruiter", family: "hr" },
]);
const FAMILY_OF = new Map(HARVEST_QUERIES.map(x => [x.q, x.family]));

// ── URL → (ats_type, slug) ──────────────────────────────────────────────────────────────────────
//
// detectKnownAtsMatch (the import path's parser) for every vendor it handles, plus the two forms it
// deliberately does not: Workday's site (import never guesses it; here the URL itself is the
// evidence, and validateBoard proves it before anything is enabled) and Greenhouse's embed form.
const WORKDAY_HOST_RE = /^([a-z0-9-]+)\.wd(\d+)\.myworkdayjobs\.com$/i;
const WORKDAY_SITE_HOST_RE = /^wd(\d+)\.myworkdaysite\.com$/i;
const LOCALE_RE = /^[a-z]{2}-[a-z]{2}$/i;
const SITE_RE = /^[A-Za-z0-9_-]{1,80}$/;
// Vendors that appear in the results but have no crawler: counted, never pooled.
const UNSUPPORTED_HOSTS = [
  [/(^|\.)icims\.com$/i, "icims"], [/(^|\.)applytojob\.com$/i, "jazzhr"], [/\.oraclecloud\.com$/i, "oracle"],
  [/\.eightfold\.ai$/i, "eightfold"], [/(^|\.)jobs\.gem\.com$/i, "gem"], [/\.pinpointhq\.com$/i, "pinpoint"],
  [/^jobs\.jobvite\.com$/i, "jobvite"], [/\.bamboohr\.com$/i, "bamboohr"], [/\.taleo\.net$/i, "taleo"],
  [/\.successfactors\.(com|eu)$/i, "successfactors"], [/(^|\.)adp\.com$/i, "adp"], [/\.ultipro\.com$/i, "ukg"],
];

/** @returns {{atsType, slug} | {unsupported: string} | null} */
export function harvestPairOf(rawUrl) {
  let u;
  try { u = new URL(rawUrl); } catch { return null; }
  const host = u.hostname.toLowerCase();
  const seg = u.pathname.split("/").filter(Boolean);

  let m = host.match(WORKDAY_HOST_RE);
  if (m) {
    const site = LOCALE_RE.test(seg[0] || "") ? seg[1] : seg[0];
    if (!site || !SITE_RE.test(site)) return null;
    return { atsType: "workday", slug: `${m[2]}|${m[1].toLowerCase()}|${site}` };
  }
  m = host.match(WORKDAY_SITE_HOST_RE);
  if (m && seg[0] === "recruiting" && seg[1] && seg[2] && SITE_RE.test(seg[2])) {
    return { atsType: "workday", slug: `${m[1]}|${seg[1].toLowerCase()}|${seg[2]}` };
  }
  if (/(^|\.)greenhouse\.io$/i.test(host) && seg.join("/") === "embed/job_app") {
    const forSlug = u.searchParams.get("for");
    return forSlug ? { atsType: "greenhouse", slug: forSlug } : null;
  }
  const known = detectKnownAtsMatch(rawUrl);
  if (known && known.type !== "workday" && known.slug) return { atsType: known.type, slug: known.slug };
  for (const [re, vendor] of UNSUPPORTED_HOSTS) if (re.test(host)) return { unsupported: vendor };
  return null;
}

export const keyOf = (atsType, slug) => `${atsType}:${String(slug).toLowerCase()}`;

/**
 * Every link in one search's results → the distinct pairs it names. The job each link sat under is
 * not kept (see the header).
 */
export function poolFromResults(data) {
  const pairs = new Map();
  const unsupported = {};
  let links = 0, atsLinks = 0;
  const jobs = Array.isArray(data?.jobs_results) ? data.jobs_results : [];
  for (const job of jobs) {
    const urls = new Set((job.apply_options || []).map(o => o?.link).filter(Boolean));
    if (job.source_link) urls.add(job.source_link);
    for (const url of urls) {
      links++;
      const p = harvestPairOf(url);
      if (!p) continue;
      atsLinks++;
      if (p.unsupported) { unsupported[p.unsupported] = (unsupported[p.unsupported] || 0) + 1; continue; }
      const k = keyOf(p.atsType, p.slug);
      if (!pairs.has(k)) pairs.set(k, { ...p, url });
    }
  }
  return { jobs: jobs.length, links, atsLinks, pairs, unsupported };
}

// ── SerpApi ─────────────────────────────────────────────────────────────────────────────────────
//
// Through the plugin's googleJobs — the one place that calls SerpApi's search, which pins hl=en&gl=us (an
// unpinned call came back in Spanish). Location "United States", and NO chips/num/start: D4's search
// #1 with the live plugin's chips/num/start came back "Fully empty".
export async function serpSearch(q) {
  return googleJobs({ q, location: "United States" }, { timeout: 20000 });
}

/** The account's quota. Free — account.json does not count as a search. */
export async function serpAccount({ apiKey = process.env.SERPAPI_KEY } = {}) {
  const { data } = await axios.get("https://serpapi.com/account.json", { params: { api_key: apiKey }, timeout: 10000 });
  return { plan: data.plan_name ?? null, perMonth: data.searches_per_month ?? null,
           usedThisMonth: data.this_month_usage ?? null, left: data.plan_searches_left ?? data.total_searches_left ?? null };
}

// ── the configured set ──────────────────────────────────────────────────────────────────────────
function configuredIndex(db) {
  const rows = db.prepare("SELECT id, company, ats_type, ats_slug, active FROM company_ats_list").all();
  const byKey = new Map(), workdayTenants = new Map();
  for (const r of rows) {
    byKey.set(keyOf(r.ats_type, r.ats_slug), r);
    if (r.ats_type === "workday") {
      const tenant = String(r.ats_slug).split("|")[1];
      if (tenant) workdayTenants.set(tenant.toLowerCase(), r);
    }
  }
  // A Workday tenant we already crawl under one site is the same company under another site.
  return (atsType, slug) => byKey.get(keyOf(atsType, slug))
    || (atsType === "workday" ? workdayTenants.get(String(slug).split("|")[1]?.toLowerCase()) : undefined) || null;
}

// ── the conversion rate, per role family ────────────────────────────────────────────────────────
function sweepQueryRuns(db) {
  const runs = [];
  for (const s of db.prepare("SELECT id, started_at, queries_json FROM slug_harvest_sweeps ORDER BY id").all()) {
    let qs = [];
    try { qs = JSON.parse(s.queries_json) || []; } catch { /* a malformed row reads as no runs */ }
    for (const q of qs) if (q.ran) runs.push({ sweepId: s.id, at: s.started_at, ...q });
  }
  return runs;
}

/**
 * Per family: searches, new pairs, the rate, and whether the stopping rule has dropped it — its last
 * EXHAUSTED_AFTER searches found nothing new.
 */
export function familyConversion(db) {
  const out = new Map();
  for (const fam of new Set(HARVEST_QUERIES.map(x => x.family))) {
    out.set(fam, { family: fam, searches: 0, newPairs: 0, rate: null, lastRunAt: null, recent: [], exhausted: false });
  }
  for (const r of sweepQueryRuns(db)) {
    const f = out.get(r.family) || out.set(r.family, { family: r.family, searches: 0, newPairs: 0, rate: null, lastRunAt: null, recent: [], exhausted: false }).get(r.family);
    f.searches++; f.newPairs += r.newPairs || 0; f.lastRunAt = r.at; f.recent.push(r.newPairs || 0);
  }
  for (const f of out.values()) {
    f.rate = f.searches ? Number((f.newPairs / f.searches).toFixed(2)) : null;
    const last = f.recent.slice(-EXHAUSTED_AFTER);
    f.exhausted = last.length === EXHAUSTED_AFTER && last.every(n => n === 0);
    f.recent = last;
  }
  return [...out.values()];
}

function utcMidnight(now) { return now - (now % 86400); }

export function searchesToday(db, now = Math.floor(Date.now() / 1000)) {
  return db.prepare("SELECT COALESCE(SUM(searches), 0) FROM slug_harvest_sweeps WHERE started_at >= ?").pluck().get(utcMidnight(now));
}

function runningSweep(db, now) {
  return db.prepare("SELECT id, started_at FROM slug_harvest_sweeps WHERE finished_at IS NULL AND started_at > ? ORDER BY id DESC LIMIT 1")
    .get(now - STALE_SWEEP_SECONDS) || null;
}

/**
 * Which searches a sweep would spend. Default: the families the stopping rule has not dropped, least
 * recently searched first, up to what is left of today's cap. `queries` (strings) overrides the
 * choice but never the cap.
 */
export function planSweep(db, { queries = null, now = Math.floor(Date.now() / 1000) } = {}) {
  const used = searchesToday(db, now);
  const remainingToday = Math.max(0, DAILY_SEARCH_CAP - used);
  const fams = new Map(familyConversion(db).map(f => [f.family, f]));
  const lastRun = new Map();
  for (const r of sweepQueryRuns(db)) lastRun.set(r.q, r.at);
  const skipped = [];
  let chosen;
  if (Array.isArray(queries) && queries.length) {
    chosen = [...new Set(queries.map(q => String(q).trim()).filter(Boolean))]
      .map(q => ({ q, family: FAMILY_OF.get(q) || "custom" }));
  } else {
    chosen = [];
    for (const x of HARVEST_QUERIES) {
      if (fams.get(x.family)?.exhausted) { skipped.push({ q: x.q, family: x.family, reason: `the last ${EXHAUSTED_AFTER} ${x.family} searches found nothing new` }); continue; }
      chosen.push({ ...x });
    }
    chosen.sort((a, b) => (lastRun.get(a.q) ?? -1) - (lastRun.get(b.q) ?? -1));
  }
  const over = chosen.slice(remainingToday);
  for (const x of over) skipped.push({ q: x.q, family: x.family, reason: `over today's cap of ${DAILY_SEARCH_CAP}` });
  return { queries: chosen.slice(0, remainingToday), cap: DAILY_SEARCH_CAP, usedToday: used, remainingToday, skipped,
           running: runningSweep(db, now) };
}

// ── the sweep ───────────────────────────────────────────────────────────────────────────────────
export function openSweep(db, { queries, adminUserId = null, now = Math.floor(Date.now() / 1000) }) {
  return Number(db.prepare("INSERT INTO slug_harvest_sweeps (started_at, admin_user_id, queries_json) VALUES (?, ?, ?)")
    .run(now, adminUserId, JSON.stringify(queries.map(x => ({ q: x.q, family: x.family, ran: false })))).lastInsertRowid);
}

/**
 * Runs the searches of an opened sweep, one at a time, then validates the pairs it found new. Stops
 * at the first failed search rather than spending the rest. Never throws: the outcome is the row.
 */
export async function runSweep(db, sweepId, { search = serpSearch, validate = validateBoard, fetchers = ATS_FETCHERS,
                                              now = () => Math.floor(Date.now() / 1000) } = {}) {
  const sweep = db.prepare("SELECT * FROM slug_harvest_sweeps WHERE id = ?").get(sweepId);
  const queries = JSON.parse(sweep.queries_json);
  const isConfigured = configuredIndex(db);
  const seenThisSweep = new Set();
  const fresh = [];
  const totals = { searches: 0, links: 0, atsLinks: 0, pairs: 0, newPairs: 0 };
  const save = (error = null, finished = false) => db.prepare(`
      UPDATE slug_harvest_sweeps SET searches = ?, links = ?, ats_links = ?, pairs = ?, new_pairs = ?, queries_json = ?,
             error = COALESCE(?, error), finished_at = CASE WHEN ? THEN ? ELSE finished_at END WHERE id = ?`)
    .run(totals.searches, totals.links, totals.atsLinks, totals.pairs, totals.newPairs, JSON.stringify(queries),
         error, finished ? 1 : 0, now(), sweepId);
  const upsert = db.prepare(`
      INSERT INTO slug_harvest_pool (ats_type, slug_key, ats_slug, sample_url, first_sweep_id, first_query, first_seen_at, last_seen_at, times_seen)
      VALUES (@atsType, @slugKey, @slug, @url, @sweepId, @q, @at, @at, 1)
      ON CONFLICT(ats_type, slug_key) DO UPDATE SET last_seen_at = @at, times_seen = times_seen + 1`);
  const inPool = db.prepare("SELECT 1 FROM slug_harvest_pool WHERE ats_type = ? AND slug_key = ?").pluck();

  for (const q of queries) {
    let data;
    try {
      data = await search(q.q);
    } catch (e) {
      const status = e?.response?.status ?? null;
      save(`search "${q.q}" failed (${status ?? e?.code ?? e?.message ?? "error"}); the remaining searches were not spent`, true);
      return { ok: false, sweepId };
    }
    totals.searches++;
    const r = poolFromResults(data);
    Object.assign(q, { ran: true, jobs: r.jobs, links: r.links, atsLinks: r.atsLinks, pairs: r.pairs.size, newPairs: 0,
                       configured: 0, unsupported: r.unsupported,
                       language: data?.search_parameters ? `${data.search_parameters.hl}/${data.search_parameters.gl}` : null });
    totals.links += r.links; totals.atsLinks += r.atsLinks;
    for (const [k, p] of r.pairs) {
      if (seenThisSweep.has(k)) continue;
      seenThisSweep.add(k);
      totals.pairs++;
      if (isConfigured(p.atsType, p.slug)) { q.configured++; continue; }
      const slugKey = p.slug.toLowerCase();
      const isNew = !inPool.get(p.atsType, slugKey);
      upsert.run({ atsType: p.atsType, slugKey, slug: p.slug, url: p.url, sweepId, q: q.q, at: now() });
      if (isNew) { q.newPairs++; totals.newPairs++; fresh.push(p); }
    }
    save();
  }

  // Validate what is new, one board at a time — free, but a stranger's ATS is not ours to hammer.
  const setState = db.prepare("UPDATE slug_harvest_pool SET state = ?, validation_json = ?, validated_at = ? WHERE ats_type = ? AND slug_key = ?");
  for (const p of fresh) {
    let v;
    try { v = await validate({ atsType: p.atsType, slug: p.slug, fetchers }); }
    catch (e) { v = { ok: false, state: "error", message: e?.message || "validation threw" }; }
    setState.run(v.state, JSON.stringify(v), now(), p.atsType, p.slug.toLowerCase());
  }
  save(null, true);
  return { ok: true, sweepId };
}

export function listSweeps(db, limit = 20) {
  return db.prepare("SELECT * FROM slug_harvest_sweeps ORDER BY id DESC LIMIT ?").all(limit)
    .map(s => ({ ...s, queries: JSON.parse(s.queries_json), queries_json: undefined,
                 conversion: s.searches ? Number((s.new_pairs / s.searches).toFixed(2)) : null }));
}

export function poolSummary(db) {
  return db.prepare(`SELECT ats_type, COUNT(*) pairs, SUM(decision IS NULL) undecided, SUM(decision = 'add') added,
                            SUM(decision = 'skip') skipped, SUM(state = 'live') live
                     FROM slug_harvest_pool GROUP BY ats_type ORDER BY pairs DESC`).all();
}

// ── export ──────────────────────────────────────────────────────────────────────────────────────
/** Undecided, unconfigured pairs on a vendor we can crawl — the owner's review file. */
export function buildExport(db, { now = Math.floor(Date.now() / 1000) } = {}) {
  const isConfigured = configuredIndex(db);
  const rows = db.prepare("SELECT * FROM slug_harvest_pool WHERE decision IS NULL ORDER BY (state = 'live') DESC, first_seen_at, ats_type, slug_key").all()
    .filter(r => ATS_FETCHERS[r.ats_type] && !isConfigured(r.ats_type, r.ats_slug))
    .map(r => {
      let v = null;
      try { v = r.validation_json ? JSON.parse(r.validation_json) : null; } catch { /* unreadable reads as unvalidated */ }
      return {
        ats_type: r.ats_type, slug: r.ats_slug, decision: null, company: v?.companyGuess || null,
        exported_state: r.state || "unvalidated",
        jobs: v?.jobs ?? null, us: v?.us ?? null, descriptions: v?.descriptions?.note ?? null,
        sample_titles: (v?.sample || []).map(s => s.title).slice(0, 3),
        sample_url: r.sample_url, first_query: r.first_query, times_seen: r.times_seen,
      };
    });
  const meta = { _meta: { format: EXPORT_FORMAT, exported_at: now, rows: rows.length,
    how: "Set decision to \"add\" or \"skip\" and, for add, the company name. Leave decision null to decide later. " +
         "Import is dry first; an add is re-validated and refused if the board changed since this export." } };
  return { meta, rows };
}

export const toJsonl = ({ meta, rows }) => [meta, ...rows].map(r => JSON.stringify(r)).join("\n") + "\n";

// ── import ──────────────────────────────────────────────────────────────────────────────────────
//
// The D17 guards: invalid_value · stale · unknown pair · concurrency · a refusal that reconciles
// (each rejection says what the database holds now, so the file can be fixed rather than guessed at).
// Whole file or nothing. Re-importing the same file changes nothing.
function parseFile(text) {
  const rows = [], rejected = [];
  let meta = null;
  String(text).split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    let o;
    try { o = JSON.parse(line); } catch { rejected.push({ line: i + 1, kind: "invalid_value", error: "not a JSON object" }); return; }
    if (o && o._meta) { meta = o._meta; return; }
    rows.push({ line: i + 1, ...o });
  });
  return { meta, rows, rejected };
}

/**
 * The plan for a decision file. Validates every "add" board live (free; the stale guard needs it).
 */
export async function planImport(db, text, { validate = validateBoard, fetchers = ATS_FETCHERS } = {}) {
  const { meta, rows, rejected } = parseFile(text);
  if (!meta || meta.format !== EXPORT_FORMAT) {
    rejected.unshift({ line: 1, kind: "invalid_value", error: `not a slug-harvest export (first line must be the _meta line, format "${EXPORT_FORMAT}")` });
  }
  const getPool = db.prepare("SELECT * FROM slug_harvest_pool WHERE ats_type = ? AND slug_key = ?");
  const getCompany = db.prepare("SELECT * FROM company_ats_list WHERE ats_type = ? AND lower(ats_slug) = lower(?)");
  const seen = new Set();
  const planned = [];
  let unchanged = 0, undecided = 0;
  for (const r of rows) {
    const ats = typeof r.ats_type === "string" ? r.ats_type : null;
    const slug = typeof r.slug === "string" ? r.slug : null;
    const reject = (kind, error, extra = {}) => rejected.push({ line: r.line, pair: ats && slug ? `${ats}:${slug}` : null, kind, error, ...extra });
    if (!ats || !slug) { reject("invalid_value", "ats_type and slug are required"); continue; }
    const k = keyOf(ats, slug);
    if (seen.has(k)) { reject("invalid_value", "this pair appears twice in the file"); continue; }
    seen.add(k);
    if (r.decision == null) { undecided++; continue; }
    if (!DECISIONS.includes(r.decision)) { reject("invalid_value", `decision must be "add", "skip" or null — got ${JSON.stringify(r.decision)}`); continue; }
    const company = typeof r.company === "string" ? r.company.trim() : "";
    if (r.decision === "add" && (!company || company.length > 120)) { reject("invalid_value", "an add needs the company name (1–120 characters)"); continue; }
    const pool = getPool.get(ats, slug.toLowerCase());
    if (!pool) { reject("unknown_pair", "no sweep found this pair — an import decides on harvested pairs, it never inserts one"); continue; }
    if (pool.decision != null) {
      if (pool.decision === r.decision) { unchanged++; continue; }
      reject("concurrency", `already decided "${pool.decision}" by import ${pool.import_id ?? "?"} — revert that import to change it`, { now: pool.decision });
      continue;
    }
    const existing = getCompany.get(ats, slug);
    if (r.decision === "add" && existing?.active) {
      reject("concurrency", `already configured and active as "${existing.company}" (company ${existing.id}) — nothing to add; mark it skip`, { now: "configured" });
      continue;
    }
    planned.push({ line: r.line, ats, slug: pool.ats_slug, slugKey: pool.slug_key, decision: r.decision, company,
                   exportedState: r.exported_state ?? null, pool, reactivate: r.decision === "add" && existing ? existing : null });
  }

  for (const p of planned) {
    if (p.decision !== "add") continue;
    let v;
    try { v = await validate({ atsType: p.ats, slug: p.slug, company: p.company, fetchers }); }
    catch (e) { v = { ok: false, state: "error", message: e?.message || "validation threw" }; }
    p.validation = v;
    if (!v.ok) {
      rejected.push({ line: p.line, pair: `${p.ats}:${p.slug}`, kind: "invalid_value", error: `the board reads "${v.state}" — ${v.message}`, now: v.state });
    } else if (v.state !== p.exportedState) {
      rejected.push({ line: p.line, pair: `${p.ats}:${p.slug}`, kind: "stale",
        error: `exported as "${p.exportedState}", the board now reads "${v.state}" — export again and look before adding`, now: v.state });
    }
  }
  const valid = rejected.length === 0;
  return { valid, rejected, unchanged, undecided, planned,
           wouldAdd: planned.filter(p => p.decision === "add").length,
           wouldSkip: planned.filter(p => p.decision === "skip").length,
           expectWrites: planned.length,
           sha256: crypto.createHash("sha256").update(String(text)).digest("hex") };
}

export function summarizePlan(plan) {
  return { valid: plan.valid, rejected: plan.rejected, unchanged: plan.unchanged, undecided: plan.undecided,
           wouldAdd: plan.wouldAdd, wouldSkip: plan.wouldSkip, expectWrites: plan.expectWrites,
           rows: plan.planned.map(p => ({ pair: `${p.ats}:${p.slug}`, decision: p.decision, company: p.company || null,
                                         reactivate: Boolean(p.reactivate), state: p.validation?.state ?? null })) };
}

const POOL_DECISION_COLS = ["decision", "company", "decided_at", "import_id", "company_id"];
const pick = (row, cols) => Object.fromEntries(cols.map(c => [c, row[c] ?? null]));

/** Applies a VALID plan in one transaction. Companies are added through addCompany (audited). */
export function applyPlan(db, plan, { adminUserId = null, now = Math.floor(Date.now() / 1000) } = {}) {
  if (!plan.valid) return { ok: false, reason: "the plan has rejections" };
  if (!plan.planned.length) return { ok: true, importId: null, written: 0, added: 0 };
  return db.transaction(() => {
    const importId = Number(db.prepare("INSERT INTO slug_harvest_imports (imported_at, admin_user_id, file_sha256) VALUES (?, ?, ?)")
      .run(now, adminUserId, plan.sha256).lastInsertRowid);
    const upd = db.prepare(`UPDATE slug_harvest_pool SET decision = @decision, company = @company, decided_at = @decided_at,
                              import_id = @import_id, company_id = @company_id WHERE ats_type = @ats AND slug_key = @slugKey`);
    const rec = db.prepare(`INSERT INTO slug_harvest_import_rows (import_id, ats_type, slug_key, before_json, after_json, company_id)
                            VALUES (?, ?, ?, ?, ?, ?)`);
    let added = 0;
    for (const p of plan.planned) {
      let companyId = null;
      if (p.decision === "add") {
        if (p.reactivate) {
          const out = setCompanyActive(db, { id: p.reactivate.id, active: true, adminUserId });
          if (!out.ok) throw new Error(`company ${p.reactivate.id} vanished mid-import`);
          companyId = p.reactivate.id;
        } else {
          const out = addCompany(db, { company: p.company, atsType: p.ats, slug: p.slug, adminUserId });
          if (!out.ok) throw new Error(`${p.ats}:${p.slug} was configured mid-import`);
          companyId = out.company.id;
        }
        added++;
      }
      const after = { decision: p.decision, company: p.company || null, decided_at: now, import_id: importId, company_id: companyId };
      upd.run({ ...after, ats: p.ats, slugKey: p.slugKey });
      rec.run(importId, p.ats, p.slugKey, JSON.stringify(pick(p.pool, POOL_DECISION_COLS)), JSON.stringify(after), companyId);
    }
    db.prepare("UPDATE slug_harvest_imports SET rows_written = ?, companies_added = ? WHERE id = ?").run(plan.planned.length, added, importId);
    return { ok: true, importId, written: plan.planned.length, added };
  })();
}

export function listImports(db, limit = 20) {
  return db.prepare("SELECT * FROM slug_harvest_imports ORDER BY id DESC LIMIT ?").all(limit);
}

// ── revert ──────────────────────────────────────────────────────────────────────────────────────
/**
 * What a revert of one import would do, pair by pair. A pair a later import has since re-decided is
 * left alone and counted. A company the import added is DISABLED (active = 0, audited), never deleted:
 * its rows age out as a disabled company's always have.
 */
export function revertPreview(db, importId) {
  const imp = db.prepare("SELECT * FROM slug_harvest_imports WHERE id = ?").get(importId);
  if (!imp) return null;
  const rows = db.prepare("SELECT * FROM slug_harvest_import_rows WHERE import_id = ?").all(importId);
  const getPool = db.prepare("SELECT * FROM slug_harvest_pool WHERE ats_type = ? AND slug_key = ?");
  const getCompany = db.prepare("SELECT id, company, active FROM company_ats_list WHERE id = ?");
  const pairs = [];
  let restorable = 0, changedSince = 0;
  for (const r of rows) {
    const pool = getPool.get(r.ats_type, r.slug_key);
    const before = JSON.parse(r.before_json);
    const company = r.company_id ? getCompany.get(r.company_id) : null;
    const ownsIt = pool && pool.import_id === importId;
    if (ownsIt) restorable++; else changedSince++;
    pairs.push({ pair: `${r.ats_type}:${pool?.ats_slug ?? r.slug_key}`, restorable: ownsIt,
                 now: { decision: pool?.decision ?? null, company: company ? `${company.company} (${company.active ? "active" : "disabled"})` : null },
                 after: ownsIt ? { decision: before.decision, company: company ? `${company.company} (disabled)` : null } : "unchanged — a later import re-decided it" });
  }
  return { importId, alreadyReverted: Boolean(imp.reverted_at), restorable, changedSince, pairs };
}

export function revertImport(db, importId, { adminUserId = null, now = Math.floor(Date.now() / 1000) } = {}) {
  const preview = revertPreview(db, importId);
  if (!preview) return { ok: false, reason: `no import ${importId}` };
  if (preview.alreadyReverted) return { ok: false, reason: `import ${importId} was already reverted` };
  return db.transaction(() => {
    const rows = db.prepare("SELECT * FROM slug_harvest_import_rows WHERE import_id = ?").all(importId);
    const restore = db.prepare(`UPDATE slug_harvest_pool SET decision = @decision, company = @company, decided_at = @decided_at,
                                  import_id = @import_id, company_id = @company_id
                                WHERE ats_type = @ats AND slug_key = @slugKey AND import_id = @owner`);
    let restored = 0, disabled = 0;
    for (const r of rows) {
      const info = restore.run({ ...JSON.parse(r.before_json), ats: r.ats_type, slugKey: r.slug_key, owner: importId });
      if (!info.changes) continue;
      restored++;
      if (r.company_id) {
        const c = db.prepare("SELECT active FROM company_ats_list WHERE id = ?").get(r.company_id);
        if (c?.active) { setCompanyActive(db, { id: r.company_id, active: false, adminUserId }); disabled++; }
      }
    }
    db.prepare("UPDATE slug_harvest_imports SET reverted_at = ? WHERE id = ?").run(now, importId);
    return { ok: true, restored, disabled };
  })();
}
