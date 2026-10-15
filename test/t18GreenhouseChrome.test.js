// ⭐ T18 + T23 IN A REAL CHROME — the standard Greenhouse form (scripts/fakeAtsGreenhouseStandard.js), read, filled and
// given a résumé by the extension's OWN injected functions (gated-handoff.js probeFormShape / applyPlan, resumePanel.js
// attachResumeFile, review-overlay.js renderOverlay on dock.js) — the same text the service worker injects.
//   (1) every field is named — no "Unlabelled", the uploads by their group's heading, not "Attach"
//   (2) the fill: ≥ 80 % of the standard fields prepared with no typing (a synthetic profile + base résumé), measured
//       on the PAGE — and the résumé upload still EMPTY: a file is never attached without the click
//   (3) attach: the PDF lands in the row's own upload (the résumé's, never the cover letter's) and the page SHOWS its
//       name; a custom drop zone that shows nothing is NOT verified (the panel falls back to Download PDF)
//   (4) a file input beneath a heading is typed `resume`
//   (5) the row: Attach my résumé · Generate and attach · Skip — a page script's click sends nothing; the user's sends
//       RESUME_ATTACH_FILE for THAT upload; an attached reply moves the row to Filled; a fallback offers Download PDF
// Synthetic person (Avery Testcase). Skips, with its reason, where there is no Chrome.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { findChrome } from "../test-support/extensionBrowser.mjs";
import * as gh from "../extension/gated-handoff.js";
import { attachResumeFile } from "../extension/resumePanel.js";
import { renderOverlay, panelRowsForStep } from "../extension/review-overlay.js";
import { placeStatedAnswers } from "../extension/savedAnswerMatch.js";
import { C_LIGHT, C_DARK } from "../extension/tokens.js";
import { buildGatePacket } from "../services/applyGatePacket.js";
import { buildStructuredResume } from "../services/resumeFormatter.js";
import { greenhouseStandardForm } from "../scripts/fakeAtsGreenhouseStandard.js";
import { GREENHOUSE_FIELDS, STANDARD_IDS, SYNTHETIC_PAYLOAD, SYNTHETIC_RESUME } from "../test-support/greenhouseStandard.mjs";

const DOCK_JS = fs.readFileSync("extension/dock.js", "utf8");
const chrome = await findChrome();
const SKIP = chrome.skip || false;
const PDF = Buffer.from("%PDF-1.4\n% synthetic test file — Avery Testcase\n%%EOF\n").toString("base64");

async function browserPage(t, html) {
  const puppeteer = (await import("puppeteer-core")).default;
  const browser = await puppeteer.launch({ executablePath: chrome.path, headless: true, pipe: true, args: ["--no-first-run"] });
  t.after(() => browser.close());
  const page = await browser.newPage();
  if (html) await page.setContent(html);
  return { browser, page };
}
const probe = (page) => page.evaluate(`(${gh.__probeSource})()`);
const packet = () => buildGatePacket({ autofillPayload: SYNTHETIC_PAYLOAD, baseResume: buildStructuredResume(SYNTHETIC_RESUME),
  applyUrl: "https://job-boards.greenhouse.io/examplerobotics/jobs/4000001", jobId: "greenhouse::4000001", gateReason: "prepared" });

test("⭐ T18 (Chrome): the standard Greenhouse form is read with every field named — no 'Unlabelled', no 'Attach'", { skip: SKIP, timeout: 60000 }, async (t) => {
  const { page } = await browserPage(t, greenhouseStandardForm());
  const shape = await probe(page);
  const seen = shape.fields.map(f => ({ id: f.id, type: f.type, label: f.label, widget: f.widget }));
  assert.deepEqual(seen, GREENHOUSE_FIELDS.map(f => ({ id: f.id, type: f.type, label: f.label, widget: f.widget })),
    "the unit tests' field list is what the real page reports");
  assert.deepEqual(shape.fields.filter(f => !f.labelSource).map(f => f.id), [], "every field's label came from the page");
  const resume = shape.fields.find(f => f.id === "resume");
  assert.equal(resume.label, "Resume/CV*", "the group's heading — not its 'Attach' button's label");
  assert.equal(resume.labelSource, "group");
  assert.equal(resume.required, true, "the heading's asterisk makes it required");
  assert.equal(gh.fileTypeOf(resume), "resume");
  assert.equal(gh.fileTypeOf(shape.fields.find(f => f.id === "cover_letter")), "cover_letter");
  const rows = panelRowsForStep({ fields: shape.fields, kindOf: gh.questionKind });
  assert.deepEqual(rows.filter(r => /Unlabelled|^Attach$/.test(r.label)).map(r => r.label), []);
});

