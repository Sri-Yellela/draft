// services/challengeRerun.js — ⭐ A186-CAPTCHA (1b) · SOLVE IT WHENEVER YOU COME BACK (owner 11-12: "5 min doesnt help,
// people get back whenever and they should be able to do it, a rerun is fine but shouldnt cost too much time cause it has
// all the pieces ready").
//
// A run that met a visible check after Submit and nobody solved it in time ends held (`held_gate` / `captcha_required`).
// That row stays solvable with NO deadline: *Solve it here* on it starts a FAST RE-RUN from what the first run already
// made — the answers it typed (answers_json, which is also the approved set: the re-run refuses to submit anything that
// differs, autoApply's drift gate) and the résumé file it attached (resume_artifact_id → the same HTML → a PDF). A fresh
// browser opens the form, fills it from that, presses Submit, meets the check and opens the live session THEN — the person
// is already watching, so the five minutes start when they are there.
//
// ⛔ NO MODEL CALL, NO RE-TAILORING, NO NEW DRAFT (A181 (a)): this module is never handed the résumé generator, the
//    free-text drafter or the cover-letter writer, and it never starts a run (startRun is where a draft is counted).
// ⛔ NOTHING HERE SOLVES, BYPASSES OR OUTSOURCES A CHALLENGE — the live session streams pixels out and takes the person's
//    own clicks in (services/liveChallenge.js). The test challenge in the tests is answered by the test, standing in for
//    the person.
// ⛔ NEVER TWICE: a row already sent (this job submitted on another row, or recorded in job_applications) is refused, and
//    the row is moved to submitted only `WHERE status = 'held_gate'`.
//
//   createChallengeRerun(deps) → { start, enqueue, stop, statusOf, heldChecks, _reset }
//   heldChecksOf(db, userId)   → the person's held checks, newest first
//   challengeKindOf(page)      → 'recaptcha' | 'hcaptcha' | 'turnstile' | 'other' — from the frames' addresses only
//   withChallengeLog(live, …)  → logs the outcome of a live session by kind (Admin's counts)
//   challengeKindCounts(db)    → Admin: seen / solved / timed out / no live view, per kind

import { writeFileSync, unlinkSync } from "node:fs";

export const HELD_CHECK = Object.freeze({ status: "held_gate", reasonCode: "captcha_required" });
export const MAX_RERUNS = 3;            // a re-run holds a browser (~150 MB); the live sessions cap at 3 too
export const CHALLENGE_EVENTS = Object.freeze(["challenge_live", "challenge_no_live"]);

const parse = (s, d) => { try { return s == null ? d : JSON.parse(s); } catch { return d; } };

/** The person's held checks — newest first, at most 25. */
export function heldChecksOf(db, userId) {
  return db.prepare(`
    SELECT rj.id, rj.job_id, rj.finished_at, rj.created_at, sj.title, sj.company
    FROM apply_run_jobs rj LEFT JOIN scraped_jobs sj ON sj.job_id = rj.job_id
    WHERE rj.user_id = ? AND rj.status = ? AND rj.reason_code = ? AND rj.hidden_at IS NULL
      AND rj.answers_json IS NOT NULL   -- a check met before the form has nothing to re-fill from
    ORDER BY rj.id DESC LIMIT 25
  `).all(userId, HELD_CHECK.status, HELD_CHECK.reasonCode).map(r => ({
    runJobId: r.id, jobId: String(r.job_id), title: r.title ?? null, company: r.company ?? null,
    heldAt: Number(r.finished_at || r.created_at) || null,
  }));
}

/**
 * The stored pieces of one held check, or { error }. Reads only: the row, its answers, its résumé's HTML.
 * → { row, answers, html }
 */
