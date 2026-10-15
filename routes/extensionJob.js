// routes/extensionJob.js — ⭐ D99 J11 · THE BOARD HANDS A JOB TO THE EXTENSION. The extension's OWN token only.
//
//   GET /api/extension/job/:id   → 200 { job: { jobId, title, company, url, logo, reportPath }, ats }
//                                  404 { error: "not_on_board" } · 403 extension_only · 429 rate_limited
//                                  (`url` is null when the posting has no https address — nothing to open, the report stands)
//   POST /api/extension/page     { url, text } → 200 { posting, ats, basis }   ⭐ T2 + T3 (field report 10-14), below
//
// Read today by the on-page résumé panel (extension/boardJob.js, J12: the report). ⚠ D99 J11's bridge — the web app
// handing a job id to the extension, which opens the address THIS returns — waits on the owner's word (WORKLOG 43d).
// ⛔ Whoever opens a tab from this answer opens the SERVER's address, for a job that is the user's own or live on the
// board (services/manualHandoff.js jobOnUsersBoard) — never an address a page sent.
//
// `ats` is draft's own report on the user's base résumé (D99 J12 — the free checker is for signed-out visitors only):
//   { state: "ready", score, band, scorable, matched, missing }   the scorer judged it (score null = not enough signal)
//   { state: "no_base_resume" }                                     → "Add your résumé in draft"
//   { state: "unavailable" }                                         a profile or the scorer was not there — said so
// It is the same call the approval screen and the board use (server.js scoreBaseResumeForApply), so the score the
// page shows is the web app's.
import express from "express";
import { jobOnUsersBoard, resolvePageJob, userHasJob } from "../services/manualHandoff.js";
import { jobFromLabelledText } from "../services/jobs/importJob.js";
import { previewIngest } from "../services/jobs/jobGateway.js";
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
  if (!row) return null;
  // null when the posting has no https address: the report still stands, but there is nothing safe to open
  const url = httpsOnly(row.apply_url) || httpsOnly(row.url);
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

/** The page text a press may send — the extractor's labelled block (extension/extractor.js), capped. */
export const PAGE_TEXT_MAX = 60_000;

const reportOf = (r) => (r ? { state: "ready", score: r.score ?? null, band: r.band ?? null, scorable: r.scorable !== false,
  matched: (r.matched || []).slice(0, 40), missing: (r.missing || []).slice(0, 40) } : { state: "unavailable" });

/**
 * ⭐ T2 + T3 (field report 10-14) · "Read this page" — WHICH JOB IS THIS, AND HOW DOES MY RÉSUMÉ SCORE FOR IT?
 *
 * The owner's Stripe page read "Not on your board yet" and showed no ATS, while the capture a minute later said
 * "1 already on your board" and showed "ATS 66": two matchers, and a score withheld until a capture. Now one answer:
 *   1. the page's ADDRESS — resolvePageJob, the fill's own resolution (its URL, its ATS's job id, its Workday key);
 *   2. else the page's TEXT, through the CAPTURE'S OWN matcher — the same read (jobFromLabelledText) and the same
 *      fingerprint (previewIngest, read-only) importJob uses, so whatever a capture would link to, this names;
 *   3. the ATS: the board job's report (scoreFor — the board's and the approval screen's number), or, for a page draft
 *      does not hold, the base résumé scored against THE PAGE'S OWN TEXT on the spot (scoreText). Never a capture first.
 * ⛔ Read-only: no row is written, the text is scored and dropped, and nothing about the page is kept.
 *   posting  { known: true, jobId, title, company, how, onBoard } · { known: false, title, company } · null (no text, no match)
 *   basis    "board" — the report is the board job's · "page" — it is the page's text · null — no report
 */
