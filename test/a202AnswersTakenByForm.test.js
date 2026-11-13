// ⛔ A202 (46k, owner 11-13: Dropzone "failed again … it literally asked me for the questions again, the ones I answered a
// minute ago"). The answers reached the run (production: POST /api/apply/answers 202 → the retry used the kept answers, no
// drafting call) but the row came back asking the same questions. Four causes, each pinned here:
//   (1) Greenhouse's new boards render choice questions as react-select: the <input role=combobox> is EMPTIED once an
//       option is picked, so the post-fill read saw a picked answer as blank → incomplete_form → the same question.
//       Measured in a real Chrome on the fake ATS's standard Greenhouse form (it copies the live markup, incl. the clear).
//   (2) a field draft HAD an answer for and the form still shows empty is named (fill_failed), never asked again;
//   (3) a run that read the form no longer borrows an older Open & fill packet's employer questions;
//   (4) the person's answer also matches by the posting's ATS field name (question_<id>) when the page words it differently.
// Synthetic form and answers only.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { findChrome } from "../test-support/extensionBrowser.mjs";
import { at } from "../test-support/sourceAnchors.js";
import { discoverFields, buildAnswers, markFillFailed, fillFailedDetail, buildOpenQuestions } from "../services/applyAutomation.js";
import { heldQuestionsOf, waitsOnPerson, heldReasonWords } from "../services/heldQuestions.js";
import { greenhouseStandardForm } from "../scripts/fakeAtsGreenhouseStandard.js";

const chrome = await findChrome();
const SKIP = chrome.skip || false;
let shared = null;
after(async () => { const b = shared; shared = null; if (b) await (await b).close().catch(() => {}); });
async function page(t, html) {
  if (!shared) {
    const puppeteer = (await import("puppeteer-core")).default;
    shared = puppeteer.launch({ executablePath: chrome.path, headless: true, pipe: true, args: ["--no-first-run"] });
  }
  const p = await (await shared).newPage();
  t.after(() => p.close().catch(() => {}));
  await p.setContent(html);
  return p;
}

test("⛔ A202 (1) (Chrome): a react-select choice picked on the Greenhouse form reads back as its value, not blank", { skip: SKIP, timeout: 60000 }, async (t) => {
  const p = await page(t, greenhouseStandardForm());
  // pick "Yes" the way the fill does: focus, type, click the option
  await p.click("#question_30005");
  await p.type("#question_30005", "Yes", { delay: 20 });
  await new Promise(r => setTimeout(r, 200));
  const opts = await p.$$("#question_30005-listbox [role=option]");
  assert.ok(opts.length >= 1, "the picker's menu opened");
  await opts[0].click();
  assert.equal(await p.$eval("#question_30005", el => el.value), "", "react-select clears the typed query — the trap");
  const fields = await discoverFields(p, "greenhouse");
  const picked = fields.find(f => f.field_id === "question_30005");
  const untouched = fields.find(f => f.field_id === "question_30006");
  assert.ok(picked, "the picker is discovered");
  assert.equal(picked.type, "typeahead");
  assert.equal(picked.current_value, "Yes", "the picked option is read from react-select's single value");
  assert.equal(untouched.current_value, "", "an unpicked picker stays blank — no value lent from a neighbour");
  assert.equal(fields.find(f => f.field_id === "gender")?.current_value, "", "the EEO picker beside it stays blank");
  // ⛔ A206 (46k, Splitero's two required "(unknown)" fields): react-select's backing input (required, tabindex -1,
  // aria-hidden, no id, no name) mirrors its picker and is never a field of its own
  const nameless = fields.filter(f => f.is_required && !f.field_id && !f.name && !f.label);
  assert.deepEqual(nameless, [], "no nameless required field — the pickers' backing inputs are not counted");
});

test("⛔ A202 (2): a required field draft answered but the form left empty is fill_failed — named, never asked again", () => {
  const missing = [
    { field_id: "question_1", name: "question_1", label: "Do you live in the Bay Area?*", type: "typeahead", is_required: true },
    { field_id: "question_2", name: "question_2", label: "Pronouns*", type: "text", is_required: true },
  ];
  const resolved = [{ field_id: "question_1", name: "question_1", value: "Yes", provenance: "custom_answer" },
                    { field_id: "question_2", name: "question_2", value: null, skipped: true, refusals: ["x"] }];
  const labels = markFillFailed(missing, resolved);
  assert.deepEqual(labels, ["Do you live in the Bay Area?*"]);
  const qs = buildOpenQuestions({ missingFields: missing });
  assert.equal(qs.find(q => q.field === "question_1").reason, "fill_failed");
  assert.equal(qs.find(q => q.field === "question_2").reason, "unanswered");
  assert.equal(waitsOnPerson(qs.find(q => q.field === "question_1")), false, "not put to the person again");
  assert.equal(waitsOnPerson(qs.find(q => q.field === "question_2")), true);
  const held = heldQuestionsOf({ openQuestionsJson: JSON.stringify(qs), blanksJson: "[]" });
  assert.deepEqual(held.map(h => h.question), ["Pronouns*"]);
  const detail = fillFailedDetail(labels);
  assert.match(detail, /^draft couldn't enter your answer to "Do you live in the Bay Area\?"/);
  assert.match(heldReasonWords("incomplete_form", detail), /Required fields were left empty\. Draft couldn't enter/);
  assert.equal(fillFailedDetail([]), null);
  assert.equal(heldReasonWords("incomplete_form", null), "Required fields were left empty.");
});

test("⛔ A202 (3): a run that read the form takes only ITS OWN packet — never an older Open & fill packet's questions", () => {
  const src = fs.readFileSync("routes/apply.js", "utf8");
  const from = at(src, "const latestPacketJson = (r) =>");
  const body = src.slice(from, at(src, "const heldFacts", from));
  assert.match(body, /readTheForm = r\.open_questions_json != null \|\| r\.blanks_json != null \|\| r\.answers_json != null/);
  assert.match(body, /if \(readTheForm\) \{[\s\S]*?AND run_job_id=\?\s*\n?\s*ORDER BY created_at DESC LIMIT 1`\)/);
});

test("⛔ A202 (4): the person's answer matches the page's control by the ATS field name when the wording differs", () => {
  const field = { field_id: "question_30005", name: "question_30005", type: "typeahead", is_required: true,
    label: "Are you legally authorized to work in the United States? (Please answer honestly)*" };
  const payload = { field_map: {}, handler_map: {}, custom_answers: { "Are you legally authorized to work in the United States?": "Yes" },
    custom_answers_by_field: { question_30005: { question: "Are you legally authorized to work in the United States?", answer: "Yes" } } };
  const [a] = buildAnswers([field], payload);
  assert.equal(a.value, "Yes");
  assert.equal(a.provenance, "custom_answer");
  const [none] = buildAnswers([{ ...field, field_id: "question_99", name: "question_99" }], payload);
  assert.ok(!none || none.value == null, "another field's id never takes it");
  const src = fs.readFileSync("routes/apply.js", "utf8");
  assert.match(src, /autofillPayload\.custom_answers_by_field = byField/);
});

test("⛔ A202: the typeahead picks an EXACT option before a containing one, and a held question is logged with its reason", () => {
  const src = fs.readFileSync("services/applyAutomation.js", "utf8");
  assert.match(src, /texts\.find\(\(\[, t\]\) => t === want\) \|\| texts\.find\(\(\[, t\]\) => t\.startsWith\(want\)\) \|\| texts\.find\(\(\[, t\]\) => t\.includes\(want\)\)/);
  assert.match(src, /\[apply-held\] job=\$\{jobId\}/);
});
