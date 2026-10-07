// D55 — the DECIDED fill rules (AUTOFILL_TARGET.md §7.3–§7.5), held in the matcher so no widget path
// can route around them:  §7.3 a screening question that would rule the candidate out stops and asks
// unless they stated the answer · §7.4 never opt the candidate in · §7.5 EEO is stated or blank.
// Work authorisation keeps G2's rule (exact control match or nothing). The headless run proves the
// same on /workday-replica: the opt-in unticked, "7+ years?" and EEO left, the stop shown.

import { test } from "node:test";
import assert from "node:assert/strict";

import { matchAnswersToFields } from "../extension/gated-handoff.js";

const f = (over) => ({ index: 0, name: null, id: null, type: "text", label: "", required: false, options: null, ...over });
const one = (answer, field) => matchAnswersToFields([answer], [f(field)]);

test("§7.4 a marketing / WhatsApp opt-in is NEVER ticked — not even from an exact control match", () => {
  for (const label of ["Yes, I would like to receive text messages and marketing communications about future opportunities.",
                       "Would you like to receive WhatsApp messages from our recruiting team?",
                       "Join our talent community"]) {
    const { plan, unmatched } = one({ name: "marketing_opt_in", field: label, value: "Yes", provenance: "custom_answer" },
      { name: "marketing_opt_in", type: "checkbox", label });
    assert.equal(plan.length, 0, label);
    assert.equal(unmatched[0].reason, "opt_in_left_for_you");
  }
  const t = one({ name: "sms", field: "SMS updates", value: true, provenance: "field_map_exact" },
    { name: "sms", type: "checkbox", label: "Receive SMS updates about your application" });
  assert.equal(t.plan.length, 0, "a boolean true is a yes too");
});

test("§7.4 …and 'No' only when it is the candidate's OWN stored answer", () => {
  const label = "Would you like to receive WhatsApp messages from our recruiting team?";
  assert.equal(one({ name: "wa", field: label, value: "No", provenance: "custom_answer" }, { name: "wa", label }).plan.length, 1);
  assert.equal(one({ name: "wa", field: label, value: "No", provenance: "field_map_exact" }, { name: "wa", label }).plan.length, 0);
});

test("§7.3 a ruling-out screen is answered only where the candidate stated it", () => {
  const label = "Do you have 7+ years of professional software engineering experience?";
  // A label guess at "No" would rule them out without asking.
  const guess = one({ name: "years_exp", field: label, value: "No", provenance: "label_fuzzy" }, { name: "q7", label });
  assert.equal(guess.plan.length, 0);
  assert.equal(guess.unmatched[0].reason, "screening_left_for_you");
  // Their own saved answer to that exact question is theirs to have stated.
  assert.equal(one({ name: "q7", field: label, value: "Yes", provenance: "custom_answer" }, { name: "q7x", label }).plan.length, 1);
  // A profile value matched only by the label is not the candidate stating THIS question's answer.
  assert.equal(one({ name: "years", field: label, value: "Yes", provenance: "field_map_exact" }, { name: "qx", label }).plan.length, 0);
});

test("§7.5 EEO is stated or blank — a guessed EEO value is never placed; a stated one is", () => {
  assert.equal(one({ name: "gender", field: "Gender", value: "Female", provenance: "default" }, { name: "gender", label: "Gender" }).plan.length, 0);
  assert.equal(one({ name: "gender", field: "Gender", value: "Female", provenance: "label_fuzzy" }, { name: "sex", label: "Gender" }).plan.length, 0);
  assert.equal(one({ name: "gender", field: "Gender", value: "Female", provenance: "handler_exact" }, { name: "gender", label: "Gender" }).plan.length, 1);
});

test("work authorisation keeps G2's rule — exact control or nothing — on a Workday-shaped question", () => {
  const { plan, unmatched } = one(
    { name: "work_authorization", field: "Are you legally authorized to work in the country of employment?", value: "Yes",
      provenance: "field_map_exact", eligibility: true },
    { id: "dropdown-q-authorized", label: "Are you legally authorized to work in the United States?", widget: "dropdown" });
  assert.equal(plan.length, 0);
  assert.equal(unmatched[0].reason, "eligibility_requires_exact_match");
});

test("ordinary fields are untouched by the rules", () => {
  assert.equal(one({ name: "city", field: "City", value: "Springfield", provenance: "field_map_exact" }, { name: "city", label: "City" }).plan.length, 1);
});
