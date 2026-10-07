#!/usr/bin/env node
// D74 P0 · WHERE THE JOBS COME FROM — the source map, freshness, the funnel, quiet companies, the
// shrink, the scoreability of new rows, and headroom. ⛔ READ-ONLY, counts only — no posting text.
//
//   node scripts/d74IngestionMeasure.mjs [--db <path>] [--json]
// Production: railway ssh -s draft -- "cd /app && node scripts/d74IngestionMeasure.mjs --json"
//
// Item 3's "100 discarded rows per source" cannot come from here: a `dropped` posting (classifyJob found
// no role) is counted in pipeline_runs and stored NOWHERE. scripts/d74DropSample.mjs re-fetches the
// configured boards and classifies them locally to sample those.
import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";
import Database from "better-sqlite3";

const argv = process.argv.slice(2);
const at = argv.indexOf("--db");
const dataDir = process.env.RM_DATA_DIR || path.join(process.cwd(), "data");
const dbPath = at >= 0 ? argv[at + 1] : path.join(dataDir, "resume_master.db");
const db = new Database(dbPath, { readonly: true, fileMustExist: true });
const now = Math.floor(Date.now() / 1000);
const DAY = 86400;
const all = (sql, ...a) => db.prepare(sql).all(...a);
const get = (sql, ...a) => db.prepare(sql).get(...a);
// posted_at is free text per source; SQLite reads ISO forms. NULL when unreadable.
const POSTED = "CAST(strftime('%s', sj.posted_at) AS INTEGER)";
const FIRST_SEEN = "COALESCE(sj.discovered_at, sj.scraped_at)";

// ── 1 · the source map ───────────────────────────────────────────────────────────────────────────
const companies = all(`SELECT ats_type, active, COUNT(*) n FROM company_ats_list GROUP BY 1, 2 ORDER BY 1, 2`);
const byCompany = all(`
  SELECT c.ats_type, c.ats_slug, c.company, c.active,
         SUM(sj.is_active = 1) AS active_rows,
         SUM(sj.is_active = 1 AND ${FIRST_SEEN} >= ${now - DAY}) AS new_24h,
         SUM(sj.is_active = 1 AND ${FIRST_SEEN} >= ${now - 7 * DAY}) AS new_7d,
         SUM(sj.is_active = 1 AND ${FIRST_SEEN} >= ${now - 30 * DAY}) AS new_30d,
         MAX(sj.updated_at) AS last_seen, MAX(${FIRST_SEEN}) AS last_new
    FROM company_ats_list c
    LEFT JOIN scraped_jobs sj ON sj.source = c.ats_type AND LOWER(sj.company) = LOWER(c.company)
   GROUP BY c.id ORDER BY active_rows DESC`);
const bySource = all(`
  SELECT sj.source, SUM(sj.is_active = 1) AS active, COUNT(*) AS total,
         SUM(sj.is_active = 1 AND ${FIRST_SEEN} >= ${now - DAY}) AS new_24h,
         SUM(sj.is_active = 1 AND ${FIRST_SEEN} >= ${now - 7 * DAY}) AS new_7d,
         SUM(sj.is_active = 1 AND ${FIRST_SEEN} >= ${now - 30 * DAY}) AS new_30d,
         COUNT(DISTINCT LOWER(sj.company)) AS companies
    FROM scraped_jobs sj GROUP BY 1 ORDER BY active DESC`);

// ── 2 · freshness ────────────────────────────────────────────────────────────────────────────────
const AGE_BUCKETS = [[1, "<1d"], [7, "1–7d"], [30, "7–30d"], [60, "30–60d"], [180, "60–180d"], [365, "180–365d"], [1e9, ">365d"]];
function ageDistribution(expr) {
  const rows = all(`SELECT (${now} - ${expr}) / ${DAY} AS d FROM scraped_jobs sj WHERE sj.is_active = 1`);
  const out = Object.fromEntries(AGE_BUCKETS.map(([, k]) => [k, 0])); out.unreadable = 0;
  for (const { d } of rows) {
    if (d == null) { out.unreadable++; continue; }
    out[AGE_BUCKETS.find(([lim]) => d < lim)[1]]++;
  }
  return out;
}
const newPerDay = all(`
  SELECT date(${FIRST_SEEN}, 'unixepoch') AS day, COUNT(*) AS first_seen, SUM(sj.is_active = 1) AS still_active
    FROM scraped_jobs sj WHERE ${FIRST_SEEN} >= ${now - 30 * DAY} GROUP BY 1 ORDER BY 1`);
