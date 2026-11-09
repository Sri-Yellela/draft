// services/atlas/points.js — ⭐ D172 (3) (owner APPROVED 11-06, docs/sketches/atlas-redesign-sketch.html → Your run) ·
// POINTS ONLY FROM PROOF, and the run they add up to.
//
// ⛔ THE RULE (D172, D154 P7): points come from PROOF — never from clicking, opening a link, reading or time spent.
// The proof draft already records, and only that:
//   · an idea explained in the person's own words  — its time, via learnEarned.explanationTimes (≥ 25 words, a paste refused; D117 C8)
//   · a build finished                              — learn_builds (a link to what they built)
//   · a skill CHECKED                               — skill_proofs state 'checked' via 'check' (a PASSED quick check, D169)
//   · a skill BUILT                                 — skill_proofs state 'built' via 'link' (a validated proof link, D169)
// D142's readiness check is "not a grade" and has no pass mark, so it earns nothing; an opened link earns nothing.
// proof_points (migration 226) holds one row per piece of proof, keyed (user, kind, ref): the same proof never pays
// twice, a skill pays for its FIRST check and its first build only. syncPoints fills it from the records (retroactive,
// idempotent). Every number below is defined here and nowhere else (D173 (4)).
import { learnContent } from "../learn/learnContent.js";
import { earnedMarks, explanationTimes } from "../learn/learnEarned.js";
import { stepState, checkpointId, buildId, itemsToOpen, buildRequired } from "../../shared/learnStepState.js";
import { listYourSkills } from "../yourSkills.js";
import { approvedDecks } from "../learn/learnDecks.js";   // A154: the run's "one deck" quest

export const POINTS = Object.freeze({ explained: 10, learn_build: 60, skill_checked: 40, skill_built: 60 });
/** The Library's ladder (the sketch: "Level 2: Building blocks · 340 of 530 points to Level 3"). */
export const LEVELS = Object.freeze([
  { n: 1, name: "Foundations", at: 0 },
  { n: 2, name: "Building blocks", at: 150 },
  { n: 3, name: "Grow past senior", at: 530 },
  { n: 4, name: "Lead", at: 1500 },
]);
const DAY = 86400;
const safe = (fn, d) => { try { return fn(); } catch { return d; } };

/** Every piece of proof the person has, as { kind, ref, points, at } — read from the proof records only. */
export function proofEvents(db, userId) {
  const out = [];
  // The checkpoint and its time only — the words stay with learnEarned.js, their one reader (d117ExplanationsPrivate).
  for (const r of explanationTimes(db, userId)) out.push({ kind: "explained", ref: r.ref, points: POINTS.explained, at: r.at });
  for (const r of safe(() => db.prepare(`SELECT step_id AS ref, created_at AS at FROM learn_builds WHERE user_id = ?`).all(userId), []))
    out.push({ kind: "learn_build", ref: r.ref, points: POINTS.learn_build, at: r.at });
  // A skill's FIRST check and FIRST build — later ones prove nothing new.
  for (const r of safe(() => db.prepare(`SELECT skill_key AS ref, state, via, MIN(created_at) AS at FROM skill_proofs
      WHERE user_id = ? AND ((state = 'checked' AND via = 'check') OR (state = 'built' AND via = 'link')) GROUP BY skill_key, state`).all(userId), [])) {
    const kind = r.state === "checked" ? "skill_checked" : "skill_built";
    out.push({ kind, ref: r.ref, points: POINTS[kind], at: r.at });
  }
  return out;
}

/** Fill proof_points from the proof records. Idempotent: a row already there is left as it is. @returns rows added */
export function syncPoints(db, userId) {
  const ins = safe(() => db.prepare(`INSERT OR IGNORE INTO proof_points (user_id, kind, ref, points, earned_at) VALUES (?, ?, ?, ?, ?)`), null);
  if (!ins) return 0;
  let added = 0;
  db.transaction(() => { for (const e of proofEvents(db, userId)) added += ins.run(userId, e.kind, e.ref, e.points, e.at).changes; })();
  return added;
}

/** The level a total reaches: { n, name, at, next: { n, name, at } | null, toNext, pct }. Pure. */
export function levelOf(total) {
  let i = 0;
  while (i + 1 < LEVELS.length && total >= LEVELS[i + 1].at) i++;
  const cur = LEVELS[i], next = LEVELS[i + 1] || null;
  return { ...cur, next, toNext: next ? next.at - total : 0,
    pct: next ? Math.floor(((total - cur.at) / (next.at - cur.at)) * 100) : 100 };
}

