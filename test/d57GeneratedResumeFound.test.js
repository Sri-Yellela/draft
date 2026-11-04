// D57 · ⛔ A MANUALLY GENERATED RÉSUMÉ CAN BE FOUND NOWHERE — every test here goes red when the thing it
// pins is removed. SYNTHETIC user throughout. The store is services/generatedResumes.js (one transaction,
// always the newest); the list is routes/generatedResumes.js; the panel, the card and Settings read them.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import applyRoutes from "../routes/apply.js";
import generatedResumeRoutes from "../routes/generatedResumes.js";
import { checkLimit } from "../services/limitEnforcer.js";
import { draftSlots } from "../services/draftSlots.js";
import {
  storeGeneratedResume, refundGeneration, listGeneratedResumes, deleteGeneratedResume, sweepExpiredResumes,
  resumeRetentionDays, DEFAULT_RESUME_RETENTION_DAYS, STORE_FAILED_SENTENCE,
} from "../services/generatedResumes.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const NOW = Math.floor(Date.now() / 1000);
const DAY = 86400;

function seed() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'ada','x','PRO')").run();
  db.prepare("INSERT INTO domain_profiles (id,user_id,profile_name,role_family,domain,is_active) VALUES (10,1,'SWE','engineering','software',1)").run();
  db.prepare("INSERT INTO user_profile (user_id,first_name,last_name,email) VALUES (1,'Ada','Example','ada@example.test')").run();
  db.prepare("INSERT INTO profile_base_resumes (profile_id,user_id,name,content,updated_at) VALUES (10,1,'r.txt','synthetic base',unixepoch() - 60)").run();
  db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,url,apply_url,search_query,_hash)
              VALUES ('j1','Backend Engineer','Northwind','http://127.0.0.1:9/j1','http://127.0.0.1:9/j1','t','h1'),
                     ('j2','Data Engineer','Contoso','http://127.0.0.1:9/j2','http://127.0.0.1:9/j2','t','h2')`).run();
  return db;
}
const gen = (db, jobId, score, extra = {}) => storeGeneratedResume(db, {
  userId: 1, jobId, job: { company: "Northwind", title: "Backend Engineer" }, html: `<p>résumé ${jobId} ${score}</p>`,
  atsScore: score, atsReport: { score }, domainProfileId: 10, ...extra,
});

// ── the probe's defect: a generation after an export never reached `resumes` ─────────────────────────

test("D57 · a regeneration after an EXPORT (kept version) is the job's résumé — not only a row in resume_versions", () => {
  const db = seed();
  gen(db, "j1", 19);
  db.prepare("UPDATE resume_versions SET is_kept=1 WHERE user_id=1 AND job_id='j1' AND version=1").run(); // what /keep does
  const out = gen(db, "j1", 15);
  assert.equal(out.version, 2);
  const r = db.prepare("SELECT html, ats_score FROM resumes WHERE user_id=1 AND job_id='j1'").get();
  assert.equal(r.ats_score, 15, "the board, the panel and the stamp read `resumes` — it must hold the newest");
  assert.match(r.html, /j1 15/);
  assert.equal(db.prepare("SELECT is_kept FROM resume_versions WHERE job_id='j1' AND version=1").pluck().get(), 1,
    "the exported version is still recorded as the one exported");
  assert.doesNotMatch(read("server.js"), /keptExists/, "the gate that dropped it is gone");
});

test("D57 · the store is ONE transaction: a failure leaves no version without its résumé", () => {
  const db = seed();
  db.exec(`CREATE TRIGGER fail_resumes BEFORE INSERT ON resumes BEGIN SELECT RAISE(ABORT, 'disk full (simulated)'); END;`);
  assert.throws(() => gen(db, "j1", 50), /disk full/);
  assert.equal(db.prepare("SELECT COUNT(*) FROM resume_versions").pluck().get(), 0, "the version rolled back with it");
});

test("D57 · a job outside the profile's role scope still gets its user_jobs flag (resume_generated)", () => {
  const db = seed();
  gen(db, "j2", 30, { userJobProfileId: null });   // the resolver answers null for an unmapped job
  assert.equal(db.prepare("SELECT resume_generated FROM user_jobs WHERE user_id=1 AND job_id='j2'").pluck().get(), 1);
});

// ── a generation that fails to store refunds the quota and says so ───────────────────────────────

test("D57 · a store failure REFUNDS the plan's generation count, and no Draft slot is taken", () => {
  const db = seed();
  db.prepare("INSERT INTO user_limits (user_id, daily_resumes) VALUES (1, 1)").run();
  const ev = db.prepare("INSERT INTO usage_events (user_id, event_type, purpose, success) VALUES (1,'resume_generate','resume_generate',1)").run().lastInsertRowid;
  assert.equal(checkLimit(db, 1, "resume_generate").allowed, false, "the tools service answered: counted");
  assert.equal(refundGeneration(db, ev), true);
  assert.equal(checkLimit(db, 1, "resume_generate").allowed, true, "refunded — the user can generate again");
  const row = db.prepare("SELECT success, error_text FROM usage_events WHERE id=?").get(ev);
  assert.equal(row.success, 0);
  assert.match(row.error_text, /not stored — refunded/, "the spend is kept, and says why it is not counted");
  assert.equal(refundGeneration(db, ev), false, "refunded once");
  assert.equal(draftSlots(db, 1).generations, 0);
});

test("D57 · the kernel refunds on a failed store and the route SAYS so — 503, refunded, the slot untouched", () => {
  const server = read("server.js");
  const core = server.slice(at(server, "async function coreGenerateResume("), at(server, "function generateResumeForApply"));
  const store = core.slice(at(core, "stored = storeGeneratedResume(db, {"));
  assert.match(store, /\} catch \(e\) \{\n\s+const refunded = refundGeneration\(db, usageEventId\);/);
  assert.match(store, /throw new ResumeStoreError\(STORE_FAILED_SENTENCE, \{ cause: e, refunded \}\);/);
  const route = server.slice(at(server, 'app.post("/api/generate"'), at(server, "// SANDBOX + PDF"));
  assert.ok(at(route, "await coreGenerateResume(") < at(route, "recordGenerationSlot(db, req.user.id, jobId);"),
    "the slot is debited only after a STORED résumé");
  assert.match(route, /if \(e instanceof ResumeStoreError\) \{[\s\S]{0,300}?res\.status\(503\)\.json\(\{ error: e\.message, code: e\.code, retryable: true, refunded: true,/);
  assert.match(STORE_FAILED_SENTENCE, /could not be saved, so it was not charged/);
});

// ── listed under Settings → Your data, with retention ────────────────────────────────────────────

function mount(db) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 1, planTier: "PRO" }; next(); });
  const events = [];
  generatedResumeRoutes(app, db, (_q, _s, n) => n(), { emitToUser: (u, e) => events.push([u, e]) });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, events, stop: () => server.close() };
}

test("D57 · Settings lists every generated résumé — date, 'expires in N days', and kept for good once drafted", async () => {
  const db = seed();
  gen(db, "j1", 40); gen(db, "j2", 45);
  db.prepare("UPDATE resume_versions SET created_at=? WHERE job_id='j1'").run(NOW - 50 * DAY);
  db.prepare("INSERT INTO apply_runs (id,user_id,mode,status,total_jobs) VALUES (7,1,'auto','queued',1)").run();
  db.prepare("INSERT INTO apply_run_jobs (run_id,user_id,job_id,status) VALUES (7,1,'j2','queued')").run();
  const t = mount(db);
  try {
    const body = await (await fetch(`${t.base}/api/generated-resumes`)).json();
    assert.equal(body.retentionDays, 90);
    const j1 = body.resumes.find(r => r.jobId === "j1"), j2 = body.resumes.find(r => r.jobId === "j2");
    assert.equal(j1.expiresInDays, 40, "90 days from its generation, 50 days ago");
    assert.equal(j1.keptForGood, false);
    assert.ok(Number.isFinite(j1.generatedAt));
    assert.equal(j2.tie, "drafted");
    assert.equal(j2.keptForGood, true);
    assert.equal(j2.expiresInDays, null, "a kept résumé shows no expiry");
  } finally { t.stop(); }
  const panel = read("client/src/panels/AccountPanel.jsx");
  const yourData = panel.slice(at(panel, '<SettingsSection title="Your data"'), at(panel, "<DeleteSection"));
  assert.match(yourData, /<GeneratedResumes busy=\{busy\} run=\{run\} \/>/, "the list lives in Your data");
  assert.match(panel, /api\("\/api\/generated-resumes"\)/);
  assert.match(panel, /\$\{list\.length\} kept/);
  assert.match(panel, /`Expires in \$\{r\.expiresInDays\} day/);
});

