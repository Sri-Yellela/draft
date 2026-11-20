// scripts/walkDefendT14_46y.mjs — ⭐ 46y · D142 DEFEND and D150 T14 in draft's web app, in real Chrome, on a FRESH data dir
// (crawling off, no model key): a SYNTHETIC person with a SYNTHETIC résumé. Interview → Defend your résumé: the sketch's card,
// Type it → Done → the harder follow-up → Next question; Answer out loud → the clock counts. Learn: one piece's approved-bank
// items set live IN THIS THROWAWAY DB ONLY (the walk's stand-in for the owner's approval), two of its items answered wrong two
// days ago → the Library's quiet "N to review" line → the piece → its questions box → an answer → its checked state.
// Two themes × 1440 / 400; shots docs/fidelity-shots/walk46y-defend-*.png and walk46y-t14-*.png.
//   npm --prefix client run build && node scripts/walkDefendT14_46y.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import Database from "better-sqlite3";
import puppeteer from "puppeteer-core";
import { resolveBrowserExecutable } from "../services/browserLauncher.js";

const ROOT = process.cwd();
const RUN = path.resolve(process.argv[2] || "tmp/walkDefendT14_46y");
const SHOTS = path.join(ROOT, "docs", "fidelity-shots");
const PORT = 4461, BASE = `http://127.0.0.1:${PORT}`;
const PIECE = "o3";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = [];
const say = (name, ok, what) => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${what}`); };
fs.rmSync(RUN, { recursive: true, force: true });
fs.mkdirSync(RUN, { recursive: true });
fs.mkdirSync(SHOTS, { recursive: true });
const env = { ...process.env, RM_DATA_DIR: RUN, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "walkDefendT14-not-real",
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
Senior Software Engineer — Northwind Systems
2017 – 2019
- Led the billing migration to Kubernetes, cutting hosting costs by 40%
- Built React and Node.js features used by 3 product teams
- Wrote the on-call runbook for the ledger service
Software Engineer — Contoso Labs
2014 – 2017
- Built data pipelines on Airflow for the finance team
Skills
Go, Kafka, PostgreSQL, Airflow, Docker, AWS`;

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
    body: JSON.stringify({ username: "synthetic-ada-defend", password: "Walk46y-not-a-real-pass!", profile: { email: "ada-defend@example.test", first_name: "Ada", last_name: "Synthetic" } }) })).status);
  say("a synthetic person signs up", reg === 200 || reg === 201, String(reg));

  const db = new Database(path.join(RUN, "resume_master.db"));
  const uid = db.prepare(`SELECT id FROM users WHERE username = 'synthetic-ada-defend'`).pluck().get();
  db.prepare(`UPDATE domain_profiles SET is_active = 0 WHERE user_id = ?`).run(uid);
  const pid = db.prepare(`INSERT INTO domain_profiles (user_id, profile_name, role_family, domain, is_active) VALUES (?, 'Backend engineer', 'engineering', 'software', 1)`).run(uid).lastInsertRowid;
  db.prepare(`INSERT INTO profile_base_resumes (profile_id, user_id, name, content, updated_at) VALUES (?, ?, 'ada.txt', ?, unixepoch())`).run(pid, uid, RESUME);
  // THIS THROWAWAY DB ONLY: one piece's bank items live (the owner approves them on production), two missed two days ago.
  const ids = db.prepare(`SELECT id FROM learn_questions WHERE pieces_json LIKE ? AND type = 'scenario' ORDER BY id`).pluck().all(`%"${PIECE}"%`);
  db.prepare(`UPDATE learn_questions SET status = 'live' WHERE id IN (${ids.map(() => "?").join(",")})`).run(...ids);
  const ago = Math.floor(Date.now() / 1000) - 2 * 86400;
  for (const id of ids.slice(0, 2)) db.prepare(`INSERT INTO learn_question_answers (question_id, user_id, surface, chosen, correct, answered_at) VALUES (?, ?, 'daily', 0, 0, ?)`).run(id, uid, ago);
  db.close();
  say(`piece ${PIECE}: bank items made live in the throwaway DB`, ids.length >= 2, ids.join(", "));

  const api = await page.evaluate(async () => (await fetch("/api/interview/defend", { credentials: "include" })).json());
  say("GET /api/interview/defend", api.hasResume === true && api.bullets.length === 4, `${api.bullets?.length} bullets · first: ${api.bullets?.[0]?.text}`);

  let first = true;
  for (const theme of ["plain-light", "dusk-dark"]) {
    await page.evaluateOnNewDocument((t) => { try { localStorage.setItem("draft-theme", t); } catch { /* blocked */ } }, theme);
    for (const [w, h] of [[1440, 1000], [400, 900]]) {
      const tag = `${theme} ${w}`;
      await page.setViewport({ width: w, height: h });
      // ── Defend ──
      errors.length = 0;
      await page.goto(`${BASE}/app/interview/defend`, { waitUntil: "networkidle2", timeout: 120000 });
      const card = await page.waitForSelector("[data-defend-line]", { timeout: 45000 }).catch(() => null);
      if (!card) { say(`${tag}: Defend's card`, false, "not drawn"); await page.screenshot({ path: path.join(SHOTS, `walk46y-defend-${theme}-${w}-none.png`) }); continue; }
      const r0 = await page.evaluate(() => ({ text: document.querySelector("[data-interview-page]").innerText, side: document.documentElement.scrollWidth > innerWidth + 1,
        btns: [...document.querySelectorAll("[data-defend-line] button")].map(b => [b.innerText, getComputedStyle(b).borderRadius]) }));
      say(`${tag}: the sketch's words and card`, /Every line you wrote, asked about/.test(r0.text) && /The coach picks a bullet/.test(r0.text) && /“Led the billing migration/.test(r0.text) && /Answer out loud/.test(r0.text) && /Type it/.test(r0.text), r0.text.replace(/\s+/g, " ").slice(0, 220));
      say(`${tag}: no pill, no side-scroll`, r0.btns.every(([, br]) => parseFloat(br) <= 16) && !r0.side, JSON.stringify(r0.btns));
      await page.screenshot({ path: path.join(SHOTS, `walk46y-defend-${theme}-${w}.png`), fullPage: false });
      await page.click("[data-defend-type]");
      await page.type("[data-defend-text]", "I measured hosting spend in the cloud bill over two quarters.");
      await page.click("[data-defend-done]");
      const harder = await page.waitForSelector("[data-defend-harder]", { timeout: 5000 }).then(() => page.evaluate(() => document.querySelector("[data-defend-harder]").innerText)).catch(() => "");
      say(`${tag}: Type it → Done → the harder follow-up`, /pushes/.test(harder) && /Next question/.test(harder), harder.replace(/\s+/g, " "));
      await page.screenshot({ path: path.join(SHOTS, `walk46y-defend-harder-${theme}-${w}.png`) });
      await page.click("[data-defend-next]");
      await page.click("[data-defend-voice]");
      await sleep(2300);
      const clock = await page.evaluate(() => document.querySelector("[data-defend-clock] [role=timer]")?.textContent);
      say(`${tag}: Answer out loud → the clock counts, nothing listens`, /^0:0[2-3]$/.test(clock || ""), clock);
      say(`${tag}: Defend, no page errors`, errors.length === 0, errors.slice(0, 2).join(" | ") || "none");
      // ── Learn: the review line → the piece → its questions ──
      errors.length = 0;
      await page.goto(`${BASE}/app/atlas/library`, { waitUntil: "networkidle2", timeout: 120000 });
      const line = await page.waitForSelector("[data-learn-review]", { timeout: 30000 }).then(() => page.evaluate(() => document.querySelector("[data-learn-review]").innerText)).catch(() => "");
      say(`${tag}: the Learn home's quiet line`, line === (first ? "2 to review" : "1 to review"), line);
      await page.screenshot({ path: path.join(SHOTS, `walk46y-t14-home-${theme}-${w}.png`) });
      await page.click("[data-learn-review] a");
      const box = await page.waitForSelector("[data-learn-questions]", { timeout: 45000 }).catch(() => null);
      if (!box) { say(`${tag}: the piece's questions`, false, "not drawn"); await page.screenshot({ path: path.join(SHOTS, `walk46y-t14-${theme}-${w}-none.png`) }); continue; }
      await box.evaluate(b => b.scrollIntoView({ block: "start" }));
      const before = await page.evaluate(() => document.querySelector("[data-learn-questions]").innerText);
      say(`${tag}: the piece's questions box`, /Questions/i.test(before) && /right/i.test(before), before.replace(/\s+/g, " ").slice(0, 200));
      if (first) {   // answer once (the first pass); later passes see the state it left
        await page.click("[data-learn-question] .atl-dq__choice");
        const why = await page.waitForSelector("[data-learn-why]", { timeout: 10000 }).then(() => page.evaluate(() => document.querySelector("[data-learn-why]").innerText)).catch(() => "");
        say(`${tag}: an answer → its why`, /Right\.|Not quite\./.test(why), why.replace(/\s+/g, " ").slice(0, 160));
        first = false;
      }
      await sleep(300);
      await box.screenshot({ path: path.join(SHOTS, `walk46y-t14-piece-${theme}-${w}.png`) });
      const side = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      say(`${tag}: Learn, no side-scroll, no page errors`, !side && errors.length === 0, errors.slice(0, 2).join(" | ") || "none");
    }
  }
} catch (e) {
  say("the walk ran", false, e.message.slice(0, 600));
} finally {
  try { await browser?.close(); } catch { /* closed */ }
  kill();
}
const failed = results.filter(x => !x).length;
console.log(`\n${results.length - failed} / ${results.length} passed`);
process.exit(failed ? 1 : 0);
