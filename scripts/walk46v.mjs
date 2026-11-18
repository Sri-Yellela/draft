// scripts/walk46v.mjs — ⭐ 46v 0c · the REAL-CHROME walk of the owner's 11-18 asks: the menu's "/draft" in the logo's
// colourway (the slash LOGO_SLASH, the letters LOGO_WORD) and the assistant's button wearing draft's short logo "/d"
// (the fox and the name "Tiny" retired). Boots this checkout on a FRESH, EMPTY data dir, registers a SYNTHETIC person
// through the API, and in each of the four themes reads the computed colours against the theme's own tokens and shoots
// the dock (open) and the button at 1440 and 400 px into docs/fidelity-shots/walk46v-*.png.
//   npm --prefix client run build && node scripts/walk46v.mjs [dataDir=tmp/walk46v]
// ⛔ The harness key leak (memory): ANTHROPIC_KEY is blanked and DOTENV_CONFIG_PATH points at nothing — nothing here can
// call a model or send a mail. The server is killed by PID at the end.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import puppeteer from "puppeteer-core";
import { resolveBrowserExecutable } from "../services/browserLauncher.js";

const ROOT = process.cwd();
const RUN = path.resolve(process.argv[2] || "tmp/walk46v");
const SHOTS = path.join(ROOT, "docs", "fidelity-shots");
const PORT = 4447, BASE = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = [];
const say = (name, ok, what) => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${what}`); };
fs.rmSync(RUN, { recursive: true, force: true });
fs.mkdirSync(RUN, { recursive: true });

const env = { ...process.env, RM_DATA_DIR: RUN, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "walk46v-not-real",
  COOKIE_ENCRYPTION_KEY: crypto.randomBytes(32).toString("hex"), DRAFT_SCHEMA_READER: "off", MATCH_ALERTS: "off", NETWORK_DIGEST: "off",
  DAILY_REMINDERS: "off", TAXONOMY_BACKFILL: "off", RESEND_API_KEY: "", ANTHROPIC_API_KEY: "", ANTHROPIC_KEY: "", DOTENV_CONFIG_PATH: "./.no-dotenv-for-walk46v" };
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
  const who = `walk46v-${Date.now().toString(36)}`;
  const reg = await api("/api/auth/register", "POST", { username: who, password: "Walk46v-Passw0rd!", profile: { email: `${who}@example.invalid`, first_name: "Rin", last_name: "Example" } });
  say("register", reg.status < 400, String(reg.status));

  for (const theme of (process.env.WALK_THEMES || "plain-light,plain-dark,dusk-light,dusk-dark").split(",")) {
    await api("/api/settings/appearance", "PUT", { theme });
    await page.evaluateOnNewDocument((t) => { try { localStorage.setItem("draft-theme", t); localStorage.setItem("draft:extension-prompt-seen", "1"); sessionStorage.removeItem("draft-ask:open"); } catch { /* blocked */ } }, theme);
    for (const [w, h] of [[1440, 900], [400, 860]]) {
      await page.setViewport({ width: w, height: h });
      errors.length = 0;
      await page.goto(`${BASE}/app/atlas`, { waitUntil: "networkidle2", timeout: 120000 });
      await page.waitForSelector("[data-tiny-launch]", { timeout: 60000 });
      await sleep(800);
      const r = await page.evaluate(() => {
        const css = getComputedStyle(document.documentElement);
        const tok = (n) => { const p = document.createElement("span"); p.style.color = css.getPropertyValue(n).trim(); document.body.appendChild(p); const c = getComputedStyle(p).color; p.remove(); return c; };
        const mark = document.querySelector("[data-nav-dock] [data-draft-mark]");
        const slash = mark?.querySelector("[data-draft-slash]");
        const btn = document.querySelector("[data-tiny-launch]");
        const ts = [...(btn?.querySelectorAll("svg tspan") || [])].map(t => getComputedStyle(t).fill);
        return { theme: document.documentElement.getAttribute("data-theme"), wantSlash: tok("--c-logo-slash"), wantWord: tok("--c-logo-word"),
          markWord: mark && getComputedStyle(mark).color, markSlash: slash && getComputedStyle(slash).color, markText: mark?.textContent,
          logoAttr: mark?.hasAttribute("data-draft-logo"), btnLabel: btn?.getAttribute("aria-label"), btnText: btn?.textContent.trim(), ts,
          fox: !!btn?.querySelector("ellipse"), tinyOnPage: /\bTiny\b/.test(document.body.innerText) };
      });
      const tag = `${theme} ${w}`;
      if (w === 1440) {
        say(`${tag} dock mark`, r.logoAttr && r.markSlash === r.wantSlash && r.markWord === r.wantWord,
          `"${r.markText}" slash ${r.markSlash} (want ${r.wantSlash}) · letters ${r.markWord} (want ${r.wantWord})`);
      }
      say(`${tag} button`, r.btnLabel === "Ask draft" && !r.fox && r.ts[0] === r.wantSlash && r.ts[1] === r.wantWord,
        `label "${r.btnLabel}" · "/d" fills ${r.ts.join(" / ")} · fox ${r.fox}`);
      say(`${tag} no Tiny`, !r.tinyOnPage, r.tinyOnPage ? "the page says Tiny" : "none");
      say(`${tag} no page errors`, errors.length === 0, errors.slice(0, 2).join(" | ") || "none");
      // open the dock (hover its edge on a wide screen) and shoot it with the button
      if (w === 1440) {
        const dock = await page.$("[data-nav-dock]");
        if (dock) { const b = await dock.boundingBox(); if (b) await page.mouse.move(b.x + b.width / 2, b.y + 40); }
        await sleep(900);
      }
      await page.screenshot({ path: path.join(SHOTS, `walk46v-dock-${theme}-${w}.png`) });
      await page.click("[data-tiny-launch]");
      await sleep(900);
      const card = await page.evaluate(() => ({ title: document.querySelector("#appnav-ask h2")?.textContent, open: document.querySelector("#appnav-ask")?.getAttribute("data-open") }));
      say(`${tag} card`, card.open === "true" && card.title === "draft", `open ${card.open} · title "${card.title}"`);
      await page.screenshot({ path: path.join(SHOTS, `walk46v-ask-${theme}-${w}.png`) });
      // A233 (46v): Interview → Company guides — the explanation as a note card
      await page.goto(`${BASE}/app/interview/guides`, { waitUntil: "networkidle2", timeout: 120000 });
      const ivNote = await page.waitForSelector('[data-coming="guides"][data-note-card]', { timeout: 30000 }).then(() => true).catch(() => false);
      say(`${tag} interview note card`, ivNote, ivNote ? "a note card with its action" : "no note card on /app/interview/guides");
      if (ivNote) await page.screenshot({ path: path.join(SHOTS, `walk46v-ivguides-${theme}-${w}.png`) });
      // A233 (46v): Applications → Settings — "Never sent automatically" and Stop everything as ✓ / ✕ lists
      if (w === 1440) {
        await page.goto(`${BASE}/app/auto-apply`, { waitUntil: "networkidle2", timeout: 120000 });
        const opened = await page.waitForSelector("[data-settings-open]", { timeout: 30000 }).then(() => true).catch(() => false);
        if (!opened) { say(`${tag} settings`, false, "no Settings button on Applications"); continue; }
        await page.click("[data-settings-open]"); await sleep(700);
        await page.click('[data-fold-top="jobs"]'); await sleep(500);
        const never = await page.evaluate(() => { const n = document.querySelector("[data-never-sent]"); return n ? { kind: n.hasAttribute("data-promises"), items: [...n.querySelectorAll("li")].map(l => l.textContent.trim()) } : null; });
        say(`${tag} never sent`, never?.kind && never.items.length >= 4 && never.items.every(t => t.startsWith("✕")), JSON.stringify(never));
        const el = await page.$("[data-never-sent]"); if (el) { await el.scrollIntoView(); await sleep(300); await page.screenshot({ path: path.join(SHOTS, `walk46v-neversent-${theme}-${w}.png`) }); }
        await page.click('[data-fold-top="pausing"]'); await sleep(500);
        const stop = await page.evaluate(() => [...document.querySelectorAll("[data-stop-says] li")].map(l => l.textContent.trim()));
        say(`${tag} stop list`, stop.length === 4 && stop[3].startsWith("✕") && /Recall applications already sent/.test(stop[3]), JSON.stringify(stop));
        const el2 = await page.$("[data-stop-says]"); if (el2) { await el2.scrollIntoView(); await sleep(300); await page.screenshot({ path: path.join(SHOTS, `walk46v-stop-${theme}-${w}.png`) }); }
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
