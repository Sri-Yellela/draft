// ── D100 P7 / D102 P4 · THE FULL AUTO SCHEDULER — run times, the daily cap, the company rules ──
//
// For a user whose mode is FULL AUTO (users.send_mode = 'auto'), at each of their run times this
// takes jobs from THEIR board (the board's own query, with the filters saved in Auto settings), drops
// what they have already drafted, applies the per-company limit and the pause after an interview or
// offer, stops at the daily cap, and starts ONE run through startRun with approvalMode 'auto' — the
// same admission every Draft goes through (the kill switch, Draft slots, the line). Nothing here
// opens a browser or submits; processRunJob does, and it re-checks the mode and the kill switch.
//
// The decisions are pure functions so a test can drive them with a clock; runAutoTick wires them to
// the database and takes the board and startRun as arguments (server.js passes boardPageResponse and
// routes/apply.js's startAutoRun).
import { readAutoSettings, PAUSE_DAYS, COMPANY_WINDOW_DAYS } from "../shared/autoSettings.js";
import { companyNameKey } from "../shared/companyIdentity.js";
import { userHeld } from "./applyUserHold.js";
import { fullAutoDisabled } from "./appSettings.js";
import { eligibilityForJob, userEligibilityInputs } from "./jobEligibility.js";

const DAY = 86400;
const MAX_JOBS_PER_RUN = 25; // POST /api/apply/runs' own limit

