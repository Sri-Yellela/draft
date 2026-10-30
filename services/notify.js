// services/notify.js — ⭐ D112 item 8 / D100 P4 · ONE WAY an event reaches the person: the in-app notification (the
// existing `notifications` table + the SSE badge — what server.js insertNotification has always written), then, by the
// person's own per-event choice, a Web Push to their browsers (services/webPush.js) and an email through the existing
// Resend sender (services/emailService.js sendEmail). Nothing here invents a parallel record: every event IS a row in
// `notifications`, and the push / email are copies of it.
//
// THE EVENTS (the owner's list, 10-30):
//   needs_you           a stopped application waiting for the person — Needs you, or Ready to approve (D100 P4)
//   inbox_reply         D103's inbox filed an Interview or an Offer against one of their applications
//   apply_complete      an application was sent (the type the bell already has an icon for)
//   auto_daily_summary  FULL AUTO's day: how many were sent, how many wait
//
// ⛔ D100 P4: the text NEVER names a company or carries a value — "A job is ready for your approval". A lock screen is
// read by whoever holds the phone. Counts and the ladder's own words only.
// ⛔ Unconfigured (no configureNotify — every test that does not ask for it), notifyEvent does nothing at all, so the
// services that call it behave exactly as before.
// ⛔ A burst is ONE ping: the in-app row is always written, but push / email for the same event go out at most once per
// THROTTLE window (a SEMI run of 25 jobs reaching Ready to approve is one "ready for your approval", not 25), and the push
// carries a Topic so an offline phone gets one message, not a stack.
import { sendPush, vapidConfig, endpointAllowed } from "./webPush.js";
import { sendEmail, emailConfigured } from "./emailService.js";
import { readAutoSettings } from "../shared/autoSettings.js";

const now = () => Math.floor(Date.now() / 1000);

export const NOTIFY_EVENTS = Object.freeze({
  needs_you: { label: "Needs you", what: "An application stopped and is waiting for you — a question only you can answer, or values to approve.",
    url: "/app/auto-apply", defaults: { push: true, email: false }, throttle: 15 * 60 },
  inbox_reply: { label: "Interview or offer", what: "Your inbox filed a reply from an employer as an interview or an offer.",
    url: "/app/database?sheet=inbox", defaults: { push: true, email: false }, throttle: 0 },
  apply_complete: { label: "Application sent", what: "An application was sent to an employer.",
    url: "/app/database", defaults: { push: false, email: false }, throttle: 15 * 60 },
  auto_daily_summary: { label: "FULL AUTO daily summary", what: "Once a day while FULL AUTO is on: how many were sent and how many wait for you.",
    url: "/app/auto-apply", defaults: { push: true, email: false }, throttle: 0 },
});
export const CHANNELS = Object.freeze(["push", "email"]);
export const SUMMARY_MINUTES = 20 * 60; // 8 pm in the person's own time zone (Auto settings)

/** The words of each event — the in-app line, the push and the email say the same. No company, no value (D100 P4). */
export function eventText(event, data = {}) {
  const n = (k) => Math.max(0, Number(data[k]) || 0);
  const s = (k, one, many) => `${n(k)} ${n(k) === 1 ? one : many}`;
  switch (event) {
    case "needs_you":
      return data.ready ? { title: "Ready for your approval", body: "A job is ready for your approval." }
        : { title: "Needs you", body: "An application is waiting for you in Draft House." };
    case "inbox_reply":
      return data.category === "offer" ? { title: "An offer", body: "A reply from an employer was filed as an offer." }
        : { title: "An interview", body: "A reply from an employer was filed as an interview." };
    case "apply_complete":
      return { title: "Application sent", body: "An application was sent." };
    case "auto_daily_summary":
      return { title: "FULL AUTO today", body: `Today draft sent ${s("sent", "application", "applications")}.`
        + (n("waiting") ? ` ${s("waiting", "is", "are")} waiting for you.` : "") };
    default:
      return { title: "draft", body: "Something changed in draft." };
  }
}

