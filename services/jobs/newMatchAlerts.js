// services/jobs/newMatchAlerts.js — ⭐ D185-2 (45q, owner 11-09) · NEW-MATCH ALERTS: "a new job that fits your résumé,
// posted <N> minutes ago".
//
// THE RULES (D185 P1c, approved 11-09):
//   • TOP TIER ONLY — a posting in the person's placement subcategory that asks for most of the résumé's top skills
//     (D184 B-8's tierSkills: the résumé's technologies weighted by their share of postings): at least
//     topTierMin(N) of the N top skills. The board's lower tiers never alert.
//   • LIVE + NOT A GHOST — active, not retired or a duplicate, and not scored Likely not hiring (ghost_level < 2, D137).
//   • DIGEST BY DEFAULT, INSTANT AS AN OPT-IN, A HARD CAP — digest: one message a local day at the person's hour; instant:
//     each sweep with something new, at most MAX_INSTANT_MESSAGES a day; never more than DAILY_JOB_CAP jobs a day either way.
//   • THE BEACHHEAD (D185 (a)): a person who needs sponsorship sees postings at companies with an H-1B filing record first,
//     and the message says so; the board stays open to everyone.
//   • MEASURED — every alerted job is one match_alerts row (claimed BEFORE the message, so a crash never sends twice), with
//     the posting's own date and when draft first saw it; Admin reads time-from-posting-to-alert per source.
//
// ⛔ A126: the candidate query runs on the READ WORKERS (`read.all`), never on the one thread; the writes are small.
// ⛔ The email names jobs and companies (the person's own inbox, as D113's picks do); the push / in-app line is a count only.
import { tierSkills } from "./skillTiers.js";
import { readPrefs } from "../notify.js";
import { signalSql } from "../kb/sponsorshipSignal.js";

export const MATCH_ALERT_EVENT = "new_match";
export const ALERT_MODES = Object.freeze(["digest", "instant", "off"]);
export const DEFAULT_MODE = "digest";
export const DEFAULT_HOUR = 9;
export const DAILY_JOB_CAP = 10;
export const MAX_INSTANT_MESSAGES = 3;
/** Only postings draft first saw this recently are "new" — a backfill or a first sweep never mails a month of jobs. */
export const NEW_WINDOW_SEC = 48 * 3600;

const bad = (status, code, message) => Object.assign(new Error(message), { status, code });
const safe = (fn, d) => { try { return fn(); } catch { return d; } };
const nowS = () => Math.floor(Date.now() / 1000);

/** PURE. How many of the N top skills a posting must ask for to be TOP tier: N for N ≤ 2, else ⌈¾·N⌉. */
export function topTierMin(n) {
  const k = Math.max(0, Math.floor(Number(n) || 0));
  if (k <= 2) return k;
  return Math.ceil(0.75 * k);
}

/** PURE. The person's local day and hour from their browser's offset (minutes BEHIND UTC). */
export function localNow(nowSec, tzOffsetMin = 0) {
  const d = new Date((nowSec - tzOffsetMin * 60) * 1000);
  return { day: d.toISOString().slice(0, 10), hour: d.getUTCHours() };
}

/** PURE. A posting's own date as seconds, or null (posted_at is an ISO string or epoch text). */
export function postedSec(postedAt) {
  if (postedAt == null || postedAt === "") return null;
  if (/^\d{9,11}$/.test(String(postedAt))) return Number(postedAt);
  const t = Date.parse(String(postedAt));
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
}

// ── settings ──────────────────────────────────────────────────────────────────────────────────

export function readMatchAlertSettings(db, userId) {
  const row = safe(() => db.prepare(`SELECT mode, hour, tz_offset_min FROM match_alert_settings WHERE user_id = ?`).get(userId), null);
  const prefs = safe(() => readPrefs(db, userId)[MATCH_ALERT_EVENT], { push: false, email: false });
  return { mode: row?.mode || DEFAULT_MODE, hour: row?.hour ?? DEFAULT_HOUR, tzOffsetMin: row?.tz_offset_min ?? 0,
    email: !!prefs?.email, push: !!prefs?.push, dailyCap: DAILY_JOB_CAP, instantMessagesPerDay: MAX_INSTANT_MESSAGES };
}

