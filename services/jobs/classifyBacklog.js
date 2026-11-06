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
// ⛔ A132 (production 11-06: write pages up to 2,711 ms, /api/health/live 0.9–4.0 s for ≈ 70 s): an UPDATE rewrites the
// whole posting row (its description runs to overflow pages), and a 500-row page wrote up to ~500 of them in ONE
// transaction on the one thread. The writes now go in transactions of at most CLASSIFY_WRITE_CHUNK rows, with a yield
// between chunks — the read stays one bounded page.
export const CLASSIFY_WRITE_CHUNK = 50;
// A132 · the page read's budget on the loop, and the smallest page the walk shrinks to (see createClassifyBacklog's step).
export const READ_BUDGET_MS = 200;
export const MIN_PAGE_ROWS = 50;

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

const emptyCounts = () => ({ active: 0, shown: 0, held: 0, withFunction: 0, categorised: 0, functioned: 0, unknownByCategory: {} });
// A132 · the shown postings left with no kind of work, by their category — the rule leaves a management / business /
// arts title with no subject word (and science) unknown on purpose; this says how many, without a production DB read.
const addUnknown = (into, from) => { const o = { ...into }; for (const [k, v] of Object.entries(from || {})) o[k] = (o[k] || 0) + v; return o; };

/**
 * Classify one rowid range (from, to]. Pure database work, bounded by the range. Returns the page's counts:
 * active rows read, shown (in scope) rows, held rows, shown rows WITH a kind of work after the page, and the writes.
 */
export function classifyPage(db, range, { apply = true } = {}) {
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
    else c.unknownByCategory[category] = (c.unknownByCategory[category] || 0) + 1;
  }
  if (!apply) return { ...c, writes };
  if (writes.length) applyWrites(db, writes, c);
  return c;
}

/** One transaction over `writes` (a chunk); adds to c.categorised / c.functioned. */
export function applyWrites(db, writes, c) {
  const s = stmts(db);
  db.transaction(() => {
    for (const w of writes) {
      if (w.kind === "category") { writeCategory(db, w.jobId, w.verdict); c.categorised++; }
      else if (s.fn.run(w.fn, w.jobId).changes) c.functioned++;
    }
  })();
  return c;
}

/**
 * The job: walk the board in rowid pages, a yield between pages. One walk at a time per status object; resolves
 * with the final status. `schedule` is the yield (setImmediate by default; tests pass their own).
 */
export function createClassifyBacklog(db, { pageRows = CLASSIFY_PAGE_ROWS, writeChunk = CLASSIFY_WRITE_CHUNK, schedule = (fn) => setImmediate(fn), log = console } = {}) {
  let status = { state: "idle", runs: 0, pages: 0, ...emptyCounts(), startedAt: null, finishedAt: null, error: null, lastPageMs: 0, maxPageMs: 0, maxWriteMs: 0, maxReadMs: 0, pageRows };
  let running = null;

  const coverage = () => ({
    category: status.active ? Math.round(1000 * status.shown / status.active) / 10 : null,     // shown share of active
    functionOfShown: status.shown ? Math.round(1000 * status.withFunction / status.shown) / 10 : null,
  });

  function run(trigger = "manual") {
    if (running) return running;
    status = { ...status, state: "running", trigger, runs: status.runs + 1, pages: 0, ...emptyCounts(),
               startedAt: new Date().toISOString(), finishedAt: null, error: null, lastPageMs: 0, maxPageMs: 0, maxWriteMs: 0, maxReadMs: 0, pageRows };
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
      // Each slice of work on the loop is one bounded read + its first write chunk, or one later write chunk.
      // ⛔ A132 (production 10313b5, 11-06: maxPageMs 2,420 with maxWriteMs 0 — the READ, not the writes): board_category /
      // tag_function were added by ALTER, so they sit after the description in every row and reading them walks its
      // overflow pages — slow on the volume, invisible on a local SSD (181 ms). The page size ADAPTS: halved while a read
      // takes longer than READ_BUDGET_MS (never below MIN_PAGE_ROWS), grown back toward `pageRows` while reads are fast.
      // ⛔ A132 (3) (production dbae3aa, 11-06: 203 pages, yet one read still 2,578 ms): the page shrank only AFTER a slow
      // read, so the walk's FIRST page — 500 rows on a cold volume — paid the whole stall before it could adapt. The walk
      // now STARTS at MIN_PAGE_ROWS and doubles only while a read stays under a quarter of the budget, so no read can
      // reach more than about twice the last one that was measured fast: the stall is bounded before it happens, not after.
      let rows = Math.min(pageRows, MIN_PAGE_ROWS);
      status = { ...status, pageRows: rows };
      const step = () => {
        try {
          const t0 = Date.now();
          const range = nextRowidRange(db, from, rows);
          const plan = range.to > from ? classifyPage(db, range, { apply: false }) : { ...emptyCounts(), writes: [] };
          const readMs = Date.now() - t0;
          if (readMs > READ_BUDGET_MS && rows > MIN_PAGE_ROWS) rows = Math.max(MIN_PAGE_ROWS, Math.floor(rows / 2));
          else if (readMs < READ_BUDGET_MS / 4 && rows < pageRows) rows = Math.min(pageRows, rows * 2);
          const { writes, ...c } = plan;
          status = { ...status, pages: status.pages + 1, maxReadMs: Math.max(status.maxReadMs || 0, readMs), pageRows: rows,
            active: status.active + c.active, shown: status.shown + c.shown, held: status.held + c.held,
            withFunction: status.withFunction + c.withFunction,
            unknownByCategory: addUnknown(status.unknownByCategory, c.unknownByCategory) };
          const done = !range.more || range.to <= from;
          from = range.to;
          let i = 0;
          const writeChunk_ = (first, tStart) => {
            try {
              const t = first ? tStart : Date.now();
              const tw = Date.now();
              const w = { categorised: 0, functioned: 0 };
              const chunk = writes.slice(i, i + writeChunk);
              if (chunk.length) applyWrites(db, chunk, w);
              i += chunk.length;
              const ms = Date.now() - t;
              status = { ...status, categorised: status.categorised + w.categorised, functioned: status.functioned + w.functioned,
                lastPageMs: ms, maxPageMs: Math.max(status.maxPageMs, ms), maxWriteMs: Math.max(status.maxWriteMs, Date.now() - tw) };
              if (i < writes.length) return schedule(() => writeChunk_(false));
              if (done) return finish(null);
              schedule(step);
            } catch (e) { finish(e); }
          };
          writeChunk_(true, t0);
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
