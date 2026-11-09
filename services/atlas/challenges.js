// services/atlas/challenges.js — ⭐ D172 / A154 (45s, owner 11-08: "build league and challenges, can merge them later") ·
// CHALLENGES, behind their own switch (app_settings atlas_challenges_enabled, OFF by default):
//
//   BEAT THE BAR — the audit (D150 T05–T07) as a shareable score: a KEPT audit gets a link (/atlas/bar/<code>) that says
//                  "I'm 5 of 6 on the mid Data Engineer bar — do you clear it?" and nothing else (no name, no handle).
//   TIME ATTACK  — five reviewed four-choice questions for a role, against the SERVER's clock (D142's rule: the clock
//                  starts when the server serves a question). ⛔ Extended time (×2) and an untimed mode are always offered
//                  and never penalised (D142).
//   FRIDAY DUEL  — league members only: the SAME five questions for everyone in the pod this week (seeded by pod + week),
//                  open Friday to Sunday (UTC); the pod's finished scores side by side, handles only.
//
// ⛔ Challenges earn NO points — points come only from proof (D172, services/atlas/points.js). Only reviewed ('live')
// questions are asked (services/learn/learnQuestions.js questions, the one reader); every answer is recorded there too.
import crypto from "node:crypto";
import { getSetting, settingTruthy } from "../appSettings.js";
import { questions, servedQuestion, recordAnswer, isStructured } from "../learn/learnQuestions.js";
import { auditRoles } from "../audit/auditRoleCard.js";
import { auditResult } from "../audit/auditSession.js";
import { leagueEnabled, weekOf, weekStart } from "./league.js";

export const CHALLENGES_SETTING = "atlas_challenges_enabled";
export const CHALLENGE = Object.freeze({ QUESTIONS: 5, SECONDS: 20, EXTENDED_FACTOR: 2, GRACE_MS: 1500,
  MODES: Object.freeze(["timed", "extended", "untimed"]), DUEL_DAYS: Object.freeze([5, 6, 0]) });
const safe = (fn, d) => { try { return fn(); } catch { return d; } };
const bad = (status, code, message) => Object.assign(new Error(message), { status, code });
const hash = (s) => crypto.createHash("sha1").update(String(s)).digest("hex");

export const challengesEnabled = (db) => settingTruthy(getSetting(db, CHALLENGES_SETTING));

const secondsFor = (mode) => (mode === "untimed" ? null : mode === "extended" ? CHALLENGE.SECONDS * CHALLENGE.EXTENDED_FACTOR : CHALLENGE.SECONDS);
const served = (q, mode) => ({ ...servedQuestion(q), seconds: secondsFor(mode) });
const runOf = (db, id, userId) => {
  const r = db.prepare(`SELECT * FROM challenge_runs WHERE id = ? AND user_id = ?`).get(Number(id), userId);
  return r ? { ...r, items: JSON.parse(r.questions_json), answers: JSON.parse(r.answers_json || "[]") } : null;
};

/** PURE. Five items, seeded: the same seed always gives the same five (the duel's fairness). Four-choice only. */
export function seededFive(pool, seed, count = CHALLENGE.QUESTIONS) {
  return pool.filter(q => !isStructured(q)).map(q => ({ q, k: hash(`${seed}:${q.id}`) }))
    .sort((a, b) => a.k.localeCompare(b.k)).slice(0, count).map(x => x.q);
}

function startRun(db, userId, { kind, ref, items, mode, now }) {
  if (!CHALLENGE.MODES.includes(mode)) throw bad(400, "bad_mode", "Pick timed, extended time, or untimed.");
  if (items.length < 3) throw bad(409, "too_few_questions", "There aren't enough reviewed questions for this yet.");
  const id = db.prepare(`INSERT INTO challenge_runs (user_id, kind, ref, questions_json, answers_json, mode, total, served_at, started_at)
      VALUES (?, ?, ?, ?, '[]', ?, ?, ?, ?)`).run(userId, kind, ref, JSON.stringify(items.map(q => q.id)), mode, items.length, now, Math.floor(now / 1000)).lastInsertRowid;
  return { runId: Number(id), kind, mode, total: items.length, number: 1, question: served(items[0], mode) };
}

