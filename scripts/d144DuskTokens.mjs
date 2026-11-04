// scripts/d144DuskTokens.mjs — ⭐ D144 · writes client/src/themes/dusk-light.js and dusk-dark.js: the warm-charcoal,
// peach-accent look the owner picked on 11-02 (sketch docs/sketches/themes-studio-dusk.html, his four answers in the
// D144 row) as a registry theme pair. Every key is written out (a theme file imports no other theme, D91): Paper Light's
// / Charcoal Dark's values, with the sketch's over the keys it names (OVERRIDES).
// Change OVERRIDES and run `node scripts/d144DuskTokens.mjs`; test/d91ThemeModule.test.js holds every pair at AA.
// ⛔ Corners and type are NOT here — they are the second, separate token set (client/src/themes/shapes.js), off for
// every other theme (owner's answer 1). Draft's orange mark stays orange (answer 4): LOGO_* are untouched.
import fs from "node:fs";
import paperLight from "../client/src/themes/paper-light.js";
import charcoalDark from "../client/src/themes/charcoal-dark.js";
import { CONTRAST_PAIRS, pairTarget } from "../client/src/styles/colorTokens.js";

// ⭐ D149 · THE SKETCH, HELD TO AA. The repository's contract (test/d91ThemeModule.test.js) holds every declared pair at
// AA; a few of the sketch's values fail it as small text (its muted grey, Dusk Light's coral). Each such token moves by
// the SMALLEST step that passes — darker in light, lighter in dark; a white / black label on the accent moves the accent
// instead — and every move is printed and written beside the token, so the owner sees each value next to the sketch's.
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
  const opaque = (v, under = T.CANVAS_SHADE) => { const p = parse(v in T ? T[v] : v); if (!p) return null;
    if (p.a === 1) return p.rgb; const base = opaque(under); return p.rgb.map((c, i) => c * p.a + base[i] * (1 - p.a)); };
  const a = opaque(fg), b = opaque(bg);
  if (!a || !b) return Infinity;
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
const hex = (rgb) => "#" + rgb.map(c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0").toUpperCase()).join("");
/** One step toward black (light) or white (dark), keeping the hue: mix 2% toward the end. */
const step = (v, toward) => { const p = parse(v); const end = toward === "dark" ? 0 : 255; return hex(p.rgb.map(c => c + (end - c) * 0.02)); };
function holdAA(T, scheme) {
  const moved = {};
  for (let guard = 0; guard < 400; guard++) {
    const fail = CONTRAST_PAIRS.find(([fg, bg, size]) => fg in T && bg in T && contrastIn(T, fg, bg) < pairTarget("aa", fg, bg, size));
    if (!fail) break;
    const [fg, bg] = fail;
    const fgP = parse(T[fg]);
    const extreme = fgP && fgP.a === 1 && (fgP.rgb.every(c => c >= 250) || fgP.rgb.every(c => c <= 5));
    const key = extreme ? bg : fg;
    if (!parse(T[key]) || parse(T[key]).a !== 1) throw new Error(`cannot hold ${fg} on ${bg} at AA by moving ${key}`);
    // Move the text away from its ground: darker in a light theme; lighter in a dark one. Moving the accent under a
    // white label darkens it; under a black label, lightens it.
    const dir = extreme ? (lum(fgP.rgb) > 0.5 ? "dark" : "light") : (scheme === "light" ? "dark" : "light");
    moved[key] = moved[key] || T[key];
    T[key] = step(T[key], dir);
  }
  return moved;
}

// ⭐ D149 (owner 11-03): "it has to look exactly as it is visualized in the HTML" — the values below are
// docs/sketches/theme-dusk-v2.html's, VERBATIM (its --bg / --card / --raise / --line / --ink / --body / --muted /
// --accent / --accent2 / --on-accent / --ok / --warn / --blue / --purple), mapped onto the token keys. Full House's
// FH_* and the posting's PAIR_* take the same card values: the sketches draw those surfaces as the card, not brown.
const DARK = { bg: "#1B1B1B", card: "#262626", raise: "#2E2E2E", line: "#343434", ink: "#FFFFFF", body: "#A3A3A3", muted: "#7A7A7A",
  accent: "#FBD3C4", accent2: "#F2C2B2", onAccent: "#1B1B1B", ok: "#8FD6A8", warn: "#F2C26B", blue: "#9DBEF0", purple: "#C6A8F0" };
const LIGHT = { bg: "#F7F3F0", card: "#FFFFFF", raise: "#FBF8F6", line: "#E6DED8", ink: "#1B1B1B", body: "#55504C", muted: "#8A837D",
  accent: "#C2593A", accent2: "#AD4C30", onAccent: "#FFFFFF", ok: "#1E7A43", warn: "#9A6400", blue: "#2F6FB3", purple: "#6E55E8" };
const rgba = (hex, a) => `rgba(${[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(",")},${a})`;
const SKETCH = (k) => [k, "theme-dusk-v2.html (D149)"];
const fromSketch = (t) => ({
  CANVAS: SKETCH(t.bg), SURFACE_SOLID: SKETCH(t.card), SURFACE: SKETCH(rgba(t.card, 0.96)), SURFACE_2: SKETCH(rgba(t.raise, 0.96)),
  SURFACE_MENU: SKETCH(rgba(t.card, 0.98)), SURFACE_MODAL: SKETCH(rgba(t.card, 0.99)),
  INK: SKETCH(t.ink), INK_MUTED: SKETCH(t.body), INK_FAINT: SKETCH(t.muted), BORDER: SKETCH(t.line),
  ACCENT: SKETCH(t.accent), ACCENT_HOVER: SKETCH(t.accent2), ON_ACCENT: SKETCH(t.onAccent), ACCENT_INK: SKETCH(t.accent),
  SUCCESS: SKETCH(t.ok), WARNING: SKETCH(t.warn), VIOLET: SKETCH(t.purple),
  FH_SURFACE: SKETCH(t.card), FH_WELL: SKETCH(t.raise), FH_LINE: SKETCH(t.line), FH_ACCENT_EDGE: SKETCH(t.accent2), FH_ON_ACCENT: SKETCH(t.onAccent),
  PP_ATS_NUMBER: SKETCH(t.accent),
  PAIR_SURFACE: SKETCH(t.card), PAIR_RAISED: SKETCH(t.raise), PAIR_INK: SKETCH(t.ink), PAIR_INK_MUTED: SKETCH(t.body), PAIR_INK_FAINT: SKETCH(t.muted),
  PAIR_RULE: SKETCH(t.line), PAIR_KICKER: SKETCH(t.accent), PAIR_ACCENT: SKETCH(t.accent), PAIR_HI: SKETCH(t.ink),
  PAIR_MAST_TINT: SKETCH("rgba(0,0,0,0)"), PAIR_CARD_SHADOW: SKETCH("none"),
});

const OVERRIDES = {
  "dusk-light": { base: paperLight, label: "Dusk Light", scheme: "light", tokens: {
    CANVAS_SHADE: ["#EEE8E2", "a step below the ground"],
    ACCENT_QUIET: ["#F6E1D8", "a pale coral tint"],
    INFO: ["#625B55", "answer 4: ordinary bars grey (deepened from the sketch's #8A817A to hold 4.5:1 as text on its quiet tint)"],
    DEPTH_ACCENT: ["0 6px 18px rgba(194,89,58,0.22), inset 0 1px 0 rgba(255,255,255,0.20)", "a faint warm glow under the button"],
    ...fromSketch(LIGHT) },
    substrate: { grain: 0 } },
  "dusk-dark": { base: charcoalDark, label: "Dusk Dark", scheme: "dark", tokens: {
    CANVAS_SHADE: ["#202020", "a step toward the card"], SURFACE_TINT: ["#2A2A2A", "neutral, not brown"],
    GLASS_BODY_TOP: ["rgba(46,46,46,0.86)", "the card's glass: neutral charcoal, not Charcoal's brown"],
    GLASS_BODY: ["rgba(38,38,38,0.70)", "the card's glass, below"], GLASS_EDGE: ["rgba(255,255,255,0.07)", "a faint neutral edge"],
    GLASS_HIGHLIGHT: ["rgba(255,255,255,0.06)", "neutral"], GLASS_SHEEN: ["rgba(255,255,255,0.04)", "neutral"],
    GLASS_RIM: ["rgba(255,255,255,0.06)", "neutral"],
    ACCENT_QUIET: ["#3A2E29", "a dark peach tint"],
    INFO: ["#9A9A9A", "answer 4: ordinary bars grey"],
    FH_SEG_LIFT: ["0 2px 6px rgba(251,211,196,0.25)", "the peach, not the orange"],
    DEPTH_ACCENT: ["0 10px 26px rgba(251,211,196,0.16), inset 0 1px 0 rgba(255,255,255,0.30)", "a faint warm glow under the button"],
    ...fromSketch(DARK) },
    substrate: { grain: 0, sheen: 0 } },
};

for (const [id, o] of Object.entries(OVERRIDES)) {
  const keys = Object.keys(o.base.tokens);
  for (const k of Object.keys(o.tokens)) if (!keys.includes(k)) throw new Error(`${id}: ${k} is not a token key`);
  const w = Math.max(...keys.map(k => k.length)) + 2;
  const T = Object.fromEntries(keys.map(k => [k, (o.tokens[k] || [o.base.tokens[k]])[0]]));
  const moved = holdAA(T, o.scheme);
  for (const [k, was] of Object.entries(moved)) console.log(`  ${id}: ${k} ${was} → ${T[k]} (held at AA)`);
  const lines = keys.map(k => {
    const why = (o.tokens[k] || [null, null])[1];
    const note = moved[k] ? `${why ? `${why}; ` : ""}the sketch's ${moved[k]}, moved the smallest step that holds AA` : why;
    return `  ${(k + ":").padEnd(w)}${JSON.stringify(T[k])},${note ? `   // ${note}` : ""}`;
  });
  const sub = { ...o.base.substrate, ...o.substrate };
  const file = `// ── ${o.label.toUpperCase()} — the warm-charcoal, peach-accent theme (D144) ──────────────────────────────────────
//
// Owner 11-02: "i like the theme used in the screenshot, we need this theme available to apply in both site and admin."
// A look designed in its spirit, never a copy: draft's own wordmark (orange, answer 4) and components. The owner picked
// the tokens on docs/sketches/themes-studio-dusk.html. ⛔ GENERATED by scripts/d144DuskTokens.mjs — do not hand-edit:
// change its OVERRIDES and run it. Keys with a note are the sketch's; every other key is ${o.base.label}'s, unchanged.
// Corners and type are the second token set (themes/shapes.js), not theme keys.
const tokens = Object.freeze({
${lines.join("\n")}
});

export default Object.freeze({
  id: ${JSON.stringify(id)},
  label: ${JSON.stringify(o.label)},
  scheme: ${JSON.stringify(o.scheme)},
  contrast: "aa",
  tokens,
  // ${o.base.label}'s substrate, flat: the look has no grain.
  substrate: Object.freeze(${JSON.stringify(sub).replace(/"(\w+)":/g, "$1: ").replace(/,/g, ", ").replace(/^\{/, "{ ").replace(/\}$/, " }")}),
});
`;
  fs.writeFileSync(`client/src/themes/${id}.js`, file);
  console.log(`wrote client/src/themes/${id}.js (${keys.length} keys, ${Object.keys(o.tokens).length} from the sketch)`);
}
