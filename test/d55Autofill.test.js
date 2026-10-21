// D55 — the autofill engine items (AUTOFILL_TARGET.md §7.7 (a)–(e), §8.5 (g) and (l)).
//
// The page-side half of each item runs inside applyPlan / probeFormShape, which are serialised into
// the page and can only be exercised in a real browser — scripts/d55AutofillWorkday.mjs does that in
// headless Chrome against fakeAts's /workday-replica. What is here is what that run cannot guard
// cheaply: the pure decisions (which option is "closest", which questions stop, what an entry is),
// and the source invariants that keep the serialised copies honest.

import { test } from "node:test";
import assert from "node:assert/strict";
import { at, lastAt } from "../test-support/sourceAnchors.js";
import fs from "node:fs";

import { closestOption, matchAnswersToFields } from "../extension/gated-handoff.js";

const src = fs.readFileSync("extension/gated-handoff.js", "utf8").replace(/\r\n/g, "\n");
const body = (name) => {
  const pos = src.indexOf(`function ${name}(`);
  assert.ok(pos >= 0, `${name} not found`);
  return pos;
};
const dedent = (s) => s.split("\n").map(l => l.trim()).join("\n");

// ── (a) closest real option ──────────────────────────────────────────────────

test("(a) an exact option wins", () => {
  assert.equal(closestOption("No", ["Yes", "No"]), 1);
  assert.equal(closestOption("java", ["JavaScript", "Java"]), 1, "exact beats containment");
});

test("(a) the ATS's vocabulary wins: whole-phrase containment, shortest option first", () => {
  assert.equal(closestOption("United States", ["Canada", "United States Minor Outlying Islands", "United States of America"]), 2);
  assert.equal(closestOption("Python", ["Python (Programming Language)", "PyTorch"]), 0);
});

test("(a) word overlap: 'Computer Science' picks 'Computer and Information Sciences'", () => {
  assert.equal(closestOption("Computer Science",
    ["Computer and Information Sciences", "Computer Engineering", "Computational Biology"]), 0);
});

test("(a) a unique first word is the narrow last resort; two candidates is a refusal", () => {
  assert.equal(closestOption("Bachelor of Science",
    ["High School Diploma", "Associate", "Bachelor's Degree", "Master's Degree"]), 2);
  assert.equal(closestOption("Master of Fine Arts", ["Master's Degree", "Master of Business Administration"]), -1,
    "one shared word out of three is not overlap, and two Master options is not a unique first word");
  assert.equal(closestOption("Bachelor of Arts", ["Bachelor of Science", "Bachelor of Engineering"]), -1,
    "two Bachelor options and no better signal — never guess between them");
});

test("(a) nothing close is a refusal, never the first option", () => {
  assert.equal(closestOption("Kubernetes", ["Agile", "Docker", "Java"]), -1);
  assert.equal(closestOption("", ["Yes", "No"]), -1);
  assert.equal(closestOption("Yes", []), -1);
});

test("(a) applyPlan's serialised closestOption is byte-identical to the tested export", () => {
  const exported = src.slice(at(src, "export function closestOption("));
  const exportedText = exported.slice("export ".length, at(exported, "\n}\n") + 2);
  const plan = src.slice(body("applyPlan"));
  const inner = plan.slice(at(plan, "function closestOption("));
  const innerText = inner.slice(0, at(inner, "\n  }\n") + 4).trimEnd();
  assert.ok(innerText.length > 400, "applyPlan's copy is missing");
  assert.equal(dedent(innerText), dedent(exportedText),
    "the copy the page runs has drifted from the copy these tests run");
});

test("(a) the probe and applyPlan still enumerate the SAME controls, dropdown buttons included", () => {
  const sel = /const controls = \[\.\.\.scope\.querySelectorAll\(\n\s+'([^']+)'\n\s+\)\]\.filter\(\n([^;]+);/g;
  const found = [...src.matchAll(sel)].map(m => m[1] + "|" + dedent(m[2]));
  assert.ok(found.length >= 2);
  assert.equal(new Set(found).size, 1, "probeFormShape and applyPlan enumerate different control lists");
  assert.match(found[0], /button\[aria-haspopup="listbox"\]/);
  assert.match(found[0], /el\.getAttribute\('aria-haspopup'\) === 'listbox' \|\|/,
    "a dropdown button must survive the button-type filter by that attribute alone");
});

test("(a) a typeahead is typed and WAITED for; a dropdown waits for its late listbox", () => {
  const plan = src.slice(body("applyPlan"), at(src, "// ── Matching"));
  assert.match(plan, /const setTypeahead = async \(el, wants, mode = null\) =>/);
  assert.match(plan, /await waitFor\(\(\) => readyOptions\(el\), 4000\)/);
  // D55 (f) added a third argument, the pick mode ('exact' | 'decline' | null) — the wait is unchanged.
  assert.match(plan, /const setCombobox = async \(el, want, mode = null\) =>/);
  assert.match(plan, /await waitFor\(\(\) => readyOptions\(el\), 2500\)/);
  // "Searching…" is not an answer: a busy listbox has no options yet.
  assert.match(plan, /list\.getAttribute\('aria-busy'\) === 'true'\) return null;/);
  // Checked before isCombo, which a role=combobox <input> would also match.
  assert.ok(plan.indexOf("} else if (isTypeahead(el)) {") < plan.indexOf("} else if (isCombo(el)) {"));
  // An untrusted Enter submits nothing — but a page's own keydown handler could. Never sent.
  assert.doesNotMatch(plan, /key: 'Enter'/);
});

test("(a) a multi-select is one chip per value, each read back on the page", () => {
  const plan = src.slice(body("applyPlan"), at(src, "// ── Matching"));
  assert.match(plan, /Array\.isArray\(step\.value\) \? step\.value : \[step\.value\]/);
  assert.match(plan, /ok = want\.every\(w => shown\.includes\(String\(w\)\.toLowerCase\(\)\)\);/);
  assert.match(plan, /\.\.\.\(kind === 'combo' \|\| kind === 'typeahead' \|\| kind === 'suggest' \? \{ placed: got \} : \{\}\)/,
    "what the employer will read is the ATS's wording — the review must show that, not the profile's");
});

test("(a) an empty chip set is not a fill instruction", () => {
  const { plan, unmatched } = matchAnswersToFields(
    [{ name: "skills", field: "Skills", value: [], provenance: "field_map_exact" }],
    [{ index: 0, name: "skills", id: null, type: "text", label: "Skills", required: false, options: null }]);
  assert.equal(plan.length, 0);
  assert.equal(unmatched.length, 0);
});
