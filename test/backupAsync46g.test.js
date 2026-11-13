// ⛔ 46g (owner 11-11, "the admin panel is currently stuck on loading") · A RUNNING SERVER'S BACKUP NEVER HOLDS THE THREAD.
// Production, 16:05Z: an admin's candidate Approve took createBackup's fs.copyFileSync of the 6.2 GB database on the
// server's one thread — every request (Admin's panels, the crawler worker's poll) waited 95 s and then answered in the
// same millisecond. The running server's backups (Approve, the 02:00 auto-daily, Admin's Back up now) now use
// createBackupAsync: SQLite's online backup on the live connection, a step at a time. createBackup (sync) stays only
// for the pre-migration backup, which runs before the HTTP listener binds.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { configureBackups, createBackupAsync, listBackups, BackupRefused } from "../packages/sqlite-backup/src/index.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("46g · createBackupAsync: a consistent, complete copy while the same connection keeps writing — and the event loop keeps running", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bak46g-"));
  let db = null, tick = null;
  try {
    configureBackups({ dataDir: dir, dbFile: "live.db", filePrefix: "live" });
    db = new Database(path.join(dir, "live.db"));
    db.pragma("journal_mode = WAL");
    db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, body TEXT)");
    const ins = db.prepare("INSERT INTO t (body) VALUES (?)");
    const pad = "x".repeat(900);
    db.transaction(() => { for (let i = 0; i < 40000; i++) ins.run(pad + i); })();   // ≈ 40 MB, much of it still in the WAL
    const before = db.prepare("SELECT COUNT(*) AS n FROM t").get().n;

    // The event loop's longest pause while the backup runs, and writes through the SAME connection meanwhile.
    let last = Date.now(), maxGap = 0, wrote = 0;
    tick = setInterval(() => { const now = Date.now(); maxGap = Math.max(maxGap, now - last); last = now; ins.run("during"); wrote++; }, 5);
    let second = null;
    const p = createBackupAsync("t46g", { db, pagesPerStep: 256 });
    second = await createBackupAsync("t46g-again", { db }).then(() => "ran", (e) => e);   // one at a time
    const out = await p;
    clearInterval(tick);

    assert.ok(second instanceof BackupRefused, "a second backup while one runs is refused, not queued");
    assert.ok(out?.filename && fs.existsSync(out.path), "the backup file exists");
    assert.ok(wrote > 0, "the server kept writing during the backup");
    assert.ok(maxGap < 250, `the event loop ran during the backup (longest pause ${maxGap} ms)`);

    assert.equal(fs.existsSync(out.path + "-wal"), false, "one plain file — no sidecar to restore");   // read before anything opens the copy
    const copy = new Database(out.path, { readonly: true });
    assert.equal(copy.pragma("integrity_check", { simple: true }), "ok");
    const n = copy.prepare("SELECT COUNT(*) AS n FROM t").get().n;
    assert.ok(n >= before, `every row committed before the backup is in it (${n} ≥ ${before}) — the WAL's pages included`);
    copy.close();

    const m = listBackups();
    assert.equal(m[0].filename, out.filename);
    // A196 (46j, changed on purpose): the running server's copy is VACUUM INTO in a worker thread (the online backup's
    // final fsync froze production for ~57 s); the step-wise online backup stays behind { worker: false }.
    assert.deepEqual([m[0].label, m[0].method, m[0].walCheckpointed], ["t46g", "vacuum-into-worker", true]);
    assert.ok(m[0].size > 30 * 1024 * 1024, `its size is recorded (${m[0].size})`);
  } finally {
    clearInterval(tick); try { db?.close(); } catch {}
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* Windows may hold the file a moment */ }
  }
});

