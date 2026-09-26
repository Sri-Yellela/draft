// A COUNT THAT REPORTS ROWS THE LIST CANNOT RETURN IS UNFALSIFIABLE FROM THE UI.
// ================================================================================================
//
// Reported from production: the board showed ZERO jobs while reporting ~600 exist. That shape —
// two queries that answer the same question differently — has already cost this project once, in
// the source-health false critical, where `written` and `unchanged` were counted by different
// predicates and "the board didn't change" read as "the source stopped working".
//
// The two statements in GET /api/jobs must be the same question asked twice. They are built from
// the SAME `joinClause`, `whereClause` and `baseArgs` values — not a re-derivation, the identical
// bindings — and this pins that so a future edit cannot fork one without failing here.
//
// ⚠ ONE ASYMMETRY IS DELIBERATE AND IS ASSERTED AS SUCH. The list carries `cursorSql`, the count
// does not, because `total` means "rows matching the filters", not "rows still ahead of this
// cursor" — a feed that counted only the remainder would show the number shrinking as the user
// scrolls. describeEmptyBoard() is what keeps that honest, by naming end-of-feed rather than
// letting it look like an empty board.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";
import { describeEmptyBoard, activeFilterNames } from "../services/jobs/emptyBoardReason.js";

const SERVER = fs.readFileSync("server.js", "utf8");

/** The board route's body, bounded by its own anchors rather than by line numbers. */
const ROUTE = SERVER.slice(at(SERVER, 'app.get("/api/jobs", requireAuth'),
                           at(SERVER, 'app.get("/api/jobs/generic"'));

test("⛔ the COUNT and the LIST are built from the same join, where and args", () => {
  const countStmt = /SELECT COUNT\(\*\) as n \$\{joinClause\} \$\{whereClause\}`\)\.get\(\.\.\.baseArgs\)/;
  assert.match(ROUTE, countStmt,
    "the count must interpolate the SAME joinClause/whereClause variables the list uses and bind " +
    "the SAME baseArgs — a count with its own predicate is the defect this file exists for");

  // And the list, so a change to either side is visible here.
  assert.match(ROUTE, /\$\{joinClause\} \$\{whereClause\} \$\{cursorSql\} ORDER BY/,
    "the list must be joinClause + whereClause + the cursor predicate, in that order");
});

test("the ONLY predicate the list adds over the count is the cursor", () => {
  // Extract both statements and compare what each contains. If someone adds `AND sj.foo = ?` to
  // the list alone — the exact way these two would drift — the sets stop matching.
  // ⛔ `at()`, NOT indexOf — and test/sourceAnchorGuard.test.js enforces that, having caught this
  // file doing it the wrong way on the first run. indexOf returns -1 for a missing anchor and
  // slice reads -1 as an offset from the END, so the region does not become empty, it becomes far
  // too wide, and the assertion over it usually still passes.
  //
  // ⚠ THE COUNT ANCHOR IS THE FULL STATEMENT, not "SELECT COUNT(*) as n". The route contains a
  // SECOND count — `cacheCount`, over scraped_jobs directly — several hundred lines earlier, and
  // the short form matches THAT one and compares the wrong query. A substring that matches twice
  // is not an anchor.
  const list  = ROUTE.slice(at(ROUTE, "SELECT ${selectCols}"), at(ROUTE, "ORDER BY ${order.sql}"));
  const countStart = at(ROUTE, "SELECT COUNT(*) as n ${joinClause}");
  const count = ROUTE.slice(countStart, countStart + 120);

  const fragmentsOf = (sql) => (sql.match(/\$\{(\w+)\}/g) || [])
    .map(s => s.slice(2, -1))
    .filter(n => n !== "selectCols" && n !== "cursorCols" && n !== "order");

  const listFrags  = new Set(fragmentsOf(list));
  const countFrags = new Set(fragmentsOf(count));
  const extra = [...listFrags].filter(x => !countFrags.has(x));
  assert.deepEqual(extra, ["cursorSql"],
    `the list interpolates ${JSON.stringify(extra)} that the count does not. Only "cursorSql" may ` +
    `differ, and only because total counts the whole filtered set rather than the remainder`);
});

test("a count/list disagreement is logged at ERROR level, not swallowed", () => {
  assert.match(ROUTE, /COUNT\/LIST MISMATCH/,
    "the one state that cannot be reached by any user input must announce itself");
  assert.match(ROUTE, /console\.error\(`\[jobs\] ⛔ COUNT\/LIST MISMATCH/);
});

