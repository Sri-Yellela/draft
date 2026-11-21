// ⭐ D156 (6) / D151 · THE FILTER SENTENCE'S COUNTS OFF THE HOT LOOP (44v). A CPU profile of the 82k copy under Home's reads
// found every long busy stretch of the event loop in boardPageResponse on a request path, the largest GET /api/jobs/facets:
// 5 + N whole-board aggregates back to back, on every Home render. Now: kept per user + profile + query (2 min), one count
// in flight per key, dropped on the user's own writes; and the aggregates yield to the loop between them.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createFacetsCache, facetsKey, FACETS_TTL_MS } from "../services/jobs/facetsCache.js";
import { boardFacetsResponse } from "../services/jobs/boardFacets.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("facetsKey: the query's keys sorted, empty values dropped — one entry per meaning", () => {
  assert.equal(facetsKey(7, 3, { b: "2", a: "1", c: "" }), facetsKey(7, 3, { a: "1", b: "2" }));
  assert.notEqual(facetsKey(7, 3, { a: "1" }), facetsKey(7, 4, { a: "1" }), "another profile is another entry");
  assert.notEqual(facetsKey(7, 3, { a: "1" }), facetsKey(8, 3, { a: "1" }), "another user is another entry");
  assert.match(facetsKey(7, null, {}), /^7\|\|$/);
});

test("d156FacetsKeptPerUser: a hit within the TTL, a miss after it; only 200 answers are kept", async () => {
  let t = 1_000, n = 0;
  const cache = createFacetsCache({ now: () => t });
  const ok = () => { n++; return { status: 200, body: { total: n } }; };
  const a = await cache.get("1|2|", ok);
  assert.deepEqual([a.cache, a.value.body.total, n], ["miss", 1, 1]);
  t += FACETS_TTL_MS - 1;
  const b = await cache.get("1|2|", ok);
  assert.deepEqual([b.cache, b.value.body.total, n, b.asOf], ["hit", 1, 1, 1_000], "kept, with when it was counted");
  t += 2;
  assert.equal((await cache.get("1|2|", ok)).cache, "miss", "past the TTL it is counted again");
  const bad = await cache.get("1|2|q=x", () => ({ status: 400, body: {} }));
  assert.equal(bad.cache, "miss");
  assert.equal((await cache.get("1|2|q=x", () => ({ status: 200, body: {} }))).cache, "miss", "a 400 was never kept");
});

test("d156FacetsSingleFlight: a second identical ask while the first counts waits for it — one count", async () => {
  const cache = createFacetsCache();
  let runs = 0, release;
  const slow = () => new Promise((r) => { runs++; release = () => r({ status: 200, body: { total: 5 } }); });
  const p1 = cache.get("1|2|", slow), p2 = cache.get("1|2|", slow);
  await new Promise(setImmediate);
  release();
  const [a, b] = await Promise.all([p1, p2]);
  assert.equal(runs, 1);
  assert.deepEqual([a.cache, b.cache], ["miss", "shared"]);
  assert.equal(b.value.body.total, 5);
});

test("d156FacetsClearedOnTheUsersWrite: their kept and in-flight counts go; another user's stay", async () => {
  const cache = createFacetsCache();
  await cache.get("1|2|", () => ({ status: 200, body: {} }));
  await cache.get("9|2|", () => ({ status: 200, body: {} }));
  let release;
  const p = cache.get("1|2|q=a", () => new Promise((r) => { release = () => r({ status: 200, body: {} }); }));
  await new Promise(setImmediate);
  cache.clearUser(1);
  release(); await p;
  assert.equal((await cache.get("1|2|", () => ({ status: 200, body: {} }))).cache, "miss", "user 1's kept count is gone");
  assert.equal((await cache.get("1|2|q=a", () => ({ status: 200, body: {} }))).cache, "miss", "a count started before the write is not kept");
  assert.equal((await cache.get("9|2|", () => ({ status: 200, body: {} }))).cache, "hit", "user 9's stays");
});

