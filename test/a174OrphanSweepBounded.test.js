// A174 (46c) · a bounded Atlas drain slice never sweeps the whole match table. The slice that emptied the queue ran
// `posting_id NOT IN (SELECT id FROM scraped_jobs)` over every match row (0.43 s at 75,900 on the 100k copy; 2.8 s of
// held thread on A173's boot after a 2,552-posting expiry) — and any single posting written was enough to trigger it.
// A bounded slice now checks the next ORPHAN_SWEEP_ROWS rows from a rolling cursor; an unbounded sync (the nightly pass,
// scripts, the drift tests) still sweeps everything at once.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { computeAtlasStats } from "../services/atlas/atlasStats.js";
import { upsertNode, setStatus } from "../services/atlas/atlasStore.js";
import { syncAtlasPostings, orphanSweepChunk, ORPHAN_SWEEP_ROWS } from "../services/atlas/atlasLive.js";
import { at } from "../test-support/sourceAnchors.js";

function board(n) {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  const { id: nodeId } = upsertNode(db, { kind: "tool", name: "Python", source: "registry" });
  setStatus(db, db.prepare(`SELECT slug FROM atlas_nodes WHERE id = ?`).pluck().get(nodeId), "published");
  const ins = db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, _hash, title, company, url, description, is_active)
    VALUES (?, 'q', ?, 'Backend Engineer', 'Co', ?, 'Requirements:\n- Python and SQL', 1)`);
  for (let i = 0; i < n; i++) ins.run(`j${i}`, `h${i}`, `https://x.test/${i}`);
  computeAtlasStats(db, { now: 1 });   // the baseline: one match row per active posting
  return db;
}
const matchIds = (db) => db.prepare(`SELECT posting_id FROM atlas_posting_match ORDER BY posting_id`).pluck().all();
const replace = (db, jobId) => db.prepare(`INSERT OR REPLACE INTO scraped_jobs (job_id, search_query, _hash, title, company, url, description, is_active)
    VALUES (?, 'q', ?, 'Backend Engineer', 'Co', ?, 'Requirements:\n- Python and SQL', 1)`).run(jobId, `h-${jobId}`, `https://x.test/${jobId}`);

test("a174OrphanSweepBounded: the chunked sweep walks the match table in order, finds an orphan within one lap, and wraps", () => {
  const db = board(7);
  assert.equal(matchIds(db).length, 7);
  const gone = db.prepare(`SELECT id FROM scraped_jobs WHERE job_id = 'j5'`).pluck().get();
  replace(db, "j5");   // a new row id; no delete trigger fires — the old match row is an orphan
  assert.ok(matchIds(db).includes(gone));
  const found = [];
  for (let lap = 0; lap < 4; lap++) found.push(...orphanSweepChunk(db, 2));   // 7 rows, 2 a chunk → one lap in 4
  assert.deepEqual(found, [gone], "the orphan is found exactly once in a lap");
  assert.deepEqual(orphanSweepChunk(db, 2).length, 0, "the cursor wrapped: the next lap starts again at the beginning");
});

test("a174OrphanSweepBounded: a bounded drain slice removes a replaced posting's old reading", () => {
  const db = board(5);
  const gone = db.prepare(`SELECT id FROM scraped_jobs WHERE job_id = 'j2'`).pluck().get();
  replace(db, "j2");
  syncAtlasPostings(db, { limit: 16 });
  assert.ok(!matchIds(db).includes(gone), "the orphan's row is gone");
  assert.equal(db.prepare(`SELECT COUNT(*) FROM atlas_posting_dirty`).pluck().get(), 0);
});

test("a174OrphanSweepBounded (source): only the unbounded sync runs the whole sweep; a bounded slice takes a chunk", () => {
  const src = fs.readFileSync("services/atlas/atlasLive.js", "utf8").replace(/\r\n/g, "\n");
  const sync = src.slice(at(src, "function syncNow(db, now, limit = Infinity) {"), at(src, "const work = new Set([...dirty, ...orphans]);"));
  assert.match(sync, /const orphans = pendingAfter \? \[\] : all\n\s+\? db\.prepare\(`SELECT posting_id FROM atlas_posting_match WHERE posting_id NOT IN \(SELECT id FROM scraped_jobs\)`\)\.pluck\(\)\.all\(\)\n\s+: orphanSweepChunk\(db\);/);
  assert.equal(ORPHAN_SWEEP_ROWS, 4000);
});