// ════════════════════════════════════════════════════════════════════════════════════════════
// THE EXPLANATION ITSELF
// ════════════════════════════════════════════════════════════════════════════════════════════

test("a page with rows explains nothing — a healthy response is unchanged", () => {
  assert.equal(describeEmptyBoard({ total: 681, returned: 20, page: 1, totalPages: 35 }), null);
});

test("⛔ page past the end is NAMED, not left looking like an empty board", () => {
  const r = describeEmptyBoard({ total: 681, returned: 0, page: 99, totalPages: 35 });
  assert.equal(r.code, "page_out_of_range");
  assert.equal(r.total, 681);
  assert.match(r.message, /past the end/i);
  assert.match(r.message, /35 pages/, "it must say how many pages there actually are");
});

test("end of a cursor feed is its own state, not an error", () => {
  const r = describeEmptyBoard({ total: 681, returned: 0, page: 1, totalPages: 35, usedCursor: true });
  assert.equal(r.code, "cursor_exhausted");
  assert.ok(!r.diagnostic, "reaching the end of a feed is normal and must not be flagged as a bug");
});

test("⛔ IN RANGE, ROWS EXIST, NONE RETURNED — the defect gets its own code", () => {
  // There is no legitimate way to reach this: the count and list share one join and one WHERE, so
  // a page inside the range must return rows. Before this existed it was indistinguishable from a
  // normal empty board, which is how the production report came in as "the board is empty".
  const r = describeEmptyBoard({ total: 681, returned: 0, page: 2, totalPages: 35 });
  assert.equal(r.code, "count_list_mismatch");
  assert.equal(r.diagnostic, true, "it must be marked as a defect so the route can log it loudly");
  assert.match(r.message, /bug, not a filter/i,
    "it must not blame the user's filters for a server defect");
});

test("total 0 with filters names WHICH filters, per the brief", () => {
  const r = describeEmptyBoard({ total: 0, returned: 0, activeFilters: ["location", "workType"] });
  assert.equal(r.code, "filters_exclude_all");
  assert.deepEqual(r.filters, ["location", "workType"]);
});

test("total 0 with no filters is an empty board, and says so plainly", () => {
  const r = describeEmptyBoard({ total: 0, returned: 0, activeFilters: [] });
  assert.equal(r.code, "board_empty");
  assert.doesNotMatch(r.message, /filter/i, "there are no filters to blame here");
});

test("⛔ absent, blank and '0' params are NOT filters", () => {
  // Counting them would make every request look filtered and the explanation worthless — the same
  // failure as an allowlist that cries wolf.
  assert.deepEqual(activeFilterNames({}), []);
  assert.deepEqual(activeFilterNames({ location: "", workType: "   ", starred: "0" }), []);
  assert.deepEqual(activeFilterNames({ location: "Boston", starred: "1" }), ["location", "starred"]);
  assert.deepEqual(activeFilterNames({ skills: ["react", "node"] }), ["skills"]);
});

test("the route emits emptyReason only when the page is empty", () => {
  assert.match(ROUTE, /\.\.\.\(emptyReason \? \{ emptyReason \} : \{\}\)/,
    "a healthy response must be byte-identical to before, so no client has to learn a new field");
  assert.match(ROUTE, /const emptyReason = describeEmptyBoard\(\{/,
    "and the route must derive it rather than assembling its own explanation inline");
});

test("the no-profile early return uses the SAME field shape", () => {
  // Otherwise a client special-cases one branch and forgets the rest, which is how `reason` ended
  // up understood by exactly one component.
  assert.match(ROUTE, /code:\s*'no_active_profile'/);
  assert.match(ROUTE, /reason:\s*'no_active_profile'/,
    "the older single-string field stays for clients already reading it");
});
