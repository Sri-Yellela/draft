/**
 * BOARD ORDERING AND KEYSET PAGINATION — one definition, used for both.
 * ================================================================================================
 *
 * WHY OFFSET PAGING WAS WRONG HERE, AND IT IS NOT A PERFORMANCE ARGUMENT
 *
 * `LIMIT ? OFFSET ?` assumes the result set is STABLE between requests. The board is not, and the
 * swipe feed makes that structural rather than incidental: every dislike writes `disliked = 1`, and
 * the default board EXCLUDES disliked rows. So the set shrinks BEHIND the cursor while the user is
 * paging through it.
 *
 *   page 1 (offset 0, size 10)   rows 1..10       user swipes away 4 of them
 *   page 2 (offset 10)           was rows 11..20
 *                                is now rows 15..24    <- 11, 12, 13, 14 ARE NEVER SHOWN
 *
 * Four jobs vanished. Not filtered, not marked seen — skipped. The user never sees them, the count
 * still says they exist, and nothing reports the loss. A desktop board never hits this because it
 * does not mutate membership while paging; a swipe feed does nothing else.
 *
 * A keyset cursor asks a different question. Instead of "skip 10 rows" it asks "give me the rows
 * that sort strictly AFTER this one", anchored to the last row's own sort values. Deletions behind
 * the anchor cannot shift it, because the anchor is not a position — it is a value.
 *
 * THE PRECONDITION, AND WHY IT ALREADY HELD
 *
 * Keyset paging requires a TOTAL order: no two rows may tie on the full key list, or the cursor
 * cannot say where to resume. Every board sort already ends in `sj.job_id`, the primary key —
 * see test/boardOrderingTieBreak.test.js, which exists because the board once ordered by a bare
 * `scraped_at DESC` that tied across 1,275 rows. That fix is what makes this one possible, and the
 * dependency is now enforced rather than assumed (`assertTotalOrder` below).
 *
 * WHY THE ORDER BY MOVED HERE
 *
 * The cursor predicate must match the ORDER BY key-for-key and direction-for-direction. If they are
 * written twice they will disagree, and the failure is silent: a mismatched cursor does not error,
 * it just returns the wrong rows. That is the same defect shape as every other one this codebase
 * has hit — mapJobRow vs normalizeApiJob, three hardcoded tab lists, `tool` vs `toolType`.
 *
 * So the sorts are declared ONCE, as data, and both the ORDER BY string and the cursor predicate
 * are generated from that declaration. They cannot drift because there is nothing to drift from.
 */
"use strict";

// The band cutpoints, imported rather than restated: the fit keys below turn them into SQL, and a
// second copy of "Strong is 44" here would be free to disagree with the badge the card renders.
import { ATS_BAND_CUTPOINTS } from "../../shared/atsBands.js";

/** One ORDER BY term. `sql` may be any expression; `params` binds placeholders inside it. */
const KEY = (sql, dir = "ASC", params = []) => ({ sql, dir, params });
/** ⭐ D137 · 1 for a posting scored Likely not hiring (scraped_jobs.ghost_level 2), else 0. */
const GHOST_LAST_SQL = "(CASE WHEN sj.ghost_level >= 2 THEN 1 ELSE 0 END)";

/**
 * The "NULLs last" guard that precedes every keyed sort.
 *
 * It is a KEY in its own right, not a decoration, and that matters to the cursor: `(x IS NULL)` is
 * 0 or 1 and is never itself NULL, so it partitions the rows into a non-null group and a null group
 * before the comparison on `x` is ever reached. Within either group the comparison is well-defined.
 * Dropping it from the cursor key list — while leaving it in the ORDER BY — would resume in the
 * wrong partition.
 */
const NULLS_LAST = (sql) => KEY(`(${sql} IS NULL)`, "ASC");

