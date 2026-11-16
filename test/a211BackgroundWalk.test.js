// ⭐ A211 (a), walked 46p · AN ASHBY-SHAPED REACT FORM IN A BACKGROUND TAB — test-support/walks/a211Background.mjs: the
// runner's Fill all opens /ashby-spa (2.5 s hydration) in a hidden tab; the form renders there, is filled (name + email)
// and the row reaches a final state (Needs you) without the tab being brought forward; nothing is sent. Skips without Chrome.
import test from "node:test";
import assert from "node:assert/strict";
import { runScenario } from "../test-support/walkExtension.mjs";

test("⭐ A211 (a) (real extension): a hidden tab does not stall the runner's fill of a late-rendering React form", { timeout: 300000 }, async () => {
  const lines = [];
  const r = await runScenario("a211Background", { log: (l) => lines.push(l) });
  if (r.skipped) return;
  assert.equal(r.failures, 0, lines.filter(l => /^FAIL/.test(l)).join("\n") || lines.slice(-20).join("\n"));
});
