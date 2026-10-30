// ⭐ A99 (owner 10-30): "the autofill failed on dropdown menus and non-text fields — verify the field is actually
// COMPLETE rather than throw text in and hope." The extension's own applyPlan (and probeFormShape), in a real Chrome,
// against synthetic widgets that behave like the frameworks the portals use — each test is a way a field can LOOK
// filled while the form holds nothing:
//   (1) a React-style checkbox / radio: its state changes only through the page's own click handling; a property set
//       (`el.checked = true`) shows a tick and leaves the form's state empty
//   (2) ARIA radios / switches (`role=radio`, `role=switch`) with no native input: never listed, never filled
//   (3) a typeahead whose options list stays in the field's own box: the read-back must not mistake the open list
//       for a pick
//   (4) `type=date` / `type=month` inputs: they accept only ISO values; anything else is silently rejected
//   (5) the completeness sweep: after the fill, every REQUIRED control that is still empty is reported, by name
// Synthetic markup and words. Browser tests skip, with their reason, without Chrome.
import test from "node:test";
import assert from "node:assert/strict";
import { findChrome } from "../test-support/extensionBrowser.mjs";
import * as gh from "../extension/gated-handoff.js";

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
const fill = (page, plan) => page.evaluate(
  `(${gh.__applyPlanSource})(${JSON.stringify(plan)}, null, { neverFillSource: ${JSON.stringify(gh.NEVER_FILL_SOURCE)} })`);
const probe = (page) => page.evaluate(`(${gh.__probeFormShapeSource})()`);
const stateOf = (page) => page.evaluate(() => window.formState);

// A framework's view of a box: the STATE is written only by the page's own click handling (as React's onChange is fed by
// the native click / input events it listens to, and ignores a value it already tracks). A property set changes what the
// box shows and nothing else.
const reactish = `<script>
  window.formState = {};
  document.addEventListener('click', function (e) {
    var el = e.target;
    if (el.matches && el.matches('input[type=checkbox], input[type=radio]')) window.formState[el.name] = el.type === 'radio' ? el.value : el.checked;
  }, true);
</script>`;

test("A99 · (1) a React-style checkbox and radio are set through the page's own click, and the FORM holds them", { skip: SKIP }, async (t) => {
  const page = await pageWith(t, `<form>
    <label><input type="checkbox" name="relocate" id="relocate"> I am willing to relocate</label>
    <fieldset><legend>Are you over 18?</legend>
      <label><input type="radio" name="adult" id="adult-yes" value="yes"> Yes</label>
      <label><input type="radio" name="adult" id="adult-no" value="no"> No</label></fieldset></form>${reactish}`);
  const shape = await probe(page);
  const idx = (id) => shape.fields.find(f => f.id === id).index;
  const r = await fill(page, [
    { index: idx("relocate"), id: "relocate", name: "relocate", label: "I am willing to relocate", value: "true" },
    { index: idx("adult-yes"), id: "adult-yes", name: "adult", label: "Yes", value: "true" },
  ]);
  assert.deepEqual(await stateOf(page), { relocate: true, adult: "yes" }, "the page's own state holds both answers");
  assert.equal(r.filled.length, 2);
});

test("A99 · (1) a box the page refuses to tick is reported, never counted as filled", { skip: SKIP }, async (t) => {
  const page = await pageWith(t, `<form><label><input type="checkbox" name="locked" id="locked"> Locked box</label></form>
    <script>document.getElementById('locked').addEventListener('click', function (e) { e.preventDefault(); });</script>`);
  const shape = await probe(page);
  const r = await fill(page, [{ index: shape.fields[0].index, id: "locked", name: "locked", label: "Locked box", value: "true" }]);
  assert.equal(r.filled.length, 0);
  assert.equal(r.skipped[0].reason, "reverted_after_set");
});

const ariaRadios = `<form>
  <div id="q-auth">Are you legally authorized to work in the United States?</div>
  <div role="radiogroup" aria-labelledby="q-auth" aria-required="true">
    <div role="radio" tabindex="0" aria-checked="false" data-v="Yes">Yes</div>
    <div role="radio" tabindex="-1" aria-checked="false" data-v="No">No</div>
  </div>
  <label id="sw-label">Text me about this application</label>
  <button type="button" role="switch" aria-checked="false" aria-labelledby="sw-label" id="sw"></button>
</form>
<script>
  window.formState = {};
  document.querySelectorAll('[role=radio]').forEach(function (r) {
    r.addEventListener('click', function () {
      document.querySelectorAll('[role=radio]').forEach(function (o) { o.setAttribute('aria-checked', o === r ? 'true' : 'false'); });
      window.formState.auth = r.dataset.v;
    });
  });
  document.getElementById('sw').addEventListener('click', function () {
    var on = this.getAttribute('aria-checked') !== 'true';
    this.setAttribute('aria-checked', on ? 'true' : 'false'); window.formState.sms = on;
  });
</script>`;

