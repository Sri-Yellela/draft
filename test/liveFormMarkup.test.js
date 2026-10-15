// ⭐ LIVE MARKUP (measured 10-15, docs/LIVE_FORM_MEASUREMENT.md) — each structure the read-only measurement of public
// Greenhouse / Lever / Ashby / Workable forms found the extension reading wrong, reproduced in miniature and read by the
// extension's OWN injected probe (gated-handoff.js probeFormShape, applyPlan) in a real Chrome, plus the pure classifier
// (fieldSemantics.js) and the panel (review-overlay.js panelRowsForStep).
//   (1) react-select's hidden backing input after every REQUIRED Greenhouse picker is not a field (Stripe: 14 of 45),
//       in the probe AND applyPlan — the plan still lands on the next field by index; Workable's aria-hidden radios stay
//   (2) Workable's upload: its svg preview <label for> ("SVGs not supported by this browser."), then "Choose file" —
//       the label is "Resume", typed `resume`
//   (3) a long label the page TIES to its field (Ashby / Workable custom questions) is the label, not "Type here..."
//   (4) Lever's wrapping label: "Current location ✱" + the input + "No location found…" → the location; a wrapped
//       <select>'s options never reach a label
//   (5) Ashby's "Autofill from resume" drop zone is labelled, and the panel shows ONE résumé row (fileTypesOf); a lone
//       autofill upload (Workday's "Autofill with Resume") stays the résumé
//   (6) the wordings read live are keyed; "LGBTQ+" is an EEO question; eligibility / EEO / consent stay unkeyed (D96 §7)
// Synthetic markup and words — structure only, no real person. Browser tests skip, with their reason, without Chrome.
import test from "node:test";
import assert from "node:assert/strict";
import { findChrome } from "../test-support/extensionBrowser.mjs";
import * as gh from "../extension/gated-handoff.js";
import { classifyFields, fileTypeOf, fileTypesOf, semanticKeyOf } from "../extension/fieldSemantics.js";
import { panelRowsForStep } from "../extension/review-overlay.js";
import { pageTellsOf } from "../extension/intent.js";

const chrome = await findChrome();
const SKIP = chrome.skip || false;
let browserP = null;
async function pageWith(t, html) {
  if (!browserP) {
    const puppeteer = (await import("puppeteer-core")).default;
    browserP = puppeteer.launch({ executablePath: chrome.path, headless: true, pipe: true, args: ["--no-first-run"] });
  }
  const page = await (await browserP).newPage();
  t.after(() => page.close().catch(() => {}));
  await page.setContent(`<!DOCTYPE html><html><body>${html}</body></html>`);
  return page;
}
test.after(async () => { if (browserP) await (await browserP).close(); });
const probe = (page) => page.evaluate(`(${gh.__probeSource})()`);
const kind = { kindOf: gh.questionKind };

// react-select's measured shape (job-boards.greenhouse.io, 10-15), synthetic words
const ghPicker = (id, words, req) => `<div class="select"><div class="select__container"><label id="${id}-label" for="${id}" class="label">${words}${req ? '<span aria-hidden="true">*</span>' : ''}</label>` +
  `<div class="select-shell"><div class="select__control"><div class="select__value-container"><div class="select__placeholder" id="react-select-${id}-placeholder">Select...</div>` +
  `<div class="select__input-container"><input class="select__input" id="${id}" type="text" autocomplete="off" role="combobox" aria-autocomplete="list" aria-haspopup="true" aria-labelledby="${id}-label" aria-required="${req}" value=""></div></div></div></div>` +
  `${req ? '<input required="" tabindex="-1" aria-hidden="true" class="requiredInput" value="">' : ''}</div></div>`;

test("LIVE (1, Chrome): a required picker's hidden backing input is not a field — in the probe AND in applyPlan, which still lands by index", { skip: SKIP, timeout: 60000 }, async (t) => {
  const page = await pageWith(t, `<form>${ghPicker("school--0", "School", true)}${ghPicker("degree--0", "Degree", true)}${ghPicker("gender", "Gender", false)}
    <label id="email-label" for="email">Email<span aria-hidden="true">*</span></label><input id="email" aria-label="Email" type="text"></form>`);
  const shape = await probe(page);
  assert.deepEqual(shape.fields.map(f => `${f.id}:${f.label}`), ["school--0:School*", "degree--0:Degree*", "gender:Gender", "email:Email*"],
    "four questions, four fields — no second 'School*' / 'Degree*'");
  // applyPlan enumerates the same list: the plan's index 3 is the Email box, not a backing input
  const r = await page.evaluate(`(${gh.__applyPlanSource})(${JSON.stringify([{ index: 3, id: "email", name: null, label: "Email*", value: "avery.testcase@example.com" }])}, null, { neverFillSource: ${JSON.stringify(gh.NEVER_FILL_SOURCE)} })`);
  assert.deepEqual(r.skipped, [], JSON.stringify(r.skipped));
  assert.equal(await page.$eval("#email", el => el.value), "avery.testcase@example.com");
  assert.equal(await page.$$eval('input[aria-hidden="true"]', els => els.every(e => e.value === "")), true, "the backing inputs are untouched");
});

