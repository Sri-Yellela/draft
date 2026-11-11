// services/hirebase/runners.js — ⭐ HB-7 (D187 HB-INFRA): the runs. Each is a hirebase_runs row (its request, pages done,
// units used, counts, a resume cursor) and every page goes through the client — so through the spend guard and the
// OFF / dry-run switches. A dry run records the exact request it would send and stops: nothing leaves the machine.
//
//   sizing       the free estimate endpoint only (zero units) — HB-9 (a)'s counts
//   sample       one capped page (≤ 100 units) straight into the pipeline — HB-9 (b), the overlap test
//   backfill     paged limit 100, posted ≥ today − days; stops cleanly at the cap (the guard refuses) and resumes
//   incremental  ingested_after = the last incremental's start − 2 h (their advice), sort first_ingested asc, upsert by _id
//   expired      the free expired feed since N days → Hirebase-only rows retired
//   ageOut       Hirebase-only rows posted more than 30 days ago retired (no call; FEED-4)
import { buildSearchBody, categoryMap } from "./filter.js";
import { landHirebaseJob, retireExpiredHirebaseJob } from "./ingest.js";
import { HirebaseRefusedError, HirebaseQuotaError } from "./client.js";

// HB-FEED FEED-4 (owner 11-10): Hirebase-only rows leave the board at 30 days (was 90) — the feed is fresh-only.
export const MAX_AGE_DAYS = 30;
export const INCREMENTAL_OVERLAP_MS = 2 * 3600 * 1000;
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");

function openRun(db, kind, request, { dryRun }) {
  return Number(db.prepare(`INSERT INTO hirebase_runs (kind, request_json, status, dry_run) VALUES (?, ?, 'running', ?)`)
    .run(kind, JSON.stringify(request), dryRun ? 1 : 0).lastInsertRowid);
}
function closeRun(db, id, { status, counts = null, error = null, cursor = null, units = 0, pages = 0, maxUnits = null }) {
  db.prepare(`UPDATE hirebase_runs SET status = ?, counts_json = ?, error = ?, cursor_json = ?, units_used = units_used + ?, pages_done = pages_done + ?,
    max_units = COALESCE(?, max_units), finished_at = unixepoch() WHERE id = ?`)
    .run(status, counts ? JSON.stringify(counts) : null, error, cursor ? JSON.stringify(cursor) : null, units, pages, maxUnits, id);
}

/** HB-9 (a): free counts. `queries` = [{ label, body }]; each estimate is sent with limit 0 (the total match count). */
export async function runSizing(db, client, queries) {
  const runId = openRun(db, "estimate", queries, { dryRun: client.config.dryRun || !client.config.enabled });
  const out = [];
  try {
    for (const q of queries) {
      const r = await client.estimate({ ...q.body, limit: 0 });
      out.push({ label: q.label, count: r.dryRun ? null : (r.json?.cost ?? null), dryRun: !!r.dryRun });
    }
    closeRun(db, runId, { status: "done", counts: { estimates: out } });
  } catch (e) { closeRun(db, runId, { status: "failed", error: e.message, counts: { estimates: out } }); throw e; }
  return { runId, estimates: out };
}

/** The search-page loop every paid kind shares. Resumes at `fromPage`; stops at maxPages, the last page, or a refusal. */
async function searchPages(db, client, { kind, body, maxPages = 1, fromPage = 1 }) {
  const dryRun = client.config.dryRun || !client.config.enabled;
  const runId = openRun(db, kind, body, { dryRun });
  const counts = { returned: 0, new: 0, merged: 0, dropped: 0, held: 0 };
  let page = fromPage, pages = 0, units = 0;
  try {
    for (; pages < maxPages; page++) {
      const r = await client.search({ ...body, page });
      if (r.dryRun) { closeRun(db, runId, { status: "dry_run", counts, cursor: { page }, maxUnits: r.maxUnits }); return { runId, dryRun: true, request: r.request, counts }; }
      pages++; units += r.units;
      for (const job of r.json?.jobs || []) {
        counts.returned++;
        const landed = landHirebaseJob(db, job, { runId });
        counts[landed.action === "new" ? "new" : landed.action === "merged" ? "merged" : "dropped"]++;
        if (landed.outOfMarket) counts.held++;
      }
      if (!r.json?.total_pages || page >= r.json.total_pages) { page++; break; }
    }
    closeRun(db, runId, { status: "done", counts, cursor: { page }, units, pages });
    return { runId, counts, nextPage: page };
  } catch (e) {
    const status = e instanceof HirebaseQuotaError ? "quota" : e instanceof HirebaseRefusedError ? "refused" : "failed";
    closeRun(db, runId, { status, error: e.message, counts, cursor: { page }, units, pages });
    return { runId, counts, nextPage: page, stopped: status, error: e.message };
  }
}

