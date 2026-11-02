// ⭐ D124 · THE TRIAL's routes (services/trial.js has the rules). Mounted as trialRoutes(app, db, deps), so
// test/authRouteGuardManifest.test.js enumerates every /api route here with its guard.
//
//   POST /api/trial/start            the signed-in account becomes a trial account (after /try's sign-up)
//   GET  /api/trial/samples          D124 amended: the six samples, each OFFERED only with 10 good picks in its category today
//   GET  /api/trial/picks            the account's 10 picks: its sample's, or its own résumé's category's (or why there are none)
//   POST /api/trial/resume           { choice: "A"…"F" | "own" } — a hidden sample is refused — a sample's text comes back for the normal
//                                    /api/domain-profiles/from-resume onboarding, so the board is read from it as for anyone.
//                                    A111: "own" (+ content, name) only with app setting trial_own_resume on — else 409
//                                    own_resume_off; a field held / unknown / < 10 picks today → 409 field_not_live, nothing saved
//   GET  /api/trial/role-fit/:jobId  A111: one pick against the tester's own résumé — the ATS report + the Atlas role reading
//   POST /api/admin/trial/own-resume A111: { on: boolean } — the own-résumé pathway's switch (Admin → Trial; off by default)
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
//   GET  /api/survey/form            D130: the standalone survey's questions — PUBLIC (no account; jobsviadraft.com/survey)
//   POST /api/survey                 D130: a standalone response — PUBLIC, honeypot + ≤ 5 an hour per address, one per email
//   GET  /api/admin/survey/export.csv D130: the standalone responses; name and email only with ?contact=1
//   GET  /try/practice/:jobId        draft's practice form for one posting (a signed ?u=&t= names the account)
//   POST /try/practice/:jobId        its submission: counted, and a confirmation goes into the tester's Inbox
import { startTrial, pickResume, trialState, saveSurvey, finishTrial, saveFeedback, recordEvent, setAccess,
         adminTrialCounts, surveyExport, SURVEY, trialAnalytics, crossCut, analyticsCsv, STANDALONE_SURVEY, saveStandaloneSurvey,
         standaloneCsv, surveySources, verifyPracticeToken, renderPracticeForm, renderPracticeThanks,
         recordPracticeSubmission, saveTrialName } from "../services/trial.js";
import { testersReport, testersCsv } from "../services/testersReport.js";
import { testerContacts, testerContactsCsv } from "../services/testerContacts.js";
import { draftSlots } from "../services/draftSlots.js";
import { offeredSamples, samplePicks, ownPicks } from "../services/trialPicks.js";
import { demoState, completeDemo } from "../services/trialDemo.js";
// A111 · the own-résumé pathway, behind app setting trial_own_resume (off by default).
import { trialOwnResumeOn, setSetting, TRIAL_OWN_RESUME_KEY } from "../services/appSettings.js";
import { readOwnResume, recordOwnReading, ownResumeFields } from "../services/trialOwn.js";
import { roleFitFor } from "../services/trialRoleFit.js";
import { getRegistry } from "./domainProfiles.js";