// ── The orderings ────────────────────────────────────────────────────────────────────────────
//
// Transcribed from the strings these replace, term for term. The generated SQL is character-
// equivalent apart from an explicit `ASC` on the final job_id key, which was previously implicit.
//
// The leading key is discovered_at (FIRST SEEN), not scraped_at (last touched by a writer):
// upsertCanonicalJob rewrites scraped_at on every write, so the nightly crawl would otherwise sink
// every job that did not arrive in that batch — including a user's own import, measured at page 34
// of 34 minutes after they added it. COALESCE onto scraped_at because pre-pivot rows can lack
// discovered_at.
const RECENCY = [
  KEY("COALESCE(sj.discovered_at, sj.scraped_at)", "DESC"),
  NULLS_LAST("sj.posted_at"),
  KEY("sj.posted_at", "DESC"),
  KEY("sj.job_id", "ASC"),
];

// Undated postings stay last in BOTH directions: leading the "oldest" list with them would be an
// ordering by absence rather than by age.
const OLDEST = [
  KEY("COALESCE(sj.discovered_at, sj.scraped_at)", "ASC"),
  NULLS_LAST("sj.posted_at"),
  KEY("sj.posted_at", "ASC"),
  KEY("sj.job_id", "ASC"),
];

const LEVEL_RANK = `CASE sj.experience_level
        WHEN 'intern' THEN 0 WHEN 'entry' THEN 1 WHEN 'mid' THEN 2
        WHEN 'senior' THEN 3 WHEN 'lead' THEN 4 WHEN 'executive' THEN 5 END`;

// min_years_exp is written only by the extension capture, so on a crawled board it is entirely
// NULL and sorting on it alone would be a silent no-op. experience_level IS populated, by
// enrichment, from a fixed ordered vocabulary — so rank that, and let the precise number win
// wherever it exists.
const EXP = (dir) => [
  NULLS_LAST("sj.min_years_exp"),
  KEY("sj.min_years_exp", dir),
  NULLS_LAST(`(${LEVEL_RANK})`),
  KEY(`(${LEVEL_RANK})`, dir),
  ...RECENCY,
];

// ── FIT: position encodes fit (owner decision 2026-09-29) ─────────────────────────────────────
//
// The default board ranked by the derived rank keys and then by RECENCY, and on a real profile the
// rank keys leave hundreds of rows tied at MATCH — so inside the band a user actually reads, the
// order was "newest first" and said nothing about fit. The UI redesign makes position the primary
// fit signal ("band as position, not badge"), which is only true if the board sorts by it.
//
// Two keys, in this order, inserted between the rank keys and RECENCY:
//
//   1. the BAND ORDINAL — Strong 0, Moderate 1, NOT ESTABLISHED 2, Weak 3.
//   2. the score, DESC, so rows inside a band are ordered by the number the band was cut from.
//
// ⛔ NOT ESTABLISHED IS 2, BETWEEN MODERATE AND WEAK — NEVER LAST, AND NEVER COERCED TO A SCORE.
// A NULL `aor.ats_score` is either the scorer DECLINING (not enough signal in the posting — a
// correctness state, shared/atsBands.js) or a row not scored yet. Neither is a claim that the job
// is a poor fit, so neither may sort as one. This is the same rule the rank keys follow
// (jobQuery.js: "NOT ESTABLISHED ranks between, never at the bottom"): "we have not judged this"
// is not the same statement as "this does not match".
//
// THE BAND KEY IS ALSO THE NULL PARTITION, which is what keeps the cursor NULL-safe. Every NULL
// score lands in band 2 and no non-NULL score does, so inside any one band `aor.ats_score` is
// either entirely NULL or entirely non-NULL. Within band 2 the score comparison `<` yields NULL and
// the `IS` equality yields true, so the cursor falls through to RECENCY exactly as NULLS_LAST's
// partition makes it do on every other keyed sort. No `=` and no `IN` appears anywhere in the
// chain — cursorPredicate emits only `<`/`>` and `IS`.
//
// ⛔ THE CUTPOINTS ARE READ FROM shared/atsBands.js, the one definition the card's badge renders
// from. The CASE below is GENERATED from them, so a recalibrated cutpoint moves the order and the
// badge together; test/boardFitRanking.test.js sweeps every integer score and asserts this SQL and
// atsBandFor() agree.
//
// `aor` is the board query's LEFT JOIN of ats_only_reports for (caller, active profile) — the same
// alias SORT_KEYS.atsScore already sorts on, and the same row the card's matchScore is read from,
// so the band a card displays and the band it is sorted by are the same cell.
const FIT_SCORE_SQL = "aor.ats_score";
const FIT_BAND_ORDINAL = Object.freeze({ strong: 0, moderate: 1, not_established: 2, weak: 3 });
const FIT_BAND_SQL =
  `(CASE WHEN ${FIT_SCORE_SQL} IS NULL THEN ${FIT_BAND_ORDINAL.not_established}` +
  ` WHEN ${FIT_SCORE_SQL} >= ${Number(ATS_BAND_CUTPOINTS.strong)} THEN ${FIT_BAND_ORDINAL.strong}` +
  ` WHEN ${FIT_SCORE_SQL} >= ${Number(ATS_BAND_CUTPOINTS.moderate)} THEN ${FIT_BAND_ORDINAL.moderate}` +
  ` ELSE ${FIT_BAND_ORDINAL.weak} END)`;
