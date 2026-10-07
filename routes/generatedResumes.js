// ── D57 · Settings → Your data → Generated résumés ───────────────────────────────────────────────
//
// Every résumé the user generated, per job: when, whether it is kept for good (the job was drafted or
// applied) or when it expires (a convenience copy, RESUME_RETENTION_DAYS), and delete. The rule lives
// in services/generatedResumes.js; this only exposes it. Deleting frees the job's Résumé button on
// every open board at once (the `resume_deleted` sync event), not only after a reload.
import { listGeneratedResumes, deleteGeneratedResume, resumeRetentionDays } from "../services/generatedResumes.js";

export default function generatedResumeRoutes(app, db, requireAuth, { emitToUser = () => {} } = {}) {
  app.get("/api/generated-resumes", requireAuth, (req, res) => {
    const days = resumeRetentionDays();
    res.json({ resumes: listGeneratedResumes(db, req.user.id, { days }), retentionDays: days });
  });

  app.delete("/api/generated-resumes/:jobId", requireAuth, (req, res) => {
    const jobId = String(req.params.jobId);
    if (!deleteGeneratedResume(db, req.user.id, jobId)) return res.status(404).json({ error: "Resume not found" });
    try { emitToUser(req.user.id, { type: "resume_deleted", jobId }); } catch { /* the delete stands */ }
    res.json({ ok: true, jobId });
  });
}
