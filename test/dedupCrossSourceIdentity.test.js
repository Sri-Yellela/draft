// A49 fix 1 — the same posting from two sources must MERGE under the canonical priority
// (direct ATS > provider > aggregator > import), WITHOUT merging distinct req ids or different cities.
//
// The defect: computeReqUid namespaced a requisition id by the source that CARRIED it, so Jobo's copy
// of an Ashby posting got `jobo:acme:<jobo id>` while the Ashby crawl wrote `ashby:acme:<uuid>`.
// selectMatch read any two different non-null req_uids as distinct sibling requisitions, so the pair
// could never merge — dormant only because Jobo is paused. A company on two ATSs (mid-migration) had
// the same problem with `greenhouse:` against `ashby:`.
//
// Run against the REAL schema (every migration), with synthetic companies and postings.
import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { reconcileFingerprint, upsertCanonicalJob } from "../services/jobs/aggregator.js";
import { normalizeJob, computeReqUid, atsPostingIdentity, reqUidNamespace } from "../services/jobs/schema.js";

const VERDICT = { roleKey: "engineering", seniority: "mid", domain: "software", collar: "white", confidence: 0.9 };
const UUID_A = "0a1b2c3d-1111-4a4a-8b8b-000000000001";
const UUID_B = "0a1b2c3d-2222-4a4a-8b8b-000000000002";

function board() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  return db;
}

/** One posting through the real normalize -> reconcile -> upsert path every writer uses. */
function write(db, fields) {
  const job = normalizeJob({ title: "Backend Engineer", company: "Examplecorp", location: "Austin, TX",
                             description: "Build services.", ...fields });
  const dedup = reconcileFingerprint(db, { ...job, company_icon_url: null });
  if (dedup.action === "fold") return { folded: true, into: dedup.intoJobId, id: job.id };
  upsertCanonicalJob(db, {
    jobId: job.id, canonical: dedup.job, verdict: VERDICT, contentHash: "h:" + job.id,
    searchQuery: job.source, sourceLabel: job.source, matchedBy: job.source, dedup,
    now: 1_790_000_000,
  });
  return { folded: false, into: job.id, id: job.id };
}

const active = (db) => db.prepare("SELECT job_id, source FROM scraped_jobs WHERE is_active = 1 ORDER BY job_id").all();

const ashby = (uuid, extra = {}) => ({
  id: uuid, req_id: uuid, source: "ashby", url: `https://jobs.ashbyhq.com/examplecorp/${uuid}/application`, ...extra,
});
const jobo = (joboId, url, extra = {}) => ({ id: joboId, req_id: joboId, source: "jobo", url, ...extra });

test("Jobo's copy of an Ashby posting FOLDS into the Ashby row — it no longer reads as a sibling req", () => {
  const db = board();
  write(db, ashby(UUID_A));
  const r = write(db, jobo("jobo-77", `https://jobs.ashbyhq.com/examplecorp/${UUID_A}`));
  assert.equal(r.folded, true, "the provider copy must merge into the direct-ATS row");
  assert.equal(r.into, `ashby::${UUID_A}`);
  assert.deepEqual(active(db).map(x => x.source), ["ashby"], "one board row, the ATS one");
  const row = db.prepare("SELECT sources_seen FROM scraped_jobs WHERE job_id = ?").get(`ashby::${UUID_A}`);
  assert.deepEqual(JSON.parse(row.sources_seen).sort(), ["ashby", "jobo"], "the merge is recorded");
});

test("arriving the other way round, the Ashby crawl outranks and retires the Jobo row", () => {
  const db = board();
  write(db, jobo("jobo-77", `https://jobs.ashbyhq.com/examplecorp/${UUID_A}`));
  write(db, ashby(UUID_A));
  assert.deepEqual(active(db).map(x => x.source), ["ashby"]);
  assert.equal(db.prepare("SELECT is_active FROM scraped_jobs WHERE job_id = 'jobo::jobo-77'").get().is_active, 0,
    "the provider row is retired (soft), not deleted");
});

test("a Jobo copy whose URL names no ATS still merges by fingerprint — its own id is not a req identity across sources", () => {
  const db = board();
  write(db, ashby(UUID_A));
  const r = write(db, jobo("jobo-78", "https://feed.example.test/jobs/78"));
  assert.equal(r.folded, true);
  assert.equal(active(db).length, 1);
});

test("⛔ two DISTINCT Ashby reqs (same title, company, city) both stay — and a Jobo copy lands on the right one", () => {
  const db = board();
  write(db, ashby(UUID_A));
  write(db, ashby(UUID_B));
  assert.equal(active(db).length, 2, "sibling requisitions are two real jobs");
  const r = write(db, jobo("jobo-79", `https://jobs.ashbyhq.com/examplecorp/${UUID_B}`));
  assert.equal(r.into, `ashby::${UUID_B}`, "matched EXACTLY by the home-ATS id, not by fingerprint order");
  assert.equal(active(db).length, 2, "and neither sibling was demoted");
});

