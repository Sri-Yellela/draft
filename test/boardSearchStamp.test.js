// ⚡ 10-06 (33): the search's per-row cache is stamped IN SQL (updated_at + each field's byte length) and
// the description crosses into JS only on a miss. The risk that trades for speed is a STALE match, so
// it is held here: an edited description is re-read even when updated_at does not move.
import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { registerBoardSearch, boardSearchSql } from "../services/jobs/boardSearch.js";

function board() {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE scraped_jobs (job_id TEXT PRIMARY KEY, updated_at INTEGER, title TEXT, company TEXT,
             skills_json TEXT, summary TEXT, description TEXT)`);
  db.prepare("INSERT INTO scraped_jobs VALUES ('stamp-1', 100, 'Engineer', 'Northwind', NULL, NULL, 'Build pipelines in Go.')").run();
  db.prepare("INSERT INTO scraped_jobs VALUES ('stamp-2', 100, 'Engineer', 'Contoso', NULL, NULL, NULL)").run();
  registerBoardSearch(db);
  return db;
}
const find = (db, term) => {
  const s = boardSearchSql([term]);
  return db.prepare(`SELECT sj.job_id FROM scraped_jobs sj WHERE ${s.sql} IS NOT NULL ORDER BY sj.job_id`).all(...s.params).map(r => r.job_id);
};

test("search finds a term in the description, and a SECOND pass (cached) answers the same", () => {
  const db = board();
  assert.deepEqual(find(db, "pipelines"), ["stamp-1"]);
  assert.deepEqual(find(db, "pipelines"), ["stamp-1"], "the cached pass — the description was not re-sent");
});

test("an edited description is re-read even when updated_at did not move — never a stale match", () => {
  const db = board();
  assert.deepEqual(find(db, "kubernetes"), []);
  db.prepare("UPDATE scraped_jobs SET description = 'Run Kubernetes clusters at scale.' WHERE job_id = 'stamp-1'").run();
  assert.deepEqual(find(db, "kubernetes"), ["stamp-1"]);
  assert.deepEqual(find(db, "pipelines"), [], "the old text is gone");
  // A row with no description at all is never mistaken for a cache hit.
  db.prepare("UPDATE scraped_jobs SET description = 'Kubernetes too.' WHERE job_id = 'stamp-2'").run();
  assert.deepEqual(find(db, "kubernetes"), ["stamp-1", "stamp-2"]);
});
