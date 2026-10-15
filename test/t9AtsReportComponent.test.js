// ⭐ T9 · THE ATS PANEL IS ONE COMPONENT, EVERYWHERE (owner 10-14: "the same ATS panel we use on the website — same
// design and everything").
//
// `<draft-ats-report>` (shared/atsReportElement.js) is built ONCE and drawn by the web app (a thin React wrapper,
// client/src/components/AtsReport.jsx) and the extension (its popup — the element — and its on-page panel —
// mountAtsReport into the panel's shadow root), from THE SAME JSON: the scorer's own report, which the web app's ATS
// panel gets from POST /api/jobs/:id/keywords and the extension's routes now pass through (routes/extensionJob.js).
//
// What this pins:
//   1. one component — the generated token file and the extension's bundle are current; the bundle is that code
//   2. the same report renders the same words and numbers on both surfaces (the web path and the extension's data path)
//   3. theme parity — the component's token values ARE the registry's, all four themes; shape cues travel with it
//   4. job terms are rendered as TEXT, never markup; the component makes no request and runs no parsed HTML
//   5. keyboard and screen reader: claim boxes are real buttons with aria-pressed, folds are details/summary
//   6. the consumers: the wrapper is thin, the popup and the panel load the bundle; nothing extension-only
//   7. in a REAL Chrome: the popup (the real unpacked extension page, its CSS and its CSP) and a web-app host page draw
//      the same pixels, per theme, cues off and on; no request; the keyboard claims a term (skips with its reason
//      when this machine has no Chrome)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import vm from "node:vm";
import { miniDocument } from "../test-support/miniDom.mjs";
import { at } from "../test-support/sourceAnchors.js";
import { buildAtsReport, ATS_CLAIM_EVENT, ATS_TERM_EVENT } from "../shared/atsReportElement.js";
import { cleanReport, fromDeckReport } from "../shared/atsReportModel.js";
import { ATS_REPORT_CSS, atsHostCss } from "../shared/atsReportStyles.js";
import { ATS_REPORT_THEMES, ATS_REPORT_DEFAULT_THEMES } from "../shared/atsReportTokens.js";
import { staleAtsReport, transformModule, BUNDLE_MODULES } from "../scripts/buildAtsReport.mjs";
import { reportOf, boardJobForExtension } from "../routes/extensionJob.js";
import { atsFacts } from "../extension/boardJob.js";
import { reportModel } from "../extension/resumePanel.js";
import { collectRequiredFiles } from "../scripts/buildExtension.mjs";
import { CROSS_PRODUCT } from "../client/src/modules.manifest.js";

const { THEME_LIST } = await import("../client/src/themes/index.js");
const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const stripJs = (s) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

// A SYNTHETIC report in the scorer's own shape — every section the card draws.
const RAW = Object.freeze({
  source: "local_ats_v5", score: 61.4, scorable: true,
  tier1_matched: ["Go", "PostgreSQL"], tier1_missing: ["Kafka", "<img src=x onerror=alert(1)>"],
  competencies_matched: ["ownership"], competencies_missing: ["mentoring"],
  action_verbs_matched: ["Shipped"], action_verbs_missing: ["Scaled"], action_verbs_generic: ["Managed", "Partnered"],
  decline_reasons: [], hard_constraint_misses: ["Security clearance"],
  experience: { summary: "Résumé experience (6 years) meets 4+ year requirement.", requiredYears: 4, candidateYears: 6, fit: true },
  seniority_cap: { applied: false }, resume_depth: null, internal_debug: { not: "for the card" },
});

