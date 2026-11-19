// ⭐ T17 · ONE FLOATING DOCK, TOP FRAME ONLY (field report 10-15, (a) + (g)) — the parts that need no browser.
//
// The owner: the review panel was baked into the application form's iframe (cut off by the frame's edge, or covering
// the form), the popup could not be resized or stay open, and "the floating logic and every other reusable piece must
// be MODULAR". So:
//   1. the geometry (extension/dock.js, pure): at FOUR viewport sizes nothing extends past the viewport — a fresh dock,
//      a rectangle saved on a bigger screen, every snapped edge, collapsed; resize keeps the minimum and the maximum
//   2. ⛔ the TOP FRAME ONLY: dock.js refuses a child frame; the service worker injects the dock and every view at
//      frame 0 and nowhere else; the form's own frame is reached only for its fields (by tabId + frameId)
//   3. ⛔ ONE module: none of the four views (Fill · ATS · Résumé · Copy sheet) — nor the status line — carries drag,
//      resize, snap, collapse or placement code of its own; each asks dock.js for its host
//   4. the rectangle remembered PER SITE: named fields only, one write site, 50 sites, 30 days; only a page's top frame
//      may write it
//   5. the four themes and the cues: the account's appearance picks the palettes; the frame paints only var(--c-*)
//   6. no new permission; the dock ships in the package (the builder follows `files: ['dock.js']`)
// The real-Chrome half: test/t17DockChrome.test.js (the dock itself) and test/t11EmbeddedChrome.test.js (the extension
// on an employer page that embeds the ATS form in a cross-origin frame).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { at } from "../test-support/sourceAnchors.js";
import { C_LIGHT, C_DARK, C_CONTRAST_LIGHT, C_CONTRAST_DARK, EXT_THEMES } from "../extension/tokens.js";
import { collectRequiredFiles } from "../scripts/buildExtension.mjs";

const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const stripJs = (s) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const DOCK_SRC = read("extension/dock.js");

/** dock.js in a sandbox: `top` decides whether this "window" is the top frame. Returns globalThis.__draftDock. */
function loadDock({ top = true } = {}) {
  const win = {};
  win.top = top ? win : {};
  const ctx = vm.createContext({ window: win, Math, Number, Object, Array, String, Set, Map, JSON, Error });
  ctx.globalThis = ctx;
  vm.runInContext(DOCK_SRC, ctx);
  return ctx.__draftDock;
}
const D0 = loadDock();
// the sandbox's objects are another realm's — compare them as plain data
const plain = (x) => JSON.parse(JSON.stringify(x));
const D = Object.fromEntries(Object.entries(D0).map(([k, v]) => [k, typeof v === "function" && !/^(ensure|isTop|current)$/.test(k)
  ? (...a) => { const r = v(...a); return r && typeof r === "object" ? plain(r) : r; } : v]));

// ── 1 · the geometry ──────────────────────────────────────────────────────────────────────────────────────────────
const SIZES = [{ w: 1440, h: 900 }, { w: 1024, h: 768 }, { w: 768, h: 1024 }, { w: 375, h: 667 }];
const inside = (r, vp) => r.x >= 0 && r.y >= 0 && r.x + r.w <= vp.w && r.y + r.h <= vp.h && r.w > 0 && r.h > 0;

test("⛔ T17: at FOUR viewport sizes the dock never extends past the viewport — fresh, saved on a bigger screen, every edge, collapsed", () => {
  const saved = [{ x: 1500, y: 700, w: 900, h: 1400 }, { x: -400, y: -300, w: 100, h: 50 }, { x: 10, y: 10, w: 5000, h: 5000 }, { x: NaN, y: "x", w: null, h: undefined }];
  for (const vp of SIZES) {
    assert.ok(inside(D.defaultRect(vp), vp), `${vp.w}×${vp.h} fresh`);
    for (const rect of saved) {
      for (const edge of [null, "left", "right", "top", "bottom"]) {
        for (const collapsed of [false, true]) {
          const r = D.layoutRect({ rect, edge, collapsed }, vp);
          assert.ok(inside(r, vp), `${vp.w}×${vp.h} ${JSON.stringify({ rect, edge, collapsed })} → ${JSON.stringify(r)}`);
        }
      }
    }
  }
});

