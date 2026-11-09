// ⭐ A144 (45o, owner 11-08) · THE COMPANIES TAB — every company with open jobs; search, industry, technology, hiring now,
// sponsorship; TRUE counts (each facet over what the OTHER filters leave); the tab beside All jobs · Starred · Imported.
// Synthetic companies only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { buildDirectory, queryDirectory } from "../services/companies/companyDirectory.js";

const NOW = Date.UTC(2026, 10, 8, 12) ;
const nowSec = Math.floor(NOW / 1000);

function fixture() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE companies (id INTEGER PRIMARY KEY, slug TEXT, name TEXT, domain TEXT, parent_id INTEGER);
    CREATE TABLE scraped_jobs (id INTEGER PRIMARY KEY, job_id TEXT, is_active INTEGER, duplicate_of TEXT, board_category TEXT, discovered_at INTEGER);
    CREATE TABLE job_company (job_id TEXT, company_id INTEGER);
    CREATE TABLE company_facts (company_id INTEGER PRIMARY KEY, industry TEXT, hq TEXT, status TEXT);
    CREATE TABLE company_tech (company_id INTEGER, tech TEXT, postings INTEGER, last_seen INTEGER);
    CREATE TABLE company_lca_sponsorship (company TEXT PRIMARY KEY, match_status TEXT, match_confidence REAL, certified_total INTEGER);
  `);
  const co = db.prepare(`INSERT INTO companies (id, slug, name) VALUES (?, ?, ?)`);
  co.run(1, "acme-robotics", "Acme Robotics"); co.run(2, "birch-bank", "Birch Bank"); co.run(3, "cobalt-labs", "Cobalt Labs");
  co.run(4, "dormant-co", "Dormant Co");   // only closed / held postings → never listed
  let n = 0;
  const job = (company, { active = 1, cat = "software-engineering", dup = null, ageDays = 30 } = {}) => {
    n++; db.prepare(`INSERT INTO scraped_jobs (id, job_id, is_active, duplicate_of, board_category, discovered_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(n, `j${n}`, active, dup, cat, nowSec - ageDays * 86400);
    db.prepare(`INSERT INTO job_company VALUES (?, ?)`).run(`j${n}`, company);
  };
  for (let i = 0; i < 5; i++) job(1);
  job(1, { ageDays: 2 });                 // Acme: 6 open, 1 this week
  job(2); job(2); job(2, { dup: "j1" });  // Birch: 2 open (a duplicate is not counted)
  job(3, { ageDays: 1 });                 // Cobalt: 1 open, this week
  job(4, { active: 0 }); job(4, { cat: "held" });
  db.prepare(`INSERT INTO company_facts VALUES (1, 'Robotics', 'Boston', 'ok'), (2, 'Banking', 'Chicago', 'ok'), (3, 'Robotics', NULL, 'ok')`).run();
  const t = db.prepare(`INSERT INTO company_tech VALUES (?, ?, ?, ?)`);
  t.run(1, "Go", 4, nowSec); t.run(1, "Python", 3, nowSec); t.run(2, "Java", 2, nowSec); t.run(3, "Go", 2, nowSec);
  t.run(3, "Rust", 1, nowSec);            // one posting: below the page's evidence rule
  const l = db.prepare(`INSERT INTO company_lca_sponsorship VALUES (?, ?, ?, ?)`);
  l.run("Acme Robotics", "matched", 0.9, 40); l.run("Birch Bank", "matched", 0.4, 300);   // Birch: too weak a match to show
  l.run("Cobalt Labs", "unmatched", 0.9, 5);
  const read = { all: async (sql, params) => db.prepare(sql).all(...params) };
  return { db, read };
}

