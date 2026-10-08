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

test("⛔ D80 E: the weekly cron only REPORTS, and Admin shows the proposals beside the Disable button", () => {
  const src = fs.readFileSync("server.js", "utf8").replace(/\r\n/g, "\n");
  const start = at(src, 'cron.schedule("0 5 * * 1"');
  const body = src.slice(start, at(src, "\n});", start));
  assert.match(body, /heatReport\(db\)/);
  assert.doesNotMatch(body, /setCompanyActive|UPDATE|active\s*=\s*0/, "the cron never deactivates");
  assert.doesNotMatch(fs.readFileSync("services/companyHeat.js", "utf8").replace(/^\s*\/\/.*$/gm, ""), /\b(UPDATE|INSERT|DELETE)\b|\.run\(/, "the heat report never writes");
  const ui = fs.readFileSync("client/src/panels/adminOps.jsx", "utf8");
  assert.match(ui, /data-company-heat/);
  assert.match(ui, /Proposed for deactivation/);
});
