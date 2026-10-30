// ⭐ T34 (10-19 report) · A CAREERS SITE NOBODY CONFIGURED. The extension's own extractJobPayload, in a real Chrome, on
// synthetic pages shaped like the ones no adapter knows: each yields a job (title, company, the posting's text) or — when
// the job is somewhere the top page cannot read — `ok: false`, which T32 turns into a popup with its reason.
//   (1) a JSON-LD JobPosting  (2) none: Open Graph + the main region  (3) the words inside a web component's shadow root
//   (4) the posting inside an iframe: not read from the top page (T11 reads frames by their own address)
//   (5) "Capture selection": the person selects the job's text on a page nothing else can read
// Synthetic employers and words. Browser tests skip, with their reason, without Chrome.
import test from "node:test";
import assert from "node:assert/strict";
import { findChrome } from "../test-support/extensionBrowser.mjs";
import { extractJobPayload } from "../extension/extractor.js";

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
  await page.setContent(`<!DOCTYPE html><html><head>${html.head || ""}</head><body>${html.body}</body></html>`);
  return page;
}
test.after(async () => { if (browserP) await (await browserP).close(); });
const extract = (page) => page.evaluate(`(${extractJobPayload})()`);
const POSTING = "About the role. You will build the data platform that powers our product. Responsibilities include designing " +
  "pipelines, owning reliability, and mentoring engineers. Requirements: 4+ years with Python and SQL; experience with " +
  "distributed systems. Benefits: health, dental, 401(k), and a learning budget.";

test("T34 · (1) a JSON-LD JobPosting gives the title, the employer and the posting's own text", { skip: SKIP }, async (t) => {
  const ld = { "@context": "https://schema.org", "@type": "JobPosting", title: "Data Platform Engineer",
    hiringOrganization: { "@type": "Organization", name: "Fabrikam" }, description: `<p>${POSTING}</p>` };
  const page = await pageWith(t, { head: `<title>Careers</title><script type="application/ld+json">${JSON.stringify(ld)}</script>`, body: "<div>Fabrikam careers</div>" });
  const r = await extract(page);
  assert.deepEqual([r.ok, r.title, r.company], [true, "Data Platform Engineer", "Fabrikam"]);
  assert.match(r.text, /build the data platform/);
});

test("T34 · (2) no structured data: Open Graph names the role and the employer, the main region is the posting", { skip: SKIP }, async (t) => {
  const page = await pageWith(t, {
    head: `<title></title><meta property="og:title" content="Data Platform Engineer"><meta property="og:site_name" content="Fabrikam">`,
    body: `<header>Menu · Teams · Life here</header><main><h2>Data Platform Engineer</h2><p>${POSTING}</p></main><footer>© Fabrikam</footer>`,
  });
  const r = await extract(page);
  assert.deepEqual([r.ok, r.title, r.company], [true, "Data Platform Engineer", "Fabrikam"]);
  assert.match(r.text, /Responsibilities include/);
});

test("T34 · (3) the words inside a web component's shadow root are read when the light DOM holds nothing", { skip: SKIP }, async (t) => {
  const page = await pageWith(t, {
    head: `<title>Data Platform Engineer</title>`,
    body: `<job-view></job-view><script>
      customElements.define('job-view', class extends HTMLElement { connectedCallback() {
        this.attachShadow({ mode: 'open' }).innerHTML = '<section><h1>Data Platform Engineer</h1><p>' + ${JSON.stringify(POSTING)} + '</p></section>';
      } });</script>`,
  });
  const r = await extract(page);
  assert.equal(r.ok, true);
  assert.equal(r.title, "Data Platform Engineer");
  assert.match(r.text, /mentoring engineers/);
});

test("T34 · (4) a posting inside an iframe is not read from the top page — ok:false, so the read says why (T32)", { skip: SKIP }, async (t) => {
  const page = await pageWith(t, {
    head: `<title>Join us</title>`,
    body: `<h1>Join us</h1><iframe src="about:blank" title="application"></iframe>`,
  });
  const r = await extract(page);
  assert.equal(r.ok, false, "nothing like a posting in the top page");
});

test("T34 · (5) Capture selection: on a page nothing else reads, the person's own selection IS the posting", { skip: SKIP }, async (t) => {
  const page = await pageWith(t, {
    head: `<title></title>`,
    body: `<div id="noise">Home · Search · Sign in</div><div id="pick"><div>Data Platform Engineer</div><div>${POSTING}</div></div>`,
  });
  assert.equal((await extract(page)).ok, false, "a bare page with no title, no heading and no structure: nothing to name the job");
  await page.evaluate(() => { const r = document.createRange(); r.selectNodeContents(document.getElementById("pick")); getSelection().removeAllRanges(); getSelection().addRange(r); });
  const r = await extract(page);
  assert.equal(r.ok, true);
  assert.equal(r.title, "Data Platform Engineer");
  assert.doesNotMatch(r.text, /Sign in/, "only what was selected");
});
