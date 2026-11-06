// ⛔⛔ D165 (owner 11-06) — "the semi run failed miserably, didnt even trigger a resume generation". The 45a audit: the
// *Ask me first* run (mode auto + approval required) took CASE D — the preview WITHOUT generating (AL2) — so the form was
// filled with no résumé and held "Resume left empty"; the résumé was written 26 s later for the hand-off packet only.
// R1: THE RÉSUMÉ IS NEVER THE PERSON'S JOB. These pin the fix (A6 (1)–(2)) and A135's one automatic retry.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";
import { personQuestions, describeApplication } from "../client/src/lib/applyObstacles.js";

const route = fs.readFileSync("routes/apply.js", "utf8").replace(/\r\n/g, "\n");
const server = fs.readFileSync("server.js", "utf8").replace(/\r\n/g, "\n");

test("d165ResumeAlwaysGenerated: an Ask-me-first run no longer defers — only the operator switch brings AL2 back", () => {
  assert.match(route, /const deferGeneration = needsApproval && !generateAtQueue && process\.env\.DRAFT_DEFER_PREVIEW_GENERATION === "1";/);
  // With deferGeneration false, an approval-required run with no current artifact is CASE C: generation starts with the
  // browser, and the upload step awaits it (resumePathPromise) — the artifact is recorded on the attempt.
  const caseC = route.slice(at(route, "CASE C: no artifact"), at(route, "// Record final result for CASE A and CASE C"));
  assert.match(caseC, /const resumePathPromise = generateResumeForApply\(userId, jobId, toolType\)/);
  assert.match(caseC, /usedArtifactId = gen\.resumeId \?\? null;/);
  assert.match(caseC, /resumePathPromise,\n/);
  // The per-profile toggle that offered deferral is gone.
  assert.doesNotMatch(fs.readFileSync("client/src/panels/JobProfilesPanel.jsx", "utf8"), /generate_at_queue/);
});

test("d165ResumeNeverLeftToUser: the résumé / cover-letter slots are never 'yours to answer'; a run without one says it couldn't be made", () => {
  assert.deepEqual(personQuestions(["Resume", "Salary Requirement", "Resume/CV", "Cover Letter", "Résumé *", "Attach your resume", "Why us?", "Resume gap explanation"]),
    ["Salary Requirement", "Why us?", "Resume gap explanation"]);
  assert.deepEqual(personQuestions(null), []);
  const sections = fs.readFileSync("client/src/panels/AutoApplyPanelSections.jsx", "utf8");
  assert.match(sections, /Still yours to answer: <span style=\{\{ fontWeight: 700 \}\}>\{personQuestions\(job\.missingRequired\)\.join\(", "\)\}/);
  const obstacles = fs.readFileSync("client/src/lib/applyObstacles.js", "utf8");
  for (const code of ["resume_unavailable", "generation_failed", "resume_claim_violation"]) {
    const block = obstacles.slice(at(obstacles, `  ${code}: {`), at(obstacles, "},", at(obstacles, `  ${code}: {`)));
    assert.match(block, /obstacle: "The résumé couldn't be made/, code);
    assert.match(block, /action: "Try again/, code);
    assert.doesNotMatch(block, /Generate one for this job/, `${code}: the person is never sent to make it`);
  }
  assert.ok(describeApplication, "the obstacle table is read through describeApplication");
});

test("a135ClaimViolationRetriedOnce: one withheld résumé is regenerated once, within the person's limit, before the run gives up", () => {
  const fn = server.slice(at(server, "function generateResumeForApply(userId, jobId, toolType) {"), at(server, "// ⭐ T19 hardening (G1, 10-30)"));
  assert.match(fn, /const callOnce = \(\) => coreGenerateResume\(/);
  assert.match(fn, /if \(e\?\.code !== "resume_claim_violation" \|\| !checkLimit\(db, userId, "resume_generate"\)\.allowed\) throw e;/);
  assert.match(fn, /return callOnce\(\);/);
  // Exactly one retry: callOnce is invoked twice in the chain, no loop.
  assert.equal((fn.match(/callOnce\(\)/g) || []).length, 2);
});

test("d165SemiStopsOnlyForPersonQuestions: an upload slot is never an open question put to the person", async () => {
  const { buildOpenQuestions } = await import("../services/applyAutomation.js");
  const qs = buildOpenQuestions({ missingFields: [
    { label: "Resume", name: "resume", type: "file", is_required: true },
    { label: "Cover Letter", name: "cl", type: "file", is_required: true },
    { label: "Salary Requirement", name: "salary", type: "text", is_required: true },
  ] });
  assert.deepEqual(qs.map(q => q.question), ["Salary Requirement"]);
});

// R3 · AUTO answers from what it knows — the Profile and the person's own saved answers. D123 P7 (a model writing routine
// answers) was never built (A120), so nothing in the fill path can invent an eligibility, salary or legal answer; these
// pin that, so the day P7 lands it has to keep the never-list out of the model's hands.
test("d165AutoNeverInventsNeverListAnswers: the fill path imports no model; eligibility classes are recognised; salary comes from the Profile", () => {
  const auto = fs.readFileSync("services/applyAutomation.js", "utf8");
  for (const l of auto.split(/\r?\n/).filter(l => /^import\b/.test(l))) {
    assert.doesNotMatch(l, /anthropic|modelGateway|toolsService|coreGenerate/i, `the fill path must not reach a model: ${l}`);
  }
  for (const cls of ["sponsorship", "citizenship", "visa", "eeo", "work_auth", "criminal", "clearance"]) {
    assert.ok(auto.includes(`['${cls}',`), `${cls} is on the never-guess list`);
  }
  assert.match(auto, /'desired_salary':'salary'/, "salary is answered only from the Profile's salary key or a saved answer");
});

// R2 · every answer given is saved for next time, and the held jobs it unblocks are retried under the person's own
// approval default (an Ask-me-first retry ends at Ready to review, never sent).
test("d165AnswersSavedForNextTime: /api/apply/answers saves (remember), retries what it unblocks, keeps the approval default", () => {
  const core = route.slice(at(route, "function answersCore(req, out) {"), at(route, 'app.post("/api/apply/answers"'));
  assert.match(core, /const \{ answers = \{\}, overrides = \{\}, retryJobIds = null, mode = "auto", approvalMode = null \} = req\.body \|\| \{\};/);
  assert.match(core, /if \(approvalMode === "approved"\)\s*\n\s*return out\.status\(400\)/, "answering never authorises a send");
  assert.match(core, /Object\.prototype\.hasOwnProperty\.call\(remember, q\)/, "each answer carries its own remember choice");
  assert.match(core, /startRun\(req\.user\.id, normalisePlanTier\(req\.user\?\.planTier\), toRetry,\s*\n\s*\{ mode, tool: "generate", approvalMode, retryOfHeld: true \}\)/);
});
