import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import applyRoutes, { capturedAtsAtApply } from "../routes/apply.js";
import applicationRecordRoutes from "../routes/applicationRecords.js";
import {
  verifyEvidence, recordSubmission, recordSubmissionFromPipeline, markPending, listRecords,
} from "../services/applicationRecords.js";
import { draftSlots, recordGenerationSlot, draftSlotLimit } from "../services/draftSlots.js";
import { DECK_SIZE } from "../services/dailyDraft.js";
import { at } from "../test-support/sourceAnchors.js";
import { atsJobInputHash, ATS_JOB_INPUT_FIELDS } from "../services/jobs/boardFitPrecompute.js";
// A52 follow-up: a stored board score is stamped at apply only while it is CURRENT for the posting.
const currentJobHash = (db, jobId) => atsJobInputHash(db.prepare(`SELECT ${ATS_JOB_INPUT_FIELDS.join(", ")} FROM scraped_jobs WHERE job_id = ?`).get(jobId));

// A63 (owner, O45c, 10-02): the board's tools, reshaped.
//   (1) Apply is the company name — a link to the posting; no separate Apply button.
//   (2) A résumé generation uses one of the day's Draft slots — the same 10 a Draft uses.
//   (3) PENDING -> recorded -> VERIFIED -> Submitted. Nothing becomes "submitted" on a click alone;
//       job_applications (with the ATS score at apply) is written only when a record verifies.

const NOW = Math.floor(Date.now() / 1000);