// ── preferences ──────────────────────────────────────────────────────────────────────────────

/** The person's choices: every event × channel, a stored row winning over the event's default. */
export function readPrefs(db, userId) {
  const rows = db.prepare(`SELECT event, push, email FROM notification_prefs WHERE user_id = ?`).all(userId);
  const stored = Object.fromEntries(rows.map(r => [r.event, r]));
  return Object.fromEntries(Object.entries(NOTIFY_EVENTS).map(([k, e]) => [k, {
    push: stored[k] ? stored[k].push === 1 : e.defaults.push,
    email: stored[k] ? stored[k].email === 1 : e.defaults.email,
  }]));
}

/** One switch. Unknown events / channels are refused (400), never stored. */
export function setPref(db, userId, event, channel, on) {
  if (!NOTIFY_EVENTS[event]) throw Object.assign(new Error("Unknown notification."), { status: 400, code: "bad_event" });
  if (!CHANNELS.includes(channel)) throw Object.assign(new Error("Unknown channel."), { status: 400, code: "bad_channel" });
  const cur = readPrefs(db, userId)[event];
  const next = { ...cur, [channel]: on === true };
  db.prepare(`INSERT INTO notification_prefs (user_id, event, push, email, updated_at) VALUES (?, ?, ?, ?, unixepoch())
    ON CONFLICT(user_id, event) DO UPDATE SET push = excluded.push, email = excluded.email, updated_at = excluded.updated_at`)
    .run(userId, event, next.push ? 1 : 0, next.email ? 1 : 0);
  return readPrefs(db, userId);
}

// ── subscriptions ────────────────────────────────────────────────────────────────────────────

/** Store (or re-own) one browser's subscription. Returns its id. Refuses a malformed one or a non-push-service endpoint. */
export function saveSubscription(db, userId, sub, userAgent = null) {
  const bad = (code) => Object.assign(new Error("That browser subscription is not usable."), { status: 400, code });
  const endpoint = String(sub?.endpoint || "");
  if (endpoint.length > 2048 || !endpointAllowed(endpoint)) throw bad("bad_endpoint");
  const p256dh = String(sub?.keys?.p256dh || ""), auth = String(sub?.keys?.auth || "");
  if (!/^[A-Za-z0-9_-]{80,100}$/.test(p256dh) || !/^[A-Za-z0-9_-]{16,32}$/.test(auth)) throw bad("bad_keys");
  // One row per endpoint: the same browser signed in as another account now pushes to THAT account.
  db.prepare(`INSERT INTO push_subscriptions (user_id, endpoint, key_p256dh, key_auth, user_agent) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, key_p256dh = excluded.key_p256dh, key_auth = excluded.key_auth,
      user_agent = excluded.user_agent, failures = 0`)
    .run(userId, endpoint, p256dh, auth, userAgent ? String(userAgent).slice(0, 200) : null);
  return db.prepare(`SELECT id FROM push_subscriptions WHERE endpoint = ?`).pluck().get(endpoint);
}

export function removeSubscription(db, userId, endpoint) {
  return db.prepare(`DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?`).run(userId, String(endpoint || "")).changes > 0;
}

export function subscriptionCount(db, userId) {
  return db.prepare(`SELECT COUNT(*) FROM push_subscriptions WHERE user_id = ?`).pluck().get(userId);
}

/**
 * Push one message to every browser of one person. A 404 / 410 deletes that subscription (RFC 8030: it is gone);
 * a success stamps it; other failures are counted, and five in a row retire it.
 */
