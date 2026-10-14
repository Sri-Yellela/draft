// routes/extensionJob.js — ⭐ D99 J11 · THE BOARD HANDS A JOB TO THE EXTENSION. The extension's OWN token only.
//
//   GET /api/extension/job/:id   → 200 { job: { jobId, title, company, url, logo, reportPath }, ats }
//                                  404 { error: "not_on_board" } · 403 extension_only · 429 rate_limited
//
// The web app's "open the posting" (client/src/lib/openPosting.js) posts a job id to the extension's one content
// script on jobsviadraft.com; the extension asks HERE before it opens anything. ⛔ The address the page sent is never
// trusted — the page sends only the id, and the address the tab opens is the one THIS returns, for a job that is the
// user's own or live on the board (services/manualHandoff.js jobOnUsersBoard); anything else opens nothing.
//
// `ats` is draft's own report on the user's base résumé (D99 J12 — the free checker is for signed-out visitors only):
//   { state: "ready", score, band, scorable, matched, missing }   the scorer judged it (score null = not enough signal)
//   { state: "no_base_resume" }                                     → "Add your résumé in draft"
//   { state: "unavailable" }                                         a profile or the scorer was not there — said so
// It is the same call the approval screen and the board use (server.js scoreBaseResumeForApply), so the score the
// page shows is the web app's.
import express from "express";
import { jobOnUsersBoard } from "../services/manualHandoff.js";
import { createRateLimiter } from "../services/extensionResume.js";
import { getKnownLogoUrl } from "../shared/companyLogos.js";

/** ⚠ provisional: a board click is one lookup; 60 a minute is far above a person and far below a script. */
export const LOOKUP_LIMIT = Object.freeze({ limit: 60, windowMs: 60_000 });

const httpsOnly = (u) => { try { const x = new URL(String(u || "")); return x.protocol === "https:" ? x.href : null; } catch { return null; } };

/** The job the extension may open, and its report — or null when it is not on this user's board. */
export function boardJobForExtension(db, userId, jobId, { scoreFor, hasBaseResume }) {
  const id = String(jobId ?? "").slice(0, 128);
  if (!id || !jobOnUsersBoard(db, userId, id)) return null;
  const row = db.prepare("SELECT job_id, title, company, url, apply_url, company_icon_url FROM scraped_jobs WHERE job_id = ?").get(id);
  const url = httpsOnly(row?.apply_url) || httpsOnly(row?.url);
  if (!row || !url) return null;
  let ats;
  if (!hasBaseResume(userId)) ats = { state: "no_base_resume" };
  else {
    const r = (() => { try { return scoreFor(userId, id); } catch { return null; } })();
    ats = r ? { state: "ready", score: r.score ?? null, band: r.band ?? null, scorable: r.scorable !== false,
                matched: (r.matched || []).slice(0, 40), missing: (r.missing || []).slice(0, 40) }
            : { state: "unavailable" };
  }
  return {
    job: { jobId: String(row.job_id), title: row.title ?? null, company: row.company ?? null, url,
           logo: row.company_icon_url || getKnownLogoUrl(row.company || "") || null,
           reportPath: `/app/jobs?job=${encodeURIComponent(String(row.job_id))}` },
    ats,
  };
}

export function createExtensionJobRouter({ db, requireAuth, isExtension, scoreFor, hasBaseResume, limit = LOOKUP_LIMIT, now }) {
  const router = express.Router();
  const ok = createRateLimiter({ ...limit, ...(now ? { now } : {}) });
  router.get("/api/extension/job/:id", requireAuth, (req, res) => {
    if (!isExtension(req)) return res.status(403).json({ error: "extension_only", message: "This is for the draft extension." });
    if (!ok(String(req.user.id))) return res.status(429).json({ error: "rate_limited", message: "Too many requests — try again in a minute." });
    const out = boardJobForExtension(db, req.user.id, req.params.id, { scoreFor, hasBaseResume });
    if (!out) return res.status(404).json({ error: "not_on_board", message: "That job is not on your board." });
    res.json(out);
  });
  return router;
}
