// scripts/walkDismiss46y.mjs — ⭐ 46y · D192 (4d) "DOES THIS ADD UP?" — the DISMISS, clicked in real Chrome (46x left it covered
// by the service test only). The fixture is walkContextual46x's: a SYNTHETIC person (a backend résumé with a "Salesforce at
// Kestrel Payments" bullet) and a SYNTHETIC company (Kestrel Payments, a stack read from its own postings) on a FRESH data dir,
// crawling off — plus ONE application held for approval whose TAILORED résumé carries a different Salesforce bullet, so the
// two places each have a flag of their own (a key is kind · employer · bullet · tech).
// In each of plain-light / dusk-dark × 1440 / 400:
//   (1) the posting's ATS card: the flag is there → click Dismiss → it goes → the base résumé changes (a re-score: the check
//       runs again on the new text) and the page reloads → the flag stays gone; the held review's own flag is untouched.
//   (2) Home's held review (the row's Résumé pane): the tailored résumé's flag → Dismiss → gone → reload → still gone.
// Between combinations the dismissals are undone through the route's own `undo: true`, so every combination clicks.
// Shots docs/fidelity-shots/walk46y-dismiss-{card,held}-<theme>-<w>-{before,after}.png.
//   (cd client && npx vite build) && node scripts/walkDismiss46y.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import Database from "better-sqlite3";
import puppeteer from "puppeteer-core";
import { resolveBrowserExecutable } from "../services/browserLauncher.js";

