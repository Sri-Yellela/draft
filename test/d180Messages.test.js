// ⭐ D180 P2 (45o) · MESSAGES — the spec's named tests P2 carries: d180StrangersLandInRequests (messages), d180BlockStopsEverything
// (messages), d180ReportReachesQueue, d180NoAiReadsMessagesUnasked, d180SendJobCardRenders, d180DeleteRemovesContent,
// d180HomeInboxNeverMixed — plus: sealed at rest, one message until accepted, the daily cap. Synthetic people only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { setVisibility } from "../services/profilePage.js";
import { createSecretBox } from "../services/secretBox.js";
import { requestConnection, respond, block } from "../services/network/connections.js";
import { sendMessage, myThreads, readThread, answerRequest, hideMessage, report, reportQueue, resolveReport, NEW_REQUEST_THREADS_PER_DAY }
  from "../services/network/messages.js";

const box = createSecretBox(crypto.randomBytes(32));
function freshDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  for (const m of MIGRATIONS) db.exec(m.sql);
  const ins = db.prepare("INSERT INTO users (id, username, password_hash) VALUES (?, ?, 'x')");
  [[1, "ada"], [2, "ben"], [3, "cy"], [4, "di"]].forEach(r => ins.run(...r));
  const h = db.prepare("INSERT INTO proof_pages (user_id, handle, enabled) VALUES (?, ?, 0)");
  [[1, "ada-example"], [2, "ben-example"], [3, "cy-example"], [4, "di-example"]].forEach(r => h.run(...r));
  for (const id of [1, 2, 3]) setVisibility(db, id, { page: "public" });   // 4 stays private
  db.exec(`INSERT INTO scraped_jobs (id, job_id, search_query, _hash, title, company, location, is_active, board_category) VALUES (77, 'gh::77', 'test', 'h77', 'Data Engineer', 'Northwind', 'Boston', 1, 'software-engineering')`);
  return db;
}
const connect = (db, a, aH, b, bH) => { requestConnection(db, a, bH); respond(db, b, aH, true); };

test("d180StrangersLandInRequests (messages) · a stranger's first message is a request; one message until accepted; a private page can't be written to", () => {
  const db = freshDb();
  const r = sendMessage(db, box, 1, { to: "ben-example", text: "Hi — saw your talk." });
  assert.equal(r.status, "request");
  assert.equal(myThreads(db, box, 2).requests.length, 1, "it lands in Ben's Requests");
  assert.equal(myThreads(db, box, 2).threads.length, 0, "not his inbox");
  assert.equal(myThreads(db, box, 1).sent.length, 1);
  assert.throws(() => sendMessage(db, box, 1, { to: "ben-example", text: "again" }), (e) => e.code === "wait_for_accept");
  assert.throws(() => sendMessage(db, box, 2, { to: "ada-example", text: "reply" }), (e) => e.code === "accept_first");
  answerRequest(db, 2, r.threadId, true);
  assert.equal(sendMessage(db, box, 2, { to: "ada-example", text: "Thanks!" }).status, "open");
  assert.throws(() => sendMessage(db, box, 1, { to: "di-example", text: "hi" }), (e) => e.code === "no_such_person");
  connect(db, 1, "ada-example", 3, "cy-example");
  assert.equal(sendMessage(db, box, 1, { to: "cy-example", text: "hi" }).status, "open", "between connections it is a thread");
});

test("sealed at rest · the database holds only the sealed body; declining deletes the request", () => {
  const db = freshDb();
  const r = sendMessage(db, box, 1, { to: "ben-example", text: "the secret is kept" });
  const row = db.prepare("SELECT * FROM network_messages WHERE id = ?").get(r.messageId);
  assert.ok(row.body_enc && row.body_iv && row.body_tag);
  assert.ok(!JSON.stringify(row).includes("the secret is kept"));
  assert.equal(readThread(db, box, 2, r.threadId).messages[0].text, "the secret is kept");
  answerRequest(db, 2, r.threadId, false);
  assert.equal(db.prepare("SELECT COUNT(*) FROM network_messages").pluck().get(), 0, "declined: the thread and its message are gone");
});

test("the daily cap on new request threads", () => {
  const db = freshDb();
  const now = 1_800_000_000;
  for (let i = 0; i < NEW_REQUEST_THREADS_PER_DAY; i++) {
    db.prepare("INSERT INTO users (id, username, password_hash) VALUES (?, ?, 'x')").run(100 + i, `u${i}`);
    db.prepare("INSERT INTO network_threads (low_id, high_id, status, requester_id, created_at, last_at) VALUES (1, ?, 'request', 1, ?, ?)").run(100 + i, now - 60, now - 60);
  }
  assert.throws(() => sendMessage(db, box, 1, { to: "ben-example", text: "hi" }, { now }), (e) => e.code === "daily_cap");
});

