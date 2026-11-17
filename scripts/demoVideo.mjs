#!/usr/bin/env node
/**
 * ⭐ 46q · THE DEMO VIDEO, ONE COMMAND (owner 11-16: "a new demo run video for yc to update the older one"; the brief:
 * ≤ 180 s, production, "good enough" resolution, short burned-in captions naming each step, no voice). It walks the
 * product as it is now — the board and today's picks, a posting, Draft, Home (the applications), Tiny, Atlas, Profile —
 * in a real Chrome on an ALREADY SIGNED-IN profile (the owner signs in once; this script never sees a password), records
 * the tab with puppeteer's screencast (ffmpeg) and writes an mp4.
 *
 *   node scripts/demoVideo.mjs --profile "C:\Users\<you>\.draft-yc-profile" [--base https://jobsviadraft.com]
 *        [--out C:\Users\<you>\Videos\draft-demo-<date>.mp4] [--size 1600x900] [--no-draft]
 *
 * ⛔ IT REFUSES TO SEND ANYTHING (D36: the person sends). Every request that is not a GET is ABORTED unless it is on the
 * allow-list below — one Draft (POST /api/apply/runs: it makes a run that waits for review), the posting's "visited"
 * mark, Tiny's lookups, telemetry. Approve, send, submit, run-now, handoff, answers, settings: all aborted and counted;
 * the script prints every aborted write and exits 1 if any was a send / approve / submit path. --no-draft aborts the
 * Draft too. ⛔ Only https://jobsviadraft.com or this computer's loopback.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import puppeteer from "puppeteer-core";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const flag = (k) => process.argv.includes(k);
const BASE = arg("--base", "https://jobsviadraft.com").replace(/\/$/, "");
const PROFILE = arg("--profile", null);
const [VW, VH] = String(arg("--size", "1600x900")).split("x").map(Number);
const today = new Date().toISOString().slice(0, 10);
const OUT = path.resolve(arg("--out", path.join(os.homedir(), "Videos", `draft-demo-${today}.mp4`)));
const NO_DRAFT = flag("--no-draft");
// ⭐ 46s (owner 11-17: "do the demo in plain light theme"): the theme is applied IN THIS BROWSER ONLY — the account's
// saved appearance is answered with this theme for the recording (a read, mocked); nothing is written to the account.
const THEME = arg("--theme", null);
const CHROME = arg("--chrome", "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe");
const MAX_SECONDS = 180;
// ⭐ 46t (owner 11-17: "use narration and captions … last video was at 99s without much emphasis on atlas and also weak
// narration on how draft works. use the time"): every beat SPEAKS a line and shows a short caption; the beat lasts as long
// as its line. --voice <edge-tts voice> (default en-US-AndrewNeural) makes the clips with edge-tts (only these lines leave
// the computer — the owner's pick, 11-17); --no-voice records captions only; --voice-only makes the clips and stops (it still wants --profile and a free --out).
const VOICE = flag("--no-voice") ? null : arg("--voice", "en-US-AndrewNeural");
const CLIPS = path.join(path.dirname(OUT), ".demo-voice");

const host = new URL(BASE);
if (!(host.origin === "https://jobsviadraft.com" || /^(127\.0\.0\.1|localhost)$/.test(host.hostname))) { console.error(`REFUSING: ${BASE} is not draft's production or this computer`); process.exit(2); }
if (!PROFILE || !fs.existsSync(PROFILE)) { console.error("REFUSING: --profile must name a signed-in Chrome profile directory"); process.exit(2); }
if (fs.existsSync(OUT)) { console.error(`REFUSING: ${OUT} exists — the old video is kept; pass another --out`); process.exit(2); }

/** The only writes a demo may make. Everything else that is not a GET is aborted. */
export const ALLOWED_WRITES = [
  { method: "POST", re: /^\/api\/apply\/runs$/, why: "Draft — a run that waits for the person's review (Ask me first)" },
  { method: "PATCH", re: /^\/api\/jobs\/[^/]+\/visited$/, why: "the posting was opened" },
  { method: "POST", re: /^\/api\/assistant\/lookup$/, why: "Tiny's T2 answers (no model)" },
  { method: "POST", re: /^\/api\/(events|telemetry|track|analytics|client-errors?)(\/|$)/, why: "telemetry" },
];
export const NEVER = /approve|submit|send|run-now|release|handoff|confirm|\/answers|mark-applied|sent\b/i;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const aborted = [], allowed = [];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: PROFILE,
  args: ["--no-first-run", `--window-size=${VW},${VH}`, "--disable-features=HttpsFirstBalancedModeAutoEnable"], defaultViewport: { width: VW, height: VH, deviceScaleFactor: 1 } });
