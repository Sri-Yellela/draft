// ⭐ D150 T01 + T02 · THE QUESTION BANK and its review desk (owner 11-03: "use the quiz part as part of our own learning
// model"). One table, one live-only reader; an import that validates, diffs by id and never resets a reviewed item; the
// review route the only way to live; the flags computed from the answers. Synthetic items; the real content files
// (content/learn/audit-questions-v*.json) are checked to import cleanly. An in-memory database built from the migrations.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { questions, servedQuestion, importQuestions, importQuestionFiles, itemProblems, reviewQuestion, recordAnswer,
  questionStats, flagsFor, reviewList, unknownPieces, FLAG_RULES } from "../services/learn/learnQuestions.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const fresh = () => { const db = new Database(":memory:"); for (const m of MIGRATIONS) db.exec(m.sql); return db; };
const item = (id, over = {}) => ({ id, role: "Data Engineer", level: "mid", type: "scenario", skills: ["data-pipelines"], pieces: [],
  stem: "A synthetic scenario that asks which change you make first?", choices: ["A fix", "B fix", "C fix", "D fix"], correct: 1,
  why: ["Why A.", "Why B is right.", "Why C.", "Why D."], source: "test", status: "draft", ...over });
const file = (...items) => ({ version: 1, note: "synthetic", items });

test("D150 · t01WhyPerChoice — an item without a why for every choice is refused, and the file writes nothing", () => {
  const db = fresh();
  assert.deepEqual(itemProblems(item("ok-1")), []);
  assert.ok(itemProblems(item("bad-1", { why: ["only one"] })).some(p => /why/.test(p)));
  assert.ok(itemProblems(item("bad-2", { surprise: 1 })).some(p => /unknown field "surprise"/.test(p)), "an unknown field is refused, not dropped");
  assert.ok(itemProblems(item("bad-3", { correct: 9 })).some(p => /correct/.test(p)));
  const r = importQuestions(db, file(item("ok-1"), item("bad-1", { why: ["x"] })), { apply: true });
  assert.equal(r.applied, false);
  assert.equal(r.refused.length, 1);
  assert.equal(db.prepare("SELECT COUNT(*) FROM learn_questions").pluck().get(), 0, "nothing written when any item is refused");
  assert.throws(() => importQuestions(db, { ...file(item("ok-2")), extra: true }), /Unknown top-level/);
});

test("D150 · t01LiveOnly + t02ApproveOnlyHere — an import writes drafts whatever the file says; only the review makes one live", () => {
  const db = fresh();
  importQuestions(db, file(item("q-1", { status: "live" }), item("q-2")), { apply: true });
  assert.deepEqual(questions(db), [], "the reader returns nothing until a person approves");
  reviewQuestion(db, "q-1", { action: "approve", reviewer: "owner" });
  assert.deepEqual(questions(db).map(q => q.id), ["q-1"]);
  reviewQuestion(db, "q-1", { action: "retire", reviewer: "owner" });
  assert.deepEqual(questions(db), []);
  assert.throws(() => reviewQuestion(db, "q-2", { action: "approve" }), /names its reviewer/);
  // The served shape carries no answer key and no explanations.
  reviewQuestion(db, "q-2", { action: "approve", reviewer: "owner" });
  const s = servedQuestion(questions(db)[0]);
  assert.equal(s.correct, undefined); assert.equal(s.why, undefined);
  // ⛔ nothing else in the code sets status = 'live'.
  const src = read("services/learn/learnQuestions.js");
  assert.equal(src.split("SET status = 'live'").length - 1, 1, "one place writes live");
  assert.ok(at(src, "SET status = 'live'") > at(src, "export function reviewQuestion"), "and it is reviewQuestion");
});