test("T17: the size bounds — a minimum and a maximum, the minimum giving way only to a viewport smaller than it", () => {
  const vp = { w: 1280, h: 900 };
  const L = D.limitsFor(vp);
  assert.deepEqual([L.minW, L.minH, L.maxW, L.maxH], [300, 220, 760, 884]);
  const r = { x: 400, y: 100, w: 400, h: 500 };
  assert.deepEqual(D.resizeRect(r, "e", -1000, 0, vp).w, 300, "never narrower than the minimum");
  assert.deepEqual(D.resizeRect(r, "e", 5000, 0, vp).w, 760, "never wider than the maximum");
  assert.deepEqual(D.resizeRect(r, "s", 0, -1000, vp).h, 220);
  // a corner moves only its own edges: from the north-west, the south-east corner stays put
  const nw = D.resizeRect(r, "nw", -50, -40, vp);
  assert.deepEqual(nw, { x: 350, y: 60, w: 450, h: 540 });
  assert.equal(nw.x + nw.w, r.x + r.w); assert.equal(nw.y + nw.h, r.y + r.h);
  const tiny = D.limitsFor({ w: 280, h: 200 });
  assert.deepEqual([tiny.minW, tiny.maxW, tiny.minH, tiny.maxH], [264, 264, 184, 184], "a viewport smaller than the minimum: the minimum gives way");
});

test("T17: snap — a full-height column at left / right, a full-width band at top / bottom; the pointer AT the screen's edge snaps", () => {
  const vp = { w: 1280, h: 900 };
  const rect = { x: 500, y: 200, w: 400, h: 500 };
  assert.deepEqual(D.layoutRect({ rect, edge: "left" }, vp), { x: 8, y: 8, w: 400, h: 884 });
  assert.deepEqual(D.layoutRect({ rect, edge: "right" }, vp), { x: 872, y: 8, w: 400, h: 884 });
  assert.deepEqual(D.layoutRect({ rect, edge: "top" }, vp), { x: 8, y: 8, w: 1264, h: 500 });
  assert.deepEqual(D.layoutRect({ rect, edge: "bottom" }, vp), { x: 8, y: 392, w: 1264, h: 500 });
  assert.equal(D.edgeAtPointer(2, 400, vp), "left");
  assert.equal(D.edgeAtPointer(1278, 400, vp), "right");
  assert.equal(D.edgeAtPointer(600, 1, vp), "top");
  assert.equal(D.edgeAtPointer(600, 898, vp), "bottom");
  assert.equal(D.edgeAtPointer(600, 400, vp), null, "a drag that ends inside the screen does not snap");
  // collapsed, the slim bar keeps the rectangle's corner (or the snapped edge) and is the slim height
  assert.deepEqual(D.layoutRect({ rect, edge: null, collapsed: true }, vp), { x: 500, y: 200, w: 400, h: 44 });
  assert.deepEqual(D.layoutRect({ rect, edge: "right", collapsed: true }, vp), { x: 872, y: 8, w: 400, h: 44 });
  assert.deepEqual(D.layoutRect({ rect, edge: "bottom", collapsed: true }, vp).y, 848);
});

