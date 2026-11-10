// services/companyCandidates.js — ⛔ D82 B/C/E · THE CANDIDATE POOL, the nightly probe, and their guards.
//
//   DISCOVER  HN weekly (services/jobs/hnDiscovery.js)                → runHnDiscovery
//   → POOL    company_candidates (migration 148)                       → poolCandidates
//   → PROBE   nightly, READ-ONLY, 25 at a time, ≥ 1 s between boards   → runCandidateProbe
//   → REVIEW  Admin → Companies → Candidates (routes/companies.js)     → listCandidates
//   → ADD     the owner's approval: backup · disk gate · D80 evidence  → approveCandidates (via addCompany)
//
// ⛔ A DISCOVERY JOB NEVER WRITES A COMPANY. runHnDiscovery and runCandidateProbe write company_candidates,
// discovery_breakers and one pipeline_runs row — nothing else. Only approveCandidates (an owner's press,
// confirmed twice) calls services/companyList.js addCompany, which itself refuses an add without evidence,
// a portfolio / VC board or a staffing agency (D80).
// ⛔ DEDUP: a pair already configured, already in the pool (any status — a REJECTED row stays rejected), or a
// company whose name is already configured is never queued again. ⛔ NEVER a portfolio / VC board, a staffing
// agency, or a deny-listed host (crawler_denylist, owner-editable, plus D80's never-sources).
// ⛔ GUARDS (D82 E): every run writes a pipeline_runs row (run_kind 'discovery', source 'hn' / 'probe');
// a per-source CIRCUIT BREAKER opens after BREAKER_AFTER consecutive failures and pauses that source until
// the owner resets it; DISCOVERY_PAUSED=1 stops every job before it reads anything.
import axios from "axios";
import { collectHn, isDeniedHost } from "./jobs/hnDiscovery.js";
import { probeBoard } from "./companyProbe.js";
import { addCompany, admitFromProbe, evidenceLine, excludedCompany } from "./companyList.js";
import { recordPipelineRun } from "./jobs/pipelineRunLog.js";
import { fetchDescription } from "./jobs/detailFetch.js";
import { toActor } from "./actor.js";

export const STATUSES = Object.freeze(["new", "probed", "approved", "rejected", "added", "dormant"]);
export const PROBE_BATCH = 25;
export const PROBE_GAP_MS = 1000;            // ≥ 1 s between boards; the detail sample is spaced the same
export const PROBE_FRESH_DAYS = 14;          // an approval acts on a probe no older than this
export const BREAKER_AFTER = 3;
export const SOURCES = Object.freeze(["hn", "probe"]);
const RUN_KIND = "discovery";
const nowS = () => Math.floor(Date.now() / 1000);
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

// ── the kill switch and the breaker ──────────────────────────────────────────────────────────────────
/** DISCOVERY_PAUSED — anything truthy-looking pauses (a kill switch fails toward stopped). */
export const discoveryPaused = (env = process.env) => /^(1|true|yes|on)$/i.test(String(env.DISCOVERY_PAUSED || "").trim());

export function breakerOf(db, source) {
  try { return db.prepare("SELECT * FROM discovery_breakers WHERE source = ?").get(source) || { source, failures: 0, open: 0 }; }
  catch { return { source, failures: 0, open: 1, last_error: "discovery_breakers unreadable (migration 148)" }; } // fail closed
}
export function listBreakers(db) { return SOURCES.map((s) => breakerOf(db, s)); }

function recordOutcome(db, source, { ok, error = null, now = nowS() }) {
  const cur = breakerOf(db, source);
  const failures = ok ? 0 : (cur.failures || 0) + 1;
  const open = !ok && failures >= BREAKER_AFTER ? 1 : cur.open ? 1 : 0;
  db.prepare(`INSERT INTO discovery_breakers (source, failures, open, opened_at, last_error, updated_at) VALUES (@source, @failures, @open, @opened, @err, @now)
              ON CONFLICT(source) DO UPDATE SET failures = @failures, open = @open, opened_at = @opened, last_error = @err, updated_at = @now`)
    .run({ source, failures, open, opened: open ? (cur.opened_at || now) : null, err: ok ? null : String(error || "failed").slice(0, 300), now });
  return { failures, open: !!open };
}

