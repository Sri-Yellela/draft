import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import {
  vapidConfig, vapidJwt, vapidAuthorization, encryptPayload, sendPush, endpointAllowed, generateVapidKeys, fromB64u,
} from "../services/webPush.js";
import {
  NOTIFY_EVENTS, eventText, readPrefs, setPref, saveSubscription, pushToUser, configureNotify, notifyEvent, channelsOffered,
  notifyRunJobOutcome,
} from "../services/notify.js";
import notifyRoutes from "../routes/notify.js";
import { at } from "../test-support/sourceAnchors.js";

// ⭐ D112 item 8 (owner 10-30) · Web Push (VAPID, no vendor) + email through Resend. Synthetic people and keys; every push
// service and Resend is a fake fetch — no test reaches the network.

const b64u = (b) => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** A VAPID pair made here with plain node:crypto (not the service's own generator) — the env variables' encoding. */
function testVapidEnv() {
  const { privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = privateKey.export({ format: "jwk" });
  return {
    VAPID_PUBLIC_KEY: b64u(Buffer.concat([Buffer.from([4]), fromB64u(jwk.x), fromB64u(jwk.y)])),
    VAPID_PRIVATE_KEY: jwk.d, VAPID_SUBJECT: "mailto:support@jobsviadraft.com",
  };
}

/** A browser: its p256dh key pair and auth secret, and the subscription it would hand the page. */
function testBrowser(endpoint = "https://fcm.googleapis.com/fcm/send/synthetic-abc") {
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  const auth = crypto.randomBytes(16);
  return { ecdh, auth, sub: { endpoint, keys: { p256dh: b64u(ecdh.getPublicKey()), auth: b64u(auth) } } };
}

/** The RECEIVER's side of RFC 8291 / RFC 8188, written apart from the sender — the KDF through node's own hkdfSync. */
function decrypt(body, browser) {
  const salt = body.subarray(0, 16), rs = body.readUInt32BE(16), idlen = body[20];
  const asPublic = body.subarray(21, 21 + idlen), ct = body.subarray(21 + idlen);
  assert.equal(rs, 4096);
  assert.equal(idlen, 65);
  const uaPublic = browser.ecdh.getPublicKey();
  const secret = browser.ecdh.computeSecret(asPublic);
  const ikm = Buffer.from(crypto.hkdfSync("sha256", secret, browser.auth, Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]), 32));
  const cek = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
  const d = crypto.createDecipheriv("aes-128-gcm", cek, nonce);
  d.setAuthTag(ct.subarray(ct.length - 16));
  const plain = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  let end = plain.length - 1;
  while (end >= 0 && plain[end] === 0) end--;
  assert.equal(plain[end], 2, "the last record's delimiter");
  return plain.subarray(0, end).toString("utf8");
}

function freshDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'dana','x'), (2,'eli','x')").run();
  db.prepare("INSERT INTO user_profile (user_id, email) VALUES (1, 'dana@personal.example')").run();
  return db;
}

/** A fake network: answers by URL; records every request. */
function fakeFetch(answer = () => 201) {
  const calls = [];
  const fn = async (url, init) => { calls.push({ url, init }); return { ok: true, status: answer(url, init) }; };
  fn.calls = calls;
  return fn;
}

const quiet = { warn() {}, log() {} };

// ── VAPID ────────────────────────────────────────────────────────────────────────────────────

