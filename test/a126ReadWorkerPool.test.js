// A126 (hotfix 11-05) · the board's heavy reads run in worker threads (services/db/readWorker.js), and the pool never
// fails closed: a dead worker, a timeout or a disabled pool answers on the main connection.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { createReadPool } from "../services/db/readWorker.js";

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "a126-"));
  const file = path.join(dir, "t.db");
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)");
  const ins = db.prepare("INSERT INTO t (v) VALUES (?)");
  db.transaction(() => { for (let i = 0; i < 2000; i++) ins.run(`v${i}`); })();
  return { dir, file, db };
}
const waitReady = async (pool, n = 1) => {
  for (let i = 0; i < 200 && pool.status().ready < n; i++) await new Promise(r => setTimeout(r, 25));
};

test("A126 · reads answer from the worker with the main connection's result, params bound positionally", async () => {
  const { dir, file, db } = fixture();
  const pool = createReadPool({ dbPath: file, fallbackDb: db, size: 2 });
  try {
    await waitReady(pool, 2);
    assert.equal(pool.status().ready, 2, "both workers start");
    assert.deepEqual(await pool.get("SELECT COUNT(*) AS n FROM t WHERE id > ?", [1000]), db.prepare("SELECT COUNT(*) AS n FROM t WHERE id > ?").get(1000));
    assert.deepEqual(await pool.all("SELECT id, v FROM t WHERE id BETWEEN ? AND ? ORDER BY id", [5, 7]),
      [{ id: 5, v: "v4" }, { id: 6, v: "v5" }, { id: 7, v: "v6" }]);
    // a write on the main connection is visible to the next pooled read (WAL readers see committed data)
    db.prepare("INSERT INTO t (v) VALUES ('new')").run();
    assert.equal((await pool.get("SELECT COUNT(*) AS n FROM t")).n, 2001);
    assert.ok(pool.status().served >= 3 && pool.status().fallback === 0, "served by the workers, not the fallback");
    // the board's SQL functions are registered in the worker
    const r = await pool.get("SELECT draft_search_cached('x', 'y') AS c");
    assert.equal(r.c, 0);
  } finally { await pool.close(); db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test("A126 · a SQL error is the SQL's own — thrown, not swallowed", async () => {
  const { dir, file, db } = fixture();
  const pool = createReadPool({ dbPath: file, fallbackDb: db, size: 1 });
  try {
    await waitReady(pool);
    await assert.rejects(pool.get("SELECT nope FROM t"), /no such column/);
  } finally { await pool.close(); db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test("A126 · never fails closed: disabled, or every worker gone, the main connection answers", async () => {
  const { dir, file, db } = fixture();
  const off = createReadPool({ dbPath: file, fallbackDb: db, enabled: false });
  assert.equal((await off.get("SELECT COUNT(*) AS n FROM t")).n, 2000);
  assert.equal(off.status().fallback, 1);
  const bad = createReadPool({ dbPath: path.join(dir, "missing.db"), fallbackDb: db, size: 1, log: { error() {} } });
  try {
    await new Promise(r => setTimeout(r, 300));     // the worker's open fails (fileMustExist) and it exits
    assert.equal((await bad.get("SELECT COUNT(*) AS n FROM t")).n, 2000, "a pool with no live worker reads the main connection");
    assert.ok(bad.status().fallback >= 1);
  } finally { await bad.close(); await off.close(); db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test("A126 · the event loop stays free while a pooled read runs", async () => {
  const { dir, file, db } = fixture();
  const pool = createReadPool({ dbPath: file, fallbackDb: db, size: 1 });
  try {
    await waitReady(pool);
    // a deliberately slow read: a recursive CTE of 3M rows
    const slow = pool.get("WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c WHERE x < 3000000) SELECT COUNT(*) AS n FROM c");
    let ticks = 0;
    const iv = setInterval(() => ticks++, 5);
    const r = await slow;
    clearInterval(iv);
    assert.equal(r.n, 3000000);
    assert.ok(ticks >= 3, `the loop kept serving timers during the read (${ticks} ticks)`);
  } finally { await pool.close(); db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test("A126 · server.js reads the board's list and counts through the pool, with a kill switch", () => {
  const src = fs.readFileSync("server.js", "utf8");
  assert.match(src, /const readPool = createReadPool\(\{/);
  assert.match(src, /DRAFT_READ_WORKERS/);
  assert.match(src, /readPool\.all\(\s*`SELECT sj\.job_id AS id \$\{joinClause\}/);   // A175: the page chosen by id in the pool, its columns after
  assert.match(src, /readPool\.all\(\s*`SELECT sj\.job_id AS id, COUNT\(\*\) OVER \(\) AS n \$\{joinClause\}/);   // …and the kept order
  assert.match(src, /value: await measure\(\{\s*db, read: readPool,/);
});
