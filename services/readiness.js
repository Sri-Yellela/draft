// services/readiness.js — ⭐ D142 · READINESS, module one: CHECK — where you really stand (owner 11-01 / 11-02).
//
// *"candidates write resume bullets sophisticatedly using ai but fail to back it up in interviews … one [module] that
// tests them to make them aware … timed ones … they cant use ai to beat a 10 sec timer."*
//
//   · ADAPTIVE: a short check per skill the user claims or aims for — harder after a right answer, easier after a wrong
//     one, at most MAX_QUESTIONS; the output is AWARENESS, NOT A GRADE ("Strong: joins, aggregation · To work on:
//     window functions"), by concept.
//   · THE TIMER IS THE SERVER'S: a question's clock starts when the server SERVES it and stops when the answer arrives;
//     the answer key never leaves the server before the answer. In TIMED mode an answer after the limit (+ a grace for
//     the network) earns no credit — that is what blocks the easy look-up. ⛔ ACCESSIBILITY: EXTENDED time (×2) and an
//     UNTIMED practice mode are always offered and never penalised — their right answers count as right.
//   · ⛔ NOT A CERTIFICATE: a check is self-awareness; nothing here is shareable or shown to an employer.
//   · ⛔ ONLY REVIEWED QUESTIONS: a question is served only when a person has reviewed it (status 'live'). Drafts —
//     including the agent's seed (content/readiness/drafts.json) — wait in Admin → Data → Readiness questions.
//   · THE MAP'S STATES per skill: claimed (on the Profile / résumé) → checked (a finished check) → built (the skill's
//     Learn piece earned, D117 C8 / D116 M8 — the CLOSE module's builds join here when they exist).
// ⛔ D17: no model.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { haveTerms, termOf } from "./atlas/atlasStore.js";
import { atlasIndex } from "./atlas/atlasMe.js";
import { nodeLearnStates } from "./atlas/atlasTree.js";

export const READINESS = Object.freeze({
  MAX_QUESTIONS: 8,
  START_DIFFICULTY: 2,
  GRACE_MS: 1500,          // the network's share of a timed answer
  EXTENDED_FACTOR: 2,
  MODES: ["timed", "extended", "untimed"],
});
const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };
const bad = (status, code, message) => Object.assign(new Error(message), { status, code });
export const skillKey = (s) => termOf(String(s ?? "")) || String(s ?? "").trim().toLowerCase();

/** A question as a user sees it — no answer, no explanation. */
const served = (q, mode) => ({ id: q.id, skill: q.skill, concept: q.concept, difficulty: q.difficulty, prompt: q.prompt,
  options: JSON.parse(q.options_json), seconds: mode === "untimed" ? null : mode === "extended" ? q.seconds * READINESS.EXTENDED_FACTOR : q.seconds });

/** PURE. The next difficulty: harder after a right answer, easier after a wrong one, within 1–3. */
export function nextDifficulty(current, wasRight) {
  return Math.max(1, Math.min(3, current + (wasRight ? 1 : -1)));
}

