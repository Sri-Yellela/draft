import test from "node:test";
import assert from "node:assert/strict";
import { at } from "../test-support/sourceAnchors.js";
import fs from "node:fs";
import http from "node:http";
import express from "express";
import Database from "better-sqlite3";
import applyRoutes from "../routes/apply.js";
import { autoApply } from "../services/applyAutomation.js";
import { _resetLiveChallenges } from "../services/liveChallenge.js";
import { draftedFromAnswers, challengeKindCounts, heldChecksOf } from "../services/challengeRerun.js";
import { configureNotify, notifyRunJobOutcome, eventText, NOTIFY_EVENTS } from "../services/notify.js";
import { buildNodes } from "../client/src/lib/draftHouseTree.js";
import { solvableHere } from "../client/src/lib/applyObstacles.js";

// ⭐ A186-CAPTCHA (1b) · NO TIME LIMIT (owner 11-12). A held check (held_gate / captcha_required) stays solvable whenever
// the person comes back: Solve it here re-runs it FAST from what the first run made — its typed answers (also the approved
// set: the drift gate) and its résumé file — with NO model call, NO re-tailoring and NO new draft; the live check opens
// when it comes up. ⛔ Nothing in draft answers a check: in the real-Chrome test below the click is the test standing in
// for the person. Synthetic person (Ada), synthetic jobs; nothing leaves this machine.

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const PROFILE_PAYLOAD = { field_map: { first_name: "Ada", last_name: "Lovelace", full_name: "Ada Lovelace", email: "ada@example.com" }, handler_map: {}, custom_answers: {} };
const RESUME_HTML = "<html><body><h1>Ada Lovelace</h1><p>Analytical engines.</p></body></html>";
const MIN_PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");

