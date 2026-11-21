// ⭐ 47a (D151 Rule 5, measured at 250k × 20 users): a SLOW pool read is never re-run on the main connection. The timeout
// counted from the QUEUE, and its fallback re-ran whole-board statements synchronously on the main thread — the event loop
// froze 141.6 s. Now: slow → still the worker's answer (counted in `slow`); hopeless (10 × the timeout) → rejected.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { createReadPool, HARD_TIMEOUT_FACTOR } from "../services/db/readWorker.js";

const SLOW = "WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c WHERE x < 3000000) SELECT COUNT(*) AS n FROM c";

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d151-nofallback-"));
  const file = path.join(dir, "t.db");
  const db = new Database(file); db.pragma("journal_mode = WAL"); db.exec("CREATE TABLE t (x INTEGER)"); db.close();
  return { dir, file, db: new Database(file) };
}
const ready = async (pool) => { for (let i = 0; i < 200 && pool.status().ready < 1; i++) await new Promise(r => setTimeout(r, 25)); assert.equal(pool.status().ready, 1, "the worker is up"); };

test("d151ReadPoolNoMainFallback: a read past the timeout keeps its worker's answer — nothing runs on the main connection", async () => {
  const { dir, file, db } = fixture();
  const pool = createReadPool({ dbPath: file, fallbackDb: db, size: 1, timeoutMs: 150, log: { log() {}, error() {} } });
  try {
    await ready(pool);
    const r = await pool.get(SLOW);
    assert.equal(r.n, 3000000);
    assert.equal(pool.status().fallback, 0, "not re-run on the main connection");
    assert.ok(pool.status().slow >= 1, "counted as slow");
  } finally { await pool.close(); db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test("d151ReadPoolNoMainFallback: a read with no answer in HARD_TIMEOUT_FACTOR × the timeout is REJECTED (read_timeout), never run here", async () => {
  const { dir, file, db } = fixture();
  const pool = createReadPool({ dbPath: file, fallbackDb: db, size: 1, timeoutMs: 5, log: { log() {}, error() {} } });
  try {
    await ready(pool);
    assert.equal(HARD_TIMEOUT_FACTOR, 10);
    await assert.rejects(pool.get(SLOW), (e) => e.code === "read_timeout");
    assert.equal(pool.status().fallback, 0);
  } finally { await pool.close(); db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});
