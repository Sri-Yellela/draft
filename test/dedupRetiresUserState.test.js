// A49 fix 4 — when dedup decides a row is a duplicate, every user's Saves, Passes and applications
// move to (resolve to) the canonical row. Never lost, never duplicated. And a user's own import that
// matches a posting already on the board is attached to that row and SAYS so.
//
// Before: the demotion was a bare `is_active = 0`. user_jobs / job_applications / resumes stayed on
// the demoted job_id, so a Saved job vanished from Saved, a Passed job was dealt again (a Pass is the
// persisted "never deal again" decision) and an applied job read as un-applied. A star on a job_id that
// folded without ever getting a row was worse: the 7-day cleanup's orphan cascade deletes user_jobs
// whose job_id has no scraped_jobs row.
//
// Real schema (every migration, 116 included); synthetic users, companies and postings.
import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { reconcileFingerprint, upsertCanonicalJob } from "../services/jobs/aggregator.js";
import { normalizeJob } from "../services/jobs/schema.js";
import { restoreRetiredDuplicate, mergeUserJobRows } from "../services/jobs/dedupRetire.js";
import { importJob } from "../services/jobs/importJob.js";

const VERDICT = { roleKey: "engineering", seniority: "mid", domain: "software", collar: "white", confidence: 0.9 };
const UUID = "0a1b2c3d-1111-4a4a-8b8b-000000000001";
const ATS = { id: UUID, req_id: UUID, source: "ashby", url: `https://jobs.ashbyhq.com/examplecorp/${UUID}` };
const AGG = { id: "adz-9", source: "adzuna", url: "https://www.adzuna.com/land/ad/9" };

function board() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.exec(`INSERT INTO users (id, username, password_hash) VALUES (1,'synthetic-a','x'),(2,'synthetic-b','x'),(3,'synthetic-c','x');`);
  return db;
}

function write(db, fields) {
  const job = normalizeJob({ title: "Backend Engineer", company: "Examplecorp", location: "Austin, TX",
                             description: "Build services.", ...fields });
  const dedup = reconcileFingerprint(db, { ...job, company_icon_url: null });
  if (dedup.action === "fold") return { folded: true, into: dedup.intoJobId, id: job.id };
  upsertCanonicalJob(db, {
    jobId: job.id, canonical: dedup.job, verdict: VERDICT, contentHash: "h:" + job.id,
    searchQuery: job.source, sourceLabel: job.source, matchedBy: job.source, dedup, now: 1_790_000_000,
  });
  return { folded: false, into: job.id, id: job.id };
}

const uj = (db, sql = "", ...a) => db.prepare(`SELECT user_id, job_id, starred, disliked, applied FROM user_jobs ${sql} ORDER BY user_id`).all(...a);

test("the ATS copy outranks the aggregator row: Saves, Passes and an application move to it", () => {
  const db = board();
  write(db, AGG);
  const ins = db.prepare("INSERT INTO user_jobs (user_id, job_id, starred, disliked, applied, updated_at) VALUES (?,?,?,?,?,?)");
  ins.run(1, "adzuna::adz-9", 1, 0, 0, 100);   // saved
  ins.run(2, "adzuna::adz-9", 0, 1, 0, 100);   // passed
  ins.run(3, "adzuna::adz-9", 0, 0, 1, 100);   // applied
  db.prepare("INSERT INTO job_applications (user_id, job_id, company, role) VALUES (3, 'adzuna::adz-9', 'Examplecorp', 'Backend Engineer')").run();
  db.prepare("INSERT INTO resumes (user_id, job_id, company, role, html) VALUES (3, 'adzuna::adz-9', 'Examplecorp', 'Backend Engineer', '<p/>')").run();

  write(db, ATS);
  const canon = `ashby::${UUID}`;

  assert.deepEqual(uj(db), [
    { user_id: 1, job_id: canon, starred: 1, disliked: 0, applied: 0 },
    { user_id: 2, job_id: canon, starred: 0, disliked: 1, applied: 0 },
    { user_id: 3, job_id: canon, starred: 0, disliked: 0, applied: 1 },
  ], "every decision now sits on the row the board shows");
  assert.equal(db.prepare("SELECT job_id FROM job_applications WHERE user_id = 3").get().job_id, canon);
  assert.equal(db.prepare("SELECT job_id FROM resumes WHERE user_id = 3").get().job_id, canon);

  const retired = db.prepare("SELECT is_active, duplicate_of, retired_reason, retired_at FROM scraped_jobs WHERE job_id = 'adzuna::adz-9'").get();
  assert.equal(retired.is_active, 0);
  assert.equal(retired.duplicate_of, canon, "the retirement names its canonical row");
  assert.equal(retired.retired_reason, "duplicate");
  assert.ok(retired.retired_at > 0);
  const log = db.prepare("SELECT * FROM job_dedup_log").all();
  assert.equal(log.length, 1, "one retirement, one log row");
  assert.deepEqual(JSON.parse(log[0].moved_json).user_jobs_moved.length, 3);
});

