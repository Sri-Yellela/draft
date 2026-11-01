#!/usr/bin/env node
// Owner 11-01 (bug: /try's text cut off on the right; /survey with no logo): /try and /survey at 360, 390, 768 and
// 1280 px in Paper Light and Charcoal Dark — the page never scrolls sideways and no text block overflows its box; the
// survey shows the /draft header. LOCAL ONLY. Screenshots into docs/tour-shots/.
import path from "node:path";
import fs from "node:fs";
import { launchBrowser } from "../services/browserLauncher.js";

const BASE = process.argv.includes("--base") ? process.argv[process.argv.indexOf("--base") + 1] : "http://localhost:3917";
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(BASE)) { console.error("REFUSING: --base must be localhost"); process.exit(2); }
const OUT = "docs/tour-shots";
fs.mkdirSync(OUT, { recursive: true });
let failed = 0;
const b = await launchBrowser({ headless: "new" });
try {
  for (const w of [360, 390, 768, 1280]) for (const theme of ["light", "dark"]) for (const pg of ["/try", "/survey"]) {
    const ctx = await b.createBrowserContext();
    const p = await ctx.newPage();
    await p.setViewport({ width: w, height: 860, ...(w < 600 ? { isMobile: true, hasTouch: true } : {}) });
    await p.evaluateOnNewDocument((t) => { try { localStorage.setItem("draft-theme", t); } catch {} }, theme);
    await p.goto(BASE + pg, { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 600));
    const r = await p.evaluate(() => {
      const page = document.documentElement.scrollWidth > window.innerWidth + 1;
      const blocks = [...document.querySelectorAll("h1, h2, p, label, span, a")].filter(e => e.getClientRects().length)
        .filter(e => e.textContent.trim() && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== "visible").map(e => e.textContent.slice(0, 40));
      const nav = document.querySelector("nav, header")?.getBoundingClientRect().bottom || 0;
      const underNav = [...document.querySelectorAll("main h1, h1[data-try-heading]")].filter(e => e.getBoundingClientRect().top < nav - 1).map(e => e.textContent.slice(0, 40));
      const offRight = [...document.querySelectorAll("h1, p")].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1).map(e => e.textContent.slice(0, 40));
      return { page, blocks, offRight, underNav, header: !!document.querySelector("[data-survey-header] img, [data-survey-header] svg, [data-survey-header] a") };
    });
    const ok = !r.page && !r.blocks.length && !r.offRight.length && !r.underNav.length && (pg !== "/survey" || r.header);
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${pg} ${w}px ${theme}${ok ? "" : `  ${JSON.stringify(r)}`}`);
    await p.screenshot({ path: path.join(OUT, `page-${pg.slice(1)}-${w}-${theme}.jpg`), type: "jpeg", quality: 70, fullPage: true });
    await ctx.close();
  }
} finally { await b.close(); }
console.log(failed ? `${failed} FAILED` : "ALL PASS");
process.exit(failed ? 1 : 0);
