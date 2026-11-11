// scripts/walkA179local.mjs — ⭐ 46f · A179's LOCAL full-server walk (the log's open "empty profile + base résumé → Draft →
// the run fills from the résumé"): the real server from this checkout on a THROWAWAY copy of data/resume_master.db, keys
// blanked, a synthetic account with an EMPTY profile and a SAMPLE résumé as its base — so the Draft is routed to draft's
// OWN practice form (/try/practice/:jobId, services/sampleResumes.js), never to an employer. Reads what the run REPORTED.
//   node scripts/walkA179local.mjs            → PASS / FAIL lines; tmp/walkA179/server.log, results.json
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import Database from "better-sqlite3";

const ROOT = process.cwd();
const DIR = path.join(ROOT, "tmp", "walkA179");
const PORT = 4413, BASE = `http://127.0.0.1:${PORT}`;
const SRC_DB = process.env.WALK_DB || path.join(ROOT, "data", "resume_master.db");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = [];
const say = (walk, ok, what) => { results.push({ walk, ok, what }); console.log(`${ok ? "PASS" : "FAIL"} ${walk}: ${what}`); };
const sample = JSON.parse(fs.readFileSync(path.join(ROOT, "content/trial/sample-a.json"), "utf8"));

fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });
fs.copyFileSync(SRC_DB, path.join(DIR, "resume_master.db"));
// The local copy's postings are all closed: re-open ONE posting in the copy only (the Draft never reaches it — the practice
// form stands in for it, keyed on the job id).
const pre = new Database(path.join(DIR, "resume_master.db"));
const job = pre.prepare(`SELECT job_id, company, title FROM scraped_jobs WHERE (apply_url LIKE '%greenhouse%' OR url LIKE '%greenhouse%') ORDER BY id DESC LIMIT 1`).get()
  || pre.prepare(`SELECT job_id, company, title FROM scraped_jobs ORDER BY id DESC LIMIT 1`).get();
pre.prepare(`UPDATE scraped_jobs SET is_active = 1, retired_at = NULL, scraped_at = unixepoch() WHERE job_id = ?`).run(job.job_id);
pre.close();

const env = { ...process.env, RM_DATA_DIR: DIR, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "walkA179-secret-not-real",
  APP_BASE_URL: BASE, DRAFT_DEFER_PREVIEW_GENERATION: "1",   // the operator switch: no tools service locally — the résumé waits for approval, the FILL is what is walked
  DRAFT_SCHEMA_READER: "off", MATCH_ALERTS: "off", NETWORK_DIGEST: "off", DAILY_REMINDERS: "off", TAXONOMY_BACKFILL: "off",
  RESEND_API_KEY: "", ANTHROPIC_API_KEY: "", ANTHROPIC_KEY: "", DOTENV_CONFIG_PATH: "./.no-dotenv-for-local-harness" };
