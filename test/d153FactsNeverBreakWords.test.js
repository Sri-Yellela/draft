// ⛔ D153 (5) · THE FACTS BOX NEVER BREAKS A WORD (owner 11-04: production showed "Rem / ote", "not state / d",
// "Says no spon / sors / hip"). D149's one-row grid (`grid-auto-flow: column`) squeezed every cell into the panel's width,
// and `overflow-wrap: anywhere` broke the words. And D152 (7): a fact not on file is left out, never a "not stated" cell.
// The source pins below, and (44s) the real-Chrome measurement at 1280 and 390: `fidelityShots.mjs --styles posting-facts`
// opens a posting with six facts on file (sponsorship "Says no sponsorship" and a history line included) and reads every
// word's client rects — a word broken across lines has rects on two lines.
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

test("d153FactsNeverBreakWords (real Chrome, 1280 and 390): six facts wrap onto rows and no word is split", { timeout: 200000 }, (t) => {
  const out = fidelityProbe("posting-facts");
  if (out.skipped) { t.skip(out.skipped); return; }
  for (const [size, d] of Object.entries(out)) {
    assert.ok(d.facts, `${size}: the opened posting has a facts box`);
    assert.deepEqual(d.facts.cells.map(c => c.key), ["experience", "workstyle", "salary", "posted", "history", "sponsorship"], `${size}: the six facts`);
    assert.deepEqual(d.facts.broken, [], `${size}: a word broke across lines`);
    assert.ok(d.facts.rows >= 2, `${size}: the cells wrap onto rows (${d.facts.rows}), not one squeezed row`);
    for (const c of d.facts.cells) assert.equal(c.overflows, false, `${size}: ${c.key} overflows its cell`);
    assert.ok(d.facts.words.some(w => w.word === "sponsorship"), `${size}: the long value is measured`);
    assert.doesNotMatch(d.facts.cells.map(c => c.text).join(" "), /not stated|unknown/i, `${size}: no "not stated" cell`);
  }
});
