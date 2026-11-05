// ── The deck's fan, as numbers ───────────────────────────────────────────────────────────────
//
// docs/BRAND_OUTLAY_AND_MOTION.md §"THE DECK — DECIDED 2026-09-30". Pure, so the geometry can be
// tested without a browser and a screenshot is never the only thing that knows what the arc is.
//
//   A fan of full-size cards on a shallow arc, pulled back so the dealt stack is in frame. The FRONT
//   card is face-up, square-on, at full size; the rest are face-down, falling away along the arc.
//
// ⭐ TWO ORIENTATIONS, ONE MODEL, AND THEY MOVE TOGETHER. A right pivot gets HORIZONTAL cards (the
// fan opens up and down); a bottom pivot gets VERTICAL cards (it opens left and right, like a hand).
// A narrow card tilted 10° is unreadable and a 700px one is fine — that is the whole reason, so the
// switch is a WIDTH, never a device class: a 700px card on an arc wants ~1100px of viewport.
//
// "Pulled back" applies to the cards BEHIND. The front card is never scaled: it is exactly the card
// that shipped, risen out of the fan into the content layer (zLayers.js: --z-fan < --z-content).

import { DECK_LIMITS, DECK_PRESETS, clampAxis } from "../../../shared/deckGeometry.js";

export const FAN_SWITCH_PX = 1100;

// The four parameters, found by looking — the reach sweep (550/700/900/1100/1400, both orientations,
// screenshotted mid-stack) is in the queue 27 SESSION LOG. spread 7° held as briefed in both; zoom
// 0.72 held for horizontal and MOVED for vertical (below).
// ⛔ `reach` decides whether the arc reads as a circle. At ~550 it is a pronounced curve, at ~1400 an
// almost straight overlap, and a value between two that each look right is a value that looks like
// neither. Each number below is the edge of a CONSTRAINT, not a midpoint:
//
//   horizontal 800   the LARGEST reach that keeps the opening stack in a 1440×900 frame. The 4th
//                    card's bottom edge sits at zoom·reach·sin 28° + its rotated half-height (~239)
//                    below the front card's centre (~390 down): 800 puts it at ~899px. At 900 it
//                    clips; at 550–700 each card steps < 70px and the backs bunch behind the front.
//   vertical  1100   the SMALLEST reach at which the first back clears a 318px card by enough to
//                    show its logo; at 900 only an edge shows. The second sits at the screen edge,
//                    fading — clipping that reads as deliberate, with the counter saying the rest.
//   vertical zoom .86 — at 0.72 a narrow back is so small that its logo, centred, sits entirely
//                    BEHIND the front card: a phone would rotate blind, the exact failure the logo
//                    back exists to fix. At 0.86 the first back peeks ~90px and its logo shows.
//
// Nothing else may restate these.
export const FAN = Object.freeze({
  horizontal: Object.freeze({ zoom: 0.72, spread: 7, reach: 800, visible: 4 }),
  vertical:   Object.freeze({ zoom: 0.86, spread: 7, reach: 1100, visible: 4 }),
});

// The card that ships, per orientation. The vertical card is narrower than its viewport so the fan
// behind it has somewhere to show — the gutter is where the stack reads as a stack.
// ⭐ D149 (owner 11-03): the card's box is declutter-v7.html's, measured in a real Chrome — 640 × 232 at 1280 × 800 and
// 366 × 232 at 390 × 844 (the collapsed card is as tall as its content; the front card still grows with it). Was
// 700 × 380 and 360 × 500, a frame with empty space under the info row.
export const CARD = Object.freeze({
  horizontal: Object.freeze({ width: 640, height: 232 }),
  vertical:   Object.freeze({ maxWidth: 366, gutter: 12, height: 232 }),
});

export const orientationFor = (viewportWidth) => (viewportWidth >= FAN_SWITCH_PX ? "horizontal" : "vertical");

/** The card's size for a viewport. Horizontal never shrinks below its design width unless it must. */
export function cardSize(orientation, viewportWidth) {
  if (orientation === "horizontal") return { width: Math.min(CARD.horizontal.width, viewportWidth - 32), height: CARD.horizontal.height };
  const width = Math.max(240, Math.min(CARD.vertical.maxWidth, viewportWidth - 2 * CARD.vertical.gutter));
  return { width, height: CARD.vertical.height };
}

