// ⛔ A209 (46l, found by a207's real-Chrome acceptance): classifyFlowState read ANY page with the words "thank you" as a
// confirmation. An application form that opens "Thank you for your interest in Example Robotics" was classified 'submitted'
// BEFORE the click — the run recorded Sent (confirmation_page_pre_click) and nothing reached the employer (FA5: Sent is
// evidence, never a guess). Confirmation words now count only when the application form is no longer showing.
// Synthetic employer and person; a local server only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import { findChrome } from "../test-support/extensionBrowser.mjs";
import { autoApply, classifyFlowState, CONFIRMATION_MAX_VISIBLE_CONTROLS } from "../services/applyAutomation.js";

const chrome = await findChrome();
const SKIP = chrome.skip || false;
const FORM = `<!doctype html><html><body><h1>Software Engineer</h1><p>Thank you for your interest in Example Robotics.</p>
<form method="post" action="submit"><label for="n">Full name</label><input id="n" name="name" required>
<label for="e">Email</label><input id="e" name="email" type="email" required><button type="submit">Submit Application</button></form></body></html>`;
const THANKS = `<!doctype html><html><body><input aria-label="Search jobs" placeholder="Search jobs"><h2>Thank you for applying!</h2><p>We'll be in touch.</p></body></html>`;
const PAYLOAD = { field_map: { first_name: "Ada", last_name: "Lovelace", full_name: "Ada Lovelace", email: "ada@example.com" }, handler_map: {}, custom_answers: {} };
const MIN_PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");

test("⛔ A209 (Chrome): a form page that says 'thank you' is a form; a confirmation page with a search box is a confirmation", { skip: SKIP, timeout: 60000 }, async (t) => {
  assert.equal(CONFIRMATION_MAX_VISIBLE_CONTROLS, 2);
  const puppeteer = (await import("puppeteer-core")).default;
  const browser = await puppeteer.launch({ executablePath: chrome.path, headless: true, pipe: true, args: ["--no-first-run"] });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.setContent(FORM);
  const onForm = await classifyFlowState(page);
  assert.ok(["form_ready", "submit_ready"].includes(onForm), `a form state, not a confirmation (${onForm})`);
  await page.setContent(THANKS);
  assert.equal(await classifyFlowState(page), "submitted");
});

test("⛔ A209 (Chrome): the run presses Submit on a 'thank you for your interest' form — Sent only after the employer got it", { skip: SKIP, timeout: 120000 }, async (t) => {
  let posts = 0;
  const s = http.createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    if (req.method === "POST") { posts++; req.resume(); return res.end(THANKS); }
    res.end(FORM);
  });
  await new Promise(r => s.listen(0, "127.0.0.1", r));
  t.after(() => s.close());
  const pdf = `${process.env.TEMP || "/tmp"}/a209.pdf`;
  fs.writeFileSync(pdf, MIN_PDF);
  const r = await autoApply(`http://127.0.0.1:${s.address().port}/apply`, PAYLOAD, { mode: "full", jobId: "a209::1", resumePath: pdf, submitBlocker: () => null });
  assert.equal(posts, 1, `the form was actually submitted (status ${r.status}, evidence ${r.submitEvidence})`);
  assert.equal(r.status, "submitted");
  assert.notEqual(r.submitEvidence, "confirmation_page_pre_click", "never Sent on the form's own words");
});
