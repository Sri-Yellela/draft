// D123 P2 — draft's half of the lean tailoring call (services/leanTailoring.js + toolsServiceRequests.js): the switch,
// the full posting text, the KB placements at the candidate's OWN employers, and the request on the wire.
// Synthetic people and companies; an in-memory KB.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { tailoringFor, fullPostingText, candidateEmployers, kbPlacements, leanJobKeywords, LEAN_LEDGER_RENAME, PLACEMENT_MIN_POSTINGS } from "../services/leanTailoring.js";
import { generateRequest, RESUME_MASTER_ACCEPTS_LEAN } from "../services/toolsServiceRequests.js";
import { recordToolsServiceUsage } from "../services/toolsService.js";
import { validate } from "../test-support/contractSchema.js";

const lf = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const schemas = JSON.parse(lf("contract/resume-master/resume-master-api.v1.json")).components.schemas;

const RESUME = `Alex Rivers
EXPERIENCE
Software Engineer, Quillmark Freight, Denver, CO | Jan 2023 - Present
- Built a REST API in Java serving 40,000 requests a day
Data Intern, Ferngate Retail, Dallas, TX | Jun 2022 - Aug 2022
- Wrote ETL jobs in Python
SKILLS
Tools: Notion, Docker`;

function kb() {
  const db = new Database(":memory:");
  db.exec("CREATE TABLE company_technographics (company TEXT, skill TEXT, weight REAL, last_seen INTEGER, posting_count INTEGER)");
  const ins = db.prepare("INSERT INTO company_technographics VALUES (?, ?, 1, 0, ?)");
  ins.run("Quillmark Freight", "Kafka", 7);
  ins.run("Quillmark Freight", "Terraform", 1);   // under the floor
  ins.run("Ferngate Retail", "Airflow", 4);
  ins.run("Notion", "Kubernetes", 50);            // a tool in the skills line, not an employer
  return db;
}

// ⛔ Owner 11-07 (changed on purpose): a tailored résumé is a strategy × a model, LEAN when nothing is set — for everyone.
test("d123TailoringSwitch: lean by default, DRAFT_TAILORING sets it for everyone", () => {
  assert.equal(tailoringFor({ env: {} }), "lean");
  assert.equal(tailoringFor({ env: { DRAFT_TAILORING: "lean" } }), "lean");
  assert.equal(tailoringFor({ env: { DRAFT_TAILORING: "full" } }), "full");
  assert.equal(tailoringFor({ env: { DRAFT_TAILORING: "fast" } }), "lean", "an unknown value is the default");
});

test("d123FullPostingText: the crawl's full text wins over the 5,000-character cut", () => {
  assert.equal(fullPostingText({ description: "cut", description_full: "the whole posting" }), "the whole posting");
  assert.equal(fullPostingText({ description: "only this" }), "only this");
});

test("d123PlacementsAtOwnEmployersOnly: a missing term is placeable only where the candidate's own employer's stack has it", () => {
  const db = kb();
  assert.deepEqual(candidateEmployers(db, RESUME).sort(), ["Ferngate Retail", "Quillmark Freight"], "Notion in the skills line is not an employer");
  const p = kbPlacements(db, { resumeText: RESUME, missing: ["Kafka", "Terraform", "Airflow", "Kubernetes"], claimed: [] });
  assert.deepEqual(p, [{ term: "Kafka", employer: "Quillmark Freight" }, { term: "Airflow", employer: "Ferngate Retail" }]);
  assert.ok(PLACEMENT_MIN_POSTINGS >= 3, "one stray posting is not a stack");
  assert.deepEqual(kbPlacements(db, { resumeText: RESUME, missing: ["Kafka"], claimed: ["Kafka"] }), [], "a claimed term travels as claimed");
  assert.deepEqual(kbPlacements(db, { resumeText: "no experience section", missing: ["Kafka"] }), []);
});

