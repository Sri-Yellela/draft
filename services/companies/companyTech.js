// services/companies/companyTech.js — ⭐ D179 P5a · TECHNOGRAPHICS FROM THE COMPANY'S OWN POSTINGS (45l, 11-08).
//
// D179 (5): "technographics that earn their place — evidence, never guesses". Source 1, the strongest and our own: the
// company's job postings. For each technology (shared/techVocabulary.js — technologies only, with aliases): how many of
// the company's postings name it, which teams (the postings' kind of work until P2's subcategories exist), first and
// last seen. A company page shows a technology only on ≥ 2 postings' evidence inside 180 days (SHOW_MIN_POSTINGS,
// FRESH_DAYS) — enforced by the reader, stackFor().
//
// TWO WALKS, both D153 (3)'s shape (rowid / id pages, small and adaptive, chunked writes, a yield between):
//   1. extractTech — each active posting's text read ONCE per content: its technologies into job_tech, the content
//      hash it was read at into job_tech_scan; a changed posting is re-read, an unchanged one never is.
//   2. aggregate — company_tech rebuilt from job_tech × job_company (D179 P4a's records) per range of company ids, a
//      GROUP BY over small rows — the descriptions are never read again for it.
// ⛔ The old company_technographics table (keyed by name, soft skills mixed in, no writer since A80 V4) is left as it
// is: services/kb's claim checks still read it. P4b moves those readers here and retires it, with the 31-company
// DOMAIN_TOOL_REGISTRY the scorer reads (D179 (5): "the duplicate tool registry is retired").
import { technologiesIn, TECH_GROUP_OF } from "../../shared/techVocabulary.js";
import { nextRowidRange } from "../jobs/rowidWalk.js";

export const SHOW_MIN_POSTINGS = 2;
export const FRESH_DAYS = 180;
export const PAGE_ROWS = 200;
export const MIN_PAGE_ROWS = 25;
export const READ_BUDGET_MS = 200;
export const WRITE_CHUNK = 50;
export const COMPANY_RANGE = 200;

const EXTRACT_SQL = `
  SELECT sj.job_id, sj.title, COALESCE(sj.description_text, sj.description) AS text, COALESCE(sj.content_hash, '') AS hash
    FROM scraped_jobs sj
    LEFT JOIN job_tech_scan s ON s.job_id = sj.job_id
   WHERE sj.is_active = 1 AND sj.rowid > ? AND sj.rowid <= ?
     AND (s.job_id IS NULL OR s.content_hash IS NOT COALESCE(sj.content_hash, ''))`;

// A posting's time in seconds (discovered_at may be seconds or milliseconds on old rows).
const SEC = (col) => `(CASE WHEN ${col} > 100000000000 THEN ${col} / 1000 ELSE ${col} END)`;
const AGG_SQL = `
  SELECT jc.company_id, jt.tech, COUNT(*) AS postings,
         MIN(${SEC("sj.discovered_at")}) AS first_seen,
         MAX(CASE WHEN sj.is_active = 1 THEN ? ELSE ${SEC("COALESCE(sj.retired_at, sj.discovered_at)")} END) AS last_seen,
         GROUP_CONCAT(DISTINCT sj.tag_function) AS teams
    FROM job_company jc
    JOIN job_tech jt ON jt.job_id = jc.job_id
    JOIN scraped_jobs sj ON sj.job_id = jc.job_id
   WHERE jc.company_id > ? AND jc.company_id <= ?
     AND (sj.is_active = 1 OR ${SEC("COALESCE(sj.retired_at, sj.discovered_at)")} >= ?)
   GROUP BY jc.company_id, jt.tech`;

const STMTS = new WeakMap();
function stmts(db) {
  let s = STMTS.get(db);
  if (!s) {
    s = {
      extract: db.prepare(EXTRACT_SQL),
      clearJob: db.prepare(`DELETE FROM job_tech WHERE job_id = ?`),
      putTech: db.prepare(`INSERT OR IGNORE INTO job_tech (job_id, tech) VALUES (?, ?)`),
      scanned: db.prepare(`INSERT INTO job_tech_scan (job_id, content_hash, scanned_at) VALUES (?, ?, unixepoch())
        ON CONFLICT(job_id) DO UPDATE SET content_hash = excluded.content_hash, scanned_at = excluded.scanned_at`),
      agg: db.prepare(AGG_SQL),
      clearRange: db.prepare(`DELETE FROM company_tech WHERE company_id > ? AND company_id <= ?`),
      putStack: db.prepare(`INSERT INTO company_tech (company_id, tech, grp, postings, first_seen, last_seen, teams_json, computed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch())`),
      maxCompany: db.prepare(`SELECT COALESCE(MAX(id), 0) FROM companies`).pluck(),
    };
    STMTS.set(db, s);
  }
  return s;
}

