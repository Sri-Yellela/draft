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
  // ⭐ D178 Fly my route: how many segments lead up to each stop (the anchor's index), so a flight draws the track to it.
  return { start, flag, stops: stops.map(s => ({ ...s, seg: anchors.indexOf(s) })), segments };
}

/** A station's Learn piece (the course's circle view, D178) or its Atlas page. */
export function stationHref(base, s) {
  return s?.learn?.stepId ? `${base}/library/silicon-to-software?view=circle#step-${encodeURIComponent(s.learn.stepId)}` : `${base}/${encodeURIComponent(s?.slug || "")}`;
}

const STATE_SAID = { done: "you have it", next: "next", ahead: "ahead" };
/**
 * ⭐ D178 · FLY MY ROUTE (owner 11-07: "the track draws from You to the goal and the camera walks the stations"). Pure:
 * one frame per stop — You, each station in order, the goal — with how many segments are drawn by then (`drawn`), where
 * the camera looks (x, y) and the line it reads ("2 of 5 · Streaming · next"). Nothing invented: the stations, their
 * states and the goal's open roles are the route's own.
 */
export function flightPlan(layout, role = "", openRoles = null) {
  const { start, flag, stops, segments } = layout;
  const n = stops.length;
  return [
    { kind: "start", x: start.x + 60, y: start.y, drawn: 0, text: `You · ${n} ${n === 1 ? "stop" : "stops"} to ${role}` },
    ...stops.map((s, i) => ({ kind: "station", slug: s.slug, x: s.x, y: s.y, drawn: s.seg, text: `${i + 1} of ${n} · ${s.name} · ${STATE_SAID[s.state]}` })),
    { kind: "goal", x: flag.x + 60, y: flag.y - 30, drawn: segments.length,
      text: `${role}${Number.isFinite(openRoles) ? ` · ${openRoles.toLocaleString("en-US")} open roles` : ""}` },
  ];
}

/** The camera: centre (x, y) at `zoom`, clamped so the board always fills the frame. A CSS transform for the board's group. */
export function cameraFor(x, y, zoom = 1.8) {
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const tx = clamp(BOARD.w / 2 - x * zoom, BOARD.w - BOARD.w * zoom, 0);
  const ty = clamp(BOARD.h / 2 - y * zoom, BOARD.h - BOARD.h * zoom, 0);
  return `translate(${Math.round(tx)}px, ${Math.round(ty)}px) scale(${zoom})`;
}

/** The line under the board: "Start: Streaming" (the next station) — null when every station is done. */
export function startLine(stations = []) {
  const n = stationStates(stations).find(s => s.state === "next");
  return n ? { text: `Start: ${n.name}`, learn: n.learn || null, slug: n.slug } : null;
}
