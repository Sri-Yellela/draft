// ── The leather substrate's settings, per theme ─────────────────────────────────────────────
//
// Consumed by components/PaperBackground.jsx; proved by test/colorTokens.test.js, which computes
// each theme's worst-case pixel from THESE numbers and refuses any setting past the contrast floor.
//
// LIGHT is the owner's pick (bench C, 09-30): a crisp pebble, the shadow is what could darken the
// cream toward the text, so GRAIN is bounded by CANVAS_SHADE; the white sheen only lightens.
// DARK inverts it: the text is light, so the SHEEN (toward SHEEN_TINT) is the layer that could wash
// toward it and is bounded by the dark CANVAS_SHADE; the near-black shadow only deepens.
export const PAPER = Object.freeze({
  light: Object.freeze({ freq: 0.34, octaves: 2, gain: 2.2, bias: 0.85, grain: 0.12, fibre: 0, sheen: 0.55 }),
  dark:  Object.freeze({ freq: 0.34, octaves: 2, gain: 2.2, bias: 0.85, grain: 0.40, fibre: 0, sheen: 0.12 }),
});
export const alphaMax = (p) => Math.min(1, p.gain - p.bias);
