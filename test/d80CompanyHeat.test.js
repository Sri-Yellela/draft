// ⛔ D80 E · THE LOOP — hiring heat per configured company. Each red when removed:
// hot ≤ 30 days / warm ≤ 60 / dormant past 60 — by the CRAWL's first-seen clock · a newly added company with
// nothing yet is on probation, not dormant · a row the scope sweep retired as out_of_scope is NOT heat · dormant
// companies are PROPOSED and nothing is deactivated · the summary measures against the 80% target and leaves
// probation out of it · the weekly cron only reports.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { at } from "../test-support/sourceAnchors.js";
import { heatOf, heatReport, HOT_DAYS, DORMANT_DAYS } from "../services/companyHeat.js";

const DAY = 86400;
const NOW = Math.floor(Date.parse("2026-10-08T12:00:00Z") / 1000);

test("⛔ D80 E: hot ≤ 30 days, warm ≤ 60, dormant past 60; a new company with nothing yet is on probation", () => {
  assert.equal(heatOf({ last_new_at: NOW - 5 * DAY, created_at: NOW - 400 * DAY }, NOW), "hot");
  assert.equal(heatOf({ last_new_at: NOW - (HOT_DAYS + 1) * DAY, created_at: NOW - 400 * DAY }, NOW), "warm");
  assert.equal(heatOf({ last_new_at: NOW - (DORMANT_DAYS + 1) * DAY, created_at: NOW - 400 * DAY }, NOW), "dormant");
  assert.equal(heatOf({ last_new_at: null, created_at: NOW - 400 * DAY }, NOW), "dormant", "never posted, long configured");
  assert.equal(heatOf({ last_new_at: null, created_at: NOW - 3 * DAY }, NOW), "probation", "it has not had the chance to post");
});

function db0() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.exec("UPDATE company_ats_list SET active = 0");      // the seeded companies are not under test
  return db;
}
const company = (db, name, slug, created) => db.prepare("INSERT INTO company_ats_list (company, ats_type, ats_slug, active, created_at, evidence) VALUES (?, 'ashby', ?, 1, ?, 'test')").run(name, slug, created);
const posting = (db, id, name, seen, active = 1) => db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, _hash, title, company, url, source, is_active, discovered_at)
  VALUES (?, 't', ?, 'Software Engineer', ?, ?, 'ashby', ?, ?)`).run(id, `h-${id}`, name, `https://example.com/${id}`, active, seen);

test("⛔ D80 E: an out_of_scope row is not heat; dormant companies are PROPOSED and nothing is deactivated", () => {
  const db = db0();
  company(db, "Hot Co", "hot", NOW - 400 * DAY);
  company(db, "Sleepy Co", "sleepy", NOW - 400 * DAY);
  company(db, "Fresh Co", "fresh", NOW - 2 * DAY);
  posting(db, "h1", "Hot Co", NOW - 3 * DAY);
  posting(db, "s1", "Sleepy Co", NOW - 200 * DAY, 0);
  posting(db, "s2", "Sleepy Co", NOW - 5 * DAY, 0);                // recent — but the scope sweep retired it
  db.prepare("INSERT INTO rejected_jobs (job_id, title, company, source, reason, rejected_at) VALUES ('s2', 'Recruiter', 'Sleepy Co', 'ashby', 'out_of_scope', ?)").run(NOW);
  const r = heatReport(db, { now: NOW });
  const by = Object.fromEntries(r.companies.map((c) => [c.company, c.heat]));
  assert.deepEqual(by, { "Fresh Co": "probation", "Hot Co": "hot", "Sleepy Co": "dormant" });
  assert.deepEqual(r.proposals.map((p) => p.company), ["Sleepy Co"]);
  assert.match(r.proposals[0].why, /no new in-scope posting for 200 days/);
  assert.equal(db.prepare("SELECT COUNT(*) FROM company_ats_list WHERE active = 1").pluck().get(), 3, "a proposal deactivates nothing");
  assert.deepEqual([r.summary.hot, r.summary.dormant, r.summary.probation, r.summary.hotShare, r.summary.meetsTarget], [1, 1, 1, 0.5, false],
    "probation is left out of the share; 1 of 2 judged is below the 80% target");
});

