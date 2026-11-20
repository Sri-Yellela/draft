// ⭐ T9 · THE ATS PANEL IS ONE COMPONENT — IN A REAL CHROME: the popup (the real unpacked extension page, its CSS and its
// CSP) and a web-app host page draw the same pixels, per theme, cues off and on; no request; the keyboard reaches the
// folds. Skips with its reason when this machine has no Chrome.
// ⭐ A232 R5 (46y, owner 11-19 "all four approved"): split out of test/t9AtsReportComponent.test.js (its points 1–6, pure, run in the fast tier);
// the synthetic report and the two readers are test-support/t9AtsReportFixture.mjs, shared by both.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { at } from "../test-support/sourceAnchors.js";
import { read, stripJs, RAW } from "../test-support/t9AtsReportFixture.mjs";

const { THEME_LIST } = await import("../client/src/themes/index.js");

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
@font-face { font-family: 'DM Sans'; font-weight: 500; src: url(${FS}/dm-sans/files/dm-sans-latin-500-normal.woff2) format('woff2'); }
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
import { defineAtsReportElement } from "/shared/atsReportElement.js";
defineAtsReportElement();
window.ready = true;
</script></body></html>`;

// Every face the card may draw with (atsReportStyles.js: DM Sans 400/500/700 — ⭐ D152 (8) added 500 — Poppins 800 italic, Instrument Serif 400).
const CARD_FACES = Object.freeze(['400 16px "DM Sans"', '500 16px "DM Sans"', '700 16px "DM Sans"', 'italic 800 16px "Poppins"', '400 16px "Instrument Serif"']);

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

test("⭐ T9 · REAL CHROME: the extension's bundle and the web app draw the same pixels — four themes, cues off and on — and no request",
  { skip: chrome.skip || false, timeout: 240000 }, async (t) => {
    let h;
    try { h = await launchExtensionBrowser({ theme: "light" }); }
    catch (e) { if (e instanceof HarnessSkip) { t.skip(e.reason); return; } throw e; }
    const web = await staticServer();
    t.after(async () => { await h.close(); await web.stop(); });
    // ⭐ T31: the toolbar popup is retired — the extension's bundle is measured on an extension page it ships: the settings
    // page (its tokens.css, ui.css and CSP), with the bundle loaded by <script src>, as the popup loaded it.
    const popup = await h.browser.newPage();
    await popup.goto(`chrome-extension://${h.extensionId}/options.html`);
    await popup.evaluate(() => new Promise((ok, no) => {
      const s = document.createElement("script"); s.src = "atsReport.js"; s.onload = ok; s.onerror = () => no(new Error("atsReport.js did not load")); document.head.append(s);
    }));
    await popup.evaluate(() => { document.body.style.width = "340px"; const el = document.createElement("draft-ats-report"); el.id = "ats-report-card"; document.body.append(el); });
    assert.equal(await popup.evaluate(() => typeof customElements.get("draft-ats-report")), "function", "the extension's bundle did not define the element");
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

test("⭐ T9 → 46x · REAL CHROME: the keyboard reaches the folds (no claim button to stop on) — and a redraw keeps the open fold",
  { skip: chrome.skip || false, timeout: 120000 }, async (t) => {
    let h;
    try { h = await launchExtensionBrowser({ theme: "light" }); }
    catch (e) { if (e instanceof HarnessSkip) { t.skip(e.reason); return; } throw e; }
    const web = await staticServer();
    t.after(async () => { await h.close(); await web.stop(); });
    const page = await h.browser.newPage();
    await page.goto(`${web.origin}/host.html`);
    await page.waitForFunction(() => window.ready === true);
    await page.evaluate((r) => { const el = document.getElementById("card"); el.report = r; el.render();
      el.shadowRoot.querySelector("details[data-fold=on-resume]").open = true; }, JSON.parse(JSON.stringify(RAW)));
    await page.keyboard.press("Tab");
    const first = await page.evaluate(() => document.getElementById("card").shadowRoot.activeElement?.localName || null);
    assert.equal(first, "summary", "the first stop is a fold's summary — the report has no button");
    // A new report (a re-score) redraws the card — the open fold stays open.
    await page.evaluate((r) => { const el = document.getElementById("card"); el.report = { ...r, score: (r.score || 0) + 1 }; el.render(); }, JSON.parse(JSON.stringify(RAW)));
    const after = await page.evaluate(() => ({ open: !!document.getElementById("card").shadowRoot.querySelector("details[data-fold=on-resume]").open,
      buttons: document.getElementById("card").shadowRoot.querySelectorAll("button").length }));
    assert.deepEqual(after, { open: true, buttons: 0 });
  });
