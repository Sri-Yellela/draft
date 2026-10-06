// scripts/d37HeaderGeometry.mjs — D37 (owner, 10-06): the header is ONE CENTRED COLUMN.
//
// Loads the REAL client/src/components/FullHouse.css into a static page with the header's structure
// (sentence, open panel, bar) and measures it headless at 390 / 1280 / 1920 / 2560. Local file only —
// no server, no login, no network. Checks GEOMETRY; colours are runtime tokens and are not drawn here.
//   node scripts/d37HeaderGeometry.mjs            → prints each width; exits 1 on a violation
// Pass: the sentence, panel and bar share left and right edges · left and right margins differ ≤ 1px ·
// the bar never exceeds 760px · at 390 it fills the window inside the 16px gutters.
import path from "node:path";
import fs from "node:fs";
import { pathToFileURL, fileURLToPath } from "node:url";
import os from "node:os";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "d37-"));
const { launchBrowser } = await import(pathToFileURL(path.join(repo, "services/browserLauncher.js")).href);
const css = pathToFileURL(path.join(repo, "client/src/components/FullHouse.css")).href;
const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${css}">
<style>body{margin:0;font:16px system-ui} :root{--fh-sentence-family:Georgia;--fh-sentence-size:26px;--fh-sentence-line:1.35;--fh-sentence-weight:400}</style></head>
<body><header class="fh">
<h1 class="bh" id="s"><span class="bh__verb">discovering</span> <button class="tok">all</button> roles at <button class="tok">all</button> career levels and <button class="tok">all</button> workstyles in <button class="tok" aria-pressed="true">the United States</button>.</h1>
<section class="fh-pan" id="p"><div class="fh-pin">panel</div></section>
<div class="fh-bar" id="b"><div class="fh-views"><button>ALL</button><button>★</button><button>/d</button><button>+</button></div>
<div class="fh-srch"><input placeholder="Job title, company, or anything in the posting…"></div><button class="fh-ico">⇅</button></div>
</header></body></html>`;
const file = path.join(outDir, "page.html");
fs.writeFileSync(file, html);
const browser = await launchBrowser({ headless: "new" });
const page = await browser.newPage();
const out = [];
for (const w of [390, 1280, 1920, 2560]) {
  await page.setViewport({ width: w, height: 900 });
  await page.goto(pathToFileURL(file).href);
  const r = await page.evaluate(() => {
    const box = (id) => { const b = document.getElementById(id).getBoundingClientRect(); return { left: b.left, right: b.right, width: b.width }; };
    return { s: box("s"), p: box("p"), b: box("b"), vw: document.documentElement.clientWidth };
  });
  out.push({ w, ...r, marginL: r.b.left, marginR: r.vw - r.b.right });
}
await browser.close();
let bad = 0;
for (const r of out) {
  const edges = [r.s, r.p, r.b].every(x => Math.abs(x.left - r.b.left) <= 1 && Math.abs(x.right - r.b.right) <= 1);
  const centred = Math.abs(r.marginL - r.marginR) <= 1;
  const ceiling = r.b.width <= 760.5;
  const fills = r.w > 804 || Math.abs(r.b.width - (r.vw - 32)) <= 1;
  const ok = edges && centred && ceiling && fills;
  if (!ok) bad++;
  console.log(`${ok ? "ok " : "BAD"} ${r.w}: sentence ${r.s.left}/${r.s.width} · panel ${r.p.left}/${r.p.width} · bar ${r.b.left}/${r.b.width} · margins ${r.marginL}/${r.marginR}`);
}
fs.rmSync(outDir, { recursive: true, force: true });
process.exit(bad ? 1 : 0);