const page = await browser.newPage();
await page.setRequestInterception(true);
if (THEME) await page.evaluateOnNewDocument((t) => { try { localStorage.setItem("draft-theme", t); } catch { /* blocked */ } }, THEME);
// a visible pointer for the recording (a headless screencast draws none): a dot that follows the mouse
await page.evaluateOnNewDocument(() => {
  addEventListener("DOMContentLoaded", () => {
    const d = document.createElement("div"); d.id = "demo-pointer";
    d.style.cssText = "position:fixed;left:-40px;top:-40px;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:rgba(20,20,20,.55);border:2px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.35);z-index:2147483646;pointer-events:none;transition:left .06s linear,top .06s linear";
    document.body.appendChild(d);
    addEventListener("pointermove", (e) => { d.style.left = e.clientX + "px"; d.style.top = e.clientY + "px"; }, { passive: true });
  });
});
page.on("request", (req) => {
  const u = new URL(req.url()), m = req.method();
  if (THEME && m === "GET" && u.origin === host.origin && u.pathname === "/api/settings/appearance")
    return req.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ theme: THEME, cues: false }) });
  if (m === "GET" || m === "HEAD" || m === "OPTIONS" || u.origin !== host.origin) return req.continue();
  // ONE Draft per recording — a second POST /api/apply/runs (a re-render, a second press) is aborted
  const isDraft = u.pathname === "/api/apply/runs";
  const ok = ALLOWED_WRITES.find(w => w.method === m && w.re.test(u.pathname)) && !(isDraft && (NO_DRAFT || allowed.some(a => a === "POST /api/apply/runs"))) && !NEVER.test(u.pathname);
  if (ok) { allowed.push(`${m} ${u.pathname}`); return req.continue(); }
  aborted.push(`${m} ${u.pathname}`); return req.abort("blockedbyclient");
});

const CAPTION_CSS = `#demo-cap{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483647;max-width:min(1100px,86vw);
  padding:12px 22px;border-radius:12px;background:rgba(14,14,16,.86);color:#fff;font:500 22px/1.35 "Inter Tight","DM Sans",system-ui,sans-serif;
  text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.35);pointer-events:none;transition:opacity .25s}`;
