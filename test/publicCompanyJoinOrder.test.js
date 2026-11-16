// ⭐ 46p · THE COMPANY PAGE'S QUERIES DRIVE FROM THE COMPANY'S OWN ROWS. services/companies/publicCompany.js builds the public
// company page AND the extension's per-press facts (D191). With a plain JOIN SQLite chose idx_scraped_jobs_duplicate_of
// (duplicate_of IS NULL = almost every posting) and read the whole table — measured on the 100k fixture in staging: ~200 ms
// per query, ~607 ms per cold company (p50), synchronous on the one thread. CROSS JOIN pins job_company first: 1.0 ms p50.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { PUBLIC_OPEN_SQL } from "../services/jobs/publicJobPage.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const src = fs.readFileSync(path.join(ROOT, "services/companies/publicCompany.js"), "utf8").replace(/\r\n/g, "\n");

test("the three open-posting reads of a company page join job_company CROSS JOIN scraped_jobs", () => {
  assert.equal((src.match(/FROM job_company jc\s+CROSS JOIN scraped_jobs sj ON sj\.job_id = jc\.job_id/g) || []).length, 3, "open-by-category, locations, the 20 jobs");
  assert.doesNotMatch(src.replace(/\/\/.*$/gm, ""), /FROM job_company jc\s+JOIN scraped_jobs sj ON sj\.job_id = jc\.job_id (LEFT JOIN job_taxonomy jt ON jt\.job_id = sj\.job_id\s+)?WHERE jc\.company_id = \? AND \$\{OPEN\}/,
    "no open-posting read left on a plain JOIN");
});

test("with the production indexes, the pinned query searches job_company by company first (never the duplicate_of index)", () => {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE scraped_jobs (id INTEGER PRIMARY KEY, job_id TEXT UNIQUE, is_active INTEGER, duplicate_of TEXT, board_category TEXT, location TEXT, ghost_level INTEGER, title TEXT);
    CREATE INDEX idx_scraped_jobs_duplicate_of ON scraped_jobs(duplicate_of);
    CREATE INDEX idx_scraped_jobs_board_cover ON scraped_jobs(job_id, is_active, board_category, ghost_level, title);
    CREATE TABLE job_company (job_id TEXT PRIMARY KEY, company_id INTEGER);
    CREATE INDEX idx_job_company_company ON job_company(company_id);`);
  const ins = db.prepare("INSERT INTO scraped_jobs (job_id, is_active, duplicate_of, board_category, location) VALUES (?, 1, NULL, 'engineering', ?)");
  const link = db.prepare("INSERT INTO job_company (job_id, company_id) VALUES (?, ?)");
  db.transaction(() => { for (let i = 0; i < 3000; i++) { ins.run(`j${i}`, `City ${i % 7}`); link.run(`j${i}`, i % 100); } })();
  db.exec("ANALYZE");
  const OPEN = PUBLIC_OPEN_SQL.replace(/\b(is_active|duplicate_of|board_category)\b/g, "sj.$1");
  const plan = db.prepare(`EXPLAIN QUERY PLAN SELECT sj.location, COUNT(*) AS n FROM job_company jc CROSS JOIN scraped_jobs sj ON sj.job_id = jc.job_id
      WHERE jc.company_id = ? AND ${OPEN} GROUP BY sj.location`).all(5).map(r => r.detail);
  assert.match(plan[0], /SEARCH jc USING (COVERING )?INDEX idx_job_company_company/, plan.join(" | "));
  assert.ok(!plan.some(d => /idx_scraped_jobs_duplicate_of/.test(d)), plan.join(" | "));
});
