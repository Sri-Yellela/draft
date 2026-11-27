// ⭐ 47k · THE REGION RAMPS — every region in docs/design/plate-system.md has its 10-step ramp as tokens in
// client/src/styles/plate.css, built by scripts/plateRamps.mjs. III and IV were built before the method was written down
// (IV from the report, III by hand around canvas v4's four steps), so they are held to it within a just-noticeable step;
// the six built from it (I, II, V–VIII) are held to it exactly. Text on a ramp follows the report's rule (≥ 4.5 : 1):
// ink on steps 0–5, paper on steps 7–9; step 6 is a mid-tone and carries no text.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { REGION_COLOURS, buildRamp, baseStep, contrast, deltaOk } from "../scripts/plateRamps.mjs";

const css = fs.readFileSync("client/src/styles/plate.css", "utf8");
const doc = fs.readFileSync("docs/design/plate-system.md", "utf8").replace(/\r\n/g, "\n");
const INK = "#1B1B1B", PAPER = "#F4EFE9";
const ROMANS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

function tokenRamp(roman) {
  const name = roman.toLowerCase();
  return Array.from({ length: 10 }, (_, i) => {
    const m = css.match(new RegExp(`--pl-${name}-${i}:\\s*(#[0-9A-Fa-f]{6});`));
    return m ? m[1].toUpperCase() : null;
  });
}

test("plateRamps47k: the region colours are the report's table and the tokens' --pl-rN", () => {
  for (const [i, roman] of ROMANS.entries()) {
    const hex = REGION_COLOURS[roman];
    assert.match(doc, new RegExp(`\\| ${roman} \\| [^|]+ \\| ${hex} \\|`), `${roman}'s colour in the report's table`);
    assert.match(css, new RegExp(`--pl-r${i + 1}: ${hex};`), `--pl-r${i + 1} is ${hex}`);
  }
});

test("plateRamps47k: every region has ten ramp tokens, light → deep, with its own colour on the ramp", () => {
  for (const roman of ROMANS) {
    const ramp = tokenRamp(roman);
    assert.ok(ramp.every(Boolean), `--pl-${roman.toLowerCase()}-0…9 all defined: ${ramp}`);
    assert.equal(ramp[baseStep(REGION_COLOURS[roman])], REGION_COLOURS[roman], `${roman}'s colour sits at step ${baseStep(REGION_COLOURS[roman])}`);
    const lum = h => contrast(h, "#000000");
    for (let i = 1; i < 10; i++) assert.ok(lum(ramp[i]) < lum(ramp[i - 1]), `${roman} step ${i} is deeper than ${i - 1}`);
  }
});

test("plateRamps47k: the method reproduces III and IV within a just-noticeable step; the others are its output exactly", () => {
  for (const roman of ["III", "IV"]) {
    const built = buildRamp(REGION_COLOURS[roman]), tokens = tokenRamp(roman);
    for (let i = 0; i < 10; i++) assert.ok(deltaOk(built[i], tokens[i]) < 2, `${roman}-${i}: ${built[i]} vs ${tokens[i]} (ΔOK ${deltaOk(built[i], tokens[i]).toFixed(2)})`);
  }
  // III's four canvas-v4 steps stay exactly as the canvas has them (the explainer's cost scale).
  assert.deepEqual([1, 3, 6, 7].map(i => tokenRamp("III")[i]), ["#F5E2D6", "#E6BA9F", "#B4532A", "#8F4122"]);
  for (const roman of ["I", "II", "V", "VI", "VII", "VIII"]) assert.deepEqual(tokenRamp(roman), buildRamp(REGION_COLOURS[roman]), roman);
});

test("plateRamps47k: ink reads on steps 0–5 and paper on steps 7–9 of every ramp (≥ 4.5 : 1)", () => {
  for (const roman of ROMANS) {
    const ramp = tokenRamp(roman);
    for (let i = 0; i <= 5; i++) assert.ok(contrast(INK, ramp[i]) >= 4.5, `ink on ${roman}-${i} ${ramp[i]}: ${contrast(INK, ramp[i]).toFixed(2)}`);
    for (let i = 7; i <= 9; i++) assert.ok(contrast(PAPER, ramp[i]) >= 4.5, `paper on ${roman}-${i} ${ramp[i]}: ${contrast(PAPER, ramp[i]).toFixed(2)}`);
  }
});

test("plateRamps47k: the design doc lists every region's ramp as the tokens have it", () => {
  for (const roman of ROMANS) {
    const line = tokenRamp(roman).join(" → ");
    assert.ok(doc.includes(line), `docs/design/plate-system.md lists ${roman}'s ramp: ${line}`);
  }
});
