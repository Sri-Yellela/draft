/**
 * D24 · GET /api/jobs/facets — THE COUNTS THE SENTENCE READS, AS THE BOARD WOULD ANSWER THEM.
 * ================================================================================================
 *
 * The response is shared/filterSentence.js's FacetsResponse, exactly:
 *
 *   { total, known, unscored, clauses: { level, where, posted, fit: FacetOption[] } }
 *   FacetOption = { value, label, count, known }
 *
 * where `count` is "rows the board would show with THIS option chosen in its clause and every OTHER
 * active filter as it is". The clause's own current choice is REPLACED, not added to.
 *
 * ⛔ THE COUNT MUST BE THE BOARD'S OWN ANSWER, NOT A SECOND OPINION. This module never writes a
 * WHERE clause for the board. It is handed `measureBoard(query, fn)`, which runs server.js's own
 * boardPageResponse for `query` up to the point the board's join / where / args exist and hands
 * them to `fn` — the identical bindings GET /api/jobs then counts and lists with. The per-option
 * conditions below are likewise the board's own fragments (buildJobFilters for the two soft-null
 * clauses, postedSinceSql for the posting age, fitBandsSql for fit), so
 *
 *     count(option) = |board(query without the clause)  ∩  the clause's own predicate for option|
 *                   = |board(query with the clause set to option)|
 *
 * holds by construction rather than by a parallel implementation agreeing. test/d24FitFacetsSorts
 * .test.js pins the equality against real queries, soft-null rows and a zero-count option included.
 *
 * COST: one statement for the headline (total / known / unscored) and ONE per clause — conditional
 * aggregation (`SUM(CASE WHEN <option> THEN 1 END)` per option) over that clause's base set — so
 * five statements whatever the option count, never one per option.
 */
import { EXPERIENCE_LEVELS, WORK_MODELS, POSTING_AGE, FIT_BANDS, labelFor } from "../../shared/jobFilterOptions.js";
import { FIRST_SEEN_SQL, FIRST_VISIT_SEC } from "../boardVisit.js";
import { buildJobFilters, postedSinceSql } from "./jobQuery.js";
import { fitBandsSql, FIT_SCORE_SQL } from "./jobCursor.js";
// D30 · the two open-set dials, over the D29 tag layer.
import { JOB_FUNCTIONS, PLACES } from "../../shared/jobTagVocabulary.js";
import { placesFilterSql, placeFacetCounts, LEVEL_SQL, WORKPLACE_SQL, EMPLOYMENT_SQL } from "./tagFilters.js";

// Paging and cursor are about WHICH SLICE of the board, never about how many rows it holds, and a
// facets request must not 400 on a cursor issued for a list. Projection params change no count.
const NOT_FILTERS = ["page", "pageSize", "page_size", "cursor", "include_fields", "include_facets"];

const strip = (sql) => String(sql).replace(/^\s*AND\s+/, "");

/** A soft-null clause's options: count = known match OR unclassified; known = known match only. */
function softNullOptions(dim) {
  return dim.options.filter(o => o.value !== "").map(o => {
    const f = buildJobFilters({ [dim.param]: [o.value] });
    const cond = strip(f.sql);
    return {
      value: o.value, label: o.label,
      count: { sql: cond, params: f.params },
      // Known = matches and is NOT kept only for being unclassified. The unclassified test is the
      // board's own (`established.unclassifiedSql`), so "known" here is the A73 `unclassified` count's
      // complement, from the same expression.
      known: { sql: `(${cond}) AND NOT ${f.established.unclassifiedSql}`, params: f.params },
    };
  });
}

/**
 * The six clauses (D30), in SENTENCE_CLAUSES' order, each with the params that encode its choice (all of
 * them are removed to form the clause's base set) and its options' predicates.
 */