const crawls = all(`
  SELECT source, status, datetime(started_at, 'unixepoch') AS started, duration_ms, fetched, written, unchanged, dropped, ejected,
         json_extract(details_json, '$.outOfMarket') AS out_of_market, json_extract(details_json, '$.pruned') AS pruned,
         json_extract(details_json, '$.companies') AS companies
    FROM pipeline_runs WHERE run_kind = 'source_sync' AND started_at >= ${now - 3 * DAY} ORDER BY started_at DESC`);
const runsPerDay = get(`SELECT COUNT(DISTINCT date(started_at, 'unixepoch')) AS days, COUNT(*) AS runs,
         MIN(time(started_at, 'unixepoch')) AS earliest, MAX(time(started_at, 'unixepoch')) AS latest
    FROM pipeline_runs WHERE run_kind = 'source_sync' AND source = 'greenhouse' AND started_at >= ${now - 30 * DAY}`);
const lags = all(`SELECT (${FIRST_SEEN} - ${POSTED}) / 3600.0 AS h FROM scraped_jobs sj
                   WHERE ${FIRST_SEEN} >= ${now - 30 * DAY} AND ${POSTED} IS NOT NULL`).map(r => r.h).filter(h => h >= 0).sort((a, b) => a - b);
const q = (xs, p) => (xs.length ? +xs[Math.floor(p * (xs.length - 1))].toFixed(1) : null);

// ── 3 · the funnel, per source, over the last 30 days of runs ────────────────────────────────────
const funnel = all(`
  SELECT source, COUNT(*) AS runs, SUM(fetched) AS fetched, SUM(written) AS written, SUM(unchanged) AS unchanged,
         SUM(merged) AS merged, SUM(dropped) AS dropped_no_role, SUM(ejected) AS ejected_blue_collar,
         SUM(COALESCE(json_extract(details_json, '$.outOfMarket'), 0)) AS held_out_of_market
    FROM pipeline_runs WHERE run_kind = 'source_sync' AND status = 'ok' AND started_at >= ${now - 30 * DAY}
   GROUP BY 1 ORDER BY fetched DESC`).map(r => ({
    ...r,
    discard_pct: r.fetched ? +(100 * (r.dropped_no_role + r.ejected_blue_collar + r.held_out_of_market) / r.fetched).toFixed(1) : null,
    no_role_pct: r.fetched ? +(100 * r.dropped_no_role / r.fetched).toFixed(1) : null,
    out_of_market_pct: r.fetched ? +(100 * r.held_out_of_market / r.fetched).toFixed(1) : null,
  }));
const rejectReasons = all(`SELECT reason, source, COUNT(*) AS n FROM rejected_jobs GROUP BY 1, 2 ORDER BY n DESC`);

// ── 4 · quiet and dead companies ─────────────────────────────────────────────────────────────────
const quiet = byCompany.filter(c => c.active && (!c.active_rows || !c.last_new || c.last_new < now - 30 * DAY))
  .map(c => ({ ats: c.ats_type, slug: c.ats_slug, active_rows: c.active_rows || 0,
               days_since_new: c.last_new ? Math.floor((now - c.last_new) / DAY) : null,
               days_since_seen: c.last_seen ? Math.floor((now - c.last_seen) / DAY) : null }));

// ── 5 · the shrink: every inactive row, by why ───────────────────────────────────────────────────
const inactive = get(`SELECT COUNT(*) AS n,
    SUM(EXISTS (SELECT 1 FROM rejected_jobs r WHERE r.job_id = sj.job_id AND r.reason LIKE 'out_of_market:%')) AS out_of_market,
    SUM(sj.retired_at IS NOT NULL) AS retired,
    SUM(sj.valid_through IS NOT NULL AND sj.valid_through < ${now}) AS expired_by_date
    FROM scraped_jobs sj WHERE sj.is_active = 0`);
const deleted = get(`SELECT COUNT(*) AS runs, SUM(jobs_deleted) AS jobs_deleted, MIN(run_at) AS first, MAX(run_at) AS last
    FROM cleanup_log WHERE run_at >= '2026-09-24'`);
const prunedByRuns = get(`SELECT SUM(COALESCE(json_extract(details_json, '$.pruned'), 0)) AS pruned,
    SUM(COALESCE(json_extract(details_json, '$.prunedStale'), 0)) AS stale, SUM(COALESCE(json_extract(details_json, '$.prunedExpired'), 0)) AS expired
    FROM pipeline_runs WHERE run_kind = 'source_sync' AND started_at >= strftime('%s', '2026-09-24')`);

