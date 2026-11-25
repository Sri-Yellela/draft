// ⭐ D198 E4 · THE EXPORT — the posted video IS the in-app explainer. The same engine (client/src/plate/explainer/
// Explainer.jsx) draws every frame at a fixed time (`at`, the clock in explainerModel.js) in headless Chrome at 1080 × 1920;
// ffmpeg joins the frames (and E3's audio, when it exists) into MP4 (H.264 / AAC), captions burned in exactly as on screen.
//   9:16 — the Short: the frame itself, 405 × 720 drawn at 8/3 → 1080 × 1920.
//   16:9 — ⚠ no 16:9 frame is sketched yet (canvas v4 draws 9:16 only, A242): until it is, the 16:9 file holds the gated
//          9:16 frame, centred on paper (1920 × 1080). Never an ungated layout (D196).
// Audio (E3): when every beat has content/explainers/<id>/audio/beat-NN.wav, each beat's track is padded to its beat's
// length and joined; the script's `audioMs` (E3's measured lengths) times the beats. Until E3 runs: a silent track, the
// beats paced at the voice's 2.5 words a second.
// The check (d198ExportMatchesApp): the MP4's frame at each beat's start, decoded by ffmpeg, against the engine's render at
// that time — the same pixels within F5's tolerance (≤ 2 %).
// Output: content/explainers/<id>/export/ (gitignored — the owner posts; no upload automation).
//   node scripts/d198Export.mjs big-o-acted-out [--fps 30] [--openings N] [--check-only]
// --check-only renders just the ten beat-start frames (a 1 fps slideshow) and runs the check: the browser tier's test.
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SIZE = Object.freeze({ w: 1080, h: 1920 });
const DSF = SIZE.w / 405;                       // 8/3: the 405 × 720 frame drawn at 1080 × 1920
const TOLERANCE = 40;                           // per channel, as F5 (scripts/d196Regress.mjs)
export const CHECK_PCT = 2;

export function ffmpegPath() {
  const r = spawnSync(process.platform === "win32" ? "where" : "which", ["ffmpeg"], { encoding: "utf8" });
  const p = (r.stdout || "").split(/\r?\n/).find(Boolean);
  return p || null;
}

/** The export page: the engine, one script, `window.__xpAt(t)` draws the frame at t synchronously. */
export async function buildExportPage(script, outDir) {
  const require = createRequire(path.join(ROOT, "client", "package.json"));
  const esbuild = require("esbuild");
  fs.mkdirSync(outDir, { recursive: true });
  const entry = `
    import { createRoot } from "react-dom/client";
    import { flushSync } from "react-dom";
    import PlateRoot from ${JSON.stringify(path.join(ROOT, "client/src/plate/PlateRoot.jsx"))};
    import { Explainer } from ${JSON.stringify(path.join(ROOT, "client/src/plate/explainer/Explainer.jsx"))};
    const script = JSON.parse(document.getElementById("xp-script").textContent);
    const root = createRoot(document.getElementById("root"));
    window.__xpAt = (t, openings) => flushSync(() => root.render(
      <PlateRoot><div className="plate" data-region={script.region}><Explainer script={script} at={t} openings={openings ?? null}/></div></PlateRoot>));
  `;
  await esbuild.build({
    stdin: { contents: entry, resolveDir: path.join(ROOT, "client"), loader: "jsx" },
    bundle: true, format: "iife", outfile: path.join(outDir, "xp.js"), jsx: "automatic", logLevel: "error",
    loader: { ".woff2": "file", ".woff": "file" }, define: { "process.env.NODE_ENV": '"production"' },
  });
  // the frame alone at (0, 0): the page chrome around it (the screen's border, the controls, the beat list) is the app's
  const html = `<!doctype html><html data-plate-palette="sketch"><head><meta charset="utf-8"><link rel="stylesheet" href="xp.css">
    <style>html,body{margin:0;background:var(--pl-paper,#F4EFE9)} .pl-xp__screen{border:0!important;box-shadow:none!important;border-radius:0!important}
    .pl-xp__controls,.pl-xp__beats{display:none!important} .pl-xp{gap:0!important}</style></head>
    <body><script type="application/json" id="xp-script">${JSON.stringify(script).replace(/</g, "\\u003c")}</script><div id="root"></div><script src="xp.js"></script></body></html>`;
  fs.writeFileSync(path.join(outDir, "xp.html"), html);
  return pathToFileURL(path.join(outDir, "xp.html")).href;
}

