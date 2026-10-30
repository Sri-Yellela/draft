import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { findChrome } from "../test-support/extensionBrowser.mjs";
import { RESUME_STYLE_BLOCK } from "../services/resumeFormatter.js";

// ⭐ A106 (owner 10-30) · Word-like tools in the PDF sandbox. The commands (client/src/lib/docFormat.js) run in a REAL
// Chrome on the résumé template's own HTML — the editing engine exists only in a browser. Synthetic résumé.
// Browser tests skip, with their reason, without Chrome.

const chrome = await findChrome();
const SKIP = chrome.skip || false;
const SRC = fs.readFileSync("client/src/lib/docFormat.js", "utf8");
const LIB = SRC.replace(/^export /gm, "") +
  "\nwindow.DF = { SELECTION, DOCUMENT, MARGINS, setSelectionSize, setSelectionLineSpacing, moveSection, insertSection };";

const RESUME = `<html><head>${RESUME_STYLE_BLOCK}</head><body contenteditable="true">
<div class="header"><div class="name">Riley Sample</div></div>
<div class="section-title">Experience</div>
<div class="entry" id="e1"><span class="entry-org" id="org">Northwind</span><ul class="bullets"><li id="b1">Built a queue</li></ul></div>
<div class="section-title">Skills</div>
<ul class="bullets"><li id="s1">Python, Go</li></ul>
<div class="section-title">Education</div>
<div id="ed">Northeastern University</div>
</body></html>`;

let browserP = null;
async function page(t) {
  if (!browserP) {
    const puppeteer = (await import("puppeteer-core")).default;
    browserP = puppeteer.launch({ executablePath: chrome.path, headless: true, pipe: true, args: ["--no-first-run"] });
  }
  const p = await (await browserP).newPage();
  t.after(() => p.close().catch(() => {}));
  await p.setContent(RESUME);
  await p.addScriptTag({ content: LIB });
  return p;
}
test.after(async () => { if (browserP) await (await browserP).close(); });
const selectText = (p, id) => p.evaluate((id) => {
  const el = document.getElementById(id); document.body.focus();
  const r = document.createRange(); r.selectNodeContents(el);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
}, id);
const caretIn = (p, id) => p.evaluate((id) => {
  const el = document.getElementById(id); document.body.focus();
  const r = document.createRange(); r.setStart(el.firstChild || el, 0); r.collapse(true);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
}, id);
const titles = (p) => p.evaluate(() => [...document.querySelectorAll(".section-title")].map(e => e.textContent));

test("A106 · bold, an exact point size and line spacing change the SELECTION, and nothing else", { skip: SKIP }, async (t) => {
  const p = await page(t);
  // A bullet's text (the template's .entry-org is already bold, and Bold toggles).
  await selectText(p, "s1");
  const weight = () => p.evaluate(() => Number(getComputedStyle(getSelection().anchorNode.nodeType === 1
    ? getSelection().anchorNode : getSelection().anchorNode.parentElement).fontWeight));
  assert.ok(await weight() < 600);
  await p.evaluate(() => DF.SELECTION.bold(document));
  await selectText(p, "s1");
  assert.ok(await p.evaluate(() => [...document.getElementById("s1").querySelectorAll("*")].some(e => Number(getComputedStyle(e).fontWeight) >= 600)),
    "the selected text is bold");
  assert.ok(await p.evaluate(() => Number(getComputedStyle(document.getElementById("b1")).fontWeight) < 600), "nothing else changed");
  await selectText(p, "b1");
  assert.equal(await p.evaluate(() => DF.setSelectionSize(document, 11)), true);
  const sized = await p.evaluate(() => [...document.querySelectorAll('[style*="font-size"]')].map(e => e.style.fontSize));
  assert.ok(sized.includes("11pt"), JSON.stringify(sized));
  assert.equal(await p.evaluate(() => document.querySelectorAll('[style*="xxx-large"], font[size="7"]').length), 0, "the engine's marker is restated, never left");
  await caretIn(p, "s1");
  assert.equal(await p.evaluate(() => DF.setSelectionLineSpacing(document, 1.5)), true);
  assert.equal(await p.evaluate(() => document.getElementById("s1").style.lineHeight), "1.5");
  // A size needs a selection — a collapsed caret says so rather than doing nothing silently.
  await caretIn(p, "ed");
  assert.equal(await p.evaluate(() => DF.setSelectionSize(document, 9)), false);
});

