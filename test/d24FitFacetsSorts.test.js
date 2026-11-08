// D24 — FULL HOUSE, THE SERVER HALF: the fit filter, the sort panel's tie-breaks, GET /api/jobs/facets.
//
// shared/filterSentence.js is the contract (written first, 217d140). This file makes it true on the
// server and pins it, in four parts:
//
//   1. FUNCTION BEFORE FORM — each filter the sentence uses, measured against a migrated in-memory
//      board: does choosing it change the rows, and how. This is where ageFilter was found filtering
//      on `scraped_at`, which every crawl rewrites (so "Past 24h" kept the whole re-crawled board).
//   2. THE FIT FILTER — fit_bands, HARD, cut at shared/atsBands.js's cutpoints, registered.
//   3. THE SORT PANEL — every SORT_PANEL sort is EXACTLY [primary, ...its declared tieBreak, job_id],
//      key for key, and in SQLite deliberately built ties resolve in that order, cursor-walkable.
//   4. FACETS — every count equals the count of the board with that option chosen, across several
//      combinations including soft-null rows and zero-count options; one statement per clause.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import {
  FILTER_DIMENSIONS, FIT_BANDS, EXPERIENCE_LEVELS, WORK_MODELS, POSTING_AGE, SORTS,
  invalidEntries, values, ageDays,
} from "../shared/jobFilterOptions.js";
import * as sentence from "../shared/filterSentence.js";
import { atsBandFor, ATS_BAND } from "../shared/atsBands.js";
import { buildJobFilters, postedSinceSql } from "../services/jobs/jobQuery.js";
import { FIRST_SEEN_SQL, FIRST_VISIT_SEC } from "../services/boardVisit.js";
import {
  SORT_KEYS, KEY, NULLS_LAST, NEWEST, BEST_FIT, COMPANY_AZ, CURATED_TAIL, FIT_KEYS, tieBreakKeys,
  buildOrderKeys, orderByClause, cursorProjection, cursorPredicate, encodeCursor, decodeCursor,
  ordersByFit, ordersByScore, fitBandsSql,
} from "../services/jobs/jobCursor.js";
import { boardFacetsResponse, facetClauses } from "../services/jobs/boardFacets.js";
import { at } from "../test-support/sourceAnchors.js";
import { placesFilterSql } from "../services/jobs/tagFilters.js";

const SERVER = fs.readFileSync("server.js", "utf8");
const USER = 41, PROFILE = 410, OTHER_USER = 42;
const NOW = 1_790_000_000;
const DAY = 86400;

function freshDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  for (const u of [USER, OTHER_USER]) {
    db.prepare("INSERT INTO users (id, username, password_hash) VALUES (?, ?, 'x')").run(u, `u${u}`);
  }
  db.prepare(`INSERT INTO domain_profiles
      (id, user_id, profile_name, role_family, domain, seniority, target_titles, selected_keywords,
       selected_verbs, selected_tools, is_active, created_at, updated_at, include_summary, generate_at_queue)
    VALUES (?, ?, 'Eng', 'engineering', 'engineering', 'mid', '[]', '[]', '[]', '[]', 1, 1, 1, 0, 0)`)
    .run(PROFILE, USER);
  return db;
}

