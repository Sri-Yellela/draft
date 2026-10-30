// ⭐ D112 item 9 c2 (owner 10-30 night) — PENDING ROWS MOVE TO "NOT APPLIED" AFTER 14 DAYS, NEVER DELETED.
//
// O45c made every opened posting a Pending row, so Pending fills with postings nobody applied to. The owner's
// pick (c2): after 14 days a pending row MOVES to a Not applied list in The Table, each row shows "Moves in
// n days", Restore brings one back with its 14 days restarting, and a moved row keeps its record and the
// posting it pins (D43). Not applied is its own state, not 'withdrawn' — see services/applicationRecords.js.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import applicationRecordRoutes from "../routes/applicationRecords.js";
import {
  markPending, recordSubmission, movePendingExpired, restoreNotApplied, listRecords, listHistory, releaseDraftRecord,
  withdraw, PENDING_MOVE_DAYS, RECORD_STATES,
} from "../services/applicationRecords.js";
import { userReferencedSql } from "../services/jobs/userReferences.js";
import { at } from "../test-support/sourceAnchors.js";

const DAY = 86400;
const NOW = Math.floor(Date.now() / 1000);
const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

function seed() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'ada','x'), (2,'eli','x')").run();
  for (const [id, co] of [["j1", "Northwind"], ["j2", "Contoso"], ["j3", "Fabrikam"], ["j4", "Tailspin"]]) {
    db.prepare("INSERT INTO scraped_jobs (job_id,title,company,url,search_query,_hash) VALUES (?,?,?,?,'t',?)")
      .run(id, "Engineer", co, `https://${co.toLowerCase()}.example/jobs/${id}`, `h-${id}`);
  }
  db.prepare("INSERT INTO apply_runs (id, user_id) VALUES (1, 1)").run();
  return db;
}
const age = (db, u, j, days) => db.prepare("UPDATE application_records SET updated_at = ? WHERE user_id = ? AND job_id = ?")
  .run(NOW - days * DAY, u, j);
const st = (db, u, j) => db.prepare("SELECT state FROM application_records WHERE user_id = ? AND job_id = ?").pluck().get(u, j);