function setup({ applyUrl = "https://boards.greenhouse.io/acme/jobs/1", answers, challengeAutoApply = null } = {}) {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, plan_tier TEXT DEFAULT 'PRO', auto_settings TEXT);
    CREATE TABLE domain_profiles (id INTEGER PRIMARY KEY, user_id INTEGER, profile_name TEXT, role_family TEXT, domain TEXT, is_active INTEGER DEFAULT 0, generate_at_queue INTEGER);
    CREATE TABLE user_profile (user_id INTEGER PRIMARY KEY, first_name TEXT, last_name TEXT, full_name TEXT, email TEXT, phone TEXT,
      custom_answers TEXT NOT NULL DEFAULT '{}', credit_draft INTEGER, desired_salary TEXT);
    CREATE TABLE scraped_jobs (job_id TEXT PRIMARY KEY, title TEXT, company TEXT, url TEXT, apply_url TEXT, source TEXT, location TEXT);
    CREATE TABLE resumes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, job_id TEXT, apply_mode TEXT, ats_score INTEGER, html TEXT, updated_at INTEGER);
    CREATE TABLE apply_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, mode TEXT, approval_mode TEXT, tool_type TEXT, status TEXT,
      total_jobs INTEGER, held_count INTEGER DEFAULT 0, submitted_count INTEGER DEFAULT 0, failed_count INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch()), started_at INTEGER, finished_at INTEGER);
    CREATE TABLE apply_run_jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER, user_id INTEGER, approved_at INTEGER, approved_from_run_job_id INTEGER,
      job_id TEXT, status TEXT, reason_code TEXT, reason_detail TEXT, started_at INTEGER, finished_at INTEGER, created_at INTEGER DEFAULT (unixepoch()),
      answers_json TEXT, resume_artifact_id INTEGER, resume_ats_score INTEGER, base_ats_score INTEGER, base_ats_json TEXT,
      screenshot_path TEXT, submit_verified INTEGER, submit_evidence TEXT, open_questions_json TEXT, hidden_at INTEGER, submitted_by TEXT,
      UNIQUE(run_id, job_id));
    CREATE TABLE apply_job_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER, run_job_id INTEGER, user_id INTEGER, job_id TEXT,
      level TEXT DEFAULT 'info', event TEXT, message TEXT, details_json TEXT, created_at INTEGER DEFAULT (unixepoch()));
    CREATE TABLE job_applications (user_id INTEGER, job_id TEXT, company TEXT, role TEXT, job_url TEXT, source TEXT, location TEXT, apply_mode TEXT,
      resume_file TEXT, applied_at INTEGER, notes TEXT, auto_status TEXT, ats_score_at_apply INTEGER, ats_scorer_version TEXT,
      ats_report_at_apply TEXT, ats_scored_at INTEGER, UNIQUE(user_id, job_id));
    CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER DEFAULT (unixepoch()));
    CREATE TABLE apply_idempotency (user_id INTEGER NOT NULL, idem_key TEXT NOT NULL, endpoint TEXT NOT NULL, status_code INTEGER NOT NULL DEFAULT 200,
      response_json TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT (unixepoch()), PRIMARY KEY (user_id, idem_key));
    INSERT INTO users (id, username) VALUES (1, 'ada'), (2, 'bob');
    INSERT INTO user_profile (user_id, first_name, last_name, full_name, email) VALUES (1, 'Ada', 'Lovelace', 'Ada Lovelace', 'ada@example.com');
  `);
  db.prepare("INSERT INTO scraped_jobs (job_id, title, company, url, apply_url, source) VALUES ('gh::chk', 'Engineer', 'Acme', ?, ?, 'greenhouse')").run(applyUrl, applyUrl);
  const resumeId = db.prepare("INSERT INTO resumes (user_id, job_id, ats_score, html) VALUES (1, 'gh::chk', 81, ?)").run(RESUME_HTML).lastInsertRowid;
  const runId = db.prepare("INSERT INTO apply_runs (user_id, mode, approval_mode, tool_type, status, total_jobs, held_count) VALUES (1, 'auto', 'approved', 'generate', 'completed', 1, 1)").run().lastInsertRowid;
  const held = db.prepare(`INSERT INTO apply_run_jobs (run_id, user_id, job_id, status, reason_code, answers_json, resume_artifact_id, submit_evidence, finished_at)
    VALUES (?, 1, 'gh::chk', 'held_gate', 'captcha_required', ?, ?, 'captcha_timeout', unixepoch())`).run(runId, JSON.stringify(answers), resumeId).lastInsertRowid;

  // ⛔ Every paid / counted path is a spy that records — the re-run must never reach any of them.
  const spent = { generate: 0, coverLetter: 0, score: 0, draftAnswers: 0, pdf: [] };
  const generateResumeForApply = async () => { spent.generate++; return { error: "must not be called" }; };
  const generateCoverLetterForApply = async () => { spent.coverLetter++; return null; };
  const scoreBase = async () => { spent.score++; return null; };
  const draftRunAnswers = async () => { spent.draftAnswers++; return {}; };
  const htmlToPdf = async (html) => { spent.pdf.push(html); return MIN_PDF; };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: Number(req.headers["x-user"] || 1), planTier: "PRO" }; next(); });
  applyRoutes(app, db, (q, r, n) => n(), () => ({ ...PROFILE_PAYLOAD }), generateResumeForApply, htmlToPdf, generateCoverLetterForApply, scoreBase,
    { draftRunAnswers, challengeAutoApply });
  const server = app.listen(0);
  return { db, server, url: `http://127.0.0.1:${server.address().port}`, held: Number(held), runId: Number(runId), resumeId: Number(resumeId), spent };
}
const post = (url, p, b = {}, user = 1) => fetch(`${url}${p}`, { method: "POST", headers: { "content-type": "application/json", "x-user": String(user) }, body: JSON.stringify(b) });
const getJson = (url, p, user = 1) => fetch(`${url}${p}`, { headers: { "x-user": String(user) } }).then(r => r.json());
const until = async (fn, ms = 20000, every = 100) => { const t = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t > ms) return null; await new Promise(r => setTimeout(r, every)); } };

const STORED = [
  { label: "First Name", name: "first_name", type: "text", value: "Ada", provenance: "profile" },
  { label: "Why do you want to work here?", name: "q_why", type: "textarea", value: "I build tools like yours.", provenance: "drafted" },
  { label: "Resume", name: "resume", type: "file", value: "resume.pdf" },
  { label: "Pronouns", name: "p", type: "text", value: null, skipped: true },
];