/** A row as the crawl leaves it: scraped_at is "now" for every row the crawl touched. */
function insertJob(db, j) {
  db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, company, title, _hash, scraped_at, discovered_at,
                is_active, posted_at, experience_level, workplace_type, salary_max)
              VALUES (@id, 'q', @company, @title, @id, @scraped, @discovered, @active, @posted, @level, @where, @salary)`)
    .run({ company: "Acme", title: "Engineer", scraped: NOW, active: 1, posted: null, level: null, where: null,
           salary: null, discovered: NOW - DAY, ...j });
  if (j.score !== undefined) {
    db.prepare(`INSERT INTO ats_only_reports (user_id, domain_profile_id, job_id, ats_report, ats_score, scorer_version, scored_at)
                VALUES (?, ?, ?, '{}', ?, 'local', 1)`).run(USER, PROFILE, j.id, j.score);
  }
  // Another user's score on the same posting must never be read as this user's.
  if (j.otherScore !== undefined) {
    db.prepare(`INSERT INTO ats_only_reports (user_id, domain_profile_id, job_id, ats_report, ats_score, scorer_version, scored_at)
                VALUES (?, NULL, ?, '{}', ?, 'local', 1)`).run(OTHER_USER, j.id, j.otherScore);
  }
  if (j.disliked) {
    db.prepare("INSERT INTO user_jobs (user_id, job_id, domain_profile_id, disliked) VALUES (?, ?, ?, 1)").run(USER, j.id, PROFILE);
  }
}

const iso = (sec) => new Date(sec * 1000).toISOString();

// ── The board, as GET /api/jobs builds it for the four sentence clauses ─────────────────────────
//
// The same joins (user_jobs and the caller's OWN ats_only_reports row, by `IS` on the profile), the
// same is_active + dislike scope, and — the point — the SAME fragment builders server.js now calls:
// buildJobFilters for experience_levels / work_models / posted_after, postedSinceSql for ageFilter,
// fitBandsSql for fit_bands. The source pins at the bottom of this file hold server.js to that.
function boardSql(query, nowSec = NOW) {
  const join = `FROM scraped_jobs sj
    LEFT JOIN user_jobs uj ON uj.job_id = sj.job_id AND uj.user_id = ? AND uj.domain_profile_id = ?
    LEFT JOIN ats_only_reports aor ON aor.job_id = sj.job_id AND aor.user_id = ? AND aor.domain_profile_id IS ?`;
  const rich = buildJobFilters(query);
  let where = `WHERE sj.is_active = 1`;
  const args = [];
  const days = ageDays(query.ageFilter);
  if (query.ageFilter && days) {
    const since = postedSinceSql(nowSec - days * DAY);
    where += ` AND ${since.sql}`; args.push(...since.params);
  } else if (query.ageFilter === "visit") {
    // D74 P1, as server.js resolves it: FIRST SEEN since the previous visit — this fixture's user has none,
    // so the first-visit window (services/boardVisit.js).
    where += ` AND ${FIRST_SEEN_SQL}`; args.push(nowSec - FIRST_VISIT_SEC);
  }
  where += ` ${rich.sql}`; args.push(...rich.params);
  const bands = String(query.fit_bands || "").split(",").filter(Boolean);
  if (bands.length) where += ` AND ${fitBandsSql(bands)}`;
  // A91: /d is the board restricted by its predicate — the harness's stand-in is "a job this user starred".
  if (query.pending === "1") where += " AND uj.starred = 1";
  where += ` AND (uj.disliked IS NULL OR uj.disliked = 0)`;
  return { joinClause: join, whereClause: where, baseArgs: [USER, PROFILE, USER, PROFILE, ...args],
           unclassifiedSql: rich.established.unclassifiedSql, established: rich.established.keys };
}
const boardIds = (db, query, sort) => {
  const b = boardSql(query);
  // The A73 known-first keys lead every sort, exactly as server.js passes them.
  const order = orderByClause(buildOrderKeys(sort, [], { established: b.established }));
  return db.prepare(`SELECT sj.job_id ${b.joinClause} ${b.whereClause} ORDER BY ${order.sql}`)
    .all(...b.baseArgs, ...order.params).map(r => r.job_id);
};
const boardCount = (db, query) => {
  const b = boardSql(query);
  return db.prepare(`SELECT COUNT(*) n ${b.joinClause} ${b.whereClause}`).get(...b.baseArgs).n;
};
// What server.js's `measure` hook hands boardFacets: the board's bindings for `query`, and a 400 for
// an unknown value exactly as rejectInvalidFilterValues answers it.
const measureFor = (db, calls = []) => async (query, measure) => {
  calls.push(query);
  for (const [name, dim] of Object.entries(FILTER_DIMENSIONS)) {
    for (const key of [dim.param, dim.excludeParam, dim.legacyParam].filter(Boolean)) {
      const bad = invalidEntries(dim, query[key]);
      if (bad.length) return { status: 400, body: { success: false, error: `Unknown ${name} value for "${key}": ${bad.join(", ")}`, jobs: [], total: 0 } };
    }
  }
  return { status: 200, body: { measured: true, value: await measure({ db, ...boardSql(query) }) } };
};

// ═══ 1 · FUNCTION BEFORE FORM ═══════════════════════════════════════════════════════════════════

test("① experience_levels WORKS (soft-null): explicit level drops the mismatch, keeps unclassified, known first", () => {
  const db = freshDb();
  insertJob(db, { id: "sen",  level: "senior", discovered: NOW - 5 * DAY });
  insertJob(db, { id: "mid",  level: "mid" });
  insertJob(db, { id: "null", level: null });
  const ids = boardIds(db, { experience_levels: "senior" }, "dateDesc");
  assert.deepEqual(ids, ["sen", "null"], "known senior leads even though older; the classified mismatch is gone");
  assert.equal(boardCount(db, {}), 3);
});

test("① work_models WORKS (soft-null) — the same shape on sj.workplace_type, never sj.work_type", () => {
  const db = freshDb();
  insertJob(db, { id: "rem", where: "remote", discovered: NOW - 9 * DAY });
  insertJob(db, { id: "ons", where: "onsite" });
  insertJob(db, { id: "unk", where: null });
  assert.deepEqual(boardIds(db, { work_models: "remote" }, "dateDesc"), ["rem", "unk"]);
  assert.match(buildJobFilters({ work_models: "remote" }).sql, /sj\.workplace_type/);
});

test("① ⛔ ageFilter WAS FILTERING ON scraped_at, which every crawl rewrites — 'Past 24h' kept a 60-day-old posting", () => {
  const db = freshDb();
  // Both re-seen by this morning's crawl (scraped_at = NOW). One was posted 60 days ago.
  insertJob(db, { id: "old", posted: iso(NOW - 60 * DAY), discovered: NOW - 60 * DAY });
  insertJob(db, { id: "new", posted: iso(NOW - 3600),     discovered: NOW - 3600 });
  // Undated, first seen 40 days ago: its age is when we first saw it, not when we last touched it.
  insertJob(db, { id: "undated-old", posted: null, discovered: NOW - 40 * DAY });
  const cutoff = NOW - 1 * DAY;
  const old = db.prepare("SELECT job_id FROM scraped_jobs sj WHERE sj.scraped_at >= ? ORDER BY job_id").all(cutoff).map(r => r.job_id);
  assert.deepEqual(old, ["new", "old", "undated-old"], "the pre-D24 clause kept every re-crawled row — the defect, measured");
  // Now the same param through the board: only the posting actually posted in the last day.
  assert.deepEqual(boardIds(db, { ageFilter: "1d" }, "dateDesc"), ["new"]);
  assert.deepEqual(boardIds(db, { ageFilter: "1m" }, "dateDesc"), ["new"]);
  assert.deepEqual(boardIds(db, { ageFilter: "" }, "dateDesc").sort(), ["new", "old", "undated-old"]);
  // posted_after (the param the web client derives from the same pill) applies the SAME predicate.
  assert.deepEqual(boardIds(db, { posted_after: cutoff }, "dateDesc"), ["new"]);
  // And server.js no longer carries the scraped_at clause for it.
  const age = SERVER.slice(at(SERVER, "const AGE_MAP = ageDaysMap();"), at(SERVER, "const fitBandSql"));
  assert.doesNotMatch(age, /ageSql\s*=\s*`AND sj\.scraped_at/, "ageFilter is back on scraped_at");
  assert.match(age, /postedSinceSql\(/, "ageFilter must apply the shared posted-within predicate");
});

