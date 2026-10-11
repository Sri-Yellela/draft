// ── The leather substrate's settings, per theme ─────────────────────────────────────────────
//
// Consumed by components/PaperBackground.jsx; proved by test/colorTokens.test.js, which computes
// each theme's worst-case pixel from THESE numbers and refuses any setting past the contrast floor.
//
// D91 (10-11): the numbers live in each theme file (`substrate`), beside the tokens they are proved
// against; this indexes them by theme id. A LIGHT scheme's shadow is what could darken the canvas
// toward the text, so GRAIN is bounded by CANVAS_SHADE and the white sheen only lightens (Paper Light
// is the owner's pick, bench C, 09-30). A DARK scheme inverts it: the text is light, so the SHEEN
// (toward SHEEN_TINT) is the layer that could wash toward it and is bounded by the dark CANVAS_SHADE.
import { THEME_LIST } from "../themes/index.js";

export const PAPER = Object.freeze(Object.fromEntries(THEME_LIST.map((t) => [t.id, t.substrate])));
export const alphaMax = (p) => Math.min(1, p.gain - p.bias);