function mount({ env = {} } = {}) {
  const prev = {};
  for (const [k, v] of Object.entries(env)) { prev[k] = process.env[k]; process.env[k] = v; }
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'ada','x','PRO')").run();
  db.prepare("INSERT INTO domain_profiles (id,user_id,profile_name,role_family,domain,is_active) VALUES (10,1,'SWE','engineering','software',1)").run();
  db.prepare("INSERT INTO user_profile (user_id,first_name,last_name,email) VALUES (1,'Ada','Lovelace','ada@example.com')").run();
  db.prepare("INSERT INTO profile_base_resumes (profile_id,user_id,name,content,updated_at) VALUES (10,1,'r.txt','real resume text',unixepoch())").run();
  db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,url,apply_url,search_query,_hash)
              VALUES ('j1','Backend Engineer','Northwind, Inc.','https://northwind.example/jobs/1',
                      'https://job-boards.greenhouse.io/northwind/jobs/1','t','h1')`).run();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 1, planTier: "PRO" }; next(); });
  const pass = (req, _res, next) => next();
  const noop = async () => ({});
  applyRoutes(app, db, pass, noop, noop, noop, noop);
  applicationRecordRoutes(app, db, pass, { capturedAtsAtApply });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const stop = () => {
    for (const [k, v] of Object.entries(prev)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    server.close();
  };
  return { db, base, stop };
}
const post = (base, path, body) => fetch(`${base}${path}`, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}),
});
const apps = (db) => db.prepare("SELECT * FROM job_applications WHERE user_id=1").all();

// ── (3) what "verified" means ────────────────────────────────────────────────────────────────

test("verified = a statement, a plausible date, and one piece of evidence matching THIS employer", () => {
  const job = { company: "Northwind, Inc.", apply_url: "https://job-boards.greenhouse.io/northwind/jobs/1",
                url: "https://northwind.example/jobs/1", discovered_at: NOW - 5 * 86400 };
  const base = { submitted_at: NOW - 3600, method: "company_site" };
  const v = (extra, j = job) => verifyEvidence({ job: j, record: { ...base, ...extra }, now: NOW });

  assert.equal(v({}).verified, false, "a statement alone is not verified");
  assert.match(v({}).checks.find(c => c.key === "evidence").detail, /Add one piece of evidence/);
  assert.equal(v({ evidence_url: "https://boards.greenhouse.io/northwind/confirmation" }).verified, true,
    "the posting's ATS domain counts");
  assert.equal(v({ evidence_url: "https://northwind.example/thanks" }).verified, true, "the posting's own host counts");
  assert.equal(v({ evidence_url: "https://evil.example/thanks" }).verified, false, "another site does not");
  assert.equal(v({ evidence_text: "Thank you for applying to NORTHWIND!" }).verified, true, "the confirmation names the company");
  assert.equal(v({ evidence_text: "Thank you for applying!" }).verified, false, "one that does not name it, does not");
  assert.equal(v({ reference: "R-104233" }).verified, true, "a reference number (taken on trust)");
  assert.equal(v({ reference: "abcd" }).verified, false, "a reference has at least one digit");
  assert.equal(v({ evidence_text: "Northwind", submitted_at: NOW + 7200 }).verified, false, "not in the future");
  assert.equal(v({ evidence_text: "Northwind", submitted_at: NOW - 30 * 86400 }).verified, false,
    "not before the posting was first seen");
  assert.equal(v({ evidence_text: "Northwind", method: "carrier pigeon" }).verified, false, "a known method");
  const out = v({ reference: "R-1" + "0".repeat(3) });
  assert.match(out.proves, /matches this employer/);
  assert.match(out.doesNotProve, /does not prove the employer received it/);
});

// ── (3) nothing becomes submitted on a click ─────────────────────────────────────────────────

test("POST /api/apply (the old Apply button) tags Pending — it no longer records an application", async () => {
  const { db, base, stop } = mount();
  try {
    const r = await post(base, "/api/apply", { jobId: "j1", jobUrl: "https://x.test/j1", mode: "semi" });
    assert.equal(r.status, 200);
    const b = await r.json();
    assert.equal(b.state, "pending");
    assert.match(b.message, /Tagged Pending/);
    assert.deepEqual(apps(db), [], "a click wrote no application");
  } finally { stop(); }
});

test("opening the posting tags Pending; 'I did not apply' takes it out; opening again puts it back", async () => {
  const { db, base, stop } = mount();
  try {
    assert.equal((await (await post(base, "/api/applications/pending", { jobId: "j1", origin: "opened_posting" })).json()).state, "pending");
    assert.equal((await post(base, "/api/applications/pending", { jobId: "j1", origin: "generated" })).status, 400,
      "a client may not claim the server's own origins");
    let list = await (await fetch(`${base}/api/applications/pending`)).json();
    assert.equal(list.pending.length, 1);
    assert.equal(list.pending[0].company, "Northwind, Inc.");
    assert.ok(list.methods.some(m => m.value === "company_site") && !list.methods.some(m => m.value === "draft"));
    assert.ok(list.verifyRule.proves && list.verifyRule.doesNotProve);

    assert.equal((await post(base, "/api/applications/pending/j1/withdraw")).status, 200);
    list = await (await fetch(`${base}/api/applications/pending`)).json();
    assert.equal(list.pending.length, 0);
    await post(base, "/api/applications/pending", { jobId: "j1", origin: "opened_posting" });
    assert.equal((await (await fetch(`${base}/api/applications/pending`)).json()).pending.length, 1);
    assert.deepEqual(apps(db), []);
  } finally { stop(); }
});

test("record without evidence -> RECORDED (still pending, says what is missing); with evidence -> VERIFIED and Submitted", async () => {
  const { db, base, stop } = mount();
  try {
    db.prepare("INSERT INTO ats_only_reports (user_id,domain_profile_id,job_id,ats_report,ats_score,job_hash) VALUES (1,10,'j1',?,48,?)")
      .run(JSON.stringify({ source: "local_ats_v4", score: 48 }), currentJobHash(db, "j1"));
    const first = await (await post(base, "/api/applications/pending/j1/record",
      { submittedAt: new Date().toISOString(), method: "company_site" })).json();
    assert.equal(first.state, "recorded");
    assert.equal(first.verified, false);
    assert.ok(first.checks.some(c => !c.ok && /evidence/.test(c.detail)));
    assert.deepEqual(apps(db), [], "not verified, so not submitted");
    assert.equal((await (await fetch(`${base}/api/applications/pending`)).json()).pending[0].state, "recorded");

    const second = await (await post(base, "/api/applications/pending/j1/record",
      { submittedAt: new Date().toISOString(), method: "company_site", evidenceText: "Thanks for applying to Northwind" })).json();
    assert.equal(second.verified, true);
    assert.match(second.message, /Submitted/);
    const [row] = apps(db);
    assert.equal(row.job_id, "j1");
    assert.equal(row.auto_status, "verified");
    assert.equal(row.ats_score_at_apply, 48, "A47's recording path fires: the score at apply is stamped");
    assert.equal(row.ats_scorer_version, "local_ats_v4");
    assert.equal(db.prepare("SELECT applied FROM user_jobs WHERE user_id=1 AND job_id='j1'").pluck().get(), 1);
    const list = await (await fetch(`${base}/api/applications/pending`)).json();
    assert.equal(list.pending.length, 0, "it left Pending");
    assert.equal(list.verified[0].jobId, "j1");

    const again = await post(base, "/api/applications/pending/j1/record",
      { submittedAt: new Date().toISOString(), method: "email", reference: "X-1234" });
    assert.equal(again.status, 409);
    assert.equal((await again.json()).error, "already_verified");
    assert.equal((await post(base, "/api/applications/pending/j1/record", { method: "company_site" })).status, 400,
      "a date is required");
  } finally { stop(); }
});

test("the automation's submit goes through the same record: verified only when it confirmed the submit", () => {
  const { db, stop } = mount();
  try {
    const run = db.prepare("INSERT INTO apply_runs (user_id,mode,status,total_jobs) VALUES (1,'auto','running',2)").run().lastInsertRowid;
    db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,apply_url,search_query,_hash)
                VALUES ('j2','SRE','Contoso','https://contoso.example/2','t','h2')`).run();
    const ok = db.prepare(`INSERT INTO apply_run_jobs (run_id,user_id,job_id,status,submit_verified,submit_evidence,finished_at)
                           VALUES (?,1,'j1','submitted',1,'confirmation heading: Application received',unixepoch())`).run(run).lastInsertRowid;
    const claimed = db.prepare(`INSERT INTO apply_run_jobs (run_id,user_id,job_id,status,submit_verified,finished_at)
                                VALUES (?,1,'j2','submitted',0,unixepoch())`).run(run).lastInsertRowid;
    assert.equal(recordSubmissionFromPipeline(db, { userId: 1, jobId: "j1", runJobId: ok, capturedAtsAtApply }).state, "verified");
    assert.equal(recordSubmissionFromPipeline(db, { userId: 1, jobId: "j2", runJobId: claimed, capturedAtsAtApply }).state, "recorded");
    assert.deepEqual(apps(db).map(a => [a.job_id, a.apply_mode]), [["j1", "AUTO"]],
      "a claimed-but-unconfirmed submit is not an application until the user verifies it");
    assert.equal(listRecords(db, 1).pending[0].jobId, "j2");
  } finally { stop(); }
});

