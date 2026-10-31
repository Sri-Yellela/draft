// D53 (owner, 10-07) — REVIEW AND CLEAR, WITH A 7-DAY RECYCLE BIN.
//
// Found before building, as the row asked: Draft House's Remove (DELETE /api/apply/run-jobs/:id) was
// ALREADY a soft hide — hidden_at, stopping a pending run first (AC4) — not a hard delete. What it
// lacked: a way back, a purge, and the same behaviour everywhere (Remove from the line CANCELLED with no
// way back; an approval had Reject and no Clear). Clear is now one function in every unsent state, into
// a bin restorable for 7 days, purged by a sweep with a brake.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import applyRoutes from "../routes/apply.js";
import { markPending } from "../services/applicationRecords.js";
import { BIN_DAYS, listBin, purgeSweep } from "../services/draftBin.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const DAY = 86400;
const now = () => Math.floor(Date.now() / 1000);

function mount() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'ada','x','PRO')").run();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 1, planTier: "PRO" }; next(); });
  const noop = async () => ({});
  applyRoutes(app, db, (req, _res, next) => next(),
    () => ({ field_map: {}, handler_map: {}, custom_answers: {} }), noop, noop, noop, () => null);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, p, body) => {
    const r = await fetch(base + p, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, json: await r.json().catch(() => null) };
  };
  return { db, call, stop: () => server.close() };
}
/** One run-job in its own run, in `status`, with prepared answers and a packet, and its Draft record. */
function seed(db, job, status, { reason = null, runStatus = "completed", createdAt = now() } = {}) {
  const run = db.prepare("INSERT INTO apply_runs (user_id,mode,status,total_jobs,approval_mode) VALUES (1,'auto',?,1,'required')").run(runStatus).lastInsertRowid;
  const id = db.prepare(`INSERT INTO apply_run_jobs (run_id,user_id,job_id,status,reason_code,answers_json,blanks_json,created_at)
    VALUES (?,1,?,?,?,'{"a":1}','[]',?)`).run(run, job, status, reason, createdAt).lastInsertRowid;
  db.prepare(`INSERT INTO apply_gate_packets (user_id, run_id, run_job_id, job_id, apply_url, expected_origin, gate_reason,
    answers_json, token_hash, expires_at, created_at) VALUES (1, ?, ?, ?, 'u', 'https://x.example', 'incomplete_form', '{"home":"x"}', ?, 9999999999, ?)`)
    .run(run, id, job, `h-${id}`, createdAt);
  if (status !== "submitted") markPending(db, 1, job, "drafted");
  return { id, run };
}
const row = (db, id) => db.prepare("SELECT * FROM apply_run_jobs WHERE id=?").get(id);
const rec = (db, job) => db.prepare("SELECT state, origin FROM application_records WHERE job_id=?").get(job) || null;

test("D53 · clear → in the bin, absent from Draft House's feeds and from /d; restore → back, same state", async () => {
  const t = mount();
  try {
    const { id } = seed(t.db, "gh::held", "held_review", { reason: "incomplete_form" });
    const del = await t.call("DELETE", `/api/apply/run-jobs/${id}`);
    assert.equal(del.json.binned, true);
    assert.equal(del.json.binDays, BIN_DAYS);
    const bin = await t.call("GET", "/api/apply/bin");
    assert.deepEqual(bin.json.items.map(i => i.id), [id]);
    assert.equal(bin.json.items[0].purgesInDays, 7);
    const feeds = (await t.call("GET", "/api/apply/runs")).json;
    assert.ok(![...feeds.review, ...feeds.stopped, ...feeds.inFlight].some(x => x.id === id), "still in Draft House");
    assert.equal(rec(t.db, "gh::held"), null, "the Draft record is released — out of /d, its Draft button free");
    const back = await t.call("POST", `/api/apply/bin/${id}/restore`);
    assert.equal(back.status, 200);
    assert.equal(back.json.needsDraft, false);
    const r = row(t.db, id);
    assert.equal(r.status, "held_review"); assert.equal(r.reason_code, "incomplete_form", "exact prior state");
    assert.equal(r.hidden_at, null); assert.equal(r.answers_json, '{"a":1}', "nothing scrubbed by a clear");
    assert.deepEqual(rec(t.db, "gh::held"), { state: "pending", origin: "drafted" }, "back in /d");
    assert.ok((await t.call("GET", "/api/apply/runs")).json.review.some(x => x.id === id));
  } finally { t.stop(); }
});

