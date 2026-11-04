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

const { C, C_LIGHT, C_DARK, CONTRAST_PAIRS, FORBIDDEN_PAIRS, cssVarName, installColorVars, resolveTheme, themePreference } =
  await import("../client/src/styles/colorTokens.js");
// ⭐ D149 (11-03): the live palette under Node is now the DEFAULT, Dusk Light. The rules in this file are PAPER LIGHT's
// (the logo-orange accent, the forbidden pairs), so they read Paper Light explicitly; Dusk is held by d91ThemeModule.
let PAL = C_LIGHT;

// ── WCAG 2.x relative luminance ────────────────────────────────────────────────────────────────
function parse(v) {
  let m = /^#([0-9a-f]{6})$/i.exec(v);
  if (m) return { rgb: [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)), a: 1 };
  m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)$/.exec(v);
  if (m) return { rgb: [+m[1], +m[2], +m[3]], a: m[4] === undefined ? 1 : +m[4] };
  throw new Error(`unparseable colour ${v}`);
}
const value = (nameOrLiteral) => (nameOrLiteral in PAL ? PAL[nameOrLiteral] : nameOrLiteral);
// A translucent colour is composited over the WORST-CASE paper, CANVAS_SHADE (of the theme in use).
function opaque(nameOrLiteral, under = PAL.CANVAS_SHADE) {
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
    assert.ok(fg in C_LIGHT && bg in C_LIGHT, `${fg} / ${bg} must both be tokens`);
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
  assert.equal(C_LIGHT.ACCENT, "#FD4600", "the accent is keyed from the logo source");
  // D91 (owner 10-11): this rule is PAPER LIGHT's — pure black on CREAM vibrates. Contrast Light is pure black
  // on pure white by design (test/d91ContrastThemes.test.js), so the rule is scoped to the paper theme.
  assert.notEqual(C_LIGHT.INK.toUpperCase(), "#000000", "pure black on cream vibrates — the doc forbids it");
  assert.ok(contrast("INK", "CANVAS") < 18, "INK is so dark it is effectively black");
  assert.equal(C_LIGHT.ON_ACCENT, C_LIGHT.INK, "text on the orange fill is ink — white fails AA on #FD4600");
  // Hex tokens are 6-digit so `${token}44` alpha suffixes stay valid CSS — in the live palette too.
  for (const [k, v] of [...Object.entries(C_LIGHT), ...Object.entries(C)]) {
    if (v.startsWith("#")) assert.match(v, /^#[0-9A-F]{6}$/i, `${k} must be a 6-digit hex`);
  }
});

