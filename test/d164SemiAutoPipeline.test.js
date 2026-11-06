// ⭐ D164 T3 (owner 11-05) · THE SUPERVISED FLOW, mode "Ask me first" (SEMI, users.send_mode NULL / 'semi'):
//   1 Draft the posting → 2 the résumé (generated on the posting, or at approval) → 3 the worker fills → 4 the application
//   waits as Ready to send in the tracker → 5 only the user's "Approve & send" submits → 6 Sent.
// ⛔ In Ask me first the worker never submits; consent boxes are left for the person (D100; 10-30's agreeToTerms is the
// user's own opt-in, OFF by default); a question only the person can answer stops the flow as Needs you.
//
// Measured, not rebuilt: the pipeline already holds these rules (routes/apply.js startRun / processRunJob,
// services/applyWorker.js lease / report / approve, services/applyAutomation.js buildAnswers). These tests pin them end
// to end on synthetic data so the owner's walk (T4) rests on them. Synthetic user, synthetic portal (portal.example.test).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import applyRoutes from "../routes/apply.js";
import { storeGeneratedResume } from "../services/generatedResumes.js";
import {
  enqueueRemoteRun, storeSession, leaseRemoteRun, acceptReport, approveRemoteRun, PRODUCT_RULES, STOP_REASONS,
} from "../services/applyWorker.js";
import { buildAnswers } from "../services/applyAutomation.js";
import { commitDecision, DECISION_SURFACES } from "../client/src/lib/jobDecisions.js";
import { DECISIONS } from "../client/src/lib/deckState.js";
import { buildNodes } from "../client/src/lib/draftHouseTree.js";
import { stageOfNode, STAGES } from "../client/src/lib/trackerRows.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const apply = read("routes/apply.js");
const CT = "c2VhbGVkLWNpcGhlcnRleHQtbm90LXJlYWRhYmxlLWJ5LWRyYWZ0LWF0LWFsbA==";

function freshDb({ sendMode = null, autoSettings = null } = {}) {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'robin','x','PRO')").run();
  db.prepare("UPDATE users SET send_mode = ?, auto_settings = ? WHERE id = 1").run(sendMode, autoSettings ? JSON.stringify(autoSettings) : null);
  db.prepare("INSERT INTO domain_profiles (id,user_id,profile_name,role_family,domain,is_active) VALUES (10,1,'Platform','engineering','software',1)").run();
  db.prepare("INSERT INTO user_profile (user_id,first_name,last_name,email) VALUES (1,'Robin','Example','robin@example.test')").run();
  db.prepare("INSERT INTO profile_base_resumes (profile_id,user_id,name,content,updated_at) VALUES (10,1,'r.txt','synthetic base',unixepoch() - 60)").run();
  storeSession(db, 1, { portalFamily: "exampleportal", originHost: "acme.portal.example.test", keyId: "key_abcdef123456", ciphertext: CT, consent: true });
  return db;
}
let n = 0;
/** A drafted job parked at the portal's gate, with its gate packet (what a local run leaves for the worker). */
function parked(db, { approval = "required", answers = [{ label: "First Name", value: "Robin" }] } = {}) {
  const run = db.prepare("INSERT INTO apply_runs (user_id,mode,status,total_jobs,approval_mode) VALUES (1,'auto','completed',1,?)").run(approval).lastInsertRowid;
  const job = `semi::${++n}`;
  const rj = Number(db.prepare("INSERT INTO apply_run_jobs (run_id,user_id,job_id,status,reason_code) VALUES (?,1,?,'held_gate','login_required')").run(run, job).lastInsertRowid);
  const packetId = Number(db.prepare(`INSERT INTO apply_gate_packets (user_id, run_id, run_job_id, job_id, apply_url, expected_origin, gate_reason, answers_json, token_hash, expires_at)
    VALUES (1,?,?,?,?,?,?,?,?,0)`).run(run, rj, job, "https://acme.portal.example.test/apply/1", "https://acme.portal.example.test", "login_required",
    JSON.stringify({ answers, applyUrl: "https://acme.portal.example.test/apply/1" }), `h${n}`).lastInsertRowid);
  const remoteId = enqueueRemoteRun(db, { userId: 1, runJobId: rj, packetId, applyUrl: "https://acme.portal.example.test/apply/1", approvalMode: approval });
  return { rj, job, remoteId };
}
const rjRow = (db, id) => db.prepare("SELECT status, reason_code, submitted_by FROM apply_run_jobs WHERE id = ?").get(id);
const remote = (db, id) => db.prepare("SELECT state, mode, outcome FROM apply_remote_runs WHERE id = ?").get(id);
const FIELDS = [{ key: "first_name", label: "First Name", value: "Robin", source: "profile" }];