test("① fit WAS NEVER WIRED — fit_bands was no param at all; now it is a registered, validated dimension", () => {
  assert.equal(FILTER_DIMENSIONS.fitBand, FIT_BANDS);
  assert.deepEqual(values(FIT_BANDS), ["strong", "moderate", "weak"]);
  assert.deepEqual(invalidEntries(FIT_BANDS, "strong,great"), ["great"], "an unknown band is named, so the board 400s");
  assert.deepEqual(invalidEntries(FIT_BANDS, "not_enough_signal"), ["not_enough_signal"],
    "'no signal' is the ABSENCE of a band — not a value anyone filters for");
  // ⛔ The contract's own FIT_BANDS (filterSentence.js imports jobFilterOptions.js, so the registry
  // cannot import it back without an ES-module cycle) must be the same definition.
  assert.deepEqual(sentence.FIT_BANDS, FIT_BANDS);
  assert.equal(sentence.SENTENCE_CLAUSES.find(c => c.key === "fit").dim.param, FIT_BANDS.param);
});

// ═══ 2 · THE FIT FILTER ═════════════════════════════════════════════════════════════════════════

test("② fitBandsSql cuts exactly where atsBandFor does, on every score; NULL is in NO band", () => {
  const db = new Database(":memory:");
  const inBand = (band, s) => db.prepare(`SELECT ${fitBandsSql([band])} AS m FROM (SELECT ? AS ats_score) AS aor`).get(s).m === 1;
  for (let s = -5; s <= 110; s++) {
    for (const band of values(FIT_BANDS)) {
      assert.equal(inBand(band, s), atsBandFor(s) === band, `score ${s}, band ${band}`);
    }
  }
  for (const band of values(FIT_BANDS)) assert.equal(inBand(band, null), false, `NULL is not ${band}`);
  assert.equal(fitBandsSql([]), null);
  const src = fs.readFileSync("services/jobs/jobCursor.js", "utf8");
  assert.doesNotMatch(src.slice(at(src, "function fitBandsSql"), at(src, "export {")), /\b(44|26)\b/,
    "the cutpoints come from ATS_BAND_CUTPOINTS, not a restated literal");
});

