// services/network/connections.js — ⭐ D180 P1 (45o) · CONNECTIONS.
//
// Owner 11-08: "D180 Networking (built, counsel reviews before it ships)". So EVERYTHING here sits behind ONE switch —
// app_settings `network_enabled`, OFF by default (networkEnabled) — and the routes answer 404 while it is off. Counsel's
// questions (user-content terms, takedown, reporting obligations, retention — the owner's list D (19)) are answered before
// the owner turns it on.
//
// The D180 spec's P1: mutual (request → accept); requests kept apart from connections; a DAILY CAP on requests; BLOCK
// (removes the connection, cancels any request, and stops new ones in both directions); suggestions from a shared
// workplace or school — among PUBLIC pages only (people_index, which holds only what a public page shows), never from an
// uploaded address book. A connection sees the profile's "Connections" sections (D183's level) — profileViewerFor.
// A person can only be asked if their page is open to connections or the public (a private page can't be found).
import { getSetting, settingTruthy } from "../appSettings.js";
import { readVisibility } from "../profilePage.js";

export const NETWORK_SETTING = "network_enabled";
export const DAILY_REQUEST_CAP = 20;
export const SUGGESTIONS_SHOWN = 10;
const DAY = 86400;
const bad = (status, code, message) => Object.assign(new Error(message), { status, code });
const pair = (a, b) => (a < b ? [a, b] : [b, a]);

/** Is the network on? OFF unless the owner turned it on (no env default: it never ships by accident). */
export function networkEnabled(db) { return settingTruthy(getSetting(db, NETWORK_SETTING)); }

