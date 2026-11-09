// services/atlas/league.js — ⭐ D172 (4) / A154 (45s, owner 11-08: "build league and challenges, can merge them later") ·
// THIS WEEK'S LEAGUE, your pod's rank on Your run, and the live count — each behind its OWN switch, OFF by default.
//
// ⛔ THE RULES THAT KEEP IT HONEST (D172): points come ONLY from proof (proof_points, services/atlas/points.js — never
// re-derived here); the league is OPT-IN (a row exists only because the person pressed Join), shows an anonymous HANDLE
// (never the name, the public page's handle or the picture), and the person can LEAVE at any time (the row is deleted);
// no public shaming — nobody below you is named to you as "behind", nobody is demoted, the feed shows proof, never a
// failure; a LIVE COUNT is a real count of distinct people and is shown only at or above LIVE_MIN.
//
//   POD     = the school (the profile's first Education row, else "Any school") × the field (the job profile's placement
//             category, else "Any field") × the tier (1 Bronze · 2 Silver · 3 Gold). Its real size is said.
//   WEEK    = Monday 00:00 UTC → the next Monday (the same weeks as the streak's rest day, points.js weekOf).
//   MONDAY  = the top PROMOTE (with points > 0) of each pod move up one tier, once per week (rollover, lazy: the first
//             league read of a new week does it, in one transaction, recorded in app_settings league_week_done).
//
// Switches (app_settings, Admin → Atlas → Compete): atlas_league_enabled (the league + the pod rank on Your run),
// atlas_live_count_enabled (the live count). services/atlas/challenges.js has its own (atlas_challenges_enabled).
import crypto from "node:crypto";
import { getSetting, setSetting, settingTruthy } from "../appSettings.js";
import { syncPoints, POINTS } from "./points.js";
import { listYourSkills } from "../yourSkills.js";
import { taxonomy } from "../jobs/taxonomyClassify.js";

export const LEAGUE_SETTING = "atlas_league_enabled";
export const LIVE_COUNT_SETTING = "atlas_live_count_enabled";
const WEEK_DONE_SETTING = "league_week_done";
export const LEAGUE = Object.freeze({
  PROMOTE: 5, TIERS: Object.freeze([null, "Bronze", "Silver", "Gold"]), PODIUM: 3, FEED: 3, SYNC_MAX: 80,
  LIVE_MIN: 10, LIVE_WINDOW_S: 15 * 60, ROLLOVER_WEEKS_MAX: 8,
});
const DAY = 86400, WEEK = 7 * DAY;
const safe = (fn, d) => { try { return fn(); } catch { return d; } };
const bad = (status, code, message) => Object.assign(new Error(message), { status, code });

export const leagueEnabled = (db) => settingTruthy(getSetting(db, LEAGUE_SETTING));
export const liveCountEnabled = (db) => settingTruthy(getSetting(db, LIVE_COUNT_SETTING));

/** The week number (weeks start Monday 00:00 UTC — day 0, 1970-01-01, was a Thursday). Pure. */
export const weekOf = (t) => Math.floor((Math.floor(t / DAY) + 3) / 7);
/** The unix time a week starts. Pure. */
export const weekStart = (w) => (w * 7 - 3) * DAY;

// ── handles ────────────────────────────────────────────────────────────────────────────────────────────────────────
const HANDLE_RE = /^[a-z0-9][a-z0-9._-]{2,22}[a-z0-9]$/;
const WORDS_A = ["quiet", "steady", "bright", "swift", "calm", "keen", "bold", "lucky", "sunny", "clever"];
const WORDS_B = ["otter", "heron", "falcon", "maple", "comet", "river", "fox", "lynx", "cedar", "owl"];
/** A handle suggestion that says nothing about the person. */
export function suggestHandle(rand = crypto.randomInt) {
  return `${WORDS_A[rand(WORDS_A.length)]}-${WORDS_B[rand(WORDS_B.length)]}-${rand(90) + 10}`;
}
/** A handle is 4–24 of a–z 0–9 . _ - , starts and ends with a letter or digit. Pure. */
export function validHandle(h) { return HANDLE_RE.test(String(h ?? "")); }

