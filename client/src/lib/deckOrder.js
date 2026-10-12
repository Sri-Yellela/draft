// A75 · THE DECK'S ORDER — the dealt order (the board's own: position IS the fit signal) or ATS match. Remembered
// per browser (the deal is frozen; the server reads it back in ATS order when asked — the score never reaches the
// client). ⭐ D93: ONE definition, read by the deck's own quick control (panels/DeckView.jsx) and by the Customise
// page, so the two can never store it differently.
export const DECK_ORDER_KEY = "draft-deck-order";
export const DECK_ORDERS = Object.freeze([
  Object.freeze({ id: "dealt", label: "Dealt", description: "The order the deck was dealt in — the board's own, best fit first." }),
  Object.freeze({ id: "ats", label: "ATS match", description: "Re-sorted by how well your résumé matches each posting's ATS read." }),
]);

export function readDeckOrder() {
  try { return localStorage.getItem(DECK_ORDER_KEY) === "ats" ? "ats" : "dealt"; } catch { return "dealt"; }
}
export function writeDeckOrder(next) {
  try { localStorage.setItem(DECK_ORDER_KEY, next === "ats" ? "ats" : "dealt"); } catch { /* a private window: this session only */ }
}
