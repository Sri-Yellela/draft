// ⭐ A179 (owner 11-10, P0) · the apply loop said it did work it didn't do. Probed 46d: production's run (user 3, mode
// preview) DID open the Sailor Health Ashby form (13 controls) and typed nothing — the payload came only from an EMPTY
// user_profile row, while the résumé held every value and the account held the email; the hold then listed the packet's
// 24 canonical fields, and the steps drew "Filled the form" green regardless. With a full profile the same real form filled
// 5, missing "Current Role" / "Alma Mater" (label wordings); after the matcher fix, 7 of 7 identity fields.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { getPlatformLabelMap } from "../services/platformDetector.js";
import { completeProfileForApply, contactGaps, _resetApplyProfileFill } from "../services/applyProfileFill.js";
import { runSteps, heldHeadline, resumeStepOf, fillOf } from "../client/src/lib/heldApplication.js";
import { heldReasonWords } from "../services/heldQuestions.js";
import { at } from "../test-support/sourceAnchors.js";

const RESUME = `Jordan Rivera
Boston, MA · jordan.rivera.synthetic@example.com · (617) 555-0199 · linkedin.com/in/jordan-rivera-synthetic

EXPERIENCE
Software Engineer — Northwind Analytics, Jan 2021 – Present
- Built data pipelines in Python and TypeScript serving 2M requests a day.
- Led the migration of a monolith to services on AWS.

EDUCATION
Bachelor of Science in Computer Science — Example State University, 2016 – 2020

SKILLS
Python, TypeScript, React, AWS, PostgreSQL`;

function fixture({ resume = RESUME, email = "account.synthetic@example.com" } = {}) {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (5, ?, 'x')").run(email);   // the sign-in id IS the email
  db.prepare("INSERT INTO base_resume (user_id, content, name) VALUES (5, ?, 'resume.txt')").run(resume);
  db.prepare("INSERT INTO user_profile (user_id) VALUES (5)").run();
  _resetApplyProfileFill();
  return db;
}

test("a179ProfileFieldsFilled: the label wordings the real Ashby form used reach the profile's keys", () => {
  const map = getPlatformLabelMap("ashby");
  for (const [label, key] of [["Current Role", "current_job_title"], ["Alma Mater", "university"], ["Current Company", "current_company"],
    ["Graduation Year", "graduation_year"], ["First Name", "first_name"], ["Email", "email"], ["LinkedIn", "linkedin_url"]]) {
    assert.equal(map[label], key, label);
  }
  // the needles stay specific — no bare "School" / "Degree" that would catch unrelated questions
  assert.equal(map.School, undefined); assert.equal(map.Degree, undefined);
});

test("a179ProfileFromResume: an EMPTY profile is filled from the base résumé before a run, and the account email stands in", () => {
  const db = fixture();
  const row = db.prepare("SELECT * FROM user_profile WHERE user_id = 5").get();
  const done = completeProfileForApply(db, row);
  assert.equal(done.full_name, "Jordan Rivera");
  assert.match(String(done.email), /jordan\.rivera\.synthetic@example\.com/, "the résumé's own email first");
  assert.match(String(done.phone), /555/);
  // written under D186's rule (and recorded "from your résumé")
  const stored = db.prepare("SELECT full_name, resume_filled_json FROM user_profile WHERE user_id = 5").get();
  assert.equal(stored.full_name, "Jordan Rivera");
  assert.match(stored.resume_filled_json, /full_name/);
  assert.deepEqual(contactGaps(done), []);
});

test("a179ProfileFromResume: a typed value is never overwritten; no email in the résumé → the account's email", () => {
  const db = fixture({ resume: RESUME.replace("jordan.rivera.synthetic@example.com · ", "") });
  db.prepare("UPDATE user_profile SET full_name = 'J. Rivera (typed)' WHERE user_id = 5").run();
  const done = completeProfileForApply(db, db.prepare("SELECT * FROM user_profile WHERE user_id = 5").get());
  assert.equal(done.full_name, "J. Rivera (typed)");
  assert.equal(done.email, "account.synthetic@example.com");
  assert.equal(db.prepare("SELECT email FROM user_profile WHERE user_id = 5").pluck().get() ?? null, null, "the account email is not written to the profile");
});

test("a179EmptyProfileCaughtBeforeRun: nothing to type → held before the browser opens, in plain words", () => {
  assert.deepEqual(contactGaps({}), ["full_name", "email"]);
  assert.deepEqual(contactGaps({ first_name: "A", last_name: "B", email: "a@b.c" }), []);
  const src = fs.readFileSync("routes/apply.js", "utf8");
  const hold = at(src, 'setJobStatus("held_review", "profile_contact_empty"');
  const launch = at(src, "await autoApply(jobUrl, autofillPayload");
  assert.ok(launch > hold, "the empty-profile hold comes before any browser launch");
  assert.match(heldReasonWords("profile_contact_empty"), /contact details are empty/);
  const server = fs.readFileSync("server.js", "utf8");
  assert.match(server, /if \(mode !== "CUSTOM_SAMPLER"\) profile = completeProfileForApply\(db, profile\);/);
});