test("② the fit filter is HARD and reads the caller's OWN score: unscored and another user's score never match", () => {
  const db = freshDb();
  insertJob(db, { id: "strong", score: 60 });
  insertJob(db, { id: "mod",    score: 30 });
  insertJob(db, { id: "weak",   score: 5 });
  insertJob(db, { id: "none" });                              // unscored for this user
  insertJob(db, { id: "theirs", otherScore: 90 });            // Strong — for somebody else
  assert.deepEqual(boardIds(db, { fit_bands: "strong" }, "atsScore"), ["strong"]);
  assert.deepEqual(boardIds(db, { fit_bands: "weak" }, "atsScore"), ["weak"], "unscored is not weak");
  assert.deepEqual(boardIds(db, { fit_bands: "strong,moderate" }, "atsScore"), ["strong", "mod"]);
  assert.equal(boardCount(db, {}), 5, "no fit filter, no narrowing");
  // Server wiring: parsed from the request, spliced into the WHERE the count and the list share.
  const handler = SERVER.slice(at(SERVER, "async function boardPageResponse("));
  // A85: banded on the CURRENT score (the badge's), not the raw stored cell.
  assert.match(handler, /const fitBandSql = fitBands\.length \? `AND \$\{fitBandsSql\(fitBands, \{ scoreSql: fitScoreSql \}\)\}` : '';/);
  const where = handler.slice(at(handler, "const whereClauseFor = (rich, { gate = true } = {}) =>"), at(handler, "const argsFor = (rich) =>"));
  assert.match(where, /\$\{rich\.sql\}\s*\n?\s*\$\{fitBandSql\}/, "fit_bands is not in the board's WHERE");
});

// ═══ 3 · THE SORT PANEL ═════════════════════════════════════════════════════════════════════════

const PRIMARY = {
  atsScore:   [NULLS_LAST("aor.ats_score"), KEY("aor.ats_score", "DESC")],
  dateDesc:   [...NEWEST],
  // D71: the provider's figure, else the posting text's USD-per-year estimate.
  compHigh:   [NULLS_LAST("COALESCE(sj.salary_max, sj.pay_text_max_usd)"), KEY("COALESCE(sj.salary_max, sj.pay_text_max_usd)", "DESC")],
  companyAsc: [...COMPANY_AZ],
};
const shape = (keys) => keys.map(k => `${k.sql} ${k.dir}`);

test("③ every SORT_PANEL sort is EXACTLY [primary, ...its declared tieBreak, job_id] — the words are the ORDER BY", () => {
  assert.deepEqual(sentence.SORT_PANEL.map(s => s.value).sort(), Object.keys(PRIMARY).sort());
  for (const s of sentence.SORT_PANEL) {
    assert.ok(values(SORTS).includes(s.value), `${s.value} is not an offered sort`);
    const groups = s.tieBreak.map(phrase => {
      const g = tieBreakKeys(phrase);
      assert.ok(g, `tie-break "${phrase}" (${s.value}) has no key group — the panel would promise an order nothing implements`);
      return g;
    });
    const expected = [...PRIMARY[s.value], ...groups.flat(), KEY("sj.job_id", "ASC")];
    assert.deepEqual(shape(SORT_KEYS[s.value]), shape(expected), `${s.value} is not ordered by exactly its declared chain`);
    // An explicit panel sort gets no curated prefix (no derived rank keys, no leading fit).
    const keys = buildOrderKeys(s.value, [{ sql: "0", params: [] }], { fit: true });
    assert.deepEqual(shape(keys), shape(expected), `${s.value} picked up a prefix it does not declare`);
    assert.ok(!ordersByFit(keys), `${s.value} would disclose 'fit' ranking it did not do`);
  }
  // Best fit: unscored LAST (unscoredLast: true) is the NULLS_LAST key leading it.
  assert.equal(sentence.SORT_PANEL.find(s => s.value === "atsScore").unscoredLast, true);
  assert.equal(SORT_KEYS.atsScore[0].sql, "(aor.ats_score IS NULL)");
  // The curated board is an ABSENT sort: rank keys, fit, then newest, company A–Z, job_id.
  const curated = buildOrderKeys("", [{ sql: "0", params: [] }], { fit: true });
  assert.ok(ordersByFit(curated));
  assert.deepEqual(shape(curated.slice(-CURATED_TAIL.length)), shape(CURATED_TAIL));
  // Every key that reads the score signs the cursor with the fit epoch (server.js), Best fit included.
  for (const v of ["atsScore", "dateDesc"]) assert.ok(ordersByScore(SORT_KEYS[v]), v);
  assert.ok(!ordersByScore(SORT_KEYS.companyAsc));
  assert.match(SERVER, /const fitEpoch = ordersByScore\(orderKeys\)/);
});