export async function pushToUser(db, userId, message, { vapid, fetchImpl, topic = null } = {}) {
  const subs = db.prepare(`SELECT * FROM push_subscriptions WHERE user_id = ?`).all(userId);
  const out = { sent: 0, removed: 0, failed: 0 };
  for (const s of subs) {
    const r = await sendPush({ endpoint: s.endpoint, keys: { p256dh: s.key_p256dh, auth: s.key_auth } }, message, { vapid, fetchImpl, topic });
    if (r.ok) { out.sent++; db.prepare(`UPDATE push_subscriptions SET last_success_at = unixepoch(), failures = 0 WHERE id = ?`).run(s.id); }
    else if (r.gone || r.error === "endpoint_refused") { out.removed++; db.prepare(`DELETE FROM push_subscriptions WHERE id = ?`).run(s.id); }
    else {
      out.failed++;
      db.prepare(`UPDATE push_subscriptions SET failures = failures + 1 WHERE id = ?`).run(s.id);
      db.prepare(`DELETE FROM push_subscriptions WHERE id = ? AND failures >= 5`).run(s.id);
    }
  }
  return out;
}

// ── the dispatcher ───────────────────────────────────────────────────────────────────────────

let CONFIG = null;

/**
 * Called once at boot by server.js. `emitToUser` is the SSE badge; `fetchImpl` is the network (push services AND Resend);
 * `appUrl` builds the email's link. Tests pass their own fetchImpl — nothing reaches the network.
 */
export function configureNotify({ db, emitToUser = () => {}, fetchImpl = fetch, env = process.env, appUrl = "", log = console } = {}) {
  CONFIG = db ? { db, emitToUser, fetchImpl, env, appUrl: String(appUrl || "").replace(/\/$/, ""), log } : null;
  return CONFIG;
}

/** What Settings shows: which channels exist at all. Push only with the three VAPID variables; email only with Resend. */
export function channelsOffered(env = process.env) {
  const v = vapidConfig(env);
  return { push: !!v, publicKey: v ? v.publicKey : null, email: emailConfigured(env) };
}

function recentlySent(db, userId, type, sinceSec, exceptId) {
  return !!db.prepare(`SELECT 1 FROM notifications WHERE user_id = ? AND type = ? AND created_at >= ? AND id != ? LIMIT 1`)
    .get(userId, type, sinceSec, exceptId);
}

/**
 * THE event. Writes the in-app row (+ the SSE badge), then the person's chosen copies. Never throws; returns what it did
 * (the tests read it). Awaitable, but the callers fire and forget — a slow push service never holds a run.
 */
export async function notifyEvent(userId, event, data = {}, { config = CONFIG } = {}) {
  try { return await dispatch(userId, event, data, config); }
  catch (e) { config?.log?.warn?.(`[notify] ${event}: ${e.message}`); return { error: e.message }; }
}

async function dispatch(userId, event, data, config) {
  if (!config || !NOTIFY_EVENTS[event] || !Number.isInteger(Number(userId))) return { skipped: "unconfigured" };
  const { db, emitToUser, fetchImpl, env, appUrl, log } = config;
  const def = NOTIFY_EVENTS[event];
  const text = eventText(event, data);
  const out = { id: null, push: null, email: null };
  try {
    const row = db.prepare(`INSERT INTO notifications (user_id, type, message, payload) VALUES (?, ?, ?, ?)`)
      .run(userId, event, text.body, JSON.stringify({ url: def.url, ...(data.date ? { date: data.date } : {}) }));
    out.id = Number(row.lastInsertRowid);
    try { emitToUser(userId, { type: "notification", id: out.id, notif_type: event, message: text.body }); } catch {}
  } catch (e) { log?.warn?.(`[notify] in-app ${event}: ${e.message}`); return out; }
  const nowSec = now();
  if (def.throttle && recentlySent(db, userId, event, nowSec - def.throttle, out.id)) return { ...out, throttled: true };
  const prefs = readPrefs(db, userId)[event];
  if (prefs.push) {
    const vapid = vapidConfig(env);
    if (vapid) {
      try {
        out.push = await pushToUser(db, userId, { title: text.title, body: text.body, url: def.url, tag: event },
          { vapid, fetchImpl, topic: event.replace(/_/g, "") });
      } catch (e) { log?.warn?.(`[notify] push ${event}: ${e.message}`); }
    }
  }
  if (prefs.email && emailConfigured(env)) {
    const to = db.prepare(`SELECT email FROM user_profile WHERE user_id = ?`).pluck().get(userId);
    if (to) {
      try {
        out.email = await sendEmail({ db, to, fetchImpl, env, subject: `draft · ${text.title}`,
          text: [text.body, "", `Open draft: ${appUrl}${def.url}`, "",
            "You chose to get this by email. Change it in draft → Account → Notifications."].join("\n") });
      } catch (e) { log?.warn?.(`[notify] email ${event}: ${e.message}`); out.email = { ok: false }; }
    }
  }
  return out;
}

