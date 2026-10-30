import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";
import crypto from "node:crypto";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import inboxRoutes, { createInboundHookRouter } from "../routes/inbox.js";
import {
  categorise, codeOf, bodyText, addressFor, revokeAddress, ingestMessage, refile, codeForWorker, setCodeOptIn, gmailFilterXml,
  ruleCorrections, CATEGORIES,
} from "../services/inbox.js";
import { jobDetail } from "../services/pipelineWorkspace.js";

// ⭐ D103 (owner 10-30) · the inbox: a forwarded copy of the replies, sorted by rule, matched to the application.
// Synthetic people, companies and mail; the 10-30 confirmation's SHAPE (send.applicantemails.com) as a fixture.

const SECRET = "whsec_" + Buffer.from("a".repeat(32)).toString("base64");
function signed(body, ts = Math.floor(Date.now() / 1000)) {
  const key = Buffer.from(SECRET.replace(/^whsec_/, ""), "base64");
  const id = `msg_${crypto.randomBytes(4).toString("hex")}`;
  const sig = crypto.createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64");
  return { "svix-id": id, "svix-timestamp": String(ts), "svix-signature": `v1,${sig}` };
}

function freshDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'dana','x'), (2,'eli','x')").run();
  // A submitted application to Northwind (with a job_applications row), one to Contoso.
  const app = (userId, job, company, title, domain = null) => {
    db.prepare("INSERT INTO application_records (user_id, job_id, state, origin, submitted_at) VALUES (?,?,'verified','drafted',unixepoch()-86400)").run(userId, job);
    db.prepare("INSERT INTO job_applications (user_id, job_id, company, role, company_domain) VALUES (?,?,?,?,?)").run(userId, job, company, title, domain);
    return db.prepare("SELECT id FROM application_records WHERE user_id=? AND job_id=?").pluck().get(userId, job);
  };
  return { db, northwind: app(1, "gh::nw", "Northwind", "Backend Engineer", "northwind.example"), contoso: app(1, "lv::ct", "Contoso", "Data Engineer") };
}

test("D103 · d103Categories — every one of the nine, by rule (the 10-30 confirmation's shape included)", () => {
  const c = (subject, body = "", fromDomain = "mail.example") => categorise({ subject, body, fromDomain }).category;
  assert.equal(c("Thank you for applying to Northwind", "We have received your application for Backend Engineer.", "send.applicantemails.com"), "applied");
  assert.equal(c("Your verification code", "Your verification code is 482913."), "verification");
  assert.equal(c("Interview with Northwind", "We'd love to schedule some time for an interview."), "interview");
  assert.equal(c("Next step: coding challenge", "Please complete the HackerRank assessment within 7 days.", "hackerrank.com"), "assessment");
  assert.equal(c("Hello from Northwind", "I'm a recruiter on the platform team and came across your profile."), "recruiter");
  assert.equal(c("Reminder: complete your application"), "reminder");
  assert.equal(c("Your offer from Northwind", "We are pleased to extend an offer of employment."), "offer");
  assert.equal(c("Your application to Northwind", "Unfortunately, we have decided to move forward with other candidates."), "rejection");
  assert.equal(c("Lunch on Friday?", "See you there."), "other");
  assert.deepEqual(CATEGORIES, ["applied", "verification", "interview", "assessment", "recruiter", "reminder", "offer", "rejection", "other"]);
});

test("D103 · d103RulesNoModel — the inbox's code reads no model and no model key", () => {
  for (const f of ["services/inbox.js", "routes/inbox.js"]) {
    const src = fs.readFileSync(f, "utf8").replace(/^\s*\/\/.*$/gm, "");
    assert.doesNotMatch(src, /anthropic|modelCall|claude|ANTHROPIC|openai/i, f);
  }
});

test("D103 · d103HtmlStripped — HTML becomes text, capped; a code is read from a Verification", () => {
  const t = bodyText({ html: "<html><body><p>Hi <b>Dana</b>,</p><script>evil()</script><p>Your code is <span>739204</span>.</p></body></html>" });
  assert.doesNotMatch(t, /<|evil\(\)/);
  assert.match(t, /Hi Dana/);
  assert.equal(codeOf({ subject: "Verify your email", body: t }), "739204");
  assert.ok(bodyText({ text: "x".repeat(50_000) }).length <= 20_000);
});

