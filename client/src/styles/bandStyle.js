// ── How a fit band LOOKS ─────────────────────────────────────────────────────────────────────
//
// shared/atsBands.js owns what a band IS — the cutpoints, the copy, the tone — and is imported by
// the server, the scorer's scripts and the client alike. How a band is PAINTED is a client concern
// and lives here, on the tokens in colorTokens.js. It used to live in atsBands.js as raw hex
// (`bg:"#dcfce7", fg:"#166534"`), which put the one palette the whole board reads outside the
// token file and outside the colour-literal guard's reach.
//
// ⛔ NOT ENOUGH SIGNAL IS DRAWN AS THE ABSENCE OF A GRADE, NOT AS A LOW ONE. Strong, Moderate and
// Weak are filled chips on one green-amber-red axis. Not enough signal has no fill and no hue:
// muted ink in a DASHED outline. The old treatment was a grey fill (#e5e7eb / #4b5563) — the same
// shape as Weak with a paler colour, which is exactly how a fourth, worse grade would look. A test
// (test/atsBandSurfaces.test.js) asserts the two differ in fill, text AND edge style.
import { C } from "./colorTokens.js";
import { ATS_BAND } from "../../../shared/atsBands.js";

const STYLES = {
  [ATS_BAND.STRONG]:   { fg: C.BAND_STRONG,   bg: C.BAND_STRONG_QUIET,   edge: C.BAND_STRONG,   edgeStyle: "solid" },
  [ATS_BAND.MODERATE]: { fg: C.BAND_MODERATE, bg: C.BAND_MODERATE_QUIET, edge: C.BAND_MODERATE, edgeStyle: "solid" },
  [ATS_BAND.WEAK]:     { fg: C.BAND_WEAK,     bg: C.BAND_WEAK_QUIET,     edge: C.BAND_WEAK,     edgeStyle: "solid" },
  [ATS_BAND.NOT_ENOUGH_SIGNAL]:
                       { fg: C.BAND_UNKNOWN,  bg: "transparent",         edge: C.BAND_UNKNOWN_EDGE, edgeStyle: "dashed" },
};

/** { fg, bg, edge, edgeStyle } for a band id; an unknown id paints as Not enough signal. */
export function bandStyle(band) {
  return STYLES[band] || STYLES[ATS_BAND.NOT_ENOUGH_SIGNAL];
}

/**
 * The chip every band surface draws. `edgeAlpha` softens the filled bands' outline (a two-digit
 * hex suffix, valid because the tokens are 6-digit); the dashed outline of Not enough signal is
 * never softened — it is the whole of that state's visual identity, and it must reach 3:1.
 */
export function bandChipStyle(band, { edgeAlpha = "55" } = {}) {
  const s = bandStyle(band);
  const dashed = s.edgeStyle === "dashed";
  return {
    background: s.bg,
    color: s.fg,
    border: `1px ${s.edgeStyle} ${dashed ? s.edge : `${s.edge}${edgeAlpha}`}`,
  };
}
