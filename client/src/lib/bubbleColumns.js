// D1 — how many job bubbles share a row: 2, 3 or 4 by the board's width (3 is the default); a phone
// gets one. Its own module so the rule is testable without a browser.
export function columnsFor(width) {
  if (!width) return 3;
  if (width < 640) return 1;
  if (width < 1000) return 2;
  if (width < 1700) return 3;
  return 4;
}