/** Time attack: five reviewed questions for a role the audit can ask about (its slug). */
export function startTimeAttack(db, userId, { role, mode = "timed" } = {}, { now = Date.now() } = {}) {
  const r = auditRoles(db).find(x => x.slug === String(role || ""));
  if (!r) throw bad(404, "no_role", "Pick a role the audit covers.");
  const items = seededFive(questions(db, { role: r.bankRole }), `${userId}:${now}`);
  return startRun(db, userId, { kind: "time_attack", ref: r.slug, items, mode, now });
}

/** Answer the question on screen; the server's clock says whether it was in time. */
export function answerRun(db, userId, runId, { questionId, chosen } = {}, { now = Date.now() } = {}) {
  const run = runOf(db, runId, userId);
  if (!run) throw bad(404, "not_found", "No such challenge.");
  if (run.finished_at) throw bad(409, "finished", "This challenge is finished.");
  const at = run.answers.length;
  if (String(questionId) !== run.items[at]) throw bad(409, "out_of_turn", "Answer the question on screen.");
  const { correct } = recordAnswer(db, { questionId: String(questionId), userId, surface: `challenge:${run.kind}`, chosen: Number(chosen), ms: now - run.served_at });
  const sec = secondsFor(run.mode);
  const inTime = sec == null || now - run.served_at <= sec * 1000 + CHALLENGE.GRACE_MS;
  const answers = [...run.answers, { id: String(questionId), chosen: Number(chosen), correct, inTime, ms: now - run.served_at }];
  const done = answers.length >= run.items.length;
  const score = answers.filter(a => a.correct && a.inTime).length;
  db.prepare(`UPDATE challenge_runs SET answers_json = ?, served_at = ?, score = ?, finished_at = ? WHERE id = ?`)
    .run(JSON.stringify(answers), done ? null : now, score, done ? Math.floor(now / 1000) : null, run.id);
  const [q] = questions(db, { ids: [String(questionId)] });
  const next = done ? null : questions(db, { ids: [run.items[answers.length]] })[0];
  return { correct, inTime, correctIndex: q?.correct ?? null, why: q ? (q.why?.[q.correct] || null) : null,
    number: answers.length + (done ? 0 : 1), total: run.items.length, done, score: done ? score : undefined,
    question: next ? served(next, run.mode) : null,
    line: done ? `${score} of ${run.items.length}${run.mode === "timed" ? " in time" : run.mode === "extended" ? " with extended time" : " untimed"}` : undefined };
}

// ── the Friday duel ────────────────────────────────────────────────────────────────────────────────────────────────
const memberOf = (db, userId) => safe(() => db.prepare(`SELECT * FROM league_members WHERE user_id = ?`).get(userId), null);
export const duelOpen = (now) => CHALLENGE.DUEL_DAYS.includes(new Date(now).getUTCDay());
const duelRef = (m, week) => `${m.pod_key}#${m.tier}#${week}`;

/** The pod's question pool: the roles in the pod's field when the audit has any, else every role. */
function duelPool(db, field) {
  const roles = safe(() => auditRoles(db), []);
  const inField = field ? roles.filter(r => r.family === field || String(r.family || "").toLowerCase() === String(field).toLowerCase()) : [];
  const use = inField.length ? inField : roles;
  return use.flatMap(r => questions(db, { role: r.bankRole }));
}

/** This week's duel for a member: open or not, the pod's scores (handles only), and the person's own run. */
export function duelState(db, userId, { now = Date.now() } = {}) {
  if (!leagueEnabled(db)) return { available: false, why: "league_off" };
  const me = memberOf(db, userId);
  if (!me) return { available: false, why: "not_member", words: "Join this week's league to duel your pod." };
  const week = weekOf(Math.floor(now / 1000));
  const ref = duelRef(me, week);
  const scores = db.prepare(`SELECT m.handle, c.score, c.total, c.user_id FROM challenge_runs c JOIN league_members m ON m.user_id = c.user_id
      WHERE c.kind = 'friday_duel' AND c.ref = ? AND c.finished_at IS NOT NULL ORDER BY c.score DESC, c.finished_at`).all(ref)
    .map(r => ({ handle: r.handle, score: r.score, total: r.total, you: r.user_id === userId }));
  const mine = db.prepare(`SELECT id, finished_at FROM challenge_runs WHERE kind = 'friday_duel' AND ref = ? AND user_id = ? ORDER BY id DESC LIMIT 1`).get(ref, userId);
  return { available: true, open: duelOpen(now), played: !!mine?.finished_at, scores,
    opensAt: weekStart(week) + 4 * 86400,
    words: "The same five questions as everyone in your pod this week — Friday to Sunday." };
}

