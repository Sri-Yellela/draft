import test from "node:test";
import assert from "node:assert/strict";
import { isRunPickable, runPickQuestions, pickedOption, draftAnswersForRun, RUN_DRAFT_MAX, runDraftQuestions } from "../services/applicationAnswerDraft.js";
import { buildOpenQuestions } from "../services/applyAutomation.js";

// ⭐ 46j (owner 11-13: "run again means the latest fixes should apply, meaning answerable questions answered"): a run
// drafts up to 10 free-text answers (was 4) and answers the last attempt's MULTIPLE-CHOICE questions from the résumé —
// only with one of the form's own options, never an eligibility / EEO / sponsorship / salary / opt-in question.
const RESUME = "Jane Placeholder. Senior backend engineer, 7 years of Python and Go. B.S. Computer Science, 2016. Built payment services at a fintech.";

test("a197: which multiple-choice questions a run may answer", () => {
  const opts = (...xs) => xs.map(x => ({ label: x, value: x }));
  assert.equal(isRunPickable({ question: "Years of experience with Python", options: opts("0-2", "3-5", "6+") }), true);
  assert.equal(isRunPickable({ question: "Highest level of education completed", options: opts("Select...", "Bachelor's", "Master's") }), true);
  for (const q of ["Are you legally authorized to work in the US?", "Will you require visa sponsorship?", "Gender", "Veteran status",
                   "Desired salary range", "How did you hear about us?", "I agree to the privacy policy", "Subscribe to our newsletter"])
    assert.equal(isRunPickable({ question: q, options: opts("Yes", "No") }), false, q);
  assert.equal(isRunPickable({ question: "Years of experience with Python", options: [] }), false, "no options → not a pick");
  assert.equal(isRunPickable({ question: "Years of experience with Python", options: opts("0-2", "3-5"), eligibility: "x" }), false);
  const picks = runPickQuestions({ lastOpenQuestions: [
    { question: "Years of experience with Python", options: opts("Select...", "0-2", "3-5", "6+") },
    { question: "years of experience with python ", options: opts("0-2") },
    { question: "Why do you want to work here?", type: "textarea" },
  ] });
  assert.deepEqual(picks, [{ question: "Years of experience with Python", options: ["0-2", "3-5", "6+"] }]);
});

test("a197: the reply must BE one of the options; UNKNOWN or anything else leaves the question to hold", () => {
  assert.equal(pickedOption("6+", ["0-2", "3-5", "6+"]), "6+");
  assert.equal(pickedOption("  bachelor's degree. ", ["Bachelor's degree", "Master's"]), "Bachelor's degree");
  assert.equal(pickedOption("UNKNOWN", ["Yes", "No"]), null);
  assert.equal(pickedOption("I think 6+ years", ["0-2", "3-5", "6+"]), null);
});

test("a197: draftAnswersForRun answers a pick with an option and drafts free text; a stray reply is dropped", async () => {
  const replies = { "Years of experience with Python": "6+", "Preferred office": "Mars", };
  const callTask = async ({ messages }) => {
    const p = messages[0].content;
    const hit = Object.keys(replies).find(k => p.includes(k));
    return { content: [{ text: hit ? replies[hit] : "I built payment services in Python and Go at a fintech, which is the work this team does." }] };
  };
  const out = await draftAnswersForRun({ db: null, userId: 1, resumeText: RESUME, title: "Backend Engineer", company: "Acme", callTask,
    questions: ["Why do you want to work here?",
      { question: "Years of experience with Python", options: ["0-2", "3-5", "6+"] },
      { question: "Preferred office", options: ["Boston", "Remote"] }] });
  assert.equal(out["Years of experience with Python"], "6+");
  assert.equal(out["Preferred office"], undefined, "a reply that is not an option is not typed");
  assert.match(out["Why do you want to work here?"], /payment services/);
});

test("a197: 10 free-text drafts a run (was 4); a low-confidence question keeps its options for the next run", () => {
  assert.equal(RUN_DRAFT_MAX, 10);
  const many = Array.from({ length: 12 }, (_, i) => ({ question: `Describe a project you are proud of, number ${i}`, type: "textarea" }));
  assert.equal(runDraftQuestions({ lastOpenQuestions: many }).length, 10);
  const q = buildOpenQuestions({ lowConfidence: [{ field: "Years of experience with Python", type: "select", value: "3-5", confidence: 0.3,
    options: [{ label: "0-2", value: "0-2" }, { label: "Select", value: "" }, { label: "6+", value: "6+" }] }] });
  assert.deepEqual(q[0].options.map(o => o.label), ["0-2", "6+"]);
  assert.equal(q[0].reason, "low_confidence");
});