export function facetClauses({ nowSec, visitSinceSec = null }) {
  return [
    // D30 · DOMAIN (the job function). Choosing one LIFTS the profile's role scope (server.js
    // functionChosen), so its base set is the board with the scope lifted and nothing narrowed —
    // every function named, soft-null keeping the unclassified — not the profile-scoped board.
    { key: "domain", remove: [JOB_FUNCTIONS.param],
      base: { [JOB_FUNCTIONS.param]: JOB_FUNCTIONS.options.map(o => o.value).join(",") },
      options: softNullOptions(JOB_FUNCTIONS) },
    { key: "level", remove: [EXPERIENCE_LEVELS.param], options: softNullOptions(EXPERIENCE_LEVELS) },
    // D30 · LOCATION, over the place set. The legacy free-text keys are removed with it: the clause's
    // own choice is replaced, whichever spelling it arrived in. known = matches a stated place.
    {
      key: "location",
      remove: [PLACES.param, "location", "locations"],
      options: PLACES.options.map(o => {
        const f = placesFilterSql([o.value]);
        return { value: o.value, label: o.label,
          count: { sql: f.sql, params: [] }, known: { sql: `(${f.sql}) AND NOT ${f.unknownSql}`, params: [] } };
      }),
      // ⚡ The SQL above is the definition; this is how it is COUNTED — the board's places read once and
      // placeFacetCounts applying the same rule per job, instead of 74 options × correlated EXISTS
      // (9–10 s per facets call, measured 10-06 (33)). test/placeFacetCounts.test.js holds them equal.
      compute: ({ db, joinClause, whereClause, baseArgs }) => {
        const byJob = new Map(db.prepare(`SELECT sj.job_id AS id ${joinClause} ${whereClause}`).all(...baseArgs).map(r => [r.id, []]));
        if (byJob.size) {
          for (const p of db.prepare(`SELECT p.job_id, p.country, p.state, p.metro FROM job_tag_places p
              WHERE p.job_id IN (SELECT sj.job_id ${joinClause} ${whereClause})`).all(...baseArgs)) {
            byJob.get(p.job_id)?.push(p);
          }
        }
        const counts = placeFacetCounts(byJob, PLACES.options.map(o => o.value));
        return Object.fromEntries(PLACES.options.flatMap((o, i) => [[`c${i}`, counts.get(o.value)?.count ?? 0], [`k${i}`, counts.get(o.value)?.known ?? 0]]));
      },
    },
    { key: "where", remove: [WORK_MODELS.param],       options: softNullOptions(WORK_MODELS) },
    {
      key: "posted",
      // The client's one age control emits BOTH (POSTING_AGE.derivedParam), so replacing the clause's
      // choice means removing both — leaving posted_after behind would cap every option at it.
      remove: [POSTING_AGE.param, POSTING_AGE.derivedParam],
      options: POSTING_AGE.options.map(o => {
        // D74 P1: "since your last visit" counts FIRST SEEN since the caller's previous visit (a day, when unknown).
        const p = o.sinceVisit ? { sql: FIRST_SEEN_SQL, params: [visitSinceSec ?? nowSec - FIRST_VISIT_SEC] }
          : o.days == null ? { sql: "1 = 1", params: [] } : postedSinceSql(nowSec - o.days * 86400);
        // Hard filter (a row's age is always known — it falls back to first-seen), so known === count.
        return { value: o.value, label: o.label, count: p, known: p };
      }),
    },
    {
      key: "fit",
      remove: [FIT_BANDS.param],
      options: FIT_BANDS.options.map(o => {
        // ⛔ A85 · banded on the CURRENT score the board hands the measure (ctx.fitScoreSql) — the one
        // the badge shows — so a stale stored score is counted in no band. Lazy for that reason.
        const p = (ctx) => ({ sql: fitBandsSql([o.value], { scoreSql: ctx?.fitScoreSql ?? FIT_SCORE_SQL }), params: [] });
        // ⛔ HARD: an unscored row is in no band, so known === count (filterSentence.js says so).
        return { value: o.value, label: labelFor(FIT_BANDS, o.value), count: p, known: p };
      }),
    },
  ];
}

const withoutKeys = (query, keys) => {
  const q = { ...query };
  for (const k of [...NOT_FILTERS, ...keys]) delete q[k];
  return q;
};

const EMPTY = (clauses) => ({
  total: 0, known: 0, unscored: 0,
  coverage: { level: 0, where: 0, employment: 0 }, views: { all: 0, saved: 0, pending: null, imported: 0 },
  clauses: Object.fromEntries(clauses.map(c => [c.key,
    c.options.map(o => ({ value: o.value, label: o.label, count: 0, known: 0 }))])),
});

/**
 * @param {object} deps
 * @param {object} deps.query         the request's query params — exactly what GET /api/jobs takes
 * @param {(query:object, fn:(ctx:{db, joinClause:string, whereClause:string, baseArgs:any[],
 *          unclassifiedSql:string}) => any) => Promise<{status:number, body:any}>} deps.measureBoard
 *        Runs the board's own query builder for `query`. When the board gets as far as a query it
 *        answers `{ status: 200, body: { measured: true, value: fn(ctx) } }`; anything else (a 400 for
 *        an unknown filter value, no profile, an empty pool) is passed through as the board said it.
 * @param {number} deps.nowSec        one clock for the whole response, shared with the board's
 *        ageFilter cutoff so "Past 24h" means the same second in both
 * @param {() => number} [deps.countPending]  D35 · the Pending view's row count (server.js's
 *        pendingJobsQuery, the /d list's own query, counted). Absent → `views.pending` is null.
 * @returns {Promise<{status:number, body:any}>}
 */
