// ── D100 P7 / D102 P4 · THE FULL AUTO SCHEDULER — run times, the daily cap, the company rules ──
//
// For a user whose mode is FULL AUTO (users.send_mode = 'auto'), at each of their run times this
// takes jobs from THEIR board (the board's own query, with the filters saved in Auto settings), drops
// what they have already drafted, applies the per-company limit and the pause after an interview or
// offer, stops at the daily cap, and starts ONE run through startRun with approvalMode 'auto' — the
// same admission every Draft goes through (the kill switch, Draft slots, the line). Nothing here
// opens a browser or submits; processRunJob does, and it re-checks the mode and the kill switch.
//
// ⭐ D113 (owner 10-31): the same tick now also serves "Ask me first" (SEMI + Auto settings `picks`), and every run is a
// PICKS RUN (services/picks.js): ranked by the ATS match, stored once per (user, run time) with the left-out counts by
// reason, then delivered once — a picks message for Ask me first, startAutoRun for Apply for me (FULL AUTO).
//
// The decisions are pure functions so a test can drive them with a clock; runAutoTick wires them to
// the database and takes the board and startRun as arguments (server.js passes boardPageResponse and
// routes/apply.js's startAutoRun).
import { readAutoSettings, PAUSE_DAYS, COMPANY_WINDOW_DAYS } from "../shared/autoSettings.js";
import { companyNameKey } from "../shared/companyIdentity.js";
import { userHeld } from "./applyUserHold.js";
import { canaryRefusal } from "./fullAutoCanary.js";
import { fullAutoDisabled } from "./appSettings.js";
import { eligibilityForJob, userEligibilityInputs } from "./jobEligibility.js";
import { livenessFor, isStale } from "./jobs/jobHistory.js";
import { sponsorshipSignal } from "./kb/sponsorshipSignal.js";
import { choosePicks, storeRun, deliverRun, nextSlotAfter, lineForCandidate, pickedJobsSince, everPicked, userLevelFor,
  expireOffers, sweepLeftOut, runPickSummaries, runPickQuestions } from "./picks.js";

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
export function pickJobs(candidates, { remaining, drafted, companyCounts, pausedCompanies, settings, isIneligible = null, isStalePosting = null }) {
  const take = [];
  const skipped = [];
  const counts = new Map(companyCounts);
  for (const c of candidates) {
    if (take.length >= Math.min(remaining, MAX_JOBS_PER_RUN)) { skipped.push({ jobId: c.jobId, reason: "daily_cap" }); continue; }
    if (drafted.has(String(c.jobId))) { skipped.push({ jobId: c.jobId, reason: "already_drafted" }); continue; }
    // ⛔ D104 P1: a posting whose stated requirements contradict what the user SET is never queued by FULL AUTO.
    if (isIneligible?.(c.jobId)) { skipped.push({ jobId: c.jobId, reason: "ineligible" }); continue; }
    // ⛔ D107 P3: nor one past the user's staleness thresholds (reposted ≥ N, open > N days) — still on the board.
    if (isStalePosting?.(c.jobId)) { skipped.push({ jobId: c.jobId, reason: "stale" }); continue; }
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
    SELECT rj.job_id, rj.created_at FROM apply_run_jobs rj JOIN apply_runs r ON r.id = rj.run_id
    WHERE rj.user_id = ? AND r.approval_mode = 'auto' AND rj.created_at >= ?
      AND rj.status NOT IN ('cancelled', 'superseded')`).all(userId, sinceSec);
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
  // ⭐ D113: the day's slots are the jobs FULL AUTO started today AND today's picks (offered, tapped or expired unanswered) —
  // one job counted once (a pick sent for the user is also an auto start). A Pass gives its slot back.
  const today = localClock(nowSec, settings.timeZone).date;
  const usedJobs = new Set();
  for (const r of [...autoStartsSince(db, userId, nowSec - 2 * DAY), ...pickedJobsSince(db, userId, nowSec - 2 * DAY)]) {
    if (localClock(r.created_at, settings.timeZone).date === today) usedJobs.add(String(r.job_id));
  }
  const used = usedJobs.size;
  // A job already picked for the user (passed included) is never offered again.
  for (const j of everPicked(db, userId)) drafted.add(j);
  const inputs = userEligibilityInputs(db, userId);
  const eligibilityOf = (jobId) => eligibilityForJob(db, userId, jobId, inputs);
  const isIneligible = (jobId) => eligibilityOf(jobId).status === "ineligible";
  const livenessOf = (jobId) => livenessFor(db, jobId, { now: nowSec });
  const isStalePosting = (jobId) => isStale(livenessOf(jobId), settings);
  // ⭐ D121 P3 · the ONE sponsorship signal per candidate; it ranks only for a user whose Application defaults say they
  // need sponsorship (and the opt-in switch filters for anyone who turned it on).
  const needsSponsorship = inputs.defaults?.sponsorship_now === "yes" || inputs.defaults?.sponsorship_later === "yes";
  const sponsorshipOf = (jobId) => {
    try {
      const row = db.prepare(`SELECT job_id, company, title, description, description_full FROM scraped_jobs WHERE job_id = ?`).get(String(jobId));
      return row ? sponsorshipSignal(db, row.company, { title: row.title, posting: row }) : null;
    } catch { return null; }
  };
  return { drafted, companyCounts, pausedCompanies, used, remaining: Math.max(0, settings.dailyCap - used), isIneligible, isStalePosting,
    eligibilityOf, livenessOf, userLevel: userLevelFor(db, userId), needsSponsorship, sponsorshipOf };
}

/** The user's D113 mode: 'apply' (FULL AUTO, "Apply for me"), 'ask' (SEMI with picks on, "Ask me first") or null. */
export function picksMode(sendMode, settings) {
  if (sendMode === "auto") return "apply";
  return settings.picks === true ? "ask" : null;
}

/**
 * One pass over every FULL AUTO user and every "Ask me first" user. Returns what it did per user, for the log and the tests.
 *
 * ⭐ D113 P1: each due user gets ONE picks run for the run time — new postings since the last run → the filters (the
 * board's own query) → D104 eligibility → D107 liveness → D106 level → per-company limit + interview pause → ranked by
 * the ATS match → cut to what the daily cap leaves → `picks` rows. Stored per run: postings seen, picked, the left-out
 * counts by reason and the left-out ids (14 days). Then delivered ONCE (services/picks.js deliverRun): the picks message
 * ("Ask me first") or the run's start ("Apply for me").
 * @param deps { nowSec, fetchBoard(userId, filters, settings) → [{ jobId, company, title?, score?, levelRead?, postedAt? }],
 *               startAutoRun(userId, jobIds, { review }) → { status, body }, notify?(userId, event, data), secret?, appUrl? }
 */
export async function runAutoTick(db, { nowSec = Math.floor(Date.now() / 1000), fetchBoard, startAutoRun, env = process.env,
  notify = null, secret = null, appUrl = "" }) {
  const out = [];
  if (fullAutoDisabled(db, env)) return [{ skipped: "kill_switch" }];
  expireOffers(db, nowSec);
  sweepLeftOut(db, nowSec);
  const users = db.prepare(`SELECT id, auto_settings, auto_last_run_at, send_mode FROM users
    WHERE send_mode = 'auto' OR auto_settings LIKE '%"picks":true%'`).all();
  for (const u of users) {
    const settings = readAutoSettings(u.auto_settings);
    const mode = picksMode(u.send_mode, settings);
    if (!mode) continue;
    let savedAt = null;
    try { savedAt = JSON.parse(u.auto_settings || "{}").savedAt ?? null; } catch { savedAt = null; }
    const deps = { notify, startAutoRun, secret, appUrl, settings };
    // A run stored but never delivered (a crash between the two) is delivered now — once (deliverRun claims it).
    try {
      const pending = db.prepare(`SELECT * FROM picks_runs WHERE user_id = ? AND delivery_claimed_at IS NULL AND expires_at > ?`).all(u.id, nowSec);
      for (const run of pending) out.push({ userId: u.id, runId: run.id, resumed: true, ...(await deliverRun(db, run, deps, nowSec)) });
    } catch { /* no picks tables in this schema */ }
    if (!runDue(nowSec, settings, { lastRunAt: u.auto_last_run_at, savedAt })) { out.push({ userId: u.id, skipped: "not_due" }); continue; }
    if (userHeld(db, u.id)) { out.push({ userId: u.id, skipped: "held" }); continue; }
    // ⛔ D175 FA2: a TEST account runs only on a sample résumé (its sends go to draft's practice form, never an employer).
    const canaryNo = canaryRefusal(db, u.id);
    if (canaryNo) { out.push({ userId: u.id, skipped: "canary_not_sample", error: canaryNo }); continue; }
    // The slot is spent whatever happens next, so a failing board does not retry every tick.
    db.prepare(`UPDATE users SET auto_last_run_at = ? WHERE id = ?`).run(nowSec, u.id);
    const slotAt = lastSlotAt(nowSec, settings);
    const ctx = userContext(db, u.id, nowSec, settings);
    let candidates;
    try { candidates = await fetchBoard(u.id, settings.filters, settings); }
    catch (e) { out.push({ userId: u.id, skipped: "board_failed", error: e.message }); continue; }
    // "Each run takes jobs posted since the last" — a job with a known posting time older than the last run is skipped.
    const isNew = (c) => u.auto_last_run_at == null || !(Number.isFinite(c.postedAt) && c.postedAt < u.auto_last_run_at);
    const fresh = candidates.filter(isNew);
    // Outside your filters: the new postings the board WITHOUT the Auto filters has that the filtered board does not.
    let outsideFilters = 0;
    if (Object.keys(settings.filters || {}).length) {
      try {
        const inFilter = new Set(candidates.map(c => String(c.jobId)));
        outsideFilters = (await fetchBoard(u.id, {}, settings)).filter(c => isNew(c) && !inFilter.has(String(c.jobId))).length;
      } catch { outsideFilters = 0; }
    }
    const { take, leftOut } = choosePicks(fresh, { ...ctx, settings });
    const skippedJobs = leftOut.length;
    let stored;
    try {
      stored = storeRun(db, { userId: u.id, slotAt, mode, expiresAt: nextSlotAfter(slotAt, settings, localClock), seen: fresh.length + outsideFilters,
        take, leftOut, outsideFilters, nowSec, review: settings.showFormBeforeSending === true,
        // D121: "why this pick" says the sponsorship signal for a user who needs sponsorship
        lineFor: (c) => lineForCandidate(c, { eligibility: ctx.eligibilityOf(c.jobId), liveness: ctx.livenessOf(c.jobId),
          sponsorship: ctx.needsSponsorship ? { ...(ctx.sponsorshipOf(c.jobId) || {}), needed: true } : null }) });
    } catch (e) { out.push({ userId: u.id, skipped: "store_failed", error: e.message }); continue; }
    if (!stored.created) { out.push({ userId: u.id, runId: stored.run.id, skipped: "run_exists" }); continue; }
    const r = await deliverRun(db, stored.run, deps, nowSec);
    if (!take.length) {
      out.push(ctx.remaining <= 0 ? { userId: u.id, runId: stored.run.id, skipped: "daily_cap", used: ctx.used }
        : { userId: u.id, runId: stored.run.id, skipped: "nothing_new", skippedJobs });
      continue;
    }
    if (mode === "apply") out.push({ userId: u.id, runId: stored.run.id, mode, started: r.started ?? 0, status: r.status ?? null, error: r.error ?? null, skippedJobs });
    else out.push({ userId: u.id, runId: stored.run.id, mode, picked: take.length, messaged: !!r.messaged, skippedJobs });
  }
  return out;
}

/** ⭐ D113: after the runs — Apply for me's one summary after each run, and the questions that came back. */
export async function runPicksFollowUps(db, { nowSec = Math.floor(Date.now() / 1000), notify = null, secret = null, appUrl = "" } = {}) {
  const summaries = await runPickSummaries(db, { notify, nowSec });
  const questions = secret ? await runPickQuestions(db, { notify, secret, appUrl, nowSec }) : [];
  return { summaries, questions };
}
