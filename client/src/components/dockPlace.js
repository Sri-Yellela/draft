// ⭐ D167 · THE DOCK GOES WHERE THE SPACE IS (owner 11-06, "draft screen"). Pure: AppNav.jsx measures, this decides.
// ⭐ D167 · the open dock's width (the sketch's 196) — AppNav.css's rail opens to it; the placement reads it.
export const DOCK_OPEN_PX = 196;
// ⭐ D167 · the gap kept between the dock and everything else — on both sides of a side dock, above and below a top one.
export const DOCK_GAP_PX = 24;
export const DOCK_TOP_GAP_PX = 20;
export const PHONE_MAX_PX = 600;

/**
 * ⭐ D167 · WHERE THE DOCK GOES, from the room it has. `contentLeft` is where the page's content starts (its first box's
 * left edge plus that box's padding — D163's centred group), `vw` the viewport's width.
 * @returns {"side" | "top" | "phone"}
 */
export function dockPlace({ vw, contentLeft }) {
  if (!(vw > PHONE_MAX_PX)) return "phone";
  return contentLeft >= DOCK_OPEN_PX + 2 * DOCK_GAP_PX ? "side" : "top";
}
