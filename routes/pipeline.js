// ── D102 · THE PIPELINE WORKSPACE'S READS, AND AUTO SETTINGS ──────────────────────────────────
//
// GET /api/pipeline?surface=draft_house|table   the surface's rows + every tab's count
// GET /api/pipeline/job/:applicationId          one job's detail panel (the same for every entry point)
// GET /api/apply/auto-settings                  the user's FULL AUTO standing instruction (D102 P4)
// PUT /api/apply/auto-settings                  replace it — validated whole, nothing half-stored
// services/pipelineWorkspace.js and shared/autoSettings.js hold the rules; these routes only expose them.
import { listPipeline, jobDetail } from "../services/pipelineWorkspace.js";
import { normaliseAutoSettings, readAutoSettings } from "../shared/autoSettings.js";

const SURFACES = ["draft_house", "table"];

export default function pipelineRoutes(app, db, requireAuth) {
  app.get("/api/pipeline", requireAuth, (req, res) => {
    const surface = String(req.query.surface ?? "draft_house");
    if (!SURFACES.includes(surface))
      return res.status(400).json({ error: "bad_surface", message: "surface is draft_house or table." });
    res.json(listPipeline(db, req.user.id, surface));
  });

  app.get("/api/pipeline/job/:applicationId", requireAuth, (req, res) => {
    if (!/^\d+$/.test(String(req.params.applicationId)))
      return res.status(400).json({ error: "bad_application_id" });
    const detail = jobDetail(db, req.user.id, req.params.applicationId);
    // Another user's id reads the same as a missing one.
    if (!detail) return res.status(404).json({ error: "not_found" });
    res.json(detail);
  });

  // D102 P5 · the same detail, found by the JOB — Draft House's stopped items come from runs and know the job id, not
  // the application record's. One record per user and job (application_records), so the lookup is exact.
  app.get("/api/pipeline/job-for/:jobId", requireAuth, (req, res) => {
    const rec = db.prepare("SELECT id FROM application_records WHERE user_id = ? AND job_id = ?").get(req.user.id, String(req.params.jobId));
    const detail = rec ? jobDetail(db, req.user.id, rec.id) : null;
    if (!detail) return res.status(404).json({ error: "not_found" });
    res.json(detail);
  });

  const settingsOf = (userId) => readAutoSettings(db.prepare("SELECT auto_settings FROM users WHERE id = ?").get(userId)?.auto_settings);

  app.get("/api/apply/auto-settings", requireAuth, (req, res) => {
    res.json({ settings: settingsOf(req.user.id) });
  });

  app.put("/api/apply/auto-settings", requireAuth, (req, res) => {
    const r = normaliseAutoSettings(req.body?.settings ?? req.body);
    if (!r.ok) return res.status(400).json({ error: r.error, message: r.message });
    // savedAt: a run time already past today does not fire for settings saved after it (services/autoScheduler.js runDue).
    db.prepare("UPDATE users SET auto_settings = ? WHERE id = ?")
      .run(JSON.stringify({ ...r.value, savedAt: Math.floor(Date.now() / 1000) }), req.user.id);
    res.json({ settings: r.value });
  });
}
