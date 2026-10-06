// D45 (owner, 10-07) — "any panel I open takes a second before it loads and shows empty for the first
// few seconds". Measured 10-07 on a throwaway local server (2,616 rows) in headless Chrome:
//   · the board's empty state rendered while the first request was in flight (EMPTY at ~475 ms, cards
//     at ~600 ms on a cold load) — shouldShowEmptyState never looked at loading;
//   · a switch kept showing the PREVIOUS view's cards until the new answer arrived;
//   · facets was fired first and, being several synchronous board queries, held the board's own request
//     behind it (/api/jobs landed at +860 ms); and a cold load asked for the same page twice.
// After: skeletons until the current view answers, a per-view cache with an idle prefetch (warm switch
// p50 7–16 ms, p95 13–33 ms), facets after the board, one board request per view at a time.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";
import { viewKey, viewCacheGet, viewCacheSet, otherViewQueries, VIEW_CACHE_LIMIT } from "../client/src/lib/boardViewCache.js";

const panel = fs.readFileSync("client/src/panels/JobsPanel.jsx", "utf8").replace(/\r\n/g, "\n");

test("D45 · the empty copy does not render while the current view's request is in flight", () => {
  assert.match(panel, /const boardLoading = answeredKey === null \|\| requestedKey !== answeredKey;/);
  assert.match(panel, /const shouldShowEmptyState = jobs\.length === 0 && !scraping && !boardLoading;/);
  // The skeleton branch comes FIRST, so neither the empty state nor another view's cards can win.
  assert.match(panel, /\{boardLoading \? \(\s*\/\/ D45[^\n]*\n\s*<JobBubbleRows jobs=\{SKELETON_CARDS\}>\{\(_, i\) => <JobBubbleSkeleton key=\{i\} \/>\}<\/JobBubbleRows>\s*\) : shouldShowEmptyState \? \(/);
  assert.equal((panel.match(/boardLoading=\{boardLoading\}/g) || []).length, 2, "both JobsColumn call sites");
  const bubble = fs.readFileSync("client/src/components/JobBubble.jsx", "utf8");
  assert.match(bubble, /<div className="jb jb--skeleton" data-skeleton="" aria-hidden="true">/, "the skeleton is the card's own geometry");
});

test("D45 · a second visit renders from the cache BEFORE the network answers", () => {
  const body = panel.slice(at(panel, "const fetchJobs = useCallback"), at(panel, "d = await api(`/api/jobs?${qs}`);"));
  assert.match(body, /const hit = viewCacheGet\(viewCacheRef\.current, key\);\s+if \(hit\) \{ setJobs\(hit\.jobs\); setTotalJobs\(hit\.total\); setTotalPages\(hit\.totalPages\); setAnsweredKey\(key\); \}/,
    "the cached view is put on screen before the request is awaited");
  assert.match(panel, /viewCacheSet\(viewCacheRef\.current, key, \{ jobs: incoming/);
});

test("D45 · the cache key ignores what does not change the answer; the prefetch asks for the other three views", () => {
  assert.equal(viewKey("page=1&posted_after=1790000000&pageSize=50"), viewKey("pageSize=50&page=1&posted_after=1790000999"),
    "posted_after is Date.now()-derived — keyed on it, no two requests would match");
  assert.notEqual(viewKey("page=1&starred=1"), viewKey("page=1"));
  const { views } = otherViewQueries("page=2&pageSize=50&starred=1&places=metro%3Aboston&cursor=abc");
  assert.equal(views.length, 3);
  for (const v of views) {
    const p = new URLSearchParams(v);
    assert.equal(p.get("page"), "1"); assert.equal(p.get("places"), "metro:boston"); assert.equal(p.get("cursor"), null);
    assert.notEqual(p.get("starred"), "1", "the current view is not prefetched");
  }
  const cache = new Map();
  for (let i = 0; i < VIEW_CACHE_LIMIT + 5; i++) viewCacheSet(cache, `k${i}`, { i });
  assert.equal(cache.size, VIEW_CACHE_LIMIT, "bounded");
  assert.equal(viewCacheGet(cache, "k0"), null, "least recent evicted first");
});

test("D45 · facets AFTER the board, and one board request per view at a time", () => {
  // D51: + a nonce, so a Draft or an Undo re-reads the /d count; still gated on the board (!boardLoading).
  assert.match(panel, /const facets = useJobFacets\(facetsQs, !boardLoading, api, facetsNonce\);/);
  assert.match(panel, /if \(!mergeMode && !options\.cursor && inFlightRef\.current === flightKey\) return;/);
  const hook = fs.readFileSync("client/src/hooks/useJobFacets.js", "utf8");
  assert.match(hook, /if \(!enabled\) return;/, "disabled keeps the last counts — they do not blank while the board loads");
});
