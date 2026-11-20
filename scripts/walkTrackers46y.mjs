// scripts/walkTrackers46y.mjs — ⭐ 46y · D159 T2–T4 (trackers) and D141 (sign up to save and fix), in real Chrome.
// A SYNTHETIC person on a FRESH data dir (crawling off, no keys): a crawled company is seeded (its board pair, its record, the
// board's alias), the person's job profile gets a saved search. On Job Profiles → Trackers the walk pastes a crawled Lever
// board (→ followed at once), an unknown Greenhouse board (→ the candidate pool, "waiting for review") and a careers page
// with no readable board (→ "can't read this page yet"); postings first seen after the follow then show as "3 new postings";
// Open on the company clears it; Open on the saved search lands on the board with it applied (and marks it seen).
// Signed out, /tools/honesty is checked and "Sign up to save and fix" carries the résumé to /register.
// In plain-light / dusk-dark × 1440 / 400. Shots docs/fidelity-shots/walk46y-trackers-*.png, walk46y-honesty-*.png.
//   (cd client && npx vite build) && node scripts/walkTrackers46y.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import Database from "better-sqlite3";
import puppeteer from "puppeteer-core";
import { resolveBrowserExecutable } from "../services/browserLauncher.js";

const ROOT = process.cwd();
const RUN = path.resolve(process.argv[2] || "tmp/walkTrackers46y");
const SHOTS = path.join(ROOT, "docs", "fidelity-shots");
const PORT = 4459, BASE = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = [];
const say = (name, ok, what) => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${what}`); };
fs.rmSync(RUN, { recursive: true, force: true });
fs.mkdirSync(RUN, { recursive: true });
fs.mkdirSync(SHOTS, { recursive: true });
const env = { ...process.env, RM_DATA_DIR: RUN, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "walkTrackers46y-not-real",
  COOKIE_ENCRYPTION_KEY: crypto.randomBytes(32).toString("hex"), DRAFT_SCHEMA_READER: "off", MATCH_ALERTS: "off", NETWORK_DIGEST: "off",
  DAILY_REMINDERS: "off", TAXONOMY_BACKFILL: "off", JOB_CRAWL: "off", DISCOVERY_PAUSED: "1", RESEND_API_KEY: "", ANTHROPIC_API_KEY: "", ANTHROPIC_KEY: "",
  DOTENV_CONFIG_PATH: "tmp/no.env" };
const server = spawn(process.execPath, ["server.js"], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
let log = "";
server.stdout.on("data", d => { log += d; if (log.length > 2e6) log = log.slice(-1e6); });
server.stderr.on("data", d => { log += d; if (log.length > 2e6) log = log.slice(-1e6); });
const kill = () => { try { execFileSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" }); } catch { /* gone */ } };
process.on("exit", kill);

const RESUME = `Ada Synthetic
Experience
Data Engineer — Northwind Systems
- Built SQL pipelines in Python
- Led executive presentations for a global sales organisation
Skills
Python, SQL, Salesforce, Kubernetes`;
const ORIGINAL = `Ada Synthetic
Experience
Data Engineer — Northwind Systems
- Built SQL pipelines in Python
Skills
Python, SQL`;

let browser = null;
try {
  const t0 = Date.now();
  for (;;) {
    if (server.exitCode != null) throw new Error(`server exited:\n${log.slice(-3000)}`);
    if ((await fetch(`${BASE}/api/health/ready`).then(r => r.status).catch(() => 0)) === 200) break;
    if (Date.now() - t0 > 300000) throw new Error(`not ready:\n${log.slice(-3000)}`);
    await sleep(500);
  }
  console.log(`ready in ${Math.round((Date.now() - t0) / 1000)} s`);
  browser = await puppeteer.launch({ executablePath: (await resolveBrowserExecutable()).path, headless: "new", pipe: true, args: ["--no-first-run", "--no-default-browser-check"] });

  // ── D141, signed out ────────────────────────────────────────────────────────────────────────────
  for (const theme of ["plain-light", "dusk-dark"]) {
    for (const [w, h] of [[1440, 1000], [400, 900]]) {
      const tag = `honesty ${theme} ${w}`;
      const ctx = await browser.createBrowserContext();
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", e => errors.push(e.message));
      await page.evaluateOnNewDocument((t) => { try { localStorage.setItem("draft-theme", t); } catch { /* blocked */ } }, theme);
      await page.setViewport({ width: w, height: h });
      await page.goto(`${BASE}/tools/honesty`, { waitUntil: "networkidle2", timeout: 120000 });
      const areas = await page.$$("textarea");
      await areas[0].type(RESUME);
      await areas[1].type(ORIGINAL);
      await page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Check my résumé")?.click());
      const card = await page.waitForSelector("[data-honesty-signup]", { timeout: 30000 }).catch(() => null);
      const txt = card ? await card.evaluate(c => c.innerText.replace(/\s+/g, " ")) : "";
      say(`${tag}: the result ends in "Sign up to save and fix"`, !!card && /Sign up to save and fix/.test(txt), txt.slice(0, 160));
      if (card) { await card.evaluate(c => c.scrollIntoView({ block: "center" })); await sleep(300); await card.screenshot({ path: path.join(SHOTS, `walk46y-honesty-${theme}-${w}-signup.png`) }); }
      say(`${tag}: no side-scroll`, !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), "");
      await page.click("[data-honesty-signup-link]");
      const carried = await page.waitForSelector("[data-ats-hook-carried]", { timeout: 20000 }).catch(() => null);
      const ctext = carried ? await carried.evaluate(c => c.innerText.replace(/\s+/g, " ")) : "";
      say(`${tag}: /register says the résumé comes with you`, !!carried && /resume\.txt comes with you/.test(ctext) && new URL(page.url()).pathname === "/register", ctext.slice(0, 160));
      if (carried) { await carried.evaluate(c => c.scrollIntoView({ block: "center" })); await sleep(300); await page.screenshot({ path: path.join(SHOTS, `walk46y-honesty-${theme}-${w}-register.png`) }); }
      say(`${tag}: no page errors`, errors.length === 0, errors.slice(0, 2).join(" | ") || "none");
      await ctx.close();
    }
  }

  // ── D159, signed in ─────────────────────────────────────────────────────────────────────────────
  const page = await (await browser.createBrowserContext()).newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  const api = (url, method = "GET", body = null) => page.evaluate(async (u, m, b) => {
    const r = await fetch(u, { method: m, credentials: "include", headers: { "content-type": "application/json" }, body: b ? JSON.stringify(b) : undefined });
    let j = null; try { j = await r.json(); } catch { j = null; } return { status: r.status, body: j };
  }, url, method, body);
  const reg = await api("/api/auth/register", "POST", { username: "synthetic-ada-trk", password: "Walk46y-not-a-real-pass!", profile: { email: "ada-trk@example.test", first_name: "Ada", last_name: "Synthetic" } });
  say("a synthetic person signs up", reg.status === 200 || reg.status === 201, String(reg.status));
  const db = new Database(path.join(RUN, "resume_master.db"));
  db.pragma("busy_timeout = 5000");
  const uid = db.prepare(`SELECT id FROM users WHERE username = 'synthetic-ada-trk'`).pluck().get();
  db.prepare(`UPDATE domain_profiles SET is_active = 0 WHERE user_id = ?`).run(uid);
  const pid = db.prepare(`INSERT INTO domain_profiles (user_id, profile_name, role_family, domain, is_active, tracked_search_json) VALUES (?, 'Data engineer', 'data', 'software', 1, ?)`)
    .run(uid, JSON.stringify({ params: "work_models=remote&page=1", name: null, savedAt: Math.floor(Date.now() / 1000) - 86400 })).lastInsertRowid;
  db.prepare("INSERT OR IGNORE INTO company_ats_list (company, ats_type, ats_slug, active) VALUES ('Northwind Labs', 'lever', 'northwind', 0)").run();
  const cid = db.prepare("INSERT INTO companies (slug, name) VALUES ('northwind-labs', 'Northwind Labs')").run().lastInsertRowid;
  db.prepare("INSERT INTO company_aliases (alias_key, company_id, evidence) VALUES ('ats:lever:northwind', ?, 'walk46y')").run(cid);

  const open = async () => {
    await page.goto(`${BASE}/app/job-profiles`, { waitUntil: "networkidle2", timeout: 120000 });
    await page.waitForFunction(() => document.querySelector("[data-trackers]") && !/Loading your trackers/.test(document.querySelector("[data-trackers]").innerText), { timeout: 45000 });
    await sleep(400);
  };
  const track = async (u) => {
    await page.$eval("[data-trackers] input[type=url]", (el) => { el.focus(); });
    await page.keyboard.type(u);
    await page.click("[data-trackers] button[type=submit]");
    await page.waitForFunction(() => document.querySelector("[data-trackers] [role=status]"), { timeout: 20000 });
    await sleep(600);
    return page.$eval("[data-trackers] [role=status]", el => el.textContent);
  };
  await page.setViewport({ width: 1440, height: 1000 });
  await open();
  const s1 = await track("https://jobs.lever.co/northwind");
  say("a crawled Lever board → followed at once", /Following Northwind Labs/.test(s1), s1);
  await page.$eval("[data-trackers] input[type=url]", (el) => { el.value = ""; });
  const s2 = await track("https://boards.greenhouse.io/zephyrdata");
  say("an unknown Greenhouse board → sent for review", /sent for review/.test(s2), s2);
  const pooled = db.prepare("SELECT status, source FROM company_candidates WHERE ats_type = 'greenhouse' AND ats_slug = 'zephyrdata'").get();
  say("… it is in the D82 candidate pool, not added", pooled?.status === "new" && pooled?.source === "user" && !db.prepare("SELECT 1 FROM company_ats_list WHERE ats_slug = 'zephyrdata'").get(), JSON.stringify(pooled));
  const s3 = await track("https://careers.unknown-co.example/open-roles");
  say("a careers page with no readable board → said so", /can't read this page yet/.test(s3), s3);
  // postings first seen AFTER the follow
  const later = Math.floor(Date.now() / 1000) + 30;
  for (let i = 1; i <= 3; i++) {
    db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, company, title, _hash, source, is_active, discovered_at) VALUES (?, 'q', 'Northwind Labs', ?, ?, 'lever', 1, ?)`)
      .run(`walk46y-nw-${i}`, `Data Engineer ${i}`, `walk46y-nw-${i}`, later);
    db.prepare("INSERT INTO job_company (job_id, company_id) VALUES (?, ?)").run(`walk46y-nw-${i}`, cid);
  }

  for (const theme of ["plain-light", "dusk-dark"]) {
    await page.evaluateOnNewDocument((t) => { try { localStorage.setItem("draft-theme", t); } catch { /* blocked */ } }, theme);
    await api("/api/settings/appearance", "PUT", { theme });
    for (const [w, h] of [[1440, 1000], [400, 900]]) {
      const tag = `trackers ${theme} ${w}`;
      await page.setViewport({ width: w, height: h });
      errors.length = 0;
      await open();
      const f = await page.evaluate(() => {
        const s = document.querySelector("[data-trackers]");
        return { search: s.querySelector("[data-tracker-search]")?.innerText.replace(/\s+/g, " ") || "",
          company: s.querySelector('[data-tracker-company="northwind-labs"]')?.innerText.replace(/\s+/g, " ") || "",
          pending: !!s.querySelector('[data-tracker-page="pending"]'), unsupported: !!s.querySelector('[data-tracker-page="unsupported"]'),
          side: document.documentElement.scrollWidth > innerWidth + 1, theme: document.documentElement.getAttribute("data-theme") };
      });
      say(`${tag}: the saved search reads as its sentence, with a count`, /Saved search · Data engineer/.test(f.search) && /(new posting|nothing new|count unavailable)/.test(f.search), f.search.slice(0, 160));
      say(`${tag}: the followed company shows 3 new postings`, /3 new postings since you last looked/.test(f.company), f.company);
      say(`${tag}: the waiting and unreadable pages are listed`, f.pending && f.unsupported, `pending ${f.pending} · unsupported ${f.unsupported}`);
      say(`${tag}: no side-scroll`, !f.side, `theme ${f.theme}`);
      const sec = await page.$("[data-trackers]");
      await sec.evaluate(c => c.scrollIntoView({ block: "start" })); await sleep(300);
      await sec.screenshot({ path: path.join(SHOTS, `walk46y-trackers-${theme}-${w}.png`) });
      say(`${tag}: no page errors`, errors.length === 0, errors.slice(0, 2).join(" | ") || "none");
    }
  }

  // Open the saved search → the board, applied, and marked seen
  await page.setViewport({ width: 1440, height: 1000 });
  await open();
  const before = (await api("/api/trackers")).body.searches[0];
  await page.evaluate(() => [...document.querySelectorAll("[data-tracker-search] button")].find(b => b.textContent.trim() === "Open")?.click());
  await page.waitForFunction(() => location.pathname.startsWith("/app/jobs") && !location.search.includes("tracker="), { timeout: 45000 }).catch(() => null);
  await sleep(2500);
  const after = (await api("/api/trackers")).body.searches[0];
  say("Open on the saved search: the board, the address cleaned, the search marked seen", new URL(page.url()).pathname.startsWith("/app/jobs") && after.lastSeenAt > before.lastSeenAt,
    `${new URL(page.url()).pathname}${new URL(page.url()).search} · lastSeenAt ${before.lastSeenAt} → ${after.lastSeenAt}`);
  // Open on the company → its page; its feed is read
  await open();
  await page.evaluate(() => [...document.querySelectorAll('[data-tracker-company="northwind-labs"] button')].find(b => b.textContent.trim() === "Open")?.click());
  await page.waitForFunction(() => location.pathname === "/companies/northwind-labs", { timeout: 20000 }).catch(() => null);
  const co = (await api("/api/trackers")).body.companies.find(c => c.slug === "northwind-labs");
  say("Open on the company: its page, the feed read (0 new)", new URL(page.url()).pathname === "/companies/northwind-labs" && co?.newCount === 0, `${new URL(page.url()).pathname} · ${co?.newCount}`);
  db.close();
} catch (e) {
  say("the walk ran", false, e.message.slice(0, 600));
} finally {
  try { await browser?.close(); } catch { /* closed */ }
  kill();
}
const failed = results.filter(x => !x).length;
console.log(`\n${results.length - failed} / ${results.length} passed`);
process.exit(failed ? 1 : 0);
