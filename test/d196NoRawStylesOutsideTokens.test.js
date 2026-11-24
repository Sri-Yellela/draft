// ⭐ D196 F1 · TOKENS FIRST, THEN NOTHING ELSE — a plate page takes every colour, shadow, face and type size from
// client/src/styles/plate.css. This guard fails the build on a raw hex / rgb / hsl, a px shadow, a font-family or a
// raw font size anywhere in the plate library (client/src/plate/**), its gallery, or a plate page (D181's rule widened).
// It also holds the token file to the design report (docs/design/plate-system.md): every hex the report's tables give
// is in the token file — so a value can't drift from the report the build claims to follow.
// ⛔ Verified to fail before it was committed (46-style): a `color: "#123456"` in plate/Marks.jsx, `box-shadow: 3px 3px 0
// var(--pl-ink)` in plate/plate.css, `font-family: Georgia` in plate/plate.css, `font-size: 14px` in plate/plate.css, and
// the report's Paper hex changed in the token file — each failed, naming the file.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { at } from "../test-support/sourceAnchors.js";

const TOKENS = "client/src/styles/plate.css";
const REPORT = "docs/design/plate-system.md";
export const PLATE_SCOPE = ["client/src/plate", "client/src/pages/dev/PlateGallery.jsx"];

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
function files(p) {
  if (!fs.existsSync(p)) return [];
  if (fs.statSync(p).isFile()) return [p];
  return fs.readdirSync(p, { withFileTypes: true }).flatMap((e) => files(path.join(p, e.name))).filter((f) => /\.(jsx?|css)$/.test(f));
}
export const scoped = () => PLATE_SCOPE.flatMap(files).map((f) => f.split(path.sep).join("/"));

export function offences(file, src = fs.readFileSync(file, "utf8")) {
  const s = strip(src.replace(/\r\n/g, "\n"));
  const out = [];
  const line = (i) => s.slice(0, i).split("\n").length;
  for (const m of s.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g)) out.push(`${file}:${line(m.index)} colour ${m[0]}`);
  // a shadow must be a token: box-shadow / boxShadow whose value has a px offset
  for (const m of s.matchAll(/(?:box-shadow|boxShadow)\s*:\s*["'`]?([^;"'`}\n]+)/g)) if (/\dpx/.test(m[1])) out.push(`${file}:${line(m.index)} shadow ${m[1].trim()}`);
  // a face must be a token
  for (const m of s.matchAll(/(?:font-family|fontFamily)\s*:\s*["'`]?([^;"'`}\n,]+)/g)) if (!/^\s*(var\(--pl-(serif|sans|mono)\)|inherit)\s*$/.test(m[1])) out.push(`${file}:${line(m.index)} font ${m[1].trim()}`);
  // a CSS font size must be a type token (they follow the text-size setting, A116)
  if (file.endsWith(".css")) for (const m of s.matchAll(/font-size\s*:\s*([^;}\n]+)/g)) if (!/^\s*var\(--pl-t-[\w-]+\)\s*$/.test(m[1])) out.push(`${file}:${line(m.index)} font-size ${m[1].trim()}`);
  return out;
}

test("D196 F1 · the scan reaches the library (a zero-hit scan is a broken scan)", () => {
  const list = scoped();
  for (const f of ["client/src/plate/plate.css", "client/src/plate/Shell.jsx", "client/src/plate/drawings/MarketSurveyPlate.jsx", "client/src/pages/dev/PlateGallery.jsx"]) {
    assert.ok(list.includes(f), `the scan missed ${f}`);
  }
  // the detector itself: each kind of offence is caught
  assert.equal(offences("x.jsx", `const a = { color: "#123456" };`).length, 1);
  assert.equal(offences("x.css", `.a { box-shadow: 3px 3px 0 var(--pl-ink); }`).length, 1);
  assert.equal(offences("x.css", `.a { font-family: Georgia; }`).length, 1);
  assert.equal(offences("x.css", `.a { font-size: 14px; }`).length, 1);
  assert.equal(offences("x.css", `.a { box-shadow: var(--pl-s3); font-family: var(--pl-mono); font-size: var(--pl-t-mono); }`).length, 0);
});

test("⛔ D196 F1 · no raw hex, px shadow, font-family or font size outside the token file", () => {
  const bad = scoped().flatMap((f) => offences(f));
  assert.deepEqual(bad, [], "add a token to client/src/styles/plate.css instead");
});

test("D196 F1 · the token file holds every hex the design report's tables give", () => {
  const report = fs.readFileSync(REPORT, "utf8");
  const tokens = strip(fs.readFileSync(TOKENS, "utf8")).toUpperCase();
  const colourSection = report.slice(at(report, "## Color"), at(report, "## Typography"));
  const hexes = [...new Set([...colourSection.matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m) => m[0].toUpperCase()))];
  assert.ok(hexes.length >= 40, `the report scan found only ${hexes.length} hexes`);
  const missing = hexes.filter((h) => !tokens.includes(h));
  assert.deepEqual(missing, [], "a report colour with no token");
  // the named core values, exactly
  for (const [tok, hex] of [["--pl-paper", "#F4EFE9"], ["--pl-ink", "#1B1B1B"], ["--pl-clay", "#C2593A"], ["--pl-lit", "#3E6B5A"], ["--pl-paper-warm", "#FBF8F4"], ["--pl-r4", "#1F3A63"]]) {
    assert.match(tokens, new RegExp(`${tok.toUpperCase()}:\\s*${hex}\\b`), `${tok} is not ${hex}`);
  }
});

test("D196 F1 · the scales are the report's: shadows 3 / 4 / 5 / 6 / 8 / 10 hard (no blur), the ruler 16 / 80, the easing", () => {
  const t = strip(fs.readFileSync(TOKENS, "utf8"));
  for (const n of [3, 4, 5, 6, 8, 10]) assert.match(t, new RegExp(`--pl-s${n}:\\s*${n}px ${n}px 0 var\\(--pl-ink\\)`), `shadow ${n}`);
  for (const m of t.matchAll(/--pl-s(?:\d+(?:-[a-z]+)?|-hover|-tab):\s*([^;]+);/g)) assert.match(m[1], /^-?\d+px -?\d+px 0 /, `a shadow with blur: ${m[1]}`);
  assert.match(t, /transparent 1px 80px/); assert.match(t, /transparent 1px 16px/);
  assert.match(t, /--pl-ease:\s*cubic-bezier\(\.2, \.8, \.2, 1\)/);
  assert.match(t, /--pl-line:\s*1\.5px/);
});
