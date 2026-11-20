// T31 · THE TOOLBAR PRESS ON THE REAL EXTENSION (test-support/walks/toolbarPress.mjs).
// ⭐ A232 R5 (46y, owner 11-19 "all four approved"): split out of test/t31ToolbarPress.test.js so the pure tests there run in the fast tier on every change; this file is the
// real-Chrome walk alone (browser tier). Skips, with its reason, without Chrome. Synthetic people only.
import test from "node:test";
import assert from "node:assert/strict";

// ═══ the real extension, pressed ═════════════════════════════════════════════════════════════════════════════
const { findChrome } = await import("../test-support/extensionBrowser.mjs");
const chromeFound = await findChrome();
test("T31 · the toolbar press on the REAL extension — asked about a posting draft does not hold, Capture on the person's click (a script's sends nothing), the toggle, a job of yours said once", { skip: chromeFound.skip || false, timeout: 300000 }, async () => {
  const { runScenario } = await import("../test-support/walkExtension.mjs");
  const lines = [];
  const r = await runScenario("toolbarPress", { log: (l) => lines.push(l) });
  if (r.skipped) return;
  assert.equal(r.failures, 0, lines.filter(l => l.startsWith("FAIL") || l.startsWith("OBSERVED")).join("\n"));
});
