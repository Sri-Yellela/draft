// ⭐ PICKERS (owner, 10-19): a box whose value only counts once one of its OWN suggestions is picked — Lever's "Current
// location", a Places box, a read-only dropdown dressed as an input — was TYPED into and left: "Boston" in the box, nothing
// in the form, and the candidate retyped it and picked "Boston" again. The extension's own applyPlan, in a real Chrome:
//   (1) a plain box with no ARIA that shows suggestions after typing: the closest is PICKED ("Springfield, IL" → Illinois's,
//       not the first Springfield), and the page's hidden pick holds it
//   (2) suggestions with nothing close: the box is CLEARED and the row is the candidate's (needs_selection) — never left
//       half-typed
//   (3) a place-like box that shows no list at all is a plain box: it keeps the typed value
//   (4) a read-only input is never typed into: a role=combobox one is opened and picked from; a bare one is left
//   (5) an ARIA typeahead: "Boston, MA" picks "Boston, Massachusetts, United States" over the other Bostons
// Synthetic markup and words. Browser tests skip, with their reason, without Chrome.
import test from "node:test";
import assert from "node:assert/strict";
import { findChrome } from "../test-support/extensionBrowser.mjs";
import * as gh from "../extension/gated-handoff.js";
import { NEED_WORDS } from "../extension/review-overlay.js";

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
const val = (page, sel) => page.$eval(sel, el => el.value);

// Lever's measured location markup, with a picker's behaviour: suggestions a beat after typing, picked on mousedown.
const leverLocation = (places) => `<form><ul><li class="application-question"><label>
  <div class="application-label">Current location <span class="required">✱</span></div><div class="application-field">
  <input class="location-input" id="loc" type="text" name="location" required><input type="hidden" name="selectedLocation">
  <div class="dropdown-container" style="display:none"><div class="dropdown-results"></div>
  <div class="dropdown-no-results" style="display:none">No location found. Try entering a different location</div></div></div></label></li></ul></form>
  <script>
  (function () {
    var PLACES = ${JSON.stringify(places)};
    var input = document.getElementById('loc'), hidden = document.querySelector('[name=selectedLocation]');
    var box = document.querySelector('.dropdown-container'), results = box.querySelector('.dropdown-results');
    var none = box.querySelector('.dropdown-no-results');
    input.addEventListener('input', function () {
      hidden.value = ''; results.innerHTML = '';
      var q = input.value.trim().toLowerCase();
      setTimeout(function () {
        var hits = q ? PLACES.filter(function (p) { return p.toLowerCase().indexOf(q) === 0; }) : [];
        results.innerHTML = '';
        hits.forEach(function (p) {
          var d = document.createElement('div'); d.className = 'dropdown-location'; d.textContent = p;
          d.addEventListener('mousedown', function (e) { e.preventDefault(); input.value = p; hidden.value = p; box.style.display = 'none'; });
          results.appendChild(d);
        });
        box.style.display = q ? 'block' : 'none';
        none.style.display = q && !hits.length ? 'block' : 'none';
      }, 150);
    });
  })();
  </script>`;

test("PICKER (1, Chrome): a plain box that suggests after typing — the closest suggestion is PICKED, and the page's pick holds it", { skip: SKIP, timeout: 60000 }, async (t) => {
  const page = await pageWith(t, leverLocation(['Springfield, MA, United States', 'Springfield, IL, United States', 'Springfield, MO, United States']));
  const r = await fill(page, [{ index: 0, name: "location", id: "loc", label: "Current location ✱", value: "Springfield, IL" }]);
  assert.equal(await val(page, "[name=selectedLocation]"), "Springfield, IL, United States", "Illinois's Springfield, picked — not the first one");
  assert.equal(await val(page, "#loc"), "Springfield, IL, United States");
  assert.deepEqual(r.filled.map(f => [f.name, f.placed]), [["location", "Springfield, IL, United States"]]);
  assert.equal(r.skipped.length, 0, JSON.stringify(r.skipped));
});

