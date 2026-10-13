// routes/enrichment.js — U1/U2/U3/U4: the admin-gated enrichment control surface.
//
// WHAT THIS ADDS THAT DID NOT EXIST. Enrichment had three triggers — the 04:00 ET cron, a
// setImmediate after cacheJobs/cacheJoboFeed, and enrichJob.js's own row selection — and all three
// were automatic. There was NO manual path, which is how 837 of ~1252 active production rows
// accumulated unenriched during the Groq 404 outage with nothing anyone could do but wait for
// tomorrow. These routes are that path.
//
// ⛔ EVERY SPENDING OR WRITING ROUTE IS DRY BY DEFAULT. POST /run and POST /import both plan the
// work, report the row count and the cost ceiling, and stop unless the body carries `apply: true`.
// The plan is produced by the SAME functions the apply path calls, so what is reported and what is
// done cannot be different sets — the failure mode this codebase keeps rediscovering.
//
// ⭐ D17 (10-03): NOTHING HERE CALLS A MODEL ANY MORE. /run counts the backlog and refuses `apply`
// (410); enrichment is /export → outside the product → /import. The paragraphs below are history.
//
// ⛔ ADMIN-GATED, AND FOR TWO DIFFERENT REASONS. /run spends real money per row. /export returns the
// entire board's posting text in one response. Neither is a per-user resource and neither should be
// reachable by an ordinary session.
//
// The routes deliberately do NOT expose anything mapJobRow would have to change. Enrichment columns
// stay on scraped_jobs; provenance is a pointer. See migration 101's comment for the cost of the
// alternative.

import { actorOf } from "../services/actor.js";
import express, { Router } from "express";
import {
  selectCandidates, estimateCost, columnCoverage, diffCoverage,
  enrichSelectionOptions, DEFAULT_MAX_LAST_SEEN_DAYS, ENRICHMENT_COLUMNS,
} from "../services/jobs/enrichmentSelection.js";
import { buildExport, toJsonl, planImport, applyImport } from "../services/jobs/enrichmentTransfer.js";
import { listBatches, getBatch, revertBatch, revertPreview } from "../services/jobs/enrichmentBatches.js";
import { IMPORT_ROW_CAP } from "../shared/enrichmentRules.js";
import { excludeRetiring } from "../services/jobs/enrichmentScope.js";

// A single manual pass is bounded. The cron's own batch is 25; a manual trigger may ask for more,
// but not for "everything" in one request — an HTTP handler that runs for 837 sequential model
// calls will be killed by a proxy timeout partway through, and the operator would have no idea how
// far it got. Larger backlogs are cleared by repeated calls, each of which is recorded as its own
// batch and is individually revertible.
const MAX_MANUAL_ROWS = 100;
const DEFAULT_MANUAL_ROWS = 10;

// ── U5.10 — VOLUME, MEASURED RATHER THAN GUESSED ────────────────────────────────────────────────
//
// The owner intends to push the whole board through this path, so "does 790 rows fit in one
// request" is a number, not a judgement call. Measured against the real board (1266 active rows):
//
//   an exported row WITH its `source` block (title/company/description/…)  ~5.3 KB
//   an import-shaped row (job_id + content_hash + enrichment only)         ~1.2 KB
//
//   790 rows, source echoed back, wrapped as {"jsonl":"…"}   5.06 MB  ← EXCEEDS express.json's 4mb
//   790 rows, source stripped                                0.92 MB  ← fits comfortably
//   500 rows, source echoed back                             3.18 MB  ← fits, with little headroom
//
// So the honest answer to "does the whole board fit in one request": NOT as a JSON string in a
// JSON body, which is what a filler returning the export file unmodified would send. It fails with
// a 413 whose body is not JSON, so the UI would have shown an unexplained error at exactly the
// scale the owner cares about.
//
// Two fixes, both here. First, the raw NDJSON upload below: the file is the body, so the ~5% JSON
// string-escaping overhead disappears and the limit is this route's own rather than the global
// 4mb. Second, PRACTICAL_IMPORT_ROWS is reported by the export endpoint so the UI can chunk before
// the operator discovers the ceiling the hard way. Chunking is safe and is the intended shape:
// each chunk is its own batch and is independently revertible.
const IMPORT_BODY_LIMIT = "32mb";
// D84 F14: one constant, shared with the page and the CLI (shared/enrichmentRules.js) — 2,000 rows a batch.
const PRACTICAL_IMPORT_ROWS = IMPORT_ROW_CAP;

