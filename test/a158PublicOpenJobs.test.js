// ⛔ A158 (45r) · public_open_jobs (migration 262): one small row per OPEN public posting, so the sitemaps never filter
// scraped_jobs (whose filter columns sit after `description`; on production one such scan ran for minutes). The triggers
// keep it right on every write; a paced walk copies in what was open before the table existed.
import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { createPublicOpenBackfill, isBackfilled } from "../services/jobs/publicOpenJobs.js";
import { jobsSitemapRoutes, jobsSitemapPageCount, companiesSitemapRoutes } from "../services/jobs/publicJobPage.js";

function world() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  return db;
}
const ins = (db, i, over = {}) => db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, company, title, _hash, is_active, board_category, duplicate_of, discovered_at)
  VALUES (?, 'q', ?, ?, ?, ?, ?, ?, 1)`).run(`j${i}`, over.company ?? "Acme", over.title ?? `Engineer ${i}`, `h${i}`, over.active ?? 1,
  "category" in over ? over.category : "computing", over.dup ?? null);
const openIds = (db) => db.prepare("SELECT job_id FROM public_open_jobs ORDER BY job_id").pluck().all();

test("a158PublicOpenJobs: the triggers keep the table to exactly the open public postings on insert, update and delete", () => {
  const db = world();
  ins(db, 1); ins(db, 2, { active: 0 }); ins(db, 3, { category: "held" }); ins(db, 4, { category: null }); ins(db, 5, { dup: "j1" });
  assert.deepEqual(openIds(db), ["j1"]);
  db.prepare("UPDATE scraped_jobs SET is_active = 1 WHERE job_id = 'j2'").run();
  db.prepare("UPDATE scraped_jobs SET board_category = 'computing' WHERE job_id = 'j4'").run();
  assert.deepEqual(openIds(db), ["j1", "j2", "j4"]);
  db.prepare("UPDATE scraped_jobs SET is_active = 0 WHERE job_id = 'j1'").run();
  db.prepare("UPDATE scraped_jobs SET board_category = 'held' WHERE job_id = 'j2'").run();
  db.prepare("UPDATE scraped_jobs SET title = 'Renamed' WHERE job_id = 'j4'").run();
  assert.deepEqual(openIds(db), ["j4"]);
  assert.equal(db.prepare("SELECT title FROM public_open_jobs WHERE job_id = 'j4'").pluck().get(), "Renamed");
  db.prepare("DELETE FROM scraped_jobs WHERE job_id = 'j4'").run();
  assert.deepEqual(openIds(db), []);
});

test("a158PublicOpenJobs: the walk copies in what was open before the table existed, once, without overwriting a trigger's row", async () => {
  const db = world();
  for (let i = 1; i <= 1200; i++) ins(db, i, { active: i % 3 === 0 ? 0 : 1 });
  db.prepare("DELETE FROM public_open_jobs").run();            // as on production: the rows predate migration 262
  db.prepare("INSERT INTO public_open_jobs (job_id, id, company, title, t) VALUES ('j1', 1, 'Acme', 'Newer', 1)").run();
  const walk = createPublicOpenBackfill(db, { offload: null, pauseMs: 0, log: { log() {}, warn() {}, error() {} } });
  const s = await walk.run("test");
  assert.equal(s.state, "done");
  assert.equal(db.prepare("SELECT COUNT(*) FROM public_open_jobs").pluck().get(), 800);
  assert.equal(db.prepare("SELECT title FROM public_open_jobs WHERE job_id = 'j1'").pluck().get(), "Newer", "INSERT OR IGNORE");
  assert.ok(isBackfilled(db));
  assert.equal((await walk.run("again")).state, "done", "never walks again");
});

test("a158PublicOpenJobs: the sitemaps read the narrow table — same open set, newest first", () => {
  const db = world();
  for (let i = 1; i <= 30; i++) ins(db, i, { active: i % 2 ? 1 : 0, company: i < 10 ? "Acme" : "Globex" });
  assert.equal(jobsSitemapPageCount(db, { max: 10 }), 2);
  const first = jobsSitemapRoutes(db, { max: 10, page: 1 });
  assert.equal(first.length, 10);
  assert.match(first[0].path, /\/29$/);
  db.prepare("INSERT INTO companies (id, name, slug) VALUES (1, 'Acme', 'acme'), (2, 'Globex', 'globex'), (3, 'Initech', 'initech')").run();
  db.prepare("INSERT INTO job_company (job_id, company_id) SELECT job_id, CASE WHEN company = 'Acme' THEN 1 ELSE 2 END FROM scraped_jobs").run();
  db.prepare("UPDATE scraped_jobs SET is_active = 0 WHERE company = 'Globex'").run();
  assert.deepEqual(companiesSitemapRoutes(db).map(r => r.path), ["/acme"]);
});
