import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { at } from "../test-support/sourceAnchors.js";
import {
  recordJobHistory, livenessFor, livenessForRows, isStale, titleKey, descSignature, signatureSimilarity,
} from "../services/jobs/jobHistory.js";
import { pickJobs, runAutoTick } from "../services/autoScheduler.js";
import { AUTO_DEFAULTS, normaliseAutoSettings } from "../shared/autoSettings.js";
import applyRoutes from "../routes/apply.js";

// ⭐ D107 (owner 10-30) · IS THIS POSTING ALIVE. Synthetic companies and postings.

const DAY = 86400;
const NOW = Math.floor(Date.UTC(2026, 9, 30, 12) / 1000);
const TEXT = "We are hiring a backend engineer to build payment systems in Go and Postgres. You will own services end to end, " +
  "work with product on design, review code, mentor others and keep our APIs fast and reliable for millions of users.";
const OTHER = "Join the design team to shape our brand identity across print, motion and the web. You will run workshops, " +
  "build illustration systems and partner with marketing on campaigns for three product launches every single year.";

function fixtureDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  return db;
}
const post = (db, id, { title = "Backend Engineer", company = "Acme, Inc.", location = "Boston, MA", text = TEXT, first, updated = first, active = 1, posted = null } = {}) =>
  db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,location,url,search_query,_hash,description,scraped_at,discovered_at,updated_at,is_active,posted_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, title, company, location, `https://x.test/${id}`, "t", `h${id}`, text, first, first, updated, active, posted);

test("D107 · keys: requisition ids and brackets leave the title key; the signature tells same text from other text", () => {
  assert.equal(titleKey("Backend Engineer (R-10233)"), "backend engineer");
  assert.equal(titleKey("Backend Engineer – REQ 554321"), "backend engineer");
  assert.equal(titleKey("Senior C++ Engineer"), "senior c++ engineer");
  assert.ok(signatureSimilarity(descSignature(TEXT), descSignature(TEXT + " Apply today.")) >= 0.6);
  assert.ok(signatureSimilarity(descSignature(TEXT), descSignature(OTHER)) < 0.3);
  assert.equal(descSignature("too short"), null);
});

test("D107 · d107RepostDetected — same title, new ID, after the earlier one closed; the history outlives the deleted row", () => {
  const db = fixtureDb();
  post(db, "a1", { first: NOW - 150 * DAY, updated: NOW - 120 * DAY, active: 0 });
  post(db, "a2", { title: "Backend Engineer (R-2)", first: NOW - 100 * DAY, updated: NOW - 70 * DAY, active: 0 });
  recordJobHistory(db, { now: NOW - 60 * DAY });
  // The cleanup deletes both board rows; the history keeps them, closed.
  db.prepare("DELETE FROM scraped_jobs").run();
  post(db, "a3", { first: NOW - 40 * DAY, updated: NOW - 10 * DAY, active: 0 });
  post(db, "a4", { title: "Backend Engineer – REQ 99881", first: NOW - 5 * DAY });
  const h = recordJobHistory(db, { now: NOW });
  assert.equal(h.closed, 0, "a1 / a2 were already closed");
  assert.ok(db.prepare("SELECT closed_at FROM job_history WHERE job_id='a1'").pluck().get());
  const l = livenessFor(db, "a4", { now: NOW });
  assert.equal(l.reposts, 3);
  assert.equal(l.kind, "reposted");
  assert.equal(l.label, "Reposted 3 times since June");
  assert.equal(livenessFor(db, "a1", { now: NOW }).reposts, 0, "the first one is no repost");
});

