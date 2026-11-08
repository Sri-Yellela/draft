// services/learn/dailyQuestion.js — ⭐ D154 P1 / P3 (45l) · ONE QUESTION A DAY, PICKED FROM YOUR OWN GAPS.
//
// One live item from the owner-approved bank (learn_questions) per person per day (their local day — the client sends it),
// picked in D154's order and the REASON stored with it:
//   1 · review   — a question they answered before whose review is due (D150's spaced review: 1 → 3 → 7 → 21 days after
//                  the last answer, by how many times in a row they have now got it right; a miss resets to 1 day)
//   2 · audit    — a skill they missed in an audit they kept (D150 T07)
//   3 · ats      — ⭐ 45m: a skill the ATS shows MISSING in the jobs they saved (starred) or applied to — the reports'
//                  tier1_missing, most-asked first (D152 8's "you could claim")
//   4 · aim      — ⭐ 45n: a gap on Your map for their aim (its unproven skills, most-demanded first), else a question
//                  for the role they aim at (D143's destination)
//   5 · any      — the bank's next item they have never seen
// Answer → judged on the server (the bank's
// recordAnswer, surface 'daily') → the WHY of the chosen choice and of the right one → GO TO LESSON (the item's pieces[] →
// the Learn piece, P3). A quiet streak: consecutive days answered, ending today or yesterday. Nothing is shown on Home
// but one line (D145). ⛔ D17: no model.
import { questions, servedQuestion, recordAnswer, isStructured, judgeStructured } from "./learnQuestions.js";
import { learnContent } from "./learnContent.js";
import { learnStepInfo, learnStepPath } from "./learnLinks.js";
import { forgivingStreak } from "./practiceProgress.js";
import { approvedDecks } from "./learnDecks.js";

export const REVIEW_DAYS = Object.freeze([1, 3, 7, 21]);
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const bad = (status, code, message) => Object.assign(new Error(message), { status, code });
const dayOf = (sec) => new Date(sec * 1000).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

/** The person's answer history per question: { id → { last (day), streak (right in a row, newest first) } }. */
function history(db, userId) {
  const rows = db.prepare(`SELECT question_id, correct, answered_at FROM learn_question_answers WHERE user_id = ? ORDER BY answered_at DESC`).all(userId);
  const h = new Map();
  for (const r of rows) {
    const e = h.get(r.question_id);
    if (!e) h.set(r.question_id, { last: dayOf(r.answered_at), streak: r.correct ? 1 : 0, open: !!r.correct });
    else if (e.open) { if (r.correct) e.streak++; else e.open = false; }
  }
  return h;
}

// A bank skill is an Atlas slug ("apache-kafka"); an ATS term is the posting's word ("Apache Kafka") — compared as words.
const skillWords = (s) => String(s || "").toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
export const ATS_JOBS_READ = 50;

/**
 * ⭐ 45m (D154 P1 (4)) · the skills the ATS shows MISSING in the jobs the person saved (starred) or applied to — the stored
 * reports' tier1_missing for their newest ATS_JOBS_READ such jobs, counted across them, most-asked first (as words).
 * Never the whole board: the board's precompute scores every posting, and those are not "their" jobs.
 */
export function atsMissingTerms(db, userId) {
  const count = new Map();
  try {
    const rows = db.prepare(`SELECT r.ats_report FROM ats_only_reports r
        JOIN (SELECT job_id, MAX(updated_at) AS at FROM user_jobs WHERE user_id = ? AND (starred = 1 OR applied = 1) GROUP BY job_id
              ORDER BY at DESC LIMIT ?) j ON j.job_id = r.job_id
      WHERE r.user_id = ?`).all(userId, ATS_JOBS_READ, userId);
    for (const r of rows) {
      let rep = null; try { rep = JSON.parse(r.ats_report); } catch { rep = null; }
      for (const t of new Set((rep?.tier1_missing || []).map(skillWords).filter(Boolean))) count.set(t, (count.get(t) || 0) + 1);
    }
  } catch { return []; }
  return [...count].sort((a, b) => b[1] - a[1]).map(([t]) => t);
}

