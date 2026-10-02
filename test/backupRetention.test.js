// Backup retention, and the two ways this directory reached 442 MB.
//
// CAUSE ONE was an import side effect. scripts/backup.js ended in an unguarded CLI block, and
// server.js imports createBackup for its auto-daily job — so every server boot fell through to the
// default branch and wrote a full copy of the DB. 27 of the 30 backups on disk were restarts.
//
// CAUSE TWO was count-only retention. `manifest.slice(0, 30)` cost 40 MB when the DB was 1.3 MB and
// 3.5 GB once migration 082's LCA tables took it to 116 MB. The policy never changed; the row count
// did. A count cap cannot see that, which is why the budget is in bytes.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { selectRetained, backupLimits } from "../scripts/backup.js";
import { at } from "../test-support/sourceAnchors.js";

const MB = 1024 * 1024;
// A65: the policy moved to packages/sqlite-backup unchanged; scripts/backup.js keeps draft's paths and
// the CLI. Every source assertion below reads the two together — the code is the same code.
const BACKUP_SRC = fs.readFileSync(new URL("../packages/sqlite-backup/src/index.js", import.meta.url), "utf8") + "\n" +
  fs.readFileSync(new URL("../scripts/backup.js", import.meta.url), "utf8");

/** Newest-first, the order the manifest stores. */
const entry = (n, label = "manual", size = 100 * MB) => ({ filename: `b${n}.db`, label, size });

// ── The import side effect ───────────────────────────────────────────────────────────────────