test("d123LeanRequestOnTheWire: no posting text, the keywords and placements, options.tailoring lean — valid against contract 1.7.0", () => {
  const db = kb();
  const job = { title: "Backend Engineer", company: "Acme", category: "Software", description: "SECRET cut text",
                description_full: "Requirements\n- Build streaming data pipelines\n- Kafka, Java", stack: null };
  const report = { tier1_matched: ["Java"], tier1_missing: ["Kafka"], claimed_matches: [], action_verbs_matched: ["Built"] };
  const keywords = leanJobKeywords(db, { job, report, resumeText: RESUME });
  assert.deepEqual(keywords.placements, [{ term: "Kafka", employer: "Quillmark Freight" }]);
  assert.ok(keywords.phrases.includes("streaming data pipelines"), "phrases come from the FULL text");
  const body = generateRequest({ profile: {}, job, baseResumeText: RESUME, mode: "GENERATE", tailoring: "lean", keywords });
  assert.equal(RESUME_MASTER_ACCEPTS_LEAN, true);
  assert.equal(body.options.tailoring, "lean");
  assert.equal(body.job.description, undefined, "the posting's text is not sent");
  assert.ok(!JSON.stringify(body).includes("SECRET"));
  assert.deepEqual(validate(JSON.parse(JSON.stringify(body)), schemas.GenerateRequest, schemas, { strict: true }), []);
  const full = generateRequest({ profile: {}, job, baseResumeText: RESUME, mode: "GENERATE" });
  assert.equal(full.options.tailoring, undefined, "the full request is unchanged");
  assert.equal(full.job.description, job.description_full, "the full request sends the crawl's FULL text (D123)");
  const aPlus = generateRequest({ profile: {}, job, baseResumeText: RESUME, mode: "A_PLUS", tailoring: "lean", keywords });
  assert.equal(aPlus.options.tailoring, undefined, "lean is GENERATE only");
  assert.ok(schemas.GenerateRequest.properties.options.properties.tailoring, "the vendored contract declares it");
});

test("d123LeanLedger: the lean call is recorded as resume_generate (the allowance and the lift panel count it); the repair keeps its name", () => {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE usage_events (id INTEGER PRIMARY KEY, user_id INTEGER, event_type TEXT, event_subtype TEXT, input_tokens INTEGER,
    output_tokens INTEGER, cache_read_tokens INTEGER, cache_creation_tokens INTEGER, cached INTEGER, model TEXT, cost_usd REAL,
    ats_score_before INTEGER, ats_score_after INTEGER, duration_ms INTEGER, job_id TEXT, company TEXT, success INTEGER, error_text TEXT,
    created_at INTEGER DEFAULT (unixepoch()), purpose TEXT, provider TEXT, domain_module TEXT)`);
  const usage = [{ purpose: "resume_tailor", model: "claude-haiku-4-5-20251001", success: true, input_tokens: 3000, output_tokens: 600 },
                 { purpose: "resume_tailor_repair", model: "claude-sonnet-5", success: true, input_tokens: 3200, output_tokens: 500 }];
  const id = recordToolsServiceUsage(db, usage, { userId: 1, jobId: "j", atsScoreBefore: 41, idFor: "resume_generate", renamePurpose: LEAN_LEDGER_RENAME });
  const rows = db.prepare("SELECT id, purpose, ats_score_before FROM usage_events ORDER BY id").all();
  assert.deepEqual(rows.map(r => r.purpose), ["resume_generate", "resume_tailor_repair"]);
  assert.equal(id, rows[0].id, "the id the after-score is written to");
  assert.equal(rows[0].ats_score_before, 41);
});

test("d123FullCallReadsFullText: the FULL call sends description_full while it fits the tools service's cap, else the stored text", async () => {
  const { FULL_TEXT_CAP } = await import("../services/toolsServiceRequests.js");
  assert.equal(FULL_TEXT_CAP, schemas.Job.properties.description.maxLength, "held equal to the vendored contract's cap");
  const sent = (job) => generateRequest({ profile: {}, job: { title: "T", ...job }, baseResumeText: RESUME, mode: "GENERATE" }).job.description;
  assert.equal(sent({ description: "cut", description_full: "the whole posting" }), "the whole posting");
  assert.equal(sent({ description: "cut", description_full: "x".repeat(FULL_TEXT_CAP + 1) }), "cut");
  assert.equal(sent({ description: "only" }), "only");
});

test("d123P1NoCacheWriteForOneDraft: the apply path caches only a burst — a single Draft sends cache:false", () => {
  const server = fs.readFileSync("server.js", "utf8").replace(/\r\n/g, "\n");
  assert.match(server, /const applyBurst = \(\(\) => \{ try \{ return db\.prepare\("SELECT COUNT\(\*\) n FROM apply_run_jobs WHERE user_id = \? AND status IN \('queued','running'\)"\)\.get\(userId\)\.n > 1; \}/);
  assert.match(server, /coreGenerateResume\(\{ userId, jobId: String\(jobId\), job: jobRow, tool, cache: applyBurst \? undefined : false \}\)/);
});