export async function boardFacetsResponse({ query, measureBoard, nowSec, countPending = null, visitSinceSec = null }) {
  const clauses = facetClauses({ nowSec, visitSinceSec });

  const head = await measureBoard(withoutKeys(query, []), ({ db, joinClause, whereClause, baseArgs, unclassifiedSql, fitScoreSql }) => {
    // A85 · "no score" means no CURRENT score — what the badge shows nothing for.
    const score = fitScoreSql ?? FIT_SCORE_SQL;
    const r = db.prepare(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN ${score} IS NULL THEN 1 ELSE 0 END), 0) AS unscored
              ${unclassifiedSql ? `, COALESCE(SUM(CASE WHEN ${unclassifiedSql} THEN 1 ELSE 0 END), 0) AS unclassified` : ""},
              COALESCE(SUM(CASE WHEN ${LEVEL_SQL} IS NOT NULL THEN 1 ELSE 0 END), 0) AS cov_level,
              COALESCE(SUM(CASE WHEN ${WORKPLACE_SQL} IS NOT NULL THEN 1 ELSE 0 END), 0) AS cov_where,
              COALESCE(SUM(CASE WHEN ${EMPLOYMENT_SQL} IS NOT NULL THEN 1 ELSE 0 END), 0) AS cov_employment
       ${joinClause} ${whereClause}`).get(...baseArgs);
    return {
      total: r.total, known: r.total - (r.unclassified || 0), unscored: r.unscored,
      // D35 · COVERAGE, LIVE: of `total`, the rows whose tag is ON FILE — the panels say
      // "47.5% coverage" and "3 postings have no level on file" from these, never from a constant.
      // Read through tagFilters.js's own expressions, so an untagged row counts its legacy column
      // exactly as the filter does.
      coverage: { level: r.cov_level, where: r.cov_where, employment: r.cov_employment },
    };
  });
  // A validation 400 is the board's own answer — same params, same validation, same body.
  if (head.status !== 200) return head;
  // No profile / empty pool: the board answers an explained empty list, so every count is 0.
  if (!head.body?.measured) return { status: 200, body: EMPTY(clauses) };

  // D35 · THE VIEW SEGMENT'S COUNTS — ALL · ★ · /d. ALL and ★ are the board's own count with the
  // Saved tab's `starred` param off and on (every other filter as it is); /d is the Pending list's own
  // query, counted (countPending). One COUNT each; null when it cannot be measured, never a guess.
  // D40: + is the same count with `imported` on — ALL restricted to the user's captures.
  // A91: /d likewise — the board's own count with `pending` on, so the /d count and the /d list are the
  // same question (countPending, the legacy query's count, is kept only as a fallback).
  const viewTotal = async (starred, imported = false, pendingView = false) => {
    const q = { ...withoutKeys(query, ["starred", "imported", "pending"]), ...(starred ? { starred: "1" } : {}),
                ...(imported ? { imported: "1" } : {}), ...(pendingView ? { pending: "1" } : {}) };
    const r = await measureBoard(q, ({ db, joinClause, whereClause, baseArgs }) =>
      db.prepare(`SELECT COUNT(*) AS n ${joinClause} ${whereClause}`).get(...baseArgs).n);
    return r.status === 200 && r.body?.measured ? r.body.value : (r.status === 200 ? 0 : null);
  };
  let pending = await viewTotal(false, false, true);
  if (!Number.isFinite(pending)) {
    try { pending = typeof countPending === "function" ? countPending() : null; } catch { pending = null; }
  }
  const views = { all: await viewTotal(false), saved: await viewTotal(true), pending: Number.isFinite(pending) ? pending : null,
                  imported: await viewTotal(false, true) };

  const body = { ...head.body.value, views, clauses: {} };
  for (const clause of clauses) {
    const baseQuery = { ...withoutKeys(query, clause.remove), ...(clause.base || {}) };
    const r = await measureBoard(baseQuery, (ctx) => {
      if (clause.compute) return clause.compute(ctx);
      const { db, joinClause, whereClause, baseArgs } = ctx;
      const cols = [], params = [];
      clause.options.forEach((o, i) => {
        const count = typeof o.count === "function" ? o.count(ctx) : o.count;
        const known = typeof o.known === "function" ? o.known(ctx) : o.known;
        cols.push(`COALESCE(SUM(CASE WHEN ${count.sql} THEN 1 ELSE 0 END), 0) AS c${i}`);
        params.push(...count.params);
        cols.push(`COALESCE(SUM(CASE WHEN ${known.sql} THEN 1 ELSE 0 END), 0) AS k${i}`);
        params.push(...known.params);
      });
      // PARAMETER ORDER IS SQL TEXT ORDER: the SELECT's option params, then the board's own.
      return db.prepare(`SELECT ${cols.join(", ")} ${joinClause} ${whereClause}`).get(...params, ...baseArgs);
    });
    if (r.status !== 200 || !r.body?.measured) return r.status !== 200 ? r : { status: 200, body: EMPTY(clauses) };
    body.clauses[clause.key] = clause.options.map((o, i) => ({
      value: o.value, label: o.label, count: r.body.value[`c${i}`], known: r.body.value[`k${i}`],
    }));
  }
  return { status: 200, body };
}
