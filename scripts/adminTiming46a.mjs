// scripts/adminTiming46a.mjs — A163 (46a, after A162): which Admin GETs hold the event loop at production scale?
// A162 found Admin → Companies scanning scraped_jobs once PER company on the one thread (the whole site froze). This boots
// the real server on a THROWAWAY copy of the 100k-posting database (tmp/a158 → tmp/a163), inflates company_ats_list to
// production's order (COMPANIES, default 3000, named after real companies in the copy so the per-company reads find rows),
// signs in a synthetic legacy admin, and asks each Admin GET the panel fires on load — one at a time, while /api/health is
// probed every 250 ms. A probe's worst wait is how long that GET held the thread (the number that froze production).
// Usage: node scripts/adminTiming46a.mjs [source.db]  · never touches data/ or production.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import Database from "better-sqlite3";

const SRC = process.argv[2] || path.join("tmp", "a158", "resume_master.db");
const DIR = path.join(process.cwd(), "tmp", "a163"), PORT = 4463, BASE = `http://127.0.0.1:${PORT}`;
const COMPANIES = Number(process.env.COMPANIES) || 3000;
fs.rmSync(DIR, { recursive: true, force: true }); fs.mkdirSync(DIR, { recursive: true });
fs.copyFileSync(SRC, path.join(DIR, "resume_master.db"));
{
  const db = new Database(path.join(DIR, "resume_master.db"));
  const have = db.prepare("SELECT COUNT(*) FROM company_ats_list").pluck().get();
  const names = db.prepare("SELECT company, source FROM scraped_jobs WHERE company IS NOT NULL GROUP BY lower(company), source ORDER BY COUNT(*) DESC LIMIT ?").all(COMPANIES);
  const add = db.prepare("INSERT OR IGNORE INTO company_ats_list (company, ats_type, ats_slug, active, created_at, evidence) VALUES (?, ?, ?, 1, unixepoch() - 86400 * 90, 'a163 timing copy')");
  db.transaction(() => { for (const [i, n] of names.entries()) add.run(n.company, n.source, `a163-${i}`); })();
  console.log(`copy: ${db.prepare("SELECT COUNT(*) FROM scraped_jobs").pluck().get()} postings · companies ${have} → ${db.prepare("SELECT COUNT(*) FROM company_ats_list").pluck().get()}`);
  db.close();
}
const env = { ...process.env, RM_DATA_DIR: DIR, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "a163-secret", ADMIN_ACCOUNTS_ENFORCE: "off",
  DISCOVERY_PAUSED: "1", DRAFT_SCHEMA_READER: "off", MATCH_ALERTS: "off", NETWORK_DIGEST: "off", DAILY_REMINDERS: "off", RESEND_API_KEY: "", ANTHROPIC_API_KEY: "" };
const server = spawn(process.execPath, ["server.js"], { env, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; server.stdout.on("data", d => { log += d; }); server.stderr.on("data", d => { log += d; });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let ready = false;
for (let i = 0; i < 600 && !ready; i++) { try { ready = (await fetch(`${BASE}/api/health/ready`)).ok; } catch {} if (!ready) await sleep(500); }
if (!ready) { console.log("never ready\n" + log.slice(-2000)); server.kill(); process.exit(1); }
await sleep(20000);   // let the boot passes (board-fit, tags) settle so they don't count against the first GET
let cookie = "";
const call = async (m, p, body) => {
  const t = performance.now();
  try {
    const r = await fetch(BASE + p, { method: m, headers: { "content-type": "application/json", cookie }, body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(240_000) });
    await r.arrayBuffer();   // the admin cookie is fixed; a response's user-session cookie must not replace it
    return { status: r.status, ms: Math.round(performance.now() - t) };
  } catch (e) { return { status: "timeout", ms: Math.round(performance.now() - t) }; }
};
// D95: an admin is an ADMIN ACCOUNT (its own table and cookie), never a users row — made in the throwaway copy directly.
{
  const { createAdminAccount, createAdminSession, ADMIN_COOKIE } = await import("../services/adminAccounts.js");
  const db = new Database(path.join(DIR, "resume_master.db"));
  const a = createAdminAccount(db, { email: "a163-timing@example.invalid", createdBy: "a163-timing" });
  cookie = `${ADMIN_COOKIE}=${createAdminSession(db, a.id)}`;
  db.close();
}
// The panel's load (production's http log, 11-10 00:14–00:27Z) plus the other admin tabs' first reads.
const PATHS = ["/api/admin/glance", "/api/admin/disk", "/api/admin/users", "/api/admin/domain-profile-requests", "/api/admin/upgrade-requests",
  "/api/admin/companies", "/api/admin/companies/candidates", "/api/admin/company-records", "/api/admin/company-records/health",
  "/api/admin/board-categories", "/api/admin/board-policy", "/api/admin/enrichment/overview", "/api/admin/enrichment/batches",
  "/api/admin/slug-harvest", "/api/admin/crawler", "/api/admin/board/taxonomy", "/api/admin/db/health", "/api/admin/pipeline-health"];
const rows = [];
for (const p of PATHS) {
  let worst = 0, stop = false;
  const probe = (async () => { while (!stop) { const t = performance.now(); try { await fetch(`${BASE}/api/health`); } catch {} worst = Math.max(worst, performance.now() - t); await sleep(250); } })();
  const r = await call("GET", p);
  stop = true; await probe;
  rows.push({ path: p, status: r.status, ms: r.ms, healthWorstMs: Math.round(worst) });
  console.log(`${p.padEnd(40)} ${String(r.status).padEnd(4)} ${String(r.ms).padStart(7)} ms   health worst ${String(Math.round(worst)).padStart(7)} ms`);
  await sleep(1000);
}
fs.writeFileSync(path.join(DIR, "timing.json"), JSON.stringify(rows, null, 1));
server.kill();
