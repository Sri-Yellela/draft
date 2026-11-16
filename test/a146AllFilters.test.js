// ⭐ A146 (45o) · ALL FILTERS — the D179 sketch's (b): the filter rail becomes ONE panel that opens in place from the
// sentence (every facet, the same true counts as each word's own panel), never a permanent column.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { BOARD_PANEL, isWordPanel, panelKey, nextBoardPanel, sentenceClauses } from "../client/src/lib/filterSentenceModel.js";

test("A146 · ALL is one of the board's panels — opened by its word, the same one-panel rule as every word", () => {
  assert.equal(BOARD_PANEL.ALL, "all");
  assert.ok(isWordPanel(BOARD_PANEL.ALL));
  assert.equal(panelKey(BOARD_PANEL.ALL), "All filters");
  assert.ok(!sentenceClauses().some((c) => c.key === BOARD_PANEL.ALL), "no clause can collide with it");
  assert.equal(nextBoardPanel("level", BOARD_PANEL.ALL), BOARD_PANEL.ALL, "opening it closes an open word");
  assert.equal(nextBoardPanel(BOARD_PANEL.ALL, BOARD_PANEL.ALL), null, "pressing it again closes it");
});

test("A146 · the panel draws EVERY clause through its own panel's options; the word sits BESIDE the sentence", () => {
  const panel = fs.readFileSync("client/src/components/WordPanel.jsx", "utf8");
  assert.match(panel, /export function AllFilters\(/);
  assert.match(panel, /\{sentenceClauses\(\)\.map\(c => \(\s*<div key=\{c\.key\} className="fh-all__sec" data-all-clause=\{c\.key\}>/);
  assert.match(panel, /<ClauseOptions clause=\{c\} params=\{params\} facets=\{facets\}/, "the same options — so the same counts");
  assert.match(panel, /open === BOARD_PANEL\.ALL\s+\? <AllFilters/);
  assert.match(panel, /if \(open === BOARD_PANEL\.ALL\) return doc\?\.getElementById\?\.\(ALL_FILTERS_ID\)/, "focus returns to the word");
  assert.doesNotMatch(fs.readFileSync("client/src/components/BoardHeadline.jsx", "utf8"), /bh__all/,
    "the heading is the sentence alone (D34 / D35)");
  const app = fs.readFileSync("client/src/App.jsx", "utf8");
  assert.match(app, /<button type="button" className="bh__all" id=\{ALL_FILTERS_ID\} data-slot=\{BOARD_PANEL\.ALL\}/);
  assert.match(app, /onClick=\{\(\) => setBoardPanel\(current => nextBoardPanel\(current, BOARD_PANEL\.ALL\)\)\}>All filters<\/button>/);
});

test("A221 (46r) · the All filters word is drawn at the page's small text size — never a fraction of its parent's", () => {
  const css = fs.readFileSync("client/src/components/FullHouse.css", "utf8");
  const rule = css.match(/^\.bh__all \{([^}]*)\}/m)[1];
  assert.match(rule, /font-size: calc\(13px \* var\(--type-scale, 1\)\);/, "it follows Settings → Text size");
  assert.doesNotMatch(rule, /font-size: [\d.]+em/, "a relative em drew it at ~6 px beside the search's small text");
});