test("⛔ an UNIDENTIFIABLE copy of one of two sibling reqs is not guessed into either", () => {
  const db = board();
  write(db, ashby(UUID_A));
  write(db, ashby(UUID_B));
  // Jobo outranks nothing here, but a wrong guess would still donate fields to the wrong sibling;
  // the ambiguity rule gives it its own row instead.
  const r = write(db, jobo("jobo-80", "https://feed.example.test/jobs/80"));
  assert.equal(r.folded, false, "ambiguous → its own row, never a guess");
  const sources = active(db).map(x => x.source).sort();
  assert.deepEqual(sources, ["ashby", "ashby", "jobo"], "both ATS siblings are still on the board");
});

test("⛔ the same role in a DIFFERENT city is never merged across sources", () => {
  const db = board();
  write(db, ashby(UUID_A));
  const r = write(db, jobo("jobo-81", "https://feed.example.test/jobs/81", { location: "Denver, CO" }));
  assert.equal(r.folded, false);
  assert.equal(active(db).length, 2, "one role in two cities is two jobs");
});

test("a company on two ATSs: its Greenhouse and Ashby copies of one posting collapse to one row", () => {
  const db = board();
  write(db, { id: "4100001", req_id: "4100001", source: "greenhouse",
              url: "https://boards.greenhouse.io/examplecorp/jobs/4100001" });
  const r = write(db, ashby(UUID_A));
  assert.equal(r.folded, true, "equal tier → the incumbent stays canonical, the newcomer folds in");
  assert.equal(active(db).length, 1);
});

test("an aggregator echo (no req id, redirect URL) still folds into the ATS row — unchanged", () => {
  const db = board();
  write(db, ashby(UUID_A));
  const r = write(db, { id: "adz-1", source: "adzuna", url: "https://www.adzuna.com/land/ad/1?se=x" });
  assert.equal(r.folded, true);
  assert.equal(active(db).length, 1);
});

test("atsPostingIdentity reads only ids that are actually in the URL", () => {
  assert.deepEqual(atsPostingIdentity(`https://jobs.ashbyhq.com/examplecorp/${UUID_A}/application`),
    { type: "ashby", externalId: UUID_A });
  assert.deepEqual(atsPostingIdentity("https://boards.greenhouse.io/examplecorp/jobs/4100001"),
    { type: "greenhouse", externalId: "4100001" });
  assert.deepEqual(atsPostingIdentity("https://careers.example.test/open?gh_jid=4100001"),
    { type: "greenhouse", externalId: "4100001" }, "Greenhouse's absolute_url is often the company's own page");
  assert.deepEqual(atsPostingIdentity(`https://jobs.lever.co/examplecorp/${UUID_B}`),
    { type: "lever", externalId: UUID_B });
  assert.deepEqual(atsPostingIdentity("https://jobs.smartrecruiters.com/Examplecorp/7440001-backend-engineer"),
    { type: "smartrecruiters", externalId: "7440001" });
  assert.deepEqual(atsPostingIdentity("https://apply.workable.com/j/08717EF2F6/apply"),
    { type: "workable", externalId: "08717EF2F6" });
  for (const u of ["https://jobs.ashbyhq.com/examplecorp", "https://www.adzuna.com/land/ad/1",
                   "not a url", "", null]) {
    assert.equal(atsPostingIdentity(u), null, `no id → no identity: ${u}`);
  }
});

test("computeReqUid: a direct-ATS row keeps its formula; a carrier with an ATS URL takes the ATS's identity", () => {
  assert.equal(computeReqUid({ source: "ashby", company: "Examplecorp", req_id: UUID_A, url: "x" }),
    `ashby:examplecorp:${UUID_A}`, "stored ATS req_uids do not change meaning");
  assert.equal(computeReqUid({ source: "jobo", company: "Examplecorp", req_id: "77",
                               url: `https://jobs.ashbyhq.com/examplecorp/${UUID_A}` }),
    `ashby:examplecorp:${UUID_A}`);
  assert.equal(computeReqUid({ source: "jobo", company: "Examplecorp", req_id: "77", url: "https://feed.example.test/77" }),
    "jobo:examplecorp:77", "no ATS URL → a source-local id, comparable only within its own namespace");
  assert.equal(computeReqUid({ source: "adzuna", company: "Examplecorp", url: "https://www.adzuna.com/land/ad/1" }), null);
  assert.equal(reqUidNamespace("jobo:examplecorp:77"), "jobo");
  assert.equal(reqUidNamespace(null), null);
});
