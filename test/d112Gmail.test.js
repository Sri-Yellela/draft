import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { createSecretBox } from "../services/secretBox.js";
import { ingestMessage, addressFor, setCodeOptIn, codeForWorker, ATS_SENDER_DOMAINS } from "../services/inbox.js";
import {
  GMAIL_SCOPE, GOOGLE_ENDPOINTS, gmailQueryFor, extractMessage, saveConnection, pollUser, pollAll, disconnect, connectionStatus,
  createGoogleGmailClient, messageInScope, scopeTerms,
} from "../services/gmail.js";
import gmailRoutes from "../routes/gmail.js";
import { at } from "../test-support/sourceAnchors.js";

// ⭐ D112 item 2 (owner 10-30) · the Gmail connection — gmail.readonly, only the ATS senders and the user's applications'
// companies, each message through D103's one path, Disconnect revokes. Synthetic people, companies and mail; a fake
// Google client throughout — no test reaches the network.

const BOX = createSecretBox(crypto.randomBytes(32));
const REFRESH = "1//synthetic-refresh-token-abc";
const b64 = (s) => Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function freshDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'dana','x'), (2,'eli','x')").run();
  const app = (userId, job, company, title, domain = null, state = "verified") => {
    db.prepare("INSERT INTO application_records (user_id, job_id, state, origin, submitted_at) VALUES (?,?,?,'drafted',unixepoch()-86400)").run(userId, job, state);
    db.prepare("INSERT INTO job_applications (user_id, job_id, company, role, company_domain) VALUES (?,?,?,?,?)").run(userId, job, company, title, domain);
    return db.prepare("SELECT id FROM application_records WHERE user_id=? AND job_id=?").pluck().get(userId, job);
  };
  const northwind = app(1, "gh::nw", "Northwind", "Backend Engineer", "northwind.example");
  const contoso = app(1, "lv::ct", "Contoso", "Data Engineer");
  app(2, "gh::fb", "Fabrikam", "SRE", "fabrikam.example");          // ANOTHER user's company — never in user 1's query
  return { db, northwind, contoso };
}

/** A Gmail message resource (format=full), multipart, optionally with attachments. */
function gmailMsg(id, { from, subject, text = null, html = null, attachments = [], at = Date.now() }) {
  const parts = [];
  if (text != null) parts.push({ partId: "0", mimeType: "text/plain", filename: "", body: { size: text.length, data: b64(text) } });
  if (html != null) parts.push({ partId: "1", mimeType: "text/html", filename: "", body: { size: html.length, data: b64(html) } });
  for (const a of attachments) parts.push(a);
  return { id, threadId: `t${id}`, internalDate: String(at), payload: { mimeType: "multipart/mixed", filename: "",
    headers: [{ name: "From", value: from }, { name: "Subject", value: subject }, { name: "To", value: "dana@personal.example" }],
    body: { size: 0 }, parts: [{ partId: "", mimeType: "multipart/alternative", filename: "", body: { size: 0 }, parts: parts.slice(0, 2) }, ...parts.slice(2)] } };
}

/** A fake Google: records every call; `mailbox` is what a list returns (a real Gmail would filter by q — the fake
 * returns everything, so the second check is what is tested). */
function fakeClient(mailbox = [], { refreshError = null } = {}) {
  const calls = [];
  return {
    calls, mailbox,
    authUrl: ({ state, redirectUri }) => { calls.push(["authUrl", state, redirectUri]); return `https://accounts.google.example/auth?state=${state}`; },
    exchangeCode: async ({ code, redirectUri }) => { calls.push(["exchangeCode", code, redirectUri]); return { access_token: "ya29.a", refresh_token: REFRESH, scope: GMAIL_SCOPE, expires_in: 3599 }; },
    refreshAccess: async (rt) => { calls.push(["refreshAccess", rt]); if (refreshError) throw Object.assign(new Error("x"), { code: refreshError }); return { access_token: "ya29.b" }; },
    profile: async () => { calls.push(["profile"]); return { emailAddress: "dana@personal.example", historyId: "1" }; },
    listMessages: async ({ q, pageToken }) => { calls.push(["listMessages", q, pageToken]); return { messages: mailbox.map(m => ({ id: m.id, threadId: m.threadId })) }; },
    getMessage: async ({ id }) => { calls.push(["getMessage", id]); return mailbox.find(m => m.id === id); },
    revoke: async (token) => { calls.push(["revoke", token]); return {}; },
  };
}