// ── 6 · scoreability of the new ──────────────────────────────────────────────────────────────────
const scoreability = all(`
  SELECT CASE WHEN ${FIRST_SEEN} >= ${now - 7 * DAY} THEN 'new ≤7d' WHEN ${FIRST_SEEN} >= ${now - 30 * DAY} THEN '7–30d' ELSE 'older' END AS cohort,
         COUNT(*) AS active,
         SUM(sj.skills_json IS NOT NULL AND sj.skills_json NOT IN ('[]','')) AS with_skills,
         SUM(EXISTS (SELECT 1 FROM ats_only_reports a WHERE a.job_id = sj.job_id AND a.ats_score IS NOT NULL)) AS scored_for_anyone,
         SUM(sj.tag_level IS NOT NULL) AS with_level
    FROM scraped_jobs sj WHERE sj.is_active = 1 GROUP BY 1`).map(r => ({ ...r,
    skills_pct: +(100 * r.with_skills / r.active).toFixed(1), scored_pct: +(100 * r.scored_for_anyone / r.active).toFixed(1) }));
// Per user with a profile: of their unscored active rows, how many are new — the rows "Best fit" sorts last.
const perUser = all(`
  SELECT a.user_id, COUNT(DISTINCT a.job_id) AS scored FROM ats_only_reports a JOIN scraped_jobs sj ON sj.job_id = a.job_id
   WHERE sj.is_active = 1 AND a.ats_score IS NOT NULL GROUP BY 1`);
const activeTotal = get("SELECT COUNT(*) AS n FROM scraped_jobs WHERE is_active = 1").n;
const newTotal = get(`SELECT COUNT(*) AS n FROM scraped_jobs sj WHERE sj.is_active = 1 AND ${FIRST_SEEN} >= ${now - 7 * DAY}`).n;
const newScoredPerUser = all(`
  SELECT a.user_id, COUNT(DISTINCT a.job_id) AS new_scored FROM ats_only_reports a JOIN scraped_jobs sj ON sj.job_id = a.job_id
   WHERE sj.is_active = 1 AND a.ats_score IS NOT NULL AND ${FIRST_SEEN} >= ${now - 7 * DAY} GROUP BY 1`);

// ── 8 · headroom ─────────────────────────────────────────────────────────────────────────────────
const pages = get("PRAGMA page_count").page_count, pageSize = get("PRAGMA page_size").page_size;
const rowBytes = get(`SELECT COUNT(*) AS n, AVG(LENGTH(COALESCE(description,'')) + LENGTH(COALESCE(description_html,''))
    + LENGTH(COALESCE(description_text,'')) + LENGTH(COALESCE(skills_json,''))) AS avg_text_bytes FROM scraped_jobs`);
let disk = null;
try { disk = execSync(`df -k ${JSON.stringify(path.dirname(dbPath))} | tail -1`, { encoding: "utf8" }).trim().split(/\s+/); } catch { /* not a POSIX host */ }
const wall = all(`SELECT source, ROUND(AVG(duration_ms)) AS avg_ms, MAX(duration_ms) AS max_ms FROM pipeline_runs
                   WHERE run_kind = 'source_sync' AND status = 'ok' AND started_at >= ${now - 30 * DAY} GROUP BY 1`);

const report = {
  db: dbPath, measuredAt: new Date(now * 1000).toISOString(), activeTotal,
  sourceMap: { companies, bySource, byCompany: byCompany.map(c => ({ ats: c.ats_type, slug: c.ats_slug, active: c.active,
    active_rows: c.active_rows || 0, new_7d: c.new_7d || 0, new_30d: c.new_30d || 0 })) },
  freshness: { postedAge: ageDistribution(POSTED), firstSeenAge: ageDistribution(FIRST_SEEN), newPerDay, runsPerDay,
               lagPostedToFirstSeenHours: { n: lags.length, p50: q(lags, 0.5), p90: q(lags, 0.9) }, recentCrawls: crawls },
  funnel, rejectReasons, quiet,
  shrink: { inactive, deletedSince0924: deleted, prunedByRunsSince0924: prunedByRuns },
  scoreability: { cohorts: scoreability, newTotal, perUser: perUser.map(u => ({ user: u.user_id, scored_active: u.scored,
    unscored_active: activeTotal - u.scored, new_scored: newScoredPerUser.find(x => x.user_id === u.user_id)?.new_scored || 0, new_total: newTotal })) },
  headroom: { dbMB: +(pages * pageSize / 1048576).toFixed(1), rows: rowBytes.n, avgTextKB: +((rowBytes.avg_text_bytes || 0) / 1024).toFixed(1),
              disk: disk ? { sizeMB: Math.round(disk[1] / 1024), usedMB: Math.round(disk[2] / 1024), freeMB: Math.round(disk[3] / 1024), use: disk[4] } : null,
              crawlWallClock: wall },
};
if (argv.includes("--json")) { console.log(JSON.stringify(report)); process.exit(0); }
console.dir(report, { depth: 4 });
