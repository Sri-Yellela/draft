// routes/adminDb.js — DB Inspector API routes for admin diagnostics
// (A50: the "SCRAPING — SCHEDULED FOR REMOVAL" banner was stale. pipelineHealth() here is the ONE
// computation the nightly alert reads; nothing schedules this file's removal.)
import { traceJobLifecycle } from "../services/jobTrace.js";
import { Router } from "express";
import fs from "fs";
import Database from "better-sqlite3";
import { redactRow, redactRows, runReadOnlyQuery, secretColumnsMentioned } from "../services/adminSafety.js";
import { JobReviewError, jobReviewImpact, reassignJob, recentJobReviewChanges, undoJobReview } from "../services/adminJobReview.js";
import { classifyTitle } from "../services/jobClassifier.js";
import { getSourceStatus } from "../services/jobs/aggregator.js";
import { BRAND } from "../shared/brand.js";
import { mayActAsAdmin } from "../shared/authPolicy.js";
import { DIRECT_ATS_SOURCES } from "../services/jobs/directApplyFilter.js";
// Y2D — the attempt cap is read from the SAME parser the fetch pass uses. A literal here would
// be a second copy of the threshold, so raising ENRICH_DETAIL_MAX_ATTEMPTS would silently make
// this panel report "exhausted" about rows that are still being retried.
import { detailFetchFromEnv } from "../services/jobs/detailBudget.js";
import { buildJobFilters } from "../services/jobs/jobQuery.js";
import { deriveProfileFilters } from "../services/jobs/profileFilterBridge.js";
import { profileTitleSql } from "../services/profileTitleFilter.js";
import { loadSimpleApplyProfile } from "../services/simpleApplyProfile.js";

// A source that hasn't written in this long is treated as stale. Ashby stopped writing on
// 2026-08-07 and nobody noticed for three days because nothing anywhere asserted freshness.
const STALE_AFTER_HOURS = 48;
// A44: enrichment runs after each nightly sync. Three missed nights with enrichable rows waiting
// is a stop, not a queue — local enrichment stopped 2026-08-24 and nothing on this panel said so.
const ENRICHMENT_STOPPED_AFTER_HOURS = 72;
// A44: sources the owner has deliberately paused (jobo: wallet exhausted, 402, "waiting,
// deliberately" — owner 10-01). Comma-separated names. A paused source is shown, never alerted:
// a permanent critical for a decision already taken is the alarm nobody reads.
const pausedSources = () => new Set(String(process.env.PIPELINE_PAUSED_SOURCES || "")
  .split(",").map(s => s.trim()).filter(Boolean));

// Columns enrichJob.js is responsible for filling. Coverage across these IS the enrichment
// health signal: the outage was diagnosed by noticing skills_json was 0% and summary 0%, which
// no admin surface displayed at the time.
const ENRICHMENT_COLUMNS = [
  "description", "summary", "normalized_title", "experience_level", "workplace_type",
  "skills_json", "salary_max_usd", "is_h1b_sponsor", "requires_work_auth",
];

// Sources the DAILY CRAWL actually calls: cacheJobs iterates the direct-ATS set, and jobo has its
// own whole-catalogue feed via cacheJoboFeed. adzuna and serpapi are live-search-only — they are
// configured and healthy and will never appear in a crawl, so "never ran" is not a finding about
// them. DERIVED from DIRECT_ATS_SOURCES rather than restated, so a provider added there joins the
// crawl here too and this cannot drift into the second copy of the list it exists to avoid.
const CRAWL_SOURCES = new Set([...DIRECT_ATS_SOURCES, "jobo"]);