// ── the pod ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** The person's school and field, from what draft already holds (no question asked). */
export function podPlace(db, userId) {
  const school = safe(() => db.prepare(`SELECT school FROM profile_education WHERE user_id = ? AND school IS NOT NULL AND school != '' ORDER BY position, id LIMIT 1`).pluck().get(userId), null);
  const field = safe(() => db.prepare(`SELECT placement_category FROM domain_profiles WHERE user_id = ? AND is_active = 1 LIMIT 1`).pluck().get(userId), null);
  const fieldName = field ? safe(() => taxonomy().byId.get(field)?.name || null, null) : null;
  return { school: school ? String(school).trim() : null, field: field || null, fieldName };
}
export const podKeyOf = ({ school, field }) => `${String(school || "").toLowerCase()}|${String(field || "").toLowerCase()}`;
/** "Northeastern · Data pod". A long school name is shortened to its distinctive word ("Northeastern University" → "Northeastern"). Pure. */
export function podName({ school, field, fieldName = null }) {
  const s = school ? String(school).replace(/\b(University|College|Institute|of|the|The|School)\b/g, " ").replace(/\s+/g, " ").trim() || school : "Any school";
  const f = fieldName || (field ? String(field).replace(/[-_]/g, " ").replace(/^\w/, c => c.toUpperCase()) : "Any field");
  return `${s} · ${f} pod`;
}

const memberOf = (db, userId) => safe(() => db.prepare(`SELECT * FROM league_members WHERE user_id = ?`).get(userId), null);

/** Join — opt-in, with a handle. Joining again changes nothing (leave first to start over). */
export function joinLeague(db, userId, { handle } = {}, { now = Math.floor(Date.now() / 1000) } = {}) {
  const have = memberOf(db, userId);
  if (have) return have;
  const h = String(handle ?? "").trim().toLowerCase();
  if (!validHandle(h)) throw bad(400, "bad_handle", "A handle is 4 to 24 letters, digits, dots, dashes or underscores.");
  if (db.prepare(`SELECT 1 FROM league_members WHERE handle = ?`).get(h)) throw bad(409, "handle_taken", "Someone has that handle — try another.");
  const place = podPlace(db, userId);
  db.prepare(`INSERT INTO league_members (user_id, handle, school, field, pod_key, tier, joined_at) VALUES (?, ?, ?, ?, ?, 1, ?)`)
    .run(userId, h, place.school, place.field, podKeyOf(place), now);
  return memberOf(db, userId);
}

/** Leave — any time; the row goes, so the person is in no pod, no feed and no count. */
export function leaveLeague(db, userId) {
  return { left: db.prepare(`DELETE FROM league_members WHERE user_id = ?`).run(userId).changes > 0 };
}

/** Points from proof between two times, per member. */
function pointsBetween(db, ids, from, to) {
  if (!ids.length) return new Map();
  const rows = db.prepare(`SELECT user_id, SUM(points) AS p FROM proof_points WHERE user_id IN (${ids.map(() => "?").join(",")})
      AND earned_at >= ? AND earned_at < ? GROUP BY user_id`).all(...ids, from, to);
  return new Map(rows.map(r => [r.user_id, r.p]));
}

/** PURE. The standings: points desc, then who joined first (a tie never depends on the order rows come back). */
export function standings(members, points) {
  return members.map(m => ({ userId: m.user_id, handle: m.handle, points: points.get(m.user_id) || 0, joinedAt: m.joined_at }))
    .sort((a, b) => b.points - a.points || a.joinedAt - b.joinedAt || a.userId - b.userId)
    .map((r, i) => ({ ...r, place: i + 1 }));
}

/**
 * Monday's promotions, once per week: for every week finished since the last one done, the top PROMOTE (with points)
 * of each pod move up a tier (Gold is the top; nobody moves down). Lazy and idempotent (league_week_done).
 */
