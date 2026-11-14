// ⭐ A184 + A185 (46f, measured at 100k / 20 users, Chrome closed) · the board's last two whole-board costs per person.
// A184 — the Full House's include_facets GROUP BY ran on EVERY load (JobsPanel always asks for it; ~700 ms of read-worker
//   time at 49k candidates): now kept with boardOrderCache's rules, keyed on the person's score mark + gate, dropped on writes.
// A185 — the board-load board-fit pass (once a minute per person) walked the whole board to find nothing to do (~30 s at
//   49k under load; 20 people kept the server busy, event loop max 56 s): after a nothing_to_do it waits 15 minutes; every
//   explicit trigger still runs at once, and the Hirebase feed now schedules its own pass when a window brings postings.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const SRC = fs.readFileSync("server.js", "utf8").replace(/\r\n/g, "\n");

test("a184: the Full House's include_facets counts are KEPT — keyed on the board, the dimensions, the score mark and the gate", () => {
  assert.match(SRC, /const boardDimFacetsCache = createFacetsCache\(\{ ttlMs: 5 \* 60 \* 1000, max: 300, staleMs: 15 \* 60 \* 1000 \}\);/);
  const block = SRC.slice(at(SRC, "if (facetDims.length) {"), at(SRC, "responseBody.facets = kept.value?.facets ?? {};"));
  assert.match(block, /return \{ status: 200, facets \};/, "facetsCache keeps only a 200 answer — a bare value was never kept (46f's first try)");
  assert.match(block, /const kept = await boardDimFacetsCache\.get\(boardKeyOf\("dims", \{ include_facets: facetDims\.join\(","\) \}\), async \(\) => \{/);
  assert.match(block, /facetsFromCrossTab\(plainDims, facetRows\)/, "the same one GROUP BY (D151) when it is counted");
  // the one key: the board without paging / order / projection, + the score mark (a scoring pass is a new entry) + the gate
  const key = SRC.slice(at(SRC, "const boardScoreMark = "), at(SRC, "const keepOrder = rawCursor"));
  assert.match(key, /"SELECT COALESCE\(MAX\(id\), 0\) AS e FROM ats_only_reports WHERE user_id = \? AND domain_profile_id IS \?"/);
  assert.match(key, /page: "", pageSize: "", page_size: "", cursor: "", include_fields: "", include_facets: "", sort: "",\n\s*\.\.\.extra, "~kind": kind, "~score": boardScoreMark, "~gate": gateBasis \?\? ""/);
  assert.match(key, /async \(\) => \(\{ status: 200, n: \(await readPool\.get\(sql, args\)\)\?\.n \|\| 0 \}\)\)\)\.value\?\.n \?\? 0;/);
  // the two per-load whole-board counts go through it
  assert.match(SRC, /count: await keptCount\("unclassified", `SELECT COUNT\(\*\) as n \$\{joinClause\} \$\{whereClause\} AND \$\{unclassifiedSql\}`, baseArgs\)/);
  assert.match(SRC, /const demotedRows = rankApplied \? await keptCount\("demoted",[\s\S]{0,400}\{ sort: req\.query\.sort \|\| "" \}\) : 0;/, "the sort decides the rank, so it is in the demoted key");
  // dropped wherever the kept order is
  // A195 leftover (46m): the order's clear skips a pass / save (applied in place by PATCH /api/jobs/interact); the counts still clear
  assert.match(SRC, /if \(writes && !\(req\.method === "PATCH" && req\.path === "\/api\/jobs\/interact"\)\) boardOrderCache\.clearUser\(req\.user\.id\);\n  if \(writes\) boardDimFacetsCache\.clearUser\(req\.user\.id\);/);
  // A195 (46j, changed on purpose): after a stored score the filter sentence's counts are marked stale (served, recounted
  // behind); the order and the Full House's counts are dropped (marking those stale raised the board's p95 — measured).
  assert.match(SRC, /facetsCache\.markStale\(userId\); boardOrderCache\.clearUser\(userId\); boardDimFacetsCache\.clearUser\(userId\);/);
});

test("a185: a board-load pass with nothing to do backs the catch-all off; explicit triggers are untouched; the feed scores its arrivals", () => {
  assert.match(SRC, /const BOARD_FIT_BOARD_IDLE_BACKOFF_MS = 15 \* 60_000;/);
  const fn = SRC.slice(at(SRC, "function scheduleBoardFit(userId, reason, profile = null) {"), at(SRC, "function boardFitIdle(userId) {"));
  assert.match(fn, /if \(reason === "board"\) \{/, "only the board-load trigger is rate-limited");
  assert.match(fn, /if \(reason === "board" && r\?\.status === "nothing_to_do"\) \{\n\s*_boardFitBoardTriggerAt\.set\(`\$\{userId\}:\$\{p\.id\}`, Date\.now\(\) \+ BOARD_FIT_BOARD_IDLE_BACKOFF_MS - BOARD_FIT_BOARD_TRIGGER_EVERY_MS\);/);
  assert.match(SRC, /if \(!r\.skipped && Object\.values\(r\.perFamily \|\| \{\}\)\.some\(v => Number\(v\?\.pulled\) > 0\)\) scheduleBoardFitForAll\("feed"\);/);
  assert.match(SRC, /scheduleBoardFitForAll\("crawl"\);/, "a crawl still scores its arrivals at once");
});
