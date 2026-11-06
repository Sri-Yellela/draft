// routes/resumeEditor.js — ⭐ D157 (owner 11-05 / 11-06, option A) + D171 FIX 4: the résumé editor is resume-master's
// tool, embedded; draft keeps no fork of it. These two reads are all draft's side needs:
//
//   GET /api/resume-editor                          where the editor lives (the tools service's PUBLIC origin) and the
//                                                   contract draft speaks to it (rm-editor/1). `available: false` →
//                                                   the client keeps its own preview (panels/SandboxPanel.jsx).
//   GET /api/apply/run-jobs/:runJobId/resume-doc    an application attempt's résumé as HTML (Home's Résumé opens it IN
//                                                   draft — D171 FIX 4 — not as a downloaded PDF). Read only once the
//                                                   application was sent: what was sent is a record, never edited.
//
// Saving an edit goes through the existing POST /api/resumes/:jobId/html (the job's tailored résumé — the one an
// attempt attaches). Nothing here writes, scores or calls a model.
import express from "express";
import { LEGACY_ORIGIN } from "../shared/brand.js";

export const EDITOR_CONTRACT = "rm-editor/1";

/**
 * The editor's public origin. RESUME_EDITOR_ORIGIN wins; else RESUME_MASTER_URL when a browser can reach it (https,
 * not Railway's private network); else the tools service's public site. A development RESUME_MASTER_URL on
 * localhost is used as it is, so a local pair works.
 */
export function editorOrigin(env = process.env) {
  const pick = (u) => { try { const x = new URL(String(u)); return x.origin; } catch { return null; } };
  if (env.RESUME_EDITOR_ORIGIN) return pick(env.RESUME_EDITOR_ORIGIN);
  const rm = pick(env.RESUME_MASTER_URL);
  if (rm && /^https:\/\//.test(rm) && !/\.internal(?::\d+)?$/.test(rm)) return rm;
  if (rm && /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(rm)) return rm;
  return env.RESUME_EDITOR_OFF === "1" ? null : LEGACY_ORIGIN;
}

const SENT = new Set(["submitted", "applied", "sent"]);

export function createResumeEditorRouter({ db, requireAuth, env = process.env }) {
  const router = express.Router();

  router.get("/api/resume-editor", requireAuth, (_req, res) => {
    const origin = env.RESUME_EDITOR_OFF === "1" ? null : editorOrigin(env);
    res.json({ available: !!origin, origin, url: origin ? `${origin}/editor/` : null, contract: EDITOR_CONTRACT });
  });

  router.get("/api/apply/run-jobs/:runJobId/resume-doc", requireAuth, (req, res) => {
    const id = Number(req.params.runJobId);
    if (!Number.isInteger(id) || id <= 0) return res.status(404).json({ error: "not_found" });
    // The posting as stored when the application was made (posting_*), else the live one.
    const rj = db.prepare(`
      SELECT rj.id, rj.job_id, rj.status, rj.submitted_by, rj.finished_at, rj.resume_artifact_id,
             COALESCE(rj.posting_title, sj.title) AS title, COALESCE(rj.posting_company, sj.company) AS company
      FROM apply_run_jobs rj LEFT JOIN scraped_jobs sj ON sj.job_id = rj.job_id
      WHERE rj.id = ? AND rj.user_id = ?`).get(id, req.user.id);
    if (!rj) return res.status(404).json({ error: "not_found" });
    if (rj.resume_artifact_id == null) {
      return res.status(404).json({ error: "no_resume_artifact", message: "No résumé was recorded for this application." });
    }
    // Ownership is checked on the artifact itself, not trusted from the foreign key.
    const r = db.prepare("SELECT job_id, company, role, html FROM resumes WHERE id = ? AND user_id = ?").get(rj.resume_artifact_id, req.user.id);
    if (!r?.html) {
      return res.status(404).json({ error: "resume_artifact_missing", message: "The résumé this application used is no longer stored." });
    }
    const sent = SENT.has(String(rj.status)) || rj.submitted_by != null;
    res.json({
      html: r.html, jobId: r.job_id || rj.job_id, company: rj.company || r.company || "", title: rj.title || r.role || "",
      readOnly: sent, sentAt: sent ? (rj.finished_at ?? null) : null,
    });
  });

  return router;
}
