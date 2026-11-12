import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import {
  runSubmitWithRetry, submitRetryVerdict, backoffSchedule, backoffBefore, SUBMIT_MAX_ATTEMPTS,
  SUBMIT_OUTCOME_UNKNOWN, RETRYABLE_SUBMIT_FAILURES,
} from "../services/submitRetry.js";

// ⭐ A189 (written as A185) · NEXT (agent) 1: a queued Submit that fails on a BROWSER / NETWORK failure is tried again —
// bounded, with backoff, each attempt re-filling from the stored payload — and NEVER twice: an attempt that pressed Submit
// is not retried, and before a re-try the row must still be ours and nothing else may have sent the posting. A refusal,
// a gate, a hold and a CAPTCHA are not failures to retry. Synthetic results; one real-Chrome check that a refused
// connection is classified as the retryable browser failure with Submit never pressed.

const err = (reasonCode, extra = {}) => ({ status: "error", reasonCode, error: `x ${reasonCode}`, permanent: false, submitPressed: false, ...extra });
const ok = { status: "submitted", submitVerified: true, submitEvidence: "confirmation_page" };

test("a189SubmitRetryBackoff: only a browser / network failure before Submit is retryable", () => {
  for (const code of RETRYABLE_SUBMIT_FAILURES) assert.equal(submitRetryVerdict(err(code), { attempt: 1 }).retry, true, code);
  const no = (r, why) => assert.deepEqual(submitRetryVerdict(r, { attempt: 1 }), { retry: false, why });
  no(ok, "not_a_failure");
  no({ status: "held_gate", reasonCode: "captcha_required" }, "not_a_failure");          // ⛔ the person's — never retried
  no({ status: "filled_not_submitted", reasonCode: "submit_unverified" }, "not_a_failure"); // clicked, unconfirmed: may have gone
  no({ status: "held_review", reasonCode: "full_auto_disabled" }, "not_a_failure");
  no({ status: "cancelled", reasonCode: "user_aborted" }, "not_a_failure");
  no(err("browser_error", { submitPressed: true }), "submit_pressed");
  no(err("upstream_api_error"), "not_browser_or_network");
  no(err("internal_error"), "not_browser_or_network");
  no(err("browser_binary_not_found"), "not_browser_or_network");                          // an operator's problem
  no(err("browser_error", { permanent: true }), "permanent");
  assert.deepEqual(submitRetryVerdict(err("browser_timeout"), { attempt: SUBMIT_MAX_ATTEMPTS }), { retry: false, why: "attempts_spent" });
});

test("a189SubmitRetryBackoff: the backoff schedule, and its env override for tests", () => {
  assert.deepEqual(backoffSchedule({}), [10_000, 30_000]);
  assert.deepEqual(backoffSchedule({ DRAFT_SUBMIT_RETRY_BACKOFF_MS: "1,2" }), [1, 2]);
  assert.deepEqual(backoffSchedule({ DRAFT_SUBMIT_RETRY_BACKOFF_MS: "junk" }), [10_000, 30_000]);
  assert.equal(backoffBefore(2, [10, 30]), 10);
  assert.equal(backoffBefore(3, [10, 30]), 30);
  assert.equal(backoffBefore(4, [10, 30]), 30);
});

test("a189SubmitRetryBackoff: a network blip then success → sent on attempt 2, after the first backoff, each attempt logged", async () => {
  const results = [err("browser_error"), ok];
  const slept = [], attempts = [], retries = [];
  const out = await runSubmitWithRetry({
    attemptFn: async () => results.shift(), schedule: [10, 30],
    sleep: async (ms) => { slept.push(ms); },
    onAttempt: (n) => attempts.push(n), onRetry: (r) => retries.push(r.attempt),
  });
  assert.equal(out.result.status, "submitted");
  assert.equal(out.attempts, 2);
  assert.deepEqual(slept, [10]);
  assert.deepEqual(attempts, [1, 2]);
  assert.deepEqual(retries, [1]);
});

test("a189SubmitRetryBackoff: bounded — three failures end failed with a sentence that says nothing was sent", async () => {
  let calls = 0;
  const slept = [];
  const out = await runSubmitWithRetry({ attemptFn: async () => { calls++; return err("browser_timeout"); },
    schedule: [10, 30], sleep: async (ms) => { slept.push(ms); } });
  assert.equal(calls, SUBMIT_MAX_ATTEMPTS);
  assert.deepEqual(slept, [10, 30]);
  assert.equal(out.result.status, "error");
  assert.equal(out.result.reasonCode, "browser_timeout");
  assert.match(out.result.reasonDetail, /Tried 3 times/);
  assert.match(out.result.reasonDetail, /nothing was sent/);
});

test("a189SubmitRetryBackoff: after a sweeper requeue the budget continues — attempt 3 is the last", async () => {
  let calls = 0;
  const out = await runSubmitWithRetry({ firstAttempt: 3, attemptFn: async () => { calls++; return err("browser_error"); }, sleep: async () => {} });
  assert.equal(calls, 1);
  assert.equal(out.stoppedBy, "attempts_spent");
});

