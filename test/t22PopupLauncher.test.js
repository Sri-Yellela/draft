// ⭐ T22 (REVISED, owner 10-15) · THE POPUP IS A LAUNCHER, NOT A CONTROL PANEL — field report problem (f).
//
// "The older buttons (capture, fill, score, /d) serve no purpose now — remove them", then, revised: the Draft button
// (/d) STAYS, and the résumé triggers go. The popup keeps: the account line · the job card with its ATS · ONE main action
// (Fill it; Capture it when the page is not a job of the user's; Read this page now when nothing is known) · the Draft
// button · Open dock · Copy sheet · Report form · More · Unlink this page. Removed: the capture, fill and score tiles, the
// stand-alone "Résumé for this job", and every other résumé-generation trigger outside the two places (the Draft button
// and the résumé field's row — T24 / T18, not built here). What this pins:
//   1. what the popup keeps and what it no longer has
//   2. NO TWO CONTROLS DO THE SAME THING — every control is pressed in a sandbox and its effect recorded
//   3. every removed action is still reachable: Ctrl+Shift+K, Ctrl+Shift+Y, and the right-click menu
//   4. the popup opens the dock and closes (and stays, saying why, when it cannot)
//   5. no résumé is started from the popup, the dock's Résumé tab, or the review panel's résumé row
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { at } from "../test-support/sourceAnchors.js";
import { CONTEXT_MENUS, MENU_SAVE_PAGE, MENU_FILL_PAGE, MENU_ATS_PAGE } from "../extension/formReport.js";
import { resumePanelModel } from "../extension/resumePanel.js";

const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const stripJs = (s) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const html = read("extension/popup.html");
const htmlCode = html.replace(/<!--[\s\S]*?-->/g, "");
const ids = [...htmlCode.matchAll(/<button\b[^>]*\bid="([^"]+)"/g)].map(m => m[1]);

// ── 1 · kept, and gone ────────────────────────────────────────────────────────────────────────────────────────────
test("⛔ T22: the popup keeps the account line, the job card with its ATS, ONE main action, the Draft button, Open dock, Copy sheet, Report form, More, Unlink", () => {
  for (const [sel, what] of [
    ['id="identity"', "the account line"], ['id="job-preview"', "the job card"], ['id="preview-score"', "…with its ATS number"],
    ['id="btn-fill-primary"', "Fill it"], ['id="btn-capture-primary"', "Capture it"], ['id="btn-read-page"', "Read this page now"],
    ['id="btn-resume"', "the Draft button (/d)"], ['id="btn-open-dock"', "Open dock"], ['id="btn-copy-sheet"', "Copy sheet"],
    ['id="btn-report-form"', "Report form"], ['id="btn-settings"', "More"], ['id="btn-unbind"', "Unlink this page"],
  ]) assert.ok(htmlCode.includes(sel), `the popup lost ${what}`);
  assert.match(htmlCode, /<button class="sq sq--primary" id="btn-resume" aria-label="Draft this job" title="Draft this job — the board's Draft, with its résumé queued">\s*<span class="draft-d" aria-hidden="true">\/d<\/span>/,
    "the Draft button keeps the mark on the orange (D1)");
});

test("⛔ T22: the capture, fill and score tiles are gone — and so are Résumé for this job, the second Prepare, the second Score and the second Read again", () => {
  for (const id of ["btn-capture-job", "btn-fill", "btn-ats", "btn-resume-onpage", "btn-score-primary", "btn-prepare", "btn-ats-again"]) {
    assert.ok(!ids.includes(id), `#${id} is still in the popup`);
    assert.doesNotMatch(read("extension/popup.js"), new RegExp(`getElementById\\('${id}'\\)`), `popup.js still wires #${id}`);
  }
  assert.doesNotMatch(htmlCode, /class="squares"|sq-cap/, "the tile row");
  assert.doesNotMatch(htmlCode, /popup-resume\.js/);
  assert.ok(!fs.existsSync("extension/popup-resume.js"), "nothing imports it any more — a dead file goes");
  assert.doesNotMatch(htmlCode, /Résumé for this job/);
});

