// scripts/walk46bSalary.mjs — ⭐ A168 (46b) · THE SALARY ANSWER, WALKED IN REAL CHROME (46a b152b94 built it; unit-tested only).
// A FRESH throwaway database (no copy of the real one), the real server booted from this checkout with every key blanked and
// the checkout's .env kept out (draft-harness-key-leak), one synthetic person (walk-sal). The walk:
//   1. signs up, opens Auto settings → Salary in Chrome, picks "A named point on the range" → "Higher end", sets a floor,
//      and reads the fold's live example ("For a posting that says $120,000–$160,000: $150,000 …");
//   2. the saved settings are the server's (GET /api/apply/auto-settings);
//   3. a posting on the board with a stated range ($130,000–$170,000 a year, on Greenhouse) → "Prepare this application"
//      (POST /api/apply/prepare) → the packet's salary answer is the chosen point ($160,000 = 75 % up), and with the slider
//      mode at 20 % it is $138,000; a posting with NO range answers the floor-raised amount or is left for the person ("ask").
// Usage: node scripts/walk46bSalary.mjs
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import Database from "better-sqlite3";
import puppeteer from "puppeteer-core";
import { resolveBrowserExecutable } from "../services/browserLauncher.js";

const ROOT = process.cwd();
const DIR = path.join(ROOT, "tmp", "walk46b"), SHOTS = path.join(DIR, "shots");
const PORT = 4419, BASE = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = [];
const say = (ok, what) => { results.push({ ok, what }); console.log(`${ok ? "PASS" : "FAIL"} a168: ${what}`); };

fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });
const env = { ...process.env, RM_DATA_DIR: DIR, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "walk46b-secret-not-real",
  DRAFT_SCHEMA_READER: "off", MATCH_ALERTS: "off", NETWORK_DIGEST: "off", DAILY_REMINDERS: "off", TAXONOMY_BACKFILL: "off",
  RESEND_API_KEY: "", ANTHROPIC_API_KEY: "", ANTHROPIC_KEY: "", DOTENV_CONFIG_PATH: "./.no-dotenv-for-local-harness" };