const rad = (deg) => (deg * Math.PI) / 180;

// ── ⭐ D152 (2) · HOME'S CARD AND ITS FAN (home-sketch.html .stack / .ghost) ─────────────────────────────────────────
//
// On Home the card is CARD-SHAPED — playing-card proportions, 5 : 7 — and the deck takes only the column it needs (390).
// The fan is the sketch's: the backs turn about the card's LOWER-LEFT corner (transform-origin 0% 100%), 5° a step, so
// the stack sweeps through the lower-right quadrant of its circle and stays inside the column's 90 px to the right of
// the card (a 10° back's top-right corner moves 420·sin 10° ≈ 73 px). Its bottom-right corner drops 300·sin 10° ≈ 52 px,
// which is why the buttons sit 84 px under the card (the sketch's margin) — the sweep never covers Pass · Save · Draft
// (D153 (1)). Two backs show; a passed card is gone, not fanned behind. Not the Customise sliders' fan (those tune the
// other two orientations); reduced motion only drops the movement, the shape is the same.
// ⭐ D156 (3): a phone keeps the dock's 52 px rail beside the page, so the column is the screen less 80 (the rail + Home's
// 14 px gutters) and the fan's room 60 (a 250 px card's 10° back reaches 350·sin 10° − 250·(1 − cos 10°) ≈ 57 px right).
export const HOME_CARD = Object.freeze({ width: 300, height: 420, phoneMax: 330, phoneGutter: 60, phoneChrome: 80, below: 84, stackPx: 980 });
export const HOME_FAN = Object.freeze({ zoom: 1, spread: 5, reach: 0, visible: 2 });
// ⭐ D156 (2) (owner 11-05: "use the horizontal cards for a wider screen and use less margins to make space for a bigger
// card, so that the stats from the expanded card can come on to the card itself"): at 1440 px and wider the card is
// LANDSCAPE, 600 × 372, its stats on it. Its backs turn 3° a step (6° for the second): the second's top-right corner moves
// 600·cos 6° + 372·sin 6° − 600 ≈ 36 px right (the column keeps 40 for it) and its bottom-right corner drops
// 600·sin 6° ≈ 63 px, under the 72 px gap above Pass · Save · Draft.
export const HOME_WIDE = Object.freeze({ minViewport: 1440, width: 600, height: 372, column: 640, below: 72 });
export const HOME_FAN_WIDE = Object.freeze({ ...HOME_FAN, spread: 3 });
/** Is Home's card landscape at this viewport width? */
export const homeLandscape = (viewportWidth) => viewportWidth >= HOME_WIDE.minViewport;
/** The deck's column on Home: 640 for the landscape card, 390 for the portrait one. */
export const homeDeckColumn = (viewportWidth) => (homeLandscape(viewportWidth) ? HOME_WIDE.column : 390);
/** The Home card's size: 600 × 372 at ≥ 1440; 300 × 420 on a computer; on a phone the column (≤ 330) less the fan's
 *  80 px, at 5 : 7. */
export function homeCardSize(viewportWidth) {
  if (homeLandscape(viewportWidth)) return { width: HOME_WIDE.width, height: HOME_WIDE.height };
  if (viewportWidth > HOME_CARD.stackPx) return { width: HOME_CARD.width, height: HOME_CARD.height };
  const col = Math.min(HOME_CARD.phoneMax, viewportWidth - HOME_CARD.phoneChrome);
  const width = Math.max(200, col - HOME_CARD.phoneGutter);
  return { width, height: Math.round((width * 7) / 5) };
}
/** Where Home's card `offset` places from the front sits: turned about its lower-left corner, never moved. */
export function homeFanTransform(offset, geometry = HOME_FAN) {
  const origin = "0% 100%";
  if (offset === 0) return { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1, shown: true, depth: 0, origin };
  // ⭐ D156 (1b): a card flipped past slides out to the left (and back in from there when the reader goes back).
  if (offset < 0) return { x: -96, y: 0, rotate: -4, scale: 1, opacity: 0, shown: false, depth: Math.abs(offset), origin };
  const shown = offset <= geometry.visible;
  return { x: 0, y: 0, rotate: shown ? offset * geometry.spread : 0, scale: 1, opacity: shown ? 1 : 0, shown, depth: Math.abs(offset), origin };
}

