// services/jobs/boardScope.js — ⛔ D78 B · COMPUTER SCIENCE ONLY, at the crawl and at a braked sweep.
//
// The rule is csScope.js (pure, over the classifier's family + the title). This file applies it, the way
// boardAge.js applies the age limit — and shares its applied exemption and its retire-and-record step, so the two board rules cannot drift apart (A93: built once).
//   · ⛔ OFF until the owner's go: while board_policy.scope_enforce = 0 the crawl only COUNTS what the rule
//     would drop (`wouldScopeOut`) and writes every posting as before. The production dry run (10-08:
//     945 of 1,942 out, 48.7%) is the reason it does not start on.
//   · Enforced: a NEW out-of-scope posting is never written (rejected_jobs `out_of_scope`); an EXISTING one
//     is retired at the crawl — BEFORE the hash check, by its stored family, because the "seen, unchanged"
//     touch would re-activate it — and by the sweep. ⛔ An APPLIED posting is kept, always.
//   · The sweep is dry by default, retires and never deletes; the reason column is the undo. ⛔ No share
//     limit (removed on the owner's word 10-08, as for the age sweep).
//
// ⛔ D126 + D127 (owner 11-01): the rule is now professionalScope.categoryOf — every professional category, the held
// groups and anything without a title signal HELD (the red-flag rule). Computing is csScope's rule, unchanged. A held
// posting is refused exactly as an out-of-scope one was (enforced) or stored as category 'held' (report-only), and
// every kept posting carries its category, which the board matches against the profile's own.
import { categoryOf, CATEGORY_SCOPE_VERSION } from './professionalScope.js';
import { classifyJob } from './classifyJob.js';
import { readPolicy, boardStmts, retireRows } from './boardAge.js';

export const SCOPE_REASON = 'out_of_scope';
export const HELD_CATEGORY = 'held';

const CATEGORY_WRITE = new WeakMap();
/**
 * Store a verdict's category on the posting (migration 207). A held verdict stores 'held' and its reason, so no board
 * shows it. A no-op on a database without the columns (an older test schema).
 */
export function writeCategory(db, jobId, v) {
  let s = CATEGORY_WRITE.get(db);
  if (s === undefined) {
    try {
      s = db.prepare(`UPDATE scraped_jobs SET board_category = @category, soc = @soc, discipline = @discipline,
        category_confidence = @confidence, category_reason = @reason WHERE job_id = @jobId`);
    } catch { s = null; }
    CATEGORY_WRITE.set(db, s);
  }
  if (!s) return;
  s.run({ jobId, category: v.inScope ? v.category : HELD_CATEGORY, soc: v.soc, discipline: v.discipline,
          confidence: v.confidence, reason: v.reason });
}

/**
 * Classify every ACTIVE posting with no category yet (the rows from before 207, and any a crawl wrote without one).
 * Pure regex over titles: a few thousand rows take milliseconds. Returns the counts.
 * ⛔⛔ D153 (3): NO LONGER RUN AT BOOT — one statement + one transaction over the whole backlog is whole-board work on
 * the event loop at 80k postings. The boot runs classifyBacklog.js instead (rowid pages, a yield between them, after
 * ready); this stays for a script or a small database.
 */
export function backfillCategories(db, { limit = 100000 } = {}) {
  let rows;
  try {
    rows = db.prepare(`SELECT job_id, title, description, company FROM scraped_jobs
                       WHERE is_active = 1 AND board_category IS NULL LIMIT ?`).all(limit);
  } catch { return { classified: 0, held: 0, skipped: 'no category column' }; }
  let held = 0;
  db.transaction(() => {
    for (const r of rows) {
      const v = categoryOf({ title: r.title, roleKey: storedFamily(db, r) });
      if (!v.inScope) held++;
      writeCategory(db, r.job_id, v);
    }
  })();
  return { classified: rows.length, held, version: CATEGORY_SCOPE_VERSION };
}

