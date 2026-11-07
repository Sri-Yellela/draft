#!/usr/bin/env node
// ⭐ D166 T1 · THE LEGACY-SCREEN INVENTORY, SHOT — every route a person can reach, in a real Chrome, against a LOCAL draft
// on a THROWAWAY copy of the database (never production). Boot first:
//   COOKIE_ENCRYPTION_KEY=<random> RM_DATA_DIR=<temp dir holding a COPY of data/resume_master.db> ANTHROPIC_KEY= PORT=3967 node server.js
// then:
//   node scripts/d166InventoryShots.mjs [--base http://localhost:3967] [--out docs/legacy-shots] [--width 1280]
// A SYNTHETIC account is made; each route is opened signed in (public pages too — they render the same either way, except
// /login and /register, opened in a signed-out context). Per page: a screenshot and the markers D166 names, read from
// the RENDERED page — internal words (No signal · Open & fill · HELD ON PURPOSE · Held on purpose · runJob / reasonCode
// leaks), raw URLs shown as text, a visible modal, a blurred backdrop, horizontal scroll. Prints one JSON line per page.
import fs from "node:fs";
import { launchBrowser } from "../services/browserLauncher.js";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg("--base", "http://localhost:3967");
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(BASE)) { console.error("REFUSING: --base must be localhost"); process.exit(2); }
const OUT = arg("--out", "docs/legacy-shots");
const W = Number(arg("--width", 1280));
fs.mkdirSync(OUT, { recursive: true });

export const ROUTES = [
  // signed in — the app
  "/app/today", "/app/auto-apply", "/app/atlas", "/app/profile", "/app/interview", "/app/job-profiles",
  "/app/integrations", "/app/account", "/app/saved-answers", "/app/customise", "/app/recruiter",
  "/profile", "/interview", "/atlas",
  // public
  "/", "/features", "/how-it-works", "/extension", "/pricing", "/about", "/contact", "/faq", "/privacy", "/terms",
  "/survey", "/docs/claude", "/products", "/blog", "/tools/ats", "/tools/generate", "/tools/apply", "/tools/honesty",
  "/resume", "/ats-score",
];
const SIGNED_OUT = ["/login", "/register"];

const slug = (r) => (r === "/" ? "landing" : r.replace(/^\//, "").replace(/[/?=&]+/g, "-"));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function read(page) {
  return page.evaluate(() => {
    const text = document.body.innerText || "";
    const vis = (el) => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0; };
    const words = ["No signal", "Open & fill", "HELD ON PURPOSE", "Held on purpose", "reasonCode", "runJob", "held_review", "undefined", "NaN"]
      .filter(w => text.includes(w));
    const rawUrls = (text.match(/https?:\/\/[^\s)]+/g) || []).slice(0, 3);
    const modals = [...document.querySelectorAll("[role=dialog][aria-modal=true], [aria-modal=true]")].filter(vis)
      .map(m => m.getAttribute("aria-label") || m.className || "dialog");
    const blurred = [...document.querySelectorAll("body *")].filter(el => {
      const f = getComputedStyle(el).backdropFilter || getComputedStyle(el).webkitBackdropFilter || "";
      return /blur\(/.test(f) && vis(el) && el.getBoundingClientRect().width >= window.innerWidth * 0.9 && el.getBoundingClientRect().height >= window.innerHeight * 0.9;
    }).length;
    return {
      url: location.pathname + location.search,
      title: (document.querySelector("h1, h2")?.innerText || document.title || "").replace(/\s+/g, " ").slice(0, 80),
      words, rawUrls, modals, fullScreenBlur: blurred,
      hscroll: document.documentElement.scrollWidth > window.innerWidth + 1,
      height: document.documentElement.scrollHeight,
    };
  });
}

const browser = await launchBrowser({ headless: true });
const results = [];
try {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message || e).slice(0, 120)));
  await page.setViewport({ width: W, height: 800, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
  const user = `d166${Date.now().toString(36)}`;
  const reg = await page.evaluate(async (u) => {
    const res = await fetch("/api/auth/register", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: u, password: "Walk-Pass-2026!x", profile: { email: `${u}@example.com`, first_name: "Shot", last_name: "Tester" } }) });
    const j = await res.json().catch(() => ({}));
    if (j.authContext) sessionStorage.setItem("rm_auth_context", j.authContext);
    return res.status;
  }, user);
  if (reg !== 200) { console.error(`sign-up failed: ${reg}`); process.exit(1); }
  for (const r of ROUTES) {
    errors.length = 0;
    await page.goto(`${BASE}${r}`, { waitUntil: "networkidle2", timeout: 45000 }).catch(() => {});
    await wait(1200);
    const s = await read(page);
    await page.screenshot({ path: `${OUT}/${slug(r)}-${W}.png`, fullPage: false });
    const row = { route: r, signedIn: true, ...s, errors: [...errors] };
    results.push(row); console.log(JSON.stringify(row));
  }
  const out = await browser.createBrowserContext();
  const p2 = await out.newPage();
  await p2.setViewport({ width: W, height: 800, deviceScaleFactor: 1 });
  for (const r of SIGNED_OUT) {
    await p2.goto(`${BASE}${r}`, { waitUntil: "networkidle2", timeout: 45000 }).catch(() => {});
    await wait(800);
    const s = await read(p2);
    await p2.screenshot({ path: `${OUT}/${slug(r)}-${W}.png`, fullPage: false });
    const row = { route: r, signedIn: false, ...s, errors: [] };
    results.push(row); console.log(JSON.stringify(row));
  }
} finally { await browser.close(); }
fs.writeFileSync(`${OUT}/inventory-${W}.json`, JSON.stringify(results, null, 2));
