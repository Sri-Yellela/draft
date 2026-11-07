// services/fullAutoCanary.js — ⛔ D175 FA2 [T7] · A FULL-AUTO CANARY THAT NEVER TOUCHES A REAL EMPLOYER.
//
// The whole FULL AUTO loop — the scheduler's picks → the run → the tailored résumé → the fill → the submit → *Sent* →
// the summary — is proven every night on a production TEST account (users.test_account = 1, migration 224) in *Apply
// for me*, whose active résumé is one of draft's fictional SAMPLES. A sample's sends go only to draft's own practice
// form (services/sampleResumes.js — the rule the owner kept on 11-07), so the canary exercises the real code path end
// to end and no employer ever receives anything.
//
// Two halves:
//   canaryRefusal(db, userId)  the scheduler's guard: a test account in Apply for me whose active résumé is NOT a sample
//                              is never run (it would send a made-up account's applications to real employers).
//   canaryReport(db, userId)   after the night's run: each step green or red with why; the worst one decides. Read by
//                              the nightly cron (one `[canary]` line, kept in app_settings) and by pipeline health
//                              (a red line in Admin → System).
//
// Making the test account is the owner's step (D175 FA2 / O-list: users.test_account = 1, a sample résumé, Apply for me
// with one run time). Until one exists the canary reports "no canary account" — a warning, not a pass.
import { activeSampleId } from "./sampleResumes.js";
import { getSetting, setSetting } from "./appSettings.js";

export const CANARY_KEY = "full_auto_canary_last";
const DAY = 86400;

/** The accounts the canary covers: production test accounts in Apply for me. */
export function canaryAccounts(db) {
  try { return db.prepare(`SELECT id FROM users WHERE test_account = 1 AND send_mode = 'auto' ORDER BY id`).pluck().all(); }
  catch { return []; }
}

/** null when the scheduler may run this account; else why not. Only test accounts are ever refused here. */
export function canaryRefusal(db, userId) {
  let test = 0;
  try { test = Number(db.prepare(`SELECT test_account FROM users WHERE id = ?`).pluck().get(userId)) || 0; } catch { test = 0; }
  if (!test) return null;
  return activeSampleId(db, userId) ? null
    : "a test account runs Apply for me only on a sample résumé (its sends go to draft's practice form) — its active résumé is not one";
}

/**
 * The night's run for one canary account, step by step. `sinceSec` bounds the run looked at (default: the last 36 h).
 * @returns { userId, ok, runId, steps: [{ id, ok, why }] }
 */
export function canaryReport(db, userId, { nowSec = Math.floor(Date.now() / 1000), sinceSec = nowSec - 1.5 * DAY } = {}) {
  const steps = [];
  const step = (id, ok, why) => { steps.push({ id, ok: !!ok, why }); return !!ok; };
  const done = (runId = null) => ({ userId, runId, ok: steps.every(s => s.ok), steps });

  if (!step("sample_resume", activeSampleId(db, userId), activeSampleId(db, userId)
    ? `the active résumé is sample ${activeSampleId(db, userId)}` : "the active résumé is not a sample — the scheduler refuses this account")) return done();
  let run = null;
  try {
    run = db.prepare(`SELECT * FROM picks_runs WHERE user_id = ? AND mode = 'apply' AND created_at >= ? ORDER BY created_at DESC LIMIT 1`).get(userId, sinceSec);
  } catch { run = null; }
  if (!step("scheduled", run, run ? `run ${run.id} at ${new Date(run.created_at * 1000).toISOString()}` : "no Apply for me run in the window")) return done();
  if (!step("picked", run.picked > 0, run.picked > 0 ? `${run.picked} picked of ${run.seen} seen` : `nothing picked (${run.seen} seen) — the loop was not exercised`)) return done(run.id);

  const jobs = db.prepare(`SELECT p.job_id, p.state, rj.id AS rj_id, rj.status, rj.resume_artifact_id, rj.submit_verified
    FROM picks p LEFT JOIN apply_run_jobs rj ON rj.id = (
      SELECT id FROM apply_run_jobs WHERE user_id = p.user_id AND job_id = p.job_id AND created_at >= p.created_at - 60 ORDER BY id DESC LIMIT 1)
    WHERE p.run_id = ? AND p.state = 'auto'`).all(run.id);
  const started = jobs.filter(j => j.rj_id);
  if (!step("started", started.length > 0, `${started.length} of ${jobs.length} picks became application runs`)) return done(run.id);

  // ⛔ The one that matters most: every application went to the practice form, never anywhere else.
  const practice = db.prepare(`SELECT COUNT(*) FROM apply_job_logs WHERE run_job_id = ? AND event = 'practice_form'`).pluck();
  const offTarget = started.filter(j => !practice.get(j.rj_id));
  step("practice_form_only", offTarget.length === 0, offTarget.length === 0
    ? `all ${started.length} filled draft's practice form`
    : `⛔ ${offTarget.length} run job(s) with no practice-form record: ${offTarget.map(j => j.rj_id).join(", ")}`);
  const withResume = started.filter(j => j.resume_artifact_id != null).length;
  step("resume", withResume === started.length, `${withResume} of ${started.length} carried a tailored résumé`);
  const sent = started.filter(j => j.status === "submitted" && j.submit_verified === 1).length;
  step("sent", sent === started.length, `${sent} of ${started.length} submitted with evidence`
    + (sent < started.length ? ` (others: ${started.filter(j => j.status !== "submitted").map(j => j.status).join(", ")})` : ""));
  step("summary", run.summary_sent_at != null, run.summary_sent_at != null ? "the run's summary went out" : "no summary yet");
  return done(run.id);
}

