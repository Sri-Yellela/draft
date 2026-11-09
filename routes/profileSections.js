// ── D101 · THE PROFILE PAGE'S API ──────────────────────────────────────────────────────────────
//
// GET  /api/profile/sections                 the sections, Application defaults (set / not set), "n of 10", and a
//                                             suggestion from a newer base résumé (offered, never applied)
// PUT  /api/profile/sections/:section        summary · experience · education · skills · links — one drawer's Save
// POST /api/profile/sections/use-resume      "Your résumé says X — use it?" — one press
// PUT  /api/profile/defaults/:key            { value } — set one Application default; { value: null } clears it
// PUT  /api/profile/evidence               D109 P1 · { target: 'bullet'|'project', claim, items: [{ kind, label, url }] } —
//                                             one claim's evidence links (https only); [] removes them
// GET  /api/profile/proof-page             D109 P3 · { enabled, handle } — the public page is OFF until turned on
// PUT  /api/profile/proof-page             D109 P3 · { enabled, handle }
// PUT  /api/profile/education-override       D112 d2 · { degree, field, school, year } — the Change override for a form
//                                             that needs something else; all empty clears it (the section speaks again)
// ⭐ D183 P1 · PROFILE = YOUR PAGE (services/profilePage.js):
// GET    /api/profile/page                     the owner's page: header, source, sections, skills in two columns, where
//                                             you fit, achievements, links, and who can see each (DEFAULT only you)
// GET    /api/profile/page?as=public|connection  ⛔ the SAME filter the public page uses — hidden sections are never sent
// PUT    /api/profile/page/visibility          { page } · { section, level|null } · { searchable } · { openToWork } ·
//                                             { referrals } · { headline }
// POST   /api/profile/page/achievements        { title, detail?, year? } — one added by hand
// DELETE /api/profile/page/achievements/:id
// services/structuredProfile.js holds the rules; these routes only expose them.
import { readProfile, saveSection, useResumeSuggestion, setDefault, readDefaults, profileLogosToResolve, setEducationOverride } from "../services/structuredProfile.js";
import { resolveCaptureLogo } from "../services/jobs/companyLogoStore.js";
import { setEvidence, readProofPage, setProofPage } from "../services/proofLinks.js";
import { profilePage, viewFor, setVisibility, addAchievement, removeAchievement } from "../services/profilePage.js";
import { refreshPerson } from "../services/peopleSearch.js";
import { latestReplacement, keepReplacement, undoReplacement } from "../services/profileReplace.js";
import { saveBaseResumeRecord, upsertSimpleApplyProfile } from "../services/simpleApplyProfile.js";

