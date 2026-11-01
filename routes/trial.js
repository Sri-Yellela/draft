// ⭐ D124 · THE TRIAL's routes (services/trial.js has the rules). Mounted as trialRoutes(app, db, deps), so
// test/authRouteGuardManifest.test.js enumerates every /api route here with its guard.
//
//   POST /api/trial/start            the signed-in account becomes a trial account (after /try's sign-up)
//   GET  /api/trial/samples          D124 amended: the six samples, each OFFERED only with 10 good picks in its category today
//   GET  /api/trial/picks            the account's 10 picks: its sample's, or its own résumé's category's (or why there are none)
//   POST /api/trial/resume           { choice: "A"…"F" | "own" } — a hidden sample is refused — a sample's text comes back for the normal
//                                    /api/domain-profiles/from-resume onboarding, so the board is read from it as for anyone
//   GET  /api/trial/state            { trial, hasProfile, sample, drafts, draftsUsed, sent, locked, surveyDue, survey } — and
//                                    starts the trial's clock on a trial account's first load (THE TRIAL IS THE MAIN FRAME)
//   POST /api/trial/finish           "Finish the trial": the site locks into the survey now
//   POST /api/trial/event            { event: "page" | "active_minute", detail } — the trial's analytics (names, counts)
//   POST /api/admin/trial/access     { who: id | username | email, access: "full" | "trial" | "default" } — exclusive access
//   POST /api/trial/survey           the answers (every question optional; validated, unknown keys dropped)
//   POST /api/trial/survey/dismiss   the survey skipped at the end (the coming-soon page follows)
//   POST /api/trial/feedback         { body, screen } — "Something broke? / Feedback"
//   GET  /api/admin/trial            Admin → Trial: counts only
//   GET  /api/admin/trial/export     the survey answers WITHOUT emails, as JSON
//   GET  /api/admin/trial/analytics  D129: the funnel (step times), drop-offs, interactions, errors, the survey; ?by=&value= narrows
//   GET  /api/admin/trial/crosscut   D129: one survey answer by sample | field | device | speed | draftsOk (?key=&by=)
//   GET  /api/admin/trial/export.csv D129: one row per tester; emails only with ?emails=1 and only those who gave one
//   GET  /try/practice/:jobId        draft's practice form for one posting (a signed ?u=&t= names the account)
//   POST /try/practice/:jobId        its submission: counted, and a confirmation goes into the tester's Inbox
import { startTrial, pickResume, trialState, saveSurvey, dismissSurvey, finishTrial, saveFeedback, recordEvent, setAccess,
         adminTrialCounts, surveyExport, SURVEY, trialAnalytics, crossCut, analyticsCsv, verifyPracticeToken, renderPracticeForm, renderPracticeThanks,
         recordPracticeSubmission } from "../services/trial.js";
import { draftSlots } from "../services/draftSlots.js";
import { offeredSamples, samplePicks, ownPicks } from "../services/trialPicks.js";