export function pageJobForExtension(db, userId, { url = "", text = "", frameUrls = [] } = {}, { scoreFor, scoreText, hasBaseResume }) {
  const href = /^https?:\/\//i.test(String(url)) ? String(url).slice(0, 2048) : "";
  const body = typeof text === "string" ? text.slice(0, PAGE_TEXT_MAX) : "";
  let jobId = null, how = null;
  if (href) {
    const page = resolvePageJob(db, userId, href);
    if (page.job) { jobId = page.job.jobId; how = page.how || "url"; }
  }
  // ⭐ BINDING FIRST (owner 10-15) · T11: an employer's page that embeds the ATS's form (Stripe → Greenhouse) may name
  // no job in its own address; the FORM's frame does (…/embed/job_app?token=8198280). The same resolution, read-only —
  // identity only: where answers may be released is still the packet's origin list (services/applyOrigins.js).
  for (const f of (Array.isArray(frameUrls) ? frameUrls : []).slice(0, 3)) {
    if (jobId) break;
    const fu = /^https?:\/\//i.test(String(f)) ? String(f).slice(0, 2048) : "";
    if (!fu) continue;
    const page = resolvePageJob(db, userId, fu);
    if (page.job) { jobId = page.job.jobId; how = "frame"; }
  }
  let read = null;
  if (body.trim()) { try { read = jobFromLabelledText({ url: href || null, text: body }); } catch { read = null; } }
  if (!jobId && read) {
    try {
      const p = previewIngest(db, read);
      if (p.existingJobId) {
        const row = db.prepare("SELECT job_id, duplicate_of FROM scraped_jobs WHERE job_id = ?").get(p.existingJobId);
        if (row) { jobId = String(row.duplicate_of || row.job_id); how = "capture_match"; }
      }
    } catch { /* a fingerprint that cannot be read is not a match */ }
  }
  const hasBase = (() => { try { return !!hasBaseResume(userId); } catch { return false; } })();
  if (jobId) {
    const row = db.prepare("SELECT job_id, title, company FROM scraped_jobs WHERE job_id = ?").get(jobId);
    if (row) {
      const ats = !hasBase ? { state: "no_base_resume" } : reportOf((() => { try { return scoreFor(userId, row.job_id); } catch { return null; } })());
      // ⭐ BINDING FIRST: `mine` — the job is already this user's own (saved, captured, drafted, prepared) — so the
      // extension can say "on your board" vs "on the draft board, not yet yours" without a second question.
      return { kind: "job", posting: { known: true, jobId: String(row.job_id), title: row.title ?? null, company: row.company ?? null, how,
                          onBoard: jobOnUsersBoard(db, userId, row.job_id), mine: userHasJob(db, userId, row.job_id) },
               ats, basis: ats.state === "ready" ? "board" : null };
    }
  }
  // `kind`: "job" — a posting the page's text describes · "not_a_job" — text was read and is no posting · "unread" —
  // no text came (the extension could not read the page) and the address names nothing.
  if (!read) return { kind: body.trim() ? "not_a_job" : "unread", posting: null, ats: null, basis: null };
  const ats = !hasBase ? { state: "no_base_resume" } : reportOf((() => { try { return scoreText(userId, read); } catch { return null; } })());
  return { kind: "job", posting: { known: false, title: read.title ?? null, company: read.company ?? null }, ats, basis: ats.state === "ready" ? "page" : null };
}

export function createExtensionJobRouter({ db, requireAuth, isExtension, scoreFor, scoreText = null, hasBaseResume, limit = LOOKUP_LIMIT, now }) {
  const router = express.Router();
  const ok = createRateLimiter({ ...limit, ...(now ? { now } : {}) });
  router.get("/api/extension/job/:id", requireAuth, (req, res) => {
    if (!isExtension(req)) return res.status(403).json({ error: "extension_only", message: "This is for the draft extension." });
    if (!ok(String(req.user.id))) return res.status(429).json({ error: "rate_limited", message: "Too many requests — try again in a minute." });
    const out = boardJobForExtension(db, req.user.id, req.params.id, { scoreFor, hasBaseResume });
    if (!out) return res.status(404).json({ error: "not_on_board", message: "That job is not on your board." });
    res.json(out);
  });
  // ⭐ T2 + T3 — the press's one question (pageJobForExtension above). Its own limiter: a press is one request.
  const okPage = createRateLimiter({ ...limit, ...(now ? { now } : {}) });
  router.post("/api/extension/page", requireAuth, (req, res) => {
    if (!isExtension(req)) return res.status(403).json({ error: "extension_only", message: "This is for the draft extension." });
    if (!okPage(String(req.user.id))) return res.status(429).json({ error: "rate_limited", message: "Too many requests — try again in a minute." });
    res.json(pageJobForExtension(db, req.user.id, { url: req.body?.url, text: req.body?.text, frameUrls: req.body?.frameUrls },
      { scoreFor, scoreText: scoreText || (() => null), hasBaseResume }));
  });
  return router;
}
