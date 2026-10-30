// ── D100 P2 / P4 · THE APPLY WORKER'S QUEUE, ON DRAFT'S SIDE (docs/APPLY_WORKER.md) ────────────
//
// The worker is a separate service with NO database credentials. It leases ONE remote run over a signed
// API (routes/applyWorker.js), fills the account portal with the same engine and the same gate packet a
// local run built, and REPORTS back; draft decides what that means. draft holds the session only as
// ciphertext sealed to a per-session key the worker minted — it can store it, hand it to the worker, and
// never read it.
//
// A remote run is created where a local run hits an account portal's sign-in wall (held_gate) and the
// user has a live session for that portal — the hook in routes/apply.js createGatePacket. Its mode:
//   fill     fill and STOP at review → Ready to approve (SEMI, D79 §4)
//   submit   fill, verify every value equals the approved one, submit — an approved run, or the user's
//            FULL AUTO standing instruction (D100; submitted_by records which)
// D100's product rules travel with every lease and are enforced again by the worker: a consent box is
// never ticked, a human check is never answered, an eligibility answer is never guessed (→ Needs you).
import { fullAutoDisabled } from "./appSettings.js";
import { userHeld } from "./applyUserHold.js";
import { notifyEvent } from "./notify.js";

export const LEASE_SECONDS = 15 * 60;
export const MAX_ATTEMPTS = 3;
export const REMOTE_STATES = Object.freeze(["queued", "leased", "ready_to_approve", "submitted", "stopped", "failed", "cancelled"]);
export const PRODUCT_RULES = Object.freeze({ tickConsent: false, answerHumanCheck: false, guessEligibility: false });
function userAgreesToTerms(db, userId) {
  try { return JSON.parse(db.prepare(`SELECT auto_settings FROM users WHERE id = ?`).pluck().get(userId) || "{}").agreeToTerms === true; }
  catch { return false; }
}
/** The worker's stop reasons → the run-job's hold reason (a T32-style code the panel already reads, or a new one). */
export const STOP_REASONS = Object.freeze({
  signed_out: "session_signed_out",
  human_check: "human_check",
  consent_required: "consent_required",
  eligibility_unanswered: "needs_you_eligibility",
  value_mismatch: "submit_check_failed",
  portal_changed: "portal_changed",
  // D100 (a): an account draft creates — the portal's own checks stop it, never answered by draft.
  email_verification: "account_email_verification",
  signup_failed: "account_signup_failed",
  signin_failed: "account_signin_failed",
  // 43s (the Amazon run): the portal refused the automated browser (403) · the email already has an account and the user
  // did not choose a reset · the reset could not be completed · the profile carries no email to make an account with.
  portal_blocked: "portal_blocked",
  account_exists: "account_exists",
  reset_not_found: "account_reset_failed",
  reset_failed: "account_reset_failed",
  no_profile_email: "account_no_email",
});

const FAMILY = /^[a-z0-9][a-z0-9_-]{1,39}$/;
const HOST = /^(?=.{3,253}$)[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const now = () => Math.floor(Date.now() / 1000);
const hostOf = (url) => { try { return new URL(url).hostname.toLowerCase(); } catch { return null; } };

// ── portal sessions ──────────────────────────────────────────────────────────────────────────

/** Store a sealed session. The ciphertext is opaque here — draft never parses or decrypts it. */
export function storeSession(db, userId, { portalFamily, originHost, keyId, ciphertext, consent, expiresAt = null }) {
  const fail = (code, message) => Object.assign(new Error(message), { status: 400, code });
  if (consent !== true) throw fail("consent_required", "Consent is recorded per portal before anything is stored.");
  if (!FAMILY.test(String(portalFamily || ""))) throw fail("bad_portal", "A portal family is a short lowercase name.");
  const host = String(originHost || "").toLowerCase();
  if (!HOST.test(host)) throw fail("bad_origin", "The portal's host name is required.");
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(String(keyId || ""))) throw fail("bad_key", "The session key id the worker minted is required.");
  if (typeof ciphertext !== "string" || ciphertext.length < 32 || ciphertext.length > 2_000_000 || !/^[A-Za-z0-9+/=_.:-]+$/.test(ciphertext))
    throw fail("bad_ciphertext", "The sealed session is required, as encoded ciphertext.");
  // One live session per portal per user: a reconnect replaces the old one (its key is destroyed by the caller).
  const replaced = db.prepare(`SELECT id, key_id FROM portal_sessions WHERE user_id = ? AND portal_family = ? AND revoked_at IS NULL`)
    .all(userId, portalFamily);
  db.prepare(`UPDATE portal_sessions SET revoked_at = unixepoch() WHERE user_id = ? AND portal_family = ? AND revoked_at IS NULL`)
    .run(userId, portalFamily);
  const id = db.prepare(`INSERT INTO portal_sessions (user_id, portal_family, origin_host, key_id, ciphertext, consent_at, expires_at)
    VALUES (?, ?, ?, ?, ?, unixepoch(), ?)`).run(userId, portalFamily, host, keyId, ciphertext,
    Number.isInteger(expiresAt) ? expiresAt : null).lastInsertRowid;
  return { id: Number(id), replacedKeyIds: replaced.map(r => r.key_id) };
}

