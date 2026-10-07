// D69 (b) · THE TOP NAV AT PHONE WIDTHS — the real app, a real server, headless Chrome.
//
//   node scripts/d69NavPass.mjs <base>
//
// Run against a THROWAWAY server only (RM_DATA_DIR on a copy, keys blanked). Registers a SYNTHETIC user,
// opens the board at 360, 390, 440 and 1280px, and measures: does every tab fit (no scrolling), is every
// tab inside the viewport and clear of the avatar, and does the row stay inside the bar. Every page
// request that leaves localhost is aborted. Prints JSON; screenshots to ../draft-screenshots/d69.
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { resolveBrowserExecutable } from "../services/browserLauncher.js";

const BASE = process.argv[2] || "http://127.0.0.1:3169";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "")), "..");
const OUT = path.resolve(ROOT, "..", "draft-screenshots", "d69");
let cookie = "";
async function call(method, p, body) {
  const r = await fetch(`${BASE}${p}`, { method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
  const set = r.headers.get("set-cookie");
  if (set && /connect\.sid=/.test(set)) cookie = set.split(";")[0];
  return r;
}

fs.mkdirSync(OUT, { recursive: true });
const u = `d69nav${Date.now() % 100000}`;
const reg = await call("POST", "/api/auth/register", { username: u, password: "Synthetic-Pass-69!", profile: { email: `${u}@example.invalid`, first_name: "Ada", last_name: "Synthetic" } });
const browser = await puppeteer.launch({ executablePath: (await resolveBrowserExecutable()).path, headless: "new", pipe: true, args: ["--no-first-run"] });
const page = await browser.newPage();
await page.setRequestInterception(true);
let aborted = 0;
page.on("request", req => { const h = new URL(req.url()).hostname; if (["localhost", "127.0.0.1"].includes(h) || /^(data|blob):/.test(req.url())) req.continue(); else { aborted++; req.abort(); } });
const errors = [];
page.on("pageerror", e => errors.push(String(e.message || e)));
// The app carries its session as an auth-context token in sessionStorage (client/src/lib/api.js), not a cookie.
const token = (await reg.json()).authContext;
await page.evaluateOnNewDocument((t) => { try { sessionStorage.setItem("rm_auth_context", t); } catch {} }, token);
const seen = {};
for (const w of [360, 390, 440, 1280]) {
  await page.setViewport({ width: w, height: 800, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/app/jobs`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('nav[aria-label="Main"] a', { timeout: 20000 });
  await new Promise(r => setTimeout(r, 700));
  seen[w] = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Main"]');
    const bar = nav.closest("header") || nav.parentElement.parentElement;
    const tabs = [...nav.querySelectorAll("a")].map(a => { const r = a.getBoundingClientRect(); return { text: a.innerText.replace(/\s+/g, " "), left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom) }; });
    const avatar = document.querySelector('[aria-haspopup="menu"], [data-avatar], button[aria-label*="ccount" i]');
    const ar = avatar?.getBoundingClientRect();
    const br = bar.getBoundingClientRect();
    return {
      fits: nav.scrollWidth <= nav.clientWidth + 1,
      scrollWidth: nav.scrollWidth, clientWidth: nav.clientWidth,
      allInViewport: tabs.every(t => t.left >= 0 && t.right <= window.innerWidth),
      clearOfAvatar: ar ? tabs.every(t => t.right <= ar.left) : null,
      insideBar: tabs.every(t => t.top >= br.top - 1 && t.bottom <= br.bottom + 1),
      tabs,
    };
  });
  await page.screenshot({ path: path.join(OUT, `nav-${w}.png`), clip: { x: 0, y: 0, width: w, height: 70 } });
}
await browser.close();
console.log(JSON.stringify({ seen, pageErrors: errors, abortedOffLocalhost: aborted }, null, 2));