test("⭐ T23 (Chrome): ≥ 80 % of the standard fields filled with NO typing — and the résumé upload untouched until the click", { skip: SKIP, timeout: 90000 }, async (t) => {
  const { page } = await browserPage(t, greenhouseStandardForm());
  const shape = await probe(page);
  const p = packet();
  const m = gh.matchAnswersToFields(p.answers, shape.fields);
  const stated = placeStatedAnswers(p, shape.fields, m.plan, gh.questionKind);
  const plan = gh.withoutNeverFill([...m.plan, ...stated.plan], shape.fields).plan;
  const r = await page.evaluate(`(${gh.__applyPlanSource})(${JSON.stringify(plan)}, null, { neverFillSource: ${JSON.stringify(gh.NEVER_FILL_SOURCE)} })`);
  const filledIds = new Set(r.filled.map(f => shape.fields[f.index]?.id));
  // read the page itself: what each standard field HOLDS now
  const holds = await page.evaluate((ids) => Object.fromEntries(ids.map(id => {
    const el = document.getElementById(id);
    if (!el) return [id, null];
    if (el.type === "file") return [id, el.files.length ? el.files[0].name : ""];
    if (el.getAttribute("role") === "combobox") return [id, document.querySelector(`[data-value-of="${id}"]`)?.textContent || ""];
    return [id, el.value];
  })), STANDARD_IDS);
  const filled = STANDARD_IDS.filter(id => holds[id]);
  // the résumé is prepared as ONE click (Attach my résumé) — no typing; counted, but it must still be empty here
  const prepared = new Set([...filled, "resume"]);
  const share = prepared.size / STANDARD_IDS.length;
  console.log(`T23 measured: ${filled.length} of ${STANDARD_IDS.length} standard fields filled on the page, ${prepared.size} prepared with no typing (${Math.round(share * 100)}%) — not: ${STANDARD_IDS.filter(id => !prepared.has(id)).join(", ")}`);
  assert.ok(share >= 0.8, JSON.stringify(holds));
  assert.deepEqual(STANDARD_IDS.filter(id => !prepared.has(id)), ["cover_letter"], JSON.stringify({ holds, skipped: r.skipped }));
  assert.equal(holds["candidate-location"], "Springfield, Illinois, United States", "the profile's city, picked from the page's own list");
  assert.equal(holds["school--0"], "State University of Examples", "the résumé's school");
  assert.equal(holds["degree--0"], "Bachelor's Degree");
  assert.equal(holds.country, "United States +1");
  assert.equal(holds["end-year--0"], "2018");
  for (const id of STANDARD_IDS.filter(i => i !== "resume" && i !== "cover_letter")) assert.ok(filledIds.has(id), `${id} read back as filled`);
  // ⛔ nothing on the eligibility, EEO or custom questions; ⛔ no file attached by the fill
  const left = await page.evaluate(() => ["question_30003", "question_30004", "question_30005", "question_30006", "gender", "veteran_status", "preferred_name"]
    .map(id => document.getElementById(id).value));
  assert.deepEqual(left, ["", "", "", "", "", "", ""]);
  assert.equal(await page.evaluate(() => document.getElementById("resume").files.length + document.getElementById("cover_letter").files.length), 0,
    "a file is never attached without the click");
  assert.equal(r.resume, null);
});

