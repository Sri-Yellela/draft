// routes/jobData.js — A62: JOB DATA IN AND OUT, AT WILL (admin-gated).
//
// routes/enrichment.js moves ENRICHMENT in and out (its import only fills columns on rows that
// already exist). This moves the JOBS themselves: export the board as NDJSON, and import postings
// from an outside filler or any other source — ⛔ through the ONE gateway (services/jobs/jobGateway.js:
// the same deduper, canonical write and US-only gate every crawled source uses), never a second
// writer.
//
// ⛔ THE SAME THREE RULES AS EVERY OTHER WRITING ADMIN ROUTE:
//   dry by default    POST /import plans every row and stops unless apply === true;
//   revertible        an applied import is a batch; reverting it RETIRES the rows it inserted
//                     (is_active = 0, retired_reason 'import_reverted') — soft, never deleted, and
//                     only after a dry run whose count matches (409 otherwise, A58's pattern);
//   says what it cannot undo  a row that ATTACHED to an existing posting donated its blank-filling
//                     fields to that row, and a revert does not take them back.
import { actorOf, actorUserId, actorRef } from "../services/actor.js";
import express, { Router } from "express";
import crypto from "node:crypto";
import { ingestJob, previewIngest } from "../services/jobs/jobGateway.js";
import { SOURCE_LABELS } from "../services/jobs/aggregator.js";
import { detectKnownAtsMatch } from "../services/jobs/importJob.js";

const EXPORT_COLUMNS = [
  "job_id", "title", "company", "location", "url", "apply_url", "source", "description", "posted_at",
  "employment_type", "workplace_type", "salary_min", "salary_max", "salary_currency", "is_active",
];
const MAX_IMPORT_ROWS = 2000;
const MAX_TEXT = { title: 300, company: 200, location: 300, url: 2000, description: 60000 };