// ── 2 · no two controls do the same thing ─────────────────────────────────────────────────────────────────────────
/** popup.js (with config.js and companion.js before it, as popup.html loads them) in a sandbox; every effect recorded. */
function popupSandbox(replies = {}) {
  const els = {};
  const effects = [];
  const el = (id) => (els[id] ||= { id, style: {}, textContent: "", className: "", hidden: false, disabled: false, title: "", dataset: {}, children: [],
    listeners: {}, addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }, append(...x) { this.children.push(...x); }, setAttribute() {},
    set innerHTML(v) { this.children = []; }, get innerHTML() { return ""; }, set onclick(f) { this.listeners.click = f ? [f] : []; } });
  const document = { getElementById: el, createElement: (t) => el(`<${t}>${Math.random()}`), addEventListener() {}, dispatchEvent() {} };
  let closed = 0;
  const chrome = {
    runtime: {
      sendMessage: async (m) => { effects.push(`message:${m.type}${m.phase ? `:${m.phase}` : ""}${m.tab ? `:${m.tab}` : ""}`); return replies[m.type] ?? null; },
      openOptionsPage() { effects.push("options"); },
    },
    tabs: { query: async () => [{ id: 7, url: "https://zoom.wd5.myworkdayjobs.com/x" }], create(o) { effects.push(`tab:${new URL(o.url).pathname}`); } },
    permissions: { request: async (o) => { effects.push(`permission:${(o.origins || []).join(",")}`); return true; } },
    storage: { local: { get: async () => ({}) } },
    scripting: { executeScript: async () => { effects.push("page-read"); return [{ result: "" }]; } },
  };
  const window = { close() { closed++; } };
  const sandbox = { document, chrome, window, setTimeout: () => 0, clearTimeout() {}, console, URL, Promise, Date, Event: class { constructor(t) { this.type = t; } }, navigator: {} };
  vm.createContext(sandbox);
  for (const f of ["extension/config.js", "extension/companion.js", "extension/popup.js"]) vm.runInContext(read(f), sandbox);
  return { els, effects, closed: () => closed };
}
const press = async (s, id) => {
  const before = s.effects.length;
  for (const f of s.els[id]?.listeners?.click || []) await f({ preventDefault() {} });
  await new Promise(r => setImmediate(r));
  return s.effects.slice(before);
};

test("⛔ T22: NO TWO CONTROLS DO THE SAME THING — each of the popup's buttons, pressed, has an effect no other has", async () => {
  const s = popupSandbox({ PROBE_AUTH: { authenticated: true, username: "ada" }, DOCK_OPEN: { ok: true }, COPY_SHEET_PANEL: { ok: true },
    REPORT_FORM: { ok: true, host: "x.test", labelCount: 3 }, FILL_ACTIVE_TAB: { ok: false }, CAPTURE_ACTIVE_TAB: { success: false, message: "x" } });
  await new Promise(r => setImmediate(r));
  // a frame permission the fill asked for, so "Allow draft on Greenhouse" has something to do
  s.effects.length = 0;
  const signature = {};
  const wired = ids.filter(id => (s.els[id]?.listeners?.click || []).length);
  for (const id of ids) {
    if (id === "btn-allow-frame") continue;   // pressed below, once a fill has named the frame
    const eff = await press(s, id);
    if (eff.length) signature[id] = eff.join(" → ");
  }
  // every press that did something did something different
  const seen = new Map();
  for (const [id, sig] of Object.entries(signature)) {
    assert.ok(!seen.has(sig), `#${id} does the same thing as #${seen.get(sig)}: ${sig}`);
    seen.set(sig, id);
  }
  // and the expected ones, by name
  assert.equal(signature["btn-fill-primary"], "message:FILL_ACTIVE_TAB");
  assert.equal(signature["btn-capture-primary"], "message:CAPTURE_ACTIVE_TAB");
  assert.equal(signature["btn-read-page"], "message:PREVIEW_ACTIVE_TAB → message:POPUP_CONTEXT");
  // ⭐ T24: the Draft button drafts (INTENT_DRAFT); on a page with no job it opens draft, as it did before
  assert.equal(signature["btn-resume"], "message:INTENT_DRAFT → message:OPEN_RESUME_BUILDER");
  assert.equal(signature["btn-open-dock"], "message:DOCK_OPEN");
  assert.equal(signature["btn-copy-sheet"], "message:COPY_SHEET_PANEL");
  assert.equal(signature["btn-settings"], "options");
  assert.equal(signature["btn-unbind"], "message:UNBIND_TAB");
  assert.ok(wired.length >= 12, `${wired.length} wired controls`);
  // ⛔ the popup reads nothing of the page with any control (the score tile's innerText read is gone)
  assert.ok(!Object.values(signature).some(sig => /page-read/.test(sig)), JSON.stringify(signature));
  // ⛔ and starts no résumé
  assert.ok(!Object.values(signature).some(sig => /RESUME_(GENERATE|PANEL_OPEN)/.test(sig)), JSON.stringify(signature));
});