/** One posting's technologies (title + text), as stored. */
export function postingTech(row) { return technologiesIn(`${row.title || ""}\n${row.text || ""}`).map(t => t.name); }

/** Write the extraction for a chunk of postings (one transaction). */
export function writeExtraction(db, rows, c = { postings: 0, mentions: 0 }) {
  const s = stmts(db);
  db.transaction(() => {
    for (const r of rows) {
      const techs = postingTech(r);
      s.clearJob.run(r.job_id);
      for (const t of techs) s.putTech.run(r.job_id, t);
      s.scanned.run(r.job_id, r.hash || "");
      c.postings++; c.mentions += techs.length;
    }
  })();
  return c;
}

/** Rebuild company_tech for company ids (from, to]. */
export function aggregateRange(db, from, to, nowSec = Math.floor(Date.now() / 1000)) {
  return writeAggregate(db, from, to, readAggregate(db, from, to, nowSec));
}

/** ⛔ A159 (45r): the aggregate's READ half — the three-way join — which the offload worker runs (writes nothing). */
export function readAggregate(db, from, to, nowSec = Math.floor(Date.now() / 1000)) {
  return db.prepare(AGG_SQL).all(nowSec, from, to, nowSec - FRESH_DAYS * 86400);
}

/** ⛔ A159: the WRITE half — company_tech for ids (from, to] replaced from the read's rows, one short transaction. */
export function writeAggregate(db, from, to, rows) {
  const s = stmts(db);
  db.transaction(() => {
    s.clearRange.run(from, to);
    for (const r of rows) {
      const teams = String(r.teams || "").split(",").map(x => x.trim()).filter(Boolean);
      s.putStack.run(r.company_id, r.tech, TECH_GROUP_OF[r.tech] || "tools", r.postings, r.first_seen, r.last_seen, JSON.stringify(teams));
    }
  })();
  return rows.length;
}

/**
 * The company page's Tech stack: grouped, each item with its evidence — only technologies on ≥ SHOW_MIN_POSTINGS
 * postings seen inside FRESH_DAYS. `ofPostings` = the company's postings in the same window, for "in 14 of 22".
 */
export function stackFor(db, companyId, nowSec = Math.floor(Date.now() / 1000)) {
  const since = nowSec - FRESH_DAYS * 86400;
  const items = db.prepare(`SELECT tech, grp, postings, first_seen, last_seen, teams_json FROM company_tech
      WHERE company_id = ? AND postings >= ? AND last_seen >= ? ORDER BY postings DESC, tech`).all(companyId, SHOW_MIN_POSTINGS, since);
  const ofPostings = db.prepare(`SELECT COUNT(*) FROM job_company jc JOIN scraped_jobs sj ON sj.job_id = jc.job_id
      WHERE jc.company_id = ? AND (sj.is_active = 1 OR ${SEC("COALESCE(sj.retired_at, sj.discovered_at)")} >= ?)`).pluck().get(companyId, since);
  const groups = {};
  for (const x of items) {
    (groups[x.grp] ||= []).push({ tech: x.tech, postings: x.postings, of: ofPostings, firstSeen: x.first_seen, lastSeen: x.last_seen,
      teams: JSON.parse(x.teams_json || "[]"), newThisQuarter: x.first_seen != null && x.first_seen >= nowSec - 90 * 86400 });
  }
  return { companyId, ofPostings, groups };
}

/** The background job: extract, then aggregate. One run at a time; resolves with the status. */
/**
 * ⛔ A159 (45r): `offloadAgg({ from, to, nowSec })` runs readAggregate on the offload worker; only writeAggregate runs here.
 * When it rejects, that range is read here as before (the walk never stops).
 */
