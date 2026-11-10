// ⭐ A167 (owner 11-10) · PHASE 1 MONETISATION — the infrastructure, every piece behind its switch, OFF by default.
// Synthetic people; Stripe and the SMS provider are fakes (no network). The owner's own steps (keys, prices, counsel's
// wording) are not needed for any of this.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { billingConfig, verificationConfig, extensionLinks, tierForPrice } from "../services/billing/config.js";
import { formEncode, verifyWebhook, signWebhook, idempotencyKey, stripeClient } from "../services/billing/stripe.js";
import { applyAllowed, spendTrialDrafts, handleStripeEvent, billingStatus, activeSubscription, saveCustomer } from "../services/billing/subscriptions.js";
import { normalisePhone, startVerification, checkVerification, signProof, readProof, identityRefusal, setVerifiedPhone, maskPhone, maskEmail } from "../services/billing/verification.js";
import { createBillingRouters } from "../routes/billing.js";
import { MERGE_PLAN } from "../services/accountService.js";
import { planWords } from "../client/src/lib/planWords.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const PEPPER = "a167:test";
const ON = { BILLING_ENABLED: "1", STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: "whsec_test", STRIPE_PRICE_STARTER: "price_s", STRIPE_PRICE_PRO: "price_p" };
function freshDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'dana','x','BASIC'), (2,'eli','x','BASIC')").run();
  db.prepare("INSERT INTO user_profile (user_id, email) VALUES (1, 'dana@example.test'), (2, 'eli@example.test')").run();
  return db;
}
const jobs = (n, from = 0) => Array.from({ length: n }, (_, i) => `job${from + i}`);

test("a167SwitchesOffByDefault: nothing gated, no live charge without the owner's word, test prices shown", () => {
  const off = billingConfig({});
  assert.equal(off.enabled, false);
  assert.equal(verificationConfig({}).required, false);
  assert.equal(billingConfig({ STRIPE_SECRET_KEY: "sk_live_x" }).stripeReady, false, "a live key needs BILLING_LIVE_CONFIRMED");
  assert.equal(billingConfig({ STRIPE_SECRET_KEY: "sk_live_x", BILLING_LIVE_CONFIRMED: "yes" }).stripeReady, true);
  assert.equal(billingConfig({ STRIPE_SECRET_KEY: "sk_test_x" }).testPrices, true);
  assert.equal(off.trialDrafts, 10);
  assert.equal(tierForPrice("price_p", ON).id, "pro");
  assert.deepEqual(extensionLinks({ EXTENSION_STORE_URL: "http://insecure", EXTENSION_DOWNLOAD_URL: "https://x.test/ext.zip" }), { storeUrl: null, downloadUrl: "https://x.test/ext.zip" });
  assert.equal(verificationConfig({ NODE_ENV: "production" }).smsProvider, null, "no dev stand-in in production");
  const db = freshDb();
  assert.deepEqual(applyAllowed(db, 1, jobs(50), {}), { ok: true, via: "off" });
});

test("a167TrialOfTenDrafts: one per job, a re-draft is free, the 11th needs a plan; a plan opens it", () => {
  const db = freshDb();
  const a = applyAllowed(db, 1, jobs(6), ON);
  assert.equal(a.ok, true); assert.equal(a.via, "trial"); assert.equal(a.trialLeft, 4);
  spendTrialDrafts(db, 1, a.spend);
  assert.equal(applyAllowed(db, 1, ["job0", "job1"], ON).trialLeft, 4, "the same postings again use nothing");
  const b = applyAllowed(db, 1, jobs(5, 6), ON);
  assert.equal(b.ok, false); assert.equal(b.code, "plan_required"); assert.equal(b.trialLeft, 4);
  spendTrialDrafts(db, 1, jobs(4, 6));
  const c = applyAllowed(db, 1, ["new"], ON);
  assert.equal(c.ok, false); assert.match(c.message, /everything else on the site stays open/);
  db.prepare("INSERT INTO billing_subscriptions (stripe_subscription_id, user_id, tier, status) VALUES ('sub_1', 1, 'starter', 'active')").run();
  assert.deepEqual(applyAllowed(db, 1, ["new"], ON), { ok: true, via: "plan", tier: "starter" });
  assert.equal(applyAllowed(db, 2, jobs(10), ON).ok, true, "another person's trial is their own");
});