/** The bundle, run the way the popup runs it (a classic script), in a sandbox: its api. */
function bundleApi() {
  const sandbox = { CustomEvent: globalThis.CustomEvent, queueMicrotask, console };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(read("extension/atsReport.js"), sandbox, { filename: "extension/atsReport.js" });
  return sandbox.__draftAtsReport;
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// 1 · ONE COMPONENT
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test("⛔ T9 · the generated token file and the extension's bundle are current — the bundle IS the shared code", async () => {
  assert.deepEqual(await staleAtsReport(), [], "run: node scripts/buildAtsReport.mjs");
  const bundle = read("extension/atsReport.js");
  // A classic script (popup <script src>, executeScript files) that is also a valid module: no import, no export.
  assert.doesNotMatch(bundle, /^\s*(import|export)\b/m);
  for (const m of BUNDLE_MODULES) assert.ok(bundle.includes(`// ── shared/${m} `), `${m} is not in the bundle`);
  // The bundler is strict: a form it does not understand is an error, never a silent mis-bundle.
  assert.throws(() => transformModule("x.js", 'import * as all from "./atsBands.js";\n', new Set(["atsBands.js"])), /does not understand/);
  assert.throws(() => transformModule("x.js", "export default 1;\n", new Set()), /does not understand/);
  assert.throws(() => transformModule("x.js", 'import { a } from "./later.js";\n', new Set()), /not bundled before it/);
  // The api it exposes is the module's.
  const api = bundleApi();
  for (const k of ["buildAtsReport", "mountAtsReport", "defineAtsReportElement", "cleanReport", "reportAsks"]) assert.equal(typeof api[k], "function", k);
});

test("⛔ T9 · the manifest logs the cross-product component, and every path it names is real and used as it says", () => {
  assert.equal(CROSS_PRODUCT.length, 1);
  const [c] = CROSS_PRODUCT;
  for (const f of [c.module, ...c.parts, c.bundle, ...c.extension, `client/src/${c.web}`]) assert.ok(fs.existsSync(f), `${f} is gone`);
  assert.match(read(`client/src/${c.web}`), /from "\.\.\/\.\.\/\.\.\/shared\/atsReportElement\.js"/, "the web wrapper imports the module");
  for (const f of c.extension) assert.match(read(f), /atsReport\.js|ats-report-card/, `${f} does not load the bundle`);
  // The extension's build ships it: the popup names it, and boardJob.js imports it.
  const manifest = JSON.parse(read("extension/manifest.json"));
  assert.ok(collectRequiredFiles(manifest).includes("atsReport.js"), "the zip would ship without the ATS component");
});

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// 2 · THE SAME REPORT, THE SAME WORDS AND NUMBERS, ON BOTH SURFACES
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test("⭐ T9 · the web app's path and the extension's data path draw the SAME card from the same JSON", () => {
  // The web app: ATSPanel hands the /keywords JSON to the wrapper; the element cleans it and draws it.
  const webCard = buildAtsReport(miniDocument(), cleanReport(RAW));
  const web = webCard.outerHTML;
  // The extension: the server passes the scorer's report through (reportOf), it crosses the wire as JSON, the
  // service worker keeps it to the component's named fields (atsFacts), the panel's model carries it (reportModel),
  // and the BUNDLE — not the module — draws it.
  const wire = JSON.parse(JSON.stringify(reportOf({ score: 61.4, band: "moderate", scorable: true, matched: RAW.tier1_matched, missing: RAW.tier1_missing, report: RAW })));
  const model = reportModel(atsFacts(wire));
  assert.ok(model.report, "the panel's model lost the report");
  const ext = bundleApi().buildAtsReport(miniDocument(), model.report).outerHTML;
  assert.equal(ext, web, "the extension drew a different card from the same report");
  // The words and the numbers, read off the card itself.
  for (const words of ["You cover 4 of the 8 things this posting asks for.", "61", "Kafka", "mentoring", "Scaled", "Managed",
                       "Already yours", "Generic — not a gap", "Required by this posting, not on your profile: Security clearance", "✓ Met"]) {
    assert.ok(webCard.textContent.includes(words), `the card does not say: ${words}`);
  }
  assert.doesNotMatch(web, /internal_debug|for the card/, "a field the card does not read reached it");
});

test("⭐ T9 · no extension-only field: the extension's `ats.report` is the scorer's report itself, passed through", () => {
  assert.deepEqual(reportOf({ score: 1, band: "weak", report: RAW }).report, RAW, "the route reshaped the report");
  assert.deepEqual(Object.keys(reportOf({ score: 1, band: "weak" })).sort(), ["band", "matched", "missing", "scorable", "score", "state"],
    "no report → the summary exactly as before");
  // The approval screen's stored copy stays the summary: only the extension's routes ask for the report.
  const server = read("server.js");
  assert.match(server, /function scoreBaseResumeForApply\(userId, jobId, \{ withReport = false \} = \{\}\)/);
  assert.match(server, /\.\.\.\(withReport \? \{ report \} : \{\}\),/);
  assert.match(read("routes/apply.js"), /scoreBaseResumeForApply\(userId, jobId\) : null;/, "the apply worker started storing the full report");
});

test("⭐ T9 · the deck's frozen report and a declined report draw through the same component", () => {
  const declined = buildAtsReport(miniDocument(), cleanReport({ source: "local_ats_v5", score: null, decline_reasons: ["Too little text to judge."] }));
  assert.match(declined.outerHTML, /data-unknown="true">Not enough signal<\/div><span class="ats-sum__cap">no judgement<\/span>/);
  assert.doesNotMatch(declined.outerHTML, /data-ats-score/, "a declined report printed a number");
  const deck = buildAtsReport(miniDocument(), cleanReport(fromDeckReport({ skillsMatched: ["Go"], skillsMissing: ["Rust"], verbsGeneric: [] })), { band: "moderate" });
  assert.match(deck.outerHTML, /Moderate match/);
});

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// 3 · THEME PARITY
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test("⭐ T9 · the component's token values ARE the theme registry's — all four themes — and no theme → the OS's pair", () => {
  assert.deepEqual(Object.keys(ATS_REPORT_THEMES).sort(), THEME_LIST.map((t) => t.id).sort(), "a theme is missing from the component");
  for (const t of THEME_LIST) {
    const want = Object.fromEntries(Object.entries(t.tokens).filter(([k]) => k.startsWith("PAIR_") || k === "BAND_UNKNOWN" || k === "BAND_UNKNOWN_EDGE"));
    assert.deepEqual({ ...ATS_REPORT_THEMES[t.id].tokens }, want, `${t.id}: the component's values drifted from the registry`);
    assert.ok(atsHostCss().includes(`:host([theme="${t.id}"]) {`), `${t.id} has no :host block`);
  }
  assert.deepEqual({ ...ATS_REPORT_DEFAULT_THEMES }, { light: "paper-light", dark: "charcoal-dark" });
  assert.match(atsHostCss(), /@media \(prefers-color-scheme: dark\) \{ :host\(:not\(\[theme\]\)\) \{/);
  // Every var() the design reads is one the host block sets (or the font stacks it sets).
  const set = new Set([...atsHostCss().matchAll(/(--[a-z0-9-]+):/g)].map((m) => m[1]));
  for (const v of new Set([...ATS_REPORT_CSS.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]))) assert.ok(set.has(v), `${v} is read but never set on :host`);
  // The web app names the live theme and hands over the shape cues; the extension's own stylesheet still carries none
  // of the pair's tokens (the pair travels only inside the component's shadow root).
  const wrapper = read("client/src/components/AtsReport.jsx");
  assert.match(wrapper, /theme: ACTIVE_THEME\.id, \.\.\.\(CUES \? \{ cues: "shape" \} : \{\}\)/);
  assert.doesNotMatch(read("extension/tokens.css"), /--c-pair-/);
});

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// 4 · TEXT, NEVER MARKUP · NO REQUEST
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test("⛔ T9 · a job term that is markup prints as characters — no element is made from the posting's words", () => {
  const card = buildAtsReport(miniDocument(), cleanReport(RAW));
  assert.equal(card.querySelectorAll("img").length, 0, "a term became an element");
  assert.ok(card.outerHTML.includes("&lt;img src=x onerror=alert(1)&gt;"), "the term is not shown as text");
  // The renderer never parses HTML: no innerHTML / insertAdjacentHTML / DOMParser anywhere in the component.
  for (const f of ["shared/atsReportElement.js", "shared/atsReportModel.js", "shared/atsReportStyles.js"]) {
    assert.doesNotMatch(stripJs(read(f)), /innerHTML|outerHTML|insertAdjacentHTML|DOMParser|document\.write/, `${f} parses markup`);
  }
  // Objects in a term list are dropped, never stringified into the card.
  assert.deepEqual(cleanReport({ tier1_missing: [{ html: "<b>x</b>" }, "Go"] }).tier1_missing, ["Go"]);
});

test("⛔ T9 · the component makes no request and loads nothing — no fetch, no XHR, no socket, no image, no import()", () => {
  for (const f of ["shared/atsReportElement.js", "shared/atsReportModel.js", "shared/atsReportStyles.js", "shared/atsReportTokens.js", "extension/atsReport.js"]) {
    const code = stripJs(read(f));
    assert.doesNotMatch(code, /\bfetch\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|new Image\b|import\(|\beval\(|new Function\(|chrome\.|url\(/, `${f} reaches out`);
  }
});

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// 5 · KEYBOARD AND SCREEN READER · CLAIMS ARE THE HOST'S
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test("⭐ T9 · read-only without claims (the extension, the public tool); real buttons with aria-pressed with them", () => {
  const ro = buildAtsReport(miniDocument(), cleanReport(RAW));
  assert.equal(ro.querySelectorAll("button").length, 0, "a read-only card offers a control");
  assert.equal(ro.querySelectorAll("[data-claim-note]").length, 0, "the claim copy shows where nothing can be claimed");
  const host = new EventTarget();
  const got = [];
  host.addEventListener(ATS_CLAIM_EVENT, (e) => got.push(e.detail));
  const rw = buildAtsReport(miniDocument(), cleanReport(RAW), { host, claims: { pending: new Set(["skill:mentoring"]) } });
  const buttons = rw.querySelectorAll("button");
  assert.equal(buttons.length, 4, "one button per 'You could claim' box");
  for (const b of buttons) { assert.equal(b.getAttribute("type"), "button"); assert.ok(["true", "false"].includes(b.getAttribute("aria-pressed"))); }
  // NOTHING IS PRE-SELECTED: only the click in flight reads as claimed.
  assert.deepEqual(buttons.filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.getAttribute("data-key")), ["quality:mentoring"]);
  buttons.find((b) => b.getAttribute("data-key") === "verb:Scaled").click();
  buttons.find((b) => b.getAttribute("data-key") === "quality:mentoring").click();
  assert.deepEqual(got, [{ kind: "action_verb", term: "Scaled", claimed: true }, { kind: "skill", term: "mentoring", claimed: false }]);
  // The folds are native disclosure widgets, closed by default; the bar says what it shows.
  assert.equal(rw.querySelectorAll("details").length, 2);
  assert.ok(rw.querySelectorAll("details").every((d) => !d.hasAttribute("open") && d.children[0].localName === "summary"));
  const bar = rw.querySelector("[data-ats-bar]");
  assert.equal(bar.getAttribute("role"), "img");
  assert.equal(bar.getAttribute("aria-label"), "4 of 8 asks already on your résumé; 2 generic, not a gap");
});

test("⭐ T9 · D32's hover link: only where the host asks — focus and pointer say the term, leaving says null", () => {
  const host = new EventTarget();
  const lit = [];
  host.addEventListener(ATS_TERM_EVENT, (e) => lit.push(e.detail.term));
  const off = buildAtsReport(miniDocument(), cleanReport(RAW), { host });
  assert.equal(off.querySelectorAll("[data-pair-term]").length, 0, "boxes link where nothing asked them to");
  const on = buildAtsReport(miniDocument(), cleanReport(RAW), { host, linkable: true });
  const go = on.querySelector('[data-key="skill:Go"]');
  assert.equal(go.getAttribute("tabindex"), "0", "a read-only box in a pair is reachable by keyboard");
  go.fire("focus"); go.fire("blur"); go.fire("mouseenter"); go.fire("mouseleave");
  assert.deepEqual(lit, ["Go", null, "Go", null]);
});

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// 6 · THE CONSUMERS
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test("⛔ T9 · the web wrapper is THIN — it reads no section, prints no copy, and only passes inputs and events", () => {
  const w = stripJs(read("client/src/components/AtsReport.jsx"));
  assert.doesNotMatch(w, /tier1_|competencies_|action_verbs_|decline_reasons|You could claim|Already yours|ats-box|className=/);
  assert.match(w, /el\.addEventListener\(ATS_CLAIM_EVENT, onClaim\)/);
  assert.match(w, /latest\.current\.claims\?\.onToggle\?\.\(kind, term, claimed\)/, "the claim goes back through ATSPanel's toggle (AG2)");
  assert.match(w, /latest\.current\.link\?\.light\(e\.detail\?\.term \|\| null\)/, "the hover link reaches lib/pairLink.js");
  assert.ok(!fs.existsSync("client/src/components/AtsReport.css"), "the old stylesheet is back beside the component");
});

test("⛔ T9 · the popup and the on-page panel draw the component — and add only their own buttons", () => {
  const html = read("extension/popup.html");
  assert.ok(html.indexOf('<script src="atsReport.js"></script>') < html.indexOf('<script src="popup.js"></script>'), "the bundle loads before popup.js");
  assert.match(html, /<draft-ats-report id="ats-report-card"><\/draft-ats-report>/);
  assert.match(html, /<button class="btn" id="btn-ats-full" style="display:none">Full report in draft<\/button>/);
  assert.match(html, /<button class="btn" id="btn-ats-again">Read again<\/button>/);
  const popup = read("extension/popup.js");
  assert.match(popup, /card\.report = r\.report;/, "the popup hands the component the scorer's JSON as it is");
  assert.doesNotMatch(stripJs(popup), /tier1_|competencies_|action_verbs_/, "the popup reads a report's sections itself");
  const panel = read("extension/resumePanel.js");
  assert.match(panel, /files: \['atsReport\.js'\]/, "the panel injects the extension's own file — no remote code");
  // ⭐ T17: drawn in the dock's ATS tab (its own view, rm-ats-panel)
  assert.match(panel, /ATS\.mountAtsReport\(cardHost, m\.report\.report, \{\}\)/);
  assert.doesNotMatch(stripJs(panel), /tier1_|competencies_|action_verbs_/);
  // The service worker keeps the report to the component's own named fields.
  assert.match(read("extension/boardJob.js"), /globalThis\.__draftAtsReport\?\.cleanReport\(ats\.report\)/);
  assert.match(read("extension/boardJob.js"), /^import '\.\/atsReport\.js';$/m);
  // CSP: the extension pages still run only their own scripts.
  assert.equal(JSON.parse(read("extension/manifest.json")).content_security_policy.extension_pages, "script-src 'self'; object-src 'self'");
});

test("⛔ T9 × BINDING FIRST · the popup's card comes only from a press, and only with what the identify allowed", () => {
  const popup = stripJs(read("extension/popup.js"));
  const body = (src, from, to) => src.slice(at(src, from), at(src, to, at(src, from) + from.length));
  // Opening the popup on a bound tab (T14's TAB_STATE) is no request and no page read: the job card and its score come
  // back from the tab's own record, the FULL card does not — it waits for Read again (D23: every read begins with a press).
  const tabState = body(popup, "function showTabState(st)", "\nfunction ");
  assert.doesNotMatch(tabState, /renderAtsReport|POPUP_CONTEXT|sendMessage/, "the tab's state draws the card or asks the server on open");
  assert.match(tabState, /'Read again'/, "a bound tab's popup offers Read again — the press that brings the card");
  // The press: the card is drawn from the context the identify-first POPUP_CONTEXT returned — and hidden when it carried
  // no ready report (a signed-out / unreachable stop returns `report: null`).
  const readP = body(popup, "async function readPage()", "\ndocument.getElementById('btn-read-page')");
  assert.ok(readP.indexOf("chrome.runtime.sendMessage({ type: 'POPUP_CONTEXT' })") < readP.indexOf("renderAtsReport(context)"));
  const render = body(popup, "function renderAtsReport(context)", "\ndocument.getElementById('btn-ats-again')");
  assert.match(render, /if \(r\?\.state !== 'ready' \|\| !r\.report \|\| typeof card\.render !== 'function'\) \{ box\.style\.display = 'none'; return; \}/);
  // "Full report in draft" only for the board job's report — the bound job's id, never a page-text score's.
  assert.match(render, /r\.basis === 'board' \? \(context\.posting\?\.jobId \?\? context\.binding\?\.jobId \?\? null\) : null/);
  // The service worker: a stop asks nothing more and sends no report; the one extra GET only when the identify's answer
  // carried no report, for a job draft knows — and the binding is still the identify's (no rebind on the GET).
  const bg = stripJs(read("extension/background.js"));
  const ctx = body(bg, "async function popupContext(tab)", "\nasync function previewActiveTab");
  const stop = body(ctx, "if (identity && IDENTITY_STOPS.includes(identity.outcome))", "\n  }");
  assert.match(stop, /report: null/);
  assert.ok(ctx.indexOf("IDENTITY_STOPS.includes") < ctx.indexOf("lookupBoardJob("), "the GET comes after a stop has returned");
  assert.match(ctx, /const boardReport = !page\?\.ats && board\?\.posting\?\.known && board\.posting\.jobId\s*\?\s*await lookupBoardJob\(RESUME_MASTER_URL, board\.posting\.jobId\)/);
  assert.doesNotMatch(ctx.slice(at(ctx, "const boardReport")), /via: 'recognised'/, "the board GET rebinds the tab");
});

test("⛔ T9 · the extension draws no second ATS report: no file outside the bundle prints the card's headings", () => {
  const HEADINGS = /You could claim|Already yours|Generic — not a gap|things this posting asks for/;
  for (const f of fs.readdirSync("extension").filter((f) => /\.(js|html)$/.test(f) && f !== "atsReport.js")) {
    assert.doesNotMatch(stripJs(read(`extension/${f}`)), HEADINGS, `extension/${f} draws its own ATS report`);
  }
});

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// 7 · IN A REAL CHROME — the popup and a web-app host page, pixel for pixel
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const { findChrome, launchExtensionBrowser, HarnessSkip } = await import("../test-support/extensionBrowser.mjs");
const chrome = await findChrome();

/** A read-only static server for the web-app host page: the shared modules and the site's own font files. */
function staticServer() {
  const ROOT = path.resolve(".");
  const types = { ".js": "text/javascript", ".woff2": "font/woff2", ".html": "text/html", ".css": "text/css" };
  const requests = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    if (url.pathname !== "/favicon.ico") requests.push(url.pathname);   // the browser asks for a favicon on its own
    if (url.pathname === "/host.html") { res.writeHead(200, { "content-type": "text/html" }); res.end(HOST_HTML); return; }
    const rel = url.pathname.replace(/^\/+/, "");
    if (!/^(shared\/[\w.-]+\.js|client\/node_modules\/@fontsource\/[\w-]+\/files\/[\w.-]+\.woff2)$/.test(rel)) { res.writeHead(404); res.end(); return; }
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
    res.end(fs.readFileSync(file));
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ origin: `http://127.0.0.1:${server.address().port}`, requests, stop: () => new Promise((r) => server.close(r)) })));
}

// The web app's document around the card — deliberately HOSTILE to it: the site's fonts (the same files the extension
// copies), but a body font, size, colour and a stray --c-pair-surface the card must not inherit.
const FS = "/client/node_modules/@fontsource";
const HOST_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: 'DM Sans'; font-weight: 400; src: url(${FS}/dm-sans/files/dm-sans-latin-400-normal.woff2) format('woff2'); }
@font-face { font-family: 'DM Sans'; font-weight: 700; src: url(${FS}/dm-sans/files/dm-sans-latin-700-normal.woff2) format('woff2'); }
@font-face { font-family: 'Poppins'; font-style: italic; font-weight: 800; src: url(${FS}/poppins/files/poppins-latin-800-italic.woff2) format('woff2'); }
@font-face { font-family: 'Instrument Serif'; font-weight: 400; src: url(${FS}/instrument-serif/files/instrument-serif-latin-400-normal.woff2) format('woff2'); }
:root { --c-pair-surface: #00FF00; --font-body: monospace; }
body { margin: 0; padding: 24px; font: 13px/2 serif; color: #FF00FF; letter-spacing: 2px; background: #888888; }
draft-ats-report { width: 300px; }
.warm { font-family: 'DM Sans'; } .warm b { font-weight: 700; } .warm i { font-family: 'Poppins'; font-style: italic; font-weight: 800; } .warm s { font-family: 'Instrument Serif'; }
</style></head><body><div class="warm">warm <b>up</b> <i>the</i> <s>faces</s></div>
<draft-ats-report id="card"></draft-ats-report>
<script type="module">
import { defineAtsReportElement, ATS_CLAIM_EVENT } from "/shared/atsReportElement.js";
defineAtsReportElement();
window.claims = [];
document.getElementById("card").addEventListener(ATS_CLAIM_EVENT, (e) => window.claims.push(e.detail));
window.ready = true;
</script></body></html>`;

// Every face the card draws with (atsReportStyles.js: DM Sans 400/700, Poppins 800 italic, Instrument Serif 400).
const CARD_FACES = Object.freeze(['400 16px "DM Sans"', '700 16px "DM Sans"', 'italic 800 16px "Poppins"', '400 16px "Instrument Serif"']);

/** Load every face the card uses in THIS page, explicitly — `document.fonts.ready` alone can resolve before a face
 *  nothing has asked for yet is fetched, which is how the parity check flaked once beside j9FullPass under load. */
async function fontsLoaded(page) {
  const missing = await page.evaluate(async (faces) => {
    const out = [];
    for (const f of faces) { try { const got = await document.fonts.load(f); if (!got.length) out.push(f); } catch { out.push(f); } }
    await document.fonts.ready;
    return out;
  }, CARD_FACES);
  assert.deepEqual(missing, [], `${page.url()} could not load the card's faces`);
}

/** How two screenshots differ — sizes, the number of differing pixels and their bounding box — decoded by Chrome itself
 *  (a canvas in `page`), so a failure says WHERE, not just "different". */
async function pictureDiff(page, a, b) {
  return page.evaluate(async (a64, b64) => {
    const load = (s) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = `data:image/png;base64,${s}`; });
    const [A, B] = await Promise.all([load(a64), load(b64)]);
    if (A.width !== B.width || A.height !== B.height) return `size ${A.width}x${A.height} vs ${B.width}x${B.height}`;
    const px = (img) => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
      const x = c.getContext("2d"); x.drawImage(img, 0, 0); return x.getImageData(0, 0, img.width, img.height).data; };
    const da = px(A), db = px(B);
    let n = 0, x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
    for (let i = 0; i < da.length; i += 4) {
      if (da[i] !== db[i] || da[i + 1] !== db[i + 1] || da[i + 2] !== db[i + 2] || da[i + 3] !== db[i + 3]) {
        n++; const p = i / 4, x = p % A.width, y = (p - x) / A.width;
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
    }
    return n ? `${n} of ${A.width * A.height} pixels differ, in ${x0},${y0} to ${x1},${y1}` : "identical once decoded";
  }, a.toString("base64"), b.toString("base64"));
}

