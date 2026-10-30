// ── D101 · THE PROFILE PAGE'S API ──────────────────────────────────────────────────────────────
//
// GET  /api/profile/sections                 the sections, Application defaults (set / not set), "n of 10", and a
//                                             suggestion from a newer base résumé (offered, never applied)
// PUT  /api/profile/sections/:section        summary · experience · education · skills · links — one drawer's Save
// POST /api/profile/sections/use-resume      "Your résumé says X — use it?" — one press
// PUT  /api/profile/defaults/:key            { value } — set one Application default; { value: null } clears it
// services/structuredProfile.js holds the rules; these routes only expose them.
import { readProfile, saveSection, useResumeSuggestion, setDefault, readDefaults, profileLogosToResolve } from "../services/structuredProfile.js";
import { resolveCaptureLogo } from "../services/jobs/companyLogoStore.js";

/** @param opts.resolveLogo(db, { company }) — the logo lookup (injectable for tests); never awaited by a read. */
export default function profileSectionRoutes(app, db, requireAuth, { resolveLogo = resolveCaptureLogo } = {}) {
  const fail = (res, e) => res.status(e.status || 500).json({ error: e.code || "error", message: e.message });
  // D101 P1: the experience section's logos — looked up in the background; the next read shows them.
  const lookUpLogos = (userId) => {
    for (const company of profileLogosToResolve(db, userId)) {
      Promise.resolve().then(() => resolveLogo(db, { company })).catch(() => {});
    }
  };

  app.get("/api/profile/sections", requireAuth, (req, res) => {
    try { res.json(readProfile(db, req.user.id)); lookUpLogos(req.user.id); } catch (e) { fail(res, e); }
  });
  app.post("/api/profile/sections/use-resume", requireAuth, (req, res) => {
    if (!useResumeSuggestion(db, req.user.id)) return res.status(409).json({ error: "nothing_to_use", message: "Your base résumé could not be read." });
    res.json(readProfile(db, req.user.id));
  });
  app.put("/api/profile/sections/:section", requireAuth, (req, res) => {
    try { saveSection(db, req.user.id, req.params.section, req.body || {}); res.json(readProfile(db, req.user.id)); }
    catch (e) { fail(res, e); }
  });
  app.put("/api/profile/defaults/:key", requireAuth, (req, res) => {
    if (!req.body || !("value" in req.body)) return res.status(400).json({ error: "value_required", message: 'PUT {"value": "…"} or {"value": null} to clear.' });
    try { setDefault(db, req.user.id, req.params.key, req.body.value, "user"); res.json({ defaults: readDefaults(db, req.user.id) }); }
    catch (e) { fail(res, e); }
  });
}
