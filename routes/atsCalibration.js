// ⭐ D125 · Admin → ATS calibration (services/atsCalibration.js). Every route is the admin's alone.
//
//   GET  /api/admin/ats-calibration                  the set (latest version), progress, the résumés
//   POST /api/admin/ats-calibration/build            make a new set version (20 computing + 20 other fields, frozen)
//   POST /api/admin/ats-calibration/resume           { label, text } — a résumé he pastes; or { who } — his own, copied from
//                                                    his user account (username or email): an admin account has none (D95)
//   GET  /api/admin/ats-calibration/item/:id         one posting: the text, draft's reading, each pair's CURRENT score
//   PUT  /api/admin/ats-calibration/item/:id         his marks, added terms, must ↔ nice moves, score feels, done
//   POST /api/admin/ats-calibration/assist           { ids } — the batch he copies into a Claude chat (draft calls no model)
//   POST /api/admin/ats-calibration/assist/import    { answer } — the chat's JSON, kept as SUGGESTIONS per posting
//   GET  /api/admin/ats-calibration/results          precision / recall, must / nice, ρ, bias per band, the worst pairs, fixes
//   POST /api/admin/ats-calibration/fix              { kind, term, why } — one fix queued for the agent
//   POST /api/admin/ats-calibration/baseline         record today's results as the gate's baseline
import { setOverview, buildSet, addResume, copyAccountResume, ensureResumes, itemView, saveReview, assistBatch, importAssist, results, queueFix, listFixes,
         recordBaseline, latestBaseline, gate } from "../services/atsCalibration.js";

/** @param deps.score (job, resumeText) => the scorer's report — the board's weights and confirmed synonyms. */
export default function atsCalibrationRoutes(app, db, { requireAdmin, score }) {
  const fail = (res, e) => res.status(e.status || 500).json({ error: e.code || "error", message: e.message });
  const id = (req) => Number(req.params.id);
  // ⛔ D95: an admin request carries NO user (services/adminGuard.js) — the admin account's id, or the legacy admin's.
  const actor = (req) => req.admin?.id ?? req.user?.id ?? null;

  app.get("/api/admin/ats-calibration", requireAdmin, (_req, res) => {
    try { ensureResumes(db); res.json({ ...setOverview(db), fixes: listFixes(db), baseline: latestBaseline(db) }); } catch (e) { fail(res, e); }
  });
  app.post("/api/admin/ats-calibration/build", requireAdmin, (req, res) => {
    try { res.json(buildSet(db, { score })); } catch (e) { fail(res, e); }
  });
  app.post("/api/admin/ats-calibration/resume", requireAdmin, (req, res) => {
    try { res.json(req.body?.who ? { resumes: copyAccountResume(db, req.body.who) } : addResume(db, req.body || {})); } catch (e) { fail(res, e); }
  });
  app.get("/api/admin/ats-calibration/item/:id", requireAdmin, (req, res) => {
    try { const v = itemView(db, id(req), { score }); v ? res.json(v) : res.status(404).json({ error: "not_found" }); } catch (e) { fail(res, e); }
  });
  app.put("/api/admin/ats-calibration/item/:id", requireAdmin, (req, res) => {
    try { res.json(saveReview(db, id(req), req.body || {}, { userId: actor(req) })); } catch (e) { fail(res, e); }
  });
  app.post("/api/admin/ats-calibration/assist", requireAdmin, (req, res) => {
    try { res.json(assistBatch(db, (req.body?.ids || []).map(Number).filter(Number.isInteger).slice(0, 10))); } catch (e) { fail(res, e); }
  });
  app.post("/api/admin/ats-calibration/assist/import", requireAdmin, (req, res) => {
    try { res.json(importAssist(db, req.body?.answer)); } catch (e) { fail(res, e); }
  });
  app.get("/api/admin/ats-calibration/results", requireAdmin, (_req, res) => {
    try { const r = results(db, { score }); const b = latestBaseline(db, r.version); res.json({ ...r, baseline: b, gate: b ? gate(r, b) : null }); }
    catch (e) { fail(res, e); }
  });
  app.post("/api/admin/ats-calibration/fix", requireAdmin, (req, res) => {
    try { res.json({ fixes: queueFix(db, req.body || {}, { userId: actor(req) }) }); } catch (e) { fail(res, e); }
  });
  app.post("/api/admin/ats-calibration/baseline", requireAdmin, (req, res) => {
    try { res.json(recordBaseline(db, results(db, { score }), { userId: actor(req) })); } catch (e) { fail(res, e); }
  });
}