test("D103 · d103MatchesApplication + d103InterviewMovesStatus — matched by company, and an Interview moves the row on The Table", () => {
  const { db, northwind, contoso } = freshDb();
  const { address } = addressFor(db, 1);
  const r = ingestMessage(db, { providerId: "p1", to: [address], from: "Talent <careers@northwind.example>", subject: "Interview for Backend Engineer",
    text: "We'd like to schedule an interview." });
  assert.deepEqual([r.stored, r.category, r.applicationId, r.advanced], [true, "interview", northwind, true]);
  assert.equal(jobDetail(db, 1, northwind).status, "interview");
  assert.equal(jobDetail(db, 1, northwind).emails[0].category, "interview");
  // the ATS's own sender with the company named in the subject; never moves an offer back
  const r2 = ingestMessage(db, { providerId: "p2", to: [address], from: "no-reply@send.applicantemails.com",
    subject: "Thank you for applying to Contoso", text: "We have received your application for Data Engineer." });
  assert.deepEqual([r2.category, r2.applicationId], ["applied", contoso]);
  assert.equal(jobDetail(db, 1, contoso).checklist.find(s => s.step === "confirmation_email").state, "done");
  ingestMessage(db, { providerId: "p3", to: [address], from: "hr@northwind.example", subject: "Your offer", text: "We are pleased to extend an offer." });
  ingestMessage(db, { providerId: "p4", to: [address], from: "hr@northwind.example", subject: "Interview follow-up", text: "Another interview round." });
  assert.equal(jobDetail(db, 1, northwind).status, "offer", "never backwards");
  // no match → Other's attach path; a duplicate delivery is stored once
  assert.equal(ingestMessage(db, { providerId: "p5", to: [address], from: "x@unknown.example", subject: "Hello", text: "Hi" }).applicationId, null);
  assert.equal(ingestMessage(db, { providerId: "p5", to: [address], from: "x@unknown.example", subject: "Hello", text: "Hi" }).reason, "duplicate");
});

test("D103 · d103RevokeStopsIntake — a revoked address stores nothing; another user's mail never lands here", () => {
  const { db } = freshDb();
  const { address } = addressFor(db, 1);
  assert.equal(revokeAddress(db, 1), true);
  assert.equal(ingestMessage(db, { to: [address], from: "a@b.example", subject: "x", text: "y" }).reason, "address_revoked");
  assert.notEqual(addressFor(db, 1).address, address, "a new address, never the old one again");
  assert.equal(ingestMessage(db, { to: ["someone@gmail.com"], subject: "x" }).reason, "not_our_address");
  assert.equal(db.prepare("SELECT COUNT(*) FROM inbox_messages").pluck().get(), 0);
});

test("D103 · re-filing is one press, counted against the rule that filed it", () => {
  const { db } = freshDb();
  const { address } = addressFor(db, 1);
  const r = ingestMessage(db, { providerId: "q1", to: [address], from: "a@b.example", subject: "Reminder: your interview tomorrow", text: "See you." });
  assert.equal(r.category, "interview");
  assert.deepEqual(refile(db, 1, r.id, "reminder"), { id: r.id, category: "reminder" });
  assert.deepEqual(ruleCorrections(db), [{ rule: "interview.phrase", fromCategory: "interview", toCategory: "reminder", n: 1 }]);
  assert.throws(() => refile(db, 1, r.id, "spam"), /category is one of/);
  assert.equal(refile(db, 2, r.id, "other"), null, "another user's message");
});

