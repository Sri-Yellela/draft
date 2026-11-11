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
  // ⭐ D156 (1d) (changed on purpose): the sentence's ORIGINAL size (FULL_HOUSE_TYPE, min(30px, 6.4vw)) — still times the text size.
  assert.match(block, /--fh-sentence-size: calc\(min\(30px, 6\.4vw\) \* var\(--type-scale, 1\)\);/);
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

// ⭐ A116 · 46g — the INLINE sizes, screen by screen (~1,340 `fontSize: <number>` in the client's JSX on 11-11). A screen is
// listed here once every inline size in it goes through ts() (themes/shapes.js: calc(Npx * var(--type-scale, 1))).
export const INLINE_SCALED = ["client/src/panels/JobsPanel.jsx", "client/src/panels/DeckView.jsx",
  "client/src/panels/ProfilePanel.jsx", "client/src/components/DomainProfileWizard.jsx", "client/src/panels/AutoApplyPanelSections.jsx", "client/src/panels/AutoApplyPanel.jsx", "client/src/components/ProfileSections.jsx", "client/src/panels/AccountPanel.jsx", "client/src/components/JobCard.jsx", "client/src/panels/SandboxPanel.jsx", "client/src/panels/IntegrationsPanel.jsx", "client/src/components/AuthScreen.jsx", "client/src/panels/JobWorkspacePanel.jsx", "client/src/pages/marketing/ExtensionPage.jsx", "client/src/components/CompanyKbSections.jsx", "client/src/panels/SavedAnswersPanel.jsx"];
test("A116 · 46g — the board and the deck: no inline font size ignores the text size", () => {
  for (const f of INLINE_SCALED) {
    const bare = raw(f).split("\n").map((l, i) => [i + 1, l]).filter(([, l]) => /fontSize:\s?\d/.test(l)).map(([n, l]) => `${f}:${n} ${l.trim().slice(0, 80)}`);
    assert.deepEqual(bare, [], `bare inline font sizes in ${f}`);
  }
  assert.match(raw("client/src/themes/shapes.js"), /export const ts = \(px\) => `calc\(\$\{px\}px \* var\(\$\{TYPE_SCALE_VAR\}, 1\)\)`;/);
});
