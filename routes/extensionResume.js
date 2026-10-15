// routes/extensionResume.js — ⭐ D98 P1 · the extension's résumé endpoints. The extension's OWN token only.
//
//   POST /api/extension/resume                  { boundJobId, trigger: "click", regenerate? } → 202 { id, status: "queued", … }
//                                               (200 with the existing generation when one is already live for this
//                                               job and base résumé — nothing is spent twice)
//   GET  /api/extension/resume/:id              the status, and when ready the result
//   POST /api/extension/resume/:id/cancel       queued → cancelled (slot back) · generating → cancelled
//   POST /api/extension/resume/:id/pdf          { attach? } → the stored PDF's name and where to fetch it
//   GET  /api/extension/resume/:id/pdf/file     the PDF bytes (application/pdf)
//   GET  /api/extension/base-resume             ⭐ T18: { exists, fileName } — does the account keep a base résumé
//   GET  /api/extension/base-resume/pdf/file    ⭐ T18: the base résumé as a PDF ("Attach my résumé") — no model, no slot
//
// ⛔ Refused for anything but the extension's credential (an auth_contexts row with the extension's user agent): a
// browser tab, its cookie, or a script with a tab's token gets 403 — the web app has its own Generate.
// ⛔ The job comes from the tab binding (`boundJobId`) and must already be the user's own (services/manualHandoff.js
// userHasJob, the same rule routes/apply.js applies to the binding) — another user's job is "not on your board".
// ⛔ Rate-limited per user; every error is one of USER_ERRORS (services/extensionResume.js).
import express from "express";
import { userError, createRateLimiter } from "../services/extensionResume.js";

/** ⚠ provisional: a user may START at most this many generations in ten minutes, and read at most 120 times a minute. */
export const START_LIMIT = Object.freeze({ limit: 6, windowMs: 10 * 60_000 });
export const READ_LIMIT = Object.freeze({ limit: 120, windowMs: 60_000 });

export function createExtensionResumeRouter({ service, requireAuth, isExtension, startLimit = START_LIMIT, readLimit = READ_LIMIT, now }) {
  const router = express.Router();
  const startOk = createRateLimiter({ ...startLimit, ...(now ? { now } : {}) });
  const readOk = createRateLimiter({ ...readLimit, ...(now ? { now } : {}) });
  const send = (res, out) => res.status(out.status).json(out.body);

  const extensionOnly = (req, res, next) => (isExtension(req) ? next() : send(res, userError("extension_only")));
  const limited = (ok) => (req, res, next) => (ok(String(req.user.id)) ? next() : send(res, userError("rate_limited")));
  const guard = [requireAuth, extensionOnly];

  router.post("/api/extension/resume", ...guard, limited(startOk), (req, res) => {
    // ⛔ USER-TRIGGERED ONLY: the extension sends `trigger: "click"` from the button's handler and nowhere else.
    if (req.body?.trigger !== "click") return send(res, userError("trigger_required"));
    const jobId = req.body?.boundJobId != null && req.body.boundJobId !== "" ? String(req.body.boundJobId) : null;
    send(res, service.start(req.user.id, { jobId, regenerate: req.body?.regenerate === true }));
  });

  router.get("/api/extension/resume/:id", ...guard, limited(readOk), (req, res) => send(res, service.get(req.user.id, req.params.id)));

  router.post("/api/extension/resume/:id/cancel", ...guard, limited(readOk), (req, res) => send(res, service.cancel(req.user.id, req.params.id)));

  router.post("/api/extension/resume/:id/pdf", ...guard, limited(readOk), async (req, res) => {
    try { send(res, await service.pdf(req.user.id, req.params.id, { attach: req.body?.attach === true })); }
    catch { send(res, userError("pdf_unavailable")); }
  });

  router.get("/api/extension/resume/:id/pdf/file", ...guard, limited(readOk), (req, res) => {
    const file = service.pdfFile(req.user.id, req.params.id);
    if (!file) return send(res, userError("not_found"));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.end(file.body);
  });

  // ⭐ T18 · the review row's "Attach my résumé". Reads only; the extension's credential only, like every route here.
  router.get("/api/extension/base-resume", ...guard, limited(readOk), (req, res) => {
    if (typeof service.baseResumeInfo !== "function") return send(res, userError("not_found"));
    res.json(service.baseResumeInfo(req.user.id));
  });
  router.get("/api/extension/base-resume/pdf/file", ...guard, limited(readOk), async (req, res) => {
    let file = null;
    try { file = typeof service.baseResumePdf === "function" ? await service.baseResumePdf(req.user.id) : null; }
    catch { return send(res, userError("pdf_unavailable")); }
    if (!file) return send(res, userError("not_found"));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.end(file.body);
  });

  return router;
}
