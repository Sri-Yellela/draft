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

export const C = {
  // ── CANVAS — the paper. The substrate everything sits on. ─────────────────────────────────
  CANVAS:        "#F3ECE0",   // cream paper, the logo's ground
  // The DARKEST tone the grain can produce. Not painted anywhere: it is the worst case that every
  // contrast check below is computed against, so a pair that passes here passes over any grain
  // pixel. PaperBackground's grain is tuned to stay lighter than this.
  CANVAS_SHADE:  "#E6DDCF",
  GRAIN:         "#5A4632",   // the fibre tone the noise is tinted with (drawn at low alpha)

  // ── SURFACE — glass over the paper. Cards, panels, the dock. ──────────────────────────────
  SURFACE_TINT:  "#FFFBF5",   // the glass's colour; drawn at the alphas below
  SURFACE:       "rgba(255,251,245,0.58)",   // cards, the resting glass
  SURFACE_2:     "rgba(255,251,245,0.72)",   // raised panels, panel headers
  SURFACE_MENU:  "rgba(255,251,245,0.96)",   // menus and dropdowns: must read over anything
  SURFACE_MODAL: "rgba(255,251,245,0.97)",
  SURFACE_INPUT: "rgba(255,255,255,0.55)",
  SURFACE_SOLID: "#FBF7F0",   // an opaque stand-in for the glass, where a hex is required
  HOVER:         "rgba(30,25,21,0.05)",      // ink wash for hover rows and ghost buttons
  SCRIM:         "rgba(30,25,21,0.28)",      // dims the page under a modal
  GLASS_EDGE:    "rgba(30,25,21,0.10)",      // the glass hairline
  GLASS_HIGHLIGHT: "rgba(255,255,255,0.70)", // the inset top highlight on glass

  // ── INK — text. ⛔ NOT pure black on cream; it vibrates. ─────────────────────────────────
  INK:           "#1E1915",
  INK_MUTED:     "#4A423B",
  INK_FAINT:     "#62574D",   // the faintest TEXT allowed; still AA on CANVAS_SHADE
  BORDER:        "#DDD2C3",   // decorative hairlines (cards, dividers) — not a control edge
  BORDER_STRONG: "#C7B9A7",
  BORDER_CONTROL: "#7F7263",  // an input's edge: a UI component boundary, so it must reach 3:1

  // ── ACCENT — the logo orange, #FD4600, keyed from the source. A FILL. ──────────────────────
  ACCENT:        "#FD4600",
  ACCENT_HOVER:  "#FF6424",   // LIGHTER on hover: a darker orange drops ink-on-fill below 4.5:1
  ON_ACCENT:     "#1E1915",   // text/icons on an ACCENT fill (= INK; named so the pairing is explicit)
  ACCENT_INK:    "#A33200",   // orange as TEXT, icons, focus rings, active edges
  // ACCENT-QUIET: a desaturated orange for states that are not calls to action — the selected
  // tab, a tag, an active filter. A fill; its text is ACCENT_INK.
  ACCENT_QUIET:  "#EBD5C6",

  // ── State. Each has a text tone that passes on paper and a quiet fill it also passes on. ──────
  SUCCESS:       "#1A6B33",
  SUCCESS_QUIET: "#D5E8D8",
  WARNING:       "#8F5200",
  WARNING_QUIET: "#F2E2C4",
  DANGER:        "#B3261E",
  DANGER_QUIET:  "#F5D9D3",
  INFO:          "#1E5E94",
  INFO_QUIET:    "#D7E4F0",

  // ── Two categorical tones for things that are neither a state nor the brand: competencies in
  //    the ATS report, the cover-letter action, a foreign-key column, a company avatar. Same rule
  //    as the states: a text tone that passes on paper, and a quiet fill it also passes on.
  VIOLET:        "#6A3DB0",
  VIOLET_QUIET:  "#E6DCF2",
  TEAL:          "#0E6470",

  // ── FIT BANDS — Strong / Moderate / Weak / Not enough signal (shared/atsBands.js). ───────────
  //
  // Their own names rather than SUCCESS / WARNING / DANGER, although Strong and Weak sit near
  // those hues: a band is a statement about fit, a state is a statement about an operation, and a
  // later palette change to one must not silently move the other. The dark-era values these
  // replace failed on the cream as text (#16a34a 2.81:1, #d97706 2.71:1, measured at step 2).
  //
  // Each fit band has a TEXT tone (≥ 4.5:1 on paper and on glass) and a QUIET fill it passes on,
  // which also carries INK at ≥ 4.5:1 — so a chip reads with either text colour.
  BAND_STRONG:         "#17663A",
  BAND_STRONG_QUIET:   "#D3E8D9",
  BAND_MODERATE:       "#7A5300",
  BAND_MODERATE_QUIET: "#F2E3C0",
  BAND_WEAK:           "#A3281E",
  BAND_WEAK_QUIET:     "#F6D9D2",
  // ⛔ NOT ENOUGH SIGNAL IS NOT A FOURTH, WORSE GRADE. It is the scorer declining for want of
  // evidence — a correctness state — so it deliberately has NO FILL and NO HUE: muted ink inside a
  // DASHED outline, on whatever surface it sits on. A paler red (or any tint on the green-amber-red
  // axis) would read as "below Weak", which is the one thing it must never say. The edge is a UI
  // boundary and reaches 3:1; the text reaches 4.5:1. See client/src/styles/bandStyle.js.
  BAND_UNKNOWN:        "#4A423B",
  BAND_UNKNOWN_EDGE:   "#7F7263",

  // ── Third-party sign-in buttons. Their owners' brand colours, so they are tokens too — and
  //    checked like every other pair. ⛔ Google's #4285F4 carries white text at 3.56:1, which FAILS
  //    AA; the button uses Google's darker #1A73E8 (4.51:1) instead.
  PROVIDER_LINKEDIN: "#0A66C2",
  PROVIDER_GITHUB:   "#24292E",
  PROVIDER_GOOGLE:   "#1A73E8",
  // Not a sign-in button: the two source marks the board draws beside a posting (LinkedIn's "in"
  // square reuses PROVIDER_LINKEDIN). Same pairing rule — ON_PROVIDER on the fill.
  PROVIDER_INDEED:   "#003A9B",
  ON_PROVIDER:       "#FFFFFF",

  // Shadows are ink at low alpha — a warm shadow on paper, not a grey one.
  SHADOW_SM: "0 1px 2px rgba(30,25,21,0.08), 0 1px 1px rgba(30,25,21,0.05)",
  SHADOW_MD: "0 4px 12px rgba(30,25,21,0.10), 0 2px 4px rgba(30,25,21,0.06)",
  SHADOW_LG: "0 18px 40px rgba(30,25,21,0.14), 0 6px 14px rgba(30,25,21,0.08)",
  SHADOW_XL: "0 36px 80px rgba(30,25,21,0.18), 0 14px 30px rgba(30,25,21,0.10)",
};

