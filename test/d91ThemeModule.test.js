// D91 · THE THEME MODULE — a theme is data, one file; the registry is the only place one is chosen.
//
// docs/THEME_MODULE.md §5 is the contract, and each rule is a test here: every theme supplies every key,
// hex stays 6-digit, every declared pair passes at the theme's OWN target, nothing outside themes/index.js
// decides a theme, the pre-paint script resolves exactly what the app resolves (no flash), and — P1's proof
// that building the module changed nothing — Paper Light and Charcoal Dark are pinned to the palettes as
// they stood before the move (sha256 of the token objects, measured on f04c927).
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const REG = await import("../client/src/themes/index.js");
const { THEME_LIST, THEMES, resolve, prePaintScript, installColorVars, ACTIVE_THEME, cssVarName } = REG;
const { CONTRAST_PAIRS, C_LIGHT, C_DARK } = await import("../client/src/styles/colorTokens.js");
const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");

// ── WCAG 2.x, translucent grounds composited over the theme's CANVAS_SHADE (as colorTokens.test.js) ──
function parse(v) {
  let m = /^#([0-9a-f]{6})$/i.exec(v);
  if (m) return { rgb: [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)), a: 1 };
  m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)$/.exec(v);
  if (m) return { rgb: [+m[1], +m[2], +m[3]], a: m[4] === undefined ? 1 : +m[4] };
  throw new Error(`unparseable colour ${v}`);
}
const channel = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
function contrastIn(T, fg, bg) {
  const opaque = (v, under = T.CANVAS_SHADE) => { const { rgb, a } = parse(v in T ? T[v] : v);
    if (a === 1) return rgb; const base = opaque(under); return rgb.map((c, i) => c * a + base[i] * (1 - a)); };
  const [hi, lo] = [lum(opaque(fg)), lum(opaque(bg))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
// The targets (§3): AA themes 4.5 text / 3 large and UI; AAA themes 7 text / 4.5 large and UI.
const TARGET = { aa: { normal: 4.5, large: 3, ui: 3 }, aaa: { normal: 7, large: 4.5, ui: 4.5 } };

test("the registry: one file per theme, the contract's six fields, unique ids that name their files", () => {
  assert.ok(THEME_LIST.length >= 2, "the registry lost a theme");
  const imports = [...read("client/src/themes/index.js").matchAll(/^import (\w+) from "\.\/([\w-]+)\.js";$/gm)];
  assert.equal(imports.length, THEME_LIST.length, "every imported theme file is in THEME_LIST, and nothing else is");
  for (const t of THEME_LIST) {
    assert.deepEqual(Object.keys(t).sort(), ["contrast", "id", "label", "scheme", "substrate", "tokens"], `${t.id}'s fields`);
    assert.ok(fs.existsSync(`client/src/themes/${t.id}.js`), `${t.id} is not in a file of its own name`);
    assert.ok(["light", "dark"].includes(t.scheme), `${t.id}: scheme`);
    assert.ok(["aa", "aaa"].includes(t.contrast), `${t.id}: contrast`);
    assert.ok(Object.isFrozen(t) && Object.isFrozen(t.tokens), `${t.id} is mutable`);
    assert.equal(THEMES[t.id], t);
  }
  assert.equal(new Set(THEME_LIST.map(t => t.id)).size, THEME_LIST.length, "two themes share an id");
});

test("⛔ every theme supplies EVERY key — no token exists in one theme only — and hex stays 6-digit", () => {
  const keys = Object.keys(THEMES["paper-light"].tokens).sort();
  assert.ok(keys.length >= 100, "the key set collapsed");
  for (const t of THEME_LIST) {
    assert.deepEqual(Object.keys(t.tokens).sort(), keys, `${t.id}'s key set`);
    for (const [k, v] of Object.entries(t.tokens)) {
      if (v.startsWith("#")) assert.match(v, /^#[0-9A-F]{6}$/i, `${t.id}.${k} must be a 6-digit hex (\`\${token}44\` suffixes)`);
    }
  }
});

test("⛔ every declared pair passes at the theme's OWN target", () => {
  assert.ok(CONTRAST_PAIRS.length >= 100, "the pair list has been emptied — a vacuous pass");
  const failures = [];
  for (const t of THEME_LIST) {
    const need = TARGET[t.contrast];
    for (const [fg, bg, size] of CONTRAST_PAIRS) {
      const r = contrastIn(t.tokens, fg, bg);
      if (r < need[size]) failures.push(`${t.id}: ${fg} on ${bg} (${size}) ${r.toFixed(2)} < ${need[size]}`);
    }
  }
  assert.deepEqual(failures, []);
});

test("⭐ P1 changed nothing: Paper Light and Charcoal Dark are the pre-move palettes, value for value", () => {
  const h = (o) => crypto.createHash("sha256").update(JSON.stringify(o)).digest("hex");
  // Measured 10-11 on f04c927, from styles/colorTokens.js C_LIGHT / C_DARK and styles/paper.js PAPER, before the move.
  assert.equal(h(THEMES["paper-light"].tokens), "84bef674ad453c97adff47f2829456aa701083fc038ebaec204b1e14af263ccc", "Paper Light's tokens moved");
  assert.equal(h(THEMES["charcoal-dark"].tokens), "20dadd282f307ec9437e74766aab7e025cfee6089e348775c074f1170dd108c2", "Charcoal Dark's tokens moved");
  assert.equal(h(THEMES["paper-light"].substrate), "45bb1c5a0ffefb4506661eca615ff30df3e0017c9ae2e6bca1bd8cfee739883b", "Paper Light's grain moved");
  assert.equal(h(THEMES["charcoal-dark"].substrate), "fda58e8ae1c8f36797e69d93c0f85c7f71caee4475171b18e10fa340ceb093b6", "Charcoal Dark's grain moved");
  // The old names are the theme sets themselves, not copies that could drift.
  assert.equal(C_LIGHT, THEMES["paper-light"].tokens);
  assert.equal(C_DARK, THEMES["charcoal-dark"].tokens);
});

test("resolve(): light and dark name the Paper pair; system follows the OS", () => {
  const mm = (dark) => () => ({ matches: dark });
  assert.equal(resolve("light", mm(true)).id, "paper-light");
  assert.equal(resolve("dark", mm(false)).id, "charcoal-dark");
  assert.equal(resolve("system", mm(true)).id, "charcoal-dark");
  assert.equal(resolve("system", mm(false)).id, "paper-light");
  assert.equal(resolve("neon", mm(false)).id, "paper-light", "junk is system");
  assert.equal(ACTIVE_THEME.id, "paper-light", "under Node (no window) the live theme is Paper Light");
});

test("the live theme is published: every token as --c-*, plus data-theme, data-contrast and color-scheme", () => {
  const set = new Map(), dataset = {};
  installColorVars({ documentElement: { dataset, style: { setProperty: (k, v) => set.set(k, v) } } });
  for (const [k, v] of Object.entries(ACTIVE_THEME.tokens)) assert.equal(set.get(cssVarName(k)), v);
  assert.equal(dataset.theme, ACTIVE_THEME.id);
  assert.equal(dataset.contrast, ACTIVE_THEME.contrast);
  assert.equal(set.get("color-scheme"), ACTIVE_THEME.scheme);
});

test("⛔ ONE decider: nothing outside themes/index.js reads the preference or the OS scheme, and the old registry is gone", () => {
  const files = fs.readdirSync("client/src", { recursive: true }).map(String)
    .filter(f => /\.(jsx?|css)$/.test(f)).map(f => path.join("client/src", f).replace(/\\/g, "/"));
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  const hits = [];
  for (const f of files) {
    if (f === "client/src/themes/index.js") continue;
    const s = strip(read(f));
    if (/prefers-color-scheme|["']draft-theme["']|rm_theme_id/.test(s)) hits.push(f);
    // A theme file is imported by the registry alone (colorTokens.js re-exports two under their old names).
    if (/from "(?:\.\.\/themes|\.)\/(?:paper-light|charcoal-dark)\.js"/.test(s) && f !== "client/src/styles/colorTokens.js") hits.push(`${f} imports a theme file`);
  }
  assert.deepEqual(hits, []);
  assert.doesNotMatch(strip(read("client/src/styles/theme.jsx")), /isDark|setThemeId|availableThemes|localStorage/,
    "the vestigial registry is back in the theme provider");
});

test("⛔ NO FLASH: the pre-paint script is inlined before first paint and resolves what the app resolves", () => {
  // index.html carries the marker; vite.config.js replaces it, and refuses to build without it.
  const html = read("client/index.html");
  assert.ok(html.includes("<!--d91-pre-paint-->"), "index.html lost the pre-paint marker");
  assert.ok(html.indexOf("<!--d91-pre-paint-->") < html.indexOf('<script type="module"'), "the marker sits after the bundle");
  assert.doesNotMatch(html.replace(/<!--[\s\S]*?-->/g, ""), /rm-bg-mode|data-bg/, "the dead pre-paint script is back");
  const vite = read("client/vite.config.js");
  assert.match(vite, /import \{ prePaintScript \} from "\.\/src\/themes\/index\.js";/);
  assert.match(vite, /themePrePaint,/);
  // Run it, for every preference × OS scheme, against a fake document — it must set exactly resolve()'s theme.
  const src = prePaintScript();
  assert.doesNotMatch(src, /<\/script/i);
  for (const pref of [null, "system", "light", "dark", "junk"]) for (const dark of [false, true]) {
    const attrs = {}, style = {};
    const documentElement = { setAttribute: (k, v) => { attrs[k] = v; }, style: { setProperty: (k, v) => { style[k] = v; } } };
    new Function("localStorage", "window", "document", src)(
      { getItem: () => pref }, { matchMedia: () => ({ matches: dark }) }, { documentElement });
    const want = resolve(pref ?? undefined, () => ({ matches: dark }));
    assert.equal(attrs["data-theme"], want.id, `pref ${pref}, OS dark ${dark}`);
    assert.equal(attrs["data-contrast"], want.contrast);
    assert.equal(style["color-scheme"], want.scheme);
    assert.equal(style["--c-canvas"], want.tokens.CANVAS, "the pre-paint ground is the theme's canvas");
  }
});
