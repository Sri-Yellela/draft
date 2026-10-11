#!/usr/bin/env node
// D91 P3 · DERIVE the contrast themes' tokens — one rule, run by a script, reviewed by a person.
//
//   node scripts/deriveThemeTokens.mjs            print every derived key, its source and its margin
//   node scripts/deriveThemeTokens.mjs --write    also (re)write client/src/themes/contrast-{light,dark}.js
//
// docs/THEME_MODULE.md §3 fixes the REPRESENTATIVE set (the sketch, docs/themes-contrast.html); this derives
// EVERY other key from the same-scheme AA theme (Contrast Light from Paper Light, Contrast Dark from Charcoal
// Dark) by §4's rule, and nothing else is hand-copied:
//   1. NEUTRALS ARE PURE GREY (R = G = B). An opaque neutral keeps its position between its source theme's
//      canvas and ink (in CIE L*), re-spaced onto the contrast theme's canvas and ink. A translucent value or
//      a shadow keeps its alpha; each neutral colour inside it snaps to pure black or white.
//   2. CHROMATIC TOKENS ARE ONLY THE BRAND SET and KEEP THEIR HUE: only HSL lightness moves, in the smallest
//      step (0.5%) that meets the theme's target on EVERY declared pair the token is in. A fill that only ever
//      sits under text (a quiet fill) starts from the theme's own quiet-fill lightness instead.
//   3. Third-party sign-in colours are their owners' — copied, and their pairs held at AA (4.5), not 7:1
//      (owner 10-11, docs/THEME_AUDIT.md §13 #8). The label on the orange fill is held at 4.5 (§11 #2).
// The output is a theme file per contrast theme; test/d91ThemeModule.test.js then proves every pair at AAA,
// the greys, the brand-only hues, and that the two invert.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const { default: paperLight } = await imp("client/src/themes/paper-light.js");
const { default: charcoalDark } = await imp("client/src/themes/charcoal-dark.js");
const { CONTRAST_PAIRS, AA_HELD, pairTarget } = await imp("client/src/styles/colorTokens.js");

