import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import {
  startCheck, answerCheck, readinessStates, mostClaimed, reviewQuestion, seedReadinessDrafts, nextDifficulty, pickQuestion, summarise, READINESS,
} from "../services/readiness.js";

// ⭐ D142 (owner 11-01 / 11-02) · READINESS — module one, CHECK. Synthetic people; the seed bank is the drafted SQL /
// Python set in content/readiness/drafts.json (drafts until a person reviews them).

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const T0 = Date.UTC(2026, 10, 3, 12);

function fixtureDb({ approve = true } = {}) {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1,'a','x'), (2,'b','x')").run();
  for (const s of ["SQL", "Python", "Kubernetes"]) db.prepare("INSERT INTO profile_skills (user_id, name) VALUES (1, ?)").run(s);
  db.prepare("INSERT INTO profile_skills (user_id, name) VALUES (2, 'SQL')").run();
  seedReadinessDrafts(db);
  if (approve) for (const id of db.prepare("SELECT id FROM readiness_questions").pluck().all()) reviewQuestion(db, id, { action: "approve", reviewer: "owner" });
  return db;
}
const keyOf = (db, id) => db.prepare("SELECT answer FROM readiness_questions WHERE id = ?").pluck().get(id);

test("D142 · d142QuestionsReviewedBeforeLive — drafts are never served; a person approves; edits are checked", () => {
  const db = fixtureDb({ approve: false });
  assert.equal(db.prepare("SELECT COUNT(*) FROM readiness_questions WHERE status = 'draft'").pluck().get(), 20, "the seed waits as drafts");
  assert.throws(() => startCheck(db, 1, { skill: "SQL" }), /no reviewed check for SQL/);
  const id = db.prepare("SELECT id FROM readiness_questions WHERE skill_key = 'sql' ORDER BY id LIMIT 1").pluck().get();
  assert.throws(() => reviewQuestion(db, id, { action: "approve", reviewer: null }), /Who reviewed it/);
  assert.throws(() => reviewQuestion(db, id, { action: "approve", reviewer: "owner", edits: { answer: 9 } }), /one of the options/);
  const q = reviewQuestion(db, id, { action: "approve", reviewer: "owner" });
  assert.deepEqual([q.status, q.reviewed_by], ["live", "owner"]);
  assert.equal(seedReadinessDrafts(db), 0, "the seed never goes over a bank that exists");
  assert.match(read("client/src/panels/adminReadiness.jsx"), /Approve — make it live/);
});

test("D142 · the answer key never leaves before the answer; the server's clock decides", () => {
  const db = fixtureDb();
  const s = startCheck(db, 1, { skill: "SQL", mode: "timed", now: T0 });
  assert.equal("answer" in s.question, false);
  assert.equal("explanation" in s.question, false);
  assert.equal(s.question.difficulty, READINESS.START_DIFFICULTY);
  const r = answerCheck(db, 1, s.checkId, { questionId: s.question.id, chosen: keyOf(db, s.question.id), now: T0 + 5000 });
  assert.equal(r.correct, true);
  assert.equal(r.inTime, true);
  assert.equal(typeof r.answer, "number", "the key comes with the feedback, after");
  assert.throws(() => answerCheck(db, 1, s.checkId, { questionId: s.question.id, chosen: 0 }), /not the question being asked/);
  assert.throws(() => answerCheck(db, 2, s.checkId, { questionId: r.question.id, chosen: 0 }), /No such check/, "another user's check");
});

test("D142 · d142CheckAdaptive — harder after a right answer, easier after a wrong one; at most 8 questions", () => {
  assert.equal(nextDifficulty(2, true), 3);
  assert.equal(nextDifficulty(2, false), 1);
  assert.equal(nextDifficulty(3, true), 3);
  assert.equal(nextDifficulty(1, false), 1);
  const pool = [{ id: 1, difficulty: 1, concept: "a" }, { id: 2, difficulty: 3, concept: "a" }, { id: 3, difficulty: 3, concept: "b" }];
  assert.equal(pickQuestion(pool, { difficulty: 3, conceptsAsked: new Set(["a"]) }).id, 3, "a concept not asked yet first");
  const db = fixtureDb();
  let s = startCheck(db, 1, { skill: "SQL", now: T0 });
  let q = s.question, t = T0, r, n = 0;
  const seen = [];
  while (q) {
    seen.push(q.difficulty);
    t += 3000;
    r = answerCheck(db, 1, s.checkId, { questionId: q.id, chosen: keyOf(db, q.id), now: t });
    n++;
    q = r.question || null;
  }
  assert.equal(n, READINESS.MAX_QUESTIONS);
  assert.equal(seen[1], 3, "a right answer at 2 → a 3 next");
  assert.ok(r.summary, "a summary at the end");
});