test("T17: a saved place is cleaned to its named fields — finite numbers, a known edge and tab, nothing else", () => {
  const p = D.cleanPlace({ rect: { x: 1.4, y: 2.6, w: 300, h: 400, extra: 1 }, edge: "diagonal", collapsed: "yes", tab: "secrets", pops: { copy: { x: 1, y: 2, w: 3, h: 4 }, evil: { x: 1, y: 1, w: 1, h: 1 }, ats: { x: 1 } }, html: "<script>" });
  assert.deepEqual(JSON.parse(JSON.stringify(p)), { rect: { x: 1, y: 3, w: 300, h: 400 }, edge: null, collapsed: false, tab: "draft", pops: { copy: { x: 1, y: 2, w: 3, h: 4 } } });   // ⭐ D191 sketch 2: an unknown tab → the panel, the home
  assert.deepEqual([...D.TAB_IDS], ["draft", "fill", "ats", "resume", "copy"], "ONE dock: the panel (This job, D191 sketch 2) · Fill · ATS · Résumé · Copy sheet");
});

// ── 2 · the top frame only ────────────────────────────────────────────────────────────────────────────────────────
test("⛔ T17: dock.js refuses a child frame — ensure() is null and draws nothing where window.top is not this window", () => {
  const child = loadDock({ top: false });
  assert.equal(child.isTop(), false);
  assert.equal(child.ensure({}), null, "a child frame gets no dock");
  // and the refusal is the FIRST thing ensure does
  const ensure = DOCK_SRC.slice(at(DOCK_SRC, "function ensure(meta = {}) {"));
  assert.match(ensure.slice(0, 200), /if \(!isTop\(\)\) return null;/);
});

