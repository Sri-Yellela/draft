// services/jobs/autoCapture.js — ⭐ D64 · AUTOMATED CAPTURE, the server's half.
//
// Owner, 10-07: "phasing out manual capture and building an automated one that auto captures when a tab
// is opened and captures content, runs a check if it is relevant to the user's board, and migrates it
// without the user having to do anything."
//
// ⛔ It REVERSES three recorded decisions (AUTOFILL_TARGET.md §8.6): decision A ("one gesture per
// application"), the held-off per-ATS auto-start, and the refusal of auto-saving on LinkedIn / Indeed.
// The guard rails that made those calls cautious are here and in the extension:
//   · OFF by default, opt-in, host access requested at runtime for the job-site list only (extension).
//   · Nothing leaves the browser unless the page IS a posting (extension; extension/autoCapture.js).
//   · ⛔ RELEVANCE IS DECIDED HERE, AGAINST THE USER'S BOARD, BEFORE ANYTHING IS STORED. An irrelevant
//     posting is discarded: no scraped_jobs row, no job_captures row, no refusal row — not even its URL.
//   · A relevant one goes through the ONE capture gateway (importJob → ingestJob) exactly as a manual
//     capture does, marked origin 'auto_capture' ("Captured automatically").
//   · Braked: one per URL per user per day, a cap per hour, and a kill switch beside fullAutoDisabled().
//   · Auto-capture is NOT auto-apply: nothing here fills or submits anything (D36).
//
// THE BOARD'S RULE, reused — not a second notion of "relevant":
//   US admission  importJob's captureMarket gate (D41(d)) — the same one a manual capture meets.
//   role          the board admits jrm.role_key = the active profile's role key (server.js
//                 LOWER(COALESCE(NULLIF(role_family,''), domain))) plus roleScopeExtra (D42: engineering
//                 also sees data). A capture is relevant when its role key is one of those.
//   fit           NOT a gate: the board does not hide a posting by fit unless the user sets the fit
//                 filter, so neither does this — fit orders the board, it does not admit to it.
// ⛔ D17: deterministic (classifyJob is rules, no model).
import { classifyJob } from "./classifyJob.js";
import { roleScopeExtra } from "../../shared/jobTagVocabulary.js";
import { getSetting, settingTruthy } from "../appSettings.js";

export const AUTO_CAPTURE_ORIGIN = "auto_capture";
export const AUTO_CAPTURE_DISABLED_KEY = "auto_capture_disabled";
// The hourly cap is generous for a person browsing postings and small for a runaway loop.
export const AUTO_CAPTURE_HOURLY_CAP = 30;
const DAY = 24 * 3600;

/**
 * THE KILL SWITCH — the same shape as fullAutoDisabled(): the app_settings row wins (flip it with no
 * deploy), the env var AUTO_CAPTURE_DISABLED is the boot default. Read at request time, never cached.
 */
export function autoCaptureDisabled(db, env = process.env) {
  const row = getSetting(db, AUTO_CAPTURE_DISABLED_KEY);
  if (row !== null) return settingTruthy(row);
  return settingTruthy(env?.AUTO_CAPTURE_DISABLED);
}

/** The board's role keys for the user's ACTIVE profile, or null when there is no active profile. */
export function boardRoleKeys(db, userId) {
  const p = db.prepare(
    "SELECT role_family, domain FROM domain_profiles WHERE user_id = ? AND is_active = 1 LIMIT 1"
  ).get(userId);
  if (!p) return null;
  const key = String((p.role_family && String(p.role_family).trim()) || p.domain || "").toLowerCase();
  if (!key) return null;
  return [key, ...roleScopeExtra(key)];
}

/**
 * Is this posting relevant to the user's board? `existingJobId` — a row already in the pool: its own
 * job_role_map buckets decide (the board reads those). Otherwise the posting is classified as the
 * gateway would classify it on insert.
 * @returns {{ relevant: boolean, reason: string, roleKey?: string|null }}
 */
