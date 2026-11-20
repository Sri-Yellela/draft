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
//   5. keyboard and screen reader: every row is read-only (46x: no claims), folds are details/summary
//   6. the consumers: the wrapper is thin, the popup and the panel load the bundle; nothing extension-only
//   7 · in a REAL Chrome — ⭐ A232 R5 (46y, owner 11-19 "all four approved"): moved to test/t9AtsReportChrome.test.js (browser tier),
//      so 1–6 here run in the fast tier on every change
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { miniDocument } from "../test-support/miniDom.mjs";
import { at } from "../test-support/sourceAnchors.js";
import { buildAtsReport, ATS_TERM_EVENT } from "../shared/atsReportElement.js";
import { cleanReport, fromDeckReport } from "../shared/atsReportModel.js";
import { ATS_REPORT_CSS, atsHostCss } from "../shared/atsReportStyles.js";
import { ATS_REPORT_THEMES, ATS_REPORT_DEFAULT_THEMES } from "../shared/atsReportTokens.js";
import { staleAtsReport, transformModule, BUNDLE_MODULES } from "../scripts/buildAtsReport.mjs";
import { reportOf, boardJobForExtension } from "../routes/extensionJob.js";
import { atsFacts } from "../extension/boardJob.js";
import { reportModel } from "../extension/resumePanel.js";
import { collectRequiredFiles } from "../scripts/buildExtension.mjs";
import { CROSS_PRODUCT } from "../client/src/modules.manifest.js";
import { read, stripJs, RAW } from "../test-support/t9AtsReportFixture.mjs";   // A232 R5: shared with t9AtsReportChrome

const { THEME_LIST } = await import("../client/src/themes/index.js");

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
  // ⭐ D152 (8), changed on purpose (option A): the count is the heading, the number a plain sentence under it.
  for (const words of ["4 of 8 things this posting asks for", "A 61% match.", "Kafka", "mentoring", "Scaled", "Managed",
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
  // ⭐ 46x D192 (4): the contextual block rides beside the report, and only where the report travels (withReport)
  assert.match(server, /\.\.\.\(withReport \? \{ report, contextual: contextualForBase\(userId, activeProfile, job, report\) \} : \{\}\),/);
  assert.match(read("routes/apply.js"), /scoreBaseResumeForApply\(userId, jobId\) : null;/, "the apply worker started storing the full report");
});

test("⭐ T9 · the deck's frozen report and a declined report draw through the same component", () => {
  const declined = buildAtsReport(miniDocument(), cleanReport({ source: "local_ats_v5", score: null, decline_reasons: ["Too little text to judge."] }));
  // ⭐ D152 (8), changed on purpose: the band heading is gone — the scorer declining is said in words (still no grade).
  assert.match(declined.outerHTML, /data-ats-band="not_enough_signal"/);
  assert.match(declined.outerHTML, /data-ats-unknown>Not enough signal to judge this posting — no judgement\.<\/p>/);
  assert.doesNotMatch(declined.outerHTML, /data-ats-score/, "a declined report printed a number");
  const deck = buildAtsReport(miniDocument(), cleanReport(fromDeckReport({ skillsMatched: ["Go"], skillsMissing: ["Rust"], verbsGeneric: [] })), { band: "moderate" });
  assert.match(deck.outerHTML, /Moderate match — read it with the count\./, "with no number, the band in words — not a heading");
  assert.match(deck.outerHTML, /1 of 2 things this posting asks for/);
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
// 5 · KEYBOARD AND SCREEN READER · READ-ONLY (⭐ 46x, owner 11-19: "ditch the whole prove it and claim it gimmick", then
//     "do the clean up" — the claim buttons, the claimed segment and the You could claim / History switches are retired)
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test("⭐ T9 → 46x · the report is read-only on every surface: no button, no claim copy, no switch; the folds and the bar say what they show", () => {
  const rw = buildAtsReport(miniDocument(), cleanReport(RAW));
  assert.equal(rw.querySelectorAll("button").length, 0, "a read-only card offers a control");
  for (const sel of ["[data-claim-note]", "[data-ats-view]", "[aria-pressed]"]) assert.equal(rw.querySelectorAll(sel).length, 0, `a claim or a switch is back: ${sel}`);
  assert.doesNotMatch(rw.textContent, /That's true of me|Claimed · undo|You could claim|claimed by you/);
  // the missing terms: one labelled block of plain rows
  assert.equal(rw.querySelector("[data-ats-missing]").querySelectorAll(".ats-cl").length, 4);
  // The folds are native disclosure widgets, closed by default; the bar says what it shows.
  assert.equal(rw.querySelectorAll("details").length, 2);
  assert.ok(rw.querySelectorAll("details").every((d) => !d.hasAttribute("open") && d.children[0].localName === "summary"));
  const bar = rw.querySelector("[data-ats-bar]");
  assert.equal(bar.getAttribute("role"), "img");
  // ⭐ D152 (8) → 46x: the bar is on your résumé · missing (generic language is not an ask, so not on it).
  assert.equal(bar.getAttribute("aria-label"), "4 of 8 asks already on your résumé");
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
  assert.doesNotMatch(w, /claims|ATS_CLAIM_EVENT|onToggle|history/, "46x: the wrapper passes no claims and no history");
  assert.match(w, /latest\.current\.link\?\.light\(e\.detail\?\.term \|\| null\)/, "the hover link reaches lib/pairLink.js");
  assert.ok(!fs.existsSync("client/src/components/AtsReport.css"), "the old stylesheet is back beside the component");
});

test("⛔ T9 · the on-page panel draws the component — and adds only its own buttons (⭐ T31: the retired popup's card went with it)", () => {
  const panel = read("extension/resumePanel.js");
  assert.match(panel, /files: \['atsReport\.js'\]/, "the panel injects the extension's own file — no remote code");
  // ⭐ T17: drawn in the dock's ATS tab (its own view, rm-ats-panel)
  // ⭐ D105 P5: with the report's Atlas links when the worker resolved any (atlasForReport) — the component draws them.
  assert.match(panel, /ATS\.mountAtsReport\(cardHost, m\.report\.report, m\.report\.atlas \? \{ atlas: m\.report\.atlas \} : \{\}\)/);
  assert.doesNotMatch(stripJs(panel), /tier1_|competencies_|action_verbs_/);
  // The service worker keeps the report to the component's own named fields.
  assert.match(read("extension/boardJob.js"), /globalThis\.__draftAtsReport\?\.cleanReport\(ats\.report\)/);
  assert.match(read("extension/boardJob.js"), /^import '\.\/atsReport\.js';$/m);
  // CSP: the extension pages still run only their own scripts.
  assert.equal(JSON.parse(read("extension/manifest.json")).content_security_policy.extension_pages, "script-src 'self'; object-src 'self'");
});

test("⛔ T9 × BINDING FIRST · the card comes only from a press, and only with what the identify allowed (⭐ T31: the toolbar press)", () => {
  const body = (src, from, to) => src.slice(at(src, from), at(src, to, at(src, from) + from.length));
  // ⭐ T31: the press reads only when pressed and signed in (toolbarPress.js); the card is the dock's ATS tab, drawn
  // from the panel's own report (the retired popup's card and its Read again went with the popup)
  assert.match(read("extension/toolbarPress.js"), /const ctx = identity\?\.authenticated \? await deps\.context\(tab\)/);
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
