// ⭐ D155 (11-08) · d155DeckQuestionsIntoBank — every deck batch's check questions enter the bank through its own importer;
// an owner-approved batch's untouched questions go live (reviewed by the owner); an edited one stays on the desk.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { importDeckQuestions, deckOf } from "../services/learn/learnDecks.js";
import { reviewQuestion } from "../services/learn/learnQuestions.js";

const fresh = () => { const db = new Database(":memory:"); for (const m of MIGRATIONS) db.exec(m.sql); return db; };

test("d155DeckQuestionsIntoBank: the real batches — 209 (decks-v1's 1 + v2–v24's 192 + v25's 2, approved 11-23 + v26's 14, approved 11-24), all valid, all live (every batch approved)", () => {
  const db = fresh();
  const r = importDeckQuestions(db);
  assert.ok(r.every(x => !x.error && !x.refused.length), JSON.stringify(r.filter(x => x.error || x.refused?.length)).slice(0, 300));
  const n = db.prepare("SELECT COUNT(*) FROM learn_questions WHERE imported_from LIKE 'content/decks/%'").pluck().get();
  const live = db.prepare("SELECT COUNT(*) FROM learn_questions WHERE imported_from LIKE 'content/decks/%' AND status = 'live'").pluck().get();
  assert.equal(n, 209); assert.equal(live, 209);
  assert.match(db.prepare("SELECT reviewed_by FROM learn_questions WHERE id = 'sw-b-01-q1'").pluck().get(), /^owner \(decks-v2 review\)$/);
  // a deck now serves its check (the question, without its answer)
  const d = deckOf(db, "sw-b-01");
  assert.equal(d.check.question.id, "sw-b-01-q1");
  assert.ok(!("correct" in d.check.question) && !("why" in d.check.question));
  // idempotent: a second boot changes nothing
  const again = importDeckQuestions(db);
  assert.ok(again.every(x => !x.added.length && !x.changed.length && !x.live));
});

test("d155DeckQuestionsIntoBank: an unapproved batch stays draft; an edited question is never flipped back to live", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d155q-"));
  try {
    const q = (id) => ({ id, type: "scenario", role: "Software Engineer", level: "mid", skills: [], pieces: [], stem: "Which is the safe choice here?", choices: ["a", "b"], correct: 1, why: ["no", "yes"], source: "drafted-for-review", status: "draft" });
    fs.writeFileSync(path.join(dir, "decks-v90.json"), JSON.stringify({ version: 90, decks: [], newQuestions: [q("x-90-q1")] }));
    fs.writeFileSync(path.join(dir, "decks-v91.json"), JSON.stringify({ version: 91, decks: [], newQuestions: [q("x-91-q1")] }));
    fs.writeFileSync(path.join(dir, "approvals.json"), JSON.stringify({ approved: { "91": { by: "owner", at: "2026-11-08", words: "ok" } } }));
    const db = fresh();
    importDeckQuestions(db, { dir });
    const st = (id) => db.prepare("SELECT status FROM learn_questions WHERE id = ?").pluck().get(id);
    assert.equal(st("x-90-q1"), "draft", "not approved → the desk");
    assert.equal(st("x-91-q1"), "live", "approved → live");
    // an edit sends it back to draft (version 2); the next boot must not re-live it
    reviewQuestion(db, "x-91-q1", { action: "edit", reviewer: "owner", edits: { stem: "Which is the safer choice here?" } });
    assert.equal(st("x-91-q1"), "draft");
    importDeckQuestions(db, { dir });
    assert.equal(st("x-91-q1"), "draft", "an edited question stays on the desk");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