export default function trialRoutes(app, db, { requireAuth, requireAdmin, secret, upload, deliver = null }) {
  const fail = (res, e) => res.status(e.status || 500).json({ error: e.code || "error", message: e.message });
  // D124 amended: the day's picks are scored once (≈ 7 ms a posting, six samples) — warmed here, off the request path.
  setTimeout(() => { offeredSamples(db).catch(() => { /* the first request computes it */ }); }, 20_000).unref?.();

  app.post("/api/trial/start", requireAuth, (req, res) => {
    try { res.json(startTrial(db, req.user.id)); } catch (e) { fail(res, e); }
  });

  // Owner 11-01: the testers use sample résumés, so the account's own name is collected — asked when sign-up gave none.
  app.post("/api/trial/name", requireAuth, (req, res) => {
    try { res.json(saveTrialName(db, req.user.id, req.body || {})); } catch (e) { fail(res, e); }
  });

  app.get("/api/trial/samples", requireAuth, async (_req, res) => {
    try {
      res.json({ samples: (await offeredSamples(db)).map(({ id, label, category, offered }) => ({ id, label, category, offered })),
        // A111: /try offers "Use my own résumé" only while the switch is on (off by default).
        ownResume: trialOwnResumeOn(db) });
    }
    catch (e) { fail(res, e); }
  });

  // A111 step 4: one pick, the role against the tester's OWN résumé — the ATS report + the Atlas reading
  // (services/trialRoleFit.js; its atlasReading is the seam P3's per-role reading replaces). { available: false } otherwise.
  app.get("/api/trial/role-fit/:jobId", requireAuth, async (req, res) => {
    try { res.json(await roleFitFor(db, { userId: req.user.id, jobId: req.params.jobId, registry: getRegistry() })); } catch (e) { fail(res, e); }
  });

  app.get("/api/trial/picks", requireAuth, async (req, res) => {
    try {
      const choice = db.prepare("SELECT trial_resume FROM users WHERE id = ?").pluck().get(req.user.id);
      if (choice && choice !== "own") return res.json({ sample: choice, picks: await samplePicks(db, choice) });
      res.json({ sample: null, ...(await ownPicks(db, req.user.id)) });
    } catch (e) { fail(res, e); }
  });

  // ⭐ The trial's demonstration (owner 11-01): the replay's data for this account's 2 drafted picks (the real tailoring,
  // made once per sample × posting), and its end — the picks recorded as sent by demonstration, confirmations in the Inbox.
  app.get("/api/trial/demo", requireAuth, (req, res) => {
    try { res.json(demoState(db, req.user.id)); } catch (e) { fail(res, e); }
  });
  app.post("/api/trial/demo/complete", requireAuth, (req, res) => {
    try { res.json({ ...completeDemo(db, req.user.id, { deliver }), state: trialState(db, req.user.id) }); } catch (e) { fail(res, e); }
  });

  app.post("/api/trial/resume", requireAuth, async (req, res) => {
    try {
      const choice = req.body?.choice;
      // ⭐ A111 · "Use my own résumé" — OFF by default (Admin → Trial). Off: refused, exactly as /try never offers it.
      if (choice === "own") {
        if (!trialOwnResumeOn(db)) {
          return res.status(409).json({ error: "own_resume_off", message: "Using your own résumé is not open in the trial yet. Pick a sample résumé." });
        }
        // The field is read BEFORE anything is saved; a field that is held, unknown or short of 10 picks today is told so
        // honestly and nothing is kept (D127: never another category's picks). Admin → Trial records the field either way.
        const reading = await readOwnResume(db, req.user.id, { content: req.body?.content, registry: getRegistry() });
        recordOwnReading(db, req.user.id, reading);
        if (!reading.live) {
          const samples = (await offeredSamples(db)).filter(s => s.offered).map(({ id, label, category }) => ({ id, label, category }));
          return res.status(409).json({ error: "field_not_live", reason: reading.reason, field: reading.field, picks: reading.picks, samples,
            message: "Your field isn't live in the trial yet. Try a sample résumé instead." });
        }
        const picked = pickResume(db, req.user.id, "own", { own: true });
        // The résumé goes on through the normal onboarding (POST /api/domain-profiles/from-resume), as a sample's does.
        return res.json({ ...picked, field: reading.field, picks: reading.picks,
          own: { name: String(req.body?.name || "resume.txt").slice(0, 120), content: String(req.body?.content) } });
      }
      // D124 amended: a sample whose category has fewer than 10 good picks today is hidden — and refused if asked for.
      if (choice !== "own" && (await offeredSamples(db)).some(x => x.id === choice && !x.offered)) {
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

  // 44b (owner 11-02): "they should not be able to break this sequence before the survey" — the survey can no longer be
  // skipped. The route stays (older pages still call it) and refuses; nothing is recorded, so the survey stays due.
  app.post("/api/trial/survey/dismiss", requireAuth, (_req, res) => {
    res.status(410).json({ error: "survey_required", message: "The survey comes before the rest of draft opens." });
  });

  app.post("/api/trial/feedback", requireAuth, (req, res) => {
    try { saveFeedback(db, req.user.id, req.body || {}); res.json({ ok: true }); } catch (e) { fail(res, e); }
  });

  // ⭐ D131 · Admin → Testers: one readable page over the trial + both surveys (services/testersReport.js). Read-only.
  const testersOpts = (q) => ({ period: String(q.period || "invites"), source: String(q.source || "all"), exclude: q.exclude !== "0" });
  app.get("/api/admin/testers", requireAdmin, (req, res) => {
    try { res.json(testersReport(db, testersOpts(req.query))); } catch (e) { fail(res, e); }
  });
  // Owner 11-02: ?contact=1 adds each person's name and email; without it the file has neither.
  app.get("/api/admin/testers/export.csv", requireAdmin, (req, res) => {
    try {
      const contact = req.query.contact === "1";
      res.set("Content-Type", "text/csv; charset=utf-8")
        .set("Content-Disposition", `attachment; filename="draft-testers${contact ? "-with-contacts" : ""}.csv"`)
        .send(testersCsv(db, { ...testersOpts(req.query), contact }));
    } catch (e) { fail(res, e); }
  });

  // 44b · People & questions: names, emails and what each person wrote (services/testerContacts.js). Admin only.
  app.get("/api/admin/trial/people", requireAdmin, (req, res) => {
    try { res.json(testerContacts(db, { exclude: req.query.exclude !== "0" })); } catch (e) { fail(res, e); }
  });
  app.get("/api/admin/trial/people.csv", requireAdmin, (req, res) => {
    try {
      res.set("Content-Type", "text/csv; charset=utf-8").set("Content-Disposition", 'attachment; filename="draft-testers-contacts.csv"')
        .send(testerContactsCsv(db, { exclude: req.query.exclude !== "0" }));
    } catch (e) { fail(res, e); }
  });

  app.get("/api/admin/trial", requireAdmin, (_req, res) => {
    // A111: the own-résumé pathway's switch and its testers' fields (names and counts — never a résumé's text).
    try { res.json({ ...adminTrialCounts(db), ownResume: { on: trialOwnResumeOn(db), ...ownResumeFields(db) } }); } catch (e) { fail(res, e); }
  });

  // A111 · Admin → Trial's switch for "Use my own résumé" (off by default; the owner's to turn on — O-row 3).
  app.post("/api/admin/trial/own-resume", requireAdmin, (req, res) => {
    try {
      if (typeof req.body?.on !== "boolean") return res.status(400).json({ error: "bad_value", message: "on must be true or false." });
      setSetting(db, TRIAL_OWN_RESUME_KEY, req.body.on);
      res.json({ on: trialOwnResumeOn(db) });
    } catch (e) { fail(res, e); }
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

  // ⭐ D130 · the standalone survey — public by design: it is for people with no account.
  app.get("/api/survey/form", (_req, res) => res.json({ survey: STANDALONE_SURVEY }));
  app.post("/api/survey", (req, res) => {
    try { res.json(saveStandaloneSurvey(db, req.body || {}, { ip: req.ip })); }
    catch (e) { res.status(e.status || 500).json({ error: e.code || "error", message: e.message, ...(e.missing ? { missing: e.missing } : {}) }); }
  });
  app.get("/api/admin/survey/sources", requireAdmin, (_req, res) => {
    try { res.json(surveySources(db)); } catch (e) { fail(res, e); }
  });
  app.get("/api/admin/survey/export.csv", requireAdmin, (req, res) => {
    try {
      res.set("Content-Type", "text/csv; charset=utf-8").set("Content-Disposition", 'attachment; filename="draft-survey-standalone.csv"')
        .send(standaloneCsv(db, { includeContact: req.query.contact === "1" }));
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
