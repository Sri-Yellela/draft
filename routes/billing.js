// ⭐ A167 (owner 11-10) · PHASE 1 MONETISATION — the routes. Every one is behind its switch (services/billing/config.js):
//
//   hooksRouter (mounted BEFORE the JSON parser — Stripe signs the RAW body)
//     POST /api/billing/webhook          verified (Stripe-Signature), idempotent (billing_events). 404 while billing is off.
//   apiRouter
//     GET  /api/billing/status           the person's plan, trial (10 drafts) and the tiers at their (test) prices
//     POST /api/billing/checkout         { tier } → a Stripe Checkout URL (subscription mode)
//     POST /api/billing/portal           → a Stripe customer-portal URL (card, plan, cancel, invoices)
//     POST /api/verify/start             { channel: email | sms, target }   (signed-out allowed — it is the sign-up's)
//     POST /api/verify/check             { channel, target, code } → { proof }
//     GET  /api/verify/status            the signed-in person's email / phone verified
//     POST /api/account/phone            { proof } → the proven phone on the account (one account per phone)
//     GET  /api/account/lead-sharing     · PUT { consent: true|false } — the explicit, OFF-by-default consent (f)
//     GET  /api/admin/signup-refusals    the refused sign-ups / phone changes, masked
import express from "express";
import { billingConfig, tierById, verificationConfig, extensionLinks } from "../services/billing/config.js";
import { stripeClient, verifyWebhook, idempotencyKey, StripeError } from "../services/billing/stripe.js";
import { billingStatus, customerIdFor, saveCustomer, handleStripeEvent } from "../services/billing/subscriptions.js";
import { startVerification, checkVerification, readProof, setVerifiedPhone, accountVerified, twilioVerify, VerifyError } from "../services/billing/verification.js";
import { sendVerificationCodeEmail } from "../services/emailService.js";

const sendError = (res, e) => {
  if (e instanceof VerifyError) return res.status(e.status).json({ error: e.code, message: e.message, ...(e.retryAfterSec ? { retryAfterSec: e.retryAfterSec } : {}) });
  // Draft's own "not configured" is a 503; Stripe's 4xx is the request's fault (400); anything else from Stripe is a 502.
  if (e instanceof StripeError) return res.status(e.status === 503 ? 503 : e.status >= 400 && e.status < 500 ? 400 : 502).json({ error: e.code || "stripe_error", message: e.message });
  console.error(`[billing] ${e.message}`);
  return res.status(500).json({ error: "billing_error" });
};

