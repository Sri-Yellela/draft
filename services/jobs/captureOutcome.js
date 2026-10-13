// services/jobs/captureOutcome.js — D33 part 3: THE GATEWAY SAYS WHY.
//
// The owner captured a posting, the extension said "Captured", and the job was not on the board.
// That is silence reported as success — the most common defect shape in this codebase — and it
// happened because the server's answer was a handful of optional flags (attachedToExisting,
// outOfMarket, degraded) that the extension never read. Now every capture answers ONE object,
// worded ONCE, here, and every surface shows that text as given: the extension's toast and popup,
// and the site's /extension page.
//
//   inserted   new to draft — on the board (ALL), and in your imports (+)
//   attached   it matched a posting draft already had — that row is the one in your imports; link to it
//   held       a capture from before D41(d), held off the board by the US-only gate, and WHY (the
//              gate's own reason code, from rejected_jobs — services/jobs/usLocation.js)
//   closed     in your imports, but the listing has closed
//   refused    ⛔ D41(d): NOT captured — no US evidence. Nothing was written but the attempt.
//
// ⛔ D41(a) (owner, 10-06): a capture no longer stars, so no outcome says "★ Saved" any more.
//
// ⛔ The state is READ BACK from the database (jobGateway.boardStateOf), never inferred from which
// branch ran. Each outcome carries `link` — the job's own address on the site (client/src/lib/
// jobUrl.js's jobDetailHref, pinned by test) — which opens it by id whether or not it is on a board.
import { boardStateOf } from "./jobGateway.js";

export const CAPTURE_OUTCOMES = Object.freeze(["inserted", "attached", "held", "closed", "refused"]);

// ⛔ D41(d) — two refusals, because they are two different facts. Calling a US remote role "not in
// the US" would be false, and a false refusal of the owner's own capture is the worst outcome here.
export const REFUSAL_MESSAGES = Object.freeze({
  non_us:      "This job is based outside the US, so it was not captured — draft is US-only for now.",
  unconfirmed: "We couldn't confirm this job is in the US, so it was not captured — the posting names no US location, US pay range or US work-authorisation line.",
});
/** Which refusal a gate reason is (usLocation.js captureMarket's kinds). */
export const refusalKindOf = (reason) =>
  reason === "non_us_location" || reason === "remote_non_us_by_description" ? "non_us" : "unconfirmed";

// Why the US-only gate holds a posting, in words — keyed by usEligibility's reason codes. ⛔ Every
// code usEligibility can return must be here (pinned by test): an unworded reason would be a hold
// reported without its why.
export const HELD_WHY = Object.freeze({
  remote_region_unstated:
    "it says \"Remote\" without saying from where, and the board only takes a posting with positive US evidence (a US location, a US-only line, US time zones or a US pay range)",
  remote_non_us_by_description: "it is remote from outside the US, and the board is US-only",
  non_us_location: "it is located outside the US, and the board is US-only",
  location_unparseable: "its location could not be read as a US place, and the board is US-only",
});

/** The site's address for one job (the same string jobDetailHref builds on the client). */
export function jobLink(jobId) {
  return jobId ? `/app/jobs?job=${encodeURIComponent(jobId)}` : null;
}

function labelOf({ title, company }) {
  return [title, company].filter(Boolean).join(" at ") || "this job";
}

/**
 * @param db
 * @param {{ jobId: string, action: 'inserted'|'attached', title?: string, company?: string,
 *           noActiveProfile?: boolean }} c
 * @returns {{ outcome, matchedExisting, onBoard, reason, message, jobId, link }}
 */
export function describeCapture(db, { jobId, action, title = null, company = null, noActiveProfile = false, alreadyCaptured = false }) {
  const { state, reason } = boardStateOf(db, jobId);
  if (state === "missing") throw new Error(`describeCapture: no row for ${jobId} — a capture must never be reported without one`);
  const label = labelOf({ title, company });
  const matchedExisting = action === "attached";
  let outcome, message;
  if (state === "held") {
    outcome = "held";
    message = `In your imports, but NOT on the board: ${label} is held off it because ${HELD_WHY[reason] || `of the US-only gate (${reason})`}.`;
  } else if (state === "closed") {
    outcome = "closed";
    message = `In your imports, but NOT on the board: the listing for ${label} has closed.`;
  } else if (matchedExisting) {
    outcome = "attached";
    // ⭐ ONE wording everywhere after a capture that matched a board job (owner 10-12) — and a repeat capture
    // says it was already captured, so the second press is not a new question.
    message = alreadyCaptured ? `Already captured — ${label} is on your board and in your imports.` : `${label} is on your board and in your imports.`;
  } else {
    outcome = "inserted";
    message = `Added to the board: ${label} — it is in ALL, and in your imports.`;
  }
  // The board is scoped to the ACTIVE job profile; with none, it cannot show anything yet.
  if (noActiveProfile) message += " You have no active job profile yet, so the board cannot show it — create one on Full House.";
  return {
    outcome, matchedExisting, alreadyCaptured: matchedExisting && !!alreadyCaptured, onBoard: state === "on_board",
    reason: state === "held" ? reason : null,
    message, jobId, link: jobLink(jobId),
  };
}

/**
 * A user's last captures, newest first, each with what happened to it NOW — the same words the
 * capture answered with, re-read against the row's current state (a posting held at capture time
 * and admitted by a later crawl reads "on the board" today). For the extension popup's recent list
 * (POST /api/import/context) and the site's /extension page (GET /api/extension/status).
 */
export function recentCaptures(db, userId, limit = 5) {
  if (!userId) return [];
  let rows;
  try {
    rows = db.prepare(`
      SELECT c.job_id AS jobId, MAX(c.created_at) AS capturedAt, s.title, s.company,
             (SELECT c2.action FROM job_captures c2 WHERE c2.user_id = c.user_id AND c2.job_id = c.job_id
              ORDER BY c2.id DESC LIMIT 1) AS action
      FROM job_captures c LEFT JOIN scraped_jobs s ON s.job_id = c.job_id
      WHERE c.user_id = ?
      GROUP BY c.job_id ORDER BY capturedAt DESC, MAX(c.id) DESC LIMIT ?
    `).all(userId, limit);
  } catch { return []; }   // a database without migration 122 has no captures to list
  return rows.map(r => {
    const base = { jobId: r.jobId, title: r.title || null, company: r.company || null, capturedAt: r.capturedAt * 1000 };
    // D41(d) · a refused capture has no posting: say it was refused, and which refusal.
    if (r.action === "refused_not_us") {
      const reason = String(r.jobId || "").split(":")[2] || null;
      return { ...base, jobId: null, outcome: "refused", onBoard: false, reason,
               message: REFUSAL_MESSAGES[refusalKindOf(reason)], link: null };
    }
    try {
      const d = describeCapture(db, { jobId: r.jobId, action: r.action, title: r.title, company: r.company });
      return { ...base, outcome: d.outcome, onBoard: d.onBoard, reason: d.reason, message: d.message, link: d.link };
    } catch {
      // The row is gone (pruned): say so rather than drop the capture from the list.
      return { ...base, outcome: "missing", onBoard: false, reason: null,
               message: "This capture's posting is no longer in draft.", link: null };
    }
  });
}
