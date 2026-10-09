// D73 §B (owner, 10-08/10-09) — the app's email work, each guard red when removed. No mail leaves: Resend is a stub.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { sendEmail, sendPasswordResetEmail } from "../services/emailService.js";
import { sendMarketingEmail, signUnsubscribeToken, setMarketingConsent, unsubscribe, verifyUnsubscribeToken } from "../services/emailConsent.js";
import { verifySvixSignature, recordEmailEvent, isSuppressed } from "../services/emailSuppression.js";
import { sendNotice, noticeDryRun, NOTICE_DEFAULT_CEILING } from "../services/notices.js";
import { createEmailRouters } from "../routes/email.js";
import { SUPPORT_EMAIL } from "../shared/brand.js";

const ENV = { RESEND_API_KEY: "re_test", PASSWORD_RESET_SECRET: "pepper", NODE_ENV: "test" };
function db(users = 2) {
  const d = new Database(":memory:");
  for (const m of MIGRATIONS) d.exec(m.sql);
  for (let i = 1; i <= users; i++) {
    d.prepare("INSERT INTO users (id, username, password_hash) VALUES (?, ?, 'h')").run(i, `u${i}`);
    d.prepare("INSERT INTO user_profile (user_id, email) VALUES (?, ?)").run(i, `u${i}@example.com`);
  }
  return d;
}
function resend() {
  const sent = [];
  return { sent, fetchImpl: async (_url, init) => { sent.push(JSON.parse(init.body)); return { ok: true, status: 200 }; } };
}

test("⛔ D73: service mail replies to support@ — noreply@ has no inbox", async () => {
  const r = resend();
  await sendEmail({ to: "a@example.com", subject: "s", text: "t", env: ENV, fetchImpl: r.fetchImpl });
  assert.equal(r.sent[0].reply_to, SUPPORT_EMAIL);
  assert.equal(SUPPORT_EMAIL, "support@jobsviadraft.com");
});

test("⛔ D73: a reset email still goes to a user who unsubscribed from marketing; a SUPPRESSED address gets nothing", async () => {
  const d = db();
  unsubscribe(d, 1);
  const r = resend();
  const ok = await sendPasswordResetEmail({ to: "u1@example.com", resetUrl: "https://x/r", otp: "123456", expiresAt: 9e9 }, { db: d, env: ENV, fetchImpl: r.fetchImpl });
  assert.equal(ok.ok, true);
  assert.equal(r.sent.length, 1, "unsubscribing from marketing never stops account mail");
  recordEmailEvent(d, { type: "email.bounced", data: { to: ["u1@example.com"], bounce: { type: "Permanent" } } });
  const no = await sendEmail({ to: "U1@example.com", subject: "s", text: "t", db: d, env: ENV, fetchImpl: r.fetchImpl });
  assert.deepEqual([no.ok, no.reason, r.sent.length], [false, "suppressed", 1]);
});