/**
 * ⭐ D178-4 · THE STREAK COUNTS DAYS WITH PROOF, NOT VISITS — and ONE REST DAY A WEEK is automatic: a single day without
 * proof in a (Monday–Sunday, UTC) week does not break it; a second one does. Today still open does not break it either.
 * Pure: `days` = a Set of UTC day numbers with proof. @returns { count (proof days in the streak), rest: Set of rest days }
 */
const weekOf = (d) => Math.floor((d + 3) / 7);   // day 0 (1970-01-01) was a Thursday → weeks start on Monday
// ⭐ A155 (45o, the D178 picks: "the person can also choose weekdays only"): with it on, a Saturday or Sunday without proof
// neither breaks the streak nor uses the week's rest day — it is simply not a day that counts. A weekend day WITH proof
// still lights and counts.
export const isWeekend = (d) => { const w = (d + 4) % 7; return w === 0 || w === 6; };   // 0 = Sunday, 6 = Saturday
export function streakRun(days, endDay, { weekdaysOnly = false } = {}) {
  const rest = new Set();
  let d = endDay, n = 0;
  if (!days.has(d)) d--;                         // today isn't over: start from yesterday
  for (let guard = 0; guard < 4000; d--, guard++) {
    if (days.has(d)) { n++; continue; }
    if (weekdaysOnly && isWeekend(d)) continue;
    const w = weekOf(d);
    if ([...rest].some(r => weekOf(r) === w)) break;
    if (!days.has(d - 1)) break;                  // a rest day sits between two proof days
    rest.add(d);
  }
  return { count: n, rest };
}
export function streakOf(days, now = Math.floor(Date.now() / 1000), opts = {}) { return streakRun(days, Math.floor(now / DAY), opts).count; }
/** The longest streak ever (the same rule), for "Best: N days" — never shames a broken one. */
export function bestStreak(days, opts = {}) {
  let best = 0;
  for (const d of days) best = Math.max(best, streakRun(days, d, opts).count);   // the best run ending at any proof day
  return best;
}
/** The month on Your run: the last 28 days, oldest first — { day, lit, rest, today }. */
export function monthOf(days, now = Math.floor(Date.now() / 1000), opts = {}) {
  const today = Math.floor(now / DAY), { rest } = streakRun(days, today, opts);
  return Array.from({ length: 28 }, (_, i) => { const d = today - 27 + i;
    return { day: d, lit: days.has(d), rest: rest.has(d), today: d === today, off: !!opts.weekdaysOnly && isWeekend(d) && !days.has(d) }; });
}

/**
 * ⭐ D178-4 · MARKS, EARNED FOR WHOLES — never for clicks: finishing a whole MODULE (every lesson complete by the one earned
 * rule) earns its mark, dated by the last piece of proof that finished it. Pure over the Learn document and the person's
 * earned marks (id → time). @returns { earned: [{ module, title, at }] newest first, next: [{ module, title, done, total, pct }] }
 */
export function marksFrom(doc, marks = {}) {
  const earned = [], next = [];
  (doc?.PARTS || []).forEach((part, pi) => {
    const steps = (part.phases || []).flatMap(ph => ph.steps || []);
    if (!steps.length) return;
    const done = steps.filter(st => stepState(st, marks).complete).length;
    const title = String(part.t || "").replace(/^Part\s+\d+\s*:\s*/i, "");
    if (done === steps.length) {
      const ids = steps.flatMap(st => [...itemsToOpen(st).map(it => it.id), ...(st.c || []).map((_, i) => checkpointId(st.id, i)), ...(buildRequired(st) ? [buildId(st.id)] : [])]);
      earned.push({ module: pi + 1, title, at: Math.max(0, ...ids.map(id => Number(marks[id]) || 0)) });
    } else next.push({ module: pi + 1, title, done, total: steps.length, pct: Math.floor((done / steps.length) * 100) });
  });
  return { earned: earned.sort((a, b2) => b2.at - a.at), next: next.sort((a, b2) => b2.pct - a.pct).slice(0, 3) };
}

