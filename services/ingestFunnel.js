// services/ingestFunnel.js — where one source's last crawl put every posting it fetched.
//
// ⛔ WHY THIS EXISTS (owner, 10-14): "the admin panel says only around 80 are accepted and 1800 refused for
// one of the providers". Production's greenhouse run that day fetched 15,998 postings. The glance showed
// `written 80` (new or changed only) beside `refused 1,878` (dropped + ejected only) — and left out the
// 2,328 unchanged postings that are on the board, and the 4,874 outside the US, 2,326 too old and 3,659
// outside computer science that the run also held out. Two counters out of ten, read as the whole story.
//
// So the run is a PARTITION here, in the order services/jobs/aggregator.js cacheJobs() tests each posting
// (one bucket per posting, first test that matches wins):
//
//   fetched
//     → outside the US          details.outOfMarket   (the US-only gate, A37)
//     → too old                 details.tooOld        (a NEW posting past the age limit, D78 A)
//     → retired: aged out       details.agedOut       (an ON-BOARD posting past the limit, retired)
//     → retired: scoped out     details.scopedOut     (an ON-BOARD posting outside CS, retired)
//     → blue-collar             ejected
//     → no role family          dropped               (the classifier found no family)
//     → outside computer science details.outOfScope   (a NEW posting outside CS, D78 B)
//     → on the board            written + unchanged + merged
//         of which rescued      details.rescued       (no role family, but a clear CS title — filed under
//                                                     'general'; ing-crawl-fixes 9ef7e99. A SUBSET of
//                                                     written + merged, never a bucket of its own: since that
//                                                     commit `dropped` excludes them, and they run on
//                                                     through the scope gate, dedup and the upsert.)
//
// ⛔ "ON THE BOARD" IS pipelineHealth()'s `accountedFor`, AND THERE IS ONE DEFINITION OF IT. A merged
// posting is a cross-source duplicate whose fields were folded into another source's canonical row: it is
// on the board, under that row. routes/adminDb.js classifies a source on THIS object, so the panel and the
// nightly alert cannot come to disagree about what a run put on the board.
//
// ⛔ THE PARTS NEED NOT SUM TO `fetched`, AND THE REMAINDER IS SAID, NOT HIDDEN. cacheJobs counts an aged-out
// or scoped-out posting only when it was still ON the board; one a sweep retired earlier, re-seen tonight,
// stops at the same gate and is counted nowhere. A posting with no id is skipped uncounted too. Production
// greenhouse 10-14: 853 of 15,998. That gap is reported as `uncounted` with what it is, because a funnel
// whose parts silently fail to add up is the shape every other figure on this panel exists to catch.
//
// ⛔ REFUSALS ARE A STANDING POOL, NOT NEWS. Every posting a provider still lists is fetched and re-checked
// on every daily crawl, so tonight's 4,874 "outside the US" are, almost all, last night's 4,874 again.

const n = (v) => Number(v || 0);

export const RECUR_NOTE = "Refusals recur on every daily crawl: each posting a provider still lists is " +
  "fetched and checked again, so these counts are a standing pool, not new refusals.";

function parseDetails(run) {
  if (!run) return {};
  if (run.details && typeof run.details === "object") return run.details;
  try { return JSON.parse(run.details_json || "null") || {}; } catch { return {}; }
}

/**
 * The funnel of one source_sync run. `run` is a pipeline_runs row (details_json a string) or the same
 * fields with `details` already parsed. Null when there is no run.
 */
export function runFunnel(run) {
  if (!run) return null;
  const d = parseDetails(run);
  const fetched = n(run.fetched);
  const refused = [
    { key: "outOfMarket", label: "outside the US", n: n(d.outOfMarket) },
    { key: "tooOld", label: "too old (past the age limit)", n: n(d.tooOld) },
    { key: "blueCollar", label: "blue-collar", n: n(run.ejected) },
    { key: "noRoleFamily", label: "no role family", n: n(run.dropped) },
    { key: "outOfScope", label: "outside computer science", n: n(d.outOfScope) },
  ];
  const retired = [
    { key: "agedOut", label: "aged out (was on the board)", n: n(d.agedOut) },
    { key: "scopedOut", label: "scoped out (was on the board)", n: n(d.scopedOut) },
  ];
  const onBoardParts = [
    { key: "newOrChanged", label: "new or changed", n: n(run.written) },
    { key: "unchanged", label: "unchanged, still listed", n: n(run.unchanged) },
    { key: "duplicate", label: "duplicate — on the board under another source", n: n(run.merged) },
  ];
  // Shown under "on the board", NOT summed: each is already inside one of the parts above.
  const onBoardIncludes = [
    { key: "rescued", label: "of which rescued — a CS title with no role family, filed under general", n: n(d.rescued) },
  ];
  const sum = (xs) => xs.reduce((t, x) => t + x.n, 0);
  const refusedTotal = sum(refused);
  const retiredTotal = sum(retired);
  const onBoard = sum(onBoardParts);
  const uncounted = fetched - refusedTotal - retiredTotal - onBoard;
  return {
    fetched,
    onBoard,
    onBoardParts,
    onBoardIncludes,
    refused,
    refusedTotal,
    retired,
    retiredTotal,
    // Everything the run held off the board on purpose — what pipelineHealth calls `rejected`.
    heldOff: refusedTotal + retiredTotal,
    uncounted,
    uncountedNote: uncounted > 0
      ? "not counted by the crawl — postings already retired earlier (for age or scope) re-seen tonight, or with no posting id"
      : uncounted < 0 ? "the counters exceed the fetch — a counting defect in the crawl" : null,
    note: RECUR_NOTE,
  };
}