export function setMatchAlertSettings(db, userId, { mode, hour, tzOffsetMin } = {}) {
  const cur = readMatchAlertSettings(db, userId);
  const m = mode === undefined ? cur.mode : String(mode);
  if (!ALERT_MODES.includes(m)) throw bad(400, "bad_mode", "Choose a daily digest, as they arrive, or off.");
  const h = hour === undefined ? cur.hour : Number(hour);
  if (!Number.isInteger(h) || h < 0 || h > 23) throw bad(400, "bad_hour", "Choose an hour from 0 to 23.");
  const tz = tzOffsetMin === undefined ? cur.tzOffsetMin : Number(tzOffsetMin);
  if (!Number.isInteger(tz) || tz < -840 || tz > 840) throw bad(400, "bad_offset", "The time zone offset is out of range.");
  db.prepare(`INSERT INTO match_alert_settings (user_id, mode, hour, tz_offset_min, updated_at) VALUES (?, ?, ?, ?, unixepoch())
    ON CONFLICT(user_id) DO UPDATE SET mode = excluded.mode, hour = excluded.hour, tz_offset_min = excluded.tz_offset_min,
      updated_at = excluded.updated_at`).run(userId, m, h, tz);
  return readMatchAlertSettings(db, userId);
}

// ── who, when ─────────────────────────────────────────────────────────────────────────────────

// ⭐ D186-5 (45s): the placement's "also fits" subcategory is searched beside the primary (the primary's own counts first).
const alsoOf = (p) => { try { const a = typeof p.placement_also === "string" ? JSON.parse(p.placement_also) : p.placement_also; return a?.subcategory && !/\.general$/.test(a.subcategory) ? a.subcategory : null; } catch { return null; } };

/** The people with a placed active job profile and a base résumé, and at least one channel on for new matches. */
export function alertAudience(db) {
  const rows = safe(() => db.prepare(`SELECT dp.user_id, dp.id AS profile_id, dp.placement_subcategory, dp.placement_level, dp.placed_at, dp.placement_also,
        br.content, br.updated_at AS resume_at, s.mode, s.hour, s.tz_offset_min, s.last_digest_day, s.cursor_at,
        up.sponsorship_need, up.requires_sponsorship
      FROM domain_profiles dp
      JOIN profile_base_resumes br ON br.profile_id = dp.id AND br.user_id = dp.user_id
      LEFT JOIN match_alert_settings s ON s.user_id = dp.user_id
      LEFT JOIN user_profile up ON up.user_id = dp.user_id
     WHERE dp.is_active = 1 AND dp.placement_subcategory IS NOT NULL AND dp.placement_subcategory NOT LIKE '%.general'
       AND COALESCE(s.mode, '${DEFAULT_MODE}') != 'off'`).all(), []);
  return rows.filter(r => { const p = safe(() => readPrefs(db, r.user_id)[MATCH_ALERT_EVENT], null); return !!(p && (p.email || p.push)); });
}

/** What today has already used: jobs alerted and instant messages sent, on the person's local day. */
export function usedToday(db, userId, day, tzOffsetMin = 0) {
  const rows = safe(() => db.prepare(`SELECT alerted_at, batch FROM match_alerts WHERE user_id = ? AND alerted_at >= ?`)
    .all(userId, nowS() - 2 * 86400), []);
  const today = rows.filter(r => localNow(r.alerted_at, tzOffsetMin).day === day);
  return { jobs: today.length, messages: new Set(today.map(r => r.batch)).size };
}

/** PURE-ish. Is this person due now, and how many jobs may still go out today? */
export function dueFor(person, used, nowSec) {
  const mode = person.mode || DEFAULT_MODE;
  if (mode === "off") return { due: false, reason: "off" };
  const { day, hour } = localNow(nowSec, person.tz_offset_min || 0);
  const remaining = Math.max(0, DAILY_JOB_CAP - used.jobs);
  if (!remaining) return { due: false, reason: "daily_cap", day };
  if (mode === "digest") {
    if (hour < (person.hour ?? DEFAULT_HOUR) || person.last_digest_day === day) return { due: false, reason: "not_time", day };
    return { due: true, remaining, day };
  }
  if (used.messages >= MAX_INSTANT_MESSAGES) return { due: false, reason: "message_cap", day };
  return { due: true, remaining, day };
}

const needsSponsorship = (p) => ["now", "future"].includes(String(p.sponsorship_need || "").toLowerCase()) || !!p.requires_sponsorship;

// ── the candidates (read workers) ─────────────────────────────────────────────────────────────