export function rollover(db, { now = Math.floor(Date.now() / 1000) } = {}) {
  const current = weekOf(now);
  const done = Number(getSetting(db, WEEK_DONE_SETTING));
  if (!Number.isFinite(done) || done <= 0) { setSetting(db, WEEK_DONE_SETTING, String(current - 1)); return { promoted: 0 }; }
  if (done >= current - 1) return { promoted: 0 };
  let promoted = 0;
  db.transaction(() => {
    for (let w = Math.max(done + 1, current - LEAGUE.ROLLOVER_WEEKS_MAX); w <= current - 1; w++) {
      const from = weekStart(w), to = weekStart(w + 1);
      const members = db.prepare(`SELECT * FROM league_members WHERE joined_at < ?`).all(to);
      const pods = new Map();
      for (const m of members) { const k = `${m.pod_key}#${m.tier}`; (pods.get(k) || pods.set(k, []).get(k)).push(m); }
      for (const list of pods.values()) {
        const top = standings(list, pointsBetween(db, list.map(m => m.user_id), from, to)).filter(r => r.points > 0).slice(0, LEAGUE.PROMOTE);
        for (const r of top) promoted += db.prepare(`UPDATE league_members SET tier = MIN(tier + 1, 3) WHERE user_id = ? AND tier < 3`).run(r.userId).changes;
      }
    }
    setSetting(db, WEEK_DONE_SETTING, String(current - 1));
  })();
  return { promoted };
}

const FEED_WORDS = {
  skill_checked: (ref) => `proved ${String(ref).replace(/-/g, " ")}`,
  skill_built: (ref) => `built with ${String(ref).replace(/-/g, " ")}`,
  learn_build: () => "finished a build",
  explained: () => "explained an idea",
};

/** The one move that closes the gap: the first skill to check (Your run's prove quest), else explaining an idea. */
function closingMove(db, userId) {
  const skill = safe(() => listYourSkills(db, userId).skills.find(s => s.action === "check"), null);
  if (skill) return { kind: "check", label: `Prove ${skill.name}`, skill: skill.name, points: POINTS.skill_checked };
  return { kind: "explain", label: "Explain one idea", points: POINTS.explained };
}