/** The pick for `day`, with its reason, or null when the bank has nothing. Pure over the database. */
export function pickDaily(db, userId, day, { aimRole = null, aimGaps = null } = {}) {
  const live = questions(db, {});
  if (!live.length) return null;
  const byId = new Map(live.map(q => [q.id, q]));
  const h = history(db, userId);
  // 1 · a due review — the most overdue first, a miss (streak 0) before a right answer.
  const due = [...h].filter(([id]) => byId.has(id)).map(([id, e]) => ({ id, over: daysBetween(e.last, day) - REVIEW_DAYS[Math.min(e.streak, REVIEW_DAYS.length - 1)], streak: e.streak }))
    .filter(x => x.over >= 0).sort((a, b) => a.streak - b.streak || b.over - a.over);
  if (due.length) return { item: byId.get(due[0].id), reason: "review" };
  const unseen = live.filter(q => !h.has(q.id));
  // 2 · a skill missed in a kept audit.
  let missed = new Set();
  try {
    for (const s of db.prepare(`SELECT item_ids_json, answers_json FROM audit_sessions WHERE claimed_by = ?`).all(userId)) {
      for (const a of JSON.parse(s.answers_json || "[]")) if (!a.correct) for (const sk of byId.get(a.id)?.skills || []) missed.add(sk);
    }
  } catch { missed = new Set(); }
  const fromAudit = unseen.find(q => q.skills.some(s => missed.has(s)));
  if (fromAudit) return { item: fromAudit, reason: "audit" };
  // 3 · a skill the ATS shows missing in the jobs they saved or applied to — the most-asked first.
  const ats = atsMissingTerms(db, userId);
  if (ats.length) {
    const rank = new Map(ats.map((t, i) => [t, i]));
    const best = unseen.map(q => ({ q, r: Math.min(...q.skills.map(s => rank.get(skillWords(s)) ?? Infinity)) }))
      .filter(x => Number.isFinite(x.r)).sort((a, b) => a.r - b.r)[0];
    if (best) return { item: best.q, reason: "ats" };
  }
  // 4 · the aim — ⭐ 45n (D154 P1 step 3): first a GAP on Your map for the aim (the aim role's skills not yet proven, the
  // most-demanded first — roleReadiness's moves, the same reading Your map shows), then any question for the aim's role.
  // aimGaps may be a function — read only when the pick reaches this step (roleReadiness reads the Atlas).
  let gaps = null; try { gaps = typeof aimGaps === "function" ? aimGaps() : aimGaps; } catch { gaps = null; }
  if (gaps?.length) {
    const rank = new Map(gaps.map((s, i) => [skillWords(s), i]));
    const best = unseen.map(q => ({ q, r: Math.min(...q.skills.map(s => rank.get(skillWords(s)) ?? Infinity)) }))
      .filter(x => Number.isFinite(x.r)).sort((a, b) => a.r - b.r)[0];
    if (best) return { item: best.q, reason: "aim_gap" };
  }
  const forAim = aimRole ? unseen.find(q => String(q.role || "").toLowerCase() === String(aimRole).toLowerCase()) : null;
  if (forAim) return { item: forAim, reason: "aim" };
  // 5 · anything new.
  if (unseen.length) return { item: unseen[0], reason: "any" };
  return null;
}

const REASON_WORDS = { review: "a review that's due", audit: "a skill your audit flagged", ats: "a skill your saved jobs ask for",
  aim: "your aim's role", aim_gap: "a gap on your map for your aim", any: "something new" };

function lessonsFor(db, item) {
  let learn = null; try { learn = learnContent(db); } catch { learn = null; }
  return (item.pieces || []).map(p => {
    let info = null; try { info = learn ? learnStepInfo(learn, p) : null; } catch { info = null; }
    return info ? { label: info.title || info.label || p, stepId: p, path: learnStepPath(p) } : null;
  }).filter(Boolean);
}

/**
 * ⭐ 45n (owner 11-08, decision (6): "D155's decks ARE P4's mini-lessons") · the approved five-slide decks for this item —
 * a deck whose check IS this question first, then decks sharing one of its skills; at most two.
 */