const FIT_KEYS = Object.freeze([
  KEY(FIT_BAND_SQL, "ASC"),
  KEY(FIT_SCORE_SQL, "DESC"),
]);

/**
 * Every sort the board offers, as key lists. Reconciled against shared/jobFilterOptions.js's SORTS
 * by test/filterOptionContract.test.js — an option with no entry here would silently fall through
 * to the default and read to the user as a dead control, which is what happened to compHigh,
 * compLow and dateAsc before they were implemented.
 */
// ── D24 · THE SORT PANEL'S TIE-BREAKS, AS KEY GROUPS ──────────────────────────────────────────
//
// shared/filterSentence.js's SORT_PANEL declares, per sort, the tie-break chain IN WORDS ("newest
// first", "then company A–Z", "best fit first") — because a coarse score ties hundreds of rows and
// those ties used to fall to whatever the next key happened to be, invisibly. Each phrase is ONE key
// group here, and test/d24FitFacetsSorts.test.js asserts every panel sort is exactly
//     [its primary key(s), ...the groups its tieBreak names, in order, sj.job_id]
// so the words on the panel and the ORDER BY cannot drift apart.
//
//   "newest first"   — the Newest sort's own keys: first seen (discovered_at, onto scraped_at for
//                      pre-pivot rows), then the posting's own date with undated rows last.
//   "best fit first" — FIT_KEYS' two expressions (band ordinal with NOT ESTABLISHED between Moderate
//                      and Weak, then the score): the same "fit" the curated board leads with. NEW key
//                      objects, not FIT_KEYS itself — ordersByFit() tests identity, so a tie-break on
//                      fit does not read as "the board was ranked by fit" in the curation disclosure.
//   "company A–Z"    — case-insensitive (LOWER — ASCII folding, as SQLite does without ICU), with a
//                      NULL company last so the cursor never compares across the NULL partition.
const NEWEST = RECENCY.slice(0, -1);
const BEST_FIT = Object.freeze([KEY(FIT_BAND_SQL, "ASC"), KEY(FIT_SCORE_SQL, "DESC")]);
const COMPANY_AZ = Object.freeze([NULLS_LAST("sj.company"), KEY("LOWER(sj.company)", "ASC")]);
const BY_ID = KEY("sj.job_id", "ASC");
/** The panel's tie-break phrases -> key groups. "then " is prose, not a different key. */
const TIE_BREAK_KEYS = Object.freeze({
  "newest first":   NEWEST,
  "best fit first": BEST_FIT,
  "company A–Z":    COMPANY_AZ,
});
const tieBreakKeys = (phrase) => TIE_BREAK_KEYS[String(phrase).replace(/^then\s+/, "")];

