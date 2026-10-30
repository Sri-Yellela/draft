import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

// D55 (f) piece 1 — "Choose not to disclose" is a STATED EEO answer (docs/AUTOFILL_TARGET.md §8.1 row
// 18, §7.5: "decline to answer IS a stated answer"). A Self-ID step fills with the form's own decline
// option instead of stopping; a field the candidate never set stays blank; the decline is never a default.

import { buildAnswers, matchOptionValue, isEeoField } from "../services/applyAutomation.js";
import { EEO_DECLINE, EEO_FIELDS, isEeoDecline, pickDeclineOption, DECLINE_OPTION_RE } from "../shared/savedAnswers.js";

const opts = (...labels) => labels.map((l, i) => ({ value: `opt_${i}`, label: l }));
const GENDER = opts("Male", "Female", "Decline to self-identify");
const VETERAN = opts("I am a protected veteran", "I am not a protected veteran", "I don't wish to answer");
const DISABILITY = opts("Yes, I have a disability (or previously had a disability)", "No, I do not have a disability", "I do not want to answer");

const field = (label, handler_type, options, over = {}) => ({
  field_id: label, name: label.toLowerCase().replace(/\W+/g, "_"), label, type: "select",
  handler_type, options, is_required: true, ...over,
});
const payload = (eeo) => ({
  field_map: {}, custom_answers: {},
  handler_map: { gender: eeo.gender ?? "", ethnicity: eeo.ethnicity ?? "", veteran: eeo.veteran ?? "", disability: eeo.disability ?? "" },
});

test("a DECLINE fills each Self-ID step with the form's own decline option, however it is worded", () => {
  const fields = [
    field("Gender", "gender", GENDER),
    field("Veteran Status", "veteran", VETERAN),
    field("Disability Status", "disability", DISABILITY),
  ];
  const out = buildAnswers(fields, payload({ gender: EEO_DECLINE, veteran: EEO_DECLINE, disability: EEO_DECLINE }));
  const by = Object.fromEntries(out.map(a => [a.label, a]));
  assert.equal(by["Gender"].value, "opt_2", "Decline to self-identify");
  assert.equal(by["Veteran Status"].value, "opt_2", "I don't wish to answer");
  assert.equal(by["Disability Status"].value, "opt_2", "I do not want to answer");
  for (const a of out) {
    assert.equal(a.skipped, undefined, `${a.label} filled, not held`);
    assert.equal(a.provenance, "handler_exact", "it is the candidate's own stated answer");
  }
});

test("a decline on a form that offers NO decline option stops — it is never answered with something else", () => {
  const [a] = buildAnswers([field("Gender", "gender", opts("Male", "Female"))], payload({ gender: EEO_DECLINE }));
  assert.equal(a.value, null);
  assert.equal(a.skipped, true);
  assert.deepEqual(a.refusals, ["eeo:decline_option_absent"]);
});

test("⛔ an EEO field the candidate never set stays BLANK — no option is chosen, decline is not a default", () => {
  const fields = [
    field("Gender", "gender", GENDER),
    field("Are you Hispanic/Latino?", "ethnicity", opts("Yes", "No", "Decline to self-identify")),
    field("Veteran Status", "veteran", VETERAN),
  ];
  const out = buildAnswers(fields, payload({}));
  assert.equal(out.filter(a => a.value !== null && a.value !== undefined).length, 0,
    "nothing was filled: " + JSON.stringify(out));
});

test("⛔ the payload builder never DEFAULTS an EEO column — an unset one goes out empty", () => {
  const src = fs.readFileSync("server.js", "utf8").replace(/\r\n/g, "\n");
  const body = src.slice(at(src, "function buildAutofillPayload("), at(src, "// ── Auth ──"));
  assert.ok(body.length > 1000, "buildAutofillPayload found");
  assert.doesNotMatch(body, /EEO_DECLINE|Choose not to disclose|Decline to self/i, "no decline default in the payload");
  for (const [handler, col] of [["gender", "gender"], ["ethnicity", "ethnicity"], ["veteran", "veteran_status"], ["disability", "disability_status"]]) {
    assert.match(body, new RegExp(`'${handler}': profile\\?\\.${col} \\|\\| ''`), `${handler} is the stored value or blank`);
  }
});

test("a stated answer picks ITS option exactly — 'Male' never fills 'Female', which most forms list first", () => {
  const [a] = buildAnswers([field("Gender", "gender", opts("Female", "Male", "Decline to self-identify"))], payload({ gender: "Male" }));
  assert.equal(a.value, "opt_1");
  assert.equal(matchOptionValue("I am not a protected veteran", VETERAN), "opt_1");
});

test("the decline vocabulary does not swallow real answers", () => {
  for (const real of ["I am not a protected veteran", "No, I do not have a disability", "Male", "Not Hispanic or Latino"]) {
    assert.equal(DECLINE_OPTION_RE.test(real), false, real);
  }
  for (const decline of ["Decline to self-identify", "I don't wish to answer", "I do not want to answer", "Prefer not to say",
    "I choose not to disclose", "Decline To State", "I don’t wish to answer"]) {
    assert.ok(pickDeclineOption([{ value: "x", label: decline }]) === "x", decline);
  }
  assert.equal(isEeoDecline(EEO_DECLINE), true);
  assert.equal(isEeoDecline(""), false, "blank is NOT a decline");
  assert.equal(isEeoDecline(null), false);
  assert.equal(isEeoDecline("Male"), false);
});

test("a non-EEO field holding the decline text is not treated as a decline", () => {
  assert.equal(isEeoField({ label: "How did you hear about us?", handler_type: null }), false);
  assert.equal(isEeoField({ label: "Gender", handler_type: null }), true);
  assert.equal(isEeoField({ label: "Self-ID", handler_type: "disability" }), true);
});

// D101 (10-30) moved the four self-ID answers from Profile's EEO selects (user_profile columns the fill stopped
// reading after the first import) to Application defaults — this test followed them on purpose.
test("Application defaults offer the decline as its OWN choice for all four self-ID answers, and blank says 'Not set'", () => {
  const src = fs.readFileSync("client/src/components/ProfileSections.jsx", "utf8").replace(/\r\n/g, "\n");
  const panel = fs.readFileSync("client/src/panels/ProfilePanel.jsx", "utf8");
  assert.match(panel, /<ProfileSections theme=\{theme\}\/>/);
  assert.doesNotMatch(panel, /Voluntary Self-Identification \(EEO\)/, "one place sets these answers, not two");
  // The four self-ID keys each get the decline first, then the usual words.
  for (const key of ["gender", "ethnicity", "veteran", "disability"]) assert.match(src, new RegExp(`\\b${key}: \\[`), key);
  assert.match(src, /SELF_ID\[item\.key\] \? \[EEO_DECLINE, \.\.\.SELF_ID\[item\.key\]\]/);
  assert.match(src, /const NOT_SET = "Not set — I'll answer on each form";/);
  assert.match(src, /<option value="">\{NOT_SET\}<\/option>/);
  assert.match(src, /onSet\(item\.key, e\.target\.value === "" \? null : e\.target\.value\)/, "blank CLEARS the default — never stored as an answer");
  assert.doesNotMatch(src, /Prefer not to say/, "blank must not be labelled as a decline — the fill leaves it for the candidate");
  assert.equal(EEO_FIELDS.length, 4);
});
