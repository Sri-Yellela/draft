// ⭐ A167 (owner 11-10) · PHASE 1 MONETISATION — the one place its switches, keys, tiers and prices are read.
//
// EVERYTHING HERE IS OFF UNTIL THE OWNER'S GO. Two switches, each parsed once, each "anything not affirmative is off":
//   BILLING_ENABLED                 the apply gate (only SEMI / FULL AUTO — Apply through draft — needs a plan or the trial),
//                                   Checkout, the customer portal and the webhook's writes. Off: nothing is gated, no plan
//                                   is shown, the webhook answers 404.
//   SIGNUP_VERIFICATION_REQUIRED    sign-up needs BOTH the email and the phone proven by a one-time code, and one phone is
//                                   one account. Off: sign-up is today's.
//
// ⛔ The owner's own steps before either can run live (logged in WORKLOG A167; not restated): the Stripe account and its
// keys — TEST first (sk_test_…), then live —, an SMS provider account and its keys (Twilio Verify), the real prices, and
// counsel's terms / refund / privacy wording. Until then the tiers carry ARBITRARY TEST PRICES (owner: "set an arbitrary
// number for testing") and every surface that shows a price says it is a test price.
//
// ⛔ This is NOT the older MONETISATION_ENABLED lever (shared/monetisation.js — the entitlement gates on modes and the A+
// résumé). That lever stays OFF and untouched: phase 1 opens the whole site and gates ONE thing.

const truthy = (v) => ["1", "true", "yes", "on"].includes(String(v ?? "").trim().toLowerCase());
const int = (v, d) => { const n = Number.parseInt(String(v ?? ""), 10); return Number.isFinite(n) && n >= 0 ? n : d; };

export const TRIAL_DRAFTS_DEFAULT = 10;

/**
 * The paid tiers. `testPriceCents` is the ARBITRARY number shown and charged in test mode; the real Stripe Price is named
 * by its env var (a price_… id from the owner's Stripe dashboard) — never a number in this file.
 */
export const BILLING_TIERS = Object.freeze([
  Object.freeze({ id: "starter", name: "Starter", testPriceCents: 900,  interval: "month", priceEnv: "STRIPE_PRICE_STARTER",
    blurb: "Apply through draft: Ask me first and Apply for me, at your run times." }),
  Object.freeze({ id: "pro",     name: "Pro",     testPriceCents: 1900, interval: "month", priceEnv: "STRIPE_PRICE_PRO",
    blurb: "Everything in Starter, with more applications a day." }),
]);

export function tierById(id) {
  return BILLING_TIERS.find(t => t.id === String(id || "").toLowerCase()) || null;
}

/** Which tier a Stripe price id belongs to (from the configured env vars), or null. */
export function tierForPrice(priceId, env = process.env) {
  if (!priceId) return null;
  return BILLING_TIERS.find(t => env[t.priceEnv] && env[t.priceEnv] === priceId) || null;
}

/** The whole configuration, read from an env bag. Pure — tests pass their own. */
export function billingConfig(env = process.env) {
  const secretKey = String(env.STRIPE_SECRET_KEY || "").trim();
  const mode = secretKey.startsWith("sk_live_") || secretKey.startsWith("rk_live_") ? "live"
    : secretKey.startsWith("sk_test_") || secretKey.startsWith("rk_test_") ? "test" : null;
  const enabled = truthy(env.BILLING_ENABLED);
  return {
    enabled,
    // ⛔ A live key is refused unless the owner says live in so many words — a test deploy can never charge a card.
    stripeMode: mode,
    liveAllowed: truthy(env.BILLING_LIVE_CONFIRMED),
    stripeReady: !!secretKey && (mode === "test" || (mode === "live" && truthy(env.BILLING_LIVE_CONFIRMED))),
    secretKey,
    webhookSecret: String(env.STRIPE_WEBHOOK_SECRET || "").trim(),
    publishableKey: String(env.STRIPE_PUBLISHABLE_KEY || "").trim(),
    trialDrafts: int(env.TRIAL_DRAFTS, TRIAL_DRAFTS_DEFAULT),
    tiers: BILLING_TIERS.map(t => ({ ...t, priceId: String(env[t.priceEnv] || "").trim() || null })),
    // The prices shown are the test ones until real prices exist AND the key is live.
    testPrices: mode !== "live",
  };
}

export function verificationConfig(env = process.env) {
  const twilio = {
    accountSid: String(env.TWILIO_ACCOUNT_SID || "").trim(),
    authToken: String(env.TWILIO_AUTH_TOKEN || "").trim(),
    serviceSid: String(env.TWILIO_VERIFY_SERVICE_SID || "").trim(),
  };
  const production = String(env.NODE_ENV || "").toLowerCase() === "production";
  return {
    required: truthy(env.SIGNUP_VERIFICATION_REQUIRED),
    smsProvider: twilio.accountSid && twilio.authToken && twilio.serviceSid ? "twilio_verify"
      // A local code (hashed here, "sent" to the server log) — a development stand-in, NEVER in production.
      : production ? null : "dev_log",
    twilio,
    production,
    codeTtlSec: int(env.VERIFY_CODE_TTL_SEC, 600),
    maxAttempts: int(env.VERIFY_MAX_ATTEMPTS, 5),
    // Rate limits: per target, per IP.
    perTargetPer10Min: int(env.VERIFY_PER_TARGET_10MIN, 3),
    perIpPerHour: int(env.VERIFY_PER_IP_HOUR, 10),
    defaultCountry: String(env.PHONE_DEFAULT_COUNTRY || "US").toUpperCase(),
  };
}

/** Where the extension lives (A167 (h)) — the store listing and / or the direct download. Null when not configured. */
export function extensionLinks(env = process.env) {
  const store = String(env.EXTENSION_STORE_URL || "").trim();
  const download = String(env.EXTENSION_DOWNLOAD_URL || "").trim();
  const ok = (u) => /^https:\/\//i.test(u);
  return { storeUrl: ok(store) ? store : null, downloadUrl: ok(download) ? download : null };
}