/** The user's portals — status and the use log; never the ciphertext. */
export function listPortals(db, userId, nowSec = now()) {
  return db.prepare(`SELECT id, portal_family, origin_host, consent_at, expires_at, created_at, last_used_at, revoked_at
    FROM portal_sessions WHERE user_id = ? ORDER BY created_at DESC, id DESC`).all(userId).map(s => ({
    id: s.id, portalFamily: s.portal_family, originHost: s.origin_host, connectedAt: s.created_at, lastUsedAt: s.last_used_at,
    expiresAt: s.expires_at,
    status: s.revoked_at ? "removed" : s.expires_at && s.expires_at <= nowSec ? "expired"
      : s.expires_at && s.expires_at - nowSec < 7 * 86400 ? "expiring" : "active",
    uses: db.prepare(`SELECT apply_run_job_id AS runJobId, started_at AS at, outcome FROM portal_session_uses
      WHERE session_id = ? ORDER BY id DESC LIMIT 20`).all(s.id),
  }));
}

/** Mark a session revoked and stop its queued runs. Returns its key id, for the worker to destroy. */
export function revokeSession(db, userId, sessionId) {
  const s = db.prepare(`SELECT id, key_id FROM portal_sessions WHERE id = ? AND user_id = ? AND revoked_at IS NULL`).get(Number(sessionId), userId);
  if (!s) return null;
  db.prepare(`UPDATE portal_sessions SET revoked_at = unixepoch() WHERE id = ?`).run(s.id);
  db.prepare(`UPDATE apply_remote_runs SET state = 'cancelled', outcome = 'session_removed', updated_at = unixepoch()
    WHERE session_id = ? AND state IN ('queued', 'leased')`).run(s.id);
  return { id: s.id, keyId: s.key_id };
}

/** The live session for a page's host, if the user has one (the portal's host or a subdomain of it). */
export function sessionForHost(db, userId, host, nowSec = now()) {
  const h = String(host || "").toLowerCase();
  if (!h) return null;
  return db.prepare(`SELECT * FROM portal_sessions WHERE user_id = ? AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > ?) ORDER BY id DESC`).all(userId, nowSec)
    .find(s => h === s.origin_host || h.endsWith(`.${s.origin_host}`)) || null;
}

// ── portal accounts (D100 (a), owner 10-30) ──────────────────────────────────────────────────
//
// draft creates an account FOR the user on a portal that wants one. The email is the user's own (no alias, D100);
// the WORKER generates the password and seals { email, password } to a key it minted for this account, so draft
// stores ciphertext and never sees the password. The user can always take the account over with the portal's own
// "forgot password" — it is their email.

/** The user's consent for one portal: draft may create (and then use) an account there. Idempotent per portal. */
export function requestAccount(db, userId, { portalFamily, originHost, consent, resetExisting = false }) {
  const fail = (code, message) => Object.assign(new Error(message), { status: 400, code });
  if (consent !== true) throw fail("consent_required", "Consent is recorded per portal before an account is made.");
  if (!FAMILY.test(String(portalFamily || ""))) throw fail("bad_portal", "A portal family is a short lowercase name.");
  const host = String(originHost || "").toLowerCase();
  if (!HOST.test(host)) throw fail("bad_origin", "The portal's host name is required.");
  // ⭐ 43s: when the email already has an account there, reset its password with the portal's own Forgot password
  // (the user's explicit choice, said with the request). Re-requesting can change it; a failed account is retried.
  const reset = resetExisting === true ? 1 : 0;
  const live = db.prepare(`SELECT id, status FROM portal_accounts WHERE user_id = ? AND portal_family = ? AND removed_at IS NULL`).get(userId, portalFamily);
  if (live) {
    db.prepare(`UPDATE portal_accounts SET reset_existing = ?, consent_at = unixepoch(), updated_at = unixepoch(),
      status = CASE WHEN status = 'created' THEN status ELSE 'requested' END WHERE id = ?`).run(reset, live.id);
    return { id: live.id, existing: true };
  }
  const id = db.prepare(`INSERT INTO portal_accounts (user_id, portal_family, origin_host, consent_at, reset_existing) VALUES (?, ?, ?, unixepoch(), ?)`)
    .run(userId, portalFamily, host, reset).lastInsertRowid;
  return { id: Number(id), existing: false };
}