const SORT_KEYS = {
  // ⛔ D24 · NEWEST IS NEWEST. An EXPLICIT dateDesc no longer gets the curated prefix (derived rank
  // keys + fit leading) — buildOrderKeys gives that to an ABSENT sort only. The panel's subtitle is
  // "Most recently posted first. Shows everything.", and with fit leading it was neither. Ties: best
  // fit first, then company A–Z.
  dateDesc:       [...NEWEST, ...BEST_FIT, ...COMPANY_AZ, BY_ID],
  dateAsc:        OLDEST,
  // ⛔ CC5 · THIS SORTED ON A COLUMN THAT IS NULL ON EVERY ROW, i.e. it was a dead control: the
  // NULLS_LAST key was equal for all 2,460 active rows and the order collapsed to RECENCY, so
  // picking "Best match" silently gave you "Newest". `sj.ats_score` was also the wrong column even
  // when populated — one cell per JOB, written from whichever user's résumé triggered the crawl.
  //
  // It now sorts on `aor.ats_score`, the caller's OWN cached score for their active profile
  // (migration 108). Rows they have never had scored still sort last, which is honest: the control
  // orders what it actually knows and says nothing about the rest.
  //
  // ⛔ IT IS NOT SCORED PER REQUEST, AND THAT IS MEASURED RATHER THAN ASSUMED. Scoring the whole
  // board to sort it costs 2,458 rows x 6.67ms = 16.4 SECONDS. A cache read is the only affordable
  // source, so the sort is only as complete as the user's own history — stated here so nobody
  // reads a short "Best match" list as a bug.
  //
  // `aor` is the board query's own LEFT JOIN alias. Every other key here is `sj.`-prefixed for the
  // same reason: these expressions are written against the caller's aliases, and buildOrderKeys has
  // exactly one caller (server.js's board), which defines both.
  //
  // D24 · unscored rows LAST (the NULLS_LAST key — SORT_PANEL's `unscoredLast: true`), and ties
  // newest first, then company A–Z: a score is coarse, so ties are the common case, not the edge.
  atsScore:       [NULLS_LAST("aor.ats_score"),      KEY("aor.ats_score", "DESC"),      ...NEWEST, ...COMPANY_AZ, BY_ID],
  applicantCount: [NULLS_LAST("sj.applicant_count"), KEY("sj.applicant_count", "ASC"),  ...RECENCY],
  // D24 · "no stated pay sorts last" is the NULLS_LAST key; ties newest first, then company A–Z.
  // D71 · the provider's figure, else the posting text's USD-per-year estimate (migration 141).
  compHigh:       [NULLS_LAST("COALESCE(sj.salary_max, sj.pay_text_max_usd)"), KEY("COALESCE(sj.salary_max, sj.pay_text_max_usd)", "DESC"), ...NEWEST, ...COMPANY_AZ, BY_ID],
  // D24 · new. Ties newest first; job_id makes it total.
  companyAsc:     [...COMPANY_AZ, ...NEWEST, BY_ID],
  compLow:        [NULLS_LAST("COALESCE(sj.salary_min, sj.pay_text_min_usd)"), KEY("COALESCE(sj.salary_min, sj.pay_text_min_usd)", "ASC"), ...RECENCY],
  yoeLow:         EXP("ASC"),
  yoeHigh:        EXP("DESC"),
};

/** The column the ordering is guaranteed to end on. Nothing here works without it. */
const TOTAL_ORDER_COLUMN = "sj.job_id";

/**
 * Fail loudly rather than paginate wrongly.
 *
 * If a future sort is added that does NOT end in the primary key, its order is not total: rows tie,
 * SQLite is free to return a tie group in any order between queries, and a cursor built on it will
 * both repeat and skip rows — silently, because there is no error to raise at read time. Checking
 * it here turns that into a startup-time throw.
 */
