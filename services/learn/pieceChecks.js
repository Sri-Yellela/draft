// services/learn/pieceChecks.js — ⭐ D150 T14 (46y) · QUESTIONS INSIDE LEARN + SPACED REVIEW: a Learn piece's "checked" state
// and the quiet "N to review" line on the Learn home.
//
// The items are the owner-approved bank's (learn_questions, status live — ONE reader, questions()): an item names the Learn
// pieces it checks in its pieces[] (T02's drafts, approved by the owner in Admin → Data → Question bank). ⛔ Nothing here adds
// or drafts a question — a piece with no live item has no questions and no "checked" state.
//   · a piece is CHECKED when every one of its live items was answered right the LAST time it was answered (on any surface —
//     the daily question, a deck's check, the audit or the piece itself: one person, one history);
//   · a wrong answer schedules a review, and right answers space out: the ONE review rule (dailyQuestion.js dueReviews,
//     1 → 3 → 7 → 21 days) — so the daily question and this line can never disagree;
//   · "N to review" counts the due items that belong to a Learn piece (reviewable in Learn), and names the piece to open first.
// ⛔ D17 / D190: no model. Answers go through the bank's recordAnswer (surface 'learn'), judged on the server.
import { questions, servedQuestion, recordAnswer } from "./learnQuestions.js";
import { answerHistory, dueReviews, resultOf, REVIEW_DAYS } from "./dailyQuestion.js";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const bad = (status, code, message) => Object.assign(new Error(message), { status, code });
const todayUtc = () => new Date().toISOString().slice(0, 10);
const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** The live bank by piece: Map pieceId → items (bank order). */
export function itemsByPiece(db) {
  const m = new Map();
  for (const q of questions(db, {})) for (const p of q.pieces || []) {
    if (!m.has(p)) m.set(p, []);
    m.get(p).push(q);
  }
  return m;
}

/** One piece's state from the person's history: { total, answered, right, checked, due: [ids], next (day of the next review) }. */
export function pieceState(items, h, day) {
  const ids = new Set(items.map(q => q.id));
  const due = dueReviews(h, day, ids).map(x => x.id);
  let answered = 0, right = 0, next = null;
  for (const q of items) {
    const e = h.get(q.id);
    if (!e) continue;
    answered++;
    if (e.right) right++;
    const when = addDays(e.last, REVIEW_DAYS[Math.min(e.streak, REVIEW_DAYS.length - 1)]);
    if (!next || when < next) next = when;
  }
  return { total: items.length, answered, right, checked: items.length > 0 && right === items.length, due, next };
}

/** GET /api/learn/checks — every piece with live items, its state, and the review line's count. */
export function learnChecks(db, userId, day = todayUtc()) {
  if (!DAY_RE.test(String(day || ""))) throw bad(400, "bad_day", "Which day is it for you?");
  const byPiece = itemsByPiece(db);
  const h = userId ? answerHistory(db, userId) : new Map();
  const pieces = {};
  const dueIds = new Set();
  const order = [];
  for (const [p, items] of byPiece) {
    const s = pieceState(items, h, day);
    pieces[p] = { total: s.total, right: s.right, checked: s.checked, due: s.due.length };
    for (const id of s.due) dueIds.add(id);
    if (s.due.length) order.push({ p, n: s.due.length });
  }
  order.sort((a, b) => b.n - a.n || a.p.localeCompare(b.p));
  return { day, pieces, review: { count: dueIds.size, pieces: order.map(x => x.p) } };
}

/**
 * GET /api/learn/piece/:id/questions — the piece's live items as served (no answer key), and for a signed-in person its state
 * and the item to ask NEXT: a due review first, then one never answered, then one last answered wrong. null when checked
 * and nothing is due.
 */
export function pieceQuestions(db, pieceId, userId = null, day = todayUtc()) {
  if (!DAY_RE.test(String(day || ""))) throw bad(400, "bad_day", "Which day is it for you?");
  const items = itemsByPiece(db).get(String(pieceId)) || [];
  const out = { piece: String(pieceId), questions: items.map(servedQuestion) };
  if (!userId || !items.length) return { ...out, state: null, next: null };
  const h = answerHistory(db, userId);
  const state = pieceState(items, h, day);
  const next = state.due[0] || items.find(q => !h.has(q.id))?.id || items.find(q => !h.get(q.id)?.right)?.id || null;
  return { ...out, state, next };
}

/** POST /api/learn/piece/:id/answer — one answer to one of the piece's items; the result (as the daily question's) + the new state. */
export function answerPieceQuestion(db, userId, pieceId, { questionId, chosen = null, response = null, ms = null, day = todayUtc() } = {}) {
  if (!DAY_RE.test(String(day || ""))) throw bad(400, "bad_day", "Which day is it for you?");
  const items = itemsByPiece(db).get(String(pieceId)) || [];
  const item = items.find(q => q.id === questionId);
  if (!item) throw bad(404, "no_question", "That question is not part of this lesson.");
  const resp = Array.isArray(response) ? response.slice(0, 8).map(Number) : null;
  const { correct } = recordAnswer(db, { questionId: item.id, userId, surface: "learn", chosen: resp ? -1 : Number(chosen), response: resp, ms });
  const h = answerHistory(db, userId);
  const state = pieceState(items, h, day);
  const next = state.due.find(id => id !== item.id) || items.find(q => !h.has(q.id))?.id || items.find(q => !h.get(q.id)?.right && q.id !== item.id)?.id || null;
  return { result: resultOf(db, item, resp ? -1 : Number(chosen), correct, resp), state, next };
}
