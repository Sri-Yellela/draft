// services/learn/dailyReminder.js — ⭐ D154 P1 (45m) · THE DAILY QUESTION'S GENTLE REMINDER.
//
// OFF BY DEFAULT: the switches are notification_prefs' `daily_question` (push / email, both off — services/notify.js), and
// the time is the person's own (daily_reminders: their local hour + the browser's offset from UTC when they chose it).
// The sweep (every 10 minutes, server.js) sends at most ONE reminder per person per local day, only once their local
// hour has come, and only when today's question is still unanswered (or not yet picked). The words never name a skill or
// a job (services/notify.js eventText). Turning it off clears both switches; the chosen hour is kept for next time.
import { readPrefs, setPref } from "../notify.js";

export const DEFAULT_HOUR = 9;
const bad = (status, code, message) => Object.assign(new Error(message), { status, code });
const safe = (fn, d) => { try { return fn(); } catch { return d; } };

/** { on, push, email, hour, tzOffsetMin } — on is false for every account until the person turns it on. */
export function readReminder(db, userId) {
  const prefs = safe(() => readPrefs(db, userId).daily_question, { push: false, email: false });
  const row = safe(() => db.prepare(`SELECT hour, tz_offset_min FROM daily_reminders WHERE user_id = ?`).get(userId), null);
  return { on: !!(prefs.push || prefs.email), push: !!prefs.push, email: !!prefs.email,
    hour: row?.hour ?? DEFAULT_HOUR, tzOffsetMin: row?.tz_offset_min ?? 0 };
}

/**
 * Turn it on at an hour ({ on: true, hour, tzOffsetMin, channel: 'push' | 'email' }) or off ({ on: false }).
 * tzOffsetMin is the browser's Date#getTimezoneOffset() (minutes BEHIND UTC, e.g. 300 for New York in winter).
 */
export function setReminder(db, userId, { on, hour, tzOffsetMin = 0, channel = "push" } = {}) {
  if (on === false) {
    setPref(db, userId, "daily_question", "push", false);
    setPref(db, userId, "daily_question", "email", false);
    return readReminder(db, userId);
  }
  const h = Number(hour);
  if (!Number.isInteger(h) || h < 0 || h > 23) throw bad(400, "bad_hour", "Choose an hour from 0 to 23.");
  const tz = Number(tzOffsetMin);
  if (!Number.isInteger(tz) || tz < -840 || tz > 840) throw bad(400, "bad_offset", "The time zone offset is out of range.");
  if (!["push", "email"].includes(channel)) throw bad(400, "bad_channel", "Push or email.");
  db.prepare(`INSERT INTO daily_reminders (user_id, hour, tz_offset_min, updated_at) VALUES (?, ?, ?, unixepoch())
    ON CONFLICT(user_id) DO UPDATE SET hour = excluded.hour, tz_offset_min = excluded.tz_offset_min, updated_at = excluded.updated_at`).run(userId, h, tz);
  setPref(db, userId, "daily_question", channel, true);
  return readReminder(db, userId);
}

/** PURE. The person's local day (YYYY-MM-DD) and hour at `nowSec`, from their stored offset. */
export function localNow(nowSec, tzOffsetMin = 0) {
  const d = new Date((nowSec - tzOffsetMin * 60) * 1000);
  return { day: d.toISOString().slice(0, 10), hour: d.getUTCHours() };
}

/** Who gets a reminder now: switched on, a time chosen, their hour reached, not sent today, today not answered. */
export function dueReminders(db, nowSec = Math.floor(Date.now() / 1000)) {
  const rows = safe(() => db.prepare(`SELECT d.user_id, d.hour, d.tz_offset_min, d.last_sent_day FROM daily_reminders d
      JOIN notification_prefs p ON p.user_id = d.user_id AND p.event = 'daily_question' AND (p.push = 1 OR p.email = 1)`).all(), []);
  const out = [];
  for (const r of rows) {
    const { day, hour } = localNow(nowSec, r.tz_offset_min);
    if (hour < r.hour || r.last_sent_day === day) continue;
    const answered = safe(() => db.prepare(`SELECT answered_at FROM daily_questions WHERE user_id = ? AND day = ?`).get(r.user_id, day), null);
    if (answered?.answered_at) continue;
    out.push({ userId: r.user_id, day });
  }
  return out;
}

/** The sweep: send each due reminder through notifyEvent, marking the day first (one a day, even if a send fails). */
export async function runDailyReminders(db, notify, nowSec = Math.floor(Date.now() / 1000)) {
  let sent = 0;
  for (const { userId, day } of dueReminders(db, nowSec)) {
    db.prepare(`UPDATE daily_reminders SET last_sent_day = ? WHERE user_id = ?`).run(day, userId);
    try { await notify(userId, "daily_question", {}); sent++; } catch { /* notifyEvent never throws; a failed send waits for tomorrow */ }
  }
  return sent;
}