test("A106 · a section moves up and down as a whole, and a new one goes after the caret's", { skip: SKIP }, async (t) => {
  const p = await page(t);
  await caretIn(p, "s1");                       // in Skills
  assert.equal(await p.evaluate(() => DF.moveSection(document, -1)), true);
  assert.deepEqual(await titles(p), ["Skills", "Experience", "Education"]);
  assert.equal(await p.evaluate(() => document.getElementById("s1").closest("ul").previousElementSibling.textContent), "Skills", "its content moved with it");
  await caretIn(p, "s1");
  assert.equal(await p.evaluate(() => DF.moveSection(document, -1)), false, "the first section cannot move up");
  await caretIn(p, "ed");
  assert.equal(await p.evaluate(() => DF.moveSection(document, 1)), false, "the last cannot move down");
  await caretIn(p, "b1");                       // in Experience
  await p.evaluate(() => DF.insertSection(document));
  assert.deepEqual(await titles(p), ["Skills", "Experience", "New section", "Education"]);
});

test("A106 · margins and Fit to one page change the template's variables — carried in the saved HTML; Reset undoes them", { skip: SKIP }, async (t) => {
  const p = await page(t);
  const bodyPt = () => p.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
  const before = await bodyPt();
  const r = await p.evaluate(() => DF.DOCUMENT.fitStep(document));
  assert.equal(r.fs, 8.25);
  assert.ok(await bodyPt() < before, "the body text is smaller");
  await p.evaluate(() => DF.DOCUMENT.margins(document, DF.MARGINS[0]));
  const html = await p.evaluate(() => document.documentElement.outerHTML);
  assert.match(html, /--fs-body: 8\.25pt/);
  assert.match(html, /--margin-x: 0\.4in/, "the saved / exported HTML carries the change");
  for (let i = 0; i < 40; i++) await p.evaluate(() => DF.DOCUMENT.fitStep(document));
  assert.equal(await p.evaluate(() => document.documentElement.style.getPropertyValue("--fs-body")), "7pt", "never below a readable floor");
  await p.evaluate(() => DF.DOCUMENT.reset(document));
  assert.equal(await bodyPt(), before);
  assert.equal(await p.evaluate(() => document.documentElement.getAttribute("style") || ""), "");
});

test("A106 · the sandbox shows the toolbar in Page view and records every change through its own input path", () => {
  const sb = fs.readFileSync("client/src/panels/SandboxPanel.jsx", "utf8");
  const tb = fs.readFileSync("client/src/components/DocToolbar.jsx", "utf8");
  assert.match(sb, /<DocToolbar getDoc=\{toolbarDoc\} getAllDocs=\{toolbarDocs\} onChanged=\{toolbarChanged\} \/>/);
  assert.match(sb, /doc\?\.dispatchEvent\(new Event\("input"\)\)/);
  assert.match(sb, /doc\.addEventListener\("selectionchange", markActive\)/);
  // The page keeps its selection: every button acts on mousedown with preventDefault.
  assert.match(tb, /onMouseDown: \(e\) => \{ e\.preventDefault\(\); fn\(\); \}/);
  // execCommand lives in ONE module.
  for (const f of ["client/src/components/DocToolbar.jsx", "client/src/panels/SandboxPanel.jsx"]) {
    assert.doesNotMatch(fs.readFileSync(f, "utf8"), /execCommand/, f);
  }
  // A105 finding 9: unsaved edits are guarded.
  assert.match(sb, /window\.addEventListener\("beforeunload", warn\)/);
});
