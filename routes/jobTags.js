// routes/jobTags.js — D29: the board's own tags, for the admin (mounted at /api/admin/job-tags).
//
//   GET  /                 coverage per tag over the active board — measured, never cached
//   GET  /export?tag=level the CSV of postings the tagger left NULL on that tag (or tag=any)
//   POST /import           { csv, apply }: DRY BY DEFAULT — the plan, every refused line named;
//                          `apply: true` writes it, all-or-nothing, and only when the plan is clean
//   POST /retag            re-derive every posting's tags now (owner tags survive)
//
// No model call anywhere on this surface (D17): the owner reads a posting and picks a value.
import express, { Router } from "express";
import { tagCoverage, tagStaleJobs } from "../services/jobs/jobTags.js";
import { buildTagExport, planTagImport, applyTagImport, EXPORT_COLUMNS } from "../services/jobs/jobTagTransfer.js";

export function createJobTagsRouter(db, requireAdmin) {
  const router = Router();
  router.use(requireAdmin);

  router.get("/", (_req, res) => {
    try { res.json({ coverage: tagCoverage(db), exportColumns: EXPORT_COLUMNS }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get("/export", (req, res) => {
    try {
      const { csv, rows } = buildTagExport(db, { tag: String(req.query.tag || "any"), limit: Number(req.query.limit) || 500 });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="job-tags-${req.query.tag || "any"}.csv"`);
      res.setHeader("X-Rows", String(rows));
      res.send(csv);
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  router.post("/import", express.json({ limit: "4mb" }), (req, res) => {
    try {
      const plan = planTagImport(db, String(req.body?.csv || ""));
      if (!req.body?.apply) return res.json({ dryRun: true, ...plan });
      if (!plan.ok) return res.status(422).json({ dryRun: false, applied: false, ...plan });
      const r = applyTagImport(db, plan, { by: req.user?.username || "admin" });
      res.json({ dryRun: false, applied: true, ...plan, ...r, coverage: tagCoverage(db) });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post("/retag", (_req, res) => {
    try { res.json({ ...tagStaleJobs(db, { all: true }), coverage: tagCoverage(db) }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
}
