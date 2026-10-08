// services/jobs/boardAge.js — ⛔ D78 A · THE AGE LIMIT: posted within 120 days, at the door and at the sweep.
//
// Owner, 10-09: "posted within 120 days … not hide, just remove jobs past 120 days unless the user applies for it".
//   · AT THE DOOR (cacheJobs, before the hash check — like the US gate): a NEW posting older than the limit is
//     never written (rejected_jobs `too_old`). That removes nothing from the board, so it is always on.
//   · AN EXISTING posting past the limit is RETIRED (is_active = 0, rejected_jobs `aged_out`) — at the crawl
//     (otherwise the crawl's "seen, unchanged" touch would re-activate it every morning) and by the daily
//     SWEEP (for rows no crawl returns any more) — ⛔ ONLY once the owner switches `age_enforce` on, after
//     the dry run (the first pass may be large: the board holds cards 177 and 363 days old).
//   · ⛔ A posting a user APPLIED to is exempt, always. Starred / drafted / imported ones leave the board and
//     stay in the user's own lists (D43: "no longer listed"). ⛔ RETIRE, NEVER DELETE: `aged_out` is the undo.
//   · ⛔ A NULL date is never a reason to drop: the age falls back to first seen (for a new row: now).
//   · ⛔ THE SWEEP CARRIES A BRAKE: a dry run by default, and it refuses to retire more than CEILING_SHARE of
//     the active board in one pass unless explicitly forced.
// The policy is one row (board_policy, migration 146) — changed from Admin with no redeploy.

export const DEFAULT_LIMIT_DAYS = 120;
export const CEILING_SHARE = 0.30;
const DAY = 86400;

export function readPolicy(db) {
  try {
    const p = db.prepare("SELECT * FROM board_policy WHERE id = 1").get();
    if (p) return p;
  } catch { /* before migration 146 */ }
  return { id: 1, age_limit_days: DEFAULT_LIMIT_DAYS, age_enforce: 0, scope_enforce: 0 };
}

/** Admin: change the policy. Only known fields, validated. */
export function setPolicy(db, patch = {}, { by = null, now = Math.floor(Date.now() / 1000) } = {}) {
  const cur = readPolicy(db);
  const next = { ...cur };
  if ("age_enforce" in patch) next.age_enforce = patch.age_enforce ? 1 : 0;
  if ("scope_enforce" in patch) next.scope_enforce = patch.scope_enforce ? 1 : 0;
  if ("age_limit_days" in patch) {
    const n = Number(patch.age_limit_days);
    if (!Number.isInteger(n) || n < 30 || n > 730) throw Object.assign(new Error("age_limit_days: 30–730"), { status: 400 });
    next.age_limit_days = n;
  }
  db.prepare(`UPDATE board_policy SET age_limit_days = @age_limit_days, age_enforce = @age_enforce, scope_enforce = @scope_enforce,
              updated_at = @now, updated_by = @by WHERE id = 1`).run({ ...next, now, by });
  return readPolicy(db);
}

const toEpoch = (v) => { const t = Date.parse(String(v || "")); return Number.isFinite(t) ? Math.floor(t / 1000) : null; };

/**
 * How old is this posting? `posted_at` when it parses; else first seen (a new row has not been seen: now).
 * @returns {{ days: number, basis: "posted_at" | "first_seen", tooOld: boolean }}
 */
export function ageOf({ posted_at = null, first_seen = null } = {}, { now = Math.floor(Date.now() / 1000), limitDays = DEFAULT_LIMIT_DAYS } = {}) {
  const posted = toEpoch(posted_at);
  const at = posted ?? (Number.isFinite(first_seen) ? first_seen : now);
  const days = Math.floor((now - at) / DAY);
  return { days, basis: posted ? "posted_at" : "first_seen", tooOld: days > limitDays };
}

/** The SQL the sweep and the dry run share: active, past the limit by the same rule, not applied. */
export function agedSql(limitDays, now) {
  const cutoff = now - limitDays * DAY;
  return `sj.is_active = 1
    AND COALESCE(CAST(strftime('%s', sj.posted_at) AS INTEGER), COALESCE(sj.discovered_at, sj.scraped_at)) < ${cutoff}
    AND NOT EXISTS (SELECT 1 FROM user_jobs uj WHERE uj.job_id = sj.job_id AND uj.applied = 1)
    AND NOT EXISTS (SELECT 1 FROM job_applications ja WHERE ja.job_id = sj.job_id)`;
}

/** Prepared statements for the crawl's gates — one set per connection. Shared with boardScope.js (D78 B):
 *  the applied exemption and the retire-and-record step are written once. */
