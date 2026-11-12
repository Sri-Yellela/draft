// ── A189 (written as A185) · THE SUBMIT THAT SURVIVES A BAD MINUTE ──────────────────────────────────────────────────
//
// An approved application (or a FULL AUTO one) is a queued job: Approve answers 202 and a fresh browser re-fills the
// form from the stored payload and presses Submit. Two ways it used to end badly with nothing wrong with the
// application itself:
//
//   (1) the browser / the network failed for a moment (net::ERR_*, a navigation timeout, a crashed target) — the job
//       ended "failed" and the person had to notice and press Approve again;
//   (2) the worker died under it (a deploy restart) — the row stayed `running` until boot recovery filed it as
//       "may or may not have reached the employer", even when it had never reached the Submit button.
//
// This file is the RULES; routes/apply.js is the wiring (the retry loop around autoApply for the mode that clicks, the
// sweeper on boot and on an interval). Pure functions only — no database handle, no clock — so every rule is tested by
// itself (test/a189SubmitRetryBackoff.test.js, test/a189StuckSubmittingSweeper.test.js).
//
// ⛔ THE ONE RULE ABOVE ALL: NEVER SEND TWICE. A retry happens only when the failed attempt provably never pressed
// Submit (autoApply reports `submitPressed`, and the route writes a `submit_pressed` event BEFORE the click, so a crash
// between the event and the click errs towards "pressed"). An attempt that pressed Submit and then lost the page is
// never retried — the person is told it may have been sent and to check their email. Before each re-try the route also
// re-checks that nobody stopped it and that no other attempt already sent this posting; and autoApply itself records a
// confirmation page it finds on arrival as submitted WITHOUT clicking (`confirmation_page_pre_click`).
//
// ⛔ NOT A FAILURE TO RETRY: a refusal, a gate, a hold, a CAPTCHA (`captcha_required` is the person's — see
// services/liveChallenge.js; a check is never answered by draft), a submit that was clicked with no confirmation
// (`submit_unverified` — it may have gone), the kill switch, the user's stop, a permanent failure (no browser binary).

/** Total attempts for one approved submit, the first included — shared by the in-process retry and the sweeper. */
export const SUBMIT_MAX_ATTEMPTS = 3;

/** Waits before attempt 2, attempt 3, … (ms). DRAFT_SUBMIT_RETRY_BACKOFF_MS="10000,30000" overrides (tests use "1,1"). */
export const SUBMIT_RETRY_BACKOFF_MS = Object.freeze([10_000, 30_000]);

/** A row `running` with no live worker in this process for this long is stuck (DRAFT_STUCK_SUBMIT_SEC overrides). */
export const STUCK_SUBMIT_AFTER_SEC = 10 * 60;

/** How often the sweeper looks (ms), and how many rows one look handles — a LIMITed, index-backed read (migration 273). */
export const STUCK_SWEEP_INTERVAL_MS = 2 * 60 * 1000;
export const STUCK_SWEEP_LIMIT = 25;

/** Browser / network failures — the only reasons a submit is tried again. */
export const RETRYABLE_SUBMIT_FAILURES = Object.freeze(["browser_error", "browser_timeout", "browser_launch_failed"]);

/** The events the route writes on the run-job's log (apply_job_logs) — the durable record the sweeper reads. */
export const SUBMIT_EVENTS = Object.freeze({
  attempt: "submit_attempt",     // written at the start of every attempt of the mode that clicks: "press tracking is on"
  pressed: "submit_pressed",     // written immediately BEFORE the Submit click
  retry: "submit_retry",         // an in-process retry after a browser / network failure
  requeued: "submit_requeued",   // the sweeper put a stuck row back in the queue (counts as a retry)
  swept: "submit_swept",         // the sweeper ended a stuck row in a held state
});

/** The reason codes this adds (client/src/lib/applyObstacles.js describes both). */
export const SUBMIT_INTERRUPTED = "submit_interrupted";
export const SUBMIT_OUTCOME_UNKNOWN = "submit_outcome_unknown";

export function backoffSchedule(env = process.env) {
  const raw = String(env?.DRAFT_SUBMIT_RETRY_BACKOFF_MS || "").trim();
  if (!raw) return [...SUBMIT_RETRY_BACKOFF_MS];
  const parsed = raw.split(",").map(s => Number(s.trim())).filter(n => Number.isFinite(n) && n >= 0);
  return parsed.length ? parsed : [...SUBMIT_RETRY_BACKOFF_MS];
}

export function stuckAfterSec(env = process.env) {
  const n = Number(env?.DRAFT_STUCK_SUBMIT_SEC);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : STUCK_SUBMIT_AFTER_SEC;
}

/** The wait before attempt `nextAttempt` (2, 3, …) — the last value repeats if the schedule is shorter. */
export function backoffBefore(nextAttempt, schedule = SUBMIT_RETRY_BACKOFF_MS) {
  if (!schedule.length) return 0;
  return schedule[Math.min(Math.max(0, nextAttempt - 2), schedule.length - 1)];
}

/**
 * May this attempt's result be tried again?  → { retry: boolean, why: string }
 * `attempt` is the number of the attempt that just ended (1-based, counting attempts before a requeue).
 */
