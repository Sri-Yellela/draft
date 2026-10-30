// apply-worker/lib/run.js — ⭐ D100 P2 · ONE LEASED RUN: unseal in memory → the SAME fill engine → a report.
//
// ⛔ d100OneFillEngine: the fill is services/applyAutomation.js autoApply — imported, never copied. The worker adds
// only what draft's own runs do not need: the session decrypted in memory (autoApply's `storageState`, never a
// file), the approved values as the engine's own drift check, and the mapping of the engine's result to a report.
// D100's product rules are the engine's own: a consent / terms box is never answered (buildAnswers' refusals), a
// human check stops the run (detectGate → captcha_required), an eligibility question is never guessed.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { aadFor } from "./keys.js";
import { sessionFromAccount } from "./accounts.js";
import { sourceOf } from "../../shared/answerSource.js";


/** The engine's answers → the report's field list: labels and values, never pixels. */
export function fieldList(answers = []) {
  return (Array.isArray(answers) ? answers : []).filter(a => a && !a.skipped && a.value != null).map(a => ({
    key: String(a.field_id ?? a.name ?? a.label ?? ""),
    label: String(a.label ?? a.name ?? a.field_id ?? ""),
    value: String(a.value),
    // D104 P2: shared/answerSource.js — a guess has no source and is never dressed as the profile's.
    source: sourceOf(a.provenance),
  }));
}

const CONSENT = /\b(consent|agree|terms|privacy|attest|acknowledge|certif|signature)\b/i;
const ELIGIBILITY = /authori[sz]|sponsor|citizen|clearance|criminal|convict|visa/i;

/**
 * The engine's result → { outcome, reason?, fields?, evidence?, error? } (services/applyWorker.js acceptReport).
 * Pure; a screenshot the engine returned is DROPPED here whatever APPLY_NO_SCREENSHOTS says.
 */
export function reportFor(lease, result) {
  const fields = fieldList(result?.answers);
  const s = result?.status;
  if (s === "submitted") {
    return { remoteId: lease.id, outcome: "submitted", fields,
      evidence: { confirmation: result.submitEvidence ? String(result.submitEvidence).slice(0, 200) : null } };
  }
  if (s === "preview_ready" && lease.mode === "fill") return { remoteId: lease.id, outcome: "filled", fields };
  if (s === "held_gate") {
    return { remoteId: lease.id, outcome: "stopped", fields,
      reason: result.reasonCode === "captcha_required" ? "human_check" : "signed_out" };
  }
  if (s === "cancelled") return { remoteId: lease.id, outcome: "error", error: "cancelled" };
  if (s === "error") return { remoteId: lease.id, outcome: "error", error: String(result.reasonCode || result.error || "error").slice(0, 200) };
  if (result?.reasonCode === "answers_changed_since_approval") return { remoteId: lease.id, outcome: "stopped", reason: "value_mismatch", fields };
  // Held for the person: name WHY when the open questions say so — a consent box, an eligibility answer.
  const open = (result?.openQuestions || []).map(q => String(q?.question ?? q?.label ?? q)).join(" ");
  const reason = CONSENT.test(open) ? "consent_required" : ELIGIBILITY.test(open) ? "eligibility_unanswered" : "portal_changed";
  return { remoteId: lease.id, outcome: "stopped", reason, fields };
}

/**
 * Run one lease. deps: { autoApply, keys, fetchResume(remoteId) → Buffer|null,
 *   openPage() → { page, close } and postAccount(report) — D100 (a), for a lease that carries an account }
 * The session is unsealed (or signed in to) into memory and handed to the engine as an object; the résumé (not
 * secret to the portal) is the one temp file, removed in `finally`.
 */
export async function runLease(lease, { autoApply, keys, fetchResume, openPage = null, postAccount = null, getCode = null }) {
  let storageState;
  if (lease.session) {
    try {
      const json = keys.unseal({ keyId: lease.session.keyId, sealed: lease.session.ciphertext,
        aad: aadFor({ userId: lease.userId, portalFamily: lease.session.portalFamily }) });
      storageState = JSON.parse(json);
    } catch (e) {
      // A destroyed key (revoked) or a session sealed for someone else: the user signs in again.
      return { remoteId: lease.id, outcome: "stopped", reason: "signed_out", error: e.code || "unseal_failed" };
    }
  } else if (lease.account && openPage && postAccount) {
    // D100 (a): an account draft made (or makes now) for the user — signed in here, the cookies kept in memory.
    try {
      const r = await sessionFromAccount(lease, { keys, openPage, postAccount, getCode: getCode ? () => getCode(lease.id) : null });
      if (r.stopped) return { remoteId: lease.id, outcome: "stopped", reason: r.stopped };
      storageState = r.storageState;
    } catch (e) {
      return { remoteId: lease.id, outcome: "error", error: String(e?.message || e).slice(0, 200) };
    }
  } else {
    return { remoteId: lease.id, outcome: "stopped", reason: "signed_out" };
  }
  let resumePath = null;
  try {
    const pdf = await fetchResume(lease.id).catch(() => null);
    if (pdf) {
      resumePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "aw-")), "resume.pdf");
      fs.writeFileSync(resumePath, pdf, { mode: 0o600 });
    }
    const approvedAnswers = lease.approvedValues
      ? Object.entries(lease.approvedValues).map(([field_id, value]) => ({ field_id, value }))
      : null;
    const result = await autoApply(lease.applyUrl, lease.autofillData || {}, {
      // fill → stop at review (the engine's preview); submit → send, with the approved values as its drift check
      mode: lease.mode === "fill" ? "preview" : "full",
      storageState, approvedAnswers, resumePath,
      jobId: `remote_${lease.id}`,
    });
    return reportFor(lease, result);
  } catch (e) {
    return { remoteId: lease.id, outcome: "error", error: String(e?.message || e).slice(0, 200) };
  } finally {
    storageState = null;
    if (resumePath) { try { fs.rmSync(path.dirname(resumePath), { recursive: true, force: true }); } catch {} }
  }
}
