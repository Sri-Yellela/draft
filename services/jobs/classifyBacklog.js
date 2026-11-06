// services/jobs/classifyBacklog.js — ⛔⛔ D153 (3) · CLASSIFY THE BOARD'S BACKLOG AS A BACKGROUND JOB.
//
// Owner 11-04: "43,009 of 52,681 postings with no kind of work on file". Two things kept the board unclassified:
//   1. The kind of work (tag_function) came only from the role classifier's bucket, and its 'general' bucket maps to
//      nothing — while D127's title classifier had placed most of those postings in a category (categoryFunction.js
//      now derives the function from D127's in-scope verdict; jobTags.tagFunction uses it for every NEW tag).
//   2. A posting tagged before that rule keeps its tag until its inputs change (tag_basis) — so the backlog is never
//      re-derived by the 10-minute tag pass. And D127's category backfill ran at boot as ONE statement + ONE
//      transaction over every unclassified active row (100k LIMIT): at A112's 80k board, whole-board work on the event
//      loop, which D151 forbids.
// This job does both, over the whole board, in ROWID PAGES (A123's rowidWalk: a primary-key range of `pageRows`
// rows, bounded whatever the board's size) with a yield (setImmediate) between pages, started after ready:
//   · board_category IS NULL → D127's verdict written (writeCategory — 'held' with its reason when out of scope);
//   · tag_function IS NULL (and no owner tag for it) → the role bucket's function, else D127's in-scope category's,
//     else left NULL. ⛔ D127's leak rule: a held posting is never given a function or a category (unknown stays
//     unknown, it is not guessed).
// IDEMPOTENT: each write is conditional on the column still being NULL, and a second walk over a classified board
// writes nothing. The walk counts coverage as it goes (every active row in the page is read once), so the status —
// in /api/version — says how much of the shown board carries a category and a kind of work, without a whole-board query.
import { categoryOf } from "./professionalScope.js";
import { writeCategory, storedFamily, HELD_CATEGORY } from "./boardScope.js";
import { functionForCategory } from "./categoryFunction.js";
import { functionForRole } from "../../shared/jobTagVocabulary.js";
import { nextRowidRange } from "./rowidWalk.js";

export const CLASSIFY_PAGE_ROWS = 500;

const PAGE_SQL = `
  SELECT sj.job_id, sj.title, sj.company, sj.board_category, sj.tag_function, sj.tag_owner_json,
         (SELECT m.role_key FROM job_role_map m WHERE m.job_id = sj.job_id AND m.source_profile_id IS NULL
           ORDER BY m.rowid LIMIT 1) AS role_key
    FROM scraped_jobs sj
   WHERE sj.is_active = 1 AND sj.rowid > ? AND sj.rowid <= ?`;

function ownerFunction(json) {
  if (!json) return null;
  try { return JSON.parse(json)?.job_function ?? null; } catch { return null; }
}

/** The kind of work for one posting: its role bucket's, else D127's in-scope category's (by the title), else null. */
export function postingFunction({ title, role_key }, verdict = categoryOf({ title, roleKey: role_key })) {
  return functionForRole(role_key) ?? functionForCategory(verdict, title);
}

const STMTS = new WeakMap();
function stmts(db) {
  let s = STMTS.get(db);
  if (!s) {
    s = {
      page: db.prepare(PAGE_SQL),
      fn: db.prepare("UPDATE scraped_jobs SET tag_function = ? WHERE job_id = ? AND tag_function IS NULL"),
    };
    STMTS.set(db, s);
  }
  return s;
}

const emptyCounts = () => ({ active: 0, shown: 0, held: 0, withFunction: 0, categorised: 0, functioned: 0 });

/**
 * Classify one rowid range (from, to]. Pure database work, bounded by the range. Returns the page's counts:
 * active rows read, shown (in scope) rows, held rows, shown rows WITH a kind of work after the page, and the writes.
 */
