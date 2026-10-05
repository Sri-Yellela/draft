import { Router } from "express";
import { importJob, ImportInputError, detectKnownAtsMatch } from "../services/jobs/importJob.js";
import { isPermanentModelFailure } from "../services/modelCall.js";
import { recentCaptures } from "../services/jobs/captureOutcome.js";

// Sibling to routes/importedJobs.js, NOT an extension of it — importedJobs.js manages the
// legacy per-user `imported_jobs` table (LinkedIn-extension saved jobs). This router writes
// into the global scraped_jobs pool instead, via the same dedup/enrichment pipeline every other
// source uses. See services/jobs/importJob.js for the extraction + dedup logic.
export function createImportJobRouter(db, anthropic) {
  const router = Router();

  // POST /api/import/job — { url?, text?, html? }, at least one required.
  router.post("/job", async (req, res) => {
    const { url, text, html } = req.body || {};
    try {
      // userId attaches the import to the person who made it (starred in user_jobs). Without it
      // the row landed in the global pool unowned: the importer had no guarantee of ever seeing
      // it again, while every other user with a matching profile did. requireAuth is applied at
      // the mount in server.js, so req.user is always present here.
      const result = await importJob({ url, text, html }, { db, anthropic, userId: req.user?.id || null });
      res.json(result);
    } catch (err) {
      if (err instanceof ImportInputError) {
        return res.status(400).json({ error: err.message });
      }
      console.error("[POST /api/import/job] Error:", err.message);

      // ⛔ DO NOT TELL A USER TO RETRY SOMETHING THAT CANNOT SUCCEED.
      // Import requires a model call, and when the balance is exhausted every attempt fails the
      // same way in about 200ms. The old blanket "Please try again" sent people into a loop that
      // could only fail, and made an unfunded account read as a flaky feature — which is exactly
      // how it was reported. 503 rather than 502: the service is unavailable, not the upstream
      // misbehaving, and `retryable` says so in a field a client can branch on instead of
      // pattern-matching prose.
      if (isPermanentModelFailure(err)) {
        return res.status(503).json({
          error: "Job capture is unavailable right now — the AI service this needs is not " +
                 "currently funded. Retrying will not help; this needs an account change.",
          retryable: false,
        });
      }
      res.status(502).json({ error: "Could not import this job. Please try again.", retryable: true });
    }
  });

  // D13 — THE COMPANION'S ONE QUESTION ABOUT A PAGE: is this posting on your board yet?
  //
  // POST /api/import/context { url } — the tab's URL in the BODY, not a query string, so it does not
  // land in ordinary request logs (the ATS Score Tool's URL-borne text does; this need not). Read-
  // only despite the verb. The extension's popup asks it once per opening —
  // which is a user action, and the URL is what a capture would send anyway. It reads and writes
  // nothing else: no row is created, nothing is fetched from the URL, and the answer is not stored
  // by the extension (it holds no new storage key — STORE_LISTING's six are unchanged).
  //
  //   posting  — `saved` (starred for you, so it is in ★ Saved), `known` (in the pool, so it can be
  //              on a board, but not saved by you), or neither; matched on the URL with its query,
  //              hash and trailing slash dropped, against both url and apply_url. A row retired as a
  //              duplicate resolves to its canonical row, as importJob does.
  //   ats      — what the URL names (detectKnownAtsMatch — D4: the parsing is already live), or null.
  //   recent   — your last five captures, newest first, for a page that is neither a posting nor a
  //              form you drafted.
  router.post("/context", (req, res) => {
    const raw = String(req.body?.url || "").slice(0, 2048);
    let posting = null;
    let ats = null;
    if (/^https?:\/\//i.test(raw)) {
      let bare = raw;
      try { const u = new URL(raw); bare = `${u.origin}${u.pathname}`.replace(/\/+$/, ""); } catch {}
      const candidates = [...new Set([raw, bare, `${bare}/`])];
      const marks = candidates.map(() => "?").join(",");
      let row = db.prepare(`
        SELECT job_id, title, company, duplicate_of, is_active FROM scraped_jobs
        WHERE url IN (${marks}) OR apply_url IN (${marks})
        ORDER BY updated_at DESC LIMIT 1
      `).get(...candidates, ...candidates);
      if (row?.duplicate_of) {
        row = db.prepare("SELECT job_id, title, company, duplicate_of, is_active FROM scraped_jobs WHERE job_id = ?")
          .get(row.duplicate_of) || row;
      }
      const saved = row
        ? !!db.prepare("SELECT 1 FROM user_jobs WHERE user_id = ? AND job_id = ? AND starred = 1").get(req.user.id, row.job_id)
        : false;
      posting = row
        ? { known: true, saved, jobId: row.job_id, title: row.title || null, company: row.company || null,
            active: row.is_active !== 0 }
        : { known: false, saved: false, jobId: null, title: null, company: null, active: null };
      const m = detectKnownAtsMatch(raw);
      ats = m ? { type: m.type, slug: m.slug || m.tenant || null } : null;
    }
    // D33: each with what happened to it (on the board · held off it and why · closed), worded by
    // services/jobs/captureOutcome.js — the same words the capture itself answered with.
    const recent = recentCaptures(db, req.user.id, 5);
    res.json({ posting, ats, recent });
  });

  return router;
}
