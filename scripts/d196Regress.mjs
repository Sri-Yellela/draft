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

async function shot(page, url, sel, width, pad, waitMs) {
  await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: "load", timeout: 60000 });
  await page.waitForSelector(sel, { timeout: 30000 });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  // let the board's entrance animations finish (draw-on 3.5 s, view-in .35 s) — and stop the loops for a still frame
  await new Promise((r) => setTimeout(r, waitMs));
  await page.addStyleTag({ content: "*,*::before,*::after{animation-play-state:paused!important;transition:none!important}" });
  const box = await page.$eval(sel, (el) => { const r = el.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; });
  const clip = { x: Math.max(0, Math.floor(box.x - pad)), y: Math.max(0, Math.floor(box.y - pad)), width: Math.ceil(box.w + 2 * pad), height: Math.ceil(box.h + 2 * pad) };
  return { png: await page.screenshot({ clip, captureBeyondViewport: true }), clip };
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
  const index = unpackCanvas();
  const row = index.find((r) => r.title === p.board);
  const boardUrl = pathToFileURL(path.join(CANVAS, row.file)).href;
  const buildUrl = await buildFixturePage(p.fixture);
  const page = await browser.newPage();
  const board = await shot(page, boardUrl, p.boardSel, width, p.pad, 4000);
  const build = await shot(page, buildUrl, p.buildSel, width, p.pad, 600);
  const r = await compareInPage(page, board.png, build.png, p.masks || []);
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
