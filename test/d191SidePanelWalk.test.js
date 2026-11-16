// ⭐ D191 (46o rebuild, walked 46p) · THE SIDE PANEL WITH THE REAL EXTENSION LOADED — test-support/walks/d191SidePanel.mjs:
// the notice on a fresh install; the home line with the runner first (two buttons — T27); the home line's Open through the
// dock (DOCK_ACT) opens the panel; at 320 px in light and dark the This-job card carries draft's facts (sub line, Works with,
// state, Apply from here — 46p found lookupPage dropping them) and the company card; no model route. Skips without Chrome.
import test from "node:test";
import assert from "node:assert/strict";
import { runScenario } from "../test-support/walkExtension.mjs";

test("⭐ D191 (real extension): the side panel opens from the dock and shows the posting's facts and the employer", { timeout: 300000 }, async () => {
  const lines = [];
  const r = await runScenario("d191SidePanel", { log: (l) => lines.push(l) });
  if (r.skipped) return;
  assert.equal(r.failures, 0, lines.filter(l => /^FAIL/.test(l)).join("\n") || lines.slice(-20).join("\n"));
});
