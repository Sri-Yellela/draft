// scripts/d181PlainTokens.mjs — ⭐ D181 (owner 11-07: "one simple theme colorway for users who prefer it, very basic
// colorways and bgs") · writes client/src/themes/plain-light.js and plain-dark.js: neutral backgrounds, ONE accent, no
// tints. The palette is the D181 row's, verbatim; every other key is Paper Light's / Charcoal Dark's, then neutralised:
//   · COLOURWAYS OFF — the decorative hues (company tiles, the violet / teal marks, the warm glass and tints) take one
//     neutral or the one accent; meaning colours stay (success / warning / danger, the match bands, the providers' own
//     brand colours, draft's orange mark — the logo is never re-coloured).
//   · Type: no serif display — client/src/index.css sets --font-display to Inter Tight under [data-theme^="plain-"].
// Every declared text pair is held at AA by the same smallest-step rule as D144's generator (scripts/d144DuskTokens.mjs),
// and every move is written beside its token. Run: `node scripts/d181PlainTokens.mjs`.
import fs from "node:fs";
import paperLight from "../client/src/themes/paper-light.js";
import charcoalDark from "../client/src/themes/charcoal-dark.js";
import { CONTRAST_PAIRS, pairTarget } from "../client/src/styles/colorTokens.js";

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
const step = (v, toward) => { const p = parse(v); const end = toward === "dark" ? 0 : 255; return hex(p.rgb.map(c => c + (end - c) * 0.02)); };
function holdAA(T, scheme) {
  const moved = {};
  for (let guard = 0; guard < 600; guard++) {
    const fail = CONTRAST_PAIRS.find(([fg, bg, size]) => fg in T && bg in T && contrastIn(T, fg, bg) < pairTarget("aa", fg, bg, size));
    if (!fail) break;
    const [fg, bg] = fail;
    const fgP = parse(T[fg]);
    const extreme = fgP && fgP.a === 1 && (fgP.rgb.every(c => c >= 250) || fgP.rgb.every(c => c <= 5));
    const key = extreme ? bg : fg;
    if (!parse(T[key]) || parse(T[key]).a !== 1) throw new Error(`cannot hold ${fg} on ${bg} at AA by moving ${key}`);
    const dir = extreme ? (lum(fgP.rgb) > 0.5 ? "dark" : "light") : (scheme === "light" ? "dark" : "light");
    moved[key] = moved[key] || T[key];
    T[key] = step(T[key], dir);
  }
  return moved;
}

const rgba = (h, a) => `rgba(${[1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(",")},${a})`;
const ROW = "the D181 row (11-07)";
const NEUTRAL = "colourways off (D181): one neutral";
const ONE_ACCENT = "colourways off (D181): the one accent";
// The row's palette, verbatim.
const LIGHT = { bg: "#F6F7F9", card: "#FFFFFF", raise: "#F1F3F5", line: "#E3E6EA", ink: "#111111", body: "#4B5563", muted: "#5F6672",
  accent: "#1D4ED8", onAccent: "#FFFFFF", chip: "#EEF2FF", chipInk: "#1E3A8A", tile: "#4B5563", shade: "#ECEEF1", hover: "rgba(17,17,17,0.05)" };
const DARK = { bg: "#111315", card: "#1B1E21", raise: "#24282C", line: "#2E3338", ink: "#F3F4F6", body: "#C2C7CE", muted: "#A9B0B8",
  accent: "#8AB4F8", onAccent: "#0B1220", chip: "#1C2740", chipInk: "#BFD3FB", tile: "#3A4048", shade: "#16191C", hover: "rgba(255,255,255,0.06)" };

