// T27 (owner, 10-19) · POPUPS FOR EVERYTHING THAT LEADS UP — "all the permissions, all the stuff that leads up to the
// reading of the page, the filling, everything else — they need to be POP-UPS and that's it."
//
// extension/popup-layer.js is the ONE popup: one at a time, queued · ≤ 1 line and ≤ 2 buttons · a toast dismisses
// itself, a question stays · Esc closes it · the focus goes into a question and comes back · a press reaches the caller
// with isTrusted · the Settings gear opens the settings page on a trusted click · ⛔ it never requests a permission
// (owner 10-23: a permission is requested on the settings page, #permissions).
//
// Part 1 reads the source; Part 2 drives the real dock.js + popup-layer.js in headless Chrome (SKIPS, saying why, with no
// Chrome).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import { at } from "../test-support/sourceAnchors.js";
import { findChrome } from "../test-support/extensionBrowser.mjs";
import { C_LIGHT, C_DARK } from "../extension/tokens.js";

const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const LAYER = read("extension/popup-layer.js");
const DOCK = read("extension/dock.js");
const stripJs = (s) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

test("T27 ① the popup layer: injected WITH the dock into the top frame, shipped in the package, never a permission request", async () => {
  assert.match(read("extension/dockHost.js"), /files: \['dock\.js', 'popup-layer\.js'\]/);
  const { collectRequiredFiles } = await import("../scripts/buildExtension.mjs");
  assert.ok(collectRequiredFiles(JSON.parse(read("extension/manifest.json"))).includes("popup-layer.js"), "popup-layer.js is not in the package");
  assert.doesNotMatch(stripJs(LAYER), /chrome\.permissions/, "a web page cannot request a permission — the settings page does (owner 10-23)");
  assert.match(LAYER, /document\.documentElement\.appendChild\(host\)/, "on <html>, never in <body>");
  assert.match(LAYER, /\(s\.actions \|\| \[\]\)\.slice\(0, 2\)/, "two buttons at most");
  assert.match(LAYER, /if \(ev\.isTrusted\) void send\(\{ type: 'OPEN_SETTINGS', trigger: 'click', section: s\.settings \}\);/);
});