const server = spawn(process.execPath, ["server.js"], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
let log = "";
server.stdout.on("data", d => { log += d; }); server.stderr.on("data", d => { log += d; });
const stop = () => { try { server.kill(); } catch { /* gone */ } };
process.on("exit", stop);
let up = false;
for (let i = 0; i < 240 && !up; i++) { try { up = (await fetch(`${BASE}/api/health/ready`)).ok; } catch { /* not yet */ } if (!up) await sleep(500); }
if (!up) { console.log("server never became ready\n" + log.slice(-3000)); process.exit(1); }
const db = new Database(path.join(DIR, "resume_master.db"));

const resolution = await resolveBrowserExecutable();
const browser = await puppeteer.launch({ executablePath: resolution.path, headless: "new", pipe: true, args: ["--no-first-run", "--no-default-browser-check"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const shot = (n) => page.screenshot({ path: path.join(SHOTS, `${n}.png`) }).catch(() => {});
const api = (url, method = "GET", body = null) => page.evaluate(async (u, m, b) => {
  const r = await fetch(u, { method: m, credentials: "include", headers: { "content-type": "application/json" }, body: b ? JSON.stringify(b) : undefined });
  let j = null; try { j = await r.json(); } catch { /* none */ }
  return { status: r.status, body: j };
}, url, method, body);

try {
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  const reg = await api("/api/auth/register", "POST", { username: "walk-sal", password: "walk-sal-password-1",
    profile: { first_name: "Sal", last_name: "Walker", email: "walk-sal@example.test", city: "Boston", state: "MA" } });
  if (reg.status !== 200) throw new Error(`register ${reg.status} ${JSON.stringify(reg.body)}`);
  const userId = db.prepare("SELECT id FROM users WHERE username = 'walk-sal'").pluck().get();

  // ── 1. the fold, in Chrome ─────────────────────────────────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/app/auto-apply`, { waitUntil: "networkidle2" });
  await page.waitForSelector("[data-settings-open]", { timeout: 20000 });
  await page.click("[data-settings-open]");
  await page.waitForSelector("[data-settings-drawer] [data-fold-top=salary]", { timeout: 15000 });
  await page.click("[data-fold-top=salary]");
  await page.waitForSelector("[data-salary-mode=preset] input", { timeout: 5000 });
  await page.click("[data-salary-mode=preset] input");
  await page.waitForSelector("#dh-sal-preset", { timeout: 5000 });
  await page.select("#dh-sal-preset", "higher_end");
  await sleep(300);
  const example = await page.$eval("[data-salary-example]", e => e.textContent.replace(/\s+/g, " ").trim());
  say(/\$150,000/.test(example), `the fold's example for $120k–$160k at "higher end": ${example.slice(0, 110)}`);
  // the floor
  await page.click("#dh-sal-floor", { clickCount: 3 });
  await page.type("#dh-sal-floor", "145000");
  await sleep(300);
  await shot("salary-fold");
  const lineBefore = await page.$eval("[data-fold-top=salary] [data-fold-value]", e => e.textContent.trim());
  // Done → the drawer saves (its own Save, or saves on change — read the server either way)
  await page.click("[data-fold-done=salary]").catch(() => {});
  await sleep(1500);
  const saveBtn = await page.$("[data-settings-save]");
  if (saveBtn) { await saveBtn.click(); await sleep(1500); }
  const saved = (await api("/api/apply/auto-settings")).body;
  const sal = saved?.settings?.salary || saved?.salary || null;
  say(sal?.mode === "preset" && sal?.preset === "higher_end" && sal?.floor === 145000,
    `saved on the server: ${JSON.stringify(sal)} · the fold's line "${lineBefore}"`);

  // ── 3. a posting with a stated range → the packet's answer ───────────────────────────────────────────────────────────
  const addJob = (id, min, max) => {
    db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, company, title, _hash, scraped_at, direct_apply, is_active, url, apply_url,
      salary_min_usd, salary_max_usd, salary_period, location, description)
      VALUES (?, 'walk', 'Walk Rails Co', 'Backend Engineer', ?, unixepoch(), 1, 1, ?, ?, ?, ?, ?, 'Boston, MA', 'Build services.')`)
      .run(id, `h-${id}`, `https://boards.greenhouse.io/walkrails/jobs/${id}`, `https://boards.greenhouse.io/walkrails/jobs/${id}`, min, max, min == null ? null : "annual");
    db.prepare(`INSERT INTO user_jobs (user_id, job_id, visited, applied, starred, created_at, updated_at, disliked, resume_generated)
      VALUES (?, ?, 1, 0, 1, unixepoch(), unixepoch(), 0, 0)`).run(userId, id);
    // The posting's Greenhouse form, known (D185-1's cache) — one salary question, as the ATS publishes it.
    db.prepare(`INSERT INTO posting_application_schemas (job_id, ats, status, fields_json, fetched_at) VALUES (?, 'greenhouse', 'ok', ?, unixepoch())`)
      .run(id, JSON.stringify([{ name: "question_salary", label: "What are your salary expectations?", type: "text", handler_type: "salary", is_required: true, custom: true }]));
  };
  const answerFor = async (id) => {
    const r = await api("/api/apply/prepare", "POST", { url: `https://boards.greenhouse.io/walkrails/jobs/${id}` });
    if (r.status !== 200) return { error: `${r.status} ${JSON.stringify(r.body).slice(0, 160)}` };
    const packet = JSON.parse(db.prepare("SELECT answers_json FROM apply_gate_packets WHERE id = ?").pluck().get(r.body.packetId));
    const a = (packet.answers || []).find(x => x.name === "question_salary" || x.handler_type === "salary");
    return { value: a ? String(a.value ?? "") : null, answer: a || null, unresolved: (packet.unresolved || []).filter(u => /salary/i.test(u.field || "")).length };
  };
  addJob("9100001", 130000, 170000);
  const hi = await answerFor("9100001");
  say(hi.value === "160000", `$130k–$170k, higher end → the packet answers ${JSON.stringify(hi.value ?? hi.error)}`);

  // slider at 20 % (through the server's own settings route — the same validation the drawer uses)
  const put = await api("/api/apply/auto-settings", "PUT", { ...(saved?.settings || saved), salary: { ...sal, mode: "position", position: 20, floor: null, whenNoRange: "ask" } });
  addJob("9100002", 130000, 170000);
  const pos = await answerFor("9100002");
  say(put.status === 200 && pos.value === "138000", `slider 20 % of $130k–$170k → ${JSON.stringify(pos.value ?? pos.error)} (settings PUT ${put.status})`);

  addJob("9100003", null, null);
  const none = await answerFor("9100003");
  say(none.value === "" || none.value == null, `no posted range + "ask me" → left for the person (${JSON.stringify(none.value)}; open salary questions ${none.unresolved})`);
  await shot("after");
} catch (e) {
  say(false, `walk error: ${e.message}`);
  await shot("error");
} finally {
  await browser.close();
  stop();
}
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed} / ${results.length} PASS`);
process.exit(failed ? 1 : 0);
