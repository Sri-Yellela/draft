// scripts/d176RenderedRead.mjs — ⭐ D176-1 (45s) pass 3: the to-verify rows whose licence the plain-HTML passes could not see
// (the page renders with script). Each row's page is RENDERED in headless Chrome, paced (one page at a time, ~2 s apart,
// a generic client name), and what it states is collected — never classified here:
//   · statements on the page itself (Creative Commons / CC0 / MIT / Apache / GPL / public domain / "All rights reserved" /
//     "not subject to copyright" / licensed under …), each with its surrounding words
//   · up to 3 of its own links named licence / copyright / terms / legal / reuse, rendered and read the same way
// Output: tmp/d176-rendered.json (row id → { url, statements[], links[{ url, statements[] }], error }). A person classifies
// from the quotes (the D176-1 rule: a repo or software licence, a footer-only line or a mixed site is HELD with its quote).
// Usage: node scripts/d176RenderedRead.mjs [--ids a,b,c]
import fs from "node:fs";
import puppeteer from "puppeteer-core";
import { resolveBrowserExecutable } from "../services/browserLauncher.js";
import { loadRegistry } from "../services/atlas/sourceRegistry.js";

const OUT = "tmp/d176-rendered.json";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const retry = process.argv.includes("--retry-errors");
const want = (() => { const i = process.argv.indexOf("--ids"); return i > 0 ? new Set(process.argv[i + 1].split(",")) : null; })();
const reg = loadRegistry();
const rows = (reg.sources || reg).filter(s => s.licenceClass === "to-verify" && (!want || want.has(s.id)) && !/google\.com\/search/.test(s.url));
const done = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
// --retry-errors: only the rows whose read failed (a timeout, or the tab that died), each in a FRESH tab.

const PAT = /(creative\s*commons|\bCC[- ]?BY(?:[- ](?:SA|NC|ND))*(?:[- ]?\d\.\d)?|\bCC0\b|public domain|not subject to copyright|MIT License|Apache License|GNU (?:Free Documentation|General Public) License|\bGPL\b|licen[cs]ed under|all rights reserved|may not be (?:reproduced|copied)|permission (?:is|to) (?:granted|reproduce)|terms of (?:use|service))/gi;

async function readPage(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await sleep(2500);   // let the script draw the footer
  await sleep(800);
  return page.evaluate((src) => {
    const re = new RegExp(src, "gi");
    const text = (document.body?.innerText || "").replace(/\s+/g, " ");
    const statements = [];
    for (const m of text.matchAll(re)) {
      const s = Math.max(0, m.index - 140), e = Math.min(text.length, m.index + m[0].length + 160);
      const q = text.slice(s, e).trim();
      if (!statements.some(x => x.includes(m[0]) && x.slice(0, 60) === q.slice(0, 60))) statements.push(q);
      if (statements.length >= 8) break;
    }
    const links = [...document.querySelectorAll("a[href]")]
      .filter(a => /licen[cs]e|copyright|terms|legal|reuse|permissions/i.test(`${a.textContent} ${a.getAttribute("href")}`))
      .map(a => a.href).filter(h => /^https?:/.test(h)).filter((h, i, all) => all.indexOf(h) === i).slice(0, 3);
    return { statements, links };
  }, PAT.source);
}

const resolution = await resolveBrowserExecutable();
if (!resolution?.path) { console.log(JSON.stringify({ skipped: "no Chrome" })); process.exit(0); }
const browser = await puppeteer.launch({ executablePath: resolution.path, headless: "new", pipe: true, args: ["--no-first-run", "--no-default-browser-check"] });
try {
  for (const r of rows) {
    if (retry ? !done[r.id]?.error : (done[r.id] && !want)) continue;
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (compatible; draft-licence-reader/1.0)");
    const rec = { url: r.url, statements: [], links: [], error: null, readAt: new Date().toISOString() };
    try {
      const main = await readPage(page, r.url);
      rec.statements = main.statements;
      for (const l of main.links) {
        await sleep(1500);
        try { const sub = await readPage(page, l); rec.links.push({ url: l, statements: sub.statements }); }
        catch (e) { rec.links.push({ url: l, statements: [], error: String(e.message).slice(0, 120) }); }
      }
    } catch (e) { rec.error = String(e.message).slice(0, 160); }
    done[r.id] = rec;
    fs.writeFileSync(OUT, JSON.stringify(done, null, 1));
    console.log(`${r.id}: ${rec.error ? "ERROR " + rec.error : `${rec.statements.length} on page, ${rec.links.length} links`}`);
    await page.close().catch(() => {});
    await sleep(2000);
  }
} finally { await browser.close(); }