/** This week's league for the person: not a member → the join card; a member → the pod, podium, rows, gap and feed. */
export function myLeague(db, userId, { now = Math.floor(Date.now() / 1000) } = {}) {
  rollover(db, { now });
  const me = memberOf(db, userId);
  const week = weekOf(now), from = weekStart(week), to = weekStart(week + 1);
  const resetsIn = to - now;
  if (!me) {
    const place = podPlace(db, userId);
    return { member: false, suggestion: suggestHandle(), pod: { name: podName(place) }, resetsAt: to, resetsIn,
      rule: "Points come only from proof. You join with a handle — it's all anyone sees — and you can leave any time." };
  }
  const members = db.prepare(`SELECT * FROM league_members WHERE pod_key = ? AND tier = ?`).all(me.pod_key, me.tier);
  for (const m of members.slice(0, LEAGUE.SYNC_MAX)) safe(() => syncPoints(db, m.user_id), 0);
  const ids = members.map(m => m.user_id);
  const today = Math.floor(now / DAY) * DAY;
  const nowRows = standings(members, pointsBetween(db, ids, from, now + 1));
  const before = today > from ? new Map(standings(members, pointsBetween(db, ids, from, today)).map(r => [r.userId, r.place])) : null;
  const rows = nowRows.map(r => ({ handle: r.handle, points: r.points, place: r.place, you: r.userId === userId,
    move: before ? (before.get(r.userId) || r.place) - r.place : null }));
  const mine = rows.find(r => r.you);
  const lineAt = Math.min(LEAGUE.PROMOTE, rows.length);
  const canMoveUp = me.tier < 3;
  const linePoints = rows.length > LEAGUE.PROMOTE ? rows[LEAGUE.PROMOTE - 1].points : 0;
  const inZone = canMoveUp && mine.place <= LEAGUE.PROMOTE && mine.points > 0;
  const gap = !canMoveUp || inZone ? null : Math.max(1, linePoints - mine.points + 1);
  const move = gap ? closingMove(db, userId) : null;
  const feed = safe(() => db.prepare(`SELECT p.kind, p.ref, p.points, p.earned_at AS at, m.handle FROM proof_points p
      JOIN league_members m ON m.user_id = p.user_id WHERE m.pod_key = ? AND m.tier = ? AND p.earned_at >= ?
      ORDER BY p.earned_at DESC LIMIT ?`).all(me.pod_key, me.tier, from, LEAGUE.FEED), [])
    .map(e => ({ handle: e.handle, words: (FEED_WORDS[e.kind] || (() => "proved something"))(e.ref), points: e.points, at: e.at }));
  const place = { school: me.school, field: me.field, fieldName: me.field ? safe(() => taxonomy().byId.get(me.field)?.name || null, null) : null };
  return {
    member: true, handle: me.handle, tier: { n: me.tier, name: LEAGUE.TIERS[me.tier], next: canMoveUp ? LEAGUE.TIERS[me.tier + 1] : null },
    pod: { name: podName(place), size: members.length },
    line: canMoveUp
      ? `${LEAGUE.TIERS[me.tier]} · ${podName(place)} — ${members.length} ${members.length === 1 ? "person" : "people"}. Points from proof only. The top ${LEAGUE.PROMOTE} move up to ${LEAGUE.TIERS[me.tier + 1]} on Monday.`
      : `${LEAGUE.TIERS[me.tier]} · ${podName(place)} — ${members.length} ${members.length === 1 ? "person" : "people"}. Points from proof only. Gold is the top tier.`,
    resetsAt: to, resetsIn,
    podium: rows.slice(0, LEAGUE.PODIUM),
    rows, promotionLine: canMoveUp ? lineAt : null,
    you: { place: mine.place, points: mine.points, move: mine.move },
    gap: gap ? { points: gap, words: `${gap} point${gap === 1 ? "" : "s"} to the promotion line.${move.points >= gap ? ` ${move.label} (+${move.points}) and you're in.` : ""}`, move } : null,
    feed,
    footer: "You're in the league because you joined it. Your handle is all anyone sees.",
  };
}

/** Your run's pod line: "#6 in your Northeastern · Data pod · 40 points to move up" — members only, the switch on. */
export function podRank(db, userId, { now = Math.floor(Date.now() / 1000) } = {}) {
  if (!leagueEnabled(db) || !memberOf(db, userId)) return null;
  const l = myLeague(db, userId, { now });
  const toMove = l.gap?.points ?? null;
  return { place: l.you.place, pod: l.pod.name, size: l.pod.size, toMove,
    line: `#${l.you.place} in your ${l.pod.name}${toMove ? ` · ${toMove} point${toMove === 1 ? "" : "s"} to move up` : ""}` };
}

/**
 * The live count: distinct people in the same field who did a real act of practice (proof earned, a question answered)
 * in the last LIVE_WINDOW_S. Shown only at or above LIVE_MIN; otherwise null — never a made-up or rounded-up number.
 */
export function liveCount(db, userId, { now = Math.floor(Date.now() / 1000) } = {}) {
  if (!liveCountEnabled(db)) return null;
  const { field } = podPlace(db, userId);
  if (!field) return null;
  const since = now - LEAGUE.LIVE_WINDOW_S;
  const n = safe(() => db.prepare(`SELECT COUNT(DISTINCT u) FROM (
      SELECT user_id AS u FROM proof_points WHERE earned_at >= ?
      UNION SELECT user_id AS u FROM learn_question_answers WHERE answered_at >= ? AND user_id IS NOT NULL
    ) a JOIN domain_profiles d ON d.user_id = a.u AND d.is_active = 1 WHERE d.placement_category = ?`).pluck().get(since, since, field), 0);
  if (n < LEAGUE.LIVE_MIN) return null;
  const fieldWords = (safe(() => taxonomy().byId.get(field)?.name || null, null) || String(field).replace(/[-_]/g, " ")).toLowerCase();
  return { n, field, line: `${n} people practising ${fieldWords} right now` };
}