/** { date: "YYYY-MM-DD", minutes } — the wall clock in `timeZone` at epoch second `nowSec`. */
export function localClock(nowSec, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(nowSec * 1000)).map(p => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

const toMinutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/**
 * The epoch second of the most recent run time at or before now (today's, or yesterday's last).
 * Minute precision; a DST jump can move one slot by an hour, which is accepted.
 */
export function lastSlotAt(nowSec, settings) {
  const { minutes } = localClock(nowSec, settings.timeZone);
  const slots = settings.runTimes.map(toMinutes).sort((a, b) => a - b);
  const today = slots.filter(m => m <= minutes);
  const back = today.length ? minutes - today[today.length - 1] : minutes + (1440 - slots[slots.length - 1]);
  return nowSec - (nowSec % 60) - back * 60;
}

/** Due when a run time has passed since the last run (or, before any run, since the settings were saved). */
export function runDue(nowSec, settings, { lastRunAt = null, savedAt = null } = {}) {
  const since = Math.max(lastRunAt ?? 0, savedAt ?? 0);
  return lastSlotAt(nowSec, settings) > since;
}

/** Auto applications started today, in the user's own day (the cap is per local day). */
export function startedToday(createdAts, nowSec, timeZone) {
  const today = localClock(nowSec, timeZone).date;
  return createdAts.filter(t => localClock(t, timeZone).date === today).length;
}

/**
 * Which candidates this run takes, in board order. Pure.
 * @param candidates [{ jobId, company }] in the board's order
 * @param ctx { remaining, drafted:Set<jobId>, companyCounts:Map<key,n>, pausedCompanies:Set<key>, settings }
 * @returns { take: jobId[], skipped: [{ jobId, reason }] }
 */
export function pickJobs(candidates, { remaining, drafted, companyCounts, pausedCompanies, settings, isIneligible = null }) {
  const take = [];
  const skipped = [];
  const counts = new Map(companyCounts);
  for (const c of candidates) {
    if (take.length >= Math.min(remaining, MAX_JOBS_PER_RUN)) { skipped.push({ jobId: c.jobId, reason: "daily_cap" }); continue; }
    if (drafted.has(String(c.jobId))) { skipped.push({ jobId: c.jobId, reason: "already_drafted" }); continue; }
    // ⛔ D104 P1: a posting whose stated requirements contradict what the user SET is never queued by FULL AUTO.
    if (isIneligible?.(c.jobId)) { skipped.push({ jobId: c.jobId, reason: "ineligible" }); continue; }
    const key = companyNameKey(c.company || "");
    if (key && settings.pauseCompanyAfterReply && pausedCompanies.has(key)) { skipped.push({ jobId: c.jobId, reason: "company_paused" }); continue; }
    if (key && settings.perCompanyLimit30d != null && (counts.get(key) || 0) >= settings.perCompanyLimit30d) {
      skipped.push({ jobId: c.jobId, reason: "company_limit" }); continue;
    }
    take.push(String(c.jobId));
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  }
  return { take, skipped };
}

// ── the database side ────────────────────────────────────────────────────────────────────────

function autoStartsSince(db, userId, sinceSec) {
  return db.prepare(`
    SELECT rj.created_at FROM apply_run_jobs rj JOIN apply_runs r ON r.id = rj.run_id
    WHERE rj.user_id = ? AND r.approval_mode = 'auto' AND rj.created_at >= ?
      AND rj.status NOT IN ('cancelled', 'superseded')`).pluck().all(userId, sinceSec);
}

function companyOf(db, userId, jobId) {
  const r = db.prepare(`SELECT COALESCE(rj.posting_company, sj.company) AS company
    FROM application_records ar
    LEFT JOIN apply_run_jobs rj ON rj.user_id = ar.user_id AND rj.job_id = ar.job_id
    LEFT JOIN scraped_jobs sj ON sj.job_id = ar.job_id
    WHERE ar.user_id = ? AND ar.job_id = ? ORDER BY rj.id DESC LIMIT 1`).get(userId, jobId);
  return r?.company || null;
}

/** Everything a run needs to decide, read for one user. */
export function userContext(db, userId, nowSec, settings) {
  const recs = db.prepare(`SELECT job_id, created_at FROM application_records WHERE user_id = ? AND state != 'withdrawn'`).all(userId);
  const drafted = new Set(recs.map(r => String(r.job_id)));
  const companyCounts = new Map();
  for (const r of recs) {
    if (r.created_at < nowSec - COMPANY_WINDOW_DAYS * DAY) continue;
    const key = companyNameKey(companyOf(db, userId, r.job_id) || "");
    if (key) companyCounts.set(key, (companyCounts.get(key) || 0) + 1);
  }
  const pausedCompanies = new Set(db.prepare(`
    SELECT company FROM job_applications
    WHERE user_id = ? AND response_outcome IN ('interview', 'offer', 'assessment')
      AND COALESCE(outcome_at, applied_at, 0) >= ?`).pluck().all(userId, nowSec - PAUSE_DAYS * DAY)
    .map(c => companyNameKey(c || "")).filter(Boolean));
  const used = startedToday(autoStartsSince(db, userId, nowSec - 2 * DAY), nowSec, settings.timeZone);
  const inputs = userEligibilityInputs(db, userId);
  const isIneligible = (jobId) => eligibilityForJob(db, userId, jobId, inputs).status === "ineligible";
  return { drafted, companyCounts, pausedCompanies, used, remaining: Math.max(0, settings.dailyCap - used), isIneligible };
}

/**
 * One pass over every FULL AUTO user. Returns what it did per user, for the log and the tests.
 * @param deps { nowSec, fetchBoard(userId, filters) → [{ jobId, company }], startAutoRun(userId, jobIds) → { status, body } }
 */
export async function runAutoTick(db, { nowSec = Math.floor(Date.now() / 1000), fetchBoard, startAutoRun, env = process.env }) {
  const out = [];
  if (fullAutoDisabled(db, env)) return [{ skipped: "kill_switch" }];
  const users = db.prepare(`SELECT id, auto_settings, auto_last_run_at FROM users WHERE send_mode = 'auto'`).all();
  for (const u of users) {
    const settings = readAutoSettings(u.auto_settings);
    let savedAt = null;
    try { savedAt = JSON.parse(u.auto_settings || "{}").savedAt ?? null; } catch { savedAt = null; }
    if (!runDue(nowSec, settings, { lastRunAt: u.auto_last_run_at, savedAt })) { out.push({ userId: u.id, skipped: "not_due" }); continue; }
    if (userHeld(db, u.id)) { out.push({ userId: u.id, skipped: "held" }); continue; }
    // The slot is spent whatever happens next, so a failing board does not retry every tick.
    db.prepare(`UPDATE users SET auto_last_run_at = ? WHERE id = ?`).run(nowSec, u.id);
    const ctx = userContext(db, u.id, nowSec, settings);
    if (ctx.remaining <= 0) { out.push({ userId: u.id, skipped: "daily_cap", used: ctx.used }); continue; }
    let candidates;
    try { candidates = await fetchBoard(u.id, settings.filters); }
    catch (e) { out.push({ userId: u.id, skipped: "board_failed", error: e.message }); continue; }
    // "Each run takes jobs posted since the last" — a job with a known posting time older than the last run is skipped.
    const fresh = u.auto_last_run_at == null ? candidates
      : candidates.filter(c => !(Number.isFinite(c.postedAt) && c.postedAt < u.auto_last_run_at));
    const { take, skipped } = pickJobs(fresh, { ...ctx, settings });
    if (!take.length) { out.push({ userId: u.id, skipped: "nothing_new", skippedJobs: skipped.length }); continue; }
    const r = startAutoRun(u.id, take);
    out.push({ userId: u.id, started: take.length, status: r?.status ?? null, error: r?.body?.error ?? null, skippedJobs: skipped.length });
  }
  return out;
}