test("T27 ② the messages that sat in the dock's body are popups: the status news, the intent line, a row's say, the dock's errors, the submitted confirmation", () => {
  const badge = read("extension/autofill-badge.js"), intent = read("extension/intent.js"), ro = read("extension/review-overlay.js");
  assert.match(badge, /globalThis\.__draftPopups\?\.show\?\.\(\{ id: 'rm-draft-status-toast', kind: 'toast'/);
  const path = intent.slice(at(intent, "export function renderIntentPath("), at(intent, "async function drawPath("));
  assert.match(path, /pop\.show\(\{/);
  assert.doesNotMatch(path, /el\.slot = 'status'/, "the intent line is back in the dock's status slot");
  assert.match(path, /if \(!answer\.trusted\) return 'ignore';/);
  assert.match(ro, /id: 'rm-draft-fill-said', kind: 'toast'/);
  assert.match(ro, /id: 'rm-draft-submitted', kind: 'question'/);
  assert.match(ro, /if \(answer\.action !== 'yes' \|\| !answer\.trusted\) return;/, "recorded on the person's own Yes only");
  assert.match(DOCK, /id: 'rm-draft-dock-said', kind: 'toast', text: frame\.loadError\[tab\]/);
});

// ═══ Part 2 · in a real Chrome ═══════════════════════════════════════════════════════════════════════════════

const chrome = await findChrome();
const SKIP = chrome.skip || false;
const STUB = `window.__sent = []; window.chrome = { runtime: { lastError: null, sendMessage(m, cb) { window.__sent.push(m); cb && cb({ ok: true }); } } };`;

test("T27 · the popup layer in a REAL Chrome — one at a time, a toast goes by itself, a question stays, Esc, focus in and back, trusted presses only, the gear", { skip: SKIP, timeout: 90000 }, async (t) => {
  const server = http.createServer((_q, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end("<!doctype html><title>Acme</title><body><input id=page-field>"); });
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
  const theme = { light: C_LIGHT, dark: C_DARK };
  await page.evaluate((th) => { window.__th = th; globalThis.__draftDock.ensure({ theme: th }); }, theme);
  const shown = () => page.evaluate(() => [...document.querySelectorAll("[data-draft-popup]")].map(h => ({ id: h.id, kind: h.dataset.draftPopup,
    text: h.shadowRoot.querySelector(".tx").textContent, buttons: h.shadowRoot.querySelectorAll("button[data-action]").length })));

  // two at once: a queue, not a stack
  await page.evaluate(() => { window.__a = []; const P = globalThis.__draftPopups;
    P.show({ id: "q1", kind: "question", text: "Draft this job?", theme: window.__th, actions: [{ id: "yes", label: "Yes", icon: "check", primary: true }, { id: "no", label: "No", icon: "close" }, { id: "x", label: "third", icon: "edit" }] }).then(a => window.__a.push(["q1", a]));
    P.show({ id: "t1", kind: "toast", text: "Filled — review and submit", ms: 250, theme: window.__th }).then(a => window.__a.push(["t1", a])); });
  let s = await shown();
  assert.deepEqual(s.map(x => x.id), ["q1"], "one popup at a time");
  assert.equal(s[0].buttons, 2, "two buttons at most");
  assert.deepEqual(await page.evaluate(() => globalThis.__draftPopups.waiting()), ["t1"], "the second waits its turn");
  // the focus is IN the question; nothing of it is in the dock's body
  assert.equal(await page.evaluate(() => document.activeElement?.id), "q1", "the focus went into the question");
  assert.ok(!(await page.evaluate(() => document.getElementById("rm-draft-dock").textContent.includes("Draft this job?"))), "a popup's words in the dock's body");
  // a page script's click answers nothing… the person's does
  await page.evaluate(() => document.getElementById("q1").shadowRoot.querySelector('[data-action="yes"]').click());
  const synthetic = await page.evaluate(() => window.__a.find(x => x[0] === "q1")?.[1]);
  assert.equal(synthetic?.trusted, false, "a synthetic click must reach the caller as untrusted");
  // (with no onAction, a press closes it — the caller reads `trusted`); the queued toast now shows
  s = await shown();
  assert.deepEqual(s.map(x => x.id), ["t1"]);
  await page.waitForFunction(() => !document.getElementById("t1"), { timeout: 3000 });
  assert.equal(await page.evaluate(() => window.__a.find(x => x[0] === "t1")?.[1].action), "timeout", "a toast dismisses itself");

  // a question STAYS; a trusted press answers it, and the focus goes back where it was
  await page.focus("#page-field");
  await page.evaluate(() => { globalThis.__draftPopups.show({ id: "q2", kind: "question", text: "Did you submit this application yourself?", theme: window.__th,
    actions: [{ id: "yes", label: "Yes — record it", icon: "check", primary: true }] }).then(a => { window.__q2 = a; }); });
  await new Promise(r => setTimeout(r, 4200));
  assert.ok(await page.$("#q2"), "a question went away by itself");
  await page.click("#q2 >>> [data-action='yes']");
  assert.deepEqual(await page.evaluate(() => window.__q2), { action: "yes", trusted: true, toggle: false });
  assert.equal(await page.evaluate(() => document.activeElement?.id), "page-field", "the focus came back");

  // Esc closes the popup — and only the popup (the dock stays)
  await page.evaluate(() => { globalThis.__draftPopups.show({ id: "q3", kind: "question", text: "Read this page?", theme: window.__th, actions: [{ id: "ok", label: "Read", icon: "read" }] }).then(a => { window.__q3 = a; }); });
  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => window.__q3?.action), "dismissed");
  assert.ok(await page.$("#rm-draft-dock"), "Esc on a popup closed the dock too");

  // the Settings gear: the person's click asks for the settings page AT that section
  await page.evaluate(() => { globalThis.__draftPopups.show({ id: "p1", kind: "question", text: "Allow draft on this site", settings: "permissions", theme: window.__th,
    actions: [{ id: "allow", label: "Allow", word: "Allow", primary: true }] }); });
  await page.evaluate(() => document.getElementById("p1").shadowRoot.querySelector('[data-role="popup-settings"]').click());
  assert.deepEqual(await page.evaluate(() => window.__sent.filter(m => m.type === "OPEN_SETTINGS")), [], "a synthetic click opens nothing");
  await page.evaluate(() => { globalThis.__draftPopups.show({ id: "p2", kind: "question", text: "Allow draft on this site", settings: "permissions", theme: window.__th,
    actions: [{ id: "allow", label: "Allow", word: "Allow", primary: true }] }); });
  await page.click("#p2 >>> [data-role='popup-settings']");
  assert.deepEqual(await page.evaluate(() => window.__sent.filter(m => m.type === "OPEN_SETTINGS")), [{ type: "OPEN_SETTINGS", trigger: "click", section: "permissions" }]);
});