test("46g · the running server's three backups are the async one; only the pre-migration backup stays synchronous", () => {
  const routes = read("routes/companies.js");
  assert.match(routes, /backup = \(label\) => createBackupAsync\(label, \{ db \}\)/);
  assert.match(routes, /router\.post\("\/candidates\/approve", async \(req, res\) => \{/);
  assert.match(routes, /try \{ snapshot = await backup\("pre-d82-candidates"\); \}/);
  assert.doesNotMatch(routes, /\bcreateBackup\(/, "no synchronous backup in the companies router");
  const server = read("server.js");
  assert.match(server, /createBackupAsync\("auto-daily", \{ db \}\)\.catch\(/);
  assert.match(server, /app\.post\("\/api\/admin\/backups", requireAdmin, async \(req, res\) => \{\n  try \{\n    const result = await createBackupAsync\(req\.body\.label\|\|"manual", \{ db \}\);/);
  // the one synchronous call left is the pre-migration backup, before the listener binds
  assert.deepEqual([...server.matchAll(/\bcreateBackup\(([^)]*)\)/g)].map(m => m[1]), ["label"]);
});

// ⛔ A196 (46j): production 11-12 05:05–05:07Z — Approve's online backup froze every request ~57 s at its end (the
// destination's commit + fsync on the one thread). The copy now runs as VACUUM INTO in a worker thread.
test("a196BackupOffTheThread: the worker copy is consistent while the server writes; the loop never waits on it; worker:false keeps the step-wise path", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bak196-"));
  let db = null, tick = null;
  try {
    configureBackups({ dataDir: dir, dbFile: "live.db", filePrefix: "live" });
    db = new Database(path.join(dir, "live.db"));
    db.pragma("journal_mode = WAL");
    db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, body TEXT)");
    const ins = db.prepare("INSERT INTO t (body) VALUES (?)");
    const pad = "y".repeat(900);
    db.transaction(() => { for (let i = 0; i < 60000; i++) ins.run(pad + i); })();
    const before = db.prepare("SELECT COUNT(*) AS n FROM t").get().n;
    let last = Date.now(), maxGap = 0, wrote = 0;
    tick = setInterval(() => { const now = Date.now(); maxGap = Math.max(maxGap, now - last); last = now; ins.run("during"); wrote++; }, 5);
    const out = await createBackupAsync("t196", { db });
    clearInterval(tick);
    assert.ok(wrote > 0, "the server kept writing during the copy");
    assert.ok(maxGap < 150, `the event loop never waited on the copy (longest pause ${maxGap} ms)`);
    assert.equal(fs.existsSync(out.path + "-wal"), false, "one plain file");
    const copy = new Database(out.path, { readonly: true });
    assert.equal(copy.pragma("integrity_check", { simple: true }), "ok");
    assert.ok(copy.prepare("SELECT COUNT(*) AS n FROM t").get().n >= before, "every row committed before the copy is in it");
    copy.close();
    assert.equal(listBackups()[0].method, "vacuum-into-worker");
    const stepwise = await createBackupAsync("t196-stepwise", { db, worker: false });
    assert.ok(fs.existsSync(stepwise.path));
    assert.equal(listBackups()[0].method, "online-backup");
  } finally {
    clearInterval(tick); try { db?.close(); } catch {}
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* Windows may hold the file a moment */ }
  }
});

// ⛔ A196 (2) (production 11-13 02:00Z): the worker's copy written straight onto the database's volume flushed in one burst
// and the server's reads queued behind it (every request waited 39 s). The snapshot is staged on another disk, then copied
// onto the volume at a capped rate with periodic syncs.
test("a196StagedThrottledCopy: the snapshot is staged, copied at the cap, synced, and the stage removed", async () => {
  const { vacuumIntoInWorker } = await import("../packages/sqlite-backup/src/index.js");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bak196b-"));
  try {
    const src = path.join(dir, "live.db");
    const db = new Database(src);
    db.pragma("journal_mode = WAL");
    db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, body TEXT)");
    const ins = db.prepare("INSERT INTO t (body) VALUES (?)");
    db.transaction(() => { for (let i = 0; i < 8000; i++) ins.run("z".repeat(900) + i); })();   // ≈ 8 MB
    const stage = path.join(dir, "stage.db"), dest = path.join(dir, "out.db");
    const t0 = Date.now();
    await vacuumIntoInWorker(src, dest, { stage, mbps: 20 });
    const ms = Date.now() - t0, size = fs.statSync(dest).size;
    assert.equal(fs.existsSync(stage), false, "the stage is removed");
    assert.ok(ms >= (size / (20 * 1048576)) * 1000 * 0.8, `copied no faster than the cap (${size} B in ${ms} ms)`);
    const copy = new Database(dest, { readonly: true });
    assert.equal(copy.pragma("integrity_check", { simple: true }), "ok");
    assert.equal(copy.prepare("SELECT COUNT(*) AS n FROM t").get().n, 8000);
    copy.close(); db.close();
    await assert.rejects(vacuumIntoInWorker(path.join(dir, "missing.db"), path.join(dir, "x.db"), { stage: path.join(dir, "s2.db") }));
    assert.equal(fs.existsSync(path.join(dir, "s2.db")), false, "a failed copy leaves no stage behind");
  } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }
});