test("PICKER (2, Chrome): suggestions with nothing close — the box is CLEARED and the row is the candidate's, never half-typed", { skip: SKIP, timeout: 60000 }, async (t) => {
  const page = await pageWith(t, leverLocation(['Austin, TX, United States']));
  const r = await fill(page, [{ index: 0, name: "location", id: "loc", label: "Current location ✱", value: "Boston, MA" }]);
  assert.equal(await val(page, "#loc"), "", "no typed-but-unpicked text is left behind");
  assert.equal(await val(page, "[name=selectedLocation]"), "");
  assert.equal(r.filled.length, 0);
  assert.deepEqual(r.skipped.map(s => s.reason), ["needs_selection"]);
  assert.ok(NEED_WORDS.needs_selection, "the panel has words for it");
});

test("PICKER (3, Chrome): a place-like box that shows no list is a plain box — it keeps the typed value", { skip: SKIP, timeout: 60000 }, async (t) => {
  const page = await pageWith(t, `<form><label for="city">City</label><input id="city" name="city" type="text"></form>`);
  const r = await fill(page, [{ index: 0, name: "city", id: "city", label: "City", value: "Boston, MA" }]);
  assert.equal(await val(page, "#city"), "Boston, MA");
  assert.equal(r.filled.length, 1);
  assert.equal(r.skipped.length, 0);
});

test("PICKER (4, Chrome): a read-only input is never typed into — a combobox one is opened and picked from, a bare one is left", { skip: SKIP, timeout: 60000 }, async (t) => {
  const page = await pageWith(t, `<form>
    <label for="dd">Degree</label><input id="dd" name="degree" readonly role="combobox" aria-controls="dd-list" value="">
    <ul id="dd-list" role="listbox" hidden></ul>
    <label for="ro">Start date</label><input id="ro" name="start" readonly value="">
  </form><script>
    var dd = document.getElementById('dd'), list = document.getElementById('dd-list');
    dd.addEventListener('click', function () {
      list.innerHTML = '<li role="option">Bachelor\\'s Degree</li><li role="option">Master\\'s Degree</li>'; list.hidden = false;
      [].forEach.call(list.children, function (o) { o.addEventListener('click', function () { dd.value = o.textContent; list.hidden = true; }); });
    });
  </script>`);
  const r = await fill(page, [
    { index: 0, name: "degree", id: "dd", label: "Degree", value: "Master of Science" },
    { index: 1, name: "start", id: "ro", label: "Start date", value: "2026-01-05" },
  ]);
  assert.equal(await val(page, "#dd"), "Master's Degree", "picked from its own list, not typed");
  assert.equal(await val(page, "#ro"), "", "a read-only box takes no typing");
  assert.deepEqual(r.skipped.map(s => [s.name, s.reason]), [["start", "needs_selection"]]);
});

test("PICKER (5, Chrome): an ARIA typeahead — 'Boston, MA' picks Massachusetts's Boston over the other Bostons", { skip: SKIP, timeout: 60000 }, async (t) => {
  const page = await pageWith(t, `<form><div class="field"><label for="ta">Location (City)</label>
    <input id="ta" type="text" role="combobox" aria-autocomplete="list" aria-controls="ta-list" value="">
    <div role="listbox" id="ta-list"></div><div class="chosen"></div></div></form>
  <script>
    var ta = document.getElementById('ta'), list = document.getElementById('ta-list'), chosen = document.querySelector('.chosen');
    var PLACES = ['Boston, Lincolnshire, United Kingdom', 'Boston, Georgia, United States', 'Boston, Massachusetts, United States'];
    ta.addEventListener('input', function () {
      var q = ta.value.trim().toLowerCase(); list.innerHTML = '';
      PLACES.filter(function (p) { return q && p.toLowerCase().indexOf(q) === 0; }).forEach(function (p) {
        var o = document.createElement('div'); o.setAttribute('role', 'option'); o.textContent = p;
        o.addEventListener('click', function () { chosen.textContent = p; ta.value = ''; list.innerHTML = ''; });
        list.appendChild(o);
      });
    });
  </script>`);
  const r = await fill(page, [{ index: 0, name: null, id: "ta", label: "Location (City)", value: "Boston, MA" }]);
  assert.equal(await page.$eval(".chosen", el => el.textContent), "Boston, Massachusetts, United States");
  assert.deepEqual(r.filled.map(f => f.placed), ["Boston, Massachusetts, United States"]);
});

