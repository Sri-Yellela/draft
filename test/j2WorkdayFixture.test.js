// J2 · THE WORKDAY-SHAPED FIXTURE'S STEPS (D96 §1, §5, §7; D98 §5) — no browser.
// scripts/fakeAts.js serves the owner's Zoom stage as ONE document whose steps are inert <template data-ws-step>
// blocks, swapped in without changing the URL. Each test reads the served HTML and asserts the controls a step must
// carry for the lanes' browser passes to mean anything. Each is red with its control removed (mutation-checked).
// ⚠ The markup is assumed, not measured on a live tenant (O73) — these tests pin the FIXTURE, not Workday.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { startFakeAts } from "../test-support/extensionBrowser.mjs";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const ats = await startFakeAts();
test.after(() => ats.stop());
const STAGE = `${ats.origin}/en-US/Zoom/job/Remote--(US)/Software-Engineer_R19749-1/apply/applyManually?source=linkedin`;
const html = await (await fetch(STAGE)).text();
const strip = (s) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const templates = Object.fromEntries([...html.matchAll(/<template data-ws-step="([^"]+)"([^>]*)>([\s\S]*?)<\/template>/g)]
  .map(([, id, attrs, body]) => [id, { body, onPath: /data-ws-on-path/.test(attrs), title: attrs.match(/data-ws-title="([^"]+)"/)?.[1] }]));
const step = (id) => { assert.ok(templates[id], `step ${id} is served`); return templates[id].body; };
const labelText = (body, id) => { const m = body.match(new RegExp(`<label for="${id}"[^>]*>([\\s\\S]*?)</label>`)); return m ? strip(m[1]) : null; };
const dropdown = (body, aid) => new RegExp(`<button[^>]*data-automation-id="${aid}"[^>]*aria-haspopup="listbox"`).test(body);

test("the steps: My Information → My Experience → Application Questions → Voluntary Disclosures → Self Identify → Review, and two off the path", () => {
  assert.deepEqual(Object.entries(templates).filter(([, t]) => t.onPath).map(([id]) => id),
    ["myInformation", "myExperience", "applicationQuestions", "voluntaryDisclosures", "selfIdentify", "review"]);
  assert.deepEqual(Object.entries(templates).filter(([, t]) => !t.onPath).map(([id]) => id).sort(), ["signIn", "unrecognised"]);
  assert.match(html, /<form data-automation-id="applyFlowPage" id="ws-root"/);
  assert.match(html, /id="next-step" data-automation-id="bottom-navigation-next-button"/);
  assert.match(html, /<h2 data-automation-id="jobPostingHeader">Software Engineer<\/h2>/, "the extractor's Workday header (f72be86)");
});

test("every apply stage answers with the steps; the posting has none", async () => {
  for (const tail of ["/apply", "/apply/useMyLastApplication", "/apply/applyManually"]) {
    const h = await (await fetch(`${ats.origin}/Zoom/job/Remote--(US)/Software-Engineer_R19749-1${tail}`)).text();
    assert.match(h, /<template data-ws-step="myInformation"/, tail);
  }
  const posting = await (await fetch(`${ats.origin}/Zoom/job/Remote--(US)/Software-Engineer_R19749-1`)).text();
  assert.doesNotMatch(posting, /data-ws-step/);
});

test("My Information: the trailing asterisk, the address, state and country dropdowns, phone device type, phone number, the country phone code typeahead", () => {
  const b = step("myInformation");
  assert.equal(labelText(b, "ws-firstName"), "First Name*", "D96 symptom 4: the label's text ends in the asterisk");
  assert.equal(labelText(b, "ws-lastName"), "Last Name*");
  for (const id of ["ws-addressLine1", "ws-city", "ws-postalCode", "ws-phoneNumber"]) assert.match(labelText(b, id) || "", /\*$/, id);
  assert.match(b, /name="firstName"/); assert.match(b, /name="lastName"/); assert.match(b, /name="email"/);
  for (const aid of ["addressSection_addressLine1", "addressSection_city", "addressSection_postalCode", "phone-number"]) assert.match(b, new RegExp(`<input[^>]*data-automation-id="${aid}"`), aid);
  for (const aid of ["addressSection_countryRegion", "countryDropdown", "phone-device-type"]) assert.ok(dropdown(b, aid), `${aid} is a button + listbox`);
  assert.match(b, /data-ws-options="[^"]*California/, "the state dropdown lists states");
  assert.match(b, /<input[^>]*role="combobox"[^>]*data-automation-id="searchBox"[^>]*data-ws-for="country-phone-code"/, "country phone code is a typeahead");
});

test("My Experience: month / year dates and a HIDDEN input[type=file] inside a custom drop zone", () => {
  const b = step("myExperience");
  assert.match(b, /data-automation-id="dateSectionMonth-input"/);
  assert.match(b, /data-automation-id="dateSectionYear-input"/);
  const zone = b.match(/<div data-automation-id="file-upload-drop-zone"[\s\S]*?<\/div>\s*<\/div>/)?.[0] || "";
  assert.match(zone, /<input type="file"[^>]*data-automation-id="file-upload-input-ref"[^>]*class="ws-hidden-file"/, "the file input sits inside the zone");
  assert.match(html, /\.ws-hidden-file\{[^}]*opacity:0/, "and is visually hidden");
});

test("Application Questions: a radio group and a checkbox group", () => {
  const b = step("applicationQuestions");
  assert.match(b, /<fieldset role="radiogroup"[^>]*>[\s\S]*?<input type="radio"/);
  assert.match(b, /<fieldset role="group"[^>]*>[\s\S]*?<input type="checkbox"[\s\S]*?<input type="checkbox"/);
});

test("Voluntary Disclosures: three EEO dropdowns AND the 'I have read and consent' checkbox", () => {
  const b = step("voluntaryDisclosures");
  for (const aid of ["gender", "ethnicity", "veteranStatus"]) assert.ok(dropdown(b, aid), aid);
  assert.match(b, /<input type="checkbox" id="ws-consent" data-automation-id="agreementCheckbox"/);
  assert.match(labelText(b, "ws-consent") || "", /^I have read and consent to the Terms and Conditions\*$/);
});

test("Self Identify: a NAME + DATE signature, and the disability radio group", () => {
  const b = step("selfIdentify");
  assert.match(b, /<input[^>]*id="ws-sig-name"[^>]*data-automation-id="selfIdentifiedDisabilityData--name"/);
  assert.match(b, /data-automation-id="formField-selfIdentifiedDisabilityData--dateSignedOn"[\s\S]*dateSectionMonth-input[\s\S]*dateSectionDay-input[\s\S]*dateSectionYear-input/);
  assert.match(b, /role="radiogroup"[^>]*>[\s\S]*Yes, I have a disability/);
});

test("Review: the review page; Save and Continue turns into Submit there (the client says so)", () => {
  assert.match(step("review"), /data-automation-id="reviewJobApplicationPage"/);
  assert.match(html, /next\.textContent = id === 'review' \? 'Submit' : 'Save and Continue'/);
});

test("Sign In carries a PASSWORD input, pre-filled with the sentinel a run checks for leaks", () => {
  assert.match(step("signIn"), /<input[^>]*type="password"/);
  assert.match(html, /"passwordSentinel":"ws-PASSWORD-SENTINEL-7d1c0e"/);
});

test("the unrecognised step: controls with no label, name, aria-label or placeholder", () => {
  const b = step("unrecognised");
  const controls = [...b.matchAll(/<(input|textarea|button)\b[^>]*>/g)].map(m => m[0]);
  assert.equal(controls.length, 3);
  for (const c of controls) assert.doesNotMatch(c, /\b(name|aria-label|placeholder|aria-labelledby)=/, c);
  assert.doesNotMatch(b, /<label/);
});

test("⛔ D60: the fixture's own CSS has no capsule — every radius is 6px or less", () => {
  const css = html.match(/<style>\n #ws-root[\s\S]*?<\/style>/)?.[0] || "";
  assert.ok(css.length > 100, "found the fixture's stylesheet");
  const radii = [...css.matchAll(/border-radius:\s*([\d.]+)(px|%)/g)].map(([, n, u]) => ({ n: Number(n), u }));
  assert.ok(radii.length > 0);
  for (const r of radii) assert.ok(r.u === "px" && r.n <= 6, `radius ${r.n}${r.u}`);
});

test("⚠ every assumed shape says so: the O73 caveat is on the block and on each assumed control", () => {
  const src = read("scripts/fakeAts.js");
  const block = src.slice(at(src, "J2 · THE STAGES INSIDE"), at(src, "function workdayShapedClient"));
  assert.ok((block.match(/⚠ shape assumed, re-measure on a live tenant \(O73\)/g) || []).length >= 5);
  assert.match(block, /⚠ SYNTHETIC, not a Workday shape/);
});
