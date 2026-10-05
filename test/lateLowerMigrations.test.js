// A LOWER-NUMBERED MIGRATION THAT ARRIVES AFTER HIGHER ONES ARE APPLIED MUST STILL RUN.
//
// D16 (125_application_artifacts) and A76 (126_ats_grade_corpus) were built on branches that sat
// unmerged while 127_slug_harvest and 128_job_tags went to production. So production meets 125 and
// 126 on a database whose newest applied migration is already 128.
//
// That is only safe if the runner decides by NAME — "is this id in schema_migrations?" — and not by
// a numeric high-water mark ("skip everything at or below the highest applied number"). A
// high-water runner would skip both silently: application_artifacts would never exist, every
// recorded application would fail to keep its résumé, and the A76 import would fail on a missing
// enrichment_batches.kind column — at runtime, not at boot.
//
// Both runners (server.js at boot, scripts/migration.js by hand) call the one shared
// applyPendingMigrations; test/migrationListsAgree.test.js holds that their lists carry the same
// ids in the same order. This file proves the shared loop's behaviour on a database at 128.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { applyPendingMigrations } from "../scripts/applyMigrations.js";

const LATE = ["125_application_artifacts", "126_ats_grade_corpus"];
const AHEAD = ["127_slug_harvest", "128_job_tags"];

/** A database as production had it before the merge: every migration up to 128, minus 125 and 126. */
function databaseAt128() {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
             id TEXT PRIMARY KEY, applied_at INTEGER NOT NULL DEFAULT (unixepoch()));`);
  applyPendingMigrations(db, MIGRATIONS.filter(m => !LATE.includes(m.id)));
  return db;
}

const appliedIds = (db) =>
  db.prepare("SELECT id FROM schema_migrations ORDER BY rowid").all().map(r => r.id);
const hasTable = (db, name) =>
  !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);

test("the late migrations are in the list, ahead of 127 — a fresh database applies them in number order", () => {
  const ids = MIGRATIONS.map(m => m.id);
  for (const id of [...LATE, ...AHEAD]) assert.ok(ids.includes(id), `${id} missing from scripts/migrations.js`);
  assert.deepEqual(
    [...LATE, ...AHEAD].map(id => ids.indexOf(id)).slice().sort((a, b) => a - b),
    [...LATE, ...AHEAD].map(id => ids.indexOf(id)),
    "125 → 126 → 127 → 128 is the list order");
});

test("on a database at 128, the runner applies 125 and 126 — by id, not by number", () => {
  const db = databaseAt128();
  try {
    const before = appliedIds(db);
    for (const id of AHEAD) assert.ok(before.includes(id), `setup: ${id} should already be applied`);
    for (const id of LATE) assert.ok(!before.includes(id), `setup: ${id} should not be applied yet`);
    assert.equal(hasTable(db, "application_artifacts"), false);
    assert.equal(hasTable(db, "ats_corpus_grades"), false);

    const n = applyPendingMigrations(db, MIGRATIONS);

    assert.equal(n, 2, "exactly the two late migrations run — nothing else is re-applied");
    const after = appliedIds(db);
    assert.deepEqual(after.slice(-2), LATE, "recorded after 128, in list order");
    assert.ok(hasTable(db, "application_artifacts"), "125 created application_artifacts");
    assert.ok(hasTable(db, "ats_corpus_grades"), "126 created ats_corpus_grades");
    const cols = db.prepare("PRAGMA table_info(enrichment_batches)").all().map(c => c.name);
    assert.ok(cols.includes("kind"), "126 added enrichment_batches.kind");
    // 128's own work is untouched by the late arrivals.
    const jobCols = db.prepare("PRAGMA table_info(scraped_jobs)").all().map(c => c.name);
    assert.ok(jobCols.includes("tag_level") && hasTable(db, "job_tag_places"), "128 still in place");

    assert.equal(applyPendingMigrations(db, MIGRATIONS), 0, "a second boot applies nothing");
  } finally { db.close(); }
});

test("both runners go through the shared id-keyed loop", () => {
  // If either runner grew its own loop again, the behaviour above would no longer describe it.
  const server = fs.readFileSync(path.join(process.cwd(), "server.js"), "utf8");
  const script = fs.readFileSync(path.join(process.cwd(), "scripts", "migration.js"), "utf8");
  assert.match(server, /applyPendingMigrations\(db, MIGRATIONS,/, "server.js boot runner");
  assert.match(script, /applyPendingMigrations\(db, MIGRATIONS,/, "scripts/migration.js runner");
});
