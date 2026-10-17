// T10 row 17 · THE EXTENSION DISABLED — the website falls back to the plain link (open item 4).
//
// In a real Chrome, with the web app's REAL helper (client/src/lib/openPosting.js, served as-is) and Chrome's popup
// blocker LEFT ON (puppeteer's --disable-popup-blocking is dropped, so a window.open outside the click's activation
// window would be refused, as for a person):
//   (a) no extension at all (removed, or disabled before the board loaded): a click opens the page's own link at once
//   (b) the extension DISABLED after the board loaded — the page still carries the nonce its content script wrote, but
//       nothing answers: the hand-off times out (HANDOFF_TIMEOUT_MS, 4 s, under Chrome's ~5 s activation window) and the
//       page opens its own link — still allowed, exactly once
// Synthetic job only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import { findChrome } from "../test-support/extensionBrowser.mjs";

const chrome = await findChrome();
const SKIP = chrome.skip || false;

const page = (staleNonce) => `<!doctype html><html${staleNonce ? ' data-draft-extension="nonce-from-a-disabled-extension"' : ""}><head><meta charset="utf-8"><title>board</title></head><body>
<a id="posting" href="/posting-link" target="_blank" rel="noopener noreferrer">Synthco — Data Engineer</a>
<script type="module">
  import { postingClick } from '/openPosting.js';
  window.__clicked = 0;
  document.getElementById('posting').addEventListener('click', (e) => { window.__clicked++; postingClick({ jobId: 'wd-1', applyUrl: location.origin + '/posting-link' }, e); });
</script></body></html>`;

async function serve() {
  const helper = fs.readFileSync("client/src/lib/openPosting.js", "utf8");
  const server = http.createServer((req, res) => {
    if (req.url === "/board") return res.writeHead(200, { "content-type": "text/html" }).end(page(false));
    if (req.url === "/board-stale") return res.writeHead(200, { "content-type": "text/html" }).end(page(true));
    if (req.url === "/openPosting.js") return res.writeHead(200, { "content-type": "application/javascript" }).end(helper);
    if (req.url === "/posting-link") return res.writeHead(200, { "content-type": "text/html" }).end("<!doctype html><title>posting</title><h1>The employer's posting</h1>");
    res.writeHead(404).end();
  });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(r => server.close(r)) };
}

async function run(t, path) {
  const puppeteer = (await import("puppeteer-core")).default;
  const srv = await serve();
  const browser = await puppeteer.launch({ executablePath: chrome.path, headless: true, pipe: true,
    ignoreDefaultArgs: ["--disable-popup-blocking"], args: ["--no-first-run"] });
  t.after(async () => { await browser.close().catch(() => {}); await srv.close(); });
  const tab = await browser.newPage();
  await tab.goto(`${srv.origin}${path}`);
  await tab.waitForFunction(() => typeof window.__clicked === "number");
  const opened = [];
  browser.on("targetcreated", (tg) => { if (tg.type() === "page") opened.push(tg); });
  const t0 = Date.now();
  await tab.click("#posting");
  const target = await browser.waitForTarget(tg => tg.type() === "page" && tg.url().endsWith("/posting-link"), { timeout: 9000 }).catch(() => null);
  const after = Date.now() - t0;
  await new Promise(r => setTimeout(r, 600));   // a second tab, if any, would appear here
  return { target, after, pages: opened.length, nonce: await tab.$eval("html", el => el.dataset.draftExtension || null) };
}

test("⛔ row 17 (a) · no extension in this Chrome: a click on a posting opens the page's own link at once", { skip: SKIP, timeout: 60000 }, async (t) => {
  const r = await run(t, "/board");
  assert.equal(r.nonce, null, "no content script marked the page");
  assert.ok(r.target, "the posting opened");
  assert.ok(r.after < 2000, `opened at once (${r.after} ms)`);
  assert.equal(r.pages, 1, "one tab, not two");
});

test("⛔ row 17 (b) · the extension disabled AFTER the board loaded: nothing answers the hand-off, and the page opens its own link — inside the click's activation window, once", { skip: SKIP, timeout: 60000 }, async (t) => {
  const r = await run(t, "/board-stale");
  assert.equal(r.nonce, "nonce-from-a-disabled-extension", "the page still carries the nonce");
  assert.ok(r.target, "the posting opened — Chrome's popup blocker allowed it");
  assert.ok(r.after >= 3500 && r.after < 6000, `after the hand-off's own wait (${r.after} ms)`);
  assert.equal(r.pages, 1, "one tab, not two");
});