test("the CLI block is guarded, so importing this module cannot write a backup", () => {
  assert.match(BACKUP_SRC, /const isEntryPoint = process\.argv\[1\] &&/,
    "the run-as-script block must be gated on being the entry point");
  assert.match(BACKUP_SRC, /if \(isEntryPoint\) \{/);
  // The default branch — the one that fired on every server boot — must sit INSIDE the guard.
  const guardAt = BACKUP_SRC.indexOf("if (isEntryPoint) {");
  const createAt = BACKUP_SRC.lastIndexOf('createBackup(args[0] || "manual")');
  assert.ok(guardAt > 0 && createAt > guardAt,
    "createBackup(args[0]) must be inside the entry-point guard, not at module scope");
  // Importing for real is the actual proof, and test/ importing it above already exercises that:
  // if the guard were missing, running this suite would have written a backup.
});

// ── The byte budget ──────────────────────────────────────────────────────────────────────────

test("the byte budget binds before the count cap when backups are large", () => {
  // Ten 100 MB backups under a 30-count cap: the count says keep all ten, the budget says five.
  const entries = Array.from({ length: 10 }, (_, i) => entry(i));
  const { keep, drop, keptBytes } = selectRetained(entries,
    { maxBytes: 500 * MB, maxCount: 30, minKeep: 3 });
  assert.equal(keep.length, 5);
  assert.equal(drop.length, 5);
  assert.ok(keptBytes <= 500 * MB, `kept ${keptBytes} over budget`);
  // And it keeps the NEWEST five, not an arbitrary five.
  assert.deepEqual(keep.map(e => e.filename), ["b0.db", "b1.db", "b2.db", "b3.db", "b4.db"]);
});

test("the count cap still binds when backups are small — the old behaviour is intact", () => {
  const entries = Array.from({ length: 40 }, (_, i) => entry(i, "manual", 1.3 * MB));
  const { keep } = selectRetained(entries, { maxBytes: 512 * MB, maxCount: 30, minKeep: 3 });
  assert.equal(keep.length, 30, "40 tiny backups under a 30 cap must retain 30");
});

test("the newest backup is never pruned, even alone over budget", () => {
  // A DB bigger than the whole budget. Deleting the only copy of the current state to satisfy a
  // number would be the worst thing this function could do.
  const entries = [entry(0, "manual", 900 * MB), entry(1, "manual", 900 * MB)];
  const { keep } = selectRetained(entries, { maxBytes: 512 * MB, maxCount: 30, minKeep: 1 });
  assert.deepEqual(keep.map(e => e.filename), ["b0.db"]);
});

test("MIN_KEEP overrides the budget — one backup is not a backup", () => {
  const entries = Array.from({ length: 6 }, (_, i) => entry(i, "manual", 400 * MB));
  const { keep } = selectRetained(entries, { maxBytes: 512 * MB, maxCount: 30, minKeep: 3 });
  assert.equal(keep.length, 3, "the floor holds even though 3 x 400 MB blows a 512 MB budget");
  // ...but the floor must not override the COUNT cap, or maxCount stops meaning anything.
  const capped = selectRetained(entries, { maxBytes: 512 * MB, maxCount: 1, minKeep: 3 });
  assert.equal(capped.keep.length, 1);
});

// ── Keeping the KINDS of restore point ───────────────────────────────────────────────────────

test("a burst of manual backups cannot evict every auto-daily", () => {
  // The realistic failure: a day of restarts/manual saves pushes the coarse history off the end,
  // leaving five copies of one afternoon and no older restore point at all.
  const entries = [
    ...Array.from({ length: 8 }, (_, i) => entry(i, "manual")),
    entry(90, "auto-daily"),
    entry(91, "auto-daily"),
  ];
  const { keep } = selectRetained(entries, { maxBytes: 500 * MB, maxCount: 30, minKeep: 1 });
  assert.equal(keep.length, 5, "budget still respected");
  assert.ok(keep.some(e => e.label === "auto-daily"),
    "the newest auto-daily must survive a burst of manuals");
  assert.equal(keep[0].filename, "b0.db", "and the newest overall still leads");
});

test("a pre-restore snapshot is protected as its own kind", () => {
  // It is the file you want most after a mistaken restore, and it used to be untracked entirely —
  // never listed, never pruned. Now it has a label, so rule 2 keeps the newest one.
  const entries = [
    ...Array.from({ length: 6 }, (_, i) => entry(i, "manual")),
    entry(80, "pre-restore"),
    entry(90, "auto-daily"),
  ];
  const { keep } = selectRetained(entries, { maxBytes: 400 * MB, maxCount: 30, minKeep: 1 });
  assert.ok(keep.some(e => e.label === "pre-restore"), "the pre-restore snapshot must survive");
  assert.ok(keep.some(e => e.label === "auto-daily"));
  assert.ok(keep.reduce((n, e) => n + e.size, 0) <= 400 * MB);
});

test("restoreBackup records the pre-restore copy in the manifest", () => {
  // Untracked files are invisible to `list` and immune to pruning — the two properties that made
  // them accumulate forever.
  assert.match(BACKUP_SRC, /filename: safeName, label: "pre-restore"/);
  const at = BACKUP_SRC.indexOf('label: "pre-restore"');
  assert.ok(BACKUP_SRC.slice(at).includes("saveManifest(keep)"),
    "and the manifest must actually be written after adding it");
});

// ── The WAL, which is why a file copy was not a backup ───────────────────────────────────────

test("copying only the main file loses committed data; a TRUNCATE checkpoint recovers it", () => {
  // THE PROPERTY, demonstrated on a throwaway database rather than asserted about ours. Measured on
  // the real one first: two backups nine hours apart and the live DB all shared one md5, because the
  // main file had not changed while a 41 MB WAL accumulated. A backup taken then read
  // periods_with_filings = 18 against the live 21 — three hours behind, and it restored cleanly.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "walcheck-"));
  const dbPath = path.join(dir, "t.db");
  // Windows holds a lock for every OPEN sqlite handle, so rmSync fails with EPERM unless all of
  // them are closed first — including the read-only ones, and including the case where an assertion
  // threw before the close. Hence a list closed in `finally` rather than closes inline.
  const open = [];
  const openDb = (p, opts) => { const d = new Database(p, opts); open.push(d); return d; };
  try {
    const db = openDb(dbPath);
    db.pragma("journal_mode = WAL");
    db.exec("CREATE TABLE t (v INTEGER)");
    db.prepare("INSERT INTO t (v) VALUES (1)").run();
    db.pragma("wal_checkpoint(TRUNCATE)");           // baseline: row 1 is in the main file

    // A committed write that stays in the WAL, exactly like the server's.
    db.prepare("INSERT INTO t (v) VALUES (2)").run();
    assert.ok(fs.existsSync(`${dbPath}-wal`) && fs.statSync(`${dbPath}-wal`).size > 0,
      "the WAL must actually hold something for this test to mean anything");

    // What the OLD createBackup did: copy the main file only.
    const naive = path.join(dir, "naive.db");
    fs.copyFileSync(dbPath, naive);
    assert.equal(openDb(naive, { readonly: true }).prepare("SELECT count(*) c FROM t").get().c, 1,
      "a main-file-only copy is missing the committed row — the bug");

    // What it does now.
    const [row] = db.pragma("wal_checkpoint(TRUNCATE)", { simple: false });
    assert.equal(row.busy, 0, "checkpoint should not be busy against a single connection");
    const checked = path.join(dir, "checked.db");
    fs.copyFileSync(dbPath, checked);
    assert.equal(openDb(checked, { readonly: true }).prepare("SELECT count(*) c FROM t").get().c, 2,
      "after the checkpoint the main file is the whole database");
  } finally {
    for (const d of open) { try { d.close(); } catch {} }
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
  }
});

test("the checkpoint runs BEFORE the copy, and its result is recorded rather than assumed", () => {
  const cpAt = BACKUP_SRC.indexOf("const cp = checkpointWal();");
  const copyAt = BACKUP_SRC.indexOf("fs.copyFileSync(DB_PATH, dest);");
  assert.ok(cpAt > 0 && copyAt > cpAt, "checkpointWal() must run before the file copy");
  assert.match(BACKUP_SRC, /wal_checkpoint\(TRUNCATE\)/,
    "PASSIVE is the automatic behaviour that already failed to keep up; FULL leaves the log in place");
  // A backup it cannot vouch for must say so, in the manifest and on stdout.
  assert.match(BACKUP_SRC, /walCheckpointed: cp\.ok/);
  assert.match(BACKUP_SRC, /WAL checkpoint incomplete/);
  // ...and fall back to carrying the sidecar rather than shipping a possibly-stale copy.
  assert.match(BACKUP_SRC, /fs\.copyFileSync\(`\$\{DB_PATH\}-wal`, `\$\{dest\}-wal`\)/);
  // A carried sidecar is part of what the backup costs, so it has to count against the budget or
  // retention would under-estimate the directory it is meant to bound.
  assert.match(BACKUP_SRC, /const size = fs\.statSync\(dest\)\.size \+ \(walCopied/);
});

test("restore clears the live sidecars, so a restored file is not merged with the old log", () => {
  // Copying the main file while resume_master.db-wal still holds the PREVIOUS database's pages
  // leaves SQLite reconciling a restored file with a log belonging to something else.
  const restoreAt = BACKUP_SRC.indexOf("export function restoreBackup");
  const body = BACKUP_SRC.slice(restoreAt);
  const copyAt = body.indexOf("fs.copyFileSync(src, DB_PATH);");
  const unlinkAt = body.indexOf('for (const side of ["-wal", "-shm"])');
  assert.ok(copyAt > 0 && unlinkAt > copyAt, "sidecars must be cleared after the main file lands");
  // And a backup that carried its own WAL gets it back.
  assert.match(body, /if \(fs\.existsSync\(`\$\{src\}-wal`\)\)/);
});

// ── verify: backfilling only what is actually knowable ───────────────────────────────────────

test("verify backfills walCheckpointed as false, and says so about the PROCESS not the data", () => {
  // The honest reading: for a copy taken before the checkpoint existed, "was the WAL checkpointed?"
  // is literally false — none was performed. What is NOT knowable is whether the WAL held anything
  // at that moment, and integrity_check cannot recover it: a database copied mid-WAL is perfectly
  // valid, just older. That is precisely how the stale backup passed every check while being three
  // hours behind, so the note has to carry the caveat the boolean cannot.
  assert.match(BACKUP_SRC, /entry\.walCheckpointed = false;/);
  assert.match(BACKUP_SRC, /walNote =[\s\S]{0,120}predates the checkpoint step/);
  assert.match(BACKUP_SRC, /may be missing data that was in the WAL/);
  // Only filled when ABSENT — a real `false` from a busy checkpoint, or a real `true`, must survive.
  assert.match(BACKUP_SRC, /if \(entry\.walCheckpointed === undefined\) \{/);
});

test("verify cannot downgrade a checkpoint that really happened", () => {
  // The failure this guards: re-running verify stamping `false` over a genuine `true` would turn a
  // complete backup into one the operator distrusts, and the `list` output is the only place that
  // distinction ever reaches a human.
  const at = BACKUP_SRC.indexOf("entry.walCheckpointed = false;");
  const guardAt = BACKUP_SRC.lastIndexOf("if (entry.walCheckpointed === undefined) {", at);
  assert.ok(guardAt > 0 && guardAt < at,
    "the backfill must sit inside an `=== undefined` guard so it is never an overwrite");
});

test("verifying a WAL database creates sidecars, so verify has to clean up after itself", () => {
  // Not hypothetical: opening the five real backups read-only produced TEN files, and a sidecar
  // beside an EXISTING .db is invisible to sweepOrphanSidecars, which only looks for orphans. This
  // is where the two mystery -shm/-wal files in data/backups came from.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sidecar-"));
  const dbPath = path.join(dir, "t.db");
  const open = [];
  try {
    const db = new Database(dbPath);
    open.push(db);
    db.pragma("journal_mode = WAL");
    db.exec("CREATE TABLE t (v INTEGER)");
    db.pragma("wal_checkpoint(TRUNCATE)");
    db.close();
    for (const side of ["-wal", "-shm"]) { try { fs.unlinkSync(`${dbPath}${side}`); } catch {} }
    assert.ok(!fs.existsSync(`${dbPath}-wal`), "clean starting point");

    // READ-ONLY is enough to recreate them.
    const ro = new Database(dbPath, { readonly: true });
    open.push(ro);
    ro.pragma("integrity_check", { simple: true });
    assert.ok(fs.existsSync(`${dbPath}-shm`),
      "a read-only open recreates the sidecars — the reason verify records what existed first");
  } finally {
    for (const d of open) { try { d.close(); } catch {} }
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
  }

  // And the implementation has to note pre-existing sidecars so it removes only its own, never a
  // backup's carried WAL from the busy-checkpoint path.
  assert.match(BACKUP_SRC, /const pre = \{ wal: fs\.existsSync\(`\$\{p\}-wal`\), shm: fs\.existsSync\(`\$\{p\}-shm`\) \}/);
  assert.match(BACKUP_SRC, /if \(!pre\.wal\) \{ try \{ fs\.unlinkSync\(`\$\{p\}-wal`\)/);
});

test("verify records the schema era, which is the question you ask before restoring", () => {
  assert.match(BACKUP_SRC, /FROM schema_migrations ORDER BY rowid DESC LIMIT 1/);
  // An ancient backup may predate the table entirely; that must be null, not a crash.
  assert.match(BACKUP_SRC, /catch \{ entry\.schema = null; \}/);
  // A file that has gone missing is reported, not thrown over.
  assert.match(BACKUP_SRC, /entry\.integrity = "missing";/);
  assert.match(BACKUP_SRC, /entry\.integrity = `unreadable: \$\{err\.message\}`/);
});

test("list surfaces the checkpoint state — the manifest alone warns nobody", () => {
  assert.match(BACKUP_SRC, /UNVERIFIED-WAL/);
  const listAt = BACKUP_SRC.indexOf('if (args[0] === "list")');
  const flagAt = BACKUP_SRC.indexOf("const flag = (e) =>");
  assert.ok(flagAt > 0 && flagAt < listAt, "the flag helper must be in scope for list");
  assert.match(BACKUP_SRC, /\$\{flag\(e\)\}/);
});

// ── Housekeeping ─────────────────────────────────────────────────────────────────────────────

test("sidecars are removed with their .db, and orphans are swept", () => {
  // A pruned .db could leave -shm/-wal behind; two such orphans outlived every backup in the
  // directory because nothing ever looked for them.
  assert.match(BACKUP_SRC, /for \(const side of \["-shm", "-wal"\]\)/);
  assert.match(BACKUP_SRC, /function sweepOrphanSidecars\(\)/);
  assert.match(BACKUP_SRC, /sweepOrphanSidecars\(\);/);
});

test("the caps are configurable, so a deploy is not stuck with this machine's budget", () => {
  for (const name of ["BACKUP_MAX_BYTES", "BACKUP_MAX_COUNT", "BACKUP_MIN_KEEP"]) {
    assert.ok(BACKUP_SRC.includes(name), `${name} must be readable from the environment`);
  }
  // The env var may only LOWER the disk-derived budget. It used to default to a 512 MB constant —
  // larger than the 500 MB volume it lived on — and that pin went with the constant.
  assert.doesNotMatch(BACKUP_SRC, /512 \* 1024 \* 1024/);
  assert.equal(backupLimits({ total: 1000 * MB, free: 900 * MB }, 0, { maxBytes: 100 * MB }).budget,
    100 * MB, "BACKUP_MAX_BYTES lowers the budget");
  assert.equal(backupLimits({ total: 1000 * MB, free: 900 * MB }, 0, { maxBytes: 5000 * MB }).budget,
    400 * MB, "...and cannot raise it past the volume's share");
});

// ── The disk (2026-09-29: the 02:00 backup died with ENOSPC at 481/500 MB) ─────────────────────

test("the budget is derived from the volume, not a constant bigger than the volume", () => {
  const small = backupLimits({ total: 500 * MB, free: 19 * MB }, 300 * MB);
  assert.equal(small.budget, 200 * MB, "40% of a 500 MB volume");
  const big = backupLimits({ total: 1000 * MB, free: 519 * MB }, 300 * MB);
  assert.equal(big.budget, 400 * MB, "the same code on the grown volume gets a bigger budget");
  // Ceiling: what backups may occupy = held + free − reserve (64 MB floor, else 5% of the volume).
  assert.equal(small.reserve, 64 * MB);
  assert.equal(small.ceiling, 300 * MB + 19 * MB - 64 * MB);
});

test("MIN_KEEP overrides the budget but NEVER the disk", () => {
  const entries = Array.from({ length: 5 }, (_, i) => entry(i, "manual", 116 * MB));
  const { keep, keptBytes } = selectRetained(entries,
    { maxBytes: 100 * MB, ceiling: 300 * MB, maxCount: 30, minKeep: 3 });
  assert.equal(keep.length, 2, "3 × 116 MB passes the floor and overruns a 300 MB disk ceiling");
  assert.ok(keptBytes <= 300 * MB);
});

test("even the newest is not kept past the disk — the caller refuses instead", () => {
  const { keep } = selectRetained([entry(0, "manual", 200 * MB), entry(1)],
    { maxBytes: 1000 * MB, ceiling: 150 * MB, maxCount: 30, minKeep: 3 });
  assert.ok(!keep.some(e => e.filename === "b0.db"));
});

// createBackup is run in a CHILD PROCESS against a scratch BACKUP_DATA_DIR, never against data/. A
// first version of the test below faked the disk in-process against the real data/ and deleted two
// local backups for good — which is also how the prune-then-refuse bug it now pins was found.
import { spawnSync } from "node:child_process";
const BACKUP_URL = new URL("../scripts/backup.js", import.meta.url).href;

/** Scratch data dir: a small real DB, plus backups whose manifest sizes may LIE. */
function scratch(backups) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bak-"));
  fs.mkdirSync(path.join(dir, "backups"));
  const db = new Database(path.join(dir, "resume_master.db"));
  db.exec("CREATE TABLE t(x); INSERT INTO t VALUES (randomblob(200000));");
  db.close();
  const manifest = backups.map(([name, claimed], i) => {
    fs.writeFileSync(path.join(dir, "backups", name), Buffer.alloc(50 * 1024));
    return { filename: name, label: i ? "manual" : "auto-daily", size: claimed };
  });
  fs.writeFileSync(path.join(dir, "backups", "manifest.json"), JSON.stringify(manifest));
  return dir;
}

function runBackup(dir, fakeDisk) {
  const patch = fakeDisk ? `fs.statfsSync = () => ({ bsize: 4096, ` +
    `blocks: ${Math.floor(fakeDisk.total / 4096)}, bavail: ${Math.floor(fakeDisk.free / 4096)} });` : "";
  const code = `import fs from "node:fs"; ${patch}
    const { createBackup } = await import(${JSON.stringify(BACKUP_URL)});
    try { createBackup("test"); console.log("OK"); } catch (e) { console.log(e.message); }`;
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", code],
    { env: { ...process.env, BACKUP_DATA_DIR: dir }, encoding: "utf8" });
  return r.stdout + r.stderr;
}

test("createBackup refuses BEFORE copying, and deletes NOTHING, when the disk cannot hold the copy", () => {
  // The incident shape: a 500 MB volume with 19 MB free. The manifest CLAIMS 300 MB of backups —
  // trusting that, the first version planned to free them, pruned both, then refused anyway.
  const dir = scratch([["old-a.db", 150 * MB], ["old-b.db", 150 * MB]]);
  const before = fs.readdirSync(path.join(dir, "backups")).sort();
  const manifestBefore = fs.readFileSync(path.join(dir, "backups", "manifest.json"), "utf8");
  const out = runBackup(dir, { total: 500 * MB, free: 19 * MB });
  assert.match(out, /BACKUP REFUSED/);
  assert.deepEqual(fs.readdirSync(path.join(dir, "backups")).sort(), before, "nothing copied, nothing pruned");
  assert.equal(fs.readFileSync(path.join(dir, "backups", "manifest.json"), "utf8"), manifestBefore);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("with room, createBackup still copies and records the backup", () => {
  const dir = scratch([["old-a.db", 50 * 1024]]);
  const out = runBackup(dir, null);
  assert.match(out, /OK/, out);
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, "backups", "manifest.json"), "utf8"));
  assert.equal(manifest[0].label, "test");
  assert.ok(fs.existsSync(path.join(dir, "backups", manifest[0].filename)));
  assert.equal(manifest.length, 2, "the old backup is kept — there is room for it");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the refusal and the pruning both come before the copy — in backup and in restore", () => {
  const room = BACKUP_SRC.slice(at(BACKUP_SRC, "function makeRoom"));
  assert.ok(at(room, "throw new BackupRefused(msg)") < at(room, "removeBackupFile(e.filename)"),
    "makeRoom must refuse before it deletes anything");
  const body = BACKUP_SRC.slice(at(BACKUP_SRC, "export function createBackup"));
  assert.ok(at(body, "makeRoom(") < at(body, "fs.copyFileSync(DB_PATH, dest);"));
  const restore = BACKUP_SRC.slice(at(BACKUP_SRC, "export function restoreBackup"));
  assert.ok(at(restore, "makeRoom(") < at(restore, "fs.copyFileSync(DB_PATH, safePath)"));
});

test("an empty manifest is not an error", () => {
  assert.deepEqual(selectRetained([]), { keep: [], drop: [], keptBytes: 0 });
});

test("a missing size does not let an entry escape the budget as free", () => {
  // Manifest entries written by older versions may lack `size`. Treating undefined as 0 is the
  // only safe reading, but it must not then be COUNTED as if it were free forever.
  const entries = [entry(0, "manual", undefined), entry(1, "manual", 600 * MB)];
  const { keep } = selectRetained(entries, { maxBytes: 500 * MB, maxCount: 30, minKeep: 1 });
  assert.deepEqual(keep.map(e => e.filename), ["b0.db"], "the oversized one is still dropped");
});

test("retention keeps a CONTIGUOUS newest run — it never drops a newer backup to keep an older one", () => {
  // Production, 09-30: the loop skipped past a backup that did not fit and kept going, so as the
  // database grew every recent (large) backup was dropped and the small old ones behind it were
  // kept. 09-17..09-29 were gone; 08-22..09-16 survived. Sizes here are that shape: newest large.
  const sizes = [28, 60, 60, 60, 60, 22, 14, 14, 14, 14, 13, 13, 13, 13];
  const entries = sizes.map((mb, i) => entry(i, "auto-daily", mb * MB));
  const { keep } = selectRetained(entries, { maxBytes: 200 * MB, maxCount: 30, minKeep: 3 });
  const idx = keep.map(e => Number(e.filename.slice(1, -3)));
  // b0 (28) + b1..b3 (180) is over 200, so the floor of 3 keeps b0..b2 and the run stops at b3.
  // Before the fix it went on to keep b5..b13 — every small OLD backup — behind the dropped b3/b4.
  assert.deepEqual(idx, [0, 1, 2], `kept ${idx.join(",")}`);
  for (let i = 1; i < idx.length; i++) assert.equal(idx[i], idx[i - 1] + 1, "a hole in the kept run");
});

test("a protected label still survives the contiguous rule", () => {
  // The newest of each label is kept even when it is old — that is the head, and it is intentional.
  const entries = [entry(0, "auto-daily", 50 * MB), entry(1, "auto-daily", 50 * MB),
                   entry(2, "auto-daily", 50 * MB), entry(3, "pre-migration", 10 * MB)];
  const { keep } = selectRetained(entries, { maxBytes: 70 * MB, maxCount: 30, minKeep: 1 });
  assert.deepEqual(keep.map(e => e.filename), ["b0.db", "b3.db"]);
});
