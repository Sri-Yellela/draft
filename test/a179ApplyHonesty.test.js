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
  const at = src.indexOf('setJobStatus("held_review", "profile_contact_empty"');
  const launch = src.indexOf("await autoApply(jobUrl, autofillPayload");
  assert.ok(at > 0 && launch > at, "the empty-profile hold comes before any browser launch");
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
  assert.equal(two.title, "2 answers only you can give");
  assert.match(two.lead, /draft filled 7 of 13 fields/);
  const none = heldHeadline(heldNode({ fill: { filled: 0, discovered: 24 } }, ["Email"]));
  assert.match(none.lead, /Nothing was filled/);
  assert.doesNotMatch(none.lead, /Everything else is done/);
});
