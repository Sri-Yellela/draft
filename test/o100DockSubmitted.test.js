// O100 (owner 11-06: "(c) both") — how a submission is recorded once the form's page has gone.
//   (a) the DOCK's "I submitted it" on a tab BOUND to a job: it lasts past the form (the confirmation page is the
//       evidence, the binding names the job) — asked once more, recorded only on the person's own Yes;
//   (b) the tracker: "I applied" on a "Did you apply?" row (an application the extension filled is origin 'draft' →
//       pending_self) opens the full sheet's Pending record form — already there; pinned here so it stays.
// Measured before (44x): only the retired popup's SUBMITTED_ACTIVE_TAB recorded it; the review panel's own button
// needs the panel Ready (page-picker answers keep it at "Needs you") and is gone with the page after Submit.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import { findChrome } from "../test-support/extensionBrowser.mjs";
import { at } from "../test-support/sourceAnchors.js";
import { C_LIGHT, C_DARK } from "../extension/tokens.js";
import { STAGES, stageOfHistory } from "../client/src/lib/trackerRows.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const DOCK = read("extension/dock.js");
const LAYER = read("extension/popup-layer.js");
const BG = read("extension/background.js");
const HOST = read("extension/dockHost.js");

test("O100 (a) · the service worker records DOCK_SUBMITTED only for the click's own message from the page's top frame", () => {
  const start = at(BG, "if (msg?.type === 'DOCK_SUBMITTED') {");
  const body = BG.slice(start, at(BG, "return true;\n  }", start) + 20);
  assert.match(body, /msg\.trigger !== 'click' \|\| sender\?\.frameId !== 0 \|\| !sender\?\.tab\?\.id/);
  assert.match(body, /recordSubmitted\(\{ serverUrl: RESUME_MASTER_URL, tab: sender\.tab \}\)/, "the same record as the panel's: the page is the evidence");
});

test("O100 (a) · the dock learns the tab's bound job from dockMeta — its title and company only", () => {
  assert.match(HOST, /bindingForTab\(tab\)\.catch\(\(\) => null\)/);
  assert.match(HOST, /job: bound \? \{ title: bound\.title \|\| '', company: bound\.company \|\| '' \} : null/);
  assert.match(DOCK, /\$\{kind === 'dock' && f\.job \? submittedBtn\(\) : ''\}/, "shown on a bound tab only");
  assert.match(DOCK, /if \(role === 'submitted'\) \{ if \(ev\.isTrusted\) void askSubmitted\(f, btn\); return; \}/, "a page script's click asks nothing");
  assert.match(DOCK, /if \(answer\?\.action !== 'yes' \|\| !answer\.trusted\) return;/, "recorded on the person's own Yes only");
});