test("⭐ D170 (4): a working board whose every posting is outside the US is PROPOSED too — with its own reason; one US posting keeps it off", () => {
  const db = db0();
  company(db, "Abroad Co", "abroad", NOW - 2 * DAY);          // new — would be probation, but it already shows only non-US postings
  company(db, "Mixed Co", "mixed", NOW - 400 * DAY);
  posting(db, "m1", "Mixed Co", NOW - 3 * DAY);
  const held = db.prepare("INSERT INTO rejected_jobs (job_id, title, company, source, reason, rejected_at) VALUES (?, 'Software Engineer', ?, 'ashby', 'out_of_market:non_us', ?)");
  for (const id of ["a1", "a2", "a3"]) held.run(id, "Abroad Co", NOW);
  held.run("m2", "Mixed Co", NOW);
  const r = heatReport(db, { now: NOW });
  assert.deepEqual(r.proposals.map((p) => [p.company, p.kind]), [["Abroad Co", "outside_us"]]);
  assert.equal(r.proposals[0].why, "every posting it returns (3) is outside the US");
  assert.equal(db.prepare("SELECT COUNT(*) FROM company_ats_list WHERE active = 1").pluck().get(), 2, "a proposal deactivates nothing");
});

test("⛔ D80 E: the weekly cron only REPORTS, and Admin shows the proposals beside the Disable button", () => {
  const src = fs.readFileSync("server.js", "utf8").replace(/\r\n/g, "\n");
  const start = at(src, 'cron.schedule("0 5 * * 1"');
  const body = src.slice(start, at(src, "\n});", start));
  assert.match(body, /heatReport\(db, \{ counts: await boardCountsVia\(readPool\) \}\)/);   // A162: the posting pass runs on the read pool
  assert.doesNotMatch(body, /setCompanyActive|UPDATE|active\s*=\s*0/, "the cron never deactivates");
  assert.doesNotMatch(fs.readFileSync("services/companyHeat.js", "utf8").replace(/^\s*\/\/.*$/gm, ""), /\b(UPDATE|INSERT|DELETE)\b|\.run\(/, "the heat report never writes");
  const ui = fs.readFileSync("client/src/panels/adminOps.jsx", "utf8");
  assert.match(ui, /data-company-heat/);
  assert.match(ui, /Proposed for deactivation/);
});

// ⛔ A162 (46a): opening Admin → Companies froze production for minutes — heatReport and listCompanies ran correlated
// subqueries on lower(company) PER COMPANY, each a whole scan of scraped_jobs. Now ONE grouped pass answers them all.
test("A162: the heat report and the company list read the postings in ONE pass, whatever the number of companies", async () => {
  const { boardCounts, boardCountsVia } = await import("../services/companyHeat.js");
  const { listCompanies } = await import("../services/companyList.js");
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.exec("DELETE FROM company_ats_list");
  const add = db.prepare("INSERT INTO company_ats_list (company, ats_type, ats_slug, active, created_at, evidence) VALUES (?, ?, ?, 1, ?, 'test')");
  for (let i = 0; i < 40; i++) add.run(`Co ${i}`, "ashby", `co${i}`, NOW - 400 * 86400);
  posting(db, 'a1', 'CO 1', NOW - 5 * 86400); posting(db, 'a2', 'co 1', NOW - 90 * 86400, 0); posting(db, 'a3', 'Co 2', NOW - 45 * 86400);
  let scans = 0;
  const prepare = db.prepare.bind(db);
  const counting = new Proxy(db, { get: (t, p) => p === "prepare" ? (sql) => { if (/FROM scraped_jobs/.test(sql)) scans++; return prepare(sql); } : (typeof t[p] === "function" ? t[p].bind(t) : t[p]) });
  const r = heatReport(counting, { now: NOW });
  assert.equal(scans, 1, "one pass over scraped_jobs for 40 companies");
  const by = Object.fromEntries(r.companies.map(c => [c.company, c]));
  assert.deepEqual([by["Co 1"].active_rows, by["Co 1"].new_30d, by["Co 1"].heat], [1, 1, "hot"], "the company name matches case-insensitively, as before");
  assert.equal(by["Co 2"].heat, "warm"); assert.equal(by["Co 3"].heat, "dormant"); assert.equal(by["Co 3"].active_rows, 0);
  const counts = boardCounts(db, { now: NOW });
  const viaPool = await boardCountsVia({ all: async (sql, params) => db.prepare(sql).all(...params) }, { now: NOW });
  assert.deepEqual([...viaPool.entries()], [...counts.entries()], "the read pool's pass is the same pass");
  const list = Object.fromEntries(listCompanies(db, { counts }).map(c => [c.company, c]));
  assert.deepEqual([list["Co 1"].active_rows, list["Co 1"].last_new_at], [1, NOW - 5 * 86400], "the list's last_new_at is the newest row, active or not");
  const route = fs.readFileSync("routes/companies.js", "utf8");
  assert.match(route, /await boardCountsVia\(read, \{ now \}\)/, "Admin → Companies runs the pass on the read pool");
});
