// D55 (f), the extension's half: the packet's saved answers, the worked-here answer and the EEO
// declines placed on the page's questions — exact question equality only (docs/AUTOFILL_TARGET.md
// §8.1 rows 4–7 and 18, §8.2 items 1–2). Measured end to end on the local Workday replica by
// scripts/d55AutofillWorkday.mjs scenario 4; these are the unit rules. Synthetic data throughout.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as shared from "../shared/savedAnswers.js";
import * as ext from "../extension/savedAnswerMatch.js";
import { placeStatedAnswers } from "../extension/savedAnswerMatch.js";
import { questionKind } from "../extension/gated-handoff.js";
import { packetSavedAnswers } from "../services/applyGatePacket.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const place = (packet, fields, plan = []) => placeStatedAnswers(packet, fields, plan, questionKind);

let idx = 0;
const f = (o) => ({ index: idx++, name: null, id: null, required: false, options: null, widget: null, group: null, ...o });
const dropdown = (label) => f({ type: "button", label, widget: "dropdown" });
const select = (label, opts) => f({ type: "select-one", label, options: opts.map((t, i) => ({ value: `v${i}`, text: t })) });
const radios = (group, name, opts) => opts.map((label) => f({ type: "radio", name, label, group }));
const checkbox = (label) => f({ type: "checkbox", label });

// ── The copy is the shared rule, byte for byte ──────────────────────────────────────────────────
test("⛔ the extension's copy of shared/savedAnswers.js is textually identical", () => {
  for (const fn of ["normaliseQuestion", "pickDeclineOption", "companyNameVariants", "isOptInQuestion",
    "isNegativeAnswer", "parseWorkedHereQuestion"]) {
    // Line endings normalised: which way each file is checked out is incidental (CLAUDE.md), the text is not.
    const src = (x) => String(x).replace(/\r\n/g, "\n");
    assert.equal(src(ext[fn]), src(shared[fn]), `${fn} drifted from shared/savedAnswers.js`);
  }
  for (const re of ["DECLINE_OPTION_RE", "OPT_IN_RE"]) {
    assert.equal(ext[re].source, shared[re].source, re);
    assert.equal(ext[re].flags, shared[re].flags, re);
  }
  assert.equal(ext.EEO_DECLINE, shared.EEO_DECLINE);
  assert.equal(ext.COMPANY_TOKEN, shared.COMPANY_TOKEN);
  // The module-private constants the copied functions close over.
  const s = read("shared/savedAnswers.js"), e = read("extension/savedAnswerMatch.js");
  for (const name of ["LEGAL_SUFFIX_RE", "WORKED_HERE_RES", "TAIL_BEFORE_RE", "TAIL_WIDENED_RE", "TAIL_TIME_RE", "HERE_RE"]) {
    const decl = (src) => { const i = at(src, `const ${name} =`); return src.slice(i, at(src, ";\n", i)); };
    assert.equal(decl(e), decl(s), `${name} drifted`);
  }
  // And the copy applyPlan carries into the page for a custom dropdown's decline pick.
  const gh = read("extension/gated-handoff.js");
  const reAt = at(gh, "  const DECLINE_OPTION_RE =");
  const inPage = gh.slice(reAt, at(gh, ";\n", reAt));
  assert.equal(inPage.replace(/^\s*const DECLINE_OPTION_RE =\s*/, ""), "/" + shared.DECLINE_OPTION_RE.source + "/i");
});

// ── 1 · saved answers: EQUALITY, never containment ──────────────────────────────────────────────
test("⛔ (f)1 a saved answer is placed only on the SAME question — normalised equality, never containment", () => {
  const saved = [{ question: "Do you require sponsorship?", answer: "No", eligibility: true, optIn: false }];
  // The inverted / widened question that CONTAINS the saved one's words — never matched.
  let r = place({ savedAnswers: saved }, [dropdown("Do you now or in the future require sponsorship?")]);
  assert.equal(r.plan.length, 0);
  r = place({ savedAnswers: saved }, [dropdown("Do you not require sponsorship?")]);
  assert.equal(r.plan.length, 0);
  r = place({ savedAnswers: saved }, [dropdown("Do you require sponsorship to work for any employer other than us?")]);
  assert.equal(r.plan.length, 0, "the page's question CONTAINS the saved one — containment is never a match");
  // The same question, with an asterisk, "(required)" and different spacing — matched.
  r = place({ savedAnswers: saved }, [dropdown("Do you  require sponsorship (required) *")]);
  assert.equal(r.plan.length, 1);
  assert.equal(r.plan[0].value, "No");
  assert.equal(r.plan[0].exactOption, true, "an eligibility answer must not take the closest option");
  assert.equal(r.plan[0].eligibility, true, "pinned to the top of the review");
  assert.equal(r.plan[0].provenance, "saved_answer");
});

