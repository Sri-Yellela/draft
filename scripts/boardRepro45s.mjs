// scripts/boardRepro45s.mjs — 45s (owner 11-09: "its not matching me any jobs for construction pm … 704 exist"). Boots the
// real server on a THROWAWAY copy of the local database with 40 postings relabelled as Boston construction project
// management (classified proj.construction, senior), signs in a synthetic person with Daniel's résumé (D184 sample H), and
// asks the signed-in board (/api/jobs) the way the client does — then drops one parameter at a time to find what empties it.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import Database from "better-sqlite3";

const DIR = path.join(process.cwd(), "tmp", "boardrepro"), PORT = 4412, BASE = `http://127.0.0.1:${PORT}`;
fs.rmSync(DIR, { recursive: true, force: true }); fs.mkdirSync(DIR, { recursive: true });
fs.copyFileSync("data/resume_master.db", path.join(DIR, "resume_master.db"));
{
  const db = new Database(path.join(DIR, "resume_master.db"));
  const ids = db.prepare(`SELECT job_id FROM scraped_jobs ORDER BY id LIMIT 40`).pluck().all();
  for (const [i, id] of ids.entries()) {
    db.prepare(`UPDATE scraped_jobs SET is_active = 1, retired_at = NULL, scraped_at = unixepoch(), company = ?, title = ?, location = 'Boston, MA',
        description = ? WHERE job_id = ?`).run(i % 2 ? "Suffolk Construction" : "Shawmut Design and Construction",
      i % 3 ? "Senior Project Manager" : "Project Manager, Construction",
      "Manage commercial construction projects: budgets, schedules, subcontractors, RFIs, change orders, Procore. 7+ years.", id);
  }
  db.close();
}
const env = { ...process.env, RM_DATA_DIR: DIR, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "repro-secret",
  DRAFT_SCHEMA_READER: "off", MATCH_ALERTS: "off", NETWORK_DIGEST: "off", DAILY_REMINDERS: "off", RESEND_API_KEY: "", ANTHROPIC_API_KEY: "", ANTHROPIC_KEY: "", DOTENV_CONFIG_PATH: "./.no-dotenv-for-local-harness" };
const server = spawn(process.execPath, ["server.js"], { env, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; server.stdout.on("data", d => { log += d; }); server.stderr.on("data", d => { log += d; });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
for (let i = 0; i < 240; i++) { try { if ((await fetch(`${BASE}/api/health/ready`)).ok) break; } catch {} await sleep(500); }
// the classifier labels them on its own pass; make sure they carry proj.construction / senior for the repro
{
  const db = new Database(path.join(DIR, "resume_master.db"));
  for (const id of db.prepare(`SELECT job_id FROM scraped_jobs WHERE company IN ('Suffolk Construction','Shawmut Design and Construction')`).pluck().all()) {
    db.prepare(`UPDATE scraped_jobs SET board_category = 'management' WHERE job_id = ?`).run(id);
    db.prepare(`DELETE FROM job_role_map WHERE job_id = ?`).run(id);
    db.prepare(`INSERT INTO job_role_map (job_id, role_key, role_family, domain, confidence, matched_by) VALUES (?, 'pm', 'pm', 'pm', 0.9, 'repro')`).run(id);
    db.prepare(`INSERT OR REPLACE INTO job_taxonomy (job_id, category, subcategory, confidence, reason, version, classified_at) VALUES (?, 'project-program-management', 'proj.construction', 0.9, 'repro', '2', unixepoch())`).run(id);
  }
  db.close();
}
let cookie = "";
const call = async (m, p, body) => {
  const r = await fetch(BASE + p, { method: m, headers: { "content-type": "application/json", cookie }, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  let j = null; try { j = await r.json(); } catch {} return { status: r.status, body: j };
};
await call("POST", "/api/auth/register", { username: "repro-daniel", password: "Repro45s-Passw0rd!", profile: { email: "repro@example.invalid", first_name: "Repro", last_name: "Person" } });
const daniel = JSON.parse(fs.readFileSync("content/trial/sample-h.json", "utf8")).resumeText;
const up = await call("POST", "/api/domain-profiles/from-resume", { content: daniel, name: "daniel.pdf" });
const prof = up.body?.profile || {};
console.log("profile:", prof.profile_name, "| domain", prof.domain, "| role_family", prof.role_family, "| placement", prof.placement_category, prof.placement_subcategory, prof.placement_level, "| also", prof.placement_also);
const base = { subcategory: "proj.construction", experience_levels: "senior", places: "metro:boston" };
const variants = [["as the client sends (role · senior · Boston)", base], ["− places", { subcategory: "proj.construction", experience_levels: "senior" }],
  ["− level", { subcategory: "proj.construction", places: "metro:boston" }], ["role only", { subcategory: "proj.construction" }], ["nothing", {}],
  ["role only, curate=off", { subcategory: "proj.construction", curate: "off" }]];
for (const [name, q] of variants) {
  const r = await call("GET", `/api/jobs?${new URLSearchParams({ ...q, page: "1" })}`);
  console.log(`${name.padEnd(44)} → status ${r.status} total ${r.body?.total ?? r.body?.totalJobs ?? "?"} rows ${r.body?.jobs?.length ?? "?"} beingMatched ${JSON.stringify(r.body?.beingMatched ?? r.body?.being_matched ?? null)}${r.body?.error ? " error " + r.body.error : ""}`);
}
for (let t = 0; t < 8; t++) {
  await sleep(10000);
  const r = await call("GET", `/api/jobs?${new URLSearchParams({ ...base, page: "1" })}`);
  console.log(`+${(t + 1) * 10}s  as the client sends → total ${r.body?.total} rows ${r.body?.jobs?.length} beingMatched ${JSON.stringify(r.body?.beingMatched ?? null)}`);
}
console.log(log.split(/\r?\n/).filter(l => /board|match|fit|precompute|score/i.test(l)).slice(-10).join(" || "));
server.kill();
fs.writeFileSync(path.join(DIR, "server.log"), log);
