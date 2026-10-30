// routes/inbox.js — ⭐ D103 · THE INBOX'S DOORS.
//
// Hook (mounted BEFORE the JSON parser — the signature is over the raw body):
//   POST /api/hooks/inbound   Resend's inbound webhook (`email.received`), Svix-signed with RESEND_INBOUND_SECRET.
//                             The event carries the message's metadata; its body is fetched by id (fetchBody).
//                             No secret on the server = 503: the door is off, not open.
// User (requireAuth):
//   GET  /api/inbox/address            the private forwarding address (made on first ask) + the filter steps
//   POST /api/inbox/address/revoke     intake stops at once
//   GET  /api/inbox/gmail-filter.xml   an importable Gmail filter that forwards the ATS senders' mail
//   GET  /api/inbox?category=&applicationId=   the messages (a 280-character preview each)
//   POST /api/inbox/:id/category       { category } — re-file in one press (the correction is counted per rule)
//   POST /api/inbox/:id/attach         { applicationId } — "Attach to an application"
//   PUT  /api/inbox/code-optins/:portal { on } — D103 P5: the apply worker may read this portal's codes
import express from "express";
import { verifySvixSignature } from "../services/emailSuppression.js";
import {
  ingestMessage, addressFor, revokeAddress, listMessages, refile, attach, setCodeOptIn, gmailFilterXml, CATEGORIES, INBOX_DOMAIN,
} from "../services/inbox.js";

/**
 * The body of a received message, by its id. ⚠ The Receiving API's path is the agent's reading of Resend's docs
 * (10-30) — verified on the owner's first live message; a failure stores the message from its subject alone.
 */
export function resendBodyFetcher({ env = process.env, fetchImpl = fetch } = {}) {
  return async (emailId) => {
    if (!env.RESEND_API_KEY || !emailId) return null;
    const r = await fetchImpl(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, {
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}` }, signal: AbortSignal.timeout(10_000) });
    if (!r.ok) return null;
    const j = await r.json();
    return { text: j.text ?? null, html: j.html ?? null };
  };
}

export function createInboundHookRouter(db, { env = process.env, fetchBody = resendBodyFetcher({ env }), log = console } = {}) {
  const router = express.Router();
  router.post("/api/hooks/inbound", express.raw({ type: "*/*", limit: "256kb" }), async (req, res) => {
    const v = verifySvixSignature({ rawBody: req.body, headers: req.headers, secret: env.RESEND_INBOUND_SECRET });
    if (!v.ok) return res.status(v.reason === "unconfigured" ? 503 : 401).json({ error: v.reason });
    let event;
    try { event = JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString("utf8") : String(req.body)); }
    catch { return res.status(400).json({ error: "bad_json" }); }
    if (event?.type && event.type !== "email.received") return res.json({ ok: true, ignored: true });
    const d = event?.data || event || {};
    let body = { text: d.text ?? null, html: d.html ?? null };
    if (!body.text && !body.html) {
      try { body = (await fetchBody(d.email_id || d.id)) || body; } catch (e) { log.warn?.(`[inbox] body fetch failed: ${e.message}`); }
    }
    const r = ingestMessage(db, {
      providerId: String(d.email_id || d.id || req.headers["svix-id"] || "").slice(0, 120) || null,
      to: d.to || [], from: d.from || "", subject: d.subject || "",
      text: body.text, html: body.html,
      receivedAt: d.created_at ? Math.floor(Date.parse(d.created_at) / 1000) || null : null,
    });
    // Never the sender, never the subject in the log — a category and whether it matched.
    if (r.stored) log.log?.(`[inbox] stored ${r.category}${r.applicationId ? " (matched)" : ""}${r.advanced ? " → status moved" : ""}`);
    res.json({ ok: true, stored: r.stored, ...(r.stored ? {} : { reason: r.reason }) });
  });
  return router;
}

export default function inboxRoutes(app, db, requireAuth) {
  const fail = (res, e) => res.status(e.status || 500).json({ error: e.code || "error", message: e.message });

  app.get("/api/inbox/address", requireAuth, (req, res) => {
    const a = addressFor(db, req.user.id);
    res.json({ ...a, domain: INBOX_DOMAIN, steps: [
      "In Gmail: Settings → See all settings → Forwarding and POP/IMAP → Add a forwarding address → paste the address above.",
      "Gmail sends a confirmation code to it — it appears in your draft Inbox under Verification; confirm it in Gmail.",
      "Settings → Filters and Blocked Addresses → Import filters → choose the draft filter file → Create filters.",
      "Only mail from applicant-tracking systems is forwarded; employers keep writing to your own address.",
    ] });
  });
  app.post("/api/inbox/address/revoke", requireAuth, (req, res) => res.json({ revoked: revokeAddress(db, req.user.id) }));
  app.get("/api/inbox/gmail-filter.xml", requireAuth, (req, res) => {
    res.type("application/xml").set("Content-Disposition", 'attachment; filename="draft-gmail-filter.xml"')
      .send(gmailFilterXml(addressFor(db, req.user.id).address));
  });
  app.get("/api/inbox", requireAuth, (req, res) => {
    const category = req.query.category ? String(req.query.category) : null;
    if (category && !CATEGORIES.includes(category)) return res.status(400).json({ error: "bad_category" });
    res.json({ categories: CATEGORIES, messages: listMessages(db, req.user.id, { category, applicationId: req.query.applicationId || null }) });
  });
  app.post("/api/inbox/:id/category", requireAuth, (req, res) => {
    try { const r = refile(db, req.user.id, req.params.id, String(req.body?.category || "")); return r ? res.json(r) : res.status(404).json({ error: "not_found" }); }
    catch (e) { fail(res, e); }
  });
  app.post("/api/inbox/:id/attach", requireAuth, (req, res) => {
    const r = attach(db, req.user.id, req.params.id, req.body?.applicationId);
    return r ? res.json(r) : res.status(404).json({ error: "not_found" });
  });
  app.put("/api/inbox/code-optins/:portal", requireAuth, (req, res) => {
    if (typeof req.body?.on !== "boolean") return res.status(400).json({ error: "on must be true or false" });
    try { res.json({ portals: setCodeOptIn(db, req.user.id, req.params.portal, req.body.on) }); } catch (e) { fail(res, e); }
  });
}
