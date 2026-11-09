// 45s (owner 11-09: "its not matching me any jobs for construction pm" — 704 existed): after a new résumé the board holds
// back postings until they are scored for it (A126 (7)). Three defects kept the board empty for minutes: the refresh on
// `board_scored` was a DEBOUNCE (reset by every event the queue sends ~4 s apart, so it fired only after the queue drained);
// a missed event left nothing to refill it; and the empty page said "nothing matches" while the postings DID match.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const jp = fs.readFileSync("client/src/panels/JobsPanel.jsx", "utf8").replace(/\r\n/g, "\n");

test("boardMatchingRefresh: board_scored is a throttle — a pending refresh is kept, not pushed back", () => {
  assert.match(jp, /board_scored: \(\) => \{\n      if \(boardScoredTimerRef\.current\) return;   \/\/ one refresh already on its way\n      boardScoredTimerRef\.current = setTimeout\(\(\) => \{ boardScoredTimerRef\.current = null;/);
  assert.doesNotMatch(jp, /board_scored: \(\) => \{\n      clearTimeout\(boardScoredTimerRef\.current\);/);
});

test("boardMatchingRefresh: an empty page that is being matched re-asks every 5 s (≤ 4 min) and says it is matching", () => {
  assert.match(jp, /if \(!\(jobs\.length === 0 && beingMatched > 0 && currentPage <= 1\)\)/);
  assert.match(jp, /setTimeout\(\(\) => \{ fetchJobsRef\.current\?\.\(1\)\.catch\(\(\) => \{\}\); \}, 5000\)/);
  assert.match(jp, /\) : shouldShowEmptyState \? \(\n[^\n]*\n        beingMatched > 0 \? \(\n          <div data-matching-empty=""/);
  assert.match(jp, /Matching \{beingMatched\.toLocaleString\(\)\}/);
});
