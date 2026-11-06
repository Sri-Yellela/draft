// routes/yourSkills.js — ⭐ D169 · YOUR SKILLS, in Atlas (services/yourSkills.js). Every read is the signed-in person's own.
//
//   GET    /api/your-skills                     → the List: { skills, counts, profileLine, proofKinds }
//   GET    /api/your-skills/map                 → the Map: { have, near, opens, gaps, target, held }
//   POST   /api/your-skills/skills              { name }  → lands as CLAIMED; unknown → held for the curator (never a node)
//   DELETE /api/your-skills/skills/:key         → off the list (and withdrawn where it was claimed on an ATS report)
//   GET    /api/your-skills/prove?skill=        → what proves it here: a quick check (questions exist), a build, a link
//   POST   /api/your-skills/checks              { skill, mode: timed | extended | untimed }  → the first question
//   POST   /api/your-skills/checks/:id/answer   { questionId, chosen }  → feedback; the last one → summary (passed → checked)
//   POST   /api/your-skills/proof               { skill, url, kind, label }  → D109's link → built
// Admin (mounted behind requireAdmin):
//   GET    /api/admin/your-skills/holds         → the skills people typed that the Atlas has no published node for
import { Router } from "express";
import { listYourSkills, yourSkillsMap, addSkill, removeSkill, proveOptions, startQuickCheck, answerQuickCheck, addSkillProof, curatorHolds }
  from "../services/yourSkills.js";

const send = (res, fn) => {
  res.set("Cache-Control", "private, no-store");
  try { res.json(fn()); }
  catch (e) { res.status(e.status || 500).json({ error: e.code || "your_skills_failed", message: e.message }); }
};

export function createYourSkillsRouter(db, { requireAuth }) {
  const router = Router();
  router.use(requireAuth);
  router.get("/", (req, res) => send(res, () => listYourSkills(db, req.user.id)));
  router.get("/map", (req, res) => send(res, () => yourSkillsMap(db, req.user.id)));
  router.post("/skills", (req, res) => send(res, () => addSkill(db, req.user.id, { name: req.body?.name })));
  router.delete("/skills/:key", (req, res) => send(res, () => removeSkill(db, req.user.id, { key: req.params.key })));
  router.get("/prove", (req, res) => send(res, () => proveOptions(db, req.user.id, { skill: String(req.query.skill ?? "").slice(0, 80) })));
  router.post("/checks", (req, res) => send(res, () => startQuickCheck(db, req.user.id, { skill: req.body?.skill, mode: req.body?.mode || "timed" })));
  router.post("/checks/:id/answer", (req, res) => send(res, () => answerQuickCheck(db, req.user.id, Number(req.params.id),
    { questionId: req.body?.questionId, chosen: req.body?.chosen })));
  router.post("/proof", (req, res) => send(res, () => addSkillProof(db, req.user.id,
    { skill: req.body?.skill, url: req.body?.url, kind: req.body?.kind, label: req.body?.label })));
  return router;
}

export function createYourSkillsAdminRouter(db) {
  const router = Router();
  router.get("/holds", (_req, res) => send(res, () => ({ holds: curatorHolds(db) })));
  return router;
}