test("LIVE (1, Chrome): Workable's real radios are aria-hidden with tabindex -1 behind role=radio — they stay fields", { skip: SKIP, timeout: 60000 }, async (t) => {
  const page = await pageWith(t, `<form><span id="q1_label"><strong>Can you start within a month?</strong></span>
    <fieldset role="radiogroup" aria-labelledby="q1_label">
      <div role="radio" aria-checked="false" tabindex="0"><label><input id="r1" tabindex="-1" aria-hidden="true" type="radio" name="QA_1" value="true"><div><span>YES</span></div></label></div>
      <div role="radio" aria-checked="false" tabindex="-1"><label><input id="r2" tabindex="-1" aria-hidden="true" type="radio" name="QA_1" value="false"><div><span>NO</span></div></label></div>
    </fieldset></form>`);
  const shape = await probe(page);
  assert.deepEqual(shape.fields.map(f => [f.type, f.label, f.group]), [["radio", "YES", "Can you start within a month?"], ["radio", "NO", "Can you start within a month?"]]);
});

test("LIVE (2, Chrome): Workable's upload — the svg preview label and 'Choose file' are not its label; 'Resume' is, and it is the résumé", { skip: SKIP, timeout: 60000 }, async (t) => {
  const page = await pageWith(t, `<form><span><strong>*</strong></span><span id="up_label"><strong>Resume</strong></span>
    <div data-role="dropzone"><div data-role="preview"><label for="input_files_input_x1"><svg width="10" height="10"><text>SVGs not supported by this browser.</text></svg></label></div>
    <div><label tabindex="0" role="button" for="input_files_input_x1" id="description_input_x1" aria-describedby="up_label">Choose file</label> <span>or drag and drop here</span></div>
    <input data-ui="resume" tabindex="-1" id="input_files_input_x1" type="file" aria-labelledby="up_label description_input_x1" required></div></form>`);
  const [f] = (await probe(page)).fields;
  assert.equal(f.label, "Resume");
  assert.equal(f.labelSource, "labelledby");
  assert.equal(fileTypeOf(f), "resume");
});

test("LIVE (3, Chrome): a long label the page ties to its field is the label — not the placeholder, not nothing", { skip: SKIP, timeout: 60000 }, async (t) => {
  const long = "Describe a project you are proud of. ".repeat(12).trim();     // > 300 characters
  const page = await pageWith(t, `<form>
    <div><label for="q-a">${long}</label><textarea id="q-a" placeholder="Type here..."></textarea></div>
    <div><span id="q-b_label"><strong>${long}</strong></span><textarea id="q-b" aria-labelledby="q-b_label"></textarea></div></form>`);
  const shape = await probe(page);
  assert.ok(long.length > 300);
  assert.deepEqual(shape.fields.map(f => f.labelSource), ["for", "labelledby"]);
  assert.deepEqual(shape.fields.map(f => f.label), [long.slice(0, 200), long.slice(0, 200)]);
});

test("LIVE (4, Chrome): Lever's wrapping label — the question before the field, not its status text; a wrapped select's options never", { skip: SKIP, timeout: 60000 }, async (t) => {
  const page = await pageWith(t, `<form><ul>
    <li class="application-question resume"><label><div class="application-label">Resume/CV <span class="required">✱</span></div><div class="application-field">
      <a href="#"><span class="filename"></span><span class="default-label">ATTACH RESUME/CV</span><input id="resume-upload-input" name="resume" tabindex="-1" type="file"></a>
      <span class="resume-upload-failure"><div class="resume-upload-label">Couldn't auto-read resume.</div></span></div></label></li>
    <li class="application-question"><label><div class="application-label">Current location <span class="required">✱</span></div><div class="application-field">
      <input class="location-input" id="location-input" type="text" name="location" required><input type="hidden" name="selectedLocation">
      <div class="dropdown-container"><div class="dropdown-results"></div><div class="dropdown-no-results">No location found. Try entering a different location</div></div></div></label></li>
    <li class="application-question"><label>Country of residence <select name="cards[c1][field0]"><option>Canada</option><option>Mexico</option></select></label></li>
    <li class="application-question"><label><input type="checkbox" name="cards[c2][field0]" value="English">English</label></li>
  </ul></form>`);
  const shape = await probe(page);
  assert.deepEqual(shape.fields.map(f => [f.labelSource, f.label]),
    [["wrap", "Resume/CV ✱"], ["wrap", "Current location ✱"], ["wrap", "Country of residence"], ["wrap", "English"]]);
  const keys = classifyFields(shape.fields, kind);
  assert.equal(keys[1], "location", "the location is keyed — the status text no longer hides it");
  assert.equal(keys[2], "country");
  assert.equal(fileTypeOf(shape.fields[0]), "resume");
});

