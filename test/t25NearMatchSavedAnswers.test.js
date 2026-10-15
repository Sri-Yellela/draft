// T25 (owner 10-15) · NEAR-MATCH SAVED ANSWERS. "How did you hear about this job?" reuses the answer saved for "How did
// you hear about us?" — deterministically (content words, stop words and employer words set aside, a high Jaccard
// threshold, the same question word / negation / numbers), never across question kinds (D96 §7), only one of a
// picker's own options, and landing as Check with the original question named. SYNTHETIC answers only.
import test from "node:test";
import assert from "node:assert/strict";

const gh = await import("../extension/gated-handoff.js");
const ov = await import("../extension/review-overlay.js");
const sam = await import("../extension/savedAnswerMatch.js");

let idx = 0;
const f = (o) => ({ index: idx++, name: null, id: `f${idx}`, required: false, options: null, widget: null, group: null, automationId: null, visible: true, hasValue: false, ...o });
const saved = (question, answer, extra = {}) => ({ question, answer, source: "you_typed", acknowledgedAt: "2026-10-01T00:00:00Z", widgetKind: "text", ...extra });
const place = (savedAnswers, fields, plan = []) => sam.placeStatedAnswers({ savedAnswers }, fields, plan, gh.questionKind);

test("⭐ T25: the owner's example — 'How did you hear about this job?' reuses the answer saved for '…about us?', as a NEAR match", () => {
  idx = 0;
  const fields = [f({ type: "text", label: "How did you hear about this job?*", required: true })];
  const { plan } = place([saved("How did you hear about us?", "A friend's referral")], fields);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].value, "A friend's referral");
  assert.equal(plan[0].matchedBy, "near_question", "a near match says so — never the exact tier's 'saved_answer'");
  assert.equal(plan[0].provenance, "saved_answer");
  assert.equal(plan[0].saved.near.question, "How did you hear about us?");
  // the curated equivalences: the other ways the same question is asked
  for (const q of ["Where did you hear about this position?", "How did you find out about this role?", "How did you first hear about the company"]) {
    idx = 0;
    assert.equal(place([saved("How did you hear about us?", "A friend's referral")], [f({ type: "text", label: q })]).plan.length, 1, q);
  }
});

test("⛔ T25: a different question that shares words is NOT a near match", () => {
  assert.equal(sam.nearQuestionScore("Why do you want to work here?", "Why are you leaving your job?").near, false);
  idx = 0;
  assert.equal(place([saved("Why do you want to work here?", "The mission")], [f({ type: "text", label: "Why are you leaving your job?" })]).plan.length, 0);
  // a negation, a question word and a number each refuse it on their own — pairs that would otherwise score ≥ 0.75
  const pairs = [
    ["Do you have a personal portfolio website link?", "Do you not have a personal portfolio website link?"],
    ["Describe your engineering leadership style", "Why would you describe your engineering leadership style?"],
    ["Preferred office location", "Preferred office location 2"],
  ];
  for (const [a, b] of pairs) {
    assert.equal(sam.nearQuestionScore(a, b).near, false, `${a} ≠ ${b}`);
    assert.ok(sam.nearQuestionTokens(a).length >= 3, "a long enough question that only the guard tells them apart");
  }
  // …while the same question in other words is
  assert.equal(sam.nearQuestionScore("What is your GitHub profile URL?", "Your GitHub profile URL").near, true);
});

test("⛔ T25 (D96 §7): an eligibility, EEO, consent, opt-in or salary question NEVER near-matches — on either side", () => {
  const cases = [
    ["Are you legally authorized to work in the United States?", "Are you legally authorized to work in the US?", "Yes"],
    ["Will you now or in the future require sponsorship?", "Will you require sponsorship now or in future?", "No"],
    ["What is your gender identity?", "Gender identity", "Woman"],
    ["What are your salary expectations?", "Salary expectations for this role", "150000"],
    ["What is your expected compensation?", "Expected compensation for this position", "150000"],
    ["What is your expected pay rate?", "Expected pay rate", "75"],
    ["Do you hold a green card?", "Do you currently hold a green card", "Yes"],
    ["Would you like to join our talent community?", "Join our talent community", "No"],
  ];
  for (const [savedQ, pageQ, a] of cases) {
    idx = 0;
    const { plan } = place([saved(savedQ, a)], [f({ type: "text", label: pageQ })]);
    assert.equal(plan.length, 0, `${pageQ} ← ${savedQ}`);
    assert.ok(sam.nearMatchBarred(pageQ, gh.questionKind), `barred: ${pageQ}`);
  }
  // A saved answer flagged eligibility never lends itself, whatever its wording reads as.
  idx = 0;
  assert.equal(place([saved("How did you hear about us?", "LinkedIn", { eligibility: true })],
    [f({ type: "text", label: "How did you hear about this job?" })]).plan.length, 0);
  // …and the exact tier is untouched: the same eligibility question still fills exactly.
  idx = 0;
  const exact = place([saved("Are you legally authorized to work in the United States?", "Yes", { eligibility: true })],
    [f({ type: "text", label: "Are you legally authorized to work in the United States?" })]).plan;
  assert.equal(exact.length, 1);
  assert.notEqual(exact[0].matchedBy, "near_question");
});