function assertTotalOrder(keys, label) {
  const last = keys[keys.length - 1];
  if (!last || last.sql !== TOTAL_ORDER_COLUMN) {
    throw new Error(
      `sort "${label}" does not end in ${TOTAL_ORDER_COLUMN}, so its order is not total and a ` +
      `keyset cursor over it would repeat and skip rows`);
  }
  return keys;
}
for (const [name, keys] of Object.entries(SORT_KEYS)) assertTotalOrder(keys, name);

/**
 * The full key list for a request: the derived profile-relevance prefix (default sort only), then
 * — when `fit` is asked for, default sort only — the fit keys, then the chosen sort.
 *
 * WHY THE RANK KEYS LEAD FIT, AND NOT THE OTHER WAY ROUND. The rank keys are CC1's scope-shaped
 * ordering: `role_key` (in your declared bucket vs. not classified yet), `q`, target titles, the
 * bridge's skills and level windows. Putting fit first would let a Strong-scoring posting from an
 * explicitly mismatched window (say a skills MISS) jump above every in-window row, which undoes
 * the ordering CC1 bought and makes the "N further down" disclosure describe nothing. Fit resolves
 * what the rank keys leave TIED — which on a real profile is almost all of it. Measured, not
 * assumed: see the commit that introduced this block for the tie-group sizes and the graded-5
 * positions under both precedences.
 *
 * `rankKeys` are the INDIVIDUAL relevance expressions, not the pre-joined ORDER BY fragment. The
 * cursor has to compare them one at a time, so it needs them separately — which is why
 * buildJobFilters now exports `rank.keys` alongside `rank.sql`, with `rank.sql` derived FROM
 * `rank.keys` so the two cannot disagree.
 *
 * Relevance leads the DEFAULT order only. Choosing "Pay high to low" is a user-set instruction
 * about ORDER, so it wins outright; leaving the sort alone is not an instruction, so a derived key
 * may lead there. The client always sends a sort and its initial value is 'dateDesc', so absence
 * and 'dateDesc' are the same state.
 *
 * Fit follows the same rule for the same reason: it is derived, so it may lead only where the user
 * has not chosen an order. "Best match" (atsScore) is the explicit way to ask for score order
 * across the whole board.
 *
 * `fit` is opt-in per call because only the caller knows whether the `aor` join exists (the board
 * defines it; nothing else calls this) and whether ranking by the profile is wanted at all — the
 * Saved tab and `?curate=off` both say it is not.
 */