test("D103 · d103WorkerReadsOnlyOptedPortalCode — the code only for an opted-in portal, from its own host, within 10 minutes, logged", () => {
  const { db } = freshDb();
  const { address } = addressFor(db, 1);
  const nowSec = Math.floor(Date.now() / 1000);
  ingestMessage(db, { providerId: "c1", to: [address], from: "no-reply@account.amazon.jobs", subject: "Your verification code", text: "Your verification code is 551203." });
  ingestMessage(db, { providerId: "c2", to: [address], from: "no-reply@other.example", subject: "Your verification code", text: "Your verification code is 999999." });
  const ask = () => codeForWorker(db, { userId: 1, portalFamily: "amazon", originHost: "amazon.jobs", sinceSec: nowSec - 60, remoteRunId: 7 });
  assert.deepEqual(ask(), { refused: "not_opted_in" });
  setCodeOptIn(db, 1, "amazon", true);
  assert.deepEqual(ask(), { code: "551203" }, "the portal's own host — not another sender's code");
  assert.deepEqual(db.prepare("SELECT portal_family, remote_run_id FROM inbox_code_uses").all(), [{ portal_family: "amazon", remote_run_id: 7 }]);
  assert.deepEqual(codeForWorker(db, { userId: 1, portalFamily: "amazon", originHost: "amazon.jobs", sinceSec: nowSec - 60, nowSec: nowSec + 900 }), { code: null }, "older than 10 minutes");
  setCodeOptIn(db, 1, "amazon", false);
  assert.deepEqual(ask(), { refused: "not_opted_in" });
});

test("D103 · d103SignatureRequired — the inbound hook is off without its secret, refuses a bad signature, stores a signed delivery", async () => {
  const { db } = freshDb();
  const { address } = addressFor(db, 1);
  const mount = (env) => {
    const app = express();
    app.use(createInboundHookRouter(db, { env, fetchBody: async () => ({ text: "We have received your application.", html: null }), log: {} }));
    app.use(express.json());
    app.use((req, _r, n) => { req.user = { id: 1 }; n(); });
    inboxRoutes(app, db, (_q, _r, n) => n());
    const server = app.listen(0);
    return { base: `http://127.0.0.1:${server.address().port}`, stop: () => server.close() };
  };
  const body = JSON.stringify({ type: "email.received", data: { email_id: "re_1", to: [address], from: "no-reply@send.applicantemails.com",
    subject: "Thank you for applying to Northwind", created_at: new Date().toISOString() } });
  const off = mount({});
  try { assert.equal((await fetch(off.base + "/api/hooks/inbound", { method: "POST", body, headers: signed(body) })).status, 503); } finally { off.stop(); }
  const t = mount({ RESEND_INBOUND_SECRET: SECRET });
  try {
    const bad = await fetch(t.base + "/api/hooks/inbound", { method: "POST", body, headers: { ...signed(body), "svix-signature": "v1,AAAA" } });
    assert.equal(bad.status, 401);
    assert.equal(db.prepare("SELECT COUNT(*) FROM inbox_messages").pluck().get(), 0);
    const ok = await (await fetch(t.base + "/api/hooks/inbound", { method: "POST", body, headers: signed(body) })).json();
    assert.equal(ok.stored, true);
    const list = await (await fetch(t.base + "/api/inbox?category=applied")).json();
    assert.equal(list.messages.length, 1);
    assert.match(list.messages[0].preview, /received your application/, "the body was fetched by id");
    const xml = await (await fetch(t.base + "/api/inbox/gmail-filter.xml")).text();
    assert.match(xml, new RegExp(address.replace(/\./g, "\\.")));
    assert.match(gmailFilterXml("x@in.jobsviadraft.com"), /forwardTo/);
  } finally { t.stop(); }
});