test("D142 · d142TimedModesAndUntimed + d142ExtendedTimeNeverPenalised — late in timed earns no credit; extended and untimed never lose it", () => {
  const db = fixtureDb();
  const late = (mode) => {
    const s = startCheck(db, 1, { skill: "Python", mode, now: T0 });
    const secs = db.prepare("SELECT seconds FROM readiness_questions WHERE id = ?").pluck().get(s.question.id);
    assert.equal(s.question.seconds, mode === "untimed" ? null : mode === "extended" ? secs * 2 : secs);
    return answerCheck(db, 1, s.checkId, { questionId: s.question.id, chosen: keyOf(db, s.question.id), now: T0 + (secs * 1.5) * 1000 + 2000 });
  };
  assert.equal(late("timed").inTime, false, "1.5× the limit is past the timer");
  assert.equal(late("extended").inTime, true, "within 2× — never penalised");
  assert.equal(late("untimed").inTime, true, "no clock — never penalised");
  const sum = summarise([{ concept: "joins", difficulty: 2, correct: true, credit: false }], { skill: "SQL", mode: "timed" });
  assert.match(sum.line, /1 right but past the timer/);
});

test("D142 · d142NotACertificate — the summary is awareness by concept, said as such; nothing is shareable", () => {
  const s = summarise([
    { concept: "joins", difficulty: 2, correct: true, credit: true }, { concept: "joins", difficulty: 3, correct: true, credit: true },
    { concept: "window functions", difficulty: 2, correct: false, credit: false },
  ], { skill: "SQL", mode: "timed" });
  assert.equal(s.line, "Strong: joins · To work on: window functions");
  assert.equal(s.note, "This is for you — where you stand today, not a grade or a certificate.");
  assert.doesNotMatch(JSON.stringify(s), /score|grade":|percent|certif(ied|icate":)/i);
  const ui = read("client/src/pages/atlas/ReadinessCheck.jsx");
  assert.match(ui, /not a grade or a certificate/);
  assert.doesNotMatch(ui.replace(/^\s*\/\/.*$/gm, ""), /\b(share|linkedin|badge|download)\b/i, "no way to share or show it");
});

test("D142 · d142MapStatesClaimedCheckedBuilt — a claimed skill becomes checked when a check finishes", () => {
  const db = fixtureDb();
  const before = readinessStates(db, 1);
  assert.deepEqual(before.map(s => [s.skill, s.state, s.checkAvailable]), [["SQL", "claimed", true], ["Python", "claimed", true], ["Kubernetes", "claimed", false]]);
  const s = startCheck(db, 1, { skill: "SQL", now: T0 });
  let q = s.question, t = T0, r;
  while (q) { t += 2000; r = answerCheck(db, 1, s.checkId, { questionId: q.id, chosen: 0, now: t }); q = r.question || null; }
  const after = readinessStates(db, 1);
  assert.equal(after.find(x => x.skill === "SQL").state, "checked");
  assert.ok(after.find(x => x.skill === "SQL").lastCheck.line);
  assert.equal(after.find(x => x.skill === "Python").state, "claimed");
  assert.match(read("services/readiness.js"), /builtTerms\.has\(key\) \? "built"/, "built = the skill's Learn piece earned (D117 C8)");
});

test("D142 · the 10 most-claimed skills say where content goes first", () => {
  const m = mostClaimed(fixtureDb(), 10);
  assert.deepEqual(m[0], { key: "sql", skill: "SQL", people: 2, live: 10, draft: 0 });
});
