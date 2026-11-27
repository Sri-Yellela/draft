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
  // ⛔ 47j w1-market (changed on purpose): `.fh[data-fh-d147]` and its sentence size are deleted with the classic header — the
  // market's sentence is the plate cartouche's (plate sizes follow --type-scale through --pl-scale). The one .bh left (the
  // Customise preview) sets its own size token (Customise.css .cz-pv).
  assert.doesNotMatch(block, /--fh-sentence-size: calc/);
  assert.match(raw("client/src/components/Customise.css"), /\.cz-pv \{ --fh-sentence-size: 24px; \}/);
});

// ⛔ 47m (changed on purpose): "A116 · D147 — the opened posting (its header, actions, facts box and match box) " retired — the posting panel is deleted (D199 C7): a job opens as its opening sheet (plate/OpeningSheet.jsx, SheetResume.jsx), pinned by d199Market47h and a204.

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

// ⭐ A116 · 46g — the INLINE sizes (1,366 `fontSize: <number>` in 99 of the client's JSX files on 11-11). Every screen, the
// admin console included, now sizes its inline text through ts() (themes/shapes.js: calc(Npx * var(--type-scale, 1))), so
// Settings → Text size reaches it — and no file, old or new, may carry a bare inline size again.
const jsxFiles = (d, out = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
  const f = `${d}/${e.name}`; if (e.isDirectory()) jsxFiles(f, out); else if (e.name.endsWith(".jsx")) out.push(f); } return out; };
test("A116 · 46g — no inline font size anywhere in the client ignores the text size", () => {
  // ⛔ 47j w2-outside (changed on purpose): `fontSize: 0` is not a text size — the email form's spacer cells (plate/Dispatch.jsx)
  // zero it so Outlook draws no line box; nothing scales a zero.
  const files = jsxFiles("client/src");
  assert.ok(files.length > 170 && files.includes("client/src/panels/JobsPanel.jsx") && files.includes("client/src/panels/AdminPanel.jsx"), `the scan found the client (${files.length})`);
  const bare = files.flatMap(f => raw(f).split("\n").map((l, i) => [i + 1, l]).filter(([, l]) => /fontSize:\s?(?!0\b)\d/.test(l) || /fontSize:\s*(?!\s|ts\()[^,}"'`]*\?\s*\d+(\.\d+)?\s*:\s*\d/.test(l)).map(([n, l]) => `${f}:${n} ${l.trim().slice(0, 80)}`));
  assert.deepEqual(bare, [], "bare inline font sizes — wrap them in ts()");
  assert.match(raw("client/src/themes/shapes.js"), /export const ts = \(px\) => `calc\(\$\{px\}px \* var\(\$\{TYPE_SCALE_VAR\}, 1\)\)`;/);
});
