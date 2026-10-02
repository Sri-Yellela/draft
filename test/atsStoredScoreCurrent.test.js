// A STORED ATS SCORE IS SHOWN ONLY WHILE IT IS STILL ABOUT THIS POSTING (A52).
// ================================================================================================
//
// Observed 10-01: a board card's header read "No signal" while its own ATS panel, open beside it,
// read "Strong match". The card read a STORED score; the panel scored FRESH. Reproduced on a copy
// of the local database through the real server (boot precompute over the board with enrichment
// stripped, enrichment restored, compared): the precompute's plan called every row fresh, because
// `basis_hash` (migration 110) covers only the CANDIDATE side — and 238 rows per profile still read
// "not enough signal" that now scored, 63 / 277 more sat in the wrong band.
//
// What these pin:
//   · migration 118 adds `job_hash`, byte-identical in both runners, additive;
//   · atsJobInputHash covers exactly the posting columns the scorer reads — and every one of them
//     is a real scraped_jobs column (the first draft named two that are not, and the boot pass
//     threw);
//   · ⛔ enrichment landing on a scored posting makes its row STALE: the plan re-scores it, and the
//     re-score is the same number the panel computes fresh;
//   · the board never presents a stale stored score (presentedScore → null), basis or posting;
//   · the panel's cache read and every writer carry the posting's hash.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import {
  createBoardFitPrecompute, atsJobInputHash, ATS_JOB_INPUT_FIELDS, storedScoreSql, presentedScore,
} from "../services/jobs/boardFitPrecompute.js";
import { scoreAtsLocally, buildRuntimeAtsBasis, LOCAL_ATS_SOURCE } from "../services/localAtsScorer.js";
import { at } from "../test-support/sourceAnchors.js";

const SERVER = fs.readFileSync("server.js", "utf8");
const RUNNER = fs.readFileSync("scripts/migrations.js", "utf8");
const USER = 7, PROFILE = 70;

function freshDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (?, 'u7', 'x')").run(USER);
  db.prepare(`INSERT INTO domain_profiles
      (id, user_id, profile_name, role_family, domain, seniority, target_titles, selected_keywords,
       selected_verbs, selected_tools, is_active, created_at, updated_at, include_summary, generate_at_queue)
    VALUES (?, ?, 'Eng', 'engineering', 'engineering', 'mid', '[]', '[]', '[]', '[]', 1, 1, 1, 0, 0)`)
    .run(PROFILE, USER);
  return db;
}

// A synthetic candidate and a posting written the way abstract postings are: its prose names almost
// no registry term, so unenriched it declines; enrichment's skills_json is what makes it scorable.
const RESUME = "Backend engineer. Built services in Python and Go on PostgreSQL, Kafka and Kubernetes, " +
               "with Terraform, Docker and Redis. Designed REST APIs and gRPC services.";
const PROSE = "You will shape how our platform grows. Partner with teams across the company, own " +
              "outcomes end to end, and help us raise the bar for what great looks like.";
const ENRICHED = JSON.stringify(["Python", "Go", "PostgreSQL", "Kafka", "Kubernetes", "Terraform", "Docker", "Redis"]
  .map(skill => ({ skill, type: "hard" })));

const basis = buildRuntimeAtsBasis({ resumeText: RESUME, domainProfile: { seniority: "mid" } });
const scoreJob = (job, rb) => scoreAtsLocally({ job, runtimeBasis: rb });
const store = (db) => ({ userId, profileId, jobId, report, basisHash, jobHash = null }) => {
  db.prepare("DELETE FROM ats_only_reports WHERE user_id=? AND job_id=? AND domain_profile_id IS ?").run(userId, jobId, profileId);
  db.prepare(`INSERT INTO ats_only_reports (user_id, domain_profile_id, job_id, ats_report, ats_score, scorer_version, scored_at, basis_hash, job_hash)
              VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`)
    .run(userId, profileId, jobId, JSON.stringify(report), report.score ?? null, report.source || LOCAL_ATS_SOURCE, basisHash, jobHash);
};
const quiet = { log() {}, warn() {}, error() {} };
const profileRow = (db) => db.prepare("SELECT * FROM domain_profiles WHERE id=?").get(PROFILE);
function seedPosting(db, id = "p1") {
  db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, company, title, _hash, scraped_at, discovered_at, is_active, description)
              VALUES (?, 'q', 'Co', 'Software Engineer', ?, 1, 1, 1, ?)`).run(id, `h-${id}`, PROSE);
}
const boardRead = (db) => db.prepare(`
  SELECT sj.job_id, aor.ats_score AS matchScore, ${storedScoreSql("sj", "aor")}
  FROM scraped_jobs sj LEFT JOIN ats_only_reports aor
    ON aor.job_id = sj.job_id AND aor.user_id = ${USER} AND aor.domain_profile_id IS ${PROFILE}`).get();

test("migration 118 is byte-identical in both runners, additive, and the column exists", () => {
  // From the block's comment through its closing backtick — the bytes, CRLF included.
  const block = (src) => {
    const start = at(src, "// 118 (A52)");
    return src.slice(start, at(src, "`,", at(src, 'id: "118_ats_reports_job_hash"', start)) + 2);
  };
  assert.equal(block(SERVER), block(RUNNER));
  const m = MIGRATIONS.find(x => x.id === "118_ats_reports_job_hash");
  assert.match(m.sql, /^\s*ALTER TABLE ats_only_reports ADD COLUMN job_hash TEXT;\s*$/);
  const cols = freshDb().prepare("PRAGMA table_info(ats_only_reports)").all().map(c => c.name);
  assert.ok(cols.includes("job_hash"));
});