test("D112 · VAPID — the JWT is ES256 with aud = the push service's origin, exp ≤ 24 h, sub; its signature verifies with the public key", () => {
  const env = testVapidEnv();
  const vapid = vapidConfig(env);
  assert.ok(vapid, "a well-formed pair is accepted");
  const nowSec = 1_800_000_000;
  const jwt = vapidJwt({ audience: "https://fcm.googleapis.com", subject: vapid.subject, privateKey: vapid.privateKey, nowSec });
  const [h, c, s] = jwt.split(".");
  assert.deepEqual(JSON.parse(fromB64u(h)), { typ: "JWT", alg: "ES256" });
  const claims = JSON.parse(fromB64u(c));
  assert.equal(claims.aud, "https://fcm.googleapis.com");
  assert.equal(claims.sub, "mailto:support@jobsviadraft.com");
  assert.ok(claims.exp > nowSec && claims.exp <= nowSec + 24 * 3600);
  const sig = fromB64u(s);
  assert.equal(sig.length, 64, "JWS ES256 is raw r‖s, not DER");
  const p = fromB64u(env.VAPID_PUBLIC_KEY);
  const pub = crypto.createPublicKey({ format: "jwk", key: { kty: "EC", crv: "P-256", x: b64u(p.subarray(1, 33)), y: b64u(p.subarray(33)) } });
  assert.ok(crypto.verify("sha256", Buffer.from(`${h}.${c}`), { key: pub, dsaEncoding: "ieee-p1363" }, sig));
  const tampered = b64u(Buffer.from(JSON.stringify({ ...claims, sub: "mailto:x@example.com" })));
  assert.ok(!crypto.verify("sha256", Buffer.from(`${h}.${tampered}`), { key: pub, dsaEncoding: "ieee-p1363" }, sig));
  // The header: aud from the endpoint's ORIGIN (no path), k = the public key.
  const auth = vapidAuthorization("https://updates.push.services.mozilla.com/wpush/v2/abc", vapid, nowSec);
  assert.match(auth, new RegExp(`^vapid t=[^,]+, k=${env.VAPID_PUBLIC_KEY}$`));
  assert.equal(JSON.parse(fromB64u(auth.slice(8).split(",")[0].split(".")[1])).aud, "https://updates.push.services.mozilla.com");
  // The owner's generator makes a pair the service accepts.
  const g = generateVapidKeys();
  assert.ok(vapidConfig({ VAPID_PUBLIC_KEY: g.publicKey, VAPID_PRIVATE_KEY: g.privateKey, VAPID_SUBJECT: "mailto:a@b.example" }));
});

test("D112 · nothing offered without the env — unset, half-set, mismatched or a bad subject is no push at all", async () => {
  const env = testVapidEnv();
  assert.equal(vapidConfig({}), null);
  assert.equal(vapidConfig({ ...env, VAPID_SUBJECT: "" }), null);
  assert.equal(vapidConfig({ ...env, VAPID_PRIVATE_KEY: "" }), null);
  assert.equal(vapidConfig({ ...env, VAPID_SUBJECT: "support@jobsviadraft.com" }), null, "RFC 8292: mailto: or https:");
  assert.equal(vapidConfig({ ...env, VAPID_PRIVATE_KEY: testVapidEnv().VAPID_PRIVATE_KEY }), null, "a private key that is not the public key's");
  assert.deepEqual(channelsOffered({}), { push: false, publicKey: null, email: false });
  assert.equal((await sendPush(testBrowser().sub, "x", { vapid: null, fetchImpl: fakeFetch() })).error, "not_configured");

  const db = freshDb();
  const mk = (e, f = fakeFetch()) => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.user = { id: 1 }; next(); });
    notifyRoutes(app, db, (req, _res, next) => next(), { env: e, fetchImpl: f });
    return app.listen(0);
  };
  const off = mk({});
  try {
    const base = `http://127.0.0.1:${off.address().port}`;
    const st = await (await fetch(`${base}/api/notify/settings`)).json();
    assert.deepEqual([st.push.offered, st.push.publicKey, st.email.offered], [false, null, false]);
    // 45s (on purpose): a Network event (messages_unread) is listed only while the network is on — off here.
    assert.equal(st.events.length, Object.values(NOTIFY_EVENTS).filter(e => !e.network).length);
    const sub = await fetch(`${base}/api/push/subscribe`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(testBrowser().sub) });
    assert.equal(sub.status, 404);
    assert.equal(db.prepare("SELECT COUNT(*) FROM push_subscriptions").pluck().get(), 0);
    assert.equal((await fetch(`${base}/api/push/test`, { method: "POST" })).status, 404);
  } finally { off.close(); }
  const on = mk(env);
  try {
    const base = `http://127.0.0.1:${on.address().port}`;
    const st = await (await fetch(`${base}/api/notify/settings`)).json();
    assert.deepEqual([st.push.offered, st.push.publicKey], [true, env.VAPID_PUBLIC_KEY]);
    const ok = await fetch(`${base}/api/push/subscribe`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(testBrowser().sub) });
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).push.devices, 1);
    const evil = await fetch(`${base}/api/push/subscribe`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testBrowser("https://169.254.169.254/latest").sub) });
    assert.equal(evil.status, 400, "an endpoint that is not a push service is refused");
    const pref = await fetch(`${base}/api/notify/prefs`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "nope", channel: "push", on: true }) });
    assert.equal(pref.status, 400);
  } finally { on.close(); }
  // The client shows push only when the server offers it, and registers the service worker only on the person's press.
  const card = fs.readFileSync(new URL("../client/src/components/NotificationSettings.jsx", import.meta.url), "utf8");
  assert.match(card, /const pushOffered = state\.push\?\.offered && pushSupported\(\);/);
  assert.match(card.slice(at(card, "const setHerePush"), at(card, "if (!pushOffered && !emailOffered)")), /Notification\.requestPermission\(\)[\s\S]*serviceWorker\.register\("\/sw\.js"/);
});

