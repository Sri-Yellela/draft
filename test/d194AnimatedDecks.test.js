// ⭐ D194 (owner 11-14) · ANIMATED DECKS WITH NARRATION AND CAPTIONS — the row's ten tests, on the pure model
// (client/src/pages/atlas/deckPlay.js), the voice pick (narrationVoice.js) and the player's source. The real-Chrome walk is
// scripts/walkDeckPlay46z.mjs (both themes × 1440 / 400, reduced motion, the keyboard, a stubbed speechSynthesis).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";
import { MODES, SPEEDS, beatsOf, holdMs, revealAt, step, initialState, keyAction, pointOf, progressLine, READ_MS_PER_POINT } from "../client/src/pages/atlas/deckPlay.js";
import { pickVoice } from "../client/src/lib/narrationVoice.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const PLAY = read("client/src/pages/atlas/DeckPlay.jsx");
const PAGE = read("client/src/pages/atlas/LibraryGuides.jsx");
const CSS = read("client/src/pages/atlas/LibraryPanel.css");
const DECK = { id: "t", title: "T", slides: [
  { tag: "What it is", title: "One", points: ["a b c", { text: "TCP/IP", narration: "T-C-P-I-P, the protocol suite", animateAs: "typewriter" }] },
  { tag: "Core ideas", title: "Two", points: ["d", "e", "f"] },
  { tag: "Check yourself", title: "One question", points: ["Answer it, then read the why."] },
] };
const run = (s, ...as) => as.reduce((x, a) => step(x, a), s);

test("d194ThreeModesToggle: Watch · Read · Cards, one toggle; Cards is the static deck and stops playback", () => {
  assert.deepEqual(MODES, ["watch", "read", "cards"]);
  const s = initialState(DECK, { mode: "read" });
  assert.equal(s.playing, true);
  assert.equal(run(s, { type: "mode", mode: "cards" }).playing, false);
  assert.equal(run(s, { type: "mode", mode: "watch" }).mode, "watch");
  assert.equal(run(s, { type: "mode", mode: "nope" }).mode, "read");
  assert.match(PAGE, /data-deck-modes=""/);
  for (const m of ["Watch", "Read", "Cards"]) assert.match(PAGE, new RegExp(`"${m}"`));
});

test("d194PointsRevealOneAtATime: the title, then each point; the check is one beat and the player stops there", () => {
  const beats = beatsOf(DECK);
  assert.deepEqual(beats.map(b => [b.slide, b.point]), [[0, -1], [0, 0], [0, 1], [1, -1], [1, 0], [1, 1], [1, 2], [2, -1]]);
  assert.deepEqual(revealAt(beats, 0), { slide: 0, shown: 0 });
  assert.deepEqual(revealAt(beats, 2), { slide: 0, shown: 2 });
  assert.deepEqual(revealAt(beats, 4), { slide: 1, shown: 1 });
  let s = initialState(DECK, { mode: "read" });
  for (let i = 0; i < 10; i++) s = step(s, { type: "ended" });
  assert.equal(s.at, beats.length - 1);
  assert.equal(s.playing, false, "it waits on the check");
  assert.equal(beats.at(-1).check, true);
  assert.equal(step(s, { type: "play" }).at, 0, "Play at the check plays from the top");
});

test("d194ReduceMotionInstant: Reduce motion turns every reveal and animation off", () => {
  const rm = CSS.slice(at(CSS, "@media (prefers-reduced-motion: reduce) {\n  .lib-play__pt"));
  assert.match(rm, /transition: none !important; animation: none !important/);
  assert.match(CSS, /\.lib-play__pt \{ opacity: 0; transform: translateY\(10px\); transition: opacity 300ms ease, transform 300ms ease; \}/);
});