export function classifyPage(db, range) {
  const s = stmts(db);
  const rows = s.page.all(range.from, range.to);
  const c = emptyCounts();
  const writes = [];
  for (const r of rows) {
    c.active++;
    // The stored category is the verdict when there is one; otherwise D127's classifier decides now.
    let verdict = null;
    let category = r.board_category;
    if (category == null) {
      verdict = categoryOf({ title: r.title, roleKey: storedFamily(db, r) });
      category = verdict.inScope ? verdict.category : HELD_CATEGORY;
      writes.push({ kind: "category", jobId: r.job_id, verdict });
    }
    if (category === HELD_CATEGORY) { c.held++; continue; }   // ⛔ D127: no function for a held posting
    c.shown++;
    let fn = r.tag_function;
    if (fn == null && ownerFunction(r.tag_owner_json) == null) {
      // The category's verdict, re-read from the title (pure) when it was stored by an earlier pass.
      const v = verdict && verdict.inScope ? verdict : categoryOf({ title: r.title, roleKey: r.role_key });
      fn = postingFunction(r, v);   // the same rule as jobTags.deriveTags, so a later re-tag agrees
      if (fn) writes.push({ kind: "function", jobId: r.job_id, fn });
    }
    if (fn != null) c.withFunction++;
  }
  if (writes.length) {
    db.transaction(() => {
      for (const w of writes) {
        if (w.kind === "category") { writeCategory(db, w.jobId, w.verdict); c.categorised++; }
        else if (s.fn.run(w.fn, w.jobId).changes) c.functioned++;
      }
    })();
  }
  return c;
}

/**
 * The job: walk the board in rowid pages, a yield between pages. One walk at a time per status object; resolves
 * with the final status. `schedule` is the yield (setImmediate by default; tests pass their own).
 */
export function createClassifyBacklog(db, { pageRows = CLASSIFY_PAGE_ROWS, schedule = (fn) => setImmediate(fn), log = console } = {}) {
  let status = { state: "idle", runs: 0, pages: 0, ...emptyCounts(), startedAt: null, finishedAt: null, error: null, lastPageMs: 0, maxPageMs: 0 };
  let running = null;

  const coverage = () => ({
    category: status.active ? Math.round(1000 * status.shown / status.active) / 10 : null,     // shown share of active
    functionOfShown: status.shown ? Math.round(1000 * status.withFunction / status.shown) / 10 : null,
  });

  function run(trigger = "manual") {
    if (running) return running;
    status = { ...status, state: "running", trigger, runs: status.runs + 1, pages: 0, ...emptyCounts(),
               startedAt: new Date().toISOString(), finishedAt: null, error: null, lastPageMs: 0, maxPageMs: 0 };
    running = new Promise((resolve) => {
      let from = 0;
      const finish = (error) => {
        status = { ...status, state: error ? "failed" : "done", finishedAt: new Date().toISOString(), error: error ? error.message : null };
        running = null;
        if (error) log.error?.(`[classify] backlog walk failed at rowid ${from} (the next boot resumes; nothing half-written):`, error.message);
        else if (status.categorised || status.functioned) {
          log.log?.(`[classify] (${trigger}) backlog: ${status.categorised} categorised, ${status.functioned} given a kind of work; `
            + `shown ${status.shown} of ${status.active}, ${coverage().functionOfShown}% with a kind of work`);
        }
        resolve(self.status());
      };
      const step = () => {
        try {
          const t0 = Date.now();
          const range = nextRowidRange(db, from, pageRows);
          const c = range.to > from ? classifyPage(db, range) : emptyCounts();
          const ms = Date.now() - t0;
          status = { ...status, pages: status.pages + 1, lastPageMs: ms, maxPageMs: Math.max(status.maxPageMs, ms),
            active: status.active + c.active, shown: status.shown + c.shown, held: status.held + c.held,
            withFunction: status.withFunction + c.withFunction, categorised: status.categorised + c.categorised,
            functioned: status.functioned + c.functioned };
          if (!range.more || range.to <= from) return finish(null);
          from = range.to;
          schedule(step);
        } catch (e) { finish(e); }
      };
      schedule(step);
    });
    return running;
  }

  const self = {
    run,
    get running() { return !!running; },
    /** For /api/version: the walk's state and the coverage it measured (the last completed walk's, or so far). */
    status: () => ({ ...status, coverage: coverage() }),
  };
  return self;
}
