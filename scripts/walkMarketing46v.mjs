// scripts/walkMarketing46v.mjs — ⭐ 46v 0d · the REAL-CHROME walk of the marketing pages in the landing's treatment (owner 11-18: "yes do the other pages too, drop the 24 hours line"); adapted from walkLanding46v, which walks the signed-out landing (owner's pick 11-18: A's hero
// with draft's own card dealt every second and no match text, B's shelf for the features, C below). Boots this checkout on
// a FRESH, EMPTY data dir, inserts a few SYNTHETIC public jobs (made-up companies), and in four themes × 1440 / 400 checks
// the deck, the shelf, C and the page width; shots into docs/fidelity-shots/walk46v-landing-*.png.
//   npm --prefix client run build && node scripts/walkMarketing46v.mjs [dataDir=tmp/walkMarketing46v]
// ⛔ The harness key leak (memory): ANTHROPIC_KEY is blanked and DOTENV_CONFIG_PATH points at nothing. Killed by PID at the end.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import puppeteer from "puppeteer-core";
import { resolveBrowserExecutable } from "../services/browserLauncher.js";

const ROOT = process.cwd();
const RUN = path.resolve(process.argv[2] || "tmp/walkMarketing46v");
const SHOTS = path.join(ROOT, "docs", "fidelity-shots");
const PORT = 4450, BASE = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = [];
const say = (name, ok, what) => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${what}`); };
fs.rmSync(RUN, { recursive: true, force: true });
fs.mkdirSync(RUN, { recursive: true });

const env = { ...process.env, RM_DATA_DIR: RUN, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "walkMarketing46v-not-real",
  COOKIE_ENCRYPTION_KEY: crypto.randomBytes(32).toString("hex"), DRAFT_SCHEMA_READER: "off", MATCH_ALERTS: "off", NETWORK_DIGEST: "off",
  DAILY_REMINDERS: "off", TAXONOMY_BACKFILL: "off", RESEND_API_KEY: "", ANTHROPIC_API_KEY: "", ANTHROPIC_KEY: "", DOTENV_CONFIG_PATH: "./.no-dotenv-for-walkMarketing46v" };
const server = spawn(process.execPath, ["server.js"], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
let log = "";
server.stdout.on("data", d => { log += d; if (log.length > 2e6) log = log.slice(-1e6); });
server.stderr.on("data", d => { log += d; if (log.length > 2e6) log = log.slice(-1e6); });
const kill = () => { try { process.kill(server.pid, "SIGKILL"); } catch { /* gone */ } try { execFileSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" }); } catch { /* gone */ } };
process.on("exit", kill);


const PAGES = [
  ["about", "/about", async (page) => (await page.$$("[data-about-sections] [data-note-card]")).length === 3 ? "3 note cards" : null],
  ["features", "/features", async (page) => {
    const books = await page.$$("[data-features-book] button"); if (books.length < 7) return null;
    await books[4].click(); await sleep(900);
    const seen = await page.evaluate(() => { const el = document.getElementById("tool-your-review-queue"); if (!el) return false; const r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; });
    return seen ? `${books.length} books; a book brings its tool into view` : null; }],
  ["how-it-works", "/how-it-works", async (page) => (await page.$$("[data-how-steps] li")).length === 5 ? "5 numbered steps" : null],
  ["extension", "/extension", async (page) => {
    const steps = (await page.$$("[data-extension-setup] li")).length, facts = (await page.$$("[aria-labelledby='ext-facts-h'] .tb-prom__i")).length;
    return steps === 4 && facts === 3 ? "4 steps, 3 ✓ facts" : null; }],
  ["faq", "/faq", async (page) => {
    const groups = (await page.$$("[data-faq-group]")).length, qs = await page.$$("[data-faq] summary"); if (groups !== 4 || qs.length !== 8) return null;
    await qs[0].click(); await sleep(200);
    return (await page.evaluate(() => document.querySelector("[data-faq]")?.open)) ? "4 groups, 8 folds; one opens" : null; }],
  ["contact", "/contact", async (page) => {
    const t = await page.evaluate(() => document.body.innerText);
    return !/24 hours/i.test(t) && await page.$("[data-contact-form]") ? "the form; no '24 hours'" : null; }],
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
  const resolution = await resolveBrowserExecutable();
  browser = await puppeteer.launch({ executablePath: resolution.path, headless: "new", pipe: true, args: ["--no-first-run", "--no-default-browser-check"] });
  const page = await (await browser.createBrowserContext()).newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  for (const theme of (process.env.WALK_THEMES || "plain-light,plain-dark,dusk-light,dusk-dark").split(",")) {
    await page.evaluateOnNewDocument((t) => { try { localStorage.setItem("draft-theme", t); } catch { /* blocked */ } }, theme);
    for (const [w, h] of [[1440, 900], [400, 860]]) {
      await page.setViewport({ width: w, height: h });
      for (const [name, url, check] of PAGES) {
        const tag = `${theme} ${w} ${name}`;
        errors.length = 0;
        await page.goto(`${BASE}${url}`, { waitUntil: "networkidle2", timeout: 120000 });
        await page.waitForSelector(".mk-h1", { timeout: 30000 }).catch(() => {});
        const what = await check(page).catch(() => null);
        say(`${tag} content`, !!what, what || "missing");
        const hs = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        say(`${tag} no side-scroll`, !hs, hs ? "the page scrolls sideways" : "none");
        say(`${tag} no page errors`, errors.length === 0, errors.slice(0, 2).join(" | ") || "none");
        if (theme === "plain-light" || theme === "dusk-dark") await page.screenshot({ path: path.join(SHOTS, `walk46v-mk-${name}-${theme}-${w}.png`), fullPage: true });
      }
    }
  }
} catch (e) {
  say("walk", false, e.stack || e.message);
} finally {
  if (browser) await browser.close().catch(() => {});
  kill();
}
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length} / ${results.length} passed`);
process.exit(failed.length ? 1 : 0);