/** Draw `report` in `page`'s card with these attributes, wait for its faces and two frames, and screenshot just the card. */
async function shot(page, selector, report, { theme = null, cues = false } = {}) {
  // FIRST to the front: a background tab is never painted — its frames never come (the wait below would hang) and its
  // screenshot would wait for ever.
  await page.bringToFront();
  await page.evaluate(async (sel, r, th, cu, faces) => {
    const el = document.querySelector(sel);
    if (th) el.setAttribute("theme", th); else el.removeAttribute("theme");
    if (cu) el.setAttribute("cues", "shape"); else el.removeAttribute("cues");
    el.style.width = "300px";
    el.style.background = "rgb(10, 20, 30)";   // the same ground behind the card's rounded corners on both pages
    // At the same WHOLE-pixel place on both pages: a card at a fractional offset rasterises its text differently.
    Object.assign(el.style, { position: "absolute", left: "0px", top: "0px", zIndex: "1" });
    el.report = r;
    el.render();
    for (const d of el.shadowRoot.querySelectorAll("details")) d.open = true;   // every section in the picture
    for (const f of faces) { try { await document.fonts.load(f); } catch { /* fontsLoaded() asserted them */ } }
    await document.fonts.ready;
    // laid out AND painted — two frames, bounded so a frame that never comes cannot hang the run
    await Promise.race([new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))), new Promise((res) => setTimeout(res, 1000))]);
  }, selector, report, theme, cues, CARD_FACES);
  return (await page.$(selector)).screenshot();
}

