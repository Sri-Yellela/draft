// ⭐ D178-4 (owner's pick 11-07: Your run = Idea A's level dial + Idea B's month, quests, résumé reward, marks) ·
// d178StreakCountsProofOnly · d178RestDayKeepsStreak · d178MarksOnlyForWholes. Pure rules + the panel's wiring.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { streakRun, streakOf, bestStreak, monthOf, marksFrom } from "../services/atlas/points.js";
import { itemsToOpen, checkpointId, buildId, buildRequired } from "../shared/learnStepState.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const DAY = 86400, T = 20400;          // a Wednesday (UTC day 20400)
const now = T * DAY + 3600;
const days = (...ago) => new Set(ago.map(a => T - a));

test("d178StreakCountsProofOnly: only days with proof count; today still open does not break it", () => {
  assert.equal(streakOf(days(0, 1, 2), now), 3);
  assert.equal(streakOf(days(1, 2), now), 2, "nothing yet today: the streak still stands");
  assert.equal(streakOf(new Set(), now), 0);
  const src = read("services/atlas/points.js");
  assert.match(src, /const days = new Set\(rows\.map\(r => dayOf\(r\.at\)\)\);/, "the days are proof_points' days — proof, not visits");
  assert.equal(bestStreak(days(0, 1, 10, 11, 12, 13, 20)), 4, "the best streak is kept");
});

test("d178RestDayKeepsStreak: one day without proof a week is a rest day; a second in the same week ends it", () => {
  const r = streakRun(days(0, 1, 3, 4), T);
  assert.equal(r.count, 4); assert.deepEqual([...r.rest], [T - 2]);
  assert.equal(streakOf(days(0, 2, 4), now), 2, "two gaps in one week: the streak ends at the second");
  assert.equal(streakOf(days(0, 1, 4, 5), now), 2, "two days in a row without proof are not a rest day");
  const m = monthOf(days(0, 1, 3), now);
  assert.equal(m.length, 28);
  assert.deepEqual(m.slice(-4).map(d => [d.lit, d.rest, d.today]), [[true, false, false], [false, true, false], [true, false, false], [true, false, true]]);
});

test("d178MarksOnlyForWholes: a mark for a whole module, dated by its last proof — never for part of one", () => {
  const doc = JSON.parse(fs.readFileSync("content/learn/silicon-to-software.json", "utf8"));
  const ids = (part) => part.phases.flatMap(ph => ph.steps.flatMap(st => [...itemsToOpen(st).map(i => i.id), ...(st.c || []).map((_, i) => checkpointId(st.id, i)), ...(buildRequired(st) ? [buildId(st.id)] : [])]));
  const all = ids(doc.PARTS[5]);
  const half = Object.fromEntries(all.slice(0, Math.floor(all.length / 2)).map((id, i) => [id, 100 + i]));
  assert.deepEqual(marksFrom(doc, half).earned, [], "half a module earns nothing");
  const whole = Object.fromEntries(all.map((id, i) => [id, 100 + i]));
  assert.deepEqual(marksFrom(doc, whole).earned, [{ module: 6, title: "Languages and media", at: 100 + all.length - 1 }]);
  assert.ok(marksFrom(doc, half).next.some(n => n.module === 6 && n.pct > 0), "progress toward the next mark");
  const ui = read("client/src/pages/atlas/YourRun.jsx");
  assert.match(ui, /data-run-month=""/); assert.match(ui, /data-run-marks=""/); assert.match(ui, /data-run-proven=""/);
  assert.doesNotMatch(ui.replace(/\/\/[^\n]*|\{\/\*[\s\S]*?\*\/\}/g, ""), /🔥|flame|streak repair|shop|coins/i, "no flames, no shop, no currency (D178)");
});
