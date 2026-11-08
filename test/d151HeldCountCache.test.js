// D151 (45k) · the board's "N more being matched" held read, kept per user + statement (services/jobs/heldCountCache.js).
import test from "node:test";
import assert from "node:assert/strict";
import { createHeldCountCache, heldKey } from "../services/jobs/heldCountCache.js";

const clock = () => { let t = 1_000; return { now: () => t, add: (ms) => { t += ms; } }; };

test("d151HeldCountCache: fresh is a hit (nothing read), stale answers at once and refreshes once behind it, old reads again", async () => {
  const c = clock();
  const cache = createHeldCountCache({ freshMs: 100, staleMs: 1000, now: c.now });
  let reads = 0;
  const compute = async () => ({ count: ++reads, more: false });
  const k = heldKey(7, "SELECT 1", [1]);
  assert.deepEqual(await cache.get(k, compute), { value: { count: 1, more: false }, cache: "miss" });
  assert.equal((await cache.get(k, compute)).cache, "hit");
  assert.equal(reads, 1);
  c.add(200);
  const stale = await cache.get(k, compute);
  assert.equal(stale.cache, "stale"); assert.equal(stale.value.count, 1, "the kept answer, at once");
  await cache.get(k, compute);            // a second stale ask while the refresh flies starts no other
  await new Promise(r => setImmediate(r));
  assert.equal(reads, 2, "exactly one refresh");
  assert.equal((await cache.get(k, compute)).value.count, 2, "the refresh's answer is kept");
  c.add(5000);
  assert.equal((await cache.get(k, compute)).cache, "miss");
});

test("d151HeldCountCache: concurrent misses share one read; another statement or user is another entry", async () => {
  const cache = createHeldCountCache();
  let reads = 0;
  const compute = async () => { reads++; await new Promise(r => setTimeout(r, 5)); return { count: reads }; };
  const [a, b] = await Promise.all([cache.get(heldKey(1, "S", []), compute), cache.get(heldKey(1, "S", []), compute)]);
  assert.equal(reads, 1); assert.equal(a.cache, "miss"); assert.equal(b.cache, "shared");
  await cache.get(heldKey(1, "S2", []), compute);
  await cache.get(heldKey(2, "S", []), compute);
  assert.equal(reads, 3);
});

test("d151HeldCountCache: clearUser drops only that user's entries (their scoring landed)", async () => {
  const cache = createHeldCountCache();
  const compute = async () => ({ count: 1 });
  await cache.get(heldKey(1, "S", []), compute);
  await cache.get(heldKey(12, "S", []), compute);
  cache.clearUser(1);
  assert.equal((await cache.get(heldKey(1, "S", []), compute)).cache, "miss");
  assert.equal((await cache.get(heldKey(12, "S", []), compute)).cache, "hit", "user 12 is not user 1");
});

test("d151HeldCountCache: a failed read is not kept, and is the caller's error", async () => {
  const cache = createHeldCountCache();
  await assert.rejects(cache.get(heldKey(1, "S", []), async () => { throw new Error("boom"); }), /boom/);
  assert.equal(cache.size(), 0);
  assert.equal((await cache.get(heldKey(1, "S", []), async () => ({ count: 3 }))).value.count, 3);
});

test("d151HeldCountCache: bounded, the oldest dropped first", async () => {
  const cache = createHeldCountCache({ max: 2 });
  for (const s of ["a", "b", "c"]) await cache.get(heldKey(1, s, []), async () => ({ count: 0 }));
  assert.equal(cache.size(), 2);
});