const heldNode = (row, questions = []) => ({ kind: "held", why: "question", question: questions[0] ? { question: questions[0] } : null,
  ref: { rows: [{ ...row, heldQuestions: questions.map(q => ({ question: q, required: true })) }] } });

test("a179StepsFromWorkerReportOnly: 'Filled the form' is green only on a reported fill — 0 typed is a failed step", () => {
  const st = (n) => Object.fromEntries(runSteps(n).map(s => [s.id, [s.state, s.label, s.meta]]));
  assert.deepEqual(st(heldNode({ fill: { filled: 0, discovered: 24 } }, ["Email"])).filled, ["fail", "Filled the form — nothing was filled", "0 of 24"]);
  assert.deepEqual(st(heldNode({ fill: { filled: 7, discovered: 13 } }, ["Why this role?"])).filled, ["done", "Filled the form", "7 of 13"]);
  assert.deepEqual(st(heldNode({}, ["Why this role?"])).filled, ["", "Filled the form — not reported", ""]);
  assert.equal(fillOf({ fill: { filled: "3", discovered: null } }).filled, 3);
});

test("a179TailoredOnlyWithDelta: 'Tailored' only when the tailored résumé scored above the base", () => {
  assert.equal(resumeStepOf({ baseAtsScore: 58, atsScore: 61 }).label, "Tailored your résumé");
  assert.equal(resumeStepOf({ baseAtsScore: 66, atsScore: 66 }).label, "Your résumé already fits — tailoring changed no score");
  const lower = resumeStepOf({ baseAtsScore: 57, atsScore: 47 });
  assert.equal(lower.state, "fail"); assert.equal(lower.meta, "ATS 57 → 47");
});

test("a179HeadingCountsReal: the heading counts the questions waiting; 'everything else is done' only when it is", () => {
  const two = heldHeadline(heldNode({ fill: { filled: 7, discovered: 13 } }, ["Proficiency across languages", "Why this role?"]));
  assert.equal(two.title, "2 drafts to check", "A181 (4): free-text questions are draft's drafts to check, not answers only you can give");
  assert.match(two.lead, /draft filled 7 of 13 fields/);
  const none = heldHeadline(heldNode({ fill: { filled: 0, discovered: 24 } }, ["Email"]));
  assert.match(none.lead, /Nothing was filled/);
  assert.doesNotMatch(none.lead, /Everything else is done/);
});