test("the tokens are published as custom properties from the one definition", () => {
  const set = new Map();
  installColorVars({ documentElement: { style: { setProperty: (k, v) => set.set(k, v) } } });
  assert.equal(set.get("--c-accent"), C.ACCENT, "the live palette's own accent (Dusk by default, D149)");
  assert.equal(set.get("--c-accent-quiet"), C.ACCENT_QUIET);
  assert.equal([...set.keys()].filter(k => k.startsWith("--c-")).length, Object.keys(C).length);
  assert.equal(set.get("color-scheme"), "light", "the page must say which scheme it is");
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

test("the leather can never cross either theme's contrast floor, however it is tuned", async () => {
  // Taste sets the grain (the owner chose bench C, 09-30); the FLOOR is not taste. Light: the
  // shadow layers darken toward GRAIN and must stay lighter than CANVAS_SHADE. Dark: the floor
  // inverts — the SHEEN lightens toward SHEEN_TINT and must stay darker than the dark CANVAS_SHADE.
  // Computed from styles/paper.js, the numbers the component draws with.
  const { PAPER, alphaMax } = await import("../client/src/styles/paper.js");
  const hex = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const floor = (P, toward) => {
    const [c, s, g] = [hex(P.CANVAS), hex(P.CANVAS_SHADE), hex(P[toward])];
    return Math.min(...c.map((ci, i) => (s[i] - ci) / (g[i] - ci)));
  };
  // D91: EVERY registered theme, by its scheme — a light theme's shadow, a dark theme's sheen.
  const { THEME_LIST } = await import("../client/src/themes/index.js");
  assert.ok(THEME_LIST.length >= 2, "the registry lost a theme");
  for (const t of THEME_LIST) {
    const P = PAPER[t.id], T = t.tokens;
    assert.ok(P, `${t.id} has no substrate`);
    if (t.scheme === "light") {
      const worst = 1 - (1 - alphaMax(P) * P.grain) * (1 - alphaMax(P) * P.fibre);
      assert.ok(worst < floor(T, "GRAIN"),
        `${t.id}: the darkest pebble covers ${(worst * 100).toFixed(2)}% — the floor is ${(floor(T, "GRAIN") * 100).toFixed(2)}%`);
    } else {
      const worst = alphaMax(P) * P.sheen;
      assert.ok(worst < floor(T, "SHEEN_TINT"),
        `${t.id}: the lightest sheen covers ${(worst * 100).toFixed(2)}% — the floor is ${(floor(T, "SHEEN_TINT") * 100).toFixed(2)}%`);
    }
  }
  // The component reads these, not its own copies.
  const src = fs.readFileSync("client/src/components/PaperBackground.jsx", "utf8");
  assert.match(src, /const P = PAPER\[ACTIVE_THEME\.id\]/);
});

// ── DARK MODE (UI step 6, 09-30) ────────────────────────────────────────────────────────────────

test("the two palettes have IDENTICAL keys — a token cannot exist in one theme only", () => {
  assert.deepEqual(Object.keys(C_DARK).sort(), Object.keys(C_LIGHT).sort());
  for (const [k, v] of Object.entries(C_DARK)) {
    if (v.startsWith("#")) assert.match(v, /^#[0-9A-F]{6}$/i, `${k} must be a 6-digit hex (alpha suffixes)`);
  }
});

test("⛔ every declared pair passes AA in DARK too — passing on cream says nothing about charcoal", () => {
  PAL = C_DARK;
  try {
    const failures = [];
    for (const [fg, bg, size] of CONTRAST_PAIRS) {
      const r = contrast(fg, bg);
      if (r < REQUIRED[size]) failures.push(`${fg} on ${bg} (${size}): ${r.toFixed(2)} < ${REQUIRED[size]}`);
    }
    assert.deepEqual(failures, []);
    // In dark the floor INVERTS: CANVAS_SHADE is the LIGHTEST substrate tone, so it must be lighter
    // than CANVAS — the worst case for light text — and still dark.
    assert.ok(contrast("CANVAS_SHADE", "#000000") > contrast("CANVAS", "#000000"), "dark CANVAS_SHADE is not the lighter tone");
  } finally { PAL = C_LIGHT; }
});

test("the theme preference: system follows the OS; an explicit choice wins; junk is system", () => {
  const mm = (dark) => () => ({ matches: dark });
  assert.equal(resolveTheme("dark", mm(false)), "dark");
  assert.equal(resolveTheme("light", mm(true)), "light");
  assert.equal(resolveTheme("system", mm(true)), "dark");
  assert.equal(resolveTheme("system", mm(false)), "light");
  // ⭐ D149: junk (or nothing, or blocked storage) is the DEFAULT now — Dusk.
  assert.equal(themePreference({ getItem: () => "neon" }), "dusk");
  assert.equal(themePreference({ getItem: () => { throw new Error("blocked"); } }), "dusk");
});

test("the ACCOUNT's theme wins on a device — and reloads only when the screen would change", async () => {
  const { adoptAccountTheme } = await import("../client/src/styles/colorTokens.js");
  let reloads = 0;
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  try {
    // Under Node the live theme is the default, Dusk Light (D149). Account says dusk-light: stored, NO reload.
    assert.equal(adoptAccountTheme("dusk-light", { reload: () => reloads++ }), false);
    assert.equal(store.get("draft-theme"), "dusk-light");
    // Account says dark: stored, and a reload (the screen must change).
    assert.equal(adoptAccountTheme("dark", { reload: () => reloads++ }), true);
    assert.equal(reloads, 1);
    // Already agreeing: nothing at all — no loop after the reload.
    assert.equal(adoptAccountTheme("dark", { reload: () => reloads++ }), false);
    assert.equal(reloads, 1);
    // Junk is ignored.
    assert.equal(adoptAccountTheme("neon", { reload: () => reloads++ }), false);
  } finally { delete globalThis.localStorage; }
});
