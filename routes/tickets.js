// routes/tickets.js — ⭐ D88 P3 · support tickets.
//   /api/support        the signed-in user's own requests (Settings → Help) — never another's, never an internal note
//   /api/admin/tickets  the queue (Admin → People → Support) — admin only, checked on every route
// Mail: a new request and every user reply go to support@ (the owner's inbox); an admin's reply goes to the user,
// Reply-To support@, with a link back to the thread. An internal note sends nothing. ⛔ No model writes a reply (D17).
import express from "express";
import {
  openTicket, userTickets, userTicket, userReply, ticketQueue, adminTicket, adminReply, setTicketFields,
  TicketError, TICKET_CATEGORIES, TICKET_STATUSES, TICKET_PRIORITIES, CANNED,
} from "../services/tickets.js";
import { writeAudit } from "../services/userAdmin.js";

export function createSupportRouters({ db, requireAuth, requireAdmin, sendEmail, supportEmail, appUrl }) {
  const fail = (res, e) => (e instanceof TicketError
    ? res.status(e.status).json({ error: e.message })
    : (console.error("[tickets]", e.message), res.status(500).json({ error: "That did not go through — try again." })));
  const mail = async (msg) => { try { await sendEmail({ ...msg, db }); } catch (e) { console.warn("[tickets] mail failed:", e.message); } };
  const tid = (req) => Number.parseInt(req.params.id, 10);

  // ── the user ──
  const user = express.Router();
  user.get("/tickets", requireAuth, (req, res) => res.json({ tickets: userTickets(db, req.user.id), categories: TICKET_CATEGORIES }));
  user.get("/tickets/:id", requireAuth, (req, res) => { try { res.json(userTicket(db, req.user.id, tid(req))); } catch (e) { fail(res, e); } });
  user.post("/tickets", requireAuth, async (req, res) => {
    try {
      const { category, subject, message, context } = req.body || {};
      const id = openTicket(db, { userId: req.user.id, category, subject, message, context: context || {} });
      await mail({ to: supportEmail, subject: `[draft support #${id}] ${String(subject).slice(0, 120)}`,
        text: `${req.user.username} (account ${req.user.id}) opened a request — ${TICKET_CATEGORIES[category]}.\n\n${String(message).slice(0, 4000)}\n\nAnswer it in draft: ${appUrl(req)}/admin?g=people&s=support&t=${id}` });
      res.status(201).json({ id });
    } catch (e) { fail(res, e); }
  });
  user.post("/tickets/:id/messages", requireAuth, async (req, res) => {
    try {
      userReply(db, req.user.id, tid(req), req.body?.body);
      await mail({ to: supportEmail, subject: `[draft support #${tid(req)}] a reply from ${req.user.username}`,
        text: `${String(req.body?.body || "").slice(0, 4000)}\n\nIn draft: ${appUrl(req)}/admin?g=people&s=support&t=${tid(req)}` });
      res.json({ ok: true });
    } catch (e) { fail(res, e); }
  });

  // ── the admin ──
  const admin = express.Router();
  admin.get("/", requireAdmin, (req, res) => {
    try { res.json({ ...ticketQueue(db, { status: req.query.status, category: req.query.category }), categories: TICKET_CATEGORIES, statuses: TICKET_STATUSES, priorities: TICKET_PRIORITIES, canned: CANNED }); }
    catch (e) { fail(res, e); }
  });
  admin.get("/:id", requireAdmin, (req, res) => { try { res.json(adminTicket(db, tid(req))); } catch (e) { fail(res, e); } });
  admin.post("/:id/messages", requireAdmin, async (req, res) => {
    try {
      const internal = req.body?.internal === true;
      const solve = req.body?.solve === true && !internal;
      const t = adminTicket(db, tid(req));
      adminReply(db, { ticketId: t.id, actorId: req.user.id, body: req.body?.body, internal, solve });
      writeAudit(db, { actorId: req.user.id, action: internal ? "ticket.note" : "ticket.reply", target: `user:${t.userId}`,
        after: { ticket: t.id, solved: solve } });
      let mailed = false;
      if (!internal && t.email) {
        const r = await (async () => { try { return await sendEmail({ db, to: t.email, subject: `Re: ${t.subject} [#${t.id}]`, replyTo: supportEmail,
          text: `${String(req.body?.body || "").trim()}\n\n—\nRead the whole thread, or reply, in draft: ${appUrl(req)}/app/account#help\n(Or reply to this email.)` }); }
          catch (e) { console.warn("[tickets] reply mail failed:", e.message); return null; } })();
        mailed = !!r?.ok;
      }
      res.json({ ok: true, internal, mailed });
    } catch (e) { fail(res, e); }
  });
  admin.post("/:id", requireAdmin, (req, res) => {
    try {
      const t = adminTicket(db, tid(req));
      const { status, priority, assignee } = req.body || {};
      const out = setTicketFields(db, { ticketId: t.id, status, priority, assignee: assignee === undefined ? undefined : (assignee == null ? null : Number(assignee)) });
      writeAudit(db, { actorId: req.user.id, action: "ticket.update", target: `user:${t.userId}`,
        before: { ticket: t.id, status: out.before.status, priority: out.before.priority }, after: { ticket: t.id, status: out.after.status, priority: out.after.priority } });
      res.json({ ok: true });
    } catch (e) { fail(res, e); }
  });

  return { user, admin };
}
