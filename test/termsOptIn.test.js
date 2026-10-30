// ⭐ 10-30 (owner): "lift the gates on the terms ticking … let the users decide if they want it, if not they will go
// semi." A portal's terms / privacy / consent box is ticked by the PIPELINE (draft's own runs and the apply worker) only
// when the user switched on Auto settings' `agreeToTerms`; off (the default) it stays theirs and the run stops at Needs
// you. Never a signature, an attestation of truth, or a marketing opt-in. ⛔ A CAPTCHA / human check is NOT lifted:
// automating it is a way around the portal's bot detection — it still stops at Needs you (WORKLOG A103).
import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { buildAnswers, PROVENANCE, CONFIDENCE_BY_PROVENANCE, AUTO_SUBMIT_MIN_CONFIDENCE } from "../services/applyAutomation.js";
import { normaliseAutoSettings, AUTO_DEFAULTS } from "../shared/autoSettings.js";
import { withApplicationDefaults } from "../services/structuredProfile.js";
import { sourceOf } from "../shared/answerSource.js";

const box = (id, label) => ({ field_id: id, name: id, label, type: "checkbox", is_required: true });
const FIELDS = [
  box("tos", "I agree to the Terms of Service and the Privacy Policy"),
  box("gdpr", "I consent to the processing of my data for recruiting purposes"),
  box("cert", "I certify that the information I provided is true and complete"),
  box("sms", "I consent to receive SMS messages about new jobs"),
  box("sig", "Electronic signature: I agree this is my signature"),
];
const ticked = (payload) => buildAnswers(FIELDS, payload).filter(a => a.value != null && !a.skipped).map(a => a.field_id);

test("terms opt-in · OFF (the default): no box is ticked — each stays the person's (Needs you)", () => {
  assert.equal(AUTO_DEFAULTS.agreeToTerms, false);
  assert.deepEqual(ticked({ field_map: {}, handler_map: {}, custom_answers: {} }), []);
  assert.deepEqual(ticked({ field_map: {}, handler_map: {}, custom_answers: {}, agree_to_terms: false }), []);
});

test("terms opt-in · ON: terms, privacy and data-processing consent are ticked — never an attestation, a signature or an opt-in", () => {
  const on = buildAnswers(FIELDS, { field_map: {}, handler_map: {}, custom_answers: {}, agree_to_terms: true });
  assert.deepEqual(on.filter(a => a.value != null && !a.skipped).map(a => a.field_id), ["tos", "gdpr"]);
  const tos = on.find(a => a.field_id === "tos");
  assert.equal(tos.provenance, PROVENANCE.USER_CONSENT_SETTING);
  assert.ok(CONFIDENCE_BY_PROVENANCE.user_consent_setting >= AUTO_SUBMIT_MIN_CONFIDENCE, "the user's own instruction is not a guess");
  assert.equal(sourceOf(tos.provenance), "user_setting");
});

test("terms opt-in · validated whole; carried into the payload from the user's own Auto settings", () => {
  assert.equal(normaliseAutoSettings({ agreeToTerms: "yes" }).ok, false);
  assert.equal(normaliseAutoSettings({ agreeToTerms: true }).value.agreeToTerms, true);
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'dana','x'), (2,'eli','x')").run();
  db.prepare("UPDATE users SET auto_settings = ? WHERE id = 1").run(JSON.stringify({ agreeToTerms: true }));
  const base = { field_map: {}, handler_map: {}, custom_answers: {} };
  assert.equal(withApplicationDefaults(db, 1, base).agree_to_terms, true);
  assert.equal(withApplicationDefaults(db, 2, base).agree_to_terms, false, "another user's choice is not yours");
});

test("terms opt-in · the apply worker's lease carries THIS user's choice; a human check is never lifted", async () => {
  const { enqueueRemoteRun, storeSession, leaseRemoteRun, PRODUCT_RULES } = await import("../services/applyWorker.js");
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,auto_settings) VALUES (1,'dana','x',?)").run(JSON.stringify({ agreeToTerms: true }));
  storeSession(db, 1, { portalFamily: "exampleportal", originHost: "portal.example.test", keyId: "key_abcdef123456",
    ciphertext: "c2VhbGVkLWNpcGhlcnRleHQtbm90LXJlYWRhYmxlLWJ5LWRyYWZ0LWF0LWFsbA==", consent: true });
  const run = db.prepare("INSERT INTO apply_runs (user_id,mode,status,total_jobs,approval_mode) VALUES (1,'auto','completed',1,'required')").run().lastInsertRowid;
  const rj = Number(db.prepare("INSERT INTO apply_run_jobs (run_id,user_id,job_id,status) VALUES (?,1,'w::1','held_gate')").run(run).lastInsertRowid);
  const pk = Number(db.prepare(`INSERT INTO apply_gate_packets (user_id, run_id, run_job_id, job_id, apply_url, expected_origin, gate_reason, answers_json, token_hash, expires_at)
    VALUES (1,?,?,'w::1','https://a.portal.example.test/x','https://a.portal.example.test','login_required','{"answers":[]}','t1',0)`).run(run, rj).lastInsertRowid);
  enqueueRemoteRun(db, { userId: 1, runJobId: rj, packetId: pk, applyUrl: "https://a.portal.example.test/x", approvalMode: "required" });
  const { run: lease } = leaseRemoteRun(db, { workerId: "w", env: {} });
  assert.deepEqual(lease.rules, { tickConsent: true, answerHumanCheck: false, guessEligibility: false });
  assert.equal(PRODUCT_RULES.answerHumanCheck, false);
});