test("d164SemiAutoStopsBeforeSubmit · Ask me first: Draft parks for review, the worker fills and STOPS at Ready to send", async () => {
  // 1 · The posting's Draft is the board's Draft: POST /api/apply/runs, surface "board", no approvalMode.
  const calls = [];
  await commitDecision({ jobId: "semi::x", decision: DECISIONS.DRAFTED, tool: "generate", surface: DECISION_SURFACES.BOARD,
    api: async (p, o) => { calls.push([p, JSON.parse(o.body)]); return { runId: 1 }; } });
  assert.equal(calls[0][0], "/api/apply/runs");
  assert.equal(calls[0][1].surface, "board");
  assert.equal("approvalMode" in calls[0][1], false, "a Draft never asks for no review");
  assert.match(read("client/src/panels/JobsPanel.jsx"), /commitDecision\(\{ jobId, decision, tool: draftTool, surface: DECISION_SURFACES\.BOARD \}\)/);

  // …and on the server it parks for review (approval_mode 'required'), carrying the résumé generated on the posting (2).
  const db = freshDb();
  storeGeneratedResume(db, { userId: 1, jobId: "no-posting::1", job: { company: "Fabrikam", title: "Platform Engineer" },
    html: "<p>tailored</p>", atsScore: 72, atsReport: { score: 72 }, domainProfileId: 10 });
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 1, planTier: "PRO" }; next(); });
  const noop = async () => ({});
  applyRoutes(app, db, (_q, _s, nx) => nx(), () => ({ field_map: {}, handler_map: {}, custom_answers: {} }), noop, noop, noop, () => null);
  const server = app.listen(0);
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/apply/runs`;
    const post = (body) => fetch(base, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const r = await post({ jobIds: ["no-posting::1"], mode: "auto", surface: "board" });
    assert.equal(r.status, 202);
    assert.equal(db.prepare("SELECT approval_mode FROM apply_runs ORDER BY id DESC LIMIT 1").pluck().get(), "required");
    assert.equal(db.prepare("SELECT resume_artifact_id FROM apply_run_jobs WHERE job_id='no-posting::1'").pluck().get(),
      db.prepare("SELECT id FROM resumes WHERE job_id='no-posting::1'").pluck().get(), "the Draft carries the résumé made on the posting");
    const refused = await post({ jobIds: ["no-posting::2"], mode: "auto", surface: "board", approvalMode: "auto" });
    assert.equal(refused.status, 400, "the board / deck may not ask for no review");
    assert.equal((await refused.json()).error, "approval_mode_forbidden_for_surface");
  } finally { await new Promise(res => setTimeout(res, 50)); server.close(); }

  // 3 · The worker leases a FILL (never a submit) for a run awaiting review…
  const w = freshDb();
  const { rj, remoteId } = parked(w);
  assert.equal(remote(w, remoteId).mode, "fill");
  const lease = leaseRemoteRun(w, { workerId: "w1", env: {} });
  assert.equal(lease.run?.mode, "fill");
  // …and a report that it SUBMITTED a fill run is refused — nothing is recorded as sent.
  const submitted = [];
  assert.deepEqual(acceptReport(w, { remoteId, outcome: "submitted", fields: FIELDS, evidence: { confirmation: "x" } },
    { workerId: "w1", hooks: { onSubmitted: (x) => submitted.push(x) } }), { ok: false, error: "mode_mismatch" });
  assert.equal(submitted.length, 0);
  assert.notEqual(rjRow(w, rj).status, "submitted");
  // 4 · Filled → Ready to approve; the run-job waits as held_review / awaiting_approval.
  assert.deepEqual(acceptReport(w, { remoteId, outcome: "filled", fields: FIELDS }, { workerId: "w1" }), { ok: true, state: "ready_to_approve" });
  assert.deepEqual({ ...rjRow(w, rj) }, { status: "held_review", reason_code: "awaiting_approval", submitted_by: null });
  // …which the tracker draws as Ready to send, with Approve as its first action.
  const [node] = buildNodes({ pending: [{ runJobId: rj, jobId: "semi::1", company: "Fabrikam", title: "Platform Engineer" }] });
  assert.equal(stageOfNode(node), "ready");
  assert.equal(STAGES.ready.word, "Ready to send");
  assert.equal(STAGES.ready.actions[0], "approve");

  // An UNATTENDED submit (nobody approved values) is never leased for a SEMI user — it stops, nothing sent.
  const u = freshDb();
  const auto = parked(u, { approval: "auto" });
  assert.equal(remote(u, auto.remoteId).mode, "submit");
  assert.deepEqual(leaseRemoteRun(u, { workerId: "w1", env: {} }), {});
  assert.deepEqual({ ...remote(u, auto.remoteId) }, { state: "stopped", mode: "submit", outcome: "full_auto_not_chosen" });
  // The local engine holds the same door (boot recovery, the line, a hand-written row all arrive here).
  const gate = apply.slice(at(apply, 'if (mode === "auto" && approvalMode === "auto" && userApplyMode(userId) !== "auto"'), at(apply, 'if (mode === "auto" && fullAutoDisabled()) {'));
  assert.match(gate, /setJobStatus\("held_review", "full_auto_not_chosen",/);

  // A question only the person can answer stops the flow as Needs you.
  const q = freshDb();
  const held = parked(q);
  leaseRemoteRun(q, { workerId: "w1", env: {} });
  assert.deepEqual(acceptReport(q, { remoteId: held.remoteId, outcome: "stopped", reason: "eligibility_unanswered" }, { workerId: "w1" }), { ok: true, state: "stopped" });
  assert.deepEqual({ ...rjRow(q, held.rj) }, { status: "held_review", reason_code: STOP_REASONS.eligibility_unanswered, submitted_by: null });
  assert.equal(STAGES[stageOfNode({ kind: "held", why: "question" })].word, "Needs you");
  assert.equal(PRODUCT_RULES.guessEligibility, false);
});

test("d164SubmitOnlyByUser · only the user's Approve & send submits — and only exactly what they approved", () => {
  const db = freshDb();   // SEMI
  const { rj, remoteId } = parked(db);
  leaseRemoteRun(db, { workerId: "w1", env: {} });
  acceptReport(db, { remoteId, outcome: "filled", fields: FIELDS }, { workerId: "w1" });
  // Before approval there is nothing for a worker to submit.
  assert.deepEqual(leaseRemoteRun(db, { workerId: "w1", env: {} }), {});
  // 5 · Approve & send (POST /api/portals/approve/:runJobId, the signed-in user only) → the worker refills and submits.
  assert.ok(approveRemoteRun(db, 1, rj));
  assert.equal(approveRemoteRun(db, 2, rj), null, "another user cannot approve it");
  const lease = leaseRemoteRun(db, { workerId: "w1", env: {} });
  assert.equal(lease.run?.mode, "submit");
  assert.deepEqual(lease.run.approvedValues, { first_name: "Robin" });
  const submitted = [];
  assert.deepEqual(acceptReport(db, { remoteId, outcome: "submitted", fields: FIELDS, evidence: { confirmation: "Thanks for applying" } },
    { workerId: "w1", hooks: { onSubmitted: (x) => submitted.push(x) } }), { ok: true, state: "submitted" });
  // 6 · Sent, recorded as the USER's submit.
  assert.deepEqual({ ...rjRow(db, rj) }, { status: "submitted", reason_code: null, submitted_by: "user" });
  assert.equal(submitted[0].submittedBy, "user");

  // A submit whose values differ from the approved ones is stopped, not recorded as sent.
  const d2 = freshDb();
  const p2 = parked(d2);
  leaseRemoteRun(d2, { workerId: "w1", env: {} });
  acceptReport(d2, { remoteId: p2.remoteId, outcome: "filled", fields: FIELDS }, { workerId: "w1" });
  approveRemoteRun(d2, 1, p2.rj);
  leaseRemoteRun(d2, { workerId: "w1", env: {} });
  const r = acceptReport(d2, { remoteId: p2.remoteId, outcome: "submitted", fields: [{ ...FIELDS[0], value: "Someone Else" }] }, { workerId: "w1" });
  assert.equal(r.state, "stopped");
  assert.deepEqual({ ...rjRow(d2, p2.rj) }, { status: "held_review", reason_code: "submit_check_failed", submitted_by: null });

  // The local engine records the same: an approved run is the user's submit; a SEMI user's run is never 'auto'.
  assert.match(apply, /\.run\(approvalMode === "approved" \|\| \(userApplyMode\(userId\) !== "auto" && pickAuthorisesSend\(db, userId, jobId\)\) \? "user" : "auto", runJobId\);/);
  // The tracker's Ready row: "Approve & send" is the only send, and it says it cannot be undone.
  const panel = read("client/src/panels/AutoApplyPanel.jsx");
  assert.match(panel, /\{ id: "approve", label: "Approve & send", kind: "primary", disabled: pendingBusy,\n\s+title: "Approving submits it to the employer and cannot be undone\.", onClick: \(\) => decidePending\(\[r\.runJobId\], true\) \}/);
  assert.match(read("routes/applyWorker.js"), /app\.post\("\/api\/portals\/approve\/:runJobId", requireAuth,/);
});

test("d164ConsentLeftForUser · a consent / terms box is the person's unless THEY opted in; an attestation never", () => {
  // The worker's rules: consent is ticked only by the user's own Auto settings choice (agreeToTerms, OFF by default).
  assert.equal(PRODUCT_RULES.tickConsent, false);
  const off = freshDb();
  parked(off);
  assert.equal(leaseRemoteRun(off, { workerId: "w1", env: {} }).run.rules.tickConsent, false, "default: left for the person");
  assert.equal(leaseRemoteRun(off, { workerId: "w1", env: {} }).run, undefined);
  const on = freshDb({ autoSettings: { agreeToTerms: true } });
  parked(on);
  assert.equal(leaseRemoteRun(on, { workerId: "w1", env: {} }).run.rules.tickConsent, true, "the user's own opt-in");
  assert.equal(PRODUCT_RULES.answerHumanCheck, false);

  // The local fill engine: a required terms box stays unanswered (→ Needs you) without the opt-in…
  const fields = [
    { field_id: "terms", name: "terms", label: "I agree to the Terms and Privacy Policy", type: "checkbox", required: true },
    { field_id: "attest", name: "attest", label: "I certify that my answers are true and complete", type: "checkbox", required: true },
  ];
  const answer = (payload) => Object.fromEntries(buildAnswers(fields, payload).map(a => [a.field_id, a.value]));
  const without = answer({ field_map: {}, handler_map: {}, custom_answers: {} });
  assert.equal(without.terms ?? null, null);
  assert.equal(without.attest ?? null, null);
  // …and with it, only the terms box — never the attestation.
  const withOptIn = answer({ field_map: {}, handler_map: {}, custom_answers: {}, agree_to_terms: true });
  assert.equal(withOptIn.terms, "true");
  assert.equal(withOptIn.attest ?? null, null, "an attestation of truth is never ticked for the person");
});
