// ⭐ D171 FIX 3 (owner 11-06: "I could not open the job from Home to compare the JD with the résumé") — every Home
// application row's "The posting" opens the posting IN PLACE: the job description AS STORED WHEN THE APPLICATION WAS
// MADE (migration 225, written by the queue's own snapshot statement in routes/apply.js), owner-checked, still readable
// after a re-crawl rewrites the posting or the posting is gone — and "Open the original" beside the row's Résumé.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import express from "express";
import { MIGRATIONS } from "../scripts/migrations.js";
import { createApplicationPostingRouter, postingAnswer } from "../routes/applicationPosting.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

function migrated() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  return db;
}
async function serve(db, userId) {
  const app = express();
  app.use(createApplicationPostingRouter({ db, requireAuth: (req, _res, next) => { req.user = { id: userId }; next(); } }));
  const server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
  const get = async (p) => { const r = await fetch(`http://127.0.0.1:${server.address().port}${p}`); return { status: r.status, body: await r.json() }; };
  return { get, close: () => new Promise(r => server.close(r)) };
}

/** The queue's own snapshot statements, as routes/apply.js prepares them — run here on the real schema. */
function queueSnapshots() {
  const src = read("routes/apply.js");
  const region = src.slice(at(src, "let snapshotJob = null;"), at(src, "const tagDrafted ="));
  const stmts = [...region.matchAll(/db\.prepare\(`([\s\S]*?)`\)/g)].map(m => m[1]);
  assert.equal(stmts.length, 2, "129's posting snapshot and 225's description snapshot");
  assert.match(stmts[1], /posting_description = \(SELECT COALESCE\(sj\.description_text, sj\.description\) FROM scraped_jobs sj WHERE sj\.job_id = apply_run_jobs\.job_id\)/);
  // Both run inside the queue's transaction, after the run-jobs are inserted.
  assert.match(src, /snapshotJob\?\.run\(runId\);\n\s+snapshotDescription\?\.run\(runId\);\n\s+\}\)\(\);/);
  return stmts;
}

const JD = "About the role\nYou will build the payments ledger.\n\nRequirements:\n- 5 years of Go\n- Postgres";

test("d171PostingOpensFromHomeRow: the JD as stored when the application was made, owner-checked, readable after the posting is gone", async () => {
  const db = migrated();
  assert.ok(db.prepare("PRAGMA table_info(apply_run_jobs)").all().some(c => c.name === "posting_description"), "migration 225");
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1, 'syn-a', 'x'), (2, 'syn-b', 'x')").run();
  db.prepare(`INSERT INTO scraped_jobs (job_id, source, search_query, _hash, title, company, location, url, apply_url, description, is_active)
    VALUES ('gh::9', 'greenhouse', 't', 'h9', 'Backend Engineer', 'Northwind', 'Remote', 'https://boards.example.com/9', 'https://boards.example.com/9/apply', ?, 1)`).run(JD);
  const run = db.prepare("INSERT INTO apply_runs (user_id, mode, status, created_at) VALUES (1, 'semi', 'done', unixepoch())").run().lastInsertRowid;
  const rj = db.prepare("INSERT INTO apply_run_jobs (run_id, user_id, job_id, status, created_at) VALUES (?, 1, 'gh::9', 'submitted', unixepoch())").run(run).lastInsertRowid;
  for (const sql of queueSnapshots()) db.prepare(sql).run(run);
  assert.equal(db.prepare("SELECT posting_description FROM apply_run_jobs WHERE id = ?").pluck().get(rj), JD, "the queue kept the words");

  // A re-crawl rewrites the posting: the application still reads what was applied to.
  db.prepare("UPDATE scraped_jobs SET description = 'A different role now.' WHERE job_id = 'gh::9'").run();
  const s = await serve(db, 1);
  try {
    let r = await s.get(`/api/apply/run-jobs/${rj}/posting`);
    assert.equal(r.status, 200);
    assert.equal(r.body.description, JD);
    assert.equal(r.body.source, "snapshot");
    assert.equal(r.body.title, "Backend Engineer");
    assert.equal(r.body.url, "https://boards.example.com/9/apply", "Open the original");
    assert.equal(r.body.gone, false);
    // The posting is gone from the board: still readable, and said so.
    db.prepare("DELETE FROM scraped_jobs WHERE job_id = 'gh::9'").run();
    r = await s.get(`/api/apply/run-jobs/${rj}/posting`);
    assert.equal(r.body.description, JD);
    assert.equal(r.body.gone, true);
    assert.equal(r.body.company, "Northwind", "129's snapshot keeps the masthead");
    // By job: the person's own application.
    r = await s.get(`/api/apply/jobs/gh%3A%3A9/posting`);
    assert.equal(r.status, 200);
    assert.equal(r.body.description, JD);
    assert.equal(r.body.runJobId, rj);
    assert.equal((await s.get("/api/apply/run-jobs/abc/posting")).status, 404);
    assert.equal((await s.get("/api/apply/jobs/nope/posting")).status, 404, "no application → nothing served");
  } finally { await s.close(); }

  // ⛔ Owner-checked: another person's attempt is a 404, by attempt and by job.
  const other = await serve(db, 2);
  try {
    assert.equal((await other.get(`/api/apply/run-jobs/${rj}/posting`)).status, 404);
    assert.equal((await other.get(`/api/apply/jobs/gh%3A%3A9/posting`)).status, 404);
  } finally { await other.close(); }
});

