// ⭐ The surveys, Admin → Testers and the practice form's routes. Mounted as surveyRoutes(app, db, deps), so
// test/authRouteGuardManifest.test.js enumerates every /api route here with its guard.
//
// 11-07 (owner): the D124 trial (/api/trial/*, /try, Admin → Trial) was removed — every account gets the whole site.
// What stays is the research over what testers already gave, the standalone survey, and the sample résumés' safety
// rule's practice form:
//   GET  /api/admin/testers                 D131: Admin → Testers, one readable page over the trial's stored answers + both surveys
//   GET  /api/admin/testers/export.csv      the same rows; names and emails only with ?contact=1
//   GET  /api/admin/testers/people          44b: People & questions — each tester's name, email and what they wrote (admin only)
//   GET  /api/admin/testers/people.csv      the same, as CSV
//   GET  /api/survey/form                   D130: the standalone survey's questions — PUBLIC (no account; jobsviadraft.com/survey)
//   POST /api/survey                        D130: a standalone response — PUBLIC, honeypot + ≤ 5 an hour per address, one per email
//   GET  /api/admin/survey/sources          D130: both surveys side by side and combined, the YC numbers
//   GET  /api/admin/survey/export.csv       D130: the standalone responses; name and email only with ?contact=1
//   GET  /try/practice/:jobId               draft's practice form for one posting (a signed ?u=&t= names the account)
//   POST /try/practice/:jobId               its submission: counted, and a confirmation goes into the account's Inbox
import { STANDALONE_SURVEY, saveStandaloneSurvey, standaloneCsv, surveySources } from "../services/survey.js";
import { verifyPracticeToken, renderPracticeForm, renderPracticeThanks, recordPracticeSubmission } from "../services/sampleResumes.js";
import { testersReport, testersCsv } from "../services/testersReport.js";
import { testerContacts, testerContactsCsv } from "../services/testerContacts.js";

export default function surveyRoutes(app, db, { requireAdmin, secret, upload, deliver = null }) {
  const fail = (res, e) => res.status(e.status || 500).json({ error: e.code || "error", message: e.message });

  // ⭐ D131 · Admin → Testers: one readable page over the trial's stored answers + both surveys (services/testersReport.js).
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
  app.get("/api/admin/testers/people", requireAdmin, (req, res) => {
    try { res.json(testerContacts(db, { exclude: req.query.exclude !== "0" })); } catch (e) { fail(res, e); }
  });
  app.get("/api/admin/testers/people.csv", requireAdmin, (req, res) => {
    try {
      res.set("Content-Type", "text/csv; charset=utf-8").set("Content-Disposition", 'attachment; filename="draft-testers-contacts.csv"')
        .send(testerContactsCsv(db, { exclude: req.query.exclude !== "0" }));
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

  // ── the practice form — posted by draft's own server-side browser, which has no user session ──
  // ⛔ A sample résumé (a fictional person) never reaches a real employer (services/sampleResumes.js).
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