test("⛔ T17: the service worker draws the dock and EVERY view at frame 0 only; the form's frame is reached only for its fields", () => {
  const host = stripJs(read("extension/dockHost.js"));
  const calls = host.match(/executeScript\(\{[^)]*\}\)/g) || [];
  assert.ok(calls.length >= 2, "dockHost injects dock.js and the view");
  for (const c of calls) assert.match(c, /frameIds: \[0\]/, `not pinned to the top frame: ${c}`);
  const gh = stripJs(read("extension/gated-handoff.js"));
  // the views and the badge's stop signal: drawInDock / frame 0 — never at(tabId), the form's frame
  for (const fn of ["renderOverlay", "renderBadge", "removeReviewPanel", "badgeDismissed"]) {
    for (const m of gh.matchAll(new RegExp(`executeScript\\(\\{[^}]*\\}[^)]*func: ${fn}\\b`, "g"))) {
      assert.match(m[0], /frameIds: \[0\]/, `${fn} injected outside the top frame: ${m[0]}`);
    }
    assert.doesNotMatch(gh, new RegExp(`target: at\\([^)]*\\), func: ${fn}\\b`), `${fn} is drawn in the form's frame`);
  }
  assert.match(gh, /drawInDock\(tab\.id, renderOverlay,/);
  assert.match(gh, /drawInDock\(tabId, renderBadge,/);
  // what the dock asks about the form goes to the FORM's frame (at(tabId)), and only from the dock's own top frame
  const ff = gh.slice(at(gh, "export const formFrameHandlers = {"));
  assert.match(ff, /DOCK_FIELDS_HELD[\s\S]*?sender\.frameId !== 0[\s\S]*?target: at\(tabId\), func: fieldsHeld/);
  assert.match(ff, /DOCK_MISSING_REQUIRED[\s\S]*?sender\.frameId !== 0[\s\S]*?target: at\(tabId\), func: findMissingRequired/);
  // the panel's edit goes to the form's frame, not the frame the message came from (the dock's)
  assert.match(read("extension/background.js"), /applyOverlayEdit\(\{ tabId, frameId: formFrameOf\(tabId\)/);
  // the other two views' draws, likewise
  assert.match(read("extension/resumePanel.js"), /drawInDock\(tab\.id, renderResumePanel,/);
  assert.match(read("extension/background.js"), /drawInDock\(tab\.id, renderCopySheetPanel,/);
  assert.match(read("extension/autoRead.js"), /drawInDock\(tabId, renderBadge,/);
});

// ── 3 · ONE module ────────────────────────────────────────────────────────────────────────────────────────────────
const VIEWS = [
  ["extension/review-overlay.js", "export function renderOverlay(", "fill"],
  ["extension/resumePanel.js", "export function renderResumePanel(", "ats"],
  ["extension/resumePanel.js", "export function renderResumePanel(", "resume"],
  ["extension/copy-sheet-panel.js", "export function renderCopySheetPanel(", "copy"],
  ["extension/autofill-badge.js", "export function renderBadge(", "status"],
];
const fnBody = (src, anchor) => { const s = src.slice(at(src, anchor)); const end = s.search(/\n}\n/); return s.slice(0, end > 0 ? end : undefined); };

test("⛔ T17: ONE module — every view asks dock.js for its host; NONE carries drag, resize, snap, collapse or placement code of its own", () => {
  const FLOATING = [
    [/\b(mouse|pointer)(down|move|up)\b/, "pointer drag"], [/setPointerCapture/, "pointer capture"],
    [/\.style\.(left|right|top|bottom|width|height)\s*=/, "placing itself"], [/position\s*:\s*(fixed|absolute)\s*;?\s*z-index/, "a floating box of its own"],
    [/style\.cssText\s*=\s*`?position/, "placing itself"], [/z-index\s*:\s*2147483/, "its own z-order"],
    [/IntersectionObserver|__draftFrameView/, "following a frame's visible strip"], [/data-role="(dock|collapse|expand|close|drag)"/, "its own window controls"],
    [/\bkey === 'Escape'|'Escape'/, "its own Esc"], [/innerWidth\s*\/\s*2/, "its own snapping"],
  ];
  for (const [file, anchor, tab] of VIEWS) {
    const body = stripJs(fnBody(read(file), anchor));
    for (const [re, what] of FLOATING) assert.doesNotMatch(body, re, `${file} (${tab}) carries ${what} — that belongs to extension/dock.js`);
    assert.match(body, /globalThis\.__draftDock/, `${file} (${tab}) does not use the dock`);
    if (tab === "status") assert.match(body, /dock\.status\(\{ id: ID \}\)/);
    else assert.match(body, new RegExp(`dock\\.view\\('${tab}'`), `${file} does not draw the ${tab} tab on the dock`);
  }
  // and nowhere else in the extension: dock.js is the only file with a pointer drag. A drag LISTENS for the pointer;
  // the fill DISPATCHES a press onto a page's own suggestion (gated-handoff.js press), which drags nothing.
  for (const f of fs.readdirSync("extension").filter(f => f.endsWith(".js") && f !== "dock.js" && f !== "atsReport.js")) {
    assert.doesNotMatch(stripJs(read(`extension/${f}`)), /addEventListener\(\s*['"`](mouse|pointer)(down|move)\b|\bon(mouse|pointer)(down|move)\b|setPointerCapture/, `extension/${f} drags something — the dock is the one module that may`);
  }
  // the dock itself has every piece the owner listed
  for (const [re, what] of [[/pointerdown/, "drag"], [/data-handle="\$\{hd\}"/, "resize from edges and corners"], [/edgeAtPointer/, "snap"],
    [/data-role="collapse"/, "collapse"], [/role="tablist"/, "tabs"], [/popOut/, "pop a tab out"], [/DOCK_PLACE/, "remembered per site"],
    [/'Escape'/, "Esc"], [/prefers-reduced-motion/, "reduced motion"], [/function raise\(f\)/, "z-order"], [/focusin/, "never over the field being typed in"]]) {
    assert.match(DOCK_SRC, re, `dock.js lacks ${what}`);
  }
});

test("T17: the views keep their markup hooks — the same host ids the walks read, as light-DOM children of the dock", () => {
  assert.match(read("extension/review-overlay.js"), /const ID = 'rm-gate-review-overlay';/);
  assert.match(read("extension/resumePanel.js"), /const ID = 'rm-resume-panel';\n  const ATS_ID = 'rm-ats-panel';/);
  assert.match(read("extension/copy-sheet-panel.js"), /const HOST_ID = 'rm-copy-sheet-panel';/);
  assert.match(DOCK_SRC, /el\.slot = `view-\$\{tab\}`;/);
  assert.match(DOCK_SRC, /document\.documentElement\.appendChild\(host\)/, "the dock is on <html>, never in <body> (the form probe never sees it)");
});

// ── 4 · remembered per site ───────────────────────────────────────────────────────────────────────────────────────
function stubStorage() {
  const local = new Map();
  globalThis.chrome = {
    storage: { local: { get: async (k) => (local.has(k) ? { [k]: local.get(k) } : {}), set: async (o) => { for (const [k, v] of Object.entries(o)) local.set(k, JSON.parse(JSON.stringify(v))); } } },
    runtime: { getURL: (p) => `chrome-extension://x/${p}` },
    tabs: { get: async () => null },
  };
  return local;
}

test("⛔ T17: the rectangle is remembered PER SITE — the origin only, the named fields only, 50 sites, 30 days", async () => {
  const local = stubStorage();
  const host = await import("../extension/dockHost.js");
  const t0 = Date.UTC(2026, 9, 15);
  const place = { rect: { x: 10, y: 20, w: 400, h: 500 }, edge: "left", collapsed: true, tab: "copy", pops: { ats: { x: 1, y: 2, w: 300, h: 300 } }, popped: ["ats", "nope"], page: "<html>", answers: ["Ada"] };
  assert.equal(await host.saveDockPlace("https://careers.acme.test/jobs/1?gh_jid=9&email=ada@example.test", place, t0), true);
  const all = local.get("dockPlace");
  assert.deepEqual(Object.keys(all), ["https://careers.acme.test"], "the site's origin — never the path or the query");
  assert.deepEqual(all["https://careers.acme.test"], { rect: { x: 10, y: 20, w: 400, h: 500 }, edge: "left", collapsed: true, tab: "copy", pops: { ats: { x: 1, y: 2, w: 300, h: 300 } }, popped: ["ats"], at: t0 });
  // another page on the same site finds it; another site does not
  const realNow = Date.now;
  Date.now = () => t0 + 1000;
  try {
    assert.equal((await host.loadDockPlace("https://careers.acme.test/other"))?.edge, "left");
    assert.equal(await host.loadDockPlace("https://other.test/jobs/1"), null);
    assert.equal(await host.saveDockPlace("chrome://extensions", place), false, "only a web page's site");
  } finally { Date.now = realNow; }
  // 50 sites, the newest kept; 30 days
  for (let i = 0; i < 60; i++) await host.saveDockPlace(`https://s${i}.test/`, place, t0 + i);
  const kept = Object.keys(local.get("dockPlace"));
  assert.equal(kept.length, 50);
  assert.ok(kept.includes("https://s59.test") && !kept.includes("https://s0.test"), "the oldest go first");
  await host.saveDockPlace("https://late.test/", place, t0 + 31 * 864e5);
  assert.deepEqual(Object.keys(local.get("dockPlace")), ["https://late.test"], "nothing older than 30 days is kept");
});

test("⛔ T17: only a web page's TOP frame may write the place (DOCK_PLACE) — the dock never exists anywhere else", async () => {
  const local = stubStorage();
  const { handlers } = await import("../extension/dockHost.js");
  const place = { rect: { x: 1, y: 1, w: 300, h: 300 } };
  assert.deepEqual(await handlers.DOCK_PLACE({ place }, { frameId: 3, tab: { id: 1, url: "https://a.test/" }, url: "https://job-boards.greenhouse.io/embed" }), { ok: false });
  assert.deepEqual(await handlers.DOCK_PLACE({ place }, { frameId: 0 }), { ok: false }, "no tab: an extension page");
  assert.equal(local.get("dockPlace"), undefined);
  assert.deepEqual(await handlers.DOCK_PLACE({ place }, { frameId: 0, tab: { id: 1, url: "https://a.test/x" }, url: "https://a.test/x" }), { ok: true });
  assert.deepEqual(Object.keys(local.get("dockPlace")), ["https://a.test"]);
  // ONE write site for the key
  assert.equal((stripJs(read("extension/dockHost.js")).match(/chrome\.storage\.local\.set\(/g) || []).length, 1);
});

// ── 5 · the four themes and the cues ──────────────────────────────────────────────────────────────────────────────
test("T17: the account's appearance picks the palettes — system, contrast, or one of the four themes whatever the OS", async () => {
  stubStorage();
  const { themePair } = await import("../extension/dockHost.js");
  assert.deepEqual([themePair("system").light, themePair("system").dark], [C_LIGHT, C_DARK]);
  assert.deepEqual([themePair(null).light, themePair("light").dark], [C_LIGHT, C_DARK], "nothing stored, or the older names: the Paper pair");
  assert.deepEqual([themePair("contrast").light, themePair("contrast").dark], [C_CONTRAST_LIGHT, C_CONTRAST_DARK]);
  for (const id of ["paper-light", "charcoal-dark", "contrast-light", "contrast-dark"]) {
    const p = themePair(id);
    assert.equal(p.light, EXT_THEMES[id].tokens); assert.equal(p.dark, EXT_THEMES[id].tokens, `${id} holds whatever the OS says`);
  }
  // the registry's four, and the tokens are the registry's own
  const { THEME_LIST } = await import("../client/src/themes/index.js");
  assert.deepEqual(Object.keys(EXT_THEMES), THEME_LIST.map(t => t.id));
  for (const t of THEME_LIST) assert.equal(EXT_THEMES[t.id].tokens.INK, t.tokens.INK);
  // every view is handed the resolved pair (overlayTheme), and the dock its cues
  assert.match(read("extension/dockHost.js"), /const pair = themePair\(\(await accountAppearance\(\)\)\?\.theme\);/);
  assert.match(read("extension/dockHost.js"), /cues: appearance\?\.cues === true/);
});

test("T17: the frame paints only with tokens — var(--c-*), no colour literal; the cues add a SHAPE; reduced motion holds still", () => {
  const css = DOCK_SRC.slice(at(DOCK_SRC, "const FRAME_CSS = "), at(DOCK_SRC, "const LOGO_FACE"));
  assert.doesNotMatch(css.replace(/\$\{[^}]*\}/g, ""), /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i, "a colour literal in the dock's CSS");
  assert.match(css, /:host\(\[data-cues="shape"\]\) \.tab\[aria-selected="true"\]::before \{ content: "▸ "; \}/);
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\) \{ :host\(\[data-settle\]\) \{ transition/);
  // ⛔ D60: no capsule — every radius in the frame is a rectangle's, but a PERFECT CIRCLE (⭐ T28: the launcher's dot —
  // width and height equal in its own rule) stays round
  for (const m of css.matchAll(/[^{}]*\{[^}]*border-radius:\s*([^;]+);[^}]*\}/g)) {
    const w = m[0].match(/\bwidth: (\d+)px/)?.[1], h = m[0].match(/\bheight: (\d+)px/)?.[1];
    if (/50%/.test(m[1]) && w && w === h) continue;
    assert.doesNotMatch(m[1], /999|50%|9999/, `a capsule: ${m[0].trim().slice(0, 120)}`);
  }
});

// ── 6 · no new permission; it ships ───────────────────────────────────────────────────────────────────────────────
test("T17: no new permission, and the dock ships in the package (the builder follows files: ['dock.js'])", () => {
  const manifest = JSON.parse(read("extension/manifest.json"));
  assert.deepEqual([...manifest.permissions].sort(), ["activeTab", "contextMenus", "scripting", "sidePanel", "storage"]);
  assert.deepEqual(manifest.host_permissions, ["https://jobsviadraft.com/*"]);
  assert.ok(!manifest.web_accessible_resources, "the dock needs no web-accessible resource");
  const files = collectRequiredFiles(manifest);
  for (const f of ["dock.js", "dockHost.js"]) assert.ok(files.includes(f), `${f} is not in the package`);
});
