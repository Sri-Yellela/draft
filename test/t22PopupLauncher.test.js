// ⭐ T22 (REVISED, owner 10-15) → ⭐ T31 (owner 10-25) · THE TOOLBAR POPUP IS RETIRED.
//
// T22 made the popup a launcher; T31 ("I want as much info moved away from the current panels as possible; info relayed
// when it is needed") retires it: the toolbar icon is the dock's toggle (extension/toolbarPress.js) and every control the
// launcher held lives where it is needed — each pinned here to its new place, and tested there:
//   Fill it → the dock's Fill tab (DOCK_FILL) · Capture it / the Draft button → the press's "Add this job to draft?"
//   (DOCK_ACT capture / draft — test/t31ToolbarPress.test.js) · Read this page → the press itself · Open dock → the press ·
//   Copy sheet → the dock's tab · Report form → the fill's "not recognised" popup (DOCK_ACT report) · More → the dock's
//   gear (OPEN_SETTINGS) · the account line / Sign in / Disconnect → Settings → Account · Unlink → the ATS tab
//   (DOCK_ACT unbind) · "Allow draft on <site>" → Settings → Permissions · the one-time card and "Always read here" →
//   Settings → automatic reading (options-auto.js onConsentAll / onAlwaysHere).
// Still pinned from T22: every action stays one shortcut or one right-click away; no résumé starts outside its two places.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";
import { CONTEXT_MENUS, MENU_SAVE_PAGE, MENU_FILL_PAGE, MENU_ATS_PAGE } from "../extension/formReport.js";
import { resumePanelModel } from "../extension/resumePanel.js";

const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const stripJs = (s) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