/** The owner closes a breaker (Admin → Companies → Candidates). */
export function resetBreaker(db, source, { now = nowS() } = {}) {
  if (!SOURCES.includes(source)) return { ok: false, code: "unknown_source" };
  db.prepare(`INSERT INTO discovery_breakers (source, failures, open, opened_at, last_error, updated_at) VALUES (?, 0, 0, NULL, NULL, ?)
              ON CONFLICT(source) DO UPDATE SET failures = 0, open = 0, opened_at = NULL, last_error = NULL, updated_at = excluded.updated_at`).run(source, now);
  return { ok: true, breaker: breakerOf(db, source) };
}

/** Why this job must not run now, or null. Checked before a single request is made. */
export function blockedBy(db, source, env = process.env) {
  if (discoveryPaused(env)) return "paused";
  if (breakerOf(db, source).open) return "breaker_open";
  return null;
}

function skipRun(db, source, reason, startedAt) {
  recordPipelineRun(db, { runKind: RUN_KIND, source, status: "skipped_unconfigured", startedAt,
    errorText: reason === "paused" ? "DISCOVERY_PAUSED is set" : `circuit breaker open after ${BREAKER_AFTER} consecutive failures`,
    details: { reason } });
  return { ran: false, reason };
}

// ── the pool ─────────────────────────────────────────────────────────────────────────────────────────
function denyList(db) {
  try { return db.prepare("SELECT domain FROM crawler_denylist").all().map((r) => r.domain); } catch { return []; }
}

/**
 * Pool discovered candidates. Only a candidate with a SUPPORTED ATS pair is queued (the probe needs one);
 * the rest are counted. @returns { inserted, refreshed, skipped: { reason: n } }
 */
export function poolCandidates(db, candidates, { source, now = nowS() } = {}) {
  const deny = denyList(db);
  const configuredPair = db.prepare("SELECT 1 FROM company_ats_list WHERE ats_type = ? AND lower(ats_slug) = lower(?)");
  const configuredNames = new Set(db.prepare("SELECT company FROM company_ats_list").all().map((r) => String(r.company).toLowerCase().trim()));
  const existing = db.prepare("SELECT id, source_json FROM company_candidates WHERE ats_type = ? AND ats_slug = ?");
  const insert = db.prepare(`INSERT INTO company_candidates (company, ats_type, ats_slug, source, source_json, status, first_seen, last_seen)
                             VALUES (?, ?, ?, ?, ?, 'new', ?, ?)`);
  const refresh = db.prepare("UPDATE company_candidates SET last_seen = ?, source_json = ? WHERE id = ?");
  const out = { inserted: 0, refreshed: 0, skipped: {} };
  const skip = (why) => { out.skipped[why] = (out.skipped[why] || 0) + 1; };
  db.transaction(() => {
    for (const c of candidates) {
      if (!c.ats) { skip(c.other ? "unsupported_ats" : "no_board"); continue; }
      const { atsType, slug, url } = c.ats;
      let host = null; try { host = new URL(url).hostname; } catch { /* a pair with no url: nothing to check */ }
      if (host && isDeniedHost(host, deny)) { skip("denied_host"); continue; }
      const excluded = excludedCompany({ company: c.company, slug });
      if (excluded) { skip(excluded); continue; }
      if (configuredPair.get(atsType, slug)) { skip("configured"); continue; }
      if (configuredNames.has(String(c.company).toLowerCase().trim())) { skip("configured_name"); continue; }
      const detail = JSON.stringify({ sources: c.sources, n_months: c.n_months, recent4: c.recent4, last: c.last, months: c.months,
        yc: c.yc, site: c.site, remote: c.remote, usHint: c.usHint, header: String(c.header || "").slice(0, 240), board: url, jobUrl: c.jobUrl || null });
      const row = existing.get(atsType, slug);
      if (row) { refresh.run(now, detail, row.id); out.refreshed++; continue; }   // status untouched: a rejected row stays rejected
      insert.run(c.company, atsType, slug, source, detail, now, now);
      out.inserted++;
    }
  })();
  return out;
}

// ── B · the HN job (weekly) ──────────────────────────────────────────────────────────────────────────
const defaultFetchJson = async (url) => (await axios.get(url, { timeout: 20000, headers: { "User-Agent": "draft-discovery/1 (+company discovery, weekly)" } })).data;

