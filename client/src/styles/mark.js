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

/** A mark in `color` (a text-tone token). `dashed` draws the bar dashed and drops the tint — the
 *  "not a grade" treatment Not enough signal needs (bandStyle.js). */
export function markStyle(color, { dashed = false } = {}) {
  return {
    display: "inline-flex", alignItems: "center", gap: 6,
    borderRadius: 6, padding: "4px 8px 4px 7px",
    fontFamily: LOGO_FACE, fontStyle: "italic", fontWeight: 800, fontSize: 10.5, lineHeight: 1,
    letterSpacing: 0, textTransform: "none", whiteSpace: "nowrap",
    color, border: 0, borderLeft: `3px ${dashed ? "dashed" : "solid"} ${color}`,
    background: dashed ? "transparent" : `color-mix(in srgb, ${color} 12%, transparent)`,
  };
}

/** A fit band as a mark. Not enough signal stays the absence of a grade: dashed bar, no tint. */
export function bandMarkStyle(band) {
  const s = bandStyle(band);
  return markStyle(s.fg, { dashed: s.edgeStyle === "dashed" });
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