const ROOT = process.cwd();
const RUN = path.resolve(process.argv[2] || "tmp/walkDismiss46y");
const SHOTS = path.join(ROOT, "docs", "fidelity-shots");
const PORT = 4453, BASE = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = [];
const say = (name, ok, what) => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${what}`); };
fs.rmSync(RUN, { recursive: true, force: true });
fs.mkdirSync(RUN, { recursive: true });
fs.mkdirSync(SHOTS, { recursive: true });
const env = { ...process.env, RM_DATA_DIR: RUN, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "walkDismiss46y-not-real",
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
Senior Software Engineer, Backend — Northwind Systems
- Built payment infrastructure for merchants in fintech on Kafka and PostgreSQL
- Ran on-call for the ledger service and cut pages by 40%
- Built data pipelines on Airflow
Software Engineer — Kestrel Payments
2016 – 2018
- Integrated Salesforce for the revenue team
Skills
Go, Kafka, PostgreSQL, Airflow, Docker, AWS`;
// the re-score: the same résumé with one more skill — the check runs again on new text; the dismissed bullet is unchanged
const RESUME_2 = RESUME.replace("Docker, AWS", "Docker, AWS, Terraform");
// the tailored résumé the held application would send: a DIFFERENT Salesforce bullet at Kestrel (its own flag key)
const TAILORED = `<div class="section-title">EXPERIENCE</div>
<div class="entry"><div>Senior Software Engineer, Backend — Northwind Systems</div><div>2018 – Present</div>
<ul class="bullets"><li>Built payment infrastructure for merchants on Kafka and PostgreSQL</li></ul></div>
<div class="entry"><div>Software Engineer — Kestrel Payments</div><div>2016 – 2018</div>
<ul class="bullets"><li>Built Salesforce dashboards for the merchant success team</li></ul></div>`;
const POSTING = `Senior Backend Engineer at Kestrel Payments

What you'll do
- Build payment infrastructure for merchants across the country
- Own on-call for the ledger service

Requirements
- 5+ years of backend experience in Go, Kafka, PostgreSQL, Terraform and AWS`;

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
    body: JSON.stringify({ username: "synthetic-ada-dismiss", password: "Walk46y-not-a-real-pass!", profile: { email: "ada-dismiss@example.test", first_name: "Ada", last_name: "Synthetic" } }) })).status);
  say("a synthetic person signs up", reg === 200 || reg === 201, String(reg));

  const dbPath = path.join(RUN, "resume_master.db");
  const db = new Database(dbPath);
  const now = Math.floor(Date.now() / 1000);
  const uid = db.prepare(`SELECT id FROM users WHERE username = 'synthetic-ada-dismiss'`).pluck().get();
  try { db.prepare(`UPDATE users SET plan_tier = 'PRO' WHERE id = ?`).run(uid); } catch { /* column */ }
  db.prepare(`UPDATE domain_profiles SET is_active = 0 WHERE user_id = ?`).run(uid);
  const pid = db.prepare(`INSERT INTO domain_profiles (user_id, profile_name, role_family, domain, is_active, placement_category, placement_subcategory, placement_level, placement_confidence, placed_at)
    VALUES (?, 'Backend engineer', 'engineering', 'software', 1, 'software-engineering', 'swe.backend', 'senior', 0.9, unixepoch())`).run(uid).lastInsertRowid;
  db.prepare(`INSERT INTO profile_base_resumes (profile_id, user_id, name, content, updated_at) VALUES (?, ?, 'ada.txt', ?, unixepoch())`).run(pid, uid, RESUME);
  const cols = new Set(db.prepare("PRAGMA table_info(scraped_jobs)").all().map(c => c.name));
  const JOB = "walk46y-dismiss-1";
  const row = { job_id: JOB, search_query: "walk", company: "Kestrel Payments", title: "Senior Backend Engineer", location: "Boston, MA",
    url: "https://example.invalid/jobs/d1", apply_url: "https://example.invalid/jobs/d1", _hash: JOB, scraped_at: now, posted_at: new Date().toISOString(),
    direct_apply: 1, is_active: 1, source: "greenhouse", description: POSTING, description_text: POSTING, level_read: "senior", board_category: "engineering",
    skills_json: JSON.stringify(["Go", "Kafka", "PostgreSQL", "Terraform", "AWS"].map(skill => ({ skill, type: "hard" }))) };
  const ins = (r) => { const k = Object.keys(r).filter(x => cols.has(x)); db.prepare(`INSERT OR REPLACE INTO scraped_jobs (${k.join(",")}) VALUES (${k.map(() => "?").join(",")})`).run(...k.map(x => r[x])); };
  ins(row);
  const co = db.prepare(`INSERT INTO companies (slug, name) VALUES ('kestrel-payments', 'Kestrel Payments')`).run().lastInsertRowid;
  db.prepare(`INSERT INTO company_aliases (alias_key, company_id, evidence) VALUES ('name:kestrelpayments', ?, 'walk')`).run(co);
  db.prepare(`INSERT INTO job_company (job_id, company_id) VALUES (?, ?)`).run(JOB, co);
  db.prepare(`INSERT INTO job_taxonomy (job_id, category, subcategory, confidence, reason, version, classified_at) VALUES (?, 'software-engineering', 'swe.backend', 0.9, 'walk', '1', ?)`).run(JOB, now);
  for (let i = 0; i < 21; i++) {
    const r2 = { ...row, job_id: `walk46y-dismiss-old-${i}`, _hash: `walk46y-dismiss-old-${i}`, is_active: 0, url: `https://example.invalid/jobs/dold${i}` };
    if (cols.has("retired_at")) r2.retired_at = now - 86400 * 10;
    if (cols.has("discovered_at")) r2.discovered_at = now - 86400 * 20;
    ins(r2);
    db.prepare(`INSERT INTO job_company (job_id, company_id) VALUES (?, ?)`).run(r2.job_id, co);
  }
  const tech = db.prepare(`INSERT INTO company_tech (company_id, tech, grp, postings, first_seen, last_seen, teams_json, computed_at) VALUES (?, ?, ?, ?, ?, ?, '[]', ?)`);
  for (const [t, g, n] of [["Apache Kafka", "data", 14], ["Go", "languages", 12], ["Terraform", "devops", 9], ["Prefect", "data", 6]]) tech.run(co, t, g, n, now - 86400 * 200, now, now);
  try { db.prepare(`INSERT INTO company_facts (company_id, industry, status, fetched_at) VALUES (?, 'healthcare', 'ok', ?)`).run(co, now); } catch { /* table */ }
  // ONE application held for approval, its tailored résumé made (the held review's résumé pane checks THAT résumé)
  const rid = db.prepare(`INSERT INTO resumes (user_id, job_id, company, role, ats_score, html) VALUES (?, ?, 'Kestrel Payments', 'Senior Backend Engineer', 74, ?)`).run(uid, JOB, TAILORED).lastInsertRowid;
  const run = db.prepare(`INSERT INTO apply_runs (user_id, mode, approval_mode, status, total_jobs) VALUES (?, 'auto', 'required', 'completed', 1)`).run(uid).lastInsertRowid;
  db.prepare(`INSERT INTO apply_run_jobs (run_id, user_id, job_id, status, reason_code, answers_json, resume_artifact_id, resume_ats_score)
    VALUES (?, ?, ?, 'held_review', 'awaiting_approval', '[{"name":"email","label":"Email","value":"ada-dismiss@example.test","provenance":"field_map_exact","confidence":0.9}]', ?, 74)`).run(run, uid, JOB, rid);
  db.close();
  const setBase = (text) => { const d = new Database(dbPath); d.prepare(`UPDATE profile_base_resumes SET content = ?, updated_at = unixepoch() WHERE profile_id = ?`).run(text, pid); d.close(); };

  const apiGet = (u) => page.evaluate(async (x) => { const r = await fetch(x, { credentials: "include" }); return r.ok ? r.json() : { status: r.status }; }, u);
  const flagsOf = (r) => (r?.entries || []).flatMap(e => e.flags || []);
  const base0 = await apiGet("/api/resume/plausibility");
  const held0 = await apiGet(`/api/resumes/${rid}/plausibility`);
  const baseKey = flagsOf(base0).find(f => /Salesforce/.test(f.reason || ""))?.key;
  const heldKey = flagsOf(held0).find(f => /Salesforce/.test(f.reason || ""))?.key;
  say("the two résumés each have their own Salesforce flag", !!baseKey && !!heldKey && baseKey !== heldKey, `${baseKey} ≠ ${heldKey}`);
  const undo = (key) => page.evaluate(async (k) => (await fetch("/api/resume/plausibility/dismiss", { method: "POST", credentials: "include",
    headers: { "content-type": "application/json" }, body: JSON.stringify({ key: k, undo: true }) })).status, key);
  const flagText = () => page.evaluate(() => [...document.querySelectorAll("[data-plausibility]")].map(s => s.innerText).join("\n"));
  const clickDismiss = (scope, re) => page.evaluate((sc, src) => {
    const b = [...document.querySelectorAll(`${sc} [data-plausibility] button`)].find(x => new RegExp(src).test(x.closest("[data-plausibility-flag]")?.innerText || ""));
    if (b) b.click();
    return !!b;
  }, scope, re.source);

  for (const theme of ["plain-light", "dusk-dark"]) {
    await page.evaluateOnNewDocument((t) => { try { localStorage.setItem("draft-theme", t); } catch { /* blocked */ } }, theme);
    for (const [w, h] of [[1440, 1000], [400, 900]]) {
      const tag = `${theme} ${w}`;
      await page.setViewport({ width: w, height: h });
      await undo(baseKey); await undo(heldKey);
      setBase(RESUME);
      errors.length = 0;

      // ── (1) the posting's ATS card
      const openCard = async () => {
        await page.goto(`${BASE}/app/jobs?job=${encodeURIComponent(JOB)}`, { waitUntil: "networkidle2", timeout: 120000 });
        const box = await page.waitForSelector("button[data-ats-box]", { timeout: 45000 }).catch(() => null);
        if (!box) return false;
        await box.evaluate(b => b.scrollIntoView({ block: "center" }));
        await box.click();
        return !!(await page.waitForSelector("[data-ats-card-part='tech_stack']", { timeout: 45000 }).catch(() => null));
      };
      if (!await openCard()) { say(`${tag}: the ATS card`, false, "not drawn"); await page.screenshot({ path: path.join(SHOTS, `walk46y-dismiss-card-${theme}-${w}-none.png`) }); continue; }
      const cardFlag = /Integrated Salesforce for the revenue team/;
      await page.waitForSelector("[data-plausibility]", { timeout: 20000 }).catch(() => null);
      const before = await flagText();
      say(`${tag}: card — the flag is there before Dismiss`, cardFlag.test(before), before.replace(/\s+/g, " ").slice(0, 140));
      await (await page.$("[data-plausibility]"))?.evaluate(s => s.scrollIntoView({ block: "center" }));
      await sleep(250);
      await (await page.$("[data-posting-match-panel]"))?.screenshot({ path: path.join(SHOTS, `walk46y-dismiss-card-${theme}-${w}-before.png`) });
      const clicked = await clickDismiss("[data-posting-match-panel]", /Integrated Salesforce/);
      await sleep(800);
      say(`${tag}: card — gone on Dismiss`, clicked && !cardFlag.test(await flagText()), clicked ? "clicked" : "no Dismiss button");
      const base1 = await apiGet("/api/resume/plausibility");
      say(`${tag}: card — the server kept the dismissal`, !flagsOf(base1).some(f => f.key === baseKey), `dismissed ${JSON.stringify(base1.dismissed)}`);
      // the re-score: the base résumé changes, the page reloads, the check runs again on the new text
      setBase(RESUME_2);
      if (!await openCard()) { say(`${tag}: the ATS card after the re-score`, false, "not drawn"); continue; }
      await sleep(2500);
      const after = await flagText();
      say(`${tag}: card — still gone after the re-score`, !cardFlag.test(after), after.replace(/\s+/g, " ").slice(0, 140) || "no flags drawn");
      await (await page.$("[data-posting-match-panel]"))?.evaluate(p => p.scrollIntoView({ block: "start" }));
      await sleep(250);
      await (await page.$("[data-posting-match-panel]"))?.screenshot({ path: path.join(SHOTS, `walk46y-dismiss-card-${theme}-${w}-after.png`) });
      const heldStill = await apiGet(`/api/resumes/${rid}/plausibility`);
      say(`${tag}: card — the held résumé's own flag untouched`, flagsOf(heldStill).some(f => f.key === heldKey), "per key");

      // ── (2) Home's held review — the row's Résumé pane
      const heldFlag = /Built Salesforce dashboards/;
      const openHeld = async () => {
        await page.goto(`${BASE}/app/auto-apply`, { waitUntil: "networkidle2", timeout: 120000 });
        const ok = await page.waitForFunction(() => [...document.querySelectorAll("[data-tracker-table] tr.trk-row")].some(x => /Kestrel/.test(x.innerText)), { timeout: 45000 }).catch(() => null);
        if (!ok) return false;
        await page.evaluate(() => { const r = [...document.querySelectorAll("[data-tracker-table] tr.trk-row")].find(x => /Kestrel/.test(x.innerText)); r.scrollIntoView({ block: "center" }); r.click(); });
        const pane = await page.waitForSelector("[data-row-open] [data-pane='resume']", { timeout: 20000 }).catch(() => null);
        if (!pane) return false;
        await pane.click();
        return !!(await page.waitForSelector("[data-pane-body='resume']", { timeout: 20000 }).catch(() => null));
      };
      if (!await openHeld()) { say(`${tag}: Home's held row's résumé pane`, false, "not reached"); await page.screenshot({ path: path.join(SHOTS, `walk46y-dismiss-held-${theme}-${w}-none.png`) }); continue; }
      await page.waitForSelector("[data-pane-body='resume'] [data-plausibility]", { timeout: 20000 }).catch(() => null);
      const hBefore = await flagText();
      say(`${tag}: held — the tailored résumé's flag is there before Dismiss`, heldFlag.test(hBefore), hBefore.replace(/\s+/g, " ").slice(0, 140));
      await (await page.$("[data-pane-body='resume'] [data-plausibility]"))?.evaluate(s => s.scrollIntoView({ block: "center" }));
      await sleep(250);
      await (await page.$("[data-row-open]"))?.screenshot({ path: path.join(SHOTS, `walk46y-dismiss-held-${theme}-${w}-before.png`) });
      const hClicked = await clickDismiss("[data-pane-body='resume']", /Salesforce dashboards/);
      await sleep(800);
      say(`${tag}: held — gone on Dismiss`, hClicked && !heldFlag.test(await flagText()), hClicked ? "clicked" : "no Dismiss button");
      if (!await openHeld()) { say(`${tag}: Home's held row after the reload`, false, "not reached"); continue; }
      await sleep(2500);
      const hAfter = await flagText();
      say(`${tag}: held — still gone after the reload (the check re-run)`, !heldFlag.test(hAfter), hAfter.replace(/\s+/g, " ").slice(0, 140) || "no flags drawn");
      await (await page.$("[data-row-open]"))?.screenshot({ path: path.join(SHOTS, `walk46y-dismiss-held-${theme}-${w}-after.png`) });
      const side = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      say(`${tag}: no side-scroll, no page errors`, !side && errors.length === 0, errors.slice(0, 2).join(" | ") || "no errors");
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
