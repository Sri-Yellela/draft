// scripts/walkSandbox47b.mjs — ⭐ 47b · VIEW RÉSUMÉ'S SANDBOX PAGE, END TO END IN A REAL CHROME (47a left it unwalked: the
// extension's View résumé opens draft's /draft/resume/<job>; the extension half is walked in test-support/walks/resumePanel.mjs).
// A local resume-master serves the embedded editor (RESUME_EDITOR_ORIGIN — its frame-ancestors admit http://127.0.0.1:*), draft
// runs on a FRESH data dir, crawling off, no model key. A SYNTHETIC person: a base résumé, and ONE tailored résumé stored through
// the extension generation's own write (services/generatedResumes.js storeGeneratedResume) with the scorer's tier-1 lists.
// In plain-light and plain-dark × 1440 / 400:
//   /draft/resume/<job> (the address kept, D157 (i)) → the jobs page with THAT résumé open in resume-master's editor (the iframe, its document = the tailored
//   HTML) · "What we changed" docked beside it (open by default) · 47a E4: against the JOB — "1 → 3 of the job's 4 must-haves"
//   and "now shows Kubernetes" / "now shows Terraform"; the base-vs-tailored columns · no page error.
// Shots docs/fidelity-shots/walk47b-sandbox-<theme>-<w>.png.
//   (cd client && npx vite build) && node scripts/walkSandbox47b.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import Database from "better-sqlite3";
import puppeteer from "puppeteer-core";
import { resolveBrowserExecutable } from "../services/browserLauncher.js";
import { storeGeneratedResume } from "../services/generatedResumes.js";
import { recordBaseUpload } from "../services/baseResumeHistory.js";

