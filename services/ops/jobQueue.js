// services/ops/jobQueue.js — ⭐ D151 RULE 2 (45q) · ONE BACKGROUND JOB SYSTEM.
//
// "No request handler may run work whose cost grows with the number of postings … Such work moves to one background job
// system: a jobs table (kind · key · status · run_after · lease_until · attempts · last_error · duration) and a worker loop
// that leases jobs, runs them in batches with a time budget, retries with backoff, and records duration; one job per kind
// and key at a time (dedupe)."
//
//   enqueue(db, kind, key, { runAfter, payload })  — one PENDING row per (kind, key): a second enqueue while one waits or
//                                                    runs is a no-op (UNIQUE partial index + the status check).
//   registerHandler(kind, fn)                      — fn({ db, key, payload, budgetMs, deadline }) → { done: true } or
//                                                    { done: false, payload } to be continued in the next slice (the job
//                                                    yields: a whole-board pass is a SERIES of bounded slices).
//   runSlice(db, { budgetMs, now })                — lease the oldest due job (lease_until = now + LEASE), run ONE slice,
//                                                    then: done → status done + duration; more → back to pending at once
//                                                    with its payload; threw → attempts + 1, backoff (30 s · 2^n, ≤ 1 h),
//                                                    failed after MAX_ATTEMPTS. An expired lease is taken again.
//   startWorker(db, { everyMs, budgetMs })         — the loop: one slice per tick, never more than budgetMs of work in one
//                                                    tick, so the one Node thread always gets back to requests.
//   queueStats(db)                                 — Admin → Diagnostics: backlog per kind, oldest waiting, failures.
export const LEASE_MS = 5 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
export const DEFAULT_BUDGET_MS = 200;
const nowMs = () => Date.now();
const handlers = new Map();

export function registerHandler(kind, fn) { handlers.set(String(kind), fn); }
export function handlerKinds() { return [...handlers.keys()]; }

/** One pending job per (kind, key). Returns { queued: true, id } or { queued: false, id, status } when one already waits / runs. */
export function enqueue(db, kind, key = "", { runAfter = null, payload = null, now = nowMs() } = {}) {
  const k = String(kind), kk = String(key ?? "");
  const live = db.prepare(`SELECT id, status FROM bg_jobs WHERE kind = ? AND key = ? AND status IN ('pending', 'running')`).get(k, kk);
  if (live) return { queued: false, id: live.id, status: live.status };
  const r = db.prepare(`INSERT OR IGNORE INTO bg_jobs (kind, key, status, run_after, payload_json, attempts, created_at)
      VALUES (?, ?, 'pending', ?, ?, 0, ?)`).run(k, kk, runAfter ?? now, payload == null ? null : JSON.stringify(payload), now);
  if (!r.changes) {
    const again = db.prepare(`SELECT id, status FROM bg_jobs WHERE kind = ? AND key = ? AND status IN ('pending', 'running')`).get(k, kk);
    return { queued: false, id: again?.id ?? null, status: again?.status ?? null };
  }
  return { queued: true, id: Number(r.lastInsertRowid) };
}

/** PURE. The retry delay after `attempts` failures: 30 s · 2^(n-1), capped at an hour. */
export function backoffMs(attempts) { return Math.min(60 * 60 * 1000, 30 * 1000 * 2 ** Math.max(0, attempts - 1)); }

function lease(db, now) {
  return db.transaction(() => {
    const row = db.prepare(`SELECT * FROM bg_jobs
        WHERE (status = 'pending' AND run_after <= ?) OR (status = 'running' AND lease_until < ?)
        ORDER BY run_after, id LIMIT 1`).get(now, now);
    if (!row) return null;
    db.prepare(`UPDATE bg_jobs SET status = 'running', lease_until = ?, started_at = COALESCE(started_at, ?) WHERE id = ?`)
      .run(now + LEASE_MS, now, row.id);
    return row;
  })();
}