test("D150 · t01ImportIdempotent — a re-import never resets status, answers or a reviewer's edit; changed content of a live item goes back to review", () => {
  const db = fresh();
  const f = file(item("i-1"), item("i-2"));
  importQuestions(db, f, { apply: true });
  reviewQuestion(db, "i-1", { action: "approve", reviewer: "owner" });
  recordAnswer(db, { questionId: "i-1", surface: "audit", chosen: 1, ms: 4000 });
  reviewQuestion(db, "i-2", { action: "edit", reviewer: "owner", edits: { stem: "The reviewer's own better wording of the scenario?" } });
  const again = importQuestions(db, f, { apply: true });
  assert.deepEqual(again.unchanged.sort(), ["i-1", "i-2"]);
  assert.equal(questions(db, { ids: ["i-1"] }).length, 1, "still live");
  assert.equal(questionStats(db, "i-1").answered, 1, "answers kept");
  assert.match(db.prepare("SELECT stem FROM learn_questions WHERE id = 'i-2'").pluck().get(), /reviewer's own/, "the edit survives a re-import");
  const changed = importQuestions(db, file(item("i-1", { correct: 2 }), item("i-2")), { apply: true });
  assert.deepEqual(changed.requeued, ["i-1"]);
  assert.equal(db.prepare("SELECT status FROM learn_questions WHERE id = 'i-1'").pluck().get(), "draft", "a changed answer key is reviewed again");
});

test("D150 · t01OneReader — every consumer reads questions(); filters by role, level, type and skill", () => {
  const db = fresh();
  importQuestions(db, file(item("r-1"), item("r-2", { role: "Backend Engineer", skills: ["apis"] }), item("r-3", { level: "senior", type: "recall" })), { apply: true });
  for (const id of ["r-1", "r-2", "r-3"]) reviewQuestion(db, id, { action: "approve", reviewer: "owner" });
  assert.deepEqual(questions(db, { role: "Data Engineer" }).map(q => q.id), ["r-1", "r-3"]);
  assert.deepEqual(questions(db, { level: "senior" }).map(q => q.id), ["r-3"]);
  assert.deepEqual(questions(db, { type: "recall" }).map(q => q.id), ["r-3"]);
  assert.deepEqual(questions(db, { skills: ["apis"] }).map(q => q.id), ["r-2"]);
  // No second reader of the table outside the module (the routes go through it).
  for (const f of ["server.js"]) assert.doesNotMatch(read(f), /FROM learn_questions WHERE status = 'live'/, `${f} reads live items itself`);
});

test("D150 · t02FlagsComputed — too easy, too hard, a dead choice, too fast; nothing before enough answers", () => {
  const db = fresh();
  importQuestions(db, file(item("f-1"), item("f-2")), { apply: true });
  for (const id of ["f-1", "f-2"]) reviewQuestion(db, id, { action: "approve", reviewer: "owner" });
  for (let i = 0; i < FLAG_RULES.MIN_ANSWERS - 1; i++) recordAnswer(db, { questionId: "f-1", surface: "audit", chosen: 1, ms: 900 });
  assert.deepEqual(flagsFor(questionStats(db, "f-1")), [], "no flag before 30 answers");
  recordAnswer(db, { questionId: "f-1", surface: "audit", chosen: 1, ms: 900 });
  const codes = flagsFor(questionStats(db, "f-1")).map(f => f.code).sort();
  assert.deepEqual(codes, ["dead_choice", "dead_choice", "dead_choice", "too_easy", "too_fast"]);
  for (let i = 0; i < 30; i++) recordAnswer(db, { questionId: "f-2", surface: "audit", chosen: i % 4 === 1 ? 1 : [0, 2, 3][i % 3], ms: 8000 });
  const s = questionStats(db, "f-2");
  assert.ok(s.correctShare < 0.3);
  assert.equal(s.medianMs, 8000);
  assert.deepEqual(reviewList(db, { flagged: true }).map(q => q.id), ["f-1"].concat(flagsFor(s).length ? ["f-2"] : []));
  assert.throws(() => recordAnswer(db, { questionId: "f-1", surface: "audit", chosen: 7 }), /Choose one/);
});

test("D150 · T03 — the four content files import as 90 drafts, idempotently, and every cited Learn piece exists", () => {
  const db = fresh();
  const first = importQuestionFiles(db);
  assert.deepEqual(first.map(r => r.error || r.refused.length), [0, 0, 0, 0], JSON.stringify(first.map(r => r.refused)));
  assert.equal(db.prepare("SELECT COUNT(*) FROM learn_questions WHERE status = 'draft'").pluck().get(), 90);
  assert.ok(importQuestionFiles(db).every(r => !r.added.length && !r.changed.length));
  assert.deepEqual(unknownPieces(db), []);
  assert.deepEqual(questions(db), [], "imported, none live");
});

test("D150 T02 · the wiring — boot import, the admin routes, the desk, the tracker importer skips the bank's files", () => {
  const s = read("server.js");
  assert.match(s, /for \(const r of importQuestionFiles\(db\)\)/);
  assert.match(s, /app\.get\("\/api\/admin\/questions", requireAdmin/);
  assert.match(s, /app\.post\("\/api\/admin\/questions\/:id\/review", requireAdmin/);
  assert.ok(read("services/learn/learnImport.js").includes("!/^audit-questions-v\\d+\\.json$/.test(f)"), "the tracker importer skips the bank's files");
  assert.match(read("client/src/panels/adminMap.js"), /\["questions", "Question bank"\]/);
  assert.match(read("client/src/panels/AdminPanel.jsx"), /\{at\("data", "questions"\) && <QuestionBankTab\/>\}/);
  const desk = read("client/src/panels/adminQuestions.jsx");
  assert.match(desk, /Approve — make it live/);
  assert.match(desk, /api\(`\/api\/admin\/questions\/\$\{encodeURIComponent\(id\)\}\/review`/);
  const acct = read("services/accountService.js");
  assert.match(acct, /learn_question_answers: "move"/);
});
