import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import applyRoutes from "../routes/apply.js";
import { at } from "../test-support/sourceAnchors.js";

/**
 * TASK AH6 — the Auto Apply panel opens on the day something last happened.
 *
 * The real-browser proof is scripts/ah6RecentRunDefault.mjs. These cover the endpoint's arithmetic
 * (which is a timezone question, and therefore the part most likely to be quietly wrong) and pin
 * the panel shapes.
 *
 * THE REPORT SAID the date filter lands on today and shows an empty board. It does not land on
 * today — it lands on NO DATE and asks you to pick one, which is AD1's deliberate inversion. AD1
 * was right that a panel must not silently ship a day's applications nobody asked for, and wrong
 * about what to do instead: the commonest reason to open Auto Apply is to see what happened on the
 * last run, which is almost never today, so the panel was making the reader answer a question it
 * could answer itself.
 *
 * ⛔ D25 (10-04): THE CLIENT HALF IS GONE. Draft House no longer has AD1's calendar or sub-tabs —
 * it shows what stopped and needs the user, and the dated record is The Table's (D15) — so the
 * mount-time bootstrap that picked a day for that calendar, the "Showing <day>" line, the tab notes
 * and the standing-work notes were all removed with it, and their nine tests with them. What stays
 * pinned here is the ENDPOINT, which still exists and still answers correctly; that no effect calls
 * it any more is asserted in applyRunHistory.test.js and applyPanelLayoutAdoption.test.js.
 */

function serverWith(rows) {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE apply_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, mode TEXT,
      status TEXT, total_jobs INTEGER, created_at INTEGER, started_at INTEGER, finished_at INTEGER);
    CREATE TABLE apply_run_jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER, user_id INTEGER,
      job_id TEXT, status TEXT, reason_code TEXT, created_at INTEGER, hidden_at INTEGER);
    CREATE TABLE scraped_jobs (job_id TEXT PRIMARY KEY, title TEXT, company TEXT, url TEXT, apply_url TEXT);
  `);
  db.prepare("INSERT INTO apply_runs (id,user_id,mode,status) VALUES (1,1,'semi','done')").run();
  const ins = db.prepare("INSERT INTO apply_run_jobs (run_id,user_id,job_id,status,created_at,hidden_at) VALUES (1,?,?,?,?,?)");
  for (const r of rows) ins.run(r.userId ?? 1, r.jobId ?? "j", r.status ?? "held_review", r.createdAt, r.hiddenAt ?? null);

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 1, planTier: "PRO" }; next(); });
  applyRoutes(app, db, (q, r, n) => n(), () => ({ field_map: {}, handler_map: {}, custom_answers: {} }),
    async () => ({}), async () => Buffer.from(""), async () => ({}));
  return { app, db };
}
const latest = (app, query = "") => new Promise((resolve) => {
  const server = app.listen(0, async () => {
    const r = await fetch(`http://127.0.0.1:${server.address().port}/api/apply/history/latest${query}`);
    const body = await r.json();
    server.close(() => resolve({ status: r.status, body }));
  });
});

// ── the endpoint ─────────────────────────────────────────────────────────────────────────────

test("no runs at all returns null — not today, and not an error", () => {
  // A user with no history has no most-recent day. Inventing today for them is the blank board with
  // extra steps, which is the thing this task is fixing.
  const { app } = serverWith([]);
  return latest(app).then(({ status, body }) => {
    assert.equal(status, 200);
    assert.equal(body.date, null);
  });
});

test("the latest run's day is returned", () => {
  // 2026-08-22 12:00 UTC and an older row.
  const { app } = serverWith([
    { createdAt: Math.floor(Date.UTC(2026, 7, 18, 12) / 1000) },
    { createdAt: Math.floor(Date.UTC(2026, 7, 22, 12) / 1000) },
  ]);
  return latest(app, "?tzOffset=0").then(({ body }) => assert.equal(body.date, "2026-08-22"));
});

test("the day is the CALLER'S day, not UTC's", () => {
  // A run queued at 9pm in Boston (UTC-4, offset +240) belongs to that Boston day. Read as UTC it
  // is already tomorrow, and the panel would open on a day with nothing on it — the exact failure
  // this task is about, reintroduced by the fix.
  const at = Math.floor(Date.UTC(2026, 7, 23, 1) / 1000);   // 2026-08-23 01:00 UTC
  const { app } = serverWith([{ createdAt: at }]);
  return latest(app, "?tzOffset=240").then(({ body }) => {
    assert.equal(body.date, "2026-08-22", "in Boston that instant is still the 22nd");
  });
});

test("a hidden row does not count as activity", () => {
  // hidden_at is the user saying "stop showing me this". Opening on the day of a row they hid would
  // be the panel arguing with them.
  const recent = Math.floor(Date.UTC(2026, 7, 24, 12) / 1000);
  const older = Math.floor(Date.UTC(2026, 7, 20, 12) / 1000);
  const { app } = serverWith([
    { createdAt: older },
    { createdAt: recent, hiddenAt: recent + 10 },
  ]);
  return latest(app, "?tzOffset=0").then(({ body }) => assert.equal(body.date, "2026-08-20"));
});

test("another user's runs are not my most recent activity", () => {
  const mine = Math.floor(Date.UTC(2026, 7, 19, 12) / 1000);
  const theirs = Math.floor(Date.UTC(2026, 7, 25, 12) / 1000);
  const { app } = serverWith([
    { userId: 1, createdAt: mine },
    { userId: 2, createdAt: theirs },
  ]);
  return latest(app, "?tzOffset=0").then(({ body }) => assert.equal(body.date, "2026-08-19"));
});

test("it returns a DATE and never a listing", () => {
  const at = Math.floor(Date.UTC(2026, 7, 22, 12) / 1000);
  const { app } = serverWith([{ createdAt: at }]);
  return latest(app, "?tzOffset=0").then(({ body }) => {
    // The whole justification for adding a request to the mount is that this one is cheap. A body
    // that grew rows would be the preload AD1 forbade, arriving through a different door.
    assert.deepEqual(Object.keys(body), ["date"]);
  });
});

test("the listing endpoint still refuses to default — only the panel has a default", () => {
  const route = fs.readFileSync("routes/apply.js", "utf8");
  const listing = route.slice(at(route, 'app.get("/api/apply/history", requireAuth'));
  assert.match(listing, /if \(!range\) return res\.status\(400\)/,
    "a caller must still name the day it wants; an endpoint with a sensible default invites a mount to hit it");
});

// ── the panel: removed by D25 (see the header) ───────────────────────────────────────────────







// ── legibility (requirement 4) ────────────────────────────────────────────────────────────────




test("abPanelUi stubs the latest-date endpoint explicitly, so its resting state is the real one", () => {
  // Before this it fell through to a fallback body with no `date` key, so AD1's resting-state
  // checks would have passed if the panel had stopped asking, or if the endpoint had broken.
  const harness = fs.readFileSync("scripts/abPanelUi.mjs", "utf8");
  assert.match(harness, /url\.pathname === '\/api\/apply\/history\/latest'/);
  assert.match(harness, /JSON\.stringify\(\{ date: null \}\)/);
  // And the AD1 network check now names LISTINGS rather than every history path.
  assert.match(harness, /p\.startsWith\('\/api\/apply\/history\?'\)/);
});
