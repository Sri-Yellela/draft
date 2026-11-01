// D124 — THE TRIAL (owner 11-01, twice amended): THE TRIAL IS THE MAIN FRAME — every new account is a trial account unless
// an admin grants it exclusive access; 2 Drafts, then the site locks into the survey and a coming-soon page. THE SAFETY
// RULE (a sample résumé never reaches a real employer — its Drafts fill draft's practice form), the practice form end to
// end over HTTP, the survey and feedback, the analytics, and Admin → Trial's counts. Synthetic accounts; the two samples
// are fictional people.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import express from "express";
import multer from "multer";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import trialRoutes from "../routes/trial.js";
import { samples, sampleIdForText, activeSampleId, trialSendUrl, practiceUrlFor, verifyPracticeToken, startTrial, pickResume,
         trialState, saveSurvey, cleanSurvey, saveFeedback, adminTrialCounts, surveyExport, isTrial, SURVEY_AFTER_SENT,
         dismissSurvey, finishTrial, setAccess, recordEvent, TRIAL_DRAFTS, SURVEY } from "../services/trial.js";
import { clearPicksCache } from "../services/trialPicks.js";
import { draftSlots, slotsExhausted } from "../services/draftSlots.js";
import { detectPlatformFromUrl } from "../services/platformDetector.js";
import { tailoringFor } from "../services/leanTailoring.js";

// The preload turns the trial off for the rest of the suite (test-support/isolateTrackingSink.mjs); these tests are about it.
process.env.DRAFT_TRIAL = "on";
const SECRET = "test-secret";
const lf = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

function freshDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1, 'tester', 'x'), (2, 'owner-of-real-resume', 'x')").run();
  db.prepare("INSERT INTO scraped_jobs (job_id, search_query, _hash, title, company, url, apply_url) VALUES ('gh::1', 'q', 'h1', 'Backend Engineer', 'Acme Robotics', 'https://boards.greenhouse.io/acme/jobs/1', 'https://boards.greenhouse.io/acme/jobs/1')").run();
  return db;
}
function withBase(db, userId, text) {
  const r = db.prepare("INSERT INTO domain_profiles (user_id, profile_name, role_family, domain, is_active) VALUES (?, 'p', 'engineering', 'it_digital', 1)").run(userId);
  db.prepare("INSERT INTO profile_base_resumes (profile_id, user_id, content, name) VALUES (?, ?, ?, 'r.txt')").run(r.lastInsertRowid, userId, text);
}
const REAL = "Jordan Example\nEXPERIENCE\nEngineer, Example Corp | 2021 - Present\n- Built services in Go\n".repeat(4);