export function createCompanyTech(db, { pageRows = PAGE_ROWS, writeChunk = WRITE_CHUNK, schedule = (fn) => setImmediate(fn), log = console, offloadAgg = null } = {}) {
  let status = { state: "idle", runs: 0, phase: null, pages: 0, postings: 0, mentions: 0, companies: 0, stackRows: 0,
    startedAt: null, finishedAt: null, error: null, maxReadMs: 0, maxWriteMs: 0, pageRows };
  let running = null;

  function run(trigger = "manual") {
    if (running) return running;
    status = { ...status, state: "running", trigger, runs: status.runs + 1, phase: "extract", pages: 0, postings: 0, mentions: 0,
      companies: 0, stackRows: 0, startedAt: new Date().toISOString(), finishedAt: null, error: null, maxReadMs: 0, maxWriteMs: 0 };
    running = new Promise((resolve) => {
      const s = stmts(db);
      let from = 0, rows = Math.min(pageRows, MIN_PAGE_ROWS);
      const finish = (error) => {
        status = { ...status, state: error ? "failed" : "done", phase: null, finishedAt: new Date().toISOString(), error: error ? error.message : null };
        running = null;
        if (error) log.error?.(`[company-tech] ${status.phase || "walk"} failed (the next run resumes; nothing half-written):`, error.message);
        else log.log?.(`[company-tech] (${trigger}) read ${status.postings} postings (${status.mentions} technologies named); ${status.stackRows} stack rows over ${status.companies} company ranges`);
        resolve(self.status());
      };
      // ── 2 · aggregate, a range of company ids per slice ──
      let cFrom = 0, cMax = 0;
      const aggregate = () => {
        const to = cFrom + COMPANY_RANGE, nowSec = Math.floor(Date.now() / 1000);
        const read = offloadAgg
          ? offloadAgg({ from: cFrom, to, nowSec }).catch(() => readAggregate(db, cFrom, to, nowSec))
          : Promise.resolve().then(() => readAggregate(db, cFrom, to, nowSec));
        read.then((rows) => {
          const tw = Date.now();
          const n = writeAggregate(db, cFrom, to, rows);
          status = { ...status, companies: status.companies + 1, stackRows: status.stackRows + n, maxWriteMs: Math.max(status.maxWriteMs, Date.now() - tw) };
          cFrom = to;
          if (cFrom >= cMax) return finish(null);
          schedule(aggregate);
        }).catch((e) => finish(e));
      };
      // ── 1 · extract, rowid pages ──
      const step = () => {
        try {
          const t0 = Date.now();
          const range = nextRowidRange(db, from, rows);
          const found = range.to > from ? s.extract.all(range.from, range.to) : [];
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
              const c = { postings: 0, mentions: 0 };
              const part = found.slice(i, i + writeChunk);
              if (part.length) writeExtraction(db, part, c);
              i += part.length;
              status = { ...status, postings: status.postings + c.postings, mentions: status.mentions + c.mentions, maxWriteMs: Math.max(status.maxWriteMs, Date.now() - tw) };
              if (i < found.length) return schedule(chunk);
              if (done) {
                status = { ...status, phase: "aggregate" };
                cMax = s.maxCompany.get();
                return cMax > 0 ? schedule(aggregate) : finish(null);
              }
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

/**
 * ⭐ D179 (owner 11-07: the card gains "Works with" — the team's stack). The technologies each of these postings names
 * (job_tech, read once per content by the walk above): job_id → up to `max` names, languages and frameworks first.
 * One IN read for the jobs on screen; a posting the walk has not read yet has none (never guessed).
 */
const GROUP_RANK = { languages: 0, frameworks: 1, data: 2, cloud: 3, devops: 4, "ml-ai": 5, tools: 6 };
export function techForJobs(db, jobIds, { max = 6 } = {}) {
  const ids = [...new Set((jobIds || []).map(String).filter(Boolean))].slice(0, 200);
  const out = new Map();
  if (!ids.length) return out;
  let rows = [];
  try { rows = db.prepare(`SELECT job_id, tech FROM job_tech WHERE job_id IN (${ids.map(() => "?").join(",")})`).all(...ids); }
  catch { return out; }
  for (const r of rows) { if (!out.has(r.job_id)) out.set(r.job_id, []); out.get(r.job_id).push(r.tech); }
  for (const [k, list] of out) out.set(k, list.sort((a, b) => (GROUP_RANK[TECH_GROUP_OF[a]] ?? 9) - (GROUP_RANK[TECH_GROUP_OF[b]] ?? 9) || a.localeCompare(b)).slice(0, max));
  return out;
}
