// ⭐ T17 · THE DOCK IN A REAL CHROME — extension/dock.js on a real page (its own stylesheet, real pointer and keyboard
// events, a real cross-origin child frame). What the owner asked for (field report 10-15, (a) + (g)):
//   · ⛔ it never mounts inside a child frame — the page's iframe on ANOTHER ORIGIN gets nothing; the top frame gets one
//   · at four viewport sizes it never extends past the viewport (saved rectangles from a bigger screen included)
//   · drag by the header, resize from an edge and a corner, snap (pointer at the screen's edge), collapse — each change
//     is sent to be remembered (DOCK_PLACE) and a new page restores it
//   · keyboard-operable: Move (arrows, Ctrl+arrow snaps), Resize (arrows), the tabs (arrows), Esc
//   · the four themes: the frame is painted from the palette it is handed, and the shape cues add a shape
//   · a tab pops out into its own window and comes back, its view intact
// The extension's own wiring (the service worker draws it only at frame 0, the per-site record in chrome.storage) is
// walked with the real extension in test/t11EmbeddedChrome.test.js. Skips, with its reason, where there is no Chrome.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import { findChrome } from "../test-support/extensionBrowser.mjs";
import { C_LIGHT, C_DARK, C_CONTRAST_LIGHT, C_CONTRAST_DARK } from "../extension/tokens.js";

const chrome = await findChrome();
const SKIP = chrome.skip || false;
const DOCK = fs.readFileSync("extension/dock.js", "utf8");

/** Two origins: the page on one port, its iframe on another — a cross-origin child frame, as Greenhouse's is. */
async function servers(t) {
  const frame = http.createServer((_q, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end("<!doctype html><html><body><form><label for=a>First</label><input id=a></form></body></html>"); });
  await new Promise(r => frame.listen(0, "127.0.0.1", r));
  const framePort = frame.address().port;
  const page = http.createServer((q, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(`<!doctype html><html><head><title>Acme careers</title></head><body style="margin:0;height:3000px">
      <h1>Software Engineer</h1><label for="city">City</label><input id="city" style="position:absolute;right:40px;top:200px;width:200px">
      <iframe id="embedded" src="http://localhost:${framePort}/apply" style="width:600px;height:400px;border:0"></iframe></body></html>`);
  });
  await new Promise(r => page.listen(0, "127.0.0.1", r));
  t.after(() => { frame.close(); page.close(); });
  return { url: `http://127.0.0.1:${page.address().port}/jobs/1`, framePort };
}

const STUB = `window.__sent = []; window.chrome = { runtime: { lastError: null, sendMessage(m, cb) { window.__sent.push(m); cb && cb(m.type === 'DOCK_TAB' ? { ok: false, message: 'no server here' } : { ok: true }); } } };`;
const meta = (theme = { light: C_LIGHT, dark: C_DARK }, place = null, cues = false) => ({ theme, place, cues });

async function launch(t) {
  const puppeteer = (await import("puppeteer-core")).default;
  const browser = await puppeteer.launch({ executablePath: chrome.path, headless: true, pipe: true, args: ["--no-first-run", "--site-per-process"] });
  t.after(() => browser.close());
  return browser;
}
async function openPage(browser, url, viewport = { width: 1280, height: 900 }) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.goto(url, { waitUntil: "load" });
  await page.evaluate(STUB);
  await page.addScriptTag({ content: DOCK });
  return page;
}
const rect = (page) => page.evaluate(() => { const b = document.getElementById("rm-draft-dock").getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height, vw: document.documentElement.clientWidth, vh: innerHeight }; });
const within = (r) => r.x >= 0 && r.y >= 0 && r.x + r.w <= r.vw + 0.5 && r.y + r.h <= r.vh + 0.5;
const places = (page) => page.evaluate(() => window.__sent.filter(m => m.type === "DOCK_PLACE").map(m => m.place));
const settle = (page) => page.evaluate(() => new Promise(r => setTimeout(r, 260)));   // the place is sent 200 ms after a change