// ── 1 · the popup is gone, and every control it held has a home ───────────────────────────────────────────────────
test("⛔ T31: no toolbar popup — no default_popup, no popup file — and every control it held lives where it is needed", () => {
  const manifest = JSON.parse(read("extension/manifest.json"));
  assert.equal(manifest.action.default_popup, undefined, "the toolbar icon opens a popup again — it is the dock's toggle");
  for (const f of ["popup.html", "popup.js", "popup-auto.js", "popup-progress.js", "companion.js"]) assert.ok(!fs.existsSync(`extension/${f}`), `extension/${f} is back`);
  const bg = read("extension/background.js");
  assert.match(bg, /chrome\.action\.onClicked\.addListener\(\(tab\) => \{ void pressToolbar\(tab\)/, "the press");
  assert.match(bg, /message\.type === 'DOCK_FILL'[\s\S]{0,300}handleGatedHandoff\(sender\.tab\)/, "Fill it → the dock's Fill tab");
  const acts = bg.slice(at(bg, "const DOCK_ACTS = Object.freeze({"), at(bg, "if (msg?.type !== 'DOCK_ACT') return false;"));
  for (const [act, what] of [["capture", "Capture it"], ["draft", "the Draft button"], ["fill", "Fill, from a popup"], ["report", "Report form"],
    ["unbind", "Unlink this page"], ["'sign-in'", "Sign in"], ["'allow-site'", "Allow draft on <site>"], ["'always-here'", "Always read here"]])
    assert.match(acts, new RegExp(`\n  ${act}: async`), `${what} has no home`);
  assert.match(read("extension/dock.js"), /if \(role === 'settings'\) \{ if \(ev\.isTrusted\) void send\(\{ type: 'OPEN_SETTINGS'/, "More → the gear");
  assert.match(read("extension/resumePanel.js"), /ibtn\(\{ role: 'unbind', label: `Unlink this page from \$\{m\.job\}`, icon: 'unlink' \}\)/, "Unlink → the ATS tab");
  const opt = read("extension/options.html");
  for (const id of ["account", "permissions", "auto-read"]) assert.match(opt, new RegExp(`<section id="${id}"`), `Settings has no #${id}`);
  const oa = read("extension/options-auto.js");
  assert.match(oa, /export function onConsentAll\(api\) \{/, "the one-time card's one prompt");
  assert.match(oa, /export function onAlwaysHere\(api, here\) \{/, "Always read here");
});

// ── 2 · every action is still one shortcut or one right-click away ───────────────────────────────────────────────────────────────────
test("⛔ T22: every removed action is still reachable — Ctrl+Shift+K and Ctrl+Shift+Y, and the right-click menu", () => {
  const manifest = JSON.parse(read("extension/manifest.json"));
  assert.equal(manifest.commands["capture-job"].suggested_key.default, "Ctrl+Shift+K");
  assert.equal(manifest.commands["fill-gated-application"].suggested_key.default, "Ctrl+Shift+Y");
  const bg = stripJs(read("extension/background.js"));
  const onCommand = bg.slice(at(bg, "chrome.commands.onCommand.addListener"));
  assert.match(onCommand.slice(0, 400), /command === 'fill-gated-application'\) \{ void handleGatedHandoff\(\); return; \}/);
  assert.match(onCommand.slice(0, 700), /void captureActiveTab\(tab\)/);   // (D191 added the panel's shortcut above it)
  // the right-click menu: capture (it always was), fill and the score — created on install, routed to the same code
  assert.deepEqual(CONTEXT_MENUS.filter(m => m.contexts.includes("page")).map(m => [m.id, m.title]), [
    [MENU_SAVE_PAGE, "Save this page to draft"],
    [MENU_FILL_PAGE, "Fill this application with draft"],
    [MENU_ATS_PAGE, "Show draft's ATS report"],
    ["draft-ask", "Ask draft…"],   // ⭐ D191 (3): the extension's own panel — 46n: its chat is Tiny
  ]);
  const onClicked = bg.slice(at(bg, "chrome.contextMenus.onClicked.addListener"), at(bg, "async function saveLinkToDraft"));
  assert.match(onClicked, /MENU_SAVE_PAGE\) \{ void captureActiveTab\(tab\); return; \}/, "capture: the same captureActiveTab");
  assert.match(onClicked, /MENU_FILL_PAGE\) \{ void handleGatedHandoff\(tab\); return; \}/, "fill: the same chain as Fill it and Ctrl+Shift+Y");
  assert.match(onClicked, /MENU_ATS_PAGE\) void openDock\(tab, 'ats'\);/, "the score: the dock's ATS tab");
  // the toolbar press is a fifth way in: on a posting draft does not hold it asks, and Capture is the same capture
  assert.match(bg, /capture: async \(tab\) => \{ const r = await captureActiveTab\(tab\);/);
  // the dock's own Fill tab is a fourth way in, the same chain (DOCK_FILL → handleGatedHandoff(sender.tab))
  assert.match(bg, /message\.type === 'DOCK_FILL'[\s\S]{0,300}handleGatedHandoff\(sender\.tab\)/);
  // the free checker's page-text-in-a-URL path went with the score tile
  assert.doesNotMatch(bg, /OPEN_ATS_SCORE/);
});

// ── 3 · no résumé is started from the Résumé tab, or anywhere but its two places ───────────────────────────────────
// ⭐ 47a E2 (owner 11-21, moved on purpose: "generate the resume then and there"): the tab offers ONE start again — Tailor
// when none exists, Try again after a refusal / failure / cancel — and never Regenerate; the rest of the view is unchanged.
test("⛔ T22 → 47a E2: the dock's Résumé tab — Tailor / Try again only where nothing usable exists, never Regenerate; the review row only shows the tab", () => {
  const JOB = { jobId: "j1", title: "Software Engineer", company: "Zoom" };
  const ID = "erg_0123456789abcdef01234567";
  const states = [
    resumePanelModel({ job: JOB, allowance: { used: 0, limit: 10, remaining: 10 } }),
    resumePanelModel({ job: JOB, error: { error: "Résumé generation is unavailable right now.", code: "upstream" } }),
    ...["queued", "generating", "refused", "failed", "cancelled", "ready"].map(status => resumePanelModel({ job: JOB, view: { id: ID, status, job: JOB } })),
    resumePanelModel({ job: JOB, view: { id: ID, status: "ready", job: JOB, pdf: { attached: true, fileName: "a.pdf" } } }),
    resumePanelModel({ job: JOB, view: { id: ID, status: "ready", job: JOB }, attach: { outcome: "fallback", fileName: "a.pdf" } }),
  ];
  const STARTS = { none: "Tailor my résumé for this job", refused: "Try again", failed: "Try again", cancelled: "Try again" };
  for (const m of states) {
    const roles = (m.actions || []).map(a => a.role);
    if (STARTS[m.state]) assert.deepEqual((m.actions || []).filter(a => a.role === "generate").map(a => a.label), [STARTS[m.state]], m.state);
    else assert.ok(!roles.some(r => /generate/.test(r)), `${m.state}: ${roles.join(", ")}`);
    assert.ok(!(m.actions || []).some(a => /Regenerate/.test(a.label)), `${m.state}: ${JSON.stringify(m.actions)}`);
  }
  assert.equal(states[0].state, "none");
  assert.deepEqual(states[0].lines.map(l => l.text), ["No résumé has been made for this job yet."]);
  // what the view still does: attach, download, edit, cancel a running one
  assert.deepEqual(states.find(m => m.state === "ready").actions.map(a => a.role), ["attach", "download", "edit"]);
  assert.deepEqual(states.find(m => m.state === "generating").actions.map(a => a.role), ["cancel"]);
  // the view's code sends no RESUME_GENERATE; the ONE handler stays for the two places T24 / T18 wire
  const src = read("extension/resumePanel.js");
  const view = stripJs(src.slice(at(src, "export function renderResumePanel("), at(src, "// ── the injected attach")));
  assert.doesNotMatch(view, /role === 'regenerate'/);
  assert.equal((view.match(/RESUME_GENERATE/g) || []).length, 1, "the tab's one start (47a E2)");
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
