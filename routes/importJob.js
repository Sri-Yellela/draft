import { Router } from "express";
import { importJob, ImportInputError, ImportRefusedError, detectKnownAtsMatch, linkRefetchability } from "../services/jobs/importJob.js";
import { recentCaptures } from "../services/jobs/captureOutcome.js";
import { getKnownLogoUrl } from "../shared/companyLogos.js";
import { atsScorePair } from "../shared/resumeScores.js";
import { autoCaptureDisabled, autoCaptureBrake, listAutoCaptures, undoAutoCapture } from "../services/jobs/autoCapture.js";
import { resolvePageJob } from "../services/manualHandoff.js";
import { pageKeyOf } from "../services/jobPageKey.js";

// Sibling to routes/importedJobs.js, NOT an extension of it — importedJobs.js manages the
// legacy per-user `imported_jobs` table (LinkedIn-extension saved jobs). This router writes
// into the global scraped_jobs pool instead, via the same dedup/enrichment pipeline every other
// source uses. See services/jobs/importJob.js for the extraction + dedup logic.
//
// ⛔ D17 / D33: no model client. Import reads deterministically (services/jobs/importJob.js), so it
// cannot fail on an unfunded balance — the 503 "the AI service this needs is not funded" is gone
// with the call that produced it.
/**
 * @param {{ queueLogo?: ((target: { company: string, urls: string[] }) => Promise<any>) | null }} [opts]
 *   D41(c) — called after a successful capture, never awaited: the logo lands in the background and
 *   the card shows its letter tile until then. Null (tests, COMPANY_LOGOS=off) fetches nothing.
 */
