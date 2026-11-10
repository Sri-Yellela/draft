// ⭐ D187 HB-10 · Admin → System → Hirebase — the state it shows, the caps it sets, the sizing it runs (HB-9 (a)), all
// behind requireAdmin, and the section mounted on the System page. Offline.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { hirebaseState, sizingQueries, setCaps } from "../services/hirebase/admin.js";
import { createHirebaseClient } from "../services/hirebase/client.js";
import { runSizing } from "../services/hirebase/runners.js";

const db0 = () => { const db = new Database(":memory:"); for (const m of MIGRATIONS) db.exec(m.sql); return db; };
const quiet = { log() {}, warn() {}, error() {} };

test("HB-10: the state — switches as they ship (off, dry-run), the Free caps, nothing used, no runs", () => {
  const s = hirebaseState(db0(), { env: {} });
  assert.equal(s.enabled, false); assert.equal(s.dryRun, true); assert.equal(s.hasKey, false);
  assert.deepEqual(s.caps, { month: 500, day: 200 });
  assert.equal(s.used.month, 0); assert.deepEqual(s.runs, []);
  assert.equal(s.skipOurBoards, false); assert.ok(s.ourBoards.includes("greenhouse"));
});

test("HB-10: caps are whole numbers; a bad one is refused (400)", () => {
  const db = db0();
  assert.deepEqual(setCaps(db, { month: 25000, day: 1000 }), { month: 25000, day: 1000 });
  assert.throws(() => setCaps(db, { month: -1 }), (e) => e.status === 400);
  assert.throws(() => setCaps(db, { day: 1.5 }), (e) => e.status === 400);
});

test("HB-9 (a) through HB-10: the owner's seven free estimates, both ways for the whole filter and SWE; a dry run sends nothing", async () => {
  const q = sizingQueries({ nowMs: Date.parse("2026-11-10T12:00:00Z") });
  assert.equal(q.length, 7);
  assert.ok(q.some(x => /our boards skipped/.test(x.label) && Array.isArray(x.body.exclude_job_board)));
  assert.ok(q.filter(x => /Software engineering/.test(x.label)).every(x => x.body.days_ago === 1));
  assert.ok(q.some(x => x.body.geo_locations?.[0]?.city === "Boston"));
  assert.ok(q.some(x => x.body.visa === "true"));
  assert.equal(q[0].body.date_posted, "2026-09-11");
  let calls = 0;
  const db = db0();
  const r = await runSizing(db, createHirebaseClient({ db, env: { HIREBASE_KEY: "k", HIREBASE_ENABLED: "1" }, log: quiet, fetchImpl: async () => { calls++; } }), q);
  assert.equal(calls, 0);
  assert.ok(r.estimates.every(e => e.dryRun && e.count === null));
  assert.equal(hirebaseState(db, { env: {} }).runs[0].kind, "estimate");
});

test("HB-10: the routes are admin-only, the caps change is audited, and the section is on Admin → System", () => {
  const src = fs.readFileSync("server.js", "utf8");
  for (const r of ['app.get("/api/admin/hirebase", requireAdmin', 'app.put("/api/admin/hirebase", requireAdmin',
    'app.post("/api/admin/hirebase/sizing", requireAdmin', 'app.post("/api/admin/hirebase/sample", requireAdmin']) assert.ok(src.includes(r), r);
  assert.match(src, /action: "hirebase_caps"/);
  const admin = fs.readFileSync("client/src/panels/AdminPanel.jsx", "utf8");
  assert.match(admin, /<PostingArchiveSection\/><HirebaseSection\/>/);
  const ui = fs.readFileSync("client/src/panels/adminDiagnostics.jsx", "utf8");
  assert.match(ui, /export function HirebaseSection\(\)/);
  assert.match(ui, /api\("\/api\/admin\/hirebase"\)/);
});