test("the posting hash covers exactly what the scorer reads, and every field is a real column", () => {
  const cols = new Set(freshDb().prepare("PRAGMA table_info(scraped_jobs)").all().map(c => c.name));
  for (const f of ATS_JOB_INPUT_FIELDS) assert.ok(cols.has(f), `${f} is not a scraped_jobs column`);
  const job = { title: "Engineer", company: "Co", category: null, description: PROSE, skills_json: null, normalized_title: null };
  const h = atsJobInputHash(job);
  assert.equal(h, atsJobInputHash({ ...job, scraped_at: 99, ats_score: 3, is_active: 0 }), "non-scoring columns do not move it");
  for (const f of ATS_JOB_INPUT_FIELDS) {
    assert.notEqual(h, atsJobInputHash({ ...job, [f]: "changed" }), `${f} must move the hash`);
  }
  assert.notEqual(atsJobInputHash({ ...job, description: "" }), atsJobInputHash({ ...job, description: null }), "empty is not absent");
});

test("⛔ enrichment landing on a scored posting makes its stored row STALE, and the re-score is the panel's fresh score", async () => {
  const db = freshDb();
  seedPosting(db);
  const pc = createBoardFitPrecompute({ db, log: quiet, store: store(db), scoreJob,
    basisFor: () => ({ runtimeBasis: basis, basisHash: "B1" }) });

  const first = await pc.runFor({ userId: USER, profile: profileRow(db) });
  assert.equal(first.scored, 1);
  const before = boardRead(db);
  assert.equal(before.matchScore, null, "unenriched, the abstract posting declines — the fixture's premise");
  assert.equal(presentedScore(before, { basisHash: "B1" }), null);

  // Enrichment lands — the nightly pass writes skills_json days after the row was first scored.
  db.prepare("UPDATE scraped_jobs SET skills_json = ?, enriched_at = 2 WHERE job_id = 'p1'").run(ENRICHED);
  const fresh = scoreJob(db.prepare("SELECT * FROM scraped_jobs WHERE job_id='p1'").get(), basis).score;
  assert.ok(fresh != null, "enriched, the panel scores it");

  const plan = pc.plan({ userId: USER, profileId: PROFILE, basisHash: "B1" });
  assert.deepEqual(plan.jobIds, ["p1"], "the posting changed under its stored row — it is stale, not fresh");
  assert.equal(plan.postingChanged, 1);
  // Until it is re-scored, the board does not present the stale verdict.
  assert.equal(presentedScore(boardRead(db), { basisHash: "B1" }), null);

  const second = await pc.runFor({ userId: USER, profile: profileRow(db) });
  assert.equal(second.scored, 1);
  const after = boardRead(db);
  assert.equal(after.matchScore, fresh, "the stored score is now the panel's fresh score");
  assert.equal(presentedScore(after, { basisHash: "B1" }), fresh);
  const third = await pc.runFor({ userId: USER, profile: profileRow(db) });
  assert.equal(third.status, "nothing_to_do", "and it stays fresh until something changes");
});

test("the board never presents a stale stored score — posting changed, basis changed, or written before 118", () => {
  const db = freshDb();
  seedPosting(db);
  const job = db.prepare("SELECT * FROM scraped_jobs WHERE job_id='p1'").get();
  store(db)({ userId: USER, profileId: PROFILE, jobId: "p1", report: { score: 50 }, basisHash: "B1", jobHash: atsJobInputHash(job) });
  assert.equal(presentedScore(boardRead(db), { basisHash: "B1" }), 50, "current on both sides: shown");
  assert.equal(presentedScore(boardRead(db), { basisHash: "B2" }), null, "the résumé/claims changed: not shown");
  db.prepare("UPDATE scraped_jobs SET description = description || ' Rust.' WHERE job_id='p1'").run();
  assert.equal(presentedScore(boardRead(db), { basisHash: "B1" }), null, "the posting changed: not shown");
  store(db)({ userId: USER, profileId: PROFILE, jobId: "p1", report: { score: 50 }, basisHash: "B1", jobHash: null });
  assert.equal(presentedScore(boardRead(db), { basisHash: "B1" }), null, "a row from before 118: not shown");
  db.prepare("DELETE FROM ats_only_reports").run();
  assert.equal(presentedScore(boardRead(db), { basisHash: "B1" }), null, "no row: no opinion");
});

test("the server wires it: every writer stamps the posting, the panel's cache and the board check it", () => {
  assert.match(SERVER, /INSERT INTO ats_only_reports\s*\(user_id, domain_profile_id, job_id, ats_report, ats_score, scorer_version, scored_at, basis_hash, job_hash\)/);
  const panel = SERVER.slice(at(SERVER, 'app.post("/api/jobs/:id/keywords"'), at(SERVER, 'app.get("/api/jobs/by-id/:jobId"'));
  assert.match(panel, /AND job_hash IS \?/, "the panel's cache must not serve a report about an older posting");
  assert.match(panel, /jobHash: panelJobHash/);
  assert.match(SERVER, /report, basisHash, jobHash: atsJobInputHash\(job\)/, "adopt-enhanced stamps the posting");
  // The crawl scorer that stamped `atsJobInputHash(row)` went with scrapeJobs (deleted 10-02, 18).
  assert.doesNotMatch(SERVER, /scoreAtsLocally\(\{\s*job: item,/, "no path may score a thinner in-memory item");
  const route = SERVER.slice(at(SERVER, "async function boardPageResponse"), at(SERVER, "include_facets (optional, default-off)"));
  assert.match(route, /aor\.ats_score AS matchScore, \$\{storedScoreSql\("sj", "aor"\)\}/);
  assert.match(route, /matchScore: presentedScore\(j, \{ basisHash: boardBasisHash \}\)/);
});