/** PURE. The next question: the wanted difficulty, a concept not asked yet first, then the nearest difficulty. */
export function pickQuestion(pool, { asked = new Set(), conceptsAsked = new Set(), difficulty = READINESS.START_DIFFICULTY } = {}) {
  const open = pool.filter(q => !asked.has(q.id));
  if (!open.length) return null;
  const rank = (q) => [Math.abs(q.difficulty - difficulty), conceptsAsked.has(q.concept) ? 1 : 0, q.id];
  return open.slice().sort((a, b) => { const x = rank(a), y = rank(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; })[0];
}

/** PURE. The awareness summary, by concept — never a grade. */
export function summarise(answers, { skill, mode }) {
  const by = new Map();
  for (const a of answers) {
    const c = by.get(a.concept) || { concept: a.concept, right: 0, asked: 0, hardestRight: 0 };
    c.asked++;
    if (a.credit) { c.right++; c.hardestRight = Math.max(c.hardestRight, a.difficulty); }
    by.set(a.concept, c);
  }
  const concepts = [...by.values()];
  const strong = concepts.filter(c => c.right === c.asked && c.hardestRight >= 2).map(c => c.concept);
  const work = concepts.filter(c => c.right < c.asked).map(c => c.concept);
  const late = answers.filter(a => a.correct && !a.credit).length;
  const parts = [];
  if (strong.length) parts.push(`Strong: ${strong.join(", ")}`);
  if (work.length) parts.push(`To work on: ${work.join(", ")}`);
  if (late) parts.push(`${late} right but past the timer`);
  return { skill, mode, asked: answers.length, concepts, strong, work, late,
    line: parts.length ? parts.join(" · ") : "Too few questions to say yet.",
    note: "This is for you — where you stand today, not a grade or a certificate." };
}

const livePool = (db, key) => safe(() => db.prepare(`SELECT * FROM readiness_questions WHERE skill_key = ? AND status = 'live'`).all(key), []);
const answersOf = (db, checkId) => safe(() => db.prepare(`SELECT a.*, q.concept, q.difficulty FROM readiness_answers a
    JOIN readiness_questions q ON q.id = a.question_id WHERE a.check_id = ? ORDER BY a.answered_at, a.question_id`).all(checkId), [])
  .map(a => ({ ...a, correct: !!a.correct, credit: !!a.correct && !!a.in_time }));

/** Start a check. @returns {{ checkId, skill, mode, question, of }} */
export function startCheck(db, userId, { skill, mode = "timed", now = Date.now() }) {
  if (!READINESS.MODES.includes(mode)) throw bad(400, "bad_mode", "Pick timed, extended time, or untimed practice.");
  const key = skillKey(skill);
  const pool = livePool(db, key);
  if (!pool.length) throw bad(404, "no_questions", `There is no reviewed check for ${skill} yet.`);
  const first = pickQuestion(pool, {});
  const id = db.prepare(`INSERT INTO readiness_checks (user_id, skill_key, mode, current_q, served_at, started_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(userId, key, mode, first.id, now, Math.floor(now / 1000)).lastInsertRowid;
  return { checkId: Number(id), skill: first.skill, mode, question: served(first, mode), of: Math.min(READINESS.MAX_QUESTIONS, pool.length) };
}

/**
 * Answer the question being asked. The server's clock decides "in time".
 * @returns {{ correct, inTime, answer, explanation, question?: next, summary?: when finished }}
 */
export function answerCheck(db, userId, checkId, { questionId, chosen, now = Date.now() }) {
  const c = db.prepare(`SELECT * FROM readiness_checks WHERE id = ? AND user_id = ?`).get(checkId, userId);
  if (!c) throw bad(404, "not_found", "No such check.");
  if (c.finished_at) throw bad(409, "finished", "This check is finished.");
  if (Number(questionId) !== c.current_q) throw bad(409, "not_current", "That is not the question being asked.");
  const q = db.prepare(`SELECT * FROM readiness_questions WHERE id = ?`).get(c.current_q);
  const ms = Math.max(0, now - c.served_at);
  const limit = c.mode === "untimed" ? Infinity : q.seconds * 1000 * (c.mode === "extended" ? READINESS.EXTENDED_FACTOR : 1) + READINESS.GRACE_MS;
  const pickedIdx = Number.isInteger(chosen) ? chosen : null;
  const correct = pickedIdx === q.answer;
  const inTime = ms <= limit;
  db.prepare(`INSERT INTO readiness_answers (check_id, question_id, chosen, correct, in_time, ms, answered_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(checkId, q.id, pickedIdx, correct ? 1 : 0, inTime ? 1 : 0, ms, Math.floor(now / 1000));
  const answers = answersOf(db, checkId);
  const credit = correct && inTime;
  const pool = livePool(db, c.skill_key);
  const asked = new Set(answers.map(a => a.question_id));
  const next = answers.length >= READINESS.MAX_QUESTIONS ? null : pickQuestion(pool, { asked,
    conceptsAsked: new Set(answers.map(a => a.concept)), difficulty: nextDifficulty(q.difficulty, credit) });
  const feedback = { correct, inTime, answer: q.answer, explanation: q.explanation || null };
  if (!next) {
    const summary = summarise(answers, { skill: q.skill, mode: c.mode });
    db.prepare(`UPDATE readiness_checks SET current_q = NULL, served_at = NULL, finished_at = ?, summary_json = ? WHERE id = ?`)
      .run(Math.floor(now / 1000), JSON.stringify(summary), checkId);
    return { ...feedback, summary };
  }
  db.prepare(`UPDATE readiness_checks SET current_q = ?, served_at = ? WHERE id = ?`).run(next.id, now, checkId);
  return { ...feedback, question: served(next, c.mode), number: answers.length + 1 };
}

/**
 * The user's skills with their state on the map — claimed → checked → built — and whether a check exists for each.
 */
export function readinessStates(db, userId) {
  const { terms } = safe(() => haveTerms(db, userId), { terms: new Set() });
  const names = safe(() => db.prepare(`SELECT name FROM profile_skills WHERE user_id = ? ORDER BY position, id`).pluck().all(userId), []);
  const keys = new Map();
  for (const n of names) keys.set(skillKey(n), n);
  for (const t of terms) if (!keys.has(t)) keys.set(t, t);
  const checked = new Map(safe(() => db.prepare(`SELECT skill_key, MAX(finished_at) AS at, summary_json FROM readiness_checks
      WHERE user_id = ? AND finished_at IS NOT NULL GROUP BY skill_key`).all(userId), []).map(r => [r.skill_key, r]));
  const idx = safe(() => atlasIndex(db), null);
  const learning = idx ? safe(() => nodeLearnStates(db, userId, idx), new Map()) : new Map();
  const builtTerms = new Set();
  if (idx) for (const [id, l] of learning) if (l.state?.complete) { const n = idx.byId.get(id); if (n?.term) builtTerms.add(n.term); }
  const withChecks = new Set(safe(() => db.prepare(`SELECT DISTINCT skill_key FROM readiness_questions WHERE status = 'live'`).pluck().all(), []));
  return [...keys.entries()].map(([key, name]) => {
    const c = checked.get(key);
    const state = builtTerms.has(key) ? "built" : c ? "checked" : "claimed";
    return { skill: name, key, state, checkAvailable: withChecks.has(key),
      lastCheck: c ? { at: c.at, line: safe(() => JSON.parse(c.summary_json).line, null) } : null };
  });
}

/** Admin: the most-claimed skills across users' Profiles — where the content goes first ("the 10 most-claimed"). */
export function mostClaimed(db, limit = 10) {
  const rows = safe(() => db.prepare(`SELECT name FROM profile_skills`).pluck().all(), []);
  const counts = new Map();
  for (const n of rows) { const k = skillKey(n); const c = counts.get(k) || { key: k, skill: n, people: 0 }; c.people++; counts.set(k, c); }
  const live = new Map(safe(() => db.prepare(`SELECT skill_key, status, COUNT(*) AS n FROM readiness_questions GROUP BY skill_key, status`).all(), [])
    .map(r => [`${r.skill_key}:${r.status}`, r.n]));
  return [...counts.values()].sort((a, b) => b.people - a.people || a.skill.localeCompare(b.skill)).slice(0, limit)
    .map(c => ({ ...c, live: live.get(`${c.key}:live`) || 0, draft: live.get(`${c.key}:draft`) || 0 }));
}

/** Admin: a question's review — approve (live), back to draft, or retire; with edits. ⛔ Only a person does this. */
export function reviewQuestion(db, id, { action, reviewer, edits = null, now = Math.floor(Date.now() / 1000) }) {
  const q = db.prepare(`SELECT * FROM readiness_questions WHERE id = ?`).get(id);
  if (!q) throw bad(404, "not_found", "No such question.");
  const status = { approve: "live", draft: "draft", retire: "retired" }[action];
  if (!status) throw bad(400, "bad_action", "approve, draft or retire.");
  if (!reviewer) throw bad(400, "reviewer_required", "Who reviewed it?");
  const e = edits || {};
  const options = Array.isArray(e.options) ? e.options.map(String) : JSON.parse(q.options_json);
  const answer = Number.isInteger(e.answer) ? e.answer : q.answer;
  if (answer < 0 || answer >= options.length) throw bad(400, "bad_answer", "The answer must be one of the options.");
  db.prepare(`UPDATE readiness_questions SET prompt = ?, options_json = ?, answer = ?, explanation = ?, concept = ?, difficulty = ?, seconds = ?,
      status = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?`)
    .run(String(e.prompt ?? q.prompt), JSON.stringify(options), answer, e.explanation ?? q.explanation, String(e.concept ?? q.concept),
      Math.max(1, Math.min(3, Number(e.difficulty ?? q.difficulty))), Math.max(5, Number(e.seconds ?? q.seconds)), status, String(reviewer), now, id);
  return db.prepare(`SELECT * FROM readiness_questions WHERE id = ?`).get(id);
}

const DRAFTS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "content", "readiness", "drafts.json");
/** Boot: the drafted bank goes in as DRAFTS, only into an empty table (never over reviewed content). */
export function seedReadinessDrafts(db, file = DRAFTS) {
  if (safe(() => db.prepare(`SELECT COUNT(*) FROM readiness_questions`).pluck().get(), 1) > 0) return 0;
  const list = safe(() => JSON.parse(fs.readFileSync(file, "utf8")), []);
  const ins = db.prepare(`INSERT INTO readiness_questions (skill, skill_key, concept, difficulty, prompt, options_json, answer, explanation, seconds, status, written_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`);
  db.transaction(() => { for (const q of list) ins.run(q.skill, skillKey(q.skill), q.concept, q.difficulty, q.prompt, JSON.stringify(q.options), q.answer, q.explanation ?? null, q.seconds ?? 20, q.writtenBy || "agent-draft"); })();
  return list.length;
}