test("⭐ T18 (Chrome): Attach puts the PDF in the row's own upload and the page shows its name; a drop zone that shows nothing is not verified", { skip: SKIP, timeout: 60000 }, async (t) => {
  const { page } = await browserPage(t, greenhouseStandardForm());
  const run = (file) => page.evaluate(`(${attachResumeFile.toString()})(${JSON.stringify(file)})`);
  const r = await run({ base64: PDF, fileName: "Avery_Testcase_Resume.pdf", mimeType: "application/pdf", target: { id: "resume", kind: "resume" } });
  assert.deepEqual({ target: r.target, set: r.set, verified: r.verified, how: r.how }, { target: true, set: true, verified: true, how: "page" });
  assert.equal(await page.$eval("[data-filename-of='resume']", el => el.textContent), "Avery_Testcase_Resume.pdf", "the page shows the file's name");
  assert.equal(await page.evaluate(() => document.getElementById("cover_letter").files.length), 0, "never the cover letter's box");
  // a cover letter goes ONLY into the box typed cover_letter
  const c = await run({ base64: PDF, fileName: "Avery_Testcase_Letter.pdf", target: { id: "cover_letter", kind: "cover_letter" } });
  assert.equal(c.verified, true);
  assert.equal(await page.evaluate(() => document.getElementById("resume").files[0].name), "Avery_Testcase_Resume.pdf", "the résumé stayed");
  // ⛔ a résumé is never put in a box whose words say it is something else, even when a row names it
  const page2 = (await browserPage(t, greenhouseStandardForm())).page;
  const wrong = await page2.evaluate(`(${attachResumeFile.toString()})(${JSON.stringify({ base64: PDF, fileName: "x.pdf", target: { id: "cover_letter", kind: "resume" } })})`);
  assert.equal(await page2.evaluate(() => document.getElementById("cover_letter").files.length), 0, JSON.stringify(wrong));
  // the custom drop zone: set, but the page shows nothing and the input is hidden → NOT verified → the fallback
  const { page: dz } = await browserPage(t, greenhouseStandardForm({ nameless: true }));
  const n = await dz.evaluate(`(${attachResumeFile.toString()})(${JSON.stringify({ base64: PDF, fileName: "Avery_Testcase_Resume.pdf", target: { id: "resume", kind: "resume" } })})`);
  assert.equal(n.verified, false);
  assert.equal(n.reason, "not_shown");
});

test("T18 (Chrome): a file input beneath a heading is typed `resume` — the heading is its label", { skip: SKIP, timeout: 60000 }, async (t) => {
  const { page } = await browserPage(t, `<form>
    <div class="row"><label for="fn">First name</label><input id="fn"></div>
    <section class="up"><h3>Resume</h3><div class="dz"><input type="file" id="f-1"><button type="button">Upload</button></div></section>
    <section class="up"><h3>Cover letter (optional)</h3><div class="dz"><input type="file" id="f-2"><button type="button">Upload</button></div></section>
    <div><input type="file" id="f-3"></div></form>`);
  const shape = await probe(page);
  const f = (id) => shape.fields.find(x => x.id === id);
  assert.equal(f("f-1").label, "Resume");
  assert.equal(gh.fileTypeOf(f("f-1")), "resume");
  assert.equal(gh.fileTypeOf(f("f-2")), "cover_letter");
  assert.equal(gh.fileTypeOf(f("f-3")), "other");
  assert.equal(f("f-3").labelSource, null, "nothing named it");
  assert.ok(f("f-3").raw && f("f-3").raw.id === "f-3", "its raw attributes travel for Show details");
});

