// client/src/pages/atlas/trackModel.js — ⭐ D172 (4) (atlas-redesign-sketch.html → Your map) · THE TRACK BOARD, pure: one thick
// track that loops — from You along the top, round a curve on the right, back along the bottom to the flag at the goal —
// with the route's skills as stations on it. Green = done, the first not-done = next (it pulses), empty rings ahead; the
// walked part of the track is drawn in the accent. Geometry in a 1000 × 420 board; the component only draws it.

export const BOARD = Object.freeze({ w: 1000, h: 420, top: 110, bottom: 310, left: 110, right: 860, turnR: 100 });

/** The stations' states: done · next (the first not done) · ahead. */
export function stationStates(stations = []) {
  const next = stations.findIndex(s => !s.done);
  return stations.map((s, i) => ({ ...s, state: s.done ? "done" : i === next ? "next" : "ahead" }));
}

/**
 * Lay the stations on the loop: the first half along the top (left → right), the rest along the bottom (right → left).
 * @returns { start: {x,y}, flag: {x,y}, stops: [{...station, x, y, row: "top" | "bottom"}], segments: [{ d, walked }] }
 */
export function layoutTrack(stations = []) {
  const { top, bottom, left, right, turnR } = BOARD;
  const st = stationStates(stations);
  const nTop = Math.ceil(st.length / 2), nBottom = st.length - nTop;
  const xs = (n, from, to) => Array.from({ length: n }, (_, i) => Math.round(from + ((to - from) * (i + 1)) / (n + 1)));
  const topX = xs(nTop, left, right), bottomX = xs(nBottom, right, left);
  const stops = st.map((s, i) => (i < nTop ? { ...s, x: topX[i], y: top, row: "top" } : { ...s, x: bottomX[i - nTop], y: bottom, row: "bottom" }));
  const start = { x: left - 40, y: top }, flag = { x: left - 10, y: bottom };
  // The path as anchors: start → top stops → the turn → bottom stops → flag. Each segment ends at an anchor.
  // The track leaves You from its box's right edge (the box is 92 wide), so it never shows through it.
  const anchors = [{ x: start.x + 46, y: start.y, kind: "start" }, ...stops.filter(s => s.row === "top"),
    { x: right, y: top, kind: "turn-in" }, { x: right, y: bottom, kind: "turn-out" }, ...stops.filter(s => s.row === "bottom"), { ...flag, kind: "flag" }];
  const lastDone = stops.reduce((a, s, i) => (s.state === "done" ? i : a), -1);
  const walkedTo = lastDone >= 0 ? anchors.indexOf(stops[lastDone]) : 0;
  const segments = [];
  for (let i = 1; i < anchors.length; i++) {
    const a = anchors[i - 1], b = anchors[i];
    const d = a.kind === "turn-in" && b.kind === "turn-out"
      ? `M ${a.x} ${a.y} A ${turnR} ${turnR} 0 0 1 ${b.x} ${b.y}`
      : `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
    segments.push({ d, walked: i <= walkedTo });
  }
  return { start, flag, stops, segments };
}

/** The line under the board: "Start: Streaming" (the next station) — null when every station is done. */
export function startLine(stations = []) {
  const n = stationStates(stations).find(s => s.state === "next");
  return n ? { text: `Start: ${n.name}`, learn: n.learn || null, slug: n.slug } : null;
}
