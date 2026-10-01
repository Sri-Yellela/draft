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
export const CARD = Object.freeze({
  horizontal: Object.freeze({ width: 700, height: 380 }),
  vertical:   Object.freeze({ maxWidth: 360, gutter: 36, height: 500 }),
});

export const orientationFor = (viewportWidth) => (viewportWidth >= FAN_SWITCH_PX ? "horizontal" : "vertical");

/** The card's size for a viewport. Horizontal never shrinks below its design width unless it must. */
export function cardSize(orientation, viewportWidth) {
  if (orientation === "horizontal") return { width: Math.min(CARD.horizontal.width, viewportWidth - 32), height: CARD.horizontal.height };
  const width = Math.max(240, Math.min(CARD.vertical.maxWidth, viewportWidth - 2 * CARD.vertical.gutter));
  return { width, height: CARD.vertical.height };
}

const rad = (deg) => (deg * Math.PI) / 180;

/**
 * Where the card `offset` places from the front sits. offset 0 is the front card; positive offsets
 * are the cards still to come, negative the ones rotated past. Returns a transform relative to the
 * front slot's centre, plus whether it is shown at all.
 *
 * The card's centre lies on a circle of radius `reach` round the pivot, and the card is turned to
 * face the pivot — that is what makes it a fan and not a staircase. The behind-cards are then
 * pulled back: positions and size both scaled by `zoom` toward the front slot.
 */
export function fanTransform(offset, orientation, geometry = FAN[orientation], expanded = null) {
  // Expanded three-column (queue 40): the front card shifts right by `card.shift`, every back by `arc`.
  if (expanded) {
    const t = fanTransform(offset, orientation, geometry);
    return { ...t, x: round(t.x + (offset === 0 ? expanded.card.shift : expanded.arc)) };
  }
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

// ── The expanded card, three columns: ATS │ card │ posting (queue 40) ─────────────────────────
//
// Expansion used to grow DOWNWARDS and leave the left and right thirds of a wide screen empty. At
// THREE_COL_PX and above it grows SIDEWAYS instead: the card shifts slightly right, the ATS report
// opens on its LEFT, the posting sits on its RIGHT, and the fan's arc slides right, behind the
// posting — the depth comes from the arc passing under the new panel.
//
// ⛔ The card is still the element that expanded. The panels FLANK it inside the deck's own stage;
// they are not a second view and nothing routes.
//
// The numbers are the edges of constraints, not taste:
//   minPanel 280   the narrowest a column of 14.5px prose reads at (~40 characters a line) and the
//                  ATS chips wrap without orphaning a single chip per line
//   minCard  560   the narrowest the horizontal card holds its 46px title in three lines
//   shift     32   "slightly": less than the gap, so the card never reads as left-aligned to a panel
//   → THREE_COL_PX = the width at which minPanel × 2 + minCard + the gutters + 2 × shift first fit
//                  (1272), rounded up to the laptop breakpoint the screenshots are taken at.
// Below it the panels STACK inside the card (ATS, then the posting), and below FAN_SWITCH_PX the deck
// is the vertical one — the fallback is the layout that shipped, so a narrow screen loses nothing.
export const EXPANDED = Object.freeze({ pad: 24, gap: 20, minPanel: 280, minCard: 560, shift: 32 });
export const THREE_COL_PX = 1280;

/**
 * Where the three columns go for a viewport, or null below THREE_COL_PX (the panels stack).
 * `vw` is the LAYOUT width (clientWidth — a scrollbar is not page), `centerX` the deck stage's centre
 * in it. Every x is relative to that centre, which is where the front card's slot is.
 */
export function expandedLayout(vw, centerX = vw / 2) {
  if (!(vw >= THREE_COL_PX)) return null;
  const { pad, gap, minPanel, shift } = EXPANDED;
  const width = Math.min(CARD.horizontal.width, vw - 2 * pad - 2 * gap - 2 * minPanel - 2 * shift);
  const cardLeft = centerX - width / 2 + shift;
  const cardRight = cardLeft + width;
  const left = { x: round(pad - centerX), width: round(cardLeft - gap - pad) };
  const right = { x: round(cardRight + gap - centerX), width: round(vw - pad - cardRight - gap) };
  // The arc slides right until the fan's spine sits under the posting's centre — behind it, by tier.
  const arc = round(right.x + right.width / 2);
  return { card: { width, shift }, left, right, arc };
}
