// ── What is left of the drain's tests: the budget it read ───────────────────────────────────────
//
// drainEnrichment looped the model enrichment pass under a DAILY BUDGET from the 04:00 cron. A80 V4
// removed every trigger and A80 (10-05) deleted the pass and the drain with enrichJob.js's model call
// (D17: only résumé generation may call a model). Its fifteen loop tests (every stop reason, the
// detail-fetch budget, one run record per drain, the overlap rule) went with it — they are in git
// history before that commit. The budget itself is still read: the admin glance shows its caps.
import test from "node:test";
import assert from "node:assert/strict";
import { enrichBudget } from "../services/jobs/enrichJob.js";

test("the budget comes from the environment, with the measured defaults", async () => {
  const saved = { ...process.env };
  try {
    delete process.env.ENRICH_DAILY_MAX_ROWS;
    delete process.env.ENRICH_DAILY_MAX_USD;
    delete process.env.ENRICH_MAX_RUN_MINUTES;
    // Sized against measured production numbers: ~$0.002/row and ~2.8s/row, so 300 rows is ~$0.60
    // and ~14 minutes — inside all three bounds rather than merely under one of them.
    assert.deepEqual(enrichBudget(), { maxRows: 300, maxUsd: 1.0, maxMinutes: 20 });

    process.env.ENRICH_DAILY_MAX_ROWS = "50";
    process.env.ENRICH_DAILY_MAX_USD = "0.25";
    process.env.ENRICH_MAX_RUN_MINUTES = "3";
    assert.deepEqual(enrichBudget(), { maxRows: 50, maxUsd: 0.25, maxMinutes: 3 });

    // A nonsense value must fall back to the default rather than become 0 — a 0 budget would stop
    // enrichment dead, silently, which is the failure this whole task is about.
    process.env.ENRICH_DAILY_MAX_ROWS = "not-a-number";
    assert.equal(enrichBudget().maxRows, 300);
  } finally {
    for (const k of ["ENRICH_DAILY_MAX_ROWS", "ENRICH_DAILY_MAX_USD", "ENRICH_MAX_RUN_MINUTES"]) {
      if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
    }
  }
});
