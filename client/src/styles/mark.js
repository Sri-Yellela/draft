// ── D60 · THE MARK — status and tags, never a capsule ─────────────────────────────────────────────
//
// Owner 10-07: "I want the pill design to be permanently barred from all future designs." Every
// non-interactive tag, status and band that used to be a filled capsule (`borderRadius: 999`) is now a
// MARK — the sketch's `.mkr` (extension-latest.html, "Pills → marks"): a rectangle, radius 6, text in
// the logo face at 10.5px, a 3px LEADING BAR in the status colour and a 12% tint of it behind. The bar
// carries the state so it still reads without the tint — the colour-blind-safe version of a capsule.
//
// Interactive things are depth boxes (DepthButton / .dbx-depth), never marks. Counts (the nav's 2, a
// quota) are `countStyle` — a small rectangle, radius 6. The CSS twin of both is `.mark` / `.mark-count`
// in components/DepthButton.css, for stylesheets. test/d60NoPills.test.js is the guard.
import { C } from "./colorTokens.js";
import { bandStyle } from "./bandStyle.js";

export const LOGO_FACE = "'Poppins', var(--font-body)";

// ── D91 P4 · SHAPE CUES — the glyph and edge every status mark carries, inert until the user turns cues on
// (<html data-cues="shape">, styles/cues.css). ✓ solid · ! dashed · ✕ double · i dotted. The kind is read
// from the status TOKEN the mark is drawn in (resolved once with the theme, so identity is meaning), or given.
const CUES = Object.freeze({
  ok:   Object.freeze({ "--mark-glyph": '"✓"', "--mark-edge": "solid" }),
  warn: Object.freeze({ "--mark-glyph": '"!"', "--mark-edge": "dashed" }),
  bad:  Object.freeze({ "--mark-glyph": '"✕"', "--mark-edge": "double" }),
  info: Object.freeze({ "--mark-glyph": '"i"', "--mark-edge": "dotted" }),
});
const KIND_BY_COLOUR = new Map([
  // (Not BAND_UNKNOWN: it is INK_MUTED's value in Paper Light, so every muted tag would read "i". A band mark
  // names its kind — bandMarkStyle below.)
  [C.INFO, "info"],
  [C.WARNING, "warn"], [C.BAND_MODERATE, "warn"],
  [C.DANGER, "bad"], [C.BAND_WEAK, "bad"],
  [C.SUCCESS, "ok"], [C.BAND_STRONG, "ok"],
]);
/** The cue (custom properties) for a status kind — "ok" | "warn" | "bad" | "info" — or null. */
export function statusCue(kind) { return CUES[kind] || null; }
const DOT_COLOUR = { ok: C.SUCCESS, warn: C.WARNING, bad: C.DANGER, info: C.INFO };
/** A status DOT's cue (a 5–7px circle that carries meaning by colour): under cues it draws its glyph in
 *  the dot's own box instead of the fill. Spread into the dot's style; inert until cues are on. */
export function dotCue(kind) {
  const c = CUES[kind];
  return c ? { "--dot-glyph": c["--mark-glyph"], "--dot-c": DOT_COLOUR[kind] } : {};
}

/** A mark in `color` (a text-tone token). `dashed` draws the bar dashed and drops the tint — the
 *  "not a grade" treatment Not enough signal needs (bandStyle.js). `kind` names the status when the colour
 *  alone does not (a muted tag that means "failed"). */
// ⛔⛔ D152 (7b) (owner 11-04): THE LABEL CHIP IS RETIRED SITE-WIDE — the inline twin of .mark (DepthButton.css): a word or
// a short phrase in D145's plain type, no box / border / fill / bar / heavy italic. A STATE (a status colour) gets a 6px
// dot before the word, drawn as a background (the shape cue's ::before keeps its place), and the word in body grey; any
// other colour (the accent, a muted tag) is simply the word in that colour. `dashed` (Not enough signal — not a grade)
// drops the dot: a grey word.
export function markStyle(color, { dashed = false, kind = null } = {}) {
  const k = kind || KIND_BY_COLOUR.get(color);
  const state = !!k && !dashed;
  return {
    ...(statusCue(k) || {}),
    position: "relative",
    display: "inline-flex", alignItems: "center", gap: 6,
    borderRadius: 0, padding: state ? "0 0 0 12px" : 0,
    fontFamily: "var(--shape-font-ui, var(--font-body))", fontStyle: "normal", fontWeight: 500,
    fontSize: "calc(12.5px * var(--type-scale, 1))", lineHeight: 1.4,
    letterSpacing: 0, textTransform: "none", whiteSpace: "nowrap",
    color: state ? C.INK_MUTED : dashed ? C.INK_MUTED : color, border: 0,
    background: state ? `radial-gradient(circle at 3px 50%, ${color} 3px, transparent 3.5px) no-repeat` : "none",
  };
}

/** A fit band as a mark. Not enough signal stays the absence of a grade: dashed bar, no tint. */
export function bandMarkStyle(band) {
  const s = bandStyle(band);
  return markStyle(s.fg, { dashed: s.edgeStyle === "dashed", kind: s.cue });
}

/** A count — the nav's 2, "10 left": a small rectangle on the accent, never a capsule. */
export function countStyle({ quiet = false } = {}) {
  return {
    display: "inline-block", minWidth: 18, textAlign: "center", boxSizing: "border-box",
    borderRadius: 6, padding: "2px 5px",
    fontFamily: LOGO_FACE, fontStyle: "italic", fontWeight: 800, fontSize: 10.5, lineHeight: 1.2,
    background: quiet ? C.ACCENT_QUIET : C.ACCENT, color: quiet ? C.ACCENT_INK : C.ON_ACCENT,
  };
}
