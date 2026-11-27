// ⭐ D150 T14 (46y) · QUESTIONS INSIDE LEARN + SPACED REVIEW — a piece's "checked" state from the owner-approved bank's items,
// the ONE review rule shared with the daily question (1 → 3 → 7 → 21 days; a miss → 1 day), and the quiet "N to review" line on
// the Learn home. The WORKLOG's names: t14CheckedState · t14SpacedSchedule · t14ReviewLineQuiet. Synthetic items only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { at } from "../test-support/sourceAnchors.js";
import { recordAnswer } from "../services/learn/learnQuestions.js";
import { pickDaily, answerHistory, dueReviews } from "../services/learn/dailyQuestion.js";
import { learnChecks, pieceQuestions, answerPieceQuestion } from "../services/learn/pieceChecks.js";
import { createLearnRouter } from "../routes/learn.js";
import { pieceCheckLine } from "../client/src/pages/atlas/libraryModel.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const secOf = (day) => Math.floor(Date.parse(`${day}T12:00:00Z`) / 1000);

function freshDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'avery','x'), (2,'blake','x')").run();
  const ins = db.prepare(`INSERT INTO learn_questions (id, role, level, type, pieces_json, stem, choices_json, correct, why_json, status, content_hash)
    VALUES (?, 'Software Engineer', 'entry', 'scenario', ?, ?, '["a","b","c"]', 1, '["no a","yes b","no c"]', ?, 'h')`);
  ins.run("t14-x1-a", '["x1"]', "What does a register hold?", "live");
  ins.run("t14-x1-b", '["x1"]', "What does a cache line hold?", "live");
  ins.run("t14-x1-c", '["x1","b2"]', "What does a bus carry?", "live");
  ins.run("t14-x1-draft", '["x1"]', "A drafted question nobody approved", "draft");
  ins.run("t14-b2-a", '["b2"]', "What does a gate compute?", "live");
  ins.run("t14-none", "[]", "A question with no Learn piece at all", "live");
  return db;
}
const answer = (db, id, right, day, surface = "learn") => recordAnswer(db, { questionId: id, userId: 1, surface, chosen: right ? 1 : 0, now: secOf(day) });

test("t14CheckedState · a piece is checked when every one of its LIVE items was answered right the last time — on any surface", () => {
  const db = freshDb();
  let c = learnChecks(db, 1, "2026-11-20");
  assert.deepEqual(c.pieces.x1, { total: 3, right: 0, checked: false, due: 0 }, "the draft item is not counted");
  assert.equal(c.pieces.b2.total, 2);
  assert.equal(c.pieces.zz, undefined, "a piece with no approved item has no state at all");
  answer(db, "t14-x1-a", true, "2026-11-20");
  answer(db, "t14-x1-b", true, "2026-11-20", "daily");   // the daily question's answer counts here too — one history
  answer(db, "t14-x1-c", false, "2026-11-20");
  c = learnChecks(db, 1, "2026-11-20");
  assert.deepEqual(c.pieces.x1, { total: 3, right: 2, checked: false, due: 0 });
  answer(db, "t14-x1-c", true, "2026-11-20");
  c = learnChecks(db, 1, "2026-11-20");
  assert.equal(c.pieces.x1.checked, true);
  assert.equal(c.pieces.b2.checked, false, "b2 shares one item; its own is unanswered");
  // the LAST answer decides: a later miss un-checks it
  answer(db, "t14-x1-a", false, "2026-11-21");
  assert.equal(learnChecks(db, 1, "2026-11-21").pieces.x1.checked, false);
  // never another person's answers
  assert.equal(learnChecks(db, 2, "2026-11-21").pieces.x1.right, 0);
  assert.deepEqual([pieceCheckLine(null, 3), pieceCheckLine({ checked: false, right: 2, total: 3 }, 3), pieceCheckLine({ checked: true, right: 3, total: 3 }, 3)],
    ["3 questions on this lesson", "2 of 3 right", "Checked · all 3 right"]);
});

test("t14SpacedSchedule · a miss comes back the next day; right answers space out 3 → 7 → 21; the daily question reads the same rule", () => {
  const db = freshDb();
  answer(db, "t14-x1-a", false, "2026-11-01");
  assert.equal(learnChecks(db, 1, "2026-11-01").review.count, 0, "not due the same day");
  assert.equal(learnChecks(db, 1, "2026-11-02").review.count, 1, "a miss → 1 day");
  answer(db, "t14-x1-a", true, "2026-11-02");
  assert.equal(learnChecks(db, 1, "2026-11-04").review.count, 0);
  assert.equal(learnChecks(db, 1, "2026-11-05").review.count, 1, "right once → 3 days");
  answer(db, "t14-x1-a", true, "2026-11-05");
  assert.equal(learnChecks(db, 1, "2026-11-11").review.count, 0);
  assert.equal(learnChecks(db, 1, "2026-11-12").review.count, 1, "right twice in a row → 7 days");
  // the daily question picks the same due review (one rule — dueReviews)
  assert.equal(pickDaily(db, 1, "2026-11-12").reason, "review");
  assert.equal(pickDaily(db, 1, "2026-11-12").item.id, "t14-x1-a");
  assert.deepEqual(dueReviews(answerHistory(db, 1), "2026-11-12").map(x => x.id), ["t14-x1-a"]);
  // the piece asks the due one first
  assert.equal(pieceQuestions(db, "x1", 1, "2026-11-12").next, "t14-x1-a");
  assert.equal(pieceQuestions(db, "x1", 1, "2026-11-06").next, "t14-x1-b", "nothing due → one never answered");
});