// ── §3, the sketch's representative set (docs/themes-contrast.html), and nothing more ──────────────────
export const FIXED = {
  "contrast-light": {
    CANVAS: "#FFFFFF", CANVAS_SHADE: "#EDEDED",
    SURFACE: "rgba(255,255,255,0.72)", SURFACE_2: "rgba(250,250,250,0.86)", SURFACE_MENU: "rgba(255,255,255,0.98)",
    SURFACE_SOLID: "#FFFFFF", HOVER: "rgba(0,0,0,0.07)", SCRIM: "rgba(0,0,0,0.60)", SURFACE_INPUT: "rgba(0,0,0,0.04)",
    GLASS_SPECULAR: "rgba(255,255,255,1)", GLASS_SHEEN: "rgba(255,255,255,0.7)", GLASS_BODY_TOP: "rgba(255,255,255,0.88)",
    GLASS_BODY: "rgba(246,246,246,0.60)", GLASS_RIM: "rgba(0,0,0,0.26)",
    INK: "#000000", INK_MUTED: "#1A1A1A", INK_FAINT: "#404040",
    BORDER: "#C8C8C8", BORDER_STRONG: "#8C8C8C", BORDER_CONTROL: "#404040",
    ACCENT: "#FD4600", ACCENT_HOVER: "#FF6424", ON_ACCENT: "#000000", ACCENT_INK: "#8A2A00", ACCENT_QUIET: "#FFE3D5",
    SUCCESS: "#005A26", SUCCESS_QUIET: "#E6F4EC", WARNING: "#6B4500", WARNING_QUIET: "#FBF0D9",
    DANGER: "#9E0B0B", DANGER_QUIET: "#FDEEEE", INFO: "#0B4F8A", INFO_QUIET: "#E4EEF9",
    BAND_STRONG: "#005A26", BAND_STRONG_QUIET: "#E6F4EC", BAND_MODERATE: "#6B4500", BAND_MODERATE_QUIET: "#FBF0D9",
    BAND_WEAK: "#9E0B0B", BAND_WEAK_QUIET: "#FDEEEE", BAND_UNKNOWN: "#1A1A1A", BAND_UNKNOWN_EDGE: "#404040",
    DEPTH_REST: "0 0 0 1px rgba(0,0,0,0.20), 0 4px 10px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.95)",
    DEPTH_HOVER: "0 0 0 1px rgba(0,0,0,0.32), 0 9px 20px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.95)",
    DEPTH_ACCENT: "0 0 0 1px #A32E00, 0 5px 14px rgba(253,70,0,0.45), inset 0 1px 0 rgba(255,255,255,0.35)",
    SHADOW_GLASS: "0 0 0 1px rgba(0,0,0,0.16), 0 14px 30px -10px rgba(0,0,0,0.34)",
    LOGO_SLASH: "#FD4600", LOGO_WORD: "#000000", LOGO_TILE: "#FFFFFF",
    PAIR_MATCHED: "#005A26", PAIR_MISSING: "#9E0B0B", PAIR_GENERIC: "#5A5A5A",
  },
  "contrast-dark": {
    CANVAS: "#000000", CANVAS_SHADE: "#1A1A1A",
    SURFACE: "rgba(26,26,26,0.72)", SURFACE_2: "rgba(36,36,36,0.84)", SURFACE_MENU: "rgba(12,12,12,0.98)",
    SURFACE_SOLID: "#121212", HOVER: "rgba(255,255,255,0.12)", SCRIM: "rgba(0,0,0,0.78)", SURFACE_INPUT: "rgba(255,255,255,0.08)",
    GLASS_SPECULAR: "rgba(255,255,255,0.50)", GLASS_SHEEN: "rgba(255,255,255,0.09)", GLASS_BODY_TOP: "rgba(40,40,40,0.80)",
    GLASS_BODY: "rgba(16,16,16,0.58)", GLASS_RIM: "rgba(255,255,255,0.32)",
    INK: "#FFFFFF", INK_MUTED: "#E6E6E6", INK_FAINT: "#BDBDBD",
    BORDER: "#404040", BORDER_STRONG: "#737373", BORDER_CONTROL: "#BDBDBD",
    ACCENT: "#FD4600", ACCENT_HOVER: "#FF6424", ON_ACCENT: "#000000", ACCENT_INK: "#FF9466", ACCENT_QUIET: "#3A1A0C",
    SUCCESS: "#46D683", SUCCESS_QUIET: "#0C2A1A", WARNING: "#FFC044", WARNING_QUIET: "#2C2208",
    DANGER: "#FF8080", DANGER_QUIET: "#301010", INFO: "#6DB8FF", INFO_QUIET: "#0E2236",
    BAND_STRONG: "#46D683", BAND_STRONG_QUIET: "#0C2A1A", BAND_MODERATE: "#FFC044", BAND_MODERATE_QUIET: "#2C2208",
    BAND_WEAK: "#FF8080", BAND_WEAK_QUIET: "#301010", BAND_UNKNOWN: "#E6E6E6", BAND_UNKNOWN_EDGE: "#BDBDBD",
    DEPTH_REST: "0 0 0 1px rgba(255,255,255,0.16), 0 6px 16px rgba(255,255,255,0.07), inset 0 1px 0 rgba(255,255,255,0.30)",
    DEPTH_HOVER: "0 0 0 1px rgba(255,255,255,0.28), 0 10px 26px rgba(255,255,255,0.12), inset 0 1px 0 rgba(255,255,255,0.40)",
    DEPTH_ACCENT: "0 0 0 1px #FF6424, 0 6px 20px rgba(253,70,0,0.45), inset 0 1px 0 rgba(255,255,255,0.35)",
    SHADOW_GLASS: "0 0 0 1px rgba(255,255,255,0.14), 0 18px 40px -14px rgba(255,255,255,0.16)",
    LOGO_SLASH: "#FD4600", LOGO_WORD: "#FD4600", LOGO_TILE: "#FFFFFF",
    PAIR_MATCHED: "#46D683", PAIR_MISSING: "#FF8080", PAIR_GENERIC: "#A8A8A8",
  },
};
// The sketch's grain (§3 "grain alpha .06 / .10, neutral"): the same pebble, a neutral fibre tone.
export const SUBSTRATE = {
  "contrast-light": { freq: 0.34, octaves: 2, gain: 2.2, bias: 0.85, grain: 0.06, fibre: 0, sheen: 0.55 },
  "contrast-dark":  { freq: 0.34, octaves: 2, gain: 2.2, bias: 0.85, grain: 0.10, fibre: 0, sheen: 0.10 },
};
const THIRD_PARTY = /^(PROVIDER_|ON_PROVIDER$)/;
// Documents are never themed (THEME_MODULE §1): the cover letter's surface is the same in every theme.
export const DOCUMENT = /^DOC_/;
// Pairs held at AA in an AAA theme, each with its reason (the test names the same set).
// The targets and the two AA exceptions live beside CONTRAST_PAIRS (styles/colorTokens.js), shared with the tests.
export { AA_HELD };
const need = (fg, bg, size) => pairTarget("aaa", fg, bg, size);

