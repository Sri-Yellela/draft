// T30 (owner, 10-19) · THE ACCEPTANCE — a budget the tests can count, for every view the dock shows.
//
//   (a) beyond field labels and values, ≤ 40 visible characters in the dock's body (tooltips and popups excluded)
//   (d) every control has an accessible name and a tooltip
//   (e) the closed dock is one square with no text — test/t28Launcher.test.js
//   (f) one popup at a time; a toast dismisses itself — test/t27Popups.test.js
//   (g) every setting reachable from the settings page and its deep link — test/t29SettingsPage.test.js
//   (b) (c) the Fill view's colours and its one divider — test/t26DockSurface.test.js
//   (h) two themes × shape cues on / off, here; four themes for the frame and the Fill view in t26
//   (i) the behaviour is unchanged — the J9 full pass and every walk, green on this tree
//
// This file counts (a) and (d) for the views t26 does not: the Copy sheet, the Résumé tab and the ATS tab — the real
// renderers, the real dock.js, in headless Chrome. It SKIPS, saying why, with no Chrome.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import { findChrome } from "../test-support/extensionBrowser.mjs";
import { renderCopySheetPanel } from "../extension/copy-sheet-panel.js";
import { renderResumePanel, resumePanelModel } from "../extension/resumePanel.js";
import { C_LIGHT, C_DARK } from "../extension/tokens.js";

const DOCK = fs.readFileSync("extension/dock.js", "utf8");
const LAYER = fs.readFileSync("extension/popup-layer.js", "utf8");
const chrome = await findChrome();
const SKIP = chrome.skip || false;
const STUB = `window.chrome = { runtime: { lastError: null, sendMessage(m, cb) { cb && cb({ ok: true }); } } };`;

const SHEET = { job: { title: "Software Engineer", company: "Zoom" }, source: "packet", unanswered: [{ label: "Phone Number" }], rows: [
  { label: "First Name", value: "Ada", provenance: "field_map_exact" },
  { label: "Are you legally authorized to work here?", value: "Yes", eligibility: true, provenance: "saved_answer", source: "you_acknowledged", acknowledgedAt: "2026-10-12T10:00:00Z" },
  { label: "Address Line 1", value: "1 Example Way", provenance: "saved_answer", source: "you_typed", acknowledgedAt: "2026-10-12T10:00:00Z" }] };
const JOB = { jobId: "j1", title: "Software Engineer", company: "Zoom" };
const MODELS = {
  ready: resumePanelModel({ job: JOB, view: { id: "erg_00000000aaaaaaaa", status: "ready", score: { before: 62, after: 81 }, guard: { passed: true },
    changes: { rewritten: 9, added: 2, jobTerms: 16 }, preview: { html: "<h1>Ada Example</h1><p>Software engineer.</p>" }, pdf: { fileName: "Ada_Example_Zoom_Software_Engineer.pdf" } } }),
  generating: resumePanelModel({ job: JOB, view: { id: "erg_00000000aaaaaaab", status: "generating", createdAt: Math.floor(Date.now() / 1000) } }),
  refused: resumePanelModel({ job: JOB, view: { id: "erg_00000000aaaaaaac", status: "refused", guard: { reasons: ["Claims a degree the profile does not list"] } } }),
  nojob: resumePanelModel({}),
};

/** In the page: the visible words of one view outside its labels and values, and its controls without a name or a tooltip. */
function countIn(hostId, keep) {
  const host = document.getElementById(hostId), root = host.shadowRoot;
  const shown = (e) => { for (let a = e; a && a !== root; a = a.parentElement) { const s = getComputedStyle(a);
    if (s.display === "none" || s.visibility === "hidden" || a.classList?.contains("sr")) return false; } return true; };
  const words = []; const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) { const p = n.parentElement, s = n.textContent.trim();
    if (!s || !p || p.closest("style") || !shown(p) || p.closest(keep)) continue; words.push(s); }
  const unnamed = [...root.querySelectorAll("button")].filter(b => shown(b) && (!(b.getAttribute("aria-label") || b.textContent.trim()) || !b.title)).map(b => b.dataset.role || b.outerHTML.slice(0, 60));
  return { words, unnamed };
}

test("T30 (a) (d) · the Copy sheet, the Résumé tab (four states) and the ATS tab in a REAL Chrome — ≤ 40 visible characters beyond labels and values, every control named; two themes × shape cues", { skip: SKIP, timeout: 120000 }, async (t) => {
  const server = http.createServer((_q, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end("<!doctype html><title>Acme</title><body><h1>Apply</h1>"); });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  t.after(() => server.close());
  const puppeteer = (await import("puppeteer-core")).default;
  const browser = await puppeteer.launch({ executablePath: chrome.path, headless: true, pipe: true, args: ["--no-first-run"] });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const theme = { light: C_LIGHT, dark: C_DARK };
  for (const os of ["light", "dark"]) for (const cues of [false, true]) {
    const open = async () => {
      await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "load" });
      await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: os }]);
      await page.evaluate(STUB);
      await page.addScriptTag({ content: DOCK });
      await page.addScriptTag({ content: LAYER });
    };
    const tag = `${os}${cues ? " · shape cues" : ""}`;
    await open();
    await page.evaluate(`(${renderCopySheetPanel.toString()})(${JSON.stringify(SHEET)}, ${JSON.stringify(theme)}, ${JSON.stringify({ theme, cues })})`);
    let g = await page.evaluate(countIn, "rm-copy-sheet-panel", ".k, .v");
    assert.ok(g.words.join("").length <= 40 && g.words.every(x => /^[\d+]+$/.test(x)), `${tag} · Copy sheet: ${JSON.stringify(g.words)}`);
    assert.deepEqual(g.unnamed, [], `${tag} · Copy sheet: a control without its name and tooltip`);
    for (const [state, model] of Object.entries(MODELS)) {
      await open();
      await page.evaluate(`(${renderResumePanel.toString()})(${JSON.stringify(model)}, ${JSON.stringify({ theme, dock: { theme, cues }, paper: { bg: C_LIGHT.SURFACE_SOLID, ink: C_LIGHT.INK }, tab: "resume", pollMs: 600000 })})`);
      g = await page.evaluate(countIn, "rm-resume-panel", '[data-role="preview"], [data-role="elapsed"]');
      assert.ok(g.words.join("").length <= 40 && g.words.every(x => /^[\d→–:]+$/.test(x)), `${tag} · Résumé (${state}): ${JSON.stringify(g.words)}`);
      assert.deepEqual(g.unnamed, [], `${tag} · Résumé (${state}): a control without its name and tooltip`);
      g = await page.evaluate(countIn, "rm-ats-panel", '[data-role="ats-card"], .marks, [data-role="ats-matched"], [data-role="ats-missing"]');
      assert.ok(g.words.join("").length <= 40, `${tag} · ATS (${state}): ${JSON.stringify(g.words)}`);
      assert.deepEqual(g.unnamed, [], `${tag} · ATS (${state}): a control without its name and tooltip`);
    }
  }
});
