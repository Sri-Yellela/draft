// Preloaded into every test process (`npm test` runs `node --test --import` with this file).
//
// services/trackingFailureSink.js is the out-of-process fallback for a usage write that failed, and
// its default file is data/usage-tracking-failures.jsonl in the working directory. Tests that run
// the trackers against in-memory databases with no usage tables fail that write ON PURPOSE, so
// every `npm test` appended ~109 fake "spend that was not recorded" lines to the developer's real
// data/ — and the next local boot drained them into the real database as sink_recovered failures.
// Found 10-02 (18): a fresh local database booted with 6,863 of them, all test fixtures.
//
// So each test process gets its own sink in the OS temp dir unless the test chose one itself.
// test/testSinkIsolation.test.js pins this.
import os from "node:os";
import path from "node:path";

// ⭐ D124: the trial is the main frame for every account made after migration 205 — which is every account a test
// fixture makes. The suite predates it, so the preload turns it off; test/d124Trial.test.js turns it back on.
if (!process.env.DRAFT_TRIAL) process.env.DRAFT_TRIAL = "off";

// ⛔ D171 (owner 11-06: ≈ $0.50 on the local-dev key had to be accounted for): the suite never calls a live model.
// server.js loads `dotenv/config`, so any test that boots it in this checkout would read .env's real key. dotenv
// never overrides a variable that is already set — an empty one included — so the preload sets them empty and
// every model path sees "not configured" (as on a fresh clone). Live calls belong in scripts run on purpose.
// test/d171TestsNeverCallLiveModels.test.js pins this.
for (const k of ["ANTHROPIC_KEY", "ANTHROPIC_API_KEY", "ANTHROPIC_WORKSPACE_ID"]) process.env[k] = "";

if (!process.env.USAGE_FAILURE_SINK_PATH) {
  process.env.USAGE_FAILURE_SINK_PATH = path.join(os.tmpdir(), `draft-test-sink-${process.pid}.jsonl`);
}
