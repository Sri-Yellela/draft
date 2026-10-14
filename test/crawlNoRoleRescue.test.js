// The crawl's no-family branch: the CS rescue must run there, and what it still refuses is recorded.
//
// DEFECT A — services/jobs/csScope.js deliberately brings in a clear CS title the classifier could not
// place (UNPLACED includes null; the CS_TITLE rules). cacheJobs `continue`d on `roleKey === null` before
// the scope gate ever ran, so in a crawl the rescue could not fire: "Full-Stack SWE, Data Acquisition",
// "TPM Manager, Infrastructure", "Research Manager, Interpretability", "SWE Fellow" were dropped every day.
//
// DEFECT C — the ~1,840 postings greenhouse drops each day for having no role family left no per-posting
// record in rejected_jobs (every other refusal does), so no breakdown of them was possible.
//
// These drive WHOLE crawls through cacheJobs with a fake source (the d82RetireRule harness). Synthetic
// postings only.
import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { cacheJobs, NO_ROLE_REASON } from "../services/jobs/aggregator.js";
import { classifyJob, ROLE_KEY_FALLBACK } from "../services/jobs/classifyJob.js";
import { normalizeJob } from "../services/jobs/schema.js";

const HOUR = 3600;
const T0 = 1_900_000_000;

function freshDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("UPDATE company_ats_list SET active = 0").run();
  db.prepare("INSERT OR IGNORE INTO company_ats_list (company, ats_type, ats_slug, active) VALUES ('Synthco', 'greenhouse', 'synthco', 1)").run();
  return db;
}

// A deliberately thin description, so the TITLE is what the classifier has to go on.
function posting(n, title) {
  return normalizeJob({
    id: `nr-${n}`, req_id: `nr-${n}`, title, company: "Synthco", location: "Austin, TX",
    url: `https://job-boards.greenhouse.io/synthco/jobs/${n}`, source: "greenhouse",
    description: "Synthco is hiring in Austin, TX. Join our team.",
    posted_at: new Date((T0 - 2 * 24 * HOUR) * 1000).toISOString(),
  });
}

async function crawlAt(db, hours, jobs) {
  const source = { name: "greenhouse", isConfigured: () => true, search: async () => ({ jobs }) };
  const realNow = Date.now;
  Date.now = () => (T0 + hours * HOUR) * 1000;
  try { await cacheJobs(db, null, { sources: [source] }); }
  finally { Date.now = realNow; }
  return db.prepare("SELECT * FROM pipeline_runs WHERE source = 'greenhouse' ORDER BY id DESC LIMIT 1").get();
}

const row     = (db, id) => db.prepare("SELECT is_active, bucket_role FROM scraped_jobs WHERE job_id = ?").get(id);
const roles   = (db, id) => db.prepare("SELECT role_key FROM job_role_map WHERE job_id = ? ORDER BY role_key").pluck().all(id);
const reasons = (db, id) => db.prepare("SELECT reason FROM rejected_jobs WHERE job_id = ?").pluck().all(id);

const RESCUED = [
  posting(1, "Full-Stack SWE, Data Acquisition"),
  posting(2, "TPM Manager, Infrastructure"),
  posting(3, "Research Manager, Interpretability"),
  posting(4, "SWE Fellow"),
];
const CLAIMS = posting(5, "Complex Claims Manager");
const BACKEND = posting(6, "Backend Software Engineer");

test("the premise: the classifier places none of these titles (roleKey null, white collar)", () => {
  for (const j of [...RESCUED, CLAIMS]) {
    const v = classifyJob(j.title, j.description, j.company);
    assert.equal(v.collar, "white", j.title);
    assert.equal(v.roleKey, null, `${j.title} must reach the crawl's no-family branch`);
  }
  assert.equal(classifyJob(BACKEND.title, BACKEND.description, BACKEND.company).roleKey, "engineering");
});