/**
 * Where the card `offset` places from the front sits. offset 0 is the front card; positive offsets
 * are the cards still to come, negative the ones rotated past. Returns a transform relative to the
 * front slot's centre, plus whether it is shown at all.
 *
 * The card's centre lies on a circle of radius `reach` round the pivot, and the card is turned to
 * face the pivot — that is what makes it a fan and not a staircase. The behind-cards are then
 * pulled back: positions and size both scaled by `zoom` toward the front slot.
 */
export function fanTransform(offset, orientation, geometry = FAN[orientation]) {
  const { zoom, spread, reach, visible } = geometry;
  if (offset === 0) return { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1, shown: true, depth: 0 };
  const a = rad(offset * spread);
  const along = reach * Math.sin(a);           // across the arc
  const toward = reach * (1 - Math.cos(a));    // curving toward the pivot
  const dist = Math.abs(offset);
  // Fades to zero AT `visible + 1`, so `visible` cards either side are on screen.
  const opacity = Math.max(0, 1 - dist / (visible + 1));
  const base = { scale: zoom, opacity, shown: dist <= visible, depth: dist };
  return orientation === "horizontal"
    // Pivot off to the RIGHT: later cards fall away BELOW, curving right, turned toward the pivot.
    ? { ...base, x: round(zoom * toward), y: round(zoom * along), rotate: round(-offset * spread) }
    // Pivot BELOW: later cards fall away to the RIGHT, curving down, like a hand of cards.
    : { ...base, x: round(zoom * along), y: round(zoom * toward), rotate: round(offset * spread) };
}

const round = (n) => Math.round(n * 100) / 100;

// ── The geometry as a user control: the FIT (queue 38) ───────────────────────────────────────
//
// shared/deckGeometry.js holds the presets and each slider's own range. Those are not enough: the
// three are COUPLED, and the sketches had combinations that broke the layout at the extremes. So a
// geometry reaches the fan only through clampGeometry, which fits the COMBINATION against the
// constraints that chose the shipped numbers in queue 27, made general:
//
//   horizontal  peek ≥ 40   the first back shows at least 40px below the front card (standard: 47)
//                           — less, and the next card hides entirely: you rotate blind
//               frame ≤ 900 the 3rd back's bottom edge inside a 1440×900 frame, the front card's
//                           centre ~390px down. (The faint 4th may clip, as it already does at
//                           1280×800 at ANY reach — queue 27; the fade and the counter carry it.)
//   vertical    peek ≥ 80   the first back clears a 318px phone card by enough to show its logo —
//                           queue 27's reason vertical zoom moved to 0.86 (standard: 93)
//               x ≤ 160     the first back's centre — its logo — stays on a 390px screen
//
// Every constraint grows with reach (and with spread), so the reaches that fit a zoom and spread are
// one interval, and so are the spreads that fit a zoom: the clamp keeps zoom, then pulls spread into
// its interval, then reach into its.
export const FIT = Object.freeze({
  horizontal: Object.freeze({ peekMin: 40, frameBottom: 900, frontCentreY: 390 }),
  vertical:   Object.freeze({ peekMin: 80, logoMaxX: 160, viewport: 390 }),
});