test("a user who acted on BOTH copies keeps one row — the latest verdict wins, facts are OR'd", () => {
  const db = board();
  write(db, AGG);
  write(db, { ...ATS, location: "Austin, TX" }); // the ATS row exists; AGG is retired into it
  // Re-activate the aggregator copy as if it had been on the board when the user acted on it, then
  // let a re-crawl of the ATS row reconcile against it again.
  db.prepare("UPDATE scraped_jobs SET is_active = 1, duplicate_of = NULL WHERE job_id = 'adzuna::adz-9'").run();
  db.prepare("UPDATE scraped_jobs SET is_active = 0 WHERE job_id = ?").run(`ashby::${UUID}`);
  const ins = db.prepare("INSERT INTO user_jobs (user_id, job_id, starred, disliked, applied, visited, updated_at) VALUES (?,?,?,?,?,?,?)");
  ins.run(1, "adzuna::adz-9", 1, 0, 0, 1, 100);       // saved the aggregator copy first
  ins.run(1, `ashby::${UUID}`, 0, 1, 0, 0, 200);      // later passed the ATS copy
  write(db, ATS);
  const rows = uj(db, "WHERE user_id = 1");
  assert.equal(rows.length, 1, "never two decisions for one posting");
  assert.equal(rows[0].job_id, `ashby::${UUID}`);
  assert.equal(rows[0].disliked, 1, "the later decision (Pass) stands");
  assert.equal(rows[0].starred, 0);
  assert.equal(db.prepare("SELECT visited FROM user_jobs WHERE user_id = 1").get().visited, 1, "facts are OR'd");
});

test("mergeUserJobRows: applied survives any verdict; agreement is kept; disagreement → latest", () => {
  assert.deepEqual(
    { ...mergeUserJobRows({ starred: 1, updated_at: 5 }, { disliked: 1, applied: 1, updated_at: 9 }) },
    { visited: 0, applied: 1, resume_generated: 0, starred: 0, disliked: 1, domain_profile_id: null, updated_at: 9 });
  assert.equal(mergeUserJobRows({ starred: 1, updated_at: 9 }, { disliked: 1, updated_at: 5 }).starred, 1);
  assert.equal(mergeUserJobRows({ starred: 1 }, { starred: 1 }).starred, 1);
});

test("a star on a live-search id that FOLDS (no row of its own) moves to the canonical row", () => {
  const db = board();
  write(db, ATS);
  db.prepare("INSERT INTO user_jobs (user_id, job_id, starred) VALUES (1, 'adzuna::adz-9', 1)").run();
  const r = write(db, AGG);
  assert.equal(r.folded, true);
  assert.deepEqual(uj(db), [{ user_id: 1, job_id: `ashby::${UUID}`, starred: 1, disliked: 0, applied: 0 }],
    "otherwise the cleanup's orphan cascade deletes it: its job_id has no scraped_jobs row");
});

test("re-crawling an already-retired duplicate is a no-op — no log spam, no churn", () => {
  const db = board();
  write(db, AGG);
  write(db, ATS);
  write(db, AGG);
  write(db, AGG);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM job_dedup_log").get().n, 1);
});

test("a retirement is restorable: the row comes back, the users' state goes back, and dedup keeps them apart", () => {
  const db = board();
  write(db, AGG);
  db.prepare("INSERT INTO user_jobs (user_id, job_id, starred, updated_at) VALUES (1, 'adzuna::adz-9', 1, 100)").run();
  db.prepare("INSERT INTO job_applications (user_id, job_id, company, role) VALUES (1, 'adzuna::adz-9', 'Examplecorp', 'Backend Engineer')").run();
  write(db, ATS);

  const r = restoreRetiredDuplicate(db, "adzuna::adz-9");
  assert.equal(r.restored, true);
  const row = db.prepare("SELECT is_active, duplicate_of, retired_reason FROM scraped_jobs WHERE job_id = 'adzuna::adz-9'").get();
  assert.deepEqual({ ...row }, { is_active: 1, duplicate_of: null, retired_reason: null });
  assert.deepEqual(uj(db).map(x => x.job_id), ["adzuna::adz-9"], "the Save is back where the user made it");
  assert.equal(db.prepare("SELECT job_id FROM job_applications").get().job_id, "adzuna::adz-9");

  // The next crawl of either copy must not merge them again.
  write(db, ATS);
  const r2 = write(db, AGG);
  assert.equal(r2.folded, false, "a pair restored apart stays apart");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM scraped_jobs WHERE is_active = 1").get().n, 2);
});

test("a user's import of a posting already on the board ATTACHES to it and says so", async () => {
  const db = board();
  write(db, ATS);
  // The extension's labelled block — since D33 the only extraction is deterministic (no model).
  const res = await importJob(
    { url: "https://www.linkedin.com/jobs/view/4100000001",
      text: "Title: Backend Engineer\nCompany: Examplecorp\nLocation: Austin, TX\nBuild services." },
    { db, userId: 2 },
  );
  assert.equal(res.attachedToExisting, true, "the response must say the capture matched an existing row");
  assert.equal(res.existingJobId, `ashby::${UUID}`);
  assert.equal(res.job.id, `ashby::${UUID}`);
  assert.match(res.message, /already on the board/);
  assert.deepEqual(uj(db, "WHERE user_id = 2"), [{ user_id: 2, job_id: `ashby::${UUID}`, starred: 0, disliked: 0, applied: 0 }],
    "and it is the importer's own (D41(a): attached, not starred) — never silently dropped");
});
