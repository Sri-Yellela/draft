#!/usr/bin/env node
// 44b · "a friend used it in Chrome on Android — it's 404". The app's 404 is drawn IN THE BROWSER (the server answers
// 200 with the app shell for any path), so a person's 404 never shows in the HTTP log. This opens production as a
// signed-out Pixel in real Chrome, follows every same-site link on the given start pages, and reports each page that
// renders "404 — Page Not Found". Read-only: it signs nobody up and submits nothing.
//
// Usage: node scripts/androidProbe.mjs [--base https://jobsviadraft.com] [--paths /,/survey]
import puppeteer from "puppeteer-core";
import { resolveBrowserExecutable } from "../services/browserLauncher.js";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg("base", "https://jobsviadraft.com").replace(/\/$/, "");
const START = arg("paths", "/,/survey,/login,/register").split(",");
const UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

const resolution = await resolveBrowserExecutable();
if (!resolution) { console.error("No Chrome binary."); process.exit(1); }
const browser = await puppeteer.launch({ executablePath: resolution.path, headless: "new", pipe: true });
const page = await browser.newPage();
await page.setUserAgent(UA);
await page.setViewport({ width: 412, height: 915, isMobile: true, hasTouch: true, deviceScaleFactor: 2.6 });

const seen = new Set(), queue = [...START], found = [];
async function visit(p) {
  await page.goto(BASE + p, { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise(r => setTimeout(r, 600));
  const r = await page.evaluate(() => ({
    notFound: /404\s*[—-]\s*Page Not Found/i.test(document.body.innerText),
    url: location.pathname + location.search,
    links: [...document.querySelectorAll("a[href]")].map(a => a.getAttribute("href")),
  }));
  return r;
}
while (queue.length && seen.size < 60) {
  const p = queue.shift();
  if (seen.has(p)) continue;
  seen.add(p);
  let r;
  try { r = await visit(p); } catch (e) { console.log(`ERR  ${p} ${e.message.slice(0, 80)}`); continue; }
  console.log(`${r.notFound ? "404 " : "ok  "} ${p}${r.url !== p ? `  → ${r.url}` : ""}`);
  if (r.notFound) found.push(p);
  if (START.includes(p)) {
    for (const h of r.links) {
      if (!h || h.startsWith("#") || /^(mailto|tel|javascript):/.test(h)) continue;
      let u; try { u = new URL(h, BASE + p); } catch { continue; }
      if (u.origin !== BASE || u.pathname.startsWith("/api/")) continue;
      const k = u.pathname + u.search;
      if (!seen.has(k)) queue.push(k);
    }
  }
}
await browser.close();
console.log(`\n${seen.size} pages, ${found.length} rendered the 404: ${found.join(", ") || "none"}`);
