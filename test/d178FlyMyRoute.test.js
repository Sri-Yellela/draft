// ⭐ D178 · d178FlyMyRoute — "Fly my route": the track draws from You to the goal and the camera walks the stations
// (owner 11-07, the translation table). One frame per stop, the track drawn up to it, the camera clamped to the board,
// a caption read aloud; reduced motion keeps the walk and drops the movement. Synthetic route.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { BOARD, layoutTrack, flightPlan, cameraFor, stationHref } from "../client/src/pages/atlas/trackModel.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const route = [
  { slug: "sql", name: "SQL", done: true }, { slug: "batch", name: "Batch pipelines", done: true },
  { slug: "streaming", name: "Streaming", done: false, learn: { stepId: "s40", path: "/atlas/learn#step-s40" } },
  { slug: "airflow", name: "Orchestration", done: false }, { slug: "contracts", name: "Data contracts", done: false },
];

test("d178FlyMyRoute: one frame per stop — You, each station in order, the goal — the track drawn further at each", () => {
  const t = layoutTrack(route);
  const f = flightPlan(t, "Data Engineer", 1234);
  assert.deepEqual(f.map(x => x.kind), ["start", "station", "station", "station", "station", "station", "goal"]);
  assert.deepEqual(f.filter(x => x.kind === "station").map(x => x.slug), route.map(s => s.slug), "the route's order");
  const drawn = f.map(x => x.drawn);
  assert.equal(drawn[0], 0, "nothing drawn at You");
  assert.equal(drawn.at(-1), t.segments.length, "the whole track at the goal");
  for (let i = 1; i < drawn.length; i++) assert.ok(drawn[i] > drawn[i - 1], `frame ${i} draws further`);
  assert.deepEqual(f.map(x => x.text), [
    "You · 5 stops to Data Engineer",
    "1 of 5 · SQL · you have it", "2 of 5 · Batch pipelines · you have it", "3 of 5 · Streaming · next",
    "4 of 5 · Orchestration · ahead", "5 of 5 · Data contracts · ahead",
    "Data Engineer · 1,234 open roles",
  ]);
  assert.equal(flightPlan(t, "Data Engineer", null).at(-1).text, "Data Engineer", "no count is invented");
  assert.equal(flightPlan(layoutTrack(route.slice(0, 1)), "X").at(0).text, "You · 1 stop to X");
});

test("d178FlyMyRoute: the camera centres the stop and never shows past the board's edge", () => {
  const parse = (s) => s.match(/translate\((-?\d+)px, (-?\d+)px\) scale\(([\d.]+)\)/).slice(1).map(Number);
  for (const [x, y] of [[0, 0], [BOARD.w, BOARD.h], [BOARD.w / 2, BOARD.h / 2], [110, 310]]) {
    const [tx, ty, z] = parse(cameraFor(x, y));
    assert.equal(z, 1.8);
    assert.ok(tx <= 0 && tx >= BOARD.w - BOARD.w * z, `x clamped for ${x}`);
    assert.ok(ty <= 0 && ty >= BOARD.h - BOARD.h * z, `y clamped for ${y}`);
  }
  const [tx, ty] = parse(cameraFor(BOARD.w / 2, BOARD.h / 2));
  assert.equal(tx, Math.round(BOARD.w / 2 - (BOARD.w / 2) * 1.8));
  assert.equal(ty, Math.round(BOARD.h / 2 - (BOARD.h / 2) * 1.8));
});

test("d178FlyMyRoute: a station opens its piece in the course's circle view (D178's home), else its Atlas page", () => {
  assert.equal(stationHref("/app/atlas", route[2]), "/app/atlas/library/silicon-to-software?view=circle#step-s40");
  assert.equal(stationHref("/app/atlas", route[0]), "/app/atlas/sql");
});

test("d178FlyMyRoute: wired — the button, the drawn segments, the camera, the caption read aloud, reduced motion still", () => {
  const ui = read("client/src/pages/atlas/TrackBoard.jsx");
  assert.match(ui, /<DepthButton size="compact" onClick=\{startFlight\} data-track-fly="">Fly my route<\/DepthButton>/);
  assert.match(ui, /<DepthButton size="compact" onClick=\{stopFlight\} data-track-fly-stop="">Stop<\/DepthButton>/);
  assert.match(ui, /<p className="trk-board__caption" aria-live="polite" data-fly-caption="">\{frame \? frame\.text : ""\}<\/p>/);
  assert.match(ui, /const camera = frame && !still \? cameraFor\(frame\.x, frame\.y\) : undefined;/, "reduced motion: the camera does not move");
  assert.match(ui, /pathLength="1" className=\{`trk-board__fly\$\{i < frame\.drawn \? " is-drawn" : ""\}`\}/);
  assert.doesNotMatch(ui, /\/learn#step-/, "no link through the old /learn address");
  const css = read("client/src/pages/atlas/TrackBoard.css");
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.trk-stop__pulse \{ animation: none; \} \.trk-cam, \.trk-board__fly \{ transition: none; \} \}/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i, "tokens only");
  assert.doesNotMatch(css, /border-radius:\s*(999|50%)/, "no pills (D60)");
});
