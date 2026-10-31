// routes/learn.js — ⭐ D115 · LEARN, the owner's "From silicon to software" tracker inside the Atlas (/atlas/learn).
//   GET  /api/learn                     the content (public): copy, PARTS, ATLAS (patterns), INDEX (concepts) — the
//                                       owner's words verbatim, links only
//   GET  /api/learn/progress            the signed-in learner's marks → { marks: [{ id, state, at }] }
//   PUT  /api/learn/progress            { id, on } — an item done / a checkpoint explained, or cleared
//   POST /api/learn/progress/import     { marks } — the browser's marks, offered on sign-in; the account's win
// ⭐ D118 P2: the content is the DATABASE's (learnContent(db), learn_content) — an import from Admin → Atlas → Import
// content is served on the next read; the public cache is a minute (was an hour), so a browser has it within one.
import { Router } from "express";
import { learnContent } from "../services/learn/learnContent.js";
import { readProgress, setMark, importMarks } from "../services/learn/learnProgress.js";
import { circleOf } from "../services/learn/learnCircle.js";

export const LEARN_CACHE = "public, max-age=60";

export function createLearnRouter(db, { requireAuth }) {
  const router = Router();
  router.get("/", (_req, res) => {
    const { source, copy, PARTS, ATLAS, INDEX } = learnContent(db);
    res.set("Cache-Control", LEARN_CACHE);
    res.json({ source, copy, PARTS, ATLAS, INDEX });
  });
  // ⭐ D117 · the circle's overlay on the tracker (public, like the tracker): per piece its "Before this" links (with
  // their status — drafted ones are used and marked "draft" until the owner accepts them), "After this" (computed), the
  // Atlas nodes it teaches, its live D115 P5 links; and the guided routes as data. The tracker's words stay /api/learn's.
  router.get("/circle", (_req, res) => {
    res.set("Cache-Control", LEARN_CACHE);
    res.json(circleOf(db, learnContent(db)));
  });
  router.get("/progress", requireAuth, (req, res) => res.json({ marks: readProgress(db, req.user.id) }));
  router.put("/progress", requireAuth, (req, res) => {
    const { id, on } = req.body || {};
    if (typeof id !== "string" || typeof on !== "boolean") return res.status(400).json({ error: "id (string) and on (boolean) are required" });
    if (!setMark(db, req.user.id, id, on, { learn: learnContent(db) })) return res.status(404).json({ error: "unknown_mark" });
    res.json({ ok: true });
  });
  router.post("/progress/import", requireAuth, (req, res) => res.json({ ok: true, ...importMarks(db, req.user.id, req.body?.marks, { learn: learnContent(db) }) }));
  return router;
}