test("③ ⭐ in SQLite, deliberate ties resolve in the declared order, and a cursor walks every row once", () => {
  const db = freshDb();
  const T = NOW - 10 * DAY;
  // Ties built on purpose: equal scores, equal discovery times, equal salaries, companies differing
  // only in case, unscored and unpaid rows, a NULL-able posted_at.
  const rows = [
    { id: "a1", company: "beta",  score: 50, discovered: T,       salary: 200 },
    { id: "a2", company: "Alpha", score: 50, discovered: T,       salary: 200 },
    { id: "a3", company: "alpha", score: 50, discovered: T,       salary: 200 },
    { id: "a4", company: "Gamma", score: 50, discovered: T + 100, salary: null },
    { id: "a5", company: "Alpha", score: 30, discovered: T + 100, salary: 150 },
    { id: "a6", company: "Delta",            discovered: T + 100, salary: 200 },   // unscored
    { id: "a7", company: "Delta",            discovered: T,       salary: null },  // unscored
    { id: "a8", company: "Alpha", score: 10, discovered: T,       salary: 150 },
  ];
  for (const r of rows) insertJob(db, r);
  const expected = {
    // unscored last; 50s: newest first (a4), then T: company A–Z case-insensitive (a2/a3 tie on
    // 'alpha' -> job_id), then beta.
    atsScore:   ["a4", "a2", "a3", "a1", "a5", "a8", "a6", "a7"],
    // newest first: T+100 {a4 Strong, a5 Moderate, a6 unscored} — best fit: Strong, Moderate, then
    // NOT ESTABLISHED between Moderate and Weak; T: a1,a2,a3 (Strong; company), a7 (unscored), a8 (Weak).
    dateDesc:   ["a4", "a5", "a6", "a2", "a3", "a1", "a7", "a8"],
    // pay desc, no stated pay last; 200s: newest (a6) then company (Alpha a2,a3; beta a1).
    compHigh:   ["a6", "a2", "a3", "a1", "a5", "a8", "a4", "a7"],
    // company A–Z; inside Alpha newest first (a5) then job_id.
    companyAsc: ["a5", "a2", "a3", "a8", "a1", "a6", "a7", "a4"],
  };
  for (const [sort, ids] of Object.entries(expected)) {
    assert.deepEqual(boardIds(db, {}, sort), ids, `${sort}`);
    // The order is TOTAL: a keyset walk two rows at a time returns every row exactly once, in order.
    const keys = buildOrderKeys(sort, [], {});
    const b = boardSql({});
    const proj = cursorProjection(keys), order = orderByClause(keys);
    const seen = []; let cur = null;
    for (let guard = 0; guard < 20; guard++) {
      const pred = cur ? cursorPredicate(keys, decodeCursor(cur, keys).values) : { sql: "", params: [] };
      const page = db.prepare(`SELECT sj.job_id ${proj.sql} ${b.joinClause} ${b.whereClause} ${pred.sql ? `AND ${pred.sql}` : ""}
                               ORDER BY ${order.sql} LIMIT 3`).all(...proj.params, ...b.baseArgs, ...pred.params, ...order.params);
      const two = page.slice(0, 2);
      seen.push(...two.map(r => r.job_id));
      if (page.length <= 2) break;
      cur = encodeCursor(keys, two[1]);
    }
    assert.deepEqual(seen, ids, `${sort}: the cursor walk disagrees with the ORDER BY`);
  }
});

// ═══ 4 · FACETS ═════════════════════════════════════════════════════════════════════════════════

function facetFixture() {
  const db = freshDb();
  const lv = ["senior", "mid", null, "entry"], wm = ["remote", "onsite", null, "hybrid"];
  const ages = [0.2, 1.5, 2.5, 5, 20, 60];
  let n = 0;
  for (const level of lv) for (const where of wm) for (const age of ages) {
    n++;
    const id = `j${String(n).padStart(3, "0")}`;
    // Scores: strong rows are ONSITE only, so "remote + Strong" is a genuine zero; every fourth row
    // is unscored; one in seven is undated (age = first seen).
    const score = n % 4 === 0 ? undefined : where === "onsite" ? 60 : (n % 3 === 0 ? 30 : 8);
    const dated = n % 7 !== 0;
    insertJob(db, {
      id, level, where, score,
      company: ["Acme", "beta", "Core"][n % 3],
      posted: dated ? iso(NOW - age * DAY) : null,
      discovered: NOW - age * DAY,
      disliked: n % 11 === 0,
      active: n % 13 === 0 ? 0 : 1,
    });
  }
  return db;
}

