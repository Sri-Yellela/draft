// scripts/walkContextual46x.mjs — ⭐ 46x · THE ATS CARD (the owner's option C, 11-19) in draft's web app, in real Chrome: a SYNTHETIC
// person (a backend résumé, placed swe.backend · senior) and a SYNTHETIC company (Kestrel Payments: a stack read from its own
// postings, an industry) with one posting, on a FRESH data dir, crawling off. Opens the posting, presses its match box, and reads
// the contextual section under the report: two numbers painted by band (no band word), the four parts, What fits, What to do.
// Two themes × 1440 / 400; shots docs/fidelity-shots/walk46x-contextual-*.png.
//   npm --prefix client run build && node scripts/walkContextual46x.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import Database from "better-sqlite3";
import puppeteer from "puppeteer-core";
import { resolveBrowserExecutable } from "../services/browserLauncher.js";

const ROOT = process.cwd();
const RUN = path.resolve(process.argv[2] || "tmp/walkContextual46x");
const SHOTS = path.join(ROOT, "docs", "fidelity-shots");
const PORT = 4452, BASE = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = [];
const say = (name, ok, what) => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${what}`); };
fs.rmSync(RUN, { recursive: true, force: true });
fs.mkdirSync(RUN, { recursive: true });
const env = { ...process.env, RM_DATA_DIR: RUN, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "walkContextual46x-not-real",
  COOKIE_ENCRYPTION_KEY: crypto.randomBytes(32).toString("hex"), DRAFT_SCHEMA_READER: "off", MATCH_ALERTS: "off", NETWORK_DIGEST: "off",
  DAILY_REMINDERS: "off", TAXONOMY_BACKFILL: "off", JOB_CRAWL: "off", RESEND_API_KEY: "", ANTHROPIC_API_KEY: "", ANTHROPIC_KEY: "",
  DOTENV_CONFIG_PATH: "./.no-dotenv-for-walkContextual46x" };
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
const POSTING = `Senior Backend Engineer at Kestrel Payments