test("D103 P5 · the worker's code door: only for the run it holds, only for an opted-in portal", async () => {
  const { createApplyWorkerRouter } = await import("../routes/applyWorker.js");
  const { enqueueRemoteRun, requestAccount } = await import("../services/applyWorker.js");
  const { db } = freshDb();
  const TOKEN = "w".repeat(40);
  requestAccount(db, 1, { portalFamily: "amazon", originHost: "amazon.jobs", consent: true });
  const run = db.prepare("INSERT INTO apply_runs (user_id,mode,status,total_jobs,approval_mode) VALUES (1,'auto','completed',1,'required')").run().lastInsertRowid;
  const rj = Number(db.prepare("INSERT INTO apply_run_jobs (run_id,user_id,job_id,status) VALUES (?,1,'az::1','held_gate')").run(run).lastInsertRowid);
  const pk = Number(db.prepare(`INSERT INTO apply_gate_packets (user_id, run_id, run_job_id, job_id, apply_url, expected_origin, gate_reason, answers_json, token_hash, expires_at)
    VALUES (1,?,?,'az::1','https://www.amazon.jobs/apply/1','https://www.amazon.jobs','login_required','{"answers":[]}','hz',0)`).run(run, rj).lastInsertRowid);
  const remoteId = enqueueRemoteRun(db, { userId: 1, runJobId: rj, packetId: pk, applyUrl: "https://www.amazon.jobs/apply/1", approvalMode: "required" });
  const app = express();
  app.use("/api/worker", createApplyWorkerRouter(db, { env: { APPLY_WORKER_TOKEN: TOKEN } }));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const h = { authorization: `Bearer ${TOKEN}`, "x-worker-id": "w1" };
  try {
    assert.equal((await fetch(`${base}/api/worker/code/${remoteId}`, { headers: h })).status, 404, "not leased yet");
    assert.equal((await fetch(`${base}/api/worker/lease`, { headers: h })).status, 200);
    const { address } = addressFor(db, 1);
    ingestMessage(db, { providerId: "z1", to: [address], from: "no-reply@account.amazon.jobs", subject: "Verify your email", text: "Your verification code is 551203." });
    assert.equal((await fetch(`${base}/api/worker/code/${remoteId}`, { headers: h })).status, 403, "not opted in");
    setCodeOptIn(db, 1, "amazon", true);
    assert.deepEqual(await (await fetch(`${base}/api/worker/code/${remoteId}`, { headers: h })).json(), { code: "551203" });
    assert.equal((await fetch(`${base}/api/worker/code/${remoteId}`, { headers: { ...h, "x-worker-id": "other" } })).status, 404, "another worker");
  } finally { server.close(); }
});

// ⭐ D112 item 3 (owner 10-30) CHANGED THIS ON PURPOSE: unset used to mean "no sweep"; it now means the policy's 180
// days. "0" keeps the explicit no-sweep meaning; nonsense falls back to 180 (toward the promise, not away from it).
test("D103 P1 · deletion: one message or all, only the user's own; the retention sweep defaults to 180 days", async () => {
  const { deleteMessages, sweepInbox } = await import("../services/inbox.js");
  const { db } = freshDb();
  const { address } = addressFor(db, 1);
  const nowSec = Math.floor(Date.now() / 1000);
  ingestMessage(db, { providerId: "d1", to: [address], from: "a@b.example", subject: "Hello", text: "x", receivedAt: nowSec - 400 * 86400 });
  ingestMessage(db, { providerId: "d2", to: [address], from: "a@b.example", subject: "Hello", text: "y" });
  const [old, fresh] = db.prepare("SELECT id FROM inbox_messages ORDER BY received_at").pluck().all();
  assert.equal(deleteMessages(db, 2, fresh), 0, "another user's message is not theirs to delete");
  assert.equal(sweepInbox(db, "0"), 0, "an explicit 0 is the documented no-sweep");
  assert.equal(sweepInbox(db, "500"), 0, "an override longer than the message's age keeps it");
  assert.equal(sweepInbox(db, undefined), 1, "unset → the policy's 180 days, and a 400-day-old message goes");
  assert.deepEqual(db.prepare("SELECT id FROM inbox_messages").pluck().all(), [fresh]);
  assert.ok(old);
  assert.equal(deleteMessages(db, 1, null), 1);
  assert.equal(db.prepare("SELECT COUNT(*) FROM inbox_messages").pluck().get(), 0);
});

