// services/submitFamilies.js — ⭐ A187 S1–S3 (46k, owner 11-12: Ashby answered a submit from draft's server browser with
// "Your application submission was flagged as possible spam", even after the person solved the check in the live view).
//
// The submit came from draft's server — one data-centre address, an automated browser, the same for every person — and
// that is what an ATS's spam check is built to catch. Solving the check does not change where the submit comes from.
// ⛔ The fix is NOT to disguise it: no proxies, no "stealth" browsers, no fingerprint spoofing (declined — A187, A186).
// The fix is to send from the PERSON'S OWN browser (A187-1: the extension hand-off fills the form from the stored payload
// and the person presses Submit), and to stop server-side submits wherever an ATS flags them:
//
//   S1  serverSubmitBlock(db, { ats })               → "server_submit_paused" for Ashby (always) and any family paused by S3
//   S2  serverSubmitBlock(db, { userId, jobId })     → "flagged_spam" when THIS job's submit was flagged before: a flagged
//                                                       submit is never pressed again from the server (repeated flagged
//                                                       submits from one address make it worse for every person)
//   S3  submitOutcomeCounts(db)                       → Admin: submits by ATS × outcome (sent · flagged as spam · check ·
//                                                       failed · paused), and which families are paused now
//       a family with FLAG_THRESHOLD flags in FLAG_WINDOW_S pauses itself; the owner is told once (the log line + Admin)
//
// Every count reads apply_job_logs' `submit_outcome` events (one indexed-by-time pass; a handful of rows a day) — no table.

export const SPAM_FLAG_RE = /flagged as (possible |potential )?spam|submission (was|has been) flagged|(marked|detected) as (possible |potential )?spam|suspicious (activity|submission)/i;

/** Families whose server-side submit is paused whatever the counts say (the owner, 11-12: Ashby). */
export const ALWAYS_PAUSED = Object.freeze(new Set(["ashby"]));
// ⭐ A207 (b) (46l, owner 11-13: "if A185's server submit gets a spam flag on Ashby, that ATS is marked 'extension submit'"):
// the FIRST flag marks the family, and the mark is DURABLE — an app_settings row `submit_family:<ats>` set by the flag and
// cleared only by the owner in Admin (A187's 2-in-24-h window lapsed by itself and sent the next submit into the same refusal).
export const FLAG_THRESHOLD = 1;
export const FLAG_WINDOW_S = 24 * 3600;
export const FAMILY_MARK_PREFIX = "submit_family:";
export const familyMarkKey = (ats) => FAMILY_MARK_PREFIX + String(ats || "").toLowerCase();

/** The family's durable mark → { mode: "extension", at, runJobId, jobId } or null. Never throws. */
export function familyMark(db, ats) {
  const a = String(ats || "").toLowerCase();
  if (!a) return null;
  try {
    const row = db.prepare("SELECT value, updated_at FROM app_settings WHERE key = ?").get(familyMarkKey(a));
    if (!row) return null;
    const v = parse(row.value);
    return { mode: "extension", at: Number(v.at) || Number(row.updated_at) || null, runJobId: v.runJobId ?? null, jobId: v.jobId ?? null };
  } catch { return null; }
}

/** Mark a family "extension submit" (the first flag). Keeps the FIRST mark's time and run — a later flag never moves it. */
export function markFamilyExtension(db, ats, { runJobId = null, jobId = null, now = nowS() } = {}) {
  const a = String(ats || "").toLowerCase();
  if (!a || a === "unknown") return null;
  const existing = familyMark(db, a);
  if (existing) return existing;
  try {
    db.prepare(`INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO NOTHING`)
      .run(familyMarkKey(a), JSON.stringify({ mode: "extension", at: now, runJobId, jobId: jobId == null ? null : String(jobId) }), now);
  } catch { return null; }
  return familyMark(db, a);
}

/** The owner's clear (Admin). Returns the mark it removed, or null. */
export function clearFamilyMark(db, ats) {
  const before = familyMark(db, ats);
  if (before) db.prepare("DELETE FROM app_settings WHERE key = ?").run(familyMarkKey(ats));
  return before;
}