const caption = (text) => page.evaluate((t, css) => {
  if (!document.getElementById("demo-cap-css")) { const s = document.createElement("style"); s.id = "demo-cap-css"; s.textContent = css; document.head.appendChild(s); }
  let c = document.getElementById("demo-cap"); if (!c) { c = document.createElement("div"); c.id = "demo-cap"; document.body.appendChild(c); }
  c.textContent = t; c.style.opacity = t ? "1" : "0";
}, text, CAPTION_CSS).catch(() => {});
const go = async (p) => { await page.goto(BASE + p, { waitUntil: "networkidle2", timeout: 45000 }).catch(() => {}); await sleep(800); };
const smoothScroll = (px, ms = 1800) => page.evaluate((px, ms) => new Promise(r => { const y0 = scrollY, t0 = performance.now(); const f = (t) => { const k = Math.min(1, (t - t0) / ms); scrollTo(0, y0 + px * (k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2)); k < 1 ? requestAnimationFrame(f) : r(); }; requestAnimationFrame(f); }), px, ms);
const clickText = (re, sel = "button, a, [role=button]") => page.evaluate((src, sel) => { const re = new RegExp(src, "i"); const el = [...document.querySelectorAll(sel)].find(e => re.test((e.textContent || "").trim()) && e.offsetParent); if (el) { el.scrollIntoView({ block: "center" }); el.click(); return true; } return false; }, re.source, sel);
// Types into ONE element only: it must hold the focus first — stray keys would reach the board's shortcuts (Enter opens a
// posting, S saves). Each key goes to the element's own handle, never the page.
const typeSlow = async (sel, text) => {
  const el = await page.waitForSelector(sel, { visible: true, timeout: 10000 });
  await el.focus(); await sleep(150);
  if (!(await el.evaluate(e => e === document.activeElement))) throw new Error(`${sel} did not take the focus`);
  await el.type(text, { delay: 45 });
};
// ⭐ 46s · hover like a person: bring the mark into view, glide the pointer to it (its tooltip opens), hold
const hover = async (sel, { nth = 0, hold = 2200 } = {}) => {
  const els = await page.$$(sel); const el = els[Math.min(nth, els.length - 1)];
  if (!el) return false;
  await el.evaluate(e => e.scrollIntoView({ block: "center", behavior: "smooth" })); await sleep(700);
  const b = await el.boundingBox(); if (!b) return false;
  await page.mouse.move(b.x + b.width / 2, b.y + Math.min(b.height / 2, 40), { steps: 18 }); await sleep(hold);
  return true;
};
const scrollToSel = async (sel) => { await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: "start", behavior: "smooth" }), sel); await sleep(1200); };
const enterIn = async (sel) => { const el = await page.$(sel); if (await el?.evaluate(e => e === document.activeElement)) await el.press("Enter"); else throw new Error(`${sel} lost the focus`); };

/** The script: [id, caption, narration]. The narration says how draft works; the caption names the step. */
export const LINES = {
  intro: ["draft reads employers' own career pages every day, and ranks every job against your résumé",
    "This is draft. Every day it reads open jobs straight from employers' career pages, on Greenhouse, Lever, Ashby and Workday, and scores each one against your résumé the way an applicant tracking system would. These are today's picks."],
  board: ["The whole board, every job with your match",
    "Below them is the whole board, every job with your match."],
  posting: ["Open a job: pay, workstyle, sponsorship and your match, at a glance",
    "Open one: the pay, the workstyle, visa sponsorship, and how your résumé scores against it."],
  draft: ["Draft: a tailored résumé and a filled form — nothing is sent until you say so",
    "Press Draft, and draft tailors your résumé to this one job, never inventing experience, then fills in the employer's form and stops. Nothing is sent without you."],
  home: ["Home: every application, and what each one needs from you",
    "Home is every application in one place, and what each one needs from you."],
  review: ["Review, answer what only you can, and send it yourself",
    "Check the résumé and the answers, fill in what only you can, and send it yourself."],
  tiny: ["Tiny: ask in plain words — it sets the filters and answers from your own data",
    "Tiny lives on every page. Ask in plain words: it sets the board's filters, or counts what needs you, from your own data."],
  atlas: ["Atlas: how many jobs you can apply for today — counted, never a model's guess",
    "Now Atlas: where you stand in the market. The big number is counted from live postings and your résumé, never a model's guess: the jobs you can apply for today, split by level."],
  histogram: ["Every open job for your aim, by how much of it you already have",
    "This is every open job for your aim, placed by how much of it you already have. Right of the line, sixty percent or more, you can apply."],
  map: ["Your skill map: each square is a skill, sized by how many jobs want it",
    "Your skill map: each square is a skill these jobs ask for, sized by how many ask."],
  states: ["Solid: proven · striped: on your résumé · outlined: a gap",
    "Solid is proven, striped is on your résumé, and an outline is a gap the market wants."],
  role: ["Switch the job and the same map redraws for what that role wants",
    "Switch roles, and the same map redraws for what that job wants."],
  learn: ["Learn next: the skills that open the most jobs per hour, with who is hiring",
    "Learn next turns your gaps into a plan: the skills that open the most jobs per hour of study, with the companies hiring for each."],
  move: ["Jobs you could move to: further right, the more of it you already have",
    "And the roles you could move to: further right, the more you already have; higher, the more are open."],
  run: ["Your run: a plan for today, and points only from proof",
    "Atlas also teaches. Your run sets today's plan, about nine minutes, and points come only from proof: a check passed, an idea explained, a build finished."],
  library: ["The library: guides by level, courses and pathways",
    "The library holds guides by level, full courses, and a pathway for each kind of engineering role."],
  course: ["A course is one circle: 108 lessons, from silicon to software",
    "A course is one circle: a hundred and eight lessons, from the first transistor to the cloud. Each lesson links the best material we found, and ends with a quick check in your own words."],
  deck: ["A guide is a short deck — five minutes to read",
    "Guides are short decks you can read in five minutes."],
  question: ["One question a day, picked from your gaps and the jobs you saved",
    "And one question a day, picked from the gaps on your map and the skills your saved jobs ask for."],
  close: ["draft — find the job, fit the résumé, apply when you say so.  jobsviadraft.com",
    "draft. Find the right jobs, fit your résumé to each one, and apply when you say so. jobs via draft dot com."],
};

