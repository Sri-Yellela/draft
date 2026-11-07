// ⭐ D178-2 (owner 11-07, two production screenshots) · d178CircleLabelsNeverCropped · d178CountsReadClaims — the circle's
// part labels fit inside the drawing; a family's count reads the person's claims and proofs (the same names Your skills
// reads), never a flat "you have 0 of N" when there are claims; reading Your map never writes the Profile.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { GEO, LABEL, circleViewBox, partLabelLines, circleLayout } from "../client/src/pages/atlas/learnModel.js";
import { familyCountLine } from "../shared/atlasFamilyCount.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const seed = JSON.parse(fs.readFileSync("content/learn/silicon-to-software.json", "utf8"));

test("d178CircleLabelsNeverCropped: every part label, wrapped, fits inside the viewBox", () => {
  const [vx, vy, vw, vh] = circleViewBox().split(" ").map(Number);
  // The pieces in path order, as the circle lays them out (one per step).
  const pieces = seed.PARTS.flatMap((p, pi) => p.phases.flatMap(ph => ph.steps.map(s => ({ id: s.id, partIndex: pi + 1, part: p.t }))));
  const layout = circleLayout(pieces);
  assert.equal(layout.parts.length, 8);
  for (const part of layout.parts) {
    const am = (part.a0 + part.a1) / 2, lr = GEO.r + 40;
    const x = GEO.c + lr * Math.cos(am), y = GEO.c + lr * Math.sin(am);
    const anchor = Math.abs(Math.cos(am)) < 0.3 ? "middle" : Math.cos(am) > 0 ? "start" : "end";
    const lines = partLabelLines(part.index, part.t);
    assert.ok(lines.every(l => l.length <= LABEL.chars || !l.includes(" ")), `${part.t}: wrapped to ${LABEL.chars} a line`);
    const w = Math.max(...lines.map(l => l.length)) * LABEL.charW;
    const [x0, x1] = anchor === "start" ? [x, x + w] : anchor === "end" ? [x - w, x] : [x - w / 2, x + w / 2];
    assert.ok(x0 >= vx && x1 <= vx + vw, `"${lines.join(" / ")}" spans ${Math.round(x0)}…${Math.round(x1)} inside ${vx}…${vx + vw}`);
    assert.ok(y - lines.length * LABEL.lineH >= vy && y + lines.length * LABEL.lineH <= vy + vh, `${part.t}: inside vertically`);
  }
  assert.deepEqual(partLabelLines(7, "Part 7: Computing in the physical world"), ["7 · COMPUTING IN", "THE PHYSICAL WORLD"], "the part's own 'Part n:' is not repeated");
  assert.match(read("client/src/pages/atlas/LearnCircle.jsx"), /<svg className="lrc__svg" viewBox=\{circleViewBox\(\)\}/);
});

test("d178CountsReadClaims: the family sentence — proven, claimed, learned; never 'you have 0 of N'", () => {
  assert.equal(familyCountLine({ provenCount: 2, claimedCount: 3, total: 8 }), "2 proven · 3 claimed · of 8");
  assert.equal(familyCountLine({ claimedCount: 1, learnedCount: 1, total: 4 }), "1 claimed · 1 learned · of 4");
  assert.equal(familyCountLine({ total: 8 }), "none yet · of 8");
  // One sentence, two readers (the tree's tag and the family list) — and both read the claims Your skills reads.
  assert.match(read("services/atlas/atlasTree.js"), /tag: `\$\{f\.name\.toUpperCase\(\)\} · \$\{familyCountLine\(/);
  assert.match(read("client/src/pages/atlas/YourMap.jsx"), /familyCountLine\(\{ provenCount: f\.provenCount/);
  assert.doesNotMatch(read("client/src/pages/atlas/YourMap.jsx"), /you have \{/);
  const me = read("services/atlas/atlasMe.js");
  assert.match(me, /for \(const s of safeRead\(\(\) => yourSkillStates\(db, userId\), \[\]\)\)/, "Your map reads Your skills' names and states");
  const ys = read("services/yourSkills.js");
  assert.match(ys, /skillNames\(db, userId, \{ seed: false \}\)/, "reading Your map never seeds (writes) the Profile");
});

test("d178CircleLabelsNeverCropped: the wheel — round the ring only when wide enough, else a legend under it; the ring laid out above it", async () => {
  const { labelsAsLegend, ringHeight, LEGEND_BELOW_W, LEGEND_SPACE, outScale, WHEEL } = await import("../client/src/pages/atlas/learnWheel.js");
  assert.equal(labelsAsLegend(LEGEND_BELOW_W - 1), true);
  assert.equal(labelsAsLegend(LEGEND_BELOW_W + 200), false);
  for (const [W, H] of [[358, 709], [354, 840], [900, 840]]) {
    const Hr = ringHeight(W, H), rOuter = (WHEEL.R + WHEEL.CH) * outScale(W, Hr);
    if (labelsAsLegend(W)) assert.ok(Hr / 2 + rOuter <= H - LEGEND_SPACE + 1, `${W}×${H}: the ring ends above the legend's room`);
    else assert.equal(Hr, H);
  }
  const ui = read("client/src/pages/atlas/LearnWheel.jsx");
  assert.match(ui, /const lines = partLabelLines\(part\.index, part\.t\);/);
  assert.match(ui, /className=\{`lwh__labels\$\{labelsAsLegend\(W\) \? " lwh__labels--legend" : ""\}`\}/);
  assert.doesNotMatch(ui, /\{part\.index\} · \{String\(part\.t\)\.toUpperCase\(\)\}/, "the old one-line, cropped label is gone");
});
