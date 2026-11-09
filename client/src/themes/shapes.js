// ── THE SECOND TOKEN SET — corners and type (D144, owner 11-02 answer 1) ─────────────────────────────────
//
// D91 kept radii and type OUT of themes ("effects stay put", THEME_MODULE.md §5). The owner's answer to D144's main
// question was "colours + corners + fonts": a second, small set of tokens, OFF for every existing theme so none of them
// changes. It lives here, keyed by theme id, rather than as a field on the theme objects — a theme file stays one file of
// colour data (test/d91ThemeModule.test.js pins its fields) and an absent entry IS "off".
//
// Published as custom properties on <html> (installShapeVars, called by installColorVars) with `data-shape="on"` when
// the live theme has a set. Components read them with a fallback that is today's value — `var(--shape-radius-card, 22px)`
// — so with the set off nothing moves.
//
// ⭐ D145 · TEXT SIZE (owner 11-03: "should be able to adjust font size"): the user's choice is a layout option
// (shared/appearance.js `text`), published as `--type-scale` on the element carrying data-text-size; `ts(px)` below is
// how a size is written so it scales. Independent of the theme — it works in every theme.
export const SHAPE_SETS = Object.freeze({
  "dusk-dark": Object.freeze({
    RADIUS_CARD: "28px", RADIUS_CONTROL: "16px", RADIUS_SMALL: "10px",
    FONT_UI: "'Inter Tight', 'DM Sans', system-ui, sans-serif",
    HEADLINE_WEIGHT: "500", HEADLINE_TRACKING: "-0.035em",
  }),
  "dusk-light": Object.freeze({
    RADIUS_CARD: "28px", RADIUS_CONTROL: "16px", RADIUS_SMALL: "10px",
    FONT_UI: "'Inter Tight', 'DM Sans', system-ui, sans-serif",
    HEADLINE_WEIGHT: "500", HEADLINE_TRACKING: "-0.035em",
  }),
});
// ⭐ D181 · PLAIN: no serif display — Inter Tight only (the face Dusk already loads), as the body and the headlines.
// ⛔ 45r: this was a [data-theme="plain-*"] rule in index.css — a second file deciding by theme, which
// test/inkPairD32's one-decider rule forbids. The faces live here as data; themes/index.js (the decider) publishes them
// on <html>, in its pre-paint script and at load. Not a SHAPE_SET: Plain keeps today's corners and weights.
export const FACE_SETS = Object.freeze({
  "plain-light": Object.freeze({ FONT_DISPLAY: "'Inter Tight', 'DM Sans', system-ui, sans-serif", FONT_UI: "'Inter Tight', 'DM Sans', system-ui, sans-serif" }),
  "plain-dark":  Object.freeze({ FONT_DISPLAY: "'Inter Tight', 'DM Sans', system-ui, sans-serif", FONT_UI: "'Inter Tight', 'DM Sans', system-ui, sans-serif" }),
});
/** The custom properties a face set publishes (--font-display is index.css's own default face). */
export const FACE_VARS = Object.freeze({ FONT_DISPLAY: "--font-display", FONT_UI: "--shape-font-ui" });
export function installFaceVars(themeId, el) {
  if (!el?.style) return;
  const set = FACE_SETS[themeId];
  for (const [k, v] of Object.entries(FACE_VARS)) {
    if (set) el.style.setProperty(v, set[k]);
    // FONT_UI is also a shape key: leave it to installShapeVars when this theme has no face set.
    else if (k !== "FONT_UI") el.style.removeProperty?.(v);
  }
}
export const SHAPE_KEYS = Object.freeze(["RADIUS_CARD", "RADIUS_CONTROL", "RADIUS_SMALL", "FONT_UI", "HEADLINE_WEIGHT", "HEADLINE_TRACKING"]);
/** Today's values — what every theme without a set draws (the fallbacks in var()). */
export const SHAPE_DEFAULTS = Object.freeze({
  RADIUS_CARD: "22px", RADIUS_CONTROL: "16px", RADIUS_SMALL: "10px",
  FONT_UI: "'DM Sans', system-ui, sans-serif", HEADLINE_WEIGHT: "400", HEADLINE_TRACKING: "-0.01em",
});
export const shapeVarName = (k) => `--shape-${k.toLowerCase().replace(/_/g, "-")}`;
/** A shape token as CSS: the live set's value when the theme has one, else today's value. */
export const shape = (k) => `var(${shapeVarName(k)}, ${SHAPE_DEFAULTS[k]})`;

// ── Text size ─────────────────────────────────────────────────────────────────────────────────────────
// The four steps (D145 row: ≈ 0.9 · 1 · 1.12 · 1.25), by the layout option's value.
export const TEXT_SCALE = Object.freeze({ smaller: 0.9, default: 1, larger: 1.12, largest: 1.25 });
export const TYPE_SCALE_VAR = "--type-scale";
/** A font size that follows the user's text size: ts(46) → "calc(46px * var(--type-scale, 1))". */
export const ts = (px) => `calc(${px}px * var(${TYPE_SCALE_VAR}, 1))`;

export function installShapeVars(themeId, el) {
  if (!el?.style) return;
  const set = SHAPE_SETS[themeId];
  for (const k of SHAPE_KEYS) {
    if (set) el.style.setProperty(shapeVarName(k), set[k]); else el.style.removeProperty?.(shapeVarName(k));
  }
  if (el.dataset) { if (set) el.dataset.shape = "on"; else delete el.dataset.shape; }
}