// ⭐ LIVE (Greenhouse, stripe.com's embedded form, 10-21): react-select's open state is the PAGE's, opened only in an
// onKeyUp handler (`code !== "Enter"` → open). A value set through the setter opened nothing, so every picker read "no
// close option"; and with no list of its own open, the fill read the FIRST listbox in the document — the phone field's
// hidden country list. Both reproduced here; the phone Country shows a pick shortened ("+1").
test("PICKER (6, Chrome): a picker that opens only on KEY-UP is typed with keys; another widget's hidden listbox is never read; a shortened single value counts", { skip: SKIP, timeout: 60000 }, async (t) => {
  const page = await pageWith(t, `<ul role="listbox" id="iti-0__country-listbox" style="display:none"><li role="option">United States</li><li role="option">Boston</li></ul>
  <form>
   ${["loc", "cc"].map(id => `<div class="select"><label id="${id}-label" for="${id}">${id === "loc" ? "Location (City)" : "Country"}</label>
    <div class="select__control"><div class="select__value-container"><div class="select__single-value"></div>
    <div class="select__input-container"><input class="select__input" id="${id}" type="text" role="combobox" aria-autocomplete="list" aria-haspopup="true" aria-expanded="false" aria-labelledby="${id}-label" value=""></div></div></div>
    <div class="select__menu-host"></div></div>`).join("")}
  </form><script>
  var DATA = { loc: ['Boston, England, United Kingdom', 'Boston, Massachusetts, United States', 'East Boston, Massachusetts, United States'],
               cc: ['Canada +1', 'United States +1'] };
  Object.keys(DATA).forEach(function (id) {
    var el = document.getElementById(id), host = el.closest('.select').querySelector('.select__menu-host');
    var single = el.closest('.select__control').querySelector('.select__single-value');
    var open = false;
    function draw() {
      host.innerHTML = '';
      if (!open) { el.setAttribute('aria-expanded', 'false'); el.removeAttribute('aria-controls'); return; }
      var q = el.value.trim().toLowerCase();
      var lb = document.createElement('div'); lb.setAttribute('role', 'listbox'); lb.id = 'react-select-' + id + '-listbox';
      DATA[id].filter(function (p) { return p.toLowerCase().indexOf(q) >= 0; }).forEach(function (p) {
        var o = document.createElement('div'); o.setAttribute('role', 'option'); o.textContent = p;
        o.addEventListener('click', function () { single.textContent = id === 'cc' ? p.split(' ').pop() : p; el.value = ''; open = false; draw(); });
        lb.appendChild(o);
      });
      host.appendChild(lb); el.setAttribute('aria-expanded', 'true'); el.setAttribute('aria-controls', lb.id);
    }
    el.addEventListener('input', draw);                                   // the text changes; the list stays shut
    el.addEventListener('keyup', function (e) { if (e.code === 'Escape' || e.code === 'Tab') open = false; else if (e.code !== 'Enter') open = true; draw(); });
  });
  </script>`);
  const r = await fill(page, [
    { index: 0, name: null, id: "loc", label: "Location (City)", value: "Boston, MA" },
    { index: 1, name: null, id: "cc", label: "Country", value: "United States +1" },
  ]);
  assert.deepEqual(r.filled.map(f => f.placed), ["Boston, Massachusetts, United States", "United States +1"], JSON.stringify(r.skipped));
  assert.equal(await page.$eval("#cc", el => el.closest(".select__control").querySelector(".select__single-value").textContent), "+1");
  assert.equal(r.skipped.length, 0);
});
