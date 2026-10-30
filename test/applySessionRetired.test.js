import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import applyRoutes from "../routes/apply.js";
import { at } from "../test-support/sourceAnchors.js";

/**
 * /api/apply/session — retired in 09 (410), REVERSED by D100 (owner 10-30) as a recorded deliberate reversal.
 *
 * WHAT THEY WERE. In the server-side-Playwright era (ebeb9ae) POST /save wrote a Playwright `storageState` — the
 * cookies of the candidate's LOGGED-IN session on an employer's portal — to data/sessions/<userId>_<domain>.json in
 * PLAINTEXT. That is why they were retired, and it is the thing the reversal must never bring back.
 *
 * WHAT CHANGED IN THE DESIGN (D79 / D100, docs/APPLY_WORKER.md §2). A session is sealed in the user's app to a
 * per-session key the APPLY WORKER minted; draft stores ciphertext it cannot read, never a password; revoke destroys
 * the key. The old paths now point (308) at those doors — /api/portals/upload refuses anything that is not sealed —
 * and still nothing touches the filesystem. The plaintext refusal itself is pinned in test/d100ApplyWorker.test.js.
 */

function server() {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE apply_runs (id INTEGER PRIMARY KEY, user_id INTEGER, status TEXT);
           CREATE TABLE apply_run_jobs (id INTEGER PRIMARY KEY, run_id INTEGER, user_id INTEGER,
             job_id TEXT, status TEXT, hidden_at INTEGER);
           CREATE TABLE scraped_jobs (job_id TEXT PRIMARY KEY);`);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 1, planTier: "PRO" }; next(); });
  applyRoutes(app, db, (q, r, n) => n(), () => ({ field_map: {}, handler_map: {}, custom_answers: {} }),
    async () => ({}), async () => Buffer.from(""), async () => ({}));
  return app;
}
const call = (app, method, path, body) => new Promise((resolve) => {
  const s = app.listen(0, async () => {
    const r = await fetch(`http://127.0.0.1:${s.address().port}${path}`, {
      method, redirect: "manual",
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    s.close(() => resolve({ status: r.status, location: r.headers.get("location") }));
  });
});

test("D100 · saving a portal session points at the SEALED upload — 308, method and body kept", async () => {
  const { status, location } = await call(server(), "POST", "/api/apply/session/save",
    { domain: "workday.com", storageState: { cookies: [{ name: "sid", value: "secret" }] } });
  assert.equal(status, 308);
  assert.equal(location, "/api/portals/upload");
});

test("D100 · asking for a session points at the portal list — status only, never the session", async () => {
  const { status, location } = await call(server(), "GET", "/api/apply/session/workday.com");
  assert.equal(status, 308);
  assert.equal(location, "/api/portals");
});

test("nothing is written to disk, whatever is posted", async () => {
  // The original wrote data/sessions/<userId>_<domain>.json. If that directory ever reappears,
  // something has started persisting portal sessions in the clear again and this should be the thing that says so.
  await call(server(), "POST", "/api/apply/session/save",
    { domain: "greenhouse.io", storageState: { cookies: [] } });
  assert.equal(fs.existsSync("data/sessions"), false,
    "data/sessions exists — a plaintext portal session store has come back");
  const route = fs.readFileSync("routes/apply.js", "utf8");
  const block = route.slice(at(route, "REVERSES the 410"), at(route, 'app.get("/api/apply/session/:domain"') + 200);
  assert.doesNotMatch(block, /writeFileSync|existsSync|sessionPath|storageState/);
});

test("both routes stay behind requireAuth", () => {
  const route = fs.readFileSync("routes/apply.js", "utf8");
  assert.match(route, /app\.post\("\/api\/apply\/session\/save", requireAuth/);
  assert.match(route, /app\.get\("\/api\/apply\/session\/:domain", requireAuth/);
});

test("the stub shapes stay gone", () => {
  const route = fs.readFileSync("routes/apply.js", "utf8");
  assert.doesNotMatch(route, /res\.json\(\{ exists: false \}\)/);
  const block = route.slice(at(route, "WAS RETIRED (until D100"), at(route, 'app.get("/api/apply/session/:domain"') + 200);
  assert.doesNotMatch(block, /res\.json\(\{ ok: true \}\)/);
});