test("⛔ D73: a marketing send skips anyone not opted in, unsubscribed or suppressed — and refuses entirely unless enabled", async () => {
  const d = db(3);
  const r = resend();
  const on = { ...ENV, MARKETING_SENDS_ENABLED: "1", MAIL_POSTAL_ADDRESS: "PO Box 1, Boston MA" };
  const send = (userId, env = on) => sendMarketingEmail(d, { userId, subject: "News", text: "Hello", appUrl: "https://jobsviadraft.com", env, fetchImpl: r.fetchImpl });
  assert.equal((await send(1, ENV)).reason, "marketing_disabled");
  assert.equal((await send(1, { ...ENV, MARKETING_SENDS_ENABLED: "1" })).reason, "no_postal_address");
  assert.equal((await send(1)).reason, "not_opted_in", "nobody is opted in by default");
  setMarketingConsent(d, 1, true, "signup");
  setMarketingConsent(d, 2, true, "signup"); unsubscribe(d, 2);
  setMarketingConsent(d, 3, true, "signup"); recordEmailEvent(d, { type: "email.complained", data: { to: ["u3@example.com"] } });
  assert.equal((await send(2)).reason, "not_opted_in");
  assert.equal((await send(3)).reason, "suppressed");
  assert.equal(r.sent.length, 0);
  assert.equal((await send(1)).ok, true);
  assert.match(r.sent[0].headers["List-Unsubscribe"], /^<https:\/\/jobsviadraft\.com\/u\/[^>]+>$/);
  assert.equal(r.sent[0].headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  assert.match(r.sent[0].text, /Unsubscribe: https:\/\/jobsviadraft\.com\/u\//);
  assert.match(r.sent[0].text, /PO Box 1/);
});

test("⛔ D73: no promotional sending path is reachable — no route or server code imports the marketing sender", () => {
  const files = ["server.js", ...fs.readdirSync("routes").map(f => `routes/${f}`), ...fs.readdirSync("services").filter(f => f.endsWith(".js") && f !== "emailConsent.js").map(f => `services/${f}`)];
  for (const f of files) assert.doesNotMatch(fs.readFileSync(f, "utf8"), /sendMarketingEmail/, f);
});

async function app(t, d, env = ENV) {
  const a = express();
  const { hooksRouter, appRouter } = createEmailRouters({ db: d, env, requireAuth: (req, _r, n) => { req.user = { id: 1 }; n(); },
    requireAdmin: (req, _r, n) => { req.user = { id: 1 }; n(); }, log: { warn() {} } });
  a.use(hooksRouter); a.use(express.json()); a.use(appRouter);
  const s = a.listen(0); t.after(() => s.close());
  return `http://127.0.0.1:${s.address().port}`;
}

test("⛔ D73: the unsubscribe link works signed out, twice, and as a one-click POST; a forged token is refused", async (t) => {
  const d = db();
  setMarketingConsent(d, 1, true, "signup");
  const base = await app(t, d);
  const tok = signUnsubscribeToken(1, { env: ENV });
  assert.equal(verifyUnsubscribeToken(tok, { env: ENV }), 1);
  assert.equal((await fetch(`${base}/u/${tok}`)).status, 200);
  assert.equal((await fetch(`${base}/u/${tok}`)).status, 200, "idempotent");
  assert.equal((await fetch(`${base}/u/${tok}`, { method: "POST", body: "List-Unsubscribe=One-Click", headers: { "content-type": "application/x-www-form-urlencoded" } })).status, 200);
  const row = d.prepare("SELECT marketing_opt_in, unsubscribed_at FROM users WHERE id = 1").get();
  assert.equal(row.marketing_opt_in, 0); assert.ok(row.unsubscribed_at);
  const forged = signUnsubscribeToken(2, { env: { PASSWORD_RESET_SECRET: "other" } });
  assert.equal((await fetch(`${base}/u/${forged}`)).status, 400);
});

test("⛔ D73: the Resend webhook refuses a bad signature and a stale timestamp; a good one suppresses the bounced address", async (t) => {
  const d = db();
  const secretRaw = crypto.randomBytes(24);
  const env = { ...ENV, RESEND_WEBHOOK_SECRET: `whsec_${secretRaw.toString("base64")}` };
  const base = await app(t, d, env);
  const body = JSON.stringify({ type: "email.bounced", data: { email_id: "e1", to: ["u2@example.com"], bounce: { type: "Permanent" } } });
  const ts = String(Math.floor(Date.now() / 1000));
  const sign = (id, stamp, b) => `v1,${crypto.createHmac("sha256", secretRaw).update(`${id}.${stamp}.${b}`).digest("base64")}`;
  const post = (headers, b = body) => fetch(`${base}/api/hooks/resend`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: b });
  assert.equal((await post({ "svix-id": "m1", "svix-timestamp": ts, "svix-signature": "v1,AAAA" })).status, 401);
  const old = String(Number(ts) - 3600);
  assert.equal((await post({ "svix-id": "m1", "svix-timestamp": old, "svix-signature": sign("m1", old, body) })).status, 401);
  assert.equal((await post({ "svix-id": "m1", "svix-timestamp": ts, "svix-signature": sign("m1", ts, body) }, body + " ")).status, 401, "the RAW body is what is signed");
  const ok = await post({ "svix-id": "m1", "svix-timestamp": ts, "svix-signature": `v1,zzz ${sign("m1", ts, body)}` });
  assert.equal(ok.status, 200);
  assert.equal(isSuppressed(d, "u2@example.com"), true);
  assert.equal(verifySvixSignature({ rawBody: body, headers: {}, secret: null }).reason, "unconfigured");
});

test("⛔ D73: the notice tool's dry run sends nothing, and it refuses above its ceiling unless raised to the count", async () => {
  const d = db(NOTICE_DEFAULT_CEILING + 2);
  const r = resend();
  const dry = noticeDryRun(d, { audience: "all" });
  assert.equal(dry.recipients, NOTICE_DEFAULT_CEILING + 2);
  assert.equal(dry.overCeiling, true);
  assert.equal(r.sent.length, 0);
  const args = { audience: "all", subject: "Policy update", body: "We changed X.", why: "our policy is changing", env: ENV, fetchImpl: r.fetchImpl, sleep: async () => {} };
  await assert.rejects(sendNotice(d, args), (e) => e.status === 409 && /above the ceiling/.test(e.message));
  assert.equal(r.sent.length, 0, "a refusal sends nothing");
  assert.equal(d.prepare("SELECT COUNT(*) FROM notice_log").pluck().get(), 0);
  const out = await sendNotice(d, { ...args, ceiling: NOTICE_DEFAULT_CEILING + 2 });
  assert.equal(out.sent, NOTICE_DEFAULT_CEILING + 2);
  assert.match(r.sent[0].text, /You are receiving this service notice because you have a draft account: our policy is changing/);
  const logRow = d.prepare("SELECT * FROM notice_log").get();
  assert.equal(logRow.recipients, NOTICE_DEFAULT_CEILING + 2);
  assert.ok(!Object.values(logRow).some(v => typeof v === "string" && /We changed X|Policy update/.test(v)), "the log never holds the content");
  await assert.rejects(sendNotice(d, { ...args, why: "" }), /why the user/);
});

test("⛔ D73: the sign-up box starts UNTICKED and consent is recorded only when ticked, with when and where", () => {
  const auth = fs.readFileSync("client/src/components/AuthScreen.jsx", "utf8");
  assert.match(auth, /const \[marketingOptIn, setMarketingOptIn\] = useState\(false\);/);
  assert.match(auth, /marketingOptIn: marketingOptIn === true,/);
  const server = fs.readFileSync("server.js", "utf8");
  assert.match(server, /if \(req\.body\?\.marketingOptIn === true\) setMarketingConsent\(db, newUser\.id, true, "signup"\);/);
  const d = db(1);
  setMarketingConsent(d, 1, true, "signup");
  const row = d.prepare("SELECT marketing_opt_in, marketing_opt_in_at, marketing_opt_in_source FROM users WHERE id = 1").get();
  assert.deepEqual([row.marketing_opt_in, row.marketing_opt_in_source, !!row.marketing_opt_in_at], [1, "signup", true]);
});
