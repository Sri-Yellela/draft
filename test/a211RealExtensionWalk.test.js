// ⭐ A211 (1a) · the runner tab WITH THE REAL EXTENSION LOADED — test-support/walks/a211Runner.mjs: two extension-submit
// applications; "Fill all" fills each in a background tab (one to Ready, one stopped at Needs you) and sends nothing; a
// script's click and a press-less / non-runner RUNNER_SEND send nothing; ONE trusted "Send all" sends exactly the Ready one
// from this browser and Sent is recorded once. Skips, with its reason, without Chrome.
import test from "node:test";
import assert from "node:assert/strict";
import { runScenario } from "../test-support/walkExtension.mjs";

test("⭐ A211 (1a) (real extension): the runner fills in the background and sends only the Ready ones, on one trusted press", { timeout: 300000 }, async () => {
  const lines = [];
  const r = await runScenario("a211Runner", { log: (l) => lines.push(l) });
  if (r.skipped) return;
  assert.equal(r.failures, 0, lines.filter(l => /^FAIL/.test(l)).join("\n") || lines.slice(-20).join("\n"));
});
