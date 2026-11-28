// ⭐ D197 #19 (47n) · the extension panel's skill squares behind More (docs/revamp/extension.md M2) — pure model + the panel's markup
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";
import { skillSquares } from "../extension/jobPanelModel.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("skillSquares47n: the first five of the fit card's words, a claimed word counts as yours, the words say how many", () => {
  const fit = { words: [
    { label: "Python", state: "on" }, { label: "Kubernetes", state: "missing" }, { label: "SQL", state: "claimed" },
    { label: "Go", state: "on" }, { label: "Terraform", state: "missing" }, { label: "Rust", state: "on" } ] };
  const s = skillSquares(fit);
  assert.deepEqual(s.squares.map((x) => x.label), ["Python", "Kubernetes", "SQL", "Go", "Terraform"]);
  assert.deepEqual(s.squares.map((x) => x.on), [true, false, true, true, false]);
  assert.equal(s.words, "3 of your 5 top skills");
  assert.equal(skillSquares({ words: [{ label: "SQL", state: "on" }] }).words, "1 of your 1 top skill");
});

test("skillSquares47n: no report, no words, or an older worker → no squares", () => {
  assert.equal(skillSquares(null), null);
  assert.equal(skillSquares({ words: [] }), null);
  assert.equal(skillSquares({ words: [{ label: "  ", state: "on" }] }), null);
});

test("skillSquares47n: the panel keeps them behind More, collapsed, and opening them sends nothing", () => {
  const panel = read("extension/jobPanel.js");
  assert.match(panel, /data-role="more" aria-expanded="false" aria-controls="rm-draft-skills">More<\/button>/);
  assert.match(panel, /<div class="sqs" id="rm-draft-skills" hidden>/);
  const handler = panel.slice(at(panel, "const mb = ev.target.closest?.('[data-role=\"more\"]');"));
  assert.ok(/return; \}/.test(handler.split("\n")[1]), "More's press returns before any message");
  const bg = read("extension/background.js");
  assert.match(bg, /if \(model\.job && model\.kind !== 'signed-out' && ctx\?\.job\?\.skills\) model\.skills = ctx\.job\.skills;/);
});
