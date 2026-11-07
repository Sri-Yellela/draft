// ⛔ D175 FA3 [T7] · R3 — AUTO NEVER INVENTS A NEVER-LIST ANSWER. Salary, sponsorship, work authorisation, citizenship,
// visa, clearance, criminal history and EEO are filled ONLY from the person's own data: a canonical Profile key / handler
// (Application defaults), or their saved answer to that exact question. Nothing else — no near label, no other key
// (a country of residence never answers citizenship), and no model: the fill engine has no model-written provenance.
// An unanswered required one holds the application at Needs you (full-auto escalates), and the run goes on.
// Synthetic person throughout.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildAnswers, defaultAnswerPolicy, PROVENANCE, eligibilityClassOf } from "../services/applyAutomation.js";

const f = (label, over = {}) => ({ field_id: label, name: label.toLowerCase().replace(/\W+/g, "_"), label, type: "text", required: true, ...over });
const NEVER_LIST = [
  f("Salary expectation"),
  f("Will you now or in the future require sponsorship for employment visa status?"),
  f("Are you legally authorized to work in the United States?"),
  f("Are you a U.S. citizen?"),
  f("Do you have an active security clearance?"),
  f("Have you ever been convicted of a felony?"),
  f("Gender"),
  f("Veteran status"),
];
const ORDINARY = [f("Email"), f("First Name")];
// A person whose Profile has their contact details and a country — and nothing on the never-list.
const PROFILE = { field_map: { email: "jordan.rivera@example.org", first_name: "Jordan", country: "United States", city: "Boston" },
  handler_map: {}, custom_answers: {} };

test("FA3: with nothing saved, no never-list field is answered — only the ordinary ones", () => {
  const got = buildAnswers([...ORDINARY, ...NEVER_LIST], PROFILE);
  const answered = got.filter(a => a.value != null && a.value !== "" && !a.skipped && !a.policy_rejected).map(a => a.label);
  assert.deepEqual(answered.sort(), ["Email", "First Name"]);
  for (const nf of NEVER_LIST) assert.ok(!answered.includes(nf.label), `${nf.label} must not be invented`);
});

test("FA3: the person's saved answer to the exact question fills it, marked as theirs", () => {
  const saved = { ...PROFILE, custom_answers: {
    "Salary expectation": "150000",
    "Are you a U.S. citizen?": "No",
    "Gender": "Prefer not to say",
  } };
  const got = buildAnswers([...NEVER_LIST], saved);
  const byLabel = Object.fromEntries(got.filter(a => a.value != null).map(a => [a.label, a]));
  assert.equal(byLabel["Salary expectation"]?.value, "150000");
  assert.equal(byLabel["Are you a U.S. citizen?"]?.value, "No");
  for (const l of ["Salary expectation", "Are you a U.S. citizen?"]) {
    assert.equal(byLabel[l].provenance, PROVENANCE.CUSTOM_ANSWER, `${l}: the person's own answer`);
  }
  assert.ok(!byLabel["Do you have an active security clearance?"], "a question they did not answer stays empty");
});

test("FA3: a saved answer to a DIFFERENT eligibility question never answers this one (no containment)", () => {
  const near = { ...PROFILE, custom_answers: { "Are you authorized to work in Canada?": "Yes", "Citizenship": "Canada" } };
  const got = buildAnswers([f("Are you legally authorized to work in the United States?"), f("Are you a U.S. citizen?")], near);
  assert.equal(got.filter(a => a.value != null && a.value !== "").length, 0);
});

test("FA3: full-auto holds on an unanswered required field instead of guessing — and never sends a guess", () => {
  const guess = { field_id: "s", label: "Salary expectation", value: "120000", provenance: PROVENANCE.LABEL_FUZZY, confidence: 0.3, required: true };
  const d = defaultAnswerPolicy({ mode: "full", answers: [guess] });
  assert.equal(d.escalate, true);
  assert.deepEqual(d.approved, []);
});

test("FA3: every never-list label is classed (or is salary, which only its own key / saved answer fills) and no model writes a fill answer", () => {
  for (const nf of NEVER_LIST.filter(x => x.label !== "Salary expectation")) assert.ok(eligibilityClassOf(nf.label), nf.label);
  const src = fs.readFileSync("services/applyAutomation.js", "utf8");
  assert.doesNotMatch(src, /callTask|callModel|messages\.create/, "the fill engine calls no model");
  assert.ok(!Object.values(PROVENANCE).some(p => /model|llm|generated|ai_/.test(p)), "no model-written provenance exists");
});
