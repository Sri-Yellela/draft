// D99 J11 · THE BRIDGE IN A REAL CHROME — the extension, its content script, the real lookup route and the web app's real helper (test-support/walks/boardBridge.mjs).
// ⭐ A232 R5 (46y, owner 11-19 "all four approved"): split out of test/d99Bridge.test.js so the pure tests there run in the fast tier on every change; this file is the
// real-Chrome walk alone (browser tier). Skips, with its reason, without Chrome. Synthetic people only.
import test from "node:test";
import assert from "node:assert/strict";
import { findChrome } from "../test-support/extensionBrowser.mjs";
import { runScenario } from "../test-support/walkExtension.mjs";

// ── the real thing: the extension, its content script, the real lookup route and the web app's real helper ─────────
const chromeBin = await findChrome();
test("⛔ J11 walk: a trusted click opens the SERVER's address bound 'via board'; no click, nothing; not on the board → the page's link — in a real Chrome", { skip: chromeBin.skip || false, timeout: 300000 }, async () => {
  const lines = [];
  const r = await runScenario("boardBridge", { log: (l) => lines.push(l) });
  if (r.skipped) return;
  assert.equal(r.failures, 0, lines.filter(l => l.startsWith("FAIL")).join("\n"));
});