test("D107 · not a repost: several cities the same week, one still open, another text, another company, past 90 days", () => {
  const db = fixtureDb();
  post(db, "b1", { location: "Boston, MA", first: NOW - 3 * DAY });
  post(db, "b2", { location: "Austin, TX", first: NOW - 2 * DAY });
  post(db, "b3", { location: "Boston, MA", first: NOW - 1 * DAY });
  post(db, "c1", { text: OTHER, first: NOW - 60 * DAY, updated: NOW - 50 * DAY, active: 0 });
  post(db, "d1", { company: "Other Co", first: NOW - 60 * DAY, updated: NOW - 50 * DAY, active: 0 });
  post(db, "e1", { first: NOW - 300 * DAY, updated: NOW - 280 * DAY, active: 0 });
  post(db, "f1", { location: "Austin, TX", first: NOW - 40 * DAY });
  recordJobHistory(db, { now: NOW });
  const m = livenessForRows(db, db.prepare("SELECT * FROM scraped_jobs WHERE job_id IN ('b1','b2','b3')").all(), { now: NOW });
  assert.deepEqual([...m.values()].map(x => x.reposts), [0, 0, 0], "a week apart at most, other text, other company, or past 90 days");
});

test("D107 · d107AgeShown — new, open N days, open long; the posting's own date counts when it is earlier", () => {
  const db = fixtureDb();
  post(db, "n1", { company: "N1", first: NOW - 3600 });
  post(db, "n2", { company: "N2", first: NOW - DAY - 3600 });
  post(db, "o1", { company: "O1", first: NOW - 9 * DAY });
  post(db, "o2", { company: "O2", first: NOW - 94 * DAY });
  post(db, "o3", { company: "O3", first: NOW - DAY, posted: new Date((NOW - 45 * DAY) * 1000).toISOString() });
  recordJobHistory(db, { now: NOW });
  const lab = (id) => livenessFor(db, id, { now: NOW }).label;
  assert.equal(lab("n1"), "New — first seen today");
  assert.equal(lab("n2"), "New — first seen yesterday");
  assert.equal(lab("o1"), "Open 9 days");
  assert.equal(lab("o2"), "Open 94 days");
  assert.equal(lab("o3"), "Open 45 days", "posted 45 days ago, first seen by the crawl yesterday");
  // Before the rollup has seen a row, the board row itself answers.
  post(db, "z1", { company: "Z1", first: NOW - 40 * DAY });
  assert.equal(livenessFor(db, "z1", { now: NOW }).label, "Open 40 days");
});

test("D107 · d107ThresholdSetting — staleReposts / staleOpenDays default 3 / 90, can be off, refused out of range", () => {
  assert.equal(AUTO_DEFAULTS.staleReposts, 3);
  assert.equal(AUTO_DEFAULTS.staleOpenDays, 90);
  assert.equal(normaliseAutoSettings({ staleReposts: null, staleOpenDays: null }).value.staleOpenDays, null);
  assert.equal(normaliseAutoSettings({ staleReposts: 0 }).error, "bad_stale_reposts");
  assert.equal(normaliseAutoSettings({ staleOpenDays: 7 }).error, "bad_stale_open_days");
  assert.equal(isStale({ reposts: 3, openDays: 10 }, AUTO_DEFAULTS), true);
  assert.equal(isStale({ reposts: 0, openDays: 91 }, AUTO_DEFAULTS), true);
  assert.equal(isStale({ reposts: 2, openDays: 90 }, AUTO_DEFAULTS), false);
  assert.equal(isStale({ reposts: 9, openDays: 400 }, { staleReposts: null, staleOpenDays: null }), false, "off is off");
  const drawer = fs.readFileSync("client/src/components/AutoSettingsDrawer.jsx", "utf8");
  assert.match(drawer, /staleReposts/);
  assert.match(drawer, /staleOpenDays/);
});