test("D53 · Clear behaves the same in EVERY unsent state — line, in flight, approval, held, failed", async () => {
  const t = mount();
  try {
    const cases = {
      inflight: seed(t.db, "j-run", "running", { runStatus: "running" }),
      approval: seed(t.db, "j-appr", "held_review", { reason: "awaiting_approval" }),
      held: seed(t.db, "j-held", "held_review", { reason: "login_required" }),
      failed: seed(t.db, "j-fail", "failed", { reason: "internal_error" }),
    };
    for (const [name, { id }] of Object.entries(cases)) {
      const r = await t.call("DELETE", `/api/apply/run-jobs/${id}`);
      assert.equal(r.json.binned, true, `${name} did not go to the bin`);
    }
    assert.equal(row(t.db, cases.inflight.id).status, "cancelled", "a running one is stopped first (AC4)");
    // The line — removed whole.
    const run = t.db.prepare("INSERT INTO apply_runs (user_id,mode,status,total_jobs,approval_mode,line_position) VALUES (1,'auto','waiting',1,'required',1)").run().lastInsertRowid;
    const lj = t.db.prepare("INSERT INTO apply_run_jobs (run_id,user_id,job_id,status) VALUES (?,1,'j-line','queued')").run(run).lastInsertRowid;
    assert.equal((await t.call("DELETE", `/api/apply/line/${run}`)).status, 200);
    const ids = listBin(t.db, 1).map(i => i.id).sort((a, b) => a - b);
    assert.deepEqual(ids, [...Object.values(cases).map(c => c.id), lj].sort((a, b) => a - b), "every state lands in the one bin");
    // A stopped one comes back as a new Draft, said so.
    assert.equal(listBin(t.db, 1).find(i => i.id === lj).stoppedByClear, true);
    assert.equal((await t.call("POST", `/api/apply/bin/${lj}/restore`)).json.needsDraft, true);
  } finally { t.stop(); }
});

test("D53 · an APPLIED item cannot be cleared — not binned, refused in bulk, never purged", async () => {
  const t = mount();
  try {
    const { id } = seed(t.db, "j-sent", "submitted");
    const del = await t.call("DELETE", `/api/apply/run-jobs/${id}`);
    assert.equal(del.json.binned, false, "AC4's soft hide stays; it is not the bin");
    assert.equal(row(t.db, id).purge_after, null);
    t.db.prepare("UPDATE apply_run_jobs SET hidden_at=NULL WHERE id=?").run(id);
    const bulk = await t.call("POST", "/api/apply/bin/clear", { runJobIds: [id] });
    assert.deepEqual(bulk.json.refused, [id]);
    // Even forced into a past purge date, the sweep will not touch a sent one.
    t.db.prepare("UPDATE apply_run_jobs SET hidden_at=1, purge_after=1 WHERE id=?").run(id);
    assert.equal(purgeSweep(t.db, { dryRun: false }).purged, 0);
    assert.equal(row(t.db, id).answers_json, '{"a":1}');
  } finally { t.stop(); }
});

test("D53 · an 8-day-old cleared item is invisible at READ time and PURGED by the sweep", async () => {
  const t = mount();
  try {
    const { id } = seed(t.db, "j-old", "held_review", { reason: "incomplete_form" });
    await t.call("DELETE", `/api/apply/run-jobs/${id}`);
    const later = now() + 8 * DAY;
    assert.deepEqual(listBin(t.db, 1, { now: later }), [], "past its date it is gone from the bin even before the sweep");
    assert.equal(row(t.db, id).answers_json, '{"a":1}', "the read-time filter alone scrubs nothing");
    // ⛔ Dry run by default: reports, touches nothing.
    const dry = purgeSweep(t.db, { now: later });
    assert.equal(dry.dryRun, true); assert.deepEqual(dry.ids, [id]);
    assert.equal(row(t.db, id).purged_at, null);
    const real = purgeSweep(t.db, { now: later, dryRun: false });
    assert.equal(real.purged, 1);
    const r = row(t.db, id);
    assert.ok(r.purged_at); assert.equal(r.answers_json, null); assert.equal(r.blanks_json, null);
    assert.equal(t.db.prepare("SELECT COUNT(*) FROM apply_gate_packets WHERE run_job_id=?").pluck().get(id), 0, "the packet's answers are deleted");
    const logged = t.db.prepare("SELECT details FROM cleanup_log ORDER BY id DESC LIMIT 1").pluck().get();
    assert.deepEqual(JSON.parse(logged), { kind: "draft_bin_purge", refused: false, purged: 1, runJobIds: [id] }, "it logs what it purged");
    assert.equal((await t.call("POST", `/api/apply/bin/${id}/restore`)).status, 404, "a purged item cannot be restored");
  } finally { t.stop(); }
});

test("D53 · the sweep REFUSES past its ceiling — and purges none", () => {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'ada','x')").run();
  for (const j of ["a", "b", "c"]) {
    const { id } = seed(db, j, "held_review");
    db.prepare("UPDATE apply_run_jobs SET hidden_at=1, purge_after=2 WHERE id=?").run(id);
  }
  const out = purgeSweep(db, { dryRun: false, ceiling: 2 });
  assert.equal(out.refused, true); assert.equal(out.purged, 0);
  assert.equal(db.prepare("SELECT COUNT(*) FROM apply_run_jobs WHERE purged_at IS NOT NULL").pluck().get(), 0);
  assert.match(db.prepare("SELECT details FROM cleanup_log ORDER BY id DESC LIMIT 1").pluck().get(), /"refused":true/);
});

