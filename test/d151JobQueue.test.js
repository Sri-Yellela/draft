// D151 Rule 2 (45q) · one background job system: leased, batched within a time budget, retried with backoff, one job per
// kind + key, duration recorded — and the new-match sweep is its first kind.
import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { enqueue, registerHandler, runSlice, backoffMs, queueStats, pruneJobs, MAX_ATTEMPTS, LEASE_MS } from "../services/ops/jobQueue.js";

function db() {
  const d = new Database(":memory:");
  d.exec(MIGRATIONS.find(m => m.id === "261_bg_jobs").sql);
  return d;
}

test("d151OneJobPerKindKey: a second enqueue while one waits or runs is a no-op; another key is its own job", () => {
  const d = db();
  const a = enqueue(d, "k1", "x", { now: 1000 });
  assert.equal(a.queued, true);
  assert.deepEqual(enqueue(d, "k1", "x", { now: 1001 }), { queued: false, id: a.id, status: "pending" });
  assert.equal(enqueue(d, "k1", "y", { now: 1001 }).queued, true);
  assert.throws(() => d.prepare("INSERT INTO bg_jobs (kind, key, status, run_after, created_at) VALUES ('k1', 'x', 'pending', 1, 1)").run(),
    /UNIQUE/, "the partial unique index is the dedupe, even for a writer that skips the check");
});

test("d151JobsLeasedBatchedBudgeted: a job runs as slices within its budget, resumes from its payload, records its duration", async () => {
  const d = db();
  let t = 10_000;
  const now = () => t;
  const seen = [];
  registerHandler("t_slices", async ({ payload, deadline, budgetMs }) => {
    assert.equal(budgetMs, 200);
    let i = payload?.i ?? 0;
    while (i < 10) { if (now() >= deadline) return { done: false, payload: { i } }; seen.push(i++); t += 50; }
    return { done: true };
  });
  enqueue(d, "t_slices", "", { now: t });
  const outs = [];
  for (let n = 0; n < 6; n++) { const o = await runSlice(d, { now, budgetMs: 200 }); if (!o) break; outs.push(o.status); }
  assert.deepEqual(seen, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], "every item once, in order, across slices");
  assert.deepEqual(outs, ["more", "more", "done"], "≤ 200 ms of work per slice (4 items × 50 ms)");
  const row = d.prepare("SELECT status, slices, duration_ms FROM bg_jobs WHERE kind = 't_slices'").get();
  assert.deepEqual(row, { status: "done", slices: 3, duration_ms: 500 });
  // A lease that expired (a crashed worker) is taken again.
  registerHandler("t_lease", async () => ({ done: true }));
  enqueue(d, "t_lease", "", { now: t });
  d.prepare("UPDATE bg_jobs SET status = 'running', lease_until = ? WHERE kind = 't_lease'").run(t - 1);
  assert.equal((await runSlice(d, { now })).status, "done");
  assert.ok(LEASE_MS >= 60_000);
});

test("d151JobsRetryWithBackoff: a throw retries later, then fails after MAX_ATTEMPTS; Admin sees it", async () => {
  const d = db();
  let t = 1_000_000;
  registerHandler("t_fail", async () => { throw new Error("boom"); });
  enqueue(d, "t_fail", "", { now: t });
  assert.equal((await runSlice(d, { now: () => t, log: null })).status, "retry");
  assert.equal(await runSlice(d, { now: () => t, log: null }), null, "not due until its backoff passes");
  for (let n = 2; n <= MAX_ATTEMPTS; n++) { t += backoffMs(n - 1) + 1; await runSlice(d, { now: () => t, log: null }); }
  const row = d.prepare("SELECT status, attempts, last_error FROM bg_jobs WHERE kind = 't_fail'").get();
  assert.deepEqual(row, { status: "failed", attempts: MAX_ATTEMPTS, last_error: "boom" });
  assert.equal(backoffMs(1), 30_000); assert.equal(backoffMs(20), 3_600_000);
  const stats = queueStats(d, { now: t });
  assert.equal(stats.find(s => s.kind === "t_fail").failedDay, 1);
  assert.equal(pruneJobs(d, { days: 0, now: t + 1 }), 1);
});