// ── colour math ───────────────────────────────────────────────────────────────────────────────────────
const hex2 = (n) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0").toUpperCase();
const toHex = ([r, g, b]) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;
function parse(v) {
  let m = /^#([0-9a-f]{6})$/i.exec(v);
  if (m) return { rgb: [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)), a: 1 };
  m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)$/.exec(v);
  if (m) return { rgb: [+m[1], +m[2], +m[3]], a: m[4] === undefined ? 1 : +m[4] };
  return null;
}
const channel = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const lstar = (rgb) => { const y = lum(rgb); return y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y; };
function greyForLstar(L) {   // the pure grey with this L*
  let lo = 0, hi = 255;
  for (let i = 0; i < 20; i++) { const mid = (lo + hi) / 2; if (lstar([mid, mid, mid]) < L) lo = mid; else hi = mid; }
  const g = Math.round((lo + hi) / 2); return [g, g, g];
}
function rgb2hsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}
function hsl2rgb([h, s, l]) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r, g, b].map((v) => (v + m) * 255);
}
const chroma = (rgb) => Math.max(...rgb) - Math.min(...rgb);
/** The brand set, by hue: orange, amber, green, teal, blue, violet, red. */
export function brandFamily(rgb) {
  const [h] = rgb2hsl(rgb);
  return h < 12 || h >= 340 ? "red" : h < 32 ? "orange" : h < 52 ? "amber" : h < 75 ? null
    : h < 165 ? "green" : h < 195 ? "teal" : h < 235 ? "blue" : h < 300 ? "violet" : null;
}
// The keys whose MEANING is a hue (rule 2), by role. Every other opaque key is a neutral (rule 1). NAMED, not
// guessed by a saturation threshold: Paper Light's warm creams (#DED5C4, the grain's #5A4632) are saturated
// enough to fool one, and a threshold would file a quiet fill as tinted in light and grey in dark.
//   text  — carries text or meaning on a ground: starts at the source value, then rule 2's lightness search
//   fill  — only ever a ground under text: the hue of the Paper Light value, at the theme's quiet-fill lightness
//   edge  — a decorative tinted hairline: the Paper Light hue at a mid lightness, so it still reads as an edge
//   brand — the orange fill's own edge: the same-scheme source value, unchanged
export const HUE_KEYS = Object.freeze({
  VIOLET: "text", TEAL: "text", PAIR_KICKER: "text", PAIR_ACCENT: "text",
  VIOLET_QUIET: "fill", PAIR_MET_QUIET: "fill", PAIR_LIT: "fill", PAIR_MISSING_QUIET: "fill",
  PAIR_MATCHED_EDGE: "edge", PAIR_MISSING_EDGE: "edge", FH_ACCENT_EDGE: "brand",
});
// D48: one number, one colour — the header's ATS number IS the pair's kicker in every theme.
const ALIASES = { PP_ATS_NUMBER: "PAIR_KICKER", PAIR_KICKER: "PP_ATS_NUMBER" };

