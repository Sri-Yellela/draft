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
export const FLAG_THRESHOLD = 2;
export const FLAG_WINDOW_S = 24 * 3600;

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
  try { return familyFlagCount(db, a, opts) >= FLAG_THRESHOLD ? "flags" : null; } catch { return null; }
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
export function recordSubmitOutcome(db, { ats, result, log }) {
  const outcome = submitOutcomeOf(result);
  if (!outcome || typeof log !== "function") return null;
  const a = String(ats || "unknown").toLowerCase();
  log("submit_outcome", `Submit on ${a}: ${outcome.replace("_", " ")}`, { ats: a, outcome });
  if (outcome === "flagged_spam" && !ALWAYS_PAUSED.has(a) && !told.has(a)) {
    let n = 0;
    try { n = familyFlagCount(db, a); } catch {}
    if (n >= FLAG_THRESHOLD) {
      told.add(a);
      console.warn(`[submit-family] PAUSED ${a}: ${n} submits flagged as spam in 24 h — server-side submit to ${a} stops; ` +
        "every run there is handed to the person's own browser (Admin → System → Switches → Submits by ATS).");
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
  const families = [...by.values()].map(f => ({ ...f, pausedBy: familyPause(db, f.ats, { now }) }))
    .sort((x, y) => (y.sent + y.flagged_spam + y.challenge + y.failed + y.paused) - (x.sent + x.flagged_spam + x.challenge + x.failed + x.paused));
  return { days: d, threshold: FLAG_THRESHOLD, families, paused: families.filter(f => f.pausedBy).map(f => f.ats) };
}