export function storedPieces(db, userId, runJobId) {
  const id = Number(runJobId);
  if (!Number.isInteger(id) || id <= 0) return { error: "not_found", status: 404 };
  const row = db.prepare(`SELECT * FROM apply_run_jobs WHERE id = ? AND user_id = ?`).get(id, userId);
  if (!row) return { error: "not_found", status: 404, message: "That application isn't yours, or it no longer exists." };
  if (row.status !== HELD_CHECK.status || row.reason_code !== HELD_CHECK.reasonCode) {
    return { error: "not_held_on_a_check", status: 409, message: "This application isn't waiting on a check any more." };
  }
  const sentElsewhere = db.prepare(`SELECT 1 FROM apply_run_jobs WHERE user_id = ? AND job_id = ? AND status = 'submitted' LIMIT 1`)
    .get(userId, row.job_id);
  let recorded = null;
  try { recorded = db.prepare(`SELECT 1 FROM job_applications WHERE user_id = ? AND job_id = ? LIMIT 1`).get(userId, String(row.job_id)); }
  catch { /* no table in a bare harness — the run-job check above still holds */ }
  if (sentElsewhere || recorded) return { error: "already_sent", status: 409, message: "This job is already in your Submitted applications — nothing was sent again." };
  const answers = parse(row.answers_json, null);
  if (!Array.isArray(answers) || !answers.some(a => a && !a.skipped && a.value != null && String(a.value) !== "")) {
    return { error: "no_stored_answers", status: 409, message: "The first run kept no answers to re-fill from — use Run again." };
  }
  const html = row.resume_artifact_id == null ? null
    : db.prepare(`SELECT html FROM resumes WHERE id = ? AND user_id = ?`).pluck().get(row.resume_artifact_id, userId) ?? null;
  if (!html) return { error: "no_stored_resume", status: 409, message: "The résumé the first run attached is gone — use Run again." };
  return { row, answers, html };
}

/**
 * The first run's typed answers as `drafted_answers` (label → value): autoApply reads them only where nothing else
 * resolved a field — so the free-text answers the first run drafted with the model are reused, not drafted again.
 */
export function draftedFromAnswers(answers) {
  const out = {};
  for (const a of Array.isArray(answers) ? answers : []) {
    if (!a || a.skipped || a.policy_rejected || a.type === "file") continue;
    const label = typeof a.label === "string" ? a.label.trim() : "";
    if (!label || a.value == null || typeof a.value === "object") continue;
    const v = String(a.value);
    if (v && !(label in out)) out[label] = v;
  }
  return out;
}

/** Which kind of check is on the page — from the frames' ADDRESSES only (nothing is read inside a check). */
export async function challengeKindOf(page) {
  let urls = [];
  try { urls = (page?.frames?.() || []).map(f => { try { return f.url(); } catch { return ""; } }); } catch { urls = []; }
  const all = urls.join(" ").toLowerCase();
  if (/hcaptcha\.com|\/hcaptcha/.test(all)) return "hcaptcha";
  if (/challenges\.cloudflare\.com|turnstile/.test(all)) return "turnstile";
  if (/recaptcha/.test(all)) return "recaptcha";
  return "other";
}

/** Wraps a live session so its outcome is logged by kind (Admin's counts). Returns the same object. */
export function withChallengeLog(live, { kind = "other", log = () => {} } = {}) {
  if (!live || typeof live.waitForOutcome !== "function") return live;
  const wait = live.waitForOutcome.bind(live);
  live.waitForOutcome = async (...args) => {
    const outcome = await wait(...args);
    try { log("challenge_outcome", { kind, outcome }); } catch { /* a log line never changes the run */ }
    return outcome;
  };
  return live;
}

/** Admin · counting by challenge kind over the last `days` days, plus how many held checks wait now. */
export function challengeKindCounts(db, { days = 30, nowSec = Math.floor(Date.now() / 1000) } = {}) {
  const since = nowSec - Math.max(1, Number(days) || 30) * 86400;
  const kinds = new Map();
  const at = (k) => { if (!kinds.has(k)) kinds.set(k, { kind: k, seen: 0, solved: 0, timedOut: 0, noLive: 0, reruns: 0 }); return kinds.get(k); };
  const rows = db.prepare(`
    SELECT event, details_json FROM apply_job_logs
    WHERE created_at >= ? AND event IN ('challenge_live', 'challenge_no_live', 'challenge_outcome')
  `).all(since);
  for (const r of rows) {
    const d = parse(r.details_json, {}) || {};
    const k = typeof d.kind === "string" && d.kind ? d.kind : "other";
    const c = at(k);
    if (r.event !== "challenge_outcome" && d.rerun) c.reruns++;   // met again by a Solve it here re-run
    if (r.event === "challenge_live") c.seen++;
    else if (r.event === "challenge_no_live") { c.seen++; c.noLive++; }
    else if (d.outcome === "submitted") c.solved++;
    else if (d.outcome === "timeout") c.timedOut++;
  }
  const waiting = db.prepare(`SELECT COUNT(*) FROM apply_run_jobs WHERE status = ? AND reason_code = ? AND hidden_at IS NULL`)
    .pluck().get(HELD_CHECK.status, HELD_CHECK.reasonCode);
  return { days: Math.max(1, Number(days) || 30), kinds: [...kinds.values()].sort((a, b) => b.seen - a.seen), waiting };
}

