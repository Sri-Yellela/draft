// ⛔ D77 · BACKUPS OFF THE VOLUME, AND A DISK GAUGE WITHOUT RAILWAY PRO. Each red when removed:
// the pull refuses a destination inside the repo · a copy that fails integrity_check is flagged · the gauge
// is amber at 70% and red at 85% · D74's tranche gate reads the gauge (and the routes that add or enable a
// company obey it).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { refuseInsideRepo, verifyCopy, newestBackup, pruneGood, shellLine } from "../scripts/pullBackup.mjs";
import { toneFor, readGauge, trancheGate, projectTranche, AMBER_AT, RED_AT, TRANCHE_LIMIT } from "../services/diskGauge.js";
import { createCompaniesRouter } from "../routes/companies.js";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "d77-"));
function draftDb(file = ":memory:") {
  const db = new Database(file);
  // The runner creates schema_migrations itself (server.js), so a test database does too.
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at INTEGER NOT NULL DEFAULT (unixepoch()))");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO schema_migrations (id) VALUES ('143_deploy_events')").run();
  db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, _hash, title, company, url, source, description, is_active)
              VALUES ('j1', 't', 'h1', 'Engineer', 'Acme', 'https://example.com/1', 'greenhouse', 'Build things.', 1)`).run();
  return db;
}

test("⛔ D77: the pull refuses a destination inside the repository — the root, a subfolder — and allows one outside", () => {
  const repo = path.resolve(".");
  assert.equal(refuseInsideRepo(repo, repo).ok, false);
  assert.equal(refuseInsideRepo(path.join(repo, "data", "backups"), repo).ok, false);
  assert.equal(refuseInsideRepo(path.join(os.tmpdir(), "draft-backups"), repo).ok, true);
  assert.equal(refuseInsideRepo(path.join(repo, "..", "draft-backups"), repo).ok, true, "a sibling of the repo is outside it");
});

test("⛔ D77: a copy that fails integrity_check is flagged; so is a file that is not a draft database; a whole one passes", () => {
  const dir = tmp();
  const good = path.join(dir, "good.db");
  draftDb(good).close();
  const v = verifyCopy(good);
  assert.equal(v.ok, true, v.problems.join(" · "));
  assert.equal(v.rows, 1);
  // Corrupt the copy: overwrite pages in the middle of the file.
  const bad = path.join(dir, "bad.db");
  const bytes = fs.readFileSync(good);
  bytes.fill(0x5a, Math.floor(bytes.length / 3), Math.floor(bytes.length / 3) + 8192);
  fs.writeFileSync(bad, bytes);
  const b = verifyCopy(bad);
  assert.equal(b.ok, false, "a corrupted copy must not pass");
  // A corruption integrity_check REPORTS (orphaned pages) rather than one that throws on read.
  const orphan = path.join(dir, "orphan.db");
  const od = draftDb(orphan);
  od.exec("CREATE TABLE pad (x); CREATE INDEX pad_x ON pad(x);");
  const ins = od.prepare("INSERT INTO pad VALUES (?)");
  for (let i = 0; i < 3000; i++) ins.run("v" + i);
  od.unsafeMode(true); od.pragma("writable_schema = ON");
  od.prepare("DELETE FROM sqlite_master WHERE name = 'pad_x'").run();
  od.pragma("writable_schema = OFF"); od.close();
  const oc = verifyCopy(orphan);
  assert.equal(oc.ok, false);
  assert.ok(oc.problems.some(p => p.startsWith("integrity_check:")), "flagged BY integrity_check");
  // A valid SQLite file that is not draft's.
  const other = path.join(dir, "other.db");
  new Database(other).exec("CREATE TABLE t (x)");
  const o = verifyCopy(other);
  assert.equal(o.ok, false);
  assert.ok(o.problems.some(p => p.startsWith("missing table scraped_jobs")));
  assert.equal(verifyCopy(path.join(dir, "absent.db")).ok, false);
});

test("D77: the pull picks the newest backup database, never the manifest; keeps 8 good copies; refuses shell-sensitive arguments", () => {
  const files = [{ type: "file", name: "manifest.json", modifiedAt: "2026-10-08T00:00:00Z" },
                 { type: "file", name: "a.db", modifiedAt: "2026-10-06T02:00:00Z" }, { type: "file", name: "b.db", modifiedAt: "2026-10-07T02:00:00Z" }];
  assert.equal(newestBackup(files).name, "b.db");
  const dir = tmp();
  for (let i = 10; i < 21; i++) fs.writeFileSync(path.join(dir, `resume_master_2026-10-${i}.db`), "x");
  fs.writeFileSync(path.join(dir, "resume_master_2026-10-09.db.FAILED"), "x");
  const r = pruneGood(dir, 8);
  assert.equal(r.kept.length, 8);
  assert.deepEqual(r.deleted.sort(), ["resume_master_2026-10-10.db", "resume_master_2026-10-11.db", "resume_master_2026-10-12.db"]);
  assert.ok(fs.existsSync(path.join(dir, "resume_master_2026-10-09.db.FAILED")), "a FAILED copy is left for inspection");
  assert.throws(() => shellLine(["download", "/x", "C:\\a&calc"]));
  assert.equal(shellLine(["volume", "files", "--volume", "draft-data", "list", "/backups", "--json"]), "railway volume files --volume draft-data list /backups --json");
});

test("⛔ D77: the gauge is green below 70%, amber from 70%, red from 85% — read from statfs", () => {
  assert.deepEqual([AMBER_AT, RED_AT], [70, 85]);
  assert.deepEqual([69.9, 70, 84.9, 85, 99].map(toneFor), ["green", "amber", "amber", "red", "red"]);
  const at = (usedPct) => readGauge(tmp(), { statfs: () => ({ blocks: 1000, bsize: 1048576, bavail: 1000 - usedPct * 10 }), backups: () => [] });
  assert.equal(at(50).tone, "green");
  assert.equal(at(72).tone, "amber");
  assert.equal(at(90).tone, "red");
});

test("⛔ D77 → D74: the tranche gate reads the gauge — refused when the projection passes 70%", () => {
  const db = draftDb();
  const gauge = (usedPct) => () => ({ totalBytes: 1000 * 1048576, usedBytes: usedPct * 10 * 1048576, freeBytes: (100 - usedPct) * 10 * 1048576,
                                      usedPct, tone: toneFor(usedPct), largest: [], backups: { count: 3, bytes: 150 * 1048576, budget: 400 * 1048576 } });
  const ok = trancheGate(db, "data", { companies: 1, readGaugeImpl: gauge(40) });
  assert.equal(ok.ok, true);
  const near = trancheGate(db, "data", { companies: 1, readGaugeImpl: gauge(TRANCHE_LIMIT + 0.5) });
  assert.equal(near.ok, false);
  assert.equal(near.reason, "disk_gate");
  assert.equal(trancheGate(db, "data", { readGaugeImpl: () => { throw new Error("no statfs"); } }).reason, "disk_unreadable", "an unreadable disk refuses — never waves it through");
  const p = projectTranche(db, gauge(40)(), { companies: 25 });
  assert.ok(p.addedBackupBytes >= p.addedDbBytes, "the backups that copy the database are counted");
});

test("⛔ D77 → D74: enabling a company obeys the gate (507); disabling never waits on it; server.js gives the routers its data directory", async () => {
  const db = draftDb();
  const id = db.prepare("SELECT id FROM company_ats_list LIMIT 1").pluck().get();
  let refuse = true;
  const app = express();
  app.use("/c", createCompaniesRouter(db, (_q, _s, n) => n(), { gate: () => (refuse ? { ok: false, reason: "disk_gate" } : { ok: true }) }));
  const server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
  const url = `http://127.0.0.1:${server.address().port}/c/${id}`;
  const patch = (active) => fetch(url, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ active }) });
  try {
    assert.equal((await patch(true)).status, 507);
    assert.notEqual((await patch(false)).status, 507, "disabling is always allowed");
    refuse = false;
    assert.equal((await patch(true)).status, 200);
  } finally { server.close(); }
  const src = fs.readFileSync("server.js", "utf8");
  assert.match(src, /createCompaniesRouter\(db, requireAdmin, \{ dataDir: DATA_DIR, read: readPool \}\)/);   // A162 (46a) added the read pool
  assert.match(src, /createSlugHarvestRouter\(db, requireAdmin, \{\s*gate: \(companies\) => trancheGate\(db, DATA_DIR, \{ companies \}\) \}\)/);
  assert.match(fs.readFileSync("routes/slugHarvest.js", "utf8"), /if \(plan\.wouldAdd > 0\) \{\s*const disk = gate\(plan\.wouldAdd\);/, "a harvest import that adds companies is gated");
});
