// client/src/lib/deckWheel.js — ⭐ D168 · THE DECK GESTURE, ONE COPY: over a deck, one wheel or trackpad flick turns ONE card,
// in either direction; at an end the page scrolls instead. Home's deck (panels/DeckView.jsx) and Atlas's lesson deck
// (D178-3, pages/atlas/LessonDeck.jsx — "the existing card-deck design", owner 11-07) both use it.
export const WHEEL_STEP = 60;               // accumulated wheel delta for one card
export const WHEEL_SETTLE_MS = 140;         // one trackpad flick is many events; rotate once per flick

/**
 * A wheel listener for a deck. `skip(e)` → true leaves the event to the page; `canStep(dir)` → false at an end (the page
 * scrolls); `step(dir)` turns one card. Use with addEventListener("wheel", fn, { passive: false }).
 */
export function deckWheelHandler({ skip = () => false, canStep, step, now = () => performance.now() }) {
  let acc = 0, settleUntil = 0;
  return (e) => {
    if (e.ctrlKey || skip(e)) return;          // pinch-zoom, or the caller's reading state: the page's
    const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    const dir = d > 0 ? 1 : -1;
    if (!canStep(dir)) { acc = 0; return; }    // at an end: let the page scroll
    e.preventDefault();
    const t = now();
    if (t < settleUntil) return;
    acc += d * (e.deltaMode === 1 ? 33 : 1);
    if (Math.abs(acc) >= WHEEL_STEP) { acc = 0; settleUntil = t + WHEEL_SETTLE_MS; step(dir); }
  };
}