export const SUBMIT_OUTCOMES = Object.freeze(["sent", "flagged_spam", "challenge", "failed", "paused"]);

/** True when a page's text is an ATS's spam refusal. Never throws. */
export function isSpamFlagText(text) {
  return SPAM_FLAG_RE.test(String(text ?? ""));
}

/** One autoApply result → the outcome counted for its ATS, or null when nothing was attempted at the submit step. */
export function submitOutcomeOf(result) {
  const st = String(result?.status ?? ""), why = String(result?.reasonCode ?? "");
  if (st === "submitted") return "sent";
  if (why === "flagged_spam") return "flagged_spam";
  if (why === "server_submit_paused") return "paused";
  if (st === "held_gate" && why === "captcha_required" && /captcha/.test(String(result?.submitEvidence ?? ""))) return "challenge";
  if (why === "submit_unverified" || why === "no_submit_button") return "failed";
  return null;
}

const nowS = () => Math.floor(Date.now() / 1000);
const parse = (s) => { try { return JSON.parse(s || "{}") || {}; } catch { return {}; } };

/** Flags counted for one family in the window (S3). */
export function familyFlagCount(db, ats, { now = nowS(), windowS = FLAG_WINDOW_S } = {}) {
  if (!ats) return 0;
  const rows = db.prepare(`SELECT details_json FROM apply_job_logs WHERE created_at >= ? AND event = 'submit_outcome'`).all(now - windowS);
  let n = 0;
  for (const r of rows) { const d = parse(r.details_json); if (d.ats === ats && d.outcome === "flagged_spam") n++; }
  return n;
}

/** Why a family's server-side submit is paused, or null. */
export function familyPause(db, ats, opts = {}) {
  const a = String(ats || "").toLowerCase();
  if (!a) return null;
  if (ALWAYS_PAUSED.has(a)) return "always";
  if (familyMark(db, a)) return "marked";       // A207 (b): durable, until the owner clears it
  void opts;
  return null;
}

/** Was this person's submit of this job ever flagged as spam? (S2) */
export function jobWasFlagged(db, { userId, jobId } = {}) {
  if (userId == null || jobId == null) return false;
  try {
    return !!db.prepare(`SELECT 1 FROM apply_job_logs WHERE user_id = ? AND job_id = ? AND event = 'submit_outcome'
      AND details_json LIKE '%"outcome":"flagged_spam"%' LIMIT 1`).get(userId, String(jobId));
  } catch { return false; }
}

/**
 * S1 + S2 · may the SERVER press Submit on this form? A reason code to stop (the run is held and handed to the person's
 * own browser — both reasons are RESUMABLE_HELD_REASONS), or null.
 */
export function serverSubmitBlock(db, { ats = null, userId = null, jobId = null } = {}) {
  if (jobWasFlagged(db, { userId, jobId })) return "flagged_spam";
  return familyPause(db, ats) ? "server_submit_paused" : null;
}

const told = new Set();
/**
 * Count one outcome (S3) and, when this flag pauses its family, say so once. `log(event, message, details)` is the run's
 * logEvent bound to the run job.
 */
export function recordSubmitOutcome(db, { ats, result, log, runJobId = null, jobId = null }) {
  const outcome = submitOutcomeOf(result);
  if (!outcome || typeof log !== "function") return null;
  const a = String(ats || "unknown").toLowerCase();
  log("submit_outcome", `Submit on ${a}: ${outcome.replace("_", " ")}`, { ats: a, outcome });
  // ⭐ A207 (b): the first flag marks the family "extension submit" — durable, said once.
  if (outcome === "flagged_spam" && !ALWAYS_PAUSED.has(a) && !familyMark(db, a)) {
    const mark = markFamilyExtension(db, a, { runJobId, jobId });
    if (mark && !told.has(a)) {
      told.add(a);
      console.warn(`[submit-family] MARKED ${a} extension submit: a server submit was flagged as spam (run job ${runJobId ?? "?"}) — ` +
        `draft's server no longer presses Submit on ${a}; every run there is sent from the person's own browser with one press ` +
        "in the extension (Admin → System → Switches → Submits by ATS clears it).");
    }
  }
  return outcome;
}