// Every clause's options, rebuilt as the query a user would send by CHOOSING that option.
function chosen(query, clauseKey, value) {
  const q = { ...query };
  const dim = sentence.SENTENCE_CLAUSES.find(c => c.key === clauseKey).dim;
  delete q[dim.param]; if (dim.derivedParam) delete q[dim.derivedParam];
  if (value !== "") q[dim.param] = value;
  return q;
}

const COMBOS = [
  {},
  { experience_levels: "senior" },
  { experience_levels: "senior,mid", work_models: "remote" },
  { work_models: "remote", fit_bands: "strong" },
  { ageFilter: "1w", fit_bands: "moderate,weak" },
  { experience_levels: "entry", work_models: "hybrid", ageFilter: "3d", fit_bands: "weak" },
  { ageFilter: "1m", posted_after: String(NOW - 30 * DAY), work_models: "onsite" },
];

test("④ ⭐ every facet count IS the board's count with that option chosen — across combinations, soft-null and zero included", async () => {
  const db = facetFixture();
  let zeros = 0, softNullGaps = 0, checked = 0;
  for (const query of COMBOS) {
    const { status, body } = await boardFacetsResponse({ query, nowSec: NOW, measureBoard: measureFor(db) });
    assert.equal(status, 200);
    // Exactly the FacetsResponse shape (D35 added `coverage` and `views`, additively).
    assert.deepEqual(Object.keys(body).sort(), ["clauses", "coverage", "known", "total", "unscored", "views"]);
    // D179 (a) (45l, on purpose): + the role (Category → Subcategory), the facets' one clause the domain word reads.
    assert.deepEqual(Object.keys(body.clauses), [...sentence.SENTENCE_CLAUSES.map(c => c.key), "role"]);
    // Headline: the board as it stands.
    assert.equal(body.total, boardCount(db, query), `total ${JSON.stringify(query)}`);
    const b = boardSql(query);
    const unc = b.unclassifiedSql
      ? db.prepare(`SELECT COUNT(*) n ${b.joinClause} ${b.whereClause} AND ${b.unclassifiedSql}`).get(...b.baseArgs).n : 0;
    assert.equal(body.known, body.total - unc);
    assert.equal(body.unscored, db.prepare(`SELECT COUNT(*) n ${b.joinClause} ${b.whereClause} AND aor.ats_score IS NULL`).get(...b.baseArgs).n);
    // D35 · COVERAGE IS LIVE — of `total`, the rows whose tag is on file (an untagged row reads its
    // legacy column, as every row of this fixture does), so the panels' "47.5% coverage" is measured.
    for (const [k, col] of [["level", "sj.experience_level"], ["where", "sj.workplace_type"], ["employment", "sj.employment_type"]]) {
      assert.equal(body.coverage[k], db.prepare(`SELECT COUNT(*) n ${b.joinClause} ${b.whereClause} AND ${col} IS NOT NULL`).get(...b.baseArgs).n,
        `coverage.${k} under ${JSON.stringify(query)}`);
    }
    // D35 · the view segment's ALL count is the board's own count — and (A91) so is /d's, with pending on.
    assert.equal(body.views.all, boardCount(db, query));
    assert.equal(body.views.pending, boardCount(db, { ...query, pending: "1" }));
    for (const clause of sentence.SENTENCE_CLAUSES) {
      const opts = body.clauses[clause.key];
      assert.deepEqual(opts.map(o => o.value), clause.dim.options.map(o => o.value).filter(v => clause.key === "posted" || v !== ""));
      for (const o of opts) {
        const q = chosen(query, clause.key, o.value);
        assert.equal(o.count, boardCount(db, q), `${clause.key}=${o.value || "any"} under ${JSON.stringify(query)}`);
        // known: of the board's rows under q, those whose THIS-clause column is classified (the
        // contract: "count − known are kept only because their column is unclassified").
        const bq = boardSql(q);
        // D29: level and workplace read the tag, falling back to the legacy column on an untagged row
        // (every row of this fixture); domain reads the function tag; location the place set.
        const col = { level: "sj.experience_level", where: "sj.workplace_type", domain: "sj.tag_function" }[clause.key];
        const place = clause.key === "location" ? placesFilterSql([o.value]) : null;
        const knownN = col
          ? db.prepare(`SELECT COUNT(*) n ${bq.joinClause} ${bq.whereClause} AND ${col} IS NOT NULL`).get(...bq.baseArgs).n
          : place
            ? db.prepare(`SELECT COUNT(*) n ${bq.joinClause} ${bq.whereClause} AND NOT ${place.unknownSql}`).get(...bq.baseArgs).n
            : o.count;
        assert.equal(o.known, knownN, `known ${clause.key}=${o.value}`);
        assert.ok(o.known <= o.count);
        assert.ok(typeof o.label === "string" && o.label);
        if (clause.key === "fit" || clause.key === "posted") assert.equal(o.known, o.count, "hard clauses: known === count");
        if (o.count === 0) zeros++;
        if (o.known < o.count) softNullGaps++;
        checked++;
      }
    }
  }
  assert.ok(checked > 100, `checked ${checked}`);
  assert.ok(zeros >= 3, `the fixture must exercise zero-count options (${zeros})`);
  assert.ok(softNullGaps >= 10, `the fixture must exercise soft-null rows (${softNullGaps})`);
  // The designed zero: every Strong score is on an ONSITE row, so under "remote" Strong is 0 — even
  // with soft-null keeping the unclassified-workplace rows — and wouldEmpty dims it.
  const { body } = await boardFacetsResponse({ query: { work_models: "remote" }, nowSec: NOW, measureBoard: measureFor(db) });
  const strong = body.clauses.fit.find(o => o.value === "strong");
  assert.equal(strong.count, 0);
  assert.equal(sentence.wouldEmpty(strong), true);
  assert.equal(boardCount(db, { work_models: "remote", fit_bands: "strong" }), 0);
  // ...while the level options under "remote" count unclassified levels, and say so (count > known).
  const senior = body.clauses.level.find(o => o.value === "senior");
  assert.ok(senior.count > senior.known, "unclassified levels are counted, and said to be");
});