const ROLE = new WeakMap();
// The classifier's own row first (source_profile_id NULL) — a profile-scrape row only when there is no other.
function storedRoleStmt(db) {
  let s = ROLE.get(db);
  if (!s) {
    s = db.prepare(`SELECT role_key FROM job_role_map WHERE job_id = ?
                    ORDER BY (source_profile_id IS NULL) DESC, created_at ASC LIMIT 1`).pluck();
    ROLE.set(db, s);
  }
  return s;
}

/** The family a stored posting was filed under; re-classified when it has no role row. */
export function storedFamily(db, { job_id, title, description, company }) {
  const k = storedRoleStmt(db).get(job_id);
  if (k !== undefined) return k;
  const v = classifyJob(title || '', description || '', company || '');
  return v.collar === 'blue' ? null : v.roleKey;
}

/**
 * ⛔ The crawl's scope gate. Called BEFORE the hash check for an EXISTING row (roleKey = its stored family)
 * and after classification for a NEW one (roleKey = the verdict's).
 * @returns {"keep" | "would_drop" | "rejected_new" | "scoped_out"} — the caller `continue`s on the last two.
 */
export function scopeGate(db, job, jobId, { exists, roleKey, now, policy = readPolicy(db) }) {
  const v = categoryOf({ title: job.title, roleKey });
  if (v.inScope) { if (exists) writeCategory(db, jobId, v); return 'keep'; }
  if (!policy.scope_enforce) { if (exists) writeCategory(db, jobId, v); return 'would_drop'; }  // report-only: stored 'held'
  const s = boardStmts(db);
  const row = { job_id: jobId, title: job.title || '', company: job.company || '', source: job.source || '', rejected_at: now };
  if (!exists) { s.reject.run({ ...row, reason: SCOPE_REASON }); return 'rejected_new'; }
  if (s.applied.get(jobId, jobId)) return 'keep';                // ⛔ an application keeps its posting
  s.retire.run(jobId);
  s.reject.run({ ...row, reason: SCOPE_REASON });
  return 'scoped_out';
}

/**
 * ⛔ The SWEEP: every active, un-applied posting the rule puts out of scope. DRY BY DEFAULT.
 */
export function sweepScope(db, { dryRun = true, now = Math.floor(Date.now() / 1000), policy = readPolicy(db), log = null } = {}) {
  const active = db.prepare('SELECT COUNT(*) FROM scraped_jobs WHERE is_active = 1').pluck().get();
  const rows = db.prepare(`SELECT sj.job_id, sj.title, sj.company, sj.source, sj.description,
      EXISTS (SELECT 1 FROM user_jobs uj WHERE uj.job_id = sj.job_id AND uj.applied = 1)
        OR EXISTS (SELECT 1 FROM job_applications ja WHERE ja.job_id = sj.job_id) AS applied
    FROM scraped_jobs sj WHERE sj.is_active = 1`).all();
  const out = [];
  let appliedKept = 0;
  const byReason = {}, byFamily = {}, byCompany = {};
  for (const r of rows) {
    const roleKey = storedFamily(db, r);
    const v = categoryOf({ title: r.title, roleKey });
    if (v.inScope) continue;
    if (r.applied) { appliedKept++; continue; }
    out.push(r);
    byReason[v.reason] = (byReason[v.reason] || 0) + 1;
    const fam = roleKey ?? '(none)';
    byFamily[fam] = (byFamily[fam] || 0) + 1;
    const co = r.company || '?';
    byCompany[co] = (byCompany[co] || 0) + 1;
  }
  const share = active ? +(out.length / active).toFixed(3) : 0;
  const base = { dryRun, enforced: !!policy.scope_enforce, version: CATEGORY_SCOPE_VERSION, active, candidates: out.length, appliedKept,
                 retired: 0, share,
                 byReason, byFamily, byCompany: Object.entries(byCompany).sort((a, b) => b[1] - a[1]).slice(0, 25) };
  if (dryRun || !out.length) return base;
  retireRows(db, out, SCOPE_REASON, now);
  log?.({ kind: 'scope_sweep', retired: out.length, active, share, version: CATEGORY_SCOPE_VERSION });
  return { ...base, retired: out.length };
}
