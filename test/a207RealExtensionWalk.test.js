// ⭐ A207 (a) (46l) · the one press WITH THE REAL EXTENSION LOADED — test-support/walks/extensionSubmit.mjs: an extension-submit
// hand-off on the fake ATS's plain form; Submit application waits for Ready; a page script's click sends and records nothing;
// the person's ONE trusted press submits the form from this browser (one submission at the fake ATS, every answer + the
// résumé) and Sent is recorded on draft's server from the confirmation page, once. Skips, with its reason, without Chrome.
import test from "node:test";
import assert from "node:assert/strict";
import { runScenario } from "../test-support/walkExtension.mjs";

test("⭐ A207 (a) (real extension): one trusted press sends the form from the person's browser; nothing else does", { timeout: 300000 }, async () => {
  const lines = [];
  const r = await runScenario("extensionSubmit", { log: (l) => lines.push(l) });
  if (r.skipped) return;
  assert.equal(r.failures, 0, lines.filter(l => /^FAIL/.test(l)).join("\n") || lines.slice(-20).join("\n"));
});
