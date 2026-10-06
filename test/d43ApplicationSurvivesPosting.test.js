// D43 (10-06) — AN APPLICATION RECORD MUST SURVIVE ITS POSTING.
//
// O43 found 4 user_jobs and 4 job_applications rows in production pointing at postings that no longer
// exist (A90). The expiry cleanup's DELETE exempted only STARRED and APPLIED user_jobs rows; every
// other record a user had of a posting — an application whose user_jobs flag was unset, a run-job, a
// capture, an application record in progress — lost its posting under it. ⚠ Not confirmed by job_id
// against cleanup_log id 85 (the 1,288-row delete): production reads were refused this session.
//
// The rule: a record of something the user DID must not depend on a row the system can delete.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { recordSubmission, listHistory } from "../services/applicationRecords.js";
import { userReferencedSql, isUserReferenced } from "../services/jobs/userReferences.js";
import { at } from "../test-support/sourceAnchors.js";

const NOW = Math.floor(Date.now() / 1000);

function seed() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'ada','x')").run();
  db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,url,apply_url,location,salary_min,salary_max,salary_currency,
                                        search_query,_hash,discovered_at,scraped_at)
              VALUES ('j1','Backend Engineer','Northwind','https://northwind.example/jobs/1',
                      'https://job-boards.greenhouse.io/northwind/jobs/1','Boston, MA',150000,180000,'USD','t','h1',?,?),
                     ('j2','Data Engineer','Contoso','https://contoso.example/jobs/2',
                      'https://contoso.example/jobs/2','Austin, TX',NULL,NULL,NULL,'t','h2',?,?)`)
    .run(NOW - 30 * 86400, NOW - 30 * 86400, NOW - 30 * 86400, NOW - 30 * 86400);
  return db;
}
const apply = (db, jobId = "j1") => recordSubmission(db, { userId: 1, jobId,
  input: { submittedAt: (NOW - 3600) * 1000, method: "company_site", reference: "R-1042" } });

test("D43 · applying SNAPSHOTS the posting — company, title, URL, location and the pay", () => {
  const db = seed();
  apply(db);
  const ja = db.prepare("SELECT * FROM job_applications WHERE user_id = 1 AND job_id = 'j1'").get();
  assert.equal(ja.company, "Northwind");
  assert.equal(ja.role, "Backend Engineer");
  assert.match(ja.job_url, /greenhouse\.io\/northwind\/jobs\/1/);
  assert.equal(ja.location, "Boston, MA");
  assert.deepEqual([ja.salary_min, ja.salary_max, ja.salary_currency], [150000, 180000, "USD"], "migration 129");
});

test("D43 · apply → the posting is DELETED anyway → the application still renders, labelled", () => {
  const db = seed();
  apply(db);
  db.prepare("DELETE FROM scraped_jobs WHERE job_id = 'j1'").run();   // a delete from outside the guards
  const [row] = listHistory(db, 1).filter(r => r.jobId === "j1");
  assert.equal(row.company, "Northwind", "the company is the record's own");
  assert.equal(row.title, "Backend Engineer");
  assert.equal(row.postingListed, false, "and it says the posting is no longer listed");
  const ui = fs.readFileSync("client/src/components/ApplicationHistory.jsx", "utf8");
  assert.match(ui, /row\.postingListed === false \? " · posting no longer listed"/);
  const table = fs.readFileSync("server.js", "utf8");
  assert.match(table, /postingListed:\s+r\.sj_job_id != null/, "the spreadsheet view says so too");
  assert.match(table, /salaryMin:\s+r\.sj_salary_min\s+\|\| r\.salary_min/, "and falls back to the snapshot pay");
});

test("D43 · a delete of a REFERENCED posting is refused by every delete path — it is retired instead", () => {
  const db = seed();
  apply(db);
  assert.equal(isUserReferenced(db, "j1"), true);
  assert.equal(isUserReferenced(db, "j2"), false);
  // The expiry cleanup's own predicate, read out of server.js and interpolated as the template does.
  const server = fs.readFileSync("server.js", "utf8").replace(/\r\n/g, "\n");
  const fn = server.slice(at(server, "function runExpiredJobsCleanup()"), at(server, 'cron.schedule("0 3 * * *"'));
  const predicate = fn.slice(at(fn, "const EXPIRED_PREDICATE = `") + "const EXPIRED_PREDICATE = `".length,
                             at(fn, "`;", at(fn, "const EXPIRED_PREDICATE = `")))
    .replace('${userReferencedSql("scraped_jobs.job_id")}', userReferencedSql("scraped_jobs.job_id"));
  const deleted = db.prepare(`DELETE FROM scraped_jobs WHERE ${predicate}`).run(NOW - 7 * 86400).changes;
  assert.equal(deleted, 1, "only the posting nobody references");
  assert.ok(db.prepare("SELECT 1 FROM scraped_jobs WHERE job_id = 'j1'").get(), "the applied-to posting survives");
  // The blue-collar reject and the reclassify script use the same guard.
  assert.match(fs.readFileSync("services/jobs/aggregator.js", "utf8"), /deleteJobStmt:\s+guardedDelete\(db\)/);
  assert.match(fs.readFileSync("scripts/reclassifyJobs.js", "utf8"), /AND NOT \$\{userReferencedSql\("scraped_jobs\.job_id"\)\}/);
  // Every kind of user record protects its posting.
  for (const t of ["user_jobs", "job_applications", "apply_run_jobs", "application_records", "job_captures"]) {
    assert.match(userReferencedSql("x"), new RegExp(`FROM ${t} `), `${t} must protect its posting`);
  }
});

test("D43 · a run-job SNAPSHOTS the posting it was queued for (migration 129)", () => {
  const src = fs.readFileSync("routes/apply.js", "utf8");
  assert.match(src, /UPDATE apply_run_jobs SET\s+posting_title\s+= \(SELECT sj\.title FROM scraped_jobs sj WHERE sj\.job_id = apply_run_jobs\.job_id\)/);
  assert.match(src, /posting_url\s+= \(SELECT COALESCE\(sj\.apply_url, sj\.url\) FROM scraped_jobs sj/);
  assert.match(src, /snapshotJob\?\.run\(runId\);/, "run inside the same transaction as the insert");
  const db = seed();
  const cols = db.prepare("PRAGMA table_info(apply_run_jobs)").all().map(c => c.name);
  for (const c of ["posting_title", "posting_company", "posting_url", "posting_location"]) assert.ok(cols.includes(c), c);
});
