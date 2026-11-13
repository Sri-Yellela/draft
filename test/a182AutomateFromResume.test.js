// ⭐ A182 (owner 11-11): "all these questions can be automated from the resume, this is what we are trying to sell to start
// with." Decisions: work authorisation + sponsorship asked ONCE at résumé upload (never inferred); free-text questions
// drafted during the run in BOTH modes. Offline — a fake gateway.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { isRunDraftable, runDraftQuestions, draftAnswersForRun, answerDraftsEnabled, RUN_DRAFT_MAX } from "../services/applicationAnswerDraft.js";
import { workAuthAffirmative, resolveSponsorshipNeed, PROVENANCE, CONFIDENCE_BY_PROVENANCE } from "../services/applyAutomation.js";
import { WORK_AUTH_CHOICES, SPONSORSHIP_CHOICES, FOUR_THINGS } from "../services/resumeSetup.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const SEVEN = ["Please share your proficiency across programming languages", "Tell us a little about why you are interested in this role!",
  "Current Company", "Current Role", "Alma Mater", "Are you legally authorized to work in the country of employment?",
  "Do you now or in the future require sponsorship for work authorization?"];

test("a182WhichQuestionsADraftAnswers: the two free-text ones, never company / role / school (the Profile's) or eligibility", () => {
  assert.deepEqual(SEVEN.filter(q => isRunDraftable({ question: q })), SEVEN.slice(0, 2));
  assert.equal(isRunDraftable({ question: "Why do you want this job?", options: ["a", "b"] }), false, "a choice is not free text");
  const qs = runDraftQuestions({ schemaQuestions: [{ label: SEVEN[1], required: true }],
    lastOpenQuestions: SEVEN.map(q => ({ question: q, required: true })).concat([{ question: "Tell us a little about why you are interested in this role!" }]) });
  assert.deepEqual(qs, [SEVEN[1], SEVEN[0]], "the schema's first, the last attempt's after, each once");
  assert.ok(RUN_DRAFT_MAX <= 10);   // 46j (owner, changed on purpose): 4 → 10 — a form with more free-text questions held the rest on every run
});

test("a182DraftsThroughTheGatewayChecked: answers.routine per question; a draft with a foreign link is dropped", async () => {
  const calls = [];
  const callTask = async (args) => { calls.push(args.task); return { content: [{ text: args.messages[0].content.includes("proficiency")
    ? "I work daily in TypeScript and Python, shipping React front ends at Sample Co." : "See https://evil.example.com for my answer." }] }; };
  const out = await draftAnswersForRun({ db: null, userId: 1, resumeText: "Maya Chen — Frontend Engineer at Sample Co. TypeScript, Python, React. ".repeat(3),
    questions: SEVEN.slice(0, 2), title: "Software Engineer", company: "Sample Health", callTask, anthropic: null });
  assert.deepEqual(calls, ["answers.routine", "answers.routine"]);
  assert.deepEqual(Object.keys(out), [SEVEN[0]], "the withheld draft is left out — that field holds as before");
  assert.deepEqual(await draftAnswersForRun({ resumeText: "", questions: SEVEN.slice(0, 1), callTask }), {}, "no résumé, no draft");
});

test("a182DraftedAnswerFillsTheField: drafted_answers is read after the person's own answers, exact question only, never eligibility", () => {
  const src = read("services/applyAutomation.js");
  assert.equal(PROVENANCE.DRAFTED_FROM_RESUME, "drafted_from_resume");
  assert.ok(CONFIDENCE_BY_PROVENANCE.drafted_from_resume >= 0.85, "clears the auto-submit floor (both modes, owner 11-11)");
  const i = at(src, "// ⭐ A182 · 3b. the run's DRAFTED answer");
  const block = src.slice(i, at(src, "// D55 (f) · NEVER OPT THE CANDIDATE IN", i));
  assert.match(block, /normaliseQuestion\(q\) === lblQ/); assert.match(block, /allowEligibilityExactAnswer: false/);
  assert.ok(i > at(src, "// 3. custom_answers — the user's own answer to this question."), "after the person's own answers");
  const apply = read("routes/apply.js");
  // A198 (46j, changed on purpose): the drafts are kept (payloadParts) and MERGED with the answers kept from earlier runs.
  assert.match(apply, /autofillPayload\.drafted_answers = \{ \.\.\.\(autofillPayload\.drafted_answers \|\| \{\}\), \.\.\.drafted \};/);
  assert.match(read("server.js"), /draftRunAnswers: \(\{ userId, jobId, questions, title, company \}\) => answerDraftsEnabled\(db\)/);
  assert.match(read("client/src/lib/heldApplication.js"), /drafted_from_resume: "written by draft from your résumé"/);
});

test("a182DraftsOnByDefault: answer_drafts_enabled is ON unless an admin set it off", () => {
  const db = { prepare: () => ({ get: () => undefined, pluck() { return this; } }) };
  assert.equal(answerDraftsEnabled(db), true);
});

test("a182EligibilityAskedOnceAtUpload: the two choices, stored where the fill reads them", () => {
  assert.deepEqual(FOUR_THINGS.slice(0, 2).map(t => t.key), ["work_auth", "sponsorship_need"]);
  assert.equal(workAuthAffirmative(WORK_AUTH_CHOICES[0].value), true);
  assert.equal(workAuthAffirmative(WORK_AUTH_CHOICES[1].value), false);
  for (const c of SPONSORSHIP_CHOICES) assert.equal(resolveSponsorshipNeed({ sponsorship_need: c.value }), c.value);
  assert.match(read("client/src/pages/profile/ResumeSetup.jsx"), /data-four-choices=\{i\.key\}/);
});
