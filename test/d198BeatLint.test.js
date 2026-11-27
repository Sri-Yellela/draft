// ⭐ D198 E2 (owner 11-24) · THE EXPLAINER'S SCRIPT FORMAT — the lint (services/learn/explainerScript.js) on a
// constructed script and on every content/explainers/<id>/script.json. Format A is the approved one (canvas v4);
// B–D are refused until they are sketched and approved (E6).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { scriptProblems, beatProblems, keywordInLine, estimatedSeconds, wordsOf, MAX_WORDS, BEATS_FORMAT_A, COST_COLOURS, EXPLAINER_RAMPS }
  from "../services/learn/explainerScript.js";

const DIR = "content/explainers";
const scripts = fs.existsSync(DIR)
  ? fs.readdirSync(DIR).filter(d => fs.existsSync(path.join(DIR, d, "script.json")))
      .map(d => ({ dir: d, script: JSON.parse(fs.readFileSync(path.join(DIR, d, "script.json"), "utf8")) }))
  : [];
const pilot = () => JSON.parse(JSON.stringify(scripts.find(s => s.dir === "big-o-acted-out").script));

test("d198BeatLint: every committed script passes, its folder named by its id — the pilot is there", () => {
  assert.ok(scripts.some(s => s.dir === "big-o-acted-out"), "the pilot script (E5) is committed");
  for (const { dir, script } of scripts) {
    assert.equal(script.id, dir, `${dir}: id matches its folder`);
    assert.deepEqual(scriptProblems(script), [], dir);
  }
});

test("d198BeatLint: a beat over 14 words fails; a missing or absent keyword fails", () => {
  const s = pilot();
  s.beats[0].say = "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen";
  assert.ok(wordsOf(s.beats[0].say).length > MAX_WORDS);
  assert.ok(beatProblems(s.beats[0], 0, s).some(p => /15 words/.test(p)));
  const k = pilot(); delete k.beats[2].keyword;
  assert.ok(scriptProblems(k).some(p => /beat 03 .*no keyword/.test(p)));
  const off = pilot(); off.beats[2].keyword = "teleports";
  assert.ok(scriptProblems(off).some(p => /"teleports" is not a word of the line/.test(p)));
  // The sketch's own keys match by a word's start, punctuation aside ("Close," / "Your").
  assert.ok(keywordInLine("Close, not enough.", "Close,") && keywordInLine("Your turn: pick.", "Your"));
});

test("d198BeatLint: a cost without a reason fails — on a beat and in the plate; the reason is one word", () => {
  const s = pilot(); delete s.beats[2].cost[0].reason;
  assert.ok(scriptProblems(s).some(p => /beat 03 .*cost 1: a cost without a reason/.test(p)));
  const t = pilot(); t.plate.rows[0].cells.search.reason = "";
  assert.ok(scriptProblems(t).some(p => /plate array\.search: a cost without a reason/.test(p)));
  const two = pilot(); two.beats[3].cost[1].reason = "goes straight";
  assert.ok(scriptProblems(two).some(p => /one word/.test(p)));
  const lvl = pilot(); lvl.beats[3].cost[1].level = "green";
  assert.ok(scriptProblems(lvl).some(p => /light \/ mid \/ deep/.test(p)));
  const ghost = pilot(); ghost.beats[3].cost[1].on = "trie";
  assert.ok(scriptProblems(ghost).some(p => /no such row/.test(p)));
});

test("d198BeatLint: an overlay without its fields fails; an unknown overlay fails", () => {
  const s = pilot(); delete s.beats[1].overlay.stamp;
  assert.ok(scriptProblems(s).some(p => /usualAnswer overlay has no stamp/.test(p)));
  const w = pilot(); w.beats[7].overlay.line = " ";
  assert.ok(scriptProblems(w).some(p => /whereItRuns overlay has no line/.test(p)));
  const y = pilot(); delete y.check;
  assert.ok(scriptProblems(y).some(p => /yourTurn overlay needs the script's check/.test(p)));
  const u = pilot(); u.beats[1].overlay.kind = "confetti";
  assert.ok(scriptProblems(u).some(p => /overlay kind must be one of/.test(p)));
});

test("d198BeatLint: formats B–D are refused until sketched; a region without a built ramp is refused; format A is ten beats", () => {
  for (const f of ["B", "C", "D"]) {
    const s = pilot(); s.format = f;
    assert.ok(scriptProblems(s).some(p => /not built yet/.test(p)), f);
  }
  const r = pilot(); r.region = "IV";
  assert.ok(scriptProblems(r).some(p => /no ramp built yet/.test(p)));
  const n = pilot(); n.beats.pop();
  assert.ok(scriptProblems(n).some(p => new RegExp(`format A has ${BEATS_FORMAT_A} beats`).test(p)));
  // The cost scale is Region III's ramp, three steps of it.
  assert.deepEqual(Object.values(COST_COLOURS.III).map(c => EXPLAINER_RAMPS.III.includes(c)), [true, true, true]);
});

test("d198BeatLint: publishing needs factChecked; nothing may name reels_output; the pilot runs ≈ 58 s at the voice's pace", () => {
  const s = pilot(); s.factChecked = false;
  assert.ok(scriptProblems(s, { publish: true }).some(p => /not fact-checked/.test(p)));
  s.factChecked = true;
  assert.deepEqual(scriptProblems(s, { publish: true }), []);
  const leak = pilot(); leak.sources = ["reels_output/some_reel/frame-01.png"];
  assert.ok(scriptProblems(leak).some(p => /reels_output/.test(p)));
  const secs = estimatedSeconds(pilot());
  assert.ok(secs >= 45 && secs <= 75, `≈ 58 s in the storyboard, estimated ${secs} s`);
});