export default function trialRoutes(app, db, { requireAuth, requireAdmin, secret, upload, deliver = null }) {
  const fail = (res, e) => res.status(e.status || 500).json({ error: e.code || "error", message: e.message });
  // D124 amended: the day's picks are scored once (≈ 7 ms a posting, six samples) — warmed here, off the request path.
  setTimeout(() => { try { offeredSamples(db); } catch { /* the first request computes it */ } }, 20_000).unref?.();

  app.post("/api/trial/start", requireAuth, (req, res) => {
    try { res.json(startTrial(db, req.user.id)); } catch (e) { fail(res, e); }
  });

  app.get("/api/trial/samples", requireAuth, (_req, res) => {
    try { res.json({ samples: offeredSamples(db).map(({ id, label, category, offered }) => ({ id, label, category, offered })) }); }
    catch (e) { fail(res, e); }
  });

  app.get("/api/trial/picks", requireAuth, (req, res) => {
    try {
      const choice = db.prepare("SELECT trial_resume FROM users WHERE id = ?").pluck().get(req.user.id);
      if (choice && choice !== "own") return res.json({ sample: choice, picks: samplePicks(db, choice) });
      res.json({ sample: null, ...ownPicks(db, req.user.id) });
    } catch (e) { fail(res, e); }
  });

  app.post("/api/trial/resume", requireAuth, (req, res) => {
    try {
      const choice = req.body?.choice;
      // D124 amended: a sample whose category has fewer than 10 good picks today is hidden — and refused if asked for.
      if (choice !== "own" && offeredSamples(db).some(x => x.id === choice && !x.offered)) {
        return res.status(409).json({ error: "sample_not_offered", message: "That sample is not available today. Pick another, or use your own résumé." });
      }
      res.json(pickResume(db, req.user.id, choice));
    } catch (e) { fail(res, e); }
  });

  const state = (userId) => {
    startTrial(db, userId);
    let used = null;
    try { used = draftSlots(db, userId).drafts; } catch { /* a fixture without the apply tables */ }
    return trialState(db, userId, { draftsUsed: used });
  };

  app.get("/api/trial/state", requireAuth, (req, res) => {
    try { res.json({ ...state(req.user.id), survey: SURVEY }); } catch (e) { fail(res, e); }
  });

  app.post("/api/trial/finish", requireAuth, (req, res) => {
    try { finishTrial(db, req.user.id); res.json({ ...state(req.user.id), survey: SURVEY }); } catch (e) { fail(res, e); }
  });

  app.post("/api/trial/event", requireAuth, (req, res) => {
    try { res.json({ recorded: recordEvent(db, req.user.id, req.body || {}) }); } catch (e) { fail(res, e); }
  });

  app.post("/api/trial/survey", requireAuth, (req, res) => {
    try { res.json({ ok: true, answers: saveSurvey(db, req.user.id, req.body || {}) }); } catch (e) { fail(res, e); }
  });

  app.post("/api/trial/survey/dismiss", requireAuth, (req, res) => {
    try { dismissSurvey(db, req.user.id); res.json({ ok: true }); } catch (e) { fail(res, e); }
  });

  app.post("/api/trial/feedback", requireAuth, (req, res) => {
    try { saveFeedback(db, req.user.id, req.body || {}); res.json({ ok: true }); } catch (e) { fail(res, e); }
  });

  app.get("/api/admin/trial", requireAdmin, (_req, res) => {
    try { res.json(adminTrialCounts(db)); } catch (e) { fail(res, e); }
  });

  app.post("/api/admin/trial/access", requireAdmin, (req, res) => {
    try { res.json(setAccess(db, { who: req.body?.who, access: req.body?.access, by: req.admin?.email || req.admin?.username || "admin" })); }
    catch (e) { fail(res, e); }
  });

  app.get("/api/admin/trial/analytics", requireAdmin, (req, res) => {
    try {
      const filter = req.query.by ? { by: String(req.query.by), value: String(req.query.value ?? "") } : null;
      res.json(trialAnalytics(db, { filter }));
    } catch (e) { fail(res, e); }
  });

  app.get("/api/admin/trial/crosscut", requireAdmin, (req, res) => {
    const out = crossCut(db, { key: String(req.query.key || ""), by: String(req.query.by || "") });
    if (!out) return res.status(400).json({ error: "bad_crosscut", message: "key must be a survey question and by one of sample, field, device, speed, draftsOk." });
    res.json({ key: req.query.key, by: req.query.by, cut: out });
  });

  app.get("/api/admin/trial/export.csv", requireAdmin, (req, res) => {
    try {
      res.set("Content-Type", "text/csv; charset=utf-8").set("Content-Disposition", 'attachment; filename="draft-trial.csv"')
        .send(analyticsCsv(db, { includeEmails: req.query.emails === "1" }));
    } catch (e) { fail(res, e); }
  });

  app.get("/api/admin/trial/export", requireAdmin, (_req, res) => {
    try { res.json({ answers: surveyExport(db) }); } catch (e) { fail(res, e); }
  });

  // ── the practice form — posted by draft's own server-side browser, which has no user session ──
  const jobFor = (jobId) => { try { return db.prepare("SELECT job_id, title, company, url, apply_url FROM scraped_jobs WHERE job_id = ?").get(String(jobId)); } catch { return null; } };
  const html = (res, status, body) => res.status(status).type("html").set("Cache-Control", "no-store").send(body);

  app.get("/try/practice/:jobId", (req, res) => {
    const userId = verifyPracticeToken({ secret, jobId: req.params.jobId, u: req.query.u, t: req.query.t });
    const job = jobFor(req.params.jobId);
    if (!userId || !job) return html(res, 404, "<!doctype html><title>Not found</title><p>This practice form link is not valid.</p>");
    const action = `/try/practice/${encodeURIComponent(req.params.jobId)}?u=${encodeURIComponent(req.query.u)}&t=${encodeURIComponent(req.query.t)}`;
    html(res, 200, renderPracticeForm({ job, action }));
  });

  app.post("/try/practice/:jobId", upload.any(), (req, res) => {
    const userId = verifyPracticeToken({ secret, jobId: req.params.jobId, u: req.query.u, t: req.query.t });
    const job = jobFor(req.params.jobId);
    if (!userId || !job) return html(res, 404, "<!doctype html><title>Not found</title><p>This practice form link is not valid.</p>");
    const fields = Object.values(req.body?.job_application || {}).filter(v => String(v ?? "").trim()).length
      || Object.keys(req.body || {}).filter(k => k.startsWith("job_application[") && String(req.body[k] ?? "").trim()).length;
    const resumeAttached = (req.files || []).some(f => /resume/i.test(f.fieldname) && f.size > 0);
    recordPracticeSubmission(db, { userId, job, fieldsFilled: fields, resumeAttached, deliver });
    html(res, 200, renderPracticeThanks({ job }));
  });
}
