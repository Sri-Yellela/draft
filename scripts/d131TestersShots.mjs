// scripts/d131TestersShots.mjs — ⭐ D131's proof: Admin → Testers in a real Chrome at 1280 and 390 px, on SYNTHETIC
// testers seeded into a LOCAL server's database (never production). Screenshots to docs/tour-shots/ (untracked).
//   node scripts/d131TestersShots.mjs --db <the running server's resume_master.db> [--base http://localhost:3918]
import fs from "node:fs";
import Database from "better-sqlite3";
import { launchBrowser } from "../services/browserLauncher.js";
import { createAdminAccount, createAdminSession, ADMIN_COOKIE } from "../services/adminAccounts.js";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg("--base", "http://localhost:3918");
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(BASE)) { console.error("REFUSING: --base must be localhost"); process.exit(2); }
const DB = arg("--db", null);
if (!DB) { console.error("--db <path> is required"); process.exit(2); }
const OUT = "docs/tour-shots";
fs.mkdirSync(OUT, { recursive: true });
let failed = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  — ${detail}`}`); if (!ok) failed++; };

// ── synthetic testers (fictional; ids from 90001 so nothing real is touched) ──
const db = new Database(DB);
const now = Math.floor(Date.now() / 1000);
const pick = (a, i) => a[i % a.length];
const STAGE = ["Actively applying", "Student, looking for an internship or first job", "Starting to look in the next few months", "Employed, but open to the right offer"];
const FIELD = ["Software and computing", "Data, ML and AI", "Mechanical or manufacturing engineering", "Business, finance or consulting", "Electrical or electronics engineering"];
const TIME = ["15 to 30 minutes", "30 minutes to 1 hour", "30 minutes to 1 hour", "1 to 2 hours", "Under 15 minutes"];
const WEEK = ["6 to 15 a week", "1 to 5 a week", "16 to 30 a week", "6 to 15 a week"];
const FRUS = ["Applying and hearing nothing back", "Filling out the same application forms again and again", "Applying and hearing nothing back", "Finding jobs I'm actually eligible for (visa, level, location)"];
const PAID = ["No, never", "Yes, under $20 in total", "Yes, $20 to $100", "No, never"];
const TRUST = ["Yes, after I've checked the first few", "Only if I approve every one", "Yes, I'd let it send on its own", "Yes, after I've checked the first few"];
const INT = ["Yes, as soon as I can", "Yes, when I start looking", "Maybe", "Yes, as soon as I can"];
const PAY = ["$10 to $20 a month", "Under $10 a month", "$10 to $20 a month", "$20 to $40 a month", "I'd only use it if it were free"];
const answers = (i) => ({ search_stage: pick(STAGE, i), field: pick(FIELD, i), time_per_app: pick(TIME, i), apps_per_week: pick(WEEK, i),
  find_tool: "LinkedIn or Indeed", paid_before: pick(PAID, i), frustration: pick(FRUS, i), trust_auto: pick(TRUST, i), interested: pick(INT, i), fair_price: pick(PAY, i) });
