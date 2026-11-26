// ⛔ D153 (5) · THE FACTS BOX NEVER BREAKS A WORD (owner 11-04: production showed "Rem / ote", "not state / d",
// "Says no spon / sors / hip"). D149's one-row grid (`grid-auto-flow: column`) squeezed every cell into the panel's width,
// and `overflow-wrap: anywhere` broke the words. And D152 (7): a fact not on file is left out, never a "not stated" cell.
// The source pins below, and (44s) the real-Chrome measurement at 1280 and 390: `fidelityShots.mjs --styles posting-facts`
// opens a posting and reads every word's client rects — a word broken across lines has rects on two lines. Since 47j it
// measures the OPENING SHEET's glance strip (D199 C7), where a posting opens now.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";
import { probe as fidelityProbe } from "../test-support/fidelityProbe.mjs";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const CSS = read("client/src/components/PostingPanel.css");
const JSX = read("client/src/components/PostingPanel.jsx");

test("d153FactsNeverBreakWords: the last facts rules wrap the cells and never break a word", () => {
  const i = CSS.lastIndexOf("D153 (5)");
  assert.ok(i > 0, "the D153 (5) block is missing");
  const block = CSS.slice(i);
  assert.match(block, /\.posting__facts \.posting__strip \{[^}]*display: flex; flex-wrap: wrap;/);
  assert.match(block, /\.posting__facts \.posting__cell \{[^}]*flex: 1 1 \d+px;/);
  assert.match(block, /\.posting__facts \.posting__cell dd, \.posting__facts \.posting__cell dt \{ overflow-wrap: normal; word-break: normal;/);
  // nothing after the block puts the one-row grid back
  assert.doesNotMatch(block, /grid-auto-flow: column/);
});

test("d153NoNotStatedInPanel: the opened posting's facts box leaves out a fact with no value", () => {
  const fn = JSX.slice(at(JSX, "function PanelMasthead("));
  assert.match(fn.slice(0, 2000), /const all = \[\.\.\.cells, \.\.\.extra\]\.filter\(c => c\.value != null\);/);
});

// ⭐ 47j (D199 C7 — re-pointed on purpose): a posting no longer opens on the deck (PostingPanel's six-cell facts box); the
// Index row, the deck's title and its Open all go to the OPENING SHEET (/app/jobs/<id>). The sheet's facts are its glance
// strip — pay · type · level (· stack you have when the company's stack is known) — held to the same rule: no word broken,
// cells wrap onto rows rather than squeeze, nothing overflows its cell, no "not stated".
test("d153FactsNeverBreakWords (real Chrome, 1280 and 390): the opening sheet's glance strip wraps onto rows and no word is split", { timeout: 200000 }, (t) => {
  const out = fidelityProbe("posting-facts");
  if (out.skipped) { t.skip(out.skipped); return; }
  for (const [size, d] of Object.entries(out)) {
    assert.match(d.url || "", /^\/app\/jobs\/[^/]+$/, `${size}: the Index row opened the posting's own sheet (${d.url})`);
    assert.ok(d.facts, `${size}: the opened sheet has its glance strip`);
    const keys = d.facts.cells.map(c => c.key);
    assert.deepEqual(keys.slice(0, 3), ["pay", "type", "level"], `${size}: pay, type and level first (${keys.join(", ")})`);
    assert.deepEqual(d.facts.broken, [], `${size}: a word broke across lines`);
    // the glance cells size to their own words (no fixed columns to squeeze, as PostingPanel's six-cell grid had): held by
    // "no word split" and "no cell overflows" above and below, and the strip staying inside the sheet at every width
    assert.ok(d.facts.right <= d.facts.sheetRight + 1, `${size}: the strip stays inside the sheet (${d.facts.right} > ${d.facts.sheetRight})`);
    for (const c of d.facts.cells) assert.equal(c.overflows, false, `${size}: ${c.key} overflows its cell`);
    assert.doesNotMatch(d.facts.cells.map(c => c.text).join(" "), /not stated|unknown|undefined|null/i, `${size}: no "not stated" cell`);
  }
});
