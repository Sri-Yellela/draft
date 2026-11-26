// ⭐ D196 F5 · VISUAL REGRESSION AGAINST THE SKETCH — the gate every phase passes before it is called done.
//
// The oracle is the canvas export itself: each artboard page (tmp/d196-canvas/<id>.html, unpacked from the committed
// docs/sketches/Atlas plate system.html by scripts/d196UnpackCanvas.mjs) rendered in headless Chrome. The build side is the
// same composition from the plate library with the sketch's example data (client/src/plate/fixtures.jsx), bundled with
// esbuild into a standalone page. Both are cropped to the same element (found by selector on each side, so the crop
// follows the layout instead of guessing pixels), and compared pixel by pixel in the browser:
//   a pixel differs when any channel differs by more than TOLERANCE (anti-aliasing and font hinting stay under it);
//   masked rectangles (dynamic text) are skipped; the difference is differing / compared pixels.
// The gate: ≤ 2 % per pair (D196 F5). A failing pair is fixed in the component, never by raising the threshold.
// Output (tmp/d196-regress/<pair>/): board.png, build.png, diff.png (differences in clay), pair.png (sketch | build) and
// report.json — the side-by-side goes in NOW for the owner.
//
// Usage: node scripts/d196Regress.mjs [--pair <name>] [--width 1280|390] [--threshold 2]
// ⚠ Drives a real Chrome (services/browserLauncher.js): run it with memory to spare, one pair at a time on the 8 GB machine.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { unpackCanvas, DEFAULT_OUT as CANVAS } from "./d196UnpackCanvas.mjs";
import { SOURCES } from "./d196PortDrawings.mjs";
import { finalBoards, serveFinal } from "./d196FinalCanvas.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "tmp", "d196-regress");
export const THRESHOLD_PCT = 2;
export const TOLERANCE = 40;   // per channel, 0–255
export const LAUNCH_ARGS = Object.freeze(["--disable-lcd-text"]);

/** ⭐ 47h (lane atlas): reload a board page with its JS timers off (a still frame of a page that ticks on setInterval). */
async function atFreezeTimers(page) {
  await page.evaluateOnNewDocument(() => { window.setInterval = () => 0; });
  await page.reload({ waitUntil: "load", timeout: 60000 });
}