export function createImportJobRouter(db, opts = null) {
  const queueLogo = typeof opts?.queueLogo === "function" ? opts.queueLogo : null;
  const router = Router();

  // POST /api/import/job — { url?, text?, html? }, at least one required.
  router.post("/job", async (req, res) => {
    const { url, text, html } = req.body || {};
    try {
      // userId attaches the import to the person who made it (starred in user_jobs). Without it
      // the row landed in the global pool unowned: the importer had no guarantee of ever seeing
      // it again, while every other user with a matching profile did. requireAuth is applied at
      // the mount in server.js, so req.user is always present here.
      const result = await importJob({ url, text, html }, { db, userId: req.user?.id || null });
      if (queueLogo && result?.job?.company) {
        const urls = [result.employerSite, result.job.url, result.job.applyUrl, url].filter(Boolean);
        Promise.resolve().then(() => queueLogo({ company: result.job.company, urls })).catch(() => {});
      }
      const { employerSite, ...body } = result || {};
      res.json(body);
    } catch (err) {
      if (err instanceof ImportInputError) {
        return res.status(400).json({ error: err.message });
      }
      // ⛔ D41(d): no US evidence → nothing written. 422 with the plain message as `error`, which every
      // extension build already shows as a failed capture.
      if (err instanceof ImportRefusedError) {
        return res.status(422).json({ error: err.message, refused: true, kind: err.kind, retryable: false });
      }
      console.error("[POST /api/import/job] Error:", err.message);
      // What is left to fail is a fetch (the posting's site, an ATS list) or the database, so a
      // retry can genuinely help. Nothing here depends on a model balance any more (D33).
      res.status(502).json({ error: "Could not import this job. Please try again.", retryable: true });
    }
  });

  // ⭐ D55 decision B — "Save link to draft", the extension's right-click on a LINK.
  //
  // POST /api/import/link { url } — the link's address and nothing else: no page was opened, so
  // there is no text to send. Accepted ONLY where linkRefetchability() says the server reads the
  // posting itself, from the ATS's own listing; every other link is refused BEFORE any fetch, with
  // a 422 whose `error` names the remedy (open it and Save this page). Then the same importJob()
  // as a capture — same dedup, same US gate, same job_captures row, same answer — with refetchOnly,
  // so the generic page fetch is never a fallback for a link.
  router.post("/link", async (req, res) => {
    const url = typeof req.body?.url === "string" ? req.body.url.slice(0, 2048) : "";
    const verdict = linkRefetchability(db, url);
    if (!verdict.ok) {
      return res.status(422).json({ error: verdict.message, refused: true, kind: `link_${verdict.reason}`, retryable: false });
    }
    try {
      const result = await importJob({ url }, { db, userId: req.user?.id || null, refetchOnly: true });
      if (queueLogo && result?.job?.company) {
        const urls = [result.employerSite, result.job.url, result.job.applyUrl, url].filter(Boolean);
        Promise.resolve().then(() => queueLogo({ company: result.job.company, urls })).catch(() => {});
      }
      const { employerSite, ...body } = result || {};
      res.json(body);
    } catch (err) {
      if (err instanceof ImportInputError) return res.status(422).json({ error: err.message, refused: true, kind: "link_not_listed", retryable: false });
      if (err instanceof ImportRefusedError) {
        return res.status(422).json({ error: err.message, refused: true, kind: err.kind, retryable: false });
      }
      console.error("[POST /api/import/link] Error:", err.message);
      res.status(502).json({ error: "Could not reach that job board. Please try again.", retryable: true });
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
  //   ⭐ D63 — for a KNOWN posting, what the popup leads with (the job card's language): `logo` (the
  //   row's stored icon, else the known-domain table — never a guess), `scores` (D58's pair: the stored
  //   base score for your ACTIVE profile and your tailored résumé's, `shown` = the one that would be
  //   sent), and `resumeReady`. Read from rows that already exist; the request is unchanged — the URL
  //   the press already sent — so the data SENT does not grow, only the answer does.
  router.post("/context", (req, res) => {
    const raw = String(req.body?.url || "").slice(0, 2048);
    let posting = null;
    let ats = null;
    if (/^https?:\/\//i.test(raw)) {
      // ⭐ The SAME resolution the fill uses (services/manualHandoff.js resolvePageJob): the page's address, its job
      // KEY at any stage (a Workday requisition — /apply, /applyManually …), or its ATS's job id. Before this the popup
      // matched the exact URL only, so a stage page read "Capture it" for a job the fill could find.
      const page = resolvePageJob(db, req.user.id, raw);
      const row = page.job
        ? db.prepare("SELECT job_id, title, company, duplicate_of, is_active, company_icon_url FROM scraped_jobs WHERE job_id = ?").get(page.job.jobId)
        : null;
      const saved = row
        ? !!db.prepare("SELECT 1 FROM user_jobs WHERE user_id = ? AND job_id = ? AND starred = 1").get(req.user.id, row.job_id)
        : false;
      // ⭐ Captured by you already (any route — the hotkey, the popup, automatic): the popup shows "Captured ✓", not "Capture it".
      let captured = null;
      if (row) {
        try { captured = db.prepare("SELECT MAX(created_at) FROM job_captures WHERE user_id = ? AND job_id = ? AND (action IS NULL OR action NOT LIKE 'refused%')").pluck().get(req.user.id, row.job_id) ?? null; }
        catch { captured = null; }
      }
      let extra = { logo: null, scores: null, resumeReady: false };
      if (row) {
        const profileId = db.prepare("SELECT id FROM domain_profiles WHERE user_id = ? AND is_active = 1 ORDER BY id LIMIT 1")
          .pluck().get(req.user.id) ?? null;
        const base = db.prepare("SELECT ats_score FROM ats_only_reports WHERE user_id = ? AND domain_profile_id IS ? AND job_id = ?")
          .pluck().get(req.user.id, profileId, row.job_id) ?? null;
        const resume = db.prepare("SELECT ats_score, base_ats_score, length(html) AS n FROM resumes WHERE user_id = ? AND job_id = ?")
          .get(req.user.id, row.job_id);
        const ready = !!resume && resume.n > 0;
        extra = {
          logo: row.company_icon_url || getKnownLogoUrl(row.company || "") || null,
          scores: atsScorePair({ base: ready ? (resume.base_ats_score ?? base) : base, tailored: ready ? resume.ats_score : null }),
          resumeReady: ready,
        };
      }
      posting = row
        ? { known: true, saved, captured: captured != null, capturedAt: captured != null ? captured * 1000 : null, how: page.how || null,
            jobId: row.job_id, title: row.title || null, company: row.company || null, active: row.is_active !== 0, ...extra }
        : { known: false, saved: false, captured: false, capturedAt: null, how: null, jobId: null, title: null, company: null, active: null, logo: null, scores: null, resumeReady: false };
      const m = detectKnownAtsMatch(raw);
      const pk = pageKeyOf(raw);
      ats = m ? { type: m.type, slug: m.slug || m.tenant || null,
        ...(pk ? { requisition: pk.requisition, rev: pk.rev, stage: pk.stage } : {}) } : null;
    }
    // D33: each with what happened to it (on the board · held off it and why · closed), worded by
    // services/jobs/captureOutcome.js — the same words the capture itself answered with.
    const recent = recentCaptures(db, req.user.id, 5);
    res.json({ posting, ats, recent });
  });

  // ⭐ D64 · AUTOMATED CAPTURE — POST /api/import/auto { url, text }.
  //
  // The extension sends this only for a page its local check found to BE a posting (JSON-LD JobPosting,
  // or a known ATS posting URL shape), and only while the user has switched automatic capture on.
  // Here: the kill switch, then the brakes, then importJob in auto mode — which decides relevance to the
  // user's board BEFORE writing and discards an irrelevant posting without a trace
  // (services/jobs/autoCapture.js). ⛔ The text the user's own browser read is required: this route
  // never makes draft fetch a page.
  //   200 { discarded: true, reason }   not relevant (outside the US, outside the profile's roles…) — nothing stored
  //   200 { already: true }             this URL was auto-captured for you in the last 24 h
  //   200 capture answer, auto: true    on your board, marked "Captured automatically"
  //   429 auto_capture_cap · 403 auto_capture_disabled (never 503 on this router — D33: no model failure here)
  router.post("/auto", async (req, res) => {
    if (autoCaptureDisabled(db)) {
      return res.status(403).json({ error: "Automatic capture is switched off.", code: "auto_capture_disabled", retryable: false });
    }
    const url = typeof req.body?.url === "string" ? req.body.url.slice(0, 2048) : "";
    const text = typeof req.body?.text === "string" ? req.body.text : "";
    if (!/^https?:[/][/]/i.test(url) || !text.trim()) {
      return res.status(400).json({ error: "Automatic capture sends the page's address and the text it read." });
    }
    const brake = autoCaptureBrake(db, req.user.id, url);
    if (brake?.code === "already_today") return res.json({ success: true, auto: true, already: true });
    if (brake) return res.status(429).json({ error: "Too many automatic captures this hour.", code: "auto_capture_cap", retryable: true });
    try {
      const result = await importJob({ url, text }, { db, userId: req.user.id, auto: true });
      if (!result?.discarded && queueLogo && result?.job?.company) {
        const urls = [result.employerSite, result.job.url, result.job.applyUrl, url].filter(Boolean);
        Promise.resolve().then(() => queueLogo({ company: result.job.company, urls })).catch(() => {});
      }
      const { employerSite, ...body } = result || {};
      res.json({ ...body, auto: true });
    } catch (err) {
      if (err instanceof ImportInputError) return res.status(400).json({ error: err.message });
      console.error("[POST /api/import/auto] Error:", err.message);
      res.status(502).json({ error: "Could not capture this job automatically.", retryable: true });
    }
  });

  // ⭐ "Captured today" (owner 10-12: it read 0 after two captures of one job) — DISTINCT jobs captured in the last
  // 24 hours by ANY route (the hotkey, the popup, the right-click, automatic), and how many of them were already on
  // the board. A second capture of one job counts once. Account-level, like the Today ring: allowed on popup open.
  router.get("/today", (req, res) => {
    let row = { n: 0, already: 0 };
    try {
      row = db.prepare(`SELECT COUNT(*) AS n, SUM(first_action = 'attached') AS already FROM (
          SELECT job_id, (SELECT c2.action FROM job_captures c2 WHERE c2.user_id = c.user_id AND c2.job_id = c.job_id ORDER BY c2.id ASC LIMIT 1) AS first_action
          FROM job_captures c WHERE c.user_id = ? AND c.created_at > unixepoch() - 86400 AND (c.action IS NULL OR c.action NOT LIKE 'refused%')
          GROUP BY job_id)`).get(req.user.id);
    } catch { /* no captures table */ }
    res.json({ today: row?.n || 0, alreadyOnBoard: row?.already || 0, windowHours: 24 });
  });

  // D64 · "Captured today: N" — the popup's list, with an undo per item.
  router.get("/auto", (req, res) => {
    res.json({ captures: listAutoCaptures(db, req.user.id), disabled: autoCaptureDisabled(db) });
  });

  // D64 · undo one automatic capture: off your board and your + view (the shared posting stays).
  router.post("/auto/:jobId/undo", (req, res) => {
    const r = undoAutoCapture(db, req.user.id, String(req.params.jobId || ""));
    if (!r.undone) return res.status(404).json({ error: "That posting was not captured automatically for you." });
    res.json({ success: true, ...r });
  });

  return router;
}