test("a167StripeWebhookVerifiedIdempotent: signature, staleness, replays, the subscription's life", () => {
  const body = JSON.stringify({ id: "evt_1", type: "x" });
  assert.equal(verifyWebhook(body, signWebhook(body, "whsec_test"), "whsec_test").id, "evt_1");
  assert.throws(() => verifyWebhook(body, signWebhook(body, "wrong"), "whsec_test"), /does not match/);
  assert.throws(() => verifyWebhook(body, signWebhook(body, "whsec_test", 1000), "whsec_test"), /too old/);
  assert.throws(() => verifyWebhook(body + " ", signWebhook(body, "whsec_test"), "whsec_test"), /does not match/, "the RAW body is what is signed");

  const db = freshDb();
  handleStripeEvent(db, { id: "evt_c", type: "checkout.session.completed", data: { object: { client_reference_id: "1", customer: "cus_1" } } }, ON);
  const sub = (status, extra = {}) => ({ id: "sub_9", customer: "cus_1", status, current_period_end: 2_000_000_000, items: { data: [{ price: { id: "price_p" } }] }, ...extra });
  handleStripeEvent(db, { id: "evt_s1", type: "customer.subscription.created", data: { object: sub("active") } }, ON);
  assert.equal(activeSubscription(db, 1).tier, "pro");
  assert.deepEqual(handleStripeEvent(db, { id: "evt_s1", type: "customer.subscription.created", data: { object: sub("active") } }, ON), { handled: true, duplicate: true });
  handleStripeEvent(db, { id: "evt_s2", type: "customer.subscription.updated", data: { object: sub("past_due") } }, ON);
  assert.equal(activeSubscription(db, 1).status, "past_due", "access kept while Stripe retries the card");
  handleStripeEvent(db, { id: "evt_s3", type: "customer.subscription.deleted", data: { object: sub("active") } }, ON);
  assert.equal(activeSubscription(db, 1), null);
  assert.equal(handleStripeEvent(db, { id: "evt_u", type: "charge.refunded", data: { object: {} } }, ON).ignored, "charge.refunded");
  assert.throws(() => handleStripeEvent(db, { id: "evt_bad", type: "customer.subscription.created", data: { object: { ...sub("active"), customer: "cus_unknown" } } }, ON));
  assert.match(db.prepare("SELECT error FROM billing_events WHERE stripe_event_id = 'evt_bad'").pluck().get(), /no user/, "a failure is recorded and NOT marked processed (Stripe retries)");
  assert.equal(billingStatus(db, 1, ON).trial.left, 10);
});

test("a167StripeClient: form encoding, an idempotency key on every write, errors surfaced", async () => {
  assert.equal(formEncode({ line_items: [{ price: "p", quantity: 1 }], metadata: { user_id: "1" } }),
    "line_items%5B0%5D%5Bprice%5D=p&line_items%5B0%5D%5Bquantity%5D=1&metadata%5Buser_id%5D=1");
  assert.equal(idempotencyKey(["checkout", 1, "pro"], 6000), idempotencyKey(["checkout", 1, "pro"], 6300), "the same intent in one window");
  assert.notEqual(idempotencyKey(["checkout", 1, "pro"], 6000), idempotencyKey(["checkout", 1, "starter"], 6000));
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return { ok: true, json: async () => ({ id: "cs_1", url: "https://checkout.stripe.test/cs_1" }) }; };
  const s = stripeClient({ secretKey: "sk_test_x", fetchImpl });
  await s.createCheckoutSession({ customer: "cus_1", priceId: "price_s", userId: 1, tier: "starter", successUrl: "https://a/ok", cancelUrl: "https://a/no" }, "key-1");
  assert.equal(calls[0].url, "https://api.stripe.com/v1/checkout/sessions");
  assert.equal(calls[0].init.headers["Idempotency-Key"], "key-1");
  assert.match(calls[0].init.body, /mode=subscription/);
  const bad = stripeClient({ secretKey: "sk_test_x", fetchImpl: async () => ({ ok: false, status: 402, json: async () => ({ error: { message: "card declined", code: "card_declined" } }) }) });
  await assert.rejects(() => bad.createPortalSession({ customer: "c", returnUrl: "https://a" }), /card declined/);
});