/** Lease and run ONE slice of the oldest due job. Returns what happened, or null when nothing was due. */
export async function runSlice(db, { budgetMs = DEFAULT_BUDGET_MS, now = nowMs, log = console } = {}) {
  const t0 = now();
  const job = lease(db, t0);
  if (!job) return null;
  const fn = handlers.get(job.kind);
  let payload = null;
  try { payload = job.payload_json ? JSON.parse(job.payload_json) : null; } catch { payload = null; }
  const finish = (fields) => {
    const sets = Object.keys(fields).map(k => `${k} = @${k}`).join(", ");
    db.prepare(`UPDATE bg_jobs SET ${sets} WHERE id = @id`).run({ ...fields, id: job.id });
  };
  if (!fn) {
    finish({ status: "failed", last_error: `no handler for ${job.kind}`, lease_until: null, finished_at: t0 });
    return { id: job.id, kind: job.kind, status: "failed", error: "no_handler" };
  }
  try {
    const out = await fn({ db, key: job.key, payload, budgetMs, deadline: t0 + budgetMs });
    const spent = now() - t0;
    const total = (job.duration_ms || 0) + spent;
    if (out && out.done === false) {
      finish({ status: "pending", run_after: now(), payload_json: out.payload == null ? null : JSON.stringify(out.payload),
        lease_until: null, duration_ms: total, slices: (job.slices || 0) + 1 });
      return { id: job.id, kind: job.kind, status: "more", spentMs: spent };
    }
    finish({ status: "done", lease_until: null, duration_ms: total, slices: (job.slices || 0) + 1, finished_at: now(), last_error: null });
    return { id: job.id, kind: job.kind, status: "done", spentMs: spent };
  } catch (e) {
    const attempts = (job.attempts || 0) + 1;
    const failed = attempts >= MAX_ATTEMPTS;
    finish({ status: failed ? "failed" : "pending", attempts, last_error: String(e?.message || e).slice(0, 500),
      run_after: now() + backoffMs(attempts), lease_until: null, ...(failed ? { finished_at: now() } : {}) });
    log?.warn?.(`[jobs] ${job.kind}:${job.key} attempt ${attempts} failed: ${e?.message || e}`);
    return { id: job.id, kind: job.kind, status: failed ? "failed" : "retry", attempts };
  }
}

/** The worker loop: one slice per tick. Returns a stop function. */
export function startWorker(db, { everyMs = 1000, budgetMs = DEFAULT_BUDGET_MS, log = console } = {}) {
  let busy = false, stopped = false;
  const timer = setInterval(async () => {
    if (busy || stopped) return;
    busy = true;
    try { await runSlice(db, { budgetMs, log }); } catch (e) { log?.warn?.(`[jobs] slice: ${e.message}`); } finally { busy = false; }
  }, everyMs);
  timer.unref?.();
  return () => { stopped = true; clearInterval(timer); };
}

/** Keep the table small: finished jobs older than `days` go. */
export function pruneJobs(db, { days = 7, now = nowMs() } = {}) {
  return db.prepare(`DELETE FROM bg_jobs WHERE status IN ('done', 'failed') AND COALESCE(finished_at, created_at) < ?`).run(now - days * 86400000).changes;
}

/** Admin → Diagnostics: per kind — waiting, running, failed (last day), oldest waiting, the last run's duration. */
export function queueStats(db, { now = nowMs() } = {}) {
  try {
    return db.prepare(`SELECT kind,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS waiting,
        SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) AS running,
        SUM(CASE WHEN status = 'failed' AND finished_at >= ? THEN 1 ELSE 0 END) AS failedDay,
        MIN(CASE WHEN status = 'pending' THEN run_after END) AS oldestWaiting,
        MAX(CASE WHEN status = 'done' THEN duration_ms END) AS slowestMs
      FROM bg_jobs GROUP BY kind ORDER BY kind`).all(now - 86400000);
  } catch { return []; }
}