export async function runHnDiscovery(db, { env = process.env, fetchJson = defaultFetchJson, sleep = sleepMs, gapMs, now = nowS() } = {}) {
  const startedAt = nowS();
  const blocked = blockedBy(db, "hn", env);
  if (blocked) return skipRun(db, "hn", blocked, startedAt);
  try {
    const r = await collectHn({ fetchJson, sleep, now, ...(gapMs != null ? { gapMs } : {}) });
    const failedThreads = r.threads.filter((t) => t.error).length;
    if (!r.threads.length || failedThreads === r.threads.length) throw new Error(r.threads.length ? "every thread request failed" : "no Who is hiring? thread in the list");
    const pooled = poolCandidates(db, r.candidates, { source: "hn", now });
    const skipped = Object.values(pooled.skipped).reduce((a, b) => a + b, 0);
    recordPipelineRun(db, { runKind: RUN_KIND, source: "hn", status: pooled.inserted ? "ok" : "no_results", startedAt,
      fetched: r.candidates.length, written: pooled.inserted, unchanged: pooled.refreshed, skipped, failed: r.errors.length,
      details: { requests: r.requests.length, threads: r.threads, feed: r.feed, skippedBy: pooled.skipped, errors: r.errors.slice(0, 5) } });
    recordOutcome(db, "hn", { ok: true });
    return { ran: true, candidates: r.candidates.length, ...pooled, requests: r.requests.length, threads: r.threads.length };
  } catch (e) {
    recordPipelineRun(db, { runKind: RUN_KIND, source: "hn", status: "failed", startedAt, errorText: e.message });
    const b = recordOutcome(db, "hn", { ok: false, error: e.message });
    return { ran: true, failed: true, error: e.message, breaker: b };
  }
}

// ── C · the nightly probe — READ-ONLY on the boards, writes only its own table ───────────────────────
/** D80 A's proposed bar (the owner sets it): ≥ 5 in-scope · ≥ 40% ≤ 120 d · ≥ 90% described · ≥ 50% US. */
export function barOf(ev) {
  const d = ev.descriptions;
  const desc = !d ? null : d.inline > 0 ? Math.round((100 * d.inline) / d.of) : d.sampled ? Math.round((100 * d.reachable) / d.sampled) : 0;
  const misses = [];
  if (!((ev.csOpen || 0) >= 5)) misses.push("in-scope < 5");
  if (!((ev.pct120 ?? 0) >= 40)) misses.push("<= 120d < 40%");
  if (desc != null && desc < 90) misses.push("described < 90%");
  if (!((ev.usPct ?? 0) >= 50)) misses.push("US < 50%");
  return { meets: misses.length === 0, misses, describedPct: desc };
}
/** Ranked by fresh in-scope postings, capped, weighted by recency (D80 A): 8 recent roles outrank 200 stale. */
export const rankScore = (ev) => (ev.state === "live" ? Math.min(ev.cs || 0, 30) + Math.min(ev.cs30 || 0, 15) : 0);

function evidenceOf(p, now) {
  return { state: p.state, message: p.message, jobs: p.jobs ?? p.fetched ?? 0, us: p.us ?? 0, cs: p.cs ?? 0, csOpen: p.csOpen ?? 0,
    cs30: p.cs30 ?? 0, pct30: p.pct30 ?? null, pct120: p.pct120 ?? null, medianAge: p.medianAge ?? null, salaryPct: p.salaryPct ?? null,
    usPct: p.usPct ?? null, descriptions: p.descriptions ? { inline: p.descriptions.inline, of: p.descriptions.of, sampled: p.descriptions.sampled, reachable: p.descriptions.reachable } : null,
    sample: (p.sample || []).map((s) => s.title).slice(0, 5), probedAt: now };
}

