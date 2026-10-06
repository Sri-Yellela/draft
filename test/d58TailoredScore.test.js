// D58 · THE ATS DID NOT UPDATE AFTER THE RÉSUMÉ WAS GENERATED — each test goes red when the thing it pins is
// removed. SYNTHETIC user. The pair (base → tailored) is written ONCE on the résumé at generation
// (services/generatedResumes.js, migration 131) and every surface reads it through shared/resumeScores.js.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { capturedAtsAtApply } from "../routes/apply.js";
import { recordSubmission, markPending } from "../services/applicationRecords.js";
import { storeGeneratedResume, listGeneratedResumes } from "../services/generatedResumes.js";
import { atsScorePair } from "../shared/resumeScores.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const NOW = Math.floor(Date.now() / 1000);

function seed() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'ada','x','PRO')").run();
  db.prepare("INSERT INTO domain_profiles (id,user_id,profile_name,role_family,domain,is_active) VALUES (10,1,'SWE','engineering','software',1)").run();
  db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,url,apply_url,search_query,_hash,discovered_at)
              VALUES ('j1','Backend Engineer','Northwind, Inc.','https://northwind.example/jobs/1',
                      'https://job-boards.greenhouse.io/northwind/jobs/1','t','h1',?)`).run(NOW - 5 * 86400);
  return db;
}
const gen = (db, tailored, base) => storeGeneratedResume(db, {
  userId: 1, jobId: "j1", job: { company: "Northwind, Inc.", title: "Backend Engineer" }, html: `<p>tailored ${tailored}</p>`,
  atsScore: tailored, atsReport: { score: tailored, source: "local_ats_test" }, baseAtsScore: base, domainProfileId: 10,
});

test("D58 · generating writes the PAIR once on the résumé — base and tailored, read back after a reload", () => {
  const db = seed();
  gen(db, 71, 58);
  const r = db.prepare("SELECT ats_score, base_ats_score FROM resumes WHERE user_id=1 AND job_id='j1'").get();
  assert.deepEqual([r.base_ats_score, r.ats_score], [58, 71]);
  assert.equal(db.prepare("SELECT base_ats_score FROM resume_versions WHERE job_id='j1'").pluck().get(), 58);
  const listed = listGeneratedResumes(db, 1)[0];
  assert.deepEqual([listed.baseAtsScore, listed.atsScore], [58, 71]);
  // the server passes AK1's before-score as the pair's base, and the reload carries it
  const server = read("server.js");
  const core = server.slice(at(server, "async function coreGenerateResume("), at(server, "function generateResumeForApply"));
  assert.match(core, /baseAtsScore: atsScoreBefore,\n\s+atsCacheKey,/);
  assert.match(server, /r\.apply_mode, r\.ats_score, r\.ats_report, r\.created_at, r\.updated_at,\n\s+r\.base_ats_score,/);
  assert.match(server, /id: "131_resume_score_pair"/);
});

test("D58 · ONE READ, EVERY SURFACE — the card badge, the posting header and the ATS card all read scoresFor", () => {
  const jobs = read("client/src/panels/JobsPanel.jsx");
  assert.match(jobs, /baseAtsScore: r\.base_ats_score \?\? null,/, "the boot map carries the stored base");
  assert.match(jobs, /score=\{scoresFor\(job, g\)\.shown\}/, "the card badge");
  assert.match(jobs, /scores: scoresFor\(selectedJob, g2\),/, "the posting header, through the panel's meta");
  const payload = jobs.slice(at(jobs, "function buildAtsPayload("), at(jobs, "// -- Main panel"));
  assert.match(payload, /const pair = scoresFor\(job, artifact\);/, "the ATS card");
  assert.doesNotMatch(jobs, /openAtsPanel\(\{ score: ?d\.atsScore|openAtsPanel\(\{ score: d\.ats_score|openAtsPanel\(\{ score:existingArtifact/,
    "an ATS card opened from a generation builds its own score — a second read");
  const jd = read("client/src/components/JobDetailPanel.jsx");
  assert.match(jd, /<AtsNumberBox score=\{scores\.shown\} tailored=\{scores\.tailoredShown\} base=\{scores\.base\}/);
  assert.match(jd, /<small>\{tailored \? "tailored" : "ATS"\}<\/small>/, "the box marks a tailored score");
  assert.doesNotMatch(jd, /const atsScore = g\?\.atsScore \?\? job\?\.baseAtsScore/);
  // the pair itself: the tailored score is what would be sent
  const p = atsScorePair({ base: 58, tailored: 71 });
  assert.deepEqual([p.shown, p.tailoredShown, p.line], [71, true, "Base 58 → tailored 71"]);
  assert.deepEqual(atsScorePair({ base: 58, tailored: null }).shown, 58, "no tailored résumé → the base");
});

test("D58 · a tailored score BELOW the base is shown — and said", () => {
  const p = atsScorePair({ base: 58, tailored: 52 });
  assert.equal(p.shown, 52, "the score of the résumé that would be sent, even when it is lower");
  assert.equal(p.lower, true);
  assert.equal(p.line, "Base 58 → tailored 52 — lower than your base résumé");
  const card = read("client/src/panels/AtsReportPanel.jsx");
  assert.match(card, /\{activeAts\?\.pair\?\.line && \(\n\s+<div data-ats-pair="" data-lower=\{activeAts\.pair\.lower \? "true" : undefined\}/);
  assert.match(card, /\{activeAts\.pair\.line\}/);
});

test("D58 · the manual route records the TAILORED score at apply — the newest, even after an export", () => {
  const db = seed();
  gen(db, 71, 58);
  db.prepare("UPDATE resume_versions SET is_kept=1 WHERE job_id='j1'").run();   // exported
  gen(db, 52, 58);                                                                 // regenerated by hand
  markPending(db, 1, "j1", "generated");
  const out = recordSubmission(db, { userId: 1, jobId: "j1", capturedAtsAtApply,
    input: { submittedAt: (NOW - 3600) * 1000, method: "company_site", reference: "R-1042" } });
  assert.equal(out.verification.verified, true);
  const row = db.prepare("SELECT ats_score_at_apply FROM job_applications WHERE user_id=1 AND job_id='j1'").get();
  assert.equal(row.ats_score_at_apply, 52, "the résumé that was sent — not the base 58, not the exported 71");
});

test("D58 · a null score renders no digit — never a 0 — and is stored as NULL", () => {
  const p = atsScorePair({ base: null, tailored: null });
  assert.deepEqual([p.shown, p.line, p.tailoredShown], [null, null, false]);
  assert.equal(atsScorePair({ base: "", tailored: undefined }).shown, null);
  const db = seed();
  gen(db, null, Number.NaN);
  const r = db.prepare("SELECT ats_score, base_ats_score FROM resumes").get();
  assert.deepEqual([r.ats_score, r.base_ats_score], [null, null]);
  assert.match(read("client/src/components/JobDetailPanel.jsx"), /const has = ATS_NUMBER_SHOWN && Number\.isFinite\(score\);/);
  assert.match(read("client/src/components/JobBubble.jsx"), /const showNumber = ATS_NUMBER_SHOWN && Number\.isFinite\(score\);/);
});

test("D58 · nothing the user did not claim raises the score: base and tailored are scored with the same claims", () => {
  const server = read("server.js");
  const core = server.slice(at(server, "async function coreGenerateResume("), at(server, "function generateResumeForApply"));
  const before = core.slice(at(core, "let atsScoreBefore = null;"), at(core, "let usageEventId = null;"));
  const after = core.slice(at(core, "const runtimeBasis = buildRuntimeAtsBasis({"), at(core, "const atsScore = atsReport.score;"));
  assert.match(before, /claims: atsClaims\(beforeProfile\)/);
  assert.match(after, /claims: atsClaims\(activeProfile\)/);
  assert.match(after, /termWeights: atsTermWeightsForJob\(job\)/, "same job, same weights");
});