test("the cache holds at most `max` entries, the oldest dropped first", async () => {
  const cache = createFacetsCache({ max: 2 });
  for (const k of ["1|1|a", "1|1|b", "1|1|c"]) await cache.get(k, () => ({ status: 200, body: {} }));
  assert.equal(cache.size(), 2);
  assert.equal((await cache.get("1|1|a", () => ({ status: 200, body: {} }))).cache, "miss");
});

// A board stub: every aggregate answers 1 for totals / counts, 0 for the rest.
const zeroRow = new Proxy({}, { get: (_t, k) => (k === "then" ? undefined : (k === "total" || k === "n") ? 1 : 0) });
const ctx = { db: { prepare: () => ({ get: () => zeroRow, all: () => [] }) }, joinClause: "", whereClause: "", baseArgs: [] };

test("d156FacetsYieldBetweenAggregates: the loop is given back before each view count and each clause", async () => {
  const order = [];
  let measures = 0, breaths = 0;
  // The stub awaits the aggregate like the real measureBoard (45k: before, an un-awaited Promise spread into {} unnoticed).
  const measureBoard = async (_q, fn) => { measures++; order.push("m"); return { status: 200, body: { measured: true, value: await fn(ctx) } }; };
  const r = await boardFacetsResponse({ query: {}, nowSec: 1_800_000_000, measureBoard, breathe: async () => { breaths++; order.push("b"); } });
  assert.equal(r.status, 200);
  assert.equal(breaths, measures - 1, "one breath before every aggregate after the head");
  assert.equal(order[0], "m"); assert.ok(!order.join("").includes("mm"), "never two aggregates back to back");

  // With the real yield, something queued meanwhile (a health check) runs between the aggregates.
  const seen = [];
  let k = 0;
  const measureReal = async (_q, fn) => { seen.push(`m${k++}`); if (k === 1) setImmediate(() => seen.push("other")); return { status: 200, body: { measured: true, value: await fn(ctx) } }; };
  await boardFacetsResponse({ query: {}, nowSec: 1_800_000_000, measureBoard: measureReal });
  assert.equal(seen.indexOf("other"), 1, `the waiting work ran right after the head aggregate (${seen.slice(0, 4)})`);
});

test("server.js: the route is cached and says so; the user's writes clear it after their auth context is bound", () => {
  const s = read("server.js");
  assert.match(s, /import \{ createFacetsCache, facetsKey, createRefreshGate, looseCountKey \} from "\.\/services\/jobs\/facetsCache\.js";/);
  assert.match(s, /const key = facetsKey\(req\.user\.id, profileId, \{ \.\.\.req\.query, "~visit": visitMark\(db, req\.user\.id\) \?\? "first" \}\);/,
    "the visit mark rolls on a GET, so it is part of the key — the stored mark, never the fallback that moves with now");
  assert.match(s, /await facetsCache\.get\(key, \(\) => facetsAnswer\(req, lens\)\);/);
  assert.match(s, /res\.set\("X-Facets-Cache", cache\);\n  res\.set\("X-Facets-As-Of", new Date\(asOf\)\.toISOString\(\)\);/);
  const bind = s.indexOf("app.use(bindAuthContext);"), clear = s.indexOf("facetsCache.clearUser(req.user.id)");
  assert.ok(bind > 0 && clear > bind, "the clear runs after bindAuthContext binds a token's user");
  // ⭐ A183 (46f, on purpose): every write still clears — except the keywords panel's POST, which clears itself only when it
  // stores a report (test/a183KeywordsPanelKeepsCaches.test.js).
  assert.match(s, /const writes = req\.method !== "GET" && req\.method !== "HEAD" && req\.user\?\.id != null && !\(req\.method === "POST" && KEYWORDS_PANEL\.test\(req\.path\)\);\n  if \(writes\) facetsCache\.clearUser\(req\.user\.id\);/);
});
