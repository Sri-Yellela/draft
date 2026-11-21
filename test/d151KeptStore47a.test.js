// ⭐ 47a (D151 Rule 5, measured at 250k × 20 users) · the board's kept answers (order, Full House counts, the filter sentence)
// survive a restart: a second level in the database (migration 280, services/jobs/keptStore.js) under the SAME key; a first
// load after a deploy is answered at once as "stale" with one recount behind it; the person's own write deletes their rows.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { createFacetsCache, facetsKey, createRefreshGate } from "../services/jobs/facetsCache.js";
import { createKeptStore, KEPT_STORE_MAX_AGE_S } from "../services/jobs/keptStore.js";
import { MERGE_PLAN } from "../services/accountService.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const dbWithTable = () => {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY);
    INSERT INTO users (id) VALUES (7), (8);
    CREATE TABLE board_kept_cache (cache_key TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL, value_json TEXT NOT NULL, written_at INTEGER NOT NULL)`);
  return db;
};

test("d151KeptStore: a counted answer is written through; a NEW process (a fresh cache on the same db) answers it at once, as stale, with one recount behind", async () => {
  const db = dbWithTable();
  let t = 1_000_000_000_000;
  const now = () => t;
  const key = facetsKey(7, 3, { "~epoch": 42 });
  let counts = 0;
  const compute = async () => { counts++; return { status: 200, ids: ["a", "b"], total: 2 }; };
  const first = createFacetsCache({ ttlMs: 300_000, staleMs: 900_000, now, store: createKeptStore(db, "order", { now }), storeStaleMs: 6 * 3600_000 });
  assert.equal((await first.get(key, compute)).cache, "miss");
  assert.equal(counts, 1);
  t += 2 * 3600_000;   // a deploy two hours later — memory is gone, the row is not
  const fresh = createFacetsCache({ ttlMs: 300_000, staleMs: 900_000, now, store: createKeptStore(db, "order", { now }), storeStaleMs: 6 * 3600_000 });
  const got = await fresh.get(key, compute);
  assert.equal(got.cache, "stale", "answered at once from the database");
  assert.deepEqual(got.value.ids, ["a", "b"]);
  await new Promise(r => setImmediate(r));
  assert.equal(counts, 2, "one recount behind it");
  // past the store's window it is a plain miss (never an old answer forever)
  t += 7 * 3600_000;
  const later = createFacetsCache({ ttlMs: 300_000, staleMs: 900_000, now, store: createKeptStore(db, "order", { now }), storeStaleMs: 6 * 3600_000 });
  assert.equal((await later.get(key, compute)).cache, "miss");
});

test("d151KeptStore: the person's own write deletes their rows (only theirs, only this kind); a non-200 is never kept; failures are swallowed", async () => {
  const db = dbWithTable();
  const order = createKeptStore(db, "order"), facets = createKeptStore(db, "facets");
  order.write(facetsKey(7, 1, {}), { status: 200, ids: [] });
  order.write(facetsKey(8, 1, {}), { status: 200, ids: [] });
  facets.write(facetsKey(7, 1, {}), { status: 200, body: {} });
  const c = createFacetsCache({ store: order });
  c.clearUser(7);
  const rows = db.prepare("SELECT kind, user_id FROM board_kept_cache ORDER BY kind, user_id").all();
  assert.deepEqual(rows, [{ kind: "facets", user_id: 7 }, { kind: "order", user_id: 8 }]);
  const c2 = createFacetsCache({ store: order });
  await c2.get(facetsKey(8, 2, {}), async () => ({ status: 500 }));
  assert.equal(db.prepare("SELECT COUNT(*) n FROM board_kept_cache WHERE cache_key LIKE 'order:8|2|%'").get().n, 0);
  const broken = createKeptStore(new Database(":memory:"), "order");   // no table yet
  assert.equal(broken.read("7|1|"), null);
  assert.doesNotThrow(() => broken.write("7|1|", { status: 200 }));
  assert.ok(KEPT_STORE_MAX_AGE_S >= 6 * 3600);
});

test("d151KeptStore: migration 280 in both lists, a cascade on the account, dropped on merge; the three board caches use it", () => {
  for (const f of ["server.js", "scripts/migrations.js"]) {
    const s = read(f);
    assert.match(s, /id: "280_board_kept_cache"/, f);
    assert.match(s, /user_id     INTEGER NOT NULL REFERENCES users\(id\) ON DELETE CASCADE/, f);
  }
  assert.equal(MERGE_PLAN.board_kept_cache, "drop");
  const srv = read("server.js");
  for (const kind of ["facets", "order", "dim"]) assert.match(srv, new RegExp(`store: createKeptStore\\(db, "${kind}"\\), storeStaleMs: 6 \\* 3600 \\* 1000`), kind);
});

test("d151KeptStore: the recounts BEHIND stale answers go one at a time through the shared gate; a miss never waits on it", async () => {
  const gate = createRefreshGate(1);
  let t = 0; const now = () => t;
  let running = 0, peak = 0;
  const slow = async () => { running++; peak = Math.max(peak, running); await new Promise(r => setTimeout(r, 20)); running--; return { status: 200, n: 1 }; };
  const c = createFacetsCache({ ttlMs: 10, staleMs: 1000, now, refreshGate: gate });
  for (let i = 0; i < 5; i++) await c.get(`7|1|q=${i}`, slow);   // five misses, counted at once as asked
  t = 100;                                                         // all five now stale
  const answers = await Promise.all([0, 1, 2, 3, 4].map(i => c.get(`7|1|q=${i}`, slow)));
  assert.ok(answers.every(a => a.cache === "stale"), "answered at once");
  peak = 0;
  while (gate.status().running || gate.status().waiting) await new Promise(r => setTimeout(r, 5));
  assert.equal(peak, 1, "one recount at a time");
  const miss = await c.get("8|1|fresh", slow);
  assert.equal(miss.cache, "miss");
  assert.match(read("server.js"), /const boardRefreshGate = createRefreshGate\(1\);/);
});

test("d151KeptStore: the held count — 'none being matched' fresh 5 min, its refresh through the gate, kept across a restart (long keys hashed)", async () => {
  const { createHeldCountCache, heldKey, HELD_EMPTY_FRESH_MS } = await import("../services/jobs/heldCountCache.js");
  const db = dbWithTable();
  let t = 1_000_000_000_000; const now = () => t;
  const key = heldKey(7, "SELECT sj.job_id AS id FROM scraped_jobs sj " + "x".repeat(500), [1, 2]);
  let reads = 0;
  const none = async () => { reads++; return { count: 0, more: false }; };
  const gate = createRefreshGate(1);
  const a = createHeldCountCache({ freshMs: 120_000, now, store: createKeptStore(db, "held", { now }), storeStaleMs: 6 * 3600_000, refreshGate: gate });
  assert.equal((await a.get(key, none)).cache, "miss");
  t += 200_000;   // past freshMs, inside the empty answer's 5 min
  assert.equal(HELD_EMPTY_FRESH_MS, 300_000);
  assert.equal((await a.get(key, none)).cache, "hit", "nothing held: no 9 s walk every 2 min");
  assert.equal(reads, 1);
  const row = db.prepare("SELECT cache_key FROM board_kept_cache WHERE kind = 'held'").get();
  assert.match(row.cache_key, /^held:7\|#[0-9a-f]{40}$/, "a long key stored as the user + a hash");
  t += 3600_000;  // a restart an hour later
  const b = createHeldCountCache({ freshMs: 120_000, now, store: createKeptStore(db, "held", { now }), storeStaleMs: 6 * 3600_000, refreshGate: gate });
  assert.equal((await b.get(key, none)).cache, "stale", "answered at once after a restart");
  while (gate.status().running || gate.status().waiting) await new Promise(r => setTimeout(r, 5));
  assert.equal(reads, 2, "one refresh behind it, through the gate");
  b.clearUser(7);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM board_kept_cache WHERE kind = 'held'").get().n, 0, "their scoring landing clears it");
});

test("d151KeptStore: a count whose score / visit mark moved is answered from the loose key (stale, one recount behind); an order never is", async () => {
  const { looseCountKey } = await import("../services/jobs/facetsCache.js");
  const db = dbWithTable();
  let t = 1_000_000_000_000; const now = () => t;
  let counts = 0;
  const count = async () => { counts++; return { status: 200, n: counts }; };
  const mk = () => createFacetsCache({ ttlMs: 300_000, staleMs: 900_000, now, store: createKeptStore(db, "dim", { now }), storeStaleMs: 6 * 3600_000, looseKey: looseCountKey });
  await mk().get(facetsKey(7, 3, { "~kind": "dim", "~score": 55 }), count);
  t += 60_000;
  const moved = await mk().get(facetsKey(7, 3, { "~kind": "dim", "~score": 56 }), count);   // scoring landed: a new score mark
  assert.equal(moved.cache, "stale", "the near-right count at once");
  assert.equal(moved.value.n, 1);
  assert.equal(looseCountKey("7|3|a=1&~score=9&~visit=x"), "7|3|a=1#loose");
  assert.doesNotMatch(read("server.js"), /store: createKeptStore\(db, "order"\)[^\n]*looseKey/, "the order keeps its exact key (the cursor's epoch check)");
});

test("d151KeptStore: a stored answer read AGAIN is still stale at once — it never waits behind the refresh queued in the gate", async () => {
  const db = dbWithTable();
  let t = 1_000_000_000_000; const now = () => t;
  const key = facetsKey(7, 3, { "~kind": "dim" });
  createKeptStore(db, "dim", { now }).write(key, { status: 200, n: 1 }, t - 3600_000);   // an hour old: past staleMs, inside the store window
  const gate = createRefreshGate(1);
  let release;
  const blocker = gate.run(() => new Promise(r => { release = r; }));   // the gate is busy until released
  const c = createFacetsCache({ ttlMs: 300_000, staleMs: 900_000, now, store: createKeptStore(db, "dim", { now }), storeStaleMs: 6 * 3600_000, refreshGate: gate });
  const first = await c.get(key, async () => ({ status: 200, n: 2 }));
  const second = await Promise.race([c.get(key, async () => ({ status: 200, n: 3 })), new Promise(r => setTimeout(() => r("waited"), 200))]);
  assert.equal(first.cache, "stale");
  assert.notEqual(second, "waited", "the second read must not wait for the queued refresh");
  assert.equal(second.cache, "stale");
  release(); await blocker;
});
