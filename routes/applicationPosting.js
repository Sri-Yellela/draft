// routes/applicationPosting.js — ⭐ D171 FIX 3 (owner 11-06: "I could not open the job from Home to compare the JD with
// the résumé"). An application's posting, read IN draft from its Home row: the job description AS STORED WHEN THE
// APPLICATION WAS MADE (apply_run_jobs.posting_description, migration 225, written beside 129's title / company / URL /
// location in routes/apply.js), so it still reads after a re-crawl rewrites the posting or it closes.
//
//   GET /api/apply/run-jobs/:runJobId/posting   one attempt's posting
//   GET /api/apply/jobs/:jobId/posting          the person's own application to that job: the newest attempt's
//                                               snapshot, else the live posting when they hold a record of it
//
// ⛔ Owner-checked: an attempt or record that is not the signed-in person's is a 404 — never "exists, not yours".
// The answer says where the words came from — `source`: "snapshot" (as applied to), "live" (an attempt made before 225,
// or a record with no attempt: today's posting, said so) or null (nothing stored) — and `gone` when the posting is no
// longer on the board. Read-only: nothing here writes, scores or calls a model.
import express from "express";

const ATTEMPT_SQL = `
  SELECT rj.id AS run_job_id, rj.job_id, rj.created_at,
         rj.posting_title, rj.posting_company, rj.posting_url, rj.posting_location, rj.posting_description,
         sj.job_id AS live_id, sj.is_active AS live_active, sj.title AS live_title, sj.company AS live_company,
         COALESCE(sj.apply_url, sj.url) AS live_url, sj.location AS live_location,
         COALESCE(sj.description_text, sj.description) AS live_description
  FROM apply_run_jobs rj LEFT JOIN scraped_jobs sj ON sj.job_id = rj.job_id`;

const text = (v) => (typeof v === "string" && v.trim() ? v : null);

/** One answer from an attempt row (or a record-only one). Pure. */
export function postingAnswer(r, record = null) {
  const snap = text(r.posting_description);
  const live = text(r.live_description);
  return {
    jobId: r.job_id,
    runJobId: r.run_job_id ?? null,
    title: r.posting_title || r.live_title || record?.role || "",
    company: r.posting_company || r.live_company || record?.company || "",
    location: r.posting_location || r.live_location || record?.location || "",
    url: r.posting_url || r.live_url || record?.job_url || null,
    description: snap || live || null,
    source: snap ? "snapshot" : live ? "live" : null,
    gone: r.live_id == null || Number(r.live_active) === 0,
    appliedAt: r.created_at ?? null,
  };
}

export function createApplicationPostingRouter({ db, requireAuth }) {
  const router = express.Router();

  router.get("/api/apply/run-jobs/:runJobId/posting", requireAuth, (req, res) => {
    const id = Number(req.params.runJobId);
    if (!Number.isInteger(id) || id <= 0) return res.status(404).json({ error: "not_found" });
    const r = db.prepare(`${ATTEMPT_SQL} WHERE rj.id = ? AND rj.user_id = ?`).get(id, req.user.id);
    if (!r) return res.status(404).json({ error: "not_found" });
    res.json(postingAnswer(r));
  });

  router.get("/api/apply/jobs/:jobId/posting", requireAuth, (req, res) => {
    const jobId = String(req.params.jobId || "");
    if (!jobId) return res.status(404).json({ error: "not_found" });
    // The newest attempt that kept the words wins; else the newest attempt at all.
    const r = db.prepare(`${ATTEMPT_SQL} WHERE rj.user_id = ? AND rj.job_id = ?
      ORDER BY (rj.posting_description IS NOT NULL) DESC, rj.id DESC LIMIT 1`).get(req.user.id, jobId);
    if (r) return res.json(postingAnswer(r));
    // No attempt: an application the person recorded, imported or sent elsewhere — today's posting, said so.
    const record = db.prepare("SELECT company, role, job_url, location FROM job_applications WHERE user_id = ? AND job_id = ?").get(req.user.id, jobId);
    const held = record || db.prepare("SELECT 1 FROM application_records WHERE user_id = ? AND job_id = ?").get(req.user.id, jobId);
    if (!held) return res.status(404).json({ error: "not_found" });
    const live = db.prepare(`SELECT job_id AS live_id, is_active AS live_active, title AS live_title, company AS live_company,
      COALESCE(apply_url, url) AS live_url, location AS live_location, COALESCE(description_text, description) AS live_description
      FROM scraped_jobs WHERE job_id = ?`).get(jobId) || {};
    res.json(postingAnswer({ job_id: jobId, ...live }, record || null));
  });

  return router;
}