test("⛔ T17: the dock mounts in the TOP frame and NEVER inside a child frame (a cross-origin iframe, as Greenhouse's on stripe.com)", { skip: SKIP, timeout: 90000 }, async (t) => {
  const { url, framePort } = await servers(t);
  const browser = await launch(t);
  const page = await openPage(browser, url);
  const child = page.frames().find(f => f.url().includes(`:${framePort}/`));
  assert.ok(child, "the cross-origin child frame loaded");
  await child.evaluate(STUB);
  await child.addScriptTag({ content: DOCK });
  const inChild = await child.evaluate((m) => ({ isTop: globalThis.__draftDock.isTop(), dock: !!globalThis.__draftDock.ensure(m), hosts: document.querySelectorAll("[data-draft-dock]").length }), meta());
  assert.deepEqual(inChild, { isTop: false, dock: false, hosts: 0 }, "a child frame draws nothing");
  const inTop = await page.evaluate((m) => ({ isTop: globalThis.__draftDock.isTop(), dock: !!globalThis.__draftDock.ensure(m), hosts: document.querySelectorAll("[data-draft-dock]").length }), meta());
  assert.deepEqual(inTop, { isTop: true, dock: true, hosts: 1 });
  // a view on it lives in the top document, a light-DOM child of the dock with its own shadow root
  const v = await page.evaluate(() => { const el = globalThis.__draftDock.current().view("fill", { id: "v-fill" }); el.attachShadow({ mode: "open" }).innerHTML = "<p>rows</p>"; return { parent: el.parentElement.id, slot: el.slot }; });
  assert.deepEqual(v, { parent: "rm-draft-dock", slot: "view-fill" });
  assert.equal(await page.evaluate(() => document.body.contains(document.getElementById("rm-draft-dock"))), false, "on <html>, never in <body> — the form probes never see it");
});

test("⛔ T17: at four viewport sizes the dock never extends past the viewport — fresh, from a bigger screen's saved rectangle, snapped, collapsed", { skip: SKIP, timeout: 120000 }, async (t) => {
  const { url } = await servers(t);
  const browser = await launch(t);
  const sizes = [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 375, height: 667 }];
  const saved = { rect: { x: 1500, y: 700, w: 900, h: 1400 }, edge: null, collapsed: false, tab: "fill" };
  for (const vp of sizes) {
    const page = await openPage(browser, url, vp);
    await page.evaluate((m) => globalThis.__draftDock.ensure(m), meta());
    assert.ok(within(await rect(page)), `${vp.width}×${vp.height} fresh: ${JSON.stringify(await rect(page))}`);
    await page.evaluate(() => globalThis.__draftDock.current().close());
    await page.evaluate((m) => globalThis.__draftDock.ensure(m), meta(undefined, saved));
    const r = await rect(page);
    assert.ok(within(r), `${vp.width}×${vp.height} from a saved 900×1400 at (1500, 700): ${JSON.stringify(r)}`);
    for (const edge of ["left", "right", "top", "bottom"]) {
      await page.evaluate((m) => { globalThis.__draftDock.current()?.close(); globalThis.__draftDock.ensure(m); }, meta(undefined, { ...saved, edge }));
      assert.ok(within(await rect(page)), `${vp.width}×${vp.height} snapped ${edge}: ${JSON.stringify(await rect(page))}`);
    }
    await page.evaluate(() => globalThis.__draftDock.current().collapse());
    assert.ok(within(await rect(page)), `${vp.width}×${vp.height} collapsed`);
    // the window shrinks under it: it follows
    await page.evaluate(() => globalThis.__draftDock.current().expand());
    await page.setViewport({ width: Math.round(vp.width * 0.7), height: Math.round(vp.height * 0.7) });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    assert.ok(within(await rect(page)), `${vp.width}×${vp.height} → 70%: ${JSON.stringify(await rect(page))}`);
    await page.close();
  }
});