test("D112 · endpoints — only the browsers' push services, https, no credentials, no odd port", () => {
  for (const ok of ["https://fcm.googleapis.com/fcm/send/x", "https://updates.push.services.mozilla.com/wpush/v2/x",
    "https://wns2-by3p.notify.windows.com/w/?token=x", "https://web.push.apple.com/QH8x"]) assert.ok(endpointAllowed(ok), ok);
  for (const bad of ["http://fcm.googleapis.com/x", "https://localhost/x", "https://evilfcm.googleapis.com.example/x",
    "https://u:p@fcm.googleapis.com/x", "https://fcm.googleapis.com:8443/x", "https://10.0.0.1/x", "not a url"]) assert.ok(!endpointAllowed(bad), bad);
});

// ── RFC 8291 ─────────────────────────────────────────────────────────────────────────────────

test("D112 · RFC 8291 — the payload encrypts for a test key pair and the receiver's side decrypts it; a wrong auth secret cannot", () => {
  const browser = testBrowser();
  const message = JSON.stringify({ title: "Ready for your approval", body: "A job is ready for your approval.", url: "/app/auto-apply" });
  const body = encryptPayload(message, browser.sub);
  assert.equal(decrypt(body, browser), message);
  // Fresh salt and key per message: the same message never encrypts to the same bytes.
  const again = encryptPayload(message, browser.sub);
  assert.notDeepEqual(body.subarray(0, 16), again.subarray(0, 16));
  assert.notDeepEqual(body.subarray(21, 86), again.subarray(21, 86));
  assert.throws(() => decrypt(body, { ...browser, auth: crypto.randomBytes(16) }));
  assert.throws(() => encryptPayload("x", { keys: { p256dh: "short", auth: browser.sub.keys.auth } }), /bad_p256dh/);
  assert.throws(() => encryptPayload("x".repeat(5000), browser.sub), /payload_too_large/);
});

test("D112 · sending — the request carries aes128gcm, the VAPID header, TTL; a 410 and a 404 DELETE the subscription, a 201 stamps it, 500s count", async () => {
  const db = freshDb();
  const vapid = vapidConfig(testVapidEnv());
  const live = testBrowser("https://fcm.googleapis.com/fcm/send/live");
  const gone = testBrowser("https://updates.push.services.mozilla.com/wpush/v2/gone");
  const missing = testBrowser("https://web.push.apple.com/missing");
  const flaky = testBrowser("https://wns2-by3p.notify.windows.com/w/?token=flaky");
  for (const b of [live, gone, missing, flaky]) saveSubscription(db, 1, b.sub, "test");
  const f = fakeFetch((url) => url.endsWith("gone") ? 410 : url.endsWith("missing") ? 404 : url.includes("flaky") ? 500 : 201);
  const r = await pushToUser(db, 1, { title: "t", body: "b" }, { vapid, fetchImpl: f, topic: "needsyou" });
  assert.deepEqual(r, { sent: 1, removed: 2, failed: 1 });
  const left = db.prepare("SELECT endpoint, failures, last_success_at FROM push_subscriptions ORDER BY id").all();
  assert.deepEqual(left.map(x => x.endpoint), [live.sub.endpoint, flaky.sub.endpoint], "410 and 404 are deleted");
  assert.ok(left[0].last_success_at > 0);
  assert.equal(left[1].failures, 1);
  const req = f.calls.find(c => c.url === live.sub.endpoint).init;
  assert.equal(req.method, "POST");
  assert.equal(req.headers["Content-Encoding"], "aes128gcm");
  assert.match(req.headers.Authorization, /^vapid t=.+, k=/);
  assert.equal(req.headers.TTL, String(24 * 3600));
  assert.equal(req.headers.Topic, "needsyou");
  assert.deepEqual(JSON.parse(decrypt(req.body, live)), { title: "t", body: "b" });
  // Five failures in a row retire a subscription.
  for (let i = 0; i < 4; i++) await pushToUser(db, 1, { title: "t" }, { vapid, fetchImpl: f });
  assert.deepEqual(db.prepare("SELECT endpoint FROM push_subscriptions").pluck().all(), [live.sub.endpoint]);
});

