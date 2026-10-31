// ── D110 · INTERVIEW MODE's routes — every one the signed-in user's own (services/interviewPrep.js holds the rules) ──
//
// GET    /api/interview/prep/:applicationId                 the Prep tab: countdown, skills (Atlas links), rounds, stories, debriefs
// PUT    /api/interview/prep/:applicationId/date            { date: "YYYY-MM-DD" | null, time: "HH:MM" | null, timeZone? } — the user's
//                                                            date (D113 UI "Add the date": the zone, and interview_at, kept with it)
// GET    /api/interview/prep/:applicationId/connector-data  P4: exactly the data the connector's tool would hand the user's Claude
// GET    /api/interview/stories                             the story bank
// POST   /api/interview/stories                             add one
// POST   /api/interview/stories/from-profile                start the bank from the Profile's experience
// PUT    /api/interview/stories/:id                         edit one
// DELETE /api/interview/stories/:id
// GET    /api/interview/debriefs                            ?applicationId= — the user's debriefs
// POST   /api/interview/debriefs                            { applicationId?, round, heldOn?, went?, notes?, questions: [] }
// DELETE /api/interview/debriefs/:id
// GET    /api/interview/questions                           ?round= — the user's OWN question bank (never another user's)
import { readPrep, setPrepDate, connectorPack, listStories, createStory, updateStory, deleteStory, seedStoriesFromProfile,
  addDebrief, listDebriefs, deleteDebrief, questionBank } from "../services/interviewPrep.js";
import { jobDetail } from "../services/pipelineWorkspace.js";

const ID = /^\d+$/;

export default function interviewRoutes(app, db, requireAuth) {
  const send = (res, fn) => {
    try {
      const out = fn();
      if (out == null) return res.status(404).json({ error: "not_found" });
      res.json(out);
    } catch (e) {
      if (e?.status) return res.status(e.status).json({ error: e.code || "bad_request", message: e.message });
      throw e;
    }
  };
  const badId = (res) => res.status(400).json({ error: "bad_id" });

  app.get("/api/interview/prep/:applicationId", requireAuth, (req, res) => {
    if (!ID.test(req.params.applicationId)) return badId(res);
    // The ladder's status (interview / assessment) is a trigger too — read through the same detail the page uses.
    send(res, () => {
      const detail = jobDetail(db, req.user.id, req.params.applicationId);
      return detail ? readPrep(db, req.user.id, req.params.applicationId, { status: detail.status }) : null;
    });
  });

  app.put("/api/interview/prep/:applicationId/date", requireAuth, (req, res) => {
    if (!ID.test(req.params.applicationId)) return badId(res);
    send(res, () => setPrepDate(db, req.user.id, req.params.applicationId,
      { date: req.body?.date ?? null, time: req.body?.time ?? null, timeZone: req.body?.timeZone ?? null }));
  });

  app.get("/api/interview/prep/:applicationId/connector-data", requireAuth, (req, res) => {
    if (!ID.test(req.params.applicationId)) return badId(res);
    send(res, () => {
      const rec = db.prepare(`SELECT job_id FROM application_records WHERE id = ? AND user_id = ?`).get(Number(req.params.applicationId), req.user.id);
      return rec ? connectorPack(db, req.user.id, rec.job_id) : null;
    });
  });

  app.get("/api/interview/stories", requireAuth, (req, res) => send(res, () => ({ stories: listStories(db, req.user.id) })));
  app.post("/api/interview/stories", requireAuth, (req, res) => send(res, () => ({ story: createStory(db, req.user.id, req.body || {}) })));
  app.post("/api/interview/stories/from-profile", requireAuth, (req, res) => send(res, () => seedStoriesFromProfile(db, req.user.id)));
  app.put("/api/interview/stories/:id", requireAuth, (req, res) => {
    if (!ID.test(req.params.id)) return badId(res);
    send(res, () => { const s = updateStory(db, req.user.id, req.params.id, req.body || {}); return s ? { story: s } : null; });
  });
  app.delete("/api/interview/stories/:id", requireAuth, (req, res) => {
    if (!ID.test(req.params.id)) return badId(res);
    send(res, () => (deleteStory(db, req.user.id, req.params.id) ? { ok: true } : null));
  });

  app.get("/api/interview/debriefs", requireAuth, (req, res) => {
    const a = req.query.applicationId;
    if (a != null && !ID.test(String(a))) return badId(res);
    send(res, () => ({ debriefs: listDebriefs(db, req.user.id, { applicationId: a ?? null }) }));
  });
  app.post("/api/interview/debriefs", requireAuth, (req, res) => send(res, () => ({ debrief: addDebrief(db, req.user.id, req.body || {}) })));
  app.delete("/api/interview/debriefs/:id", requireAuth, (req, res) => {
    if (!ID.test(req.params.id)) return badId(res);
    send(res, () => (deleteDebrief(db, req.user.id, req.params.id) ? { ok: true } : null));
  });
  app.get("/api/interview/questions", requireAuth, (req, res) =>
    send(res, () => ({ questions: questionBank(db, req.user.id, { round: req.query.round ? String(req.query.round) : null }) })));
}
