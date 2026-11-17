// ── CHARCOAL DARK — warm charcoal leather, the same keys re-pointed ──────────────────────────────
//
// D91 (10-11): the values that were C_DARK in styles/colorTokens.js, MOVED here in P1 with their notes
// (pinned by hash in test/d91ThemeModule.test.js). The original header follows.
//
// ── DARK (UI step 6, 09-30) — the same keys, re-pointed ────────────────────────────────────────
//
// docs/UI_REDESIGN.md §Step 6. Not black: warm charcoal leather, with the same pebble generator. ⛔
// The floor INVERTS: text here is light, so the worst case is the LIGHTEST substrate pixel — the
// sheen — and CANVAS_SHADE names that tone in this theme. Every CONTRAST_PAIRS entry is proved
// against both themes (test/colorTokens.test.js). The orange is ~5:1 on charcoal, so here ACCENT_INK
// is a LIGHTER orange for text; ON_ACCENT stays ink on the fill. Provider colours are their owners'.
const tokens = Object.freeze({
  CANVAS:              "#1C1815",
  CANVAS_SHADE:        "#2C2621",
  GRAIN:               "#050403",
  SHEEN_TINT:          "#8C7A66",
  SURFACE_TINT:        "#2A2420",
  SURFACE:             "rgba(46,39,34,0.62)",
  SURFACE_2:           "rgba(52,44,38,0.78)",
  SURFACE_MENU:        "rgba(34,29,25,0.97)",
  SURFACE_MODAL:       "rgba(34,29,25,0.98)",
  SURFACE_INPUT:       "rgba(255,240,225,0.06)",
  SURFACE_SOLID:       "#26201C",
  HOVER:               "rgba(255,240,225,0.07)",
  SCRIM:               "rgba(0,0,0,0.55)",
  GLASS_EDGE:          "rgba(255,240,225,0.12)",
  GLASS_HIGHLIGHT:     "rgba(255,240,225,0.10)",
  GLASS_SPECULAR:      "rgba(255,240,225,0.22)",
  GLASS_SHEEN:         "rgba(255,240,225,0.07)",
  GLASS_BODY_TOP:      "rgba(58,49,42,0.74)",
  GLASS_BODY:          "rgba(38,32,28,0.50)",
  GLASS_RIM:           "rgba(255,240,225,0.11)",
  GLASS_UNDERSIDE:     "rgba(0,0,0,0.40)",
  INK:                 "#F2EADF",
  INK_MUTED:           "#CFC2B3",
  INK_FAINT:           "#ADA090",
  BORDER:              "#3B332C",
  BORDER_STRONG:       "#53483F",
  BORDER_CONTROL:      "#8E8072",
  ACCENT:              "#FD4600",
  ACCENT_HOVER:        "#FF6424",
  ON_ACCENT:           "#1E1915",
  ACCENT_INK:          "#FF7D4A",
  ACCENT_QUIET:        "#3D2519",
  LOGO_SLASH:          "#FD4600",   // D19: dark mode unchanged — the whole mark stays the orange
  LOGO_WORD:           "#FD4600",
  SUCCESS:             "#5FCB8C",
  SUCCESS_QUIET:       "#163120",
  WARNING:             "#E6AA4E",
  WARNING_QUIET:       "#35280F",
  DANGER:              "#F27F72",
  DANGER_QUIET:        "#3B1C18",
  INFO:                "#7BB4EA",
  INFO_QUIET:          "#15263A",
  CHART_NEUTRAL:       "#6B7280",   // A228: a chart's "not yet" bars beside the accent — dataviz validator: normal-vision ΔE ≥ 15 and ≥ 3:1 on the surface in every theme
  VIOLET:              "#BCA2F0",
  VIOLET_QUIET:        "#2B2142",
  TEAL:                "#62C5D1",
  BAND_STRONG:         "#72D59D",
  BAND_STRONG_QUIET:   "#173423",
  BAND_MODERATE:       "#EAB95E",
  BAND_MODERATE_QUIET: "#362913",
  BAND_WEAK:           "#F48F83",
  BAND_WEAK_QUIET:     "#3D1D19",
  BAND_UNKNOWN:        "#CFC2B3",
  BAND_UNKNOWN_EDGE:   "#8E8072",
  PROVIDER_LINKEDIN:   "#0A66C2",
  PROVIDER_GITHUB:     "#24292E",
  PROVIDER_GOOGLE:     "#1A73E8",
  PROVIDER_INDEED:     "#003A9B",
  ON_PROVIDER:         "#FFFFFF",
  // D32 · the ink pair — the product's only dark surface. RE-DERIVED against the ink, never converted.
  // A86: the sketch's DARK values (pair2.html). Its translucent tints (--okbg, --nobd …) are composited
  // ONCE, over --surf (#191511; a claim box's edge over --surf2, the box it outlines), into the opaque
  // hex the contrast test can measure.
  PAIR_SURFACE:        "#191511",   // --surf: darker than the leather, so the pair reads as one object
  PAIR_RAISED:         "#221D18",   // --surf2
  PAIR_INK:            "#E8E0D2",   // --tx
  PAIR_INK_MUTED:      "#CDC4B6",   // --tx2
  PAIR_INK_FAINT:      "#A39A8C",   // --dim
  PAIR_RULE:           "#342C25",   // --line
  PAIR_KICKER:         "#FD4600",   // --atx (in dark the logo orange passes as text: 5.2:1)
  PAIR_ACCENT:         "#FD4600",   // --accent
  PAIR_MATCHED:        "#7FC79A",   // --ok
  PAIR_MISSING:        "#E8937C",   // --no
  PAIR_GENERIC:        "#91887D",   // --gen #8A8075 → #91887D: 4.07:1 on its own --genbg
  PAIR_MET_QUIET:      "#262C23",   // --okbg rgba(127,199,154,.13) over --surf
  PAIR_LIT:            "#4B2C1A",
  PAIR_HI:             "#FBF7F0",   // --hi
  PAIR_MATCHED_EDGE:   "#384A3A",   // --okbd rgba(127,199,154,.3)
  PAIR_MISSING_QUIET:  "#32241E",   // --nobg rgba(232,147,124,.12)
  PAIR_MISSING_EDGE:   "#5D4036",   // --nobd rgba(232,147,124,.3), over --surf2
  PAIR_GENERIC_QUIET:  "#27221D",   // --genbg rgba(138,128,117,.12)
  PAIR_GENERIC_EDGE:   "#36312B",   // --genbd rgba(138,128,117,.26)
  PAIR_MAST_TINT:      "rgba(253,70,0,0.07)",
  PAIR_CARD_SHADOW:    "0 12px 34px rgba(0,0,0,0.18)",
  PAIR_KIND_ALPHA:     "0.75",      // sketch .62 → .75, the least that keeps the label ≥ 4.5 on every box
  // The sketch's dark --lift / --lift2.
  PAIR_LIFT:           "0 3px 9px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.07)",
  PAIR_LIFT2:          "0 8px 20px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.11)",
  PAIR_PRESS:          "0 2px 5px rgba(0,0,0,0.60), inset 0 1px 0 rgba(255,240,225,0.06)",
  // D35 · the Full House header — RE-DERIVED for the charcoal canvas (#1C1815). The sketch's dark
  // ground (#141110) is darker than the app's, so its --surf #191511 would sit BELOW the canvas and
  // read as a hole; each value keeps the sketch's STEP above the ground instead.
  FH_SURFACE:          "#241F1B",
  FH_WELL:             "#2D2722",
  FH_LINE:             "#40372F",
  FH_ACCENT_EDGE:      "#E03D00",
  FH_ON_ACCENT:        "#2A0D00",
  FH_SEG_LIFT:         "0 2px 6px rgba(253,70,0,0.36)",
  FH_INSET:            "inset 0 1px 3px rgba(0,0,0,0.38)",
  FH_ADD_HOVER:        "0 8px 20px rgba(253,70,0,0.46)",
  PP_ATS_NUMBER:       "#FD4600",   // = PAIR_KICKER dark; 4.3:1 on FH_WELL — the number is 26px, large text
  SHADOW_SM:           "0 1px 2px rgba(0,0,0,0.35), 0 1px 1px rgba(0,0,0,0.25)",
  SHADOW_MD:           "0 4px 12px rgba(0,0,0,0.40), 0 2px 4px rgba(0,0,0,0.30)",
  SHADOW_LG:           "0 18px 40px rgba(0,0,0,0.50), 0 6px 14px rgba(0,0,0,0.35)",
  SHADOW_XL:           "0 36px 80px rgba(0,0,0,0.60), 0 14px 30px rgba(0,0,0,0.40)",
  SHADOW_GLASS:        "0 1px 1px rgba(0,0,0,0.30), 0 14px 30px -10px rgba(0,0,0,0.65)",
  SHADOW_GLASS_HOVER:  "0 2px 2px rgba(0,0,0,0.35), 0 24px 44px -14px rgba(0,0,0,0.75)",
  DEPTH_REST:          "0 3px 8px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.08)",
  DEPTH_HOVER:         "0 7px 17px rgba(0,0,0,0.50), inset 0 1px 0 rgba(255,255,255,0.10)",
  DEPTH_PRESS:         "0 2px 5px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)",
  DEPTH_ACCENT:        "0 3px 9px rgba(253,70,0,0.40), inset 0 1px 0 rgba(255,255,255,0.20)",
  LOGO_SHADOW:         "0 2px 6px rgba(0,0,0,0.45)",
  LOGO_TILE:           "#FBF7F0",   // D61: the SAME paper as light — a logo's tile never follows the theme
  TILE_BLUE:           "#2B59C3",   // D149: the letter tile — the same as light (Paper Light says why)
  TILE_GREEN:          "#1F7A4D",   // D149: the letter tile — the same as light (Paper Light says why)
  TILE_PURPLE:         "#7A2E8E",   // D149: the letter tile — the same as light (Paper Light says why)
  TILE_ORANGE:         "#C2410C",   // D149: the letter tile — the same as light (Paper Light says why)
  TILE_TEAL:           "#0E7490",   // D149: the letter tile — the same as light (Paper Light says why)
  TILE_SLATE:          "#374151",   // D149: the letter tile — the same as light (Paper Light says why)
  TILE_ROSE:           "#9D174D",   // D149: the letter tile — the same as light (Paper Light says why)
  ON_TILE:             "#FFFFFF",   // D149: the letter tile — the same as light (Paper Light says why)
  DOC_PAPER:           "#FFFFFF",   // D91: a document is black on white in every theme
  DOC_INK:             "#1A1A1A",
});

export default Object.freeze({
  id: "charcoal-dark",
  label: "Charcoal Dark",
  scheme: "dark",
  contrast: "aa",
  tokens,
  // The same pebble generator as Paper Light; the floor inverts (was styles/paper.js PAPER.dark).
  substrate: Object.freeze({ freq: 0.34, octaves: 2, gain: 2.2, bias: 0.85, grain: 0.40, fibre: 0, sheen: 0.12 }),
});