What you'll do
- Build payment infrastructure for merchants across the country
- Lead a team of 5 engineers through design reviews
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
    body: JSON.stringify({ username: "synthetic-ada-ctx", password: "Walk46x-not-a-real-pass!", profile: { email: "ada-ctx@example.test", first_name: "Ada", last_name: "Synthetic" } }) })).status);
  say("a synthetic person signs up", reg === 200 || reg === 201, String(reg));

  const db = new Database(path.join(RUN, "resume_master.db"));
  const now = Math.floor(Date.now() / 1000);
  const uid = db.prepare(`SELECT id FROM users WHERE username = 'synthetic-ada-ctx'`).pluck().get();
  try { db.prepare(`UPDATE users SET plan_tier = 'PRO' WHERE id = ?`).run(uid); } catch { /* column */ }
  db.prepare(`UPDATE domain_profiles SET is_active = 0 WHERE user_id = ?`).run(uid);
  const pid = db.prepare(`INSERT INTO domain_profiles (user_id, profile_name, role_family, domain, is_active, placement_category, placement_subcategory, placement_level, placement_confidence, placed_at)
    VALUES (?, 'Backend engineer', 'engineering', 'software', 1, 'software-engineering', 'swe.backend', 'senior', 0.9, unixepoch())`).run(uid).lastInsertRowid;
  db.prepare(`INSERT INTO profile_base_resumes (profile_id, user_id, name, content, updated_at) VALUES (?, ?, 'ada.txt', ?, unixepoch())`).run(pid, uid, RESUME);
  const cols = new Set(db.prepare("PRAGMA table_info(scraped_jobs)").all().map(c => c.name));
  const JOB = "walk46x-ctx-1";
  const row = { job_id: JOB, search_query: "walk", company: "Kestrel Payments", title: "Senior Backend Engineer", location: "Boston, MA",
    url: "https://example.invalid/jobs/ctx1", _hash: JOB, scraped_at: now, posted_at: new Date().toISOString(), direct_apply: 1, is_active: 1,
    source: "greenhouse", description: POSTING, description_text: POSTING, level_read: "senior", board_category: "engineering",
    skills_json: JSON.stringify(["Go", "Kafka", "PostgreSQL", "Terraform", "AWS", "Docker", "Kubernetes", "gRPC"].map(skill => ({ skill, type: "hard" }))) };
  const keys = Object.keys(row).filter(k => cols.has(k));
  db.prepare(`INSERT OR REPLACE INTO scraped_jobs (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`).run(...keys.map(k => row[k]));
  const co = db.prepare(`INSERT INTO companies (slug, name) VALUES ('kestrel-payments', 'Kestrel Payments')`).run().lastInsertRowid;
  db.prepare(`INSERT INTO company_aliases (alias_key, company_id, evidence) VALUES ('name:kestrelpayments', ?, 'walk')`).run(co);
  db.prepare(`INSERT INTO job_company (job_id, company_id) VALUES (?, ?)`).run(JOB, co);
  db.prepare(`INSERT INTO job_taxonomy (job_id, category, subcategory, confidence, reason, version, classified_at) VALUES (?, 'software-engineering', 'swe.backend', 0.9, 'walk', '1', ?)`).run(JOB, now);
  // the stack's evidence: 22 postings of theirs (retired copies of the one above, inside the 180-day window)
  for (let i = 0; i < 21; i++) {
    const r2 = { ...row, job_id: `walk46x-ctx-old-${i}`, _hash: `walk46x-ctx-old-${i}`, is_active: 0, url: `https://example.invalid/jobs/old${i}` };
    if (cols.has("retired_at")) r2.retired_at = now - 86400 * 10;
    if (cols.has("discovered_at")) r2.discovered_at = now - 86400 * 20;
    const k2 = Object.keys(r2).filter(k => cols.has(k));
    db.prepare(`INSERT OR REPLACE INTO scraped_jobs (${k2.join(",")}) VALUES (${k2.map(() => "?").join(",")})`).run(...k2.map(k => r2[k]));
    db.prepare(`INSERT INTO job_company (job_id, company_id) VALUES (?, ?)`).run(r2.job_id, co);
  }
  const tech = db.prepare(`INSERT INTO company_tech (company_id, tech, grp, postings, first_seen, last_seen, teams_json, computed_at) VALUES (?, ?, ?, ?, ?, ?, '[]', ?)`);
  for (const [t, g, n] of [["Apache Kafka", "data", 14], ["Go", "languages", 12], ["Terraform", "devops", 9], ["Prefect", "data", 6]]) tech.run(co, t, g, n, now - 86400 * 200, now, now);
  try { db.prepare(`INSERT INTO company_facts (company_id, industry, status, fetched_at) VALUES (?, 'healthcare', 'ok', ?)`).run(co, now); } catch { /* table */ }
  db.close();

  const api = await page.evaluate(async (id) => (await fetch(`/api/jobs/${id}/contextual`, { credentials: "include" })).json(), JOB);
  say("GET /api/jobs/:id/contextual answers the block", typeof api?.contextual?.score === "number", JSON.stringify({ score: api?.contextual?.score, skill: api?.score }));

  for (const theme of ["plain-light", "dusk-dark"]) {
    await page.evaluateOnNewDocument((t) => { try { localStorage.setItem("draft-theme", t); } catch { /* blocked */ } }, theme);
    for (const [w, h] of [[1440, 1000], [400, 900]]) {
      const tag = `${theme} ${w}`;
      await page.setViewport({ width: w, height: h });
      errors.length = 0;
      await page.goto(`${BASE}/app/jobs?job=${encodeURIComponent(JOB)}`, { waitUntil: "networkidle2", timeout: 120000 });
      const box = await page.waitForSelector("button[data-ats-box]", { timeout: 45000 }).catch(() => null);
      if (!box) { say(`${tag}: the posting's match box`, false, "not found"); await page.screenshot({ path: path.join(SHOTS, `walk46x-contextual-${theme}-${w}-nobox.png`) }); continue; }
      await box.evaluate(b => b.scrollIntoView({ block: "center" }));
      await box.click();
      const sec = await page.waitForSelector("[data-ats-card-part='tech_stack']", { timeout: 45000 }).then(() => page.$("[data-ats-card]")).catch(() => null);
      if (!sec) { say(`${tag}: the ATS card`, false, "not drawn"); await page.screenshot({ path: path.join(SHOTS, `walk46x-atscard-${theme}-${w}-none.png`) }); continue; }
      const r = await page.evaluate(() => {
        const s = document.querySelector("[data-ats-card]");
        const n = s.querySelector("[data-ats-card-score]");
        const panel = document.querySelector("[data-posting-match-panel]");
        return { text: s.innerText, num: n?.textContent, color: n ? getComputedStyle(n).color : null, body: getComputedStyle(s).color,
          parts: [...s.querySelectorAll("[data-ats-card-part]")].map(p => [p.dataset.atsCardPart, p.innerText.replace(/\s+/g, " ")]),
          gain: s.querySelector("[data-ats-card-gain]")?.innerText || "", panel: panel?.innerText || "",
          claims: !!document.querySelector("draft-ats-report, [data-claim-chip], [data-skill-check]"),
          facts: [...s.querySelectorAll("[data-ats-card-facts]")].map(f => [f.dataset.atsCardFacts, f.innerText]),
          w: Math.round(s.getBoundingClientRect().width), side: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      say(`${tag}: the number, painted by its band`, /^\d+%$/.test(r.num || "") && r.color !== r.body, `${r.num} · ${r.color}`);
      say(`${tag}: no band word, no claims, no quick check, no old report`, !/(Strong|Moderate|Weak)|true of me|You could claim|claimed by you/i.test(r.panel) && !r.claims, "none");
      say(`${tag}: the four parts, one line each`, r.parts.map(x => x[0]).join() === "skill_match,role_fit,responsibility_overlap,tech_stack", r.parts.map(x => x[1]).join(" | ").slice(0, 300));
      // ⭐ 46z (owner 11-20): each part states its figures, and the card one row
      say(`${tag}: the figures — every part and the card`, ['card', 'skill_match', 'role_fit', 'responsibility_overlap', 'tech_stack'].every(k => r.facts.some(f => f[0] === k && f[1].trim())) && r.facts.some(f => f[0] === 'tech_stack' && /% of their jobs/.test(f[1])), r.facts.map(f => `${f[0]}: ${f[1]}`).join(' | ').slice(0, 400));
      say(`${tag}: the biggest gain`, /Biggest gain: Terraform — in 41% of their jobs/.test(r.gain), r.gain);
      const plaus = await page.waitForSelector("[data-plausibility]", { timeout: 20000 }).then(() => page.evaluate(() => document.querySelector("[data-plausibility]").innerText)).catch(() => "");
      say(`${tag}: does it add up — Salesforce at Kestrel flagged, with a Dismiss`, /You list Salesforce at Kestrel Payments/.test(plaus) && /Dismiss/.test(plaus), plaus.replace(/\s+/g, " ").slice(0, 160));
      say(`${tag}: fits, no side-scroll, no page errors`, r.w > 0 && r.w <= w && !r.side && errors.length === 0, `${r.w}px · ${errors.slice(0, 2).join(" | ") || "no errors"}`);
      await sec.evaluate(s => s.scrollIntoView({ block: "start" }));
      await sleep(200);
      const card = await page.$("[data-posting-match-panel]");
      await card.screenshot({ path: path.join(SHOTS, `walk46x-atscard-${theme}-${w}.png`) });
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