export function submitRetryVerdict(result, { attempt, maxAttempts = SUBMIT_MAX_ATTEMPTS } = {}) {
  if (!result || result.status !== "error") return { retry: false, why: "not_a_failure" };
  if (result.submitPressed === true) return { retry: false, why: "submit_pressed" };
  if (!RETRYABLE_SUBMIT_FAILURES.includes(result.reasonCode)) return { retry: false, why: "not_browser_or_network" };
  if (result.permanent === true) return { retry: false, why: "permanent" };
  if (!(attempt < maxAttempts)) return { retry: false, why: "attempts_spent" };
  return { retry: true, why: "browser_or_network" };
}

/** The sentence on a failure that happened AFTER Submit was pressed — never retried. */
export const OUTCOME_UNKNOWN_DETAIL =
  "Submit was pressed, then the connection to the employer's site broke before a confirmation could be read. " +
  "It may have been sent — check your email for a confirmation from the employer before sending it again.";

/** What the person reads when the retries ran out. */
export function attemptsSpentDetail(attempts, lastDetail) {
  return `Tried ${attempts} time${attempts === 1 ? "" : "s"} — the employer's site kept failing to load or respond, ` +
    `and Submit was never pressed, so nothing was sent. Approve it again later, or open it and send it yourself.` +
    (lastDetail ? ` (last error: ${String(lastDetail).slice(0, 200)})` : "");
}

/**
 * The in-process retry loop around one attempt function. Everything with a side effect is injected.
 *
 *   attemptFn(attemptNo)  → autoApply's result for that attempt
 *   firstAttempt          the number of the first attempt here (> 1 after a sweeper requeue)
 *   stillOurs()           false once the user stopped it / the row left `running` / the kill switch is on → stop retrying
 *   alreadySent()         true when another attempt already sent this posting → stop retrying
 *   onAttempt(n), onRetry({ attempt, waitMs, result })   logging hooks
 *   sleep(ms)
 *
 * → { result, attempts, stoppedBy } — `result` is the last attempt's, annotated when the loop ended it.
 */
export async function runSubmitWithRetry({
  attemptFn, firstAttempt = 1, maxAttempts = SUBMIT_MAX_ATTEMPTS, schedule = SUBMIT_RETRY_BACKOFF_MS,
  stillOurs = () => true, alreadySent = () => false, onAttempt = () => {}, onRetry = () => {},
  sleep = (ms) => new Promise(r => setTimeout(r, ms)),
} = {}) {
  let attempt = Math.max(1, firstAttempt);
  let result;
  for (;;) {
    await onAttempt(attempt);
    result = await attemptFn(attempt);
    // Pressed, then the page broke: the one failure that may already have reached the employer.
    if (result?.status === "error" && result.submitPressed === true) {
      return { result: { ...result, reasonCode: SUBMIT_OUTCOME_UNKNOWN, reasonDetail: OUTCOME_UNKNOWN_DETAIL, permanent: true },
        attempts: attempt, stoppedBy: "submit_pressed" };
    }
    const verdict = submitRetryVerdict(result, { attempt, maxAttempts });
    if (!verdict.retry) {
      if (verdict.why === "attempts_spent" && RETRYABLE_SUBMIT_FAILURES.includes(result?.reasonCode) && attempt > 1) {
        result = { ...result, reasonDetail: attemptsSpentDetail(attempt, result.reasonDetail || result.error) };
      }
      return { result, attempts: attempt, stoppedBy: verdict.why };
    }
    const waitMs = backoffBefore(attempt + 1, schedule);
    await onRetry({ attempt, waitMs, result });
    await sleep(waitMs);
    if (!(await stillOurs())) return { result, attempts: attempt, stoppedBy: "stopped" };
    if (await alreadySent()) return { result, attempts: attempt, stoppedBy: "already_sent" };
    attempt++;
  }
}

/**
 * What the sweeper does with a row stuck in `running`.  → { action: "requeue" | "hold", reasonDetail? }
 *   tracked       the row carries a `submit_attempt` event — press tracking was on for it (rows from before this code,
 *                 and rows that died before reaching the browser, are not: what they reached is unknown)
 *   pressed       a `submit_pressed` event exists — Submit may have been pressed
 *   attempts      how many `submit_attempt` events it has
 */
export function stuckSubmitDecision({ tracked, pressed, attempts, maxAttempts = SUBMIT_MAX_ATTEMPTS }) {
  if (pressed) return { action: "hold", reasonDetail:
    "The server stopped right after Submit was pressed, before a confirmation could be read. It may have reached the " +
    "employer — check your email for a confirmation before sending it again." };
  if (!tracked) return { action: "hold", reasonDetail:
    "The server stopped while this application was being prepared, and what it reached is not known. It may or may not " +
    "have reached the employer — check your email before approving it again." };
  if (attempts < maxAttempts) return { action: "requeue" };
  return { action: "hold", reasonDetail:
    `The server stopped while this application was being filled, ${attempts} times. Submit was never pressed, so nothing ` +
    "was sent. Approve it again later, or open it and send it yourself." };
}