test("⛔ T17: drag by the header, resize from an edge and a corner, snap at the screen's edge, collapse — each is sent to be remembered, and a new page restores it", { skip: SKIP, timeout: 90000 }, async (t) => {
  const { url } = await servers(t);
  const browser = await launch(t);
  const page = await openPage(browser, url);
  await page.evaluate((m) => globalThis.__draftDock.ensure(m), meta());
  const r0 = await rect(page);
  const head = await page.evaluateHandle(() => document.getElementById("rm-draft-dock").shadowRoot.querySelector(".hd"));
  const hb = await head.asElement().boundingBox();
  // drag by the header (on the mark, not a button)
  await page.mouse.move(hb.x + 20, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x - 300, hb.y + 100, { steps: 8 });
  await page.mouse.up();
  await settle(page);
  const r1 = await rect(page);
  // (the pointer went from the header's middle to 100 px below the header's top — and across the page's iframe, which
  // must not swallow the drag)
  assert.ok(Math.abs(r1.x - (r0.x - 320)) <= 2 && Math.abs(r1.y - (r0.y + 100 - hb.height / 2)) <= 2, `moved: ${JSON.stringify({ r0, r1 })}`);
  let p = (await places(page)).at(-1);
  assert.deepEqual([p.rect.x, p.rect.y], [Math.round(r1.x), Math.round(r1.y)], "the new place is sent");
  // resize from the right edge, then the bottom-left corner
  const handle = async (h) => (await page.evaluateHandle((x) => document.getElementById("rm-draft-dock").shadowRoot.querySelector(`.rz[data-handle="${x}"]`), h)).asElement().boundingBox();
  const e = await handle("e");
  await page.mouse.move(e.x + e.width / 2, e.y + 40);
  await page.mouse.down();
  await page.mouse.move(e.x + e.width / 2 + 120, e.y + 40, { steps: 6 });
  await page.mouse.up();
  const r2 = await rect(page);
  assert.ok(Math.abs(r2.w - (r1.w + 120)) <= 2 && Math.abs(r2.x - r1.x) <= 1, `wider from the right edge: ${JSON.stringify({ r1, r2 })}`);
  const sw = await handle("sw");
  await page.mouse.move(sw.x + sw.width / 2, sw.y + sw.height / 2);
  await page.mouse.down();
  await page.mouse.move(sw.x + sw.width / 2 + 60, sw.y + sw.height / 2 - 80, { steps: 6 });
  await page.mouse.up();
  const r3 = await rect(page);
  assert.ok(Math.abs(r3.w - (r2.w - 60)) <= 2 && Math.abs(r3.x + r3.w - (r2.x + r2.w)) <= 1 && Math.abs(r3.h - (r2.h - 80)) <= 2, `the corner: the right edge stays: ${JSON.stringify({ r2, r3 })}`);
  // never below the minimum
  const sw2 = await handle("sw");
  await page.mouse.move(sw2.x + 5, sw2.y + 5);
  await page.mouse.down();
  await page.mouse.move(sw2.x + 2000, sw2.y - 2000, { steps: 4 });
  await page.mouse.up();
  const r4 = await rect(page);
  assert.ok(r4.w >= 299 && r4.h >= 219, `the minimum holds: ${JSON.stringify(r4)}`);
  // snap: the pointer let go AT the screen's left edge
  const hb2 = await (await page.evaluateHandle(() => document.getElementById("rm-draft-dock").shadowRoot.querySelector(".hd"))).asElement().boundingBox();
  await page.mouse.move(hb2.x + 20, hb2.y + 10);
  await page.mouse.down();
  await page.mouse.move(1, 300, { steps: 8 });
  await page.mouse.up();
  await settle(page);
  const r5 = await rect(page);
  assert.ok(r5.x <= 8.5 && r5.y <= 8.5 && r5.h >= r5.vh - 17, `snapped left — a full-height column: ${JSON.stringify(r5)}`);
  p = (await places(page)).at(-1);
  assert.equal(p.edge, "left");
  // collapse: the slim bar, remembered
  await page.click("#rm-draft-dock >>> [data-role='collapse']");
  await settle(page);
  assert.ok((await rect(page)).h <= 44.5, "collapsed to the slim bar");
  p = (await places(page)).at(-1);
  assert.equal(p.collapsed, true);
  // a new page on the same site, handed what was sent, opens exactly there
  const page2 = await openPage(browser, url);
  await page2.evaluate((m) => globalThis.__draftDock.ensure(m), meta(undefined, p));
  const back = await rect(page2);
  assert.ok(back.x <= 8.5 && back.h <= 44.5, `restored: snapped left and collapsed: ${JSON.stringify(back)}`);
  await page2.click("#rm-draft-dock >>> [data-role='expand']");
  const open = await rect(page2);
  assert.ok(Math.abs(open.w - r4.w) <= 2 && open.h >= open.vh - 17, `expanded: the remembered width, the full-height column: ${JSON.stringify({ open, r4 })}`);
});