export function accountForHost(db, userId, host) {
  const h = String(host || "").toLowerCase();
  if (!h) return null;
  return db.prepare(`SELECT * FROM portal_accounts WHERE user_id = ? AND removed_at IS NULL AND status != 'failed' ORDER BY id DESC`).all(userId)
    .find(a => h === a.origin_host || h.endsWith(`.${a.origin_host}`)) || null;
}

/** The user's accounts — status only; never the ciphertext. */
export function listAccounts(db, userId) {
  return db.prepare(`SELECT id, portal_family, origin_host, status, created_at, updated_at, last_stop, removed_at
    FROM portal_accounts WHERE user_id = ? ORDER BY id DESC`).all(userId).map(a => ({
    id: a.id, portalFamily: a.portal_family, originHost: a.origin_host, requestedAt: a.created_at,
    status: a.removed_at ? "removed" : a.status, lastStop: a.last_stop,
  }));
}

/** Remove: draft stops using it; the worker destroys its key. The account at the portal stays the user's. */
export function removeAccount(db, userId, accountId) {
  const a = db.prepare(`SELECT id, key_id FROM portal_accounts WHERE id = ? AND user_id = ? AND removed_at IS NULL`).get(Number(accountId), userId);
  if (!a) return null;
  db.prepare(`UPDATE portal_accounts SET removed_at = unixepoch(), ciphertext = NULL, updated_at = unixepoch() WHERE id = ?`).run(a.id);
  db.prepare(`UPDATE apply_remote_runs SET state = 'cancelled', outcome = 'account_removed', updated_at = unixepoch()
    WHERE account_id = ? AND state IN ('queued', 'leased')`).run(a.id);
  return { id: a.id, keyId: a.key_id };
}

/**
 * The worker's account report, before its run report: { remoteId, accountId, outcome: 'created', keyId, ciphertext }
 * or { remoteId, accountId, outcome: 'stopped', reason }. Only for a run this worker holds, on that run's account.
 */
export function acceptAccount(db, report, { workerId = "worker" } = {}) {
  const run = db.prepare(`SELECT * FROM apply_remote_runs WHERE id = ?`).get(Number(report?.remoteId));
  if (!run || run.state !== "leased" || run.worker_id !== String(workerId)) return { ok: false, error: "not_leased_by_you" };
  if (Number(report.accountId) !== run.account_id) return { ok: false, error: "wrong_account" };
  if (report.outcome === "created") {
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(String(report.keyId || "")) || typeof report.ciphertext !== "string" || !/^v1\./.test(report.ciphertext))
      return { ok: false, error: "bad_credential" };
    db.prepare(`UPDATE portal_accounts SET status = 'created', key_id = ?, ciphertext = ?, last_stop = NULL, updated_at = unixepoch()
      WHERE id = ? AND removed_at IS NULL`).run(report.keyId, report.ciphertext, run.account_id);
    return { ok: true, status: "created" };
  }
  if (report.outcome === "stopped") {
    db.prepare(`UPDATE portal_accounts SET last_stop = ?, updated_at = unixepoch() WHERE id = ?`)
      .run(String(report.reason || "stopped").slice(0, 60), run.account_id);
    return { ok: true, status: "stopped" };
  }
  return { ok: false, error: "bad_outcome" };
}

// ── the queue ────────────────────────────────────────────────────────────────────────────────

/**
 * Hand a held run-job to the worker when the user has a session for its portal. Idempotent per run-job.
 * @returns the remote run id, or null when there is no live session for the page (the gated handoff stands).
 */