test("D53 · bulk clear: the ids given, or everything older than 7 / 30 days, its count measured first", async () => {
  const t = mount();
  try {
    const fresh = seed(t.db, "j-new", "held_review");
    const old = seed(t.db, "j-9d", "held_review", { createdAt: now() - 9 * DAY });
    const older = seed(t.db, "j-40d", "failed", { createdAt: now() - 40 * DAY });
    assert.equal((await t.call("POST", "/api/apply/bin/clear", { olderThanDays: 30, dryRun: true })).json.count, 1);
    assert.equal((await t.call("POST", "/api/apply/bin/clear", { olderThanDays: 7, dryRun: true })).json.count, 2);
    assert.equal(listBin(t.db, 1).length, 0, "a dry run clears nothing");
    const r = await t.call("POST", "/api/apply/bin/clear", { olderThanDays: 7 });
    assert.deepEqual(r.json.cleared.sort(), [old.id, older.id].sort());
    assert.match(r.json.message, /They stay in the bin for 7 days/);
    assert.equal(row(t.db, fresh.id).hidden_at, null);
    assert.equal((await t.call("POST", "/api/apply/bin/clear", { olderThanDays: 3 })).status, 400, "only 7 or 30");
  } finally { t.stop(); }
});

test("D53 · Clear is not Pass — it writes no pass and trains nothing", async () => {
  const t = mount();
  try {
    const { id } = seed(t.db, "j-np", "held_review");
    await t.call("DELETE", `/api/apply/run-jobs/${id}`);
    assert.equal(t.db.prepare("SELECT COUNT(*) FROM user_jobs WHERE disliked=1").pluck().get(), 0);
    const bin = read("services/draftBin.js");
    assert.doesNotMatch(bin, /disliked|interact/, "the bin writes no pass");
  } finally { t.stop(); }
});

test("D53 · Draft House: Clear on every item, multi-select, the bin under Queued, and the privacy line", () => {
  const panel = read("client/src/panels/AutoApplyPanel.jsx");
  assert.doesNotMatch(panel, /label: "Remove"/, "one word for one act");
  assert.match(panel, /case "approval":[\s\S]{0,600}label: "Clear"[\s\S]{0,200}clearRunJobs\(\{ runJobIds: \[r\.runJobId\] \}\)/, "approvals can be cleared too");
  assert.match(panel, /`Clear \$\{count\}\? They stay in the bin for \$\{bin\.binDays\} days, then they are purged\.`/, "bulk confirms with a count");
  // D113 UI U7: the bin is a fold inside the side column's Tidy up block (Queued is gone), beside Clear older than…
  const tidy = panel.slice(at(panel, "    tidy: ("), at(panel, "  return (", at(panel, "    tidy: (")));
  assert.match(tidy, /<details data-draft-bin="" className="dh-bin">/, "the bin is a fold INSIDE Tidy up, not a nav item");
  assert.match(tidy, /purges in \$\{it\.purgesInDays\} day/);
  assert.match(tidy, /onClick=\{\(\) => confirmOlder\(7\)\}/);
  assert.doesNotMatch(panel, /Done selecting|setSelecting/, "D113 UI U9: no select mode");
  assert.match(read("client/src/pages/marketing/PrivacyPage.jsx"), /stays in its Cleared bin for 7 days/);
  assert.match(read("extension/submission/PRIVACY_RECONCILIATION.md"), /services\/draftBin\.js/);
  // The purge is scheduled — a mechanism, not only a policy.
  assert.match(read("server.js"), /setInterval\(\(\) => runDraftBinPurge\("interval"\), 6 \* 3600_000\)/);
  assert.match(read("server.js"), /purgeSweep\(db, \{ dryRun: false \}\)/);
});

test("D53 · a cleared application's packet is not offered and cannot be filled — until it is restored", async () => {
  const t = mount();
  try {
    const { id } = seed(t.db, "gh::pk", "held_gate", { reason: "login_required" });
    const pid = t.db.prepare("SELECT id FROM apply_gate_packets WHERE run_job_id=?").pluck().get(id);
    assert.ok((await t.call("GET", "/api/apply/gate-packets")).json.packets.some(p => p.packetId === pid));
    await t.call("DELETE", `/api/apply/run-jobs/${id}`);
    assert.equal(row(t.db, id).status, "held_gate", "a parked item is binned untouched, not cancelled");
    const list = (await t.call("GET", "/api/apply/gate-packets")).json;
    assert.ok(!list.packets.some(p => p.packetId === pid)); assert.equal(list.total, 0);
    assert.equal((await t.call("POST", `/api/apply/gate-packets/${pid}/token`)).status, 410);
    await t.call("POST", `/api/apply/bin/${id}/restore`);
    assert.ok((await t.call("GET", "/api/apply/gate-packets")).json.packets.some(p => p.packetId === pid), "restored with its packet");
  } finally { t.stop(); }
});
