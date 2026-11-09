// ⭐ A148 (45o, owner 11-08) · SEARCH SCOPE LABELS — People · Company · Role · Stack / Skill head the search's dropdown;
// one pressed = the server reads ONLY that kind (one query, up to 10 rows, no titles). Synthetic data only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { publicSuggest, SUGGEST_KINDS, SCOPED_LIMIT } from "../services/companies/publicCompany.js";

function fixture() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE companies (id INTEGER PRIMARY KEY, slug TEXT, name TEXT, domain TEXT, parent_id INTEGER);
    CREATE TABLE scraped_jobs (id INTEGER PRIMARY KEY, job_id TEXT, title TEXT, normalized_title TEXT, is_active INTEGER, duplicate_of TEXT, board_category TEXT);
    CREATE TABLE job_company (job_id TEXT, company_id INTEGER);
  `);
  for (let i = 1; i <= 14; i++) {
    db.prepare(`INSERT INTO companies (id, slug, name) VALUES (?, ?, ?)`).run(i, `gopher-${i}`, `Gopher Works ${i}`);
    db.prepare(`INSERT INTO scraped_jobs (id, job_id, title, is_active, board_category) VALUES (?, ?, 'Go Developer', 1, 'software-engineering')`).run(i, `j${i}`);
    db.prepare(`INSERT INTO job_company VALUES (?, ?)`).run(`j${i}`, i);
  }
  let titleReads = 0;
  const read = { all: async (sql, params) => { titleReads++; return db.prepare(sql).all(...params); } };
  return { db, read, titleReads: () => titleReads };
}

test("A148 · a scope reads only its kind, with up to 10 rows; no scope keeps the five-row grouped answer", async () => {
  assert.deepEqual([...SUGGEST_KINDS], ["person", "company", "role", "tech"]);
  const { db, read, titleReads } = fixture();
  const scoped = await publicSuggest(db, read, "go", { kind: "company" });
  assert.equal(scoped.companies.length, SCOPED_LIMIT);
  assert.deepEqual([scoped.roles, scoped.technologies, scoped.titles, scoped.people], [[], [], [], []]);
  assert.equal(titleReads(), 0, "a scoped search never reads the title index");

  const tech = await publicSuggest(db, read, "go", { kind: "tech" });
  assert.ok(tech.technologies.some((t) => t.name === "Go"));
  assert.deepEqual([tech.companies, tech.titles], [[], []]);

  const all = await publicSuggest(db, read, "go", { kind: "nonsense" });
  assert.equal(all.companies.length, 5, "an unknown kind is no scope");
  assert.ok(titleReads() > 0);
});

test("A148 · the dropdown carries the four labels, sends kind=, and Backspace in an empty box drops the scope", () => {
  const ui = fs.readFileSync("client/src/components/UsbSuggest.jsx", "utf8");
  assert.match(ui, /\[\["person", "People"\], \["company", "Company"\], \["role", "Role"\], \["tech", "Stack \/ Skill"\]\]/);
  assert.match(ui, /&kind=\$\{scope\}/);
  assert.match(ui, /e\.key === "Backspace" && grouped && scope && !\(value \|\| ""\)\.length/);
  assert.match(ui, /unauthorised\.current \|\| \(grouped && scope\) \? \{ suggestions: \[\] \}/, "a scope skips the signed-in title suggest");
  const server = fs.readFileSync("server.js", "utf8");
  assert.match(server, /publicSuggest\(db, readPool, String\(req\.query\?\.q \|\| ""\), \{ kind: /);
});