test("d180BlockStopsEverything (messages) · a block refuses a send both ways and hides the thread", () => {
  const db = freshDb();
  connect(db, 1, "ada-example", 2, "ben-example");
  const r = sendMessage(db, box, 1, { to: "ben-example", text: "hello" });
  block(db, 2, "ada-example");
  assert.throws(() => sendMessage(db, box, 1, { to: "ben-example", text: "?" }), (e) => e.code === "blocked");
  assert.throws(() => sendMessage(db, box, 2, { to: "ada-example", text: "?" }), (e) => e.code === "blocked");
  assert.equal(myThreads(db, box, 1).threads.length, 0);
  assert.throws(() => readThread(db, box, 1, r.threadId), (e) => e.code === "no_such_thread");
});

test("d180SendJobCardRenders · a job arrives as a card of the open board; a closed job can't be sent", () => {
  const db = freshDb();
  connect(db, 1, "ada-example", 2, "ben-example");
  const r = sendMessage(db, box, 1, { to: "ben-example", jobId: 77, text: "This one looks like you" });
  const m = readThread(db, box, 2, r.threadId).messages[0];
  assert.equal(m.kind, "job");
  assert.deepEqual([m.job.title, m.job.company], ["Data Engineer", "Northwind"]);
  assert.match(m.job.path, /^\/jobs\/northwind-data-engineer-77$/);
  assert.equal(m.text, "This one looks like you");
  db.exec("UPDATE scraped_jobs SET is_active = 0 WHERE id = 77");
  assert.throws(() => sendMessage(db, box, 1, { to: "ben-example", jobId: 77 }), (e) => e.code === "no_such_job");
});

test("d180ReportReachesQueue · a report reaches the queue with a hash only; removing the message clears it for both", () => {
  const db = freshDb();
  const r = sendMessage(db, box, 1, { to: "ben-example", text: "buy cheap followers here" });
  assert.throws(() => report(db, 1, { kind: "message", id: r.messageId, reason: "spam" }), (e) => e.code === "no_such_message", "you can't report your own message");
  report(db, 2, { kind: "message", id: r.messageId, reason: "spam", details: "an ad" });
  const row = db.prepare("SELECT * FROM network_reports").get();
  assert.ok(/^[0-9a-f]{64}$/.test(row.reporter_hash) && !("reporter_id" in row), "only a hash of the reporter");
  const q = reportQueue(db, box);
  assert.equal(q.length, 1);
  assert.equal(q[0].target.text, "buy cheap followers here", "the moderator reads the reported message");
  resolveReport(db, q[0].id, { status: "actioned", note: "removed", removeMessage: true });
  assert.equal(readThread(db, box, 2, r.threadId).messages[0].removed, true);
  assert.equal(db.prepare("SELECT body_enc FROM network_messages WHERE id = ?").pluck().get(r.messageId), null, "the body is gone, not only hidden");
});

test("delete for me hides on my side only; d180DeleteRemovesContent · deleting an account removes its threads and messages", () => {
  const db = freshDb();
  connect(db, 1, "ada-example", 2, "ben-example");
  const r = sendMessage(db, box, 1, { to: "ben-example", text: "one" });
  hideMessage(db, 1, r.messageId);
  assert.equal(readThread(db, box, 1, r.threadId).messages.length, 0);
  assert.equal(readThread(db, box, 2, r.threadId).messages.length, 1, "still there for Ben");
  db.prepare("DELETE FROM users WHERE id = 1").run();
  assert.equal(db.prepare("SELECT COUNT(*) FROM network_threads").pluck().get(), 0);
  assert.equal(db.prepare("SELECT COUNT(*) FROM network_messages").pluck().get(), 0);
});

test("d180NoAiReadsMessagesUnasked · nothing in services/network calls a model; d180HomeInboxNeverMixed · Home's Inbox never reads these tables", () => {
  for (const f of fs.readdirSync("services/network")) {
    const src = fs.readFileSync(path.join("services/network", f), "utf8");
    assert.doesNotMatch(src, /modelGateway|callTask|anthropic|@anthropic-ai|toolsService|\/api\/tools/i, `${f} reaches no model`);
  }
  for (const f of ["routes/inbox.js", "services/inbox.js"].filter(f => fs.existsSync(f))) {
    assert.doesNotMatch(fs.readFileSync(f, "utf8"), /network_messages|network_threads/, `${f} never mixes people's messages into employer mail`);
  }
});