test("d112cMovesAfter14 · a pending row past 14 days moves to not_applied; the rest stay; the reader sees 'Moves in n days'", () => {
  assert.equal(PENDING_MOVE_DAYS, 14, "14 is a constant");
  assert.ok(RECORD_STATES.includes("not_applied"));
  const db = seed();
  for (const j of ["j1", "j2", "j3", "j4"]) markPending(db, 1, j, "opened_posting");
  markPending(db, 2, "j1", "opened_posting");
  age(db, 1, "j1", 15);                      // past its 14 days
  age(db, 1, "j2", 10);                      // 4 days left
  age(db, 2, "j1", 15);                      // another user's — moves only on their read or the sweep
  // j3: RECORDED (the user's own evidence) — never moves, however old.
  recordSubmission(db, { userId: 1, jobId: "j3", input: { submittedAt: Date.now(), method: "company_site", evidenceText: "Thanks" } });
  age(db, 1, "j3", 40);
  // j4: Draft House owns it — origin 'drafted' never moves.
  db.prepare("UPDATE application_records SET origin = 'drafted' WHERE user_id = 1 AND job_id = 'j4'").run();
  age(db, 1, "j4", 40);

  const out = listRecords(db, 1, { now: NOW });          // ON READ: the reader's own rows move first
  assert.equal(st(db, 1, "j1"), "not_applied");
  assert.equal(st(db, 1, "j2"), "pending");
  assert.equal(st(db, 1, "j3"), "recorded");
  assert.equal(st(db, 1, "j4"), "pending");
  assert.equal(st(db, 2, "j1"), "pending", "another user's row is not touched by my read");
  assert.deepEqual(out.pending.map(r => r.jobId).sort(), ["j2", "j3", "j4"]);
  assert.deepEqual(out.notApplied.map(r => r.jobId), ["j1"]);
  assert.equal(out.pending.find(r => r.jobId === "j2").movesInDays, 4);
  assert.equal(out.pending.find(r => r.jobId === "j3").movesInDays, null, "a recorded row never moves");
  assert.equal(out.pending.find(r => r.jobId === "j4").movesInDays, null, "a Draft's row never moves");

  // A pending row with a LIVE attempt is Draft House's too, whatever its origin.
  db.prepare("INSERT INTO apply_run_jobs (run_id, user_id, job_id, status) VALUES (1, 1, 'j2', 'queued')").run();
  age(db, 1, "j2", 20);
  assert.equal(movePendingExpired(db, { userId: 1, now: NOW }), 0);
  assert.equal(st(db, 1, "j2"), "pending");

  // The sweep (server.js, every 6 hours) moves everyone's.
  assert.equal(movePendingExpired(db, { now: NOW }), 1);
  assert.equal(st(db, 2, "j1"), "not_applied");

  // The Table labels it closed — as draft's inference, not the user's word.
  const [row] = listHistory(db, 1, { now: NOW }).filter(r => r.jobId === "j1");
  assert.equal(row.status, "closed");
  assert.match(row.label, /Not applied · moved after 14 days/);

  // It leaves /d with a withdrawal; the 6-hourly sweep and the on-read moves are wired in server.js.
  const server = read("server.js");
  const OPEN = "const pendingMembershipSql = (uid) => `";
  const membership = server.slice(at(server, OPEN), at(server, "`;", at(server, OPEN)));
  assert.match(membership, /ar\.state IN \('withdrawn', 'not_applied', 'verified'\)/);
  assert.match(server, /setInterval\(\(\) => runPendingMoveSweep\("interval"\), 6 \* 3600_000\)/);
  assert.match(server, /if \(pendingTab\) \{ try \{ movePendingExpired\(db, \{ userId: ownUid \}\); \}/);
  const legacy = server.slice(at(server, "function pendingJobsQuery"), at(server, "const activeProfile", at(server, "function pendingJobsQuery")));
  assert.match(legacy, /movePendingExpired\(db, \{ userId \}\)/);

  // The Pending row says when.
  const ui = read("client/src/components/PendingApplications.jsx");
  assert.match(ui, /\{row\.movesInDays != null && \(/);
  assert.match(ui, /return `Moves in \$\{n\} day\$\{n === 1 \? "" : "s"\}`;/);
});

test("d112cRestore · Restore brings a Not applied row back to Pending with its 14 days restarting", async () => {
  const db = seed();
  markPending(db, 1, "j1", "opened_posting");
  markPending(db, 1, "j2", "opened_posting");
  age(db, 1, "j1", 20);
  movePendingExpired(db, { userId: 1, now: NOW });
  withdraw(db, 1, "j2");                                  // the user's own "I did not apply" — also listed, also restorable
  const before = listRecords(db, 1, { now: NOW });
  assert.deepEqual(before.notApplied.map(r => [r.jobId, r.state]).sort(), [["j1", "not_applied"], ["j2", "withdrawn"]]);

  const app = express();
  app.use(express.json());
  app.use((req, _r, n) => { req.user = { id: 1 }; n(); });
  applicationRecordRoutes(app, db, (_q, _r, n) => n(), { capturedAtsAtApply: () => null });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const restore = (j) => fetch(`${base}/api/applications/not-applied/${j}/restore`, { method: "POST" });
  try {
    const r = await restore("j1");
    assert.equal(r.status, 200);
    assert.equal(st(db, 1, "j1"), "pending");
    const pending = await (await fetch(`${base}/api/applications/pending`)).json();
    const j1 = pending.pending.find(x => x.jobId === "j1");
    assert.equal(j1.movesInDays, 14, "its 14 days restart from the Restore");
    assert.equal(pending.moveDays, 14);
    assert.ok(!pending.notApplied.some(x => x.jobId === "j1"));
    assert.equal((await restore("j1")).status, 409, "already pending — not in Not applied");
    assert.equal((await restore("nope")).status, 404);
    assert.equal((await restore("j2")).status, 200, "a withdrawn row restores the same way");
    assert.equal(st(db, 1, "j2"), "pending");
  } finally { server.close(); }

  // Re-opening the posting does what Restore does.
  age(db, 1, "j1", 20);
  movePendingExpired(db, { userId: 1, now: NOW });
  assert.equal(st(db, 1, "j1"), "not_applied");
  markPending(db, 1, "j1", "opened_posting");
  assert.equal(st(db, 1, "j1"), "pending");
  assert.equal(listRecords(db, 1).pending.find(x => x.jobId === "j1").movesInDays, 14);
  assert.equal(restoreNotApplied(db, 2, "j1"), 0, "never another user's row");

  // The Table has the list, with Restore.
  const panel = read("client/src/panels/DatabasePanel.jsx");
  assert.match(panel, /\["not_applied","Not applied"\]/);
  assert.match(panel, /api\(`\/api\/applications\/not-applied\/\$\{encodeURIComponent\(jobId\)\}\/restore`, \{ method: "POST" \}\)/);
  assert.match(panel, /<NotAppliedList rows=\{pendingData\.notApplied\}/);
  const ui = read("client/src/components/PendingApplications.jsx");
  assert.match(ui, /export function NotAppliedList\(/);
  assert.match(ui, /data-restore=""/);
});

test("d112cNeverDeleted · a moved row keeps its record, its snapshot and the posting it pins (D43)", () => {
  const db = seed();
  markPending(db, 1, "j1", "generated");
  // A Draft for j1 that was stopped: its snapshot of the posting stays, and nothing of it is live.
  db.prepare(`INSERT INTO apply_run_jobs (run_id, user_id, job_id, status, posting_title, posting_company, posting_url)
              VALUES (1, 1, 'j1', 'cancelled', 'Engineer', 'Northwind', 'https://northwind.example/jobs/j1')`).run();
  age(db, 1, "j1", 30);
  const idBefore = db.prepare("SELECT id FROM application_records WHERE user_id = 1 AND job_id = 'j1'").pluck().get();
  const count = () => db.prepare("SELECT COUNT(*) FROM application_records").pluck().get();
  const n0 = count();
  movePendingExpired(db, { now: NOW });
  for (let i = 0; i < 3; i++) movePendingExpired(db, { now: NOW + i * 30 * DAY });   // sweeps keep running
  assert.equal(releaseDraftRecord(db, 1, "j1"), false, "the Draft release deletes only a pending 'drafted' row");
  assert.equal(count(), n0, "nothing was deleted");
  assert.equal(db.prepare("SELECT id FROM application_records WHERE user_id = 1 AND job_id = 'j1'").pluck().get(), idBefore,
    "the same record — its id, so D16's kept résumé (application_artifacts.record_id) stays attached");
  assert.equal(st(db, 1, "j1"), "not_applied");

  // D43: the expiry cleanup's delete exempts a posting any record references — a moved one included.
  db.prepare(`DELETE FROM scraped_jobs WHERE job_id = 'j1' AND NOT ${userReferencedSql("scraped_jobs.job_id", db)}`).run();
  assert.ok(db.prepare("SELECT 1 FROM scraped_jobs WHERE job_id = 'j1'").get(), "the posting survives the cleanup");

  // And if the posting goes anyway, the Not applied row still names its job from the Draft's snapshot.
  db.prepare("DELETE FROM scraped_jobs WHERE job_id = 'j1'").run();
  const [row] = listRecords(db, 1, { now: NOW }).notApplied;
  assert.equal(row.jobId, "j1");
  assert.equal(row.company, "Northwind");
  assert.equal(row.title, "Engineer");

  // The move is an UPDATE of state — no DELETE in it.
  const svc = read("services/applicationRecords.js");
  const fn = svc.slice(at(svc, "export function movePendingExpired"), at(svc, "export function restoreNotApplied"));
  assert.match(fn, /UPDATE application_records SET state = 'not_applied'/);
  assert.doesNotMatch(fn, /DELETE/);
});