test("⛔ T17: keyboard-operable — Move (arrows, Ctrl+arrow snaps), Resize (arrows), the tabs (arrows), Esc closes", { skip: SKIP, timeout: 90000 }, async (t) => {
  const { url } = await servers(t);
  const browser = await launch(t);
  const page = await openPage(browser, url);
  await page.evaluate((m) => globalThis.__draftDock.ensure(m), meta(undefined, { rect: { x: 600, y: 100, w: 380, h: 500 } }));
  const r0 = await rect(page);
  await page.focus("#rm-draft-dock >>> [data-role='move']");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.down("Shift"); await page.keyboard.press("ArrowDown"); await page.keyboard.up("Shift");
  const r1 = await rect(page);
  assert.deepEqual([r1.x, r1.y], [r0.x - 16, r0.y + 64], "16 px a press, 64 with Shift");
  await page.keyboard.down("Control"); await page.keyboard.press("ArrowRight"); await page.keyboard.up("Control");
  const r2 = await rect(page);
  assert.ok(r2.x + r2.w >= r2.vw - 8.5 && r2.h >= r2.vh - 17, `Ctrl+→ snaps it to the right edge: ${JSON.stringify(r2)}`);
  await page.focus("#rm-draft-dock >>> [data-role='resize']");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const r3 = await rect(page);
  assert.ok(Math.abs(r3.w - (r2.w + 16)) <= 1, `Resize → is 16 px wider: ${JSON.stringify({ r2, r3 })}`);
  // the tabs: a real tablist, arrows move between them
  await page.focus("#rm-draft-dock >>> [data-role='tab'][data-tab='fill']");
  await page.keyboard.press("ArrowRight");
  const sel = await page.evaluate(() => [...document.getElementById("rm-draft-dock").shadowRoot.querySelectorAll('[role="tab"]')].map(b => [b.dataset.tab, b.getAttribute("aria-selected")]));
  assert.deepEqual(sel, [["fill", "false"], ["ats", "true"], ["resume", "false"], ["copy", "false"]]);
  assert.equal(await page.evaluate(() => document.getElementById("rm-draft-dock").shadowRoot.activeElement?.dataset.tab), "ats", "the focus follows the tab");
  // Esc in a page FIELD is the page's (its dropdowns); Esc from inside the dock closes it
  await page.focus("#city");
  await page.keyboard.press("Escape");
  assert.ok(await page.$("#rm-draft-dock"), "Esc in a page field is the page's");
  await page.focus("#rm-draft-dock >>> [data-role='move']");
  await page.keyboard.press("Escape");
  assert.equal(await page.$("#rm-draft-dock"), null, "Esc closes the dock");
});

test("⛔ T17: never over the field being typed in — a page field focused under the dock sends it to the other side", { skip: SKIP, timeout: 60000 }, async (t) => {
  const { url } = await servers(t);
  const browser = await launch(t);
  const page = await openPage(browser, url);
  await page.evaluate((m) => globalThis.__draftDock.ensure(m), meta());
  assert.equal(await page.evaluate(() => document.getElementById("rm-draft-dock").dataset.side), "right");
  await page.evaluate(() => document.getElementById("city").focus({ preventScroll: true }));
  const r = await page.evaluate(() => { const a = document.getElementById("rm-draft-dock").getBoundingClientRect(); const b = document.getElementById("city").getBoundingClientRect(); return { side: document.getElementById("rm-draft-dock").dataset.side, over: !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom) }; });
  assert.deepEqual(r, { side: "left", over: false });
});

