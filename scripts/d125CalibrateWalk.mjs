#!/usr/bin/env node
// ⭐ D125 · THE CALIBRATION SCREEN, WALKED IN REAL CHROME (LOCAL ONLY — refuses a non-localhost base). A synthetic
// admin ACCOUNT (D95 — its own row and session cookie, made in the server's database) copies a résumé from an
// account, makes the set, reviews a posting (a mark, a missed term, must ↔ nice, a feel, an own score, Done), opens
// Results, records a baseline. Screenshots to docs/tour-shots/ (untracked).
//
//   node scripts/d125CalibrateWalk.mjs --db <the running server's database> [--base http://localhost:3917] [--from <username>]
import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { launchBrowser } from "../services/browserLauncher.js";
import { createAdminAccount, createAdminSession, ADMIN_COOKIE } from "../services/adminAccounts.js";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg("--base", "http://localhost:3917");
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(BASE)) { console.error("REFUSING: --base must be localhost"); process.exit(2); }
const DB = arg("--db", null);
if (!DB) { console.error("--db <path> is required"); process.exit(2); }
const OUT = "docs/tour-shots";
fs.mkdirSync(OUT, { recursive: true });
let failed = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  — ${detail}`}`); if (!ok) failed++; };
const wait = (ms) => new Promise(r => setTimeout(r, ms));

