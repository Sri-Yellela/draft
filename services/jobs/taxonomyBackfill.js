// services/jobs/taxonomyBackfill.js — ⭐ D179 P2 (45l) · EVERY ACTIVE POSTING CLASSIFIED TO CATEGORY → SUBCATEGORY.
//
// The classifier is services/jobs/taxonomyClassify.js (pure, over the approved taxonomy). This stores its answer per
// posting in job_taxonomy (its own small table — an UPDATE on scraped_jobs rewrites the whole posting row, A132), with
// the taxonomy version it was read at: a new taxonomy version re-reads every posting, an unchanged one never re-reads.
// The walk is D153 (3)'s shape: rowid pages that start small and adapt to the read's time, chunked writes, a yield
// between. Admin reads taxonomyStats(): counts per category and subcategory, the *general* share per category (the
// owner's target: small), and the unclassified share.
import { classifyPosting, taxonomy } from "./taxonomyClassify.js";
import { nextRowidRange } from "./rowidWalk.js";

export const PAGE_ROWS = 200, MIN_PAGE_ROWS = 25, READ_BUDGET_MS = 200, WRITE_CHUNK = 100;

const PAGE_SQL = `
  SELECT sj.job_id, sj.title, substr(COALESCE(sj.description_text, sj.description, ''), 1, 6000) AS description, sj.board_category
    FROM scraped_jobs sj
    LEFT JOIN job_taxonomy jt ON jt.job_id = sj.job_id
   WHERE sj.is_active = 1 AND sj.rowid > ? AND sj.rowid <= ?
     AND (jt.job_id IS NULL OR jt.version IS NOT ?)`;

export function writeTaxonomy(db, rows, tax, c = { classified: 0, specific: 0, general: 0, unclassified: 0 }) {
  const put = db.prepare(`INSERT INTO job_taxonomy (job_id, category, subcategory, confidence, reason, version, classified_at)
    VALUES (?, ?, ?, ?, ?, ?, unixepoch())
    ON CONFLICT(job_id) DO UPDATE SET category = excluded.category, subcategory = excluded.subcategory, confidence = excluded.confidence,
      reason = excluded.reason, version = excluded.version, classified_at = excluded.classified_at`);
  db.transaction(() => {
    for (const r of rows) {
      const v = classifyPosting({ title: r.title, description: r.description, boardCategory: r.board_category }, tax);
      put.run(r.job_id, v.category, v.subcategory, v.confidence, String(v.reason || "").slice(0, 200), v.version);
      c.classified++;
      if (!v.category) c.unclassified++; else if (/\.general$/.test(v.subcategory || "")) c.general++; else c.specific++;
    }
  })();
  return c;
}

/** Admin: counts per category / subcategory over the ACTIVE board, the general share, the unclassified share. */
export function taxonomyStats(db) {
  const rows = db.prepare(`SELECT jt.category, jt.subcategory, COUNT(*) AS n FROM job_taxonomy jt
      JOIN scraped_jobs sj ON sj.job_id = jt.job_id AND sj.is_active = 1 GROUP BY jt.category, jt.subcategory`).all();
  const total = rows.reduce((s, r) => s + r.n, 0);
  const cats = new Map();
  for (const r of rows) {
    const k = r.category || "(unclassified)";
    const c = cats.get(k) || { category: k, postings: 0, general: 0, subcategories: {} };
    c.postings += r.n;
    if (/\.general$/.test(r.subcategory || "")) c.general += r.n;
    if (r.subcategory) c.subcategories[r.subcategory] = r.n;
    cats.set(k, c);
  }
  const list = [...cats.values()].map(c => ({ ...c, generalShare: c.postings ? Math.round(1000 * c.general / c.postings) / 10 : null }))
    .sort((a, b) => b.postings - a.postings);
  const unclassified = cats.get("(unclassified)")?.postings || 0;
  let version = null; try { version = taxonomy().version; } catch { version = null; }
  return { version, total, unclassifiedShare: total ? Math.round(1000 * unclassified / total) / 10 : null,
    generalShare: total ? Math.round(1000 * list.reduce((s, c) => s + c.general, 0) / total) / 10 : null, categories: list };
}

export function createTaxonomyBackfill(db, { pageRows = PAGE_ROWS, writeChunk = WRITE_CHUNK, schedule = (fn) => setImmediate(fn), log = console } = {}) {
  let status = { state: "idle", runs: 0, pages: 0, classified: 0, specific: 0, general: 0, unclassified: 0, version: null,
    startedAt: null, finishedAt: null, error: null, maxReadMs: 0, maxWriteMs: 0, pageRows };
  let running = null;
  function run(trigger = "manual") {
    if (running) return running;
    let tax;
    try { tax = taxonomy(); } catch (e) { status = { ...status, state: "skipped", error: e.message }; return Promise.resolve(self.status()); }
    status = { ...status, state: "running", trigger, runs: status.runs + 1, pages: 0, classified: 0, specific: 0, general: 0, unclassified: 0,
      version: tax.version, startedAt: new Date().toISOString(), finishedAt: null, error: null, maxReadMs: 0, maxWriteMs: 0 };
    running = new Promise((resolve) => {
      const page = db.prepare(PAGE_SQL);
      let from = 0, rows = Math.min(pageRows, MIN_PAGE_ROWS);
      const finish = (error) => {
        status = { ...status, state: error ? "failed" : "done", finishedAt: new Date().toISOString(), error: error ? error.message : null };
        running = null;
        if (error) log.error?.(`[taxonomy] backfill failed at rowid ${from} (the next run resumes):`, error.message);
        else if (status.classified) log.log?.(`[taxonomy] (${trigger}) v${tax.version}: ${status.classified} classified — ${status.specific} to a subcategory, ${status.general} at category level, ${status.unclassified} unclassified`);
        resolve(self.status());
      };
      const step = () => {
        try {
          const t0 = Date.now();
          const range = nextRowidRange(db, from, rows);
          const found = range.to > from ? page.all(range.from, range.to, tax.version) : [];
          const readMs = Date.now() - t0;
          if (readMs > READ_BUDGET_MS && rows > MIN_PAGE_ROWS) rows = Math.max(MIN_PAGE_ROWS, Math.floor(rows / 2));
          else if (readMs < READ_BUDGET_MS / 4 && rows < pageRows) rows = Math.min(pageRows, rows * 2);
          status = { ...status, pages: status.pages + 1, maxReadMs: Math.max(status.maxReadMs, readMs), pageRows: rows };
          const done = !range.more || range.to <= from;
          from = range.to;
          let i = 0;
          const chunk = () => {
            try {
              const tw = Date.now();
              const c = { classified: 0, specific: 0, general: 0, unclassified: 0 };
              const part = found.slice(i, i + writeChunk);
              if (part.length) writeTaxonomy(db, part, tax, c);
              i += part.length;
              status = { ...status, classified: status.classified + c.classified, specific: status.specific + c.specific,
                general: status.general + c.general, unclassified: status.unclassified + c.unclassified, maxWriteMs: Math.max(status.maxWriteMs, Date.now() - tw) };
              if (i < found.length) return schedule(chunk);
              if (done) return finish(null);
              schedule(step);
            } catch (e) { finish(e); }
          };
          chunk();
        } catch (e) { finish(e); }
      };
      schedule(step);
    });
    return running;
  }
  const self = { run, get running() { return !!running; }, status: () => ({ ...status }) };
  return self;
}