test("⭐ D112 · the 180-day sweep: a 181-day-old message is removed, a 179-day-old one kept; server.js runs it unset, at boot and daily", async () => {
  const { sweepInbox, inboxRetentionDays, INBOX_RETENTION_DEFAULT_DAYS } = await import("../services/inbox.js");
  assert.equal(INBOX_RETENTION_DEFAULT_DAYS, 180);
  assert.equal(inboxRetentionDays(undefined), 180);
  assert.equal(inboxRetentionDays(""), 180);
  assert.equal(inboxRetentionDays("90"), 90, "the env can still override");
  assert.equal(inboxRetentionDays("0"), null, "0 = the explicit no-sweep");
  for (const bad of ["-5", "1.5", "abc"]) assert.equal(inboxRetentionDays(bad), 180, `${bad} fails toward the promise`);
  const { db } = freshDb();
  const { address } = addressFor(db, 1);
  const nowSec = Math.floor(Date.now() / 1000);
  ingestMessage(db, { providerId: "s181", to: [address], from: "a@b.example", subject: "Old", text: "x", receivedAt: nowSec - 181 * 86400 });
  ingestMessage(db, { providerId: "s179", to: [address], from: "a@b.example", subject: "Recent", text: "y", receivedAt: nowSec - 179 * 86400 });
  assert.equal(sweepInbox(db, undefined, nowSec), 1, "only the 181-day-old message goes");
  assert.deepEqual(db.prepare("SELECT subject FROM inbox_messages").pluck().all(), ["Recent"]);
  // the wiring: no "only when set" guard, a boot run and a daily run of the same sweep
  const server = fs.readFileSync("server.js", "utf8").replace(/\r\n/g, "\n");
  const s = server.slice(at(server, "const sweepInboxNow = () =>", 0, "server.js"));
  assert.match(s, /^const sweepInboxNow = \(\) => \{ try \{ const n = sweepInbox\(db, process\.env\.INBOX_RETENTION_DAYS\);/);
  assert.match(s, /setTimeout\(sweepInboxNow, 60 \* 1000\)\.unref\(\);\nsetInterval\(sweepInboxNow, 24 \* 3600 \* 1000\)\.unref\(\);/);
});

// The route's id check read /^d+$/ (its backslash lost when written), so every real DELETE /api/inbox/:id was a 400.
test("D103 P1 · DELETE /api/inbox/:id deletes the user's own message by its numeric id", async () => {
  const { db } = freshDb();
  const { address } = addressFor(db, 1);
  ingestMessage(db, { providerId: "r1", to: [address], from: "a@b.example", subject: "Hello", text: "x" });
  const id = db.prepare("SELECT id FROM inbox_messages").pluck().get();
  const app = express();
  app.use(express.json());
  app.use((req, _r, n) => { req.user = { id: 1 }; n(); });
  inboxRoutes(app, db, (_q, _r, n) => n());
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(`${base}/api/inbox/abc`, { method: "DELETE" })).status, 400);
    const r = await fetch(`${base}/api/inbox/${id}`, { method: "DELETE" });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { deleted: 1 });
    assert.equal((await fetch(`${base}/api/inbox/${id}`, { method: "DELETE" })).status, 404);
  } finally { server.close(); }
});

// D103 UI · The Table's Inbox tab: the address is offered only when intake is on, and only on the user's press.
test("D103 UI · The Table's Inbox — gated on intake, asks before making an address, re-file and delete reach the server", () => {
  const ui = fs.readFileSync("client/src/components/ApplicationInbox.jsx", "utf8");
  const panel = fs.readFileSync("client/src/panels/DatabasePanel.jsx", "utf8");
  const route = fs.readFileSync("routes/inbox.js", "utf8");
  assert.match(route, /intake: !!process\.env\.RESEND_INBOUND_SECRET/);
  assert.match(panel, /\["inbox","Inbox"\]/);
  assert.match(panel, /activeSheet === "inbox" && <ApplicationInbox theme=\{theme\}\/>/);
  assert.match(ui, /!data\.intake \?/, "no address is offered while mail cannot arrive");
  const load = ui.slice(at(ui, "const load = useCallback"), at(ui, "useEffect(() => { load(); }"));
  assert.doesNotMatch(load, /\/api\/inbox\/address/, "loading the tab must not make an address");
  assert.match(ui, /api\(`\/api\/inbox\/\$\{m\.id\}\/category`, \{ method: "POST"/);
  assert.match(ui, /api\(`\/api\/inbox\/\$\{m\.id\}`, \{ method: "DELETE" \}\)/);
  assert.match(ui, /draft never connects to your mailbox/);
});