test("D107 · d107AutoSkipsStale — FULL AUTO leaves out the posting open 120 days; Approve all keeps it waiting", async () => {
  const db = fixtureDb();
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier,send_mode,auto_settings) VALUES (1,'dana','x','PRO','auto',?)")
    .run(JSON.stringify({ ...AUTO_DEFAULTS, savedAt: 0 }));
  post(db, "old", { title: "Data Engineer", company: "Old Co", first: NOW - 120 * DAY });
  post(db, "fresh", { title: "Data Engineer", company: "Fresh Co", first: NOW - 2 * DAY });
  recordJobHistory(db, { now: NOW });
  const calls = [];
  await runAutoTick(db, { nowSec: NOW, env: {},
    fetchBoard: async () => [{ jobId: "old", company: "Old Co" }, { jobId: "fresh", company: "Fresh Co" }],
    startAutoRun: (_u, ids) => { calls.push(ids); return { status: 202, body: {} }; } });
  assert.deepEqual(calls, [["fresh"]]);
  const p = pickJobs([{ jobId: "old" }], { remaining: 5, drafted: new Set(), companyCounts: new Map(), pausedCompanies: new Set(),
    settings: AUTO_DEFAULTS, isStalePosting: () => true });
  assert.deepEqual(p.skipped, [{ jobId: "old", reason: "stale" }]);

  // Approve all over the two: the stale one stays held; approving it alone sends it.
  db.prepare("INSERT INTO user_profile (user_id,first_name,last_name,email) VALUES (1,'Dana','Example','dana@example.test')").run();
  db.prepare("INSERT INTO domain_profiles (id,user_id,profile_name,role_family,domain,is_active) VALUES (10,1,'SWE','engineering','software',1)").run();
  db.prepare("INSERT INTO profile_base_resumes (profile_id,user_id,name,content,updated_at) VALUES (10,1,'r.txt','synthetic resume text',unixepoch())").run();
  const run = db.prepare("INSERT INTO apply_runs (user_id,mode,status,total_jobs,approval_mode) VALUES (1,'auto','completed',2,'required')").run().lastInsertRowid;
  const held = (job) => Number(db.prepare("INSERT INTO apply_run_jobs (run_id,user_id,job_id,status,reason_code) VALUES (?,1,?,'held_review','awaiting_approval')").run(run, job).lastInsertRowid);
  const a = held("old"), b = held("fresh");
  const app = express();
  app.use(express.json());
  app.use((req, _r, n) => { req.user = { id: 1, planTier: "PRO" }; n(); });
  const noop = async () => ({});
  applyRoutes(app, db, (_q, _r, n) => n(), () => ({ field_map: {}, handler_map: {}, custom_answers: {} }), noop, noop, noop, () => null);
  const server = app.listen(0);
  const approve = (body) => fetch(`http://127.0.0.1:${server.address().port}/api/apply/approve`, { method: "POST",
    headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(async r => ({ status: r.status, body: await r.json() }));
  try {
    const all = await approve({ runJobIds: [a, b] });
    assert.equal(all.status, 202, JSON.stringify(all.body));
    assert.deepEqual(all.body.approved, [b]);
    assert.equal(all.body.skippedStale[0].runJobId, a);
    assert.match(all.body.skippedStale[0].reason, /^Open \d+ days$/);
    assert.equal(db.prepare("SELECT status FROM apply_run_jobs WHERE id=?").pluck().get(a), "held_review");
    const one = await approve({ runJobIds: [a] });
    assert.equal(one.status, 202, "the user's own explicit choice");
  } finally { server.close(); }
});

test("D107 · wired: the rollup runs before the cleanup deletes and after the crawl; the board and the card carry it", () => {
  const server = fs.readFileSync("server.js", "utf8");
  const begin = at(server, "function runExpiredJobsCleanup() {", 0, "server.js — the cleanup");
  assert.ok(at(server, "recordJobHistory(db)", begin, "the cleanup writes the history") < at(server, "DELETE FROM scraped_jobs", begin, "the cleanup's delete"),
    "the history is written before anything is deleted");
  assert.match(server, /liveness: liveness\.get\(String\(j\.job_id\)\)/);
  assert.match(fs.readFileSync("client/src/components/JobCard.jsx", "utf8"), /<LivenessMark liveness=\{job\.liveness\}\/>/);
  assert.match(fs.readFileSync("client/src/components/PostingPanel.jsx", "utf8"), /<PostingLiveness liveness=\{job\.liveness\} \/>/);
});