const server = spawn(process.execPath, ["server.js"], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
let log = "";
server.stdout.on("data", d => { log += d; }); server.stderr.on("data", d => { log += d; });
const stop = () => { try { server.kill(); } catch { /* gone */ } };
process.on("exit", stop);
for (let i = 0; i < 480; i++) { try { if ((await fetch(`${BASE}/api/health/ready`)).ok) break; } catch { /* not yet */ } await sleep(500); }

let cookie = "";
const call = async (method, p, body) => {
  const r = await fetch(BASE + p, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const set = r.headers.getSetCookie?.() || [];
  if (set.length) cookie = set.map(c => c.split(";")[0]).join("; ");
  let json = null; try { json = await r.json(); } catch { json = null; }
  return { status: r.status, json };
};

try {
  // An account with an EMPTY profile: a username, a password and the email it signs in with — nothing else.
  const reg = await call("POST", "/api/auth/register", { username: "walk-a179", password: "WalkA179-Passw0rd!", profile: { email: "walk-a179@example.invalid", first_name: "Walk", last_name: "Placeholder" } });
  say("setup", reg.status < 400, `register ${reg.status} ${reg.status >= 400 ? JSON.stringify(reg.json) : ""}`);
  // Sign-up needs a name, so the EMPTY profile (A179 F1: a Google sign-in / an old upload) is made in the throwaway copy: the
  // profile row keeps only the email the account signs in with.
  { const w = new Database(path.join(DIR, "resume_master.db")); w.pragma("busy_timeout = 5000");
    w.prepare("UPDATE user_profile SET full_name = NULL, first_name = NULL, last_name = NULL, phone = NULL, linkedin_url = NULL, github_url = NULL, location = NULL, city = NULL, state = NULL, university = NULL, current_job_title = NULL, current_company = NULL WHERE user_id = (SELECT id FROM users WHERE username = ?)").run("walk-a179");
    // D186-6: a fictional sample résumé fills only a TEST account's profile — the walk account is one (in the copy).
    w.prepare("UPDATE users SET test_account = 1 WHERE username = ?").run("walk-a179"); w.close(); }
  const prof = await call("GET", "/api/profile");
  const p = prof.json?.profile || prof.json || {};
  say("empty profile", !p.first_name && !p.last_name && !p.phone, `profile before the résumé: first ${JSON.stringify(p.first_name ?? null)} · last ${JSON.stringify(p.last_name ?? null)} · phone ${JSON.stringify(p.phone ?? null)}`);
  const up = await call("POST", "/api/domain-profiles/from-resume", { content: sample.resumeText, name: `${sample.candidate.fullName}.txt` });
  const base = await call("GET", "/api/base-resume");
  say("sample résumé is the base", up.status < 400 && (base.json?.content || "").length > 100, `from-resume ${up.status} · base ${base.json?.content?.length || 0} chars`);
  const health = await call("GET", "/api/apply/health");
  say("runner", health.status === 200, `health ${JSON.stringify(health.json)}`);

  const run = await call("POST", "/api/apply/runs", { jobIds: [job.job_id], mode: "auto", surface: "walk" });
  say("Draft", run.status < 400, `POST /api/apply/runs ${run.status} ${JSON.stringify(run.json).slice(0, 200)} — ${job.company} · ${job.title}`);
  let row = null, lastLists = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 30_000) {
    const r = await call("GET", "/api/apply/runs");
    lastLists = r.json;
    const all = ["inFlight", "review", "gated", "submitted", "stopped"].flatMap(k => (r.json?.[k] || []).map(x => ({ ...x, _list: k })));
    const mine = all.filter(x => String(x.jobId) === String(job.job_id));
    row = mine.find(x => x._list !== "inFlight") || mine[0] || row;   // (a finished job can still be listed under its run in flight)
    if (row && row._list !== "inFlight") break;
    if (row && !mine.length) break;   // held for approval: it leaves these lists (read below)
    await sleep(3000);
  }
  const events = (() => { const d = new Database(path.join(DIR, "resume_master.db"), { readonly: true }); try { return d.prepare("SELECT event, message FROM apply_job_logs WHERE job_id = ? ORDER BY id").all(job.job_id); } finally { d.close(); } })();
  const practice = events.some(e => e.event === "practice_form");
  console.log("   events:", events.map(e => e.event).join(" → "));
  say("practice form, never the employer", practice, `run log names the practice form: ${practice}`);
  // A run held for approval (held_review / awaiting_approval) is listed as an APPROVAL (GET /api/apply/pending), not in
  // /api/apply/runs' review list (by design: only awaiting_approval rows are approvable) — the walk reads it there.
  const final = (() => { const d = new Database(path.join(DIR, "resume_master.db"), { readonly: true }); try { return d.prepare("SELECT status, reason_code FROM apply_run_jobs WHERE id = ?").get(row?.id); } finally { d.close(); } })();
  const pending = await call("GET", "/api/apply/pending");
  const listed = JSON.stringify(pending.json || {}).includes(String(job.job_id));
  say("held for approval, listed as an approval", final?.status === "held_review" && final?.reason_code === "awaiting_approval" && listed,
    `run job ${row?.id}: ${final?.status} / ${final?.reason_code} · on /api/apply/pending: ${listed}`);

  const detail = row?.id ? await call("GET", `/api/apply/run-jobs/${row.id}/review`) : null;
  const answers = detail?.json?.answers || [];
  const val = (re) => answers.find(a => re.test(String(a?.label || a?.name || a?.field_id || "")) && a?.value)?.value || null;
  const first = val(/first/i), last = val(/last/i), email = val(/e-?mail/i);
  const [cf, ...cl] = String(sample.candidate.fullName).split(" ");
  say("filled from the résumé", answers.filter(a => a?.value).length > 0, `${answers.filter(a => a?.value).length} fields filled`);
  say("name and email are the résumé's", first === cf && (last || "").includes(cl[cl.length - 1]) && !!email,
    `first ${JSON.stringify(first)} (résumé ${cf}) · last ${JSON.stringify(last)} · email ${email ? "filled" : "empty"} · ${answers.length} answers`);
} catch (e) {
  say("harness", false, `threw: ${e.stack?.split("\n").slice(0, 3).join(" | ")}`);
} finally {
  stop();
  fs.writeFileSync(path.join(DIR, "results.json"), JSON.stringify(results, null, 1));
  fs.writeFileSync(path.join(DIR, "server.log"), log);
  console.log(`\n${results.filter(r => r.ok).length} / ${results.length} PASS`);
}