test("a186SolveLaterRerunsFromPayload: Solve it here re-fills from the stored answers and résumé — no generation, no model call, no new draft", async () => {
  _resetLiveChallenges();
  const calls = [];
  const fake = async (url, payload, options) => {
    calls.push({ url, payload, options, pdf: fs.readFileSync(options.resumePath) });
    return { status: "submitted", submitVerified: true, submitEvidence: "confirmation_page_after_person_check", answers: STORED };
  };
  const { db, server, url, held, runId, spent } = setup({ answers: STORED, challengeAutoApply: fake });
  try {
    const runsBefore = db.prepare("SELECT COUNT(*) FROM apply_runs").pluck().get();
    const jobsBefore = db.prepare("SELECT COUNT(*) FROM apply_run_jobs").pluck().get();
    // another person's row is not theirs to re-run
    assert.equal((await post(url, `/api/apply/run-jobs/${held}/solve-check`, {}, 2)).status, 404);
    const res = await post(url, `/api/apply/run-jobs/${held}/solve-check`);
    const body = await res.json();
    assert.equal(res.status, 202, JSON.stringify(body));
    assert.equal(body.rerun.runJobId, held);
    const done = await until(() => db.prepare("SELECT status FROM apply_run_jobs WHERE id=?").pluck().get(held) === "submitted");
    assert.ok(done, "the held row moves to submitted");
    assert.equal(calls.length, 1);
    const [c] = calls;
    // the first run's address, the same résumé (its stored HTML, made into a PDF — never generated again)
    assert.equal(c.url, "https://boards.greenhouse.io/acme/jobs/1");
    assert.deepEqual(spent.pdf, [RESUME_HTML]);
    assert.ok(c.pdf.equals(MIN_PDF), "the file attached is the stored résumé's PDF");
    assert.equal(c.options.mode, "full");
    assert.deepEqual(c.options.approvedAnswers, STORED, "the drift gate: nothing that differs from the first run's answers is sent");
    assert.equal(c.payload.drafted_answers["Why do you want to work here?"], "I build tools like yours.", "a drafted answer is reused, not drafted again");
    assert.equal(c.payload.drafted_answers.Resume, undefined, "a file is not a typed answer");
    assert.equal(c.payload.drafted_answers.Pronouns, undefined, "a skipped answer stays skipped");
    assert.equal(typeof c.options.onChallenge, "function", "the live session opens when the check comes up");
    // ⛔ no model call, no re-tailoring, no new draft (no run started — startRun is where a draft is counted)
    assert.deepEqual({ generate: spent.generate, coverLetter: spent.coverLetter, score: spent.score, draftAnswers: spent.draftAnswers },
      { generate: 0, coverLetter: 0, score: 0, draftAnswers: 0 });
    assert.equal(c.options.coverLetterOnDemand, undefined, "no cover letter is written");
    assert.equal(db.prepare("SELECT COUNT(*) FROM apply_runs").pluck().get(), runsBefore, "no new run");
    assert.equal(db.prepare("SELECT COUNT(*) FROM apply_run_jobs").pluck().get(), jobsBefore, "no new run job");
    const row = db.prepare("SELECT * FROM apply_run_jobs WHERE id=?").get(held);
    assert.equal(row.submit_verified, 1);
    assert.match(row.submit_evidence, /confirmation_page_after_person_check/);
    assert.equal(row.submitted_by, "user");
    const run = db.prepare("SELECT submitted_count, held_count FROM apply_runs WHERE id=?").get(runId);
    assert.deepEqual(run, { submitted_count: 1, held_count: 0 });
    const events = db.prepare("SELECT event FROM apply_job_logs WHERE run_job_id=? ORDER BY id").pluck().all(held);
    assert.ok(events.includes("challenge_rerun_started") && events.includes("challenge_rerun_done") && events.includes("submitted"), events.join());
    // ⛔ never twice: the row is sent now — a second Solve it here is refused
    assert.equal((await post(url, `/api/apply/run-jobs/${held}/solve-check`)).status, 409);
    assert.equal(calls.length, 1);
  } finally { server.close(); _resetLiveChallenges(); }
});

