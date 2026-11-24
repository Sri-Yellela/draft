// ⭐ D196 F5 · the regression harness's arithmetic (fast tier — the pixels themselves are test/d196VisualDiff.test.js).
import test from "node:test";
import assert from "node:assert/strict";
import { diffRgba, PAIRS, THRESHOLD_PCT, TOLERANCE } from "../scripts/d196Regress.mjs";

const img = (w, h, rgb) => { const a = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < a.length; i += 4) { a[i] = rgb[0]; a[i + 1] = rgb[1]; a[i + 2] = rgb[2]; a[i + 3] = 255; } return a; };

test("D196 F5 · identical images differ by 0 %; a changed block by exactly its share; masks skip it", () => {
  const a = img(10, 10, [244, 239, 233]), b = img(10, 10, [244, 239, 233]);
  assert.equal(diffRgba(a, b, 10, 10).pct, 0);
  for (let y = 0; y < 2; y++) for (let x = 0; x < 5; x++) { const i = (y * 10 + x) * 4; b[i] = 27; b[i + 1] = 27; b[i + 2] = 27; }
  const r = diffRgba(a, b, 10, 10);
  assert.equal(r.differing, 10); assert.equal(r.pct, 10);
  assert.equal(diffRgba(a, b, 10, 10, { masks: [[0, 0, 5, 2]] }).differing, 0);
});

test("D196 F5 · anti-aliasing under the tolerance is not a difference; the gate is the owner's 2 %", () => {
  const a = img(4, 4, [100, 100, 100]), b = img(4, 4, [100 + TOLERANCE, 100, 100]);
  assert.equal(diffRgba(a, b, 4, 4).differing, 0);
  b[0] = 100 + TOLERANCE + 1;
  assert.equal(diffRgba(a, b, 4, 4).differing, 1);
  assert.equal(THRESHOLD_PCT, 2, "the threshold is never loosened to pass a page (D196 F5)");
  assert.ok(Object.keys(PAIRS).length >= 2);
});