test("d124SampleNeverSubmitsToRealEmployer: a sample résumé's Draft is sent to draft's practice form, keyed on the résumé, not the account", () => {
  const db = freshDb();
  withBase(db, 1, samples().A.resumeText);
  withBase(db, 2, REAL);
  assert.equal(activeSampleId(db, 1), "A");
  assert.equal(activeSampleId(db, 2), null);
  setAccess(db, { who: "tester", access: "full", by: "test" });
  assert.equal(isTrial(db, 1), false, "granted full access — and still the rule holds: it is the résumé that decides");
  const url = trialSendUrl(db, { userId: 1, jobId: "gh::1", baseUrl: "https://jobsviadraft.com", secret: SECRET });
  assert.match(url, /^https:\/\/jobsviadraft\.com\/try\/practice\/gh%3A%3A1\?u=1&t=/);
  assert.equal(trialSendUrl(db, { userId: 2, jobId: "gh::1", baseUrl: "https://jobsviadraft.com", secret: SECRET }), null, "an own résumé sends for real");
  assert.equal(sampleIdForText(`  ${samples().B.resumeText.toUpperCase()}  `), "B", "whitespace and case aside");
  // The run's target is chosen from it, at the one place a run picks its URL.
  const apply = lf("routes/apply.js");
  assert.match(apply, /const practiceUrl = trialSendUrl\(db, \{ userId, jobId: String\(jobId\)[^\n]*\n\s*const jobUrl = practiceUrl \|\| job\.apply_url \|\| job\.url;/);
  assert.equal(detectPlatformFromUrl(url), "greenhouse", "the engine fills it as a Greenhouse form");
});

test("d124PracticeTokenNamesOneAccountAndPosting", () => {
  const url = new URL(practiceUrlFor({ baseUrl: "http://x", secret: SECRET, userId: 7, jobId: "j1" }));
  const t = url.searchParams.get("t");
  assert.equal(verifyPracticeToken({ secret: SECRET, jobId: "j1", u: "7", t }), 7);
  assert.equal(verifyPracticeToken({ secret: SECRET, jobId: "j2", u: "7", t }), null, "not movable to another posting");
  assert.equal(verifyPracticeToken({ secret: SECRET, jobId: "j1", u: "8", t }), null, "not movable to another account");
  assert.equal(verifyPracticeToken({ secret: "other", jobId: "j1", u: "7", t }), null);
});

async function serve(db, delivered) {
  const app = express();
  app.use(express.json());
  const requireAuth = (req, res, next) => { req.user = { id: Number(req.get("x-user") || 0) }; return req.user.id ? next() : res.status(401).end(); };
  const requireAdmin = (req, res, next) => (req.get("x-admin") === "1" ? next() : res.status(403).end());
  trialRoutes(app, db, { requireAuth, requireAdmin, secret: SECRET, upload: multer({ storage: multer.memoryStorage() }), deliver: (m) => delivered.push(m) });
  const server = http.createServer(app);
  await new Promise(r => server.listen(0, r));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

test("d124PracticeFormSubmitsEndToEnd + d124ConfirmationInInbox: the form serves, takes a submission with a résumé, counts it and confirms in the Inbox", async () => {
  const db = freshDb();
  const delivered = [];
  const { server, base } = await serve(db, delivered);
  try {
    const path = new URL(practiceUrlFor({ baseUrl: base, secret: SECRET, userId: 1, jobId: "gh::1" }));
    const page = await fetch(path);
    assert.equal(page.status, 200);
    const html = await page.text();
    for (const f of ["first_name", "last_name", "email", "resume"]) assert.match(html, new RegExp(`name="job_application\\[${f}\\]"`));
    assert.match(html, /Nothing sent here reaches Acme Robotics/);
    assert.match(html, /See the real job/);
    assert.ok(!/type="checkbox"/.test(html), "no consent box for draft to tick or not");
    assert.equal((await fetch(`${base}/try/practice/gh%3A%3A1?u=1&t=forged`)).status, 404);

    const form = new FormData();
    form.set("job_application[first_name]", "Maya");
    form.set("job_application[last_name]", "Okafor");
    form.set("job_application[email]", "maya.okafor@example.com");
    form.set("job_application[resume]", new Blob(["%PDF-1.4 sample"], { type: "application/pdf" }), "resume.pdf");
    const action = html.match(/action="([^"]+)"/)[1].replace(/&amp;/g, "&");
    const sent = await fetch(base + action, { method: "POST", body: form });
    assert.equal(sent.status, 200);
    assert.match(await sent.text(), /Nothing was sent to the employer/);
    const row = db.prepare("SELECT user_id, job_id, fields_filled, resume_attached FROM practice_submissions").get();
    assert.deepEqual(row, { user_id: 1, job_id: "gh::1", fields_filled: 3, resume_attached: 1 });
    assert.equal(delivered.length, 1);
    assert.equal(delivered[0].userId, 1);
    assert.match(delivered[0].subject, /Thank you for applying to Acme Robotics/);
    assert.ok(!JSON.stringify(db.prepare("SELECT * FROM practice_submissions").all()).includes("Okafor"), "counts only, never the values");
  } finally { server.close(); }
});

test("d124TrialFlagged + the résumé pick: the first load starts the trial's clock once; a sample's text comes back for the normal onboarding", async () => {
  const db = freshDb();
  const { server, base } = await serve(db, []);
  const call = (p, body, user = "1") => fetch(base + p, { method: body ? "POST" : "GET", headers: { "x-user": user, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));
  try {
    const st = await call("/api/trial/state");
    assert.equal(st.body.trial, true);
    assert.equal(st.body.hasProfile, false);
    assert.equal(st.body.drafts, TRIAL_DRAFTS);
    const first = db.prepare("SELECT trial_at FROM users WHERE id = 1").get().trial_at;
    assert.ok(first);
    await call("/api/trial/start", {});
    assert.equal(db.prepare("SELECT trial_at FROM users WHERE id = 1").get().trial_at, first);
    // D124 amended (11-01, changed on purpose): a sample is offered only with 10 good picks in its category today.
    const refused = await call("/api/trial/resume", { choice: "B" });
    assert.deepEqual([refused.status, refused.body.error], [409, "sample_not_offered"], "an empty board offers no sample");
    const ins = db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, _hash, title, company, url, source, is_active, discovered_at,
      description, board_category, bucket_seniority) VALUES (?, 't', ?, 'Machine Learning Engineer', 'Co', ?, 'greenhouse', 1, unixepoch(), ?, 'computing', 'mid')`);
    for (let i = 0; i < 12; i++) ins.run(`ml${i}`, `h${i}`, `https://example.com/ml${i}`,
      "We are hiring a Machine Learning Engineer. Build models in Python with PyTorch and scikit-learn; Airflow, Spark, Kubernetes, AWS, SQL, MLflow.");
    clearPicksCache();  // the short answer above is cached for an hour; the board just changed
    const picked = await call("/api/trial/resume", { choice: "B" });
    assert.equal(picked.body.sample.id, "B");
    assert.match(picked.body.sample.fictional, /fictional person/);
    assert.equal(picked.body.sample.content, samples().B.resumeText);
    assert.equal((await call("/api/trial/resume", { choice: "Z" })).status, 400);
    assert.equal((await call("/api/admin/trial")).status, 403, "admin only");
    assert.equal((await call("/api/admin/trial/access", { who: "tester", access: "full" })).status, 403, "admin only");
    assert.equal(tailoringFor({ env: {}, isTrial: isTrial(db, 1) }), "lean", "a trial account's generations use the lean Haiku call");
  } finally { server.close(); }
});

test("d124MainFrame: every account made after migration 205 is a trial account unless granted; older ones keep full access; admins never", () => {
  const db = freshDb();
  assert.equal(isTrial(db, 1), true, "made after trial_since: in the trial by default");
  const since = db.prepare("SELECT value FROM trial_config WHERE key = 'trial_since'").get().value;
  db.prepare("INSERT INTO users (id, username, password_hash, created_at) VALUES (3, 'older', 'x', ?)").run(since - 86400);
  assert.equal(isTrial(db, 3), false, "an account from before the trial keeps the whole site");
  assert.match(lf("services/trial.js"), /if \(!u \|\| u\.is_admin\) return false;/, "an admin is never a trial account (a trigger keeps the flag out of fixtures)");
  assert.equal(setAccess(db, { who: "older", access: "trial", by: "owner" }).trial, true, "an admin can put an older account into the trial");
  assert.equal(setAccess(db, { who: "1", access: "full", by: "owner" }).trial, false, "exclusive access, by id");
  assert.equal(setAccess(db, { who: "tester", access: "default" }).trial, true, "back to the default");
  assert.throws(() => setAccess(db, { who: "nobody", access: "full" }), /No account/);
  assert.equal(trialState(db, 3).trial, true);
  setAccess(db, { who: "older", access: "full" });
  assert.deepEqual(trialState(db, 3), { trial: false });
});

test("d124TwoDraftCap: a trial account has 2 Drafts in all, not per day; the refusal says it is the trial", () => {
  const db = freshDb();
  const run = db.prepare("INSERT INTO apply_runs (user_id) VALUES (1)").run().lastInsertRowid;
  let n = 0;
  const draft = (status) => db.prepare("INSERT INTO apply_run_jobs (run_id, user_id, job_id, status, created_at) VALUES (?, 1, ?, ?, ?)").run(run, `gh::${++n}`, status, 1);
  assert.equal(draftSlots(db, 1).remaining, TRIAL_DRAFTS);
  draft("submitted"); draft("held_review");
  const slots = draftSlots(db, 1);
  assert.equal(slots.remaining, 0, "two Drafts, however long ago, use the trial up");
  assert.equal(slots.trial, true);
  assert.match(slotsExhausted(slots).message, /The trial includes 2 Drafts/);
  setAccess(db, { who: "tester", access: "full" });
  assert.ok(draftSlots(db, 1).remaining > 0, "full access: the normal daily allowance");
});

test("d124LockAfterSecondDraft: the 2nd sent Draft (or Finish the trial) locks the site into the survey, then coming soon", () => {
  const db = freshDb();
  startTrial(db, 1);
  const run = db.prepare("INSERT INTO apply_runs (user_id) VALUES (1)").run().lastInsertRowid;
  let n = 0;
  const send = () => db.prepare("INSERT INTO apply_run_jobs (run_id, user_id, job_id, status) VALUES (?, 1, ?, 'submitted')").run(run, `gh::${++n}`);
  send();
  assert.equal(trialState(db, 1).locked, false);
  assert.equal(SURVEY_AFTER_SENT, 2);
  send();
  assert.equal(trialState(db, 1).locked, true);
  assert.equal(trialState(db, 1).surveyDue, true);
  dismissSurvey(db, 1);
  assert.equal(trialState(db, 1).surveyDue, false, "skipped: the coming-soon page");
  assert.equal(trialState(db, 1).locked, true, "the site stays locked");
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (5, 'early', 'x')").run();
  finishTrial(db, 5);
  assert.equal(trialState(db, 5).locked, true, "Finish the trial locks with no Draft sent");
  const gate = lf("client/src/components/TrialDock.jsx");
  assert.match(gate, /if \(state\.locked\) \{\s*return state\.surveyDue && !ended\s*\? <SurveyPage/);
  assert.match(gate, /The full version is coming soon/);
});

test("d124AnalyticsCountsOnly: pages (ids stripped) and active minutes, for trial accounts, and nothing else", () => {
  const db = freshDb();
  assert.equal(recordEvent(db, 1, { event: "page", detail: "/app/job/12345?x=1" }), true);
  assert.equal(recordEvent(db, 1, { event: "page", detail: "/app/job/for/greenhouse::99" }), true);
  assert.equal(recordEvent(db, 1, { event: "active_minute" }), true);
  assert.equal(recordEvent(db, 1, { event: "keystrokes", detail: "secret" }), false);
  setAccess(db, { who: "owner-of-real-resume", access: "full" });
  assert.equal(recordEvent(db, 2, { event: "page", detail: "/app" }), false, "not a trial account: nothing recorded");
  assert.deepEqual(db.prepare("SELECT event, detail FROM trial_events ORDER BY id").all(),
    [{ event: "page", detail: "/app/job/:id" }, { event: "page", detail: "/app/job/for/:id" }, { event: "active_minute", detail: null }]);
  startTrial(db, 1);
  const c = adminTrialCounts(db);
  assert.deepEqual(c.usage.pages, { "/app/job/:id": 1, "/app/job/for/:id": 1 });
  assert.equal(c.usage.medianActiveMinutes, 1);
});

test("d124SurveyValidated + d124AdminTrialCountsOnly: unknown keys and bad values dropped; the admin sees counts, the export has no emails", () => {
  const db = freshDb();
  assert.deepEqual(cleanSurvey({ would_use: "definitely", useful: 9, frustrations: ["no_replies", "tailoring", "fake_or_stale"], hack: "x",
                                 followup_email: "not an email", thoughts: "  faster please  ", improvement: "mobile_app", target_role: "astronaut" }),
                   { frustrations: ["no_replies", "tailoring"], improvement: "mobile_app", thoughts: "faster please" });
  assert.equal(SURVEY.at(-2).key, "thoughts", "it ends in the tester's own words (then the optional follow-up email)");
  assert.equal(SURVEY.find(q => q.key === "improvement").type, "select", "the suggested improvements are a dropdown");
  startTrial(db, 1); pickResume(db, 1, "A");
  // D129 (11-01, changed on purpose): the overall "useful" became a 1–5 rating per section.
  saveSurvey(db, 1, { would_use: "maybe", rate_picks: 5, frustrations: ["no_replies"], followup_email: "tester@example.com", thoughts: "Nice." });
  saveFeedback(db, 1, { body: "The board took a while", screen: "/app" });
  assert.throws(() => saveFeedback(db, 1, { body: "  " }), /Write a line/);
  const c = adminTrialCounts(db);
  assert.deepEqual(c.funnel, { started: 1, pickedResume: 1, draft1Sent: 0, draft2Sent: 0, surveySubmitted: 1 });
  assert.equal(c.picked.A, 1);
  assert.deepEqual(c.survey.wouldUse, { maybe: 1 });
  assert.equal(c.survey.thoughts, 1);
  assert.equal(c.sectionUseful.picks, 5);
  assert.equal(c.followupEmails, 1);
  assert.ok(!JSON.stringify(c).includes("tester@example.com"), "counts only");
  assert.ok(!JSON.stringify(c).includes("Nice."), "the thoughts are counted here, read in the export");
  const ex = surveyExport(db);
  assert.equal(ex.length, 1);
  assert.equal(ex[0].followup_email, undefined, "the export carries no emails");
  assert.equal(ex[0].resume, "A");
  assert.equal(ex[0].thoughts, "Nice.");
});

test("d124NoExtensionNeeded + d124MobileFlow: /try and the gate are web pages; the samples are fictional and say so", () => {
  const app = lf("client/src/App.jsx");
  assert.match(app, /<Route path="\/try" element=/);
  assert.match(app, /<TrialGate><AppDashboard/);
  const tryPage = lf("client/src/pages/TryPage.jsx");
  assert.ok(!/extension/i.test(tryPage), "nothing in /try asks for the extension");
  assert.match(tryPage, /repeat\(auto-fit, minmax\(220px, 1fr\)\)/, "the cards reflow to one column on a phone");
  assert.match(tryPage, /width: "min\(760px, calc\(100% - 32px\)\)"/, "a 16 px gutter at phone width");
  for (const s of Object.values(samples())) {
    assert.match(s.fictional, /fictional person/);
    assert.match(s.candidate.email, /@example\.com$/);
    assert.match(s.candidate.phone, /\(555\) 010-/);
  }
});
