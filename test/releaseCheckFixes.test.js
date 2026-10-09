// 10-09 release check (Task A2) — two behavioural defects reported, fixed on the owner's /loop "complete all
// pending tasks": the apply-time cover letter's résumé, and the admin profile view's eligibility answers.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const SERVER = fs.readFileSync("server.js", "utf8");

test("⛔ the apply-time cover letter reads THIS job's résumé, else the base — never another job's", () => {
  const fn = SERVER.slice(at(SERVER, "async function generateCoverLetterForApply"), at(SERVER, "async function generateCoverLetterForApply") + 2600);
  assert.match(fn, /SELECT html FROM resumes WHERE user_id=\? AND job_id=\?"\)\.get\(userId, String\(jobId\)\)/);
  assert.doesNotMatch(fn, /FROM resumes WHERE user_id=\? ORDER BY updated_at DESC LIMIT 1/, "the newest résumé of ANY job");
  assert.match(fn, /getBaseResumeRecord\(db, \{ userId, profileId: dp\.id \}\)/, "the base résumé is the fallback");
});

test("⛔ the admin profile view returns an allow-list — no eligibility, EEO, custom answers, phone or address", () => {
  const block = SERVER.slice(at(SERVER, "const ADMIN_PROFILE_FIELDS"), at(SERVER, 'app.get("/api/admin/users/:id/profile"') + 400);
  const fields = JSON.parse(block.match(/Object\.freeze\((\[[\s\S]*?\])\)/)[1].replace(/\s+/g, " "));
  for (const banned of ["gender", "ethnicity", "veteran_status", "disability_status", "requires_sponsorship", "has_clearance",
    "clearance_level", "visa_type", "work_auth", "sponsorship_need", "custom_answers", "custom_answer_overrides", "phone",
    "address_line1", "address_line2", "zip", "desired_salary"]) {
    assert.ok(!fields.includes(banned), `${banned} must not be returned`);
  }
  assert.match(block, /ADMIN_PROFILE_FIELDS\.filter\(k => k in row\)/);
  assert.doesNotMatch(block, /res\.json\(db\.prepare\("SELECT \* FROM user_profile/);
});