/** The pairs: a board, the element to crop on each side, and the fixture that builds it. */
export const PAIRS = {
  // ⭐ D197 Wave 1 #1 (47i) · THE SHELL against the approved canvas's `Shell` board (source "final"). The build side is the
  // live dock's own component (plate/Shell.jsx's Dock / AreaNav — components/AppNav.jsx renders them) with the board's data.
  // The rail: figure A's (the market's — the /d tile current), its 4 px shadow inside the pad.
  "shell-rail": { source: "final", board: "Shell", fixture: "ShellRailMarket", boardSel: 'nav[aria-label="Main"]', buildSel: 'nav[aria-label="Main"]', pad: 6, subpixel: true },
  // the active item: figure B's (the ledger's) Home tile — white, 1.5 px ink, 3 px ink shadow, the name in 800
  "shell-active": { source: "final", board: "Shell", fixture: "ShellRailLedger", boardSel: 'nav[aria-label="Main"]:has(+ div nav[aria-label="Ledger"]) [aria-current="page"]',
    buildSel: 'nav[aria-label="Main"] [aria-current="page"]', pad: 4, subpixel: true },
  // the area nav: figure A's market header (the views, More, search with Ctrl K, the drafts chip, the 12 px ruler) across
  // the 1131 px content column beside the rail
  "shell-areanav": { source: "final", board: "Shell", fixture: "ShellRailMarket", boardSel: 'header:has(nav[aria-label="The market"])', buildSel: "header.pl-areanav", pad: 0, subpixel: true },
  // the phone's bottom bar: figure D's (the 390 px phone frame's last child)
  // the phone's top bar: figure D's first row (the /d tile, the search button)
  "shell-phonetop": { source: "final", board: "Shell", fixture: "ShellPhoneTop", boardSel: 'div[style*="height: 760px"] > div:first-child', buildSel: ".pl-topbar", pad: 0, subpixel: true },
  "shell-phonebar": { source: "final", board: "Shell", fixture: "ShellPhoneBar", boardSel: 'nav[aria-label="Main"]:last-child', buildSel: "nav.pl-dock--bar", pad: 0, subpixel: true },
  // ⭐ D197 Wave 1 #5–#7 (47h, lane atlas) · ATLAS'S THREE BOARDS (final canvas `Home`, `Map`, `Library`). The build side is
  // plate/AtlasHome.jsx · AtlasRegion.jsx · AtlasLibrary.jsx with the boards' data (fixtures.jsx). The board's own header is
  // the Atlas area nav now (the shell's, paired below against the Shell board's figure C), so each pair crops a section.
  // The hero's label tape: the board turns its word on a JS timer (reduced motion doesn't stop it), so the board page is
  // reloaded with its timers off — both sides show the first word ("computers.").
  "atlas-home-hero": { source: "final", board: "Home", fixture: "AtlasHomeBoard", boardSel: "section#top", buildSel: "section#top", pad: 0, reduced: true, subpixel: true,
    boardPrep: atFreezeTimers },
  "atlas-home-regions": { source: "final", board: "Home", fixture: "AtlasHomeBoard", boardSel: "section:nth-of-type(2)", buildSel: "section.pl-at-regions", pad: 0, reduced: true, subpixel: true, boardPrep: atFreezeTimers },
  "atlas-home-footer": { source: "final", board: "Home", fixture: "AtlasHomeBoard", boardSel: "footer", buildSel: "footer.pl-at-foot", pad: 0, reduced: true, subpixel: true, boardPrep: atFreezeTimers },
  "atlas-home-volumes": { source: "final", board: "Home", fixture: "AtlasVolumesBoard", boardSel: "header .at-drop", buildSel: ".pl-at-vols", pad: 10, reduced: true, subpixel: true,
    boardPrep: async (page) => { await atFreezeTimers(page); await page.evaluate(() => document.querySelector("header button[aria-expanded]")?.click()); await new Promise((r) => setTimeout(r, 400)); } },
  // Atlas's area nav: the Shell board's figure C (the VOL. I pill, the views with Your map current, More, search, the run chip)
  "atlas-areanav": { source: "final", board: "Shell", fixture: "ShellRailAtlas", boardSel: 'header:has(nav[aria-label="Vol. I"])', buildSel: "header.pl-areanav", pad: 0, subpixel: true },
  "atlas-map-header": { source: "final", board: "Map", fixture: "AtlasMapBoard", boardSel: "main#region > section", buildSel: "main#region > section", pad: 8, reduced: true, subpixel: true },
  "atlas-map-terrain": { source: "final", board: "Map", fixture: "AtlasMapBoard", boardSel: "main#region > div", buildSel: ".pl-at-views", pad: 8, reduced: true, subpixel: true },
  "atlas-map-route": { source: "final", board: "Map", fixture: "AtlasMapBoard", boardSel: "main#region > div", buildSel: ".pl-at-views", pad: 8, reduced: true, subpixel: true, boardTab: "Route",
    buildPrep: async (page) => { await page.evaluate(() => document.getElementById("pl-at-tab-route")?.click()); await new Promise((r) => setTimeout(r, 300)); } },
  "atlas-map-index": { source: "final", board: "Map", fixture: "AtlasMapBoard", boardSel: "main#region > div", buildSel: ".pl-at-views", pad: 8, reduced: true, subpixel: true, boardTab: "Index",
    buildPrep: async (page) => { await page.evaluate(() => document.getElementById("pl-at-tab-index")?.click()); await new Promise((r) => setTimeout(r, 300)); } },
  "atlas-library-notes": { source: "final", board: "Library", fixture: "AtlasLibraryBoard", boardSel: "#lib", buildSel: "#lib", pad: 0, reduced: true, subpixel: true },
  "atlas-library-sources": { source: "final", board: "Library", fixture: "AtlasLibraryBoard", boardSel: "#lib", buildSel: "#lib", pad: 0, reduced: true, subpixel: true,
    boardPrep: async (page) => { await page.evaluate(() => [...document.querySelectorAll("aside nav button")].find((b) => b.textContent.includes("Primary sources"))?.click()); await new Promise((r) => setTimeout(r, 500)); },
    buildPrep: async (page) => { await page.evaluate(() => document.querySelector('[data-collection="sources"]')?.click()); await new Promise((r) => setTimeout(r, 300)); } },
  "shell-market-dock": { board: "The market · draft", fixture: "ShellMarket", boardSel: 'nav[aria-label="Main"]', buildSel: 'nav[aria-label="Main"]', pad: 6 },
  "shell-market-nav": { board: "The market · draft", fixture: "ShellMarket", boardSel: "header", buildSel: "header.pl-areanav", pad: 0 },
  // P1 · the card face: the owner kept the deck's form factor (11-24), so the face can never be the board's size — this pair
  // is a LOOK for the owner (pair.png), not a pixel gate; its report says so instead of passing or failing.
  // FIX-2 (47f, the owner: "retain the frame and flip but also make it pixel diffable"): the ticket at the board's size, drawn
  // by DeckView's own FanCard (PlateDeckStill) — now a GATE. The pad takes in the 6 px shadow; the backs' slivers above and
  // to the right are the deck's own CardBack (the owner's keep), compared as they are.
  "market-face": { board: "The market · draft", fixture: "MarketFace", boardSel: "article[aria-label]", buildSel: '[data-fan-offset="0"] article', pad: 6, reduced: true, subpixel: true,
    // the two strings the build can't back (D196 R2: never invented): the board's "· CHECKED TODAY" (a dealt card has no
    // check date) and the stamp's "· FY25" (no filing year on the card) — masked; everything else is compared
    // + the back sheets' slivers in the 6 px pad above and right of the ticket (the deck's own CardBack — the keep)
    masks: [[600, 12, 200, 16], [588, 226, 206, 56], [0, 0, 820, 7], [813, 0, 7, 376]],
    // at 390 (the board's artboard, its desktop dock kept: a 226 px ticket): CHECKED TODAY on the strip's second line, and
    // the stamp — the board's covers the last chip, the build's hangs on the tear line (the noted deviation)
    masksAt: { 390: [[60, 34, 150, 16], [0, 566, 238, 76], [0, 0, 238, 7], [231, 0, 7, 829]] } },
  // P1 · the bearing: the board's sentence carries clauses the live model words differently (the résumé's own role, level,
  // sponsorship), so this too is a look at the cartouche's frame and type, not a pixel gate.
  "market-bearing": { board: "The market · draft", fixture: "MarketBearing", boardSel: "section:nth-of-type(2)", buildSel: "[data-market-bearing-fixture]", pad: 0, look: true },
  "market-hero": { board: "The market · draft", fixture: "MarketHeroBoard", boardSel: 'section[aria-labelledby="mk-title"]', buildSel: 'section[aria-labelledby="mk-title"]', pad: 0, waitBuild: 4000, reduced: true,   // both at rest: the tags' float stops under reduced motion on each side
    // the one figure the build words differently on purpose: the board's "MATCH ≥ 85%" — draft counts the strong band
    // (shared/atsBands.js), which is not ≥ 85 %, so the cell says STRONG FIT; its label is masked, its number is not
    masks: [[400, 345, 100, 18]] },
  // P1 · the openings: the deck card keeps the deck's form factor (600 wide, not the board's 760), so the section is a look
  // FIX-2 / FIX-4 / FIX-5 (47f): the Deck tab as DeckView draws it — a GATE (D196: "no page is called landed without its F5").
  "market-openings": { board: "The market · draft", fixture: "MarketOpeningsBoard", boardSel: "section:nth-of-type(3)", buildSel: "#openings", pad: 0, reduced: true, subpixel: true,
    // masked: the field card (x ≥ 868) — FIX-5 replaced the board's wrapped "ROLE FIT · STACK · DUTIES / 91 · 88 · 80" foot
    // with a labelled row on the owner's word, so it is its own LOOK pair (market-field); and the strings the board has and
    // the build can't back: "· EXAMPLE DATA", "· CHECKED TODAY", the stamp's "· FY25", the position line's sort words
    // ... and the two back sheets' slivers above and right of the ticket: the board draws plain white sheets, the build the
    // deck's OWN CardBack (the owner's keep, 11-24) at the board's exact poses — compared everywhere else
    masks: [[868, 230, 314, 461], [300, 0, 200, 22], [600, 280, 230, 18], [580, 490, 250, 70], [0, 650, 420, 30],
      [24, 236, 844, 32], [832, 236, 36, 405]],
    // at 390 the field card wraps under the deck: the gate stops at its top (cropTo — it is market-field's look), and the
    // same kinds of mask apply where the parts land there (EXAMPLE DATA, CHECKED TODAY, the stamp, the backs, the position
    // line: the build's ‹ is disabled on the first card — honest — where the board's wraps round)
    cropTo: { 390: 1495 },
    masksAt: { 390: [[80, 90, 160, 16], [40, 604, 160, 16], [20, 1150, 250, 70], [20, 560, 272, 22], [246, 560, 46, 840], [0, 1400, 292, 95]] } },
  // FIX-7 / FIX-8 (47f): the Index tab as the board's Gazetteer — a GATE, the board's Index tab pressed first. Compared as
  // they are (both inside the gate): the STACK · YOURS cells (the board writes "5 / 5 · 4 ✓"; draft's rows carry the
  // posting's skills, and the ✓ only when a report has them: "5 · 4 ✓") and each row's 32 px bubble (D182's carve-out — the
  // board doesn't draw it; the owner kept it). Masked: only "· EXAMPLE DATA".
  "market-index": { board: "The market · draft", fixture: "MarketIndexBoard", boardSel: "section:nth-of-type(3)", buildSel: "#openings", pad: 0, reduced: true, subpixel: true,
    boardTab: "Index", masks: [[300, 0, 200, 22]],
    // at 390 the gate stops at the table's header row: on the board's squeezed artboard its "5 / 5 · 4 ✓" overruns the
    // 106 px STACK column by a pixel and wraps, so every board row is ~5 px taller (draft's "5 · 4 ✓" doesn't wrap); the
    // rows are gated at 1280 and are a look here
    cropTo: { 390: 610 }, masksAt: { 390: [[0, 78, 292, 24]] } },
  "market-field": { board: "The market · draft", fixture: "MarketOpeningsBoard", boardSel: 'aside[aria-label="Why this opening fits you"]', buildSel: 'aside[aria-label="Why this opening fits you"]', pad: 6, reduced: true, look: true },
  // v2 (47e, order item 4): each ported drawing against its own element on the v2 boards, drawn at the board's width
  // (`matchWidth`: the build page reads the board element's width from its address) — the port's fidelity, pixel for pixel.
  "v2-elevation": { source: "v2", board: "Atlas place: Webhooks, Region IV grid D3", fixture: "PortedDrawing", drawing: "PlaceElevationProfile", boardSel: 'svg[aria-label^="Elevation profile"]', buildSel: "svg[role=img]", pad: 0, matchWidth: true, reduced: true, ground: "#FFFFFF", cornerMasks: 24 },
  "v2-signpost": { source: "v2", board: "Atlas place: Webhooks, Region IV grid D3", fixture: "PortedDrawing", drawing: "PlaceSignpost", boardSel: 'svg[aria-label^="A trailhead signpost"]', buildSel: "svg[role=img]", pad: 0, matchWidth: true, reduced: true, ground: "#FFFFFF", cornerMasks: 24 },
  "v2-volume": { source: "v2", board: "Atlas home: Volume I, Computing", fixture: "PortedDrawing", drawing: "AtlasVolumePlate", boardSel: 'svg[aria-label^="Plate of Volume I"]', buildSel: "svg[role=img]", pad: 0, matchWidth: true, reduced: true, ground: "#FFFFFF", cornerMasks: 24,
    hideOnBoard: '.at-bob1, .at-bob2, .at-bob3, svg[aria-label^="Plate of Volume I"] ~ *' },
  "v2-tile": { source: "v2", board: "Atlas place: Webhooks, Region IV grid D3", fixture: "PortedDrawing", drawing: "PlaceIsometricTile", boardSel: 'svg[aria-label^="An isometric map tile"]', buildSel: "svg[role=img]", pad: 0, matchWidth: true, reduced: true, ground: "#FFFFFF", cornerMasks: 24 },
  "v2-seal": { source: "v2", board: "Atlas place: Webhooks, Region IV grid D3", fixture: "PortedDrawing", drawing: "PlaceHazardSeal", boardSel: 'svg[aria-label^="A door with a wax seal"]', buildSel: "svg[role=img]", pad: 0, matchWidth: true, reduced: true, ground: "#FFFFFF", cornerMasks: 24 },
  "v2-timeout": { source: "v2", board: "Atlas place: Webhooks, Region IV grid D3", fixture: "PortedDrawing", drawing: "PlaceHazardTimeout", boardSel: 'svg[aria-label^="A stopwatch beside"]', buildSel: "svg[role=img]", pad: 0, matchWidth: true, reduced: true, ground: "#FFFFFF", cornerMasks: 24 },
  "v2-duplicate": { source: "v2", board: "Atlas place: Webhooks, Region IV grid D3", fixture: "PortedDrawing", drawing: "PlaceHazardDuplicate", boardSel: 'svg[aria-label^="Two identical letters"]', buildSel: "svg[role=img]", pad: 0, matchWidth: true, reduced: true, ground: "#FFFFFF", cornerMasks: 24 },
  "market-tickets": { board: "The market · draft", fixture: "MarketTicketsBoard", boardSel: "section:nth-of-type(4)", buildSel: "section[aria-labelledby=mk-onward]", pad: 0, look: true },
  // ⭐ D198 E1 (47h) · THE EXPLAINER, BEAT BY BEAT — v4's *Explainer · Big O, acted out* (the board scales its 405 × 720 inner
  // frame by 1.12 into its column; the run takes the scale off, so both sides are the frame at its own size). Each side's
  // beat is pressed in its own list; on your turn the build's right answer is pressed (the board draws it answered).
  ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`xp-beat-${i + 1}`, { source: "v4", board: "Explainer · Big O, acted out", fixture: "ExplainerBoard",
    boardSel: '[aria-label^="The Big O explainer"] > div > div', buildSel: ".pl-xp__frame", pad: 0, reduced: true, subpixel: true, waitBuild: 1200,
    boardPrep: async (page) => { await page.addStyleTag({ content: '[aria-label^="The Big O explainer"] > div { transform: none !important; }' });
      await page.evaluate((k) => document.querySelectorAll("ol li button")[k]?.click(), i); await new Promise((r) => setTimeout(r, 600)); },
    buildPrep: async (page) => { await page.evaluate((k) => document.querySelectorAll(".pl-xp__beat")[k]?.click(), i); await new Promise((r) => setTimeout(r, 300));
      if (i === 8) await page.evaluate(() => [...document.querySelectorAll(".pl-xp__opt")].find((b) => b.textContent.includes("Hash map"))?.click()); },
    // where it runs: the board shows the template's "[N]" — the build fills the market's count (never "[N]"): the figure is masked
    ...(i === 7 ? { masks: [[38, 482, 140, 18]] } : {}) }])),
};
// D198 (47h): the explainer's oracle — v4's export holds only the two explainer pages (A236), so it is not a SOURCES drawing set
const XP_SOURCE = { file: path.join(ROOT, "docs", "sketches", "Atlas plate system v4.html"), out: path.join(ROOT, "tmp", "d196-canvas-v4"), name: "docs/sketches/Atlas plate system v4.html" };