test("D57 · deleting frees the button: the delete answers, the board hears resume_deleted, the panel offers Résumé again", async () => {
  const db = seed();
  gen(db, "j1", 40);
  const t = mount(db);
  try {
    const r = await fetch(`${t.base}/api/generated-resumes/j1`, { method: "DELETE" });
    assert.equal(r.status, 200);
    assert.deepEqual(t.events, [[1, { type: "resume_deleted", jobId: "j1" }]]);
    assert.equal(db.prepare("SELECT COUNT(*) FROM resumes").pluck().get(), 0);
    assert.equal(db.prepare("SELECT resume_generated FROM user_jobs WHERE job_id='j1'").pluck().get(), 0);
    assert.equal((await fetch(`${t.base}/api/generated-resumes/j1`, { method: "DELETE" })).status, 404);
  } finally { t.stop(); }
  const jobs = read("client/src/panels/JobsPanel.jsx");
  assert.match(jobs, /resume_deleted: \(\{ jobId \}\) => \{[\s\S]{0,200}?delete n\[jobId\]/);
  assert.match(read("server.js"), /emitToUser\(req\.user\.id, \{ type: "resume_deleted", jobId: String\(req\.params\.jobId\) \}\)/);
  const jd = read("client/src/components/JobDetailPanel.jsx");
  // D86: two renderings of the same control — the plain button, or the split while bring-your-own-model is on.
  // Both stay gated on !hasArtifact, which is what this pins.
  assert.match(jd, /\{canGen && onGenerate && !hasArtifact && !byom\.available && \(/, "no résumé → the Résumé button");
  // D147 (11-03): under More the button reads "Résumé for this job".
  assert.match(jd, /\{canGen && onGenerate && !hasArtifact && byom\.available && split\(false, "Résumé for this job"/, "no résumé → the Résumé split");
});

test("D57 · the retention sweep deletes an expired convenience copy and never a drafted/applied one", () => {
  const db = seed();
  for (const j of ["j1", "j2"]) gen(db, j, 40);
  db.prepare("UPDATE resume_versions SET created_at=?").run(NOW - 120 * DAY);
  db.prepare("INSERT INTO job_applications (user_id,job_id,company,role) VALUES (1,'j2','Contoso','Data Engineer')").run();
  const out = sweepExpiredResumes(db, { now: NOW, days: 90 });
  assert.deepEqual(out.swept, [{ userId: 1, jobId: "j1" }]);
  assert.equal(db.prepare("SELECT job_id FROM resumes").pluck().all().join(), "j2", "the applied one is kept for good");
  assert.equal(DEFAULT_RESUME_RETENTION_DAYS, 90);
  assert.equal(resumeRetentionDays({ RESUME_RETENTION_DAYS: "30" }), 30);
  assert.match(read("server.js"), /setInterval\(\(\) => runResumeRetentionSweep\("interval"\), 24 \* 3600_000\)/);
});

test("D57 · a sweep that would delete most of what exists is REFUSED (the bin's shape)", () => {
  const db = seed();
  const many = db.prepare(`INSERT INTO resumes (user_id,job_id,company,role,html,created_at,updated_at) VALUES (1,?,'A','B','<p/>',?,?)`);
  for (let i = 0; i < 30; i++) many.run(`old${i}`, NOW - 200 * DAY, NOW - 200 * DAY);
  const out = sweepExpiredResumes(db, { now: NOW, days: 90 });
  assert.equal(out.refused, true);
  assert.equal(db.prepare("SELECT COUNT(*) FROM resumes").pluck().get(), 30, "nothing deleted");
});

// ── drafting carries it to Draft House ───────────────────────────────────────────────────────────

test("D57 · drafting a job with a stored résumé attaches it to the Draft at once — Draft House shows it", async () => {
  const db = seed();
  // A job with no posting row: the run fails fast with job_not_found instead of opening a browser.
  gen(db, "no-posting::1", 61);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 1, planTier: "PRO" }; next(); });
  const noop = async () => ({});
  applyRoutes(app, db, (_q, _s, n) => n(), () => ({ field_map: {}, handler_map: {}, custom_answers: {} }), noop, noop, noop, () => null);
  const server = app.listen(0);
  try {
    const r = await fetch(`http://127.0.0.1:${server.address().port}/api/apply/runs`, { method: "POST",
      headers: { "content-type": "application/json" }, body: JSON.stringify({ jobIds: ["no-posting::1"], mode: "auto", surface: "board" }) });
    assert.equal(r.status, 202);
    const rj = db.prepare("SELECT resume_artifact_id, resume_ats_score FROM apply_run_jobs WHERE job_id='no-posting::1'").get();
    const resumeId = db.prepare("SELECT id FROM resumes WHERE job_id='no-posting::1'").pluck().get();
    assert.equal(rj.resume_artifact_id, resumeId, "the Draft carries the résumé the user generated by hand");
    assert.equal(rj.resume_ats_score, 61);
    assert.equal(listGeneratedResumes(db, 1).find(x => x.jobId === "no-posting::1").keptForGood, true, "and it is now kept for good");
  } finally { await new Promise(r => setTimeout(r, 50)); server.close(); }
});

// ── the posting panel and the card say "résumé ready" — after a reload too ────────────────────────

test("D57 · after a reload the stored résumé reads 'Résumé ready · 2h ago' with view · download · regenerate", () => {
  const jobs = read("client/src/panels/JobsPanel.jsx");
  // The boot map (GET /api/resumes) carries when it was generated and the PARSED report.
  assert.match(jobs, /atsReport:r\.atsReport \?\? null, company:r\.company, title:r\.role,[^\n]*\n\s+generatedAt: r\.generated_at \? Number\(r\.generated_at\) \* 1000 : null,/);
  assert.match(read("server.js"), /COALESCE\(MAX\(v\.created_at\), r\.created_at\) AS generated_at/);
  // View and Download reach a stored (__exists__) résumé from the store.
  assert.match(jobs, /onViewSandbox: \(\) => \{\n\s+if \(g2\?\.html === "__exists__"\) \{ generate\(selectedJob, false\); return; \}/);
  assert.match(jobs, /const d = await api\(`\/api\/resumes\/\$\{encodeURIComponent\(selectedJob\.jobId\)\}`\);/);
  assert.match(jobs, /onRegenerate: \(\) => generate\(selectedJob, true\),/);
  const jd = read("client/src/components/JobDetailPanel.jsx");
  const acts = jd.slice(at(jd, "function PostingActions("), at(jd, "export default function JobDetailPanel("));
  assert.match(acts, /const hasArtifact = done && !!g\?\.html;/, "a stored résumé counts — it used to be hidden behind Regenerate");
  assert.match(acts, /\{ago \? `Résumé ready · \$\{ago\}` : "Résumé ready"\}/);
  // D147 (11-03): under More, "View" reads "View résumé" (the row is no longer beside the résumé button).
  for (const label of [">View résumé<", ">Download<", '"Regenerate"']) assert.ok(acts.includes(label), label);
  assert.doesNotMatch(acts, /done \? "Regenerate" : "Résumé"/, "never a Regenerate button in place of the résumé");
  assert.match(jd, /if \(s < 86400\) return `\$\{Math\.round\(s \/ 3600\)\}h ago`;/);
});

test("D57 · the job card carries a 'résumé ready' marker in every view", () => {
  const bubble = read("client/src/components/JobBubble.jsx");
  assert.match(bubble, /\{resumeReady && <div className="jb__ready" data-resume-ready="" [^>]*>résumé ready<\/div>\}/);
  assert.match(read("client/src/panels/JobsPanel.jsx"), /resumeReady=\{!!g\?\.html\}/);
  // ⭐ D152 (7b), changed on purpose: a word with the success DOT before it (no chip) — still said in the success tone.
  assert.match(read("client/src/components/JobBubble.css"), /\.jb__ready \{[^}]*background: radial-gradient\(circle at 3px 50%, var\(--c-success\) 3px/);
});
