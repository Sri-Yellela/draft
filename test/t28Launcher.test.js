// T28 (owner, 10-19) · THE LAUNCHER — "the floating panel that opens and closes should be a SQUARE BOX WITH THE DRAFT
// LOGO and that's it — just like the /d button on the job posting; click it to open and close."
//
// The dock, collapsed, is a 52px square: the /d mark on the one accent, the board's depth, a dot when something needs
// you — no word on screen (its words are its name and tooltip). It sits ON a screen edge, drags along it, snaps to the
// nearest edge when let go, and is remembered per site apart from the open dock's rectangle; it steps across the
// screen when a page field in focus is under it; a click opens the dock and a drag does not.
//
// Part 1 is the pure geometry; Part 2 drives the real dock.js in headless Chrome (SKIPS, saying why, with no Chrome).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import vm from "node:vm";
import { findChrome } from "../test-support/extensionBrowser.mjs";
import { dockPlaceRecord } from "../extension/dockHost.js";
import { C_LIGHT, C_DARK } from "../extension/tokens.js";

const DOCK = fs.readFileSync("extension/dock.js", "utf8");
const ctx = vm.createContext({ window: {}, Math, Number, Object, Array, String, Set, Map, JSON, Error });
ctx.window.top = ctx.window; ctx.globalThis = ctx;
vm.runInContext(DOCK, ctx);
const D = ctx.__draftDock;
const plain = (o) => JSON.parse(JSON.stringify(o));

test("T28 ① the launcher's square sits ON the nearest edge; with no spot of its own it takes the open dock's side", () => {
  const vp = { w: 1280, h: 900 };
  assert.deepEqual(plain(D.snapLaunch({ x: 600, y: 20, w: 52, h: 52 }, vp)), { x: 600, y: 8, w: 52, h: 52, edge: "top" });
  assert.deepEqual(plain(D.snapLaunch({ x: 1200, y: 400, w: 52, h: 52 }, vp)), { x: 1220, y: 400, w: 52, h: 52, edge: "right" });
  assert.deepEqual(plain(D.snapLaunch({ x: -50, y: 2000, w: 52, h: 52 }, vp)), { x: 8, y: 840, w: 52, h: 52, edge: "left" }, "off screen comes back on");
  assert.equal(D.launchRect({ rect: { x: 20, y: 100, w: 380, h: 600 } }, vp).x, 8, "a dock on the left leaves its launcher on the left");
  assert.equal(D.launchRect({ rect: { x: 880, y: 100, w: 380, h: 600 } }, vp).x, 1220);
  assert.equal(D.launchRect({ rect: { x: 880, y: 100, w: 380, h: 600 }, launch: { x: 8, y: 500 } }, vp).x, 8, "its own remembered spot wins");
  // remembered per site — two numbers, and nothing when there are none
  assert.deepEqual(dockPlaceRecord({ launch: { x: 8.4, y: 500.6 } }, 1).launch, { x: 8, y: 501 });
  assert.equal("launch" in dockPlaceRecord({ launch: { x: "8", y: 1 } }, 1), false);
  assert.deepEqual(plain(D.cleanPlace({ launch: { x: 3, y: 4 } })).launch, { x: 3, y: 4 });
  // ⭐ audit 10-25: the spot names its EDGE and how far along it — another window size puts it back on THAT edge
  const spot = plain(D.launchSpot(D.snapLaunch({ x: 1220, y: 424, w: 52, h: 52 }, vp), vp));
  assert.deepEqual([spot.edge, spot.x, spot.y], ["right", 1220, 424]);
  const wide = { w: 1920, h: 1080 };
  const there = plain(D.launchRect({ launch: spot }, wide));
  assert.deepEqual([there.edge, there.x], ["right", 1860], "still on the right edge in a 1920px window — not mid-screen on the top");
  assert.ok(Math.abs(there.y - Math.round(8 + spot.f * (1080 - 16 - 52))) <= 1, "the same way along it");
  assert.deepEqual(dockPlaceRecord({ launch: spot }, 1).launch, { x: 1220, y: 424, edge: "right", f: spot.f });
  assert.deepEqual(plain(D.cleanPlace({ launch: { x: 1, y: 2, edge: "nope", f: 9 } })).launch, { x: 1, y: 2 }, "an edge it cannot name is dropped");
});