function contrastIn(T, fg, bg) {
  const opaque = (v, under = T.CANVAS_SHADE) => { const p = parse(v in T ? T[v] : v);
    if (p.a === 1) return p.rgb; const base = opaque(under); return p.rgb.map((c, i) => c * p.a + base[i] * (1 - p.a)); };
  const [hi, lo] = [lum(opaque(fg)), lum(opaque(bg))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// ── the derivation ─────────────────────────────────────────────────────────────────────────────────────
function snapNeutralsIn(value) {   // translucent / composite strings: every low-chroma colour to pure black or white
  return value.replace(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/g, (m, r, g, b, a) => {
    const rgb = [+r, +g, +b];
    if (chroma(rgb) >= 48) return m;   // a brand-tinted glow (the orange) stays
    const w = lum(rgb) > 0.18 ? 255 : 0;
    return `rgba(${w},${w},${w},${a === undefined ? 1 : a})`;
  }).replace(/#([0-9a-f]{6})\b/gi, (m) => { const rgb = parse(m).rgb; return chroma(rgb) < 48 ? toHex(greyForLstar(lstar(rgb))) : m; });
}

export function derive(id) {
  const dark = id === "contrast-dark";
  const source = dark ? charcoalDark.tokens : paperLight.tokens;
  const fixed = FIXED[id];
  const T = { ...fixed };
  const notes = {};
  const sC = lstar(parse(source.CANVAS).rgb), sI = lstar(parse(source.INK).rgb);
  const tC = lstar(parse(fixed.CANVAS).rgb), tI = lstar(parse(fixed.INK).rgb);
  const quietL = ["SUCCESS_QUIET", "WARNING_QUIET", "DANGER_QUIET", "INFO_QUIET"]
    .map((k) => rgb2hsl(parse(fixed[k]).rgb)[2]).reduce((a, b) => a + b) / 4;
  for (const [k, v] of Object.entries(source)) {
    if (k in fixed) continue;
    if (THIRD_PARTY.test(k)) { T[k] = v; notes[k] = "third party — copied"; continue; }
    if (DOCUMENT.test(k)) { T[k] = v; notes[k] = "the document surface — never themed"; continue; }
    if (k === "PAIR_KIND_ALPHA") { T[k] = "1"; notes[k] = "full opacity — a reduced label cannot reach 7:1"; continue; }
    if (k === "FH_ON_ACCENT") { T[k] = fixed.ON_ACCENT; notes[k] = "= ON_ACCENT — the darkest label the brand fill takes (6.05)"; continue; }
    const p = /^#[0-9a-f]{6}$/i.test(v) ? parse(v) : null;
    if (!p) { T[k] = snapNeutralsIn(v); notes[k] = "neutrals snapped to black / white, alpha kept"; continue; }
    const role = HUE_KEYS[k];
    if (!role) {
      const t = (lstar(p.rgb) - sC) / (sI - sC);
      T[k] = toHex(greyForLstar(Math.max(0, Math.min(100, tC + t * (tI - tC)))));
      notes[k] = `grey at ${Math.round(Math.max(0, Math.min(1, t)) * 100)}% canvas→ink`;
      continue;
    }
    const [h, s] = rgb2hsl(parse(paperLight.tokens[k]).rgb);
    if (role === "text") { T[k] = v; notes[k] = `${brandFamily(p.rgb)}, from ${v}`; }
    if (role === "brand") { T[k] = v; notes[k] = `the brand edge, as ${dark ? "Charcoal Dark" : "Paper Light"}`; }
    if (role === "fill") { T[k] = toHex(hsl2rgb([h, s, quietL])); notes[k] = `${brandFamily(parse(T[k]).rgb)} quiet fill (hue ${h.toFixed(0)}°)`; }
    if (role === "edge") { T[k] = toHex(hsl2rgb([h, s, dark ? 0.32 : 0.78])); notes[k] = `${brandFamily(parse(T[k]).rgb)} edge (hue ${h.toFixed(0)}°)`; }
  }
  T.PP_ATS_NUMBER = T.PAIR_KICKER; notes.PP_ATS_NUMBER = "= PAIR_KICKER (D48)";

  // Rule 2's search, for every foreground that misses its target — the sketch's own values included (where a
  // §3 value fails a pair the sketch did not compute, it moves the least distance that passes, and says so).
  // A grey moves in L* and stays grey; a hue keeps its hue and moves only in lightness. Away from the ground.
  const moved = {};
  for (let round = 0; round < 600; round++) {
    const failing = CONTRAST_PAIRS.filter(([fg, bg, size]) => contrastIn(T, fg, bg) < need(fg, bg, size));
    if (!failing.length) break;
    const [fg, bg] = failing[0];
    if (THIRD_PARTY.test(fg)) throw new Error(`${id}: a third party's pair fails (${fg} on ${bg}) — not ours to move`);
    const rgb = parse(T[fg]).rgb;
    const ground = parse(T[bg]).a === 1 ? parse(T[bg]).rgb : parse(T.CANVAS_SHADE).rgb;
    const darker = lum(rgb) <= lum(ground);
    let next;
    if (chroma(rgb) === 0) next = greyForLstar(Math.max(0, Math.min(100, lstar(rgb) + (darker ? -0.5 : 0.5))));
    else { const [h, s, l] = rgb2hsl(rgb); next = hsl2rgb([h, s, Math.max(0, Math.min(1, l + (darker ? -0.005 : 0.005)))]); }
    moved[fg] ??= T[fg];
    T[fg] = toHex(next);
    if (ALIASES[fg]) { moved[ALIASES[fg]] ??= T[ALIASES[fg]]; T[ALIASES[fg]] = T[fg]; }
  }
  for (const [k, from] of Object.entries(moved)) {
    notes[k] = `${k in fixed ? "§3 " : ""}${from} → ${T[k]}: the least move that passes every pair it is in` + (k in fixed ? "" : ` (${notes[k]})`);
  }
  const fails = [], margins = {};
  for (const [fg, bg, size] of CONTRAST_PAIRS) {
    const r = contrastIn(T, fg, bg), want = need(fg, bg, size);
    margins[fg] = Math.min(margins[fg] ?? 99, r - want);
    if (r < want) fails.push(`${fg} on ${bg} (${size}) ${r.toFixed(2)} < ${want}`);
  }
  // Keep the source's key order, so the file reads like the others.
  const tokens = Object.fromEntries(Object.keys(source).map((k) => [k, T[k]]));
  return { tokens, notes, fails, margins };
}

function render(id, { tokens, notes }) {
  const label = id === "contrast-light" ? "Contrast Light" : "Contrast Dark";
  const scheme = id === "contrast-light" ? "light" : "dark";
  const pad = Math.max(...Object.keys(tokens).map((k) => k.length)) + 2;
  const lines = Object.entries(tokens).map(([k, v]) =>
    `  ${(k + ":").padEnd(pad)}${JSON.stringify(v)},${k in FIXED[id] && !notes[k] ? "   // §3 (the sketch)" : `   // ${notes[k]}`}`);
  return [
    `// ── ${label.toUpperCase()} — ${scheme === "light" ? "black on white" : "white on black"}, AAA text, the brand kept ${"─".repeat(40)}`.slice(0, 104),
    "//",
    "// D91 (owner 10-10): \"two plain themes — high-contrast black and white, invertible like dark and light, the same",
    "// depth and glass effects, only the colour coding changes; they can KEEP the Draft orange accent and the green",
    "// and red markers.\" ⛔ GENERATED by scripts/deriveThemeTokens.mjs — do not hand-edit a value: change §3 or the",
    "// rule there, run it with --write, and review the printed margins. Keys marked §3 are the sketch's",
    "// (docs/themes-contrast.html); every other key is derived from " + (scheme === "light" ? "Paper Light" : "Charcoal Dark") + " by the rule (THEME_MODULE.md §4).",
    "// Targets: text 7:1, large text and UI 4.5:1; the label on the orange fill and third-party buttons held at 4.5.",
    "const tokens = Object.freeze({",
    ...lines,
    "});",
    "",
    "export default Object.freeze({",
    `  id: "${id}",`,
    `  label: "${label}",`,
    `  scheme: "${scheme}",`,
    `  contrast: "aaa",`,
    "  tokens,",
    `  substrate: Object.freeze(${JSON.stringify(SUBSTRATE[id]).replace(/"(\w+)":/g, "$1: ").replace(/,/g, ", ").replace(/\{/, "{ ").replace(/\}$/, " }")}),`,
    "});",
    "",
  ].join("\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  let bad = 0;
  for (const id of ["contrast-light", "contrast-dark"]) {
    const out = derive(id);
    console.log(`\n== ${id}: ${Object.keys(out.tokens).length} keys, ${Object.keys(FIXED[id]).length} from §3, ${out.fails.length} failing pairs`);
    for (const [k, n] of Object.entries(out.notes)) console.log(`  ${k.padEnd(22)} ${String(out.tokens[k]).slice(0, 44).padEnd(46)} ${n}`);
    const tight = Object.entries(out.margins).sort((a, b) => a[1] - b[1]).slice(0, 6);
    console.log("  tightest margins:", tight.map(([k, m]) => `${k} +${m.toFixed(2)}`).join(" · "));
    for (const f of out.fails) console.log("  FAIL", f);
    bad += out.fails.length;
    if (process.argv.includes("--write")) fs.writeFileSync(path.join(ROOT, `client/src/themes/${id}.js`), render(id, out));
  }
  process.exit(bad ? 1 : 0);
}