test("a189SubmitRetryBackoff: ⛔ never twice — a failure after Submit was pressed is NOT retried and says check your email", async () => {
  let calls = 0;
  const out = await runSubmitWithRetry({ attemptFn: async () => { calls++; return err("browser_error", { submitPressed: true }); }, sleep: async () => {} });
  assert.equal(calls, 1);
  assert.equal(out.result.reasonCode, SUBMIT_OUTCOME_UNKNOWN);
  assert.equal(out.result.permanent, true);
  assert.match(out.result.reasonDetail, /may have been sent/);
  assert.match(out.result.reasonDetail, /check your email/);
});

test("a189SubmitRetryBackoff: ⛔ never twice — re-checked before each re-try: stopped, or already sent elsewhere → no further attempt", async () => {
  let calls = 0;
  const stopped = await runSubmitWithRetry({ attemptFn: async () => { calls++; return err("browser_error"); },
    sleep: async () => {}, stillOurs: () => false });
  assert.equal(calls, 1);
  assert.equal(stopped.stoppedBy, "stopped");
  calls = 0;
  const sent = await runSubmitWithRetry({ attemptFn: async () => { calls++; return err("browser_error"); },
    sleep: async () => {}, alreadySent: () => true });
  assert.equal(calls, 1);
  assert.equal(sent.stoppedBy, "already_sent");
});

test("a189SubmitRetryBackoff: a CAPTCHA / gate / refusal returns at once — one attempt, no sleep", async () => {
  for (const r of [{ status: "held_gate", reasonCode: "captcha_required" }, { status: "held_review", reasonCode: "low_confidence" },
    { status: "filled_not_submitted", reasonCode: "submit_unverified" }]) {
    let calls = 0, slept = 0;
    const out = await runSubmitWithRetry({ attemptFn: async () => { calls++; return r; }, sleep: async () => { slept++; } });
    assert.equal(calls, 1);
    assert.equal(slept, 0);
    assert.equal(out.result, r);
  }
});

test("a189SubmitRetryBackoff: wiring — the route wraps only the mode that clicks; the press mark is written before the click", () => {
  const src = fs.readFileSync("routes/apply.js", "utf8");
  const shadow = src.indexOf('const autoApply = applyMode !== "full" ? autoApplyOnce :');
  assert.ok(shadow > 0, "processRunJob shadows autoApply with the retry for applyMode 'full' only");
  const launch = src.indexOf("await autoApply(jobUrl, autofillPayload", shadow);
  assert.ok(launch > shadow, "the launch sites come after (and so use) the retrying autoApply");
  const body = src.slice(shadow, src.indexOf("// What the human approved", shadow));
  for (const piece of ["SUBMIT_EVENTS.pressed", "SUBMIT_EVENTS.attempt", "SUBMIT_EVENTS.retry", "isAbortRequested(jobId)",
    "fullAutoDisabled()", "userHeld(db, userId)", "status='submitted' AND id != ?"]) assert.ok(body.includes(piece), piece);
  const engine = fs.readFileSync("services/applyAutomation.js", "utf8").replace(/\r\n/g, "\n");
  const press = engine.indexOf("await onSubmitPress();");
  const flag = engine.indexOf("submitPressed = true;", press);
  const click = engine.indexOf("await best.btn.click();", press);
  assert.ok(press > 0 && flag > press && click > flag, "mark → flag → click, in that order");
  assert.match(engine, /permanent: attributed\.permanent,\n\s*\/\/ A189[^\n]*\n\s*submitPressed,/);
});

test("a189SubmitRetryBackoff: real Chrome — a refused connection is the retryable browser failure, Submit never pressed", { timeout: 90_000 }, async (t) => {
  let launchBrowser;
  try { ({ launchBrowser } = await import("../services/browserLauncher.js")); } catch { t.skip("no browser launcher"); return; }
  try { const b = await launchBrowser({ headless: "new", mode: "auto" }); await b.close(); }
  catch (e) { t.skip(`no Chrome on this machine: ${e.message}`); return; }
  // A port nothing listens on: bind, read the port, close.
  const port = await new Promise(r => { const s = http.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); }); });
  const { autoApply } = await import("../services/applyAutomation.js");
  let pressed = 0;
  const result = await autoApply(`http://127.0.0.1:${port}/apply`, { first_name: "Ada", last_name: "Synthetic", email: "ada@example.invalid" },
    { mode: "full", jobId: `a189-retry-${Date.now()}`, onSubmitPress: () => { pressed++; } });
  assert.equal(result.status, "error", JSON.stringify({ status: result.status, reasonCode: result.reasonCode, error: result.error }));
  assert.equal(result.submitPressed, false);
  assert.equal(pressed, 0);
  assert.equal(submitRetryVerdict(result, { attempt: 1 }).retry, true, `retryable: ${result.reasonCode} / ${result.error}`);
});