/** One NDJSON line -> a gateway job, or { error }. */
export function jobFromLine(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return { error: "not a JSON object" };
  const str = (v, n) => (v == null ? null : String(v).trim().slice(0, n) || null);
  const title = str(obj.title, MAX_TEXT.title);
  const company = str(obj.company, MAX_TEXT.company);
  const url = str(obj.url || obj.apply_url, MAX_TEXT.url);
  if (!title) return { error: "title is required" };
  if (!company) return { error: "company is required" };
  if (!url || !/^https?:\/\//i.test(url)) return { error: "url must be an http(s) address" };
  const source = obj.source ? String(obj.source) : "import";
  if (!(source in SOURCE_LABELS)) return { error: `unknown source "${source}" — one of ${Object.keys(SOURCE_LABELS).join(", ")}` };
  const id = str(obj.job_id, 200) || `import:${crypto.createHash("sha1").update(url).digest("hex").slice(0, 16)}`;
  const num = (v) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
  return {
    job: {
      id, title, company, url, source,
      apply_url: str(obj.apply_url, MAX_TEXT.url),
      location: str(obj.location, MAX_TEXT.location) || "",
      description: str(obj.description, MAX_TEXT.description),
      posted_at: obj.posted_at ?? null,
      employment_type: str(obj.employment_type, 40),
      workplace_type: str(obj.workplace_type, 40),
      salary_min: num(obj.salary_min), salary_max: num(obj.salary_max),
      salary_currency: str(obj.salary_currency, 8),
    },
  };
}

function parseNdjson(text) {
  const lines = String(text || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  return lines.map((l, i) => {
    try { return { line: i + 1, obj: JSON.parse(l) }; }
    catch { return { line: i + 1, error: "not valid JSON" }; }
  });
}

export function createJobDataRouter(db, requireAdmin) {
  const router = Router();
  router.use(requireAdmin);

  // ── GET /export — the board as NDJSON ─────────────────────────────────────────────────────────
  router.get("/export", (req, res) => {
    const activeOnly = req.query.activeOnly !== "0";
    const source = req.query.source ? String(req.query.source) : null;
    const limit = Math.min(Math.max(Number(req.query.limit) || 5000, 1), 50000);
    const rows = db.prepare(`
      SELECT ${EXPORT_COLUMNS.join(", ")} FROM scraped_jobs
      WHERE duplicate_of IS NULL ${activeOnly ? "AND is_active = 1" : ""} ${source ? "AND source = ?" : ""}
      ORDER BY job_id LIMIT ${limit}
    `).all(...(source ? [source] : []));
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="draft-jobs-${new Date().toISOString().slice(0, 10)}.ndjson"`);
    res.send(rows.map(r => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : ""));
  });

  // ── POST /import — dry by default ─────────────────────────────────────────────────────────────
  router.post("/import", express.text({ type: ["application/x-ndjson", "text/plain"], limit: "32mb" }), (req, res) => {
    const text = typeof req.body === "string" ? req.body : req.body?.jsonl;
    const apply = req.body?.apply === true || req.query.apply === "1";
    const parsed = parseNdjson(text);
    if (!parsed.length) return res.status(400).json({ error: "empty", message: "Paste or upload NDJSON — one job per line." });
    if (parsed.length > MAX_IMPORT_ROWS)
      return res.status(413).json({ error: "too_many_rows", message: `At most ${MAX_IMPORT_ROWS} rows per import; split the file.` });

    const refused = [];
    const valid = [];
    for (const p of parsed) {
      if (p.error) { refused.push({ line: p.line, reason: p.error }); continue; }
      const r = jobFromLine(p.obj);
      if (r.error) refused.push({ line: p.line, reason: r.error });
      else valid.push({ line: p.line, job: r.job });
    }
    const plan = { insert: 0, replace: 0, attach: 0, outOfMarket: 0 };
    const rows = valid.map(v => {
      const d = previewIngest(db, v.job);
      plan[d.action]++;
      if (d.outOfMarket) plan.outOfMarket++;
      return { line: v.line, jobId: v.job.id, title: v.job.title, company: v.job.company, ...d };
    });
    const base = { rows: parsed.length, valid: valid.length, refused, plan, sample: rows.slice(0, 50),
      cannotUndo: "A row that attaches to a posting already on the board fills that posting's blank fields; reverting the batch does not take them back." };
    if (!apply) {
      return res.json({ ...base, dryRun: true, applied: false,
        note: "Nothing was written. POST again with apply: true to import the valid rows." });
    }
    if (!valid.length) return res.status(400).json({ ...base, applied: false, error: "no_valid_rows" });

    const out = db.transaction(() => {
      const batchId = db.prepare("INSERT INTO job_import_batches (admin_user_id, actor, rows_in, refused, notes) VALUES (?, ?, ?, ?, ?)")
        .run(actorUserId(req), actorRef(req), parsed.length, refused.length, `by ${actorOf(req).label}`).lastInsertRowid;
      let inserted = 0, attached = 0, held = 0;
      for (const v of valid) {
        const r = ingestJob(db, { job: v.job, origin: "admin_import", batchId, searchQuery: "admin_import",
          matchedBy: "admin_import", detectKnownAtsMatch });
        if (r.action === "inserted") inserted++; else attached++;
        if (r.outOfMarket) held++;
      }
      db.prepare("UPDATE job_import_batches SET inserted=?, attached=?, held_out_of_market=? WHERE id=?")
        .run(inserted, attached, held, batchId);
      return { batchId, inserted, attached, held };
    })();
    res.json({ ...base, dryRun: false, applied: true, ...out,
      note: "Imported rows are not enriched yet — run enrichment from Operations to fill their skills and summary." });
  });

  router.get("/import/batches", (_req, res) => {
    res.json({ batches: db.prepare("SELECT * FROM job_import_batches ORDER BY id DESC LIMIT 50").all() });
  });

  // ── POST /import/batches/:id/revert — dry first; the count must match ─────────────────────────
  router.post("/import/batches/:id/revert", (req, res) => {
    const id = Number(req.params.id);
    const batch = db.prepare("SELECT * FROM job_import_batches WHERE id = ?").get(id);
    if (!batch) return res.status(404).json({ error: "not_found" });
    if (batch.reverted_at) return res.status(409).json({ error: "already_reverted", revertedAt: batch.reverted_at });
    const targets = db.prepare(`
      SELECT DISTINCT c.job_id FROM job_captures c JOIN scraped_jobs sj ON sj.job_id = c.job_id
      WHERE c.batch_id = ? AND c.action = 'inserted' AND sj.is_active = 1
    `).pluck().all(id);
    const expect = req.body?.expectRows;
    if (expect == null || Number(expect) !== targets.length) {
      return res.status(expect == null ? 200 : 409).json({
        dryRun: true, batchId: id, wouldRetire: targets.length,
        note: `Retires the ${targets.length} posting(s) this batch inserted (soft — is_active = 0, reason import_reverted). ` +
          "Rows it attached to existing postings are untouched, and the fields they donated stay. " +
          "POST again with expectRows equal to this count to revert.",
      });
    }
    const now = Math.floor(Date.now() / 1000);
    db.transaction(() => {
      const retire = db.prepare(`UPDATE scraped_jobs SET is_active = 0, retired_reason = 'import_reverted', retired_at = ?
                                 WHERE job_id = ? AND is_active = 1`);
      for (const j of targets) retire.run(now, j);
      db.prepare("UPDATE job_import_batches SET reverted_at = ?, reverted_rows = ? WHERE id = ?").run(now, targets.length, id);
    })();
    res.json({ reverted: true, batchId: id, retired: targets.length });
  });

  return router;
}
