import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// ⛔ A191 (46i, production 11-12 00:33:48Z): the boot's expired-jobs pass took 9,007 ms of synchronous statements before
// ready (83k postings, user-reference subqueries, a cold cache) — every deploy's outage 9 s longer. A boot now skips the
// pass when a cleanup finished within 20 h (the nightly 03:00 run, or the previous boot); a missed night still runs.
// Verified by booting twice on one throwaway data dir: the first ran it, the second logged the skip.
test("a191: the boot pass is skipped when a cleanup ran within 20 h — before any statement runs", () => {
  const s = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8");
  const fn = s.slice(s.search(/async function runExpiredJobsCleanupPass\(\) \{/));
  const skip = fn.search(/SELECT MAX\(run_at\) AS t FROM cleanup_log/);
  const firstWrite = fn.search(/UPDATE scraped_jobs SET is_active = 0/);
  assert.ok(skip > 0 && firstWrite > skip, "the check comes before the first statement");
  assert.match(fn, /if \(startup\) \{[\s\S]{0,400}last >= Math\.floor\(Date\.now\(\) \/ 1000\) - 20 \* 3600[\s\S]{0,300}return \{ skipped: "ran_within_20h" \};/);
});