/**
 * The top-tier, live, non-ghost postings new since the person's cursor, best first. `read` = { all(sql, params) }.
 * @returns {Promise<Array<{ job_id, title, company, source, posted_at, discovered_at, matched, sponsor }>>}
 */
export async function topTierCandidates(read, person, { skills, nowSec, limit }) {
  const n = skills.length;
  const min = topTierMin(n);
  if (!n || !min) return [];
  const since = Math.max(Number(person.cursor_at) || 0, nowSec - NEW_WINDOW_SEC);
  const marks = skills.map(() => "?").join(",");
  const sponsorSql = signalSql("sj").filed;
  const sponsorFirst = needsSponsorship(person);
  const rows = await read.all(`SELECT sj.job_id, sj.title, sj.company, sj.source, sj.posted_at, sj.discovered_at,
        (SELECT COUNT(*) FROM job_tech jt WHERE jt.job_id = sj.job_id AND jt.tech IN (${marks})) AS matched,
        CASE WHEN ${sponsorSql} THEN 1 ELSE 0 END AS sponsor
      FROM job_taxonomy jx
      JOIN scraped_jobs sj ON sj.job_id = jx.job_id
     WHERE jx.subcategory IN (?, ?) AND sj.is_active = 1 AND sj.duplicate_of IS NULL AND sj.retired_at IS NULL
       AND (sj.ghost_level IS NULL OR sj.ghost_level < 2)
       AND sj.discovered_at > ?
       AND NOT EXISTS (SELECT 1 FROM match_alerts ma WHERE ma.user_id = ? AND ma.job_id = sj.job_id)
     ORDER BY ${sponsorFirst ? "sponsor DESC," : ""} matched DESC, sj.discovered_at DESC
     LIMIT 200`, [...skills, person.placement_subcategory, alsoOf(person) || person.placement_subcategory, since, person.user_id]);
  return (rows || []).filter(r => Number(r.matched) >= min).slice(0, limit);
}

// ── the sweep ─────────────────────────────────────────────────────────────────────────────────

/** The message data: the email's list (each job named, with its link) and the count for the push / bell. */
export function alertMessage(items, { appUrl = "", nowSec, sponsorFirst = false }) {
  return {
    count: items.length,
    sponsorFirst,
    items: items.map(it => {
      const posted = postedSec(it.posted_at) ?? it.discovered_at;
      const mins = posted ? Math.max(0, Math.round((nowSec - posted) / 60)) : null;
      return { title: it.title, company: it.company, sponsor: !!it.sponsor, matched: Number(it.matched), of: it.of,
        ago: mins == null ? null : mins < 60 ? `${mins} minute${mins === 1 ? "" : "s"} ago`
          : mins < 48 * 60 ? `${Math.round(mins / 60)} hour${Math.round(mins / 60) === 1 ? "" : "s"} ago` : `${Math.round(mins / 1440)} days ago`,
        url: `${appUrl}/app/jobs?job=${encodeURIComponent(it.job_id)}` };   // the board's own deep link (JobsPanel ?job=)
    }),
  };
}

/**
 * One sweep (every 10 minutes, server.js). For each due person: their top skills → the new top-tier postings → claim the
 * rows → ONE message. Returns how many messages went out.
 */
export async function runMatchAlerts(db, read, notify, opts = {}) {
  return (await runMatchAlertsSlice(db, read, notify, opts)).sent;
}

/**
 * ⭐ D151 Rule 2 (45q): the sweep as SLICES — people in user-id order after `afterUserId`, stopping at `deadline` (ms);
 * { sent, lastUserId, done }. The job system (services/ops/jobQueue.js, kind 'match_alerts') runs it one slice a tick.
 */
