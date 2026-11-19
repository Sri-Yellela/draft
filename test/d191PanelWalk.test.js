// ⭐ D191 sketch 2 (owner 11-18: "alright go") · THE ONE PANEL WITH THE REAL EXTENSION LOADED — test-support/walks/d191Panel.mjs:
// it opens by itself on a board posting (the page first, then draft's answer, within 300 ms of the page being ready), is ONE
// thing, steps aside from the employer's Apply control, closes to the /d square and stays closed on that site, does nothing
// by itself on an application step, and the person's "Open by itself" switch turns it off. Skips without Chrome.
import test from "node:test";
import assert from "node:assert/strict";
import { runScenario } from "../test-support/walkExtension.mjs";

test("⭐ D191 sketch 2 (real extension): the one panel opens by itself on a board posting, and only there", { timeout: 300000 }, async () => {
  const lines = [];
  const r = await runScenario("d191Panel", { log: (l) => lines.push(l) });
  if (r.skipped) return;
  assert.equal(r.failures, 0, lines.filter(l => /^FAIL/.test(l)).join("\n") || lines.slice(-20).join("\n"));
});
