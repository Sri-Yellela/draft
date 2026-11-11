import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { postingRequirements, classifyDegree, classifySponsorship, requirementPills } from "../shared/postingRequirements.js";
import { normalizePosting } from "../shared/postingNormalize.js";
import { eligibilityOf, highestDegree } from "../shared/eligibility.js";
import { eligibilityForJob } from "../services/jobEligibility.js";
import { pickJobs, runAutoTick } from "../services/autoScheduler.js";
import { AUTO_DEFAULTS } from "../shared/autoSettings.js";
import { ANSWER_SOURCES, sourceOf } from "../shared/answerSource.js";
import { buildAnswers, PROVENANCE, CONFIDENCE_BY_PROVENANCE, AUTO_SUBMIT_MIN_CONFIDENCE } from "../services/applyAutomation.js";
import applyRoutes from "../routes/apply.js";

// ⭐ D104 (owner 10-30) · what another product's run showed: an application SENT for a non-citizen to a posting whose
// first line reads "MUST BE A US CITIZEN. NO H1B or Green card holders", a VP / PhD-required role shown as a match, and
// self-ratings the candidate never gave. Synthetic people and postings; the 10-30 posting's first line is the fixture.

const CITIZEN_ONLY = "MUST BE A US CITIZEN. NO H1B or Green card holders. Active TS clearance required.\n" +
  "About the role: build mission software with a small team.";
const req = (text) => postingRequirements(normalizePosting(text));

test("D104 · d104ClearanceParsed + the 10-30 first line: citizens only, TS active, no sponsorship", () => {
  assert.deepEqual(req(CITIZEN_ONLY), { citizenship: "citizen_only", clearance: "top_secret", clearanceStatus: "active_required",
    polygraph: false, sponsorship: "no_sponsorship", degree: null });
  assert.equal(req("Requires an active TS/SCI clearance with polygraph.").clearance, "ts_sci");
  assert.equal(req("Must be able to obtain a Secret clearance.").clearanceStatus, "ability_to_obtain");
});

test("D104 · no sponsorship and a REQUIRED degree are read; preferred or 'or equivalent' is not a requirement", () => {
  assert.equal(classifySponsorship("We are unable to sponsor visas for this role."), "no_sponsorship");
  assert.equal(classifySponsorship("Must be authorized to work in the US without the need for visa sponsorship."), "no_sponsorship");
  assert.equal(classifySponsorship("We sponsor H-1B visas for strong candidates."), "none_stated");
  assert.equal(classifySponsorship("We do not discriminate on the basis of visa status."), "none_stated", "boilerplate");
  assert.equal(classifyDegree("A PhD or Master's degree in CS is required. 4+ years of experience."), "masters");
  assert.equal(classifyDegree("BS in CS or equivalent experience required."), null);
  assert.equal(classifyDegree("Master's degree preferred."), null);
  assert.deepEqual(requirementPills(req(CITIZEN_ONLY)).map(p => p.key), ["citizenship", "clearance", "status", "sponsorship"]);
});

test("D104 · eligibility against what the candidate SET — ineligible, eligible, and unknown when it is not set", () => {
  const r = req(CITIZEN_ONLY);
  assert.deepEqual(eligibilityOf(r, { citizenship: "India", clearance: "none", sponsorship_now: "yes" }).reasons,
    ["U.S. citizens only", "top secret clearance required", "no visa sponsorship"]);
  assert.equal(eligibilityOf(r, { citizenship: "United States", clearance: "top_secret", sponsorship_now: "no" }).status, "eligible");
  assert.equal(eligibilityOf(r, { citizenship: "US citizen", clearance: "can_obtain", sponsorship_now: "no" }).status, "ineligible", "active required");
  const unknown = eligibilityOf(r, {});
  assert.deepEqual([unknown.status, unknown.missing], ["unknown", ["citizenship", "clearance", "sponsorship"]],
    "⛔ an unset default is never read as an answer — not eligible, not ineligible");
  assert.equal(eligibilityOf(req("U.S. citizen, national, permanent resident, refugee or asylee required (ITAR)."), { citizenship: "Permanent resident" }).status, "eligible");
  assert.equal(eligibilityOf(req("A PhD is required."), {}, ["MS Computer Science"]).status, "ineligible");
  assert.equal(highestDegree(["BS Physics", "Master of Science"]), "masters");
  assert.equal(eligibilityOf(req("Build great things with us."), {}).status, "eligible");
});

function fixtureDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier,send_mode,auto_settings) VALUES (1,'dana','x','PRO','auto',?)")
    .run(JSON.stringify({ ...AUTO_DEFAULTS, timeZone: "America/New_York", savedAt: 0 }));
  db.prepare("INSERT INTO application_defaults (user_id, key, value, source) VALUES (1,'citizenship','India','user'), (1,'sponsorship_now','yes','user')").run();
  const job = (id, description) => db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,url,apply_url,search_query,_hash,description)
    VALUES (?,?,?,?,?,?,?,?)`).run(id, "Engineer", `Co ${id}`, `https://x.test/${id}`, `https://x.test/${id}`, "t", `h${id}`, description);
  job("cit", CITIZEN_ONLY);
  job("open", "Build things with us. Python and SQL.");
  return db;
}

test("D104 · d104CitizenOnlyNeverAutoQueued — FULL AUTO's run skips the citizens-only posting and takes the open one", async () => {
  const db = fixtureDb();
  assert.equal(eligibilityForJob(db, 1, "cit").status, "ineligible");
  assert.equal(eligibilityForJob(db, 1, "open").status, "eligible");
  const calls = [];
  const out = await runAutoTick(db, { nowSec: Math.floor(Date.UTC(2026, 10, 2, 14, 30) / 1000), env: {},
    fetchBoard: async () => [{ jobId: "cit", company: "Co cit" }, { jobId: "open", company: "Co open" }],
    startAutoRun: (_u, ids) => { calls.push(ids); return { status: 202, body: {} }; } });
  assert.deepEqual(calls, [["open"]]);
  assert.equal(out[0].skippedJobs, 1);
  const p = pickJobs([{ jobId: "cit" }], { remaining: 5, drafted: new Set(), companyCounts: new Map(), pausedCompanies: new Set(),
    settings: AUTO_DEFAULTS, isIneligible: () => true });
  assert.deepEqual(p.skipped, [{ jobId: "cit", reason: "ineligible" }]);
});