export async function runCandidateProbe(db, { env = process.env, probe = probeBoard, limit = PROBE_BATCH, gapMs = PROBE_GAP_MS,
                                              sleep = sleepMs, now = nowS() } = {}) {
  const startedAt = nowS();
  const blocked = blockedBy(db, "probe", env);
  if (blocked) return skipRun(db, "probe", blocked, startedAt);
  try {
    const rows = db.prepare(`SELECT * FROM company_candidates WHERE status = 'new'
                             ORDER BY probed_at IS NOT NULL, probed_at, first_seen, id LIMIT ?`).all(Math.max(1, Math.min(limit, PROBE_BATCH)));
    const configured = db.prepare("SELECT 1 FROM company_ats_list WHERE ats_type = ? AND lower(ats_slug) = lower(?)");
    const save = db.prepare(`UPDATE company_candidates SET evidence_json = ?, rank_score = ?, status = ?, status_reason = ?, probed_at = ? WHERE id = ?`);
    // ⛔ ≤ 1 request a second per host: the detail-page sample is spaced like the boards are.
    const describe = async (row) => { await sleep(gapMs); return fetchDescription(row, { maxRetries: 0, timeoutMs: 10000 }); };
    let probed = 0, errored = 0, skipped = 0;
    for (const [i, r] of rows.entries()) {
      if (configured.get(r.ats_type, r.ats_slug)) {           // configured since it was pooled
        save.run(r.evidence_json, r.rank_score, "rejected", "already_configured", r.probed_at, r.id); skipped++; continue;
      }
      if (i > 0) await sleep(gapMs);
      let p;
      try { p = await probe({ atsType: r.ats_type, slug: r.ats_slug, company: r.company }, { now, describe }); }
      catch (e) { p = { state: "error", message: e.message }; }
      const ev = evidenceOf(p, now);
      if (p.state === "error") { save.run(JSON.stringify(ev), 0, "new", "probe_error", now, r.id); errored++; continue; }
      const admit = admitFromProbe({ ...ev, atsType: r.ats_type, slug: r.ats_slug, company: r.company });
      const bar = barOf(ev);
      save.run(JSON.stringify({ ...ev, admit: admit.reason, bar }), rankScore(ev), "probed", admit.reason, now, r.id);
      probed++;
    }
    const allFailed = errored > 0 && probed === 0;
    recordPipelineRun(db, { runKind: RUN_KIND, source: "probe", status: allFailed ? "failed" : rows.length ? "ok" : "no_results", startedAt,
      fetched: rows.length, written: probed, failed: errored, skipped, errorText: allFailed ? `all ${errored} probe(s) errored` : null });
    recordOutcome(db, "probe", { ok: !allFailed, error: allFailed ? `all ${errored} probe(s) errored` : null });
    return { ran: true, considered: rows.length, probed, errored, skipped };
  } catch (e) {
    recordPipelineRun(db, { runKind: RUN_KIND, source: "probe", status: "failed", startedAt, errorText: e.message });
    const b = recordOutcome(db, "probe", { ok: false, error: e.message });
    return { ran: true, failed: true, error: e.message, breaker: b };
  }
}

// ── REVIEW and the owner's decision ──────────────────────────────────────────────────────────────────
const parse = (s) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };
const STATUS_ORDER = "CASE status WHEN 'probed' THEN 0 WHEN 'new' THEN 1 WHEN 'approved' THEN 2 WHEN 'added' THEN 3 WHEN 'rejected' THEN 4 ELSE 5 END";

export function listCandidates(db, { status = null, limit = 200 } = {}) {
  const rows = status
    ? db.prepare(`SELECT * FROM company_candidates WHERE status = ? ORDER BY rank_score DESC, last_seen DESC LIMIT ?`).all(status, limit)
    // 45s (owner 11-09, "i dont see anything in there"): every row still waiting for a decision is listed, however many there
    // are — the 200-row cap only trims the decided ones (added / rejected), which used to push fresh 'new' rows off the list.
    : [...db.prepare(`SELECT * FROM company_candidates WHERE status IN ('probed','new','approved') ORDER BY ${STATUS_ORDER}, rank_score DESC, last_seen DESC LIMIT 2000`).all(),
       ...db.prepare(`SELECT * FROM company_candidates WHERE status NOT IN ('probed','new','approved') ORDER BY ${STATUS_ORDER}, rank_score DESC, last_seen DESC LIMIT ?`).all(limit)];
  const counts = Object.fromEntries(db.prepare("SELECT status, COUNT(*) n FROM company_candidates GROUP BY status").all().map((r) => [r.status, r.n]));
  return { candidates: rows.map((r) => ({ ...r, source_json: undefined, evidence_json: undefined, found: parse(r.source_json), evidence: parse(r.evidence_json) })), counts };
}