/** HB-9 (b): the owner's sample — 100 SWE jobs, US, posted within 1 day, our boards NOT skipped (the overlap test). */
export function runSample(db, client, { categories = [categoryMap().sampleCategory], daysAgo = 1, limit = 100 } = {}) {
  return searchPages(db, client, { kind: "sample", maxPages: 1,
    body: buildSearchBody({ categories, daysAgo, limit, skipOurBoards: false, sortBy: "date_posted", sortOrder: "desc" }) });
}

/** The 60-day backfill, paged; resumable from the last backfill run's cursor. */
export function runBackfill(db, client, { days = 60, maxPages = 10, nowMs = Date.now() } = {}) {
  const last = db.prepare(`SELECT cursor_json FROM hirebase_runs WHERE kind = 'backfill' AND dry_run = 0 ORDER BY id DESC LIMIT 1`).pluck().get();
  const fromPage = (() => { try { return JSON.parse(last || "{}").page || 1; } catch { return 1; } })();
  const datePosted = new Date(nowMs - days * 86400_000).toISOString().slice(0, 10);
  return searchPages(db, client, { kind: "backfill", maxPages, fromPage, body: buildSearchBody({ datePosted, limit: 100 }) });
}

/** Hourly: everything first ingested since the last incremental's start, minus a 2-hour overlap, oldest first. */
export function runIncremental(db, client, { maxPages = 20, nowMs = Date.now() } = {}) {
  const lastStart = db.prepare(`SELECT started_at FROM hirebase_runs WHERE kind = 'incremental' AND status = 'done' AND dry_run = 0
    AND COALESCE(json_extract(cursor_json, '$.feed'), 0) != 1 ORDER BY id DESC LIMIT 1`).pluck().get();
  const since = lastStart ? Number(lastStart) * 1000 - INCREMENTAL_OVERLAP_MS : nowMs - 24 * 3600 * 1000;
  return searchPages(db, client, { kind: "incremental", maxPages,
    body: buildSearchBody({ ingestedAfter: iso(since), sortBy: "first_ingested", sortOrder: "asc", limit: 100 }) });
}

/** Daily: the free expired feed → Hirebase-only rows retired. */
export async function runExpired(db, client, { sinceDays = 2, nowMs = Date.now(), maxPages = 50 } = {}) {
  const since = new Date(nowMs - sinceDays * 86400_000).toISOString().slice(0, 10);
  const runId = openRun(db, "expired", { since }, { dryRun: client.config.dryRun || !client.config.enabled });
  let retired = 0, seen = 0, page = 1;
  try {
    for (; page <= maxPages; page++) {
      const r = await client.expired({ since, page, limit: 1000 });
      if (r.dryRun) { closeRun(db, runId, { status: "dry_run" }); return { runId, dryRun: true, request: r.request }; }
      for (const j of r.json?.jobs || []) { seen++; retired += retireExpiredHirebaseJob(db, j._id); }
      if (!r.json?.total_pages || page >= r.json.total_pages) break;
    }
    closeRun(db, runId, { status: "done", counts: { seen, retired }, pages: page });
  } catch (e) { closeRun(db, runId, { status: "failed", error: e.message, counts: { seen, retired } }); throw e; }
  return { runId, seen, retired };
}

/** Hirebase-only rows posted more than MAX_AGE_DAYS ago are retired. No call. */
export function ageOut(db, { nowMs = Date.now() } = {}) {
  const cut = new Date(nowMs - MAX_AGE_DAYS * 86400_000).toISOString().slice(0, 10);
  return db.prepare(`UPDATE scraped_jobs SET is_active = 0, retired_reason = COALESCE(retired_reason, 'hirebase_aged'), retired_at = COALESCE(retired_at, unixepoch())
    WHERE source = 'hirebase' AND is_active = 1 AND posted_at IS NOT NULL AND substr(posted_at, 1, 10) < ?`).run(cut).changes;
}
