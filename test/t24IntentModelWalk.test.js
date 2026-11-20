// T24 · THE INTENT MODEL IN A REAL CHROME — the extension, the real Draft route, the dock's own clicks (test-support/walks/intentPath.mjs).
// ⭐ A232 R5 (46y, owner 11-19 "all four approved"): split out of test/t24IntentModel.test.js so the pure tests there run in the fast tier on every change; this file is the
// real-Chrome walk alone (browser tier). Skips, with its reason, without Chrome. Synthetic people only.
import test from "node:test";
import assert from "node:assert/strict";

// ── the real thing: the extension in a real Chrome, the real Draft route, the dock's own clicks ──────────────────────
const { findChrome } = await import("../test-support/extensionBrowser.mjs");
const { runScenario } = await import("../test-support/walkExtension.mjs");
const chromeBin = await findChrome();
test("⭐ T24 walk: the dock asks once and remembers with the account; ONE application and ONE résumé; a second Draft queues nothing; the switch — in a real Chrome",
  { skip: chromeBin.skip || false, timeout: 300000 }, async () => {
    const lines = [];
    const r = await runScenario("intentPath", { log: (l) => lines.push(l) });
    if (r.skipped) return;
    assert.equal(r.failures, 0, lines.filter(l => l.startsWith("FAIL")).join("\n"));
  });
