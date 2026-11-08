// ⭐ D172 (4) (owner APPROVED 11-06, atlas-redesign-sketch.html → Your map) · d172MapTrackBoardWithStations · d172PathFromYouToGoal —
// the map as a track board: from You to a flag at the goal, the route's skills as stations (done · next · ahead), the
// walked part in the accent; the market tree kept, on demand.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { BOARD, layoutTrack, stationStates, startLine } from "../client/src/pages/atlas/trackModel.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const route = [
  { slug: "sql", name: "SQL", done: true }, { slug: "batch", name: "Batch pipelines", done: true },
  { slug: "streaming", name: "Streaming", done: false, learn: { stepId: "s40", path: "/atlas/learn#step-s40" } },
  { slug: "airflow", name: "Orchestration", done: false }, { slug: "contracts", name: "Data contracts", done: false },
];

test("d172PathFromYouToGoal: done · next (the first not done) · ahead", () => {
  assert.deepEqual(stationStates(route).map(s => s.state), ["done", "done", "next", "ahead", "ahead"]);
  assert.deepEqual(stationStates([{ slug: "a", done: false }, { slug: "b", done: true }]).map(s => s.state), ["next", "done"], "done is per station, next is the first not done");
  assert.deepEqual(startLine(route), { text: "Start: Streaming", learn: route[2].learn, slug: "streaming" });
  assert.equal(startLine(route.map(s => ({ ...s, done: true }))), null);
});

test("d172MapTrackBoardWithStations: the loop — top row left to right, the turn, the bottom row back to the flag; the walked part", () => {
  const t = layoutTrack(route);
  assert.deepEqual(t.stops.map(s => s.row), ["top", "top", "top", "bottom", "bottom"]);
  const top = t.stops.filter(s => s.row === "top").map(s => s.x), bottom = t.stops.filter(s => s.row === "bottom").map(s => s.x);
  assert.deepEqual(top, [...top].sort((a, b) => a - b), "the top row runs left to right");
  assert.deepEqual(bottom, [...bottom].sort((a, b) => b - a), "the bottom row runs back, right to left");
  assert.ok(t.start.y === BOARD.top && t.flag.y === BOARD.bottom && t.flag.x < bottom.at(-1), "from You on the top to the flag at the bottom left");
  assert.equal(t.segments.filter(s => s.d.includes(" A ")).length, 1, "one curve: the turn");
  assert.deepEqual(t.segments.map(s => s.walked), [true, true, false, false, false, false, false, false], "walked up to the last done station");
  assert.equal(layoutTrack([]).stops.length, 0);
});

test("d172MapTrackBoardWithStations: wired — Your map leads with the board; the tree is kept, on demand; the navigator sends the stations", () => {
  const page = read("client/src/pages/atlas/AtlasPage.jsx");
  // ⭐ D178 (changed on purpose): Your route's navigator sits between the board and the tree.
  assert.match(page, /<TrackBoard base=\{base\} signedIn=\{signedIn\} \/>\n[\s\S]{0,400}<YourRoutePanel base=\{base\} signedIn=\{signedIn\} \/><\/section>\}\n\s*<details className="atl-more" data-atlas-market-tree="" open=\{!signedIn\}>/);
  assert.match(page, /<summary className="atl__link">See the whole market around you<\/summary>/);
  assert.match(read("services/navigator.js"), /route: route \? \{ \.\.\.route, stations, openRoles: aimReading\?\.role\?\.postings \?\? null \} : null/);
  const css = read("client/src/pages/atlas/TrackBoard.css");
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i, "tokens only");
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.trk-stop__pulse \{ animation: none; \} \}/);
  assert.match(css, /@media \(max-width: 640px\) \{\n  \.trk-board__svg \{ display: none; \}\n  \.trk-board__list \{ display: block; \}/, "a phone gets the ordered list");
});