// the clips, made BEFORE the browser opens (cached by voice + text), with their lengths
const clip = {};
if (VOICE) {
  fs.mkdirSync(CLIPS, { recursive: true });
  for (const [id, [, text]] of Object.entries(LINES)) {
    const f = path.join(CLIPS, `${VOICE}-${createHash("sha1").update(text).digest("hex").slice(0, 12)}.mp3`);
    // edge-tts can exit 0 with an EMPTY file (a dropped connection, 46t): retry, and never keep a 0-byte clip in the cache
    for (let i = 0; i < 3 && !(fs.existsSync(f) && fs.statSync(f).size > 0); i++) {
      fs.rmSync(f, { force: true });
      try { execFileSync("python", ["-m", "edge_tts", "--voice", VOICE, "--rate", "+8%", "--text", text, "--write-media", f], { stdio: "inherit" }); } catch { /* retried */ }
    }
    if (!(fs.existsSync(f) && fs.statSync(f).size > 0)) { fs.rmSync(f, { force: true }); throw new Error(`no voice for "${id}" after 3 tries`); }
    const sec = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString().trim());
    clip[id] = { f, ms: Math.round(sec * 1000) };
  }
  console.log(`voice ${VOICE}: ${Object.keys(clip).length} clips, ${Math.round(Object.values(clip).reduce((a, c) => a + c.ms, 0) / 1000)} s spoken`);
}
if (flag("--voice-only")) { await browser.close(); process.exit(0); }

// signed in?
await go("/app");
const me = await page.evaluate(async () => (await fetch("/api/auth/me")).json()).catch(() => ({}));
if (!me.authenticated) { console.error("REFUSING: the profile is signed out — sign in once in that profile, then run again"); await browser.close(); process.exit(3); }