/**
 * ⭐ D178-4 · THE PROOF PAGE'S LEARNING — what the person finished and proved in Atlas, each with its date, for their
 * public page (D109 P3, only when they switch it on: proof_pages.show_learning, migration 227). Proof only, never clicks:
 * the modules finished (marksFrom — a whole module by the one earned rule), the skills passed in a quick check or backed
 * by a proof link (skill_proofs, the first of each), and the builds (learn_builds, the link they supplied). No points, no
 * level, no streak — those are the person's own motivation, not evidence. Nothing here is a certificate.
 * @returns { modules: [{ title, at }], skills: [{ name, how, at, url }], builds: [{ lesson, url, at }] } — newest first
 */
export function learningProof(db, userId) {
  const doc = safe(() => learnContent(db), null);
  const titles = new Map();
  for (const p of doc?.PARTS || []) for (const ph of p.phases || []) for (const st of ph.steps || []) titles.set(st.id, st.t);
  const modules = safe(() => marksFrom(doc, earnedMarks(db, userId)).earned, []).map(m => ({ title: m.title, at: m.at }));
  const skills = safe(() => db.prepare(`SELECT skill, state, MIN(created_at) AS at,
      (SELECT url FROM skill_proofs s2 WHERE s2.user_id = s.user_id AND s2.skill_key = s.skill_key AND s2.state = 'built' AND s2.via = 'link'
        ORDER BY created_at LIMIT 1) AS url
      FROM skill_proofs s WHERE user_id = ? AND ((state = 'checked' AND via = 'check') OR (state = 'built' AND via = 'link'))
      GROUP BY skill_key, state ORDER BY at DESC`).all(userId), [])
    .map(r => ({ name: r.skill, how: r.state === "built" ? "built" : "checked", at: r.at, url: r.state === "built" ? r.url || null : null }));
  // A skill both checked and built shows once, as built (the stronger proof), dated by its first proof.
  const byName = new Map();
  for (const s of skills) {
    const cur = byName.get(s.name);
    if (!cur) byName.set(s.name, s);
    else byName.set(s.name, s.how === "built" ? { ...s, at: Math.min(s.at, cur.at) } : { ...cur, at: Math.min(s.at, cur.at) });
  }
  const builds = safe(() => db.prepare(`SELECT step_id, url, created_at AS at FROM learn_builds WHERE user_id = ? ORDER BY created_at DESC`).all(userId), [])
    .map(r => ({ lesson: titles.get(r.step_id) || null, url: r.url, at: r.at })).filter(b => b.lesson);
  return { modules, skills: [...byName.values()].sort((a, b) => b.at - a.at), builds };
}

/** The first idea not yet explained, in the path's order — the "explain one idea" quest. */
function nextExplain(db, userId) {
  const doc = safe(() => learnContent(db), null);
  if (!doc) return null;
  const marks = safe(() => earnedMarks(db, userId), {});
  for (const p of doc.PARTS || []) for (const ph of p.phases || []) for (const st of ph.steps || []) {
    if (stepState(st, marks).complete) continue;
    const i = (st.c || []).findIndex((_, k) => !marks[checkpointId(st.id, k)]);
    if (i >= 0) return { stepId: st.id, lesson: st.t, idea: st.c[i] };
  }
  return null;
}

/**
 * ⭐ A155 (45o, the D178 picks: "a day is lit when you do one real thing: pass a check, explain a checkpoint in your own
 * words, answer Today's question, finish a build, add a proof link") — ONE set of proof days for ONE streak: the proof
 * points' days + the days Today's question was answered (its own local day) + the days a proof link was added.
 */
export function proofDays(db, userId, pointRows = null) {
  const rows = pointRows || safe(() => db.prepare(`SELECT earned_at AS at FROM proof_points WHERE user_id = ?`).all(userId), []);
  const days = new Set(rows.map(r => Math.floor(r.at / DAY)));
  for (const r of safe(() => db.prepare(`SELECT day FROM daily_questions WHERE user_id = ? AND answered_at IS NOT NULL`).all(userId), [])) {
    const t = Date.parse(`${r.day}T00:00:00Z`);
    if (Number.isFinite(t)) days.add(Math.floor(t / 86400000));
  }
  for (const r of safe(() => db.prepare(`SELECT created_at AS at FROM profile_evidence WHERE user_id = ?`).all(userId), [])) days.add(Math.floor(r.at / DAY));
  return days;
}
/** A155 · Atlas's own choices (migration 251; no row = the defaults). */
export function atlasPrefs(db, userId) {
  const r = safe(() => db.prepare(`SELECT weekdays_only FROM atlas_prefs WHERE user_id = ?`).get(userId), null);
  return { weekdaysOnly: !!r?.weekdays_only };
}
export function setAtlasPrefs(db, userId, body = {}) {
  const w = body.weekdaysOnly === true ? 1 : 0;
  db.prepare(`INSERT INTO atlas_prefs (user_id, weekdays_only, updated_at) VALUES (?, ?, unixepoch())
    ON CONFLICT(user_id) DO UPDATE SET weekdays_only = excluded.weekdays_only, updated_at = excluded.updated_at`).run(userId, w);
  return atlasPrefs(db, userId);
}
/** A155 · the ONE streak (the run's), for any surface that shows a streak — Today's question included. */
export function atlasStreak(db, userId, now = Math.floor(Date.now() / 1000)) {
  const prefs = atlasPrefs(db, userId);
  return streakOf(proofDays(db, userId), now, prefs);
}

