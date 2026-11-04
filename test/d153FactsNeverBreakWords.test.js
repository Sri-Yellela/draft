// ⛔ D153 (5) · THE FACTS BOX NEVER BREAKS A WORD (owner 11-04: production showed "Rem / ote", "not state / d",
// "Says no spon / sors / hip"). D149's one-row grid (`grid-auto-flow: column`) squeezed every cell into the panel's width,
// and `overflow-wrap: anywhere` broke the words. And D152 (7): a fact not on file is left out, never a "not stated" cell.
// ⚠ A source pin. The real-Chrome measurement at 1280 and 390 (the row's d153FactsNeverBreakWords) is not written yet.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

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
  const fn = JSX.slice(JSX.indexOf("function PanelMasthead("));
  assert.match(fn.slice(0, 2000), /const all = \[\.\.\.cells, \.\.\.extra\]\.filter\(c => c\.value != null\);/);
});