/** How a geometry sits in the layout, and whether it fits. */
export function fanFit(orientation, g) {
  const geometry = { visible: FAN[orientation].visible, ...g };
  const f = FIT[orientation];
  if (orientation === "horizontal") {
    const { width: W, height: H } = CARD.horizontal;
    const halfH = (t) => { const a = rad(Math.abs(t.rotate)); return geometry.zoom * (H / 2 * Math.cos(a) + W / 2 * Math.sin(a)); };
    const t1 = fanTransform(1, orientation, geometry), t3 = fanTransform(geometry.visible - 1, orientation, geometry);
    const peek = t1.y + halfH(t1) - H / 2;
    const bottom = f.frontCentreY + t3.y + halfH(t3);
    return { peek: round(peek), bottom: round(bottom), ok: peek >= f.peekMin && bottom <= f.frameBottom };
  }
  const { width: W } = cardSize("vertical", f.viewport);
  const t1 = fanTransform(1, orientation, geometry);
  const peek = t1.x + (geometry.zoom * W) / 2 - W / 2;
  return { peek: round(peek), x: round(t1.x), ok: peek >= f.peekMin && t1.x <= f.logoMaxX };
}

const steps = (orientation, axis) => {
  const [min, max, step] = DECK_LIMITS[orientation][axis];
  const out = [];
  for (let v = min; v <= max + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
};
const interval = (vals) => (vals.length ? [vals[0], vals[vals.length - 1]] : null);

/** The reaches (on the slider's steps) that fit this zoom and spread — [lo, hi], or null if none. */
export function reachBounds(orientation, zoom, spread) {
  return interval(steps(orientation, "reach").filter(reach => fanFit(orientation, { zoom, spread, reach }).ok));
}
/** The spreads (on the slider's steps) for which SOME reach fits this zoom. */
export function spreadBounds(orientation, zoom) {
  return interval(steps(orientation, "spread").filter(spread => reachBounds(orientation, zoom, spread)));
}

const within = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));

/** ⛔ The ONLY way a chosen geometry reaches the fan: each axis into its range, then the combination into the layout. */
export function clampGeometry(orientation, g = {}) {
  const std = FAN[orientation];
  const zoom = clampAxis(orientation, "zoom", g.zoom) ?? std.zoom;
  const sb = spreadBounds(orientation, zoom);
  if (!sb) return std;
  const spread = within(clampAxis(orientation, "spread", g.spread) ?? std.spread, sb);
  const rb = reachBounds(orientation, zoom, spread);
  const reach = within(clampAxis(orientation, "reach", g.reach) ?? std.reach, rb);
  return Object.freeze({ zoom, spread, reach, visible: std.visible });
}

/**
 * The geometry the fan draws, from the user's stored preference.
 * ⛔ prefers-reduced-motion OVERRIDES WHATEVER THE USER PICKED: the deck is Tight — the smallest
 * sweep, so a step moves each card least — and its transitions are already off. A preference never
 * brings motion back.
 */
export function geometryFor(orientation, pref, { reduced = false } = {}) {
  const std = FAN[orientation];
  if (reduced) return Object.freeze({ ...std, ...DECK_PRESETS[orientation].tight });
  const preset = pref?.preset || "standard";
  if (preset === "custom") return clampGeometry(orientation, pref?.custom?.[orientation] || std);
  if (preset === "tight" || preset === "wide") return Object.freeze({ ...std, ...DECK_PRESETS[orientation][preset] });
  return std;
}

// ── The expanded card (A40) ────────────────────────────────────────────────────────────────────
// ⭐ D152 (8) (b): A40's TWO EQUAL PANELS (the ATS report beside the card: TWO_PANEL, TWO_PANEL_PX, twoPanelFor,
// twoPanelColumn) are DELETED with the deck's sheet — the deck lives only on Home, where the match opens in the
// board's posting. The posting still grows INSIDE the card, on the clock below.

// ⭐ ONE CLOCK. The design's "in unison, a bit slowly": ~0.9–1.3 s, exposed as ONE custom property so
// it is tuned in one place. Every rule in the expansion reads --deck-t and --deck-ease; none restates
// a duration. Reduced motion sets it to 0s.
// ⚠ An EVEN ease-in-out, not an ease-out: the fan's ease-out (0.22, 1, 0.36, 1) had the card 97% of the
// way there at 550 ms of 1.1 s — measured in the screenshots — which reads as fast-then-waiting, not
// "in unison, a bit slowly". Symmetric, so the slow middle is where the four movements are seen together.
export const EXPAND_CLOCK = Object.freeze({ duration: "1.1s", ease: "cubic-bezier(0.65, 0, 0.35, 1)" });