test("D104 · Approve all leaves the ineligible posting in Ready to approve; approving it ALONE still sends it", async () => {
  const db = fixtureDb();
  db.prepare("INSERT INTO user_profile (user_id,first_name,last_name,email) VALUES (1,'Dana','Example','dana@example.test')").run();
  db.prepare("INSERT INTO domain_profiles (id,user_id,profile_name,role_family,domain,is_active) VALUES (10,1,'SWE','engineering','software',1)").run();
  db.prepare("INSERT INTO profile_base_resumes (profile_id,user_id,name,content,updated_at) VALUES (10,1,'r.txt','synthetic resume text',unixepoch())").run();
  const run = db.prepare("INSERT INTO apply_runs (user_id,mode,status,total_jobs,approval_mode) VALUES (1,'auto','completed',2,'required')").run().lastInsertRowid;
  const held = (job) => Number(db.prepare("INSERT INTO apply_run_jobs (run_id,user_id,job_id,status,reason_code) VALUES (?,1,?,'held_review','awaiting_approval')").run(run, job).lastInsertRowid);
  const a = held("cit"), b = held("open");
  const app = express();
  app.use(express.json());
  app.use((req, _r, n) => { req.user = { id: 1, planTier: "PRO" }; n(); });
  const noop = async () => ({});
  applyRoutes(app, db, (_q, _r, n) => n(), () => ({ field_map: {}, handler_map: {}, custom_answers: {} }), noop, noop, noop, () => null);
  const server = app.listen(0);
  const post = (body) => fetch(`http://127.0.0.1:${server.address().port}/api/apply/approve`, { method: "POST",
    headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(async r => ({ status: r.status, body: await r.json() }));
  try {
    const all = await post({ runJobIds: [a, b] });
    assert.equal(all.status, 202, JSON.stringify(all.body));
    assert.deepEqual(all.body.approved, [b]);
    assert.deepEqual(all.body.skippedIneligible.map(x => [x.runJobId, x.reasons[0]]), [[a, "U.S. citizens only"]]);
    assert.equal(db.prepare("SELECT status FROM apply_run_jobs WHERE id=?").pluck().get(a), "held_review", "still waiting for the user");
    const one = await post({ runJobIds: [a] });
    assert.equal(one.status, 202, "the user's own explicit choice");
  } finally { server.close(); }
});

test("D104 · d104AtsUnchanged — eligibility is a separate line; nothing in it reads or writes the ATS score", () => {
  for (const f of ["shared/eligibility.js", "services/jobEligibility.js"]) {
    const src = fs.readFileSync(f, "utf8").replace(/^\s*\/\/.*$/gm, "");
    assert.doesNotMatch(src, /ats_score|atsScore|fit_score|scoreJob|computeAts/i, f);
  }
});

test("D104 · d104NoModelSource + d104EveryValueHasSource — every value the engine may SEND has a source; none is a model", () => {
  // 10-30: + user_setting — a terms box the user's own Auto settings let draft tick (test/termsOptIn.test.js). Still no model.
  // ⭐ A182 (owner 11-11): + resume_draft — a free-text answer written from the candidate's own résumé during the run.
  assert.deepEqual([...ANSWER_SOURCES].sort(), ["posting", "profile", "resume_draft", "saved_answer", "user_now", "user_setting"]);
  assert.ok(!ANSWER_SOURCES.includes("model"));
  for (const p of Object.values(PROVENANCE)) {
    const sendable = (CONFIDENCE_BY_PROVENANCE[p] ?? 0) >= AUTO_SUBMIT_MIN_CONFIDENCE;
    if (sendable) assert.ok(sourceOf(p), `${p} can be sent unattended, so it must have a source`);
  }
  assert.equal(sourceOf(PROVENANCE.LABEL_FUZZY), null, "a guess has no source");
  assert.equal(sourceOf(PROVENANCE.DEFAULT), null);
});

test("D104 · d104SelfRatingNeedsYou — a self-rating with no saved answer is left for the candidate; a saved one is theirs", () => {
  const fields = [
    { field_id: "q1", name: "q1", label: "How would you rate your experience with REST APIs?", type: "select",
      options: ["None", "Some experience, but limited", "Moderate", "Expert"].map(l => ({ label: l, value: l })), is_required: true },
    { field_id: "q2", name: "q2", label: "How many years of experience do you have with prompt engineering?", type: "select",
      options: ["0", "1 to 5", "5+"].map(l => ({ label: l, value: l })), is_required: true },
  ];
  const none = buildAnswers(fields, { field_map: {}, handler_map: {}, custom_answers: {} });
  assert.ok(!none.some(a => a.value != null && !a.skipped), "nothing is invented for a self-rating");
  const saved = buildAnswers(fields, { field_map: {}, handler_map: {},
    custom_answers: { "How would you rate your experience with REST APIs?": "Expert" } });
  const q1 = saved.find(a => a.field_id === "q1");
  assert.equal(q1?.value, "Expert");
  assert.equal(sourceOf(q1.provenance), "saved_answer");
});

test("D104 · d104BoardMarksIneligible — a row is marked for THIS user, demoted within its page, never hidden; nothing is computed with no answers set", async () => {
  const { hasEligibilityInputs, eligibilityForRow } = await import("../services/jobEligibility.js");
  const inputs = { defaults: { citizenship: "India", sponsorship_now: "yes" }, degrees: [] };
  assert.equal(hasEligibilityInputs({ defaults: {}, degrees: [] }), false, "no answers set → the board is untouched");
  assert.equal(hasEligibilityInputs(inputs), true);
  assert.deepEqual(eligibilityForRow({ description: CITIZEN_ONLY }, inputs).reasons, ["U.S. citizens only", "no visa sponsorship"]);
  assert.equal(eligibilityForRow({ description: "Build things with us." }, inputs).status, "eligible");
  assert.equal(eligibilityForRow({ description: null }, inputs).status, "eligible");
  const src = fs.readFileSync("server.js", "utf8").replace(/\r\n/g, "\n");
  const begin = at(src, "const ineligible = new Map();", 0, "server.js — the board computes it");
  // through the page's row map (D121 added the sponsorship signal and its demotion between them)
  const block = src.slice(begin, at(src, "total,", at(src, "jobs:       pageRows.map(", begin, "the row map"), "the row map's end"));
  assert.match(block, /if \(hasEligibilityInputs\(eligInputs\)\)/);
  assert.match(block, /const pageRows = ineligible\.size \? \[\.\.\.rows\.filter\(j => !ineligible\.has\(j\.job_id\)\), \.\.\.rows\.filter\(j => ineligible\.has\(j\.job_id\)\)\] : rows;/);
  assert.match(block, /jobs:\s+pageRows\.map\(/);
  assert.match(block, /eligibility: \{ status: "ineligible", reasons: ineligible\.get\(j\.job_id\) \}/);
  assert.doesNotMatch(block.slice(0, at(block, "const responseBody")), /rows\s*=\s*rows\.filter|rows\.splice/, "the page's rows (and so its cursor) are not changed");
});

// D104 · the board card draws the server's verdict — a mark (D60), only for "ineligible", with the reasons.
test("the board card marks an ineligible posting with its reasons, and nothing else", () => {
  const card = fs.readFileSync(new URL("../client/src/components/JobCard.jsx", import.meta.url), "utf8");
  const fn = card.slice(at(card, "function EligibilityMark"), at(card, "// ── Closed pill"));
  assert.match(fn, /if \(eligibility\?\.status !== "ineligible"\) return null;/, "unknown or absent must render nothing");
  assert.match(fn, /style=\{markStyle\(C\.DANGER\)\}/);
  assert.match(fn, /Not eligible/);
  // D108 P3 added the employer's filings to the title as information (changed on purpose; the verdict is unchanged).
  assert.match(card, /<EligibilityMark eligibility=\{job\.eligibility\} sponsorship=\{job\.sponsorshipFact\}\/>/);
});
