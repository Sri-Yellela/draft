// services/network/messages.js — ⭐ D180 P2 (45o) · 1:1 MESSAGES, A JOB AS A CARD, REQUESTS, MUTE, REPORT.
//
// Behind the network switch (services/network/connections.js networkEnabled — OFF by default; the routes 404 while off).
// The spec's rules, each enforced here (not in the client):
//   · STRANGERS LAND IN REQUESTS — a thread between two people who aren't connected is a 'request' until the one asked
//     accepts; the asker can send ONE message into it until then; new request threads are capped per day.
//   · NO ATTACHMENTS from anyone (v1): a message is text, or a job (a posting of the open board, drawn as a card).
//   · BLOCK STOPS EVERYTHING — a block either way refuses a send and hides the thread from both.
//   · REPORT on every message and thread — into the moderation queue (only a HASH of the reporter is kept, as D183's
//     profile reports); an admin can remove a message for both.
//   · NO AI READS ANYONE'S MESSAGES — nothing in services/network/ calls a model (test d180NoAiReadsMessagesUnasked).
//   · SEALED AT REST — every body goes through the secret box (AES-256-GCM); the database holds enc / iv / tag only.
//   · DELETE FOR ME — hides a message on my side only; account deletion removes everything (ON DELETE CASCADE).
import crypto from "node:crypto";
import { relation, isBlocked, isConnected } from "./connections.js";
import { readVisibility } from "../profilePage.js";
import { jobPath } from "../jobs/publicJobPage.js";
import { feedTarget, canSee } from "./feed.js";   // D180 P3 (45r): posts and comments are reported into the same queue

export const BODY_MAX = 4000;
export const NEW_REQUEST_THREADS_PER_DAY = 10;
export const PAGE = 50;
export const REPORT_REASONS = Object.freeze(["spam", "harassment", "scam", "inappropriate", "other"]);
const DAY = 86400;
const bad = (status, code, message) => Object.assign(new Error(message), { status, code });
const pair = (a, b) => (a < b ? [a, b] : [b, a]);
const reporterHash = (id) => crypto.createHash("sha256").update(`network-report:${id}`).digest("hex");

function personByHandle(db, handle) {
  const h = String(handle ?? "").trim().toLowerCase();
  const row = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(h) ? db.prepare(`SELECT user_id FROM proof_pages WHERE handle = ?`).get(h) : null;
  return row ? row.user_id : null;
}
const handleOf = (db, userId) => db.prepare(`SELECT handle FROM proof_pages WHERE user_id = ?`).pluck().get(userId) || null;
const nameOf = (db, userId) => db.prepare(`SELECT name FROM people_index WHERE user_id = ?`).pluck().get(userId) || handleOf(db, userId) || "A draft member";
const threadOf = (db, a, b) => { const [lo, hi] = pair(a, b); return db.prepare(`SELECT * FROM network_threads WHERE low_id = ? AND high_id = ?`).get(lo, hi) || null; };
const otherIn = (t, me) => (t.low_id === me ? t.high_id : t.low_id);
function threadFor(db, me, id) {
  const t = db.prepare(`SELECT * FROM network_threads WHERE id = ?`).get(Number(id));
  if (!t || (t.low_id !== me && t.high_id !== me)) throw bad(404, "no_such_thread", "There is no such conversation.");
  if (isBlocked(db, me, otherIn(t, me))) throw bad(404, "no_such_thread", "There is no such conversation.");
  return t;
}

/** A job of the OPEN board as a card's facts (title, company, location, its public page) — or null. */
function jobCard(db, jobId) {
  const r = db.prepare(`SELECT id, title, company, location FROM scraped_jobs WHERE id = ? AND is_active = 1`).get(Number(jobId));
  return r ? { id: r.id, title: r.title, company: r.company, location: r.location || null, path: jobPath(r) } : null;
}

/**
 * Send a message (text, or a job by its board id). Opens the thread if there is none: 'open' between connections, a
 * 'request' otherwise (the asked person's page must be open to connections or the public — a private page can't be written to).
 */