/** Pure: compare two RGBA buffers of the same size → { differing, compared, pct }. Masks are [x, y, w, h]. */
export function diffRgba(a, b, width, height, { tolerance = TOLERANCE, masks = [] } = {}) {
  let differing = 0, compared = 0;
  const masked = (x, y) => masks.some(([mx, my, mw, mh]) => x >= mx && x < mx + mw && y >= my && y < my + mh);
  const mark = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (masks.length && masked(x, y)) continue;
    const i = (y * width + x) * 4;
    compared++;
    if (Math.abs(a[i] - b[i]) > tolerance || Math.abs(a[i + 1] - b[i + 1]) > tolerance || Math.abs(a[i + 2] - b[i + 2]) > tolerance) { differing++; mark[y * width + x] = 1; }
  }
  return { differing, compared, pct: compared ? (100 * differing) / compared : 0, mark };
}

export async function buildFixturePage(name) {
  const require = createRequire(path.join(ROOT, "client", "package.json"));
  const esbuild = require("esbuild");
  const dir = path.join(OUT, "_build");
  fs.mkdirSync(dir, { recursive: true });
  const entry = `
    import { createRoot } from "react-dom/client";
    import { FIXTURES } from ${JSON.stringify(path.join(ROOT, "client/src/plate/fixtures.jsx"))};
    const C = FIXTURES[${JSON.stringify(name)}];
    createRoot(document.getElementById("root")).render(<C/>);
  `;
  await esbuild.build({
    stdin: { contents: entry, resolveDir: path.join(ROOT, "client"), loader: "jsx" },
    bundle: true, format: "iife", outfile: path.join(dir, `${name}.js`), jsx: "automatic", logLevel: "warning",
    loader: { ".woff2": "file", ".woff": "file" }, define: { "process.env.NODE_ENV": '"production"' },
  });
  // 47f (D196 THEMES): inside the app the plate takes the person's theme; the oracle is the SKETCH's palette, so the build
  // page pins it (styles/plate.css: html[data-plate-palette="sketch"] keeps the report's literal values) — like with like.
  const html = `<!doctype html><html data-plate-palette="sketch"><head><meta charset="utf-8"><link rel="stylesheet" href="${name}.css">
    <style>html,body{margin:0;background:var(--pl-paper, #F4EFE9)}</style></head><body><div id="root"></div><script src="${name}.js"></script></body></html>`;
  const file = path.join(dir, `${name}.html`);
  fs.writeFileSync(file, html);
  return pathToFileURL(file).href;
}