test("routes/apply.js records the pipeline's submit through the one service, and never fails the run on it", () => {
  const src = fs.readFileSync("routes/apply.js", "utf8");
  const at = src.indexOf('"submitted", "Application submitted successfully"');
  const hook = src.indexOf("recordSubmissionFromPipeline(db,", at);
  assert.ok(at > 0 && hook > at && hook - at < 1200, "recorded right where the submit is logged");
  assert.match(src.slice(hook - 200, hook + 300), /try \{[\s\S]*\} catch \(e\)/);
});

// ── (2) the day's Draft slots ────────────────────────────────────────────────────────────────

test("the allowance is the deck's 10, shared by Drafts and new résumés; Undo and approvals do not count", async () => {
  assert.equal(draftSlotLimit({}), DECK_SIZE);
  assert.equal(DECK_SIZE, 10);
  const { db, base, stop } = mount({ env: { DAILY_DRAFT_SLOTS: "3", APPLY_MAX_ACTIVE_RUNS_PER_USER: "9" } });
  try {
    assert.deepEqual((await (await fetch(`${base}/api/draft/slots`)).json()).remaining, 3);
    recordGenerationSlot(db, 1, "g1");
    const r1 = await (await post(base, "/api/apply/runs", { jobIds: ["d1"], mode: "auto", surface: "board" })).json();
    assert.equal(r1.draftSlots.used, 2, "one generation + one Draft");
    assert.equal(r1.draftSlots.remaining, 1);

    // An approval is the same Draft continuing — exempt, and not counted.
    const appr = db.prepare("INSERT INTO apply_runs (user_id,mode,status,total_jobs,approval_mode) VALUES (1,'auto','completed',1,'approved')").run().lastInsertRowid;
    db.prepare("INSERT INTO apply_run_jobs (run_id,user_id,job_id,status) VALUES (?,1,'d1','submitted')").run(appr);
    // A cancelled (undone) one gives its slot back.
    const undone = db.prepare("INSERT INTO apply_runs (user_id,mode,status,total_jobs) VALUES (1,'auto','completed',1)").run().lastInsertRowid;
    db.prepare("INSERT INTO apply_run_jobs (run_id,user_id,job_id,status) VALUES (?,1,'u1','cancelled')").run(undone);
    assert.equal(draftSlots(db, 1).used, 2);

    assert.equal((await post(base, "/api/apply/runs", { jobIds: ["d2"], mode: "auto", surface: "deck" })).status, 202);
    const refused = await post(base, "/api/apply/runs", { jobIds: ["d3"], mode: "auto", surface: "deck" });
    assert.equal(refused.status, 429);
    const body = await refused.json();
    assert.equal(body.error, "draft_slots_exhausted");
    assert.match(body.message, /used 3 of your 3 drafts in the last 24 hours/);
    assert.match(body.message, /a Draft and a generated résumé each use one/);

    // A slot older than 24 hours is free again.
    db.prepare("UPDATE draft_slot_uses SET created_at = unixepoch() - 90000").run();
    assert.equal(draftSlots(db, 1).remaining, 1);
  } finally { stop(); }
});

