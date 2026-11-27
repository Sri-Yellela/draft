// ── Panel geometry — the drawer insets, with no component attached ─────────────────────────────
//
// 47n: what is left of the overlay-panel geometry. PanelShell (the PDF / ATS / JD dock) and usePanelHost
// were the other readers; the deck-slot posting and its panels were deleted in 47m (a posting opens as
// its sheet, /app/jobs/<id>), so the dock's widths, tiling and persistence went with them. The market's
// filters drawer still needs its two insets — one copy, here.
//
// The clearance below the FIXED chrome. Only the fixed bar matters to a fixed overlay — the hero and
// the search bar are in-flow and scroll away underneath it. --app-chrome-height is published from the
// one measurement in hooks/useChromeHeight.js; 46 + 34 is the 80 it always was.
export const PANEL_TOP_INSET = "calc(var(--app-chrome-height, 74px) + 34px)";
export const PANEL_BOTTOM_INSET = 16;
