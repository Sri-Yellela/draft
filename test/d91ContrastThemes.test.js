// D91 P3 · CONTRAST LIGHT / CONTRAST DARK — the two AAA themes, held to their rule.
//
// docs/THEME_MODULE.md §3–4: neutrals are PURE GREY, chromatic tokens are ONLY the brand set and keep the
// sketch's hues, the pair inverts, every declared pair reaches 7:1 (4.5 for large text and UI) — with exactly
// two named exceptions held at AA — and the files are what scripts/deriveThemeTokens.mjs writes, so a hand
// edit (or a rule change nobody re-ran) fails here.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const { THEMES, THEME_LIST } = await import("../client/src/themes/index.js");
const { CONTRAST_PAIRS, FORBIDDEN_PAIRS } = await import("../client/src/styles/colorTokens.js");
const { FIXED, derive, AA_HELD, brandFamily } = await import("../scripts/deriveThemeTokens.mjs");
const CL = THEMES["contrast-light"], CD = THEMES["contrast-dark"];

function parse(v) {
  let m = /^#([0-9a-f]{6})$/i.exec(v);
  if (m) return { rgb: [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)), a: 1 };
  m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)$/.exec(v);
  if (m) return { rgb: [+m[1], +m[2], +m[3]], a: m[4] === undefined ? 1 : +m[4] };
  return null;
}
const channel = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
function contrastIn(T, fg, bg) {
  const opaque = (v, under = T.CANVAS_SHADE) => { const p = parse(v in T ? T[v] : v);
    if (p.a === 1) return p.rgb; const base = opaque(under); return p.rgb.map((c, i) => c * p.a + base[i] * (1 - p.a)); };
  const [hi, lo] = [lum(opaque(fg)), lum(opaque(bg))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
// Every colour a token carries, including those inside a shadow string.
const coloursIn = (v) => [...String(v).matchAll(/#[0-9a-f]{6}\b|rgba?\([^)]*\)/gi)].map(m => parse(m[0])).filter(Boolean);
const THIRD_PARTY = /^(PROVIDER_|ON_PROVIDER$)/;

test("both contrast themes are registered, AAA, and the light/dark pair of one another", () => {
  assert.ok(CL && CD, "a contrast theme is missing from the registry");
  // D133 added the Studio pair (AA): the registry is no longer exactly four themes, but there are exactly two AAA ones.
  assert.equal(THEME_LIST.filter(t => t.contrast === "aaa").length, 2);
  assert.deepEqual([CL.scheme, CL.contrast, CD.scheme, CD.contrast], ["light", "aaa", "dark", "aaa"]);
  assert.equal(CL.label, "Contrast Light");
  assert.equal(CD.label, "Contrast Dark");
});

test("⛔ every declared pair reaches AAA — 7:1 text, 4.5 large and UI — save the two named AA exceptions", () => {
  const failures = [], held = new Set();
  for (const t of [CL, CD]) for (const [fg, bg, size] of CONTRAST_PAIRS) {
    const why = AA_HELD(fg, bg);
    const need = why ? { normal: 4.5, large: 3, ui: 3 }[size] : { normal: 7, large: 4.5, ui: 4.5 }[size];
    if (why) held.add(why);
    const r = contrastIn(t.tokens, fg, bg);
    if (r < need) failures.push(`${t.id}: ${fg} on ${bg} (${size}) ${r.toFixed(2)} < ${need}`);
  }
  assert.deepEqual(failures, []);
  // Exactly the two exceptions the owner approved (10-11): the brand fill's label, third-party buttons.
  assert.deepEqual([...held].sort(), ["a third party's brand colour", "the label on the brand orange fill"]);
  // …and exactly these eight declared pairs — no more — whatever the rule is written as.
  assert.deepEqual(CONTRAST_PAIRS.filter(([fg, bg]) => AA_HELD(fg, bg)).map(([fg, bg]) => `${fg}/${bg}`).sort(), [
    "FH_ON_ACCENT/ACCENT", "FH_ON_ACCENT/ACCENT_HOVER", "ON_ACCENT/ACCENT", "ON_ACCENT/ACCENT_HOVER",
    "ON_PROVIDER/PROVIDER_GITHUB", "ON_PROVIDER/PROVIDER_GOOGLE", "ON_PROVIDER/PROVIDER_INDEED", "ON_PROVIDER/PROVIDER_LINKEDIN"]);
  // The rule itself is no wider than its two cases, for any token on those grounds.
  const tokens = Object.keys(CL.tokens);
  const anyHeld = tokens.flatMap((fg) => tokens.map((bg) => [fg, bg])).filter(([fg, bg]) => AA_HELD(fg, bg)).map(([fg, bg]) => `${fg}/${bg}`);
  assert.equal(anyHeld.length, 8, `an exception widened beyond its two cases: ${anyHeld.join(", ")}`);
});

test("⛔ the forbidden pairs still fail in Contrast Light, at its own target", () => {
  for (const [fg, bg, size, why] of FORBIDDEN_PAIRS) {
    const need = { normal: 7, large: 4.5, ui: 4.5 }[size];
    assert.ok(contrastIn(CL.tokens, fg, bg) < need, `"${why}" passes in Contrast Light`);
  }
});

test("⛔ neutrals are PURE GREY and every other colour is the brand set — shadows and glass included", () => {
  const stray = [];
  for (const t of [CL, CD]) for (const [k, v] of Object.entries(t.tokens)) {
    if (THIRD_PARTY.test(k)) continue;
    for (const { rgb } of coloursIn(v)) {
      const grey = rgb[0] === rgb[1] && rgb[1] === rgb[2];
      if (!grey && !brandFamily(rgb)) stray.push(`${t.id}.${k} ${v}`);
    }
  }
  assert.deepEqual(stray, []);
  // The §3 neutrals in particular (canvas, surfaces, text, borders) are R = G = B.
  for (const t of [CL, CD]) for (const k of ["CANVAS", "CANVAS_SHADE", "SURFACE_SOLID", "INK", "INK_MUTED", "INK_FAINT", "BORDER", "BORDER_STRONG", "BORDER_CONTROL"]) {
    const { rgb } = parse(t.tokens[k]);
    assert.ok(rgb[0] === rgb[1] && rgb[1] === rgb[2], `${t.id}.${k} is tinted`);
  }
});

test("the brand stays: the logo orange, the fill's label, and the green / red markers' hues", () => {
  for (const t of [CL, CD]) {
    assert.equal(t.tokens.ACCENT, "#FD4600", `${t.id}: the brand fill moved`);
    assert.equal(t.tokens.LOGO_SLASH, "#FD4600");
    assert.equal(brandFamily(parse(t.tokens.SUCCESS).rgb), "green");
    assert.equal(brandFamily(parse(t.tokens.DANGER).rgb), "red");
  }
  assert.equal(CL.tokens.LOGO_WORD, "#000000", "Contrast Light: an ink word");
  assert.equal(CD.tokens.LOGO_WORD, "#FD4600", "Contrast Dark: the all-orange mark (owner default)");
  for (const t of [CL, CD]) assert.equal(t.tokens.LOGO_TILE, "#FFFFFF", "a company logo sits on white paper in every contrast theme");
});

test("Contrast Light and Contrast Dark INVERT — canvas ↔ ink, text ↔ text, border ↔ border", () => {
  const L = (hex) => parse(hex).rgb[0] / 255;   // grey: one channel is the lightness
  assert.equal(CL.tokens.CANVAS, CD.tokens.INK, "light canvas = dark ink");
  assert.equal(CD.tokens.CANVAS, CL.tokens.INK, "dark canvas = light ink");
  for (const k of ["CANVAS_SHADE", "INK_MUTED", "INK_FAINT", "BORDER", "BORDER_STRONG", "BORDER_CONTROL"]) {
    const sum = L(CL.tokens[k]) + L(CD.tokens[k]);
    assert.ok(Math.abs(sum - 1) <= 0.12, `${k}: ${CL.tokens[k]} and ${CD.tokens[k]} do not invert (${sum.toFixed(2)})`);
  }
});

test("⛔ the files are the derivation: §3 kept (or moved the least, and saying so), the rest re-derivable", () => {
  for (const t of [CL, CD]) {
    const out = derive(t.id);
    assert.deepEqual(out.fails, [], `${t.id}: the derivation itself fails a pair`);
    assert.deepEqual({ ...t.tokens }, out.tokens, `${t.id}: the file is not what scripts/deriveThemeTokens.mjs writes — run it with --write`);
    const src = fs.readFileSync(`client/src/themes/${t.id}.js`, "utf8");
    for (const [k, v] of Object.entries(FIXED[t.id])) {
      if (t.tokens[k] !== v) assert.match(src, new RegExp(`${k}:\\s+"${t.tokens[k]}",\\s+// §3 ${v} → `), `${t.id}.${k} left the sketch without saying so`);
    }
  }
});

test("the pair, the header and the grain follow the contrast themes too", () => {
  for (const t of [CL, CD]) {
    assert.equal(t.tokens.PP_ATS_NUMBER, t.tokens.PAIR_KICKER, `${t.id}: D48 — the header's number is the kicker's colour`);
    assert.equal(t.tokens.PAIR_KIND_ALPHA, "1", `${t.id}: a reduced kind label cannot reach 7:1`);
  }
  // Contrast Light has no dark surface; in Contrast Dark the pair is as dark as the canvas.
  assert.ok(lum(parse(CL.tokens.PAIR_SURFACE).rgb) > 0.9);
  assert.ok(lum(parse(CD.tokens.PAIR_SURFACE).rgb) <= lum(parse(CD.tokens.CANVAS).rgb) + 0.001);
  assert.equal(CL.substrate.grain, 0.06, "the sketch's light grain");
  assert.equal(CD.substrate.grain, 0.10, "the sketch's dark grain");
});