test("⭐ T9 · REAL CHROME: the popup and the web app draw the same pixels — four themes, cues off and on — and no request",
  { skip: chrome.skip || false, timeout: 240000 }, async (t) => {
    let h;
    try { h = await launchExtensionBrowser({ theme: "light" }); }
    catch (e) { if (e instanceof HarnessSkip) { t.skip(e.reason); return; } throw e; }
    const web = await staticServer();
    t.after(async () => { await h.close(); await web.stop(); });
    // The extension's REAL popup page: its tokens.css, ui.css, its CSP, and the bundle loaded by <script src>.
    const popup = await h.browser.newPage();
    await popup.goto(`chrome-extension://${h.extensionId}/popup.html`);
    await popup.evaluate(() => { document.body.style.width = "340px"; document.getElementById("ats-report").style.display = "block"; });
    assert.equal(await popup.evaluate(() => typeof customElements.get("draft-ats-report")), "function", "the popup did not define the element");
    // The web app's host page.
    const page = await h.browser.newPage();
    await page.goto(`${web.origin}/host.html`);
    await page.waitForFunction(() => window.ready === true);
    // Each page loads every face the card uses before the first picture (the web page from its server, the popup from
    // the extension's own files) — and the request count is taken after, so it counts only the CARD's requests.
    await fontsLoaded(page);
    await fontsLoaded(popup);
    const report = JSON.parse(JSON.stringify(RAW));
    const before = web.requests.length;
    const mismatched = [];
    // ONE retry, both pictures redrawn: a frame caught mid-paint under load is not a parity failure; the same
    // difference twice is — and is then reported with where it is.
    const pair = async (opts) => {
      let x = await shot(page, "#card", report, opts), y = await shot(popup, "#ats-report-card", report, opts);
      if (!x.equals(y)) { x = await shot(page, "#card", report, opts); y = await shot(popup, "#ats-report-card", report, opts); }
      return [x, y];
    };
    for (const theme of THEME_LIST.map((x) => x.id)) {
      for (const cues of [false, true]) {
        const [a, b] = await pair({ theme, cues });
        if (!a.equals(b)) {
          mismatched.push(`${theme}${cues ? " +cues" : ""}: ${await pictureDiff(page, a, b)}`);
          fs.mkdirSync(path.join(h.outDir, "t9"), { recursive: true });
          fs.writeFileSync(path.join(h.outDir, "t9", `${theme}-${cues}-web.png`), a);
          fs.writeFileSync(path.join(h.outDir, "t9", `${theme}-${cues}-popup.png`), b);
        }
      }
    }
    assert.deepEqual(mismatched, [], `the popup and the web app drew different cards (pictures in ${h.outDir}/t9)`);
    assert.equal(web.requests.length, before, `the component asked for something: ${web.requests.slice(before).join(", ")}`);
    // The host page's hostile styles did not reach in: the card's ground is the theme's, not the stray green.
    await shot(page, "#card", report, { theme: "paper-light" });
    const ground = await page.evaluate(() => getComputedStyle(document.querySelector("#card").shadowRoot.querySelector(".ats-card")).backgroundColor);
    assert.equal(ground, "rgb(251, 247, 240)", "Paper Light's pair surface");   // PAIR_SURFACE #FBF7F0
    // No theme named → the OS decides: dark → Charcoal Dark, in both.
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
    await popup.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
    const [da, db] = await pair({});
    const dt = await shot(page, "#card", report, { theme: "charcoal-dark" });
    assert.ok(da.equals(db), `no theme, dark OS: the popup and the web app differ — ${da.equals(db) ? "" : await pictureDiff(page, da, db)}`);
    assert.ok(da.equals(dt), `no theme, dark OS: not Charcoal Dark — ${da.equals(dt) ? "" : await pictureDiff(page, da, dt)}`);
  });