test("D112 · d112GmailQueryScopedToApplications — the query is the ATS senders + THIS user's companies, after the watermark", async () => {
  const { db } = freshDb();
  const nowSec = Math.floor(Date.now() / 1000);
  const q = gmailQueryFor(db, 1, { afterSec: nowSec - 3600, nowSec });
  for (const d of ATS_SENDER_DOMAINS) assert.ok(q.includes(`from:${d}`), `the ATS sender ${d}`);
  assert.ok(q.includes("from:northwind.example"), "the company's own domain");
  assert.ok(q.includes('subject:"Northwind"') && q.includes('subject:"Contoso"'), "the companies by name, in the subject");
  assert.ok(!/fabrikam/i.test(q), "another user's application is never in this user's query");
  assert.match(q, /^\{[^{}]+\} after:\d+$/, "ONE OR-group and an exact epoch-seconds after: — nothing outside the group");
  assert.ok(!/in:anywhere|in:all|has:attachment|label:/i.test(q));
  // a withdrawn application's company is not read for
  db.prepare("UPDATE application_records SET state='withdrawn' WHERE job_id='lv::ct'").run();
  assert.ok(!gmailQueryFor(db, 1, { nowSec }).includes("Contoso"));

  // The poll sends exactly that query; the first reads back 30 days, the next from the newest message read.
  saveConnection(db, BOX, 1, { refreshToken: REFRESH, email: "dana@personal.example" });
  const sent = Date.now() - 2 * 3600 * 1000;
  const client = fakeClient([gmailMsg("m1", { from: "Northwind Talent <talent@northwind.example>", subject: "Thanks for applying to Northwind", text: "We have received your application.", at: sent })]);
  await pollUser(db, { box: BOX, client, userId: 1, nowSec });
  const [, q1] = client.calls.find(c => c[0] === "listMessages");
  assert.equal(q1, gmailQueryFor(db, 1, { afterSec: nowSec - 30 * 86400, nowSec }));
  client.calls.length = 0;
  await pollUser(db, { box: BOX, client, userId: 1, nowSec: nowSec + 900 });
  const [, q2] = client.calls.find(c => c[0] === "listMessages");
  assert.match(q2, new RegExp(` after:${Math.floor(sent / 1000) - 60}$`), "incremental: after the watermark");
  assert.ok(!client.calls.some(c => c[0] === "getMessage"), "a message already stored is not fetched again");
  // the status names what is read, in plain terms, and never carries the token
  const st = connectionStatus(db, 1, { GOOGLE_GMAIL_CLIENT_ID: "x", GOOGLE_GMAIL_CLIENT_SECRET: "y" });
  assert.equal(st.connected, true);
  assert.deepEqual(st.reads.companies, ["Northwind"]);
  assert.ok(!JSON.stringify(st).includes(REFRESH));
});