// ── preferences and the dispatcher ───────────────────────────────────────────────────────────

test("D112 · preferences respected — defaults, a switch per event per channel, push / email only when chosen; the in-app row always", async () => {
  const db = freshDb();
  const env = { ...testVapidEnv(), RESEND_API_KEY: "re_test" };
  const f = fakeFetch(() => 201);
  const config = configureNotify({ db, fetchImpl: f, env, appUrl: "https://jobsviadraft.com", log: quiet });
  try {
    const browser = testBrowser();
    saveSubscription(db, 1, browser.sub);
    const d = readPrefs(db, 1);
    assert.deepEqual(d.needs_you, { push: true, email: false });
    assert.deepEqual(d.apply_complete, { push: false, email: false });

    // apply_complete: push off by default → the bell only.
    let r = await notifyEvent(1, "apply_complete", {}, { config });
    assert.ok(r.id);
    assert.equal(r.push, null);
    assert.equal(r.email, null);
    assert.equal(f.calls.length, 0);

    // needs_you: push on → one push, decrypting to the exact D100 P4 words; no email (off).
    r = await notifyEvent(1, "needs_you", { ready: true }, { config });
    assert.equal(r.push.sent, 1);
    assert.equal(f.calls.length, 1);
    assert.deepEqual(JSON.parse(decrypt(f.calls[0].init.body, browser)),
      { title: "Ready for your approval", body: "A job is ready for your approval.", url: "/app/auto-apply", tag: "needs_you" });

    // A burst is one ping: the second needs_you inside the window writes the row, sends nothing.
    r = await notifyEvent(1, "needs_you", {}, { config });
    assert.ok(r.id && r.throttled);
    assert.equal(f.calls.length, 1);

    // The person turns push OFF and email ON for inbox replies → Resend, not the push service.
    setPref(db, 1, "inbox_reply", "push", false);
    setPref(db, 1, "inbox_reply", "email", true);
    r = await notifyEvent(1, "inbox_reply", { category: "offer" }, { config });
    assert.equal(r.push, null);
    assert.deepEqual(r.email, { ok: true, provider: "resend" });
    const mail = f.calls.at(-1);
    assert.equal(mail.url, "https://api.resend.com/emails");
    const sent = JSON.parse(mail.init.body);
    assert.equal(sent.to, "dana@personal.example");
    assert.match(sent.text, /filed as an offer/);
    assert.match(sent.text, /https:\/\/jobsviadraft\.com\/app\/database\?sheet=inbox/);
    // The rows: every event is a notifications row (the bell), whatever the channels did.
    assert.deepEqual(db.prepare("SELECT type FROM notifications WHERE user_id=1 ORDER BY id").pluck().all(),
      ["apply_complete", "needs_you", "needs_you", "inbox_reply"]);
    // Another person's switches are their own.
    assert.deepEqual(readPrefs(db, 2).inbox_reply, { push: true, email: false });
    assert.throws(() => setPref(db, 1, "needs_you", "sms", true), /Unknown channel/);
    // Email chosen but no Resend key: nothing is attempted.
    const noMail = configureNotify({ db, fetchImpl: f, env: { ...env, RESEND_API_KEY: "" }, log: quiet });
    const before = f.calls.length;
    r = await notifyEvent(1, "inbox_reply", { category: "interview" }, { config: noMail });
    assert.equal(r.email, null);
    assert.equal(f.calls.length, before);
  } finally { configureNotify({}); }
});