const plain = (t, scheme) => {
  const R = (v) => [v, ROW], N = (v) => [v, NEUTRAL], A = (v) => [v, ONE_ACCENT];
  const glassInk = scheme === "light" ? "17,17,17" : "0,0,0";
  return {
    CANVAS: R(t.bg), CANVAS_SHADE: N(t.shade), SURFACE_TINT: N(t.card), SURFACE: R(rgba(t.card, 0.98)), SURFACE_2: R(rgba(t.raise, 0.98)),
    SURFACE_MENU: R(rgba(t.card, 0.99)), SURFACE_MODAL: R(rgba(t.card, 0.99)), SURFACE_SOLID: R(t.card), HOVER: N(t.hover),
    GLASS_BODY_TOP: N(rgba(t.card, 0.92)), GLASS_BODY: N(rgba(t.card, 0.80)), GLASS_UNDERSIDE: N(`rgba(${glassInk},0.08)`),
    INK: R(t.ink), INK_MUTED: R(t.body), INK_FAINT: R(t.muted), BORDER: R(t.line),
    ACCENT: R(t.accent), ACCENT_HOVER: R(t.accent), ON_ACCENT: R(t.onAccent), ACCENT_INK: R(t.accent), ACCENT_QUIET: R(t.chip),
    INFO: N(t.body), VIOLET: A(t.accent), VIOLET_QUIET: A(t.chip), TEAL: A(t.accent),
    TILE_BLUE: N(t.tile), TILE_GREEN: N(t.tile), TILE_PURPLE: N(t.tile), TILE_ORANGE: N(t.tile), TILE_TEAL: N(t.tile), TILE_SLATE: N(t.tile), TILE_ROSE: N(t.tile),
    LOGO_TILE: N(t.raise),
    PAIR_SURFACE: R(t.card), PAIR_RAISED: R(t.raise), PAIR_INK: R(t.ink), PAIR_INK_MUTED: R(t.body), PAIR_INK_FAINT: R(t.muted), PAIR_RULE: R(t.line),
    PAIR_KICKER: R(t.accent), PAIR_ACCENT: R(t.accent), PAIR_HI: R(t.ink), PAIR_LIT: N(t.chip), PAIR_GENERIC: N(t.body),
    PAIR_GENERIC_QUIET: N(t.raise), PAIR_GENERIC_EDGE: N(t.line), PAIR_MAST_TINT: N("rgba(0,0,0,0)"), PAIR_CARD_SHADOW: N("none"),
    FH_SURFACE: R(t.card), FH_WELL: R(t.raise), FH_LINE: R(t.line), FH_ACCENT_EDGE: R(t.accent), FH_ON_ACCENT: R(t.onAccent),
    FH_SEG_LIFT: N("none"), FH_ADD_HOVER: N(`0 4px 12px rgba(${glassInk},0.12)`), PP_ATS_NUMBER: R(t.accent),
    DEPTH_ACCENT: N(`0 2px 6px rgba(${glassInk},0.14)`),
  };
};

const OVERRIDES = {
  "plain-light": { base: paperLight, label: "Plain Light", scheme: "light", tokens: plain(LIGHT, "light"), substrate: { grain: 0, fibre: 0, sheen: 0 } },
  "plain-dark": { base: charcoalDark, label: "Plain Dark", scheme: "dark", tokens: plain(DARK, "dark"), substrate: { grain: 0, fibre: 0, sheen: 0 } },
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
    const note = moved[k] ? `${why ? `${why}; ` : ""}was ${moved[k]}, moved the smallest step that holds AA` : why;
    return `  ${(k + ":").padEnd(w)}${JSON.stringify(T[k])},${note ? `   // ${note}` : ""}`;
  });
  const sub = { ...o.base.substrate, ...o.substrate };
  const file = `// ── ${o.label.toUpperCase()} — neutral backgrounds, one accent, no tints (D181) ────────────────────────────────
//
// Owner 11-07: "one simple theme colorway for users who prefer it, very basic colorways and bgs."
// ⛔ GENERATED by scripts/d181PlainTokens.mjs — do not hand-edit: change it and run it. Keys with a note are the D181
// row's palette or its "colourways off" rule; every other key is ${o.base.label}'s, unchanged (meaning colours, the
// providers' brand colours and draft's orange mark are never re-coloured). No serif display: client/src/index.css.
const tokens = Object.freeze({
${lines.join("\n")}
});

export default Object.freeze({
  id: ${JSON.stringify(id)},
  label: ${JSON.stringify(o.label)},
  scheme: ${JSON.stringify(o.scheme)},
  contrast: "aa",
  tokens,
  // ${o.base.label}'s substrate, flat: no grain, no fibre, no sheen.
  substrate: Object.freeze(${JSON.stringify(sub).replace(/"(\w+)":/g, "$1: ").replace(/,/g, ", ").replace(/^\{/, "{ ").replace(/\}$/, " }")}),
});
`;
  fs.writeFileSync(`client/src/themes/${id}.js`, file);
  console.log(`wrote client/src/themes/${id}.js (${keys.length} keys, ${Object.keys(o.tokens).length} set by D181)`);
}
