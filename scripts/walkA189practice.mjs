// scripts/walkA189practice.mjs — ⭐ 46j · A189's practice-form ACCEPTANCE in real Chrome (the log's NEXT (agent): "answer a held
// question → the job unblocks → Approve → Sent"). The real server from this checkout on a THROWAWAY copy of
// data/resume_master.db, keys blanked, a synthetic TEST account whose base résumé is a SAMPLE (a fictional person) — so every
// Draft is routed to draft's OWN practice form (/try/practice/:jobId, services/sampleResumes.js), never to an employer.
// ⛔ Nothing here reaches a real employer form; nothing answers a bot check.
//
//   Draft → held for approval (the practice form filled by the server's headless Chrome)
//   → every held question answered (POST /api/apply/answers, retryJobIds) → the re-run holds with NO open question
//   → Approve (POST /api/apply/approve) → the approved run re-fills from the stored payload and presses Submit
//   → Sent: the run-job `submitted`, submit_verified = 1, a practice_submissions row, the submit_attempt / submit_pressed marks.
//
// No tools service locally, so the approved run's résumé is a stored artifact for the job (CASE A) written into the copy —
// the walk is about the hold → answer → approve → send path, not about generation.
//   node scripts/walkA189practice.mjs   → PASS / FAIL lines; tmp/walkA189/server.log, results.json; exit 1 on any FAIL
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import Database from "better-sqlite3";

const ROOT = process.cwd();
const DIR = path.join(ROOT, "tmp", "walkA189");
const PORT = Number(process.env.WALK_PORT || 4419), BASE = `http://127.0.0.1:${PORT}`;
const candidates = [process.env.WALK_DB, path.join(ROOT, "data", "resume_master.db"), path.resolve(ROOT, "..", "..", "..", "data", "resume_master.db")].filter(Boolean);
const SRC_DB = candidates.find(p => fs.existsSync(p));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = [];
const say = (walk, ok, what) => { results.push({ walk, ok, what }); console.log(`${ok ? "PASS" : "FAIL"} ${walk}: ${what}`); };
const sample = JSON.parse(fs.readFileSync(path.join(ROOT, "content/trial/sample-a.json"), "utf8"));
if (!SRC_DB) { console.log("FAIL setup: no data/resume_master.db to copy (set WALK_DB)"); process.exit(1); }

fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });
fs.copyFileSync(SRC_DB, path.join(DIR, "resume_master.db"));
const DB = path.join(DIR, "resume_master.db");
const pre = new Database(DB);
const job = pre.prepare(`SELECT job_id, company, title FROM scraped_jobs WHERE (apply_url LIKE '%greenhouse%' OR url LIKE '%greenhouse%') ORDER BY id DESC LIMIT 1`).get()
  || pre.prepare(`SELECT job_id, company, title FROM scraped_jobs ORDER BY id DESC LIMIT 1`).get();
pre.prepare(`UPDATE scraped_jobs SET is_active = 1, retired_at = NULL, scraped_at = unixepoch() WHERE job_id = ?`).run(job.job_id);
pre.close();

const env = { ...process.env, RM_DATA_DIR: DIR, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "walkA189-secret-not-real",
  // 46j: the practice form's "Why are you interested" becomes REQUIRED for this walk — with no model key draft cannot
  // write it confidently, so the run HOLDS on a question and the answer → unblock leg is exercised (it raised none before).
  DRAFT_PRACTICE_REQUIRE_WHY: "1",
  APP_BASE_URL: BASE, DRAFT_DEFER_PREVIEW_GENERATION: "1", DRAFT_SUBMIT_RETRY_BACKOFF_MS: "500,1000",
  DRAFT_SCHEMA_READER: "off", MATCH_ALERTS: "off", NETWORK_DIGEST: "off", DAILY_REMINDERS: "off", TAXONOMY_BACKFILL: "off",
  RESEND_API_KEY: "", ANTHROPIC_API_KEY: "", ANTHROPIC_KEY: "", DOTENV_CONFIG_PATH: "./.no-dotenv-for-local-harness" };