function decksFor(item) {
  let decks = []; try { decks = approvedDecks(); } catch { decks = []; }
  const skills = new Set(item.skills || []);
  const own = decks.filter(d => (d.questions || []).includes(item.id));
  const near = decks.filter(d => !own.includes(d) && (d.skills || []).some(s => skills.has(s)));
  return [...own, ...near].slice(0, 2).map(d => ({ id: d.id, title: d.title }));
}

/** Days in a row with an answered daily question — ⭐ 45n (D154 P7) FORGIVING: one missed day in any seven is a rest day. */
export function streakFor(db, userId, day) {
  const days = db.prepare(`SELECT day FROM daily_questions WHERE user_id = ? AND answered_at IS NOT NULL ORDER BY day DESC LIMIT 400`).all(userId).map(r => r.day);
  return forgivingStreak(days, day).days;
}

/** Today's question: { day, reason, reasonWords, question (served), answered?, result?, streak }. */
export function todaysQuestion(db, userId, day, { aimRole = null, aimGaps = null } = {}) {
  if (!DAY_RE.test(String(day || ""))) throw bad(400, "bad_day", "Which day is it for you?");
  let row = db.prepare(`SELECT * FROM daily_questions WHERE user_id = ? AND day = ?`).get(userId, day);
  if (!row) {
    const pick = pickDaily(db, userId, day, { aimRole, aimGaps });
    if (!pick) return { day, question: null, streak: streakFor(db, userId, day) };
    db.prepare(`INSERT OR IGNORE INTO daily_questions (user_id, day, question_id, reason, created_at) VALUES (?, ?, ?, ?, unixepoch())`)
      .run(userId, day, pick.item.id, pick.reason);
    row = db.prepare(`SELECT * FROM daily_questions WHERE user_id = ? AND day = ?`).get(userId, day);
  }
  const [item] = questions(db, { ids: [row.question_id] });
  if (!item) return { day, question: null, streak: streakFor(db, userId, day) };
  const out = { day, reason: row.reason, reasonWords: REASON_WORDS[row.reason] || null, question: servedQuestion(item), streak: streakFor(db, userId, day) };
  if (row.answered_at) out.result = resultOf(db, item, row.chosen, !!row.correct, row.response_json ? JSON.parse(row.response_json) : null);
  return out;
}

function resultOf(db, item, chosen, correct, response = null) {
  // ⭐ D154 P2: a match / order answer → per pair / position right or not, the key, and the why.
  if (isStructured(item)) {
    const j = response ? judgeStructured(item, response) : { parts: [], answer: item.answer, why: item.why };
    return { correct, response, parts: j.parts, answer: item.answer, why: item.why, lessons: lessonsFor(db, item), decks: decksFor(item) };
  }
  return { chosen, correct, correctIndex: item.correct, why: { chosen: item.why[chosen] || null, right: correct ? null : item.why[item.correct] || null, rightChoice: correct ? null : item.choices[item.correct] },
    lessons: lessonsFor(db, item), decks: decksFor(item) };
}

/** Answer today's question — once. */
export function answerToday(db, userId, day, { chosen, response = null, ms = null }) {
  if (!DAY_RE.test(String(day || ""))) throw bad(400, "bad_day", "Which day is it for you?");
  const row = db.prepare(`SELECT * FROM daily_questions WHERE user_id = ? AND day = ?`).get(userId, day);
  if (!row) throw bad(404, "no_question", "Open today's question first.");
  if (row.answered_at) throw bad(409, "answered", "You've answered today's question — come back tomorrow.");
  const resp = Array.isArray(response) ? response.map(Number) : null;
  const { correct } = recordAnswer(db, { questionId: row.question_id, userId, surface: "daily", chosen: resp ? -1 : Number(chosen), response: resp, ms });
  const ch = resp ? -1 : Number(chosen);
  db.prepare(`UPDATE daily_questions SET chosen = ?, correct = ?, ms = ?, response_json = ?, answered_at = unixepoch() WHERE user_id = ? AND day = ?`)
    .run(ch, correct ? 1 : 0, Number.isFinite(ms) ? Math.round(ms) : null, resp ? JSON.stringify(resp) : null, userId, day);
  const [item] = questions(db, { ids: [row.question_id] });
  return { ...resultOf(db, item, ch, correct, resp), streak: streakFor(db, userId, day) };
}
