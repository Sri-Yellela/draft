// D55 (e) — the résumé goes into the RÉSUMÉ's file input, not "the first input[type=file]".
// Proven in headless Chrome by scripts/d55AutofillWorkday.mjs against /workday-replica, where the
// cover letter's drop zone deliberately comes first.

import { test } from "node:test";
import assert from "node:assert/strict";
import { at, lastAt } from "../test-support/sourceAnchors.js";
import fs from "node:fs";

import { resumeInputScore } from "../extension/gated-handoff.js";

const src = fs.readFileSync("extension/gated-handoff.js", "utf8").replace(/\r\n/g, "\n");
const dedent = (s) => s.split("\n").map(l => l.trim()).join("\n");

test("(e) a résumé / CV is named; a cover letter, transcript, portfolio or photo is never the target", () => {
  for (const t of ["Resume/CV", "Résumé", "resume", "Upload your CV", "Curriculum Vitae", "job_application[resume]"]) {
    assert.equal(resumeInputScore(t), 2, t);
  }
  for (const t of ["Cover Letter", "cover_letter", "Transcript", "Portfolio", "Headshot photo", "Additional documents",
                   "Resume or cover letter"]) {
    assert.equal(resumeInputScore(t), -1, t);
  }
  assert.equal(resumeInputScore("file-upload-input-ref"), 0, "an unnamed upload is neither");
});

test("(e) applyPlan's serialised resumeInputScore is byte-identical to the tested export", () => {
  const exp = src.slice(at(src, "export function resumeInputScore("));
  const expText = exp.slice("export ".length, at(exp, "\n}\n") + 2);
  const plan = src.slice(at(src, "async function applyPlan("));
  const inner = plan.slice(at(plan, "function resumeInputScore("));
  const innerText = inner.slice(0, at(inner, "\n  }\n") + 4).trimEnd();
  assert.equal(dedent(innerText), dedent(expText));
});

test("(e) never 'the first file input': named wins, a lone unnamed upload only when it is the only one", () => {
  const plan = src.slice(at(src, "async function applyPlan("), at(src, "// ── Matching"));
  assert.doesNotMatch(plan, /querySelectorAll\('input\[type="file"\]'\)\]\[0\]/, "the old first-input rule is gone");
  assert.match(plan, /const named = inputs\.filter\(i => i\.score === 2\);/);
  assert.match(plan, /if \(neutral\.length === 1\) return \{ el: neutral\[0\]\.el, by: 'only_unnamed_upload' \};/);
  assert.match(plan, /reason: neutral\.length \? 'ambiguous_file_inputs' : 'no_resume_input'/,
    "two unnamed uploads is a guess: attach nothing, and say so");
});

test("(e) the page's own confirmation is reported beside `attached`, never instead of it", () => {
  assert.match(src, /const confirmedByPage = !!\(await waitFor\(\(\) => String\(wrap\?\.textContent \|\| ''\)\.includes\(resume\.filename\), 1500\)\);/);
  assert.match(src, /attached: fileInput\.files\.length === 1 && fileInput\.files\[0\]\.name === resume\.filename,/);
});

test("(e) on a wizard the résumé is offered on every step until one takes it, and only once", () => {
  assert.match(src, /outcome\.resume\?\.attached \? null : resume/);
  assert.match(src, /if \(r\.resume && !outcome\.resume\?\.attached\) outcome\.resume = r\.resume;/);
});