test("a167PhoneAndEmailOtp: hashed codes, expiry, wrong tries lock, rate limits, proofs", async () => {
  assert.equal(normalisePhone("(617) 555-0142"), "+16175550142");
  assert.equal(normalisePhone("+44 20 7946 0958"), "+442079460958");
  assert.equal(normalisePhone("555-0142"), null);
  assert.equal(maskPhone("+16175550142"), "+1 ••• ••• ••42");
  assert.equal(maskEmail("dana@example.test"), "d•••@example.test");
  const db = freshDb();
  let smsCode = null;
  const log = { info: (l) => { smsCode = /: (\d{6})$/.exec(l)?.[1] ?? smsCode; } };
  let mailed = null;
  const deps = { pepper: PEPPER, env: {}, log, sendEmailCode: async (to, code) => { mailed = { to, code }; }, ip: "203.0.113.9" };
  await startVerification(db, { channel: "sms", target: "617-555-0142" }, deps);
  const stored = db.prepare("SELECT * FROM verify_codes").get();
  assert.ok(stored.code_hash && !stored.code_hash.includes(smsCode) && !stored.target_hash.includes("6175550142"), "neither the code nor the number in the clear");
  await assert.rejects(() => checkVerification(db, { channel: "sms", target: "617-555-0142", code: "000000" === smsCode ? "111111" : "000000" }, deps), /not right/);
  const ok = await checkVerification(db, { channel: "sms", target: "+1 617 555 0142", code: smsCode }, deps);
  assert.equal(readProof(PEPPER, ok.proof, "sms"), "+16175550142");
  assert.equal(readProof(PEPPER, ok.proof, "email"), null, "a phone proof is not an email proof");
  assert.equal(readProof("other-pepper", ok.proof, "sms"), null);
  assert.equal(readProof(PEPPER, signProof(PEPPER, { channel: "sms", target: "+1" }, 1000, 10), "sms"), null, "expired");
  // wrong tries lock
  await startVerification(db, { channel: "email", target: "New@Example.test" }, deps);
  assert.equal(mailed.to, "new@example.test");
  for (let i = 0; i < 5; i++) await assert.rejects(() => checkVerification(db, { channel: "email", target: "new@example.test", code: "999999" === mailed.code ? "888888" : "999999" }, deps));
  await assert.rejects(() => checkVerification(db, { channel: "email", target: "new@example.test", code: mailed.code }, deps), /Too many wrong codes/);
  // rate limit: 3 per target per 10 minutes
  await startVerification(db, { channel: "email", target: "new@example.test" }, deps);
  await startVerification(db, { channel: "email", target: "new@example.test" }, deps);
  await assert.rejects(() => startVerification(db, { channel: "email", target: "new@example.test" }, deps), (e) => e.code === "too_many_codes");
  await assert.rejects(() => startVerification(db, { channel: "sms", target: "6175550199" }, { ...deps, env: { NODE_ENV: "production" } }), (e) => e.code === "sms_not_configured");
  // Twilio Verify keeps the code itself
  const tw = { started: [], start: async (to) => { tw.started.push(to); }, check: async (_to, c) => c === "424242" };
  const db2 = freshDb();
  await startVerification(db2, { channel: "sms", target: "6175550100" }, { ...deps, sms: tw });
  assert.equal(db2.prepare("SELECT code_hash FROM verify_codes").pluck().get(), null);
  assert.equal((await checkVerification(db2, { channel: "sms", target: "6175550100", code: "424242" }, { ...deps, sms: tw })).verified, true);
});

test("a167OneAccountPerPhone: refused at sign-up and at a change, the refusal recorded masked for the admin", () => {
  const db = freshDb();
  setVerifiedPhone(db, 1, "+16175550142", { stage: "signup" });
  assert.equal(identityRefusal(db, { phone: "+16175550142" }).code, "phone_taken");
  assert.equal(identityRefusal(db, { phone: "+16175550142", userId: 1 }), null, "your own number is yours");
  assert.equal(identityRefusal(db, { email: "DANA@example.test" }).code, "email_taken");
  assert.throws(() => setVerifiedPhone(db, 2, "+16175550142"), (e) => e.code === "phone_taken");
  const r = db.prepare("SELECT * FROM signup_refusals").get();
  assert.equal(r.reason, "phone_taken"); assert.equal(r.phone_hint, "+1 ••• ••• ••42"); assert.equal(r.user_id, 2);
  assert.throws(() => db.prepare("UPDATE users SET phone_e164 = '+16175550142' WHERE id = 2").run(), /UNIQUE/, "the index is the last word on a race");
});

