// ⭐ D129 · THE TOUR'S GEOMETRY (the owner's bug report, 11-01: "obscured and not at the right place"). Pure, so the
// rules are tested in node: the popover never covers its target or the top navigation — below, then above, then
// beside (narrowing to MIN_W if that is what fits), and on a phone a sheet at whichever edge does not cover the target.
export const GAP = 12;
export const MARGIN = 8;
export const MIN_W = 240;
export const MAX_W = 380;

/** True when two rectangles { top, left, width, height } share any area. */
export function overlaps(a, b) {
  if (!a || !b) return false;
  return a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;
}

/**
 * Where the popover goes. rect: the target (null = no target); h: the popover's measured height; vw / vh: the viewport;
 * navBottom: the bottom of the top navigation (nothing is placed above it).
 * @returns {{ side: string, top: number, left: number, width: number }}
 */
export function placePopover({ rect, h = 220, vw, vh, navBottom = 0, phone = false }) {
  const top0 = navBottom + MARGIN;
  if (phone) {
    const width = vw - MARGIN * 2;
    const bottomTop = vh - h - MARGIN;
    if (!rect) return { side: "bottom-sheet", top: bottomTop, left: MARGIN, width };
    const underBottom = Math.max(0, rect.top + rect.height - bottomTop);       // how much of the target a bottom sheet hides
    const underTop = Math.max(0, top0 + h - rect.top);                          // … and a top one
    return underBottom <= underTop
      ? { side: "bottom-sheet", top: bottomTop, left: MARGIN, width }
      : { side: "top-sheet", top: top0, left: MARGIN, width };
  }
  if (!rect) return { side: "center", top: Math.max(top0, (vh - h) / 2), left: Math.max(MARGIN, (vw - MAX_W) / 2), width: MAX_W };
  const clampX = (x, w) => Math.max(MARGIN, Math.min(x, vw - w - MARGIN));
  const clampY = (y) => Math.max(top0, Math.min(y, vh - h - MARGIN));
  const below = rect.top + rect.height + GAP;
  if (below + h <= vh - MARGIN) return { side: "below", top: below, left: clampX(rect.left, MAX_W), width: MAX_W };
  const above = rect.top - GAP - h;
  if (above >= top0) return { side: "above", top: above, left: clampX(rect.left, MAX_W), width: MAX_W };
  const rightRoom = vw - (rect.left + rect.width) - GAP - MARGIN;
  const leftRoom = rect.left - GAP - MARGIN;
  if (rightRoom >= MIN_W && rightRoom >= leftRoom) {
    const width = Math.min(MAX_W, rightRoom);
    return { side: "right", top: clampY(rect.top), left: rect.left + rect.width + GAP, width };
  }
  if (leftRoom >= MIN_W) {
    const width = Math.min(MAX_W, leftRoom);
    return { side: "left", top: clampY(rect.top), left: rect.left - GAP - width, width };
  }
  // Nothing fits beside a target this large: the corner it covers least, never over the navigation.
  const corners = [
    { side: "corner", top: clampY(vh - h - MARGIN), left: clampX(vw - MAX_W - MARGIN, MAX_W), width: MAX_W },
    { side: "corner", top: clampY(vh - h - MARGIN), left: MARGIN, width: MAX_W },
    { side: "corner", top: top0, left: clampX(vw - MAX_W - MARGIN, MAX_W), width: MAX_W },
  ];
  const covered = (c) => {
    const x = Math.max(0, Math.min(c.left + c.width, rect.left + rect.width) - Math.max(c.left, rect.left));
    const y = Math.max(0, Math.min(c.top + h, rect.top + rect.height) - Math.max(c.top, rect.top));
    return x * y;
  };
  return corners.sort((a, b) => covered(a) - covered(b))[0];
}

/** The four dimming panels around a cut-out (the target itself is never covered). */
export function cutoutPanels(rect, { vw, vh, pad = 6 }) {
  const t = Math.max(0, rect.top - pad), l = Math.max(0, rect.left - pad);
  const b = Math.min(vh, rect.top + rect.height + pad), r = Math.min(vw, rect.left + rect.width + pad);
  return [
    { top: 0, left: 0, width: vw, height: t },
    { top: b, left: 0, width: vw, height: Math.max(0, vh - b) },
    { top: t, left: 0, width: l, height: Math.max(0, b - t) },
    { top: t, left: r, width: Math.max(0, vw - r), height: Math.max(0, b - t) },
  ];
}