test("a186SolveLaterRerunsFromPayload: a job already sent, a gone résumé, or no stored answers is refused — nothing opens", async () => {
  const opened = [];
  const fake = async (...a) => { opened.push(a); return { status: "submitted" }; };
  for (const [name, mutate, code] of [
    ["already sent", (db) => db.prepare("INSERT INTO job_applications (user_id, job_id) VALUES (1, 'gh::chk')").run(), "already_sent"],
    ["résumé gone", (db, ctx) => db.prepare("DELETE FROM resumes WHERE id=?").run(ctx.resumeId), "no_stored_resume"],
    ["no answers", (db, ctx) => db.prepare("UPDATE apply_run_jobs SET answers_json=NULL WHERE id=?").run(ctx.held), "no_stored_answers"],
    ["not held on a check", (db, ctx) => db.prepare("UPDATE apply_run_jobs SET reason_code='login_required' WHERE id=?").run(ctx.held), "not_held_on_a_check"],
  ]) {
    const ctx = setup({ answers: STORED, challengeAutoApply: fake });
    try {
      mutate(ctx.db, ctx);
      const r = await post(ctx.url, `/api/apply/run-jobs/${ctx.held}/solve-check`);
      const b = await r.json();
      assert.equal(r.status, 409, name);
      assert.equal(b.error, code, name);
    } finally { ctx.server.close(); }
  }
  assert.equal(opened.length, 0, "no browser was opened for a refused re-run");
});

test("a186SolveLaterRerunsFromPayload: the batch queue runs several held checks one after another, never two at once", async () => {
  let inFlight = 0, most = 0;
  const order = [];
  const fake = async (url, payload, options) => {
    inFlight++; most = Math.max(most, inFlight);
    await new Promise(r => setTimeout(r, 150));
    inFlight--; order.push(options.jobId);
    return { status: "held_gate", reasonCode: "captcha_required", submitEvidence: "captcha_timeout" };
  };
  const ctx = setup({ answers: STORED, challengeAutoApply: fake });
  try {
    for (const j of ["gh::b", "gh::c"]) {
      ctx.db.prepare("INSERT INTO scraped_jobs (job_id, title, company, url, apply_url) VALUES (?, 'Engineer', 'Acme', 'https://boards.greenhouse.io/acme/jobs/2', 'https://boards.greenhouse.io/acme/jobs/2')").run(j);
      ctx.db.prepare(`INSERT INTO apply_run_jobs (run_id, user_id, job_id, status, reason_code, answers_json, resume_artifact_id) VALUES (?, 1, ?, 'held_gate', 'captcha_required', ?, ?)`)
        .run(ctx.runId, j, JSON.stringify(STORED), ctx.resumeId);
    }
    assert.equal(heldChecksOf(ctx.db, 1).length, 3);
    const live = await getJson(ctx.url, "/api/apply/live");
    assert.equal(live.held.length, 3, "the held checks are listed with the live sessions");
    const r = await post(ctx.url, "/api/apply/solve-checks");
    assert.equal(r.status, 202);
    const all = await until(() => order.length === 3, 10000);
    assert.ok(all, `all three ran: ${order.join()}`);
    assert.equal(most, 1, "one at a time");
    assert.deepEqual(order, ["gh::chk", "gh::b", "gh::c"], "oldest first");
    const st = await getJson(ctx.url, "/api/apply/live");
    assert.equal(st.queue.length, 0);
    assert.ok(st.reruns.every(x => x.outcome === "timeout"), "unsolved: still held, solvable again");
    assert.equal(heldChecksOf(ctx.db, 1).length, 3, "nothing sent, nothing lost — all three still wait, no deadline");
  } finally { ctx.server.close(); }
});