test("④ one statement for the headline and ONE per clause — never one per option; the clause's choice is REPLACED", async () => {
  const db = facetFixture();
  const calls = [];
  let prepares = 0;
  const counting = new Proxy(db, { get: (t, k) => k === "prepare" ? (...a) => { prepares++; return t.prepare(...a); } : (typeof t[k] === "function" ? t[k].bind(t) : t[k]) });
  const query = { experience_levels: "senior", work_models: "remote", ageFilter: "1w", posted_after: "1", fit_bands: "strong", page: "3", cursor: "x" };
  const res = await boardFacetsResponse({ query, nowSec: NOW, measureBoard: async (q, m) => { calls.push(q); return { status: 200, body: { measured: true, value: await m({ db: counting, ...boardSql(q) }) } }; } });
  assert.equal(res.status, 200);
  // D35: + one COUNT each for the ALL and ★ views (the /d count is countPending's, absent here).
  // D40: + adds one view count (ALL · ★ · + measured, /d is its own query) — 4 before the clauses.
  // ⭐ D151 (45k): a clause whose base set IS the headline's (the request sets none of its params, it adds no base) rides
  // in the headline's statement, and the ALL view (no view param set) IS the headline's total — here location and
  // sponsorship (unset) and ALL: three fewer measures. Their counts are still the board's own (the "④ ⭐ every facet
  // count" test above checks every option against the board).
  const FOLDED = ["location", "sponsorship"];
  const own = sentence.SENTENCE_CLAUSES.filter(c => !FOLDED.includes(c.key));
  assert.equal(calls.length, 4 + own.length);   // head · ★ · + · /d (A91) · the unfolded clauses
  // + the location clause's place read and (D179 (a), on purpose) the role clause's one grouped read, both on the head's bindings
  assert.equal(prepares, 4 + own.length + 2);
  // Paging and the cursor are never forwarded (a list cursor must not 400 a facets call).
  for (const q of calls) { assert.ok(!("page" in q) && !("cursor" in q)); }
  // Each clause's base set drops exactly its own params — both of the age control's. (D30: six
  // clauses, so the calls are found by clause key, in SENTENCE_CLAUSES' order after the headline.)
  const callFor = (key) => calls[4 + own.findIndex(c => c.key === key)];
  // Nothing set: every clause without a base of its own folds — the head, ★, +, /d and the domain dial.
  const bare = [];
  await boardFacetsResponse({ query: {}, nowSec: NOW, measureBoard: async (q, m) => { bare.push(q); return { status: 200, body: { measured: true, value: await m({ db, ...boardSql(q) }) } }; } });
  assert.equal(bare.length, 5);
  assert.deepEqual(Object.keys(callFor("level")).sort(), ["ageFilter", "fit_bands", "posted_after", "work_models"]);
  assert.deepEqual(Object.keys(callFor("posted")).sort(), ["experience_levels", "fit_bands", "work_models"]);
  assert.deepEqual(Object.keys(callFor("fit")).sort(), ["ageFilter", "experience_levels", "posted_after", "work_models"]);
  // The domain dial's base LIFTS the role scope: every function named, nothing narrowed.
  assert.deepEqual(Object.keys(callFor("domain")).sort(), ["ageFilter", "experience_levels", "fit_bands", "job_functions", "posted_after", "work_models"]);
});