//
// ⭐ A72 · A SEARCH LEADS EVERYTHING. `search` is boardSearch.js's tier expression ({ sql, params }):
// 1 title starts with the term, 2 title contains it, 3 company or skill, 4 description only. A
// search is the user's explicit question, so its tier outranks the derived rank keys (dropped while
// searching — they answer "what suits my profile", not "what did I ask for"). Inside a tier, on the
// default sort, the FIT keys decide: ATS match, descending — the owner's tie-break, and the same two
// keys the default board already uses, so NOT ESTABLISHED keeps its place between Moderate and Weak.
// An explicit sort ("Pay high to low") replaces the fit tie-break and keeps the tier.
//
// ⭐ A73 · `established`: one key per filter the user SET on a soft-null column (jobQuery.js
// buildJobFilters' `established.keys`, 0 = known to match, 1 = not classified yet). They follow a
// search tier and lead everything else, on EVERY sort — the user asked for Remote, so the rows known
// to be remote come first whatever order they chose inside that.
//
// ⛔ D24 · THE CURATED DEFAULT IS AN *ABSENT* SORT, NO LONGER ALSO dateDesc. Until D24 "absence and
// 'dateDesc' are the same state" (above), so choosing Newest gave rank keys + fit first and the sort
// panel's "Most recently posted first" was false. Now an explicit sort is EXACTLY its SORT_KEYS chain
// (after a search tier and the A73 known-first keys, which are filter semantics and lead every sort),
// and the curated order (rank keys, fit, then newest, company A–Z, job_id) is what a request with NO
// `sort` gets: the daily deck's, and any client asking for "the board as curated for me".
const CURATED_TAIL = Object.freeze([...NEWEST, ...COMPANY_AZ, BY_ID]);
// ⭐ D112 item 6 · `ineligible`: services/jobEligibility.js ineligibleOrderKey — 1 when the posting's STORED
// requirements contradict an answer the user SET. It leads EVERY key, a search tier included: an ineligible
// posting goes to the end of the board, not of its page. null (nothing set) adds no key, so the order is unchanged.
// ⭐ D137 · `ghost`: true when the board holds any posting scored Likely not hiring — those are RANKED DOWN (after the
// eligible-first key, before everything else), never removed. false adds no key, so the order is unchanged.
// ⭐ D184 B-8 (45p): `skillTier` = services/jobs/skillTiers.js's key (jobs asking for more of the résumé's top skills first).
// It applies to the DEFAULT order only, with fit on, after the rank keys and before fit — so inside a tier the order is
// ATS match, then recency. Never under a search (the search's own relevance tier leads) or an explicit sort.
function buildOrderKeys(sort, rankKeys = [], { fit = false, search = null, established = [], ineligible = null, ghost = false, skillTier = null } = {}) {
  const lead = ineligible?.sql ? [KEY(ineligible.sql, "ASC", ineligible.params || [])] : [];
  if (ghost) lead.push(KEY(GHOST_LAST_SQL, "ASC"));
  const sortIsDefault = !SORT_KEYS[sort];
  const chosen = sortIsDefault ? CURATED_TAIL : SORT_KEYS[sort];
  const known = (established || []).map(k => KEY(k.sql, "ASC", k.params || []));
  if (search?.sql) {
    const tier = KEY(search.sql, "ASC", search.params || []);
    return assertTotalOrder([...lead, tier, ...known, ...(sortIsDefault ? FIT_KEYS : []), ...chosen], sort || "dateDesc");
  }
  const prefix = sortIsDefault
    ? rankKeys.map(k => KEY(`(${k.sql})`, "ASC", k.params || []))
    : [];
  const fitKeys = sortIsDefault && fit ? FIT_KEYS : [];
  const tier = sortIsDefault && fit && skillTier?.sql ? [KEY(skillTier.sql, "ASC", skillTier.params || [])] : [];
  return assertTotalOrder([...lead, ...known, ...prefix, ...tier, ...fitKeys, ...chosen], sort || "dateDesc");
}

/**
 * Did this key list order by fit? The board discloses it as `curation.rankedKeys` 'fit'.
 * ⛔ D24 · by IDENTITY with FIT_KEYS: Newest's "best fit first" tie-break carries the same SQL in its
 * own key objects (BEST_FIT), and a tie-break is not "the board was ranked by fit".
 */
function ordersByFit(keys) {
  return keys.includes(FIT_KEYS[0]);
}

/**
 * Does any key read the caller's score? Then the cursor must carry the fit EPOCH (below), because a
 * precompute pass rewrites that score while the user pages. Before D24 only the curated fit keys were
 * epoch-signed; the atsScore sort ordered by the same moving cell without it.
 */
function ordersByScore(keys) {
  return keys.some(k => k.sql.includes(FIT_SCORE_SQL));
}

/**
 * D24 · the fit FILTER (`fit_bands`): rows whose score falls in one of `bands`, cut at the same
 * ATS_BAND_CUTPOINTS as FIT_BAND_SQL and atsBandFor(). ⛔ HARD — a NULL score is in no band, so an
 * unscored row never matches "Strong" (or "Weak": unscored is not weak). Reads `aor`, the board's
 * LEFT JOIN of the caller's own ats_only_reports row, the same cell the atsScore sort orders by.
 * Returns a boolean SQL expression with no bound params, or null when no band is asked for.
 */