const STMTS = new WeakMap();
export function boardStmts(db) {
  let s = STMTS.get(db);
  if (s) return s;
  s = {
    applied: db.prepare(`SELECT 1 FROM user_jobs WHERE job_id = ? AND applied = 1
                         UNION SELECT 1 FROM job_applications WHERE job_id = ? LIMIT 1`),
    retire: db.prepare("UPDATE scraped_jobs SET is_active = 0 WHERE job_id = ?"),
    reject: db.prepare(`INSERT OR REPLACE INTO rejected_jobs (job_id, title, company, source, reason, rejected_at)
                        VALUES (@job_id, @title, @company, @source, @reason, @rejected_at)`),
  };
  STMTS.set(db, s);
  return s;
}

/**
 * ⛔ The crawl's age gate, called for every fetched posting BEFORE the hash check.
 * @returns {"keep" | "rejected_new" | "aged_out" | "would_age_out"} — the caller `continue`s on the first two.
 */
export function ageGate(db, job, jobId, { exists, now, policy = readPolicy(db) }) {
  const a = ageOf({ posted_at: job.posted_at }, { now, limitDays: policy.age_limit_days });
  if (!a.tooOld) return "keep";
  const s = boardStmts(db);
  const row = { job_id: jobId, title: job.title || "", company: job.company || "", source: job.source || "", rejected_at: now };
  if (!exists) { s.reject.run({ ...row, reason: "too_old" }); return "rejected_new"; }
  if (s.applied.get(jobId, jobId)) return "keep";              // ⛔ an application keeps its posting
  if (!policy.age_enforce) return "would_age_out";             // report-only until the owner's go
  s.retire.run(jobId);
  s.reject.run({ ...row, reason: "aged_out" });
  return "aged_out";
}

/**
 * ⛔ The SWEEP: every active posting past the limit that no crawl will see again (or that the crawl has not
 * reached yet). DRY BY DEFAULT. Refuses more than CEILING_SHARE of the active board unless `force`.
 * @returns {{ dryRun, enforced, limitDays, active, candidates, retired, refused, share, byCompany, bySource, byBasis }}
 */
export function sweepAged(db, { dryRun = true, force = false, now = Math.floor(Date.now() / 1000), policy = readPolicy(db), log = null } = {}) {
  const limitDays = policy.age_limit_days;
  const active = db.prepare("SELECT COUNT(*) FROM scraped_jobs WHERE is_active = 1").pluck().get();
  const rows = db.prepare(`SELECT sj.job_id, sj.title, sj.company, sj.source, sj.posted_at,
                                  CASE WHEN CAST(strftime('%s', sj.posted_at) AS INTEGER) IS NULL THEN 'first_seen' ELSE 'posted_at' END AS basis
                             FROM scraped_jobs sj WHERE ${agedSql(limitDays, now)}`).all();
  const tally = (key) => rows.reduce((m, r) => (m[r[key] || "?"] = (m[r[key] || "?"] || 0) + 1, m), {});
  const byCompany = Object.entries(tally("company")).sort((a, b) => b[1] - a[1]).slice(0, 25);
  const share = active ? +(rows.length / active).toFixed(3) : 0;
  const base = { dryRun, enforced: !!policy.age_enforce, limitDays, active, candidates: rows.length, retired: 0, refused: false, share,
                 byCompany, bySource: tally("source"), byBasis: tally("basis") };
  if (dryRun || !rows.length) return base;
  if (share > CEILING_SHARE && !force) {
    log?.({ kind: "age_sweep", refused: true, candidates: rows.length, active, share });
    return { ...base, refused: true, reason: `${rows.length} of ${active} (${Math.round(share * 100)}%) is above the ${Math.round(CEILING_SHARE * 100)}% ceiling — run it with force once you have read the dry run` };
  }
  retireRows(db, rows, "aged_out", now);
  log?.({ kind: "age_sweep", retired: rows.length, active, share });
  return { ...base, retired: rows.length };
}

/** ⛔ RETIRE, NEVER DELETE: is_active = 0 and a rejected_jobs row whose reason is the undo. One transaction. */
export function retireRows(db, rows, reason, now = Math.floor(Date.now() / 1000)) {
  const s = boardStmts(db);
  db.transaction(() => {
    for (const r of rows) {
      s.retire.run(r.job_id);
      s.reject.run({ job_id: r.job_id, title: r.title || "", company: r.company || "", source: r.source || "", reason, rejected_at: now });
    }
  })();
}
