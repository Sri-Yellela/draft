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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "tmp", "d196-regress");
export const THRESHOLD_PCT = 2;
export const TOLERANCE = 40;   // per channel, 0–255

/** The pairs: a board, the element to crop on each side, and the fixture that builds it. */
export const PAIRS = {
  "shell-market-dock": { board: "The market · draft", fixture: "ShellMarket", boardSel: 'nav[aria-label="Main"]', buildSel: 'nav[aria-label="Main"]', pad: 6 },
  "shell-market-nav": { board: "The market · draft", fixture: "ShellMarket", boardSel: "header", buildSel: "header.pl-areanav", pad: 0 },
  // P1 · the card face: the owner kept the deck's form factor (11-24), so the face can never be the board's size — this pair
  // is a LOOK for the owner (pair.png), not a pixel gate; its report says so instead of passing or failing.
  "market-face": { board: "The market · draft", fixture: "MarketFace", boardSel: "article[aria-label]", buildSel: "[data-market-face-fixture]", pad: 6, look: true },
  // P1 · the bearing: the board's sentence carries clauses the live model words differently (the résumé's own role, level,
  // sponsorship), so this too is a look at the cartouche's frame and type, not a pixel gate.
  "market-bearing": { board: "The market · draft", fixture: "MarketBearing", boardSel: "section:nth-of-type(2)", buildSel: "[data-market-bearing-fixture]", pad: 0, look: true },
  "market-hero": { board: "The market · draft", fixture: "MarketHeroBoard", boardSel: 'section[aria-labelledby="mk-title"]', buildSel: 'section[aria-labelledby="mk-title"]', pad: 0, waitBuild: 4000, reduced: true,   // both at rest: the tags' float stops under reduced motion on each side
    // the one figure the build words differently on purpose: the board's "MATCH ≥ 85%" — draft counts the strong band
    // (shared/atsBands.js), which is not ≥ 85 %, so the cell says STRONG FIT; its label is masked, its number is not
    masks: [[400, 345, 100, 18]] },
  // P1 · the openings: the deck card keeps the deck's form factor (600 wide, not the board's 760), so the section is a look
  "market-openings": { board: "The market · draft", fixture: "MarketOpeningsBoard", boardSel: "section:nth-of-type(3)", buildSel: "#openings", pad: 0, look: true, reduced: true },
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
};

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

async function buildFixturePage(name) {
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
  const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${name}.css">
    <style>html,body{margin:0;background:var(--pl-paper, #F4EFE9)}</style></head><body><div id="root"></div><script src="${name}.js"></script></body></html>`;
  const file = path.join(dir, `${name}.html`);
  fs.writeFileSync(file, html);
  return pathToFileURL(file).href;
}

async function shot(page, url, sel, width, pad, waitMs, reduced = false, ground = null, hide = null) {
  await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: reduced ? "reduce" : "no-preference" }]);
  await page.goto(url, { waitUntil: "load", timeout: 60000 });
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
  const src = p.source ? SOURCES[p.source] : null;
  const index = src ? unpackCanvas(src.file, src.out) : unpackCanvas();
  const row = index.find((r) => r.title === p.board);
  if (!row) throw new Error(`no board "${p.board}" in ${src ? src.name : "the v3 export"}`);
  const boardUrl = pathToFileURL(path.join(src ? src.out : CANVAS, row.file)).href;
  let buildUrl = await buildFixturePage(p.fixture);
  const page = await browser.newPage();
  const board = await shot(page, boardUrl, p.boardSel, width, p.pad, 4000, !!p.reduced, p.ground, p.hideOnBoard);
  // matchWidth: the build draws at the board element's EXACT width and at the same sub-pixel offset inside its first pixel,
  // so both rasterise on the same grid (the board's signpost sits at x = 994.73, 260.27 wide — drawn at 261 from x = 0 every
  // outline landed a fraction off and read as a difference)
  const frac = (v) => +(v - Math.floor(v)).toFixed(4);
  if (p.matchWidth || p.drawing) buildUrl += `#${new URLSearchParams({ ...(p.drawing ? { name: p.drawing } : {}),
    ...(p.matchWidth ? { w: String(board.box.w), h: String(board.box.h), ox: String(frac(board.box.x - p.pad)), oy: String(frac(board.box.y - p.pad)) } : {}) })}`;
  const build = await shot(page, buildUrl, p.buildSel, width, p.pad, p.waitBuild || 600, !!p.reduced, p.ground);
  // cornerMasks: the board container's rounded corners clip the drawing's corners there (the page's frame, not the drawing)
  const cm = p.cornerMasks, bw = board.clip.width, bh = board.clip.height;
  const masks = [...(p.masks || []), ...(cm ? [[0, 0, cm, cm], [bw - cm, 0, cm, cm], [0, bh - cm, cm, cm], [bw - cm, bh - cm, cm, cm]] : [])];
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
  const browser = await launchBrowser({ headless: "new" });
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