const ROOT = process.cwd();
const RM_ROOT = path.resolve(ROOT, "..", "resume-master");
const RUN = path.resolve(process.argv[2] || "tmp/walkSandbox47b");
const SHOTS = path.join(ROOT, "docs", "fidelity-shots");
const PORT = 4470, BASE = `http://127.0.0.1:${PORT}`;
const RM_PORT = 4471, RM = `http://127.0.0.1:${RM_PORT}`;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = [];
const say = (name, ok, what) => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${what}`); };
fs.rmSync(RUN, { recursive: true, force: true });
fs.mkdirSync(RUN, { recursive: true });
fs.mkdirSync(SHOTS, { recursive: true });

// ⛔ memory "harness key leak": every model key blanked, no .env read, in BOTH services
const noKeys = { ANTHROPIC_API_KEY: "", ANTHROPIC_KEY: "", DOTENV_CONFIG_PATH: "tmp/no.env" };
const procs = [];
const start = (cwd, env, label) => {
  const p = spawn(process.execPath, ["server.js"], { cwd, env: { ...process.env, ...noKeys, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  p.log = "";
  const keep = (d) => { p.log += d; if (p.log.length > 2e6) p.log = p.log.slice(-1e6); };
  p.stdout.on("data", keep); p.stderr.on("data", keep);
  p.label = label; procs.push(p);
  return p;
};
const kill = () => { for (const p of procs) { try { execFileSync("taskkill", ["/PID", String(p.pid), "/T", "/F"], { stdio: "ignore" }); } catch { /* gone */ } } };
process.on("exit", kill);
const ready = async (p, url) => {
  const t0 = Date.now();
  for (;;) {
    if (p.exitCode != null) throw new Error(`${p.label} exited:\n${p.log.slice(-3000)}`);
    if ((await fetch(url).then(r => r.status).catch(() => 0)) === 200) return Date.now() - t0;
    if (Date.now() - t0 > 300000) throw new Error(`${p.label} not ready:\n${p.log.slice(-3000)}`);
    await sleep(500);
  }
};

const rm = start(RM_ROOT, { PORT: String(RM_PORT), NODE_ENV: "development", RAILWAY_VOLUME_MOUNT_PATH: "", RM_DB_PATH: "" }, "resume-master");
const draft = start(ROOT, { RM_DATA_DIR: RUN, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "walkSandbox47b-not-real",
  COOKIE_ENCRYPTION_KEY: crypto.randomBytes(32).toString("hex"), DRAFT_SCHEMA_READER: "off", MATCH_ALERTS: "off", NETWORK_DIGEST: "off",
  DAILY_REMINDERS: "off", TAXONOMY_BACKFILL: "off", JOB_CRAWL: "off", RESEND_API_KEY: "", RESUME_EDITOR_ORIGIN: RM, RESUME_MASTER_URL: RM }, "draft");

const BASE_RESUME = `Ada Synthetic
Experience
Senior Software Engineer — Northwind Systems
2018 – Present
- Built payment services in Go and PostgreSQL
- Ran on-call for the ledger service and cut pages by 40%
Skills
Go, PostgreSQL, AWS`;
const TAILORED = `<!DOCTYPE html><html><head><style>body{font-family:Georgia,serif;color:#222;padding:32px} .name{font-size:26px;font-weight:700}</style></head><body>
<div class="name">Ada Synthetic</div>
<div class="section-title">EXPERIENCE</div>
<div class="entry"><div>Senior Software Engineer — Northwind Systems</div><div>2018 – Present</div>
<ul class="bullets"><li>Built payment services in Go and PostgreSQL, deployed on Kubernetes</li>
<li>Managed the ledger's infrastructure as code with Terraform</li>
<li>Ran on-call for the ledger service and cut pages by 40%</li></ul></div>
<div class="section-title">SKILLS</div><div>Go, PostgreSQL, Kubernetes, Terraform, AWS</div></body></html>`;
const POSTING = `Senior Backend Engineer at Kestrel Payments

Requirements
- 5+ years of backend experience in Go, Kubernetes, Terraform and Kafka`;
const REPORT = { source: "local_ats_v5", score: 78, scorable: true, tier1_matched: ["Go", "Kubernetes", "Terraform"], tier1_missing: ["Kafka"] };

let browser = null;
try {
  console.log(`resume-master ready in ${await ready(rm, `${RM}/editor/`)} ms; draft ready in ${await ready(draft, `${BASE}/api/health/ready`)} ms`);
  const cfgProbe = await fetch(`${RM}/editor/`).then(r => r.headers.get("content-security-policy") || "");
  say("resume-master's editor admits a 127.0.0.1 parent", /frame-ancestors[^;]*http:\/\/127\.0\.0\.1:\*/.test(cfgProbe), cfgProbe.match(/frame-ancestors[^;]*/)?.[0] || "(no CSP)");

  browser = await puppeteer.launch({ executablePath: (await resolveBrowserExecutable()).path, headless: "new", pipe: true, args: ["--no-first-run", "--no-default-browser-check"] });
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  const reg = await page.evaluate(async () => (await fetch("/api/auth/register", { method: "POST", credentials: "include", headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "synthetic-ada-sandbox", password: "Walk47b-not-a-real-pass!", profile: { email: "ada-sandbox@example.test", first_name: "Ada", last_name: "Synthetic" } }) })).status);
  say("a synthetic person signs up", reg === 200 || reg === 201, String(reg));

  const db = new Database(path.join(RUN, "resume_master.db"));
  const now = Math.floor(Date.now() / 1000);
  const uid = db.prepare(`SELECT id FROM users WHERE username = 'synthetic-ada-sandbox'`).pluck().get();
  db.prepare(`UPDATE domain_profiles SET is_active = 0 WHERE user_id = ?`).run(uid);
  const pid = db.prepare(`INSERT INTO domain_profiles (user_id, profile_name, role_family, domain, is_active, placement_category, placement_subcategory, placement_level, placement_confidence, placed_at)
    VALUES (?, 'Backend engineer', 'engineering', 'software', 1, 'software-engineering', 'swe.backend', 'senior', 0.9, unixepoch())`).run(uid).lastInsertRowid;
  db.prepare(`INSERT INTO profile_base_resumes (profile_id, user_id, name, content, updated_at) VALUES (?, ?, 'ada.txt', ?, unixepoch())`).run(pid, uid, BASE_RESUME);
  const uploadId = recordBaseUpload(db, { userId: uid, profileId: pid, content: BASE_RESUME, name: "ada.txt" });
  const cols = new Set(db.prepare("PRAGMA table_info(scraped_jobs)").all().map(c => c.name));
  const JOB = "walk47b-sandbox-1";
  const row = { job_id: JOB, search_query: "walk", company: "Kestrel Payments", title: "Senior Backend Engineer", location: "Boston, MA",
    url: "https://example.invalid/jobs/s1", apply_url: "https://example.invalid/jobs/s1", _hash: JOB, scraped_at: now, posted_at: new Date().toISOString(),
    direct_apply: 1, is_active: 1, source: "greenhouse", description: POSTING, description_text: POSTING, level_read: "senior", board_category: "engineering" };
  const k = Object.keys(row).filter(x => cols.has(x));
  db.prepare(`INSERT OR REPLACE INTO scraped_jobs (${k.join(",")}) VALUES (${k.map(() => "?").join(",")})`).run(...k.map(x => row[x]));
  const stored = storeGeneratedResume(db, { userId: uid, jobId: JOB, job: { company: "Kestrel Payments", title: "Senior Backend Engineer" }, tool: "a_plus_resume",
    html: TAILORED, atsScore: 78, atsReport: REPORT, baseAtsScore: 52, domainProfileId: pid, baseUploadId: uploadId });
  db.close();
  say("the tailored résumé is stored through the generation's own write", !!stored?.version, JSON.stringify({ version: stored?.version, uploadId }));
  const changes = await page.evaluate(async (j) => (await fetch(`/api/jobs/${encodeURIComponent(j)}/resume-changes`, { credentials: "include" })).json(), JOB);
  say("the server's comparison carries the job side", changes?.againstJob?.asked === 4 && changes.againstJob.before === 1 && changes.againstJob.after === 3,
    JSON.stringify(changes?.againstJob ? { asked: changes.againstJob.asked, before: changes.againstJob.before, after: changes.againstJob.after } : changes));

  for (const theme of ["plain-light", "plain-dark"]) {
    for (const w of [1440, 400]) {
      const tag = `${theme} ${w}`;
      await page.setViewport({ width: w, height: w === 400 ? 860 : 900 });
      await page.evaluate((t) => { try { localStorage.setItem("draft-theme", t); } catch { /* the default */ } }, theme);   // THEME_STORAGE_KEY
      const before = errors.length;
      await page.goto(`${BASE}/draft/resume/${encodeURIComponent(JOB)}`, { waitUntil: "domcontentloaded" });
      const landed = await page.waitForFunction((j) => location.pathname === `/draft/resume/${encodeURIComponent(j)}` && document.querySelector("iframe[src*='/editor/']"), { timeout: 60000 }, JOB).then(() => true).catch(() => false);
      say(`${tag}: /draft/resume/<job> keeps its address (D157 (i)) with resume-master's editor open over the jobs page`, landed, await page.evaluate(() => `${location.pathname} · iframes: ${[...document.querySelectorAll("iframe")].map(f => f.src).join(", ")}`));
      // every frame Chrome holds (the editor is cross-origin — another port — and draws the document in a frame of its own)
      const doc = await (async () => {
        const t0 = Date.now();
        while (Date.now() - t0 < 30000) {
          for (const f of page.frames()) {
            if (!f.url().startsWith(RM) && f !== page.mainFrame() && !f.url().startsWith("about:")) continue;
            // the editor draws the résumé in an open shadow root (resume-master public/editor/editor.js paperHost) — read it there
            const t = await f.evaluate(() => [document.body?.innerText || "", ...[...document.querySelectorAll("*")].filter(x => x.shadowRoot).map(x => x.shadowRoot.textContent || "")].join(" ")).catch(() => "");
            if (/Northwind Systems/.test(t) && /deployed on Kubernetes/.test(t) && /code with Terraform/.test(t) && f !== page.mainFrame()) return `${f.url().slice(0, 40)} · ${t.slice(0, 160)}`;
          }
          await sleep(500);
        }
        return null;
      })();
      say(`${tag}: the editor shows THIS job's tailored résumé`, !!doc, String(doc || "(not shown)").replace(/\s+/g, " ").slice(0, 120));
      const panel = await page.waitForFunction(() => {
        const n = document.querySelector("[data-against-job]");
        if (!n) return false;
        const strip = document.querySelector("[data-against-job-terms]");
        const cols = [...document.querySelectorAll(".rc__colh")].map(e => e.innerText.replace(/\s+/g, " "));
        const r = n.getBoundingClientRect();
        return { num: n.innerText.replace(/\s+/g, " ").trim(), terms: strip ? strip.innerText.replace(/\s+/g, " ").trim() : "", cols, visible: r.width > 0 && r.height > 0,
          inView: r.right <= window.innerWidth + 1 && r.left >= -1 };
      }, { timeout: 30000 }).then(h => h.jsonValue()).catch(() => null);
      say(`${tag}: "What we changed" is docked, against the job: 1 → 3 of 4 must-haves`, /1 → 3\s*of the job's 4 must-haves/.test(panel?.num || ""), JSON.stringify(panel));
      say(`${tag}: …and names what the tailored résumé now shows`, /now shows Kubernetes/.test(panel?.terms || "") && /now shows Terraform/.test(panel?.terms || "") && !/now shows Go\b/.test(panel?.terms || ""), panel?.terms);
      say(`${tag}: …base vs tailored columns`, (panel?.cols || []).length === 2 && /before/.test(panel.cols[0]) && /after/.test(panel.cols[1]), JSON.stringify(panel?.cols));
      say(`${tag}: …laid out inside the window`, panel?.visible === true && panel?.inView === true, JSON.stringify({ visible: panel?.visible, inView: panel?.inView }));
      await page.screenshot({ path: path.join(SHOTS, `walk47b-sandbox-${theme}-${w}.png`) }).catch(() => {});
      say(`${tag}: no page error`, errors.length === before, errors.slice(before).join(" | "));
    }
  }
} catch (e) {
  say("the walk ran", false, e.stack || String(e));
} finally {
  if (browser) await browser.close().catch(() => {});
  kill();
  const failed = results.filter(x => !x).length;
  console.log(failed ? `FAILED — ${failed} of ${results.length}` : `ALL PASS — ${results.length}`);
  process.exit(failed ? 1 : 0);
}
