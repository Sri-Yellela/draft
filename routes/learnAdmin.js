// routes/learnAdmin.js — ⭐ D118 P2 · Admin → Atlas → Import content (requireAdmin is mounted in front, server.js).
//   GET  /api/admin/learn/content           what is live: version, when, by whom, the counts
//   POST /api/admin/learn/import/preview    { content } → { base, diff (by id), counts, progress } — NOTHING is written
//   POST /api/admin/learn/import/apply      { content, base } → writes it (version + 1) and the Atlas follows;
//                                           409 when the live content moved since the preview (`base`)
// `content` is the EXTRACTED JSON — the tracker's HTML is extracted in the owner's browser (shared/learnTracker.js).
// ⛔ This server never evaluates an upload: an HTML page (or anything that is not the JSON object) is refused with a
// 400 that says to extract it first; the JSON is validated field by field (services/learn/learnImport.js).
import { Router } from "express";
import { learnContent, learnContentVersion } from "../services/learn/learnContent.js";
import { previewLearnImport, applyLearnImport } from "../services/learn/learnImport.js";

const NOT_JSON = { error: "not_extracted", message: "Send the extracted JSON ({ PARTS, ATLAS, INDEX }). A tracker page is extracted in your browser — this server never runs a script it is sent." };
const contentOf = (req) => {
  const c = req.body?.content;
  return c !== null && typeof c === "object" && !Array.isArray(c) ? c : null;
};
const curator = (req) => req.user?.username || req.admin?.email || "admin";

export function createLearnAdminRouter(db) {
  const router = Router();
  router.get("/content", (_req, res) => {
    const v = learnContentVersion(db);
    const { source } = learnContent(db);
    res.json({ version: v?.version ?? 0, at: v?.at ?? null, by: v?.by ?? null, source });
  });
  router.post("/import/preview", (req, res) => {
    const content = contentOf(req);
    if (!content) return res.status(400).json(NOT_JSON);
    const r = previewLearnImport(db, content);
    res.status(r.ok ? 200 : 400).json(r);
  });
  router.post("/import/apply", (req, res) => {
    const content = contentOf(req);
    if (!content) return res.status(400).json(NOT_JSON);
    const base = req.body?.base;
    if (!Number.isInteger(base)) return res.status(400).json({ error: "base_required", message: "Preview first: Apply carries the version the preview was made against." });
    const r = applyLearnImport(db, content, { base, by: curator(req) });
    if (r.stale) return res.status(409).json({ error: "stale", message: "The live content changed since this preview — preview again.", version: r.version });
    res.status(r.ok ? 200 : 400).json(r);
  });
  return router;
}
