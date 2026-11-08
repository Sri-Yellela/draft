// services/learn/practiceProgress.js — ⭐ D154 P6 + P7 (45n) · PROGRESS THAT COMES FROM PROOF, NOT VOLUME.
//
// P6 · a QUIET per-skill accuracy card: for each skill the person has answered at least MIN_ANSWERS questions on (any
//      surface — daily, audit, Check, Play), the share they got right, over the last WINDOW answers per skill. No curve,
//      no prediction, no invented progress (D154: "no invented progress curves") — only counts the person produced.
// P7 · the LEVEL is read from PROOF: how many skills are checked or built (D169, services/yourSkills.js — the same states
//      Your map shows). Answering more questions never raises it; proving a skill does. The words never promise a job.
//    · a FORGIVING streak: one missed day in any seven is a rest day and keeps the streak (Duolingo-style freezes are
//      volume rewards; this is a fixed allowance, nothing to buy or earn). Two missed days in a row end it.
// ⛔ D17: no model. Pure reads over the database.
import { yourSkillStates } from "../yourSkills.js";

export const PROGRESS = Object.freeze({ MIN_ANSWERS: 3, WINDOW: 20, REST_EVERY: 7 });
const safe = (fn, d) => { try { return fn(); } catch { return d; } };
const dayOf = (sec) => new Date(sec * 1000).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

/** P6 · { skills: [{ skill, answered, right, share }] } — most-answered first; only skills with MIN_ANSWERS or more. */
export function skillAccuracy(db, userId) {
  const rows = safe(() => db.prepare(`SELECT a.correct, q.skills_json FROM learn_question_answers a JOIN learn_questions q ON q.id = a.question_id
      WHERE a.user_id = ? ORDER BY a.answered_at DESC LIMIT 2000`).all(userId), []);
  const per = new Map();
  for (const r of rows) {
    let skills = []; try { skills = JSON.parse(r.skills_json || "[]"); } catch { skills = []; }
    for (const s of new Set(skills)) {
      const e = per.get(s) || { skill: s, answered: 0, right: 0 };
      if (e.answered >= PROGRESS.WINDOW) continue;
      e.answered++; if (r.correct) e.right++;
      per.set(s, e);
    }
  }
  return { skills: [...per.values()].filter(e => e.answered >= PROGRESS.MIN_ANSWERS)
    .map(e => ({ ...e, share: Math.round((e.right / e.answered) * 100) }))
    .sort((a, b) => b.answered - a.answered || a.skill.localeCompare(b.skill)), window: PROGRESS.WINDOW };
}

const LEVELS = [[0, "Starting out"], [3, "Building"], [8, "Proven in several skills"], [15, "Proven across your field"]];
/** P7 · the level from proof: { proven, level, next: { at, word } | null }. */
export function proofLevel(db, userId) {
  const proven = safe(() => yourSkillStates(db, userId).filter(s => s.state === "checked" || s.state === "built").length, 0);
  let i = 0; for (let k = 0; k < LEVELS.length; k++) if (proven >= LEVELS[k][0]) i = k;
  const next = LEVELS[i + 1] ? { at: LEVELS[i + 1][0], word: LEVELS[i + 1][1], more: LEVELS[i + 1][0] - proven } : null;
  return { proven, level: LEVELS[i][1], next, line: `${proven} skill${proven === 1 ? "" : "s"} proven — checked or built` };
}

/**
 * P7 · the forgiving streak over answered days (newest first, 'YYYY-MM-DD'), as of `day`:
 * one single missed day is forgiven if no other was forgiven in the REST_EVERY days before it. @returns { days, rests }
 */
export function forgivingStreak(answeredDays, day) {
  const days = [...new Set(answeredDays)].sort().reverse();
  if (!days.length) return { days: 0, rests: 0 };
  let gap0 = daysBetween(days[0], day);            // 0 = answered today, 1 = yesterday, 2 = missed yesterday
  if (gap0 < 0) gap0 = 0;
  if (gap0 > 2) return { days: 0, rests: 0 };
  let n = 1, rests = 0, lastRestAt = gap0 === 2 ? 0 : -Infinity;   // lastRestAt: the streak length when the last rest was used
  if (gap0 === 2) rests = 1;
  for (let i = 1; i < days.length; i++) {
    const g = daysBetween(days[i], days[i - 1]);
    if (g === 1) { n++; continue; }
    if (g === 2 && n - lastRestAt >= PROGRESS.REST_EVERY) { rests++; lastRestAt = n; n++; continue; }
    break;
  }
  return { days: n, rests };
}

/** The P6 + P7 card: { accuracy, level, streak }. */
export function practiceProgress(db, userId, day) {
  const answered = safe(() => db.prepare(`SELECT day FROM daily_questions WHERE user_id = ? AND answered_at IS NOT NULL ORDER BY day DESC LIMIT 400`).all(userId).map(r => r.day), []);
  return { accuracy: skillAccuracy(db, userId), level: proofLevel(db, userId), streak: forgivingStreak(answered, day || dayOf(Date.now() / 1000)) };
}
