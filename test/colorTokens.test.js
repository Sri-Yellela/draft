// THE COLOUR TOKENS — one named file, and every text-on-background pair passes WCAG AA.
//
// docs/UI_REDESIGN.md sequence step 2. Mirrors the z-scale's test (test/searchSurfaceLayering.test.js
// "the scale is named constants in one file"): read the object, not the prose about it.
//
// ⚠ CONTRAST IS A REQUIREMENT, NOT A PREFERENCE. The precedent: the /pricing recommended card put
// `--color-primary-text` on a `--color-primary` fill, the badge and CTA were invisible, and it
// shipped because nothing computed the pair. This file computes every pair the palette declares,
// and ALSO asserts that the pairs the palette forbids really do fail — so the list cannot be
// "fixed" by quietly declaring the orange-on-cream pair as sanctioned.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const { C, CONTRAST_PAIRS, FORBIDDEN_PAIRS, cssVarName, installColorVars } =
  await import("../client/src/styles/colorTokens.js");

// ── WCAG 2.x relative luminance ────────────────────────────────────────────────────────────────
function parse(v) {
  let m = /^#([0-9a-f]{6})$/i.exec(v);
  if (m) return { rgb: [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)), a: 1 };
  m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)$/.exec(v);
  if (m) return { rgb: [+m[1], +m[2], +m[3]], a: m[4] === undefined ? 1 : +m[4] };
  throw new Error(`unparseable colour ${v}`);
}
const value = (nameOrLiteral) => (nameOrLiteral in C ? C[nameOrLiteral] : nameOrLiteral);
// A translucent colour is composited over the WORST-CASE paper, CANVAS_SHADE.
function opaque(nameOrLiteral, under = C.CANVAS_SHADE) {
  const { rgb, a } = parse(value(nameOrLiteral));
  if (a === 1) return rgb;
  const base = opaque(under);
  return rgb.map((c, i) => c * a + base[i] * (1 - a));
}
const channel = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
export function contrast(fg, bg) {
  const b = opaque(bg);
  const f = opaque(fg);   // every declared foreground is opaque; a translucent one sits on paper
  const [hi, lo] = [lum(f), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
const REQUIRED = { normal: 4.5, large: 3, ui: 3 };

test("the formula is the WCAG one — black on white is 21:1, and a known pair matches", () => {
  // A contrast test with a wrong formula passes everything. Pin it to published values first.
  assert.equal(contrast("#000000", "#FFFFFF").toFixed(2), "21.00");
  assert.equal(contrast("#FFFFFF", "#FFFFFF").toFixed(2), "1.00");
  // #767676 on white is the textbook "just passes AA" grey: 4.54:1.
  assert.equal(contrast("#767676", "#FFFFFF").toFixed(2), "4.54");
});

test("every declared text-on-background token pair passes WCAG AA", () => {
  assert.ok(CONTRAST_PAIRS.length >= 30, "the pair list has been emptied — a vacuous pass");
  const failures = [];
  for (const [fg, bg, size] of CONTRAST_PAIRS) {
    assert.ok(fg in C && bg in C, `${fg} / ${bg} must both be tokens`);
    const r = contrast(fg, bg);
    if (r < REQUIRED[size]) failures.push(`${fg} on ${bg} (${size}): ${r.toFixed(2)} < ${REQUIRED[size]}`);
  }
  assert.deepEqual(failures, []);
});

test("⛔ the forbidden pairs really are below AA — orange on cream, white on orange", () => {
  // If one of these ever passes, the palette moved and the rule in colorTokens.js's header is stale;
  // re-derive it rather than delete the assertion.
  for (const [fg, bg, size, what] of FORBIDDEN_PAIRS) {
    const r = contrast(fg, bg);
    assert.ok(r < REQUIRED[size], `${what} now passes (${r.toFixed(2)}) — revisit the rule`);
  }
});

test("the palette is the logo's: ACCENT is #FD4600, INK is near-black and NOT pure black", () => {
  assert.equal(C.ACCENT, "#FD4600", "the accent is keyed from the logo source");
  assert.notEqual(C.INK.toUpperCase(), "#000000", "pure black on cream vibrates — the doc forbids it");
  assert.ok(contrast("INK", "CANVAS") < 18, "INK is so dark it is effectively black");
  assert.equal(C.ON_ACCENT, C.INK, "text on the orange fill is ink — white fails AA on #FD4600");
  // Hex tokens are 6-digit so `${token}44` alpha suffixes stay valid CSS.
  for (const [k, v] of Object.entries(C)) {
    if (v.startsWith("#")) assert.match(v, /^#[0-9A-F]{6}$/i, `${k} must be a 6-digit hex`);
  }
});

test("the tokens are published as custom properties from the one definition", () => {
  const set = new Map();
  installColorVars({ documentElement: { style: { setProperty: (k, v) => set.set(k, v) } } });
  assert.equal(set.get("--c-accent"), "#FD4600");
  assert.equal(set.get("--c-accent-quiet"), C.ACCENT_QUIET);
  assert.equal(set.size, Object.keys(C).length);
  assert.equal(cssVarName("SURFACE_MENU"), "--c-surface-menu");
  // And the app loads it before anything paints.
  assert.match(fs.readFileSync("client/src/main.jsx", "utf8"), /import "\.\/styles\/colorTokens\.js";/);
});

// Comment-stripped: the files' own notes describe the removed mechanisms by name.
const code = (p) => fs.readFileSync(p, "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("the per-session random accent and the video background are gone", () => {
  const theme = code("client/src/styles/theme.jsx");
  assert.doesNotMatch(theme, /Math\.random/, "the accent is random again");
  assert.doesNotMatch(theme, /rm_session_accent/, "the per-session accent key is back");
  assert.doesNotMatch(theme, /ACCENT_OPTIONS/, "the four-accent menu is back");
  assert.ok(!fs.existsSync("client/src/components/CinematicBackground.jsx"),
    "the video background component is back");
  assert.doesNotMatch(code("client/src/components/TopBar.jsx"), /setAccentId|ACCENT_OPTIONS/,
    "the accent picker is back in the profile menu");
  const shell = code("client/src/themes/cinematic.js");
  assert.match(shell, /Wrapper: PaperBackground/, "the substrate is not the paper");
  assert.doesNotMatch(shell, /\.mp4|<video/i);
  const paper = code("client/src/components/PaperBackground.jsx");
  assert.match(paper, /feTurbulence/, "the grain is not generated");
  assert.doesNotMatch(paper, /animation|<video|requestAnimationFrame/, "the substrate moves — it must be still");
});
