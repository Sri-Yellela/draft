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
import { csScopeOf, CS_SCOPE_VERSION } from './csScope.js';
import { classifyJob } from './classifyJob.js';
import { readPolicy, boardStmts, retireRows } from './boardAge.js';

export const SCOPE_REASON = 'out_of_scope';

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
  if (csScopeOf({ title: job.title, roleKey }).inScope) return 'keep';
  if (!policy.scope_enforce) return 'would_drop';               // report-only until the owner's go
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
    const v = csScopeOf({ title: r.title, roleKey });
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
  const base = { dryRun, enforced: !!policy.scope_enforce, version: CS_SCOPE_VERSION, active, candidates: out.length, appliedKept,
                 retired: 0, share,
                 byReason, byFamily, byCompany: Object.entries(byCompany).sort((a, b) => b[1] - a[1]).slice(0, 25) };
  if (dryRun || !out.length) return base;
  retireRows(db, out, SCOPE_REASON, now);
  log?.({ kind: 'scope_sweep', retired: out.length, active, share, version: CS_SCOPE_VERSION });
  return { ...base, retired: out.length };
}
