// ⭐ OWNER 10-21 ("when I type into the fields they have to be recorded for next time"): an answer the person gives ON
// THE PAGE — typed into a box, picked from a Greenhouse react-select — is remembered as one typed in the panel is. In a
// real Chrome:
//   (1) fieldValuesHeld reads what the person typed and picked, flags the field they are still in, and NEVER reads a
//       value a page script planted (trusted events only); fieldsHeld now sees react-select's single-value pick
//   (2) the panel end to end: a Needs-you row answered on the page moves to Filled and, once the person has left the
//       field, is acknowledged as you_typed with the page's value — once, not per keystroke
// Synthetic markup and words. Skips, with its reason, without Chrome.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { findChrome } from "../test-support/extensionBrowser.mjs";
import { renderOverlay, panelRowsForStep, fieldsHeld, fieldValuesHeld } from "../extension/review-overlay.js";
import { C_LIGHT, C_DARK } from "../extension/tokens.js";

const DOCK_JS = fs.readFileSync("extension/dock.js", "utf8");
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
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// A Greenhouse-shaped form: a text box, a react-select picker (pick → single-value label), and a box a page script fills.
const FORM = `<form>
  <div class="field"><label for="city">City</label><input id="city" type="text"></div>
  <div class="select"><label id="auth-label" for="auth">Are you authorized to work in the US?</label>
   <div class="select__control"><div class="select__value-container"><div class="select__single-value"></div>
   <div class="select__input-container"><input class="select__input" id="auth" type="text" role="combobox" aria-autocomplete="list" aria-labelledby="auth-label" value=""></div></div></div>
   <div class="menu" hidden><div role="option">Yes</div><div role="option">No</div></div></div>
  <div class="field"><label for="planted">Referral code</label><input id="planted" type="text"></div>
  <div class="field"><label for="other">Other</label><input id="other" type="text"></div>
</form><script>
  var auth = document.getElementById('auth'), menu = document.querySelector('.menu');
  auth.addEventListener('focus', function () { menu.hidden = false; });
  [].forEach.call(menu.children, function (o) { o.addEventListener('click', function () {
    document.querySelector('.select__single-value').textContent = o.textContent; menu.hidden = true; auth.value = ''; }); });
</script>`;
const ROWS = [
  { key: "city", unitKind: "text", locator: [{ id: "city", name: null }] },
  { key: "auth", unitKind: "text", locator: [{ id: "auth", name: null }] },
  { key: "planted", unitKind: "text", locator: [{ id: "planted", name: null }] },
];

test("PAGE ANSWERS (1, Chrome): what the person typed and picked is read — a field they are in is flagged, a value a page script planted never is", { skip: SKIP, timeout: 60000 }, async (t) => {
  const page = await pageWith(t, FORM);
  await page.evaluate(`(${fieldsHeld.toString()})([])`);           // the panel's first live check installs the watch
  await page.click("#city"); await page.keyboard.type("Boston");
  await page.click("#auth"); await page.click(".menu [role=option]:first-child");
  await page.evaluate(() => { document.getElementById("planted").value = "PAGE-PLANTED"; });
  await page.click("#city");                                           // back in the city box
  let v = await page.evaluate(`(${fieldValuesHeld.toString()})(${JSON.stringify(ROWS)})`);
  assert.deepEqual(v, [{ key: "city", value: "Boston", focused: true }, { key: "auth", value: "Yes", focused: false }],
    "the planted value is never read; the city box is still being typed in");
  await page.click("#other");
  v = await page.evaluate(`(${fieldValuesHeld.toString()})(${JSON.stringify(ROWS)})`);
  assert.equal(v.find(x => x.key === "city").focused, false);
  // react-select's pick is a single-value label: the live check now sees it
  assert.deepEqual(await page.evaluate(`(${fieldsHeld.toString()})(${JSON.stringify(ROWS)})`), ["city", "auth", "planted"]);
});

test("PAGE ANSWERS (2, Chrome): the panel — a Needs-you row answered on the page moves to Filled and is remembered ONCE, with the page's value, after the person leaves it", { skip: SKIP, timeout: 90000 }, async (t) => {
  const page = await pageWith(t, FORM);
  await page.addScriptTag({ content: DOCK_JS });
  const rows = panelRowsForStep({
    stepName: "Application",
    fields: [
      { index: 0, type: "text", label: "City", id: "city", required: true, visible: true },
      { index: 1, type: "text", label: "Are you authorized to work in the US?", id: "auth", required: true, visible: true, widget: "typeahead" },
    ],
    plan: [], filled: [],
  });
  // The service worker, in miniature: the form's frame IS this page, so its two questions run here.
  await page.evaluate(`window.__sent = [];
    window.chrome = { runtime: { lastError: null, sendMessage(m, cb) {
      window.__sent.push(m);
      const reply = m.type === 'DOCK_FIELDS_HELD' ? { ok: true, answered: (${fieldsHeld.toString()})(m.rows) }
        : m.type === 'DOCK_FIELD_VALUES' ? { ok: true, values: (${fieldValuesHeld.toString()})(m.rows) }
        : m.type === 'ANSWER_ACKNOWLEDGE' ? { ok: true } : null;
      setTimeout(() => cb && cb(reply), 0);
    } } };
    (${renderOverlay.toString()})(${JSON.stringify({ rows })}, ${JSON.stringify({ runId: "pa-1", theme: { light: C_LIGHT, dark: C_DARK } })})`);
  await sleep(1700);                                                   // the first live check installs the watch
  await page.click("#city"); await page.keyboard.type("Boston", { delay: 30 });
  await page.click("#auth"); await page.click(".menu [role=option]:first-child");
  await page.click("#other");
  const acks = () => page.evaluate(() => window.__sent.filter(m => m.type === "ANSWER_ACKNOWLEDGE").map(m => [m.question, m.answer, m.source]));
  for (let i = 0; i < 40 && (await acks()).length < 2; i++) await sleep(250);
  assert.deepEqual((await acks()).sort(), [["Are you authorized to work in the US?", "Yes", "you_typed"], ["City", "Boston", "you_typed"]]);
  await sleep(3500);
  assert.equal((await acks()).length, 2, "remembered once — not again on every check");
  const shown = await page.evaluate(() => {
    const root = document.getElementById("rm-gate-review-overlay").shadowRoot;
    return { remembered: root.querySelectorAll('[data-role="remembered"]').length, need: root.querySelectorAll('.rm-row[data-group="need"]').length };
  });
  assert.equal(shown.need, 0, "both rows left Needs you");
  assert.equal(shown.remembered, 2, "each row says it is remembered for next time");
});
