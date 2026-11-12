import test from "node:test";
import assert from "node:assert/strict";
import { inBatches, boardFacetsResponse } from "../services/jobs/boardFacets.js";

// ⭐ A195 (46j, staging 100k × 20 users): facets p95 625–645 ms — the recount after a user's own write ran its view
// counts and unfolded clauses one after another. They now run `parallel` at a time; the answer is the same.
test("a195FacetsParallel: inBatches keeps the tasks' order and never runs more than n at once", async () => {
  let live = 0, peak = 0;
  const task = (v, ms) => async () => { live++; peak = Math.max(peak, live); await new Promise(r => setTimeout(r, ms)); live--; return v; };
  const out = await inBatches([task("a", 30), task("b", 5), task("c", 20), task("d", 1), task("e", 10)], 2);
  assert.deepEqual(out, ["a", "b", "c", "d", "e"]);
  assert.equal(peak, 2);
  assert.deepEqual(await inBatches([], 3), []);
  assert.equal((await inBatches([task(1, 1)], 1))[0], 1);
});

test("a195FacetsParallel: boardFacetsResponse answers the same body at parallel 1 and 3", async () => {
  // A stand-in board: every measure gets a ctx whose reader answers by the SQL's shape (deterministic per query).
  const measureBoard = async (query, measure) => {
    const n = Object.keys(query).length + 7;
    const ctx = { joinClause: "FROM t", whereClause: "WHERE 1", baseArgs: [], unclassifiedSql: null, fitScoreSql: null,
      read: { get: async (sql) => new Proxy({}, { get: (_t, k) => (k === "then" ? undefined : (String(k).length + n + sql.length) % 97) }), all: async () => [] } };
    try { return { status: 200, body: { measured: true, value: await measure(ctx) } }; }
    catch (e) { return { status: 200, body: { measured: true, value: {} } }; }
  };
  const args = { query: { q: "engineer" }, measureBoard, nowSec: 1_800_000_000, breathe: async () => {} };
  const a = await boardFacetsResponse({ ...args, parallel: 1 });
  const b = await boardFacetsResponse({ ...args, parallel: 3 });
  assert.equal(a.status, 200);
  assert.deepEqual(b, a);
  assert.deepEqual(Object.keys(b.body.clauses), Object.keys(a.body.clauses), "clause order kept");
});

// ⭐ A195 (46j): the keywords panel's stored score MARKS a user's kept counts stale instead of dropping them — the next ask
// is answered at once from the kept counts while one recount runs behind it; any other write still clears.
import { createFacetsCache } from "../services/jobs/facetsCache.js";
test("a195MarkStaleServesKeptCounts: after markStale the next ask is 'stale' (kept body, one recount behind); clearUser still forces a miss", async () => {
  let t = 1_000_000, computes = 0;
  const cache = createFacetsCache({ ttlMs: 300_000, staleMs: 900_000, now: () => t });
  const compute = (v) => async () => { computes++; return { status: 200, body: { v } }; };
  assert.equal((await cache.get("7|1|q", compute("A"))).cache, "miss");
  await cache.get("8|1|q", compute("other"));
  t += 1000;
  cache.markStale(7);
  const r = await cache.get("7|1|q", compute("B"));
  assert.equal(r.cache, "stale");
  assert.equal(r.value.body.v, "A", "answered at once from the kept counts");
  await new Promise((res) => setImmediate(res));
  assert.equal((await cache.get("7|1|q", compute("C"))).value.body.v, "B", "the recount behind it replaced the answer");
  assert.equal((await cache.get("8|1|q", compute("x"))).cache, "hit", "another user's entries untouched");
  cache.clearUser(7);
  assert.equal((await cache.get("7|1|q", compute("D"))).cache, "miss", "a real write still forces a recount");
  const noStale = createFacetsCache({ ttlMs: 300_000, now: () => t });
  await noStale.get("7|1|q", compute("E"));
  noStale.markStale(7);
  assert.equal((await noStale.get("7|1|q", compute("F"))).cache, "miss", "without staleMs markStale = clearUser");
});