// A85 · `scoreSql` is the score to band: the board passes boardFitPrecompute's currentScoreSql, so a
// STALE stored score — one the badge would not show — is in no band, as an unscored row is. The raw
// cell remains the default only for callers with no basis to compare.
function fitBandsSql(bands, { scoreSql = FIT_SCORE_SQL } = {}) {
  const want = new Set((bands || []).map(String));
  const arms = [];
  const s = scoreSql;
  if (want.has("strong"))   arms.push(`${s} >= ${Number(ATS_BAND_CUTPOINTS.strong)}`);
  if (want.has("moderate")) arms.push(`(${s} >= ${Number(ATS_BAND_CUTPOINTS.moderate)} AND ${s} < ${Number(ATS_BAND_CUTPOINTS.strong)})`);
  if (want.has("weak"))     arms.push(`${s} < ${Number(ATS_BAND_CUTPOINTS.moderate)}`);
  if (!arms.length) return null;
  return `(${s} IS NOT NULL AND (${arms.join(" OR ")}))`;
}

/** `expr DIR, expr DIR, ...` plus the params bound inside those expressions, in text order. */
function orderByClause(keys) {
  return {
    sql: keys.map(k => `${k.sql} ${k.dir}`).join(", "),
    params: keys.flatMap(k => k.params || []),
  };
}

/** Alias for the i-th sort key when projected into the SELECT. */
const cursorColumn = (i) => `__cursor_k${i}`;

/**
 * Project every sort key into the SELECT so the DATABASE computes the cursor's values.
 *
 * Deliberately not re-derived in JavaScript from the row. `COALESCE(discovered_at, scraped_at)` and
 * the experience-level CASE are SQL expressions; a JS reimplementation would be a second copy of
 * the ordering, which is the exact thing this module exists to prevent. Asking SQLite for the value
 * it actually sorted by makes the cursor correct by construction.
 */
function cursorProjection(keys) {
  return {
    sql: keys.map((k, i) => `, ${k.sql} AS ${cursorColumn(i)}`).join(""),
    params: keys.flatMap(k => k.params || []),
  };
}

/**
 * "Strictly after this row in this ordering", as a lexicographic expansion:
 *
 *     k0 OP v0
 *  OR (k0 IS v0 AND (k1 OP v1
 *  OR (k1 IS v1 AND (... kn OP vn))))
 *
 * OP is `>` for an ASC key and `<` for a DESC key.
 *
 * EQUALITY IS `IS`, NOT `=`, AND THAT IS LOAD-BEARING. SQLite's `=` yields NULL when either side is
 * NULL, so on a row whose posted_at is NULL the chain would evaluate to NULL — falsy — and the
 * cursor would silently stop mid-feed, reporting the end of the board partway down it. `IS` is
 * SQLite's null-safe equality: NULL IS NULL is true. The comparison operators keep `>`/`<`, where
 * NULL correctly yields "not after" and lets the next key decide.
 *
 * The final key is the primary key, so the deepest branch always resolves and no row can be
 * returned twice.
 */
function cursorPredicate(keys, values) {
  if (keys.length !== values.length) {
    throw new Error(`cursor has ${values.length} values but this ordering has ${keys.length} keys`);
  }
  const params = [];
  // Built from the innermost key outwards, then emitted outermost-first, so the params below land
  // in the same order the SQL text reads them — placeholder binding is positional, and getting this
  // backwards is the kind of bug that returns plausible-looking wrong rows.
  const build = (i) => {
    const k = keys[i];
    const op = k.dir === "DESC" ? "<" : ">";
    const after = `${k.sql} ${op} ?`;
    if (i === keys.length - 1) return { sql: after, params: [...(k.params || []), values[i]] };
    const rest = build(i + 1);
    return {
      sql: `(${after} OR (${k.sql} IS ? AND ${rest.sql}))`,
      params: [
        ...(k.params || []), values[i],      // the OP comparison
        ...(k.params || []), values[i],      // the IS equality
        ...rest.params,
      ],
    };
  };
  const built = build(0);
  params.push(...built.params);
  return { sql: built.sql, params };
}

