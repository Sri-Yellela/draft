// scripts/walkQuickCheck46y.mjs — ⭐ 46y (carried since 46v) · THE QUICK CHECK'S CARD, in real Chrome.
// D169 P2's quick check had two doors: the posting panel's "That's true of me" (a claim) and Atlas → Your skills' "Check it ·
// 1 min". 46x's ATS card (option C, 75760207) removed the first; the second is the one left, and this walks it: a SYNTHETIC
// person on a FRESH data dir (crawling off), four published Atlas tools (Kafka · Airflow · dbt · Terraform), four live
// questions each added (D150's bank shape, approved through the curator's own review) — the boot's own bank import already
// holds live questions for some of them, so a check is "of 4" or "of 5" and the walk reads the number. In plain-light / dusk-dark × 1440 / 400 — one
// skill per combination, because a passed check moves the skill to CHECKED and its "Check it" goes away — it opens the check
// in place (the modes card), starts it timed (the question on draft's card, the clock), answers every question right, and
// reads the summary (passed, the skill now "checked" in the list). Shots docs/fidelity-shots/walk46y-quickcheck-*.png.
//   (cd client && npx vite build) && node scripts/walkQuickCheck46y.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import Database from "better-sqlite3";
import puppeteer from "puppeteer-core";
import { resolveBrowserExecutable } from "../services/browserLauncher.js";
import { upsertNode, setStatus } from "../services/atlas/atlasStore.js";
import { importQuestions, reviewQuestion } from "../services/learn/learnQuestions.js";

