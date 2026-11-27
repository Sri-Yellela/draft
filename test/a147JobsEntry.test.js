// ⭐ A147 (45o, owner 11-08: "On /jobs, board below") · the signed-out /jobs opens on the browse board — live totals,
// Browse by role, Hiring by technology, Companies hiring now — with the deck / list below. Synthetic data only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { buildEntry } from "../services/jobs/publicEntry.js";
import { resetDirectory } from "../services/companies/companyDirectory.js";

const NOW = Date.UTC(2026, 10, 8, 12);
const nowSec = Math.floor(NOW / 1000);

function fixture() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE companies (id INTEGER PRIMARY KEY, slug TEXT, name TEXT);
    CREATE TABLE scraped_jobs (id INTEGER PRIMARY KEY, job_id TEXT, is_active INTEGER, duplicate_of TEXT, board_category TEXT, discovered_at INTEGER);
    CREATE TABLE job_company (job_id TEXT, company_id INTEGER);
    CREATE TABLE job_tech (job_id TEXT, tech TEXT);
  `);
  db.prepare(`INSERT INTO companies VALUES (1, 'acme', 'Acme'), (2, 'birch', 'Birch')`).run();
  let n = 0;
  const job = (co, techs, { ageDays = 30, active = 1, cat = "software-engineering" } = {}) => {
    n++; db.prepare(`INSERT INTO scraped_jobs VALUES (?, ?, ?, NULL, ?, ?)`).run(n, `j${n}`, active, cat, nowSec - ageDays * 86400);
    db.prepare(`INSERT INTO job_company VALUES (?, ?)`).run(`j${n}`, co);
    for (const t of techs) db.prepare(`INSERT INTO job_tech VALUES (?, ?)`).run(`j${n}`, t);
  };
  for (let i = 0; i < 11; i++) job(1, ["Go"]);
  job(1, ["Python"], { ageDays: 1 });
  job(2, ["Python"], { ageDays: 2 }); job(2, ["Python"], { ageDays: 3 });
  job(2, ["Go"], { active: 0 });                 // closed: in no count
  job(2, ["Go"], { cat: "held" });               // held: never public
  return { all: async (sql, params) => db.prepare(sql).all(...params) };
}

test("A147 · the entry counts the OPEN public board only; technologies link their landing page at ≥ 10 jobs", async () => {
  resetDirectory();
  const e = await buildEntry(fixture(), NOW);
  assert.equal(e.total, 14);
  assert.equal(e.newThisWeek, 3);
  assert.deepEqual(e.technologies.map((t) => [t.name, t.count]), [["Go", 11], ["Python", 3]]);
  assert.equal(e.technologies[0].path, "/jobs/tech/go");
  assert.equal(e.technologies[1].path, null, "under ten open jobs there is no landing page to link");
  assert.deepEqual(e.companies.map((c) => c.slug), ["birch", "acme"], "most new this week first");
});

// ⛔ 47m (changed on purpose): "A147 · the page opens on the browse board only while nothing is searched or narr" retired — the surface it pinned was rebuilt in the plate system (47m M5).
