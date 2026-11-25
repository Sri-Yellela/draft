// ⭐ D197 Wave 1 #1 · A237 · WHERE THE DOCK GOES (the Shell board, owner-approved 11-25). Pure: AppNav.jsx measures, this
// decides. Supersedes D167's side / top / phone by the room in the margin: on a wide screen the dock is a vertical RAIL at
// the left, 84 px wide and 14 px from the edge, with the content column beside it (the area nav across its top, plate
// content centred in its 1,180 px column; at 2560 the extra width is margin — never a dock on top); below 980 px the
// rail becomes the phone's bottom bar.
export const DOCK_RAIL_PX = 84;    // the rail's width (styles/plate.css --pl-dock-width)
export const DOCK_EDGE_PX = 14;    // the rail's gap from the screen's left and top edges (the board's margin: 14px 0 0 14px)
export const SIDE_MIN_PX = 980;    // the rail from here up; below it the bottom bar (the board's own breakpoint)
export const PHONE_MAX_PX = SIDE_MIN_PX - 1;

/**
 * Where the dock goes at viewport width `vw`.
 * @returns {"side" | "phone"}  side = the left rail; phone = the bottom bar (+ the area nav's top bar)
 */
export function dockPlace({ vw }) {
  return vw >= SIDE_MIN_PX ? "side" : "phone";
}