/** Admin (S3): submits by ATS × outcome over the last `days`, and which families are paused now. */
export function submitOutcomeCounts(db, { days = 30, now = nowS() } = {}) {
  const d = Math.max(1, Number(days) || 30);
  const rows = db.prepare(`SELECT details_json FROM apply_job_logs WHERE created_at >= ? AND event = 'submit_outcome'`).all(now - d * 86400);
  const by = new Map();
  for (const r of rows) {
    const x = parse(r.details_json);
    const a = typeof x.ats === "string" && x.ats ? x.ats : "unknown";
    if (!by.has(a)) by.set(a, { ats: a, sent: 0, flagged_spam: 0, challenge: 0, failed: 0, paused: 0 });
    if (SUBMIT_OUTCOMES.includes(x.outcome)) by.get(a)[x.outcome]++;
  }
  for (const a of ALWAYS_PAUSED) if (!by.has(a)) by.set(a, { ats: a, sent: 0, flagged_spam: 0, challenge: 0, failed: 0, paused: 0 });
  // marked families with no rows in the window are still listed (the mark outlives the window)
  try {
    for (const r of db.prepare("SELECT key FROM app_settings WHERE key LIKE ?").all(FAMILY_MARK_PREFIX + "%")) {
      const a = r.key.slice(FAMILY_MARK_PREFIX.length);
      if (a && !by.has(a)) by.set(a, { ats: a, sent: 0, flagged_spam: 0, challenge: 0, failed: 0, paused: 0 });
    }
  } catch {}
  const families = [...by.values()].map(f => ({ ...f, ...shareOf(f), pausedBy: familyPause(db, f.ats, { now }), mark: familyMark(db, f.ats) }))
    .sort((x, y) => y.all - x.all);
  const total = families.reduce((t, f) => {
    for (const k of SUBMIT_OUTCOMES) t[k] += f[k];
    return t;
  }, { sent: 0, flagged_spam: 0, challenge: 0, failed: 0, paused: 0 });
  return { days: d, threshold: FLAG_THRESHOLD, families, overall: { ...total, ...shareOf(total) },
    paused: families.filter(f => f.pausedBy).map(f => f.ats) };
}

/**
 * ⭐ A207 (d) (owner: "count which ATS boards reject server submissions, so the data shows whether this is 5% of applications
 * or 50%"). Counts, never a bare percent (D111):
 *   rejected / tried       server submits flagged as spam, of server submits that reached the click (sent · flagged · check ·
 *                          failed — a paused one never clicked)
 *   extension / all        applications that reached the submit step on an extension-submit family (paused, or flagged),
 *                          of every application that reached it
 */
export function shareOf(f) {
  const tried = f.sent + f.flagged_spam + f.challenge + f.failed;
  return { tried, rejected: f.flagged_spam, all: tried + f.paused, extension: f.paused + f.flagged_spam };
}

/** Admin's two windows at once — 7 and 30 days. */
export function submitShare(db, { now = nowS() } = {}) {
  return { d7: submitOutcomeCounts(db, { days: 7, now }), d30: submitOutcomeCounts(db, { days: 30, now }), preClick: preClickSentRuns(db) };
}

/**
 * ⛔ A209 (46l): runs recorded Sent from the form's own "thank you" words before the fix (submit_evidence
 * 'confirmation_page_pre_click') — they may never have reached the employer. A count and the newest few (job id, when),
 * for the owner to check by hand. Read-only.
 */
export function preClickSentRuns(db, { limit = 20 } = {}) {
  try {
    const n = db.prepare(`SELECT COUNT(*) FROM apply_run_jobs WHERE submit_evidence = 'confirmation_page_pre_click'`).pluck().get();
    const rows = db.prepare(`SELECT id, user_id AS userId, job_id AS jobId, finished_at AS at FROM apply_run_jobs
      WHERE submit_evidence = 'confirmation_page_pre_click' ORDER BY id DESC LIMIT ?`).all(limit);
    return { count: Number(n) || 0, rows };
  } catch { return { count: 0, rows: [] }; }
}