test("a167Routes: the webhook (raw body, 404 while off), checkout without keys, lead sharing, the admin's refusals", async () => {
  const db = freshDb();
  const mount = (env) => {
    const app = express();
    const r = createBillingRouters({ db, requireAuth: (req, _res, next) => { req.user = { id: 1 }; next(); }, requireAdmin: (_q, _s, n) => n(), pepper: PEPPER, env });
    app.use(r.hooksRouter); app.use(express.json()); app.use(r.apiRouter);
    const server = app.listen(0);
    const base = `http://127.0.0.1:${server.address().port}`;
    return { server, call: (p, init = {}) => fetch(base + p, { headers: { "content-type": "application/json" }, ...init }).then(async x => ({ status: x.status, body: await x.json().catch(() => null) })) };
  };
  const off = mount({});
  try {
    assert.equal((await off.call("/api/billing/webhook", { method: "POST", body: "{}" })).status, 404);
    assert.equal((await off.call("/api/billing/checkout", { method: "POST", body: JSON.stringify({ tier: "pro" }) })).status, 404);
    assert.equal((await off.call("/api/billing/status")).body.enabled, false);
    assert.equal((await off.call("/api/verify/start", { method: "POST", body: JSON.stringify({ channel: "sms", target: "6175550142" }) })).status, 404, "no code is sent while phase 1 is off");
  } finally { off.server.close(); }
  const on = mount({ ...ON, STRIPE_SECRET_KEY: "" });
  try {
    const ev = JSON.stringify({ id: "evt_r", type: "checkout.session.completed", livemode: false, data: { object: { client_reference_id: "1", customer: "cus_r" } } });
    assert.equal((await on.call("/api/billing/webhook", { method: "POST", body: ev, headers: { "stripe-signature": signWebhook(ev, "whsec_test") } })).status, 200);
    assert.equal(db.prepare("SELECT stripe_customer_id FROM billing_customers WHERE user_id = 1").pluck().get(), "cus_r");
    assert.equal((await on.call("/api/billing/webhook", { method: "POST", body: ev, headers: { "stripe-signature": "t=1,v1=00" } })).status, 400);
    const live = JSON.stringify({ id: "evt_l", type: "x", livemode: true, data: { object: {} } });
    assert.equal((await on.call("/api/billing/webhook", { method: "POST", body: live, headers: { "stripe-signature": signWebhook(live, "whsec_test") } })).body.ignored, "mode_mismatch");
    const co = await on.call("/api/billing/checkout", { method: "POST", body: JSON.stringify({ tier: "pro" }) });
    assert.equal(co.status, 503); assert.equal(co.body.error, "stripe_not_configured");
    assert.equal((await on.call("/api/account/lead-sharing")).body.consent, false, "OFF by default");
    assert.equal((await on.call("/api/account/lead-sharing", { method: "PUT", body: JSON.stringify({ consent: "yes" }) })).status, 400, "explicit only");
    assert.equal((await on.call("/api/account/lead-sharing", { method: "PUT", body: JSON.stringify({ consent: true }) })).body.consent, true);
    assert.equal((await on.call("/api/account/phone", { method: "POST", body: JSON.stringify({ proof: "forged.sig" }) })).status, 400);
    assert.ok(Array.isArray((await on.call("/api/admin/signup-refusals")).body.refusals));
  } finally { on.server.close(); }
});

test("a167OnlyApplyIsGated: the gate is consulted at startRun and nowhere else; sign-up takes the proofs; merges plan the tables", () => {
  const route = read("routes/apply.js");
  assert.match(route, /const plan = applyAllowed\(db, userId, filtered\);\n\s+if \(!plan\.ok\) return respond\(402,/);
  assert.match(route, /if \(trialSpend\?\.length\) \{ try \{ spendTrialDrafts\(db, userId, trialSpend\);/);
  const users = ["server.js", ...fs.readdirSync("routes").map(f => `routes/${f}`)].filter(f => /applyAllowed\(/.test(read(f)));
  assert.deepEqual(users, ["routes/apply.js"], "(g) the whole site is open — only Apply through draft asks for a plan");
  const server = read("server.js");
  assert.match(server, /provenEmail = readProof\(pepper, req\.body\?\.emailProof, "email"\);/);
  assert.match(server, /const refused = identityRefusal\(db, \{ phone: provenPhone, email: provenEmail \}\);/);
  assert.match(server, /app\.use\(billingRouters\.hooksRouter\);[\s\S]*app\.use\(express\.json\(\{ limit:"4mb" \}\)\);/, "the webhook is mounted before the JSON parser");
  for (const t of ["billing_subscriptions", "billing_customers", "trial_drafts", "signup_refusals"]) assert.ok(t in MERGE_PLAN, t);
  assert.equal(planWords({ enabled: false }), null);
  assert.match(planWords({ enabled: true, trial: { drafts: 10, used: 3, left: 7 }, tiers: [] }).headline, /7 of 10 trial drafts left/);
});