test("⛔ T17: the four themes — the frame is painted from the palette it is handed, light and dark by the OS, and the shape cues add a shape", { skip: SKIP, timeout: 90000 }, async (t) => {
  const { url } = await servers(t);
  const browser = await launch(t);
  const hex = (rgb) => "#" + rgb.match(/\d+/g).slice(0, 3).map(n => Number(n).toString(16).padStart(2, "0")).join("").toUpperCase();
  const cases = [
    ["system, light OS", { light: C_LIGHT, dark: C_DARK }, "light", C_LIGHT],
    ["system, dark OS", { light: C_LIGHT, dark: C_DARK }, "dark", C_DARK],
    ["contrast, light OS", { light: C_CONTRAST_LIGHT, dark: C_CONTRAST_DARK }, "light", C_CONTRAST_LIGHT],
    ["contrast, dark OS", { light: C_CONTRAST_LIGHT, dark: C_CONTRAST_DARK }, "dark", C_CONTRAST_DARK],
  ];
  for (const [name, theme, os, want] of cases) {
    const page = await openPage(browser, url);
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: os }]);
    await page.evaluate((m) => globalThis.__draftDock.ensure(m), meta(theme, null, name.startsWith("contrast")));
    const got = await page.evaluate(() => { const r = document.getElementById("rm-draft-dock").shadowRoot; const tab = r.querySelector('[aria-selected="true"]'); return {
      ink: getComputedStyle(r.querySelector(".fr")).color, cues: document.getElementById("rm-draft-dock").getAttribute("data-cues"),
      before: getComputedStyle(tab, "::before").content, radius: Math.max(...[...r.querySelectorAll("button, .fr")].map(b => parseFloat(getComputedStyle(b).borderTopRightRadius) || 0)) }; });
    assert.equal(hex(got.ink), want.INK.toUpperCase(), `${name}: the ink is the palette's`);
    assert.ok(got.radius <= 10, `${name}: D60 — no capsule (max radius ${got.radius})`);
    if (name.startsWith("contrast")) { assert.equal(got.cues, "shape"); assert.match(got.before, /▸/, "the selected tab carries a shape, not colour alone"); }
    else assert.equal(got.cues, null);
    await page.close();
  }
});

test("⛔ T17: a tab pops out into its own window — the same frame (drag, resize, close) — and comes back with its view intact", { skip: SKIP, timeout: 60000 }, async (t) => {
  const { url } = await servers(t);
  const browser = await launch(t);
  const page = await openPage(browser, url);
  await page.evaluate((m) => {
    const d = globalThis.__draftDock.ensure(m);
    const el = d.view("copy", { id: "v-copy" });
    el.attachShadow({ mode: "open" }).innerHTML = '<input id="kept" value="typed by you">';
  }, meta());
  await page.click("#rm-draft-dock >>> [data-role='pop']");
  const popped = await page.evaluate(() => ({ pop: !!document.getElementById("rm-draft-pop-copy"), parent: document.getElementById("v-copy").parentElement.id,
    handles: document.getElementById("rm-draft-pop-copy").shadowRoot.querySelectorAll(".rz").length,
    note: document.getElementById("rm-draft-dock").shadowRoot.querySelector('[data-role="popped"]')?.textContent.trim() }));
  assert.equal(popped.pop, true);
  assert.equal(popped.parent, "rm-draft-pop-copy", "the view moved into the pop-out window");
  assert.equal(popped.handles, 8, "the pop-out is the same frame: eight resize handles");
  assert.match(popped.note, /open in its own window/);
  await settle(page);
  assert.deepEqual((await places(page)).at(-1).popped, ["copy"], "remembered as popped out");
  await page.click("#rm-draft-pop-copy >>> [data-role='dock-back']");
  const back = await page.evaluate(() => ({ pop: !!document.getElementById("rm-draft-pop-copy"), parent: document.getElementById("v-copy").parentElement.id,
    kept: document.getElementById("v-copy").shadowRoot.getElementById("kept").value }));
  assert.deepEqual(back, { pop: false, parent: "rm-draft-dock", kept: "typed by you" });
});

test("⛔ T17: a tab with no view is drawn on the user's own press only — a page script's click asks for nothing", { skip: SKIP, timeout: 60000 }, async (t) => {
  const { url } = await servers(t);
  const browser = await launch(t);
  const page = await openPage(browser, url);
  await page.evaluate((m) => globalThis.__draftDock.ensure(m), meta());
  await page.evaluate(() => document.getElementById("rm-draft-dock").shadowRoot.querySelector('[data-tab="ats"]').click());
  assert.deepEqual(await page.evaluate(() => window.__sent.filter(m => m.type === "DOCK_TAB")), [], "a synthetic click loads nothing");
  await page.click("#rm-draft-dock >>> [data-role='tab'][data-tab='resume']");
  await page.waitForFunction(() => window.__sent.some(m => m.type === "DOCK_TAB"));
  assert.deepEqual(await page.evaluate(() => window.__sent.filter(m => m.type === "DOCK_TAB")), [{ type: "DOCK_TAB", tab: "resume", trigger: "click" }]);
  assert.match(await page.evaluate(() => document.getElementById("rm-draft-dock").shadowRoot.querySelector('[data-role="load-error"]')?.textContent || ""), /no server here/,
    "a tab that could not be drawn says why");
});
