// D99 · "a job from the board is on the board" (owner, 10-13) — the server half.
//
//   · manualHandoff.js jobOnUsersBoard: the user's own job, OR a posting LIVE on the board (active, canonical). Read by
//     the tab binding's hint (routes/apply.js boundJob) and the on-page résumé's start (services/extensionResume.js) —
//     before, a job the user had only seen on the board, in a tab "Read this page" recognised, was "not on your board".
//   · GET /api/extension/job/:id (routes/extensionJob.js): the extension's own token only; the canonical https address,
//     the card, and draft's own ATS report (J12) — or 404 for a job not on this user's board. The address is the
//     SERVER's; the request carries an id only.
// Synthetic people and postings only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { jobOnUsersBoard, userHasJob } from "../services/manualHandoff.js";
import { createExtensionJobRouter, boardJobForExtension } from "../routes/extensionJob.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

function freshDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'ada','x','PRO'), (2,'blake','x','PRO')").run();
  const ins = db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,location,url,apply_url,search_query,_hash,discovered_at,is_active,duplicate_of)
                          VALUES (?,?,?,?,?,?,'t',?,unixepoch(),?,?)`);
  ins.run("gh-live-1", "Backend Engineer", "Synthco", "Austin, TX", "https://boards.greenhouse.io/synthco/jobs/1", "https://boards.greenhouse.io/synthco/jobs/1", "h1", 1, null);
  ins.run("gh-retired-2", "Data Engineer", "Synthco", "Austin, TX", "https://boards.greenhouse.io/synthco/jobs/2", null, "h2", 0, null);
  ins.run("gh-dup-3", "Backend Engineer", "Synthco", "Austin, TX", "https://jobs.lever.co/synthco/3", null, "h3", 1, "gh-live-1");
  ins.run("gh-http-4", "SRE", "Synthco", "Austin, TX", "http://careers.synthco.test/4", null, "h4", 1, null);
  // user 2 captured the retired one — theirs, not Ada's
  db.prepare("INSERT INTO job_captures (user_id, job_id, url, origin, action) VALUES (2,'gh-retired-2','https://boards.greenhouse.io/synthco/jobs/2','capture','attached')").run();
  return db;
}

test("⛔ jobOnUsersBoard: a live board posting is on every user's board; a retired one only for whoever made it theirs", () => {
  const db = freshDb();
  assert.equal(userHasJob(db, 1, "gh-live-1"), false, "the premise: Ada never touched it");
  assert.equal(jobOnUsersBoard(db, 1, "gh-live-1"), true, "but it is on her board");
  assert.equal(jobOnUsersBoard(db, 1, "gh-retired-2"), false, "retired, and not hers");
  assert.equal(jobOnUsersBoard(db, 2, "gh-retired-2"), true, "retired, and hers (captured)");
  assert.equal(jobOnUsersBoard(db, 1, "gh-dup-3"), false, "a folded duplicate is on the board only under its canonical row");
  assert.equal(jobOnUsersBoard(db, 1, "nope"), false);
  assert.equal(jobOnUsersBoard(db, 1, ""), false);
});

test("⛔ the binding's hint and the on-page résumé read jobOnUsersBoard — one rule", () => {
  const apply = read("routes/apply.js");
  assert.match(apply, /function boundJob\(userId, hint\) \{[\s\S]{0,200}if \(!jobOnUsersBoard\(db, userId, id\)\) return null;/);
  assert.match(read("services/extensionResume.js"), /if \(!jobOnUsersBoard\(db, userId, id\)\) return userError\("not_your_job"\);/);
});

function mount({ limit = { limit: 50, windowMs: 60_000 }, base = true, score = { score: 72, band: "STRONG", scorable: true, matched: ["node.js", "postgres"], missing: ["kafka"] } } = {}) {
  const db = freshDb();
  const app = express();
  app.use((req, _res, next) => { req.user = { id: Number(req.get("x-user") || 1) }; req.isExt = req.get("x-ext") !== "0"; next(); });
  app.use(createExtensionJobRouter({ db, requireAuth: (q, r, n) => n(), isExtension: (req) => req.isExt,
    scoreFor: () => score, hasBaseResume: () => base, limit }));
  const server = app.listen(0);
  const get = (id, { user = 1, ext = true } = {}) => fetch(`http://127.0.0.1:${server.address().port}/api/extension/job/${encodeURIComponent(id)}`,
    { headers: { "x-user": String(user), "x-ext": ext ? "1" : "0" } }).then(async r => ({ status: r.status, body: await r.json() }));
  return { get, stop: () => { server.close(); db.close(); } };
}

test("⛔ GET /api/extension/job/:id: the server's address, the card and draft's report — for a board job", async (t) => {
  const m = mount(); t.after(m.stop);
  const r = await m.get("gh-live-1");
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.job, { jobId: "gh-live-1", title: "Backend Engineer", company: "Synthco",
    url: "https://boards.greenhouse.io/synthco/jobs/1", logo: r.body.job.logo, reportPath: "/app/jobs?job=gh-live-1" });
  assert.deepEqual(r.body.ats, { state: "ready", score: 72, band: "STRONG", scorable: true, matched: ["node.js", "postgres"], missing: ["kafka"] });
});

test("⛔ not on this user's board → 404 and nothing to open; a browser tab's credential → 403; rate-limited", async (t) => {
  const m = mount(); t.after(m.stop);
  for (const id of ["gh-retired-2", "gh-dup-3", "nope"]) {
    const r = await m.get(id);
    assert.equal(r.status, 404, id);
    assert.equal(r.body.error, "not_on_board", id);
    assert.equal("job" in r.body, false, `${id}: no address`);
  }
  assert.equal((await m.get("gh-retired-2", { user: 2 })).status, 200, "the user who captured it may open it");
  const plain = await m.get("gh-http-4");
  assert.equal(plain.status, 200, "on the board: the report stands");
  assert.equal(plain.body.job.url, null, "but an http address is never handed over to be opened");
  assert.equal((await m.get("gh-live-1", { ext: false })).status, 403, "the extension's credential only");
  const m2 = mount({ limit: { limit: 3, windowMs: 60_000 } }); t.after(m2.stop);
  for (let i = 0; i < 3; i++) assert.equal((await m2.get("gh-live-1")).status, 200);
  assert.equal((await m2.get("gh-live-1")).status, 429);
});

test("⛔ J12: no base résumé → no_base_resume (\"Add your résumé in draft\"), never a score; a missing scorer is said", () => {
  const db = freshDb();
  assert.deepEqual(boardJobForExtension(db, 1, "gh-live-1", { scoreFor: () => { throw new Error("no"); }, hasBaseResume: () => false }).ats, { state: "no_base_resume" });
  assert.deepEqual(boardJobForExtension(db, 1, "gh-live-1", { scoreFor: () => null, hasBaseResume: () => true }).ats, { state: "unavailable" });
  const declined = boardJobForExtension(db, 1, "gh-live-1", { scoreFor: () => ({ score: null, band: "NOT_ENOUGH_SIGNAL", scorable: false }), hasBaseResume: () => true }).ats;
  assert.equal(declined.score, null, "not enough signal is null, never 0");
  assert.equal(declined.band, "NOT_ENOUGH_SIGNAL");
});

test("⛔ the route is mounted with the extension's credential check and the approval screen's scorer", () => {
  const src = read("server.js");
  assert.match(src, /app\.use\(createExtensionJobRouter\(\{ db, requireAuth, isExtension: isExtensionCredential,/);
  assert.match(src, /scoreFor: \(userId, jobId\) => scoreBaseResumeForApply\(userId, jobId\)/);
});
