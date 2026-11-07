#!/usr/bin/env node
// ⭐ D166 T1 · the overlays a person opens from the two most-seen screens, shot in a real Chrome against a LOCAL draft on a
// THROWAWAY database copy (boot as in scripts/d166InventoryShots.mjs). A SYNTHETIC account; one held application is seeded
// (--db, the copy) so the tracker has a run to review. Prints one JSON line per overlay.
//   node scripts/d166OverlayShots.mjs --db <copy>/resume_master.db [--base http://localhost:3967] [--out docs/legacy-shots]
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { launchBrowser } from "../services/browserLauncher.js";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg("--base", "http://localhost:3967");
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(BASE)) { console.error("REFUSING: --base must be localhost"); process.exit(2); }
const DB = arg("--db", null);
if (!DB || path.resolve(DB).startsWith(path.resolve("data"))) { console.error("REFUSING: --db must be a throwaway COPY outside data/"); process.exit(2); }
const OUT = arg("--out", "docs/legacy-shots");
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const overlayState = (page) => page.evaluate(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0; };
  const full = [...document.querySelectorAll("body *")].filter(el => {
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    return cs.position === "fixed" && vis(el) && r.width >= innerWidth * 0.95 && r.height >= innerHeight * 0.95 && Number(cs.zIndex || 0) > 10;
  });
  const top = full[full.length - 1];
  const text = document.body.innerText || "";
  return {
    fullScreenOverlay: full.length,
    scrim: top ? getComputedStyle(top).backgroundColor : null,
    blur: top ? (getComputedStyle(top).backdropFilter || "none") : null,
    words: ["No signal", "Open & fill", "HELD ON PURPOSE", "Held on purpose", "held_review", "reasonCode", "undefined"].filter(w => text.includes(w)),
    rawUrls: (text.match(/https?:\/\/[^\s)]+/g) || []).length,
    headline: (top?.querySelector("h1,h2,h3")?.innerText || "").slice(0, 80),
  };
});

const browser = await launchBrowser({ headless: true });
try {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
  const user = `d166o${Date.now().toString(36)}`;
  await page.evaluate(async (u) => {
    const res = await fetch("/api/auth/register", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: u, password: "Walk-Pass-2026!x", profile: { email: `${u}@example.com`, first_name: "Shot", last_name: "Tester" } }) });
    const j = await res.json().catch(() => ({})); if (j.authContext) sessionStorage.setItem("rm_auth_context", j.authContext);
  }, user);
  { // one held application, so the tracker has a run to review
    const db = new Database(DB);
    const uid = db.prepare("SELECT id FROM users WHERE username=?").get(user).id;
    const job = db.prepare("SELECT job_id FROM scraped_jobs WHERE is_active=1 LIMIT 1").get().job_id;
    const run = db.prepare("INSERT INTO apply_runs (user_id, mode, status, total_jobs) VALUES (?, 'auto', 'completed', 1)").run(uid).lastInsertRowid;
    db.prepare(`INSERT INTO apply_run_jobs (run_id, user_id, job_id, status, reason_code, open_questions_json, created_at)
      VALUES (?, ?, ?, 'held_review', 'incomplete_form', ?, unixepoch())`).run(run, uid, job, JSON.stringify([{ question: "Salary expectation", type: "text" }]));
    db.close();
  }
  const shots = [];
  const shot = async (name, note) => { const s = await overlayState(page); await page.screenshot({ path: `${OUT}/${name}-1280.png` }); const row = { name, note, ...s }; shots.push(row); console.log(JSON.stringify(row)); };

  // Home → a posting
  await page.goto(`${BASE}/app/today`, { waitUntil: "networkidle2" }); await wait(1500);
  const bubble = await page.$(".jb, [data-job-bubble], [data-bubble]");
  if (bubble) { await bubble.click(); await wait(1200); await shot("home-posting-open", "Home → press a job bubble"); await page.keyboard.press("Escape"); await wait(500); }
  else console.log(JSON.stringify({ name: "home-posting-open", missing: "no bubble on Home for a new account" }));
  // Home → a bubble's logo → the company view
  const logo = await page.$(".jb__logo");
  if (logo) { await logo.click(); await wait(1200); await shot("home-company-view", "Home → press a bubble's company logo (CompanyViewModal)"); await page.keyboard.press("Escape"); await wait(400); }
  else console.log(JSON.stringify({ name: "home-company-view", missing: "no .jb__logo" }));

  // The tracker → Review all → the runs review modal
  await page.goto(`${BASE}/app/auto-apply`, { waitUntil: "networkidle2" }); await wait(1500);
  const clicked = await page.evaluate(() => { const a = [...document.querySelectorAll("a,button")].find(b => /Review all/i.test(b.innerText)); if (a) { a.click(); return true; } return false; });
  if (clicked) { await wait(1200); await shot("tracker-review-all", "Tracker timeline → Review all (the Apply Runs Review modal)"); await page.keyboard.press("Escape"); await wait(400); }
  else console.log(JSON.stringify({ name: "tracker-review-all", missing: "no Review all link" }));
  // The tracker → Settings drawer
  const set = await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find(x => /^Settings$/i.test(x.innerText.trim())); if (b) { b.click(); return true; } return false; });
  if (set) { await wait(1000); await shot("tracker-settings-drawer", "Tracker → Settings (AutoSettingsDrawer, D148)"); }
  fs.writeFileSync(`${OUT}/overlays-1280.json`, JSON.stringify(shots, null, 2));
} finally { await browser.close(); }
