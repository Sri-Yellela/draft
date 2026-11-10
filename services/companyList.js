// ── Company list management (A50 step 4) — the growth lever, as a surface ─────────────────────
//
// docs/ADMIN_PANEL_REVAMP.md §3: "Company list management is the one I would build first. It is the
// product's growth lever and it is currently invisible" — companies arrived only as migrations.
// docs/COMPANY_LIST_STRATEGY.md §4: ⛔ validate every slug before enabling — a URL proves a page
// existed, not that a board is worth crawling, and a 404 (dead slug) must be distinguishable from an
// empty-but-alive board.
//
// Every write is logged in admin_audit_log (migration 119) with the value it replaced, and nothing
// here deletes: a company is retired by `active = 0`, which the crawl already honours.
import { fetchCompanyJobs as greenhouse } from "./jobs/sources/greenhouse.js";
import { fetchCompanyJobs as lever } from "./jobs/sources/lever.js";
import { fetchCompanyJobs as ashby } from "./jobs/sources/ashby.js";
import { fetchCompanyJobs as smartrecruiters } from "./jobs/sources/smartrecruiters.js";
import { fetchCompanyJobs as workable } from "./jobs/sources/workable.js";
import { fetchCompanyJobs as recruitee } from "./jobs/sources/recruitee.js";
import { fetchCompanyJobs as workday } from "./jobs/sources/workday.js";
import { fetchCompanyJobs as bamboohr } from "./jobs/sources/bamboohr.js";
import { fetchCompanyJobs as gem } from "./jobs/sources/gem.js";
import { fetchCompanyJobs as rippling } from "./jobs/sources/rippling.js";
import { fetchCompanyJobs as icims } from "./jobs/sources/icims.js";
import { fetchCompanyJobs as oracle, parseSlug as parseOracleSlug } from "./jobs/sources/oracle.js";
import { fetchCompanyJobs as taleo, parseSlug as parseTaleoSlug } from "./jobs/sources/taleo.js";
import { fetchCompanyJobs as successfactors, isCsbHost } from "./jobs/sources/successfactors.js";
import { usEligibility } from "./jobs/usLocation.js";
import { fetchDescription, hasDetailFetcher } from "./jobs/detailFetch.js";
import { auditActorColumns } from "./actor.js";
import { boardCounts, countsFor } from "./companyHeat.js";
import { harvestPairOf } from "./slugHarvest.js";   // 46a: a capture's URL → its full board pair (a call-time use; slugHarvest imports this file too)

export const ATS_FETCHERS = Object.freeze({ greenhouse, lever, ashby, smartrecruiters, workable, recruitee, workday, bamboohr, gem, rippling, icims, oracle, taleo, successfactors });
const SLUG_RE = /^[A-Za-z0-9][A-Za-z0-9._|-]{0,119}$/;
// 46a: the boards whose slug has parts — checked with each source's own parser, so the shape and the fetcher never disagree.
const SLUG_SHAPES = {
  workday: { ok: (s) => /^\d+\|[A-Za-z0-9-]+\|[A-Za-z0-9_-]+$/.test(s),
    message: "A Workday board is \"wdN|tenant|site\" — e.g. 5|zoom|Zoom for https://zoom.wd5.myworkdayjobs.com/Zoom. Paste the careers page URL instead and it is read for you." },
  oracle: { ok: (s) => !!parseOracleSlug(s),
    message: "An Oracle Recruiting Cloud board is \"<host>|<site>\" — e.g. fa-xxxx.fa.ocs.oraclecloud.com|CX_1. Paste the careers page URL instead." },
  taleo: { ok: (s) => !!parseTaleoSlug(s),
    message: "A Taleo board is \"<tenant>|<section>\" — e.g. hdr|ex for https://hdr.taleo.net/careersection/ex/jobsearch.ftl. Paste the careers page URL instead." },
  // 46b: a SuccessFactors Career Site Builder board is the career site's own host (services/jobs/sources/successfactors.js).
  successfactors: { ok: (s) => isCsbHost(s),
    message: "A SuccessFactors career site is its host — e.g. careers.bv.com (the site whose postings read /job/<title>/<id>/)." },
};
const AUDIT = { ADD: "company_add", ACTIVE: "company_active" };