test("⛔ T18 (Chrome): the résumé row — a page script's click sends nothing; the user's sends the attach for THAT upload; attached → Filled; not shown → Download PDF", { skip: SKIP, timeout: 90000 }, async (t) => {
  const { page } = await browserPage(t, greenhouseStandardForm());
  const shape = await probe(page);
  const rows = panelRowsForStep({ fields: shape.fields, kindOf: gh.questionKind });
  await page.addScriptTag({ content: DOCK_JS });
  const draw = (reply, files) => page.evaluate(`window.__sent = []; window.__reply = ${JSON.stringify(reply)};
    window.chrome = { runtime: { sendMessage(m, cb) { window.__sent.push(m); cb && cb(m.type === 'RESUME_ATTACH_FILE' ? window.__reply : { ok: true }); }, lastError: null } };
    (${renderOverlay.toString()})(${JSON.stringify({ rows })}, ${JSON.stringify({ runId: `t18-${Math.random()}`, theme: { light: C_LIGHT, dark: C_DARK }, files })})`);
  const ROW = (label) => `#rm-gate-review-overlay >>> .rm-row[data-idx="${rows.findIndex(r => r.label === label)}"]`;
  await draw({ ok: true, attached: true, attach: { outcome: "attached", fileName: "Avery_Testcase_Resume.pdf" } }, { tailored: null, base: true, generate: true, inFlight: false, letter: false });
  const buttons = await page.$$eval(`${ROW("Resume/CV")} [data-role="file-choices"] button`, bs => bs.map(b => b.textContent));
  assert.deepEqual(buttons, ["Attach my résumé", "Generate and attach", "Skip"], "no tailored résumé yet → no Attach tailored");
  const letter = await page.$$eval(`${ROW("Cover Letter")} [data-role="file-choices"] button`, bs => bs.map(b => b.textContent));
  assert.deepEqual(letter, ["Skip"], "draft holds no cover letter — only Skip");
  // drawing sent nothing; a page script's click sends nothing
  await page.evaluate((i) => document.getElementById("rm-gate-review-overlay").shadowRoot.querySelector(`.rm-row[data-idx="${i}"] [data-role="attach"]`).click(),
    rows.findIndex(r => r.label === "Resume/CV"));
  await new Promise(r => setTimeout(r, 200));
  assert.deepEqual(await page.evaluate(() => window.__sent.filter(m => /^RESUME_/.test(m.type))), [], "an untrusted click attaches nothing");
  assert.equal(await page.evaluate(() => document.getElementById("resume").files.length), 0);
  // the user's click
  await page.click(`${ROW("Resume/CV")} [data-role="attach"][data-which="base"]`);
  await page.waitForFunction(() => window.__sent.some(m => m.type === "RESUME_ATTACH_FILE"));
  const sent = await page.evaluate(() => window.__sent.find(m => m.type === "RESUME_ATTACH_FILE"));
  assert.deepEqual(sent, { type: "RESUME_ATTACH_FILE", which: "base", target: { id: "resume", name: null, kind: "resume" }, trigger: "click" });
  await page.waitForFunction(() => [...document.getElementById("rm-gate-review-overlay").shadowRoot.querySelectorAll('.rm-row[data-group="ok"] [data-role="value"]')]
    .some(v => v.textContent === "Avery_Testcase_Resume.pdf"));
  // the fallback: the page did not show it → Download PDF, the name said (and copied)
  await draw({ ok: true, attached: false, attach: { outcome: "fallback", fileName: "Avery_Testcase_Resume.pdf", base64: PDF, reason: "not_shown" } },
    { tailored: { id: "erg_00000000aaaaaaaa" }, base: true, generate: false, inFlight: false, letter: false });
  const again = await page.$$eval(`${ROW("Resume/CV")} [data-role="file-choices"] button`, bs => bs.map(b => b.textContent));
  assert.deepEqual(again, ["Attach tailored", "Attach my résumé", "Skip"], "a ready tailored résumé leads; Generate is not offered beside it (T24)");
  await page.click(`${ROW("Resume/CV")} [data-role="attach"][data-which="base"]`);
  await page.waitForFunction(() => !!document.getElementById("rm-gate-review-overlay").shadowRoot.querySelector('[data-role="download-file"]'));
  const said = await page.$eval(`${ROW("Resume/CV")} [data-role="say"]`, el => el.textContent);
  assert.match(said, /did not show the file.*Avery_Testcase_Resume\.pdf, is copied/);
  // Generate and attach: the user's click sends the one start, with the click's trigger
  await draw({ ok: true }, { tailored: null, base: false, generate: true, inFlight: false, letter: false });
  await page.click(`${ROW("Resume/CV")} [data-role="generate"]`);
  await page.waitForFunction(() => window.__sent.some(m => m.type === "RESUME_GENERATE"));
  assert.deepEqual(await page.evaluate(() => window.__sent.filter(m => /^RESUME_(GENERATE|PANEL_OPEN)/.test(m.type)).map(m => m.type)), ["RESUME_GENERATE", "RESUME_PANEL_OPEN"]);
  assert.equal(await page.evaluate(() => window.__sent.find(m => m.type === "RESUME_GENERATE").trigger), "click");
  // ⛔ D60: the row's buttons are rectangles
  const radius = await page.$eval(`${ROW("Resume/CV")} [data-role="generate"]`, b => parseFloat(getComputedStyle(b).borderTopRightRadius));
  assert.ok(radius <= 10);
});

// ── the REAL extension: the résumé row on Workday's drop zone (test-support/walks/resumeField.mjs) ─────────────────
import { runScenario } from "../test-support/walkExtension.mjs";
test("⭐ T18 walk (real extension): Attach my résumé lands on the drop zone and the page shows its name; Generate and attach starts one; Skip keeps a required upload", { skip: SKIP, timeout: 600000 }, async () => {
  const lines = [];
  const r = await runScenario("resumeField", { log: (l) => lines.push(l) });
  if (r.skipped) return;
  assert.equal(r.failures, 0, lines.filter(l => /^FAIL/.test(l)).join("\n") || lines.slice(-20).join("\n"));
});