test("⛔ (f)1 eligibility / EEO / opt-in: the answer must BE one of the options — no closest pick", () => {
  const saved = [{ question: "Are you legally authorized to work in the United States?", answer: "Yes", eligibility: true }];
  const s = select("Are you legally authorized to work in the United States?", ["Yes, I am authorized", "No"]);
  const r = place({ savedAnswers: saved }, [s]);
  assert.equal(r.plan.length, 0, "'Yes' is not 'Yes, I am authorized' — refused, not approximated");
  assert.equal(r.notes[0].reason, "saved_answer_not_an_option");
  const ok = place({ savedAnswers: saved }, [select("Are you legally authorized to work in the United States?", ["Yes", "No"])]);
  assert.equal(ok.plan[0].value, "v0");
  // ⭐ 10-21: a typeahead (Greenhouse's Yes / No pickers) takes a sensitive answer too — but told to pick the EXACT
  // option or nothing (applyPlan's setTypeahead 'exact'), never the closest.
  const ta = place({ savedAnswers: saved }, [f({ type: "text", widget: "typeahead", label: saved[0].question })]).plan;
  assert.equal(ta.length, 1);
  assert.equal(ta[0].exactOption, true);
});

test("⛔ (f)1 an opt-in only ever gets the candidate's own No", () => {
  const q = "Yes, I would like to receive text messages and marketing communications about future opportunities.";
  let r = place({ savedAnswers: [{ question: q, answer: "Yes", optIn: true }] }, [checkbox(q)]);
  assert.equal(r.plan.length, 0, "a saved YES to marketing was placed");
  assert.equal(r.notes[0].reason, "opt_in_left_for_you");
  // optIn flagged by the page's wording even if the saved entry did not say so.
  r = place({ savedAnswers: [{ question: q, answer: "Yes" }] }, [checkbox(q)]);
  assert.equal(r.plan.length, 0);
  r = place({ savedAnswers: [{ question: q, answer: "No", optIn: true }] }, [checkbox(q)]);
  assert.deepEqual([r.plan[0].value], ["false"], "the saved No leaves it unticked");
  r = place({ savedAnswers: [{ question: "Join our talent community?", answer: "No thanks", optIn: true }] }, [dropdown("Join our talent community?")]);
  assert.equal(r.plan[0].exactOption, true);
  // A free-text box is never an opt-in's answer.
  assert.equal(place({ savedAnswers: [{ question: q, answer: "No", optIn: true }] }, [f({ type: "text", label: q })]).plan.length, 0);
});

test("(f)1 an ordinary question takes its saved answer; a control already planned is left alone", () => {
  const saved = [{ question: "Why do you want to work at Northwind Systems?", answer: "SENTINEL-MOTIVATION" }];
  const ta = f({ type: "textarea", label: "Why do you want to work at Northwind Systems?" });
  assert.equal(place({ savedAnswers: saved }, [ta]).plan[0].value, "SENTINEL-MOTIVATION");
  assert.equal(place({ savedAnswers: saved }, [ta], [{ index: ta.index }]).plan.length, 0);
});

// ── 2 · worked here ─────────────────────────────────────────────────────────────────────────────
test("⛔ (f)2 the worked-here answer goes on a question about THIS employer — radio group read by its legend", () => {
  const group = radios("Have you previously worked for this company?*", "previousWorker", ["Yes", "No"]);
  const yes = { workedHere: { company: "Northwind Systems, Inc.", answer: "Yes", reason: "in_work_history" } };
  let r = place(yes, group);
  assert.equal(r.plan.length, 1);
  assert.equal(r.plan[0].index, group[0].index);
  assert.equal(r.plan[0].value, "true");
  assert.equal(r.plan[0].provenance, "work_history");
  // By name, in its bare or legal form.
  r = place(yes, [select("Have you ever worked for Northwind Systems before?", ["Yes", "No"])]);
  assert.equal(r.plan[0].value, "v0");
  // A question about ANOTHER employer is not this history's to answer.
  r = place(yes, [select("Have you worked at Contoso before?", ["Yes", "No"])]);
  assert.equal(r.plan.length, 0);
  assert.equal(r.notes[0].reason, "worked_here_left_for_you");
  // "or any of its subsidiaries" cannot be ruled out → no No; a time window cannot be dated → no Yes.
  const no = { workedHere: { company: "Northwind Systems", answer: "No" } };
  assert.equal(place(no, [select("Have you worked for Northwind Systems or any of its subsidiaries?", ["Yes", "No"])]).plan.length, 0);
  assert.equal(place(yes, [select("Have you worked for this company in the last 12 months?", ["Yes", "No"])]).plan.length, 0);
  // A null answer (no work history) places nothing.
  assert.equal(place({ workedHere: { company: "Northwind Systems", answer: null } }, group).plan.length, 0);
});

