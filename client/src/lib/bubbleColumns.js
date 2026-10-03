// D1 — how many job bubbles share a row: 2 or 3 by the board's width (3 is the default); a phone
// gets one. D11 capped it at THREE: D1 had a fourth column from 1700px; the owner wants at most 3.
// Its own module so the rule is testable without a browser.
export function columnsFor(width) {
  if (!width) return 3;
  if (width < 640) return 1;
  if (width < 1000) return 2;
  return 3;
}
