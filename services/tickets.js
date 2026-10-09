// services/tickets.js — ⭐ D88 P3 · support tickets: the user's side (Settings → Help) and the admin queue
// (Admin → People → Support).
//
// Decided 10-09 (39d) under the owner's "go with your recommended decisions" (D88 left them to the owner):
//   categories   account · résumés and drafts · applications and the extension · something broke · a privacy
//                request · something else
//   due          2 days from the user's last message; a privacy request 30 days from when it was opened
//                (GDPR's month — stricter than CCPA's 45 days, so one timer covers both)
//   retention    a ticket is deleted with its account (ON DELETE CASCADE) and 24 months after it is solved
//   canned       a few replies in code (CANNED), editable before sending
// ⛔ An INTERNAL note never reaches the user: the user's reads filter on internal = 0 in SQL, and an internal note
// sends no email. ⛔ No model writes a reply (D17). ⛔ No attachments in v1 — they carry personal data.
// The context attached to a ticket is the account id, the app version and the page — never a form answer.

export const TICKET_CATEGORIES = Object.freeze({
  account: "My account",
  resumes: "Résumés and drafts",
  applications: "Applications and the extension",
  bug: "Something broke",
  privacy_request: "A privacy request (a copy of my data, or deleting it)",
  other: "Something else",
});
export const TICKET_STATUSES = Object.freeze({ open: "Open", waiting_on_user: "Waiting on the user", solved: "Solved" });
export const TICKET_PRIORITIES = Object.freeze(["low", "normal", "high"]);
export const DUE_SECONDS = 2 * 86400;
export const PRIVACY_DUE_SECONDS = 30 * 86400;
export const RETENTION_SECONDS = 730 * 86400;
export const NEW_TICKETS_PER_DAY = 5;
export const CANNED = Object.freeze([
  ["Looking into it", "Thanks for writing — I'm looking into this now and will reply here as soon as I know more."],
  ["Need more detail", "Thanks — could you tell me which job (or page) this happened on, and roughly when? A screenshot described in words helps too."],
  ["Fixed", "This is fixed now. Could you try again and reply here if anything still looks wrong?"],
  ["Privacy request received", "We have your request. A copy of your data is available any time from Settings → Your data; if you want the account deleted, Settings → Delete account does it at once. If you would rather we do it, reply here to confirm and we will within 30 days."],
]);

const now = () => Math.floor(Date.now() / 1000);

export class TicketError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

const clean = (s, max) => String(s ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);

/** The user opens a ticket. Returns its id. */
export function openTicket(db, { userId, category, subject, message, context = {} }) {
  if (!TICKET_CATEGORIES[category]) throw new TicketError("Pick what it is about.");
  const s = clean(subject, 140), m = clean(message, 8000);
  if (s.length < 3) throw new TicketError("Give it a short subject.");
  if (m.length < 10) throw new TicketError("Say a little more — a sentence or two is enough.");
  const today = db.prepare("SELECT COUNT(*) AS n FROM tickets WHERE user_id = ? AND created_at > unixepoch() - 86400").get(userId).n;
  if (today >= NEW_TICKETS_PER_DAY) throw new TicketError(`You have opened ${NEW_TICKETS_PER_DAY} requests today — reply on one of them instead, and we will see it.`, 429);
  // the context is three named things, never whatever the client sent
  const ctx = { accountId: userId, appVersion: clean(context.appVersion, 40) || null, page: clean(context.page, 200) || null };
  const t = now();
  const due = t + (category === "privacy_request" ? PRIVACY_DUE_SECONDS : DUE_SECONDS);
  return db.transaction(() => {
    const id = db.prepare(`INSERT INTO tickets (user_id, category, subject, status, priority, source, context_json, created_at, updated_at, due_at)
      VALUES (?, ?, ?, 'open', ?, 'app', ?, ?, ?, ?)`).run(userId, category, s, category === "privacy_request" ? "high" : "normal", JSON.stringify(ctx), t, t, due).lastInsertRowid;
    db.prepare("INSERT INTO ticket_messages (ticket_id, author_type, author_id, body, internal, created_at) VALUES (?, 'user', ?, ?, 0, ?)").run(id, userId, m, t);
    return id;
  })();
}

