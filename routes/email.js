// routes/email.js — ⭐ D73 §B · the email doors.
//
// Two routers, for the same reason as routes/byom.js:
//   · hooksRouter   — POST /api/hooks/resend: Resend's webhook, header-authenticated (Svix signature over the
//                     RAW body), mounted BEFORE the JSON parser. Bounces and complaints → the suppression list;
//                     ⭐ D94: failed sends, provider suppressions and the domain's status → services/emailHealth.js.
//   · appRouter     — the signed-out unsubscribe page (GET and the one-click POST, /u/:token), the user's own
//                     marketing switch, and Admin → Send a notice (dry run, send, log).
import express from "express";
import { verifySvixSignature } from "../services/emailSuppression.js";
import { handleEmailEvent, emailHealthSummary, listSuppressions, removeSuppression, undoSuppressionRemoval, TEST_ADDRESSES } from "../services/emailHealth.js";
import { sendEmail } from "../services/emailService.js";
import { verifyUnsubscribeToken, unsubscribe, setMarketingConsent, marketingState } from "../services/emailConsent.js";
import { noticeDryRun, sendNotice, AUDIENCES, NOTICE_DEFAULT_CEILING } from "../services/notices.js";

const page = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · draft</title><style>body{margin:0;font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;background:#F3ECE0;color:#1E1915}
main{max-width:460px;margin:64px auto;padding:0 16px}.c{background:#FBF7F0;border:1px solid #DDD2C3;border-radius:6px;padding:22px}
@media (prefers-color-scheme:dark){body{background:#1C1815;color:#F2EADF}.c{background:#26201C;border-color:#3B332C}}</style></head>
<body><main><div class="c"><h1 style="font-size:18px;margin:0 0 8px">${title}</h1>${body}</div></main></body></html>`;

export function createEmailRouters({ db, requireAuth, requireAdmin, env = process.env, log = console, sendImpl = sendEmail }) {
  const hooksRouter = express.Router();
  hooksRouter.post("/api/hooks/resend", express.raw({ type: "*/*", limit: "64kb" }), (req, res) => {
    const v = verifySvixSignature({ rawBody: req.body, headers: req.headers, secret: env.RESEND_WEBHOOK_SECRET });
    if (!v.ok) return res.status(v.reason === "unconfigured" ? 503 : 401).json({ error: v.reason });
    let event;
    try { event = JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString("utf8") : String(req.body)); }
    catch { return res.status(400).json({ error: "bad_json" }); }
    // D94: keyed by the Svix id — a retried delivery is recorded and acted on once. An unhandled type: 200, nothing changes.
    const r = handleEmailEvent(db, event, { svixId: req.headers["svix-id"] });
    if (r.suppressed.length) log.warn?.(`[email] suppressed ${r.suppressed.length} address(es) after ${event.type}`);
    if (r.recorded && event.type === "email.failed") log.warn?.(`[email] a send FAILED at Resend: ${event?.data?.failed?.reason ?? "unknown"}`);
    res.json({ ok: true, suppressed: r.suppressed.length, ...(r.duplicate ? { duplicate: true } : {}), ...(r.ignored ? { ignored: true } : {}) });
  });

  const appRouter = express.Router();
  // ⛔ Signed out, idempotent; GET shows a page, POST is RFC 8058's one-click (List-Unsubscribe-Post).
  const unsub = (req) => { const id = verifyUnsubscribeToken(req.params.token, { env }); return id && unsubscribe(db, id) ? id : null; };
  appRouter.get("/u/:token", (req, res) => {
    const ok = unsub(req);
    res.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }).type("html")
      .status(ok ? 200 : 400).send(ok
        ? page("You're unsubscribed", "<p>draft will send you no more product news. Account emails — a password reset, a policy notice — still arrive, because they are about your account, not marketing.</p>")
        : page("This link is not valid", "<p>It may have been changed in transit. You can switch product news off in Settings → Account.</p>"));
  });
  appRouter.post("/u/:token", express.urlencoded({ extended: false, limit: "4kb" }), (req, res) => (unsub(req) ? res.status(200).end() : res.status(400).end()));

  appRouter.get("/api/account/marketing", requireAuth, (req, res) => res.json(marketingState(db, req.user.id)));
  appRouter.put("/api/account/marketing", requireAuth, express.json(), (req, res) => {
    if (typeof req.body?.optIn !== "boolean") return res.status(400).json({ error: "optIn must be true or false" });
    setMarketingConsent(db, req.user.id, req.body.optIn, "settings");
    res.json(marketingState(db, req.user.id));
  });

  // ── Admin → Send a notice.
  const adminEmail = (userId) => { try { return db.prepare("SELECT email FROM user_profile WHERE user_id = ?").pluck().get(userId) || null; } catch { return null; } };
  appRouter.get("/api/admin/notices", requireAdmin, (_req, res) => res.json({
    audiences: AUDIENCES, defaultCeiling: NOTICE_DEFAULT_CEILING, configured: !!env.RESEND_API_KEY,
    log: db.prepare("SELECT n.*, u.username FROM notice_log n LEFT JOIN users u ON u.id = n.admin_user_id ORDER BY n.id DESC LIMIT 30").all(),
  }));
  appRouter.post("/api/admin/notices/dry-run", requireAdmin, express.json(), (req, res) => {
    try { res.json(noticeDryRun(db, { audience: req.body?.audience })); } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
  });
  appRouter.post("/api/admin/notices/send", requireAdmin, express.json(), async (req, res) => {
    const b = req.body || {};
    try {
      const testTo = b.test === true ? adminEmail(req.user.id) : null;
      if (b.test === true && !testTo) return res.status(400).json({ error: "Your admin account has no email address to test with." });
      res.json(await sendNotice(db, { audience: b.audience, subject: b.subject, body: b.body, why: b.why, testTo,
        ceiling: b.ceiling ?? null, adminUserId: req.user.id, env }));
    } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
  });

  // ── ⭐ D94 · Admin → System → Email health: the numbers, the suppression list (Remove with a reason, Undo), and
  // a test send to Resend's own safe addresses — it proves the whole loop (Resend → the signed hook → the list).
  appRouter.get("/api/admin/email-health", requireAdmin, (_req, res) => res.json(emailHealthSummary(db, { env })));
  appRouter.get("/api/admin/email-health/suppressions", requireAdmin, (req, res) =>
    res.json({ rows: listSuppressions(db, { q: String(req.query.q || "") }) }));
  appRouter.post("/api/admin/email-health/suppressions/remove", requireAdmin, express.json(), (req, res) => {
    try { res.json(removeSuppression(db, { email: req.body?.email, reason: req.body?.reason, adminUserId: req.user?.id })); }
    catch (e) { res.status(e.status || 500).json({ error: e.message }); }
  });
  appRouter.post("/api/admin/email-health/suppressions/undo", requireAdmin, express.json(), (req, res) => {
    try { res.json(undoSuppressionRemoval(db, { auditId: Number(req.body?.auditId) })); }
    catch (e) { res.status(e.status || 500).json({ error: e.message }); }
  });
  appRouter.post("/api/admin/email-health/test", requireAdmin, express.json(), async (req, res) => {
    const kind = req.body?.kind === "complaint" ? "complaint" : "bounce";
    const to = TEST_ADDRESSES[kind];
    if (!env.RESEND_API_KEY) return res.status(400).json({ error: "Sending is not configured (no RESEND_API_KEY), so there is nothing to test." });
    try {
      // No `db`: the test address may already be on the list from an earlier test, and the point is to send it.
      const r = await sendImpl({ to, subject: `draft email-health test (${kind})`, text: `A test from Admin → Email health. Resend answers it with a ${kind}.`, env });
      res.json({ ok: !!r.ok, to, kind, said: r.ok
        ? `Sent to ${to}. Resend will answer with a ${kind}; if the webhook is subscribed, ${to} appears on the suppression list below within a minute.`
        : `Not sent (${r.reason}).` });
    } catch (e) { res.status(502).json({ error: `Resend refused the send: ${e.message}` }); }
  });

  return { hooksRouter, appRouter };
}