const server = spawn(process.execPath, ["server.js"], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
let log = "";
server.stdout.on("data", d => { log += d; }); server.stderr.on("data", d => { log += d; });
const stop = () => { try { server.kill(); } catch { /* gone */ } };
process.on("exit", stop);
let up = false;
for (let i = 0; i < 600; i++) { try { if ((await fetch(`${BASE}/api/health/ready`)).ok) { up = true; break; } } catch { /* not yet */ } await sleep(500); }

let cookie = "";
const call = async (method, p, body) => {
  const r = await fetch(BASE + p, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const set = r.headers.getSetCookie?.() || [];
  if (set.length) cookie = set.map(c => c.split(";")[0]).join("; ");
  let json = null; try { json = await r.json(); } catch { json = null; }
  return { status: r.status, json };
};
const read = (fn) => { const d = new Database(DB, { readonly: true }); d.pragma("busy_timeout = 5000"); try { return fn(d); } finally { d.close(); } };
const write = (fn) => { const d = new Database(DB); d.pragma("busy_timeout = 5000"); try { return fn(d); } finally { d.close(); } };
const rowsFor = () => read(d => d.prepare(`SELECT id, run_id, status, reason_code, reason_detail, submit_verified, submit_evidence, open_questions_json
  FROM apply_run_jobs WHERE job_id = ? ORDER BY id`).all(job.job_id));
/** Wait until the newest run-job for the posting has left queued / running. */
async function settle(afterId = 0, ms = 240_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const last = rowsFor().filter(r => r.id > afterId).pop();
    if (last && !["queued", "running"].includes(last.status)) return last;
    await sleep(2000);
  }
  return rowsFor().filter(r => r.id > afterId).pop() || null;
}
const pendingFor = async () => (await call("GET", "/api/apply/pending")).json?.pending?.find(p => String(p.jobId) === String(job.job_id)) || null;
/** A synthetic answer for a held question: a choice question takes its first real option; text gets a plain sentence. */
const answerFor = (q) => {
  const opts = (q.options || []).map(o => (typeof o === "string" ? o : o?.label ?? o?.value)).filter(o => o && !/^select/i.test(String(o)));
  if (opts.length) {
    const no = opts.find(o => /^no$/i.test(String(o))), yes = opts.find(o => /^yes$/i.test(String(o)));
    return String(/sponsor/i.test(q.question) && no ? no : yes || opts[0]);
  }
  return "I build reliable backend services and this team's work is the kind I do best.";
};

try {
  say("server", up, up ? `ready on ${BASE}` : "never answered /api/health/ready");
  if (!up) throw new Error("server down");
  const reg = await call("POST", "/api/auth/register", { username: "walk-a189", password: "WalkA189-Passw0rd!",
    profile: { email: "walk-a189@example.invalid", first_name: "Walk", last_name: "Placeholder" } });
  say("setup", reg.status < 400, `register ${reg.status} ${reg.status >= 400 ? JSON.stringify(reg.json) : ""}`);
  write(d => d.prepare("UPDATE users SET test_account = 1 WHERE username = ?").run("walk-a189"));
  const upload = await call("POST", "/api/domain-profiles/from-resume", { content: sample.resumeText, name: `${sample.candidate.fullName}.txt` });
  say("sample résumé is the base", upload.status < 400, `from-resume ${upload.status}`);
  const userId = read(d => d.prepare("SELECT id FROM users WHERE username = ?").pluck().get("walk-a189"));

  // 1 · Draft → held.
  const run = await call("POST", "/api/apply/runs", { jobIds: [job.job_id], mode: "auto", surface: "walk" });
  say("Draft", run.status === 202, `POST /api/apply/runs ${run.status} — ${job.company} · ${job.title}`);
  const first = await settle(0);
  const events1 = read(d => d.prepare("SELECT event FROM apply_job_logs WHERE job_id = ? ORDER BY id").pluck().all(job.job_id));
  say("practice form, never the employer", events1.includes("practice_form"), `events: ${events1.join(" → ")}`);
  say("held", first?.status === "held_review", `run job ${first?.id}: ${first?.status} / ${first?.reason_code}`);

  // 2 · Answer every held question → the job unblocks (a re-run that holds for approval with nothing open).
  let pend = await pendingFor();
  let held = pend?.heldQuestions || [];
  const open = JSON.parse(first?.open_questions_json || "[]");
  const toAnswer = held.length ? held : open;
  console.log(`   held questions: ${toAnswer.map(q => JSON.stringify(q.question)).join(", ") || "(none)"}`);
  let current = first;
  if (toAnswer.length) {
    const answers = Object.fromEntries(toAnswer.map(q => [q.question, answerFor(q)]));
    const ans = await call("POST", "/api/apply/answers", { answers, retryJobIds: [job.job_id] });
    say("answers saved, re-run started", ans.status < 300, `POST /api/apply/answers ${ans.status} ${JSON.stringify(ans.json).slice(0, 240)}`);
    current = await settle(first.id);
    pend = await pendingFor();
    held = pend?.heldQuestions || [];
    say("unblocked", current?.status === "held_review" && current?.reason_code === "awaiting_approval" && held.length === 0,
      `re-run job ${current?.id}: ${current?.status} / ${current?.reason_code} · open questions left: ${held.length}`);
  } else {
    say("unblocked", current?.reason_code === "awaiting_approval",
      `the practice form raised NO held question for this sample — nothing to answer; ${current?.status} / ${current?.reason_code}`);
  }
  if (current?.reason_code !== "awaiting_approval") throw new Error(`not approvable: ${current?.status} / ${current?.reason_code} — ${current?.reason_detail}`);

  // The approved run's résumé: a stored artifact for this job (CASE A) — no tools service in a local walk.
  write(d => {
    const prof = d.prepare("SELECT id FROM domain_profiles WHERE user_id = ? AND is_active = 1").pluck().get(userId) ?? null;
    d.prepare(`INSERT INTO resumes (user_id, job_id, company, role, apply_mode, html, ats_score, domain_profile_id, updated_at)
      VALUES (?, ?, ?, ?, 'TAILORED', ?, 82, ?, unixepoch() + 5)
      ON CONFLICT(user_id, job_id) DO UPDATE SET html = excluded.html, ats_score = 82, apply_mode = 'TAILORED', updated_at = unixepoch() + 5`)
      .run(userId, String(job.job_id), job.company || "Company", job.title || "Role",
        `<html><body><h1>${sample.candidate.fullName}</h1><pre>${sample.resumeText.replace(/</g, "&lt;")}</pre></body></html>`, prof);
  });
  const sentBefore = read(d => d.prepare("SELECT COUNT(*) FROM practice_submissions WHERE job_id = ?").pluck().get(String(job.job_id)));

  // 3 · Approve → Sent.
  const appr = await call("POST", "/api/apply/approve", { runJobIds: [current.id] });
  say("Approve", appr.status === 202, `POST /api/apply/approve ${appr.status} ${JSON.stringify(appr.json).slice(0, 200)}`);
  const sent = await settle(current.id);
  say("Sent", sent?.status === "submitted" && sent?.submit_verified === 1,
    `approved run job ${sent?.id}: ${sent?.status} / ${sent?.reason_code ?? "-"} · verified ${sent?.submit_verified} · evidence ${sent?.submit_evidence} ${sent?.reason_detail ? "· " + sent.reason_detail.slice(0, 200) : ""}`);
  const sentAfter = read(d => d.prepare("SELECT COUNT(*) FROM practice_submissions WHERE job_id = ?").pluck().get(String(job.job_id)));
  say("the practice form received exactly one submission", sentAfter - sentBefore === 1, `practice_submissions ${sentBefore} → ${sentAfter}`);
  const marks = read(d => d.prepare("SELECT event FROM apply_job_logs WHERE run_job_id = ? ORDER BY id").pluck().all(sent?.id));
  say("press tracking on the approved run", marks.filter(e => e === "submit_attempt").length === 1 && marks.filter(e => e === "submit_pressed").length === 1,
    `events: ${marks.join(" → ")}`);
} catch (e) {
  say("harness", false, `threw: ${e.stack?.split("\n").slice(0, 3).join(" | ")}`);
} finally {
  stop();
  fs.writeFileSync(path.join(DIR, "results.json"), JSON.stringify(results, null, 1));
  fs.writeFileSync(path.join(DIR, "server.log"), log);
  console.log(`\n${results.filter(r => r.ok).length} / ${results.length} PASS`);
  process.exitCode = results.every(r => r.ok) ? 0 : 1;
}
