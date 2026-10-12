// ── The deck's geometry as a user control (queue 38) ─────────────────────────────────────────
//
// The fan's look was FOUND with three sliders — zoom, spread, reach — not specified, so the same
// three are offered to the user. ⭐ It is an accessibility control as much as an engagement one: a
// flatter arc and a smaller sweep is LESS MOTION — every rotation moves each card less.
//
// ⚠ Presets first — tight / standard / wide — with the three sliders behind "Customise"; most
// people do not want to tune a radius.
//
// Shared by the client (which applies it) and the server (which stores it), so the preset names,
// the ranges and the stored shape are stated once. The ranges below are each slider's OWN limits;
// ⛔ they are not enough on their own, because the three are COUPLED — whether a reach breaks the
// layout depends on the zoom and the spread. client/src/lib/fanGeometry.js · clampGeometry fits the
// combination against the layout's constraints, and nothing reaches the fan except through it.
//
// `standard` is FAN in fanGeometry.js — the look queue 27 settled — restated nowhere.

export const DECK_PRESET_NAMES = Object.freeze(["tight", "standard", "wide"]);
// Each preset's [label, description] — the deck's own control and the Customise page (D93) say the same thing.
export const DECK_PRESET_COPY = Object.freeze({
  tight:    Object.freeze(["Tight",    "The calmest: cards close together on a flat arc. A step moves every card least."]),
  standard: Object.freeze(["Standard", "The deck as designed."]),
  wide:     Object.freeze(["Wide",     "The most sweep: the cards fan out further, on a tighter curve."]),
});

// The presets that are not the default, per orientation. Each is inside its limits AND fits the
// layout (pinned by test/deckGeometryControl.test.js against the same constraints the clamp uses).
//   tight — the calm one: the smallest sweep (4°) on the flattest arc, the backs held larger so the
//           next card still shows past the front one. A rotation moves every card least.
//   wide  — the most sweep and the tightest curve the layout keeps in frame.
export const DECK_PRESETS = Object.freeze({
  horizontal: Object.freeze({
    tight: Object.freeze({ zoom: 0.8,  spread: 4,  reach: 1100 }),
    wide:  Object.freeze({ zoom: 0.68, spread: 9,  reach: 700 }),
  }),
  vertical: Object.freeze({
    tight: Object.freeze({ zoom: 0.92, spread: 4,  reach: 1600 }),
    wide:  Object.freeze({ zoom: 0.82, spread: 10, reach: 900 }),
  }),
});

// Each slider's own range and step, per orientation: [min, max, step].
export const DECK_LIMITS = Object.freeze({
  horizontal: Object.freeze({ zoom: Object.freeze([0.64, 0.8, 0.02]), spread: Object.freeze([3, 10, 0.5]), reach: Object.freeze([600, 1400, 50]) }),
  vertical:   Object.freeze({ zoom: Object.freeze([0.8, 0.92, 0.02]), spread: Object.freeze([3, 10, 0.5]), reach: Object.freeze([800, 1800, 50]) }),
});

const AXES = ["zoom", "spread", "reach"];
const ORIENTATIONS = ["horizontal", "vertical"];

/** One value into its slider's range, snapped to its step. A non-number is null, never a default. */
export function clampAxis(orientation, axis, value) {
  const [min, max, step] = DECK_LIMITS[orientation][axis];
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return null;
  const snapped = Math.round((Math.min(max, Math.max(min, n)) - min) / step) * step + min;
  return Math.round(snapped * 1000) / 1000;
}

/**
 * The stored preference, or null when there is nothing usable. Shape:
 *   { preset: "tight" | "standard" | "wide" | "custom", custom: { horizontal?: {zoom,spread,reach}, vertical?: {…} } }
 * Custom values are per orientation, because a desktop and a phone fan are different shapes; each
 * axis is clamped to its range here, and the coupled fit happens where the fan is drawn.
 */
export function normaliseDeckPreference(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const preset = raw.preset === "custom" || DECK_PRESET_NAMES.includes(raw.preset) ? raw.preset : null;
  if (!preset) return null;
  const custom = {};
  for (const o of ORIENTATIONS) {
    const g = raw.custom?.[o];
    if (!g || typeof g !== "object") continue;
    const vals = Object.fromEntries(AXES.map(a => [a, clampAxis(o, a, g[a])]));
    if (AXES.every(a => vals[a] != null)) custom[o] = vals;
  }
  return { preset, custom };
}
