// D198 E3 · scripts/d198Voice.mjs's pure parts: the lengths land on the right beats, script.json keeps its formatting,
// a re-run replaces (never stacks) audioMs, and the lint + the engine read the result.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { withAudioMs, speechText } from "../scripts/d198Voice.mjs";
import { scriptProblems, estimatedSeconds } from "../services/learn/explainerScript.js";
import { speakMs } from "../client/src/plate/explainer/explainerModel.js";

const TEXT = fs.readFileSync("content/explainers/big-o-acted-out/script.json", "utf8");
const SCRIPT = JSON.parse(TEXT);

test("d198Voice: each beat's measured length lands on that beat, and nothing else in script.json changes", () => {
  const lengths = SCRIPT.beats.map((_, i) => 3000 + i * 111);
  const out = withAudioMs(TEXT, SCRIPT, lengths);
  const j = JSON.parse(out);
  j.beats.forEach((b, i) => assert.equal(b.audioMs, lengths[i], `beat ${i + 1}`));
  j.beats.forEach((b) => delete b.audioMs);
  assert.deepEqual(j, SCRIPT, "only audioMs was added");
  assert.equal(out.split("\n").length, TEXT.split("\n").length, "the file's own line layout is kept");
});

test("d198Voice: a second render replaces audioMs instead of adding a second one", () => {
  const once = withAudioMs(TEXT, SCRIPT, SCRIPT.beats.map(() => 4000));
  const twice = withAudioMs(once, SCRIPT, SCRIPT.beats.map(() => 4500));
  assert.equal((twice.match(/"audioMs"/g) || []).length, SCRIPT.beats.length);
  JSON.parse(twice).beats.forEach((b) => assert.equal(b.audioMs, 4500));
});

test("d198Voice: the lint accepts measured lengths, refuses a bad one, and the engine + estimate use them", () => {
  const j = JSON.parse(withAudioMs(TEXT, SCRIPT, SCRIPT.beats.map(() => 4000)));
  assert.ok(!scriptProblems(j).some((m) => /audioMs/.test(m)));
  assert.equal(speakMs(j.beats[0]), 4000);
  assert.equal(estimatedSeconds(j), Math.round(j.beats.reduce((t, b) => t + (b.holdMs ?? 4000 + 900), 0) / 100) / 10);
  j.beats[0].audioMs = -1;
  assert.ok(scriptProblems(j).some((m) => /audioMs must be a positive number/.test(m)));
});

test("d198Voice: Piper reads straight quotes", () => {
  assert.equal(speechText("Most people say an array, because it’s indexed."), "Most people say an array, because it's indexed.");
});