const chrome = await findChrome();
const SKIP = chrome.skip || false;
const STUB = `window.__sent = []; window.chrome = { runtime: { lastError: null, sendMessage(m, cb) { window.__sent.push(m); cb && cb({ ok: true }); } } };`;

test("T28 · the launcher in a REAL Chrome — one square, no words; click opens, minimise closes; a drag snaps and is remembered and opens nothing; keys; the dot; out of the field's way", { skip: SKIP, timeout: 90000 }, async (t) => {
  const server = http.createServer((_q, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end(`<!doctype html><title>Acme</title><body style="margin:0;height:2000px">
    <input id="under" style="position:fixed;right:10px;top:420px;width:120px;height:40px">`); });
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
  await page.evaluate((th) => { globalThis.__draftDock.ensure({ theme: th, place: { collapsed: true } }); }, { light: C_LIGHT, dark: C_DARK });
  const look = () => page.evaluate(() => {
    const host = document.getElementById("rm-draft-dock"), root = host.shadowRoot, b = host.getBoundingClientRect();
    const words = []; const w = document.createTreeWalker(root.querySelector(".fr"), NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) if (n.textContent.trim() && !n.parentElement.closest(".sr, .mk")) words.push(n.textContent.trim());
    const l = root.querySelector(".launch");
    return { x: b.left, y: b.top, w: b.width, h: b.height, collapsed: host.dataset.collapsed, words, launcher: !!l, name: l?.getAttribute("aria-label") || null,
      title: l?.title || null, dot: !!root.querySelector('[data-role="need-dot"]'), bg: l ? getComputedStyle(l).backgroundColor : null };
  });
  let s = await look();
  assert.ok(s.launcher && s.w === 52 && s.h === 52, `closed = one 52px square: ${JSON.stringify(s)}`);
  assert.deepEqual(s.words, [], "no word on the launcher");
  assert.ok(s.name && s.title, "named and with a tooltip");
  assert.equal(s.x, 1220, "on the right edge, level with where the open dock's top would be");
  // the dot: something needs you
  await page.evaluate(() => globalThis.__draftDock.current().summary("fill", "2 need you · 14 of 18 filled", { need: 2, filled: 14, total: 18 }));
  s = await look();
  assert.ok(s.dot, "a dot when something needs you");
  assert.match(s.name, /2 need you/, "the launcher's NAME says what needs you");
  // a drag along the screen: free while held, onto the nearest edge when let go, remembered — and it opens nothing
  await page.mouse.move(s.x + 26, s.y + 26); await page.mouse.down(); await page.mouse.move(900, 300, { steps: 6 }); await page.mouse.move(640, 40, { steps: 6 }); await page.mouse.up();
  await new Promise(r => setTimeout(r, 260));
  s = await look();
  assert.equal(s.collapsed, "true", "a drag opened the dock");
  assert.equal(s.y, 8, `snapped onto the top edge: ${JSON.stringify(s)}`);
  const placed = await page.evaluate(() => window.__sent.filter(m => m.type === "DOCK_PLACE").at(-1)?.place);
  assert.deepEqual([placed?.launch?.y, placed?.collapsed], [8, true], "remembered for the site");
  // keys: arrows move it along its edge
  await page.focus("#rm-draft-dock >>> [data-role='expand']");
  const x0 = (await look()).x;
  await page.keyboard.press("ArrowRight");
  assert.equal((await look()).x, x0 + 16, "an arrow moves it");
  // a click opens the dock; minimise brings the square back
  await page.click("#rm-draft-dock >>> [data-role='expand']");
  s = await look();
  assert.ok(s.collapsed === "false" && s.w > 52, "a click opened the dock");
  await page.click("#rm-draft-dock >>> [data-role='collapse']");
  s = await look();
  assert.ok(s.launcher && s.y === 8, "minimise: the square again, where it was");
  // out of the way: a page field in focus under it — the launcher steps across the screen
  await page.evaluate(() => globalThis.__draftDock.current().frame.place = { ...globalThis.__draftDock.current().frame.place, launch: { x: 1220, y: 414 } });
  await page.evaluate(() => globalThis.__draftDock.current().frame.draw());
  await page.focus("#under");
  s = await look();
  assert.equal(s.x, 8, `it moved off the field in focus: ${JSON.stringify(s)}`);
});
