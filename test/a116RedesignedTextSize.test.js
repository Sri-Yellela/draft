// ⭐ A116 (agent, 11-03) · TEXT SIZE REACHES EVERY REDESIGNED SCREEN. Settings → Appearance → Text size publishes
// --type-scale (D145); the deck card, the Dock and the Menu follow it through ts(). The proposal A116 recorded: each
// screen moves to it AS it is redesigned, with a guard. These are the guards for D146 (the tracker), D147 (Full House's
// header and the opened posting) and D148 (the settings drawer): inside each redesigned block, every font size is a
// calc(... * var(--type-scale, 1)) — never a bare px that ignores the reader's choice.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, "");
const raw = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

/** Every font size in `css` (font-size and the font shorthand), and the ones that ignore --type-scale. */
function unscaled(css) {
  const bad = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    for (const d of m[2].split(";")) {
      const decl = d.trim();
      if (!/^font(-size)?\s*:/.test(decl)) continue;
      if (!/\d(px|rem|em)\b|min\(/.test(decl)) continue;           // font: inherit, var(...) — nothing to scale
      if (/^font\s*:/.test(decl) && !/\d+(\.\d+)?px\s*\/|min\(/.test(decl)) continue;   // a shorthand with no size
      if (!/var\(--type-scale, 1\)/.test(decl)) bad.push(`${m[1].trim()} → ${decl}`);
    }
  }
  return bad;
}
const slice = (src, from, to) => src.slice(at(src, from), to ? at(src, to) : undefined);

test("A116 · D146 — the tracker's stylesheet follows the text size", () => {
  assert.deepEqual(unscaled(read("client/src/components/ApplicationTracker.css")), []);
});

test("A116 · D147 — Full House's header block and the sentence's size follow the text size", () => {
  const fh = raw("client/src/components/FullHouse.css");
  const block = slice(fh, "/* ── ⭐ D147 (owner 11-03, fullhouse-declutter.html) · FULL HOUSE, RESTYLED");
  assert.deepEqual(unscaled(block.replace(/\/\*[\s\S]*?\*\//g, "")), []);
  assert.match(block, /--fh-sentence-size: calc\(min\(30px, 7vw\) \* var\(--type-scale, 1\)\);/);
});

test("A116 · D147 — the opened posting (its header, actions, facts box and match box) follows the text size", () => {
  const pp = raw("client/src/components/PostingPanel.css");
  const block = slice(pp, "/* ── ⭐ D147 · the opened posting", "/* ── The phone.");
  assert.deepEqual(unscaled(block.replace(/\/\*[\s\S]*?\*\//g, "")), []);
  assert.match(pp, /\.posting__mast--panel \.posting__title \{ font-size: calc\(28px \* var\(--type-scale, 1\)\); \}/);
  const jd = raw("client/src/components/JobDetailPanel.css");
  const d147 = slice(jd, "/* D147 · Close — a small quiet text box");
  assert.deepEqual(unscaled(d147.replace(/\/\*[\s\S]*?\*\//g, "")), []);
  assert.match(jd, /\.pp__loc \{ font-size: calc\(13px \* var\(--type-scale, 1\)\);/);
});

test("A116 · D148 — the settings drawer's block follows the text size", () => {
  const dh = raw("client/src/components/DraftHouse.css");
  const block = slice(dh, "/* ── ⭐ D148 (owner 11-03, settings-declutter.html)");
  assert.deepEqual(unscaled(block.replace(/\/\*[\s\S]*?\*\//g, "")), []);
});

test("A116 · the guard itself catches a bare size", () => {
  assert.deepEqual(unscaled(".x { font-size: 14px; } .y { font: 600 13px/1 var(--f); } .z { font: inherit; }"),
    [".x → font-size: 14px", ".y → font: 600 13px/1 var(--f)"]);
  assert.deepEqual(unscaled(".x { font-size: calc(14px * var(--type-scale, 1)); }"), []);
});