/** The nightly pass: every canary account's report, kept for Admin. Returns { at, accounts, ok, reports }. */
export function runCanaryCheck(db, { nowSec = Math.floor(Date.now() / 1000), log = console } = {}) {
  const ids = canaryAccounts(db);
  const reports = ids.map(id => canaryReport(db, id, { nowSec }));
  const out = { at: nowSec, accounts: ids.length, ok: ids.length > 0 && reports.every(r => r.ok), reports };
  try { setSetting(db, CANARY_KEY, JSON.stringify(out)); } catch { /* app_settings missing — reported by the caller */ }
  if (!ids.length) log.warn?.("[canary] no canary account (users.test_account = 1 in Apply for me on a sample résumé) — FULL AUTO is unproven");
  for (const r of reports) {
    const red = r.steps.filter(s => !s.ok);
    log[r.ok ? "log" : "warn"]?.(`[canary] user ${r.userId} run ${r.runId ?? "—"}: ${r.ok ? "GREEN" : `RED — ${red.map(s => `${s.id}: ${s.why}`).join("; ")}`}`);
  }
  return out;
}

/** The last nightly result, or null. */
export function lastCanary(db) {
  try { return JSON.parse(getSetting(db, CANARY_KEY) || "null"); } catch { return null; }
}

/** Pipeline health's lines: [{ severity, subject, detail }] — empty when green. */
export function canaryAlerts(db, { nowSec = Math.floor(Date.now() / 1000) } = {}) {
  const last = lastCanary(db);
  if (!last?.accounts) {
    // Silent while nobody relies on FULL AUTO; once a real account is in Apply for me, an unproven loop is worth a line.
    let inUse = 0;
    try { inUse = db.prepare(`SELECT COUNT(*) FROM users WHERE send_mode = 'auto' AND COALESCE(test_account, 0) = 0`).pluck().get(); } catch { inUse = 0; }
    if (!inUse) return [];
    return [{ severity: "warn", subject: last ? "no canary account" : "never run",
      detail: `${inUse} account(s) use Apply for me, but no test account on a sample résumé proves the loop nightly (D175 FA2, the owner's step)` }];
  }
  const out = [];
  if (nowSec - last.at > 2 * DAY) out.push({ severity: "warn", subject: "stale", detail: `the canary last ran ${Math.floor((nowSec - last.at) / 3600)} h ago` });
  for (const r of last.reports) {
    const red = r.steps.filter(s => !s.ok);
    if (!red.length) continue;
    const offTarget = red.some(s => s.id === "practice_form_only");
    out.push({ severity: offTarget ? "critical" : "warn", subject: `user ${r.userId}`, detail: red.map(s => `${s.id}: ${s.why}`).join("; ") });
  }
  return out;
}