export function enqueueRemoteRun(db, { userId, runJobId, packetId, applyUrl, approvalMode, approvedValues = null }) {
  const host = hostOf(applyUrl);
  // An uploaded session first; otherwise an account draft created (or may create) for the user on that portal.
  const session = sessionForHost(db, userId, host);
  const account = session ? null : accountForHost(db, userId, host);
  if (!session && !account) return null;
  const mode = approvalMode === "approved" || approvalMode === "auto" ? "submit" : "fill";
  db.prepare(`INSERT INTO apply_remote_runs (user_id, run_job_id, packet_id, session_id, account_id, mode, approved_values_json)
    VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(run_job_id) DO NOTHING`)
    .run(userId, runJobId, packetId ?? null, session?.id ?? null, account?.id ?? null, mode, approvedValues ? JSON.stringify(approvedValues) : null);
  return db.prepare(`SELECT id FROM apply_remote_runs WHERE run_job_id = ?`).pluck().get(runJobId);
}

/**
 * Lease the next remote run, checking — BEFORE anything sealed leaves — the kill switch, the user's Stop
 * everything, a live session, and for an unattended submit the user's FULL AUTO mode.
 * @returns { paused } | { run } | {} (nothing to do)
 */
export function leaseRemoteRun(db, { workerId = "worker", env = process.env, nowSec = now() } = {}) {
  const killed = fullAutoDisabled(db, env);
  const rows = db.prepare(`SELECT ar.*, rj.status AS rj_status, r.approval_mode
    FROM apply_remote_runs ar
    JOIN apply_run_jobs rj ON rj.id = ar.run_job_id
    LEFT JOIN apply_runs r ON r.id = rj.run_id
    WHERE ar.state = 'queued' OR (ar.state = 'leased' AND ar.lease_until < ?)
    ORDER BY ar.id LIMIT 50`).all(nowSec);
  for (const row of rows) {
    if (userHeld(db, row.user_id)) continue;
    // Unattended = a submit nobody approved values for: only the user's FULL AUTO may send it, and the kill switch stops it.
    const unattended = row.mode === "submit" && !row.approved_values_json;
    if (unattended) {
      if (killed) continue;
      const mode = db.prepare(`SELECT send_mode FROM users WHERE id = ?`).pluck().get(row.user_id);
      if (mode !== "auto") { finishRemote(db, row, "stopped", "full_auto_not_chosen"); continue; }
    }
    if (row.attempts >= MAX_ATTEMPTS) { finishRemote(db, row, "failed", "attempts_exhausted"); continue; }
    const session = row.session_id ? db.prepare(`SELECT * FROM portal_sessions WHERE id = ?`).get(row.session_id) : null;
    const account = row.account_id ? db.prepare(`SELECT * FROM portal_accounts WHERE id = ?`).get(row.account_id) : null;
    const sessionLive = session && !session.revoked_at && !(session.expires_at && session.expires_at <= nowSec);
    const accountLive = account && !account.removed_at && account.status !== "failed";
    if (!sessionLive && !accountLive) {
      finishRemote(db, row, "stopped", account ? "account_unavailable" : "session_signed_out"); continue;
    }
    const packet = row.packet_id ? db.prepare(`SELECT apply_url, expected_origin, answers_json, resume_artifact_id FROM apply_gate_packets WHERE id = ?`).get(row.packet_id) : null;
    if (!packet) { finishRemote(db, row, "failed", "packet_missing"); continue; }
    const took = db.prepare(`UPDATE apply_remote_runs SET state = 'leased', worker_id = ?, lease_until = ?, attempts = attempts + 1,
      updated_at = unixepoch() WHERE id = ? AND (state = 'queued' OR (state = 'leased' AND lease_until < ?))`)
      .run(String(workerId).slice(0, 64), nowSec + LEASE_SECONDS, row.id, nowSec);
    if (!took.changes) continue;
    if (sessionLive) {
      db.prepare(`INSERT INTO portal_session_uses (session_id, apply_run_job_id) VALUES (?, ?)`).run(session.id, row.run_job_id);
      db.prepare(`UPDATE portal_sessions SET last_used_at = unixepoch() WHERE id = ?`).run(session.id);
    }
    return { run: {
      // userId is bound into the session's sealing (associated data user · portal · version, D79 §2.3).
      id: row.id, runJobId: row.run_job_id, userId: row.user_id, jobId: db.prepare(`SELECT job_id FROM apply_run_jobs WHERE id = ?`).pluck().get(row.run_job_id),
      mode: row.mode, leaseUntil: nowSec + LEASE_SECONDS,
      applyUrl: packet.apply_url, expectedOrigin: packet.expected_origin,
      packet: JSON.parse(packet.answers_json), resumeArtifactId: packet.resume_artifact_id,
      approvedValues: row.approved_values_json ? JSON.parse(row.approved_values_json) : null,
      session: sessionLive ? { id: session.id, keyId: session.key_id, portalFamily: session.portal_family, originHost: session.origin_host,
                 ciphertext: session.ciphertext } : null,
      // D100 (a): sign in with the account draft made — or, when it is still `requested`, create it first (ciphertext null).
      account: !sessionLive ? { id: account.id, portalFamily: account.portal_family, originHost: account.origin_host,
                 keyId: account.key_id, ciphertext: account.ciphertext, create: account.status !== "created",
                 resetExisting: account.reset_existing === 1 } : null,
      // ⭐ 10-30: the user's own choice decides the terms box (Auto settings agreeToTerms); a human check never.
      rules: { ...PRODUCT_RULES, tickConsent: userAgreesToTerms(db, row.user_id) },
    } };
  }
  return killed && rows.length ? { paused: true } : {};
}