async function shot(page, url, sel, width, pad, waitMs, reduced = false, ground = null, hide = null, clickText = null, prep = null) {
  await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: reduced ? "reduce" : "no-preference" }]);
  await page.goto(url, { waitUntil: "load", timeout: 60000 });
  // clickText (47f): press the board's own control first (its Index tab) — the board is a live page with state
  if (clickText) { await page.evaluate((t) => { const b = [...document.querySelectorAll('button[role="tab"]')].find((x) => x.textContent.includes(t)); b?.click(); }, clickText); await new Promise((r) => setTimeout(r, 400)); }
  if (prep) await prep(page);   // D198 (47h): a pair's own presses (the explainer's beat) before the still frame
  await page.waitForSelector(sel, { timeout: 30000 });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  // let the board's entrance animations finish (draw-on 3.5 s, view-in .35 s) — and stop the loops for a still frame
  await new Promise((r) => setTimeout(r, waitMs));
  await page.addStyleTag({ content: "*,*::before,*::after{animation-play-state:paused!important;transition:none!important}" });
  // a drawing compared on its own: the same ground behind it on both sides (the board's container tint and corner are the
  // page's, not the drawing's)
  if (ground) await page.addStyleTag({ content: `${sel}{background:${ground}!important}` });
  // the board page's HTML overlays on a drawing (callout tags, a moving token) are the page's, not the drawing's
  if (hide) await page.addStyleTag({ content: `${hide}{visibility:hidden!important}` });
  const box = await page.$eval(sel, (el) => { const r = el.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; });
  const clip = { x: Math.max(0, Math.floor(box.x - pad)), y: Math.max(0, Math.floor(box.y - pad)), width: Math.ceil(box.w + 2 * pad), height: Math.ceil(box.h + 2 * pad) };
  return { png: await page.screenshot({ clip, captureBeyondViewport: true }), clip, box };
}