export function sendMessage(db, box, me, { to, text = null, jobId = null }, { now = Math.floor(Date.now() / 1000) } = {}) {
  const other = personByHandle(db, to);
  if (!other || other === me) throw bad(404, "no_such_person", "There is no one at that address.");
  if (isBlocked(db, me, other)) throw bad(403, "blocked", "You can't message this person.");
  const body = text == null ? "" : String(text).trim();
  if (jobId == null && !body) throw bad(400, "empty", "Write something, or send a job.");
  if (body.length > BODY_MAX) throw bad(400, "too_long", `A message is at most ${BODY_MAX} characters.`);
  const job = jobId != null ? jobCard(db, jobId) : null;
  if (jobId != null && !job) throw bad(400, "no_such_job", "That job isn't open any more.");
  let t = threadOf(db, me, other);
  if (!t) {
    let level = "only_me"; try { level = readVisibility(db, other).page; } catch { level = "only_me"; }
    if (level === "only_me" && !isConnected(db, me, other)) throw bad(404, "no_such_person", "There is no one at that address.");
    const status = isConnected(db, me, other) ? "open" : "request";
    if (status === "request") {
      const opened = db.prepare(`SELECT COUNT(*) FROM network_threads WHERE requester_id = ? AND status = 'request' AND created_at >= ?`).pluck().get(me, now - DAY);
      if (opened >= NEW_REQUEST_THREADS_PER_DAY) throw bad(429, "daily_cap", "You've written to enough new people today — try again tomorrow.");
    }
    const [lo, hi] = pair(me, other);
    const id = db.prepare(`INSERT INTO network_threads (low_id, high_id, status, requester_id, created_at, last_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(lo, hi, status, me, now, now).lastInsertRowid;
    t = db.prepare(`SELECT * FROM network_threads WHERE id = ?`).get(id);
  } else if (t.status === "request") {
    if (t.requester_id !== me) throw bad(409, "accept_first", "Accept the request to reply.");
    const mine = db.prepare(`SELECT COUNT(*) FROM network_messages WHERE thread_id = ? AND sender_id = ?`).pluck().get(t.id, me);
    if (mine >= 1) throw bad(409, "wait_for_accept", "They haven't accepted yet — one message until they do.");
  }
  const sealed = body ? box.encrypt(body) : { enc: null, iv: null, tag: null };
  const id = db.transaction(() => {
    const mid = db.prepare(`INSERT INTO network_messages (thread_id, sender_id, kind, body_enc, body_iv, body_tag, job_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(t.id, me, job ? "job" : "text", sealed.enc, sealed.iv, sealed.tag, job ? job.id : null, now).lastInsertRowid;
    db.prepare(`UPDATE network_threads SET last_at = ? WHERE id = ?`).run(now, t.id);
    db.prepare(`INSERT INTO network_reads (thread_id, user_id, last_read_id) VALUES (?, ?, ?) ON CONFLICT(thread_id, user_id) DO UPDATE SET last_read_id = excluded.last_read_id`).run(t.id, me, mid);
    return mid;
  })();
  return { threadId: t.id, messageId: Number(id), status: t.status };
}

function opened(box, m) {
  if (!m.body_enc) return "";
  try { return box.decrypt(m.body_enc, m.body_iv, m.body_tag); } catch { return ""; }
}

/** My conversations: { threads (open), requests (asked of me), sent (my requests not yet accepted) } — newest first. */
export function myThreads(db, box, me) {
  const rows = db.prepare(`SELECT * FROM network_threads WHERE low_id = ? OR high_id = ? ORDER BY last_at DESC LIMIT 200`).all(me, me);
  const shape = (t) => {
    const other = otherIn(t, me);
    if (isBlocked(db, me, other)) return null;
    const last = db.prepare(`SELECT * FROM network_messages WHERE thread_id = ? AND removed = 0 AND NOT ((sender_id = ? AND hidden_sender = 1) OR (sender_id != ? AND hidden_other = 1)) ORDER BY id DESC LIMIT 1`).get(t.id, me, me);
    const read = db.prepare(`SELECT last_read_id, muted FROM network_reads WHERE thread_id = ? AND user_id = ?`).get(t.id, me) || { last_read_id: 0, muted: 0 };
    const unread = db.prepare(`SELECT COUNT(*) FROM network_messages WHERE thread_id = ? AND sender_id != ? AND id > ? AND removed = 0`).pluck().get(t.id, me, read.last_read_id);
    const preview = !last ? "" : last.kind === "job" ? `A job: ${jobCard(db, last.job_id)?.title || "no longer open"}` : opened(box, last).slice(0, 120);
    return { id: t.id, with: { handle: handleOf(db, other), name: nameOf(db, other) }, status: t.status, mine: t.requester_id === me,
      lastAt: t.last_at, preview, unread: read.muted ? 0 : unread, muted: !!read.muted, connected: relation(db, me, other) === "connected" };
  };
  const all = rows.map(shape).filter(Boolean);
  return {
    threads: all.filter(t => t.status === "open"),
    requests: all.filter(t => t.status === "request" && !t.mine),
    sent: all.filter(t => t.status === "request" && t.mine),
    unread: all.filter(t => t.status === "open" || !t.mine).reduce((s, t) => s + t.unread, 0),
  };
}

/** One conversation's messages (oldest first, PAGE at a time before `before`), and it is marked read. */
export function readThread(db, box, me, threadId, { before = null } = {}) {
  const t = threadFor(db, me, threadId);
  const rows = db.prepare(`SELECT * FROM network_messages WHERE thread_id = ? ${before ? "AND id < ?" : ""} ORDER BY id DESC LIMIT ?`)
    .all(...[t.id, ...(before ? [Number(before)] : []), PAGE]).reverse();
  const visible = rows.filter(m => !(m.sender_id === me ? m.hidden_sender : m.hidden_other));
  const lastId = rows.length ? rows[rows.length - 1].id : 0;
  if (lastId) db.prepare(`INSERT INTO network_reads (thread_id, user_id, last_read_id) VALUES (?, ?, ?) ON CONFLICT(thread_id, user_id) DO UPDATE SET last_read_id = MAX(last_read_id, excluded.last_read_id)`).run(t.id, me, lastId);
  const other = otherIn(t, me);
  return {
    id: t.id, status: t.status, mine: t.requester_id === me, with: { handle: handleOf(db, other), name: nameOf(db, other) },
    // A request from someone you aren't connected to: its links are shown as plain words (the client draws them so).
    fromStranger: t.status === "request" && t.requester_id !== me,
    messages: visible.map(m => ({ id: m.id, mine: m.sender_id === me, at: m.created_at, kind: m.kind,
      removed: !!m.removed, text: m.removed ? null : opened(box, m), job: m.kind === "job" && !m.removed ? jobCard(db, m.job_id) : null })),
    more: rows.length === PAGE,
  };
}

/** The asked person accepts a request (it becomes an open thread) or declines it (the thread is deleted, they aren't told). */
export function answerRequest(db, me, threadId, accept) {
  const t = threadFor(db, me, threadId);
  if (t.status !== "request" || t.requester_id === me) throw bad(404, "no_request", "There is no request here.");
  if (accept) db.prepare(`UPDATE network_threads SET status = 'open' WHERE id = ?`).run(t.id);
  else db.prepare(`DELETE FROM network_threads WHERE id = ?`).run(t.id);
  return { status: accept ? "open" : "declined" };
}

/** Hide one message on my side only. */
export function hideMessage(db, me, messageId) {
  const m = db.prepare(`SELECT m.*, t.low_id, t.high_id FROM network_messages m JOIN network_threads t ON t.id = m.thread_id WHERE m.id = ?`).get(Number(messageId));
  if (!m || (m.low_id !== me && m.high_id !== me)) throw bad(404, "no_such_message", "There is no such message.");
  db.prepare(`UPDATE network_messages SET ${m.sender_id === me ? "hidden_sender" : "hidden_other"} = 1 WHERE id = ?`).run(m.id);
  return { hidden: true };
}

export function muteThread(db, me, threadId, muted) {
  const t = threadFor(db, me, threadId);
  db.prepare(`INSERT INTO network_reads (thread_id, user_id, muted) VALUES (?, ?, ?) ON CONFLICT(thread_id, user_id) DO UPDATE SET muted = excluded.muted`).run(t.id, me, muted ? 1 : 0);
  return { muted: !!muted };
}

/** Report a message, a conversation or a profile. Only a hash of the reporter is kept; the reported person isn't told. */
export function report(db, me, { kind, id = null, handle = null, reason, details = null }) {
  if (!["message", "thread", "profile", "post", "comment"].includes(kind)) throw bad(400, "bad_kind", "Report a message, a conversation, a post, a comment or a profile.");
  if (!REPORT_REASONS.includes(reason)) throw bad(400, "bad_reason", `Pick a reason: ${REPORT_REASONS.join(", ")}.`);
  let reported = null, target = null;
  if (kind === "profile") { reported = personByHandle(db, handle); target = reported; }
  else if (kind === "post" || kind === "comment") {
    // ⭐ D180 P3 (45r): a post or comment the reporter can see (their own feed's) — same queue, same hash.
    const t = feedTarget(db, kind, id);
    const postAuthor = kind === "post" ? t?.authorId
      : db.prepare(`SELECT p.author_id FROM network_comments c JOIN network_posts p ON p.id = c.post_id WHERE c.id = ?`).pluck().get(Number(id));
    if (!t || t.removed || t.authorId === me || postAuthor == null || !canSee(db, me, postAuthor)) throw bad(404, `no_such_${kind}`, `There is no such ${kind}.`);
    reported = t.authorId; target = Number(id);
  }
  else if (kind === "thread") { const t = threadFor(db, me, id); reported = otherIn(t, me); target = t.id; }
  else {
    const m = db.prepare(`SELECT m.id, m.sender_id, t.low_id, t.high_id FROM network_messages m JOIN network_threads t ON t.id = m.thread_id WHERE m.id = ?`).get(Number(id));
    if (!m || (m.low_id !== me && m.high_id !== me) || m.sender_id === me) throw bad(404, "no_such_message", "There is no such message.");
    reported = m.sender_id; target = m.id;
  }
  if (!reported || reported === me) throw bad(404, "no_such_person", "There is no one to report.");
  const d = details == null ? null : String(details).trim().slice(0, 1000) || null;
  const rid = db.prepare(`INSERT INTO network_reports (reporter_hash, reported_user_id, target_kind, target_id, reason, details) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(reporterHash(me), reported, kind, target, reason, d).lastInsertRowid;
  return { reported: true, id: Number(rid) };
}

// ── the moderation queue (Admin) ──
/** Reports with what they point at — a reported MESSAGE is opened for the moderator (the one read the spec allows: a report). */
export function reportQueue(db, box, { status = "open", limit = 100 } = {}) {
  const st = ["open", "actioned", "dismissed"].includes(status) ? status : "open";
  return db.prepare(`SELECT * FROM network_reports WHERE status = ? ORDER BY created_at LIMIT ?`).all(st, Math.min(500, Math.max(1, Number(limit) || 100))).map(r => {
    let target = null;
    if (r.target_kind === "message") {
      const m = db.prepare(`SELECT * FROM network_messages WHERE id = ?`).get(r.target_id);
      target = m ? { kind: m.kind, removed: !!m.removed, text: m.removed ? null : opened(box, m), job: m.kind === "job" ? jobCard(db, m.job_id) : null } : null;
    } else if (r.target_kind === "post" || r.target_kind === "comment") {
      const t = feedTarget(db, r.target_kind, r.target_id);   // D180 P3 (45r)
      target = t ? { kind: r.target_kind, removed: t.removed, text: t.removed ? null : t.text, link: t.link || null } : null;
    }
    const total = db.prepare(`SELECT COUNT(*) FROM network_reports WHERE reported_user_id = ?`).pluck().get(r.reported_user_id);
    return { id: r.id, kind: r.target_kind, targetId: r.target_id, reason: r.reason, details: r.details, status: r.status, note: r.note,
      at: r.created_at, resolvedAt: r.resolved_at, reported: { handle: handleOf(db, r.reported_user_id), name: nameOf(db, r.reported_user_id) },
      reportsOnThisPerson: total, target };
  });
}
/** An admin's decision: actioned (optionally removing the reported message for both) or dismissed; re-open puts it back. */
export function resolveReport(db, reportId, { status, note = null, removeMessage = false }) {
  if (!["open", "actioned", "dismissed"].includes(status)) throw bad(400, "bad_status", "actioned, dismissed or open.");
  const r = db.prepare(`SELECT * FROM network_reports WHERE id = ?`).get(Number(reportId));
  if (!r) throw bad(404, "no_such_report", "There is no such report.");
  db.transaction(() => {
    db.prepare(`UPDATE network_reports SET status = ?, note = ?, resolved_at = ? WHERE id = ?`).run(status, note == null ? r.note : String(note).slice(0, 1000), status === "open" ? null : Math.floor(Date.now() / 1000), r.id);
    if (removeMessage && r.target_kind === "message") db.prepare(`UPDATE network_messages SET removed = 1, body_enc = NULL, body_iv = NULL, body_tag = NULL WHERE id = ?`).run(r.target_id);
    // D180 P3 (45r): a removed post / comment is gone for everyone, its words cleared.
    if (removeMessage && r.target_kind === "post") db.prepare(`UPDATE network_posts SET removed_at = unixepoch(), body = NULL, link_url = NULL WHERE id = ?`).run(r.target_id);
    if (removeMessage && r.target_kind === "comment") db.prepare(`UPDATE network_comments SET removed_at = unixepoch(), body = '' WHERE id = ?`).run(r.target_id);
  })();
  return { ok: true };
}
