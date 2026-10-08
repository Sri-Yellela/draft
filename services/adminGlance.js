// services/adminGlance.js — "Is the system healthy right now?" in one payload (A50 step 3,
// docs/ADMIN_PANEL_REVAMP.md §2A).
//
// ⛔ IT DOES NOT RECOMPUTE PIPELINE HEALTH. Ingestion and enrichment are read from the object
// pipelineHealth() returns — the SAME computation the nightly alert reads (routes/adminDb.js). A
// second derivation here is how the glance and the alert would come to disagree about what is
// wrong, so the caller passes `health` in and this module only selects from it.
//
// ⛔ EVERY SECTION SAYS WHEN IT WAS MEASURED. This project has been wrong about its own state eight
// times because a figure was carried forward instead of re-derived. `measuredAt` is when this
// payload was computed; each section adds the time its underlying fact refers to (the last crawl,
// the last enrichment), because "computed just now" over a crawl from three days ago is not "now".
//
// Read-only. No writes, no model calls. Every table read is tolerated separately: a database
// missing one table reports that section as unavailable rather than failing the glance.

export const DAY = 86400;

/** UTC midnight of the day containing `now` (seconds). Spend "today" is a UTC day: the server's. */
export function utcDayStart(now) {
  return now - (now % DAY);
}

// ── D74 P2 · CRAWL AGE — how long since each source last crawled SUCCESSFULLY ──────────────────────
// From pipelineHealth()'s lastSuccessAt (pipeline_runs, run_kind 'source_sync', status 'ok' — a failing
// source still has a recent "last run"; only the last success proves it worked). The crawl is daily, so
// one missed day plus slack is amber and a second missed day is red.
export const CRAWL_AGE_AMBER_HOURS = 30;
export const CRAWL_AGE_RED_HOURS = 54;
// Sources the daily crawl never calls (or is told not to) have no crawl age to judge.
const NOT_CRAWLED = new Set(["live_search_only", "not_enabled", "paused"]);

/**
 * { hours, tone } — tone 'ok' | 'amber' (> 30h) | 'red' (> 54h, or never succeeded) | 'not_crawled'.
 * @param {{ lastSuccessAt: number|null, health?: string, now: number }} o  seconds
 */
export function crawlAge({ lastSuccessAt, health = null, now }) {
  if (NOT_CRAWLED.has(health)) return { hours: lastSuccessAt ? (now - lastSuccessAt) / 3600 : null, tone: "not_crawled" };
  if (!lastSuccessAt) return { hours: null, tone: "red" };
  const hours = Math.max(0, now - lastSuccessAt) / 3600;
  return { hours, tone: hours > CRAWL_AGE_RED_HOURS ? "red" : hours > CRAWL_AGE_AMBER_HOURS ? "amber" : "ok" };
}

function tryRead(fn, fallback = null) {
  try { return fn(); } catch { return fallback; }
}

/**
 * @param {import("better-sqlite3").Database} db
 * @param {object} o
 * @param {object} o.health      the return value of pipelineHealth() — required
 * @param {{maxRows:number,maxUsd:number,maxMinutes:number}} [o.enrichBudget]
 * @param {{disabled:boolean,source:string}} [o.fullAuto]
 * @param {number} [o.now]       seconds
 */