const user = `caladmin${Date.now().toString(36)}`;
const b = await launchBrowser({ headless: "new" });
try {
  const ctx = await b.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  // ⛔ D95: an admin is an ADMIN ACCOUNT with its own session cookie, never a users row — made here, signed in by cookie.
  const db = new Database(DB);
  const admin = createAdminAccount(db, { email: `${user}@example.com`, createdBy: "d125-walk" });
  const token = createAdminSession(db, admin.id, { userAgent: "d125-walk" });
  const from = arg("--from", null) || db.prepare(`SELECT u.username FROM users u JOIN profile_base_resumes p ON p.user_id = u.id
    JOIN domain_profiles d ON d.id = p.profile_id AND d.is_active = 1 ORDER BY u.id DESC LIMIT 1`).pluck().get();
  db.close();
  check("an admin account and its session", !!token);
  await page.setCookie({ name: ADMIN_COOKIE, value: token, url: BASE });
  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle2" });

  const call = (p, method = "GET", body) => page.evaluate(async (p, method, body) => {
    const h = { "Content-Type": "application/json" };
    const t = sessionStorage.getItem("rm_auth_context"); if (t) h["X-Auth-Context"] = t;
    const r = await fetch(p, { method, credentials: "include", headers: h, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, json: await r.json().catch(() => null) };
  }, p, method, body);

  const ov = await call("/api/admin/ats-calibration");
  check("the admin reads the calibration overview", ov.status === 200, JSON.stringify(ov.json).slice(0, 160));
  check("the trial's samples are paired", (ov.json?.resumes || []).some(r => r.source === "sample:A"));
  if (from) {
    const cp = await call("/api/admin/ats-calibration/resume", "POST", { who: from });
    check(`copy a résumé from account ${from}`, cp.status === 200 && cp.json?.resumes?.some(r => r.source.startsWith("account:")), JSON.stringify(cp.json).slice(0, 160));
  }
  const bad = await call("/api/admin/ats-calibration/resume", "POST", { who: "no-such-person" });
  check("an unknown account is a plain 404", bad.status === 404 && /No account/.test(bad.json?.message || ""), JSON.stringify(bad));

  await page.goto(`${BASE}/admin?g=data&s=calibrate`, { waitUntil: "networkidle2" });
  const tab = await page.waitForSelector("[data-admin-calibrate]", { timeout: 20000 }).then(() => true).catch(() => false);
  check("Admin → Data → ATS calibration renders", tab);
  if (!tab) throw new Error("no tab");
  const before = (await call("/api/admin/ats-calibration")).json?.version || 0;
  await page.click("[data-cal-build]");
  // a set already made lists its postings at once: wait for the NEW version before opening one
  let built = false;
  for (let k = 0; k < 120 && !built; k++) { await wait(1000); built = ((await call("/api/admin/ats-calibration")).json?.version || 0) > before; }
  check("Make the set makes a new version", built, `was v${before}`);
  await page.waitForFunction(() => !/Making the set/.test(document.querySelector("[data-cal-build]")?.textContent || ""), { timeout: 30000 }).catch(() => {});
  const listed = await page.waitForSelector("[data-cal-item]", { timeout: 30000 }).then(() => true).catch(() => false);
  const n = await page.$$eval("[data-cal-item]", els => els.length).catch(() => 0);
  check("Make the set lists its postings", listed && n > 0, `${n} postings`);
  await page.screenshot({ path: path.join(OUT, "d125-1-set.jpg"), type: "jpeg", quality: 70, fullPage: true });
  if (!listed) throw new Error("no set");

  await page.click("[data-cal-item]");
  const opened = await page.waitForSelector("[data-cal-posting]", { timeout: 30000 }).then(() => true).catch(() => false);
  check("a posting opens", opened);
  const parts = await page.evaluate(() => ({ text: (document.querySelector("[data-cal-text]")?.innerText || "").length,
    terms: document.querySelectorAll("[data-cal-term]").length, pairs: document.querySelectorAll("[data-cal-pair]").length,
    faded: [...document.querySelectorAll("[data-cal-text] > div")].filter(d => getComputedStyle(d).color !== getComputedStyle(document.querySelector("[data-cal-text]")).color).length }));
  check("the posting's text, draft's terms and the scored pairs are shown", parts.text > 200 && parts.terms > 0 && parts.pairs > 0, JSON.stringify(parts));
  // a mark, a missed skill, a feel, an own score
  await page.click("[data-cal-term] [data-cal-right]");
  await page.type('input[aria-label="Skills draft missed"]', "Synthetic Term");
  await page.keyboard.press("Enter");
  await page.evaluate(() => [...document.querySelectorAll("[data-cal-pair] button")].find(b => b.textContent === "too low")?.click());
  const own = await page.$("[data-cal-pair] input[type=number]");
  if (own) { await own.click(); await own.type("64"); }
  await wait(1200);
  await page.screenshot({ path: path.join(OUT, "d125-2-posting.jpg"), type: "jpeg", quality: 70, fullPage: true });
  const id = await page.$eval("[data-cal-posting]", el => el.getAttribute("data-cal-posting"));
  const saved = await call(`/api/admin/ats-calibration/item/${id}`);
  const r = saved.json?.review || {};
  check("the review saved as it went", Object.values(r.marks?.skills || {}).includes("right") && r.added?.skills?.includes("Synthetic Term")
    && Object.values(r.scores || {}).some(s => s.feel === "too_low") && Object.values(r.scores || {}).some(s => s.own === 64), JSON.stringify(r).slice(0, 200));
  await page.click("[data-cal-done]");
  await wait(1500);
  const after = await call("/api/admin/ats-calibration");
  check("Done counts it", after.json?.done === 1, `done ${after.json?.done}`);

  await page.goto(`${BASE}/admin?g=data&s=calibrate`, { waitUntil: "networkidle2" });
  await page.waitForSelector("[data-admin-calibrate]", { timeout: 20000 });
  await page.evaluate(() => [...document.querySelectorAll("[data-admin-calibrate] [role=tab]")].find(b => b.textContent === "Results")?.click());
  const res = await page.waitForSelector("[data-cal-results]", { timeout: 60000 }).then(() => true).catch(() => false);
  check("Results measure the reviewed posting", res);
  if (res) {
    await page.click("[data-cal-baseline]");
    await wait(1500);
    const rr = await call("/api/admin/ats-calibration/results");
    check("the baseline is recorded and the gate holds", !!rr.json?.baseline && rr.json?.gate?.ok === true, JSON.stringify(rr.json?.gate));
    await page.screenshot({ path: path.join(OUT, "d125-3-results.jpg"), type: "jpeg", quality: 70, fullPage: true });
  }
  check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
  await ctx.close();
} catch (e) {
  check("the walk ran to the end", false, e.message);
} finally { await b.close(); }
console.log(failed ? `${failed} FAILED` : "ALL PASS");
process.exit(failed ? 1 : 0);
