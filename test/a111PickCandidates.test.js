import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { picksFor, clearPicksCache, SCORE_CAP } from "../services/trialPicks.js";

// A111 (11-02): on the P1 crawl copy the business sample's picks were the category's generic catch-alls ("Clinical Field
// Specialist", "Bank Operations Imaging Specialist") — the SCORE_CAP most recent postings were all that was scored. The
// postings scored are now those whose title is closest to the résumé's target title. Synthetic postings; fictional résumé.

const RESUME = `Pat Example\npat@example.com\n\nSKILLS\nFinance: forecasting, variance analysis, budgeting, Excel, SQL, Power BI\n\nEXPERIENCE\nFinancial Analyst, Example Co\n- Built the monthly forecast and variance analysis in Excel and SQL.`;

function board() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  const ins = db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, _hash, title, company, url, source, is_active, discovered_at,
    description, board_category, bucket_seniority, soc) VALUES (?, 't', ?, ?, ?, ?, 'greenhouse', 1, unixepoch() - ?, ?, 'business', 'mid', ?)`);
  // The newest SCORE_CAP + 30 are catch-all specialists that name the résumé's skills; the 12 analysts are OLDER.
  let i = 0;
  for (; i < SCORE_CAP + 30; i++) ins.run(`spec-${i}`, `h-s${i}`, "Operations Specialist", `Co${i}`, `https://example.com/s${i}`, i,
    `Excel, SQL, forecasting and budgeting for the operations desk ${i}.`, "13-1199");
  for (let k = 0; k < 12; k++, i++) ins.run(`fa-${k}`, `h-f${k}`, k % 2 ? "Financial Analyst" : "Senior Financial Analyst, FP&A", `Fin${k}`,
    `https://example.com/f${k}`, i, `Forecasting, variance analysis, budgeting, Excel, SQL, Power BI. Desk ${k}.`, "13-2051");
  return db;
}

test("a111PicksSteerToTargetTitle: the résumé's own occupation is scored first, not only the newest catch-alls", async () => {
  clearPicksCache();
  const db = board();
  const steered = await picksFor(db, { category: "business", seniority: "mid", resumeText: RESUME, targets: ["Financial Analyst"] });
  assert.equal(steered.length, 10);
  assert.ok(steered.every(p => p.job_id.startsWith("fa-")), steered.map(p => p.title).join(" | "));
  // without a target title it is the old order (the newest SCORE_CAP), which never reaches the older analysts
  clearPicksCache();
  const plain = await picksFor(db, { category: "business", seniority: "mid", resumeText: RESUME });
  assert.ok(plain.every(p => p.job_id.startsWith("spec-")), "no targets: the newest postings, as before");
});