export function buildGlance(db, { health, enrichBudget = null, fullAuto = null, now = Math.floor(Date.now() / 1000) } = {}) {
  if (!health) throw new Error("buildGlance needs pipelineHealth()'s result — it never computes health itself");
  const dayStart = utcDayStart(now);

  // ── Ingestion: per source, the last run and whether that is normal (health's own verdict) ──
  const sources = (health.sources || []).map(s => ({
    name: s.name,
    health: s.health,
    lastRunAt: s.lastRun?.at ?? null,
    lastRunStatus: s.lastRun?.status ?? null,
    written: s.lastRun?.written ?? null,
    unchanged: s.lastRun?.unchanged ?? null,
    refused: s.lastRun ? Number(s.lastRun.dropped || 0) + Number(s.lastRun.ejected || 0) : null,
    lastSuccessAt: s.lastSuccessAt ?? null,
    crawlAge: crawlAge({ lastSuccessAt: s.lastSuccessAt ?? null, health: s.health, now }),
    active: s.active ?? null,
  }));
  const benign = new Set(["ok", "live_search_only", "not_enabled", "paused"]);
  const ingestion = {
    measuredAt: health.generatedAt ?? now,
    lastCrawlAt: sources.reduce((m, s) => (s.lastRunAt && s.lastRunAt > (m ?? 0) ? s.lastRunAt : m), null),
    sources,
    crawlAgeHours: { amber: CRAWL_AGE_AMBER_HOURS, red: CRAWL_AGE_RED_HOURS },
    sourcesNeedingAttention: sources.filter(s => !benign.has(s.health)).map(s => s.name),
    alertCounts: health.alertCounts || { critical: 0, warn: 0 },
    alerts: (health.alerts || []).slice(0, 8),
  };

  // ── Enrichment: backlog, coverage (skills_json is THE column — A48), cost today vs the cap ──
  const e = health.enrichment || {};
  const skills = (e.coverage || []).find(c => c.column === "skills_json") || null;
  const enrichSpend = tryRead(() => db.prepare(`
    SELECT COUNT(*) AS calls, COALESCE(SUM(cost_usd), 0) AS cost_usd,
           SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failed
    FROM usage_events WHERE purpose = 'enrich_job' AND created_at >= ?
  `).get(dayStart));
  const lastRun = (e.recentRuns || [])[0] || null;
  const enrichment = {
    measuredAt: health.generatedAt ?? now,
    activeTotal: e.activeTotal ?? null,
    waiting: e.waitingForEnrichment ?? null,
    noDescription: e.noDescription ?? null,
    lastEnrichedAt: e.lastEnrichedAt ?? null,
    lastRun: lastRun && { at: lastRun.started_at, health: lastRun.health, written: lastRun.written, failed: lastRun.failed },
    skillsCoverage: skills && { nonNull: skills.nonNull, total: skills.total, pct: skills.pct },
    columnsAtZero: (e.coverage || []).filter(c => c.pct === 0 && c.total > 0).map(c => c.column),
    today: enrichSpend && {
      since: dayStart,
      calls: enrichSpend.calls,
      costUsd: enrichSpend.cost_usd,
      failedCalls: enrichSpend.failed || 0,
      capUsd: enrichBudget?.maxUsd ?? null,
      capRows: enrichBudget?.maxRows ?? null,
    },
  };

  // ── Scoring: the enriched share, NOT the band distribution ──
  // A48 (2026-10-02) explained the "not enough signal" share: ~30% of UNENRICHED rows decline and
  // 0% of enriched ones, so a band population means nothing without coverage beside it. The share
  // is the number that sets the decline rate; the band distribution stays off the glance.
  const scoring = {
    measuredAt: health.generatedAt ?? now,
    enrichedShare: skills && skills.total ? skills.nonNull / skills.total : null,
    expectedDeclineShare: skills && skills.total ? ((skills.total - skills.nonNull) / skills.total) * 0.3 : null,
    note: "≈30% of unenriched active rows score \"not enough signal\"; enriched rows ≈0% (A48). " +
          "Band distribution is deliberately not shown without this beside it.",
  };

  // ── Apply: last 24h of per-job outcomes, runs in flight, the kill switch ──
  const since24h = now - DAY;
  const applyByStatus = tryRead(() => db.prepare(`
    SELECT status, COUNT(*) AS n FROM apply_run_jobs
    WHERE COALESCE(finished_at, started_at, created_at) >= ? GROUP BY status ORDER BY n DESC
  `).all(since24h));
  const runsInFlight = tryRead(() => db.prepare(
    "SELECT COUNT(*) AS n FROM apply_runs WHERE status IN ('queued','running')",
  ).get().n);
  const apply = {
    measuredAt: now,
    window: { from: since24h, to: now },
    byStatus: applyByStatus,
    runsInFlight,
    fullAuto: fullAuto && { disabled: !!fullAuto.disabled, source: fullAuto.source },
  };

  // ── Spend: today (UTC) against the caps, and which call sites ──
  const spendTotals = tryRead(() => db.prepare(`
    SELECT COUNT(*) AS calls, COALESCE(SUM(cost_usd), 0) AS cost_usd,
           SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failed
    FROM usage_events WHERE created_at >= ?
  `).get(dayStart));
  const byPurpose = tryRead(() => db.prepare(`
    SELECT COALESCE(purpose, 'unattributed') AS purpose, COUNT(*) AS calls,
           COALESCE(SUM(cost_usd), 0) AS cost_usd,
           SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failed
    FROM usage_events WHERE created_at >= ?
    GROUP BY COALESCE(purpose, 'unattributed') ORDER BY cost_usd DESC, calls DESC LIMIT 6
  `).all(dayStart));
  // A tracking failure is spend that happened and is NOT in the totals above — said beside them.
  const trackingFailures = tryRead(() => db.prepare(
    "SELECT COUNT(*) AS n FROM usage_tracking_failures WHERE created_at >= ?",
  ).get(dayStart).n);
  const lastRecordedAt = tryRead(() => db.prepare("SELECT MAX(created_at) AS t FROM usage_events").get().t);
  const spend = {
    measuredAt: now,
    since: dayStart,
    calls: spendTotals?.calls ?? null,
    costUsd: spendTotals?.cost_usd ?? null,
    failedCalls: spendTotals ? (spendTotals.failed || 0) : null,
    byPurpose,
    trackingFailuresToday: trackingFailures,
    lastRecordedAt,
    caps: { enrichUsdPerDay: enrichBudget?.maxUsd ?? null },
  };

  return { measuredAt: now, ingestion, enrichment, scoring, apply, spend };
}
