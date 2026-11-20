// ⭐ BINDING FIRST (owner 10-15) + T15 + T16 IN A REAL CHROME — the scenario matrix (test-support/walks/bindingFirst.mjs).
// ⭐ A232 R5 (46y, owner 11-19 "all four approved"): split out of test/bindingFirst.test.js so the pure tests there run in the fast tier on every change; this file is the
// real-Chrome walk alone (browser tier). Skips, with its reason, without Chrome. Synthetic people only.
import test from "node:test";
import assert from "node:assert/strict";
import { findChrome } from "../test-support/extensionBrowser.mjs";
import { runScenario } from "../test-support/walkExtension.mjs";

// ── the real Chrome: the scenario matrix ───────────────────────────────────────────────────────────────────────────
const chromeBin = await findChrome();
test("⭐ BINDING FIRST in a REAL Chrome — the matrix: on your board · a board job not yet yours · not on the board → Capture · not a job · unreachable / signed out; (a) a page naming no job keeps the binding; T15 expired / absent → one press; identify before any prepare or mint",
  { skip: chromeBin.skip || false, timeout: 600000 }, async () => {
    const lines = [];
    const r = await runScenario("bindingFirst", { log: (l) => lines.push(l) });
    if (r.skipped) return;
    assert.equal(r.failures, 0, lines.filter(l => l.startsWith("FAIL")).join("\n") || lines.slice(-20).join("\n"));
  });
