// scripts/walkLanding46v.mjs — ⭐ 46v 0d · the REAL-CHROME walk of the new signed-out landing (owner's pick 11-18: A's hero
// with draft's own card dealt every second and no match text, B's shelf for the features, C below). Boots this checkout on
// a FRESH, EMPTY data dir, inserts a few SYNTHETIC public jobs (made-up companies), and in four themes × 1440 / 400 checks
// the deck, the shelf, C and the page width; shots into docs/fidelity-shots/walk46v-landing-*.png.
//   npm --prefix client run build && node scripts/walkLanding46v.mjs [dataDir=tmp/walkLanding46v]
// ⛔ The harness key leak (memory): ANTHROPIC_KEY is blanked and DOTENV_CONFIG_PATH points at nothing. Killed by PID at the end.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import Database from "better-sqlite3";
import puppeteer from "puppeteer-core";
import { resolveBrowserExecutable } from "../services/browserLauncher.js";

const ROOT = process.cwd();
const RUN = path.resolve(process.argv[2] || "tmp/walkLanding46v");
const SHOTS = path.join(ROOT, "docs", "fidelity-shots");
const PORT = 4448, BASE = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = [];
const say = (name, ok, what) => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${what}`); };
fs.rmSync(RUN, { recursive: true, force: true });
fs.mkdirSync(RUN, { recursive: true });

const env = { ...process.env, RM_DATA_DIR: RUN, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "walkLanding46v-not-real",
  COOKIE_ENCRYPTION_KEY: crypto.randomBytes(32).toString("hex"), DRAFT_SCHEMA_READER: "off", MATCH_ALERTS: "off", NETWORK_DIGEST: "off",
  DAILY_REMINDERS: "off", TAXONOMY_BACKFILL: "off", RESEND_API_KEY: "", ANTHROPIC_API_KEY: "", ANTHROPIC_KEY: "", DOTENV_CONFIG_PATH: "./.no-dotenv-for-walkLanding46v" };
const server = spawn(process.execPath, ["server.js"], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
let log = "";
server.stdout.on("data", d => { log += d; if (log.length > 2e6) log = log.slice(-1e6); });
server.stderr.on("data", d => { log += d; if (log.length > 2e6) log = log.slice(-1e6); });
const kill = () => { try { process.kill(server.pid, "SIGKILL"); } catch { /* gone */ } try { execFileSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" }); } catch { /* gone */ } };
process.on("exit", kill);

const SYNTHETIC = [
  ["Software Engineer, Payments", "Northwind Systems", "Boston, MA", 120000, 150000],
  ["Data Analyst", "Bluefin Analytics", "New York, NY", 90000, 115000],
  ["Senior Frontend Engineer", "Larkspur Labs", "Remote", 150000, 180000],
  ["Machine Learning Engineer", "Quillfeather AI", "San Francisco, CA", 170000, 210000],
  ["Backend Engineer", "Tidewater Cloud", "Seattle, WA", 140000, 170000],
];

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
  // synthetic public jobs, straight into the throwaway database
  const db = new Database(path.join(RUN, "resume_master.db"));
  const cols = new Set(db.prepare("PRAGMA table_info(scraped_jobs)").all().map(c => c.name));
  const now = Math.floor(Date.now() / 1000);
  for (const [i, [title, company, location, lo, hi]] of SYNTHETIC.entries()) {
    const row = { job_id: `walk46v-${i}`, search_query: "walk", company, title, location, url: `https://example.invalid/jobs/${i}`,
      _hash: `walk46v-${i}`, scraped_at: now - i * 60, posted_at: new Date(Date.now() - (i + 1) * 86400e3).toISOString(),
      salary_min: lo, salary_max: hi, salary_currency: "USD", direct_apply: 1, is_active: 1, work_type: i === 2 ? "Remote" : "Hybrid", source: "greenhouse" };
    const keys = Object.keys(row).filter(k => cols.has(k));
    db.prepare(`INSERT OR REPLACE INTO scraped_jobs (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`).run(...keys.map(k => row[k]));
  }
  db.close();
  const feed = await fetch(`${BASE}/api/jobs/generic?page=1&pageSize=12`).then(r => r.json());
  say("public feed", (feed.jobs || []).length >= 3, `${(feed.jobs || []).length} synthetic jobs on /api/jobs/generic`);

  const resolution = await resolveBrowserExecutable();
  browser = await puppeteer.launch({ executablePath: resolution.path, headless: "new", pipe: true, args: ["--no-first-run", "--no-default-browser-check"] });
  const page = await (await browser.createBrowserContext()).newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));

  for (const theme of (process.env.WALK_THEMES || "plain-light,plain-dark,dusk-light,dusk-dark").split(",")) {
    await page.evaluateOnNewDocument((t) => { try { localStorage.setItem("draft-theme", t); } catch { /* blocked */ } }, theme);
    for (const [w, h] of [[1440, 900], [400, 860]]) {
      const tag = `${theme} ${w}`;
      await page.setViewport({ width: w, height: h });
      await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
      errors.length = 0;
      await page.goto(`${BASE}/`, { waitUntil: "networkidle2", timeout: 120000 });
      await page.waitForSelector("[data-landing-card]", { timeout: 30000 });
      const first = await page.evaluate(() => ({
        id: document.querySelector("[data-landing-card]")?.getAttribute("data-landing-card"),
        match: !!document.querySelector("[data-landing-deck] [data-deck-signal-row]"),
        text: document.querySelector("[data-landing-deck]")?.innerText || "",
        draft: [...document.querySelectorAll("[data-landing-deck] [data-deck-action]")].map(b => b.textContent.trim()),
      }));
      say(`${tag} the site's card, no match`, !first.match && !/match|ATS|Not enough signal/i.test(first.text), first.match ? "a match corner" : "none");
      say(`${tag} the deck's buttons`, first.draft.join("|") === "Pass|Save|Draft", first.draft.join(" | "));
      await sleep(1300);
      const second = await page.evaluate(() => document.querySelector("[data-landing-card]")?.getAttribute("data-landing-card"));
      say(`${tag} deals every second`, second && second !== first.id, `${first.id} → ${second}`);
      // hover pauses it
      const deckBox = await (await page.$("[data-landing-deck]")).boundingBox();
      await page.mouse.move(deckBox.x + deckBox.width / 2, deckBox.y + 60);
      await sleep(300);
      const held = await page.evaluate(() => document.querySelector("[data-landing-card]")?.getAttribute("data-landing-card"));
      await sleep(1500);
      const still = await page.evaluate(() => document.querySelector("[data-landing-card]")?.getAttribute("data-landing-card"));
      say(`${tag} hover pauses`, held === still, `${held} → ${still}`);
      await page.mouse.move(2, 2);
      await page.screenshot({ path: path.join(SHOTS, `walk46v-landing-hero-${theme}-${w}.png`) });
      // the shelf
      const books = await page.$$("[data-landing-book] button");
      say(`${tag} the shelf`, books.length === 7, `${books.length} books`);
      if (books[3]) { await books[3].evaluate(b => b.scrollIntoView({ block: "center" })); await books[3].click(); await sleep(300); }
      const openBook = await page.evaluate(() => document.querySelector("[data-landing-book-open]")?.getAttribute("data-landing-book-open"));
      say(`${tag} a book opens its note`, openBook === "feat-interview", String(openBook));
      const shelf = await page.$("[data-landing-shelf]"); await shelf.screenshot({ path: path.join(SHOTS, `walk46v-landing-shelf-${theme}-${w}.png`) });
      // C
      const c = await page.evaluate(() => ({ facts: document.querySelectorAll("[data-landing-promises] .tb-fact").length,
        prom: document.querySelectorAll("[data-landing-promises] .tb-prom__i").length }));
      say(`${tag} C below`, c.facts === 4 && c.prom === 5, JSON.stringify(c));
      const cs = await page.$("[data-landing-promises]"); await cs.screenshot({ path: path.join(SHOTS, `walk46v-landing-c-${theme}-${w}.png`) });
      const hs = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      say(`${tag} no side-scroll`, !hs, hs ? "the page scrolls sideways" : "none");
      say(`${tag} no page errors`, errors.length === 0, errors.slice(0, 2).join(" | ") || "none");
    }
  }
  // reduced motion: the deck stays still
  await page.setViewport({ width: 1440, height: 900 });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle2", timeout: 120000 });
  await page.waitForSelector("[data-landing-card]", { timeout: 30000 });
  const a = await page.evaluate(() => document.querySelector("[data-landing-card]")?.getAttribute("data-landing-card"));
  await sleep(2200);
  const b = await page.evaluate(() => document.querySelector("[data-landing-card]")?.getAttribute("data-landing-card"));
  say("reduced motion: the deck is still", a === b, `${a} → ${b}`);
} catch (e) {
  say("walk", false, e.stack || e.message);
} finally {
  if (browser) await browser.close().catch(() => {});
  kill();
}
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length} / ${results.length} passed`);
process.exit(failed.length ? 1 : 0);