const ROOT = process.cwd();
const RUN = path.resolve(process.argv[2] || "tmp/walkQuickCheck46y");
const SHOTS = path.join(ROOT, "docs", "fidelity-shots");
const PORT = 4454, BASE = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = [];
const say = (name, ok, what) => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${what}`); };
fs.rmSync(RUN, { recursive: true, force: true });
fs.mkdirSync(RUN, { recursive: true });
fs.mkdirSync(SHOTS, { recursive: true });
const env = { ...process.env, RM_DATA_DIR: RUN, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "walkQuickCheck46y-not-real",
  COOKIE_ENCRYPTION_KEY: crypto.randomBytes(32).toString("hex"), DRAFT_SCHEMA_READER: "off", MATCH_ALERTS: "off", NETWORK_DIGEST: "off",
  DAILY_REMINDERS: "off", TAXONOMY_BACKFILL: "off", JOB_CRAWL: "off", RESEND_API_KEY: "", ANTHROPIC_API_KEY: "", ANTHROPIC_KEY: "",
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
Skills
Python, SQL`;
const SKILLS = ["Kafka", "Airflow", "dbt", "Terraform"];
const item = (slug, n) => ({ id: `walk46y-${slug}-${n}`, role: "Data Engineer", level: "mid", type: "scenario", skills: [slug], pieces: [],
  stem: `${slug} question ${n}: a synthetic scenario for the walk — which choice is the right one here?`,
  choices: ["The first choice", "The second choice", "The third choice", "The fourth choice"], correct: n % 4,
  why: ["Why the first.", "Why the second.", "Why the third.", "Why the fourth."], source: "walk46y", status: "draft" });

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
  const page = await (await browser.createBrowserContext()).newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  const reg = await page.evaluate(async () => (await fetch("/api/auth/register", { method: "POST", credentials: "include", headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "synthetic-ada-qc", password: "Walk46y-not-a-real-pass!", profile: { email: "ada-qc@example.test", first_name: "Ada", last_name: "Synthetic" } }) })).status);
  say("a synthetic person signs up", reg === 200 || reg === 201, String(reg));

  const db = new Database(path.join(RUN, "resume_master.db"));
  const uid = db.prepare(`SELECT id FROM users WHERE username = 'synthetic-ada-qc'`).pluck().get();
  db.prepare(`UPDATE domain_profiles SET is_active = 0 WHERE user_id = ?`).run(uid);
  const pid = db.prepare(`INSERT INTO domain_profiles (user_id, profile_name, role_family, domain, is_active) VALUES (?, 'Data engineer', 'data', 'software', 1)`).run(uid).lastInsertRowid;
  db.prepare(`INSERT INTO profile_base_resumes (profile_id, user_id, name, content, updated_at) VALUES (?, ?, 'ada.txt', ?, unixepoch())`).run(pid, uid, RESUME);
  const items = [];
  for (const name of SKILLS) {
    upsertNode(db, { kind: "tool", name, status: "draft" });
    setStatus(db, name.toLowerCase(), "published");
    for (let n = 1; n <= 4; n++) items.push(item(name.toLowerCase(), n));
  }
  const imp = importQuestions(db, { version: 1, note: "walk46y", items }, { apply: true });
  for (const it of items) reviewQuestion(db, it.id, { action: "approve", reviewer: "owner" });
  const live = db.prepare(`SELECT COUNT(*) FROM learn_questions WHERE status = 'live' AND id LIKE 'walk46y-%'`).pluck().get();
  const correctOf = db.prepare(`SELECT correct FROM learn_questions WHERE id = ?`).pluck();
  say("the bank: 16 questions live (4 per skill)", live === 16, `${live} live · refused ${JSON.stringify(imp.refused || []).slice(0, 120)}`);
  for (const name of SKILLS) {
    const st = await page.evaluate(async (n) => (await fetch("/api/your-skills/skills", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: n }) })).status, name);
    if (st !== 200 && st !== 201) say(`add ${name}`, false, String(st));
  }

  let i = 0;
  for (const theme of ["plain-light", "dusk-dark"]) {
    await page.evaluateOnNewDocument((t) => { try { localStorage.setItem("draft-theme", t); } catch { /* blocked */ } }, theme);
    for (const [w, h] of [[1440, 1000], [400, 900]]) {
      const skill = SKILLS[i++];
      const tag = `${theme} ${w} (${skill})`;
      await page.setViewport({ width: w, height: h });
      errors.length = 0;
      await page.goto(`${BASE}/app/atlas/your-skills`, { waitUntil: "networkidle2", timeout: 120000 });
      const row = await page.waitForFunction((s) => [...document.querySelectorAll("[data-skill-row]")].find(r => r.querySelector(".ysk__name")?.textContent.trim() === s), { timeout: 45000 }, skill).catch(() => null);
      if (!row) { say(`${tag}: the skill's row in Your skills`, false, "not found"); await page.screenshot({ path: path.join(SHOTS, `walk46y-quickcheck-${theme}-${w}-norow.png`) }); continue; }
      const btn = await row.asElement().evaluateHandle(r => [...r.querySelectorAll("button")].find(b => /Check it · 1 min/.test(b.textContent)));
      say(`${tag}: "Check it · 1 min" offered (claimed, questions exist)`, !!btn?.asElement(), (await row.asElement().evaluate(r => r.innerText.replace(/\s+/g, " "))).slice(0, 120));
      if (!btn?.asElement()) continue;
      await btn.asElement().click();
      const modes = await page.waitForSelector(`[data-skill-check="${skill}"] [data-skill-modes]`, { timeout: 20000 }).catch(() => null);
      say(`${tag}: the check opens IN PLACE — the modes card`, !!modes, modes ? await modes.evaluate(m => m.innerText.replace(/\s+/g, " ").slice(0, 140)) : "no card");
      if (!modes) continue;
      const card = await page.$(`[data-skill-check="${skill}"]`);
      await card.evaluate(c => c.scrollIntoView({ block: "center" }));
      await sleep(250);
      await card.screenshot({ path: path.join(SHOTS, `walk46y-quickcheck-${theme}-${w}-modes.png`) });
      // start it (timed, the default)
      await page.evaluate((s) => [...document.querySelectorAll(`[data-skill-check="${s}"] button`)].find(b => b.textContent.trim() === "Start the check")?.click(), skill);
      const q1 = await page.waitForSelector(`[data-skill-check="${skill}"] [data-skill-question]`, { timeout: 20000 }).catch(() => null);
      const look = await page.evaluate((s) => {
        const c = document.querySelector(`[data-skill-check="${s}"]`);
        const clock = c?.querySelector("[data-skill-clock]");
        const r = document.createRange(); if (clock) r.selectNodeContents(clock);
        return { title: c?.querySelector(".skc__title")?.textContent || "", clock: clock?.textContent || null, opts: c?.querySelectorAll(".skc__opt").length || 0,
          clockLines: clock ? new Set([...r.getClientRects()].map(x => Math.round(x.top))).size : 0,
          w: Math.round(c?.getBoundingClientRect().width || 0), fg: c ? getComputedStyle(c).color : null, side: document.documentElement.scrollWidth > innerWidth + 1 };
      }, skill);
      say(`${tag}: the question on draft's card, the clock running`, !!q1 && /Quick check for .+, question 1 of \d+/.test(look.title) && /^\d+s$/.test(look.clock || "") && look.opts === 4, `${look.title} · ${look.clock} · ${look.opts} choices`);
      say(`${tag}: it fits — no side-scroll`, look.w > 0 && look.w <= w && !look.side, `${look.w}px`);
      // 46y: at 400 px the clock broke into "75 / s" under the long title (the card's overflow-wrap: anywhere) — one line now
      say(`${tag}: the clock on one line`, look.clockLines === 1, `${look.clockLines} line(s)`);
      await (await page.$(`[data-skill-check="${skill}"]`))?.screenshot({ path: path.join(SHOTS, `walk46y-quickcheck-${theme}-${w}-question.png`) });
      // answer each question right (the key read from the walk's own database — the client never has it)
      // the check's length is the bank's (MAX_QUESTIONS), not this walk's 4: a fresh boot already holds live questions for some
      // of these skills (the boot import), so the walk reads "of N" and answers until the summary
      const total = Number((look.title.match(/of (\d+)/) || [])[1]) || 5;
      for (let n = 0; n < total; n++) {
        const qid = await page.$eval(`[data-skill-check="${skill}"] [data-skill-question]`, el => el.getAttribute("data-skill-question")).catch(() => null);
        if (!qid) break;
        const right = correctOf.get(qid);
        await page.evaluate((s, k) => document.querySelectorAll(`[data-skill-check="${s}"] .skc__opt`)[k]?.click(), skill, right);
        await page.waitForFunction((s, q) => !document.querySelector(`[data-skill-check="${s}"] [data-skill-question="${q}"]`) || document.querySelector(`[data-skill-check="${s}"] [data-skill-summary]`), { timeout: 15000 }, skill, qid).catch(() => null);
        await sleep(300);
      }
      const sum = await page.waitForSelector(`[data-skill-check="${skill}"] [data-skill-summary], [data-skill-row] [data-state-word="checked"]`, { timeout: 20000 }).catch(() => null);
      const after = await page.evaluate((s) => {
        const c = document.querySelector(`[data-skill-check="${s}"]`);
        const r = [...document.querySelectorAll("[data-skill-row]")].find(x => x.querySelector(".ysk__name")?.textContent.trim() === s);
        return { summary: c?.querySelector("[data-skill-summary]")?.getAttribute("data-skill-summary") || null, line: c?.innerText.replace(/\s+/g, " ").slice(0, 160) || "",
          state: r?.getAttribute("data-skill-state") || null };
      }, skill);
      say(`${tag}: passed — the skill reads "checked"`, !!sum && (after.summary === "passed" || after.state === "checked"), `${after.summary} · row ${after.state} · ${after.line}`);
      const cardAfter = await page.$(`[data-skill-check="${skill}"]`);
      if (cardAfter) { await cardAfter.evaluate(c => c.scrollIntoView({ block: "center" })); await sleep(250); await cardAfter.screenshot({ path: path.join(SHOTS, `walk46y-quickcheck-${theme}-${w}-summary.png`) }); }
      else await page.screenshot({ path: path.join(SHOTS, `walk46y-quickcheck-${theme}-${w}-summary.png`) });
      say(`${tag}: no page errors`, errors.length === 0, errors.slice(0, 2).join(" | ") || "none");
    }
  }
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
