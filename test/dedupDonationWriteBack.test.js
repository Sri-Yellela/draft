// A49 fix 3 — a duplicate DONATES what the canonical row lacks, on every write path.
//
// The salary-donation path (unionMergeFields) only works if the writer (a) hands the deduper the
// fields and (b) writes what the deduper hands back. Two writers in server.js did neither:
//   - the live-search write-back passed no pay into reconcileFingerprint and its INSERT carried no
//     description and no pay at all, so a live result was born empty and a win lost the donation;
//   - the LinkedIn scrape passed no pay in and inserted item.salary* — its OWN figure — instead of
//     the merged canonical's, so a salary donated by the row it outranked was dropped.
// And in the deduper itself: when the winning job already had a row, the unchanged-crawl path (and
// both INSERT OR IGNORE writers) never rewrote it, so the donation was computed and thrown away.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { reconcileFingerprint, upsertCanonicalJob } from "../services/jobs/aggregator.js";
import { normalizeJob } from "../services/jobs/schema.js";
import { at } from "../test-support/sourceAnchors.js";

const server = fs.readFileSync("server.js", "utf8").replace(/\r\n/g, "\n");
const VERDICT = { roleKey: "engineering", seniority: "mid", domain: "software", collar: "white", confidence: 0.9 };

function board() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  return db;
}
function write(db, f) {
  const job = normalizeJob({ title: "Backend Engineer", company: "Examplecorp", location: "Austin, TX", ...f });
  const dedup = reconcileFingerprint(db, { ...job, company_icon_url: null });
  if (dedup.action === "fold") return dedup;
  upsertCanonicalJob(db, { jobId: job.id, canonical: dedup.job, verdict: VERDICT, contentHash: "h", searchQuery: "s",
    sourceLabel: "s", matchedBy: "t", dedup, now: 1_790_000_000 });
  return dedup;
}

test("a winner whose row ALREADY exists still receives the outranked row's salary and description", () => {
  const db = board();
  // The ATS row exists from an earlier crawl, bare; it then went inactive (say, a missed crawl),
  // and an aggregator row carrying the pay took its place on the board.
  write(db, { id: "4100001", req_id: "4100001", source: "greenhouse", url: "https://boards.greenhouse.io/examplecorp/jobs/4100001" });
  db.prepare("UPDATE scraped_jobs SET is_active = 0 WHERE job_id = 'greenhouse::4100001'").run();
  write(db, { id: "a1", source: "adzuna", url: "https://www.adzuna.com/land/ad/1", description: "Full text.",
              salary_min: 150000, salary_max: 190000, salary_currency: "USD" });
  db.prepare("UPDATE scraped_jobs SET is_active = 1 WHERE job_id = 'greenhouse::4100001'").run();
  db.prepare("UPDATE scraped_jobs SET is_active = 1 WHERE job_id = 'adzuna::a1'").run();
  db.prepare("UPDATE scraped_jobs SET description = NULL WHERE job_id = 'greenhouse::4100001'").run();

  // The ATS crawl re-sees its row UNCHANGED: cacheJobs calls the deduper and then only touches it.
  const ats = normalizeJob({ id: "4100001", req_id: "4100001", source: "greenhouse", title: "Backend Engineer",
    company: "Examplecorp", location: "Austin, TX", url: "https://boards.greenhouse.io/examplecorp/jobs/4100001" });
  const d = reconcileFingerprint(db, { ...ats, company_icon_url: null });
  assert.equal(d.action, "insert_canonical");
  const row = db.prepare("SELECT salary_min, salary_max, salary_currency, description FROM scraped_jobs WHERE job_id = 'greenhouse::4100001'").get();
  assert.deepEqual({ ...row }, { salary_min: 150000, salary_max: 190000, salary_currency: "USD", description: "Full text." },
    "the donation lands on the row even though no upsert follows");
});

test("a provider copy that outranks an aggregator row inherits its pay through the deduper", () => {
  const db = board();
  write(db, { id: "a1", source: "adzuna", url: "https://www.adzuna.com/land/ad/1", salary_min: 150000, salary_max: 190000, salary_currency: "USD" });
  // What the LinkedIn writer now hands the deduper: its own (absent) pay, so the merged canonical
  // carries the donor's — and what it writes is canonical.*.
  const d = reconcileFingerprint(db, { id: "4100000009", url: "https://www.linkedin.com/jobs/view/4100000009",
    title: "Backend Engineer", company: "Examplecorp", location: "Austin, TX", source: "LinkedIn",
    salary_min: null, salary_max: null, salary_currency: null });
  assert.equal(d.action, "insert_canonical");
  assert.equal(d.job.salary_min, 150000);
  assert.equal(d.job.salary_currency, "USD");
});

test("server.js: the LinkedIn writer is gone, so the live-search write-back is its only writer", () => {
  // The LinkedIn scrape's writer (insertMany inside scrapeJobs) was fixed here, then deleted with
  // scrapeJobs on 10-02 (18): A58 had removed its last entry point. Asserted absent so a second
  // writer that bypasses the donation cannot come back unreviewed.
  assert.doesNotMatch(server, /async function scrapeJobs\(/);
  assert.doesNotMatch(server, /harvestapi\/linkedin-job-search/);
});

test("server.js: the live-search write-back carries description and pay, from the merged canonical", () => {
  const block = server.slice(at(server, "Non-blocking write-back of live search results"), at(server, "[Search] Persisted"));
  const sql = block.slice(at(block, "INSERT OR IGNORE INTO scraped_jobs"), at(block, "`);"));
  for (const c of ["description", "salary_min", "salary_max", "salary_currency", "salary_min_usd", "salary_max_usd", "salary_period"]) {
    assert.match(sql, new RegExp(`\\b${c}\\b`), `the INSERT must write ${c}`);
    assert.match(sql, new RegExp(`@${c}\\b`));
  }
  const call = block.slice(at(block, "reconcileFingerprint(db, {"), at(block, "if (dedup.action === 'fold')"));
  assert.match(call, /salary_min:\s+j\.salary_min/, "the pay must reach the deduper to be donated");
  const run = block.slice(at(block, "insert.run({"));
  assert.match(run, /description:\s+canonical\.description/);
  assert.match(run, /salary_min:\s+canonical\.salary_min/);
});
