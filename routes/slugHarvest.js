// routes/slugHarvest.js — D20: the slug harvest in the daily manual sweep (admin-gated).
//
// Every writing route is DRY BY DEFAULT and the apply names what its dry run showed:
//   POST /sweep              dry: the searches it would spend and the quota → confirm + expectQueries
//   POST /import             dry: the plan, every rejection named          → apply + expectWrites
//   POST /imports/:id/revert dry: before/after per pair                    → apply + expectRestorable
// A sweep is started by a person and runs in the background of that request; nothing schedules it.
import express, { Router } from "express";
import {
  planSweep, openSweep, runSweep, listSweeps, poolSummary, familyConversion, buildExport, toJsonl,
  planImport, summarizePlan, applyPlan, listImports, revertPreview, revertImport,
  serpSearch, serpAccount, DAILY_SEARCH_CAP,
} from "../services/slugHarvest.js";
import { validateBoard, ATS_FETCHERS } from "../services/companyList.js";
import { trancheGate } from "../services/diskGauge.js";

export const IMPORT_BODY_LIMIT = "2mb";

export function createSlugHarvestRouter(db, requireAdmin, {
  search = serpSearch, account = serpAccount, validate = validateBoard, fetchers = ATS_FETCHERS,
  configured = () => Boolean(process.env.SERPAPI_KEY),
  gate = (companies) => trancheGate(db, process.env.RM_DATA_DIR || "data", { companies }),
} = {}) {
  const router = Router();
  router.use(requireAdmin);

  router.get("/", (_req, res) => {
    try {
      res.json({ configured: configured(), cap: DAILY_SEARCH_CAP, plan: planSweep(db), sweeps: listSweeps(db, 10),
                 families: familyConversion(db), pool: poolSummary(db), imports: listImports(db, 10) });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get("/sweeps/:id", (req, res) => {
    const s = listSweeps(db, 1000).find(x => x.id === Number(req.params.id));
    if (!s) return res.status(404).json({ error: `no sweep ${req.params.id}` });
    res.json(s);
  });

  router.post("/sweep", express.json({ limit: "16kb" }), async (req, res) => {
    try {
      if (!configured()) return res.status(503).json({ error: "serpapi_not_configured", message: "SERPAPI_KEY is not set — no search can run." });
      const { queries = null, confirm = false, expectQueries = null } = req.body || {};
      const plan = planSweep(db, { queries });
      let quota = null, quotaError = null;
      try { quota = await account(); } catch (e) { quotaError = `the SerpApi account could not be read (${e?.response?.status ?? e?.code ?? "error"})`; }
      const names = plan.queries.map(q => q.q);
      if (!confirm) {
        return res.json({ dryRun: true, plan, quota, quotaError, expectQueries: names,
          note: names.length
            ? `Nothing was searched. POST again with confirm: true and expectQueries: the ${names.length} searches above. Each costs one of the month's free searches.`
            : "Nothing to search: today's cap is spent or every family has stopped converting." });
      }
      if (plan.running) return res.status(409).json({ error: "sweep_running", message: `Sweep ${plan.running.id} is still running.` });
      if (!names.length) return res.status(409).json({ error: "nothing_to_search", plan });
      if (JSON.stringify(expectQueries) !== JSON.stringify(names)) {
        return res.status(409).json({ error: "plan_changed", plan, expectQueries: names,
          message: "The searches this would spend are not the ones you saw. Run the dry run again." });
      }
      // ⛔ The quota is read BEFORE any search is spent, and an unreadable quota refuses: on a
      // 250-a-month plan, "probably fine" is how a month's searches go in an afternoon.
      if (quotaError) return res.status(503).json({ error: "quota_unknown", message: `${quotaError}; nothing was searched.` });
      if (quota.left != null && quota.left < names.length) {
        return res.status(409).json({ error: "quota_exhausted", quota, message: `${quota.left} search(es) left this month; this sweep needs ${names.length}.` });
      }
      const sweepId = openSweep(db, { queries: plan.queries, adminUserId: req.user?.id ?? null });
      runSweep(db, sweepId, { search, validate, fetchers }).catch(e => {
        try { db.prepare("UPDATE slug_harvest_sweeps SET error = ?, finished_at = unixepoch() WHERE id = ?").run(String(e?.message || e), sweepId); } catch { /* the row stays open; it goes stale after 15 minutes */ }
      });
      res.status(202).json({ started: true, sweepId, searches: names.length, poll: `GET /api/admin/slug-harvest/sweeps/${sweepId}` });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get("/export", (req, res) => {
    try {
      const payload = buildExport(db);
      if (req.query.format === "json") return res.json(payload);
      res.setHeader("Content-Type", "application/x-ndjson");
      res.setHeader("Content-Disposition", `attachment; filename="slug-harvest-${new Date().toISOString().slice(0, 10)}.jsonl"`);
      res.send(toJsonl(payload));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Body: the JSONL file as a raw application/x-ndjson body (flags in the query string), or JSON
  // { jsonl, apply, expectWrites }. One handler for both, as the enrichment import does.
  const importText = express.text({ type: ["application/x-ndjson", "application/jsonl", "text/plain"], limit: IMPORT_BODY_LIMIT });
  router.post("/import", importText, express.json({ limit: IMPORT_BODY_LIMIT }), async (req, res) => {
    try {
      const raw = typeof req.body === "string" ? req.body : null;
      const src = raw ? req.query : (req.body || {});
      const text = raw ?? (typeof src.jsonl === "string" ? src.jsonl : null);
      if (!text) return res.status(400).json({ error: "No file content. Send the JSONL as a raw application/x-ndjson body, or as body.jsonl." });
      const apply = src.apply === true || src.apply === "1" || src.apply === "true";
      const plan = await planImport(db, text, { validate, fetchers });
      const summary = summarizePlan(plan);
      if (!apply) {
        return res.json({ applied: false, dryRun: true, plan: summary,
          note: plan.valid
            ? (plan.expectWrites ? `Nothing was written. POST again with apply: true and expectWrites: ${plan.expectWrites}.` : "Nothing in this file changes anything.")
            : `${plan.rejected.length} row(s) rejected — the file is applied as a whole or not at all.` });
      }
      if (!plan.valid) {
        return res.status(422).json({ applied: false, plan: summary, written: 0,
          error: `${plan.rejected.length} row(s) rejected — the file is applied as a whole or not at all. NOTHING was written.` });
      }
      if (Number(src.expectWrites) !== plan.expectWrites) {
        return res.status(409).json({ applied: false, plan: summary,
          error: `Run the dry run first: expectWrites must equal the dry run's count (now ${plan.expectWrites}).` });
      }
      // ⛔ D77 → D74 P3: a file that adds companies is a TRANCHE — refused whole if the disk after it is above the gate.
      if (plan.wouldAdd > 0) {
        const disk = gate(plan.wouldAdd);
        if (!disk.ok) return res.status(507).json({ applied: false, plan: summary, written: 0, error: disk.message || disk.reason, disk });
      }
      const out = applyPlan(db, plan, { adminUserId: req.user?.id ?? null });
      if (!out.ok) return res.status(422).json({ applied: false, plan: summary, error: out.reason });
      res.json({ applied: true, importId: out.importId, written: out.written, companiesAdded: out.added, plan: summary,
        revert: out.importId ? `POST /api/admin/slug-harvest/imports/${out.importId}/revert` : null,
        note: out.added ? "Added companies are active; the next crawl reads them, through the same dedup and US-only gate as every source." : null });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post("/imports/:id/revert", express.json({ limit: "16kb" }), (req, res) => {
    try {
      const id = Number(req.params.id);
      const preview = revertPreview(db, id);
      if (!preview) return res.status(404).json({ error: `no import ${id}` });
      if (req.body?.apply !== true) {
        return res.json({ ...preview, applied: false, dryRun: true,
          note: "Would put each pair back to undecided and DISABLE (never delete) each company this import added. " +
                `POST again with apply: true and expectRestorable: ${preview.restorable}.` });
      }
      if (req.body?.expectRestorable !== preview.restorable) {
        return res.status(409).json({ applied: false, restorable: preview.restorable,
          error: `Run the dry run first: expectRestorable must equal the dry run's count (now ${preview.restorable}).` });
      }
      const out = revertImport(db, id, { adminUserId: req.user?.id ?? null });
      if (!out.ok) return res.status(409).json({ applied: false, error: out.reason });
      res.json({ applied: true, importId: id, restored: out.restored, companiesDisabled: out.disabled });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
}
