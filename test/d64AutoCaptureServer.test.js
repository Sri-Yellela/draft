// ⭐ D64 · AUTOMATED CAPTURE — the server's half (services/jobs/autoCapture.js, importJob's `auto` mode,
// POST /api/import/auto).
//
// Owner, 10-07: capture a job page automatically, "run a check if it is relevant to the user's board, and
// migrate it without the user having to do anything." ⛔ An IRRELEVANT posting is discarded server-side
// and NEVER STORED — not the posting, not a capture row, not a refusal record, not its URL.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { importJob, ImportInputError } from "../services/jobs/importJob.js";
import {
  autoCaptureRelevance, autoCaptureBrake, autoCaptureDisabled, listAutoCaptures, undoAutoCapture,
  AUTO_CAPTURE_ORIGIN, AUTO_CAPTURE_HOURLY_CAP, AUTO_CAPTURE_DISABLED_KEY,
} from "../services/jobs/autoCapture.js";
import { CAPTURE_ORIGINS } from "../services/jobs/jobGateway.js";

function db(roleFamily = "engineering") {
  const d = new Database(":memory:");
  for (const m of MIGRATIONS) d.exec(m.sql);
  d.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'ada','x')").run();
  d.prepare(`INSERT INTO domain_profiles (id,user_id,profile_name,role_family,domain,is_active)
             VALUES (7,1,'Current',?,'general',1)`).run(roleFamily);
  return d;
}
const page = ({ title = "Platform Engineer", location = "Austin, TX", body = "Build the platform in Go and TypeScript." } = {}) =>
  [`Title: ${title}`, `Company: Northwind`, `Location: ${location}`, ``, body].join("\n");
const auto = (d, opts = {}, n = 1) =>
  importJob({ url: `https://northwind.example.com/careers/job-${n}`, text: page(opts) }, { db: d, userId: 1, auto: true });
// Every table an automatic capture could leave a trace in.
const traces = (d) => ({
  jobs: d.prepare("SELECT COUNT(*) AS n FROM scraped_jobs").get().n,
  captures: d.prepare("SELECT COUNT(*) AS n FROM job_captures").get().n,
  rejected: d.prepare("SELECT COUNT(*) AS n FROM rejected_jobs").get().n,
  userJobs: d.prepare("SELECT COUNT(*) AS n FROM user_jobs").get().n,
  roleMap: d.prepare("SELECT COUNT(*) AS n FROM job_role_map").get().n,
});
const NONE = { jobs: 0, captures: 0, rejected: 0, userJobs: 0, roleMap: 0 };

test("⛔ D64 · a posting OUTSIDE THE US is discarded and leaves NO trace — not even the refusal or its URL", async () => {
  const d = db();
  const r = await auto(d, { location: "Berlin, Germany" });
  assert.equal(r.discarded, true);
  assert.equal(r.reason, "outside_us");
  assert.deepEqual(traces(d), NONE);
  // A MANUAL capture of the same page does record its refusal — the difference is the point.
  await assert.rejects(importJob({ url: "https://northwind.example.com/careers/job-1", text: page({ location: "Berlin, Germany" }) }, { db: d, userId: 1 }));
  assert.equal(traces(d).captures, 1, "the manual path still records a refused capture");
});

test("⛔ D64 · a posting outside the active profile's ROLES is discarded and stores nothing", async () => {
  const d = db("engineering");
  const r = await auto(d, { title: "Enterprise Account Executive", body: "Own a sales quota and close new business with enterprise customers." });
  assert.equal(r.discarded, true);
  assert.equal(r.reason, "role_mismatch");
  assert.deepEqual(traces(d), NONE);
});

test("⛔ D64 · no active profile → nothing is relevant, nothing stored", async () => {
  const d = db();
  d.prepare("UPDATE domain_profiles SET is_active = 0").run();
  const r = await auto(d);
  assert.equal(r.discarded, true);
  assert.equal(r.reason, "no_active_profile");
  assert.deepEqual(traces(d), NONE);
});

test("⭐ D64 · a RELEVANT posting lands on the board through the ONE gateway, marked auto_capture", async () => {
  const d = db();
  const r = await auto(d);
  assert.notEqual(r.discarded, true);
  assert.ok(r.job?.id, "the capture answer names the posting");
  const cap = d.prepare("SELECT origin, action, user_id FROM job_captures").all();
  assert.deepEqual(cap, [{ origin: AUTO_CAPTURE_ORIGIN, action: "inserted", user_id: 1 }]);
  assert.equal(d.prepare("SELECT COUNT(*) AS n FROM user_jobs WHERE user_id = 1 AND job_id = ? AND starred = 0").get(r.job.id).n, 1,
    "attached to the user (on their board), not starred — a capture is not a ★ (D41 a)");
  assert.ok(CAPTURE_ORIGINS.includes(AUTO_CAPTURE_ORIGIN));
});