test("d171PostingOpensFromHomeRow · an attempt made before 225, and a record with no attempt, read today's posting — and say so", async () => {
  const db = migrated();
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1, 'syn-a', 'x')").run();
  db.prepare(`INSERT INTO scraped_jobs (job_id, source, search_query, _hash, title, company, url, description, is_active)
    VALUES ('lv::1', 'lever', 't', 'h1', 'Data Engineer', 'Contoso', 'https://jobs.example.com/1', 'Live words.', 0)`).run();
  db.prepare("INSERT INTO job_applications (user_id, job_id, company, role, job_url) VALUES (1, 'lv::1', 'Contoso', 'Data Engineer', 'https://jobs.example.com/1')").run();
  const s = await serve(db, 1);
  try {
    const r = await s.get("/api/apply/jobs/lv%3A%3A1/posting");
    assert.equal(r.status, 200);
    assert.equal(r.body.source, "live");
    assert.equal(r.body.description, "Live words.");
    assert.equal(r.body.gone, true, "inactive is gone");
  } finally { await s.close(); }
  assert.equal(postingAnswer({ job_id: "x" }).source, null, "nothing stored is said as nothing");
});

test("d171PostingOpensFromHomeRow · Home's posting pane opens it in place, beside the Résumé, drawn by the posting's own body", () => {
  const panel = read("client/src/panels/AutoApplyPanel.jsx");
  const leaf = panel.slice(at(panel, 'out.push({ id: "job", label: "The job"'), at(panel, "// ⭐ D146 · THE OPENED ROW"));
  assert.match(leaf, /<AttemptPosting runJobId=\{runJobOf\(node\)\} jobId=\{node\.jobId \?\? null\}/);
  assert.match(leaf, /<AttemptPosting[\s\S]*<AttemptResume runJobId=\{runJobOf\(node\)\}[\s\S]*<\/AttemptPosting>/, "the Résumé beside the JD");
  const hist = panel.slice(at(panel, "const HistoryBody = "), at(panel, 'if (id === "resume") return ('));
  assert.match(hist, /<AttemptPosting jobId=\{row\.jobId\}/, "a Table-only row too");
  assert.match(panel, /const PANE_LEAVES = \{ posting: \["job"\]/, "The posting pane is the job leaf");
  const comp = read("client/src/components/AttemptPosting.jsx");
  assert.match(comp, /\/api\/apply\/run-jobs\/\$\{encodeURIComponent\(runJobId\)\}\/posting/);
  assert.match(comp, /\/api\/apply\/jobs\/\$\{encodeURIComponent\(jobId\)\}\/posting/);
  assert.match(comp, /<PostingText text=\{posting\.description\} \/>/, "the posting's own body (a93: built once)");
  assert.match(comp, />Open the original ↗<\/a>/);
  assert.match(comp, /postingClick\(target, e\)/, "the one way the web app opens a posting (D99 J11)");
  const pp = read("client/src/components/PostingPanel.jsx");
  assert.match(pp, /export function PostingText\(\{ text, jobId = null \}\)[\s\S]{0,400}<PostingBody text=\{body\} jobId=\{jobId\} \/>/);
  assert.match(read("server.js"), /app\.use\(createApplicationPostingRouter\(\{ db, requireAuth \}\)\);/);
});
