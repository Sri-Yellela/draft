// ⭐ A167 (a) · STRIPE, over its REST API with fetch — no SDK dependency, four calls and one signature check.
//
//   createCustomer         POST /v1/customers
//   createCheckoutSession  POST /v1/checkout/sessions      (mode=subscription — Stripe Checkout + Billing)
//   createPortalSession    POST /v1/billing_portal/sessions (the customer portal: card, plan, cancel, invoices)
//   retrieveSubscription   GET  /v1/subscriptions/:id
//   verifyWebhook          the Stripe-Signature header over the RAW body (HMAC-SHA256 of "<t>.<body>", v1 schemes,
//                          a 5-minute tolerance, compared in constant time)
//
// ⛔ Every write carries an Idempotency-Key, so a retried request (a double press, a network retry) never makes two
// customers or two sessions. The key is derived from what the request IS (the user, the tier, a 10-minute window), not
// random — a retry of the same intent gets the same key.
import crypto from "node:crypto";

const API = "https://api.stripe.com/v1";

/** Stripe's form encoding, nested: { line_items: [{ price: "p", quantity: 1 }] } → line_items[0][price]=p&… */
export function formEncode(obj, prefix = "", out = []) {
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === "object" ? formEncode(item, `${key}[${i}]`, out) : out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`)));
    else if (typeof v === "object") formEncode(v, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out.join("&");
}

export class StripeError extends Error {
  constructor(message, { status = 0, code = null, type = null } = {}) { super(message); this.status = status; this.code = code; this.type = type; }
}

/**
 * @param {{ secretKey: string, fetchImpl?: typeof fetch, apiBase?: string }} opts
 */
export function stripeClient({ secretKey, fetchImpl = globalThis.fetch, apiBase = API } = {}) {
  if (!secretKey) throw new StripeError("Stripe is not configured", { code: "stripe_not_configured" });
  const call = async (method, path, body = null, idempotencyKey = null) => {
    const headers = { Authorization: `Bearer ${secretKey}`, "Stripe-Version": "2024-06-20" };
    if (body) headers["Content-Type"] = "application/x-www-form-urlencoded";
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
    const res = await fetchImpl(`${apiBase}${path}`, { method, headers, body: body ? formEncode(body) : undefined });
    let json = null;
    try { json = await res.json(); } catch { json = null; }
    if (!res.ok) {
      const e = json?.error || {};
      throw new StripeError(e.message || `Stripe ${res.status}`, { status: res.status, code: e.code || null, type: e.type || null });
    }
    return json;
  };
  return {
    createCustomer: ({ email = null, userId }, key) =>
      call("POST", "/customers", { email: email || undefined, metadata: { user_id: String(userId) } }, key),
    createCheckoutSession: ({ customer, priceId, userId, tier, successUrl, cancelUrl }, key) =>
      call("POST", "/checkout/sessions", {
        mode: "subscription", customer, client_reference_id: String(userId),
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl, cancel_url: cancelUrl,
        metadata: { user_id: String(userId), tier },
        subscription_data: { metadata: { user_id: String(userId), tier } },
      }, key),
    createPortalSession: ({ customer, returnUrl }, key) =>
      call("POST", "/billing_portal/sessions", { customer, return_url: returnUrl }, key),
    retrieveSubscription: (id) => call("GET", `/subscriptions/${encodeURIComponent(id)}`),
  };
}

/** A stable idempotency key for one intent: the same user, action and inputs in the same 10-minute window → the same key. */
export function idempotencyKey(parts, nowSec = Math.floor(Date.now() / 1000)) {
  const window = Math.floor(nowSec / 600);
  return crypto.createHash("sha256").update(JSON.stringify([...parts, window])).digest("hex").slice(0, 48);
}

/**
 * Verify a Stripe webhook. Returns the parsed event, or throws StripeError("bad_signature" | "stale_signature" | …).
 * @param {Buffer|string} rawBody the body EXACTLY as received
 * @param {string} header the Stripe-Signature header ("t=…,v1=…,v1=…")
 */
export function verifyWebhook(rawBody, header, secret, { toleranceSec = 300, nowSec = Math.floor(Date.now() / 1000) } = {}) {
  if (!secret) throw new StripeError("No webhook secret configured", { code: "webhook_not_configured" });
  const body = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody ?? "");
  const parts = String(header || "").split(",").map(s => s.trim().split("="));
  const t = Number(parts.find(([k]) => k === "t")?.[1]);
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v).filter(Boolean);
  if (!Number.isFinite(t) || !sigs.length) throw new StripeError("Missing signature", { code: "bad_signature" });
  if (Math.abs(nowSec - t) > toleranceSec) throw new StripeError("Signature too old", { code: "stale_signature" });
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  const ok = sigs.some(s => s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
  if (!ok) throw new StripeError("Signature does not match", { code: "bad_signature" });
  try { return JSON.parse(body); } catch { throw new StripeError("Body is not JSON", { code: "bad_body" }); }
}

/** For tests and the local harness: sign a body the way Stripe does. */
export function signWebhook(body, secret, t = Math.floor(Date.now() / 1000)) {
  return `t=${t},v1=${crypto.createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
}