// ── 3 · every removed action is still reachable ───────────────────────────────────────────────────────────────────
test("⛔ T22: every removed action is still reachable — Ctrl+Shift+K and Ctrl+Shift+Y, and the right-click menu", () => {
  const manifest = JSON.parse(read("extension/manifest.json"));
  assert.equal(manifest.commands["capture-job"].suggested_key.default, "Ctrl+Shift+K");
  assert.equal(manifest.commands["fill-gated-application"].suggested_key.default, "Ctrl+Shift+Y");
  const bg = stripJs(read("extension/background.js"));
  const onCommand = bg.slice(at(bg, "chrome.commands.onCommand.addListener"));
  assert.match(onCommand.slice(0, 400), /command === 'fill-gated-application'\) \{ void handleGatedHandoff\(\); return; \}/);
  assert.match(onCommand.slice(0, 400), /void captureActiveTab\(tab\)/);
  // the right-click menu: capture (it always was), fill and the score — created on install, routed to the same code
  assert.deepEqual(CONTEXT_MENUS.filter(m => m.contexts.includes("page")).map(m => [m.id, m.title]), [
    [MENU_SAVE_PAGE, "Save this page to draft"],
    [MENU_FILL_PAGE, "Fill this application with draft"],
    [MENU_ATS_PAGE, "Show draft's ATS report"],
  ]);
  const onClicked = bg.slice(at(bg, "chrome.contextMenus.onClicked.addListener"), at(bg, "async function saveLinkToDraft"));
  assert.match(onClicked, /MENU_SAVE_PAGE\) \{ void captureActiveTab\(tab\); return; \}/, "capture: the same captureActiveTab");
  assert.match(onClicked, /MENU_FILL_PAGE\) \{ void handleGatedHandoff\(tab\); return; \}/, "fill: the same chain as Fill it and Ctrl+Shift+Y");
  assert.match(onClicked, /MENU_ATS_PAGE\) void openDock\(tab, 'ats'\);/, "the score: the dock's ATS tab");
  // the shortcut is shown where the removed tile showed it: on the main actions
  assert.match(htmlCode, /id="btn-fill-primary"[^>]*>Fill it <kbd>⌃⇧Y<\/kbd>/);
  assert.match(htmlCode, /id="btn-capture-primary">Capture it <kbd>⌃⇧K<\/kbd>/);
  // the dock's own Fill tab is a fourth way in, the same chain (DOCK_FILL → handleGatedHandoff(sender.tab))
  assert.match(bg, /message\.type === 'DOCK_FILL'[\s\S]{0,300}handleGatedHandoff\(sender\.tab\)/);
  // the free checker's page-text-in-a-URL path went with the score tile
  assert.doesNotMatch(bg, /OPEN_ATS_SCORE/);
});