/** The user's own tickets — never another's, never an internal note. */
export function userTickets(db, userId) {
  return db.prepare(`SELECT t.id, t.category, t.subject, t.status, t.created_at, t.updated_at,
      (SELECT COUNT(*) FROM ticket_messages m WHERE m.ticket_id = t.id AND m.internal = 0) AS messages,
      (SELECT m.author_type FROM ticket_messages m WHERE m.ticket_id = t.id AND m.internal = 0 ORDER BY m.id DESC LIMIT 1) AS last_from
    FROM tickets t WHERE t.user_id = ? ORDER BY t.updated_at DESC LIMIT 50`).all(userId);
}

export function userTicket(db, userId, ticketId) {
  const t = db.prepare("SELECT id, category, subject, status, created_at, updated_at FROM tickets WHERE id = ? AND user_id = ?").get(ticketId, userId);
  if (!t) throw new TicketError("No such request.", 404);
  const messages = db.prepare(`SELECT id, author_type, body, created_at FROM ticket_messages
    WHERE ticket_id = ? AND internal = 0 ORDER BY id`).all(ticketId);
  return { ...t, messages };
}

/** The user replies — the ticket is open again and due in 2 days (a privacy request keeps its legal date). */
export function userReply(db, userId, ticketId, body) {
  const t = db.prepare("SELECT id, category, due_at FROM tickets WHERE id = ? AND user_id = ?").get(ticketId, userId);
  if (!t) throw new TicketError("No such request.", 404);
  const m = clean(body, 8000);
  if (m.length < 2) throw new TicketError("The reply is empty.");
  const tm = now();
  db.transaction(() => {
    db.prepare("INSERT INTO ticket_messages (ticket_id, author_type, author_id, body, internal, created_at) VALUES (?, 'user', ?, ?, 0, ?)").run(t.id, userId, m, tm);
    db.prepare("UPDATE tickets SET status = 'open', solved_at = NULL, updated_at = ?, due_at = ? WHERE id = ?")
      .run(tm, t.category === "privacy_request" ? t.due_at : tm + DUE_SECONDS, t.id);
  })();
}

// ── the admin side ────────────────────────────────────────────────────────────────────────────────────────

export function ticketQueue(db, { status = "open", category = "" } = {}) {
  const where = [], args = [];
  if (status && status !== "all") {
    if (status === "unsolved") where.push("t.status != 'solved'");
    else if (TICKET_STATUSES[status]) { where.push("t.status = ?"); args.push(status); }
  }
  if (category && TICKET_CATEGORIES[category]) { where.push("t.category = ?"); args.push(category); }
  const rows = db.prepare(`SELECT t.id, t.user_id, u.username, t.category, t.subject, t.status, t.priority, t.assignee, a.username AS assignee_name,
      t.created_at, t.updated_at, t.due_at, t.solved_at,
      (SELECT m.author_type FROM ticket_messages m WHERE m.ticket_id = t.id AND m.internal = 0 ORDER BY m.id DESC LIMIT 1) AS last_from
    FROM tickets t JOIN users u ON u.id = t.user_id LEFT JOIN users a ON a.id = t.assignee
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY CASE t.status WHEN 'solved' THEN 1 ELSE 0 END, t.due_at ASC, t.id DESC LIMIT 200`).all(...args);
  const c = db.prepare(`SELECT
      SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open,
      SUM(CASE WHEN status = 'waiting_on_user' THEN 1 ELSE 0 END) AS waiting,
      SUM(CASE WHEN status != 'solved' AND due_at < unixepoch() THEN 1 ELSE 0 END) AS overdue,
      SUM(CASE WHEN status != 'solved' AND category = 'privacy_request' THEN 1 ELSE 0 END) AS privacy
    FROM tickets`).get();
  return { rows, counts: { open: c.open || 0, waiting: c.waiting || 0, overdue: c.overdue || 0, privacy: c.privacy || 0 } };
}