test("O100 (b) · the tracker records it: an extension-filled application is 'Did you apply?' with 'I applied'", () => {
  assert.equal(stageOfHistory({ status: "in_play", origin: "draft" }), "pending_self");
  assert.deepEqual(STAGES.pending_self.actions, ["record", "did_not_apply"]);
  const panel = read("client/src/panels/AutoApplyPanel.jsx");
  assert.match(panel, /case "record": return !n && h \? \{ id, label: "I applied"/);
  assert.match(panel, /onClick: \(\) => openSheet\("pending", row\.jobId\)/);
});

const chrome = await findChrome();
const STUB = `window.__sent = []; window.chrome = { runtime: { lastError: null, sendMessage(m, cb) { window.__sent.push(m);
  cb && cb(m.type === 'DOCK_SUBMITTED' ? { ok: true, verified: true, message: "Recorded — it's in your Submitted applications." } : { ok: true }); } } };`;

test("O100 (a) · in a REAL Chrome — on a bound tab the dock's header asks, and only the person's Yes records it", { skip: chrome.skip || false, timeout: 90000 }, async (t) => {
  const server = http.createServer((_q, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end("<!doctype html><title>Thank you</title><body><h1>Thank you for applying</h1>"); });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  t.after(() => server.close());
  const puppeteer = (await import("puppeteer-core")).default;
  const browser = await puppeteer.launch({ executablePath: chrome.path, headless: true, pipe: true, args: ["--no-first-run"] });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "load" });
  await page.evaluate(STUB);
  await page.addScriptTag({ content: DOCK });
  await page.addScriptTag({ content: LAYER });
  const theme = { light: C_LIGHT, dark: C_DARK };
  const btn = () => page.evaluate(() => { const b = document.getElementById("rm-draft-dock").shadowRoot.querySelector('[data-role="submitted"]');
    return b ? { label: b.getAttribute("aria-label") } : null; });

  // not bound → no control
  await page.evaluate((th) => { globalThis.__draftDock.ensure({ theme: th, job: null }); }, theme);
  assert.equal(await btn(), null, "an unbound tab shows no 'I submitted it'");
  // bound (a later draw says so) → the control, named for the job
  await page.evaluate((th) => { globalThis.__draftDock.ensure({ theme: th, job: { title: "Backend Engineer", company: "Acmeco" } }); }, theme);
  assert.deepEqual(await btn(), { label: "I submitted my application to Acmeco — record it in draft" });

  // a page script's click asks nothing and sends nothing
  await page.evaluate(() => document.getElementById("rm-draft-dock").shadowRoot.querySelector('[data-role="submitted"]').click());
  await new Promise(r => setTimeout(r, 300));
  assert.equal(await page.evaluate(() => !!document.getElementById("rm-draft-submitted")), false);

  // the person's click → the question; "Not yet" records nothing
  await page.click("#rm-draft-dock >>> [data-role='submitted']");
  await page.waitForSelector("#rm-draft-submitted");
  assert.match(await page.evaluate(() => document.getElementById("rm-draft-submitted").shadowRoot.querySelector(".tx").textContent), /Did you submit your application to Acmeco yourself\?/);
  await page.click("#rm-draft-submitted >>> [data-action='no']");
  await page.waitForFunction(() => !document.getElementById("rm-draft-submitted"));
  assert.deepEqual(await page.evaluate(() => window.__sent.filter(m => m.type === "DOCK_SUBMITTED")), []);

  // a synthetic Yes records nothing
  await page.click("#rm-draft-dock >>> [data-role='submitted']");
  await page.waitForSelector("#rm-draft-submitted");
  await page.evaluate(() => document.getElementById("rm-draft-submitted").shadowRoot.querySelector('[data-action="yes"]').click());
  await new Promise(r => setTimeout(r, 300));
  assert.deepEqual(await page.evaluate(() => window.__sent.filter(m => m.type === "DOCK_SUBMITTED")), []);
  await page.evaluate(() => document.getElementById("rm-draft-submitted")?.shadowRoot.querySelector('[data-role="popup-close"]')?.click());
  await page.waitForFunction(() => !document.getElementById("rm-draft-submitted"));

  // the person's Yes → DOCK_SUBMITTED, the click's own; the answer is said
  await page.click("#rm-draft-dock >>> [data-role='submitted']");
  await page.waitForSelector("#rm-draft-submitted");
  await page.click("#rm-draft-submitted >>> [data-action='yes']");
  await page.waitForSelector("#rm-draft-submitted-said");
  assert.deepEqual(await page.evaluate(() => window.__sent.filter(m => m.type === "DOCK_SUBMITTED")), [{ type: "DOCK_SUBMITTED", trigger: "click" }]);
  assert.match(await page.evaluate(() => document.getElementById("rm-draft-submitted-said").shadowRoot.querySelector(".tx").textContent), /Recorded/);

  // unbound again (a different site) → the control goes
  await page.evaluate((th) => { globalThis.__draftDock.ensure({ theme: th, job: null }); }, theme);
  assert.equal(await btn(), null);
});