/** Decode both PNGs in the page and diff them there (no image library in the repo). */
async function compareInPage(page, aPng, bPng, masks) {
  return page.evaluate(async (a64, b64, masksIn, tol) => {
    const load = (b) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = "data:image/png;base64," + b; });
    const [A, B] = await Promise.all([load(a64), load(b64)]);
    const w = Math.max(A.width, B.width), h = Math.max(A.height, B.height);
    const px = (im) => { const c = new OffscreenCanvas(w, h); const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.drawImage(im, 0, 0); return g.getImageData(0, 0, w, h).data; };
    const da = px(A), db = px(B);
    let differing = 0, compared = 0;
    const out = new OffscreenCanvas(w, h); const og = out.getContext("2d"); og.drawImage(B, 0, 0); og.fillStyle = "rgba(255,255,255,.6)"; og.fillRect(0, 0, w, h);
    const id = og.getImageData(0, 0, w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (masksIn.some(([mx, my, mw, mh]) => x >= mx && x < mx + mw && y >= my && y < my + mh)) continue;
      const i = (y * w + x) * 4; compared++;
      if (Math.abs(da[i] - db[i]) > tol || Math.abs(da[i + 1] - db[i + 1]) > tol || Math.abs(da[i + 2] - db[i + 2]) > tol) {
        differing++; id.data[i] = 194; id.data[i + 1] = 89; id.data[i + 2] = 58; id.data[i + 3] = 255;
      }
    }
    og.putImageData(id, 0, 0);
    const pair = new OffscreenCanvas(A.width + B.width + 24, h); const pg = pair.getContext("2d");
    pg.fillStyle = "#1B1B1B"; pg.fillRect(0, 0, pair.width, h); pg.drawImage(A, 0, 0); pg.drawImage(B, A.width + 24, 0);
    const toB64 = async (c) => { const blob = await c.convertToBlob({ type: "image/png" }); const buf = new Uint8Array(await blob.arrayBuffer()); let s = ""; for (let k = 0; k < buf.length; k += 32768) s += String.fromCharCode.apply(null, buf.subarray(k, k + 32768)); return btoa(s); };
    return { w, h, sizeA: [A.width, A.height], sizeB: [B.width, B.height], differing, compared, pct: compared ? 100 * differing / compared : 0, diff: await toB64(out), pair: await toB64(pair) };
  }, aPng.toString("base64"), bPng.toString("base64"), masks, TOLERANCE);
}