// The custom-property name for a token: ACCENT_QUIET -> --c-accent-quiet. The same rule zLayers.js
// uses for --z-*, so the two scales read alike in a stylesheet.
export const cssVarName = (name) => `--c-${name.toLowerCase().replace(/_/g, "-")}`;

// Stylesheets need the same values, and two copies of a palette is how a palette rots. Publish
// them from this one definition so CSS says `var(--c-ink)` and never holds a literal.
export function installColorVars(doc = typeof document !== "undefined" ? document : null) {
  if (!doc?.documentElement) return;
  for (const [name, value] of Object.entries(C)) {
    doc.documentElement.style.setProperty(cssVarName(name), value);
  }
}

installColorVars();

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
  ["ON_PROVIDER", "INFO", "normal"],   // a company avatar's initial on the blue
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
];

// Pairs that are FORBIDDEN, asserted to fail so nobody "fixes" the test by adding them above.
export const FORBIDDEN_PAIRS = [
  ["ACCENT", "CANVAS",       "normal", "the logo orange as text on paper"],
  ["ACCENT", "CANVAS",       "ui",     "the logo orange as a focus ring or input edge on paper"],
  ["#FFFFFF", "ACCENT",      "normal", "white text on the orange fill"],
  ["#FFFFFF", "#4285F4",     "normal", "white text on Google's primary blue"],
];
