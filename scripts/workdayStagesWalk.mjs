#!/usr/bin/env node
/**
 * v1.5.2 · ONE JOB ACROSS WORKDAY'S STAGES — the REAL extension, in headless Chrome, end to end.
 * ============================================================================================
 * Since J2 this is a thin entry over the shared harness: the checks live in test-support/walks/workdayStages.mjs and
 * the browser, the test build of the extension, the resolver rule and the API in test-support/extensionBrowser.mjs.
 * The same pass is `npm run walk:extension -- workdayStages`.
 *
 * Usage:  node scripts/workdayStagesWalk.mjs        (exit 1 on any FAIL, and — as before J2 — when there is no Chrome)
 */
import { runScenario } from '../test-support/walkExtension.mjs';

runScenario('workdayStages').then(
  (r) => { if (r.skipped) console.error(`No Chrome: ${r.reason}`); process.exit(r.failures || r.skipped ? 1 : 0); },
  (e) => { console.error(e); process.exit(1); },
);