test("④ same params, same validation: an unknown value is the board's own 400; no profile / empty pool is all zeros", async () => {
  const db = facetFixture();
  for (const query of [{ fit_bands: "great" }, { work_models: "office" }, { experience_levels: "mid level" }, { sort: "nope" }]) {
    const r = await boardFacetsResponse({ query, nowSec: NOW, measureBoard: measureFor(db) });
    assert.equal(r.status, 400, JSON.stringify(query));
    assert.match(r.body.error, /Unknown/);
  }
  const none = await boardFacetsResponse({ query: {}, nowSec: NOW,
    measureBoard: async () => ({ status: 200, body: { success: true, jobs: [], total: 0, needsProfileSetup: true } }) });
  assert.equal(none.status, 200);
  assert.equal(none.body.total, 0);
  assert.ok(Object.values(none.body.clauses).every(list => list.length && list.every(o => o.count === 0 && o.known === 0)));
  // facetClauses' options are the contract's dims, in their order, with their labels.
  const cl = facetClauses({ nowSec: NOW });
  assert.deepEqual(cl.map(c => c.key), [...sentence.SENTENCE_CLAUSES.map(c => c.key), "role"]);   // D179 (a), on purpose
  assert.deepEqual(cl.find(c => c.key === "fit").options.map(o => o.label), FIT_BANDS.options.map(o => o.label));
});

test("④ server.js: the facets route measures through boardPageResponse — validation first, the board's own bindings", () => {
  const route = SERVER.slice(at(SERVER, 'app.get("/api/jobs/facets", requireAuth'), at(SERVER, '// ── /api/jobs/suggest'));
  assert.match(route, /boardFacetsResponse\(\{/);
  assert.match(route, /boardPageResponse\(\{ \.\.\.req, query \}, \{ measure, nowSec \}\)/);
  assert.doesNotMatch(route, /db\.prepare/, "the facets route must not carry a WHERE of its own");
  const board = SERVER.slice(at(SERVER, "async function boardPageResponse("));
  const guard = board.indexOf("rejectInvalidFilterValues(req.query)");
  const hook = board.indexOf("if (measure) {");
  const fetchAt = board.indexOf("const fetched = await readPool.all(");   // A126: the worker pool
  assert.ok(guard > 0 && hook > guard && fetchAt > hook, "measure must run after validation and before the page fetch");
  assert.match(board.slice(hook - 400, hook), /const baseArgs\s+= argsFor\(richFilters\);/,
    "measure must receive the SAME baseArgs the list and the count use");
  // The legacy endpoint's tells are gone.
  assert.doesNotMatch(SERVER, /postedAge\[bucket\]/);
});

test("④ D35 → A91: the /d count is the BOARD's count with pending on — and a failure there is null, never a guess", async () => {
  const db = facetFixture();
  const ok = await boardFacetsResponse({ query: { work_models: "remote" }, nowSec: NOW, measureBoard: measureFor(db), countPending: () => 9 });
  assert.equal(ok.body.views.pending, boardCount(db, { work_models: "remote", pending: "1" }), "the /d count takes the board's filters, as the /d list does");
  // The board cannot answer → the legacy count, and if that fails too, null.
  const failing = async (q, m) => (q.pending === "1" ? { status: 500, body: {} } : measureFor(db)(q, m));
  const fallback = await boardFacetsResponse({ query: {}, nowSec: NOW, measureBoard: failing, countPending: () => 9 });
  assert.equal(fallback.body.views.pending, 9);
  const boom = await boardFacetsResponse({ query: {}, nowSec: NOW, measureBoard: failing, countPending: () => { throw new Error("x"); } });
  assert.equal(boom.body.views.pending, null);
  // server.js hands it the SAME function the /api/jobs/pending route lists with.
  assert.ok(SERVER.includes("countPending: () => pendingJobsQuery(req.user.id, { count: true })"));
  assert.ok(SERVER.includes("res.json(pendingJobsQuery(req.user.id));"));
});