test("LIVE (5, Chrome): Ashby's autofill drop zone is labelled by its own words — and the panel draws ONE résumé row, the real field's", { skip: SKIP, timeout: 60000 }, async (t) => {
  const page = await pageWith(t, `
    <div class="autofill-pane"><div role="presentation" class="ashby-application-form-autofill-input-root"><input accept=".pdf,.doc,.docx" type="file" tabindex="-1">
      <div class="base-layer"><div class="header"><h3 class="autofill-input-title">Autofill from resume</h3></div>
      <p>Upload your resume here to autofill key application fields.</p><div><button>Upload file</button></div></div></div></div>
    <div class="ashby-application-form-container">
      <div class="field-entry"><label class="question-title" for="_systemfield_name">Legal Name</label><input id="_systemfield_name" name="_systemfield_name" type="text" placeholder="Type here..."></div>
      <div class="field-entry"><label class="question-title" for="_systemfield_resume">Resume</label><div role="presentation"><input id="_systemfield_resume" type="file" tabindex="-1"><button>Upload File</button></div></div>
      <div class="field-entry"><label class="question-title" for="cl">Cover Letter</label><input id="cl" type="file"></div>
    </div>`);
  const shape = await probe(page);
  const files = shape.fields.filter(f => f.type === "file");
  assert.deepEqual(files.map(f => [f.label, f.labelSource]), [["Autofill from resume", "group"], ["Resume", "for"], ["Cover Letter", "for"]]);
  assert.deepEqual(files.map(fileTypeOf), ["resume", "resume", "cover_letter"], "one by one, both look like the résumé");
  assert.deepEqual(fileTypesOf(files), ["other", "resume", "cover_letter"], "read together, the autofill drop zone is not");
  const rows = panelRowsForStep({ fields: shape.fields, kindOf: gh.questionKind });
  assert.deepEqual(rows.filter(r => r.resumeOffer).map(r => r.label), ["Resume"], "one résumé row");
  assert.equal(rows.filter(r => /Unlabelled/.test(r.label)).length, 0);
  // the intent model's tells find the real field, not the drop zone
  const tells = pageTellsOf({ controls: 4, signInWall: false, files: [{ label: "Autofill from resume", required: false, holdsFile: false },
    { label: "Resume", id: "_systemfield_resume", required: true, holdsFile: false }] });
  assert.deepEqual(tells.field, { present: true, required: true, holdsFile: false });
});

test("LIVE (5): a LONE autofill upload stays the résumé (Workday's 'Autofill with Resume' step); all-autofill stays as read", () => {
  assert.deepEqual(fileTypesOf([{ label: "Autofill with Resume", automationId: "file-upload-input-ref" }]), ["resume"]);
  assert.deepEqual(fileTypesOf([{ label: "Autofill from resume" }, { label: "Parse my resume" }]), ["resume", "resume"], "nothing to prefer → unchanged");
  assert.deepEqual(fileTypesOf([{ label: "Resume/CV" }, { label: "Cover Letter" }]), ["resume", "cover_letter"]);
  assert.deepEqual(fileTypesOf([]), []);
});

test("LIVE (6): the wordings read on live forms are keyed — anchored, never a near miss", () => {
  const key = (label) => semanticKeyOf({ type: "text", label }, kind);
  assert.equal(key("Other Website"), "website");                                             // Figma
  assert.equal(key("Who is your current or previous employer?*"), "current-company");          // Stripe
  assert.equal(key("What is your current or previous job title?*"), "current-title");          // Stripe
  assert.equal(key("If located in the US, in what city and state do you reside?*"), "location"); // Stripe
  assert.equal(key("Please tell us how you heard about this opportunity.✱"), "how-heard");    // Lever
  assert.equal(key("Current location ✱"), "location");                                        // Lever, once its label is clean
  // near misses stay unkeyed
  assert.equal(key("Other Website you would like to share about your previous employer"), null);
  assert.equal(key("Who referred you to your current or previous employer?"), null);
  assert.equal(key("In what city and state were you born?"), null);
  assert.equal(key("Please tell us how you heard about our competitors"), null);
});

test("LIVE (6): 'I consider myself a member of the LGBTQ+ community' is an EEO question — and eligibility / EEO / consent stay unkeyed (D96 §7)", () => {
  assert.equal(gh.questionKind("I consider myself a member of the LGBTQ+ community. (optional)"), "eeo");   // Discord
  assert.equal(gh.questionKind("Do you identify as transgender?"), "eeo");
  for (const label of ["I consider myself a member of the LGBTQ+ community. (optional)", "Are you currently authorized to work in the US?*",
    "Will you require Stripe to sponsor you for a US work permit now or in the future?*", "Do you opt-in to receive WhatsApp messages from Stripe Recruiting?*",
    "Are you Hispanic/Latino?", "Veteran Status", "Gender"]) {
    assert.equal(semanticKeyOf({ type: "text", label }, kind), null, label);
  }
});