/** One frame at t (ms) as PNG bytes, 1080 × 1920. */
async function frame(page, t, openings) {
  await page.evaluate((tt, o) => window.__xpAt(tt, o), t, openings);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
  return page.screenshot({ type: "png", clip: { x: 0, y: 0, width: 405, height: 720 } });
}

/** The audio inputs + filter for ffmpeg: E3's beat files padded to each beat's length, or one silent track. */
function audioArgs(id, script, tl, totalMs) {
  const dir = path.join(ROOT, "content", "explainers", id, "audio");
  const files = script.beats.map((_, i) => path.join(dir, `beat-${String(i + 1).padStart(2, "0")}.wav`));
  if (files.every((f) => fs.existsSync(f))) {
    const inputs = files.flatMap((f) => ["-i", f]);
    const pads = tl.map((b, i) => `[${i + 1}:a]apad,atrim=0:${((b.end - b.start) / 1000).toFixed(3)},asetpts=N/SR/TB[a${i}]`).join(";");
    const filter = `${pads};${tl.map((_, i) => `[a${i}]`).join("")}concat=n=${tl.length}:v=0:a=1[aout]`;
    return { inputs, filter, map: "[aout]", voiced: true };
  }
  return { inputs: ["-f", "lavfi", "-t", (totalMs / 1000).toFixed(3), "-i", "anullsrc=r=48000:cl=stereo"], filter: null, map: "1:a", voiced: false };
}

/** Decode one frame of an MP4 at `sec` → PNG bytes (1080 × 1920). */
function decodeAt(ff, file, sec) {
  const r = spawnSync(ff, ["-v", "error", "-i", file, "-ss", sec.toFixed(4), "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"], { maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0 || !r.stdout?.length) throw new Error(`ffmpeg could not decode ${path.basename(file)} at ${sec}s: ${String(r.stderr || "").slice(0, 300)}`);
  return r.stdout;
}

/** Differing / compared pixels of two PNGs, in the page (no image library in the repo). */
async function comparePngs(page, a, b) {
  return page.evaluate(async (a64, b64, tol) => {
    const load = (s) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = "data:image/png;base64," + s; });
    const [A, B] = await Promise.all([load(a64), load(b64)]);
    const px = (im) => { const c = new OffscreenCanvas(A.width, A.height); const g = c.getContext("2d"); g.drawImage(im, 0, 0); return g.getImageData(0, 0, A.width, A.height).data; };
    const da = px(A), db = px(B);
    let diff = 0;
    for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) > tol || Math.abs(da[i + 1] - db[i + 1]) > tol || Math.abs(da[i + 2] - db[i + 2]) > tol) diff++;
    return { size: [A.width, A.height], sizeB: [B.width, B.height], pct: 100 * diff / (A.width * A.height) };
  }, a.toString("base64"), b.toString("base64"), TOLERANCE);
}

/**
 * Export one explainer. → { files, check: [{ beat, pct, pass }], voiced, fps, frames }.
 * checkOnly: the ten beat-start frames as a 1 fps slideshow, and the check — no full render.
 */