export async function runPair(name, { width = 1280, threshold = THRESHOLD_PCT, browser } = {}) {
  const p = PAIRS[name];
  if (!p) throw new Error(`no pair "${name}" (have: ${Object.keys(PAIRS).join(", ")})`);
  let boardUrl;
  if (p.source === "final") {
    // 47h (A244): the approved canvas's own board sources, served over http (scripts/d196FinalCanvas.mjs); board = the file stem
    if (!finalBoards().some((b) => b.stem === p.board)) throw new Error(`no board "${p.board}" on the final canvas (docs/sketches/final/project)`);
    boardUrl = `${(await serveFinal()).base}/${p.board}.dc.html`;
  } else {
    const src = p.source === "v4" ? XP_SOURCE : p.source ? SOURCES[p.source] : null;
    const index = src ? unpackCanvas(src.file, src.out) : unpackCanvas();
    const row = index.find((r) => r.title === p.board);
    if (!row) throw new Error(`no board "${p.board}" in ${src ? src.name : "the v3 export"}`);
    boardUrl = pathToFileURL(path.join(src ? src.out : CANVAS, row.file)).href;
  }
  let buildUrl = await buildFixturePage(p.fixture);
  const page = await browser.newPage();
  const board = await shot(page, boardUrl, p.boardSel, width, p.pad, 4000, !!p.reduced, p.ground, p.hideOnBoard, p.boardTab || null, p.boardPrep || null);
  // matchWidth: the build draws at the board element's EXACT width and at the same sub-pixel offset inside its first pixel,
  // so both rasterise on the same grid (the board's signpost sits at x = 994.73, 260.27 wide — drawn at 261 from x = 0 every
  // outline landed a fraction off and read as a difference)
  const frac = (v) => +(v - Math.floor(v)).toFixed(4);
  if (p.matchWidth || p.drawing) buildUrl += `#${new URLSearchParams({ ...(p.drawing ? { name: p.drawing } : {}),
    ...(p.matchWidth ? { w: String(board.box.w), h: String(board.box.h), ox: String(frac(board.box.x - p.pad)), oy: String(frac(board.box.y - p.pad)) } : {}) })}`;
  // subpixel (47f): a composed fixture (the deck's ticket) placed at the board element's own sub-pixel offset — the board's
  // ticket sits at a fractional y, and one whole pixel apart every glyph's edge read as a difference (7 % on FIX-2's run)
  else if (p.subpixel) buildUrl += `#${new URLSearchParams({ ox: String(frac(board.box.x)), oy: String(frac(board.box.y)), w: String(board.box.w), sel: p.buildSel })}`;   // sel (47i): the element a fixture places at that fraction
  const build = await shot(page, buildUrl, p.buildSel, width, p.pad, p.waitBuild || 600, !!p.reduced, p.ground, null, null, p.buildPrep || null);
  // cornerMasks: the board container's rounded corners clip the drawing's corners there (the page's frame, not the drawing)
  const cm = p.cornerMasks, bw = board.clip.width, bh = board.clip.height;
  // masksAt[width]: a pair's masks at another width (the board lays the same parts out elsewhere at 390)
  const masks = [...((p.masksAt && p.masksAt[width]) || p.masks || []), ...(cm ? [[0, 0, cm, cm], [bw - cm, 0, cm, cm], [0, bh - cm, cm, cm], [bw - cm, bh - cm, cm, cm]] : [])];
  // cropTo[width]: compare only the top N px of both (what lies below is another pair's)
  const cut = p.cropTo && p.cropTo[width];
  const [bPng, uPng] = cut ? await Promise.all([board, build].map((x) => page.evaluate(async (b64, hh) => {
    const im = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = "data:image/png;base64," + b64; });
    const c = new OffscreenCanvas(im.width, Math.min(hh, im.height)); c.getContext("2d").drawImage(im, 0, 0);
    const buf = new Uint8Array(await (await c.convertToBlob({ type: "image/png" })).arrayBuffer());
    let s = ""; for (let k = 0; k < buf.length; k += 32768) s += String.fromCharCode.apply(null, buf.subarray(k, k + 32768)); return btoa(s);
  }, x.png.toString("base64"), cut).then((b64) => Buffer.from(b64, "base64")))) : [board.png, build.png];
  if (cut) { board.png = bPng; build.png = uPng; }
  const r = await compareInPage(page, board.png, build.png, masks);
  await page.close();
  const dir = path.join(OUT, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "board.png"), board.png);
  fs.writeFileSync(path.join(dir, "build.png"), build.png);
  fs.writeFileSync(path.join(dir, "diff.png"), Buffer.from(r.diff, "base64"));
  fs.writeFileSync(path.join(dir, "pair.png"), Buffer.from(r.pair, "base64"));
  const report = { pair: name, width, board: board.clip, build: build.clip, sizeBoard: r.sizeA, sizeBuild: r.sizeB,
    differing: r.differing, compared: r.compared, pct: +r.pct.toFixed(3), threshold,
    ...(p.look ? { look: true, pass: true, note: "side by side for the owner's look — sizes differ on purpose (the deck's form factor)" }
      : { pass: r.pct <= threshold && r.sizeA.join() === r.sizeB.join() }) };
  fs.writeFileSync(path.join(dir, "report.json"), JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const names = arg("--pair") ? [arg("--pair")] : Object.keys(PAIRS);
  const { launchBrowser } = await import("../services/browserLauncher.js");
  // 47f: text in a composited layer (the deck's 3-D flip — the owner's keep) rasterises in greyscale, the board's flat page
  // in LCD sub-pixel colour; the run compares the DESIGN, so both sides render greyscale (one Chrome flag for both).
  const browser = await launchBrowser({ headless: "new", extraArgs: LAUNCH_ARGS });
  let failed = 0;
  try {
    for (const n of names) {
      const r = await runPair(n, { width: Number(arg("--width", 1280)), threshold: Number(arg("--threshold", THRESHOLD_PCT)), browser });
      if (!r.pass) failed++;
      console.log(`${r.look ? "LOOK" : r.pass ? "PASS" : "FAIL"} ${n}: ${r.pct} % differ (${r.differing} / ${r.compared}), board ${r.sizeBoard.join("×")} vs build ${r.sizeBuild.join("×")} → tmp/d196-regress/${n}/pair.png`);
    }
  } finally { await browser.close(); }
  process.exit(failed ? 1 : 0);
}