export function createBillingRouters({ db, requireAuth, requireAdmin, pepper, appOrigin = "", env = process.env, fetchImpl = globalThis.fetch, emailSender = null }) {
  const smsFor = () => {
    const v = verificationConfig(env);
    return v.smsProvider === "twilio_verify" ? twilioVerify(v.twilio, fetchImpl) : null;
  };
  const stripe = () => {
    const cfg = billingConfig(env);
    if (!cfg.stripeReady) throw new StripeError(cfg.stripeMode === "live" ? "A live Stripe key needs BILLING_LIVE_CONFIRMED" : "Stripe is not configured", { status: 503, code: "stripe_not_configured" });
    return stripeClient({ secretKey: cfg.secretKey, fetchImpl });
  };
  const origin = (req) => appOrigin || `${req.protocol}://${req.get("host")}`;

  // ── the webhook ─────────────────────────────────────────────────────────────────────────────────────────────────────
  const hooksRouter = express.Router();
  hooksRouter.post("/api/billing/webhook", express.raw({ type: "*/*", limit: "256kb" }), (req, res) => {
    const cfg = billingConfig(env);
    if (!cfg.enabled) return res.status(404).end();
    let event;
    try { event = verifyWebhook(req.body, req.get("stripe-signature"), cfg.webhookSecret); }
    catch (e) { console.warn(`[billing] webhook refused: ${e.code || e.message}`); return res.status(400).json({ error: e.code || "bad_signature" }); }
    // ⛔ A test-mode event never changes a live deploy's ledger, and the reverse.
    if (!!event.livemode !== (cfg.stripeMode === "live")) return res.status(200).json({ ignored: "mode_mismatch" });
    try {
      const r = handleStripeEvent(db, event, env);
      if (r.handled && !r.duplicate) console.log(`[billing] ${event.type} ${event.id} user=${r.userId ?? "?"}`);
      res.json({ received: true, ...(r.duplicate ? { duplicate: true } : {}) });
    } catch (e) {
      console.error(`[billing] webhook ${event.type} ${event.id} failed: ${e.message}`);
      res.status(500).json({ error: "not_processed" });   // Stripe retries; the event id is not marked processed
    }
  });

  // ── the person's plan ───────────────────────────────────────────────────────────────────────────────────────────────
  const apiRouter = express.Router();
  apiRouter.get("/api/billing/status", requireAuth, (req, res) => {
    try { res.json({ ...billingStatus(db, req.user.id, env), extension: extensionLinks(env) }); } catch (e) { sendError(res, e); }
  });

  apiRouter.post("/api/billing/checkout", requireAuth, async (req, res) => {
    const cfg = billingConfig(env);
    if (!cfg.enabled) return res.status(404).json({ error: "billing_off" });
    const tier = tierById(req.body?.tier);
    const priceId = tier && cfg.tiers.find(t => t.id === tier.id)?.priceId;
    if (!tier) return res.status(400).json({ error: "bad_tier", message: "Choose a plan." });
    if (!priceId) return res.status(503).json({ error: "price_not_configured", message: "That plan isn't on sale yet." });
    try {
      const s = stripe();
      let customer = customerIdFor(db, req.user.id);
      if (!customer) {
        const email = db.prepare("SELECT email FROM user_profile WHERE user_id = ?").pluck().get(req.user.id) || null;
        const c = await s.createCustomer({ email, userId: req.user.id }, idempotencyKey(["customer", req.user.id]));
        customer = c.id;
        saveCustomer(db, req.user.id, customer, !!c.livemode);
      }
      const base = origin(req);
      const session = await s.createCheckoutSession({
        customer, priceId, userId: req.user.id, tier: tier.id,
        successUrl: `${base}/app/settings?plan=done`, cancelUrl: `${base}/app/settings?plan=cancelled`,
      }, idempotencyKey(["checkout", req.user.id, tier.id]));
      res.json({ url: session.url });
    } catch (e) { sendError(res, e); }
  });

  apiRouter.post("/api/billing/portal", requireAuth, async (req, res) => {
    if (!billingConfig(env).enabled) return res.status(404).json({ error: "billing_off" });
    const customer = customerIdFor(db, req.user.id);
    if (!customer) return res.status(409).json({ error: "no_customer", message: "There's no plan to manage yet." });
    try {
      const p = await stripe().createPortalSession({ customer, returnUrl: `${origin(req)}/app/settings` }, idempotencyKey(["portal", req.user.id]));
      res.json({ url: p.url });
    } catch (e) { sendError(res, e); }
  });

  // ── (d) the one-time codes ──────────────────────────────────────────────────────────────────────────────────────────
  const sendEmailCode = emailSender || ((to, code) => sendVerificationCodeEmail({ to, code, purpose: "confirm this email address for draft" }, { db, env }));
  // Codes are sent only while phase 1 is on (sign-up verification or billing) — never an SMS bill for a switched-off feature.
  const verifyOn = () => verificationConfig(env).required || billingConfig(env).enabled;
  apiRouter.post("/api/verify/start", async (req, res) => {
    if (!verifyOn()) return res.status(404).json({ error: "verification_off" });
    try {
      res.json(await startVerification(db, { channel: req.body?.channel, target: req.body?.target },
        { pepper, sendEmailCode, sms: req.body?.channel === "sms" ? smsFor() : null, ip: req.ip, env }));
    } catch (e) { sendError(res, e); }
  });
  apiRouter.post("/api/verify/check", async (req, res) => {
    if (!verifyOn()) return res.status(404).json({ error: "verification_off" });
    try {
      const r = await checkVerification(db, { channel: req.body?.channel, target: req.body?.target, code: req.body?.code },
        { pepper, sms: req.body?.channel === "sms" ? smsFor() : null, env });
      res.json({ verified: true, channel: r.channel, proof: r.proof });
    } catch (e) { sendError(res, e); }
  });
  apiRouter.get("/api/verify/status", requireAuth, (req, res) => {
    res.json({ ...accountVerified(db, req.user.id), required: verificationConfig(env).required, smsReady: !!verificationConfig(env).smsProvider });
  });
  // (e) a phone change: proven by a code, refused when the number is on another account.
  apiRouter.post("/api/account/phone", requireAuth, (req, res) => {
    const phone = readProof(pepper, req.body?.proof, "sms");
    if (!phone) return res.status(400).json({ error: "bad_proof", message: "Confirm the code sent to that phone first." });
    try { setVerifiedPhone(db, req.user.id, phone, { stage: "change" }); res.json({ ok: true }); } catch (e) { sendError(res, e); }
  });

  // ── (f) the consent to share leads — explicit, separate, OFF by default ─────────────────────────────────────────────
  apiRouter.get("/api/account/lead-sharing", requireAuth, (req, res) => {
    const r = db.prepare("SELECT lead_share_consent, lead_share_consent_at FROM users WHERE id = ?").get(req.user.id) || {};
    res.json({ consent: r.lead_share_consent === 1, since: r.lead_share_consent_at ?? null });
  });
  apiRouter.put("/api/account/lead-sharing", requireAuth, (req, res) => {
    if (typeof req.body?.consent !== "boolean") return res.status(400).json({ error: "bad_consent", message: "Say yes or no." });
    const on = req.body.consent === true;
    db.prepare("UPDATE users SET lead_share_consent = ?, lead_share_consent_at = ? WHERE id = ?").run(on ? 1 : 0, on ? Math.floor(Date.now() / 1000) : null, req.user.id);
    res.json({ consent: on });
  });

  // ── (e) the admin sees a refusal ────────────────────────────────────────────────────────────────────────────────────
  apiRouter.get("/api/admin/signup-refusals", requireAdmin, (req, res) => {
    const rows = db.prepare("SELECT id, reason, stage, phone_hint, email_hint, user_id, created_at FROM signup_refusals ORDER BY id DESC LIMIT 200").all();
    res.json({ refusals: rows.map(r => ({ id: r.id, reason: r.reason, stage: r.stage, phone: r.phone_hint, email: r.email_hint, userId: r.user_id, at: r.created_at })) });
  });

  return { hooksRouter, apiRouter };
}
