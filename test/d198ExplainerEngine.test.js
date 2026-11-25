// ⭐ D198 E1 · THE EXPLAINER ENGINE — the clock (client/src/plate/explainer/explainerModel.js) and the frame it draws
// (Explainer.jsx, rendered to static markup in node — no browser). What this proves: the slash turns one step a beat and
// holds still under Reduce motion; a beat's length is its audio's when E3 has measured it (captions spread across it);
// the frame at a time is the same every time (E4's export depends on it); the plate's columns light, dim and all-light
// as the beats go; the market line is never invented. What it cannot: pixels — F5's ≤ 2 % per beat against canvas v4
// (`d198VisualDiffExplainer`) needs Chrome (47g: blocked on memory).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { slashFor, timeline, frameAt, lengthMs, speakMs, captionWords, progressSquares, columnStates, marketLine, PAUSE_MS, WORDS_PER_SECOND }
  from "../client/src/plate/explainer/explainerModel.js";
import { loadPlate } from "../test-support/renderPlate.mjs";

const pilot = () => JSON.parse(fs.readFileSync("content/explainers/big-o-acted-out/script.json", "utf8"));

test("d198SlashTurnsPerBeat: / | \\ | / — one step a beat, and the frame carries it", () => {
  const s = pilot();
  assert.deepEqual(s.beats.map((_, i) => slashFor(i)), ["/", "|", "\\", "|", "/", "|", "\\", "|", "/", "|"]);
  const tl = timeline(s);
  assert.deepEqual(tl.map((r) => frameAt(s, r.start + 1).slash), s.beats.map((_, i) => slashFor(i)));
});

test("d198ReducedMotionStill: under Reduce motion the slash holds '/' and a line shows whole at once", async () => {
  const s = pilot();
  const tl = timeline(s);
  for (const r of tl) {
    const f = frameAt(s, r.start + 1, { reduce: true });
    assert.equal(f.slash, "/");
    assert.equal(f.w, f.n, `beat ${r.i + 1}: the whole line`);
  }
  const RM = await loadPlate({ reducedMotion: true });
  const html = RM.render(RM.LIB.Explainer, { script: s, at: tl[2].start + 1 });
  assert.match(html, /data-reduce="yes"/);
  assert.match(html, /class="pl-xp__slash">\/</);
  assert.ok(!/data-s="waiting"/.test(html), "no word waits under Reduce motion");
});

test("d198BeatTimedToAudio: a measured beat lasts its audio + the hold; words spread evenly across the audio", () => {
  const s = pilot();
  const before = lengthMs(s);
  assert.equal(speakMs(s.beats[0]), Math.round((10 / WORDS_PER_SECOND) * 1000), "10 words at the voice's pace");
  s.beats[0].audioMs = 5000;                                     // E3 measured beat 01 at 5.0 s
  const tl = timeline(s);
  assert.equal(tl[0].end, 5000 + PAUSE_MS);
  assert.equal(tl[1].start, tl[0].end, "the next beat starts after the hold");
  assert.equal(lengthMs(s), before - 4000 + 5000);
  const n = 10;
  assert.equal(frameAt(s, 0).w, 0);
  assert.equal(frameAt(s, 5000 / n * 3 + 1).w, 3, "three of ten words after 3/10 of the audio");
  assert.equal(frameAt(s, 5000).w, n, "every word by the audio's end");
  assert.equal(frameAt(s, 5000 + PAUSE_MS - 1).i, 0, "still beat 01 during the hold");
  s.beats[0].holdMs = 8000;
  assert.equal(timeline(s)[0].end, 8000, "holdMs sets the whole beat");
});

test("d198ExportMatchesApp (the clock half): the frame at a time is the same every time, and ends done", () => {
  const s = pilot();
  const total = lengthMs(s);
  for (let ms = 0; ms <= total; ms += 733) assert.deepEqual(frameAt(s, ms), frameAt(s, ms));
  assert.equal(frameAt(s, total).done, true);
  assert.equal(frameAt(s, total - 1).done, false);
  assert.ok(total / 1000 > 45 && total / 1000 < 75, `≈ 58 s, ${total / 1000} s`);
});

test("d198 the plate panel: a beat lights its column, the finished ones dim, the saved card shows all; nothing before Access", () => {
  const s = pilot();
  assert.deepEqual(columnStates(s, 0), { access: "hidden", search: "hidden", insert: "hidden", delete: "hidden" });
  assert.deepEqual(columnStates(s, 2), { access: "lit", search: "hidden", insert: "hidden", delete: "hidden" });
  assert.deepEqual(columnStates(s, 4), { access: "dim", search: "dim", insert: "lit", delete: "hidden" });
  // 47h (canvas v4, beat by beat): the proof searches the TREE, not the column — Delete stays lit through it and after
  assert.deepEqual(columnStates(s, 6), { access: "dim", search: "dim", insert: "dim", delete: "lit" });
  assert.deepEqual(columnStates(s, 7), { access: "dim", search: "dim", insert: "dim", delete: "lit" });
  assert.deepEqual(columnStates(s, 9), { access: "all", search: "all", insert: "all", delete: "all" });
  assert.deepEqual(progressSquares(3, 10), ["ink", "ink", "ink", "today", "ahead", "ahead", "ahead", "ahead", "ahead", "ahead"]);
  const words = captionWords(s.beats[1].say, s.beats[1].keyword, 11);
  assert.deepEqual(words.filter((x) => x.key).map((x) => x.t), ["Close,"]);
});

test("d198 the frame: the question line, captions, ten squares, the overlays — and the market line only with a real count", async () => {
  const P = await loadPlate();
  const s = pilot();
  const tl = timeline(s);
  const at = (i) => tl[i].start + Math.floor(tl[i].speak / 2);
  const usual = P.render(P.LIB.Explainer, { script: s, at: at(1) });
  assert.match(usual, /THE USUAL ANSWER/); assert.match(usual, /CLOSE, NOT ENOUGH/);
  assert.match(usual, /data-s="spoken"/); assert.match(usual, /data-s="waiting"/);
  assert.equal((usual.match(/class="pl-sq pl-sq--run"/g) || []).length, 10);
  const runs = P.render(P.LIB.Explainer, { script: s, at: at(7), openings: 412 });
  assert.match(runs, /<b>412 openings this week<\/b> ask for Redis/);
  const noCount = P.render(P.LIB.Explainer, { script: s, at: at(7) });
  assert.ok(!/openings this week/.test(noCount) && !/\[N\]/.test(noCount), "no count → no line, never a guess");
  assert.equal(marketLine(s, null), null);
  const turn = P.render(P.LIB.Explainer, { script: s, at: at(8) });
  assert.match(turn, /Millions of lookups a day, by email address/);
  assert.equal((turn.match(/class="pl-xp__opt"/g) || []).length, 4);
  const access = P.render(P.LIB.Explainer, { script: s, at: at(2) });
  assert.match(access, /class="pl-xp__cost" data-col="lit"><span class="pl-xp__big" data-level="light">O\(1\)/);
  assert.match(access, /aria-label="Beat 3 of 10: Access"/);
});
