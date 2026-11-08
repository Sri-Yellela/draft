// ⭐ D172 (2b) (atlas-redesign-sketch.html → Library → the level ladder) · d172GuidesFromApprovedDecks · d172SoonNeverClickableAsAvailable —
// the approved decks are the Level 1 guide; a level with none is "not written yet" and never clickable; a deck's check is
// the bank question, served only when live; a check answer earns no points.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { guides, deckOf, approvedDecks, LADDER, _resetDecks } from "../services/learn/learnDecks.js";
import { LEVELS } from "../services/atlas/points.js";
import { slideLabel } from "../client/src/pages/atlas/libraryModel.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("d172GuidesFromApprovedDecks: decks-v1 (approved 11-07) is the Level 1 guide, Foundations; the ladder matches Your run's levels", () => {
  _resetDecks();
  const g = guides();
  assert.deepEqual(g.map(x => [x.level, x.name, x.written]), [[1, "Foundations", true], [2, "Building blocks", true], [3, "Grow past senior", false], [4, "Lead", false]]);
  // ⭐ D155 (11-08, changed on purpose): decks-v2 approved — Building blocks is written; the ladder reads software decks only.
  assert.equal(g[1].lessons.length, 8);
  assert.deepEqual(g[0].lessons.map(l => l.title).slice(0, 4), ["How a program runs", "Data structures", "Algorithms and complexity", "Git"]);
  assert.equal(g[0].lessons.length, 8);
  assert.deepEqual(LADDER.map(l => l.name), LEVELS.map(l => l.name), "one ladder: the guides' levels are Your run's levels");
});

test("d172GuidesFromApprovedDecks: only APPROVED decks count — a draft file shows nothing", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d172-decks-"));
  try {
    fs.writeFileSync(path.join(dir, "decks-v9.json"), JSON.stringify({ decks: [{ id: "x-1", stage: "foundations", title: "Draft deck", status: "draft", slides: [] }] }));
    _resetDecks();
    assert.deepEqual(approvedDecks(dir), []);
    assert.equal(guides({ dir })[0].written, false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); _resetDecks(); }
});

test("d172GuidesFromApprovedDecks: a deck — five slides, its check the LIVE bank question, else waiting for review", () => {
  _resetDecks();
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE learn_questions (id TEXT PRIMARY KEY, role TEXT, level TEXT, type TEXT, skills_json TEXT, pieces_json TEXT, families_json TEXT,
    stem TEXT, choices_json TEXT, correct INTEGER, why_json TEXT, source TEXT, status TEXT, version INTEGER, reviewed_by TEXT, reviewed_at INTEGER)`);
  const d0 = deckOf(db, "sw-f-01");
  assert.equal(d0.slides.length, 5);
  assert.deepEqual(d0.check, { waiting: true }, "its question is not live yet");
  db.prepare(`INSERT INTO learn_questions VALUES ('sw-f-01-q1','Software Engineer','entry','scenario','[]','[]','[]','Why?','["a","b"]',1,'["no","yes"]','x','live',1,null,null)`).run();
  const d1 = deckOf(db, "sw-f-01");
  assert.deepEqual(d1.check.question, { id: "sw-f-01-q1", role: "Software Engineer", level: "entry", type: "scenario", skills: [], stem: "Why?", choices: ["a", "b"] }, "served WITHOUT its answer");
  assert.equal(deckOf(db, "nope"), null);
  assert.equal(slideLabel(0, 5, "What it is"), "1 of 5 · What it is");
});

test("d172SoonNeverClickableAsAvailable: a level with no decks is not a link; the routes are public and classified; no points", () => {
  const ui = read("client/src/pages/atlas/LibraryGuides.jsx");
  assert.match(ui, /\{g\.written \? \(\n\s*<Link to=\{`\$\{base\}\/library\/\$\{g\.id\}`\}/);
  assert.match(ui, /<div className="lib-rung__link lib-rung__link--none" aria-disabled="true">[\s\S]{0,200}Not written yet/);
  const route = read("routes/learn.js");
  assert.match(route, /router\.post\("\/deck\/:id\/answer"[\s\S]{0,400}surface: "deck"/);
  const from = at(route, 'router.post("/deck/:id/answer"');
  assert.doesNotMatch(route.slice(from, at(route, "// ⭐ D117 · the circle's overlay", from)), /proof_points|syncPoints/, "a check answer earns no points");
  assert.match(read("content/decks/decks-v1.json"), /"status": "approved"/);
});
