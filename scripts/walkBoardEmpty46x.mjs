// scripts/walkBoardEmpty46x.mjs — ⭐ 46x (carried since 46v) · the REAL-CHROME walk of the board's two empty-state note cards,
// never seen in a browser before: "No jobs collected yet" (board-no-jobs: the pool is empty for everyone) and "No jobs in your
// profile's role" (board-no-role-jobs: jobs exist, none sorted into this profile's role). Boots this checkout on a FRESH, EMPTY
// data dir, signs up a SYNTHETIC person, gives them a job profile with a résumé, then in two themes × 1440 / 400 reads each
// card; shots into docs/fidelity-shots/walk46x-board-*.png.
//   npm --prefix client run build && node scripts/walkBoardEmpty46x.mjs [dataDir=tmp/walkBoardEmpty46x]
// ⛔ The harness key leak (memory): ANTHROPIC_KEY is blanked and DOTENV_CONFIG_PATH points at nothing. Killed by PID at the end.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import Database from "better-sqlite3";
import puppeteer from "puppeteer-core";
import { resolveBrowserExecutable } from "../services/browserLauncher.js";

const ROOT = process.cwd();
const RUN = path.resolve(process.argv[2] || "tmp/walkBoardEmpty46x");
const SHOTS = path.join(ROOT, "docs", "fidelity-shots");
const PORT = 4449, BASE = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = [];
const say = (name, ok, what) => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${what}`); };
fs.rmSync(RUN, { recursive: true, force: true });
fs.mkdirSync(RUN, { recursive: true });

const env = { ...process.env, RM_DATA_DIR: RUN, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "walkBoardEmpty46x-not-real",
  COOKIE_ENCRYPTION_KEY: crypto.randomBytes(32).toString("hex"), DRAFT_SCHEMA_READER: "off", MATCH_ALERTS: "off", NETWORK_DIGEST: "off",
  DAILY_REMINDERS: "off", TAXONOMY_BACKFILL: "off", JOB_CRAWL: "off",   // A188: no real board is crawled into the throwaway DB
  RESEND_API_KEY: "", ANTHROPIC_API_KEY: "", ANTHROPIC_KEY: "", DOTENV_CONFIG_PATH: "./.no-dotenv-for-walkBoardEmpty46x" };
const server = spawn(process.execPath, ["server.js"], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
let log = "";
server.stdout.on("data", d => { log += d; if (log.length > 2e6) log = log.slice(-1e6); });
server.stderr.on("data", d => { log += d; if (log.length > 2e6) log = log.slice(-1e6); });
const kill = () => { try { process.kill(server.pid, "SIGKILL"); } catch { /* gone */ } try { execFileSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" }); } catch { /* gone */ } };
process.on("exit", kill);

const RESUME = `Ada Synthetic
Experience
Senior Software Engineer, Backend — Northwind Systems
- Built payment services in Go and PostgreSQL for five years
- Led a team of four through the ledger migration
Skills
Go, PostgreSQL, Kafka, Kubernetes`;

let browser = null;
try {
  const t0 = Date.now();
  for (;;) {
    if (server.exitCode != null) throw new Error(`server exited:\n${log.slice(-3000)}`);
    const s = await fetch(`${BASE}/api/health/ready`).then(r => r.status).catch(() => 0);
    if (s === 200) break;
    if (Date.now() - t0 > 300000) throw new Error(`not ready in 5 minutes:\n${log.slice(-3000)}`);
    await sleep(500);
  }
  console.log(`ready in ${Math.round((Date.now() - t0) / 1000)} s`);
  const resolution = await resolveBrowserExecutable();
  browser = await puppeteer.launch({ executablePath: resolution.path, headless: "new", pipe: true, args: ["--no-first-run", "--no-default-browser-check"] });
  const page = await (await browser.createBrowserContext()).newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  const reg = await page.evaluate(async () => {
    const r = await fetch("/api/auth/register", { method: "POST", credentials: "include", headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "synthetic-ada-46x", password: "Walk46x-not-a-real-pass!", profile: { email: "ada46x@example.test", first_name: "Ada", last_name: "Synthetic" } }) });
    return { status: r.status, body: await r.json().catch(() => null) };
  });
  say("a synthetic person signs up", reg.status === 200 || reg.status === 201, `${reg.status} ${JSON.stringify(reg.body).slice(0, 120)}`);

  // a job profile with a résumé, straight into the throwaway database (the onboarding's result, not its screens)
  const db = new Database(path.join(RUN, "resume_master.db"));
  const uid = db.prepare(`SELECT id FROM users WHERE username = 'synthetic-ada-46x'`).pluck().get();
  db.prepare(`UPDATE domain_profiles SET is_active = 0 WHERE user_id = ?`).run(uid);
  const pid = db.prepare(`INSERT INTO domain_profiles (user_id, profile_name, role_family, domain, is_active) VALUES (?, 'Backend engineer', 'engineering', 'software', 1)`).run(uid).lastInsertRowid;
  db.prepare(`INSERT INTO profile_base_resumes (profile_id, user_id, name, content, updated_at) VALUES (?, ?, 'ada.txt', ?, unixepoch())`).run(pid, uid, RESUME);
  for (const sql of [`UPDATE users SET onboarding_complete = 1 WHERE id = ${uid}`, `UPDATE users SET onboarded_at = unixepoch() WHERE id = ${uid}`]) { try { db.prepare(sql).run(); } catch { /* not a column here */ } }
  db.close();

  const readBoard = async () => {
    await page.goto(`${BASE}/app/jobs`, { waitUntil: "networkidle2", timeout: 120000 });
    await page.waitForFunction(() => document.querySelector("[data-note-card]") || document.querySelector("[data-job-card], [data-board-card]"), { timeout: 45000 }).catch(() => null);
    return page.evaluate(() => [...document.querySelectorAll("[data-note-card]")].map(n => ({ id: n.getAttribute("data-note-card"), text: n.innerText.replace(/\s+/g, " ").trim(),
      w: Math.round(n.getBoundingClientRect().width), bg: getComputedStyle(n).backgroundColor, color: getComputedStyle(n).color })));
  };
  const looks = async (tag, want, shot) => {
    for (const theme of ["plain-light", "dusk-dark"]) {
      await page.evaluateOnNewDocument((t) => { try { localStorage.setItem("draft-theme", t); } catch { /* blocked */ } }, theme);
      for (const [w, h] of [[1440, 900], [400, 860]]) {
        await page.setViewport({ width: w, height: h });
        errors.length = 0;
        const cards = await readBoard();
        const card = cards.find(c => c.id === want);
        say(`${tag} ${theme} ${w}: the "${want}" card`, !!card, card ? card.text.slice(0, 160) : `cards: ${JSON.stringify(cards.map(c => c.id))}`);
        if (card) say(`${tag} ${theme} ${w}: it fits and is readable`, card.w > 0 && card.w <= w - 16 && card.bg !== card.color, `${card.w}px · ${card.bg} on ${card.color}`);
        const hs = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        say(`${tag} ${theme} ${w}: no side-scroll`, !hs, hs ? "scrolls sideways" : "none");
        say(`${tag} ${theme} ${w}: no page errors`, errors.length === 0, errors.slice(0, 2).join(" | ") || "none");
        await page.screenshot({ path: path.join(SHOTS, `walk46x-board-${shot}-${theme}-${w}.png`) });
      }
    }
  };

  // (1) the pool is empty for everyone
  await looks("empty pool", "board-no-jobs", "no-jobs");

  // (2) jobs exist, none sorted into this profile's role
  const db2 = new Database(path.join(RUN, "resume_master.db"));
  const cols = new Set(db2.prepare("PRAGMA table_info(scraped_jobs)").all().map(c => c.name));
  const now = Math.floor(Date.now() / 1000);
  for (const [i, [title, company]] of [["Registered Nurse, ICU", "Larkspur Health"], ["Construction Project Manager", "Tidewater Build"], ["Staff Accountant", "Bluefin Ledger"]].entries()) {
    const row = { job_id: `walk46x-${i}`, search_query: "walk", company, title, location: "Boston, MA", url: `https://example.invalid/jobs/${i}`,
      _hash: `walk46x-${i}`, scraped_at: now - i * 60, posted_at: new Date(Date.now() - (i + 1) * 86400e3).toISOString(), direct_apply: 1, is_active: 1, source: "greenhouse",
      description: `${title} at ${company}. A synthetic posting for a walk.` };
    const keys = Object.keys(row).filter(k => cols.has(k));
    db2.prepare(`INSERT OR REPLACE INTO scraped_jobs (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`).run(...keys.map(k => row[k]));
  }
  db2.close();
  await looks("other roles only", "board-no-role-jobs", "no-role-jobs");
} catch (e) {
  say("the walk ran", false, e.message.slice(0, 600));
} finally {
  try { await browser?.close(); } catch { /* closed */ }
  kill();
}
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed} / ${results.length} passed`);
process.exit(failed ? 1 : 0);
