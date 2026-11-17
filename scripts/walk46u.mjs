// scripts/walk46u.mjs — ⭐ 46u · the REAL-CHROME walk of the owner's 11-17 asks: Your map first in Atlas and its default
// screen; the Library as books on a shelf (pastel per id); a guide deck, a course's lesson deck and the questions on
// draft's card (components/CardPile). Boots this checkout on a FRESH, EMPTY data dir (the learn content imports on an
// empty boot), registers a SYNTHETIC person through the API, and shoots each screen in Plain Light and Dusk Dark at
// 1440 and 400 px into docs/fidelity-shots/walk46u-*.png.
//   node scripts/walk46u.mjs [dataDir=tmp/walk46u]
// ⛔ The harness key leak (memory): ANTHROPIC_KEY is blanked and DOTENV_CONFIG_PATH points at nothing — nothing here can
// call a model or send a mail. The server is killed by PID at the end.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import puppeteer from "puppeteer-core";
import { resolveBrowserExecutable } from "../services/browserLauncher.js";

const ROOT = process.cwd();
const RUN = path.resolve(process.argv[2] || "tmp/walk46u");
const SHOTS = path.join(ROOT, "docs", "fidelity-shots");
const PORT = 4446, BASE = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = [];
const say = (name, ok, what) => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${what}`); };
fs.rmSync(RUN, { recursive: true, force: true });
fs.mkdirSync(RUN, { recursive: true });

const env = { ...process.env, RM_DATA_DIR: RUN, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "walk46u-not-real",
  COOKIE_ENCRYPTION_KEY: crypto.randomBytes(32).toString("hex"), DRAFT_SCHEMA_READER: "off", MATCH_ALERTS: "off", NETWORK_DIGEST: "off",
  DAILY_REMINDERS: "off", TAXONOMY_BACKFILL: "off", RESEND_API_KEY: "", ANTHROPIC_API_KEY: "", ANTHROPIC_KEY: "", DOTENV_CONFIG_PATH: "./.no-dotenv-for-walk46u" };
const server = spawn(process.execPath, ["server.js"], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
let log = "";
server.stdout.on("data", d => { log += d; if (log.length > 2e6) log = log.slice(-1e6); });
server.stderr.on("data", d => { log += d; if (log.length > 2e6) log = log.slice(-1e6); });
const kill = () => { try { process.kill(server.pid, "SIGKILL"); } catch { /* gone */ } try { execFileSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" }); } catch { /* gone */ } };
process.on("exit", kill);

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
  const api = (url, method = "GET", body = null) => page.evaluate(async (u, m, b) => {
    const r = await fetch(u, { method: m, credentials: "include", headers: { "content-type": "application/json" }, body: b ? JSON.stringify(b) : undefined });
    let j = null; try { j = await r.json(); } catch { j = null; } return { status: r.status, body: j };
  }, url, method, body);

  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  const who = `walk46u-${Date.now().toString(36)}`;
  const reg = await api("/api/auth/register", "POST", { username: who, password: "Walk46u-Passw0rd!", profile: { email: `${who}@example.invalid`, first_name: "Rin", last_name: "Example" } });
  say("register", reg.status < 400, String(reg.status));
  const guides = (await api("/api/learn/guides")).body?.guides || [];
  const g1 = guides.find(g => g.written);
  const deckId = g1?.lessons?.[3]?.id || g1?.lessons?.[0]?.id;
  console.log(`guides: ${guides.map(g => `${g.name}${g.written ? ` (${g.lessons.length})` : " (none)"}`).join(" · ")} · deck ${deckId}`);

  for (const theme of (process.env.WALK_THEMES || "plain-light,dusk-dark").split(",")) {
    await api("/api/settings/appearance", "PUT", { theme });
    await page.evaluateOnNewDocument((t) => { try { localStorage.setItem("draft-theme", t); localStorage.setItem("draft:extension-prompt-seen", "1"); } catch { /* blocked */ } }, theme);
    for (const [w, h] of [[1440, 900], [400, 860]]) {
      await page.setViewport({ width: w, height: h });
      const shot = async (name) => { await sleep(900); await page.screenshot({ path: path.join(SHOTS, `walk46u-${name}-${theme}-${w}.png`), fullPage: true }); };
      const hscroll = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

      // 1 · /app/atlas opens Your map, first in the nav
      errors.length = 0;
      await page.goto(`${BASE}/app/atlas`, { waitUntil: "networkidle2", timeout: 120000 });
      await page.waitForSelector("[data-atlas-panel]", { timeout: 60000 });
      await page.waitForFunction(() => !/Opening…/.test(document.querySelector('[data-atlas-panel-body="your-map"]')?.innerText || ""), { timeout: 60000 }).catch(() => {});
      const nav = await page.evaluate(() => ({ panel: document.querySelector("[data-atlas-panel]")?.getAttribute("data-atlas-panel"),
        body: !!document.querySelector('[data-atlas-panel-body="your-map"]'),
        drawn: !!document.querySelector("[data-skill-map], [data-skm-empty]"),
        raw: /could not be read|Request failed/.test(document.querySelector('[data-atlas-panel-body="your-map"]')?.innerText || ""),
        first: [...document.querySelectorAll("a[data-place-item]")].map(a => a.getAttribute("data-place-item")).slice(0, 3),
        current: document.querySelector("a[data-place-item][aria-current]")?.getAttribute("data-place-item") || null }));
      await shot("atlas");
      say(`default ${theme} ${w}`, nav.panel === "your-map" && nav.body && nav.drawn && !nav.raw && nav.first.join() === "your-map,your-run,your-skills" && !(await hscroll()) && !errors.length, JSON.stringify({ ...nav, errors: errors.slice(0, 2) }));

      // 2 · the Library: books on a shelf
      errors.length = 0;
      await page.goto(`${BASE}/app/atlas/library`, { waitUntil: "networkidle2", timeout: 120000 });
      await page.waitForSelector(".lib-book", { timeout: 60000 });
      await sleep(600);
      const lib = await page.evaluate(() => {
        const books = [...document.querySelectorAll(".lib-book")];
        const bg = (el) => getComputedStyle(el.querySelector(".lib-book__spine")).backgroundColor;
        const shelves = [...document.querySelectorAll(".lib-books")].map(s => ({ over: s.scrollWidth > s.clientWidth + 1 }));
        return { n: books.length, colours: new Set(books.map(bg)).size, pastel: books.map(b => b.getAttribute("data-pastel")).join(""),
          vertical: getComputedStyle(document.querySelector(".lib-book__title")).writingMode, shelves };
      });
      await shot("library");
      say(`shelf ${theme} ${w}`, lib.n >= 6 && lib.colours >= 4 && lib.vertical === "vertical-rl" && !(await hscroll()) && !errors.length, JSON.stringify({ ...lib, errors: errors.slice(0, 2) }));

      // 3 · a guide deck on the card: Next throws the card off, the backs fan behind, the colour holds across slides
      if (deckId) {
        errors.length = 0;
        await page.goto(`${BASE}/app/atlas/library/${deckId}`, { waitUntil: "networkidle2", timeout: 120000 });
        await page.waitForSelector("[data-card-pile]", { timeout: 60000 });
        const c1 = await page.evaluate(() => ({ bg: getComputedStyle(document.querySelector(".cpile__card")).backgroundColor, backs: document.querySelectorAll(".cpile__back").length,
          radius: getComputedStyle(document.querySelector(".cpile__card")).borderTopLeftRadius }));
        await shot("deck");
        await page.evaluate(() => [...document.querySelectorAll(".lib-deck__nav button")].find(b => /Next/.test(b.textContent))?.click());
        await sleep(120);
        const mid = await page.evaluate(() => !!document.querySelector(".cpile__card--gone"));
        await sleep(600);
        const c2 = await page.evaluate(() => ({ bg: getComputedStyle(document.querySelector(".cpile__card")).backgroundColor, slide: document.querySelector("[data-deck-view]")?.getAttribute("data-slide") }));
        say(`deck ${theme} ${w}`, c1.backs === 2 && c1.radius === "28px" && c1.bg === c2.bg && c2.slide === "2" && mid && !(await hscroll()) && !errors.length, JSON.stringify({ c1, c2, thrown: mid, errors: errors.slice(0, 2) }));
      }

      // 4 · the course: its lesson deck on the card
      errors.length = 0;
      await page.goto(`${BASE}/app/atlas/library/silicon-to-software`, { waitUntil: "networkidle2", timeout: 120000 });
      await page.waitForSelector("[data-lesson-deck] [data-card-pile]", { timeout: 60000 });
      const course = await page.evaluate(() => ({ cards: document.querySelectorAll("[data-lesson-deck] .cpile__card").length, backs: document.querySelectorAll("[data-lesson-deck] .cpile__back").length,
        title: document.querySelector("[data-lesson-deck] .lib-lcard__t")?.textContent }));
      await shot("course");
      say(`course ${theme} ${w}`, course.cards === 1 && course.backs >= 1 && !!course.title && !(await hscroll()) && !errors.length, JSON.stringify({ ...course, errors: errors.slice(0, 2) }));

      // 5 · Today's question (on the card if the bank has one live for this person)
      errors.length = 0;
      await page.goto(`${BASE}/app/atlas/todays-question`, { waitUntil: "networkidle2", timeout: 120000 });
      await sleep(1500);
      const tq = await page.evaluate(() => ({ card: !!document.querySelector("[data-daily-question]")?.closest("[data-card-pile]"), q: !!document.querySelector("[data-daily-question]"),
        none: document.querySelector('[data-atlas-panel-body="todays-question"]')?.innerText.slice(0, 160) }));
      await shot("question");
      say(`question ${theme} ${w}`, (tq.q ? tq.card : true) && !(await hscroll()) && !errors.length, JSON.stringify({ ...tq, errors: errors.slice(0, 2) }));
    }
  }
} catch (e) {
  say("walk", false, e.stack || String(e));
} finally {
  if (browser) await browser.close().catch(() => {});
  kill();
  const bad = results.filter(r => !r.ok);
  console.log(`\n${results.length - bad.length} of ${results.length} PASS`);
  process.exit(bad.length ? 1 : 0);
}