export function createEnrichmentRouter(db, requireAdmin, { anthropic = null } = {}) {
  const router = Router();
  router.use(requireAdmin);

  const readSelectionOptions = (src) => ({
    maxLastSeenDays: src.maxLastSeenDays != null
      ? Number(src.maxLastSeenDays)
      : enrichSelectionOptions().maxLastSeenDays,
    source: src.source ? String(src.source) : null,
    jobIds: Array.isArray(src.jobIds) && src.jobIds.length ? src.jobIds.map(String) : null,
  });

  // ── GET /candidates — the dry run, as a read ──────────────────────────────────────────────────
  //
  // Reports the pre-filter count AND the real candidate count separately. They differ by 250x on
  // the restored board, because a bulk `updated_at` touch moved 1247 rows whose text never changed;
  // a surface that showed only the union would quote ~$2.10 to send nothing.
  router.get("/candidates", (req, res) => {
    try {
      const opts = readSelectionOptions(req.query);
      const limit = req.query.limit != null ? Number(req.query.limit) : null;
      const sel = selectCandidates(db, opts);
      const considered = limit != null ? sel.candidates.slice(0, limit) : sel.candidates;
      res.json({
        prefilterCount: sel.prefilterCount,
        candidates: sel.totalMatched,
        gatedOut: sel.gatedOut,
        noDescription: sel.noDescription,
        freshnessGateDays: opts.maxLastSeenDays,
        wouldSend: considered.length,
        estimate: estimateCost(considered),
        estimateIsCeiling: true,
        coverage: columnCoverage(db),
        // Named so a caller can hand exactly this set to POST /run and get the priced work.
        jobIds: considered.map(r => r.job_id),
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── POST /run — the backlog, counted (D17, A80 V4 — 10-03) ────────────────────────────────────
  //
  // This was the manual MODEL trigger: plan, then `apply: true` sent the rows to a model. D17 allows
  // a model for résumé generation only, so the route now does the first half and refuses the
  // second. The plan — how many rows need enrichment, and the board's coverage now — is still the
  // useful question; the answer to "so enrich them" is the export → import round trip, which this
  // response names. ⛔ An `apply: true` is 410 and touches nothing, client or no client.
  router.post("/run", async (req, res) => {
    try {
      const body = req.body || {};
      const opts = readSelectionOptions(body);
      const requested = body.limit != null ? Number(body.limit) : DEFAULT_MANUAL_ROWS;
      if (!Number.isFinite(requested) || requested <= 0) {
        return res.status(400).json({ error: "limit must be a positive number" });
      }
      const limit = Math.min(requested, MAX_MANUAL_ROWS);

      const sel = selectCandidates(db, opts);
      const considered = sel.candidates.slice(0, limit);
      const plan = {
        prefilterCount: sel.prefilterCount,
        candidates: sel.totalMatched,
        gatedOut: sel.gatedOut,
        freshnessGateDays: opts.maxLastSeenDays,
        wouldSend: considered.length,
        limitApplied: limit,
        limitCappedAt: requested > MAX_MANUAL_ROWS ? MAX_MANUAL_ROWS : null,
        jobIds: considered.map(r => r.job_id),
        manualCap: MAX_MANUAL_ROWS,
        coverageNow: columnCoverage(db),
      };
      const roundTrip = "GET /api/admin/enrichment/export → enrich the file outside the product → " +
        "POST /api/admin/enrichment/import (dry run first; every import is a revertible batch).";

      if (body.apply === true) {
        return res.status(410).json({ applied: false, error: "enrichment_by_model_retired",
          message: "Enrichment no longer calls a model (D17: a model is for résumé generation only). " +
            "Nothing was sent and no row was touched. Use the round trip: " + roundTrip, plan });
      }
      res.json({ applied: false, dryRun: true, plan,
        note: "Nothing was sent and no model was called. To enrich these rows: " + roundTrip });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── GET /export — U2, JSONL ───────────────────────────────────────────────────────────────────
  //
  // JSONL rather than CSV because CSV loses skills_json's nested shape. Admin-gated because this is
  // the entire board's text.
  router.get("/export", (req, res) => {
    try {
      const opts = readSelectionOptions(req.query);
      const payload = buildExport(db, {
        ...opts,
        candidatesOnly: req.query.allRows !== "1",
        limit: req.query.limit != null ? Number(req.query.limit) : null,
      });
      if (req.query.format === "json") {
        return res.json({
          ...payload,
          meta: { ...payload.meta, practicalImportRows: PRACTICAL_IMPORT_ROWS,
                  importBodyLimit: IMPORT_BODY_LIMIT },
        });
      }
      res.setHeader("Content-Type", "application/x-ndjson");
      res.setHeader("Content-Disposition", `attachment; filename="enrichment-export.jsonl"`);
      res.send(toJsonl(payload));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── POST /import — U3 ─────────────────────────────────────────────────────────────────────────
  //
  // Body: { jsonl: "<text>", apply?: bool, overwrite?: bool, allowStale?: bool }
  // Dry by default; a malformed file is refused AS A WHOLE and names the offending rows.
  // Two body shapes, ONE handler — so the upload path cannot drift from the JSON path. A raw
  // `application/x-ndjson` (or text/plain) body is the file itself, with options as query
  // parameters; anything else is parsed as JSON and read from `body.jsonl`. express.text() only
  // claims the raw content types, so the global express.json() still handles the JSON shape.
  const importText = express.text({
    type: ["application/x-ndjson", "application/jsonl", "text/plain"], limit: IMPORT_BODY_LIMIT,
  });

  router.post("/import", importText, (req, res) => {
    try {
      const raw = typeof req.body === "string" ? req.body : null;
      const body = raw ? {} : (req.body || {});
      // For a raw upload the flags ride in the query string. `apply` stays explicit and defaults
      // to false in both shapes: the dry run is the default no matter how the file arrived.
      const src = raw ? req.query : body;
      const truthy = v => v === true || v === "1" || v === "true";
      const text = raw ?? (typeof body.jsonl === "string" ? body.jsonl : null);
      if (!text) {
        return res.status(400).json({
          error: "No file content. Send the JSONL as a raw application/x-ndjson body, or as " +
                 "body.jsonl in a JSON request.",
        });
      }
      const options = { overwrite: truthy(src.overwrite), allowStale: truthy(src.allowStale) };
      const apply = truthy(src.apply);

      const plan = planImport(db, text, options);
      const planSummary = {
        rowsInFile: plan.rowsInFile, matched: plan.matched, wouldWrite: plan.wouldWrite,
        unchanged: plan.unchanged, perColumn: plan.perColumn, valid: plan.valid,
        // D84 F5: per column — already filled · supplied · would be written · replacing a crawler placeholder.
        columns: plan.columns,
        // D84 F6: skills renamed to their canonical form, and the terms the vocabulary does not hold.
        skillsAliased: plan.skillsAliased, unknownSkills: plan.unknownSkills,
        rejected: plan.rejected,
        skippedNonNull: plan.planned
          .filter(p => p.skippedNonNull.length)
          .map(p => ({ jobId: p.jobId, columns: p.skippedNonNull })),
        mode: options.overwrite ? "overwrite non-null values" : "fill NULLs only",
        allowStale: options.allowStale,
      };

      // ⛔ U5.9 — COVERAGE, NOT ROW COUNTS. "imported: 790" is compatible with 790 rows of nulls;
      // the enrichment trigger learned this when a model returned HTTP 200 and a null extraction
      // 49 times in 50. The denominator is the rows in this FILE that matched a posting, so the
      // rate answers "of what I sent, how much is now filled" rather than diluting the delta
      // across a 1266-row board where it would round to nothing.
      const matchedIds = plan.planned.map(p => p.jobId);
      const before = matchedIds.length ? columnCoverage(db, { jobIds: matchedIds }) : null;

      if (!apply) {
        // The dry run PROJECTS the after-state rather than leaving the operator to add up
        // perColumn by hand: before + the planned writes, which is exactly what apply will do.
        // Reported in the same shape as the applied run so the two can be compared directly.
        let projected = null;
        if (before) {
          const cols = {};
          for (const [c, v] of Object.entries(before.columns)) {
            const gain = c === "enriched_at" ? plan.wouldWrite : (plan.perColumn[c] || 0);
            const filled = Math.min(before.total, v.filled + gain);
            cols[c] = { filled, total: before.total,
                        rate: before.total ? Number((filled / before.total).toFixed(4)) : 0 };
          }
          projected = diffCoverage(before, { total: before.total, columns: cols });
        }
        return res.json({
          applied: false, dryRun: true, plan: planSummary,
          coverage: projected?.rows ?? [],
          columnsWouldClimb: projected?.climbed ?? 0,
          warning: plan.wouldWrite > 0 && (projected?.climbed ?? 0) === 0
            ? "This file would stamp rows as enriched but NO COLUMN WOULD GAIN A VALUE. Applying " +
              "it buys nothing and takes the rows out of the candidate set — check the file first."
            : null,
          note: "Nothing was written. POST again with apply: true to apply.",
        });
      }
      if (!plan.valid) {
        // U3.2 — never partially apply. 422 rather than 400: the request is well-formed, the
        // PAYLOAD is not, and the distinction matters to whoever is fixing the file.
        return res.status(422).json({
          applied: false, plan: planSummary, written: 0,
          error: `${plan.rejected.length} row(s) rejected — the file is applied as a whole or not ` +
                 `at all. NOTHING was written.`,
        });
      }

      const result = applyImport(db, text, {
        ...options,
        notes: `POST /api/admin/enrichment/import by ${actorOf(req).ref}`,
      });
      if (!result.ok) return res.status(422).json({ applied: false, plan: planSummary, error: result.reason });
      // Measured over the SAME row set the dry run projected — every row in the file that matched a
      // posting, not just the ones written. A denominator that changes between the projection and
      // the result would make the two incomparable, which is the whole point of reporting both.
      const coverage = matchedIds.length
        ? diffCoverage(before, columnCoverage(db, { jobIds: matchedIds })) : null;

      res.json({
        applied: true, plan: planSummary, written: result.written, batchId: result.batchId ?? null,
        coverage: coverage?.rows ?? [],
        columnsClimbed: coverage?.climbed ?? 0,
        columnsRegressed: coverage?.regressed ?? 0,
        coverageClimbed: (coverage?.climbed ?? 0) > 0,
        // ⛔ FLAG columnsClimbed: 0 LOUDLY. A row stamped enriched_at with nothing filled is out of
        // the candidate set for good — the poisoning that cost 120 rows once. `written > 0` with no
        // column climbing is that shape arriving from outside, where there is no code to inspect
        // afterwards, only a file somebody sent.
        warning: result.written > 0 && (coverage?.climbed ?? 0) === 0
          ? `${result.written} row(s) were written and stamped enriched but NO COLUMN GAINED A ` +
            `VALUE. Revert batch ${result.batchId ?? "(none — provenance unavailable)"} and check ` +
            `the file before importing more.`
          : null,
        revert: result.batchId != null
          ? `POST /api/admin/enrichment/batches/${result.batchId}/revert`
          : null,
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── U4 — provenance ──────────────────────────────────────────────────────────────────────────
  router.get("/batches", (req, res) => {
    try {
      const limit = req.query.limit != null ? Number(req.query.limit) : 20;
      // ?source=import&kind=enrichment — the Admin page's Past imports (D83: a grade import is source
      // 'import' too, so the kind is what separates them); unfiltered keeps the old shape.
      const source = req.query.source ? String(req.query.source) : null;
      const kind = req.query.kind ? String(req.query.kind) : null;
      res.json({ batches: listBatches(db, { limit, source, kind }) });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get("/batches/:id", (req, res) => {
    try {
      const batch = getBatch(db, Number(req.params.id));
      if (!batch) return res.status(404).json({ error: `no batch ${req.params.id}` });
      // Per-column tallies rather than the raw row list, which for a 100-row batch is noise.
      const filled = {}, corrected = {};
      for (const r of batch.rows) {
        for (const c of r.filled) filled[c] = (filled[c] || 0) + 1;
        for (const c of r.corrected) corrected[c] = (corrected[c] || 0) + 1;
      }
      res.json({ ...batch, columnsFilled: filled, columnsCorrected: corrected });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Revert is a POST and is dry by default, like the other two writing routes.
  router.post("/batches/:id/revert", (req, res) => {
    try {
      const id = Number(req.params.id);
      const batch = getBatch(db, id);
      if (!batch) return res.status(404).json({ error: `no batch ${id}` });
      // A58 (d): the dry run says what WILL be restored — how many rows, which, and how many were
      // re-enriched or re-imported since (a revert clobbers those back to the pre-batch state).
      const preview = revertPreview(db, id);
      if (req.body?.apply !== true) {
        return res.json({
          ...preview,
          applied: false, dryRun: true, batchId: id, recordedRows: batch.rows.length,
          alreadyReverted: Boolean(batch.reverted_at),
          note: "Would restore each row to its recorded prior state, including enriched_at and " +
                "content_hash — which returns the rows to the candidate set. Values that came from " +
                "INGESTION are preserved, because the revert replays a per-row before-image rather " +
                "than nulling the enrichment columns. Rows counted in changedSince were rewritten after " +
                "this batch and lose that later change. POST again with apply: true and " +
                "expectRestorable: <restorable from this dry run>.",
        });
      }
      // The apply names the count its dry run showed, so it cannot run unseen or on a stale preview.
      if (req.body?.expectRestorable !== preview.restorable) {
        return res.status(409).json({
          applied: false, error: "Run the dry run first: expectRestorable must equal the dry run's restorable " +
            `count (now ${preview.restorable}).`, restorable: preview.restorable,
        });
      }
      const result = revertBatch(db, id);
      if (!result.ok) return res.status(409).json({ applied: false, error: result.reason });
      res.json({ applied: true, batchId: id, restored: result.restored, missing: result.missing });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── GET /overview — everything the Admin Enrichment page shows on open, without a click (D83) ──
  //
  // Read-only. The four number boxes, the per-column coverage bars, the real source list for the
  // export's dropdown, and the importer's own limits — READ here, never copied into the client,
  // so the page cannot drift from the importer. Past imports come from GET /batches?source=import.
  router.get("/overview", (_req, res) => {
    try {
      const opts = enrichSelectionOptions();
      const sel = selectCandidates(db, opts);
      // D84 F8: the backlog leaves out what the enforced board policy will retire — the export does the same.
      const { keep: toEnrich, retiring } = excludeRetiring(db, sel.candidates);
      const coverage = columnCoverage(db);
      // The salary and eligibility bars are "any of the group", which per-column counts cannot give.
      const g = db.prepare(`SELECT COUNT(*) n,
          SUM(salary_min_usd IS NOT NULL OR salary_max_usd IS NOT NULL) salary,
          SUM(is_h1b_sponsor IS NOT NULL OR requires_work_auth IS NOT NULL OR is_clearance_required IS NOT NULL) flags
        FROM scraped_jobs WHERE is_active = 1`).get();
      const col = (c) => coverage.columns[c].filled;
      const groups = [
        { key: "skills", label: "Skills", columns: ["skills_json"], filled: col("skills_json") },
        { key: "level", label: "Experience level", columns: ["experience_level"], filled: col("experience_level") },
        { key: "workplace", label: "Workplace type", columns: ["workplace_type"], filled: col("workplace_type") },
        { key: "salary", label: "Salary", columns: ["salary_min_usd", "salary_max_usd"], filled: g.salary || 0 },
        { key: "flags", label: "Eligibility flags", columns: ["is_h1b_sponsor", "requires_work_auth", "is_clearance_required"], filled: g.flags || 0 },
        { key: "summary", label: "Summary", columns: ["summary"], filled: col("summary") },
      ].map(x => ({ ...x, total: coverage.total }));
      // "New postings with a fit score": active postings first seen in the last 7 days that carry a
      // score in the board's fit cache for at least one user. A posting without skills often scores
      // "not enough signal" (NULL) — which is what enrichment fixes.
      const since = Math.floor(Date.now() / 1000) - 7 * 86400;
      const fresh = db.prepare(`SELECT COUNT(*) n,
          SUM(EXISTS (SELECT 1 FROM ats_only_reports a WHERE a.job_id = j.job_id AND a.ats_score IS NOT NULL)) scored
        FROM scraped_jobs j WHERE j.is_active = 1 AND j.discovered_at >= ?`).get(since);
      const imports = db.prepare(`SELECT COUNT(*) n, COALESCE(SUM(rows_written), 0) written
        FROM enrichment_batches WHERE source = 'import' AND kind = 'enrichment' AND reverted_at IS NULL`).get();
      // D84 F1: rows filled from cut text (back in the backlog), and rows whose only text is still cut — held
      // out of every export until the next crawl stores their full text.
      const textState = db.prepare(`SELECT
          SUM(enrichment_partial = 1) partial,
          SUM(description_full IS NULL AND instr(description, '[…]') > 0) waiting
        FROM scraped_jobs WHERE is_active = 1`).get();
      const sources = db.prepare(`SELECT source, COUNT(*) n FROM scraped_jobs
        WHERE is_active = 1 AND source IS NOT NULL AND TRIM(source) != '' GROUP BY source ORDER BY n DESC`).all();
      res.json({
        backlog: toEnrich.length,
        retiringExcluded: retiring,
        freshnessGateDays: opts.maxLastSeenDays,
        noDescription: sel.noDescription,
        board: coverage.total,
        coverage, groups,
        newPostings: { days: 7, total: fresh.n || 0, scored: fresh.scored || 0 },
        imports: { count: imports.n, rowsWritten: imports.written },
        text: { partial: textState.partial || 0, waitingForFullText: textState.waiting || 0 },
        sources: sources.map(s => ({ value: s.source, count: s.n })),
        importRowCap: PRACTICAL_IMPORT_ROWS,
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── GET /coverage — the enrichment health signal, per column ──────────────────────────────────
  router.get("/coverage", (_req, res) => {
    try {
      res.json({
        coverage: columnCoverage(db),
        columns: ENRICHMENT_COLUMNS,
        freshnessGateDefaultDays: DEFAULT_MAX_LAST_SEEN_DAYS,
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
}