test("d194SpeechSyncsWithReveal: Watch unmuted speaks each beat with the browser's SpeechSynthesis and moves on its onend", () => {
  assert.match(PLAY, /new window\.SpeechSynthesisUtterance\(beat\.speech\)/);
  assert.match(PLAY, /u\.onend = done; u\.onerror = done;/);
  assert.match(PLAY, /const t = setTimeout\(done, holdMs\(beat, s\.speed\)\)/, "Read (or Watch muted) holds a timed beat");
  assert.doesNotMatch(PLAY + read("client/src/pages/atlas/deckPlay.js") + read("client/src/lib/narrationVoice.js"), /\bfetch\(|api\(|XMLHttpRequest|anthropic|openai/i, "no network, no model");
});

test("d194CaptionsAlwaysOn: every beat has a caption, shown in an aria-live bar in all playing modes", () => {
  for (const b of beatsOf(DECK)) assert.ok(b.caption.length > 0);
  assert.match(PLAY, /<p className="lib-play__cap" aria-live="polite" data-deck-caption="">\{beat\?\.caption\}<\/p>/);
  assert.equal(holdMs({ caption: "short" }, 1), READ_MS_PER_POINT, "≈ 2.5 s per point");
  assert.ok(holdMs({ caption: "word ".repeat(30) }, 1) > READ_MS_PER_POINT, "a long point is given time to be read");
});

test("d194SpeedChangesMidPlay: 0.75 / 1 / 1.25 / 1.5 — the rate and the hold follow it, playback continues", () => {
  assert.deepEqual(SPEEDS, [0.75, 1, 1.25, 1.5]);
  const s = run(initialState(DECK, { mode: "read" }), { type: "ended" }, { type: "speed", speed: 1.5 });
  assert.equal(s.speed, 1.5);
  assert.equal(s.playing, true);
  assert.equal(s.at, 1);
  assert.equal(holdMs({ caption: "x" }, 1.5), Math.round(READ_MS_PER_POINT / 1.5));
  assert.equal(step(s, { type: "speed", speed: 3 }).speed, 1.5, "an unknown speed is ignored");
  assert.match(PLAY, /u\.rate = s\.speed;/);
});

test("d194ExistingDecksPlayWithoutChanges: every approved deck makes beats with captions — no field added", async () => {
  const { approvedDecks } = await import("../services/learn/learnDecks.js");
  const decks = approvedDecks();
  assert.ok(decks.length > 100);
  for (const d of decks) {
    const beats = beatsOf(d);
    assert.ok(beats.length >= d.slides.length, d.id);
    assert.ok(beats.every(b => typeof b.caption === "string" && typeof b.speech === "string"), d.id);
    assert.equal(beats.at(-1).check, true, d.id);
  }
});

test("d194NeverAutoSound: Watch begins muted — the person turns the sound on", () => {
  assert.equal(initialState(DECK, { mode: "watch" }).muted, true);
  assert.equal(run(initialState(DECK, { mode: "watch" }), { type: "mode", mode: "read" }, { type: "mode", mode: "watch" }).muted, true);
  assert.equal(step(initialState(DECK, { mode: "watch" }), { type: "mute" }).muted, false);
  assert.match(PLAY, /const speaking = s\.mode === "watch" && !s\.muted && speechOk\(\);/);
});

test("d194KeyboardControls: space play / pause · ← → skip · 1–4 speed", () => {
  assert.deepEqual(keyAction(" "), { type: "toggle" });
  assert.deepEqual(keyAction("ArrowRight"), { type: "next" });
  assert.deepEqual(keyAction("ArrowLeft"), { type: "prev" });
  assert.deepEqual(["1", "2", "3", "4"].map(k => keyAction(k).speed), SPEEDS);
  assert.equal(keyAction("x"), null);
  const s = run(initialState(DECK, { mode: "read" }), { type: "next" }, { type: "next" }, { type: "prev" });
  assert.equal(s.at, 1);
  assert.equal(progressLine(s), "point 2 of 8");
  assert.match(PLAY, /onKeyDown=\{onKey\}/);
});

test("d194NarrationFieldOptional: a point may carry a speaker note (said instead of the text) and how it appears", () => {
  assert.deepEqual(pointOf("plain"), { text: "plain", narration: null, animateAs: "fadeIn" });
  assert.deepEqual(pointOf({ text: "TCP/IP", narration: "T-C-P-I-P", animateAs: "drawSvg" }), { text: "TCP/IP", narration: "T-C-P-I-P", animateAs: "drawSvg" });
  assert.equal(pointOf({ text: "x", animateAs: "spin" }).animateAs, "fadeIn");
  const b = beatsOf(DECK)[2];
  assert.equal(b.caption, "TCP/IP");
  assert.equal(b.speech, "T-C-P-I-P, the protocol suite");
  // the server keeps both fields (deckOf maps points through)
  assert.match(read("services/learn/learnDecks.js"), /points: s\.points \|\| \[\]/);
});

test("D194 (2): the narration voice is one of the system's own voices — the chosen one, else the language's default", () => {
  const vs = [{ name: "A", lang: "fr-FR", default: true }, { name: "B", lang: "en-GB" }, { name: "C", lang: "en-US", default: true }];
  assert.equal(pickVoice(vs, "B", "en-US").name, "B");
  assert.equal(pickVoice(vs, "gone", "en-US").name, "C");
  assert.equal(pickVoice(vs, "", "de").name, "A");
  assert.equal(pickVoice([], "", "en"), null);
});
