// T10 rows 5, 6, 7, 12, 13 and 34 (open item 4) · Lever, Workable and Ashby forms as MEASURED, filled by the real extension in one
// press; a form that renders after the press. The walk: test-support/walks/atsFamilies.mjs; the fixtures:
// scripts/fakeAtsLiveShapes.js (/lever-live, /workable-live) and scripts/fakeAts.js /ashby-spa (the replica of a live
// Ashby posting). What the walk found and what was fixed:
//   · Lever marks a required question "✱", not "*": every Lever row read "Full name ✱", "Resume/CV ✱" — the panel's
//     label now drops the mark, and a "✱" question counts as required (review-overlay.js shownLabel; the probe)
//   · Fill pressed while a script-rendered form was still loading said "No application form found" in 159 ms and never
//     filled — the handoff now waits (bounded, LATE_FORM_WAIT_MS) when a packet fills the page, then runs once more
// Synthetic person (Ada Example) only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { findChrome } from "../test-support/extensionBrowser.mjs";
import { runScenario } from "../test-support/walkExtension.mjs";
import { shownLabel, panelRowsForStep } from "../extension/review-overlay.js";
import { LATE_FORM_WAIT_MS } from "../extension/gated-handoff.js";
import { leverLiveForm, workableLiveForm } from "../scripts/fakeAtsLiveShapes.js";

const chrome = await findChrome();
const SKIP = chrome.skip || false;

test("Lever's required mark ✱ is not part of the label — as '*' never was", () => {
  assert.equal(shownLabel("Full name ✱"), "Full name");
  assert.equal(shownLabel("Resume/CV ✱"), "Resume/CV");
  assert.equal(shownLabel("First Name*"), "First Name");
  assert.equal(shownLabel("✱ Email"), "Email");
  assert.equal(shownLabel("Rate ✱ out of 5"), "Rate ✱ out of 5", "only a mark at an end is dropped");
  const rows = panelRowsForStep({ fields: [{ index: 0, id: "q", type: "text", label: "Please tell us how you heard about this opportunity. ✱", labelSource: "wrap", required: false, visible: true, hasValue: false }] });
  assert.equal(rows[0].label, "Please tell us how you heard about this opportunity.");
  assert.equal(rows[0].required, true, "a question marked ✱ is required, as one marked * is");
});

test("the late-form wait is bounded, and only a press with a packet for THIS page waits", () => {
  assert.ok(LATE_FORM_WAIT_MS > 0 && LATE_FORM_WAIT_MS <= 10000, `${LATE_FORM_WAIT_MS} ms`);
  const src = fs.readFileSync("extension/gated-handoff.js", "utf8").replace(/\r\n/g, "\n");
  const at = src.indexOf("if (!opts.lateFormWaited && await formAppears(");
  assert.ok(at > 0, "the no-form refusal waits for a late form first");
  assert.ok(at > src.indexOf("const chosen = fresh.sort("), "…only AFTER a fresh packet for this page was chosen — a page draft holds nothing for never waits");
  assert.ok(at < src.indexOf("// Only now is a token worth spending."), "…and before any token is minted");
});

test("the fixtures are the measured structures — Lever's wrapping labels and résumé link, Workable's span labels and svg upload", () => {
  const lv = leverLiveForm();
  assert.match(lv, /<li class="application-question resume"><label><div class="application-label">Resume\/CV <span class="required">✱<\/span><\/div>/);
  assert.match(lv, /id="resume-upload-input" name="resume" tabindex="-1" type="file"/);
  assert.match(lv, /No location found\. Try entering a different location/);
  assert.match(lv, /Name Pronunciation/);
  const wk = workableLiveForm();
  assert.match(wk, /<input data-ui="resume" tabindex="-1" id="input_files_input_r1" name="resume" type="file" aria-labelledby="up_label description_input_r1" required>/);
  assert.match(wk, /SVGs not supported by this browser\./);
  assert.match(wk, /role="radio"[^>]*><label><input id="qa_start_y" tabindex="-1" aria-hidden="true" type="radio"/);
  assert.match(wk, /<input name="QA_src" tabindex="-1" aria-hidden="true" value="">/);
  for (const html of [lv, wk]) assert.doesNotMatch(html, /border-radius:\s*(999|50%)/, "D60");
});

test("⭐ T10 rows 5–7 + 34 walk (real extension): Lever, Workable and Ashby forms as measured are filled in ONE press — every field named, one résumé row, EEO and screening left alone; a form that renders after the press is filled too; two tabs keep their own jobs, the same job fills in both (rows 12, 13)", { skip: SKIP, timeout: 600000 }, async () => {
  const lines = [];
  const r = await runScenario("atsFamilies", { log: (l) => lines.push(l) });
  if (r.skipped) return;
  assert.equal(r.failures, 0, lines.filter(l => /^FAIL/.test(l)).join("\n") || lines.slice(-20).join("\n"));
});
