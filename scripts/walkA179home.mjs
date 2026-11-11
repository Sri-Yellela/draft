// scripts/walkA179home.mjs — ⭐ 46f · A179 acceptance (4) and (5) SEEN IN A BROWSER, locally: Home's Run now (both modes'
// one button, A179 F5) answers with what it did; and the runner-down banner (A179 F6) shows when an application has waited
// in the queue with nothing started. Real server from this checkout on a THROWAWAY copy of data/resume_master.db, keys
// blanked, a synthetic TEST account with sample résumé A (any Draft goes to draft's practice form, never an employer).
// "Down" is made the way it happens: a run job left 'queued' for 10 minutes that the runner never picked up (written to the
// copy after boot, so the in-memory queue never sees it). Screenshots under tmp/walkA179home/shots/.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import Database from "better-sqlite3";
import puppeteer from "puppeteer-core";
import { resolveBrowserExecutable } from "../services/browserLauncher.js";

const ROOT = process.cwd();
const DIR = path.join(ROOT, "tmp", "walkA179home"), SHOTS = path.join(DIR, "shots");
const PORT = 4414, BASE = `http://127.0.0.1:${PORT}`;
const SRC_DB = process.env.WALK_DB || path.join(ROOT, "data", "resume_master.db");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = [];
const say = (walk, ok, what) => { results.push({ walk, ok, what }); console.log(`${ok ? "PASS" : "FAIL"} ${walk}: ${what}`); };
const sample = JSON.parse(fs.readFileSync(path.join(ROOT, "content/trial/sample-a.json"), "utf8"));

fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });
fs.copyFileSync(SRC_DB, path.join(DIR, "resume_master.db"));
const env = { ...process.env, RM_DATA_DIR: DIR, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "walkA179home-secret-not-real",
  APP_BASE_URL: BASE, DRAFT_DEFER_PREVIEW_GENERATION: "1", DRAFT_SCHEMA_READER: "off", MATCH_ALERTS: "off", NETWORK_DIGEST: "off",
  DAILY_REMINDERS: "off", TAXONOMY_BACKFILL: "off", RESEND_API_KEY: "", ANTHROPIC_API_KEY: "", ANTHROPIC_KEY: "",
  DOTENV_CONFIG_PATH: "./.no-dotenv-for-local-harness" };
const server = spawn(process.execPath, ["server.js"], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
let log = "";
server.stdout.on("data", d => { log += d; }); server.stderr.on("data", d => { log += d; });
const stop = () => { try { server.kill(); } catch { /* gone */ } };
process.on("exit", stop);
for (let i = 0; i < 480; i++) { try { if ((await fetch(`${BASE}/api/health/ready`)).ok) break; } catch { /* not yet */ } await sleep(500); }

const resolution = await resolveBrowserExecutable();
const browser = await puppeteer.launch({ executablePath: resolution.path, headless: "new", pipe: true,
  args: ["--no-first-run", "--no-default-browser-check", "--disable-features=HttpsFirstBalancedModeAutoEnable"] });
const page = await (await browser.createBrowserContext()).newPage();
await page.setViewport({ width: 1440, height: 900 });
const api = (url, method = "GET", body = null) => page.evaluate(async (u, m, b) => {
  const r = await fetch(u, { method: m, credentials: "include", headers: { "content-type": "application/json" }, body: b ? JSON.stringify(b) : undefined });
  let j = null; try { j = await r.json(); } catch { j = null; }
  return { status: r.status, body: j };
}, url, method, body);
const shot = (name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) }).catch(() => {});

try {
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  const reg = await api("/api/auth/register", "POST", { username: "walk-home", password: "WalkHome-Passw0rd!", profile: { email: "walk-home@example.invalid", first_name: "Walk", last_name: "Home" } });
  const w = new Database(path.join(DIR, "resume_master.db")); w.pragma("busy_timeout = 5000");
  const uid = w.prepare("SELECT id FROM users WHERE username = 'walk-home'").pluck().get();
  w.prepare("UPDATE users SET test_account = 1 WHERE id = ?").run(uid);
  const up = await api("/api/domain-profiles/from-resume", "POST", { content: sample.resumeText, name: `${sample.candidate.fullName}.txt` });
  say("setup", reg.status < 400 && up.status < 400, `register ${reg.status} · résumé ${up.status}`);

  // ── (4) Run now, in a browser ──────────────────────────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/app/auto-apply`, { waitUntil: "networkidle2", timeout: 90000 });
  const btn = await page.waitForSelector("[data-run-now]", { timeout: 30000 }).catch(() => null);
  const enabled = btn ? await page.evaluate(el => !el.disabled, btn) : false;
  say("Run now is there", !!btn && enabled, `button ${btn ? "shown" : "missing"} · enabled ${enabled}`);
  await shot("4-home-run-now");
  if (btn && enabled) {
    await page.evaluate(() => document.querySelector("[data-run-now]").click());
    const msg = await page.waitForSelector("[data-run-now-msg]", { timeout: 60000 }).then(el => page.evaluate(e => e.textContent.trim(), el)).catch(() => "");
    say("Run now answers with what it did", !!msg && !/couldn't|error|failed/i.test(msg), `"${msg}"`);
    await shot("4-home-run-now-said");
  }

  // ── (5) the runner-down banner ─────────────────────────────────────────────────────────────────────────────────
  const before = await page.evaluate(() => !!document.querySelector("[data-runner-stalled]"));
  const job = w.prepare("SELECT job_id FROM scraped_jobs ORDER BY id DESC LIMIT 1").pluck().get();
  const tenMin = Math.floor(Date.now() / 1000) - 600;
  const run = w.prepare(`INSERT INTO apply_runs (user_id, mode, tool_type, status, total_jobs, created_at, started_at) VALUES (?, 'auto', 'generate', 'running', 1, ?, ?)`).run(uid, tenMin, tenMin).lastInsertRowid;
  w.prepare(`INSERT INTO apply_run_jobs (run_id, user_id, job_id, status, created_at) VALUES (?, ?, ?, 'queued', ?)`).run(run, uid, job, tenMin);
  w.close();
  const health = await api("/api/apply/health");
  say("health says stalled", health.body?.stalled === true, JSON.stringify(health.body));
  await page.reload({ waitUntil: "networkidle2", timeout: 90000 });
  const banner = await page.waitForSelector("[data-runner-stalled]", { timeout: 30000 }).then(el => page.evaluate(e => e.textContent.trim(), el)).catch(() => "");
  say("the banner says so", !before && !!banner, `before: ${before} · now: "${banner}"`);
  await shot("5-home-runner-stalled");
} catch (e) {
  say("harness", false, `threw: ${e.stack?.split("\n").slice(0, 3).join(" | ")}`);
} finally {
  await browser.close().catch(() => {});
  stop();
  fs.writeFileSync(path.join(DIR, "results.json"), JSON.stringify(results, null, 1));
  fs.writeFileSync(path.join(DIR, "server.log"), log);
  console.log(`\n${results.filter(r => r.ok).length} / ${results.length} PASS`);
}
