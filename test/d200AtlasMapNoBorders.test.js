// ⛔ D200 · THREE MAPS, NEVER MERGED — "only Atlas uses elevation, only the market uses borders". Atlas's region map
// (plate/AtlasRegion.jsx, the final canvas's `Map` board) is the PHYSICAL map: contour bands rising to a summit, height =
// how far you've climbed, places = lessons. It draws no territory and no border: every closed line on the terrain is a
// contour (data-contour) and every filled band an elevation (data-elevation); the market's political map is never imported.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const src = strip(read("client/src/plate/AtlasRegion.jsx"));
const terrain = src.slice(src.indexOf("function Terrain("), src.indexOf("function Route("));

test("⛔ D200 · Atlas's map is the physical map: the terrain says so, and its bands are elevations", () => {
  assert.ok(terrain.length > 500, "the terrain was found");
  assert.match(terrain, /data-map="physical"/);
  assert.match(terrain, /BANDS\.map\(\(d, i\) => <path key=\{i\} d=\{d\} strokeWidth="1\.4" data-contour="" data-elevation=\{i \+ 1\}/);
  assert.match(terrain, /CONTOURS\.map\(\(d, i\) => <path key=\{i\} d=\{d\} data-contour=""\/>/);
  // the stage names are the elevation bands, low to high
  for (const s of ["LOWLANDS · START", "FOOTHILLS · BUILD", "HIGHLANDS · DEEPEN", "SUMMIT · MASTER"]) assert.ok(terrain.includes(s), s);
  // the bands are concentric round one summit (each starts at the summit's 1240 × 150 and steps out), deepest last
  const bands = [...src.matchAll(/"M1240 150 m-(\d+) 0/g)].map((m) => Number(m[1]));
  assert.deepEqual(bands.slice(0, 4), [1060, 740, 420, 160], "four bands, each inside the last");
});

test("⛔ D200 · no borders on Atlas's map — no territory, no border word, no political map imported", () => {
  assert.doesNotMatch(src, /territor/i, "no territories");
  assert.doesNotMatch(src, /data-border|data-territory|data-sector/, "no border marks");
  assert.doesNotMatch(src, /MarketTerrain|MarketSurveyPlate|PoliticalMap/, "the market's maps are never drawn here");
  // every <path> the terrain draws is a band / contour (filled ground) or a trail (unfilled, round-capped) — nothing else
  const paths = [...terrain.matchAll(/<path\b[^>]*>/g)].map((m) => m[0]);
  assert.ok(paths.length >= 4);
  for (const p of paths) assert.ok(/data-contour|d=\{t\.d\}|M40 0H0V40/.test(p), `a path that is not a contour or a trail: ${p.slice(0, 80)}`);
});