/**
 * A cursor is opaque to the client and self-describing to the server.
 *
 * It carries a SIGNATURE of the ordering it was issued for. Reusing a cursor after changing the
 * sort — or after the profile's derived relevance changed, which alters the rank keys — would
 * otherwise resume against a different ordering and return an arbitrary slice with no error. The
 * signature turns that into a 400 the client can act on: re-request the first page.
 */
//
// ⛔ THE FIT EPOCH. Every other key a cursor resumes on is effectively immutable while a user pages
// (discovered_at, the rank keys' inputs, job_id). The fit keys are not: a precompute pass rewrites
// the scores they sort on. A keyset cursor over a key that moves under it silently skips a row
// that moved from ahead of the anchor to behind it, and repeats one that moved the other way —
// measured, one row lost in a 681-row walk. So when the ordering includes fit, the signature also
// carries `epoch`, a value that changes whenever the caller's scores do (server.js passes the
// newest ats_only_reports row id for (user, profile)). A cursor that straddles a score change then
// fails loudly as `cursor_sort_mismatch` — the documented "request the first page again" — rather
// than returning a plausible feed with a hole in it.
//
// ⛔ A72 · THE BOUND PARAMETERS ARE PART OF THE ORDERING. A search tier is one SQL text for every
// term — the term is a `?` — so a signature of the text alone accepted a cursor issued for "ai" on a
// search for "ml" and resumed at a meaningless position. A key with params signs them too; a key
// without params signs exactly as before. (A cursor issued before this over a rank key WITH params
// is refused once as cursor_sort_mismatch — the documented "request the first page again".)
function orderSignature(keys, epoch = null) {
  const base = keys.map(k => (k.params?.length ? `${k.sql}|${k.dir}|${JSON.stringify(k.params)}` : `${k.sql}|${k.dir}`)).join("~~");
  return epoch == null ? base : `${base}~~epoch:${epoch}`;
}

function encodeCursor(keys, row, { epoch = null } = {}) {
  const values = keys.map((_, i) => row[cursorColumn(i)]);
  const payload = { v: 1, s: hashSignature(orderSignature(keys, epoch)), k: values };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

/**
 * @returns {{ ok: true, values: any[] } | { ok: false, error: string }}
 * Never throws on client input: a malformed cursor is a 400, not a 500.
 */
function decodeCursor(token, keys, { epoch = null } = {}) {
  let payload;
  try {
    payload = JSON.parse(Buffer.from(String(token), "base64url").toString("utf8"));
  } catch {
    return { ok: false, error: "cursor_malformed" };
  }
  if (!payload || payload.v !== 1 || !Array.isArray(payload.k)) {
    return { ok: false, error: "cursor_malformed" };
  }
  if (payload.s !== hashSignature(orderSignature(keys, epoch))) {
    return { ok: false, error: "cursor_sort_mismatch" };
  }
  if (payload.k.length !== keys.length) {
    return { ok: false, error: "cursor_sort_mismatch" };
  }
  return { ok: true, values: payload.k };
}

/** Short, stable, and not a security boundary — a cursor is not a capability. */
function hashSignature(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export {
  SORT_KEYS, RECENCY, OLDEST, TOTAL_ORDER_COLUMN,
  buildOrderKeys, orderByClause, cursorProjection, cursorPredicate,
  encodeCursor, decodeCursor, cursorColumn, orderSignature, assertTotalOrder,
  KEY, NULLS_LAST,
  FIT_KEYS, FIT_BAND_SQL, FIT_SCORE_SQL, FIT_BAND_ORDINAL, ordersByFit, ordersByScore, fitBandsSql,
  NEWEST, BEST_FIT, COMPANY_AZ, CURATED_TAIL, TIE_BREAK_KEYS, tieBreakKeys,
};
