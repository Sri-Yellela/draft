// A75 · THE DECK'S ORDER — the dealt order (the board's own: position IS the fit signal) or ATS match. Remembered
// per browser (the deal is frozen; the server reads it back in ATS order when asked — the score never reaches the
// client). ⭐ D93: ONE definition, read by the deck's own quick control (panels/DeckView.jsx) and by the Customise
// page, so the two can never store it differently.
export const DECK_ORDER_KEY = "draft-deck-order";
// ⭐ D152 (3): BEST BETS is the default — one ranking feeds the deck (the server's orderByBest over each card's best-bets
// reading); Dealt and ATS match stay choices in Customise.
export const DECK_ORDERS = Object.freeze([
  Object.freeze({ id: "best", label: "Best bets", description: "Your best bets first — eligibility, the must-haves you have, your level and how fresh it is." }),
  Object.freeze({ id: "dealt", label: "Dealt", description: "The order the deck was dealt in — the board's own, best fit first." }),
  Object.freeze({ id: "ats", label: "ATS match", description: "Re-sorted by how well your résumé matches each posting's ATS read." }),
]);

const ORDER_IDS = DECK_ORDERS.map(o => o.id);
export function readDeckOrder() {
  try { const v = localStorage.getItem(DECK_ORDER_KEY); return ORDER_IDS.includes(v) ? v : "best"; } catch { return "best"; }
}
export function writeDeckOrder(next) {
  try { localStorage.setItem(DECK_ORDER_KEY, ORDER_IDS.includes(next) ? next : "best"); } catch { /* a private window: this session only */ }
}