const WEBM = OUT.replace(/\.mp4$/i, "") + ".webm";
const rec = await page.screencast({ path: WEBM });
const t0 = Date.now();
const steps = [], spoken = [];
const step = async (name, fn) => { const s = Date.now(); try { await fn(); steps.push({ name, s: Math.round((s - t0) / 1000), ok: true }); } catch (e) { steps.push({ name, s: Math.round((s - t0) / 1000), ok: false, error: e.message.slice(0, 160) }); } };
/** One beat: the caption shows and the line starts; the actions run under it; the beat ends when both are done. */
const beat = async (id, fn = async () => {}, { min = 0, tail = 350 } = {}) => {
  const s = Date.now(); await caption(LINES[id][0]);
  if (clip[id]) spoken.push({ id, at: s - t0 });
  try { await fn(); } finally {
    const need = Math.max(clip[id]?.ms ?? 3800, min) + tail - (Date.now() - s);
    if (need > 0) await sleep(need);
  }
};
const roleBtns = () => page.evaluate(() => [...document.querySelectorAll("[data-skm-role-btn]")].map(s => s.closest("button")).filter(Boolean).length);
try {
  await step("today", async () => {
    await go("/app/today");
    await beat("intro", async () => { await sleep(3200); for (let i = 0; i < 3; i++) { await clickText(/^›$/); await sleep(1600); } });
    await beat("board", async () => { await smoothScroll(650, 1800); await sleep(900); await smoothScroll(-650, 1200); });
  });
  await step("posting", async () => {
    await beat("posting", async () => {
      await page.evaluate(() => document.querySelector("[data-jb-row], .jb, [data-job-row]")?.click()); await sleep(2600);
      await smoothScroll(380, 1400); await sleep(900); await smoothScroll(-380, 900);
    });
  });
  await step("draft", async () => {
    await beat("draft", async () => {
      // the open posting takes the deck's place — fold it back, then the deck card's Draft
      await clickText(/^Fold it back$/); await sleep(1100);
      if (!NO_DRAFT && !(await clickText(/^Draft$/))) throw new Error("no Draft button on screen");
    });
  });
  await step("home", async () => {
    await go("/app/auto-apply");
    await beat("home");
    await beat("review", async () => { await page.evaluate(() => document.querySelector("[data-tracker-table] tbody tr")?.click()); });
  });
  await step("tiny", async () => {
    await go("/app/today"); await sleep(400);
    await beat("tiny", async () => {
      // Tiny's open card survives a reload — press the fox only when it is shut (a press on an open one closes it)
      if (!(await page.$("[data-ask-draft][data-open='true']"))) await page.click("[data-tiny-launch]");
      const INPUT = "[data-ask-draft][data-open='true'] [data-ask-input]";
      await page.waitForSelector(INPUT, { visible: true, timeout: 10000 }); await sleep(500);
      await typeSlow(INPUT, "show remote jobs in New York"); await enterIn(INPUT); await sleep(2400);
      await typeSlow(INPUT, "how many need me?"); await enterIn(INPUT); await sleep(2000);
    });
    await page.click("[data-ask-close]").catch(() => {}); await sleep(400);
  });
  // ⭐ 46s / 46t (owner 11-17: "showing atlas properly … hovering over the map explaining how it works"): A228's skill map,
  // walked with the pointer — every hover opens the mark's own tooltip. Reads only: the role buttons fetch or redraw;
  // "Aim for this" (a write) is never pressed.
  await step("atlas", async () => {
    await go("/app/atlas/your-map"); await sleep(700);
    await beat("atlas", async () => { await hover("[data-skm-applicable]", { hold: 2600 }); await hover("[data-skm-levels] > div", { nth: 1, hold: 2200 }); });
    await beat("histogram", async () => { for (const n of [3, 6, 8]) await hover("[data-skm-histogram] [data-tip]", { nth: n, hold: 1600 }); });
    await scrollToSel("[data-skm-section=wants]");
    await beat("map", async () => { await hover("[data-skm-tile] rect", { nth: 0, hold: 2200 }); });
    await beat("states", async () => {
      await hover("[data-skm-tile][data-state=claimed] rect", { hold: 1900 }) || await hover("[data-skm-tile][data-state=proven] rect", { hold: 1900 });
      await hover("[data-skm-tile][data-state=missing] rect", { hold: 1900 });
    });
    await beat("role", async () => {
      if (await roleBtns() < 2) return;
      await page.evaluate(() => { const b = [...document.querySelectorAll("[data-skm-role-btn]")].map(s => s.closest("button")).filter(Boolean); (b.find(x => x.getAttribute("aria-pressed") !== "true") || null)?.click(); });
      await sleep(2200); await hover("[data-skm-tile] rect", { nth: 0, hold: 1800 });
    });
    // back to the aim, so Learn next and the moves read for the job the person is aiming at
    await page.evaluate(() => [...document.querySelectorAll("[data-skm-role-btn]")].map(s => s.closest("button")).find(b => /your aim/i.test(b?.textContent || ""))?.click()); await sleep(1200);
    await scrollToSel("[data-skm-section=learn]");
    await beat("learn", async () => { await hover("[data-skm-point]", { nth: 1, hold: 1900 }); await hover("[data-skm-step]", { nth: 0, hold: 2000 }); });
    await scrollToSel("[data-skm-section=move]");
    await beat("move", async () => { await hover("[data-skm-role]", { nth: 1, hold: 2200 }); await hover("[data-skm-card]", { nth: 0, hold: 2000 }); });
    await page.mouse.move(8, 8);
  });
  // ⭐ 46t (owner 11-17: "none of the courses and learning material is covered. distribute to accommodate"): Your run, the
  // library, a course's circle, a guide deck, Today's question — reads only (a deck's Next is a page turn; an answer to
  // Today's question would be a write and is never pressed).
  await step("learning", async () => {
    await go("/app/atlas/your-run");
    await beat("run", async () => { await hover("[data-run-total], [data-run-level]", { hold: 2200 }); await hover("[data-quest]", { hold: 2400 }); await hover("[data-run-week], [data-run-weekdays]", { hold: 1800 }); });
    await go("/app/atlas/library");
    await beat("library", async () => { await hover("[data-guide]", { nth: 0, hold: 1600 }); await hover("[data-course]", { nth: 0, hold: 1600 }); await smoothScroll(700, 1600); await sleep(700); });
    await go("/app/atlas/library/silicon-to-software");
    await beat("course", async () => {
      await scrollToSel("[data-learn-circle]");
      for (const n of [4, 30, 70]) await hover("[data-learn-piece]", { nth: n, hold: 1700 });
      await hover("[data-resource-tile]", { nth: 0, hold: 1800 });
    });
    await go("/app/atlas/library/sw-f-04");
    await beat("deck", async () => { await sleep(900); for (let i = 0; i < 2; i++) { await clickText(/^Next/); await sleep(1300); } });
    await go("/app/atlas/todays-question");
    await beat("question", async () => { await hover("[data-daily-question]", { hold: 2200 }); });
    await page.mouse.move(8, 8);
  });
  await step("close", async () => {
    await go("/app/today"); await beat("close", async () => {}, { tail: 1200 });
  });
} finally {
  await rec.stop().catch(() => {});
  await browser.close();
}
const seconds = Math.round((Date.now() - t0) / 1000);
const SILENT = OUT.replace(/\.mp4$/i, "") + ".silent.mp4";
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", WEBM, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "22", "-movflags", "+faststart", "-t", String(MAX_SECONDS), spoken.length ? SILENT : OUT], { stdio: "inherit" });
fs.rmSync(WEBM, { force: true });
if (spoken.length) {
  // each line laid at the moment its beat began, mixed (no normalising, so a lone line keeps its loudness), muxed in
  const ins = spoken.flatMap(s => ["-i", clip[s.id].f]);
  const f = spoken.map((s, i) => `[${i + 1}:a]adelay=${s.at}|${s.at}[a${i}]`).join(";") + ";" + spoken.map((_, i) => `[a${i}]`).join("") + `amix=inputs=${spoken.length}:normalize=0,apad[aud]`;
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", SILENT, ...ins, "-filter_complex", f, "-map", "0:v", "-map", "[aud]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", OUT], { stdio: "inherit" });
  fs.rmSync(SILENT, { force: true });
}
const bad = aborted.filter(a => NEVER.test(a));
console.log(JSON.stringify({ out: OUT, seconds, size: `${VW}x${VH}`, voice: VOICE, steps, spoken, allowedWrites: allowed, abortedWrites: aborted }, null, 1));
if (seconds > MAX_SECONDS) console.error(`⚠ the walk took ${seconds} s — the mp4 is cut at ${MAX_SECONDS} s`);
if (bad.length) { console.error(`⛔ the page tried ${bad.length} send / approve / submit request(s) — aborted, but look at why: ${bad.join(", ")}`); process.exit(1); }
