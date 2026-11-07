#!/usr/bin/env node
// ⭐ D151 RULE 5 · THE PERMANENT SCALE FIXTURE — a realistic draft database at 100k or 500k ACTIVE postings, built from
// SYNTHETIC data only (fictional companies and people, generated descriptions), so it can be built anywhere — this
// laptop or a CI runner — from nothing. No real person's data, no production copy.
//
//   node scripts/scaleFixture.mjs --postings 100000 --users 20 --out tmp/scale-100k
//
// How: (1) boot the real server once on the empty --out directory, so the schema is exactly what every migration makes
// (never a hand-written copy that drifts); (2) register the synthetic users through the real /api/auth/register and make
// one of them an admin; (3) stop the server; (4) write the postings (with their role map), each user's job profile and
// base résumé, and a history of applications, in batched transactions. The server's own boot passes (classify, tag,
// board-fit) then run on first boot of the suite — the same cost production pays.
//
// Prints one JSON line: { out, postings, users, ms, bytes }. Deterministic for a given --seed.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import Database from "better-sqlite3";
import { createAdminAccount, issueSignInLink, consumeSignInLink } from "../services/adminAccounts.js";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const POSTINGS = Number(arg("--postings", 100000));
const USERS = Number(arg("--users", 20));
const OUT = path.resolve(arg("--out", `tmp/scale-${Math.round(POSTINGS / 1000)}k`));
const SEED = Number(arg("--seed", 151));
const PORT = Number(arg("--port", 3990));
const DESC_CHARS = Number(arg("--desc-chars", 4500));   // production's mean is ≈ 4.6 KB (measured 11-07)
export const PASSWORD = "Scale-Fixture-2026!x";
export const ADMIN_EMAIL = "scale-admin@example.com";
if (path.resolve(OUT).startsWith(path.resolve("data"))) { console.error("REFUSING: --out must not be under data/"); process.exit(2); }

// ── a small seeded generator, so a fixture is the same every time ──
let s = SEED >>> 0;
const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];

const FUNCTIONS = [  // [tag_function, role_key, weight, titles, skills]
  ["engineering", "engineering", 38, ["Software Engineer", "Backend Engineer", "Full-stack Engineer", "Frontend Engineer", "Platform Engineer", "Site Reliability Engineer", "Mobile Engineer", "Embedded Engineer"], ["Python", "Go", "TypeScript", "React", "Kubernetes", "PostgreSQL", "AWS", "gRPC", "Rust", "Java"]],
  ["data", "data", 11, ["Data Engineer", "Data Scientist", "Analytics Engineer", "Machine Learning Engineer", "Data Analyst"], ["SQL", "Spark", "dbt", "Airflow", "Python", "PyTorch", "Snowflake", "statistics"]],
  ["product", "pm", 10, ["Product Manager", "Senior Product Manager", "Technical Product Manager", "Group Product Manager"], ["roadmaps", "discovery", "analytics", "experimentation", "stakeholders"]],
  ["sales", "sales", 15, ["Account Executive", "Sales Development Representative", "Customer Success Manager", "Solutions Engineer"], ["pipeline", "Salesforce", "negotiation", "forecasting", "renewals"]],
  ["design", "design", 4, ["Product Designer", "UX Researcher", "Brand Designer"], ["Figma", "prototyping", "user research", "design systems"]],
  ["marketing", "marketing", 4, ["Growth Marketer", "Content Marketing Manager", "Product Marketing Manager"], ["SEO", "lifecycle", "positioning", "campaigns"]],
  ["people", "hr", 3, ["Recruiter", "People Partner", "Talent Acquisition Lead"], ["sourcing", "interviewing", "HRIS", "onboarding"]],
  ["operations", "operations", 4, ["Operations Manager", "Program Manager", "Business Operations Analyst"], ["process", "vendors", "planning", "reporting"]],
  ["finance", "finance", 3, ["Financial Analyst", "Accountant", "FP&A Manager"], ["modelling", "close", "GAAP", "budgeting"]],
  ["legal", "legal", 2, [ "Counsel", "Paralegal", "Privacy Counsel"], ["contracts", "compliance", "privacy", "negotiation"]],
  [null, "general", 6, ["Associate", "Coordinator", "Specialist"], ["communication", "organisation"]],
];
const WEIGHTED = FUNCTIONS.flatMap(f => Array(f[2]).fill(f));
const SOURCES = [["greenhouse", "direct"], ["lever", "direct"], ["ashby", "direct"], ["workday", "account"], ["smartrecruiters", "guest"], ["workable", "guest"], ["bamboohr", "guest"]];
const US_LOCS = ["New York, NY", "San Francisco, CA", "Seattle, WA", "Austin, TX", "Boston, MA", "Chicago, IL", "Denver, CO", "Atlanta, GA", "Remote (US)", "Los Angeles, CA"];
const NON_US = ["London, United Kingdom", "Berlin, Germany", "Toronto, Canada", "Amsterdam, Netherlands", "Bengaluru, India", "Dublin, Ireland"];
const LEVELS = ["entry", "mid", "senior", "lead"];
const WORKPLACE = ["remote", "hybrid", "onsite"];
const A = ["Acme", "Birch", "Cobalt", "Delta", "Ember", "Fable", "Granite", "Harbor", "Iris", "Juniper", "Kestrel", "Lumen", "Maple", "Nimbus", "Orchid", "Pioneer", "Quartz", "Ridge", "Summit", "Tidal"];
const B = ["Labs", "Systems", "Data", "Health", "Robotics", "Analytics", "Cloud", "Works", "Bio", "Logistics", "Finance", "Energy"];
const COMPANIES = Array.from({ length: 3000 }, (_, i) => `${A[i % A.length]} ${B[Math.floor(i / A.length) % B.length]}${i >= A.length * B.length ? ` ${Math.floor(i / (A.length * B.length)) + 1}` : ""}`);
const PARA = ["We are looking for someone who cares about the details and ships work that matters.", "You will work with a small team across product, design and engineering.", "Our customers depend on us every day, so reliability and clear communication come first.", "You will own projects from the first sketch to the final release and measure what changed.", "We offer health cover, a learning budget, flexible hours and parental leave.", "This role reports to the head of the team and works closely with leadership.", "You have shipped production work, written it down clearly, and helped others grow."];