test("D64 · data counts for an engineering board (roleScopeExtra) — the board's own scope, not a second rule", async () => {
  const d = db("engineering");
  const rel = autoCaptureRelevance(d, 1, { job: { title: "Data Engineer", description: "Build data pipelines in Spark and SQL.", company: "Northwind" } });
  assert.equal(rel.relevant, true, JSON.stringify(rel));
});

test("⛔ D64 · automatic capture never makes draft FETCH a page — the user's own read is required", async () => {
  const d = db();
  await assert.rejects(importJob({ url: "https://boards.greenhouse.io/northwind/jobs/1" }, { db: d, userId: 1, auto: true }), ImportInputError);
  await assert.rejects(importJob({ text: page() }, { db: d, userId: null, auto: true }), ImportInputError, "and never without a user");
  assert.deepEqual(traces(d), NONE);
});

test("D64 · the brakes — one per URL per user per day, a cap per hour", async () => {
  const d = db();
  const url = "https://northwind.example.com/careers/job-1";
  assert.equal(autoCaptureBrake(d, 1, url), null);
  await auto(d);
  assert.deepEqual(autoCaptureBrake(d, 1, url), { code: "already_today", status: 200 });
  const now = Math.floor(Date.now() / 1000);
  const ins = d.prepare("INSERT INTO job_captures (user_id, job_id, url, origin, action, created_at) VALUES (1, 'x', ?, ?, 'inserted', ?)");
  for (let i = 0; i < AUTO_CAPTURE_HOURLY_CAP; i++) ins.run(`https://other.example/${i}`, AUTO_CAPTURE_ORIGIN, now - 60);
  assert.deepEqual(autoCaptureBrake(d, 1, "https://new.example/1"), { code: "hourly_cap", status: 429 });
  assert.equal(autoCaptureBrake(d, 1, "https://new.example/1", now + 7200), null, "the hour passes");
});

test("D64 · the kill switch — env default, the app_settings row wins (no deploy to flip it)", () => {
  const d = db();
  assert.equal(autoCaptureDisabled(d, {}), false);
  assert.equal(autoCaptureDisabled(d, { AUTO_CAPTURE_DISABLED: "1" }), true);
  d.prepare("INSERT INTO app_settings (key, value) VALUES (?, '0')").run(AUTO_CAPTURE_DISABLED_KEY);
  assert.equal(autoCaptureDisabled(d, { AUTO_CAPTURE_DISABLED: "1" }), false, "the override wins");
});

test("D64 · Captured today + UNDO — off the user's board; a ★ the user added keeps the row; the shared posting stays", async () => {
  const d = db();
  const a = await auto(d, {}, 1);
  const b = await auto(d, { title: "Backend Engineer" }, 2);
  assert.deepEqual(listAutoCaptures(d, 1).map(c => c.jobId).sort(), [a.job.id, b.job.id].sort());
  // a: untouched since → undo removes it from the user entirely.
  assert.deepEqual(undoAutoCapture(d, 1, a.job.id), { undone: true, removedCaptures: 1, removedUserJob: true });
  // b: the user starred it → the ★ keeps their row.
  d.prepare("UPDATE user_jobs SET starred = 1 WHERE job_id = ?").run(b.job.id);
  assert.equal(undoAutoCapture(d, 1, b.job.id).removedUserJob, false);
  assert.equal(d.prepare("SELECT COUNT(*) AS n FROM scraped_jobs WHERE job_id IN (?, ?)").get(a.job.id, b.job.id).n, 2, "the pool keeps both");
  assert.deepEqual(listAutoCaptures(d, 1), []);
  assert.equal(undoAutoCapture(d, 1, a.job.id).undone, false, "nothing left to undo");
});

test("D64 · the route: kill switch first, then the brakes, then importJob in auto mode — and never a fetch", () => {
  const src = fs.readFileSync("routes/importJob.js", "utf8").replace(/\r\n/g, "\n");
  const route = src.slice(src.indexOf('router.post("/auto"'), src.indexOf('router.get("/auto"'));
  const order = ["autoCaptureDisabled(db)", "autoCaptureBrake(db", "importJob({ url, text }, { db, userId: req.user.id, auto: true })"].map(s => route.indexOf(s));
  assert.ok(order.every(i => i > 0), JSON.stringify(order));
  assert.deepEqual([...order].sort((x, y) => x - y), order, "switch → brakes → import");
  assert.match(route, /!text\.trim\(\)/, "the page text is required");
});
