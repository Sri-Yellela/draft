// D99 J12 · ATS ON THE PAGE — "the ATS button opens the free checker and asks me to upload a résumé" (owner, 10-13).
//
// A signed-in user is never sent to the free checker: the popup's score button opens the on-page panel, which shows
// draft's OWN report for the tab's job (score, band — the web app's words — matched and missing terms, "Full report in
// draft"); no base résumé → "Add your résumé in draft"; an unlinked tab → a "Read this page now" BUTTON (D99 J11's
// wording), not an instruction to go to the popup. The free checker stays for signed-out visitors.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { resumePanelModel, reportModel, modelWords } from "../extension/resumePanel.js";
import { atsFacts } from "../extension/boardJob.js";
import { findChrome } from "../test-support/extensionBrowser.mjs";
import { runScenario } from "../test-support/walkExtension.mjs";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const JOB = { jobId: "j1", title: "Software Engineer", company: "Zoom" };

test("J12 · the report block: score and the web app's band words, the terms, the full-report link", () => {
  const r = reportModel(atsFacts({ state: "ready", score: 72.4, band: "strong", scorable: true, matched: ["go", "sql"], missing: ["kafka"] }));
  assert.equal(r.head, "ATS 72 · Strong match");
  assert.deepEqual([r.matched, r.missing], [["go", "sql"], ["kafka"]]);
  assert.deepEqual(r.action, { role: "report", label: "Full report in draft" });
  // the web app's labels, not a second spelling
  const bands = read("shared/atsBands.js");
  for (const w of ["Strong match", "Moderate match", "Weak match", "Not enough signal"]) assert.ok(bands.includes(`"${w}"`), w);
  // a declined score is "not enough signal", never 0
  assert.equal(reportModel(atsFacts({ state: "ready", score: null, band: "not_enough_signal", scorable: false })).head, "ATS · Not enough signal");
});

test("J12 · no base résumé → \"Add your résumé in draft\" and no score; nothing usable → no block at all", () => {
  const r = reportModel(atsFacts({ state: "no_base_resume" }));
  assert.equal(r.head, undefined);
  assert.deepEqual(r.action, { role: "add-resume", label: "Add your résumé in draft" });
  assert.equal(reportModel(null), null);
  assert.equal(reportModel(atsFacts({ state: "weird" })), null);
  assert.equal(atsFacts({ state: "ready", score: 5, matched: [{ value: "a page value" }, "ok"] }).matched.join(), "ok", "words only");
});

test("J12 · the panel carries the report in every state but 'nojob', and its words carry no cost", () => {
  const ats = atsFacts({ state: "ready", score: 60, band: "moderate", matched: ["go"], missing: [] });
  assert.equal(resumePanelModel({ job: JOB, report: ats }).report.head, "ATS 60 · Moderate match");
  assert.equal(resumePanelModel({ job: JOB, view: { status: "generating", createdAt: 1 }, report: ats }).report.state, "ready");
  assert.equal(resumePanelModel({ report: ats }).report, null, "no job, no report");
  assert.doesNotMatch(modelWords(resumePanelModel({ job: JOB, report: ats })), /\$|token|claude|sonnet/i);
});

test("⛔ D99 · an unlinked tab's panel says 'Read this page now' and offers it as a button", () => {
  const m = resumePanelModel({});
  assert.equal(m.state, "nojob");
  assert.match(m.lines[0].text, /Read this page now/);
  assert.deepEqual(m.actions.map(a => a.role), ["read"]);
  assert.doesNotMatch(m.lines[0].text, /in the draft popup/, "not sent somewhere else");
});

test("⛔ J12 · the popup's score button: signed in → the on-page panel; the free checker only when signed out", () => {
  const src = read("extension/popup.js");
  const fn = src.slice(at(src, "async function openAtsScore()"), at(src, "// ─── More → the options page"));
  const panel = at(fn, "type: 'RESUME_PANEL_OPEN'"), checker = at(fn, "type: 'OPEN_ATS_SCORE'");
  assert.ok(at(fn, "if (signedIn) {") < panel && panel < checker, "the signed-in branch comes first and returns");
  assert.match(fn.slice(at(fn, "if (signedIn) {"), checker), /return;\s*\}/);
  assert.match(src, /signedIn = !!identity\?\.authenticated;/);
});

test("⛔ J12 · the panel's read and report handlers: a trusted click from the page's tab only", () => {
  const src = read("extension/resumePanel.js");
  const readH = src.slice(at(src, "RESUME_READ_PAGE: async"), at(src, "RESUME_OPEN_REPORT: async"));
  assert.match(readH, /if \(msg\?\.trigger !== 'click'\) return refuse/);
  assert.match(readH, /const tab = tabOf\(sender\);\s*if \(!tab\) return refuse/);
  // the click handler sits below the isTrusted gate
  // ⭐ T17: one click handler for both of the dock's views (ATS and Résumé); Esc and the window are the dock's
  const click = src.slice(at(src, "const onClick = (r) => async (ev) =>"), at(src, "host.__draftCleanup = cleanup;"));
  assert.ok(at(click, "if (!ev.isTrusted) return;") < at(click, "role === 'read'"));
});

const chrome = await findChrome();
for (const theme of ["light", "dark"]) {
  test(`⛔ J12 walk (${theme}): the report at once, "Add your résumé", "Read this page now" — in a real Chrome`, { skip: chrome.skip || false, timeout: 300000 }, async () => {
    const lines = [];
    const r = await runScenario("atsOnPage", { theme, log: (l) => lines.push(l) });
    if (r.skipped) return;
    assert.equal(r.failures, 0, lines.filter(l => l.startsWith("FAIL")).join("\n"));
  });
}