function description(title, company, skills) {
  const parts = [`${company} is hiring a ${title}.`, `About the role: ${pick(PARA)}`, `What you'll use: ${skills.join(", ")}.`];
  while (parts.join("\n\n").length < DESC_CHARS * (0.7 + rnd() * 0.6)) parts.push(`${pick(PARA)} ${pick(PARA)} Experience with ${pick(skills)} and ${pick(skills)} helps.`);
  return parts.join("\n\n").slice(0, 5000);
}

function resumeText(i, fn) {
  return `Synthetic Person ${i}\nscale${i}@example.com\n\nEXPERIENCE\n${fn[3][0]}, ${COMPANIES[i % COMPANIES.length]} (2021 - present)\n- Built and ran ${fn[4].slice(0, 3).join(", ")} work used by thousands of customers.\n- Led a project that cut a key cost by a fifth.\n\nSKILLS\n${fn[4].join(", ")}\n\nEDUCATION\nB.S., State University, 2020\n`;
}

// ── (1) boot once to migrate, (2) register the users ──
async function bootAndRegister() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) if (/^resume_master\.db/.test(f)) fs.rmSync(path.join(OUT, f));
  const env = { ...process.env, RM_DATA_DIR: OUT, PORT: String(PORT), ANTHROPIC_KEY: "", NODE_ENV: "development",
    COOKIE_ENCRYPTION_KEY: crypto.randomBytes(32).toString("hex") };
  const child = spawn(process.execPath, ["server.js"], { env, stdio: ["ignore", "pipe", "pipe"] });
  let log = ""; child.stdout.on("data", d => { log += d; }); child.stderr.on("data", d => { log += d; });
  const base = `http://127.0.0.1:${PORT}`;
  const deadline = Date.now() + 180000;
  for (;;) {
    if (child.exitCode != null) throw new Error(`server exited during the migration boot:\n${log.slice(-2000)}`);
    const ok = await fetch(`${base}/api/health/ready`).then(r => r.status === 200).catch(() => false);
    if (ok) break;
    if (Date.now() > deadline) { child.kill(); throw new Error("the migration boot was not ready in 180 s"); }
    await new Promise(r => setTimeout(r, 500));
  }
  for (let i = 0; i < USERS; i++) {
    const r = await fetch(`${base}/api/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: `scale${i}`, password: PASSWORD, profile: { email: `scale${i}@example.com`, first_name: "Synthetic", last_name: `Person ${i}` } }) });
    if (r.status !== 200) throw new Error(`register scale${i}: ${r.status} ${await r.text()}`);
  }
  child.kill("SIGTERM");
  await new Promise(r => child.once("exit", r));
}

// ── (4) the data ──
function fill() {
  const db = new Database(path.join(OUT, "resume_master.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = OFF");
  const cols = (t) => new Set(db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name));
  const sj = cols("scraped_jobs");
  const want = ["job_id", "search_query", "company", "title", "location", "source", "url", "apply_url", "posted_at", "description", "_hash", "scraped_at",
    "salary_min", "salary_max", "salary_currency", "bucket_role", "direct_apply", "normalized_title", "summary", "experience_level", "workplace_type",
    "salary_min_usd", "salary_max_usd", "salary_period", "skills_json", "discovered_at", "updated_at", "is_active", "fingerprint", "sources_seen",
    "req_uid", "automation_tier", "tag_level", "tag_function", "tag_workplace", "tag_remote", "tag_us"].filter(c => sj.has(c));
  const ins = db.prepare(`INSERT INTO scraped_jobs (${want.join(",")}) VALUES (${want.map(c => "@" + c).join(",")})`);
  const roleIns = db.prepare("INSERT OR IGNORE INTO job_role_map (job_id, role_key, role_family, matched_by) VALUES (?, ?, ?, 'scale_fixture')");
  const now = Math.floor(Date.now() / 1000);
  const BATCH = 5000;
  const batch = db.transaction((from, to) => {
    for (let i = from; i < to; i++) {
      const fn = pick(WEIGHTED), [source, tier] = pick(SOURCES);
      const title = `${rnd() < 0.3 ? "Senior " : ""}${pick(fn[3])}`;
      const company = pick(COMPANIES);
      const us = rnd() < 0.8, location = us ? pick(US_LOCS) : pick(NON_US);
      const skills = [...new Set([pick(fn[4]), pick(fn[4]), pick(fn[4]), pick(fn[4])])];
      const min = 70000 + Math.floor(rnd() * 120) * 1000;
      const age = Math.floor(rnd() * 60 * 86400);
      const jobId = `${source}::scale${i}`;
      const desc = description(title, company, skills);
      const row = { job_id: jobId, search_query: source, company, title, location, source, url: `https://jobs.example.com/${source}/${i}`,
        apply_url: `https://jobs.example.com/${source}/${i}/apply`, posted_at: new Date((now - age) * 1000).toISOString(), description: desc,
        _hash: crypto.createHash("sha1").update(jobId).digest("hex"), scraped_at: now - age, salary_min: min, salary_max: min + 40000,
        salary_currency: "USD", bucket_role: fn[1], direct_apply: 1, normalized_title: title.toLowerCase(), summary: desc.slice(0, 280),
        experience_level: pick(LEVELS), workplace_type: location.startsWith("Remote") ? "remote" : pick(WORKPLACE),
        salary_min_usd: min, salary_max_usd: min + 40000, salary_period: "yearly", skills_json: JSON.stringify(skills),
        discovered_at: now - age, updated_at: now - age, is_active: 1, fingerprint: `${company}|${title}|${location}|${i}`.toLowerCase(),
        sources_seen: JSON.stringify([source]), req_uid: `${source}:${i}`, automation_tier: tier, tag_level: pick(LEVELS),
        tag_function: fn[0], tag_workplace: location.startsWith("Remote") ? "remote" : pick(WORKPLACE), tag_remote: location.startsWith("Remote") ? 1 : 0,
        tag_us: us ? "us" : "non_us" };
      ins.run(Object.fromEntries(want.map(c => [c, row[c] ?? null])));
      roleIns.run(jobId, fn[1], fn[1]);
    }
  });
  for (let f = 0; f < POSTINGS; f += BATCH) batch(f, Math.min(POSTINGS, f + BATCH));

  // Each user: an active job profile, a base résumé, and a history of applications (the tracker's rows).
  const users = db.prepare("SELECT id, username FROM users WHERE username LIKE 'scale%' ORDER BY id").all();
  const dp = cols("domain_profiles");
  const prof = db.prepare(`INSERT INTO domain_profiles (user_id, profile_name, role_family, domain, is_active${dp.has("seniority") ? ", seniority" : ""})
    VALUES (?, ?, ?, ?, 1${dp.has("seniority") ? ", 'mid'" : ""})`);
  const res = db.prepare("INSERT INTO profile_base_resumes (profile_id, user_id, name, content, updated_at) VALUES (?, ?, 'resume.txt', ?, ?)");
  const baseRes = db.prepare("INSERT OR REPLACE INTO base_resume (user_id, name, content, updated_at) VALUES (?, 'resume.txt', ?, ?)");
  const ja = cols("job_applications");
  const appIns = db.prepare(`INSERT OR IGNORE INTO job_applications (user_id, job_id, company, role, job_url, source, location, apply_mode, applied_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', ?)`);
  const someJobs = db.prepare("SELECT job_id, company, title, url, source, location FROM scraped_jobs WHERE rowid % ? = 0 LIMIT 400").all(Math.max(1, Math.floor(POSTINGS / 400)));
  db.transaction(() => {
    users.forEach((u, i) => {
      const fn = FUNCTIONS[i % 6];
      const pid = prof.run(u.id, `${fn[3][0]} profile`, fn[1], fn[0] || "general").lastInsertRowid;
      const text = resumeText(i, fn);
      res.run(pid, u.id, text, now); baseRes.run(u.id, text, now);
      if (ja.has("user_id")) for (let k = 0; k < 40; k++) { const j = someJobs[(i * 40 + k) % someJobs.length]; appIns.run(u.id, j.job_id, j.company, j.title, j.url, j.source, j.location, now - k * 86400); }
    });
  })();
  // An admin is an admin ACCOUNT, never a users row (D95's trigger): made the way production makes one — create, issue
  // a sign-in link, set the password with it — so the suite can sign in for Admin → Testers.
  const admin = createAdminAccount(db, { email: ADMIN_EMAIL, isOwner: true, createdBy: "scale_fixture" });
  if (!consumeSignInLink(db, issueSignInLink(db, admin.id).token, PASSWORD)) throw new Error("the fixture admin's password was not set");
  db.pragma("wal_checkpoint(TRUNCATE)");
  db.close();
  return users.length;
}

const t0 = Date.now();
await bootAndRegister();
const users = fill();
const bytes = fs.statSync(path.join(OUT, "resume_master.db")).size;
console.log(JSON.stringify({ out: OUT, postings: POSTINGS, users, ms: Date.now() - t0, bytes }));