test("D112 · d112GmailSamePathAsForwarded — a Gmail message is filed, matched, moved and code-read exactly like a forwarded copy", async () => {
  const mail = { from: "Northwind Talent <talent@northwind.example>", subject: "Interview for Backend Engineer",
    html: "<p>Hi Dana,</p><p>We'd like to <b>schedule an interview</b> for the Backend Engineer role.</p>" };
  // forwarded
  const f = freshDb();
  const fwd = ingestMessage(f.db, { providerId: "p1", to: [addressFor(f.db, 1).address], ...mail });
  // read through Gmail
  const g = freshDb();
  saveConnection(g.db, BOX, 1, { refreshToken: REFRESH });
  const res = await pollUser(g.db, { box: BOX, client: fakeClient([gmailMsg("g1", { ...mail, text: null })]), userId: 1 });
  assert.equal(res.stored, 1);
  const row = (db) => db.prepare("SELECT category, rule, body_text, application_id, from_domain, subject FROM inbox_messages WHERE user_id=1").get();
  assert.deepEqual(row(g.db), row(f.db), "the same category, rule, text, match");
  assert.equal(fwd.category, "interview");
  assert.equal(row(g.db).application_id, g.northwind);
  assert.equal(g.db.prepare("SELECT response_outcome FROM job_applications WHERE job_id='gh::nw'").pluck().get(),
    f.db.prepare("SELECT response_outcome FROM job_applications WHERE job_id='gh::nw'").pluck().get(), "the row on The Table moved the same way");
  assert.equal(g.db.prepare("SELECT source FROM inbox_messages").pluck().get(), "gmail");
  assert.equal(f.db.prepare("SELECT source FROM inbox_messages").pluck().get(), "forward");
  // 20k cap and HTML stripped, by the same bodyText
  const big = freshDb();
  saveConnection(big.db, BOX, 1, { refreshToken: REFRESH });
  await pollUser(big.db, { box: BOX, client: fakeClient([gmailMsg("g2", { from: "no-reply@greenhouse.io", subject: "Application received", html: `<div>${"word ".repeat(10_000)}</div><script>x()</script>` })]), userId: 1 });
  const body = big.db.prepare("SELECT body_text FROM inbox_messages").pluck().get();
  assert.ok(body.length <= 20_000 && !/<|x\(\)/.test(body));
  // D103 P5: an opted-in portal's code, read from a Gmail-delivered Verification, the same as a forwarded one
  const v = freshDb();
  saveConnection(v.db, BOX, 1, { refreshToken: REFRESH });
  await pollUser(v.db, { box: BOX, client: fakeClient([gmailMsg("g3", { from: "Amazon Jobs <no-reply@amazon.jobs>", subject: "Your verification code", text: "Your verification code is 482913." })]), userId: 1 });
  const since = Math.floor(Date.now() / 1000) - 60;
  assert.deepEqual(codeForWorker(v.db, { userId: 1, portalFamily: "amazon", originHost: "www.amazon.jobs", sinceSec: since }), { refused: "not_opted_in" });
  setCodeOptIn(v.db, 1, "amazon", true);
  assert.deepEqual(codeForWorker(v.db, { userId: 1, portalFamily: "amazon", originHost: "www.amazon.jobs", sinceSec: since }), { code: "482913" });
  // one path in the source: the poll calls ingestForUser, and ingestMessage hands off to it
  const svc = fs.readFileSync("services/gmail.js", "utf8");
  assert.match(svc, /ingestForUser\(db, \{ userId, source: "gmail"/);
  const inbox = fs.readFileSync("services/inbox.js", "utf8");
  assert.match(inbox.slice(at(inbox, "export function ingestMessage"), at(inbox, "export function ingestForUser")), /return ingestForUser\(db, \{ userId: addr\.user_id/);
});

test("D112 · d112DisconnectRevokes — Disconnect revokes the sealed token at Google and intake stops", async () => {
  const { db } = freshDb();
  saveConnection(db, BOX, 1, { refreshToken: REFRESH });
  const stored = db.prepare("SELECT * FROM gmail_connections WHERE user_id=1").get();
  assert.ok(!JSON.stringify(stored).includes(REFRESH), "the refresh token is sealed, never stored plain");
  const client = fakeClient([gmailMsg("m1", { from: "no-reply@greenhouse.io", subject: "Application received", text: "Thanks." })]);
  assert.deepEqual(await disconnect(db, { box: BOX, client, userId: 1 }), { revoked: true, connected: false });
  assert.deepEqual(client.calls.find(c => c[0] === "revoke"), ["revoke", REFRESH], "the token Google issued is the one revoked");
  assert.equal(db.prepare("SELECT COUNT(*) FROM gmail_connections").pluck().get(), 0);
  client.calls.length = 0;
  assert.deepEqual(await pollAll(db, { box: BOX, client }), { users: 0, stored: 0 });
  assert.equal(client.calls.length, 0, "no call to Google after Disconnect");
  // a revoke Google refuses still stops intake
  saveConnection(db, BOX, 1, { refreshToken: REFRESH });
  const refusing = { ...fakeClient(), revoke: async () => { throw Object.assign(new Error("400"), { code: "invalid_token" }); } };
  assert.deepEqual(await disconnect(db, { box: BOX, client: refusing, userId: 1, log: { warn() {} } }), { revoked: false, connected: false });
  assert.equal(db.prepare("SELECT COUNT(*) FROM gmail_connections").pluck().get(), 0);
  // the real client POSTs token=… to Google's revoke endpoint
  const seen = [];
  const real = createGoogleGmailClient({ env: {}, fetchImpl: async (url, init) => { seen.push([url, init.method, init.body]); return new Response("", { status: 200 }); } });
  await real.revoke(REFRESH);
  assert.deepEqual(seen[0], [GOOGLE_ENDPOINTS.revoke, "POST", `token=${encodeURIComponent(REFRESH)}`]);
  assert.equal(GOOGLE_ENDPOINTS.revoke, "https://oauth2.googleapis.com/revoke");
  // an expired grant (Testing mode's seven days) stops polling and asks for a reconnect
  saveConnection(db, BOX, 1, { refreshToken: REFRESH });
  assert.deepEqual(await pollUser(db, { box: BOX, client: fakeClient([], { refreshError: "invalid_grant" }), userId: 1 }), { refused: "expired" });
  assert.equal(connectionStatus(db, 1, {}).status, "expired");
  // deleting the account revokes first (server.js wires beforeDelete; the route calls it before deleteAccount)
  const acct = fs.readFileSync("routes/accountManagement.js", "utf8");
  const del = acct.slice(at(acct, 'router.post("/api/account/delete"'), at(acct, "return router;"));
  assert.ok(del.indexOf("await beforeDelete(req.user.id)") > 0 && del.indexOf("await beforeDelete(req.user.id)") < del.indexOf("deleteAccount(db"));
  assert.match(fs.readFileSync("server.js", "utf8"), /beforeDelete: \(userId\) => disconnectGmail\(db, \{ box: SECRET_BOX, client: GMAIL_CLIENT, userId \}\)/);
});

test("D112 · d112NoAttachmentsNoFullMailbox — attachments are never decoded or fetched; mail outside the terms is never stored", async () => {
  const { db } = freshDb();
  const m = gmailMsg("a1", { from: "no-reply@greenhouse.io", subject: "Application received", text: "Thanks for applying to Northwind.", attachments: [
    { partId: "2", mimeType: "application/pdf", filename: "offer.pdf", body: { size: 90_000, attachmentId: "ANGjdJ8-big" } },
    { partId: "3", mimeType: "text/plain", filename: "notes.txt", body: { size: 20, data: b64("SECRET ATTACHMENT TEXT") } },
  ] });
  const x = extractMessage(m);
  assert.equal(x.attachmentsSkipped, 2);
  assert.ok(!/SECRET ATTACHMENT/.test(`${x.text} ${x.html}`), "an inline attachment's text is not read either");
  saveConnection(db, BOX, 1, { refreshToken: REFRESH });
  // Gmail (the fake) returns mail the query would never match — the second check keeps it out.
  const client = fakeClient([m,
    gmailMsg("p1", { from: "Mum <mum@family.example>", subject: "Dinner on Sunday?", text: "Bring the Northwind cake." }),
    gmailMsg("p2", { from: "bank@bank.example", subject: "Your statement", text: "Balance." })]);
  const r = await pollUser(db, { box: BOX, client, userId: 1 });
  assert.deepEqual([r.stored, r.outOfScope], [1, 2]);
  assert.deepEqual(db.prepare("SELECT subject FROM inbox_messages").pluck().all(), ["Application received"]);
  assert.ok(!db.prepare("SELECT body_text FROM inbox_messages").pluck().get().includes("SECRET"));
  assert.deepEqual([...new Set(client.calls.map(c => c[0]))].sort(), ["getMessage", "listMessages", "refreshAccess"], "no other Google call");
  const t = scopeTerms(db, 1);
  assert.equal(messageInScope({ from: "x@hire.lever.co", subject: "Hi" }, t), true);
  assert.equal(messageInScope({ from: "pat@contoso-fan.example", subject: "Contoso update" }, t), true);
  assert.equal(messageInScope({ from: "pat@friends.example", subject: "Weekend" }, t), false);
  // in the source: one scope, gmail.readonly; format=full (no raw); the attachments endpoint is never named
  const svc = fs.readFileSync("services/gmail.js", "utf8").replace(/^\s*\/\/.*$/gm, "");
  assert.equal(GMAIL_SCOPE, "https://www.googleapis.com/auth/gmail.readonly");
  assert.ok(!/\/attachments|format=raw|gmail\.modify|mail\.google\.com\/|gmail\.send/.test(svc));
  assert.ok(!/anthropic|claude|openai|modelCall/i.test(svc), "D17: no model reads this mail");
  const url = new URL(createGoogleGmailClient({ env: { GOOGLE_GMAIL_CLIENT_ID: "cid" } }).authUrl({ state: "s", redirectUri: "https://jobsviadraft.com/api/gmail/callback" }));
  assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.deepEqual([url.searchParams.get("scope"), url.searchParams.get("access_type"), url.searchParams.get("prompt")], [GMAIL_SCOPE, "offline", "consent"]);
});

test("D112 · the connect doors — offered only when configured; the state binds the callback; an unticked scope keeps nothing", async () => {
  const { db } = freshDb();
  const session = {};
  const env = { GOOGLE_GMAIL_CLIENT_ID: "cid", GOOGLE_GMAIL_CLIENT_SECRET: "sec" };
  const client = fakeClient([]);
  const mk = (e) => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.session = session; req.user = { id: 1 }; next(); });
    gmailRoutes(app, db, (req, _res, next) => next(), { box: BOX, env: e, client, originFor: () => "https://jobsviadraft.com", log: { warn() {}, log() {} } });
    return app.listen(0);
  };
  const off = mk({});
  try {
    const base = `http://127.0.0.1:${off.address().port}`;
    assert.equal((await (await fetch(`${base}/api/gmail/status`)).json()).available, false);
    assert.equal((await fetch(`${base}/api/gmail/connect`, { redirect: "manual" })).status, 404);
  } finally { off.close(); }
  const on = mk(env);
  try {
    const base = `http://127.0.0.1:${on.address().port}`;
    const st = await (await fetch(`${base}/api/gmail/status`)).json();
    assert.deepEqual([st.available, st.connected, st.testingMode], [true, false, true]);
    const go = await fetch(`${base}/api/gmail/connect`, { redirect: "manual" });
    assert.equal(go.status, 302);
    const [, state, redirectUri] = client.calls.find(c => c[0] === "authUrl");
    assert.equal(redirectUri, "https://jobsviadraft.com/api/gmail/callback");
    const bad = await fetch(`${base}/api/gmail/callback?state=forged&code=c`, { redirect: "manual" });
    assert.match(bad.headers.get("location"), /gmail=expired/);
    assert.equal(db.prepare("SELECT COUNT(*) FROM gmail_connections").pluck().get(), 0, "a forged state connects nothing");
    session.gmailOAuth = { state, userId: 1, createdAt: Date.now() };
    const ok = await fetch(`${base}/api/gmail/callback?state=${state}&code=c1`, { redirect: "manual" });
    assert.equal(ok.headers.get("location"), "/app/database?sheet=inbox&gmail=connected");
    assert.equal(db.prepare("SELECT google_email FROM gmail_connections WHERE user_id=1").pluck().get(), "dana@personal.example");
    // a consent with the Gmail box unticked: nothing stored, the token handed back
    db.prepare("DELETE FROM gmail_connections").run();
    client.exchangeCode = async () => ({ access_token: "ya29.c", refresh_token: "r", scope: "openid" });
    session.gmailOAuth = { state: "s2", userId: 1, createdAt: Date.now() };
    const un = await fetch(`${base}/api/gmail/callback?state=s2&code=c2`, { redirect: "manual" });
    assert.match(un.headers.get("location"), /gmail=scope_not_granted/);
    assert.equal(db.prepare("SELECT COUNT(*) FROM gmail_connections").pluck().get(), 0);
    assert.deepEqual(client.calls.filter(c => c[0] === "revoke").pop(), ["revoke", "ya29.c"]);
  } finally { on.close(); }
  // The Table: Connect beside the forwarding address, what is read stated, the weekly note, Disconnect
  const ui = fs.readFileSync("client/src/components/ApplicationInbox.jsx", "utf8");
  const g = ui.slice(at(ui, "function GmailConnection"), at(ui, "const when = (sec) =>"));
  assert.match(g, /if \(!g \|\| !g\.available\) return null;/, "not offered unless the owner set the client");
  assert.match(g, /href=\{`\/api\/gmail\/connect\?\$\{authContextQuery\(\)\}`\}/);
  assert.match(g, /Nothing else in your mailbox is read, attachments are never opened/);
  assert.match(g, /g\.testingMode && /);
  assert.match(g, /reconnect once a week/);
  assert.match(g, /api\("\/api\/gmail\/disconnect", \{ method: "POST" \}\)/);
  assert.match(ui, /<GmailConnection theme=\{theme\} onChange=\{load\} \/>/);
  assert.doesNotMatch(g, /999px|rounded-full|borderRadius: "50%"/, "D60: no pills");
});

test("D112 · account paths — gmail_connections merges (keepInto), exports without its sealed token, cascades on delete", async () => {
  const { MERGE_PLAN, exportAccount, deleteAccount } = await import("../services/accountService.js");
  assert.equal(MERGE_PLAN.gmail_connections, "keepInto");
  const { db } = freshDb();
  saveConnection(db, BOX, 1, { refreshToken: REFRESH, email: "dana@personal.example" });
  const out = exportAccount(db, 1);
  assert.equal(out.data.gmail_connections[0].google_email, "dana@personal.example");
  assert.ok(!("secret_enc" in out.data.gmail_connections[0]) && !("iv" in out.data.gmail_connections[0]) && !("auth_tag" in out.data.gmail_connections[0]));
  db.pragma("foreign_keys = ON");
  deleteAccount(db, 1);
  assert.equal(db.prepare("SELECT COUNT(*) FROM gmail_connections").pluck().get(), 0);
});
