// ⭐ D151 Rule 4 · d151NoFullScanOnRequestPaths (one case) — the board's "my captures" EXISTS reads job_captures by
// (user_id, job_id) through an index, never a scan (measured 11-08: "SCAN jc" inside the board's per-posting subquery).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { at, lastAt } from "../test-support/sourceAnchors.js";

test("d151JobCapturesIndex: migration 228 is byte-identical in both runners and only ADDS an index", () => {
  const block = (f) => { const s = fs.readFileSync(f, "utf8"); const i = at(s, 'id: "228_job_captures_user_job"'); return s.slice(lastAt(s, "    {", i), at(s, "    },", i) + 6); };
  assert.equal(block("server.js"), block("scripts/migrations.js"));
  const sql = block("server.js").replace(/^\s*\/\/.*$/gm, "");
  assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_job_captures_user_job ON job_captures\(user_id, job_id\);/);
  assert.doesNotMatch(sql, /\b(DROP|DELETE|UPDATE|ALTER)\b/);
});

test("d151JobCapturesIndex: the board's capture EXISTS uses the index (no SCAN of job_captures)", () => {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  const plan = db.prepare(`EXPLAIN QUERY PLAN SELECT COUNT(*) FROM scraped_jobs sj
    WHERE EXISTS (SELECT 1 FROM job_captures jc WHERE jc.job_id = sj.job_id AND jc.user_id = 7)`).all().map(r => r.detail).join(" | ");
  assert.doesNotMatch(plan, /SCAN jc\b/, plan);
  assert.match(plan, /idx_job_captures_user_job/, plan);
  // the board's own SQL still has that exact shape
  assert.match(fs.readFileSync("server.js", "utf8"), /EXISTS \(SELECT 1 FROM job_captures jc WHERE jc\.job_id = sj\.job_id AND jc\.user_id = \$\{ownUid\}\)/);
});

test("d151BeingMatchedOneRead: migration 229's partial recency index; 'being matched' is ONE capped read, newest first, walked by the index", () => {
  const block = (f) => { const s = fs.readFileSync(f, "utf8"); const i = at(s, 'id: "229_scraped_jobs_active_recency"'); return s.slice(lastAt(s, "    {", i), at(s, "    },", i) + 6); };
  assert.equal(block("server.js"), block("scripts/migrations.js"));
  assert.match(block("server.js"), /CREATE INDEX IF NOT EXISTS idx_scraped_jobs_active_recency ON scraped_jobs\(COALESCE\(posted_at, discovered_at\) DESC\) WHERE is_active = 1;/);
  const src = fs.readFileSync("server.js", "utf8").replace(/\r\n/g, "\n");
  assert.match(src, /ORDER BY COALESCE\(sj\.posted_at, sj\.discovered_at\) DESC LIMIT \$\{BOARD_MATCH_BATCH \+ 1\}`/);
  assert.doesNotMatch(src, /SELECT COUNT\(\*\) AS n \$\{joinClause\} \$\{heldSql\}/, "no whole-board COUNT of the held postings");
  assert.match(src, /\.\.\.\(beingMatchedMore \? \{ beingMatchedMore: true \} : \{\}\),/);
  // the plan: the held read walks the partial index (the board's own predicate, is_active = 1, implies its WHERE)
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  const plan = db.prepare(`EXPLAIN QUERY PLAN SELECT sj.job_id FROM scraped_jobs sj WHERE sj.is_active = 1
    ORDER BY COALESCE(sj.posted_at, sj.discovered_at) DESC LIMIT 2001`).all().map(r => r.detail).join(" | ");
  assert.match(plan, /idx_scraped_jobs_active_recency/, plan);
  assert.doesNotMatch(plan, /USE TEMP B-TREE FOR ORDER BY/, plan);
  const ui = fs.readFileSync("client/src/panels/JobsPanel.jsx", "utf8");
  assert.match(ui, /\{beingMatched\.toLocaleString\(\)\}\{beingMatchedMore \? "\+" : ""\} more/);
});