test("DEFECT A: a clear CS title with no family is written and active, under the fallback key", async () => {
  const db = freshDb();
  const run = await crawlAt(db, 0, [...RESCUED, CLAIMS, BACKEND]);
  assert.equal(run.status, "ok");
  for (const j of RESCUED) {
    assert.deepEqual(row(db, j.id), { is_active: 1, bucket_role: ROLE_KEY_FALLBACK }, `${j.title} is on the board`);
    assert.deepEqual(roles(db, j.id), [ROLE_KEY_FALLBACK], `${j.title} is filed under the fallback key, no invented family`);
    assert.deepEqual(reasons(db, j.id), [], `${j.title} carries no refusal`);
  }
  // An ordinary classified posting is untouched by the change.
  assert.deepEqual(row(db, BACKEND.id), { is_active: 1, bucket_role: "engineering" });
  assert.deepEqual(roles(db, BACKEND.id), ["engineering"]);
});

test("DEFECT C: a no-family posting with no CS signal is NOT written and is recorded as no_role", async () => {
  assert.equal(NO_ROLE_REASON, "no_role");
  const db = freshDb();
  const run = await crawlAt(db, 0, [...RESCUED, CLAIMS, BACKEND]);
  assert.equal(row(db, CLAIMS.id), undefined, "Complex Claims Manager is never written");
  assert.deepEqual(roles(db, CLAIMS.id), []);
  const rec = db.prepare("SELECT * FROM rejected_jobs WHERE job_id = ?").get(CLAIMS.id);
  assert.equal(rec.reason, "no_role");
  assert.equal(rec.title, "Complex Claims Manager");
  assert.equal(rec.company, "Synthco");
  assert.equal(rec.source, "greenhouse");
  assert.equal(rec.rejected_at, T0);

  // `dropped` keeps its meaning — postings refused for having no role family — and equals the records.
  assert.equal(run.dropped, 1, "only the claims posting is dropped; the four rescued ones are written");
  assert.equal(run.written, 5, "four rescued + the backend posting");
  assert.equal(db.prepare("SELECT COUNT(*) FROM rejected_jobs WHERE reason = 'no_role'").pluck().get(), run.dropped);
  assert.equal(JSON.parse(run.details_json).rescued, 4, "the rescue is counted on its own");
});

test("a re-crawl re-records the same refusal in place (one row per posting, not one per crawl)", async () => {
  const db = freshDb();
  await crawlAt(db, 0, [CLAIMS, BACKEND]);
  const run = await crawlAt(db, 24, [CLAIMS, BACKEND]);
  assert.equal(run.dropped, 1);
  const recs = db.prepare("SELECT reason, rejected_at FROM rejected_jobs WHERE job_id = ?").all(CLAIMS.id);
  assert.deepEqual(recs, [{ reason: "no_role", rejected_at: T0 + 24 * HOUR }]);
});

test("⛔ a no_role record never blocks the posting: re-classified later, it is written and the record cleared", async () => {
  const db = freshDb();
  await crawlAt(db, 0, [CLAIMS, BACKEND]);
  assert.deepEqual(reasons(db, CLAIMS.id), ["no_role"]);
  // The employer retitles the same requisition (same id) — the classifier now places it.
  const retitled = { ...posting(5, "Senior Backend Software Engineer") };
  const run = await crawlAt(db, 24, [retitled, BACKEND]);
  assert.equal(run.dropped, 0);
  assert.deepEqual(row(db, CLAIMS.id), { is_active: 1, bucket_role: "engineering" }, "written and on the board");
  assert.deepEqual(roles(db, CLAIMS.id), ["engineering"]);
  assert.deepEqual(reasons(db, CLAIMS.id), [], "the stale no_role record is cleared, so no report counts it");
});

test("the clear is scoped to no_role: another gate's record for a written posting is not touched", async () => {
  const db = freshDb();
  db.prepare("INSERT INTO rejected_jobs (job_id, title, company, source, reason, rejected_at) VALUES (?, ?, 'Synthco', 'greenhouse', 'out_of_scope', 1)")
    .run(BACKEND.id, BACKEND.title);
  await crawlAt(db, 0, [BACKEND]);
  assert.deepEqual(reasons(db, BACKEND.id), ["out_of_scope"]);
});