export function autoCaptureRelevance(db, userId, { job = null, existingJobId = null } = {}) {
  const keys = boardRoleKeys(db, userId);
  if (!keys) return { relevant: false, reason: "no_active_profile" };
  let jobKeys;
  if (existingJobId) {
    jobKeys = db.prepare("SELECT role_key FROM job_role_map WHERE job_id = ?").all(existingJobId).map(r => String(r.role_key || "").toLowerCase());
  } else {
    const verdict = classifyJob(job?.title || "", job?.description || "", job?.company || "");
    jobKeys = [String(verdict?.roleKey || "").toLowerCase()];
  }
  const hit = jobKeys.find(k => k && keys.includes(k));
  return hit ? { relevant: true, reason: "role_match", roleKey: hit } : { relevant: false, reason: "role_mismatch", roleKey: jobKeys[0] || null };
}

/**
 * THE BRAKES, checked before any fetch or write. null = go; otherwise { code, status }.
 *   already_today   this URL was auto-captured for this user in the last 24 h — answered, not re-run.
 *   hourly_cap      more than AUTO_CAPTURE_HOURLY_CAP auto-captures in the last hour (429).
 */
export function autoCaptureBrake(db, userId, url, now = Math.floor(Date.now() / 1000)) {
  if (url) {
    const seen = db.prepare(
      "SELECT 1 FROM job_captures WHERE user_id = ? AND origin = ? AND url = ? AND created_at > ? LIMIT 1"
    ).get(userId, AUTO_CAPTURE_ORIGIN, url, now - DAY);
    if (seen) return { code: "already_today", status: 200 };
  }
  const n = db.prepare(
    "SELECT COUNT(*) AS n FROM job_captures WHERE user_id = ? AND origin = ? AND created_at > ?"
  ).get(userId, AUTO_CAPTURE_ORIGIN, now - 3600).n;
  if (n >= AUTO_CAPTURE_HOURLY_CAP) return { code: "hourly_cap", status: 429 };
  return null;
}

/** "Captured today: N" — the popup's list, newest first. One row per job. */
export function listAutoCaptures(db, userId, { now = Math.floor(Date.now() / 1000), sinceSeconds = DAY } = {}) {
  return db.prepare(`
    SELECT jc.job_id AS jobId, MAX(jc.created_at) AS capturedAt, sj.title, sj.company, sj.url
      FROM job_captures jc
      LEFT JOIN scraped_jobs sj ON sj.job_id = jc.job_id
     WHERE jc.user_id = ? AND jc.origin = ? AND jc.created_at > ?
     GROUP BY jc.job_id
     ORDER BY capturedAt DESC
  `).all(userId, AUTO_CAPTURE_ORIGIN, now - sinceSeconds);
}

/**
 * UNDO one automatic capture: the posting leaves the user's `+` view and board. Its auto_capture rows
 * go; the user_jobs row goes too — but ONLY when nothing else the user did holds the job there (a ★, a
 * pass, another capture, a Draft). The shared posting itself stays in the pool: other users may have it.
 * @returns {{ undone: boolean, removedCaptures: number, removedUserJob: boolean }}
 */
export function undoAutoCapture(db, userId, jobId) {
  return db.transaction(() => {
    const removed = db.prepare("DELETE FROM job_captures WHERE user_id = ? AND job_id = ? AND origin = ?")
      .run(userId, jobId, AUTO_CAPTURE_ORIGIN).changes;
    if (!removed) return { undone: false, removedCaptures: 0, removedUserJob: false };
    const otherCapture = db.prepare("SELECT 1 FROM job_captures WHERE user_id = ? AND job_id = ? LIMIT 1").get(userId, jobId);
    const drafted = hasTable(db, "apply_run_jobs")
      ? db.prepare("SELECT 1 FROM apply_run_jobs WHERE user_id = ? AND job_id = ? LIMIT 1").get(userId, jobId) : null;
    let removedUserJob = false;
    if (!otherCapture && !drafted) {
      removedUserJob = db.prepare(
        "DELETE FROM user_jobs WHERE user_id = ? AND job_id = ? AND COALESCE(starred, 0) = 0 AND COALESCE(disliked, 0) = 0"
      ).run(userId, jobId).changes > 0;
    }
    return { undone: true, removedCaptures: removed, removedUserJob };
  })();
}

function hasTable(db, name) {
  return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
}