function finishRemote(db, row, state, outcome) {
  db.prepare(`UPDATE apply_remote_runs SET state = ?, outcome = ?, lease_until = NULL, updated_at = unixepoch() WHERE id = ?`)
    .run(state, outcome, row.id);
  db.prepare(`UPDATE portal_session_uses SET outcome = ? WHERE apply_run_job_id = ? AND outcome IS NULL`).run(outcome, row.run_job_id);
}

/** A worker shutting down gives its lease back (not a failed attempt). */
export function releaseRemoteRun(db, remoteId, workerId) {
  return db.prepare(`UPDATE apply_remote_runs SET state = 'queued', lease_until = NULL, attempts = MAX(0, attempts - 1),
    updated_at = unixepoch() WHERE id = ? AND state = 'leased' AND worker_id = ?`).run(Number(remoteId), String(workerId)).changes > 0;
}

/**
 * The worker's report. Shapes:
 *   { remoteId, outcome: 'filled', fields: [{ label, value, source }] }          → Ready to approve
 *   { remoteId, outcome: 'submitted', fields, evidence: { confirmation, url } }   → submitted
 *   { remoteId, outcome: 'stopped', reason: <STOP_REASONS key>, fields? }         → Needs you
 *   { remoteId, outcome: 'error', error }                                         → retried, then failed
 * `hooks.onSubmitted({ userId, jobId, runJobId, submittedBy })` records the application (the same record every
 * other submit writes). Returns { ok, state } or { ok: false, error }.
 */