/** Start the duel (members, Friday–Sunday, once a week). */
export function startDuel(db, userId, { mode = "timed" } = {}, { now = Date.now() } = {}) {
  if (!leagueEnabled(db)) throw bad(404, "not_available", "This isn't available yet.");
  const me = memberOf(db, userId);
  if (!me) throw bad(403, "not_member", "Join this week's league to duel your pod.");
  if (!duelOpen(now)) throw bad(409, "not_open", "The duel opens on Friday.");
  const week = weekOf(Math.floor(now / 1000));
  const ref = duelRef(me, week);
  if (db.prepare(`SELECT 1 FROM challenge_runs WHERE kind = 'friday_duel' AND ref = ? AND user_id = ?`).get(ref, userId))
    throw bad(409, "already_played", "You've played this week's duel.");
  const items = seededFive(duelPool(db, me.field), ref);
  return startRun(db, userId, { kind: "friday_duel", ref, items, mode, now });
}

// ── beat the bar ───────────────────────────────────────────────────────────────────────────────────────────────────
/** The person's kept audits, newest first, with their share link when one was made. */
export function myBars(db, userId) {
  const rows = safe(() => db.prepare(`SELECT token, role_slug, level, claimed_at FROM audit_sessions WHERE claimed_by = ? ORDER BY claimed_at DESC LIMIT 10`).all(userId), []);
  return rows.map(r => {
    const res = safe(() => auditResult(db, r.token), null);
    const share = safe(() => db.prepare(`SELECT share_code FROM challenge_runs WHERE kind = 'beat_the_bar' AND ref = ? AND user_id = ?`).pluck().get(r.token, userId), null);
    return res ? { token: r.token, role: res.role, right: res.right, of: res.of, line: res.share, shareCode: share || null } : null;
  }).filter(Boolean);
}

/** Make (or return) the share link for one kept audit. The shared page carries the score line only. */
export function shareBar(db, userId, token, { now = Math.floor(Date.now() / 1000) } = {}) {
  const s = safe(() => db.prepare(`SELECT token FROM audit_sessions WHERE token = ? AND claimed_by = ?`).get(String(token), userId), null);
  if (!s) throw bad(404, "not_found", "Keep an audit result first.");
  const have = db.prepare(`SELECT share_code FROM challenge_runs WHERE kind = 'beat_the_bar' AND ref = ? AND user_id = ?`).pluck().get(s.token, userId);
  if (have) return { shareCode: have };
  const res = auditResult(db, s.token);
  const code = crypto.randomBytes(9).toString("base64url");
  db.prepare(`INSERT INTO challenge_runs (user_id, kind, ref, questions_json, answers_json, mode, score, total, started_at, finished_at, share_code)
      VALUES (?, 'beat_the_bar', ?, '[]', '[]', 'untimed', ?, ?, ?, ?, ?)`).run(userId, s.token, res.right, res.of, now, now, code);
  return { shareCode: code };
}

/** The public share page's data — the score line and the role to try; nothing about who. */
export function sharedBar(db, code) {
  if (!/^[A-Za-z0-9_-]{8,24}$/.test(String(code || ""))) return null;
  const r = safe(() => db.prepare(`SELECT ref FROM challenge_runs WHERE kind = 'beat_the_bar' AND share_code = ?`).get(String(code)), null);
  if (!r) return null;
  const res = safe(() => auditResult(db, r.ref), null);
  return res ? { role: res.role, right: res.right, of: res.of, line: res.share } : null;
}

/** The Challenges panel's one read. */
export function myChallenges(db, userId, { now = Date.now() } = {}) {
  const t = Math.floor(now / 1000);
  const best = safe(() => db.prepare(`SELECT ref, score, total, mode FROM challenge_runs WHERE user_id = ? AND kind = 'time_attack' AND finished_at >= ?
      ORDER BY score DESC, finished_at LIMIT 1`).get(userId, weekStart(weekOf(t))), null);
  return {
    bars: myBars(db, userId),
    timeAttack: { best: best || null, modes: CHALLENGE.MODES, seconds: CHALLENGE.SECONDS },
    duel: duelState(db, userId, { now }),
    rule: "Challenges earn no points — points come only from proof. Extended time and an untimed mode are always there.",
  };
}
