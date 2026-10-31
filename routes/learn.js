// routes/learn.js — ⭐ D115 · LEARN, the owner's "From silicon to software" tracker inside the Atlas (/atlas/learn).
//   GET  /api/learn                     the content (public): copy, PARTS, ATLAS (patterns), INDEX (concepts) — the
//                                       owner's words verbatim, links only
//   GET  /api/learn/circle              ⭐ D117: the circle's overlay (public) — per piece "Before this" (with status),
//                                       "After this", the Atlas nodes it teaches, its live P5 links; the guided routes
//   GET  /api/learn/circle/my-route     ⭐ D117 C5: "From your map" — the pieces teaching the user's own route's skills
// ⭐ D117 C8 · PROGRESS IS EARNED, NOT TICKED (signed in; services/learn/learnEarned.js):
//   GET  /api/learn/earned              the learner's own record: marks (opened · explained · built), their
//                                       explanations (theirs alone to read), build links, how many old ticks are kept
//   POST /api/learn/opened              { id } — the item's link was opened FROM DRAFT (the page sends it on the click)
//   PUT  /api/learn/explained           { id, text, pasted } — a checkpoint in the user's own words (≥ 25, no paste ≥ 25)
//   PUT  /api/learn/built               { step, url, kind } — the link to what was built (a required Build / Project)
//   ⛔ Nothing a user can send marks an item or a piece done: D115's PUT /progress and POST /progress/import now answer
//   410 (C8 replaced self-ticks). GET /progress still reads the old ticks, which are kept, never counted.
// ⭐ D118 P2: the content is the DATABASE's (learnContent(db), learn_content) — an import from Admin → Atlas → Import
// content is served on the next read; the public cache is a minute (was an hour), so a browser has it within one.
import { Router } from "express";
import { learnContent } from "../services/learn/learnContent.js";
import { readProgress } from "../services/learn/learnProgress.js";
import { circleOf } from "../services/learn/learnCircle.js";
import { readEarned, recordOpened, saveExplanation, saveBuild } from "../services/learn/learnEarned.js";
import { mapRouteFor } from "../services/learn/learnMapRoute.js";

export const LEARN_CACHE = "public, max-age=60";
export const TICKS_GONE = Object.freeze({ error: "earned_not_ticked",
  message: "Progress is earned now: open an item from draft, explain a checkpoint in your own words, link what you built. Nothing is marked done by hand." });

export function createLearnRouter(db, { requireAuth }) {
  const router = Router();
  const send = (res, r) => res.status(r.ok ? 200 : r.status || 400).json(r);
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
  router.get("/circle/my-route", requireAuth, (req, res) => {
    res.set("Cache-Control", "private, no-store");
    res.json(mapRouteFor(db, req.user.id));
  });
  router.get("/earned", requireAuth, (req, res) => {
    res.set("Cache-Control", "private, no-store");
    res.json(readEarned(db, req.user.id));
  });
  router.post("/opened", requireAuth, (req, res) => {
    const id = req.body?.id;
    if (typeof id !== "string") return res.status(400).json({ ok: false, error: "id (string) is required" });
    send(res, recordOpened(db, req.user.id, id));
  });
  router.put("/explained", requireAuth, (req, res) => {
    const { id, text, pasted } = req.body || {};
    if (typeof id !== "string" || typeof text !== "string") return res.status(400).json({ ok: false, error: "id and text (strings) are required" });
    send(res, saveExplanation(db, req.user.id, id, text, { pastedWords: Number(pasted) || 0 }));
  });
  router.put("/built", requireAuth, (req, res) => {
    const { step, url, kind } = req.body || {};
    if (typeof step !== "string" || typeof url !== "string") return res.status(400).json({ ok: false, error: "step and url (strings) are required" });
    send(res, saveBuild(db, req.user.id, step, { url, kind: kind || "repository" }));
  });
  router.get("/progress", requireAuth, (req, res) => res.json({ marks: readProgress(db, req.user.id) }));
  router.put("/progress", requireAuth, (_req, res) => res.status(410).json(TICKS_GONE));
  router.post("/progress/import", requireAuth, (_req, res) => res.status(410).json(TICKS_GONE));
  return router;
}