test("(f)2 the candidate's own saved answer outranks the work history", () => {
  const q = "Have you previously worked for this company?";
  const r = place({ savedAnswers: [{ question: q, answer: "No" }], workedHere: { company: "Northwind Systems", answer: "Yes" } },
    radios(q, "pw", ["Yes", "No"]));
  assert.equal(r.plan[0].provenance, "saved_answer");
  assert.equal(r.plan[0].label, q);
});

// ── 3 · the EEO decline ─────────────────────────────────────────────────────────────────────────
test("⛔ (f)3 a declined EEO field takes the form's OWN decline option; none on offer → blank", () => {
  const p = { eeoDeclines: ["gender", "veteran", "disability", "ethnicity"] };
  let r = place(p, [select("Gender", ["Male", "Female", "Decline to self identify"])]);
  assert.equal(r.plan[0].value, "v2");
  assert.equal(r.plan[0].provenance, "eeo_decline");
  r = place(p, [select("Veteran status", ["I am a protected veteran", "I am not a protected veteran"])]);
  assert.equal(r.plan.length, 0, "'I am not a protected veteran' is an ANSWER, not a decline");
  assert.equal(r.notes[0].reason, "decline_option_absent");
  // A Workday dropdown: options exist only once opened, so the page picks by the same rule.
  r = place(p, [dropdown("Ethnicity*")]);
  assert.equal(r.plan[0].declineOption, true);
  // The CC-305 disability form names nothing in its question — classed by its options.
  const dis = radios("Please check one of the boxes below:", "disabilityStatus", [
    "Yes, I have a disability (or previously had a disability)",
    "No, I do not have a disability and have not had one in the past", "I do not want to answer"]);
  r = place(p, dis);
  assert.equal(r.plan[0].index, dis[2].index);
});

test("⛔ (f)3 a decline is never a default — only a field IN eeoDeclines is touched", () => {
  const fields = [select("Gender", ["Male", "Female", "Decline to self identify"]), dropdown("Veteran Status")];
  assert.equal(place({ eeoDeclines: ["veteran"] }, fields).plan.length, 1);
  assert.equal(place({ eeoDeclines: ["veteran"] }, fields).plan[0].declineOption, true);
  assert.equal(place({}, fields).plan.length, 0);
  assert.equal(place({ eeoDeclines: [] }, fields).plan.length, 0);
});

test("(f)3 the server sends the declined KEYS only — not blank fields, not any stated EEO value", () => {
  const out = packetSavedAnswers({ handler_map: { gender: "Choose not to disclose", ethnicity: "SENTINEL-ETHNICITY",
    veteran: "", disability: "choose not to disclose" } });
  assert.deepEqual(out.eeoDeclines, ["gender", "disability"]);
  assert.doesNotMatch(JSON.stringify(out), /SENTINEL/);
  assert.equal(packetSavedAnswers({ handler_map: { gender: "" } }).eeoDeclines, undefined);
});

// ── Wiring ──────────────────────────────────────────────────────────────────────────────────────
test("(f) wiring: every wizard step runs the placer; the page honours exact and decline picks", () => {
  const gh = read("extension/gated-handoff.js");
  const loop = gh.slice(at(gh, "const matched = matchAnswersToFields(answers, step.fields);"));
  assert.match(loop.slice(0, 600), /placeStatedAnswers\(released\.packet, step\.fields, matched\.plan, questionKind\)/);
  assert.match(gh, /setCombobox\(el, step\.value, step\.declineOption \? 'decline' : step\.exactOption \? 'exact' : null\)/);
  assert.match(gh, /mode === 'exact' \? texts\.findIndex\(t => same\(t, want\)\)/);
  // The probe reads a radio's group question.
  // A99 (10-30): a native radio's or an ARIA role=radio's.
  assert.match(gh, /group: \(ariaKind\(el\) \|\| el\.type\) === 'radio' \?/);
});