/** The user behind a public link handle, with their page level — or null. */
function personByHandle(db, handle) {
  const h = String(handle ?? "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(h)) return null;
  const row = db.prepare(`SELECT user_id FROM proof_pages WHERE handle = ?`).get(h);
  return row ? { userId: row.user_id, handle: h } : null;
}
const pageLevel = (db, userId) => { try { return readVisibility(db, userId).page; } catch { return "only_me"; } };

export function isBlocked(db, a, b) {
  return !!db.prepare(`SELECT 1 FROM network_blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)`).get(a, b, b, a);
}
function rowOf(db, a, b) { const [lo, hi] = pair(a, b); return db.prepare(`SELECT * FROM network_connections WHERE low_id = ? AND high_id = ?`).get(lo, hi) || null; }
export function isConnected(db, a, b) { return a !== b && rowOf(db, a, b)?.status === "accepted"; }

/** The relation between two people, from `me`'s side: none · requested (I asked) · incoming (they asked) · connected · blocked. */
export function relation(db, me, other) {
  if (me === other) return "self";
  if (isBlocked(db, me, other)) return "blocked";
  const r = rowOf(db, me, other);
  if (!r) return "none";
  if (r.status === "accepted") return "connected";
  return r.requester_id === me ? "requested" : "incoming";
}

/** Ask to connect. Refused: self, a private page, a block either way, a pair that already exists, over the daily cap. */
export function requestConnection(db, me, handle, { note = null, now = Math.floor(Date.now() / 1000) } = {}) {
  const p = personByHandle(db, handle);
  if (!p) throw bad(404, "no_such_person", "There is no one at that address.");
  if (p.userId === me) throw bad(400, "self", "That's your own page.");
  if (pageLevel(db, p.userId) === "only_me") throw bad(404, "no_such_person", "There is no one at that address.");   // private = not findable
  if (isBlocked(db, me, p.userId)) throw bad(403, "blocked", "You can't connect with this person.");
  const existing = rowOf(db, me, p.userId);
  if (existing) return { relation: relation(db, me, p.userId) };
  const sent = db.prepare(`SELECT COUNT(*) FROM network_connections WHERE requester_id = ? AND created_at >= ?`).pluck().get(me, now - DAY);
  if (sent >= DAILY_REQUEST_CAP) throw bad(429, "daily_cap", `You can send ${DAILY_REQUEST_CAP} requests a day — try again tomorrow.`);
  const [lo, hi] = pair(me, p.userId);
  const n = note == null ? null : String(note).trim().slice(0, 300) || null;
  db.prepare(`INSERT INTO network_connections (low_id, high_id, requester_id, status, note, created_at) VALUES (?, ?, ?, 'pending', ?, ?)`).run(lo, hi, me, n, now);
  return { relation: "requested" };
}

function otherOf(db, me, handle) {
  const p = personByHandle(db, handle);
  if (!p || p.userId === me) throw bad(404, "no_such_person", "There is no one at that address.");
  return p.userId;
}
/** Accept or decline a request someone sent me. */
export function respond(db, me, handle, accept) {
  const other = otherOf(db, me, handle);
  const r = rowOf(db, me, other);
  if (!r || r.status !== "pending" || r.requester_id === me) throw bad(404, "no_request", "There is no request from this person.");
  const [lo, hi] = pair(me, other);
  if (accept) db.prepare(`UPDATE network_connections SET status = 'accepted', responded_at = unixepoch() WHERE low_id = ? AND high_id = ?`).run(lo, hi);
  else db.prepare(`DELETE FROM network_connections WHERE low_id = ? AND high_id = ?`).run(lo, hi);   // declined: nothing kept, nothing told
  return { relation: relation(db, me, other) };
}
/** Withdraw my request, or remove a connection — either way the pair is gone. */
export function removeConnection(db, me, handle) {
  const other = otherOf(db, me, handle);
  const [lo, hi] = pair(me, other);
  db.prepare(`DELETE FROM network_connections WHERE low_id = ? AND high_id = ?`).run(lo, hi);
  return { relation: relation(db, me, other) };
}
/** Block: the connection and any request go, and neither can ask again until unblocked. */
export function block(db, me, handle) {
  const other = otherOf(db, me, handle);
  const [lo, hi] = pair(me, other);
  db.transaction(() => {
    db.prepare(`DELETE FROM network_connections WHERE low_id = ? AND high_id = ?`).run(lo, hi);
    db.prepare(`INSERT OR IGNORE INTO network_blocks (blocker_id, blocked_id) VALUES (?, ?)`).run(me, other);
  })();
  return { relation: "blocked" };
}
export function unblock(db, me, handle) {
  const other = otherOf(db, me, handle);
  db.prepare(`DELETE FROM network_blocks WHERE blocker_id = ? AND blocked_id = ?`).run(me, other);
  return { relation: relation(db, me, other) };
}

/** A person as the network lists them — only what their public index row holds (name, headline, workplace, school, handle). */
function card(db, userId) {
  const r = db.prepare(`SELECT name, headline, workplace, school, handle FROM people_index WHERE user_id = ?`).get(userId);
  if (r) return { handle: r.handle, name: r.name, headline: r.headline || null, label: [r.workplace, r.school].filter(Boolean).join(" · ") || null };
  const p = db.prepare(`SELECT handle FROM proof_pages WHERE user_id = ?`).get(userId);   // a connections-only page: its handle and name only
  let u = null; try { u = db.prepare(`SELECT display_name FROM users WHERE id = ?`).get(userId); } catch { u = null; }   // not every copy has the column
  return p ? { handle: p.handle, name: u?.display_name || p.handle, headline: null, label: null } : null;
}

/** My network: connections, requests to me, requests I sent, people I blocked. */
export function myNetwork(db, me) {
  const rows = db.prepare(`SELECT * FROM network_connections WHERE low_id = ? OR high_id = ? ORDER BY COALESCE(responded_at, created_at) DESC`).all(me, me);
  const other = (r) => (r.low_id === me ? r.high_id : r.low_id);
  const withCard = (r, extra = {}) => { const c = card(db, other(r)); return c ? { ...c, since: r.responded_at || r.created_at, ...extra } : null; };
  return {
    connections: rows.filter(r => r.status === "accepted").map(r => withCard(r)).filter(Boolean),
    incoming: rows.filter(r => r.status === "pending" && r.requester_id !== me).map(r => withCard(r, { note: r.note || null })).filter(Boolean),
    outgoing: rows.filter(r => r.status === "pending" && r.requester_id === me).map(r => withCard(r)).filter(Boolean),
    blocked: db.prepare(`SELECT blocked_id FROM network_blocks WHERE blocker_id = ?`).pluck().all(me).map(id => card(db, id)).filter(Boolean),
    cap: DAILY_REQUEST_CAP,
  };
}

/**
 * People you may know — ONLY public pages (people_index), sharing your latest workplace or school. Never you, never anyone
 * already connected, asked, or blocked either way. Your own workplace / school come from your own profile sections.
 */
export function suggestions(db, me, { limit = SUGGESTIONS_SHOWN } = {}) {
  const mine = db.prepare(`SELECT workplace, school FROM people_index WHERE user_id = ?`).get(me) || (() => {
    try {
      const w = db.prepare(`SELECT company FROM profile_experience WHERE user_id = ? ORDER BY position, id LIMIT 1`).pluck().get(me) || null;
      const s = db.prepare(`SELECT school FROM profile_education WHERE user_id = ? ORDER BY position, id LIMIT 1`).pluck().get(me) || null;
      return { workplace: w, school: s };
    } catch { return { workplace: null, school: null }; }
  })();
  const keys = [mine.workplace, mine.school].map(x => String(x || "").trim().toLowerCase()).filter(Boolean);
  if (!keys.length) return { people: [], why: "Add where you work or study to your profile to see people you may know." };
  const rows = db.prepare(`SELECT user_id, name, headline, workplace, school, handle FROM people_index
      WHERE user_id != ? AND (LOWER(TRIM(COALESCE(workplace, ''))) IN (${keys.map(() => "?").join(",")}) OR LOWER(TRIM(COALESCE(school, ''))) IN (${keys.map(() => "?").join(",")}))
      LIMIT 200`).all(me, ...keys, ...keys);
  const people = rows.filter(r => relation(db, me, r.user_id) === "none").slice(0, limit).map(r => ({
    handle: r.handle, name: r.name, headline: r.headline || null, label: [r.workplace, r.school].filter(Boolean).join(" · ") || null,
    why: keys.includes(String(r.workplace || "").trim().toLowerCase()) ? `Also at ${r.workplace}` : `Also studied at ${r.school}`,
  }));
  return { people, why: null };
}

/** D183's viewer for a page: 'connection' when the network is on and the two are connected, else 'public'. */
export function profileViewerFor(db, viewerId, ownerId) {
  if (viewerId == null || viewerId === ownerId) return viewerId === ownerId && viewerId != null ? "owner" : "public";
  try { return networkEnabled(db) && isConnected(db, viewerId, ownerId) ? "connection" : "public"; } catch { return "public"; }
}