/**
 * The person's run: points, level, streak, this week, the latest proof, and today's quests (each from real data —
 * a quest whose thing does not exist is left out, never invented). Syncs first.
 */
export function yourRun(db, userId, { now = Math.floor(Date.now() / 1000) } = {}) {
  syncPoints(db, userId);
  const rows = safe(() => db.prepare(`SELECT kind, ref, points, earned_at AS at FROM proof_points WHERE user_id = ? ORDER BY earned_at DESC`).all(userId), []);
  const total = rows.reduce((a, r) => a + r.points, 0);
  const dayOf = (t) => Math.floor(t / DAY);
  const days = proofDays(db, userId, rows);   // A155: every real act lights the day — one streak
  const prefs = atlasPrefs(db, userId);
  const weekStart = now - 7 * DAY;
  const today = dayOf(now);
  const earnedToday = (kind) => rows.some(r => r.kind === kind && dayOf(r.at) === today);
  const quests = [];
  // ⭐ A154 (45o, the D172 sketch: "Today · about 5 minutes as three quest cards (the daily question · one deck · prove it in
  // a minute)"). The daily question and a deck light the day / teach, but earn no POINTS — points stay proof-only (D172).
  const answeredToday = safe(() => !!db.prepare(`SELECT 1 FROM daily_questions WHERE user_id = ? AND answered_at >= ? LIMIT 1`).get(userId, today * DAY), false);
  quests.push({ id: "today", title: "Today's question", detail: "About two minutes — answering lights today.", points: null, minutes: 2, done: answeredToday });
  const mine = new Set(safe(() => listYourSkills(db, userId).skills.map(s => String(s.name).toLowerCase()), []));
  const decks = safe(() => approvedDecks(), []);
  const deck = decks.find(d => (d.skills || []).some(k => mine.has(String(k).toLowerCase()))) || decks[0] || null;
  if (deck) quests.push({ id: "deck", title: "Read one deck", detail: deck.title, deckId: deck.id, points: null, minutes: 5, done: false });
  const ex = nextExplain(db, userId);
  if (ex) quests.push({ id: "explain", title: "Explain one idea", detail: ex.idea, lesson: ex.lesson, stepId: ex.stepId, points: POINTS.explained,
    minutes: 2, done: earnedToday("explained") });
  const skill = safe(() => listYourSkills(db, userId).skills.find(s => s.action === "check"), null);
  if (skill) quests.push({ id: "prove", title: `Check ${skill.name}`, detail: "A one-minute quick check — pass it and the skill counts as proven.",
    skill: skill.name, points: POINTS.skill_checked, minutes: 1, done: earnedToday("skill_checked") });
  return {
    total, level: levelOf(total), streak: streakOf(days, now, prefs), weekdaysOnly: prefs.weekdaysOnly,
    // ⭐ D178-4: the best streak, the month of lit squares, the marks, and what proof has unlocked for the résumé.
    best: bestStreak(days, prefs), month: monthOf(days, now, prefs),
    marks: safe(() => marksFrom(learnContent(db), earnedMarks(db, userId)), { earned: [], next: [] }),
    proven: safe(() => listYourSkills(db, userId).skills.filter(s => (s.state === "checked" || s.state === "built") && !s.onResume)
      .map(s => ({ name: s.name, state: s.state })), []),
    week: rows.filter(r => r.at >= weekStart).reduce((a, r) => a + r.points, 0),
    latest: rows.slice(0, 5),
    quests,
    rule: "Points come only from proof: an idea explained in your own words, a build finished, a skill checked.",
  };
}