export function discoveryStatus(db, env = process.env) {
  let lastRuns = [];
  try {
    lastRuns = db.prepare(`SELECT source, status, started_at, fetched, written, failed, error_text FROM pipeline_runs
                           WHERE run_kind = 'discovery' AND id IN (SELECT MAX(id) FROM pipeline_runs WHERE run_kind = 'discovery' GROUP BY source)`).all();
  } catch { /* pre-069 */ }
  return { paused: discoveryPaused(env), breakers: listBreakers(db), breakerAfter: BREAKER_AFTER, lastRuns };
}

/** Which of these ids an approval would add, and why each other one is refused. Read-only. */
export function planApproval(db, ids, { now = nowS() } = {}) {
  const eligible = [], refused = [];
  const configured = db.prepare("SELECT 1 FROM company_ats_list WHERE ats_type = ? AND lower(ats_slug) = lower(?)");
  for (const id of [...new Set((ids || []).map(Number).filter(Number.isInteger))].sort((a, b) => a - b)) {
    const r = db.prepare("SELECT * FROM company_candidates WHERE id = ?").get(id);
    if (!r) { refused.push({ id, reason: "not_found" }); continue; }
    const ev = parse(r.evidence_json);
    if (r.status !== "probed" || !ev) { refused.push({ id, company: r.company, reason: `status_${r.status}` }); continue; }
    if (!(r.probed_at >= now - PROBE_FRESH_DAYS * 86400)) { refused.push({ id, company: r.company, reason: "probe_stale" }); continue; }
    if (configured.get(r.ats_type, r.ats_slug)) { refused.push({ id, company: r.company, reason: "already_configured" }); continue; }
    const admit = admitFromProbe({ ...ev, atsType: r.ats_type, slug: r.ats_slug, company: r.company });
    if (!admit.admit) { refused.push({ id, company: r.company, reason: admit.reason }); continue; }
    eligible.push({ id, company: r.company, atsType: r.ats_type, slug: r.ats_slug, cs: ev.cs, csOpen: ev.csOpen, pct120: ev.pct120 });
  }
  return { eligible, refused };
}

/** The evidence stored with the company (D80 D): how it was found, and what the probe measured. */
export function candidateEvidence(r, ev, { now = nowS() } = {}) {
  const f = parse(r.source_json) || {};
  const found = r.source === "hn" ? `hn ${f.last || "?"}, ${f.n_months || 0} month(s) hiring${f.yc ? `, YC ${f.yc}` : ""}` : r.source;
  return evidenceLine(ev, { source: `${found}; candidate #${r.id}`, date: new Date(now * 1000).toISOString().slice(0, 10) });
}

/**
 * ⛔ The owner's approval. The caller has already passed the disk gate and taken the backup. Adds each
 * eligible candidate through addCompany WITH its evidence; a refused add stays 'approved' with the reason.
 */
export function approveCandidates(db, plan, { adminUserId = null, now = nowS() } = {}) {
  const added = [], failed = [];
  const mark = db.prepare("UPDATE company_candidates SET status = ?, status_reason = ?, decided_at = ?, decided_by = ?, decided_by_actor = ? WHERE id = ?");
  const by = toActor(adminUserId);
  for (const e of plan.eligible) {
    const r = db.prepare("SELECT * FROM company_candidates WHERE id = ?").get(e.id);
    const out = addCompany(db, { company: r.company, atsType: r.ats_type, slug: r.ats_slug, adminUserId,
      evidence: candidateEvidence(r, parse(r.evidence_json), { now }) });
    if (out.ok) { mark.run("added", `company #${out.company.id}`, now, by.userId, by.ref, r.id); added.push({ id: r.id, companyId: out.company.id }); }
    else { mark.run("approved", out.code, now, by.userId, by.ref, r.id); failed.push({ id: r.id, reason: out.code }); }
  }
  return { added, failed };
}

export function rejectCandidates(db, ids, { adminUserId = null, reason = "owner", now = nowS() } = {}) {
  const by = toActor(adminUserId);
  const st = db.prepare(`UPDATE company_candidates SET status = 'rejected', status_reason = ?, decided_at = ?, decided_by = ?, decided_by_actor = ?
                         WHERE id = ? AND status IN ('new', 'probed', 'approved')`);
  let n = 0;
  for (const id of (ids || []).map(Number).filter(Number.isInteger)) n += st.run(String(reason).slice(0, 120), now, by.userId, by.ref, id).changes;
  return { rejected: n };
}