// ── 4 · the popup opens the dock and closes ───────────────────────────────────────────────────────────────────────
test("⛔ T22: Open dock opens the dock on the page and closes the popup — and when it cannot, the popup stays and says why", async () => {
  const ok = popupSandbox({ PROBE_AUTH: { authenticated: true, username: "ada" }, DOCK_OPEN: { ok: true, tab: "ats" } });
  await new Promise(r => setImmediate(r));
  assert.deepEqual(await press(ok, "btn-open-dock"), ["message:DOCK_OPEN"]);
  assert.equal(ok.closed(), 1, "the popup closes once the dock is open");
  const no = popupSandbox({ PROBE_AUTH: { authenticated: true, username: "ada" }, DOCK_OPEN: { ok: false, message: "draft can't open its panel on this page." } });
  await new Promise(r => setImmediate(r));
  await press(no, "btn-open-dock");
  assert.equal(no.closed(), 0, "it stays open when the dock could not open");
  assert.equal(no.els["status"].textContent, "draft can't open its panel on this page.");
  // the service worker draws the dock on the active tab's TOP frame and the tab it was asked for (or ATS when empty)
  const bg = read("extension/background.js");
  assert.match(bg, /if \(message\.type === 'DOCK_OPEN'\) \{\s*chrome\.tabs\.query\(\{ active: true, currentWindow: true \}\)\s*\.then\(\(\[tab\]\) => openDock\(tab, message\.tab\)\)/);
  assert.match(bg, /r = await drawInDock\(tab\.id, openDockInPage, \[await dockMeta\(tab\), want\]\)/);
  // Copy sheet opens the dock on its Copy sheet tab, and closes the popup the same way
  assert.match(read("extension/popup.js"), /const panel = await chrome\.runtime\.sendMessage\(\{ type: 'COPY_SHEET_PANEL' \}\)\.catch\(\(\) => null\);\n\s+if \(panel\?\.ok\) \{ window\.close\(\); return; \}/);
});

// ── 5 · no résumé is started from the popup, the Résumé tab, or the review row ───────────────────────────────────
test("⛔ T22: the dock's Résumé tab is a VIEW — no Generate, Try again or Regenerate in any state; the review row only shows the tab", () => {
  const JOB = { jobId: "j1", title: "Software Engineer", company: "Zoom" };
  const ID = "erg_0123456789abcdef01234567";
  const states = [
    resumePanelModel({ job: JOB, allowance: { used: 0, limit: 10, remaining: 10 } }),
    resumePanelModel({ job: JOB, error: { error: "Résumé generation is unavailable right now.", code: "upstream" } }),
    ...["queued", "generating", "refused", "failed", "cancelled", "ready"].map(status => resumePanelModel({ job: JOB, view: { id: ID, status, job: JOB } })),
    resumePanelModel({ job: JOB, view: { id: ID, status: "ready", job: JOB, pdf: { attached: true, fileName: "a.pdf" } } }),
    resumePanelModel({ job: JOB, view: { id: ID, status: "ready", job: JOB }, attach: { outcome: "fallback", fileName: "a.pdf" } }),
  ];
  for (const m of states) {
    const roles = (m.actions || []).map(a => a.role);
    assert.ok(!roles.some(r => /generate/.test(r)), `${m.state}: ${roles.join(", ")}`);
    assert.ok(!(m.actions || []).some(a => /Generate|Try again|Regenerate/.test(a.label)), `${m.state}: ${JSON.stringify(m.actions)}`);
  }
  assert.equal(states[0].state, "none");
  assert.deepEqual(states[0].lines.map(l => l.text), ["No résumé has been made for this job yet."]);
  // what the view still does: attach, download, edit, cancel a running one
  assert.deepEqual(states.find(m => m.state === "ready").actions.map(a => a.role), ["attach", "download", "edit"]);
  assert.deepEqual(states.find(m => m.state === "generating").actions.map(a => a.role), ["cancel"]);
  // the view's code sends no RESUME_GENERATE; the ONE handler stays for the two places T24 / T18 wire
  const src = read("extension/resumePanel.js");
  const view = stripJs(src.slice(at(src, "export function renderResumePanel("), at(src, "// ── the injected attach")));
  assert.doesNotMatch(view, /RESUME_GENERATE|role === 'generate'|role === 'regenerate'/);
  assert.match(src, /RESUME_GENERATE: async \(msg, sender\) => \{/);
  // ⭐ T18 wired the SECOND of the two places: the review panel's résumé row ("Generate and attach") — and nothing else
  for (const f of fs.readdirSync("extension").filter(f => f.endsWith(".js") && f !== "resumePanel.js" && f !== "review-overlay.js")) {
    assert.doesNotMatch(stripJs(read(`extension/${f}`)), /RESUME_GENERATE/, `${f} starts a résumé`);
  }
  const ro = read("extension/review-overlay.js");
  const roCode = stripJs(ro);
  assert.equal((roCode.match(/RESUME_GENERATE/g) || []).length, 1, "the row's Generate is the review panel's only start");
  assert.ok(at(ro, "type: 'RESUME_GENERATE', trigger: 'click'") > at(ro, "if (role === 'generate') {")
    && at(ro, "if (role === 'generate') {") > at(ro, "if (!ev.isTrusted) return;"), "…a trusted click on the row's own button");
  // the row still shows the tab when there is nothing to choose from (or one is being made); it starts nothing
  // ⭐ T26: an icon control — its words are its aria-label and tooltip
  assert.match(ro, /ib\('resume', 'resume', 'See the Résumé tab'\)/);
  assert.match(ro, /if \(role === 'resume'\) \{ void send\(\{ type: 'RESUME_PANEL_OPEN', tab: 'resume' \}\); return; \}/);
  assert.doesNotMatch(ro, /Make a résumé for this job/);
});