/** Every configured company with what the board actually holds from it. */
// ⛔ A162 (46a): the per-company correlated subqueries here were whole scans of scraped_jobs each (lower() = lower() —
// no index), and froze the site whenever Admin → Companies opened. The counts come from ONE grouped pass
// (services/companyHeat.js boardCounts — the admin route passes the read pool's copy of it).
export function listCompanies(db, { counts = null } = {}) {
  const board = counts || boardCounts(db);
  return db.prepare(`
    SELECT c.id, c.company, lower(c.company) AS k, c.ats_type, c.ats_slug, c.active, c.bucket_role, c.created_at
    FROM company_ats_list c ORDER BY c.active DESC, c.company COLLATE NOCASE
  `).all().map(({ k, ...c }) => { const n = countsFor(board, c.ats_type, k); return { ...c, active_rows: n.active_rows, last_new_at: n.last_any_at }; });
}

/**
 * Slugs users' captures and admin imports have named that are NOT configured — A45's harvest, read
 * from job_captures (A62). Ranked by how many distinct people brought one in.
 */
export function harvestedSuggestions(db, limit = 50) {
  let rows;
  try {
    rows = db.prepare(`
      SELECT jc.ats_type, jc.ats_slug, COUNT(*) AS captures, COUNT(DISTINCT jc.user_id) AS people,
             MAX(jc.created_at) AS last_at, MAX(jc.url) AS sample_url
      FROM job_captures jc
      WHERE jc.ats_type IS NOT NULL AND jc.ats_slug IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM company_ats_list c WHERE c.ats_type = jc.ats_type AND lower(c.ats_slug) = lower(jc.ats_slug))
      GROUP BY jc.ats_type, lower(jc.ats_slug)
      ORDER BY people DESC, captures DESC LIMIT ?
    `).all(limit * 2);
  } catch { return []; }   // a database without migration 122
  // ⛔ 46a (owner 11-10: "workday · zoom" → Use → Probe → network error): a capture records Workday's TENANT ("zoom"), but
  // the board is "wdN|tenant|site" — so the suggestion could never be probed, and the configured check (on the tenant)
  // never matched a configured "5|zoom|Zoom". The full pair is read from a captured posting's own URL with the crawl's one
  // URL parser; a suggestion whose full board is configured is left out; one that cannot be completed says so (needsUrl).
  const configured = new Set(db.prepare("SELECT ats_type || ':' || lower(ats_slug) FROM company_ats_list").pluck().all());
  const out = [];
  for (const r of rows) {
    let slug = r.ats_slug, needsUrl = false;
    if (SLUG_SHAPES[r.ats_type] && !SLUG_SHAPES[r.ats_type].ok(String(slug))) {
      const p = r.sample_url ? harvestPairOf(r.sample_url) : null;
      if (p?.atsType === r.ats_type && SLUG_SHAPES[r.ats_type].ok(p.slug)) slug = p.slug; else needsUrl = true;
    }
    if (configured.has(`${r.ats_type}:${String(slug).toLowerCase()}`)) continue;
    out.push({ ats_type: r.ats_type, ats_slug: slug, captures: r.captures, people: r.people, last_at: r.last_at, ...(needsUrl ? { needsUrl: true } : {}) });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Probe a board. Distinguishes the three states the strategy doc names:
 *   dead     the ATS answered 404 / not found — the slug is wrong or the board is gone
 *   empty    the board answered with zero postings — alive, nothing to crawl today
 *   live     postings, with how many carry positive US evidence (queue 37 would admit only those)
 *   no_descriptions  postings, but no job text inline and none through the detail fetch (D20)
 */
export async function validateBoard({ atsType, slug, company = "", fetchers = ATS_FETCHERS, describe = defaultDescribe }) {
  const fetch = fetchers[atsType];
  if (!fetch) return { ok: false, state: "unsupported", message: `No crawler for "${atsType}".` };
  if (!SLUG_RE.test(String(slug || ""))) return { ok: false, state: "invalid", message: "That slug has characters no board slug has." };
  // ⛔ 46a (owner 11-10: Probe on "workday · zoom" → "could not be read (network error)"): a multi-part slug that is
  // incomplete built a host that does not exist (zoom.wdundefined.myworkdayjobs.com), and DNS failing read as a network
  // error. Said plainly now, before anything is fetched — with the shape and where to find it.
  const shapeMiss = SLUG_SHAPES[atsType] && !SLUG_SHAPES[atsType].ok(String(slug));
  if (shapeMiss) return { ok: false, state: "invalid", message: SLUG_SHAPES[atsType].message };
  let jobs;
  try {
    jobs = await fetch(slug, company || slug, []);
  } catch (e) {
    const status = e?.response?.status ?? e?.status ?? null;
    if (status === 404 || status === 410) return { ok: false, state: "dead", status, message: `The board answered ${status} — the slug is wrong or the board is gone.` };
    return { ok: false, state: "error", status, message: `The board could not be read (${status ?? e?.code ?? "network error"}). Try again; do not enable on this.` };
  }
  const list = Array.isArray(jobs) ? jobs : [];
  if (!list.length) return { ok: true, state: "empty", jobs: 0, us: 0, sample: [],
    message: "The board is alive but has no postings right now. Enabling it is safe; it will add nothing until it posts." };
  const us = list.filter(j => usEligibility({ location: j.location, description: j.description, offices: [] }).admit).length;
  const descriptions = await descriptionCoverage(list, atsType, describe);
  const base = { jobs: list.length, us, descriptions, sample: list.slice(0, 5).map(j => ({ title: j.title, location: j.location })),
    companyGuess: list[0]?.company || null };
  // ⛔ D4 / D20: never enable a board at 0% description coverage. Ubisoft, Bosch and Adobe were seeded
  // inactive for exactly this — 648 rows enrichment could never read. A list endpoint that carries no
  // text (SmartRecruiters, Workday) passes only if the detail fetch the enrichment pass uses actually
  // returns text for a sample of its postings.
  if (descriptions.inline === 0 && descriptions.reachable === 0) {
    return { ok: false, state: "no_descriptions", ...base,
      message: `${list.length} posting(s), but none carries a description and ${descriptions.sampled ? `0 of ${descriptions.sampled} sampled detail pages returned one` : "there is no detail fetch for this ATS"} — every row would be unenrichable. Do not enable it.` };
  }
  return { ok: true, state: "live", ...base,
    message: `${list.length} posting(s); ${us} with positive US evidence — only those reach the board. Descriptions: ${descriptions.note}.` };
}

const DETAIL_SAMPLE = 3;
const defaultDescribe = row => fetchDescription(row, { maxRetries: 0, timeoutMs: 10000 });

/**
 * How many postings carry job text inline, and — when none do — whether the enrichment pass's detail
 * fetch can reach it, measured on up to DETAIL_SAMPLE postings. `reachable` is a sample count, not a
 * projection.
 */
export async function descriptionCoverage(list, atsType, describe = defaultDescribe) {
  const inline = list.filter(j => String(j.description || "").trim().length > 0).length;
  if (inline > 0) {
    return { inline, of: list.length, sampled: 0, reachable: 0,
      note: `${inline} of ${list.length} inline (${Math.round((inline / list.length) * 100)}%)` };
  }
  if (!hasDetailFetcher(atsType) || !describe) {
    return { inline: 0, of: list.length, sampled: 0, reachable: 0, note: "none inline, no detail fetch" };
  }
  const sample = list.filter(j => j.url).slice(0, DETAIL_SAMPLE);
  let reachable = 0;
  for (const j of sample) {
    const r = await describe({ job_id: j.id ?? null, source: atsType, url: j.url, company: j.company ?? null });
    if (r?.ok) reachable++;
  }
  return { inline: 0, of: list.length, sampled: sample.length, reachable,
    note: `none inline; the detail fetch returned text for ${reachable} of ${sample.length} sampled` };
}

function audit(db, adminUserId, action, target, before, after) {
  try {
    const a = auditActorColumns(adminUserId);   // D95: an actor — admin:adm_… · user:N · system
    db.prepare("INSERT INTO admin_audit_log (admin_user_id, actor_kind, actor, action, target, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(a.admin_user_id, a.actor_kind, a.actor, action, String(target), before == null ? null : JSON.stringify(before), JSON.stringify(after));
  } catch { /* a database without migration 119 still works; the log is what is lost */ }
}

// ── D80 · which companies: hiring evidence, never list membership ─────────────────────────────────────
// ⛔ ONE SLUG, MANY EMPLOYERS corrupts company attribution (the "Localhost" class): a VC / accelerator
// portfolio board (`Pear-VC`) serves jobs from dozens of companies under one name. Refused by slug or name.
const PORTFOLIO_SLUG = /(^|[-_.])(vc|ventures?|portfolio|accelerator|incubator)([-_.]|$)/i;
const PORTFOLIO_SLUGS = new Set(["pear-vc", "pearvc", "a16z", "sequoia", "ycombinator", "workatastartup", "accel", "greylock", "kleinerperkins"]);
// ⛔ Staffing and recruiting agencies post for "a confidential employer" — not a company a candidate can target.
const AGENCY_NAME = /\b(staffing|recruit(?:ing|ers|ment)|talent\s+(?:solutions|partners|acquisition\s+partners)|search\s+partners|headhunt\w*|placement)\b/i;

/** Why this company may never be configured, or null. */
export function excludedCompany({ company = "", slug = "" } = {}) {
  const s = String(slug).toLowerCase();
  if (PORTFOLIO_SLUGS.has(s) || PORTFOLIO_SLUG.test(s)) return "portfolio_board";
  if (AGENCY_NAME.test(String(company))) return "staffing_agency";
  return null;
}

/**
 * ⛔ D80 A · the admission rule over a probe row (scripts/d78TrancheProbe.mjs): a company with NO in-scope
 * posting, or none within the age limit, is not admitted. `minRecent` is the owner's bar (D80 §A proposes 5;
 * 1 is the floor the rule itself sets). `approved` — the owner's list; a company not on it is refused.
 */
export function admitFromProbe(row, { approved = null, minRecent = 1 } = {}) {
  const key = `${row.atsType}:${String(row.slug).toLowerCase()}`;
  if (approved && !approved.has(key)) return { admit: false, reason: "not_approved" };
  const excluded = excludedCompany({ company: row.company, slug: row.slug });
  if (excluded) return { admit: false, reason: excluded };
  if (row.state !== "live") return { admit: false, reason: `board_${row.state}` };
  if (!(row.csOpen > 0)) return { admit: false, reason: "no_in_scope_postings" };
  if (!(row.cs >= minRecent)) return { admit: false, reason: row.cs > 0 ? "too_few_recent" : "none_recent" };
  return { admit: true, reason: "ok" };
}

/** The evidence line stored with a company (D80 D). */
export function evidenceLine(row, { source, date = new Date().toISOString().slice(0, 10) } = {}) {
  const pct = row.pct120 == null ? "" : `, ${row.pct120}% <= 120d`;
  const recent = row.pct30 == null ? "" : `, ${row.pct30}% <= 30d`;
  return `${source}; probe ${date}: ${row.cs} in-scope <= 120d of ${row.csOpen} in-scope open${pct}${recent}`;
}

export function addCompany(db, { company, atsType, slug, bucketRole = null, adminUserId = null, evidence = null }) {
  // ⛔ D80: no company is configured without a stored reason, and never a portfolio board or an agency.
  if (!evidence || !String(evidence).trim()) return { ok: false, code: "evidence_required" };
  const excluded = excludedCompany({ company, slug });
  if (excluded) return { ok: false, code: excluded };
  const existing = db.prepare("SELECT * FROM company_ats_list WHERE ats_type = ? AND lower(ats_slug) = lower(?)").get(atsType, slug);
  if (existing) return { ok: false, code: "exists", company: existing };
  const id = db.prepare("INSERT INTO company_ats_list (company, ats_type, ats_slug, active, bucket_role, evidence) VALUES (?, ?, ?, 1, ?, ?)")
    .run(String(company).trim(), atsType, slug, bucketRole, String(evidence).trim()).lastInsertRowid;
  const row = db.prepare("SELECT * FROM company_ats_list WHERE id = ?").get(id);
  audit(db, adminUserId, AUDIT.ADD, `${atsType}:${slug}`, null, row);
  return { ok: true, company: row };
}

export function setCompanyActive(db, { id, active, adminUserId = null }) {
  const before = db.prepare("SELECT * FROM company_ats_list WHERE id = ?").get(Number(id));
  if (!before) return { ok: false, code: "not_found" };
  db.prepare("UPDATE company_ats_list SET active = ? WHERE id = ?").run(active ? 1 : 0, before.id);
  const after = db.prepare("SELECT * FROM company_ats_list WHERE id = ?").get(before.id);
  audit(db, adminUserId, AUDIT.ACTIVE, `${before.ats_type}:${before.ats_slug}`, before, after);
  return { ok: true, company: after };
}