/**
 * The re-runner. Every dependency is handed in (routes/apply.js wires the real ones), so the tests can prove what it
 * never calls. Nothing here is given a model.
 *
 * deps:
 *   db, autoApply(url, payload, options), htmlToPdf(html) → Buffer,
 *   payloadFor({ userId, jobId, job }) → the autofill payload (deterministic: the profile, no model),
 *   jobUrlFor({ userId, jobId, job }) → the address the first run opened,
 *   registerChallenge(opts) → live | null, submitBlocker() → reason | null, refuse(userId) → { error, message } | null,
 *   onSubmitted({ userId, runJobId, jobId, runId, result }), logEvent(runId, runJobId, userId, jobId, event, msg, details),
 *   tmpPath(userId, jobId), derivedLabelMaps(), timeoutMs
 */
const OWN_BROWSER_REASONS = new Set(["server_submit_paused", "flagged_spam"]);   // A187

export function createChallengeRerun(deps) {
  const {
    db, autoApply, htmlToPdf, payloadFor, jobUrlFor, registerChallenge,
    submitBlocker = () => null, refuse = () => null, onSubmitted = () => {}, onEnded = () => {}, onOutcome = () => {},
    logEvent = () => {}, tmpPath, derivedLabelMaps = () => undefined, timeoutMs, coverLetterFor = null,
    now = () => Date.now(),
  } = deps;
  const runs = new Map();     // String(runJobId) -> entry (kept a while after it ends, so the client reads the outcome)
  const queues = new Map();   // String(userId) -> [runJobId, ...]
  const active = () => [...runs.values()].filter(e => !e.endedAt).length;
  const activeOf = (userId) => [...runs.values()].find(e => !e.endedAt && String(e.userId) === String(userId)) || null;

  const publicEntry = (e) => ({
    runJobId: e.runJobId, jobId: e.jobId, state: e.state, startedAt: e.startedAt, liveAt: e.liveAt ?? null,
    endedAt: e.endedAt ?? null, outcome: e.outcome ?? null, message: e.message ?? null,
    msToLive: e.liveAt ? e.liveAt - e.startedAt : null,
  });

  function prune() {
    const cut = now() - 10 * 60 * 1000;
    for (const [k, e] of runs) if (e.endedAt && e.endedAt < cut) runs.delete(k);
  }

  async function execute(entry, pieces) {
    const { row, answers, html } = pieces;
    const { userId, runJobId, jobId } = entry;
    const runId = row.run_id;
    let tmp = null, clTmp = null;
    try {
      const job = db.prepare(`SELECT * FROM scraped_jobs WHERE job_id = ?`).get(String(jobId)) || null;
      const url = jobUrlFor({ userId, jobId, job });
      if (!url) throw Object.assign(new Error("This job has no address to open."), { code: "no_job_url" });
      // The same résumé the first run attached — its stored HTML made into a PDF again (no generation).
      const pdf = await htmlToPdf(html);
      tmp = tmpPath(userId, jobId);
      writeFileSync(tmp, pdf);
      const payload = { ...(payloadFor({ userId, jobId, job }) || {}) };
      payload.drafted_answers = { ...draftedFromAnswers(answers), ...(payload.drafted_answers || {}) };
      entry.state = "filling";
      // 46j: a cover letter on demand (a form with a cover-letter upload stopped short of Submit without one).
      const coverLetterOnDemand = typeof coverLetterFor === "function" ? coverLetterFor({ userId, jobId, onFile: (f) => { clTmp = f; } }) : undefined;
      const result = await autoApply(url, payload, {
        mode: "full", jobId, resumePath: tmp, coverLetterOnDemand,
        approvedAnswers: answers,          // the drift gate: nothing that differs from what the first run typed is sent
        derivedLabelMaps: derivedLabelMaps(),
        submitBlocker: (platform) => submitBlocker(platform, { userId, jobId, url }),   // A187: the ATS + this job
        onChallenge: async ({ page }) => {
          const kind = await challengeKindOf(page);
          const live = await registerChallenge({ runJobId, userId, jobId, page, timeoutMs });
          entry.liveAt = now();
          entry.state = live ? "live" : "no_live";
          logEvent(runId, runJobId, userId, jobId, live ? "challenge_live" : "challenge_no_live",
            live ? "Solve it here: the form is filled again and the check is open for you."
                 : "Solve it here: the check came up again and no live view could open — finish it in your own browser.",
            { kind, rerun: true, msToLive: entry.liveAt - entry.startedAt });
          return withChallengeLog(live, { kind, log: (ev, d) => logEvent(runId, runJobId, userId, jobId, ev, `The check ended: ${d.outcome}`, { ...d, rerun: true }) });
        },
      });
      try { onOutcome({ userId, jobId, runJobId, runId, url, result }); } catch {}   // A187 S3: counted by ATS
      if (result?.status === "submitted") {
        entry.outcome = "submitted";
        entry.message = "Sent — it's in your Submitted applications.";
        onSubmitted({ userId, runJobId, jobId, runId, result });
      } else if (result?.status === "held_gate" && result?.reasonCode === "captcha_required") {
        entry.outcome = result.submitEvidence === "captcha_timeout" ? "timeout" : "check_again";
        entry.message = entry.outcome === "timeout"
          ? "The check wasn't finished in time. Nothing was sent — Solve it here again whenever you're ready."
          : "The check came up and no live view could open. Nothing was sent — try again in a minute.";
        try { db.prepare(`UPDATE apply_run_jobs SET submit_evidence = ? WHERE id = ? AND status = ?`).run(result.submitEvidence || null, runJobId, HELD_CHECK.status); } catch {}
      } else if (result?.reasonCode === "flagged_spam" || result?.reasonCode === "server_submit_paused") {
        // ⭐ A187: the employer's site flags submits from draft's servers — send it from your own browser instead.
        entry.outcome = "own_browser";
        entry.message = result.reasonCode === "flagged_spam"
          ? "The employer's site flagged the submit from draft's servers as possible spam, so nothing was sent. It's ready in your extension — Open & fill, then one press of Submit application sends it from your browser."
          : "This employer's site flags applications sent from draft's servers, so nothing was sent from here. Open & fill — one press of Submit application in the extension sends it from your browser.";
      } else if (result?.reasonCode === "answers_changed_since_approval") {
        entry.outcome = "form_changed";
        entry.message = "The form asks something different now, so nothing was sent. Use Run again for a fresh draft of it.";
      } else {
        entry.outcome = "not_sent";
        // 46j: name the required fields it could not fill (labels only), so the row and the log say WHY.
        const missing = (Array.isArray(result?.missingRequired) ? result.missingRequired : []).map(m => String(m?.label || m?.name || m || "").trim()).filter(Boolean).slice(0, 5);
        entry.missing = missing;
        entry.message = missing.length
          ? `Nothing was sent — the form still needed: ${missing.map(m => `"${m.slice(0, 80)}"`).join(", ")}. It stays here — try again, or Open & fill.`
          : `Nothing was sent (${result?.reasonCode || result?.status || "no result"}). It stays here — try again, or Open & fill.`;
        console.log(`[solve-check] run job ${runJobId}: not sent (${result?.reasonCode || result?.status}) missing=${JSON.stringify(missing)}`);
      }
      logEvent(runId, runJobId, userId, jobId, "challenge_rerun_done", entry.message,
        { outcome: entry.outcome, status: result?.status ?? null, reasonCode: result?.reasonCode ?? null, msToLive: entry.liveAt ? entry.liveAt - entry.startedAt : null });
    } catch (e) {
      entry.outcome = "error";
      entry.message = `Nothing was sent — the re-run stopped: ${String(e?.message || e).slice(0, 160)}`;
      logEvent(runId, runJobId, userId, jobId, "challenge_rerun_done", entry.message, { outcome: "error", code: e?.code || null });
    } finally {
      if (tmp) { try { unlinkSync(tmp); } catch {} }
      if (clTmp) { try { unlinkSync(clTmp); } catch {} }
      entry.endedAt = now();
      entry.state = "done";
      try { onEnded(entry); } catch {}
      next(userId);
    }
  }

  /** Start one held check's re-run now. → { status, body } */
  function start(userId, runJobId, { fromQueue = false } = {}) {
    prune();
    const key = String(runJobId);
    const running = runs.get(key);
    if (running && !running.endedAt) return { status: 202, body: { ok: true, already: true, rerun: publicEntry(running) } };
    const pieces = storedPieces(db, userId, runJobId);
    if (pieces.error) return { status: pieces.status, body: { error: pieces.error, message: pieces.message } };
    const own = activeOf(userId);
    if (own && !fromQueue) {
      // One at a time per person (the batch queue lines the rest up behind it).
      const q = queues.get(String(userId)) || [];
      if (!q.includes(Number(runJobId))) q.push(Number(runJobId));
      queues.set(String(userId), q);
      return { status: 202, body: { ok: true, queued: true, position: q.length, message: "Queued — it opens as soon as the one before it is done." } };
    }
    if (active() >= MAX_RERUNS) return { status: 429, body: { error: "busy", message: "draft is opening other checks right now — try again in a minute." } };
    // A187 S1 / S2: told the ATS and the job, so an Ashby form or a flagged job is refused here, not after a browser opens.
    let ctxUrl = null;
    try { const j = db.prepare(`SELECT * FROM scraped_jobs WHERE job_id = ?`).get(String(pieces.row.job_id)) || null; ctxUrl = jobUrlFor({ userId, jobId: pieces.row.job_id, job: j }); } catch {}
    const blocked = submitBlocker(null, { userId, jobId: String(pieces.row.job_id), url: ctxUrl }) || null;
    if (blocked) return { status: 409, body: { error: blocked, message: OWN_BROWSER_REASONS.has(blocked)
      ? "This employer's site flags applications sent from draft's servers, so it can't be sent from here. It's ready in your extension — Open & fill, then one press of Submit application sends it from your browser."
      : "Automatic sending is paused right now, so the form can't be sent from here. Open & fill still works." } };
    const refused = refuse(userId);
    if (refused) return { status: 409, body: refused };
    const entry = { runJobId: Number(runJobId), userId, jobId: String(pieces.row.job_id), state: "opening", startedAt: now() };
    runs.set(key, entry);
    logEvent(pieces.row.run_id, entry.runJobId, userId, entry.jobId, "challenge_rerun_started",
      "Solve it here: re-filling the form from what the first run made (no new draft, nothing re-written).",
      { answers: pieces.answers.length, resumeArtifactId: pieces.row.resume_artifact_id, kind: null });
    // Fire and forget: the client polls the state (GET /api/apply/live) and opens the live view when it appears.
    Promise.resolve().then(() => execute(entry, pieces)).catch(() => {});
    return { status: 202, body: { ok: true, rerun: publicEntry(entry) } };
  }

  function next(userId) {
    const q = queues.get(String(userId));
    while (q && q.length) {
      const id = q.shift();
      const r = start(userId, id, { fromQueue: true });
      if (r.status === 202 && !r.body.queued) break;
    }
    if (q && !q.length) queues.delete(String(userId));
  }

  /** (2) The batch queue: every held check given (or all of the person's), one after another. */
  function enqueue(userId, runJobIds = null) {
    const mine = heldChecksOf(db, userId).map(h => h.runJobId).reverse();   // oldest first
    const wanted = Array.isArray(runJobIds) && runJobIds.length ? mine.filter(id => runJobIds.map(Number).includes(id)) : mine;
    if (!wanted.length) return { status: 409, body: { error: "nothing_held", message: "No application is waiting on a check." } };
    const q = queues.get(String(userId)) || [];
    const running = activeOf(userId);
    for (const id of wanted) if (!q.includes(id) && (!running || running.runJobId !== id)) q.push(id);
    queues.set(String(userId), q);
    let first = null;
    if (!running) { const id = q.shift(); first = start(userId, id, { fromQueue: true }); if (first.status !== 202) next(userId); }
    if (!q.length) queues.delete(String(userId));
    return { status: 202, body: { ok: true, queued: (queues.get(String(userId)) || []).length, started: first?.body?.rerun || null,
      ...(first && first.status !== 202 ? { firstRefused: first.body } : {}) } };
  }

  /** Empty the person's queue (the one in progress finishes). */
  function stop(userId) { const n = (queues.get(String(userId)) || []).length; queues.delete(String(userId)); return n; }

  /** What the client polls: the person's re-runs (in progress, or ended in the last 10 minutes) and the queue. */
  function statusOf(userId) {
    prune();
    return {
      reruns: [...runs.values()].filter(e => String(e.userId) === String(userId)).map(publicEntry),
      queue: [...(queues.get(String(userId)) || [])],
    };
  }

  return { start, enqueue, stop, statusOf, heldChecks: (userId) => heldChecksOf(db, userId), _reset: () => { runs.clear(); queues.clear(); } };
}
