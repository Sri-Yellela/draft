// ⭐ D196 FIX-2 (owner 11-24, 47f) · THE MARKET DECK AT THE BOARD'S SIZE — "retain the frame and flip but also make it pixel
// diffable". DeckView keeps its frame (FanCard, the deck's own CardBack behind the ticket, the flip); in the plate market
// these two pure functions give it the *The market* artboard's ticket and its two back sheets instead of Home's fixed box.
//
// The board (canvas v3, "The market · draft", section 02): the deck column is `flex: 999 1 560px`; inside it a box with
// `padding: 14px 18px 0 0` holds the ticket (its own height — the title wraps, nothing is cut) and two sheets behind it:
//   the far one   inset 0 0 26px 18px, rotate(2.2deg)  → 18 px right of the ticket, 14 px above it, 12 px shorter
//   the near one  inset 6px 6px 20px 10px, rotate(1deg) → 10 px right, 8 px above, 2 px wider, 12 px shorter
// Both turn about their own centre. Those numbers are what plateFanTransform returns, so the build's backs land where the
// board's do (and F5 can diff the Deck tab).

/** The padding the backs sit in (the board's `padding: 14px 18px 0 0`). */
export const PLATE_DECK_PAD = Object.freeze({ top: 14, right: 18 });
const MIN_WIDTH = 200;          // the narrowest ticket the board draws is 226 (its 390 artboard); below 200 nothing fits
export const PLATE_TICKET_FALLBACK_H = 460;   // before the face is measured (the board's ticket at 828 px is ≈ 455)

/** The ticket's box: the column's width less the backs' 18 px; the face's measured height (0 → a first-paint guess). */
export function plateTicketSize(columnWidth, measuredHeight) {
  const width = Math.max(MIN_WIDTH, Math.round(Number(columnWidth) || 0) - PLATE_DECK_PAD.right);
  const height = Number(measuredHeight) > 0 ? Math.round(measuredHeight) : PLATE_TICKET_FALLBACK_H;
  return { width, height };
}

/** Where the card `offset` places from the front sits: 0 the ticket, 1 and 2 the board's two sheets, the rest hidden under
 *  the far sheet; a card flipped past slides out to the left, as Home's does (D156 (1b)). `dw` widens the near sheet. */
export function plateFanTransform(offset) {
  const origin = "50% 50%";
  if (offset === 0) return { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1, shown: true, depth: 0, origin, dw: 0 };
  if (offset < 0) return { x: -96, y: 0, rotate: -4, scale: 1, opacity: 0, shown: false, depth: Math.abs(offset), origin, dw: 0 };
  if (offset === 1) return { x: 10, y: -8, rotate: 1, scale: 1, opacity: 1, shown: true, depth: 1, origin, dw: 2 };
  return { x: 18, y: -14, rotate: 2.2, scale: 1, opacity: offset === 2 ? 1 : 0, shown: offset === 2, depth: offset, origin, dw: 0 };
}