test("⛔ T25: on a picker the answer must be one of the field's OWN options, or it is not used", () => {
  idx = 0;
  const select = (options) => f({ type: "select-one", label: "How did you hear about this job?", options: options.map(t => ({ text: t, value: t.toLowerCase() })) });
  assert.equal(place([saved("How did you hear about us?", "A friend's referral")], [select(["LinkedIn", "Job board", "Other"])]).plan.length, 0,
    "not among the options → not used (no closest option)");
  idx = 0;
  const { plan, notes } = place([saved("How did you hear about us?", "LinkedIn")], [select(["LinkedIn", "Job board", "Other"])]);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].value, "linkedin");
  assert.equal(notes.length, 0);
  // a Workday dropdown whose options exist only once opened: the fill is told to pick the EXACT option or nothing
  idx = 0;
  const combo = place([saved("How did you hear about us?", "LinkedIn")], [f({ type: "button", widget: "dropdown", label: "How did you hear about this job?" })]).plan;
  assert.equal(combo[0].exactOption, true);
  // a typeahead cannot promise an exact option — not used
  idx = 0;
  assert.equal(place([saved("How did you hear about us?", "LinkedIn")], [f({ type: "text", widget: "typeahead", label: "How did you hear about this job?" })]).plan.length, 0);
});

test("⛔ T25: an earlier tier wins — the exact saved answer, and a control the plan already took (T18's semantic reading)", () => {
  idx = 0;
  const fields = [f({ type: "text", label: "How did you hear about this job?" })];
  const both = [saved("How did you hear about us?", "LinkedIn"), saved("How did you hear about this job?", "A recruiter", { acknowledgedAt: "2026-01-01T00:00:00Z" })];
  const { plan } = place(both, fields);
  assert.equal(plan[0].value, "A recruiter", "the SAME question wins over a nearer-dated near one");
  assert.notEqual(plan[0].matchedBy, "near_question");
  assert.equal(place([saved("How did you hear about us?", "LinkedIn")], fields, [{ index: 0, matchedBy: "semantic" }]).plan.length, 0, "a taken control stays taken");
  // Two different answers equally near: ambiguous, nothing used.
  idx = 0;
  assert.equal(place([saved("How did you hear about us?", "LinkedIn"), saved("How did you hear about the company?", "A recruiter")],
    [f({ type: "text", label: "How did you hear about this job?" })]).plan.length, 0);
  // A near match never takes a control back from a guess (yieldGuessesToStated is exact-only).
  idx = 0;
  const guess = [{ index: 0, label: "How did you hear about this job?", value: "x", provenance: "label_fuzzy", matchedBy: "label" }];
  assert.equal(sam.yieldGuessesToStated(guess, { savedAnswers: [saved("How did you hear about us?", "LinkedIn")] }, fields, gh.questionKind).length, 1);
});

test("⭐ T25: the Fill view's row is CHECK and names the original question — never silently Filled", () => {
  idx = 0;
  const fields = [f({ type: "text", label: "How did you hear about this job?*", required: true, hasValue: true })];
  const { plan } = place([saved("How did you hear about us?", "LinkedIn")], fields);
  const rows = ov.panelRowsForStep({ fields, plan, kindOf: gh.questionKind,
    filled: [{ field: plan[0].label, name: null, index: 0, verified: true }] });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].group, "check");
  assert.equal(rows[0].source, "similar question");
  assert.equal(rows[0].note, `${ov.NEAR_NOTE} “How did you hear about us?”`);
  assert.equal(rows[0].acknowledgedAt, null, "the original's acknowledgement is not this question's");
  assert.equal(rows[0].remembered, false);
  assert.equal(ov.panelSummary(rows).line, "1 of 1 filled · 0 need you · 1 to check");
});
