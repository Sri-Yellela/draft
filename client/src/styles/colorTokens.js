// ── The colour tokens ────────────────────────────────────────────────────────────────────────
//
// Every colour the client paints comes from this file. docs/UI_REDESIGN.md, sequence step 2:
// "⛔ every colour is a token from day one", because dark mode later has to be a matter of
// RE-POINTING these names, not of hunting literals across sixty files — which is exactly what the
// z-scale had to go through before zLayers.js existed. This file mirrors zLayers.js on purpose:
// one named object, published once as CSS custom properties so stylesheets never hold a copy, and a
// test (test/colorTokens.test.js) that reads the object rather than trusting it.
//
// Measured before this file existed (2026-09-29, client/src): 887 colour literals — 744 hex, 100
// rgb(a), 43 hsl(a) — in 60 of 152 files, 179 distinct values, over a looping night-sky VIDEO
// background and a per-session RANDOM accent chosen from four (sky, lemon, green, sunset). Both of
// those are gone (owner decision, 2026-09-27). What remains is counted and ratcheted by
// test/colorLiteralGuard.test.js; do not add to it.
//
// THE PALETTE is the logo's: cream paper, the mark's orange, glass. Values chosen so every declared
// text-on-background pair passes WCAG AA — see CONTRAST_PAIRS at the bottom, which is the list the
// test computes. Two findings from computing them, which constrain every caller:
//
//   1. ⛔ THE LOGO ORANGE IS A FILL, NEVER TEXT. #FD4600 on the cream canvas is 2.96:1 — it fails
//      4.5:1 for body text AND 3:1 for large text and UI indicators. Orange text, orange icons,
//      orange focus rings and orange input edges use ACCENT_INK, a deeper orange from the same hue.
//   2. ⛔ TEXT ON AN ORANGE FILL IS INK, NOT WHITE. White on #FD4600 is 3.47:1 — large-text only.
//      INK on it is 5.0:1. This is the /pricing precedent (`--color-primary-text` on a
//      `--color-primary` fill rendered invisible and shipped) stated as a token: ON_ACCENT exists
//      for that pairing and nothing else may stand in for it.
//
// Hex, 6-digit, wherever a caller may append an alpha suffix: a dozen components write
// `${theme.border}44` / `${theme.accent}22`, which is valid only on a 6-digit hex. Translucent
// tokens are therefore separate, named, and already carry their alpha.

// ── The palettes live in the theme files (D91) ────────────────────────────────────────────────────
//
// Each theme is one file under client/src/themes/, and themes/index.js is the ONLY place a theme is
// chosen (docs/THEME_MODULE.md §5). C_LIGHT / C_DARK stay exported under their old names — the tests,
// the extension's token generator and 47 importers of `C` read them from here — but they are the
// Paper Light and Charcoal Dark token sets, not copies. `C` is the live theme's set, resolved ONCE at
// load (a preference change reloads), so inline styles, CSS variables and hex-alpha suffixes always
// agree on one palette.
import paperLight from "../themes/paper-light.js";
import charcoalDark from "../themes/charcoal-dark.js";
export const C_LIGHT = paperLight.tokens;
export const C_DARK = charcoalDark.tokens;
export {
  THEME_STORAGE_KEY, THEME_PREFERENCES, themePreference, resolveTheme, setThemePreference, adoptAccountTheme,
  THEME, ACTIVE_THEME, C, cssVarName, installColorVars,
} from "../themes/index.js";