test("D112 · D100 P4 — no event's words ever carry a company or a value", () => {
  for (const ev of Object.keys(NOTIFY_EVENTS)) {
    for (const data of [{}, { ready: true }, { category: "offer" }, { category: "interview" }, { sent: 3, waiting: 1 },
      { company: "Northwind", value: "Backend Engineer" }]) {
      const t = eventText(ev, data);
      assert.ok(!/Northwind|Backend Engineer/.test(`${t.title} ${t.body}`), `${ev}: ${t.body}`);
    }
  }
  // The per-run summary replaced the retired 8 pm one (10-31): counts only, never a company.
  assert.equal(eventText("picks_summary", { sent: 1, waiting: 0 }).body, "This run sent 1 application.");
  assert.equal(eventText("picks_summary", { sent: 3, waiting: 2 }).body, "This run sent 3 applications. 2 need you.");
  // Unconfigured, the dispatcher does nothing — the services that call it behave as before.
  return notifyEvent(1, "needs_you", {}, { config: null }).then(r => assert.equal(r.skipped, "unconfigured"));
});

// ── the events: reuse of the pipeline's own moments ──────────────────────────────────────────

test("D112 · the events fire from the pipeline — a run's held / sent job, the worker's reports, the inbox's interview / offer, FULL AUTO's day", async () => {
  const db = freshDb();
  const config = configureNotify({ db, fetchImpl: fakeFetch(), env: {}, log: quiet });
  try {
    db.prepare("INSERT INTO apply_runs (id, user_id) VALUES (1, 1)").run();
    const rj = (id, status, reason = null) => db.prepare("INSERT INTO apply_run_jobs (id, run_id, user_id, job_id, status, reason_code, finished_at) VALUES (?, 1, 1, ?, ?, ?, unixepoch())")
      .run(id, `gh::${id}`, status, reason);
    rj(1, "held_review", "awaiting_approval"); rj(2, "submitted"); rj(3, "held_gate", "login_required"); rj(4, "failed");
    db.prepare("INSERT INTO apply_remote_runs (user_id, run_job_id, mode, state) VALUES (1, 3, 'fill', 'queued')").run();
    const types = () => db.prepare("SELECT type, message FROM notifications WHERE user_id=1 ORDER BY id").all();
    await notifyRunJobOutcome(db, 1, { config });
    await notifyRunJobOutcome(db, 2, { config });
    await notifyRunJobOutcome(db, 3, { config }); // the worker holds it — not the person's yet
    await notifyRunJobOutcome(db, 4, { config });
    assert.deepEqual(types(), [{ type: "needs_you", message: "A job is ready for your approval." }, { type: "apply_complete", message: "An application was sent." }]);

    // ⛔ 10-31 (owner): the 8 pm daily summary is retired — Apply for me gets picks_summary after every run instead.
    const notify = await import("../services/notify.js");
    assert.equal(notify.runDailySummaries, undefined, "no daily summary run");
    assert.equal(notify.NOTIFY_EVENTS.auto_daily_summary, undefined, "no daily summary switch in Settings");
    assert.ok(notify.NOTIFY_EVENTS.picks_summary, "the per-run summary stays");
  } finally { configureNotify({}); }

  // The hooks are in the pipeline's own places (source pins, carved with at()).
  const apply = fs.readFileSync(new URL("../routes/apply.js", import.meta.url), "utf8");
  assert.match(apply.slice(at(apply, "() => withStartedBy(startedByOfRun(run), () => processRunJob(job, run)))"), at(apply, "runningJobs.push(p);")), /\.then\(\(\) => \{ notifyRunJobOutcome\(db, job\.id\); \}\)/);
  const worker = fs.readFileSync(new URL("../services/applyWorker.js", import.meta.url), "utf8");
  const report = worker.slice(at(worker, "export function acceptReport"), at(worker, "export function approveRemoteRun"));
  assert.match(report, /setRunJob\("held_review", "awaiting_approval"\);[\s\S]{0,200}notifyEvent\(row\.user_id, "needs_you", \{ ready: true \}\)/);
  assert.match(report, /hooks\.onSubmitted[\s\S]{0,200}notifyEvent\(row\.user_id, "apply_complete"/);
  assert.match(report.slice(at(report, 'if (report.outcome === "stopped")')), /notifyEvent\(row\.user_id, "needs_you", \{\}\)/);
  const server = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8");
  assert.ok(at(server, "configureNotify({ db, emitToUser") < at(server, "applyLine.recoverInterruptedRuns();"), "configured before a recovered run can finish");
  const tick = server.slice(at(server, "const ran = await runAutoTick("), at(server, "}), AUTO_TICK_MS)"));
  assert.doesNotMatch(tick, /runDailySummaries/, "the tick no longer sends an 8 pm summary");
  assert.match(tick, /runPicksFollowUps\(db, /, "Apply for me's per-run summary is sent from the tick");
});

test("D112 · the inbox's Interview / Offer notifies — through the same notifications row, without the company", async () => {
  const { ingestForUser } = await import("../services/inbox.js");
  const db = freshDb();
  configureNotify({ db, fetchImpl: fakeFetch(), env: {}, log: quiet });
  try {
    db.prepare("INSERT INTO application_records (user_id, job_id, state, origin, submitted_at) VALUES (1, 'gh::nw', 'verified', 'drafted', unixepoch()-86400)").run();
    db.prepare("INSERT INTO job_applications (user_id, job_id, company, role, company_domain) VALUES (1, 'gh::nw', 'Northwind', 'Backend Engineer', 'northwind.example')").run();
    const out = ingestForUser(db, { userId: 1, from: "Recruiting <talent@northwind.example>", subject: "Interview invitation — Backend Engineer at Northwind",
      text: "Hi Dana, we would like to schedule an interview with you for the Backend Engineer role. Please pick a time." });
    assert.equal(out.category, "interview");
    assert.ok(out.advanced);
    const n = db.prepare("SELECT type, message FROM notifications WHERE user_id=1").all();
    assert.deepEqual(n, [{ type: "inbox_reply", message: "A reply from an employer was filed as an interview." }]);
  } finally { configureNotify({}); }
});

// ── the account paths and the service worker ─────────────────────────────────────────────────

test("D112 · account paths — subscriptions move and switches keepInto on merge; the export drops endpoint and keys; delete cascades", async () => {
  const { MERGE_PLAN, exportAccount, deleteAccount } = await import("../services/accountService.js");
  assert.equal(MERGE_PLAN.push_subscriptions, "move");
  assert.equal(MERGE_PLAN.notification_prefs, "keepInto");
  const db = freshDb();
  saveSubscription(db, 1, testBrowser().sub, "Chrome");
  setPref(db, 1, "needs_you", "email", true);
  const out = exportAccount(db, 1);
  assert.equal(out.data.push_subscriptions.length, 1);
  assert.equal(out.data.push_subscriptions[0].user_agent, "Chrome");
  for (const k of ["endpoint", "key_p256dh", "key_auth"]) assert.ok(!(k in out.data.push_subscriptions[0]), k);
  assert.equal(out.data.notification_prefs[0].event, "needs_you");
  deleteAccount(db, 1);
  assert.equal(db.prepare("SELECT COUNT(*) FROM push_subscriptions").pluck().get(), 0);
  assert.equal(db.prepare("SELECT COUNT(*) FROM notification_prefs").pluck().get(), 0);
  // The same browser signed in as another account now pushes to THAT account — one row per endpoint.
  const db2 = freshDb();
  const b = testBrowser();
  saveSubscription(db2, 1, b.sub);
  saveSubscription(db2, 2, b.sub);
  assert.deepEqual(db2.prepare("SELECT user_id FROM push_subscriptions").pluck().all(), [2]);
});

test("D112 · the service worker shows a push and opens draft — and does nothing else (no fetch handler, no cache)", () => {
  const sw = fs.readFileSync(new URL("../client/public/sw.js", import.meta.url), "utf8");
  assert.match(sw, /addEventListener\("push"/);
  assert.match(sw, /showNotification\(/);
  assert.match(sw, /addEventListener\("notificationclick"/);
  assert.ok(!/addEventListener\("fetch"/.test(sw), "no fetch handler — the app loads from the network as before");
  assert.ok(!/caches\./.test(sw), "no cache");
  assert.match(sw, /data\.url\.startsWith\("\/"\)/, "only a same-site path is opened");
});