test("t14ReviewLineQuiet · the Learn home's line counts due items that live in a Learn piece, names the piece, and is nothing at 0", () => {
  const db = freshDb();
  assert.deepEqual(learnChecks(db, 1, "2026-11-20").review, { count: 0, pieces: [] });
  for (const id of ["t14-x1-a", "t14-x1-c", "t14-b2-a", "t14-none"]) answer(db, id, false, "2026-11-19");
  const r = learnChecks(db, 1, "2026-11-20").review;
  assert.equal(r.count, 3, "t14-none is due too, but has no Learn piece — the daily question reviews it");
  assert.deepEqual(r.pieces, ["b2", "x1"], "the piece with the most due first; a tie (2 each — t14-x1-c is in both) by id");
  answer(db, "t14-x1-b", false, "2026-11-19");
  assert.deepEqual(learnChecks(db, 1, "2026-11-20").review.pieces, ["x1", "b2"], "x1 now has 3 due");
  const lib = "" /* 47m: LibraryPanel.jsx deleted */;
  const line = lib.slice(at(lib, "export function ReviewLine"), at(lib, "/** /atlas/library — the shelf. */"));
  assert.match(line, /if \(!review\?\.count\) return null;/, "quiet: nothing when nothing is due");
  assert.match(line, /`\$\{review\.count\} to review`/);
  assert.match(line, /learnStepHref\(base, first\)/);
  assert.match(lib, /<ReviewLine base=\{base\} review=\{checks\?\.review\} \/>/);
});

test("t14 · the routes: questions served without the answer key; an answer judged on the server; the learner's own state only", async () => {
  const db = freshDb();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { const u = Number(req.get("x-user")); if (u) req.user = { id: u }; next(); });
  const requireAuth = (req, res, next) => (req.user ? next() : res.status(401).json({ error: "auth" }));
  app.use("/api/learn", createLearnRouter(db, { requireAuth }));
  const srv = app.listen(0);
  const base = `http://127.0.0.1:${srv.address().port}/api/learn`;
  const j = async (path, opts = {}) => { const r = await fetch(`${base}${path}`, opts); return { status: r.status, body: await r.json() }; };
  try {
    const out = await j("/piece/x1/questions?day=2026-11-20");
    assert.equal(out.status, 200);
    assert.deepEqual(out.body.questions.map(q => q.id), ["t14-x1-a", "t14-x1-b", "t14-x1-c"]);
    assert.ok(out.body.questions.every(q => !("correct" in q) && !("why" in q)), "no answer key leaves the server");
    assert.equal(out.body.state, null, "signed out: no state");
    assert.equal((await j("/checks?day=2026-11-20")).status, 401);
    const post = (body, user = "1") => j("/piece/x1/answer", { method: "POST", headers: { "content-type": "application/json", "x-user": user }, body: JSON.stringify({ day: "2026-11-20", ...body }) });
    assert.equal((await post({ questionId: "t14-b2-a", chosen: 1 })).status, 404, "not this lesson's question");
    assert.equal((await post({ questionId: "t14-x1-draft", chosen: 1 })).status, 404, "a draft is never asked");
    const a = await post({ questionId: "t14-x1-a", chosen: 0 });
    assert.equal(a.status, 200);
    assert.equal(a.body.result.correct, false);
    assert.equal(a.body.result.correctIndex, 1);
    assert.equal(a.body.state.right, 0);
    assert.equal(db.prepare("SELECT surface FROM learn_question_answers").get().surface, "learn");
    const mine = await j("/checks?day=2030-01-01", { headers: { "x-user": "1" } });
    assert.equal(mine.body.review.count, 1);
    const theirs = await j("/checks?day=2030-01-01", { headers: { "x-user": "2" } });
    assert.equal(theirs.body.review.count, 0);
  } finally { srv.close(); }
  // nothing new is drafted or written into the bank here
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM learn_questions").get().n, 6);
  assert.doesNotMatch(read("services/learn/pieceChecks.js"), /INSERT|UPDATE |anthropic|callTask/i);
  assert.throws(() => answerPieceQuestion(db, 1, "x1", { questionId: "t14-x1-a", chosen: 1, day: "nope" }), /Which day/);
});
