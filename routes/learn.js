// routes/learn.js — ⭐ D115 · LEARN, the owner's "From silicon to software" tracker inside the Atlas (/atlas/learn).
//   GET  /api/learn                     the content (public): copy, PARTS, ATLAS (patterns), INDEX (concepts) — the
//                                       owner's words verbatim, links only; cached for an hour
//   GET  /api/learn/progress            the signed-in learner's marks → { marks: [{ id, state, at }] }
//   PUT  /api/learn/progress            { id, on } — an item done / a checkpoint explained, or cleared
//   POST /api/learn/progress/import     { marks } — the browser's marks, offered on sign-in; the account's win
import { Router } from "express";
import { learnContent } from "../services/learn/learnContent.js";
import { readProgress, setMark, importMarks } from "../services/learn/learnProgress.js";

export function createLearnRouter(db, { requireAuth }) {
  const router = Router();
  router.get("/", (_req, res) => {
    const { source, copy, PARTS, ATLAS, INDEX } = learnContent();
    res.set("Cache-Control", "public, max-age=3600");
    res.json({ source, copy, PARTS, ATLAS, INDEX });
  });
  router.get("/progress", requireAuth, (req, res) => res.json({ marks: readProgress(db, req.user.id) }));
  router.put("/progress", requireAuth, (req, res) => {
    const { id, on } = req.body || {};
    if (typeof id !== "string" || typeof on !== "boolean") return res.status(400).json({ error: "id (string) and on (boolean) are required" });
    if (!setMark(db, req.user.id, id, on)) return res.status(404).json({ error: "unknown_mark" });
    res.json({ ok: true });
  });
  router.post("/progress/import", requireAuth, (req, res) => res.json({ ok: true, ...importMarks(db, req.user.id, req.body?.marks) }));
  return router;
}
