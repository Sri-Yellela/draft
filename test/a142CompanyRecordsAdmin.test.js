// ⭐ A142 (45o) · Admin → The board → Company records: the counts the D179 report found missing — open postings with no
// record, records sharing a domain, records whose names match once suffixes and punctuation are stripped — read without a
// DB shell. Nothing merges by itself. Synthetic companies only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { buildHealth, nameKey } from "../services/companies/companyHealth.js";

test("A142 · the name key ignores case, punctuation and legal suffixes — and nothing else", () => {
  assert.equal(nameKey("Acme Robotics, Inc."), "acme robotics");
  assert.equal(nameKey("ACME ROBOTICS LLC"), "acme robotics");
  assert.equal(nameKey("Café Labs"), "cafe");
  assert.notEqual(nameKey("Acme Robotics"), nameKey("Acme Rocketry"));
});

test("A142 · postings with no record, same-domain and same-name groups — over OPEN public postings", async () => {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE companies (id INTEGER PRIMARY KEY, slug TEXT, name TEXT, domain TEXT);
    CREATE TABLE scraped_jobs (id INTEGER PRIMARY KEY, job_id TEXT, is_active INTEGER, duplicate_of TEXT, board_category TEXT);
    CREATE TABLE job_company (job_id TEXT, company_id INTEGER);`);
  db.prepare(`INSERT INTO companies VALUES (1, 'acme', 'Acme Robotics', 'acme.example'), (2, 'acme-robotics-inc', 'Acme Robotics, Inc.', NULL),
    (3, 'acme-eu', 'Acme Europe', 'acme.example'), (4, 'birch', 'Birch Bank', 'birch.example')`).run();
  const job = (id, co, { active = 1, cat = "software-engineering" } = {}) => {
    db.prepare(`INSERT INTO scraped_jobs VALUES (?, ?, ?, NULL, ?)`).run(id, `j${id}`, active, cat);
    if (co) db.prepare(`INSERT INTO job_company VALUES (?, ?)`).run(`j${id}`, co);
  };
  job(1, 1); job(2, 1); job(3, 2); job(4, 4); job(5, null); job(6, null); job(7, null, { active: 0 }); job(8, null, { cat: "held" });
  const h = await buildHealth({ all: async (sql, p) => db.prepare(sql).all(...p) });
  assert.equal(h.openPostings, 6);
  assert.equal(h.postingsNoRecord, 2, "closed and held postings are not the linker's backlog");
  assert.equal(h.recordsWithOpenJobs, 3);
  assert.equal(h.sameDomain.groups, 1);
  assert.deepEqual(h.sameDomain.top[0].records.map((r) => r.id), [1, 3], "most open postings first");
  assert.equal(h.sameName.groups, 1);
  assert.deepEqual(h.sameName.top[0].records.map((r) => r.id).sort(), [1, 2]);
});

test("A142 · the section in Admin → The board, the route on the read workers, nothing automatic", () => {
  assert.match(fs.readFileSync("client/src/panels/adminMap.js", "utf8"), /\["records", "Company records"\]/);
  assert.match(fs.readFileSync("client/src/panels/AdminPanel.jsx", "utf8"), /\{at\("board", "records"\) && <CompanyRecordsTab\/>\}/);
  assert.match(fs.readFileSync("server.js", "utf8"), /app\.get\("\/api\/admin\/company-records\/health", requireAdmin, async \(_req, res\) => \{\r?\n  try \{ res\.json\(await companyHealth\(readPool\)\); \}/);
  const ui = fs.readFileSync("client/src/panels/adminCompanyRecords.jsx", "utf8");
  for (const dcs of ["merge", "apart", "parent"]) assert.ok(ui.includes(`decide(r.id, "${dcs}")`), dcs);
  assert.doesNotMatch(fs.readFileSync("services/companies/companyHealth.js", "utf8"), /UPDATE |DELETE |INSERT /, "the counts only read");
});