export function acceptReport(db, report, { workerId = "worker", hooks = {} } = {}) {
  const row = db.prepare(`SELECT ar.*, rj.job_id, rj.run_id, r.approval_mode FROM apply_remote_runs ar
    JOIN apply_run_jobs rj ON rj.id = ar.run_job_id LEFT JOIN apply_runs r ON r.id = rj.run_id
    WHERE ar.id = ?`).get(Number(report?.remoteId));
  if (!row) return { ok: false, error: "unknown_run" };
  if (row.state !== "leased" || row.worker_id !== String(workerId)) return { ok: false, error: "not_leased_by_you" };
  // `key` is the fill engine's own field identity (field_id ?? name ?? label — applyAutomation answerKey): approval and
  // the drift check match on it, so two fields with the same visible label cannot stand in for each other.
  const fields = Array.isArray(report.fields) ? report.fields.slice(0, 500).map(f => ({
    key: String(f?.key ?? f?.label ?? "").slice(0, 300),
    label: String(f?.label ?? "").slice(0, 300), value: f?.value == null ? null : String(f.value).slice(0, 2000),
    source: ["profile", "saved_answer", "posting", "user_now"].includes(f?.source) ? f.source : null,
  })) : null;
  const setRunJob = (status, reason, detail = null) => db.prepare(`UPDATE apply_run_jobs SET status = ?, reason_code = ?, reason_detail = ?,
    finished_at = unixepoch() WHERE id = ? AND status != 'cancelled'`).run(status, reason, detail, row.run_job_id);

  if (report.outcome === "filled") {
    if (row.mode !== "fill") return { ok: false, error: "mode_mismatch" };
    db.prepare(`UPDATE apply_remote_runs SET state = 'ready_to_approve', field_list_json = ?, lease_until = NULL, outcome = 'filled',
      updated_at = unixepoch() WHERE id = ?`).run(JSON.stringify(fields || []), row.id);
    db.prepare(`UPDATE apply_run_jobs SET answers_json = ? WHERE id = ?`)
      .run(JSON.stringify((fields || []).map(f => ({ name: f.label, value: f.value, provenance: f.source }))), row.run_job_id);
    setRunJob("held_review", "awaiting_approval");
    // D100 P4 / D112 item 8: "A job is ready for your approval" — never a company or a value.
    void notifyEvent(row.user_id, "needs_you", { ready: true });
    return { ok: true, state: "ready_to_approve" };
  }
  if (report.outcome === "submitted") {
    if (row.mode !== "submit") return { ok: false, error: "mode_mismatch" };
    // An approved run must have sent exactly the approved values (D79 §4 step 5) — the worker verified; draft checks too.
    if (row.approved_values_json && fields) {
      const want = JSON.parse(row.approved_values_json);
      const got = Object.fromEntries(fields.map(f => [f.key, f.value]));
      const differs = Object.entries(want).find(([k, v]) => got[k] !== v);
      if (differs) {
        finishRemote(db, row, "stopped", "submit_check_failed");
        setRunJob("held_review", "submit_check_failed", `value_mismatch:${differs[0].slice(0, 80)}`);
        void notifyEvent(row.user_id, "needs_you", {});
        return { ok: true, state: "stopped", warning: "reported values differ from the approved ones" };
      }
    }
    const submittedBy = row.approved_values_json ? "user" : "auto";
    db.prepare(`UPDATE apply_remote_runs SET state = 'submitted', field_list_json = ?, lease_until = NULL, outcome = 'submitted',
      updated_at = unixepoch() WHERE id = ?`).run(JSON.stringify(fields || []), row.id);
    db.prepare(`UPDATE apply_run_jobs SET status = 'submitted', reason_code = NULL, submitted_by = ?, submit_verified = ?,
      submit_evidence = ?, finished_at = unixepoch() WHERE id = ?`)
      .run(submittedBy, report.evidence?.confirmation ? 1 : null,
        report.evidence?.confirmation ? String(report.evidence.confirmation).slice(0, 200) : null, row.run_job_id);
    db.prepare(`UPDATE portal_session_uses SET outcome = 'submitted' WHERE apply_run_job_id = ? AND outcome IS NULL`).run(row.run_job_id);
    try { hooks.onSubmitted?.({ userId: row.user_id, jobId: row.job_id, runJobId: row.run_job_id, submittedBy }); } catch {}
    void notifyEvent(row.user_id, "apply_complete", {});
    return { ok: true, state: "submitted" };
  }
  if (report.outcome === "stopped") {
    const reason = STOP_REASONS[report.reason] || "portal_changed";
    if (fields) db.prepare(`UPDATE apply_remote_runs SET field_list_json = ? WHERE id = ?`).run(JSON.stringify(fields), row.id);
    finishRemote(db, row, "stopped", reason);
    setRunJob(reason === "session_signed_out" ? "held_gate" : "held_review", reason);
    void notifyEvent(row.user_id, "needs_you", {});
    return { ok: true, state: "stopped" };
  }
  if (report.outcome === "error") {
    // Any failure leaves the item retryable (D79 §4.7) — never stamped attempted — until the attempts run out.
    if (row.attempts >= MAX_ATTEMPTS) {
      finishRemote(db, row, "failed", "worker_error");
      setRunJob("failed", "worker_error", String(report.error || "").slice(0, 200));
      return { ok: true, state: "failed" };
    }
    db.prepare(`UPDATE apply_remote_runs SET state = 'queued', lease_until = NULL, outcome = ?, updated_at = unixepoch() WHERE id = ?`)
      .run(String(report.error || "error").slice(0, 200), row.id);
    return { ok: true, state: "queued" };
  }
  return { ok: false, error: "bad_outcome" };
}

/** Approving a remote Ready-to-approve run: the worker refills, verifies every value, then submits. */
export function approveRemoteRun(db, userId, runJobId) {
  const row = db.prepare(`SELECT * FROM apply_remote_runs WHERE run_job_id = ? AND user_id = ? AND state = 'ready_to_approve'`).get(Number(runJobId), userId);
  if (!row) return null;
  const values = Object.fromEntries(JSON.parse(row.field_list_json || "[]").map(f => [f.key ?? f.label, f.value]));
  db.prepare(`UPDATE apply_remote_runs SET mode = 'submit', state = 'queued', approved_values_json = ?, attempts = 0,
    updated_at = unixepoch() WHERE id = ?`).run(JSON.stringify(values), row.id);
  db.prepare(`UPDATE apply_run_jobs SET status = 'queued', reason_code = NULL, approved_at = unixepoch() WHERE id = ?`).run(row.run_job_id);
  return { remoteId: row.id, values: Object.keys(values).length };
}