export async function runMatchAlertsSlice(db, read, notify, { nowSec = nowS(), appUrl = "", log = console, afterUserId = 0, deadline = Infinity, clock = Date.now } = {}) {
  let sent = 0, lastUserId = afterUserId;
  const people = alertAudience(db).filter(p => p.user_id > afterUserId).sort((a, b) => a.user_id - b.user_id);
  for (const person of people) {
    if (clock() >= deadline) return { sent, lastUserId, done: false };
    lastUserId = person.user_id;
    try {
      const tz = person.tz_offset_min || 0;
      const used = usedToday(db, person.user_id, localNow(nowSec, tz).day, tz);
      const due = dueFor(person, used, nowSec);
      if (!due.due) continue;
      const skills = await tierSkills(read, { id: person.profile_id, placement_subcategory: person.placement_subcategory,
        placement_level: person.placement_level, placed_at: person.placed_at }, person.content, person.resume_at);
      const items = (await topTierCandidates(read, person, { skills, nowSec, limit: due.remaining }))
        .map(it => ({ ...it, of: skills.length }));
      // The cursor moves even when nothing qualified: the next sweep looks only at what is newer.
      const touch = (extra = {}) => db.prepare(`INSERT INTO match_alert_settings (user_id, mode, hour, tz_offset_min, cursor_at, last_digest_day, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, unixepoch())
          ON CONFLICT(user_id) DO UPDATE SET cursor_at = excluded.cursor_at,
            last_digest_day = COALESCE(excluded.last_digest_day, match_alert_settings.last_digest_day), updated_at = excluded.updated_at`)
        .run(person.user_id, person.mode || DEFAULT_MODE, person.hour ?? DEFAULT_HOUR, tz, nowSec, extra.day ?? null);
      if (!items.length) { touch((person.mode || DEFAULT_MODE) === "digest" ? { day: due.day } : {}); continue; }
      // ⛔ CLAIM, THEN SEND: the rows are the at-most-once guard (UNIQUE user_id, job_id) and the time-to-alert record.
      const batch = `${person.user_id}:${nowSec}`;
      const ins = db.prepare(`INSERT OR IGNORE INTO match_alerts (user_id, job_id, profile_id, source, posted_at, discovered_at,
          matched, of_skills, sponsor, mode, batch, alerted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      const claimed = db.transaction(() => items.filter(it => ins.run(person.user_id, it.job_id, person.profile_id, it.source || null,
        postedSec(it.posted_at), it.discovered_at ?? null, Number(it.matched), skills.length, it.sponsor ? 1 : 0,
        person.mode || DEFAULT_MODE, batch, nowSec).changes === 1))();
      touch((person.mode || DEFAULT_MODE) === "digest" ? { day: due.day } : {});
      if (!claimed.length) continue;
      await notify(person.user_id, MATCH_ALERT_EVENT, alertMessage(claimed, { appUrl, nowSec, sponsorFirst: needsSponsorship(person) }));
      sent += 1;
    } catch (e) { log?.warn?.(`[alerts] user ${person.user_id}: ${e.message}`); }
  }
  return { sent, lastUserId, done: true };
}

// ── Admin: time from posting to alert, per source ─────────────────────────────────────────────

function pct(sorted, p) {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))];
}

/**
 * Per source over the last `days`: alerts, people, and minutes from the posting's own date (or, without one, when draft
 * first saw it) to the alert — the median and the 90th percentile; plus draft's own lag (first seen → alert).
 */
export function matchAlertTimings(db, { days = 30, nowSec = nowS() } = {}) {
  const rows = safe(() => db.prepare(`SELECT source, user_id, posted_at, discovered_at, alerted_at, mode FROM match_alerts WHERE alerted_at >= ?`)
    .all(nowSec - days * 86400), []);
  const by = new Map();
  for (const r of rows) {
    const k = r.source || "unknown";
    if (!by.has(k)) by.set(k, { source: k, alerts: 0, people: new Set(), fromPosting: [], fromSeen: [], noPostingDate: 0 });
    const g = by.get(k);
    g.alerts += 1; g.people.add(r.user_id);
    if (r.posted_at != null) g.fromPosting.push((r.alerted_at - r.posted_at) / 60); else g.noPostingDate += 1;
    if (r.discovered_at != null) g.fromSeen.push((r.alerted_at - r.discovered_at) / 60);
  }
  const sources = [...by.values()].map(g => {
    const a = g.fromPosting.sort((x, y) => x - y), b = g.fromSeen.sort((x, y) => x - y);
    const r = (v) => (v == null ? null : Math.round(v));
    return { source: g.source, alerts: g.alerts, people: g.people.size, noPostingDate: g.noPostingDate,
      postingToAlertMin: { p50: r(pct(a, 0.5)), p90: r(pct(a, 0.9)) }, seenToAlertMin: { p50: r(pct(b, 0.5)), p90: r(pct(b, 0.9)) } };
  }).sort((x, y) => y.alerts - x.alerts);
  return { days, total: rows.length, people: new Set(rows.map(r => r.user_id)).size, sources,
    rules: { dailyJobCap: DAILY_JOB_CAP, instantMessagesPerDay: MAX_INSTANT_MESSAGES, newWindowHours: NEW_WINDOW_SEC / 3600 } };
}