export function createAdminDbRouter(db, { dbPath } = {}) {
  const router = Router();

  // A51: the raw query's own connection, READ-ONLY at the SQLite level and opened lazily. No file
  // path (an in-memory test database) means no raw query at all — fail closed, never fall back to
  // the read-write handle.
  let readOnlyConn = null;
  function readOnlyDb() {
    if (readOnlyConn) return readOnlyConn;
    if (!dbPath || dbPath === ":memory:") return null;
    readOnlyConn = new Database(dbPath, { readonly: true, fileMustExist: true });
    return readOnlyConn;
  }

  // mayActAsAdmin, not `req.user?.isAdmin`. This router is the DB inspector — the single most
  // valuable thing behind an admin check — and it was reachable from the extension origin with
  // real JSON. One predicate, shared with server.js and routes/admin.js; see shared/authPolicy.js.
  function requireAdmin(req, res, next) {
    if (!mayActAsAdmin(req)) return res.status(403).json({ error: "Admin access required" });
    next();
  }

  function roleKeyForProfile(profile) {
    return String(profile?.role_family || profile?.domain || "general").trim().toLowerCase();
  }

  // roleKeyForTitle — admin suggestion for un/misclassified jobs.
  // Uses the modular classifier (services/jobClassifier.js) so admin hints
  // stay consistent with the system-wide classification engine.
  // Low-confidence results return "general" to avoid wrong suggestions.
  function roleKeyForTitle(title) {
    const result = classifyTitle(String(title || ""));
    // Only surface confident classifications as suggestions
    if (result.confidence >= 0.65) return result.roleKey;
    // Firmware anchors always have high confidence; fall through to general otherwise
    return "general";
  }

  const VALID_REVIEW_ROLE_KEYS = new Set([
    "engineering", "data", "pm", "finance", "hr", "design",
    "legal", "operations", "healthcare", "marketing", "general",
  ]);

  function tableNames() {
    return db.prepare(
      `SELECT name FROM sqlite_master
       WHERE type='table' AND name NOT LIKE 'sqlite_%'
       ORDER BY name`
    ).all().map(t => t.name);
  }

  function assertReadableTable(table) {
    return tableNames().includes(table);
  }

  /**
   * Y2D — does this database have migration 107's detail-fetch columns?
   *
   * ⛔ THIS PANEL MUST NEVER BE THE THING THAT BREAKS. It is the surface whose entire job is to
   * notice when something else has, so naming a column a deployment has not migrated yet would
   * take the whole health view down in order to report a missing metric — the same rule
   * recordPipelineRun follows ("observability must never be able to break ingestion") and the same
   * one the company_ats_list.active check below already follows.
   *
   * Not theoretical: the pipeline-health fixtures build a hand-written minimal scraped_jobs, and
   * naming these columns unconditionally failed seven of them at once — which is precisely what a
   * pre-107 production deployment would have experienced.
   */
  function hasDetailFetchColumns() {
    try {
      const cols = db.prepare("PRAGMA table_info(scraped_jobs)").all().map(c => c.name);
      return cols.includes("detail_fetch_attempts") && cols.includes("detail_fetched_at");
    } catch { return false; }
  }

  // ── Route 0: Pipeline Health ──────────────────────────────────
  // Read-only aggregation answering "did the pipeline actually WORK?" rather than "what is in
  // the table?". The old scrape-monitor answered the latter, which is why it showed 684 rows
  // "existing and looking fine" while three independent failures ran undetected. Every panel
  // here maps to a failure from docs/PIPELINE_DIAGNOSIS.md that was invisible at the time.
  // No writes, no LLM calls.
  // ⛔ THE COMPUTATION IS A FUNCTION SO THE NIGHTLY ALERT DELIVERY CAN USE *THIS* ONE.
  //
  // These alerts caught an Anthropic credit outage, Jobo's 402 wallet and three stale companies,
  // all correctly, and nobody saw any of it because this is a route nothing polls. The fix is a
  // scheduled sender (services/jobs/alertDelivery.js) — and the one thing it must NOT do is
  // re-derive the alert set. A second implementation of 'what is wrong with the pipeline' is the
  // exact defect repaired three times this week (two ATS caches, two classifiers, two migration
  // loops). So the body moves into a named function, the route serves it, and the cron calls the
  // same one via `router.pipelineHealth`.
  function pipelineHealth() {
      const now = Math.floor(Date.now() / 1000);
      const staleBefore = now - STALE_AFTER_HOURS * 3600;
      const hasRunLog = assertReadableTable("pipeline_runs");

      // Per-source row facts. COALESCE because discovered_at is NULL for some sources (adzuna)
      // — itself a known defect (3.5), so fall back rather than reporting them as never-seen.
      const rowStats = db.prepare(`
        SELECT source,
               COUNT(*)                                            AS total,
               SUM(is_active = 1)                                  AS active,
               MAX(COALESCE(discovered_at, scraped_at, updated_at)) AS last_row_at,
               SUM(CASE WHEN description IS NULL OR TRIM(description) = '' THEN 1 ELSE 0 END) AS no_description,
               SUM(enriched_at IS NOT NULL)                        AS enriched
        FROM scraped_jobs
        GROUP BY source
      `).all();
      const rowsBySource = new Map(rowStats.map(r => [r.source, r]));

      const companyCounts = new Map(
        (assertReadableTable("company_ats_list")
          ? db.prepare(`SELECT ats_type, COUNT(*) n FROM company_ats_list GROUP BY ats_type`).all()
          : []
        ).map(r => [r.ats_type, r.n])
      );

      // Latest run per source, and the latest SUCCESSFUL one — deliberately separate. A source
      // failing repeatedly still has a recent "last run"; only last_success proves it worked.
      const lastRuns = new Map();
      const lastOk = new Map();
      if (hasRunLog) {
        for (const r of db.prepare(`
          SELECT source, status, started_at, finished_at, fetched, written, unchanged, merged,
                 dropped, ejected, failed, expired, error_text, details_json
          FROM pipeline_runs
          WHERE run_kind = 'source_sync' AND source IS NOT NULL
          ORDER BY started_at DESC
        `).all()) {
          if (!lastRuns.has(r.source)) lastRuns.set(r.source, r);
          if (r.status === "ok" && !lastOk.has(r.source)) lastOk.set(r.source, r);
        }
      }

      const paused = pausedSources();
      const sources = getSourceStatus().map(({ name, configured }) => {
        const rows = rowsBySource.get(name) || null;
        const lastRun = lastRuns.get(name) || null;
        const lastSuccess = lastOk.get(name) || null;
        const lastActivityAt = lastSuccess?.started_at ?? rows?.last_row_at ?? null;

        // Does the DAILY CRAWL call this source at all? cacheJobs iterates ATS_SOURCE_NAMES plus
        // jobo's separate feed; adzuna and serpapi are live-search-only and `cacheJobs` never
        // touches them. Without this distinction both read `never_ran` — a warning shape
        // indistinguishable from Jobo's real months-long failure, which is the confusion AC item 3
        // exists to remove. "Never ran" must mean "should have run and did not".
        const inCrawl = CRAWL_SOURCES.has(name);

        // ⛔ CLASSIFY ON `written`, NOT ON `status`. Production recorded three consecutive days of
        // enrichment as `status: 'ok'` with `written: 0, failed: 25` — a total outage that every
        // status-keyed check reads as healthy. The same hole exists on the crawl side: a
        // source_sync can succeed, fetch rows, and write none. A run that wrote nothing is not a
        // successful run, whatever it called itself.
        //
        // ⛔ BUT `written` ALONE IS THE WRONG COUNTER, AND THIS ROUTE CRIED WOLF FOR IT. On the
        // crawl side `written` is `cached` — NEW-OR-CHANGED upserts only. A posting whose
        // fingerprint matches the last crawl is recorded under `unchanged` (touch-only, the cheap
        // path in cacheJobs), and one folded into another source's canonical row under `merged`.
        // So a source whose board simply did not change overnight records `written: 0` and was
        // classified as a total outage: on 2026-09-18 production raised CRITICAL for
        // `workable: wrote 0 rows from 23 fetched` and `recruitee: 0 from 16` on two sources that
        // were working exactly as designed — 6 and 4 rows, unchanged since the night before.
        // `unchanged` was not even SELECTed above, so the one counter that proves the rows were
        // accounted for was invisible to the check that needed it. Now that 2e4429e DELIVERS these
        // alerts, a false critical is not a cosmetic problem: it is the standing alarm nobody reads.
        //
        // So classify on what the run ACCOUNTED FOR. Two different zeros, and they are not the
        // same failure:
        //   accountedFor = written + unchanged + merged  — rows that are on the board because of
        //                                                  this run, or confirmed still on it
        //   rejected     = dropped + ejected             — rows the CLASSIFIER refused on purpose
        //                                                  (unclassifiable role, blue-collar)
        const fetchedRows  = Number(lastRun?.fetched   || 0);
        const accountedFor = Number(lastRun?.written   || 0)
                           + Number(lastRun?.unchanged || 0)
                           + Number(lastRun?.merged    || 0);
        // A44: rows the US-only gate holds out (A37) are refusals too. They are counted only in
        // details_json.outOfMarket, so without this a run whose yield was part classifier-refused
        // and part held out read `wrote_nothing` CRITICAL — "lost rows silently" — when every row
        // was accounted for. A source whose whole yield is non-US is `all_rejected`, a warn.
        const heldOut      = (() => {
          try { return Number(JSON.parse(lastRun?.details_json || "null")?.outOfMarket || 0); }
          catch { return 0; }
        })();
        const rejected     = Number(lastRun?.dropped   || 0)
                           + Number(lastRun?.ejected   || 0)
                           + heldOut;

        // Fetched rows, boarded none, and the classifier refused all of them. Nothing is broken in
        // the fetch; the source's entire yield is off-board. A different cause needs a different
        // word, and `warn` rather than `critical` — kept as its own state instead of folded into
        // `wrote_nothing` because "the source is dead" and "we throw away everything it sends" lead
        // to opposite actions.
        const allRejected = lastRun != null && fetchedRows > 0 && accountedFor === 0
                          && rejected === fetchedRows;

        // Fetched rows and put none of them anywhere. Still critical, and deliberately ALSO true
        // when the rejections do not add up to the fetch: a run that fetched 23, refused 15 and
        // cannot say what became of the other 8 has lost rows silently, which is the `0de67c8`
        // shape and worse than a clean refusal, not better.
        const wroteNothing = lastRun != null && fetchedRows > 0 && accountedFor === 0
                          && !allRejected;

        // Ordered by severity — the first matching condition wins, so a misconfiguration is
        // never masked by a downstream symptom.
        let health;
        if (paused.has(name))                  health = "paused";
        else if (!configured)                  health = "not_configured";
        else if (!inCrawl)                     health = "live_search_only";
        else if (!rows && !lastRun)            health = "never_ran";
        else if (lastRun?.status === "failed") health = "failed";
        // Keyed and in the crawl, with no active companies: never enabled (workday, smartrecruiters).
        // That is configuration as intended, not a fault — shown grey, not alerted (A44).
        else if (lastRun?.status === "skipped_unconfigured") health = "not_enabled";
        else if (lastRun?.status === "no_results")           health = "no_results";
        // Ahead of `stale`, because a source writing nothing on every run is a harder failure
        // than one that has merely gone quiet, and `stale` would mask it after 48h.
        else if (wroteNothing)                 health = "wrote_nothing";
        else if (allRejected)                  health = "all_rejected";
        else if (lastActivityAt && lastActivityAt < staleBefore) health = "stale";
        else if (!rows?.active)                health = "no_rows";
        else                                   health = "ok";

        return {
          name,
          configured,
          inCrawl,
          companies:       companyCounts.get(name) ?? null,
          total:           rows?.total ?? 0,
          active:          rows?.active ?? 0,
          noDescription:   rows?.no_description ?? 0,
          enriched:        rows?.enriched ?? 0,
          lastRowAt:       rows?.last_row_at ?? null,
          lastActivityAt,
          staleHours:      lastActivityAt ? Math.floor((now - lastActivityAt) / 3600) : null,
          health,
          // The share of the last fetch the classifier refused. REPORTED, NOT ALERTED — the same
          // call task Y phase 2 made for `detailYield`: workable refuses 15 of 23 and recruitee 12
          // of 16 every night, which is real and worth a human's attention, and is also a STANDING
          // condition that would become an alarm nobody reads. `all_rejected` (all of them, so the
          // source contributes nothing at all) is the part that earns an alert.
          rejectedShare:   fetchedRows > 0 ? Number((rejected / fetchedRows).toFixed(3)) : null,
          heldOutOfMarket: heldOut,
          lastRun:         lastRun && {
            status: lastRun.status, at: lastRun.started_at,
            fetched: lastRun.fetched, written: lastRun.written,
            // `unchanged` is on the payload for the same reason it is now in the classifier: it is
            // the difference between "the board did not change" and "the source stopped working",
            // and reading `written: 0` without it cannot tell them apart.
            unchanged: lastRun.unchanged, merged: lastRun.merged,
            dropped: lastRun.dropped, ejected: lastRun.ejected, failed: lastRun.failed,
            error: lastRun.error_text,
          },
          lastSuccessAt:   lastSuccess?.started_at ?? null,
        };
      });

      // ── PER-COMPANY-SLUG HEALTH ─────────────────────────────────────────────────────────────
      // The grain that matters, and the one this route did not have. Aggregating per SOURCE
      // reported greenhouse `ok` with 621 active rows while SIX of its nine active slugs
      // contributed zero — because all seven plugins capped the CONCATENATION of their
      // per-company fetches at 900, so every company past the cut was silently severed
      // (fixed in services/jobs/sources/base.js; this is the surface that would have caught it on
      // day one). lever's three dead slugs only became visible because ALL of them died at once
      // and the source fell to `no_results`; one of three dying is invisible at source grain.
      //
      // A dead slug and a capped-out slug are the same observation — zero rows — and both need to
      // be loud. This does NOT try to tell them apart: it reports the zero, which is the fact,
      // and leaves the cause to whoever reads it.
      //
      // JOINED ON `company`, WHICH IS EXACT HERE and is not the fuzzy company-name matching the
      // LCA layer needs. Every ATS plugin writes `company: companyName` straight from the
      // `company_ats_list.company` value the crawl passed it, so the two sides are the same
      // string by construction. Scoped by `source = ats_type` as well, because jobo, adzuna and
      // imported rows carry the PROVIDER's company spelling and would join by coincidence.
      //
      // WRAPPED, and the catch returns [] rather than propagating. This panel's entire job is to
      // be the thing that notices, so it must never be the thing that breaks: a deployment whose
      // company_ats_list predates the `active` column should lose the per-company table and keep
      // every other signal, not 500 and take the whole health view with it. Same reasoning as
      // recordPipelineRun's "observability must never be able to break ingestion".
      // Last SUCCESSFUL crawl per source, so a company added since then can be told apart from one
      // that has been crawled and produced nothing. Without this the panel screams about every
      // newly-seeded company — migration 103 added ten at once — and an alert list with ten
      // false positives in it is an alert list that gets closed.
      const lastOkBySource = new Map([...lastOk].map(([k, v]) => [k, v.started_at]));

      const hasDetailCols = hasDetailFetchColumns();
      // Y2D · DESCRIPTIONS OBTAINED PER REQUEST SPENT, per company.
      //
      // SmartRecruiters and Workday need a second HTTP request per posting for their text (Phase 1
      // proved no list parameter avoids it), so "this company yields no descriptions" and "we have
      // not paid for this company's descriptions yet" are different findings that no_description
      // alone cannot tell apart. Spend is not derivable from outcomes: a description-less row might
      // have cost zero requests or three.
      //
      // Both halves of the ratio are scoped to ACTIVE rows so they describe the same population —
      // mixing all-time spend with active-only outcomes would understate yield for any company
      // whose older rows have since been pruned.
      const detailCols = hasDetailCols
        ? `SUM(CASE WHEN COALESCE(s.is_active, 0) = 1 THEN COALESCE(s.detail_fetch_attempts, 0) ELSE 0 END) AS detail_attempts,
           SUM(COALESCE(s.is_active, 0) = 1 AND s.detail_fetched_at IS NOT NULL)                     AS detail_fetched,
           SUM(COALESCE(s.is_active, 0) = 1 AND COALESCE(s.detail_fetch_attempts, 0) >= @attemptCap
               AND (s.description IS NULL OR TRIM(s.description) = ''))                              AS detail_exhausted,`
        // NULL, not 0. "This deployment does not record detail spend" and "this company has spent
        // nothing" are different statements, and a 0 would assert the second while meaning the
        // first — success-shaped output over an absent measurement, which is the failure this
        // whole panel exists to catch.
        : `NULL AS detail_attempts, NULL AS detail_fetched, NULL AS detail_exhausted,`;

      // Rows the US-only gate holds out, per company, and when a crawl last re-saw them.
      const heldOutByCompany = new Map();
      try {
        if (assertReadableTable("rejected_jobs")) {
          for (const h of db.prepare(`
            SELECT source, company, MAX(rejected_at) AS last_seen_at,
                   SUM(reason LIKE 'out_of_market:%') AS out_of_market
            FROM rejected_jobs GROUP BY source, company
          `).all()) {
            heldOutByCompany.set(`${h.source}|${h.company}`,
              { lastSeenAt: h.last_seen_at ?? null, outOfMarket: h.out_of_market || 0 });
          }
        }
      } catch (e) {
        console.warn("[pipeline-health] held-out rows unavailable:", e.message);
      }

      const companyHealth = (() => {
      try {
      return assertReadableTable("company_ats_list")
        ? db.prepare(`
            SELECT c.ats_type AS source, c.company, c.ats_slug AS slug, c.active, c.created_at,
                   COUNT(s.job_id)                                     AS total,
                   SUM(COALESCE(s.is_active, 0) = 1)                   AS active_rows,
                   SUM(COALESCE(s.is_active, 0) = 1 AND (s.description IS NULL OR TRIM(s.description) = '')) AS no_description,
                   SUM(COALESCE(s.is_active, 0) = 1 AND s.enriched_at IS NOT NULL)                           AS enriched,
                   ${detailCols}
                   MAX(COALESCE(s.discovered_at, s.scraped_at, s.updated_at)) AS last_row_at,
                   MAX(COALESCE(s.scraped_at, s.updated_at, s.discovered_at)) AS last_seen_at
            FROM company_ats_list c
            LEFT JOIN scraped_jobs s
                   ON s.company = c.company AND s.source = c.ats_type
            WHERE c.active = 1
            GROUP BY c.ats_type, c.company, c.ats_slug, c.active, c.created_at
            ORDER BY c.ats_type, active_rows DESC, c.company
          `).all(hasDetailCols ? { attemptCap: detailFetchFromEnv().maxAttempts } : {}).map(r => {
            const activeRows = r.active_rows || 0;
            const noDesc = r.no_description || 0;
            const lastCrawlOk = lastOkBySource.get(r.source) ?? null;
            const held = heldOutByCompany.get(`${r.source}|${r.company}`) || null;
            // A44 (10-02) · LIVENESS, NOT POSTING CADENCE. `last_row_at` leads with discovered_at,
            // which is when a posting was FIRST seen — so it is "this company's newest NEW job", and
            // it never moves while a stable board is re-crawled every day. Production's 542h cluster
            // (lever/openx, workable/persado, workable/skroutz, identical to the hour) was exactly
            // that: three companies seeded together by migration 103, first crawled in one run, all
            // ALIVE (probed 10-02) and re-seen on every crawl, flagged only for not posting anything
            // new. A crawl touches scraped_at on every row it returns, and the US gate rewrites
            // rejected_at on every row it holds out, so either one proves the slug answered.
            const lastSeenAt = Math.max(r.last_seen_at || 0, held?.lastSeenAt || 0) || null;
            // A company seeded AFTER its source's last successful crawl has not yet had a chance
            // to produce anything, so zero rows is the expected state and not a finding. This is
            // exactly the position the ten companies migration 103 added are in right now: the
            // migration landed 2026-09-09 04:27Z and the last crawl ran 2026-09-08 08:00Z, twenty
            // hours EARLIER. Reporting those as failures would be reporting the calendar.
            const awaitingFirstCrawl = activeRows === 0 && r.created_at != null
              && (lastCrawlOk == null || r.created_at > lastCrawlOk);
            let health;
            if (awaitingFirstCrawl)                      health = "awaiting_first_crawl";
            // Every posting it returns is held out by the US-only gate (A37): the slug works and the
            // company simply does not hire here. Not a dead slug — a decision about the company.
            else if (activeRows === 0 && held?.outOfMarket > 0) health = "out_of_market";
            // An ACTIVE company with no rows is the alert. It is configured, so somebody meant it
            // to produce; producing nothing is a failure regardless of what the source says.
            else if (activeRows === 0)                   health = "no_rows";
            // 0% descriptions is AC item 2's other disqualifier: enrichJob.js skips
            // description-less rows, so these can NEVER be enriched and inflate every coverage
            // metric they enter. This is why Ubisoft, Bosch and Adobe were seeded inactive.
            //
            // ⛔ IT NO LONGER MEANS WHAT IT MEANT, AND IT IS STILL RIGHT TO REPORT. Since Y2A a
            // description-less row from a fetchable source is a row whose text has not been BOUGHT
            // yet, not a row that can never have one — which is why `detailAttempts` is reported
            // beside this. A company reading `no_descriptions` with `detailAttempts: 0` is waiting
            // in a queue; the same company with `detailAttempts: 900` and `detailYield: 0` is a
            // real finding. The health WORD cannot carry that distinction, so the numbers do.
            else if (noDesc === activeRows)              health = "no_descriptions";
            // Stale = its source's last SUCCESSFUL crawl did not return it. With no successful crawl
            // on record there is nothing to compare with, so the old clock stands in.
            else if (lastCrawlOk != null ? (lastSeenAt == null || lastSeenAt < lastCrawlOk)
                                         : (lastSeenAt != null && lastSeenAt < staleBefore)) health = "stale";
            else                                         health = "ok";
            const attempts = r.detail_attempts;
            const obtained = r.detail_fetched;
            return {
              source: r.source, company: r.company, slug: r.slug,
              total: r.total || 0, active: activeRows, noDescription: noDesc,
              enriched: r.enriched || 0, lastRowAt: r.last_row_at ?? null,
              addedAt: r.created_at ?? null,
              lastSeenAt,
              // How long since this company's newest NEW posting. Reported, never alerted: most
              // companies do not post every two days (median gap between postings for the small
              // boards measured 10-02 was 6–43 days), so a fixed clock on it is alarm fatigue.
              quietHours: r.last_row_at ? Math.floor((now - r.last_row_at) / 3600) : null,
              heldOutOfMarket: held?.outOfMarket ?? 0,
              staleHours: lastSeenAt ? Math.floor((now - lastSeenAt) / 3600) : null,
              // Y2D. Reported, never acted on — see the ⛔ below.
              detailAttempts: attempts ?? null,
              detailObtained: obtained ?? null,
              detailYield: attempts ? Number((obtained / attempts).toFixed(3)) : null,
              detailExhausted: r.detail_exhausted ?? null,
              health,
            };
          })
        : [];
      } catch (e) {
        console.warn("[pipeline-health] per-company health unavailable:", e.message);
        return [];
      }
      })();
      // ⛔ Y2D DELIBERATELY STOPS HERE: MEASURED AND SURFACED, NEVER AUTO-DEACTIVATED.
      //
      // The brief asked for a company returning 0% descriptions to be auto-deactivated with the
      // reason recorded — "one crawl to learn that, not one crawl per crawl forever". Phase 1
      // measured the premise and it does not hold: sampling 25 postings spread across each board,
      // Ubisoft, Bosch and Adobe ALL returned 100% descriptions, 75 of 75, zero failures. The 0%
      // coverage that got them seeded inactive was the absence of our own second request, not a
      // property of the sources.
      //
      // So an auto-deactivator would guard a condition that does not occur, while introducing a
      // brand-new way to lose a healthy company to one bad crawl — silent data loss, this
      // project's single most-repeated failure shape, added to protect against a measured
      // non-problem. The per-row attempt cap already removes the "one crawl per crawl" waste it
      // was aimed at, bounded at three requests per row rather than per company, and a human
      // reads the numbers above to decide anything larger.
      //
      // If a future session revisits this: the finding that would justify auto-deactivation is a
      // company with high `detailAttempts` and `detailYield: 0`. That is now visible. Nothing is
      // stopping it being acted on except that it has never been observed.

      // Enrichment coverage: % non-null per column over ACTIVE rows. 0% must be alarming, which
      // is the whole point — skills_json sat at 0/684 while the admin panel looked healthy.
      const activeTotal = db.prepare(`SELECT COUNT(*) n FROM scraped_jobs WHERE is_active = 1`).get().n;
      const coverageRow = activeTotal
        ? db.prepare(`
            SELECT ${ENRICHMENT_COLUMNS.map(c => `SUM(${c} IS NOT NULL AND TRIM(COALESCE(${c},'')) != '') AS "${c}"`).join(", ")}
            FROM scraped_jobs WHERE is_active = 1
          `).get()
        : {};
      const coverage = ENRICHMENT_COLUMNS.map(column => {
        const nonNull = coverageRow?.[column] ?? 0;
        return {
          column, nonNull, total: activeTotal,
          pct: activeTotal ? Math.round((nonNull / activeTotal) * 1000) / 10 : 0,
        };
      });

      // ⛔ `health` HERE IS DERIVED FROM `written`, NOT FROM `status`. Production's own history is
      // the argument: 2026-09-05, -06 and -07 each recorded `status: 'ok'` with
      // `fetched 25, written 0, failed 25` — the retired-model-id outage, logged perfectly and
      // read as healthy by everything that looked at `status`. Three days invisible. A run that
      // attempted work and wrote none of it is `failed`, whatever it called itself.
      const enrichmentRuns = hasRunLog
        ? db.prepare(`
            SELECT status, started_at, fetched, written, failed, skipped, error_text, details_json
            FROM pipeline_runs WHERE run_kind = 'enrichment'
            ORDER BY started_at DESC LIMIT 10
          `).all().map(r => {
            const written = Number(r.written || 0);
            const fetched = Number(r.fetched || 0);
            const failed  = Number(r.failed || 0);
            let health;
            if (fetched > 0 && written === 0) health = "failed";
            else if (failed > 0)              health = "degraded";
            else if (fetched === 0)           health = "idle";
            else                              health = "ok";
            return {
              ...r, health,
              details: r.details_json ? JSON.parse(r.details_json) : null,
            };
          })
        : [];

      // Dedup: a sources_seen array with more than one entry means at least one duplicate was
      // folded into this canonical row. Counted via the comma rather than JSON1 so this cannot
      // fail on a build without the extension.
      const dedup = db.prepare(`
        SELECT SUM(CASE WHEN sources_seen IS NOT NULL AND sources_seen LIKE '%,%' THEN 1 ELSE 0 END) AS multi_source,
               COUNT(*) AS total
        FROM scraped_jobs WHERE is_active = 1
      `).get();

      // ── ALERTS ──────────────────────────────────────────────────────────────────────────────
      // AC item 2: "a configured source producing zero rows, or rows with 0% descriptions, is an
      // ALERT — not a quiet entry in a log nobody reads." Everything above is a table, and a
      // table is a log with better spacing: each of this project's three silent failures was
      // sitting in plain view in a panel somebody had to think to open and then read a row of.
      //
      // So the findings are collected HERE, pre-ranked, as a first-class part of the payload. An
      // empty array is the healthy answer and is meaningful — it says the checks ran and found
      // nothing, which is different from a panel that shows nothing because it computed nothing.
      const alerts = [];
      const push = (severity, kind, subject, detail) => alerts.push({ severity, kind, subject, detail });

      const unhealthySources = new Set();
      for (const s of sources) {
        if (s.health === "ok" || s.health === "live_search_only"
            || s.health === "not_enabled" || s.health === "paused") continue;
        unhealthySources.add(s.name);
        // `not_configured` is reached two different ways and they need different words. A source
        // whose isConfigured() is false is missing a KEY; a source whose last run recorded
        // `skipped_unconfigured` has the key and no active COMPANIES. Collapsing both into one
        // sentence told four sources they were missing a key they do not use — and AC item 3 is
        // specifically about not blurring configuration states together.
        const notConfiguredDetail = !s.configured
          ? "the provider reports itself unconfigured — an API key is missing from the environment"
          : "the crawl skipped it: no active companies are configured for this source";
        const detail = {
          not_configured: notConfiguredDetail,
          never_ran:      "in the daily crawl and has never produced a run or a row",
          failed:         `last run failed: ${s.lastRun?.error || "no error recorded"}`,
          no_results:     "ran and returned nothing — every configured slug came back empty",
          // Names every counter, because the previous wording — "wrote 0 rows from N fetched" —
          // was true of two sources that were working, and gave a reader nothing to check it with.
          wrote_nothing:  `last run reported '${s.lastRun?.status}' and put none of its ` +
                          `${s.lastRun?.fetched ?? 0} fetched rows on the board ` +
                          `(written 0, unchanged 0, merged 0, refused ${(s.lastRun?.dropped ?? 0) + (s.lastRun?.ejected ?? 0)})`,
          all_rejected:   `fetched ${s.lastRun?.fetched ?? 0} rows and the classifier refused ` +
                          `every one of them (${s.lastRun?.dropped ?? 0} unclassifiable, ` +
                          `${s.lastRun?.ejected ?? 0} blue-collar` +
                          (s.heldOutOfMarket ? `, ${s.heldOutOfMarket} outside the US` : "") +
                          `) — the source works, its whole yield is off-board`,
          stale:          `no successful run in ${s.staleHours}h (threshold ${STALE_AFTER_HOURS}h)`,
          no_rows:        "has run but holds no active rows",
        }[s.health] || s.health;
        // `all_rejected` is a warn for the same reason `stale` is: the pipeline is doing what it
        // was told, and the judgement to make is about the source or the classifier, not an outage.
        push(s.health === "stale" || s.health === "all_rejected" ? "warn" : "critical",
          "source", s.name, detail);
      }

      // Per-slug, and deliberately AFTER the source loop: a source can read `ok` while individual
      // companies inside it are dead, which is the failure the source grain cannot express.
      for (const c of companyHealth) {
        if (c.health === "ok" || c.health === "awaiting_first_crawl") continue;
        // A stale SOURCE makes every company under it stale, which produced one identical warning
        // per slug and buried the findings that were actually per-company. The source alert
        // already says it, and the per-company table still carries each slug's own staleHours —
        // which do differ and are worth reading. Suppressed here, not computed away.
        if (c.health === "stale" && unhealthySources.has(c.source)) continue;
        const detail = {
          no_rows:         "active company, zero rows on the board — a dead slug, or its postings were dropped before they were written",
          no_descriptions: `all ${c.active} rows have no description, so none of them can ever be enriched`,
          stale:           `not returned by its source's last successful crawl (last seen ${c.staleHours ?? "never"}h ago)`,
          out_of_market:   `every posting it returns (${c.heldOutOfMarket}) is outside the US and held out by the US-only gate — the slug works; keep or deactivate the company`,
        }[c.health] || c.health;
        push(c.health === "stale" || c.health === "out_of_market" ? "warn" : "critical", "company",
          `${c.source}/${c.slug}`, `${c.company}: ${detail}`);
      }

      // Enrichment: the column at 0% is the shape that hid the original outage, and the run that
      // wrote nothing is the shape that hid the model-id outage. Both are alerts, not cells.
      for (const c of coverage) {
        if (c.pct === 0 && c.total > 0) {
          push("critical", "coverage", c.column, `0% of ${c.total} active rows have a value`);
        }
      }
      // A44: an alert when enrichment has STOPPED. The checks below fire on a failed run and the
      // coverage loop on exactly 0%; neither fires when runs simply cease, which is how local
      // enrichment stopped on 2026-08-24 with nothing raised — and A48 found that unenriched rows are
      // the ones that score "not enough signal" (~30% of them), so a stop shows up on the board.
      let enrichmentLag = null;
      try {
        enrichmentLag = db.prepare(`
          SELECT MAX(enriched_at) AS last_enriched_at,
                 SUM(is_active = 1 AND enriched_at IS NULL
                     AND description IS NOT NULL AND TRIM(description) != '') AS waiting
          FROM scraped_jobs
        `).get();
      } catch (e) {
        // This panel must never be the thing that breaks (see hasDetailFetchColumns).
        console.warn("[pipeline-health] enrichment lag unavailable:", e.message);
      }
      if ((enrichmentLag?.waiting || 0) > 0
          && (enrichmentLag.last_enriched_at == null
              || enrichmentLag.last_enriched_at < now - ENRICHMENT_STOPPED_AFTER_HOURS * 3600)) {
        push("critical", "enrichment", "stopped",
          `nothing enriched ${enrichmentLag.last_enriched_at == null ? "ever"
            : `in ${Math.floor((now - enrichmentLag.last_enriched_at) / 3600)}h`} while ` +
          `${enrichmentLag.waiting} active rows with a description wait — unenriched rows are the ones ` +
          `that score "not enough signal"`);
      }
      const lastEnrichment = enrichmentRuns[0];
      if (lastEnrichment?.health === "failed") {
        push("critical", "enrichment", "last run",
          `recorded status '${lastEnrichment.status}' but wrote 0 of ${lastEnrichment.fetched} fetched` +
          (lastEnrichment.error_text ? ` — ${String(lastEnrichment.error_text).slice(0, 160)}` : ""));
      }
      const consecutiveFailed = (() => {
        let n = 0;
        for (const r of enrichmentRuns) { if (r.health !== "failed") break; n++; }
        return n;
      })();
      if (consecutiveFailed > 1) {
        push("critical", "enrichment", "consecutive failures",
          `the last ${consecutiveFailed} enrichment runs wrote nothing — this is the shape that ran for three days undetected`);
      }

      const SEVERITY_ORDER = { critical: 0, warn: 1 };
      alerts.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));

      return {
        generatedAt: now,
        staleAfterHours: STALE_AFTER_HOURS,
        hasRunLog,
        alerts,
        alertCounts: {
          critical: alerts.filter(a => a.severity === "critical").length,
          warn:     alerts.filter(a => a.severity === "warn").length,
        },
        sources,
        companies: companyHealth,
        enrichment: {
          activeTotal,
          coverage,
          lastEnrichedAt: enrichmentLag?.last_enriched_at ?? null,
          waitingForEnrichment: enrichmentLag?.waiting ?? 0,
          recentRuns: enrichmentRuns,
          noDescription: db.prepare(`
            SELECT COUNT(*) n FROM scraped_jobs
            WHERE is_active = 1 AND (description IS NULL OR TRIM(description) = '')
          `).get().n,
        },
        dedup: { multiSource: dedup.multi_source || 0, total: dedup.total || 0 },
      };
  }
  // Exposed on the router so server.js can schedule delivery without importing this whole file's
  // closure. The route and the cron therefore cannot disagree about what is wrong.
  router.pipelineHealth = pipelineHealth;
  router.get("/pipeline-health", requireAdmin, (_req, res) => {
    try { res.json(pipelineHealth()); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Route 1: Scrape Monitor ───────────────────────────────────
  router.get("/scrape-monitor", requireAdmin, (req, res) => {
    try {
      const limit = Math.min(200, parseInt(req.query.limit || "50"));
      // Filter by SOURCE, not by user: post-pivot the board is one shared store-then-filter
      // corpus, so "which provider produced this row" is the question worth slicing on.
      const source = req.query.source ? String(req.query.source) : null;

      // Re-pointed from the pre-pivot column set (domain_profile_id / search_query / ats_score,
      // all artifacts of the per-user scraping architecture) to the columns that actually decide
      // whether a row is usable on the store-then-filter board. `has_description` and
      // `enriched_at` are the two that matter most: a row can look perfectly fine in a raw table
      // view while being unenrichable, which is precisely how the outage stayed invisible.
      let sql = `
        SELECT
          sj.job_id, sj.title, sj.company, sj.location, sj.source, sj.source_label,
          sj.posted_at, sj.discovered_at, sj.scraped_at, sj.updated_at, sj.is_active,
          (sj.is_active = 0 AND EXISTS (SELECT 1 FROM rejected_jobs rj WHERE rj.job_id = sj.job_id
             AND rj.reason LIKE 'out_of_market:%')) AS held_outside_us,
          sj.normalized_title, sj.experience_level, sj.workplace_type,
          sj.salary_min_usd, sj.salary_max_usd, sj.skills_json, sj.summary,
          sj.enriched_at, sj.content_hash, sj.sources_seen, sj.req_uid,
          sj.is_h1b_sponsor, sj.requires_work_auth,
          LENGTH(COALESCE(sj.description, '')) AS description_len,
          (sj.description IS NOT NULL AND TRIM(sj.description) != '') AS has_description,
          sj.description
        FROM scraped_jobs sj
      `;
      const params = [];
      if (source) {
        sql += ` WHERE sj.source = ?`;
        params.push(source);
      }
      sql += ` ORDER BY COALESCE(sj.discovered_at, sj.scraped_at, sj.updated_at) DESC LIMIT ?`;
      params.push(limit);

      const DESC_LIMIT = 10000;
      const jobs = db.prepare(sql).all(...params).map(job => {
        const out = { ...job };
        if (out.description && out.description.length > DESC_LIMIT) {
          out.description = out.description.slice(0, DESC_LIMIT);
          out.description_truncated = true;
        }
        return out;
      });

      // Aggregate stats moved to /pipeline-health — the old ones here (withProfile /
      // nullProfile / avgAtsScore) measured the pre-pivot per-user scraping model and were
      // reporting healthy numbers throughout the outage. This route is now just the row list.
      res.json({
        jobs,
        sources: db.prepare(
          `SELECT source, COUNT(*) AS n FROM scraped_jobs WHERE is_active = 1 GROUP BY source ORDER BY n DESC`
        ).all(),
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Route 2: Schema Explorer ──────────────────────────────────
  router.get("/schema", requireAdmin, (req, res) => {
    try {
      const tableNames = db.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
      ).all().map(t => t.name);

      const tables = tableNames.map(name => {
        const rowCount = db.prepare(`SELECT COUNT(*) as c FROM "${name}"`).get().c;
        const columns = db.prepare(`PRAGMA table_info("${name}")`).all();
        const indexList = db.prepare(`PRAGMA index_list("${name}")`).all();
        const indexes = indexList.map(idx => {
          const info = db.prepare(`PRAGMA index_info("${idx.name}")`).all();
          return { name: idx.name, unique: idx.unique === 1, columns: info.map(c => c.name) };
        });
        const foreignKeys = db.prepare(`PRAGMA foreign_key_list("${name}")`).all().map(fk => ({
          from: fk.from, table: fk.table, to: fk.to,
        }));
        return { name, rowCount, columns, indexes, foreignKeys };
      });

      let migrations = [];
      try { migrations = db.prepare("SELECT * FROM schema_migrations ORDER BY applied_at ASC").all(); } catch {}

      let dbSizeBytes = 0;
      if (dbPath) { try { dbSizeBytes = fs.statSync(dbPath).size; } catch {} }

      const walMode = db.prepare("PRAGMA journal_mode").get();

      res.json({ tables, migrations, dbSizeBytes, walMode: walMode?.journal_mode === "wal" });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get("/schema/graph", requireAdmin, (req, res) => {
    try {
      const names = tableNames();
      const nodes = names.map(name => {
        const columns = db.prepare(`PRAGMA table_info("${name}")`).all().map(c => ({
          name: c.name,
          type: c.type,
          notnull: c.notnull === 1,
          primaryKey: c.pk > 0,
          defaultValue: c.dflt_value,
        }));
        const rowCount = db.prepare(`SELECT COUNT(*) as c FROM "${name}"`).get().c;
        return { id: name, name, rowCount, columns };
      });
      const edges = [];
      for (const name of names) {
        const fks = db.prepare(`PRAGMA foreign_key_list("${name}")`).all();
        for (const fk of fks) {
          edges.push({
            id: `${name}.${fk.from}->${fk.table}.${fk.to}`,
            fromTable: name,
            fromColumn: fk.from,
            toTable: fk.table,
            toColumn: fk.to,
          });
        }
      }
      res.json({ tables: nodes, relationships: edges });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get("/job-review", requireAdmin, (req, res) => {
    try {
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || "100")));
      const q = String(req.query.q || "").trim().toLowerCase();
      const roleKey = String(req.query.roleKey || "").trim().toLowerCase();
      const params = [];
      const where = [];
      if (q) {
        where.push(`(LOWER(sj.title) LIKE ? OR LOWER(sj.company) LIKE ? OR LOWER(sj.search_query) LIKE ?)`);
        const pat = `%${q}%`;
        params.push(pat, pat, pat);
      }
      if (roleKey === "unclassified") {
        where.push(`NOT EXISTS (SELECT 1 FROM job_role_map jrm2 WHERE jrm2.job_id = sj.job_id)`);
      } else if (roleKey) {
        where.push(`EXISTS (SELECT 1 FROM job_role_map jrm2 WHERE jrm2.job_id = sj.job_id AND jrm2.role_key = ?)`);
        params.push(roleKey);
      }

      const jobs = db.prepare(`
        SELECT sj.job_id, sj.title, sj.company, sj.search_query, sj.source_platform,
               sj.posted_at, sj.scraped_at, sj.domain_profile_id,
               dp.profile_name, dp.role_family as profile_role_family,
               GROUP_CONCAT(jrm.role_key) as role_keys,
               GROUP_CONCAT(jrm.matched_by) as matched_by,
               (SELECT COUNT(DISTINCT uj.user_id) FROM user_jobs uj WHERE uj.job_id = sj.job_id) as users_referencing
        FROM scraped_jobs sj
        LEFT JOIN domain_profiles dp ON dp.id = sj.domain_profile_id
        LEFT JOIN job_role_map jrm ON jrm.job_id = sj.job_id
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        GROUP BY sj.job_id
        ORDER BY sj.scraped_at DESC
        LIMIT ?
      `).all(...params, limit).map(row => ({
        ...row,
        suggestedRoleKey: roleKeyForTitle(row.title),
        role_keys: row.role_keys ? row.role_keys.split(",") : [],
      }));

      const profiles = db.prepare(`
        SELECT id, profile_name, role_family, domain, user_id
        FROM domain_profiles
        ORDER BY role_family, profile_name
      `).all();
      res.json({ jobs, profiles });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  // A58 (b): re-classification only — job_role_map and scraped_jobs.domain_profile_id, logged with
  // the value replaced. It used to rewrite every user's unapplied user_jobs row for the posting too,
  // which re-dealt Passes and dropped Saves; see services/adminJobReview.js.
  const jobReviewFail = (res, e) => res.status(e instanceof JobReviewError ? e.status : 500).json({ error: e.message });
  router.post("/job-review/reassign", requireAdmin, (req, res) => {
    try {
      res.json(reassignJob(db, {
        jobId: req.body?.jobId,
        roleKey: req.body?.roleKey,
        domainProfileId: req.body?.domainProfileId ? parseInt(req.body.domainProfileId) : null,
        adminUserId: req.user?.id ?? null,
        validRoleKeys: VALID_REVIEW_ROLE_KEYS,
      }));
    } catch(e) { jobReviewFail(res, e); }
  });

  // Who has a Save / Pass / application on the posting — what the confirm states. Read-only.
  router.get("/job-review/impact/:jobId", requireAdmin, (req, res) => {
    try { res.json(jobReviewImpact(db, String(req.params.jobId))); }
    catch(e) { jobReviewFail(res, e); }
  });

  // The logged changes, newest first, and undoing the newest one for a posting.
  router.get("/job-review/changes", requireAdmin, (req, res) => {
    try { res.json({ changes: recentJobReviewChanges(db, { limit: Math.min(100, parseInt(req.query.limit || "20") || 20) }) }); }
    catch(e) { jobReviewFail(res, e); }
  });
  router.post("/job-review/undo/:logId", requireAdmin, (req, res) => {
    try { res.json(undoJobReview(db, Number(req.params.logId), { adminUserId: req.user?.id ?? null })); }
    catch(e) { jobReviewFail(res, e); }
  });

  // ── Route 2c: Full schema export (for copy/download) ─────────
  router.get("/schema/export", requireAdmin, (req, res) => {
    try {
      const tableNames = db.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
      ).all().map(t => t.name);

      const createStatements = db.prepare(
        `SELECT name, type, sql FROM sqlite_master
         WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%'
         ORDER BY type DESC, name ASC`
      ).all();

      let dbSizeBytes = 0;
      if (dbPath) { try { dbSizeBytes = fs.statSync(dbPath).size; } catch {} }
      const fmtBytes = b => b > 1e6 ? (b/1e6).toFixed(1)+" MB" : b > 1e3 ? (b/1e3).toFixed(1)+" KB" : b+" B";

      let migrations = [];
      try { migrations = db.prepare("SELECT * FROM schema_migrations ORDER BY applied_at ASC").all(); } catch {}

      const generatedAt = new Date().toISOString();
      const bar = "═".repeat(55);
      const lines = [
        bar,
        `${BRAND.toUpperCase()} — FULL DB SCHEMA EXPORT`,
        `Generated: ${generatedAt}`,
        `DB Size: ${fmtBytes(dbSizeBytes)}`,
        bar,
        "",
      ];

      let totalRows = 0;
      for (const name of tableNames) {
        const rowCount = db.prepare(`SELECT COUNT(*) as c FROM "${name}"`).get().c;
        totalRows += rowCount;
        const createRow = createStatements.find(r => r.name === name && r.type === "table");
        lines.push(`[TABLE: ${name} — ${rowCount} rows]`);
        if (createRow?.sql) lines.push(createRow.sql + ";");
        lines.push("");
      }

      // Indexes section
      const indexes = createStatements.filter(r => r.type === "index" && r.sql);
      if (indexes.length) {
        lines.push(bar);
        lines.push("INDEXES");
        lines.push(bar);
        lines.push("");
        for (const idx of indexes) {
          lines.push(idx.sql + ";");
        }
        lines.push("");
      }

      if (migrations.length) {
        lines.push(bar);
        lines.push("MIGRATION HISTORY");
        lines.push(bar);
        for (const m of migrations) {
          const ts = m.applied_at
            ? new Date(m.applied_at * 1000).toISOString().slice(0, 19).replace("T", " ")
            : "unknown";
          lines.push(`${m.id} — applied ${ts}`);
        }
        lines.push("");
      }

      res.json({
        schema: lines.join("\n"),
        generatedAt,
        tableCount: tableNames.length,
        totalRows,
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Route 2b: Recent rows for a table ────────────────────────
  const ALLOWED_TABLES = new Set([
    "scraped_jobs", "user_jobs", "domain_profiles", "usage_events", "scrape_events",
    "users", "user_job_searches", "resumes", "job_applications", "apply_runs",
    "apply_run_jobs", "apply_job_logs", "schema_migrations",
    "user_limits", "cache_events", "job_role_map", "user_job_views",
  ]);
  router.get("/table-rows/:table", requireAdmin, (req, res) => {
    const table = req.params.table;
    if (!ALLOWED_TABLES.has(table)) return res.status(400).json({ error: "Table not allowed" });
    try {
      res.json(redactRows(db.prepare(`SELECT * FROM "${table}" ORDER BY rowid DESC LIMIT 10`).all()));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get("/tables", requireAdmin, (_req, res) => {
    try {
      const tables = tableNames().map(name => {
        const rowCount = db.prepare(`SELECT COUNT(*) as c FROM "${name}"`).get().c;
        const columns = db.prepare(`PRAGMA table_info("${name}")`).all();
        return { name, rowCount, columns };
      });
      res.json({ tables });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get("/table-data/:table", requireAdmin, (req, res) => {
    const table = req.params.table;
    if (!assertReadableTable(table)) return res.status(400).json({ error: "Table not allowed" });
    try {
      const page = Math.max(1, parseInt(req.query.page || "1"));
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || "25")));
      const offset = (page - 1) * pageSize;
      const total = db.prepare(`SELECT COUNT(*) as c FROM "${table}"`).get().c;
      const columns = db.prepare(`PRAGMA table_info("${table}")`).all();
      // A51: ⛔ any table is browsable, so every row is redacted — password hashes, sealed secrets
      // and session ids never leave the server. NULL stays NULL, so "is it set?" still answers.
      const rows = redactRows(db.prepare(`SELECT * FROM "${table}" ORDER BY rowid DESC LIMIT ? OFFSET ?`)
        .all(pageSize, offset));
      res.json({
        table,
        columns,
        rows,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Route 3: User Pool Inspector ─────────────────────────────
  router.get("/user-pool/:userId", requireAdmin, (req, res) => {
    const userId = parseInt(req.params.userId);
    try {
      const activeProfile = db.prepare(
        "SELECT * FROM domain_profiles WHERE user_id = ? AND is_active = 1"
      ).get(userId);

      const allProfiles = db.prepare(`
        SELECT id, profile_name, role_family, domain, is_active, created_at
        FROM domain_profiles WHERE user_id = ?
        ORDER BY is_active DESC, created_at DESC
      `).all(userId);

      const poolBreakdown = db.prepare(`
        SELECT
          uj.domain_profile_id,
          dp.profile_name,
          COUNT(*) as job_count,
          COUNT(CASE WHEN dp.user_id != ? THEN 1 END) as wrong_user_count,
          COUNT(CASE WHEN uj.domain_profile_id IS NULL THEN 1 END) as null_tag_count
        FROM user_jobs uj
        LEFT JOIN domain_profiles dp ON dp.id = uj.domain_profile_id
        WHERE uj.user_id = ?
        GROUP BY uj.domain_profile_id
      `).all(userId, userId);

      const activeId = activeProfile?.id ?? -1;
      const sampleJobs = db.prepare(`
        SELECT sj.title, sj.company, sj.search_query,
          uj.domain_profile_id,
          dp.profile_name as tagged_to_profile,
          CASE
            WHEN uj.domain_profile_id IS NULL THEN 'NULL_TAG'
            WHEN dp.user_id != ? THEN 'WRONG_USER_PROFILE'
            WHEN sj.domain_profile_id IS NULL THEN 'SCRAPED_JOB_NULL_PROFILE'
            WHEN sj.domain_profile_id != uj.domain_profile_id THEN 'SCRAPED_USER_PROFILE_MISMATCH'
            WHEN uj.domain_profile_id != ? THEN 'WRONG_PROFILE_FOR_USER'
            ELSE 'CORRECT'
          END as status
        FROM user_jobs uj
        JOIN scraped_jobs sj ON sj.job_id = uj.job_id
        LEFT JOIN domain_profiles dp ON dp.id = uj.domain_profile_id
        WHERE uj.user_id = ?
        ORDER BY status DESC
        LIMIT 100
      `).all(userId, activeId, userId);

      const searches = db.prepare(
        "SELECT search_query, last_scraped_at FROM user_job_searches WHERE user_id = ?"
      ).all(userId);

      res.json({ activeProfile, allProfiles, poolBreakdown, sampleJobs, searches });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Route 4: Job Association Trace ───────────────────────────
  router.get("/job-trace/:jobId", requireAdmin, (req, res) => {
    const jobId = req.params.jobId;
    try {
      const scrapedJob = db.prepare("SELECT * FROM scraped_jobs WHERE job_id = ?").get(jobId);
      if (!scrapedJob) return res.status(404).json({ error: "Job not found" });

      const userJobs = db.prepare(`
        SELECT uj.*, u.username, dp.profile_name,
          dp.user_id as profile_owner_user_id
        FROM user_jobs uj
        JOIN users u ON u.id = uj.user_id
        LEFT JOIN domain_profiles dp ON dp.id = uj.domain_profile_id
        WHERE uj.job_id = ?
      `).all(jobId);

      const roleMappings = db.prepare(`
        SELECT * FROM job_role_map WHERE job_id = ? ORDER BY role_key
      `).all(jobId);

      let resumes = [];
      try {
        resumes = db.prepare("SELECT * FROM resumes WHERE job_id = ?").all(jobId);
      } catch {}

      const applications = db.prepare(`
        SELECT ja.*, u.username FROM job_applications ja
        JOIN users u ON u.id = ja.user_id
        WHERE ja.job_id = ?
      `).all(jobId);

      const domainProfile = scrapedJob.domain_profile_id
        ? db.prepare(`
            SELECT dp.*, u.username as owner_username
            FROM domain_profiles dp
            JOIN users u ON u.id = dp.user_id
            WHERE dp.id = ?
          `).get(scrapedJob.domain_profile_id)
        : null;

      const hasProfile = !!scrapedJob.domain_profile_id;
      const profileOwner = domainProfile?.owner_username ?? null;
      const usersWithJob = [...new Set(userJobs.map(uj => uj.username))];
      const issues = [];

      if (!hasProfile) {
        issues.push("Job has no domain_profile_id — may appear across multiple users via NULL fallback");
      }
      for (const uj of userJobs) {
        if (domainProfile && uj.profile_owner_user_id !== uj.user_id) {
          issues.push(
            `Job tagged to ${profileOwner}'s profile but in ${uj.username}'s user_jobs with wrong profile tag`
          );
        }
      }

      // A51: these are SELECT * / uj.* / ja.* rows — redacted like every other raw row the inspector returns.
      res.json({
        scraped_job: redactRow(scrapedJob),
        user_jobs: redactRows(userJobs),
        role_mappings: redactRows(roleMappings),
        resumes: redactRows(resumes),
        applications: redactRows(applications),
        domain_profile: redactRow(domainProfile),
        diagnosis: {
          hasProfile,
          profileOwner,
          usersWithJob,
          isCorrectlyIsolated: hasProfile && issues.length === 0,
          issues,
        },
        // A50 step 5: the posting end to end — crawl, gate, dedup, enrichment, scoring, captures,
        // drafts, records, submitted — every decision with its reason, in time order.
        lifecycle: traceJobLifecycle(db, jobId),
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Route 5: Query Simulator ──────────────────────────────────
  // Answers "why does user X not see job Y?" by running the REAL board query for that user.
  //
  // It used to hand-roll its own SQL: a 7-day posted_at/scraped_at cutoff the board stopped
  // applying at the pivot, plus applied/resume_generated exclusions, and it never touched
  // buildJobFilters at all. So the one tool an admin reaches for to explain a missing job was
  // describing a query the board no longer runs — worse than a dead endpoint, because it answers
  // confidently and wrongly. It now COMPOSES THE SAME FUNCTIONS /api/jobs uses
  // (roleKeyForProfile + profileTitleSql + deriveProfileFilters + buildJobFilters), so it cannot
  // drift from the board again without the board itself changing.
  router.get("/simulate-jobs/:userId", requireAdmin, (req, res) => {
    const userId = parseInt(req.params.userId);
    try {
      const activeProfile = db.prepare(
        "SELECT * FROM domain_profiles WHERE user_id = ? AND is_active = 1"
      ).get(userId);

      if (!activeProfile) {
        return res.json({
          activeProfile: null,
          totalJobsInPool: 0,
          jobsPassingAllFilters: 0,
          sampleResults: [],
          sampleFiltered: [],
          filterReasonCounts: {},
          conditions: ["No active profile — the board returns empty immediately"],
          derivedFilters: {},
          rawSql: "",
        });
      }

      const roleKey     = roleKeyForProfile(activeProfile);
      const titleFilter = profileTitleSql("sj.title", activeProfile);
      const signals     = loadSimpleApplyProfile(db, { userId, profileId: activeProfile.id });
      // The same bridge the board applies by default; ?curate=off mirrors its escape hatch.
      const derived     = req.query.curate === "off" ? {} : deriveProfileFilters(activeProfile, signals);
      const rich        = buildJobFilters(derived);

      // profileTitleSql returns { sql, params } with a BARE predicate (it is "1 = 1" when the
      // profile has no target titles), so it needs its own AND — and its params must be spliced
      // in SQL order, between the join placeholders and buildJobFilters' params.
      const base =
        "FROM scraped_jobs sj " +
        "JOIN job_role_map jrm ON jrm.job_id = sj.job_id AND jrm.role_key = ? " +
        "LEFT JOIN user_jobs uj ON uj.job_id = sj.job_id AND uj.user_id = ? " +
        "WHERE sj.is_active = 1 AND " + titleFilter.sql + " " + rich.sql + " " +
        "AND (uj.disliked IS NULL OR uj.disliked = 0)";
      const args = [roleKey, userId, ...titleFilter.params, ...rich.params];

      const totalJobsInPool = db.prepare(
        "SELECT COUNT(*) c FROM scraped_jobs sj " +
        "JOIN job_role_map jrm ON jrm.job_id = sj.job_id AND jrm.role_key = ? " +
        "WHERE sj.is_active = 1"
      ).get(roleKey).c;

      const jobsPassingAllFilters = db.prepare("SELECT COUNT(*) c " + base).get(...args).c;

      const sampleResults = db.prepare(
        "SELECT sj.job_id, sj.title, sj.company, sj.source, jrm.role_key, sj.posted_at, " +
        "sj.discovered_at, sj.enriched_at, " +
        "(sj.description IS NOT NULL AND TRIM(sj.description) != '') AS has_description " +
        base + " ORDER BY COALESCE(sj.discovered_at, sj.scraped_at) DESC LIMIT 20"
      ).all(...args);

      // Attribute each exclusion to a SPECIFIC clause. A count alone tells an admin a job is
      // missing but not which filter removed it, which is the entire question being asked.
      const poolRows = db.prepare(
        "SELECT sj.job_id, sj.title, sj.company, sj.source, uj.disliked FROM scraped_jobs sj " +
        "JOIN job_role_map jrm ON jrm.job_id = sj.job_id AND jrm.role_key = ? " +
        "LEFT JOIN user_jobs uj ON uj.job_id = sj.job_id AND uj.user_id = ? " +
        "WHERE sj.is_active = 1 LIMIT 2000"
      ).all(roleKey, userId);

      const passing = new Set(db.prepare("SELECT sj.job_id " + base).all(...args).map(r => r.job_id));
      const passingTitle = new Set(db.prepare(
        "SELECT sj.job_id FROM scraped_jobs sj " +
        "JOIN job_role_map jrm ON jrm.job_id = sj.job_id AND jrm.role_key = ? " +
        "WHERE sj.is_active = 1 AND " + titleFilter.sql
      ).all(roleKey, ...titleFilter.params).map(r => r.job_id));

      const sampleFiltered = [];
      const filterReasonCounts = {};
      for (const job of poolRows) {
        if (passing.has(job.job_id)) continue;
        const reason = job.disliked ? "disliked"
          : !passingTitle.has(job.job_id) ? "profile_title_filter"
          : "profile_derived_filters";
        filterReasonCounts[reason] = (filterReasonCounts[reason] || 0) + 1;
        if (sampleFiltered.length < 20) sampleFiltered.push({ ...job, filterReason: reason });
      }

      const conditions = [
        "sj.is_active = 1",
        `jrm.role_key = '${roleKey}'  — active profile: "${activeProfile.profile_name}"`,
        titleFilter.sql === "1 = 1"
          ? "profileTitleSql: 1 = 1 (profile has no target_titles — no title narrowing)"
          : `profileTitleSql: ${titleFilter.sql}`,
        Object.keys(derived).length
          ? `deriveProfileFilters -> ${JSON.stringify(derived)}`
          : "deriveProfileFilters -> {} (no stored signals, or ?curate=off)",
        "uj.disliked = 0",
        "NOTE: no date cutoff — the board has not applied one since the pivot.",
      ];

      return res.json({
        activeProfile,
        totalJobsInPool,
        jobsPassingAllFilters,
        sampleResults,
        sampleFiltered,
        filterReasonCounts,
        conditions,
        derivedFilters: derived,
        rawSql: "SELECT sj.* " + base + " ORDER BY COALESCE(sj.discovered_at, sj.scraped_at) DESC;",
        rawSqlParams: args,
      });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  });

  // ── Utility: Clean user pool ──────────────────────────────────
  // A51 (10-02): "Clean Pool" (POST /clean-user-pool/:userId) is REMOVED. Built 04-15 (bb0ceab) when
  // user_jobs was a per-user scraped pool, it ran DELETE FROM user_jobs for every row not applied and
  // not tagged to the active profile — no confirm, no dry run, no count. user_jobs now holds a user's
  // SAVES and PASSES (the persisted "never deal this again") on every profile, so one click re-dealt
  // passed jobs and wiped other profiles' decisions: the cleanup_log id-85 class of loss. Nothing
  // else called it, and there is no pool left to clean.

  // A58 (b): "Re-tag Pool" (POST /retag-user-pool/:userId) is REMOVED. Pre-pivot pool logic: it ran
  // UPDATE user_jobs SET domain_profile_id = <active> over one user's untagged rows, which can resurface a
  // Pass made under another profile onto this one. A user's Saves and Passes are theirs; no admin route
  // writes user_jobs (test/adminStopHarmII.test.js).
  //
  // A58 (e): POST /force-scrape is REMOVED. It started an Apify crawl on a USER'S OWN apify_token against
  // their active profile — spending their account — and nothing called it (no UI, script or extension).
  // External scraping is retired; ingestion is the ATS crawl.

  // ── Utility: Raw read-only query ──────────────────────────────
  router.get("/raw-query", requireAdmin, (req, res) => {
    const sql = (req.query.sql || "").trim();
    if (!sql) return res.status(400).json({ error: "sql param required" });
    // Defence in depth only — ⛔ the READ-ONLY CONNECTION is the guard (A51). ATTACH stays refused
    // here because a read-only ATTACH can still READ another database file on the server.
    if (/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|REPLACE|ATTACH|DETACH|VACUUM)\b/i.test(sql)) {
      return res.status(400).json({ error: "Only SELECT queries are allowed" });
    }
    const secrets = secretColumnsMentioned(sql);
    if (secrets.length) {
      return res.status(400).json({ error: `Credential columns cannot be queried here: ${secrets.join(", ")}` });
    }
    const conn = readOnlyDb();
    if (!conn) return res.status(503).json({ error: "No read-only connection is available for raw queries" });
    try {
      res.json(runReadOnlyQuery(conn, sql));
    } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
  });

  // ── Utility: Export table as CSV ──────────────────────────────
  const EXPORT_ALLOWED = new Set([
    "scraped_jobs", "user_jobs", "domain_profiles", "usage_events", "scrape_events",
    "job_role_map", "user_job_views", "apply_runs", "apply_run_jobs", "apply_job_logs",
  ]);
  router.get("/export/:table", requireAdmin, (req, res) => {
    const table = req.params.table;
    if (!EXPORT_ALLOWED.has(table)) {
      return res.status(400).json({ error: "Table not allowed for export" });
    }
    try {
      const rows = redactRows(db.prepare(`SELECT * FROM "${table}" LIMIT 100000`).all());
      if (!rows.length) { res.setHeader("Content-Type","text/csv"); return res.send(""); }
      const headers = Object.keys(rows[0]);
      const escape = v => {
        if (v == null) return "";
        const s = String(v);
        if (s.includes(",") || s.includes('"') || s.includes("\n"))
          return `"${s.replace(/"/g, '""')}"`;
        return s;
      };
      const csv = [headers.join(","), ...rows.map(r => headers.map(h => escape(r[h])).join(","))].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${table}.csv"`);
      res.send(csv);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
}