test("A144 · the snapshot lists only companies with OPEN public postings, with their facts, stack and sponsorship", async () => {
  const { read } = fixture();
  const rows = await buildDirectory(read, NOW);
  const by = Object.fromEntries(rows.map((r) => [r.slug, r]));
  assert.deepEqual(Object.keys(by).sort(), ["acme-robotics", "birch-bank", "cobalt-labs"], "a company with only closed / held postings is not listed");
  assert.equal(by["acme-robotics"].openJobs, 6);
  assert.equal(by["acme-robotics"].newThisWeek, 1);
  assert.equal(by["birch-bank"].openJobs, 2, "a duplicate is not an open job");
  assert.deepEqual(by["acme-robotics"].tech, ["Go", "Python"]);
  assert.deepEqual(by["cobalt-labs"].tech, ["Go"], "a technology on one posting is not evidence");
  assert.equal(by["acme-robotics"].sponsorFilings, 40);
  assert.equal(by["birch-bank"].sponsorFilings, 0, "a weak name match is never shown as a fact");
  assert.equal(by["cobalt-labs"].sponsorFilings, 0, "an unmatched record is never shown");
});

test("A144 · filters combine; each facet's count is what pressing it shows (true counts)", async () => {
  const { read } = fixture();
  const rows = await buildDirectory(read, NOW);
  const all = queryDirectory(rows, {});
  assert.equal(all.total, 3);
  assert.deepEqual(all.companies.map((c) => c.slug), ["acme-robotics", "birch-bank", "cobalt-labs"], "most open jobs first");
  assert.deepEqual(all.facets.industries, [{ value: "Robotics", count: 2 }, { value: "Banking", count: 1 }]);
  assert.equal(all.facets.hiringNow, 2);
  assert.equal(all.facets.sponsors, 1);

  const robotics = queryDirectory(rows, { industry: "Robotics" });
  assert.equal(robotics.total, 2);
  assert.deepEqual(robotics.facets.industries.map((o) => o.value), ["Robotics", "Banking"], "the industry facet ignores its own filter");
  const go = robotics.facets.technologies.find((o) => o.value === "Go");
  assert.equal(go.count, queryDirectory(rows, { industry: "Robotics", tech: "Go" }).total, "the number beside Go is what Go shows");
  assert.equal(queryDirectory(rows, { tech: "go" }).total, 2, "technology matches without case");
  assert.equal(queryDirectory(rows, { hiring: "now" }).total, all.facets.hiringNow);
  assert.equal(queryDirectory(rows, { sponsor: "1" }).total, all.facets.sponsors);
  assert.deepEqual(queryDirectory(rows, { q: "bir" }).companies.map((c) => c.slug), ["birch-bank"]);
  assert.deepEqual(queryDirectory(rows, { sort: "name" }).companies.map((c) => c.name), ["Acme Robotics", "Birch Bank", "Cobalt Labs"]);
  assert.equal(queryDirectory(rows, { sort: "new" }).companies[0].newThisWeek, 1);
  assert.equal(queryDirectory(rows, { industry: "Banking", tech: "Go" }).total, 0);
});

test("A144 · the tab sits beside All jobs · Starred · Imported; the board is not asked while it shows; the route is public", () => {
  const app = fs.readFileSync("client/src/App.jsx", "utf8");
  assert.match(app, /\["companies", "Companies", "Companies hiring"\]/);
  assert.match(app, /\{co && <CompaniesView \/>\}/);
  assert.match(fs.readFileSync("client/src/panels/JobsPanel.jsx", "utf8"), /if \(!user \|\| boardTab === "companies"\) return;/);
  const server = fs.readFileSync("server.js", "utf8");
  assert.match(server, /app\.get\("\/api\/public\/companies", publicLimit, async/);
  assert.ok(server.indexOf('app.get("/api/public/companies", ') < server.indexOf('app.get("/api/public/companies/:slug"'));
  const view = fs.readFileSync("client/src/pages/companies/CompaniesView.jsx", "utf8");
  assert.match(view, /navigate\(`\$\{base\}\/\$\{c\.slug\}`\)/, "a company opens its page inside the shell");
});