test("A99 · (2) ARIA radios and switches are FIELDS: listed with their question, filled by a click, read back from aria-checked", { skip: SKIP }, async (t) => {
  const page = await pageWith(t, ariaRadios);
  const shape = await probe(page);
  const radios = shape.fields.filter(f => f.type === "radio");
  assert.deepEqual(radios.map(f => [f.label, f.group, f.required]), [
    ["Yes", "Are you legally authorized to work in the United States?", true],
    ["No", "Are you legally authorized to work in the United States?", true],
  ]);
  const sw = shape.fields.find(f => f.type === "checkbox");
  assert.equal(sw.label, "Text me about this application");
  assert.equal(radios[0].hasValue, false);
  const r = await fill(page, [{ index: radios[0].index, id: null, name: null, label: "Yes", value: "true" }]);
  assert.deepEqual(await stateOf(page), { auth: "Yes" });
  assert.equal(r.filled.length, 1);
  assert.equal((await probe(page)).fields.find(f => f.type === "radio").hasValue, true, "the group now holds an answer");
});

// A typeahead whose options list is rendered INSIDE its own field box and stays there after a miss.
const stickyTypeahead = `<form><div role="group" class="field"><label for="school">School</label>
  <input id="school" role="combobox" aria-autocomplete="list" aria-controls="school-list" aria-expanded="false">
  <div class="value"></div>
  <ul id="school-list" role="listbox" style="display:none"></ul></div></form>
<script>
  // Grouped as many lists are — "Recent" then "All" — so the same school is listed twice while the list is open.
  var SCHOOLS = ['Northeastern University', 'Northeastern University', 'Northwestern University'];
  var input = document.getElementById('school'), list = document.getElementById('school-list'), shown = document.querySelector('.value');
  window.formState = {};
  input.addEventListener('input', function () {
    var q = input.value.toLowerCase();
    list.innerHTML = '';
    setTimeout(function () {
      SCHOOLS.filter(function (s) { return s.toLowerCase().indexOf(q.split(' ')[0]) === 0; }).forEach(function (s) {
        var li = document.createElement('li'); li.setAttribute('role', 'option'); li.textContent = s;
        // This list never accepts a click: the pick never happens (a broken or slow widget).
        list.appendChild(li);
      });
      list.style.display = 'block'; input.setAttribute('aria-expanded', 'true');
    }, 30);
  });
</script>`;

test("A99 · (3) an open options list is NOT a pick — the typeahead's read-back needs the chosen value shown, not the list", { skip: SKIP }, async (t) => {
  const page = await pageWith(t, stickyTypeahead);
  const shape = await probe(page);
  const r = await fill(page, [{ index: shape.fields[0].index, id: "school", name: null, label: "School", value: "Northeastern University" }]);
  assert.equal(r.filled.length, 0, "the list still showing 'Northeastern University' does not count");
  assert.equal(r.skipped[0].reason, "reverted_after_set");
});

test("A99 · (4) a date and a month input take ISO values — a profile's '11/02/2026' and 'May 2021' are converted, not rejected", { skip: SKIP }, async (t) => {
  const page = await pageWith(t, `<form><label for="start">Earliest start date</label><input type="date" id="start" name="start">
    <label for="grad">Graduation month</label><input type="month" id="grad" name="grad"></form>`);
  const shape = await probe(page);
  const r = await fill(page, [
    { index: 0, id: "start", name: "start", label: "Earliest start date", value: "11/02/2026" },
    { index: 1, id: "grad", name: "grad", label: "Graduation month", value: "May 2021" },
  ]);
  assert.equal(shape.fields.length, 2);
  assert.equal(await page.$eval("#start", el => el.value), "2026-11-02");
  assert.equal(await page.$eval("#grad", el => el.value), "2021-05");
  assert.equal(r.filled.length, 2);
  // A value that is not a date is left, and said — never typed into a date box.
  const r2 = await fill(page, [{ index: 0, id: "start", name: "start", label: "Earliest start date", value: "as soon as possible" }]);
  assert.equal(r2.skipped[0].reason, "not_a_date");
});

test("A99 · (5) the completeness sweep (findMissingRequired, the badge's count): every REQUIRED control still empty is named — native, ARIA, and a typeahead that was typed but never picked", { skip: SKIP }, async (t) => {
  const [ariaInner, ariaScript] = ariaRadios.replace("<form>", "").split("</form>");
  const page = await pageWith(t, `<form>
    <label for="fn">First name *</label><input id="fn" name="fn" required>
    <label for="ln">Last name *</label><input id="ln" name="ln" required>
    <label for="country">Country *</label><select id="country" name="country" required><option value="">Select…</option><option>United States</option></select>
    <label for="why">Why us? (optional)</label><textarea id="why" name="why"></textarea>
    <div class="field"><label for="city">City *</label><input id="city" role="combobox" aria-autocomplete="list" aria-required="true" aria-expanded="true" aria-controls="city-list" value="Bost">
      <ul id="city-list" role="listbox"><li role="option">Boston, MA</li></ul></div>
    ${ariaInner}</form>${ariaScript}`);
  const shape = await probe(page);
  await fill(page, [{ index: shape.fields.find(f => f.id === "fn").index, id: "fn", name: "fn", label: "First name *", value: "Dana" }]);
  const missing = (await page.evaluate(`(${gh.__findMissingRequiredSource})()`)).map(m => m.label).sort();
  assert.deepEqual(missing, ["Are you legally authorized to work in the United States?", "City", "Country", "Last name"],
    "required and still empty — said, by name; typed-but-not-picked counts as empty; the optional box and the filled one are not");
});