// ── The declared text-on-background pairs ─────────────────────────────────────────────────────
//
// Every combination the design uses to put text (or a UI indicator) on a background. The test
// computes each with the WCAG 2.x relative-luminance formula; translucent backgrounds are
// composited over CANVAS_SHADE, the darkest paper the grain produces. `size`:
//   "normal"  body text          4.5:1
//   "large"   ≥ 24px, or ≥ 18.66px bold   3:1
//   "ui"      control edges, focus rings, icons that carry meaning (WCAG 1.4.11)   3:1
// A pair that is not in this list is not sanctioned. Add it here, with the test, before using it.
export const CONTRAST_PAIRS = [
  // ink on paper and on glass
  ["INK",         "CANVAS_SHADE",  "normal"],
  ["INK_MUTED",   "CANVAS_SHADE",  "normal"],
  ["INK_FAINT",   "CANVAS_SHADE",  "normal"],
  ["INK",         "SURFACE",       "normal"],
  ["INK_MUTED",   "SURFACE",       "normal"],
  ["INK_FAINT",   "SURFACE",       "normal"],
  ["INK",         "SURFACE_2",     "normal"],
  ["INK_MUTED",   "SURFACE_2",     "normal"],
  ["INK_FAINT",   "SURFACE_2",     "normal"],
  ["INK",         "SURFACE_MENU",  "normal"],
  ["INK_MUTED",   "SURFACE_MENU",  "normal"],
  ["INK_FAINT",   "SURFACE_MENU",  "normal"],
  ["INK",         "SURFACE_INPUT", "normal"],
  ["INK_FAINT",   "SURFACE_INPUT", "normal"],   // placeholder text
  ["INK",         "ACCENT_QUIET",  "normal"],
  // the orange
  ["ON_ACCENT",   "ACCENT",        "normal"],   // the CTA label — the /pricing pairing
  ["ON_ACCENT",   "ACCENT_HOVER",  "normal"],
  ["ACCENT_INK",  "CANVAS_SHADE",  "normal"],
  ["ACCENT_INK",  "SURFACE",       "normal"],
  ["ACCENT_INK",  "SURFACE_MENU",  "normal"],
  ["ACCENT_INK",  "ACCENT_QUIET",  "normal"],   // selected tab / tag
  ["ACCENT_INK",  "CANVAS_SHADE",  "ui"],       // focus ring, active edge
  // the mark's word (D19) on every surface the mark sits on: the paper (the bar at rest, auth, the
  // marketing pages), the bar's glass once scrolled, and a menu. "large": the mark is >= 18px tall.
  ["LOGO_WORD",   "CANVAS_SHADE",  "large"],
  ["LOGO_WORD",   "SURFACE",       "large"],
  ["LOGO_WORD",   "SURFACE_2",     "large"],
  ["LOGO_WORD",   "SURFACE_MENU",  "large"],
  // control edges
  ["BORDER_CONTROL", "CANVAS_SHADE",  "ui"],
  ["BORDER_CONTROL", "SURFACE_INPUT", "ui"],
  // states: text on paper, and text on its own quiet fill
  ["SUCCESS", "CANVAS_SHADE", "normal"], ["SUCCESS", "SURFACE", "normal"], ["SUCCESS", "SUCCESS_QUIET", "normal"],
  ["WARNING", "CANVAS_SHADE", "normal"], ["WARNING", "SURFACE", "normal"], ["WARNING", "WARNING_QUIET", "normal"],
  ["DANGER",  "CANVAS_SHADE", "normal"], ["DANGER",  "SURFACE", "normal"], ["DANGER",  "DANGER_QUIET",  "normal"],
  ["INFO",    "CANVAS_SHADE", "normal"], ["INFO",    "SURFACE", "normal"], ["INFO",    "INFO_QUIET",    "normal"],
  // text on a SOLID state fill (a count badge, a status pill): paper-white on the state tone
  ["SURFACE_SOLID", "DANGER",  "normal"], ["SURFACE_SOLID", "SUCCESS", "normal"],
  ["SURFACE_SOLID", "WARNING", "normal"], ["SURFACE_SOLID", "INFO",    "normal"],
  ["SURFACE_SOLID", "INK",     "normal"],   // an inverted chip
  // third-party sign-in, and the source marks
  ["ON_PROVIDER", "PROVIDER_LINKEDIN", "normal"], ["ON_PROVIDER", "PROVIDER_GITHUB", "normal"],
  ["ON_PROVIDER", "PROVIDER_GOOGLE",   "normal"], ["ON_PROVIDER", "PROVIDER_INDEED", "normal"],
  // the categorical tones: text on paper/glass/own quiet fill, and paper-white on the tone (an avatar)
  ["VIOLET", "CANVAS_SHADE", "normal"], ["VIOLET", "SURFACE", "normal"], ["VIOLET", "VIOLET_QUIET", "normal"],
  ["TEAL",   "CANVAS_SHADE", "normal"], ["TEAL",   "SURFACE", "normal"],
  ["SURFACE_SOLID", "VIOLET", "normal"], ["SURFACE_SOLID", "TEAL", "normal"],
  // a company avatar's initial (SURFACE_SOLID) on each avatar tone — CompanyLogo (D61)
  ["SURFACE_SOLID", "SUCCESS", "normal"], ["SURFACE_SOLID", "DANGER", "normal"], ["SURFACE_SOLID", "WARNING", "normal"],
  // ── the fit bands ─────────────────────────────────────────────────────────────────────────
  // as TEXT on paper and on every glass the band appears on (card, panel, menu)
  ["BAND_STRONG",   "CANVAS_SHADE", "normal"], ["BAND_STRONG",   "SURFACE", "normal"], ["BAND_STRONG",   "SURFACE_2", "normal"],
  ["BAND_MODERATE", "CANVAS_SHADE", "normal"], ["BAND_MODERATE", "SURFACE", "normal"], ["BAND_MODERATE", "SURFACE_2", "normal"],
  ["BAND_WEAK",     "CANVAS_SHADE", "normal"], ["BAND_WEAK",     "SURFACE", "normal"], ["BAND_WEAK",     "SURFACE_2", "normal"],
  ["BAND_UNKNOWN",  "CANVAS_SHADE", "normal"], ["BAND_UNKNOWN",  "SURFACE", "normal"], ["BAND_UNKNOWN",  "SURFACE_2", "normal"],
  ["BAND_UNKNOWN",  "SURFACE_MENU", "normal"],
  // as FILLS: the band's own text on its quiet fill (the chip), and ink on it
  ["BAND_STRONG",   "BAND_STRONG_QUIET",   "normal"], ["INK", "BAND_STRONG_QUIET",   "normal"],
  ["BAND_MODERATE", "BAND_MODERATE_QUIET", "normal"], ["INK", "BAND_MODERATE_QUIET", "normal"],
  ["BAND_WEAK",     "BAND_WEAK_QUIET",     "normal"], ["INK", "BAND_WEAK_QUIET",     "normal"],
  // Not enough signal has no fill; its dashed edge is a UI boundary on paper and on glass
  ["BAND_UNKNOWN_EDGE", "CANVAS_SHADE", "ui"], ["BAND_UNKNOWN_EDGE", "SURFACE", "ui"],
  ["BAND_UNKNOWN_EDGE", "SURFACE_2", "ui"],
  // ── D32 · the ink pair (every pair its two halves draw, proved in BOTH themes) ─────────────────
  ["PAIR_INK", "PAIR_SURFACE", "normal"], ["PAIR_INK", "PAIR_RAISED", "normal"],
  ["PAIR_INK_MUTED", "PAIR_SURFACE", "normal"], ["PAIR_INK_MUTED", "PAIR_RAISED", "normal"],
  ["PAIR_INK_FAINT", "PAIR_SURFACE", "normal"], ["PAIR_INK_FAINT", "PAIR_RAISED", "normal"],
  ["PAIR_HI", "PAIR_SURFACE", "normal"],                                                // the title, the band's heading
  ["PAIR_KICKER", "PAIR_SURFACE", "normal"],
  ["PAIR_ACCENT", "PAIR_SURFACE", "large"],                                             // the score, the drop cap
  ["PAIR_ACCENT", "PAIR_SURFACE", "ui"],                                                // a bullet's marker
  ["PAIR_MATCHED", "PAIR_SURFACE", "normal"], ["PAIR_MATCHED", "PAIR_MET_QUIET", "normal"],
  ["PAIR_INK", "PAIR_MET_QUIET", "normal"], ["PAIR_INK_MUTED", "PAIR_MET_QUIET", "normal"],
  ["PAIR_INK_FAINT", "PAIR_MET_QUIET", "normal"],   // the met Experience cell's name
  ["PAIR_MISSING", "PAIR_SURFACE", "normal"], ["PAIR_MISSING", "PAIR_RAISED", "normal"],    // a claim box's term
  ["PAIR_MISSING", "PAIR_MISSING_QUIET", "normal"],                                     // Experience short
  ["PAIR_GENERIC", "PAIR_SURFACE", "normal"], ["PAIR_GENERIC", "PAIR_GENERIC_QUIET", "normal"],
  // the three bar segments are UI indicators on the pair's ground
  ["PAIR_MATCHED", "PAIR_SURFACE", "ui"], ["PAIR_MISSING", "PAIR_SURFACE", "ui"], ["PAIR_GENERIC", "PAIR_SURFACE", "ui"],
  // ⭐ A86: a claim box is identified by its FILLED + square, not its (decorative) edge — the square is
  // the indicator, on the box; its glyph is the card's surface colour on the fill. Claimed: the green.
  ["PAIR_MISSING", "PAIR_RAISED", "ui"], ["PAIR_SURFACE", "PAIR_MISSING", "normal"],
  ["PAIR_MATCHED", "PAIR_MET_QUIET", "ui"], ["PAIR_SURFACE", "PAIR_MATCHED", "normal"],
  ["PAIR_KICKER", "PAIR_RAISED", "ui"],                                                 // a focus ring on a box
  ["PAIR_INK", "PAIR_LIT", "normal"],
  // "Not enough signal" has no fill, so it sits on the pair's ground directly
  ["BAND_UNKNOWN", "PAIR_SURFACE", "normal"], ["BAND_UNKNOWN_EDGE", "PAIR_SURFACE", "ui"],
  // ── D35 · the Full House header (every pair it draws, proved in BOTH themes) ─────────────────
  // the sentence's prose sits on the paper; a token at rest is INK on FH_SURFACE
  ["INK_MUTED", "CANVAS_SHADE", "large"], ["INK_MUTED", "CANVAS_SHADE", "normal"],
  ["INK", "FH_SURFACE", "normal"], ["INK", "FH_WELL", "normal"],
  ["INK_MUTED", "FH_SURFACE", "normal"], ["INK_MUTED", "FH_WELL", "normal"],
  ["INK_FAINT", "FH_SURFACE", "normal"], ["INK_FAINT", "FH_WELL", "normal"],   // + add, a panel's key, the coverage line
  ["PP_ATS_NUMBER", "FH_WELL", "large"],                                         // D48: the header box's 26px number
  ["ACCENT_INK", "FH_SURFACE", "normal"], ["ACCENT_INK", "FH_WELL", "normal"], // hover text, Close ×
  ["ACCENT_INK", "CANVAS_SHADE", "ui"], ["ACCENT_INK", "FH_SURFACE", "ui"],    // the OPEN outline, a hover edge
  ["FH_ON_ACCENT", "ACCENT", "normal"], ["FH_ON_ACCENT", "ACCENT_HOVER", "normal"],
  // ── D91 · the document surface (the cover letter as shown) — the same black on white in every theme ──
  ["DOC_INK", "DOC_PAPER", "normal"],
];

// Pairs that are FORBIDDEN, asserted to fail so nobody "fixes" the test by adding them above.
export const FORBIDDEN_PAIRS = [
  ["ACCENT", "CANVAS",       "normal", "the logo orange as text on paper"],
  ["ACCENT", "CANVAS",       "ui",     "the logo orange as a focus ring or input edge on paper"],
  ["#FFFFFF", "ACCENT",      "normal", "white text on the orange fill"],
  ["#FFFFFF", "#4285F4",     "normal", "white text on Google's primary blue"],
];
