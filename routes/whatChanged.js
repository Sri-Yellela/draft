// routes/whatChanged.js — ⭐ D108 P2 · "What changed": public read; the curator adds and removes lines (admin).
//   GET    /api/what-changed            → { items: [{ happenedOn, text, sourceUrl, sourceName }], notice }
//   POST   /api/admin/what-changed      { happenedOn, text, sourceUrl, sourceName }  — an official source only
//   DELETE /api/admin/what-changed/:id
import { Router } from "express";
import { addWhatChanged, listWhatChanged, removeWhatChanged } from "../services/kb/sponsorshipFacts.js";

export function createWhatChangedRouter(db) {
  const router = Router();
  router.get("/", (_req, res) => res.json(listWhatChanged(db)));
  return router;
}

export function createWhatChangedAdminRouter(db) {
  const router = Router();
  router.post("/", (req, res) => {
    const r = addWhatChanged(db, { ...(req.body || {}), addedBy: req.user?.username || req.admin?.email || "admin" });
    res.status(r.ok ? 201 : 400).json(r);
  });
  router.delete("/:id", (req, res) => {
    const ok = removeWhatChanged(db, req.params.id);
    res.status(ok ? 200 : 404).json({ ok });
  });
  return router;
}
