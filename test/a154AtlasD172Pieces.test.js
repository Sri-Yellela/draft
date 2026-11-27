// ⭐ A154 (45o) · the D172 pieces that do not wait on the league question: How it works (each idea as one flow, from the
// decks' own Core ideas slide), Your run's three quests (the daily question · one deck · prove it), and the map's stop cards
// (icon tile + skill + one line) with the You pill's years. ⏸ League / Challenges / pod rank / live count wait on the owner.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { flowOf, howItWorks } from "../services/learn/learnDecks.js";
import { ATLAS_NAV } from "../client/src/pages/atlas/atlasPanels.js";
import { questHref } from "../client/src/pages/atlas/yourRunModel.js";

test("A154 · How it works: a flow only where the deck's Core ideas slide names its parts — never invented", () => {
  const deck = (title) => ({ slides: [{ tag: "What it is", title: "x" }, { tag: "Core ideas", title }] });
  assert.deepEqual(flowOf(deck("Stack, heap, process, thread")), ["Stack", "heap", "process", "thread"]);
  assert.deepEqual(flowOf(deck("Producer → topic → consumer group → offsets")), ["Producer", "topic", "consumer group", "offsets"]);
  assert.equal(flowOf(deck("Why it matters")), null, "one part is not a flow");
  assert.equal(flowOf({ slides: [{ tag: "What it is", title: "A, B" }] }), null, "no Core ideas slide, no flow");
  const ideas = howItWorks();
  assert.ok(ideas.length > 0 && ideas.every((d) => d.flow.length >= 2 && d.id && d.title), "every approved deck shown has a real flow");
  assert.ok(ATLAS_NAV.find((g) => g.group === "Grow").panels.some((p) => p.id === "how-it-works"));
  assert.match(fs.readFileSync("routes/learn.js", "utf8"), /router\.get\("\/how-it-works"/);
});

test("A154 · Your run's three quests — the daily question and a deck earn no points (points only from proof)", () => {
  const pts = fs.readFileSync("services/atlas/points.js", "utf8");
  assert.match(pts, /quests\.push\(\{ id: "today", title: "Today's question", detail: "About two minutes — answering lights today\.", points: null/);
  assert.match(pts, /quests\.push\(\{ id: "deck", title: "Read one deck", detail: deck\.title, deckId: deck\.id, points: null/);
  assert.equal(questHref("/app/atlas", { id: "today" }), "/app/atlas/todays-question");
  assert.equal(questHref("/app/atlas", { id: "deck", deckId: "sw-f-01" }), "/app/atlas/library/sw-f-01");
  assert.match((fs.readFileSync("client/src/pages/atlas/Logbook.jsx", "utf8")).replace(/\r\n/g, "\n") /* 47m: YourRun.jsx deleted — its home now */, /q\.points != null \? `\+\$\{q\.points\} points` : `about \$\{q\.minutes\} min`/);
});

test("A154 · the map's stop cards say proven / next · N decks, 1 lesson; the You pill has the years", () => {
  const src = fs.readFileSync("client/src/pages/atlas/TrackBoard.jsx", "utf8");
  const start = src.indexOf("export function stopLine("), end = src.indexOf("\nconst CARD", start);
  const stopLine = new Function(`${src.slice(start, end).replace("export function", "function")}; return stopLine;`)();
  assert.equal(stopLine({ state: "done", decks: 3 }), "proven");
  assert.equal(stopLine({ state: "next", decks: 2, learn: { stepId: "s1" } }), "next · 2 decks, 1 lesson");
  assert.equal(stopLine({ state: "next", decks: 0 }), "next");
  assert.equal(stopLine({ state: "ahead", decks: 1 }), "1 deck");
  assert.match(src, /data-stop-card=\{s\.slug\}/);
  assert.match(src, /data-track-years=\{route\.youYears\}/);
  const nav = fs.readFileSync("services/navigator.js", "utf8");
  assert.match(nav, /return \{ slug: s, name, done: route\.covered\.includes\(s\), learn: sk\?\.learn \|\| null, decks: decksFor\(s, name\) \};/);
});