test("/api/generate: a NEW résumé is refused at zero and debited only on success; a cached one is free", () => {
  const src = fs.readFileSync("server.js", "utf8");
  const route = src.slice(at(src, 'app.post("/api/generate", requireAuth'), at(src, "// SANDBOX + PDF"));
  const newOnly = route.indexOf("if (!cachedArtifact || forceRegen) {");
  const check = route.indexOf("if (slots.remaining <= 0) return res.status(429).json(slotsExhausted(slots));");
  const cachedReturn = route.indexOf("if (cachedArtifact && !forceRegen) {");
  const generate = route.indexOf("await coreGenerateResume(");
  const debit = route.indexOf("recordGenerationSlot(db, req.user.id, jobId);");
  assert.ok(newOnly > 0 && check > newOnly && check < cachedReturn, "checked only on the new-generation branch");
  assert.ok(generate > 0 && debit > generate, "debited AFTER the résumé exists (debit on success)");
  assert.match(route.slice(debit, debit + 400), /markPending\(db, req\.user\.id, jobId, "generated"\)/,
    "and a generated job is tagged Pending");
});

test("the export routes tag Pending: no route but a verified record writes job_applications", () => {
  const server = fs.readFileSync("server.js", "utf8");
  const exportRoute = server.slice(at(server, 'app.post("/api/applications", requireAuth'),
    at(server, 'app.get("/api/applications", requireAuth'));
  assert.match(exportRoute, /markPending\(db, req\.user\.id, jobId, "exported_resume"\)/);
  for (const f of ["client/src/panels/JobsPanel.jsx", "client/src/panels/DatabasePanel.jsx"]) {
    const src = fs.readFileSync(f, "utf8");
    assert.doesNotMatch(src, /api\("\/api\/applications", \{ method:"POST"/, `${f} still records an export as applied`);
    assert.match(src, /origin:"exported_resume"/);
  }
});

// ── (1) Apply is the company name ────────────────────────────────────────────────────────────

test("the board: the company name is the apply link; no Apply button; slots said before pressing", () => {
  const panel = fs.readFileSync("client/src/components/JobDetailPanel.jsx", "utf8");
  assert.match(panel, /<a href=\{postingUrl\} target="_blank" rel="noopener noreferrer" onClick=\{openedPosting\}/);
  assert.match(panel, /\{selectedJob\.company\} ↗/);
  assert.doesNotMatch(panel, /api\("\/api\/apply"/, "the old Apply call is gone");
  assert.doesNotMatch(panel, /handleAutoApply|semiActive|"Opening…"/);
  assert.match(panel, /origin: "opened_posting"/);
  assert.match(panel, /data-draft-slots/);
  assert.match(panel, /drafts left in the last 24 hours — a Draft or a new résumé uses one/);
  assert.match(panel, /disabled=\{!!st \|\| noSlots\}/, "Generate is disabled at zero, not refused after");
  assert.match(panel, /data-pending-tag/);
  assert.doesNotMatch(panel, /Apply directly ↗\s*<\/a>/, "no second Apply link in the panel body");
  const card = fs.readFileSync("client/src/components/JobCard.jsx", "utf8");
  assert.doesNotMatch(card, /Apply directly/);
  assert.match(card, /data-apply-link/);
  const db = fs.readFileSync("client/src/panels/DatabasePanel.jsx", "utf8");
  assert.match(db, /<PendingApplications /);
  assert.match(db, /\/api\/applications\/pending\/\$\{encodeURIComponent\(jobId\)\}\/record/);
  const table = fs.readFileSync("client/src/components/PendingApplications.jsx", "utf8");
  for (const s of ["rule.proves", "rule.doesNotProve", "I did not apply", "Record and verify", "c.detail"]) {
    assert.ok(table.includes(s), `the Pending table shows ${s}`);
  }
});

// ── migration 121's backfill ─────────────────────────────────────────────────────────────────

test("121 backfills a Pending record for each résumé already generated — not for an application or a Draft", () => {
  const db = new Database(":memory:");
  const upTo120 = MIGRATIONS.filter(m => m.id !== "121_application_records");
  for (const m of upTo120) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'ada','x')").run();
  for (const j of ["r-only", "r-applied", "r-drafted"]) {
    db.prepare("INSERT INTO resumes (user_id,job_id,company,role,html,created_at) VALUES (1,?,'A','B','<p/>',unixepoch())").run(j);
  }
  db.prepare("INSERT INTO job_applications (user_id,job_id,company,role) VALUES (1,'r-applied','A','B')").run();
  const run = db.prepare("INSERT INTO apply_runs (user_id,mode,status,total_jobs) VALUES (1,'auto','completed',1)").run().lastInsertRowid;
  db.prepare("INSERT INTO apply_run_jobs (run_id,user_id,job_id,status) VALUES (?,1,'r-drafted','held_review')").run(run);
  db.exec(MIGRATIONS.find(m => m.id === "121_application_records").sql);
  assert.deepEqual(db.prepare("SELECT job_id, state, origin FROM application_records").all(),
    [{ job_id: "r-only", state: "pending", origin: "generated" }]);
});

test("markPending is a no-op for a job already submitted, and recordSubmission refuses one", () => {
  const { db, stop } = mount();
  try {
    db.prepare("INSERT INTO job_applications (user_id,job_id,company,role) VALUES (1,'j1','Northwind','Backend')").run();
    assert.equal(markPending(db, 1, "j1", "opened_posting").state, "submitted");
    assert.throws(() => recordSubmission(db, { userId: 1, jobId: "j1",
      input: { submittedAt: Date.now(), method: "email", reference: "A-1234" } }), /already verified/);
  } finally { stop(); }
});

test("A52 follow-up: a stored board score is stamped at apply only while it is current for the posting", () => {
  const { db, stop } = mount();
  try {
    db.prepare("INSERT INTO ats_only_reports (user_id,domain_profile_id,job_id,ats_report,ats_score,job_hash) VALUES (1,10,'j1',?,48,?)")
      .run(JSON.stringify({ source: "local_ats_v4", score: 48 }), currentJobHash(db, "j1"));
    assert.equal(capturedAtsAtApply(db, 1, "j1").score, 48, "current: stamped");
    db.prepare("UPDATE scraped_jobs SET description = 'Rewritten after enrichment landed.' WHERE job_id = 'j1'").run();
    assert.equal(capturedAtsAtApply(db, 1, "j1").score, null, "the posting changed: the board says Check match, so nothing is stamped");
    db.prepare("UPDATE ats_only_reports SET job_hash = NULL").run();
    assert.equal(capturedAtsAtApply(db, 1, "j1").score, null, "scored before migration 118, posting still there: stale");
  } finally { stop(); }
});
