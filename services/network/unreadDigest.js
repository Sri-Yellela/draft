// services/network/unreadDigest.js — ⭐ D180 (3) "an email digest only if switched on" (45s; the P2 leftover) · ONCE A DAY,
// when a message is waiting in Network, one notification that says HOW MANY — never who sent it or what it says (the
// words stay sealed, services/network/messages.js; a lock screen or an inbox is read by whoever holds it).
//
// OFF for every account until the person turns it on: notification_prefs' `messages_unread` (push and email, both off —
// services/notify.js). Only while the network switch is on (else nothing, and the event is not even listed). At most one a
// UTC day, sent from DIGEST_HOUR_UTC; a muted thread never counts (myThreads already says 0 for it). The sweep runs every
// 10 minutes beside the daily question's (server.js, NETWORK_DIGEST=off stops it).
import { networkEnabled } from "./connections.js";
import { myThreads } from "./messages.js";

export const DIGEST_HOUR_UTC = 14;   // ≈ 9–10 am on the US east coast
const DAY = 86400;
const safe = (fn, d) => { try { return fn(); } catch { return d; } };

/** Who gets the digest now: switched on, the hour reached, none sent today, at least one unread message. */
export function dueDigests(db, box, nowSec = Math.floor(Date.now() / 1000)) {
  if (!networkEnabled(db) || !box) return [];
  if (new Date(nowSec * 1000).getUTCHours() < DIGEST_HOUR_UTC) return [];
  const dayStart = Math.floor(nowSec / DAY) * DAY;
  const who = safe(() => db.prepare(`SELECT user_id FROM notification_prefs WHERE event = 'messages_unread' AND (push = 1 OR email = 1)`).pluck().all(), []);
  const out = [];
  for (const userId of who) {
    if (safe(() => db.prepare(`SELECT 1 FROM notifications WHERE user_id = ? AND type = 'messages_unread' AND created_at >= ?`).get(userId, dayStart), null)) continue;
    const unread = safe(() => myThreads(db, box, userId).unread, 0);
    if (unread > 0) out.push({ userId, count: unread });
  }
  return out;
}

/** The sweep: one digest per person a day, through notifyEvent (which writes the in-app row that marks the day). */
export async function runUnreadDigests(db, box, notify, nowSec = Math.floor(Date.now() / 1000)) {
  let sent = 0;
  for (const { userId, count } of dueDigests(db, box, nowSec)) {
    try { await notify(userId, "messages_unread", { count }); sent++; } catch { /* notifyEvent never throws; tomorrow tries again */ }
  }
  return sent;
}
