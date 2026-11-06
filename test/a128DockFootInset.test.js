// A128 (44y): Workday's "Attach tailored" failed after other ATS families in one browser — measured in a real Chrome
// with the worker's messages logged: the press never reached the worker. The Resume/CV row sat at the dock's foot,
// under the "Filling by hand — a résumé on cue" toast (popup-layer.js places popups OVER the dock's foot); the press
// landed on the toast, and the pointer then resting on it paused the toast's timer, so it never went away. Alone, the
// row happened not to be under it. Fix: while a popup covers the dock's foot, the dock's panes keep that much room
// below (padding, dock.js footInset); every dock view is height:100% of its pane with its own scroller (review .rm-sc,
// résumé .sc, copy sheet .b), so the view and its scroller end above the popup and the last row scrolls clear of it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import { findChrome } from "../test-support/extensionBrowser.mjs";
import { C_LIGHT, C_DARK } from "../extension/tokens.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const DOCK = read("extension/dock.js");
const LAYER = read("extension/popup-layer.js");

test("A128 · the dock keeps room under its panes while a popup covers its foot (source)", () => {
  assert.match(DOCK, /padding-bottom: var\(--draft-foot-inset, 0px\); box-sizing: border-box;/);
  assert.match(DOCK, /footInset\(px\) \{/);
  assert.match(LAYER, /p\.host = host;\n    footInset\(host\);/, "set when a popup is drawn");
  assert.match(LAYER, /p\.host\?\.remove\(\);\n    footInset\(null\);/, "cleared when it closes");
});

const chrome = await findChrome();
const STUB = `window.__sent = []; window.chrome = { runtime: { lastError: null, sendMessage(m, cb) { window.__sent.push(m); cb && cb({ ok: true }); } } };`;

test("A128 · in a REAL Chrome — the LAST row's button under a standing toast is pressed, not the toast", { skip: chrome.skip || false, timeout: 90000 }, async (t) => {
  const server = http.createServer((_q, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end("<!doctype html><title>Acme</title><body style='height:3000px'>"); });
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
  await page.evaluate((th) => {
    window.__th = th;
    const dock = globalThis.__draftDock.ensure({ theme: th });
    const el = dock.view("fill", { id: "a128-view" });
    // shaped like the real views: height:100% of the pane, its OWN scroller; rows taller than the dock, the button in
    // the LAST one — nothing below it
    el.innerHTML = `<div style="height:100%;display:flex;flex-direction:column;overflow:hidden"><div id="a128-sc" style="overflow:auto;flex:1;min-height:0">` +
      Array.from({ length: 14 }, (_, i) => `<div style="height:64px;border-bottom:1px solid #888">Row ${i}</div>`).join("") +
      `<div style="height:64px">Resume/CV <button id="a128-last" type="button">Attach tailored</button></div></div></div>`;
    window.__pressed = 0;
    document.getElementById("a128-last").addEventListener("click", (e) => { if (e.isTrusted) window.__pressed++; });
    globalThis.__draftPopups.show({ id: "a128-toast", kind: "toast", ms: 0, text: "Filling by hand — a résumé on cue.", theme: th,
      actions: [{ id: "d", label: "Draft it instead", word: "Draft" }] }).then(a => { window.__toast = a; });
  }, { light: C_LIGHT, dark: C_DARK });
  await page.waitForSelector("#a128-toast");
  const inset = await page.evaluate(() => document.getElementById("rm-draft-dock").style.getPropertyValue("--draft-foot-inset"));
  assert.match(inset, /^\d+px$/, "the dock was told the popup's height");
  assert.ok(parseInt(inset, 10) >= 40, `inset ${inset}`);

  await page.click("#a128-last");                       // a real press: scroll into view, then the pointer at its centre
  assert.equal(await page.evaluate(() => window.__pressed), 1, "the press reached the row's button");
  const hit = await page.evaluate(() => { const b = document.getElementById("a128-last").getBoundingClientRect();
    const at = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return at?.id || at?.tagName; });
  assert.equal(hit, "a128-last", "nothing covers the last row's button");
  assert.equal(await page.evaluate(() => window.__toast), undefined, "the toast was not pressed");

  // closing the popup gives the room back
  await page.evaluate(() => document.getElementById("a128-toast").shadowRoot.querySelector('[data-role="popup-close"]').click());
  await page.waitForFunction(() => !document.getElementById("a128-toast"));
  assert.equal(await page.evaluate(() => document.getElementById("rm-draft-dock").style.getPropertyValue("--draft-foot-inset")), "");
});