test("⭐ T9 · REAL CHROME: the keyboard claims a term — Tab to the box, Space presses it — and a redraw keeps focus and folds",
  { skip: chrome.skip || false, timeout: 120000 }, async (t) => {
    let h;
    try { h = await launchExtensionBrowser({ theme: "light" }); }
    catch (e) { if (e instanceof HarnessSkip) { t.skip(e.reason); return; } throw e; }
    const web = await staticServer();
    t.after(async () => { await h.close(); await web.stop(); });
    const page = await h.browser.newPage();
    await page.goto(`${web.origin}/host.html`);
    await page.waitForFunction(() => window.ready === true);
    await page.evaluate((r) => { const el = document.getElementById("card"); el.report = r; el.claims = { pending: [] }; el.render();
      el.shadowRoot.querySelector("details[data-fold=on-resume]").open = true; }, JSON.parse(JSON.stringify(RAW)));
    await page.keyboard.press("Tab");
    const first = await page.evaluate(() => document.getElementById("card").shadowRoot.activeElement?.getAttribute("data-key"));
    assert.equal(first, "skill:Kafka", "the first claim box is the first stop");
    await page.keyboard.press("Space");
    assert.deepEqual(await page.evaluate(() => window.claims), [{ kind: "skill", term: "Kafka", claimed: true }]);
    // The host answers with new claim state (as ATSPanel does); the card redraws — focus and the open fold stay.
    await page.evaluate(() => { const el = document.getElementById("card"); el.claims = { pending: ["skill:Kafka"] }; el.render(); });
    const after = await page.evaluate(() => { const r = document.getElementById("card").shadowRoot;
      return { focus: r.activeElement?.getAttribute("data-key"), pressed: r.activeElement?.getAttribute("aria-pressed"),
               open: !!r.querySelector("details[data-fold=on-resume]").open }; });
    assert.deepEqual(after, { focus: "skill:Kafka", pressed: "true", open: true });
  });