/** @param opts.resolveLogo(db, { company }) — the logo lookup (injectable for tests); never awaited by a read. */
export default function profileSectionRoutes(app, db, requireAuth, { resolveLogo = resolveCaptureLogo } = {}) {
  // ⭐ 45n · people search: any successful change under /api/profile re-reads the person's PUBLIC page into the index
  // (or drops them when it is not public) — after the response, never in its way.
  app.use("/api/profile", (req, res, next) => {
    if (req.method !== "GET") res.on("finish", () => { if (res.statusCode < 400 && req.user?.id != null) setImmediate(() => refreshPerson(db, req.user.id)); });
    next();
  });
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
  app.put("/api/profile/evidence", requireAuth, (req, res) => {
    try { setEvidence(db, req.user.id, req.body || {}); res.json(readProfile(db, req.user.id)); }
    catch (e) { fail(res, e); }
  });
  app.get("/api/profile/proof-page", requireAuth, (req, res) => {
    try { res.json(readProofPage(db, req.user.id)); } catch (e) { fail(res, e); }
  });
  app.put("/api/profile/proof-page", requireAuth, (req, res) => {
    try { res.json(setProofPage(db, req.user.id, req.body || {})); } catch (e) { fail(res, e); }
  });
  app.put("/api/profile/education-override", requireAuth, (req, res) => {
    try { setEducationOverride(db, req.user.id, req.body || {}); res.json(readProfile(db, req.user.id)); }
    catch (e) { fail(res, e); }
  });
  // ⭐ D183 P1 · the page. `as` previews a visitor's view through the server's own filter (View as the public).
  const pageView = (req) => {
    const as = String(req.query?.as || "owner");
    return viewFor(profilePage(db, req.user.id), as === "public" ? "public" : as === "connection" ? "connection" : "owner");
  };
  app.get("/api/profile/page", requireAuth, (req, res) => {
    try { res.json(pageView(req)); lookUpLogos(req.user.id); } catch (e) { fail(res, e); }
  });
  app.put("/api/profile/page/visibility", requireAuth, (req, res) => {
    try { setVisibility(db, req.user.id, req.body || {}); res.json(profilePage(db, req.user.id)); } catch (e) { fail(res, e); }
  });
  app.post("/api/profile/page/achievements", requireAuth, (req, res) => {
    try { addAchievement(db, req.user.id, req.body || {}); res.json(profilePage(db, req.user.id)); } catch (e) { fail(res, e); }
  });
  app.delete("/api/profile/page/achievements/:id", requireAuth, (req, res) => {
    try { removeAchievement(db, req.user.id, req.params.id); res.json(profilePage(db, req.user.id)); } catch (e) { fail(res, e); }
  });
  // ⭐ D183 P2 · What changed after a résumé replace: the newest one waiting for "Looks right"; keep it; or Undo (30 days).
  // ⭐ D183 P3 · the public link's handle (one per person, unique, reserved words refused) — kept in proof_pages, so a
  // D109 address keeps working (it redirects to /in/<handle>). The proof page's old on / off is not changed here.
  app.put("/api/profile/page/handle", requireAuth, (req, res) => {
    try {
      const cur = readProofPage(db, req.user.id);
      setProofPage(db, req.user.id, { handle: req.body?.handle, enabled: cur.enabled });
      res.json(profilePage(db, req.user.id));
    } catch (e) { fail(res, e); }
  });
  app.get("/api/profile/replacements/latest", requireAuth, (req, res) => {
    try { res.json({ replacement: latestReplacement(db, req.user.id) }); } catch (e) { fail(res, e); }
  });
  app.post("/api/profile/replacements/:id/keep", requireAuth, (req, res) => {
    try { keepReplacement(db, req.user.id, req.params.id); res.json({ ok: true }); } catch (e) { fail(res, e); }
  });
  app.post("/api/profile/replacements/:id/undo", requireAuth, (req, res) => {
    try {
      const back = undoReplacement(db, req.user.id, req.params.id);
      // The old résumé is the base again, and its signals are re-extracted from it (as an upload does).
      if (back.profileId != null && back.content) {
        saveBaseResumeRecord(db, { userId: req.user.id, profileId: back.profileId }, back.content, back.name || "resume.txt");
        const titles = JSON.parse(db.prepare("SELECT target_titles FROM domain_profiles WHERE id = ?").pluck().get(back.profileId) || "[]");
        try { upsertSimpleApplyProfile(db, { userId: req.user.id, profileId: back.profileId }, back.content, titles); } catch (e) { console.warn("[d183] undo signals:", e.message); }
      }
      res.json({ ok: true, page: profilePage(db, req.user.id) });
    } catch (e) { fail(res, e); }
  });
  app.put("/api/profile/defaults/:key", requireAuth, (req, res) => {
    if (!req.body || !("value" in req.body)) return res.status(400).json({ error: "value_required", message: 'PUT {"value": "…"} or {"value": null} to clear.' });
    try { setDefault(db, req.user.id, req.params.key, req.body.value, "user"); res.json({ defaults: readDefaults(db, req.user.id) }); }
    catch (e) { fail(res, e); }
  });
}
