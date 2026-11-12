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