export function adminTicket(db, ticketId) {
  const t = db.prepare(`SELECT t.*, u.username, p.email FROM tickets t JOIN users u ON u.id = t.user_id
    LEFT JOIN user_profile p ON p.user_id = t.user_id WHERE t.id = ?`).get(ticketId);
  if (!t) throw new TicketError("No such ticket.", 404);
  const messages = db.prepare(`SELECT m.id, m.author_type, m.body, m.internal, m.created_at, a.username AS author
    FROM ticket_messages m LEFT JOIN users a ON a.id = m.author_id AND m.author_type = 'admin' WHERE m.ticket_id = ? ORDER BY m.id`).all(ticketId);
  let context = null;
  try { context = JSON.parse(t.context_json || "null"); } catch { /* none */ }
  return { id: t.id, userId: t.user_id, username: t.username, email: t.email, category: t.category, subject: t.subject, status: t.status,
    priority: t.priority, assignee: t.assignee, createdAt: t.created_at, updatedAt: t.updated_at, dueAt: t.due_at, solvedAt: t.solved_at,
    context, messages };
}

/** An admin writes. A reply waits on the user; an internal note changes nothing the user can see. */
export function adminReply(db, { ticketId, actorId, body, internal = false, solve = false }) {
  const t = db.prepare("SELECT id, status FROM tickets WHERE id = ?").get(ticketId);
  if (!t) throw new TicketError("No such ticket.", 404);
  const m = clean(body, 8000);
  if (m.length < 2) throw new TicketError("The message is empty.");
  const tm = now();
  db.transaction(() => {
    db.prepare("INSERT INTO ticket_messages (ticket_id, author_type, author_id, body, internal, created_at) VALUES (?, 'admin', ?, ?, ?, ?)")
      .run(t.id, actorId ?? null, m, internal ? 1 : 0, tm);
    if (!internal) {
      db.prepare("UPDATE tickets SET status = ?, solved_at = ?, updated_at = ? WHERE id = ?")
        .run(solve ? "solved" : "waiting_on_user", solve ? tm : null, tm, t.id);
    } else db.prepare("UPDATE tickets SET updated_at = ? WHERE id = ?").run(tm, t.id);
  })();
  return { internal: !!internal };
}

export function setTicketFields(db, { ticketId, status, priority, assignee }) {
  const t = db.prepare("SELECT id, status, priority, assignee, solved_at FROM tickets WHERE id = ?").get(ticketId);
  if (!t) throw new TicketError("No such ticket.", 404);
  const next = { status: status ?? t.status, priority: priority ?? t.priority, assignee: assignee === undefined ? t.assignee : assignee };
  if (!TICKET_STATUSES[next.status]) throw new TicketError("Unknown status.");
  if (!TICKET_PRIORITIES.includes(next.priority)) throw new TicketError("Unknown priority.");
  if (next.assignee != null && !db.prepare("SELECT 1 FROM users WHERE id = ? AND is_admin = 1").get(next.assignee)) throw new TicketError("Only an admin can be assigned.");
  db.prepare("UPDATE tickets SET status = ?, priority = ?, assignee = ?, solved_at = ?, updated_at = unixepoch() WHERE id = ?")
    .run(next.status, next.priority, next.assignee, next.status === "solved" ? (t.status === "solved" ? t.solved_at : now()) : null, t.id);
  return { before: t, after: next };
}

/** The retention rule: a ticket solved more than 24 months ago is deleted with its messages. */
export function purgeSolvedTickets(db) {
  try { return db.prepare("DELETE FROM tickets WHERE status = 'solved' AND solved_at < unixepoch() - ?").run(RETENTION_SECONDS).changes; }
  catch { return 0; }
}
