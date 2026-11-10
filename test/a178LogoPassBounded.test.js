// ⭐ A178 (46d) · the logo pass's board-wide GROUP_CONCAT(url, apply_url) read every active posting's row through its
// overflow pages (0.6 s warm, 13.5 s cold on the 100k copy) ~20 s after every boot. Now the companies + job ids come from
// the covering index and URLs are read only for the due companies' postings, by job id.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { resolveCompanyLogos, companyKey } from "../services/jobs/companyLogoStore.js";

test("a178: the company list is answered from the covering index — no row is read", () => {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  const src = fs.readFileSync("services/jobs/companyLogoStore.js", "utf8");
  assert.doesNotMatch(src, /GROUP_CONCAT\(COALESCE\(sj\.url/, "no board-wide URL concatenation");
  const plan = db.prepare(`EXPLAIN QUERY PLAN SELECT sj.company AS company, sj.job_id AS job_id FROM scraped_jobs sj INDEXED BY idx_scraped_jobs_board_cover
    WHERE sj.is_active = 1 AND sj.company IS NOT NULL AND TRIM(sj.company) != ''`).all().map(r => r.detail).join(" | ");
  assert.match(plan, /COVERING INDEX idx_scraped_jobs_board_cover/, plan);
  assert.match(src, /URL_SAMPLE = 50/);
});

test("a178: only DUE companies are resolved (a company with a stored logo is skipped), up to the limit, their URLs read", async () => {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  const ins = db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, company, title, _hash, url, apply_url, is_active) VALUES (?, 'q', ?, 'Engineer', ?, ?, ?, 1)`);
  ins.run("gh::1", "Alpha Co", "h1", "https://boards.greenhouse.io/alpha/jobs/1", "https://alpha.example/apply/1");
  ins.run("gh::2", "Beta Co", "h2", "https://boards.greenhouse.io/beta/jobs/2", null);
  ins.run("gh::3", "Gamma Co", "h3", "https://boards.greenhouse.io/gamma/jobs/3", null);
  db.prepare(`INSERT INTO company_logos (company_key, company, status, checked_at) VALUES (?, 'Alpha Co', 'ok', unixepoch())`).run(companyKey("Alpha Co"));
  const seen = [];
  const fetchImpl = async (url) => { seen.push(String(url)); return { ok: false, status: 404, headers: new Map(), arrayBuffer: async () => new ArrayBuffer(0), text: async () => "" }; };
  const r = await resolveCompanyLogos(db, { fetchImpl, limit: 1 });
  assert.equal(r.scanned, 1, "the limit holds");
  const row = db.prepare("SELECT company FROM company_logos WHERE company_key != ?").all(companyKey("Alpha Co")).map(x => x.company);
  assert.deepEqual(row, ["Beta Co"], "alphabetical, like the old GROUP BY; the stored one skipped");
});