export async function exportExplainer(id, { fps = 30, openings = null, checkOnly = false, browser = null } = {}) {
  const ff = ffmpegPath();
  if (!ff) throw new Error("ffmpeg is not on PATH");
  const script = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "explainers", id, "script.json"), "utf8"));
  const { timeline, lengthMs } = await import(pathToFileURL(path.join(ROOT, "client/src/plate/explainer/explainerModel.js")).href);
  const tl = timeline(script), totalMs = lengthMs(script);
  const outDir = path.join(ROOT, "content", "explainers", id, "export");
  const work = path.join(ROOT, "tmp", "d198-export", id);
  const url = await buildExportPage(script, work);
  fs.mkdirSync(outDir, { recursive: true });
  let own = null;
  if (!browser) { const { launchBrowser } = await import("../services/browserLauncher.js"); own = browser = await launchBrowser({ headless: "new", extraArgs: ["--disable-lcd-text"] }); }
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 405, height: 720, deviceScaleFactor: DSF });
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
    await page.goto(url, { waitUntil: "load" });
    await page.waitForFunction(() => typeof window.__xpAt === "function");
    await page.evaluate(() => document.fonts && document.fonts.ready);
    // the times drawn: every frame, or (check-only) each beat's start — a beat's first frame, one frame in
    const step = 1000 / fps;
    const times = checkOnly ? tl.map((b) => b.start + step / 2) : Array.from({ length: Math.ceil(totalMs / step) }, (_, k) => k * step);
    const rate = checkOnly ? 1 : fps;
    const dur = checkOnly ? tl.length * 1000 : totalMs;
    const audio = checkOnly ? { inputs: ["-f", "lavfi", "-t", String(dur / 1000), "-i", "anullsrc=r=48000:cl=stereo"], filter: null, map: "1:a", voiced: false } : audioArgs(id, script, tl, totalMs);
    const short = path.join(outDir, `${id}${checkOnly ? ".check" : ""}-9x16.mp4`), wide = path.join(outDir, `${id}${checkOnly ? ".check" : ""}-16x9.mp4`);
    // one render, two files: the Short as drawn; the 16:9 the same frame centred on paper (A242: until a 16:9 frame is sketched)
    const v = `[0:v]format=yuv420p,split=2[s][w0];[w0]scale=-2:1080,pad=1920:1080:(ow-iw)/2:0:color=0xF4EFE9[w]`;
    const filter = audio.filter ? `${v};${audio.filter}` : v;
    const args = ["-y", "-v", "error", "-f", "image2pipe", "-framerate", String(rate), "-i", "-", ...audio.inputs, "-filter_complex", filter,
      "-map", "[s]", "-map", audio.map, "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-r", String(rate), "-c:a", "aac", "-b:a", "160k", "-shortest", short,
      "-map", "[w]", "-map", audio.map, "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-r", String(rate), "-c:a", "aac", "-b:a", "160k", "-shortest", wide];
    const enc = spawn(ff, args, { stdio: ["pipe", "ignore", "pipe"] });
    let err = ""; enc.stderr.on("data", (d) => { err += d; });
    const done = new Promise((res, rej) => enc.on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}: ${err.slice(0, 600)}`)))));
    const drawn = [];
    for (let k = 0; k < times.length; k++) {
      const png = await frame(page, times[k], openings);
      if (checkOnly) drawn.push(png);
      if (!enc.stdin.write(png)) await new Promise((r) => enc.stdin.once("drain", r));
      // the last frame held one frame more: a piped image sequence gives its final frame no duration, so it fell off the end
      if (k === times.length - 1 && !enc.stdin.write(png)) await new Promise((r) => enc.stdin.once("drain", r));
    }
    enc.stdin.end();
    await done;
    // the check: the MP4's frame at each beat start against the engine's render at that time
    const check = [];
    for (let i = 0; i < tl.length; i++) {
      const t = tl[i].start + step / 2;
      // an output-side seek keeps frames starting at or after `sec`: just before the frame's own start picks that frame
      const sec = Math.max(0, (checkOnly ? i : Math.floor(t / step) / fps) - 0.0005);
      const app = checkOnly ? drawn[i] : await frame(page, Math.floor(t / step) * step, openings);
      const r = await comparePngs(page, app, decodeAt(ff, short, sec));
      check.push({ beat: i + 1, pct: +r.pct.toFixed(3), size: r.sizeB, pass: r.pct <= CHECK_PCT && r.sizeB.join() === r.size.join() });
    }
    const report = { id, fps: rate, frames: times.length, ms: Math.round(dur), voiced: audio.voiced, size: [SIZE.w, SIZE.h], files: [short, wide].map((f) => path.relative(ROOT, f).split(path.sep).join("/")), check };
    fs.writeFileSync(path.join(outDir, `${checkOnly ? "check" : "export"}.json`), JSON.stringify(report, null, 2));
    return report;
  } finally {
    await page.close();
    if (own) await own.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const id = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "big-o-acted-out";
  const r = await exportExplainer(id, { fps: Number(arg("--fps", 30)), openings: arg("--openings") ? Number(arg("--openings")) : null, checkOnly: process.argv.includes("--check-only") });
  console.log(JSON.stringify({ ...r, check: r.check.map((c) => `${c.beat}:${c.pct}%${c.pass ? "" : " FAIL"}`).join(" ") }, null, 1));
  process.exit(r.check.every((c) => c.pass) ? 0 : 1);
}
