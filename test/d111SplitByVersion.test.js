// ⭐ D111 (owner 10-30) · WHAT IS WORKING — d111SplitByVersion. The résumé version an application was sent with is the
// D90 base UPLOAD its tailored version was made from (a per-job version number means nothing across jobs), read from
// the tables by gatherCallbackApps; the same reader gives the role, D107's liveness AT THE TIME and the days from
// posting to application. Synthetic people, companies and postings.
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { callbackRates, gatherCallbackApps, versionGroup, roleKey, NOT_SPLIT } from "../services/callbackRates.js";
import pipelineRoutes from "../routes/pipeline.js";

const DAY = 86400;
const NOW = Math.floor(Date.UTC(2026, 9, 30, 12) / 1000);
const UP_A = Math.floor(Date.UTC(2026, 6, 1) / 1000);
const UP_B = Math.floor(Date.UTC(2026, 7, 3) / 1000);

function fixture() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1, 'avery', 'x'), (2, 'blake', 'x')").run();
  db.prepare("INSERT INTO base_resume_uploads (id, user_id, name, content, uploaded_at) VALUES (11, 1, 'a', 'A', ?), (12, 1, 'b', 'B', ?)").run(UP_A, UP_B);
  const app = db.prepare(`INSERT INTO job_applications (user_id, job_id, company, role, applied_at, response_outcome) VALUES (?, ?, ?, ?, ?, ?)`);
  const ver = db.prepare(`INSERT INTO resume_versions (user_id, job_id, company, role, html, version, base_upload_id, created_at) VALUES (1, ?, 'Co', 'R', '<p/>', ?, ?, ?)`);
  const hist = db.prepare(`INSERT INTO job_history (job_id, company_key, title_key, first_seen, last_seen) VALUES (?, ?, 'backend engineer', ?, ?)`);
  let n = 0;
  // 16 sent with upload A (8 replied), 16 with upload B (2 replied), 3 untailored. Applied 40–60 days ago.
  const add = (upload, replied, { role = "Senior Backend Engineer, Payments", postedDaysBefore = 2 } = {}) => {
    const id = `j${++n}`, appliedAt = NOW - (40 + (n % 20)) * DAY;
    app.run(1, id, `Synthetic Co ${n}`, role, appliedAt, replied ? "rejected" : null);
    if (upload) { ver.run(id, 1, upload, appliedAt - 3600); ver.run(id, 2, 99, appliedAt + 5 * DAY); }  // v2 came AFTER sending
    hist.run(id, `co${n}`, appliedAt - postedDaysBefore * DAY, appliedAt + DAY);
  };
  for (let i = 0; i < 16; i++) add(11, i < 8);
  for (let i = 0; i < 16; i++) add(12, i < 2, { postedDaysBefore: 20 });
  for (let i = 0; i < 3; i++) add(null, false);
  // Another user's applications are never read.
  for (let i = 0; i < 20; i++) app.run(2, `o${i}`, "Other Co", "Designer", NOW - 50 * DAY, "offer");
  return db;
}

test("D111 · d111SplitByVersion — the upload the sent version was made from, not a later version", () => {
  const db = fixture();
  const rows = gatherCallbackApps(db, 1);
  assert.equal(rows.length, 35, "own applications only");
  assert.deepEqual(rows[0].version, { tailored: true, uploadId: 11, uploadedAt: UP_A }, "v1 was sent; v2 (upload 99) came later");
  const r = callbackRates(rows, { now: NOW });
  const v = r.splits.find(s => s.key === "version");
  const byKey = Object.fromEntries(v.groups.map(g => [g.key, g]));
  assert.equal(byKey["upload:11"].replies, "8 of 16");
  assert.equal(byKey["upload:12"].replies, "2 of 16");
  assert.equal(byKey.untailored.replies, "0 of 3");
  assert.equal(byKey.untailored.enough, false);
  assert.equal(byKey["upload:11"].label, "Résumé uploaded Jul 1, 2026");
  assert.equal(v.groups[0].key, "upload:12", "the newest upload first");
});

test("D111 · the headline picks the widest qualifying gap, with both counts", () => {
  const r = callbackRates(gatherCallbackApps(fixture(), 1), { now: NOW });
  assert.equal(r.shown, true);
  assert.equal(r.headline.detail, "8 of 16 vs 2 of 16");
  assert.match(r.headline.text, /^Applications (with the résumé uploaded Jul 1, 2026|sent within 3 days of posting) got 4× the replies\.$/);
  const days = r.splits.find(s => s.key === "daysToApply").groups;
  assert.deepEqual(days.map(g => [g.key, g.replies]), [["d0_3", "8 of 19"], ["d15", "2 of 16"]]);
});

test("D111 · role ignores seniority and team; liveness is read AS OF the applied date; D106's verdict is not split", () => {
  assert.equal(roleKey("Senior Backend Engineer II, Payments (R-123)"), "backend engineer");
  assert.equal(roleKey("Jr. Backend Engineer - Remote"), "backend engineer");
  const r = callbackRates(gatherCallbackApps(fixture(), 1), { now: NOW });
  assert.deepEqual(r.splits.find(s => s.key === "role").groups.map(g => [g.label, g.replies]), [["Backend Engineer", "10 of 35"]]);
  // Each posting was first seen 2 or 20 days before it was sent: at THAT time it was a first posting under 30 days,
  // although by today every one of them is months old.
  assert.deepEqual(r.splits.find(s => s.key === "liveness").groups.map(g => [g.key, g.n]), [["fresh", 35]]);
  assert.equal(r.splits.some(s => s.key === "verdict"), false);
  assert.equal(NOT_SPLIT[0].key, "verdict");
  assert.match(NOT_SPLIT[0].reason, /not recorded when an application is sent/);
  assert.equal(versionGroup(null).key, "untailored");
  assert.equal(versionGroup({ tailored: true, uploadId: null }).key, "upload:unknown");
});

test("D111 · GET /api/pipeline/callback-rates answers for the signed-in user only", async () => {
  const db = fixture();
  const app = express();
  pipelineRoutes(app, db, (req, _res, next) => { req.user = { id: Number(req.headers["x-user"]) }; next(); });
  const server = app.listen(0);
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const mine = await (await fetch(`${base}/api/pipeline/callback-rates`, { headers: { "x-user": "1" } })).json();
    assert.equal(mine.shown, true);
    assert.equal(mine.counted, 35);
    const theirs = await (await fetch(`${base}/api/pipeline/callback-rates`, { headers: { "x-user": "2" } })).json();
    assert.equal(theirs.counted, 20);
    assert.equal(theirs.total.replies, "20 of 20");
  } finally { server.close(); }
});