// ── the hooks the pipeline calls ─────────────────────────────────────────────────────────────

/**
 * After a local run finished one job (routes/apply.js processRun): Needs you / Ready to approve, or sent. A job the
 * apply worker has taken over (a queued remote run) is not waiting on the person yet — the worker's report notifies.
 */
export function notifyRunJobOutcome(db, runJobId, { config = CONFIG } = {}) {
  if (!config) return null;
  try {
    const rj = db.prepare(`SELECT id, user_id, status, reason_code FROM apply_run_jobs WHERE id = ?`).get(runJobId);
    if (!rj) return null;
    if (rj.status === "submitted") return notifyEvent(rj.user_id, "apply_complete", {}, { config });
    if (rj.status === "held_review" || rj.status === "held_gate") {
      const remote = db.prepare(`SELECT 1 FROM apply_remote_runs WHERE run_job_id = ? AND state IN ('queued', 'leased')`).get(rj.id);
      if (remote) return null;
      return notifyEvent(rj.user_id, "needs_you", { ready: rj.reason_code === "awaiting_approval" }, { config });
    }
  } catch (e) { config.log?.warn?.(`[notify] run job ${runJobId}: ${e.message}`); }
  return null;
}

/**
 * FULL AUTO's daily summary — once per person per local day, at or after SUMMARY_MINUTES in their Auto settings' time zone,
 * and only when the day had something in it. Called from the FULL AUTO tick (server.js, every 5 minutes).
 */
export async function runDailySummaries(db, { nowSec = now(), config = CONFIG } = {}) {
  if (!config) return [];
  // Loaded here, not at the top: the inbox and the worker import this file, and need not load the scheduler's graph.
  const { localClock } = await import("./autoScheduler.js");
  const out = [];
  const users = db.prepare(`SELECT id, auto_settings FROM users WHERE send_mode = 'auto'`).all();
  for (const u of users) {
    try {
      const settings = readAutoSettings(u.auto_settings);
      const clock = localClock(nowSec, settings.timeZone);
      if (clock.minutes < SUMMARY_MINUTES) continue;
      const done = db.prepare(`SELECT payload FROM notifications WHERE user_id = ? AND type = 'auto_daily_summary' AND created_at >= ?`)
        .pluck().all(u.id, nowSec - 2 * 86400).some(p => { try { return JSON.parse(p || "{}").date === clock.date; } catch { return false; } });
      if (done) continue;
      const dayStart = nowSec - clock.minutes * 60 - (nowSec % 60);
      const sent = db.prepare(`SELECT COUNT(*) FROM apply_run_jobs WHERE user_id = ? AND status = 'submitted' AND finished_at >= ?`).pluck().get(u.id, dayStart);
      const waiting = db.prepare(`SELECT COUNT(*) FROM apply_run_jobs WHERE user_id = ? AND status IN ('held_review', 'held_gate')`).pluck().get(u.id);
      if (!sent && !waiting) continue;
      out.push({ userId: u.id, sent, waiting, result: await notifyEvent(u.id, "auto_daily_summary", { sent, waiting, date: clock.date }, { config }) });
    } catch (e) { config.log?.warn?.(`[notify] summary user=${u.id}: ${e.message}`); }
  }
  return out;
}
