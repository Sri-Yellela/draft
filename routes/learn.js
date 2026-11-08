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
import { learnContent, servedLearnContent } from "../services/learn/learnContent.js";
import { readProgress } from "../services/learn/learnProgress.js";
import { circleOf } from "../services/learn/learnCircle.js";
import { readEarned, recordOpened, saveExplanation, saveBuild } from "../services/learn/learnEarned.js";
import { mapRouteFor } from "../services/learn/learnMapRoute.js";
import { courseOf, COURSE_ID, patternCourseOf, PATTERN_COURSE_ID } from "../services/learn/learnCourse.js";
import { guides, deckOf } from "../services/learn/learnDecks.js";
import { questions, recordAnswer } from "../services/learn/learnQuestions.js";
import { loadRegistry } from "../services/atlas/sourceRegistry.js";

export const LEARN_CACHE = "public, max-age=60";
export const TICKS_GONE = Object.freeze({ error: "earned_not_ticked",
  message: "Progress is earned now: open an item from draft, explain a checkpoint in your own words, link what you built. Nothing is marked done by hand." });

export function createLearnRouter(db, { requireAuth }) {
  const router = Router();
  const send = (res, r) => res.status(r.ok ? 200 : r.status || 400).json(r);
  router.get("/", (_req, res) => {
    const { source, copy, PARTS, ATLAS, INDEX } = servedLearnContent(db);   // D178-2: real links, not searches
    res.set("Cache-Control", LEARN_CACHE);
    res.json({ source, copy, PARTS, ATLAS, INDEX });
  });
  // ⭐ D172 (2) · the path as a COURSE: modules (parts) → lessons (steps), each lesson's links with their type and their
  // source from the register (D176-3) and its check. Public, like the tracker; progress is the reader's own /earned.
  router.get("/course/:id", (req, res) => {
    // ⭐ D178: the pattern atlas is its own course (no register sources — its links are LeetCode's own problem pages).
    if (req.params.id === PATTERN_COURSE_ID) { res.set("Cache-Control", LEARN_CACHE); return res.json(patternCourseOf(servedLearnContent(db))); }
    if (req.params.id !== COURSE_ID) return res.status(404).json({ error: "no_such_course" });
    let reg = { sources: [] };
    try { reg = loadRegistry(); } catch { /* an unreadable register leaves every source unnamed, never a 500 */ }
    res.set("Cache-Control", LEARN_CACHE);
    res.json(courseOf(servedLearnContent(db), reg));
  });
  // ⭐ D172 (2b) · the Library's ladder of guides (approved decks only; a level with none is "not written yet") and one deck.
  // Public, like the tracker: the decks' own words; a check question is served without its answer.
  router.get("/guides", (_req, res) => { res.set("Cache-Control", LEARN_CACHE); res.json({ guides: guides() }); });
  router.get("/deck/:id", (req, res) => {
    const d = deckOf(db, String(req.params.id).slice(0, 40));
    if (!d) return res.status(404).json({ error: "no_such_deck" });
    res.set("Cache-Control", LEARN_CACHE);
    res.json(d);
  });
  // A deck's check: the answer is recorded (anonymously when signed out) and the bank's "why" comes back. No points —
  // points come from an explanation in your own words, a build, or a passed quick check (services/atlas/points.js).
  router.post("/deck/:id/answer", (req, res) => {
    const d = deckOf(db, String(req.params.id).slice(0, 40));
    const q = d?.check?.question;
    if (!q) return res.status(404).json({ error: "no_question" });
    try {
      const r = recordAnswer(db, { questionId: q.id, userId: req.user?.id ?? null, surface: "deck", chosen: req.body?.chosen });
      const full = questions(db, { ids: [q.id] })[0];
      res.json({ correct: r.correct, answer: full?.correct ?? null, why: full?.why ?? null });
    } catch (e) { res.status(e.status || 400).json({ error: e.code || "answer_failed", message: e.message }); }
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
