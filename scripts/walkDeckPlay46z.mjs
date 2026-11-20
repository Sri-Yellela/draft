// scripts/walkDeckPlay46z.mjs — ⭐ 46z · D194 the animated decks, in real Chrome on a FRESH data dir (crawling off, no keys).
// Library → a deck: the Watch · Read · Cards toggle; Read reveals the points one at a time with the caption bar; the keyboard
// (→ skip, space pause, 3 = 1.25×); Watch starts MUTED (no speech) and, once the sound is on, speaks each beat and moves on
// the voice's end (speechSynthesis stubbed in the page — headless Chrome has no voices — recording every utterance);
// Reduce motion → no transition; played to the end it stops on the check; a guide's ▶ Watch opens a deck playing; a phone
// plays it full screen with ✕ Cards back; Customise → Narration voice lists the device's voices. No page errors.
// Two themes × 1440 / 400. Shots docs/fidelity-shots/walk46z-deck-*.png.
//   (cd client && npx vite build) && node scripts/walkDeckPlay46z.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import puppeteer from "puppeteer-core";
import { resolveBrowserExecutable } from "../services/browserLauncher.js";

const ROOT = process.cwd();
const RUN = path.resolve(process.argv[2] || "tmp/walkDeckPlay46z");
const SHOTS = path.join(ROOT, "docs", "fidelity-shots");
const PORT = 4463, BASE = `http://127.0.0.1:${PORT}`;
const DECK = "sw-f-01";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = [];
const say = (name, ok, what) => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${what}`); };
fs.rmSync(RUN, { recursive: true, force: true });
fs.mkdirSync(RUN, { recursive: true });
fs.mkdirSync(SHOTS, { recursive: true });
const env = { ...process.env, RM_DATA_DIR: RUN, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "walkDeckPlay46z-not-real",
  COOKIE_ENCRYPTION_KEY: crypto.randomBytes(32).toString("hex"), DRAFT_SCHEMA_READER: "off", MATCH_ALERTS: "off", NETWORK_DIGEST: "off",
  DAILY_REMINDERS: "off", TAXONOMY_BACKFILL: "off", JOB_CRAWL: "off", DISCOVERY_PAUSED: "1", RESEND_API_KEY: "", ANTHROPIC_API_KEY: "", ANTHROPIC_KEY: "",
  DOTENV_CONFIG_PATH: "tmp/no.env" };
const server = spawn(process.execPath, ["server.js"], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
let log = "";
server.stdout.on("data", d => { log += d; if (log.length > 2e6) log = log.slice(-1e6); });
server.stderr.on("data", d => { log += d; if (log.length > 2e6) log = log.slice(-1e6); });
const kill = () => { try { execFileSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" }); } catch { /* gone */ } };
process.on("exit", kill);

// The page's speechSynthesis, stubbed: two voices, every utterance recorded, its end fired after 150 ms.
function stubSpeech() {
  const spoken = []; window.__spoken = spoken;
  const voices = [{ name: "Walk Voice A", lang: "en-US", default: true }, { name: "Walk Voice B", lang: "en-GB", default: false }];
  let current = null;
  const synth = {
    getVoices: () => voices, addEventListener() {}, removeEventListener() {},
    speak(u) { spoken.push({ text: u.text, rate: u.rate }); current = u; const me = u; setTimeout(() => { if (current === me) { current = null; me.onend?.(); } }, 150); },
    cancel() { current = null; },
  };
  Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = function (text) { this.text = text; this.rate = 1; this.voice = null; };
}

let browser = null;
try {
  const t0 = Date.now();
  for (;;) {
    if (server.exitCode != null) throw new Error(`server exited:\n${log.slice(-3000)}`);
    if ((await fetch(`${BASE}/api/health/ready`).then(r => r.status).catch(() => 0)) === 200) break;
    if (Date.now() - t0 > 300000) throw new Error(`not ready:\n${log.slice(-3000)}`);
    await sleep(500);
  }
  browser = await puppeteer.launch({ executablePath: (await resolveBrowserExecutable()).path, headless: "new", pipe: true, args: ["--no-first-run", "--no-default-browser-check"] });
  for (const theme of ["plain-light", "dusk-dark"]) {
    for (const [w, h] of [[1440, 900], [400, 860]]) {
      const tag = `${theme} ${w}`;
      const page = await (await browser.createBrowserContext()).newPage();
      const errors = [];
      page.on("pageerror", e => errors.push(e.message));
      await page.evaluateOnNewDocument((t) => { try { localStorage.setItem("draft-theme", t); } catch { /* blocked */ } }, theme);
      await page.evaluateOnNewDocument(stubSpeech);
      await page.setViewport({ width: w, height: h });
      await page.goto(`${BASE}/atlas/library/${DECK}`, { waitUntil: "networkidle2" });
      await page.waitForSelector("[data-deck-modes]", { timeout: 20000 }).catch(() => {});
      const mode0 = await page.$eval("[data-deck-view]", e => e.dataset.deckMode).catch(() => null);
      say(`${tag}: a deck opens in Cards, with Watch · Read · Cards`, mode0 === "cards" && (await page.$$("[data-deck-mode-pick]")).length === 3, String(mode0));

      // Read: one point at a time, the caption bar always on
      await page.click('[data-deck-mode-pick="read"]');
      await page.waitForSelector("[data-deck-play]", { timeout: 5000 }).catch(() => {});
      const shown = async () => page.$$eval("[data-point-shown]", els => els.length).catch(() => -1);
      const cap = async () => page.$eval("[data-deck-caption]", e => e.textContent.trim()).catch(() => "");
      const c0 = await cap(), s0 = await shown();
      await sleep(5600);   // two beats at 2.5 s
      const c1 = await cap(), s1 = await shown();
      say(`${tag}: Read reveals the points one at a time as the caption moves`, s0 === 0 && s1 >= 1 && c0 && c1 && c0 !== c1, `shown ${s0} → ${s1}; caption "${c0.slice(0, 30)}" → "${c1.slice(0, 30)}"`);
      const capStyle = await page.$eval("[data-deck-caption]", e => { const s = getComputedStyle(e); return { fs: parseFloat(s.fontSize), live: e.getAttribute("aria-live") }; });
      say(`${tag}: the caption bar is large and aria-live`, capStyle.fs >= 17 && capStyle.live === "polite", JSON.stringify(capStyle));
      await page.screenshot({ path: path.join(SHOTS, `walk46z-deck-read-${theme}-${w}.png`) });

      // the keyboard
      await page.focus("[data-deck-play]");
      const b0 = Number(await page.$eval("[data-deck-play]", e => e.dataset.beat));
      await page.keyboard.press("ArrowRight");
      const b1 = Number(await page.$eval("[data-deck-play]", e => e.dataset.beat));
      await page.keyboard.press(" ");
      const paused = await page.$eval("[data-deck-play]", e => !("playing" in e.dataset));
      await page.keyboard.press("3");
      const sp = await page.$eval('[data-play-speed="1.25"]', e => e.getAttribute("aria-pressed"));
      const bHold = Number(await page.$eval("[data-deck-play]", e => e.dataset.beat)); await sleep(3200);
      const bAfter = Number(await page.$eval("[data-deck-play]", e => e.dataset.beat));
      say(`${tag}: → skips, space pauses (and stays paused), 3 = 1.25×`, b1 === b0 + 1 && paused && sp === "true" && bAfter === bHold, `beat ${b0}→${b1}, paused ${paused}, 1.25× ${sp}, held ${bHold}=${bAfter}`);

      // Watch: muted first, then spoken beat by beat, moving on the voice's end
      // a phone: the reel covers the page's toggle, so the player's own switch (a wide screen: the page's toggle)
      await page.click(w === 400 ? '[data-play-mode-switch="watch"]' : '[data-deck-mode-pick="watch"]');
      await sleep(1200);
      const mutedSpoken = await page.evaluate(() => window.__spoken.length);
      const muteState = await page.$eval("[data-play-mute]", e => e.dataset.playMute).catch(() => null);
      say(`${tag}: Watch starts muted — nothing is said until the person turns the sound on`, mutedSpoken === 0 && muteState === "muted", `spoken ${mutedSpoken}, ${muteState}`);
      await page.click("[data-play-mute]");
      const bw0 = Number(await page.$eval("[data-deck-play]", e => e.dataset.beat));
      await sleep(1500);
      const sp1 = await page.evaluate(() => window.__spoken.map(x => x.text));
      const bw1 = Number(await page.$eval("[data-deck-play]", e => e.dataset.beat));
      const capNow = await cap();
      say(`${tag}: sound on — each beat is spoken and the next point comes on the voice's end`, sp1.length >= 3 && bw1 >= bw0 + 3 && sp1.includes(capNow), `${sp1.length} spoken, beat ${bw0}→${bw1}`);
      const rate = await page.evaluate(() => window.__spoken.at(-1)?.rate);
      say(`${tag}: the voice's rate is the chosen speed`, rate === 1.25, String(rate));

      // played to the end: it stops on the check
      for (let k = 0; k < 40; k++) { const done = await page.$("[data-play-check]"); if (done) break; await sleep(300); }
      await sleep(600);
      const atCheck = await page.$("[data-play-check] [data-deck-check], [data-play-check] [data-deck-check-waiting]");
      const stopped = await page.$eval("[data-deck-play]", e => !("playing" in e.dataset));
      say(`${tag}: played to the end, it stops on the check`, !!atCheck && stopped, `check ${!!atCheck}, stopped ${stopped}`);
      await page.screenshot({ path: path.join(SHOTS, `walk46z-deck-check-${theme}-${w}.png`) });

      // a phone: full screen, ✕ Cards back
      if (w === 400) {
        await page.click('[data-play-prev]');
        const fixed = await page.$eval("[data-deck-play]", e => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return s.position === "fixed" && r.width >= innerWidth - 1 && r.height >= innerHeight - 1; });
        const exitVis = await page.$eval("[data-play-exit]", e => getComputedStyle(e).display !== "none");
        const noScroll = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
        await page.screenshot({ path: path.join(SHOTS, `walk46z-deck-phone-${theme}.png`) });
        await page.click("[data-play-exit]");
        const back = await page.$eval("[data-deck-view]", e => e.dataset.deckMode);
        say(`${tag}: a phone plays it full screen; ✕ Cards goes back`, fixed && exitVis && noScroll && back === "cards", `fixed ${fixed}, exit ${exitVis}, no sideways scroll ${noScroll}, back ${back}`);
      } else {
        const exitHidden = await page.$eval("[data-play-exit]", e => getComputedStyle(e).display === "none");
        say(`${tag}: on a wide screen the player stays in the page (no ✕)`, exitHidden, String(exitHidden));
      }
      say(`${tag}: no page errors`, errors.length === 0, errors.join(" · ") || "none");
      await page.close();
    }
  }

  // Reduce motion: no transition on the points
  {
    const page = await (await browser.createBrowserContext()).newPage();
    await page.evaluateOnNewDocument(stubSpeech);
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${BASE}/atlas/library/${DECK}?play=read`, { waitUntil: "networkidle2" });
    await page.waitForSelector(".lib-play__pt", { timeout: 20000 }).catch(() => {});
    const t = await page.$eval(".lib-play__pt", e => getComputedStyle(e).transitionDuration).catch(() => null);
    say("reduced motion: the points appear at once (no transition)", t === "0s", String(t));
    await page.close();
  }

  // a guide's ▶ Watch opens the deck playing (Watch, muted)
  {
    const page = await (await browser.createBrowserContext()).newPage();
    await page.evaluateOnNewDocument(stubSpeech);
    await page.setViewport({ width: 1440, height: 900 });
    const guide = await fetch(`${BASE}/api/learn/guides`).then(r => r.json()).then(g => (g.guides || []).find(x => x.written && x.lessons.some(l => l.id === DECK)));
    await page.goto(`${BASE}/atlas/library/${guide?.id}`, { waitUntil: "networkidle2" });
    await page.waitForSelector(`[data-deck-play-link="${DECK}"]`, { timeout: 20000 }).catch(() => {});
    const links = (await page.$$("[data-deck-play-link]")).length;
    await page.click(`[data-deck-play-link="${DECK}"]`).catch(() => {});
    await page.waitForSelector("[data-deck-play]", { timeout: 8000 }).catch(() => {});
    const m = await page.$eval("[data-deck-view]", e => e.dataset.deckMode).catch(() => null);
    const muted = await page.$eval("[data-play-mute]", e => e.dataset.playMute).catch(() => null);
    say("a guide's ▶ Watch opens the deck playing, muted", links >= 2 && m === "watch" && muted === "muted", `${links} ▶ links; mode ${m}; ${muted}`);
    await page.screenshot({ path: path.join(SHOTS, "walk46z-deck-guide.png") });
    await page.close();
  }

  // Customise → Narration voice lists the device's voices and keeps the choice in this browser
  {
    const page = await (await browser.createBrowserContext()).newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.evaluateOnNewDocument(stubSpeech);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    const reg = await page.evaluate(async () => (await fetch("/api/auth/register", { method: "POST", credentials: "include", headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "synthetic-ada-decks", password: "Walk46z-not-a-real-pass!", profile: { email: "ada-decks@example.test", first_name: "Ada", last_name: "Synthetic" } }) })).status);
    await page.goto(`${BASE}/app/customise`, { waitUntil: "networkidle2" });
    await page.waitForSelector("[data-narration-voice]", { timeout: 20000 }).catch(() => {});
    const opts = await page.$$eval("[data-narration-voice] option", os => os.map(o => o.value)).catch(() => []);
    await page.select("[data-narration-voice]", "Walk Voice B").catch(() => {});
    const kept = await page.evaluate(() => localStorage.getItem("draft.narrationVoice"));
    say("Customise → Narration voice: the device's voices, kept in this browser", (reg === 200 || reg === 201) && opts.includes("Walk Voice A") && opts.includes("Walk Voice B") && kept === "Walk Voice B", `register ${reg}; ${opts.length} options; kept ${kept}`);
    await page.screenshot({ path: path.join(SHOTS, "walk46z-narration-voice.png") });
    say("Customise: no page errors", errors.length === 0, errors.join(" · ") || "none");
    await page.close();
  }
} catch (e) {
  say("the walk", false, e.stack || e.message);
} finally {
  if (browser) await browser.close().catch(() => {});
  kill();
}
const pass = results.filter(Boolean).length;
console.log(`\n${pass} / ${results.length}${pass === results.length ? " ALL PASS" : " — FAILURES"}`);
process.exit(pass === results.length ? 0 : 1);