test("a179RunNowVisible: Run now shows in both modes; every held row can be Run again", () => {
  const panel = fs.readFileSync("client/src/panels/AutoApplyPanel.jsx", "utf8");
  const head = panel.slice(at(panel, "const timelineHead = ("), at(panel, "const chooseAsk = async"));
  assert.match(head, /\{!held && \(\s*<p className="dht-head__sub" data-run-now-row="">/);
  assert.doesNotMatch(head, /\(fullAuto \|\| picksOn\) && !held/, "no longer hidden in Ask me first");
  assert.match(panel, /const runAgain = !r\.postingGone \? \[\{ id: "rerun", label: rr === "busy" \? "Starting…" : rr === "started" \? "Running again…" : "Run again"/);
  assert.equal((panel.match(/\.\.\.runAgain/g) || []).length, 3, "on the question, empty and default held rows");
  assert.match(fs.readFileSync("server.js", "utf8"), /no_auto_mode: "Run now starts your daily picks/);
});

test("a179WorkerDownBanner: a queue waiting with no start is reported stalled; the panel says so", async () => {
  const { default: express } = await import("express");
  const { default: applyRoutes } = await import("../routes/apply.js");
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'ada','x','PRO')").run();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 1, planTier: "PRO" }; next(); });
  const noop = async () => ({});
  applyRoutes(app, db, (req, _res, next) => next(), () => ({ field_map: {}, handler_map: {}, custom_answers: {} }), noop, noop, noop, () => null);
  const server = app.listen(0);
  const get = async () => (await fetch(`http://127.0.0.1:${server.address().port}/api/apply/health`)).json();
  try {
    assert.equal((await get()).stalled, false, "nothing waiting");
    const run = db.prepare("INSERT INTO apply_runs (user_id,mode,status,total_jobs,approval_mode) VALUES (1,'auto','queued',1,'required')").run().lastInsertRowid;
    db.prepare("INSERT INTO apply_run_jobs (run_id,user_id,job_id,status,created_at) VALUES (?,1,'gh::1','queued',?)").run(run, Math.floor(Date.now() / 1000) - 600);
    const h = await get();
    assert.equal(h.waiting, 1); assert.equal(h.stalled, true, "10 minutes in the queue, nothing started");
    assert.equal(h.lastError, undefined, "the error is the admin's to read");
  } finally { server.close(); }
  const panel = fs.readFileSync("client/src/panels/AutoApplyPanel.jsx", "utf8");
  assert.match(panel, /api\("\/api\/apply\/health"\)/);
  assert.match(panel, /\{runnerHealth\?\.stalled && \(/);
});

test("a179OnlyNeverListAndDraftsHeld + a179OptionalNotListed: once the form was read, only its real questions are listed", async () => {
  const { heldQuestionsOf } = await import("../services/heldQuestions.js");
  const open = JSON.stringify([
    { question: "Tell us why you are interested in this role", required: true, type: "textarea" },
    { question: "Pronouns", required: false, type: "text" },
  ]);
  const blanks = JSON.stringify([]);
  const packet = JSON.stringify({ unresolved: [
    { field: "First Name", is_required: true }, { field: "Email", is_required: true }, { field: "Alma Mater", is_required: false },
    { field: "Are you legally authorized to work in the US?", is_required: true, eligibility: true },
    { field: "Proficiency across programming languages", is_required: true, from_schema: true },
  ] });
  const qs = heldQuestionsOf({ openQuestionsJson: open, blanksJson: blanks, packetJson: packet }).map(q => q.question);
  assert.deepEqual(qs.sort(), ["Are you legally authorized to work in the US?", "Proficiency across programming languages",
    "Tell us why you are interested in this role"].sort());
  // a hold before the form (nothing read): the packet's REQUIRED canonical fields are what's missing
  const before = heldQuestionsOf({ packetJson: packet }).map(q => q.question);
  assert.ok(before.includes("Email") && !before.includes("Alma Mater"), "optional never listed");
});

test("a179TailoringNotWorse (F4): a tailoring that scored lower than the base is not attached — the base résumé is", async () => {
  const { default: express } = await import("express");
  const { default: applyRoutes } = await import("../routes/apply.js");
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'ada','x','PRO')").run();
  db.prepare("INSERT INTO base_resume (user_id, content, name) VALUES (1, ?, 'resume.txt')").run(RESUME);
  let score = { atsScore: 47, baseAtsScore: 57 };
  const gen = async () => ({ html: "<p>tailored</p>", resumeId: 9, ...score });
  const line = applyRoutes(express(), db, (req, _res, next) => next(), () => ({ field_map: {}, handler_map: {} }), gen, async () => ({}), async () => ({}), () => null);
  const lower = await line.resumeForApply(1, "gh::1", "generate");
  assert.equal(lower.keptBase, "tailoring_scored_lower");
  assert.equal(lower.tailoredAtsScore, 47); assert.equal(lower.atsScore, 57);
  assert.doesNotMatch(lower.html, /tailored/);
  score = { atsScore: 61, baseAtsScore: 58 };
  const higher = await line.resumeForApply(1, "gh::1", "generate");
  assert.equal(higher.html, "<p>tailored</p>"); assert.equal(higher.keptBase, undefined);
});

test("a179TailoredOnlyWithDelta (approval rows): a Ready-to-approve row's own fields — resume.atsScore beside baseAtsScore", () => {
  // 46d, the canary's production walk: a 74 -> 74 lift on a Ready-to-approve row must read "already fits", not "Tailored"
  assert.equal(resumeStepOf({ resume: { atsScore: 74 }, baseAtsScore: 74 }).label, "Your résumé already fits — tailoring changed no score");
  assert.equal(resumeStepOf({ resume: { atsScore: 80 }, baseAts: { score: 74 } }).label, "Tailored your résumé");
  const src = fs.readFileSync("routes/apply.js", "utf8");
  assert.match(src, /baseAtsScore: baseScoreOf\(r\),/);
  assert.match(src, /SELECT base_ats_score FROM resumes WHERE user_id = \? AND job_id = \?/);
});

// ⭐ 46f · A179 F1's other half, found by the local walk (scripts/walkA179local.mjs, 9 / 9): POST /api/apply/runs judged the
// prerequisites from the profile ROW only, so an empty profile with a base résumé that names the person was refused
// "profile_name" before the run — and the run is where completeProfileForApply fills that row. It is filled first now.
test("a179PrerequisitesAfterTheResumeFill: the run-start gate fills an empty profile from the résumé before it judges", () => {
  const src = fs.readFileSync("routes/apply.js", "utf8").replace(/\r\n/g, "\n");
  assert.match(src, /import \{ contactGaps, completeProfileForApply \} from "\.\.\/services\/applyProfileFill\.js";/);
  const fill = src.indexOf('if (row) completeProfileForApply(db, row);'), gate = src.indexOf("const missingPrerequisites = getMissingApplyPrerequisites(getAutomationReadiness(db, userId));");
  assert.ok(fill > 0 && gate > fill, "the fill runs before the gate reads the profile");
});