test("a186HeldRowOffersSolveItHere: the held row says what happened, offers Solve it here, and the nudge links it", async () => {
  // the Draft House node for a held check is not a sign-in
  const nodes = buildNodes({ gatedJobs: [{ id: 41, jobId: "gh::x", company: "Acme", title: "Engineer", reasonCode: "captcha_required", fill: { filled: 2, discovered: 2 }, createdAt: 1 },
    { id: 42, jobId: "gh::y", company: "Beta", title: "Engineer", reasonCode: "login_required", createdAt: 1 }] });
  const chk = nodes.find(n => n.jobId === "gh::x"), login = nodes.find(n => n.jobId === "gh::y");
  assert.match(chk.say, /quick check.*Solve it here/);
  assert.doesNotMatch(chk.say, /signed in|minute|deadline/i);
  assert.match(login.say, /signed in/);
  // the panel's held row: Solve it here for a check, one way to start it (LiveCheck owns the POST)
  const panel = read("client/src/panels/AutoApplyPanel.jsx");
  const gated = panel.slice(at(panel, 'case "gated": {'), at(panel, 'case "inflight":'));
  assert.match(gated, /solvableHere\(r\)[\s\S]*label: "Solve it here", kind: "primary"[\s\S]*draft:solve-check/);
  assert.equal(solvableHere({ status: "held_gate", reasonCode: "captcha_required" }), true);
  assert.equal(solvableHere({ status: "held_gate", reasonCode: "login_required" }), false);
  assert.equal(solvableHere({ status: "held_review", reasonCode: "captcha_required" }), false, "a sign-in-style hold is not this");
  assert.equal(solvableHere({ status: "held_gate", reasonCode: "captcha_required", fill: null }), false, "a check BEFORE the form (no answers made) is not re-run");
  assert.equal(solvableHere({ status: "held_gate", reasonCode: "captcha_required", fill: { filled: 3, discovered: 3 } }), true);
  const live = read("client/src/components/LiveCheck.jsx");
  assert.match(live, /addEventListener\("draft:solve-check"/);
  assert.match(live, /\/api\/apply\/run-jobs\/\$\{encodeURIComponent\(runJobId\)\}\/solve-check/);
  assert.match(live, /\/api\/apply\/solve-checks/, "the batch queue");
  assert.match(live, /get\("check"\)/, "the nudge's link points at its row");
  assert.doesNotMatch(live.slice(at(live, "export default function LiveCheck")), /expires in|hurry|before it's gone/i, "no deadline on a held check");
  // the nudge: push / email "An application needs a quick check", linking the held row
  assert.equal(eventText("quick_check").body, "An application needs a quick check.");
  assert.deepEqual(NOTIFY_EVENTS.quick_check.defaults, { push: true, email: true });
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE apply_run_jobs (id INTEGER PRIMARY KEY, user_id INTEGER, status TEXT, reason_code TEXT);
    CREATE TABLE apply_remote_runs (run_job_id INTEGER, state TEXT);
    CREATE TABLE notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, type TEXT, message TEXT, payload TEXT, created_at INTEGER DEFAULT (unixepoch()));
    CREATE TABLE notification_prefs (user_id INTEGER, event TEXT, push INTEGER, email INTEGER);
    INSERT INTO apply_run_jobs VALUES (7, 1, 'held_gate', 'captcha_required'), (8, 1, 'held_gate', 'login_required');`);
  const config = configureNotify({ db, fetchImpl: async () => ({ ok: true, status: 201 }), env: {}, log: { warn() {} } });
  try {
    await notifyRunJobOutcome(db, 7, { config });
    await notifyRunJobOutcome(db, 8, { config });
    const rows = db.prepare("SELECT type, message, payload FROM notifications ORDER BY id").all();
    assert.equal(rows[0].type, "quick_check");
    assert.equal(rows[0].message, "An application needs a quick check.");
    assert.equal(JSON.parse(rows[0].payload).url, "/app/auto-apply?check=7", "the link opens the held row");
    assert.equal(rows[1].type, "needs_you", "a sign-in wall keeps its own nudge");
  } finally { configureNotify({}); }
});

test("a186 (4): Admin counts the checks by kind; draftedFromAnswers keeps only typed answers", () => {
  assert.deepEqual(draftedFromAnswers(STORED), { "First Name": "Ada", "Why do you want to work here?": "I build tools like yours." });
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE apply_job_logs (id INTEGER PRIMARY KEY, event TEXT, details_json TEXT, created_at INTEGER DEFAULT (unixepoch()));
    CREATE TABLE apply_run_jobs (id INTEGER PRIMARY KEY, status TEXT, reason_code TEXT, hidden_at INTEGER);
    INSERT INTO apply_run_jobs (status, reason_code) VALUES ('held_gate', 'captcha_required'), ('held_gate', 'login_required');`);
  const ins = db.prepare("INSERT INTO apply_job_logs (event, details_json) VALUES (?, ?)");
  ins.run("challenge_live", JSON.stringify({ kind: "recaptcha" }));
  ins.run("challenge_live", JSON.stringify({ kind: "recaptcha" }));
  ins.run("challenge_no_live", JSON.stringify({ kind: "hcaptcha" }));
  ins.run("challenge_live", JSON.stringify({ kind: "recaptcha", rerun: true }));   // met again by Solve it here
  ins.run("challenge_outcome", JSON.stringify({ kind: "recaptcha", outcome: "submitted" }));
  ins.run("challenge_outcome", JSON.stringify({ kind: "recaptcha", outcome: "timeout" }));
  const c = challengeKindCounts(db);
  assert.equal(c.waiting, 1);
  assert.deepEqual(c.kinds.find(k => k.kind === "recaptcha"), { kind: "recaptcha", seen: 3, solved: 1, timedOut: 1, noLive: 0, reruns: 1 });
  assert.deepEqual(c.kinds.find(k => k.kind === "hcaptcha"), { kind: "hcaptcha", seen: 1, solved: 0, timedOut: 0, noLive: 1, reruns: 0 });
  assert.match(read("server.js"), /app\.get\("\/api\/admin\/quick-checks", requireAdmin/);
  assert.match(read("client/src/panels/AdminPanel.jsx"), /<QuickChecksSection theme=\{theme\}\/>/);
});

// ── real Chrome: the test challenge on a local practice form (test/a186LiveCheck.test.js's fixture) ─────────────────
const FORM = `<!doctype html><html><body>
<form id="f"><label for="n">Full name</label><input id="n" name="name" required>
<label for="e">Email</label><input id="e" name="email" type="email" required>
<button type="submit">Submit Application</button></form>
<script>
let solved = false;
document.getElementById('f').addEventListener('submit', (ev) => {
  ev.preventDefault();
  if (!solved) {
    if (!document.getElementById('ch')) {
      const f = document.createElement('iframe'); f.id = 'ch'; f.src = '/recaptcha/api2/bframe?k=test';
      f.style = 'position:fixed;left:100px;top:100px;width:400px;height:580px;border:0;background:#fff';
      document.body.appendChild(f);
    }
    return;
  }
  location.href = '/thanks';
});
window.addEventListener('message', (m) => { if (m.data === 'solved') { solved = true; document.getElementById('ch')?.remove(); } });
</script></body></html>`;
const CHALLENGE = `<!doctype html><html><body style="margin:0">
<button id="b" style="width:400px;height:580px;font-size:24px" onclick="parent.postMessage('solved','*')">I am a person</button>
</body></html>`;
const THANKS = `<!doctype html><html><body><h1>Thank you for applying!</h1></body></html>`;
function serveForm() {
  const s = http.createServer((req, res) => {
    const send = (b) => { res.writeHead(200, { "content-type": "text/html" }); res.end(b); };
    if (req.url.startsWith("/recaptcha/")) return send(CHALLENGE);
    if (req.url.startsWith("/thanks")) return send(THANKS);
    return send(FORM);
  });
  return new Promise(r => s.listen(0, "127.0.0.1", () => r(s)));
}

test("a186RerunToCheckUnder30s: real Chrome — click Solve it here → the live check is open in ≤ 30 s; the person's click sends it", { timeout: 240000 }, async () => {
  _resetLiveChallenges();
  const form = await serveForm();
  const formUrl = `http://127.0.0.1:${form.address().port}/apply`;
  // THE FIRST RUN (unmeasured): the worker filled, pressed Submit, met the check, nobody was there → held. Its answers
  // are what a held row stores.
  const tmpPdf = `${process.env.TEMP || "/tmp"}/a186-first-run.pdf`;
  fs.writeFileSync(tmpPdf, MIN_PDF);
  const first = await autoApply(formUrl, PROFILE_PAYLOAD, { mode: "full", jobId: "gh::chk", resumePath: tmpPdf, onChallenge: async () => null });
  assert.equal(first.status, "held_gate", JSON.stringify({ s: first.status, r: first.reasonCode }));
  assert.equal(first.reasonCode, "captcha_required");
  assert.ok(Array.isArray(first.answers) && first.answers.length >= 2);
  const ctx = setup({ applyUrl: formUrl, answers: first.answers });   // the real autoApply
  try {
    const t0 = Date.now();
    const r = await post(ctx.url, `/api/apply/run-jobs/${ctx.held}/solve-check`);
    assert.equal(r.status, 202, JSON.stringify(await r.clone().json()));
    const live = await until(async () => (await getJson(ctx.url, "/api/apply/live")).sessions.find(s => String(s.runJobId) === String(ctx.held)), 60000, 200);
    const ms = Date.now() - t0;
    console.log(`[a186RerunToCheckUnder30s] click → live check: ${ms} ms`);
    assert.ok(live, "the live check opened");
    assert.ok(ms <= 30000, `click → live check took ${ms} ms (target ≤ 30 s)`);
    const st = await getJson(ctx.url, "/api/apply/live");
    assert.equal(st.reruns[0].state, "live");
    // the PERSON (the test standing in): clicks the check through the session — its centre (100 + 200, 100 + 290)
    await new Promise(res => setTimeout(res, 700));
    const click = await post(ctx.url, `/api/apply/live/${ctx.held}/input`, { type: "click", x: 300, y: 390 });
    assert.equal(click.status, 200);
    const sent = await until(() => ctx.db.prepare("SELECT status FROM apply_run_jobs WHERE id=?").pluck().get(ctx.held) === "submitted", 60000, 250);
    const row = ctx.db.prepare("SELECT status, submit_verified, submit_evidence FROM apply_run_jobs WHERE id=?").get(ctx.held);
    assert.ok(sent, JSON.stringify({ row, events: ctx.db.prepare("SELECT event, message FROM apply_job_logs ORDER BY id").all() }));
    assert.equal(row.submit_verified, 1);
    assert.match(row.submit_evidence, /confirmation_page_after_person_check/);
    assert.deepEqual([ctx.spent.generate, ctx.spent.coverLetter, ctx.spent.draftAnswers], [0, 0, 0], "no model call on the way");
    const done = ctx.db.prepare("SELECT details_json FROM apply_job_logs WHERE event='challenge_live'").pluck().get();
    assert.equal(JSON.parse(done).kind, "recaptcha", "counted by kind");
  } finally { ctx.server.close(); form.close(); _resetLiveChallenges(); try { fs.unlinkSync(tmpPdf); } catch {} }
});

// 46j: the combined suite's boardSecondLoadParity found LiveCheck holding a second EventSource open (the app may own one).
test("a186LiveViewPollsFrames: the viewer polls /frame (no EventSource); the route answers the owner's newest frame, 204 when nothing newer, 404 once gone", async () => {
  const live = read("client/src/components/LiveCheck.jsx");
  assert.doesNotMatch(live.replace(/^\s*\/\/.*$/gm, ""), /new\s+EventSource\s*\(/);
  assert.match(live, /\/frame\?after=\$\{after\}/);
  const src = read("routes/apply.js");
  const route = src.slice(at(src, 'app.get("/api/apply/live/:runJobId/frame", requireAuth'), at(src, 'app.post("/api/apply/live/:runJobId/input"'));
  assert.match(route, /liveSessionFor\(req\.params\.runJobId, req\.user\.id\)/, "owner only");
  assert.match(route, /status\(404\)/);
  assert.match(route, /f\.at <= Number\(req\.query\.after \|\| 0\)\) return res\.status\(204\)/);
});