db.transaction(() => {
  const user = db.prepare("INSERT OR IGNORE INTO users (id, username, password_hash, created_at, trial_at, trial_resume) VALUES (?, ?, 'x', ?, ?, ?)");
  const run = db.prepare("INSERT OR IGNORE INTO apply_runs (id, user_id) VALUES (?, ?)");
  const job = db.prepare("INSERT OR IGNORE INTO apply_run_jobs (run_id, user_id, job_id, status) VALUES (?, ?, ?, 'submitted')");
  const sv = db.prepare("INSERT OR IGNORE INTO trial_surveys (user_id, answers, created_at) VALUES (?, ?, ?)");
  const ev = db.prepare("INSERT INTO trial_events (user_id, event, detail, created_at) VALUES (?, ?, ?, ?)");
  for (let i = 0; i < 12; i++) {
    const id = 90001 + i, t = now - 3600 * (i + 1);
    user.run(id, `d131-shot-${i}`, t, t, i < 11 ? "A" : null);
    if (i < 10) { run.run(id, id); job.run(id, id, `shot-${i}-a`); if (i < 8) job.run(id, id, `shot-${i}-b`); }
    if (i < 7) sv.run(id, JSON.stringify({ ...answers(i), compared: pick(["Much better", "Somewhat better", "About the same"], i), rate_matches: 3 + (i % 3),
      rate_applying: 4 + (i % 2), rate_map: 3 + (i % 2), rate_tracker: 4, most_helpful: pick(["Applying for me", "The job matches"], i),
      ...(i % 2 ? { rate_matches_why: "Show the salary on the card." } : {}), ...(i === 2 ? { must_have: "If it handles Workday I'd pay for it tomorrow." } : {}) }), t + 480 + 60 * i);
    if (i < 6) { ev.run(id, "locked", JSON.stringify({ feature: pick(["Upload my résumé", "Draft a job", "Apply for me"], i) }), t + 900); ev.run(id, "page", "/app/atlas", t + 950); }
  }
  const sa = db.prepare("INSERT OR IGNORE INTO standalone_surveys (name, email, email_key, answers, created_at) VALUES (?, ?, ?, ?, ?)");
  for (let i = 0; i < 9; i++) sa.run(`Shot ${i}`, `shot${i}@example.com`, `shot${i}@example.com`, JSON.stringify({ ...answers(i + 3), idea_useful: 4 + (i % 2),
    idea_most_helpful: "Applications filled out and sent for you", ...(i === 1 ? { must_have: "Show me which companies sponsor before I apply." } : {}) }), now - 1800 * (i + 1));
})();

const admin = createAdminAccount(db, { email: `d131shots${Date.now().toString(36)}@example.com`, createdBy: "d131-shots" });
const token = createAdminSession(db, admin.id, { userAgent: "d131-shots" });
const b = await launchBrowser({ headless: "new" });
try {
  for (const [w, h, name] of [[1280, 900, "1280"], [390, 844, "390"]]) {
    const page = await (await b.createBrowserContext()).newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.setViewport({ width: w, height: h });
    await page.setCookie({ name: ADMIN_COOKIE, value: token, url: BASE });
    await page.goto(`${BASE}/admin?g=people&s=trial`, { waitUntil: "networkidle2" });
    const ok = await page.waitForSelector("[data-admin-testers] [data-testers-headline='people']", { timeout: 20000 }).then(() => true).catch(() => false);
    check(`${name}: the Testers page renders`, ok, errors.join(" | "));
    if (!ok) continue;
    const m = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      cards: document.querySelectorAll("[data-testers-headline]").length,
      funnel: document.querySelectorAll("[data-testers-funnel] > div").length,
      banner: document.querySelector("[data-testers-banner]")?.textContent || "",
      quotes: document.querySelectorAll("[data-testers-quotes] [style*='border-left']").length,
      // what sticks out past the screen, innermost first — names the cause when the page scrolls sideways
      wide: [...document.querySelectorAll("body *")].filter(el => { const r = el.getBoundingClientRect(); return r.width && r.right > document.documentElement.clientWidth + 1; })
        .filter(el => ![...el.children].some(c => c.getBoundingClientRect().right > document.documentElement.clientWidth + 1))
        .slice(0, 6).map(el => `${el.tagName}[${(el.textContent || "").trim().slice(0, 30)}] right=${Math.round(el.getBoundingClientRect().right)}`),
    }));
    check(`${name}: eight headline cards`, m.cards === 8, String(m.cards));
    check(`${name}: five funnel steps`, m.funnel === 5, String(m.funnel));
    check(`${name}: no sideways scroll`, m.overflow <= 0, `${m.overflow}px · ${m.wide.join(" | ")}`);
    check(`${name}: the small-number banner (16 answers < 20)`, /Only \d+ answers so far/.test(m.banner), m.banner);
    check(`${name}: quotes listed`, m.quotes >= 3, String(m.quotes));
    check(`${name}: no page errors`, errors.length === 0, errors.join(" | "));
    await page.screenshot({ path: `${OUT}/d131-testers-${name}.png`, fullPage: true });
  }
} finally {
  await b.close();
}
console.log(failed ? `${failed} FAILED` : "ALL PASS");
process.exit(failed ? 1 : 0);
