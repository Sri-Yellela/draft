// ⭐ A171 (46b, found reading production's public facets): "Product management · general" held 10,139 postings (13 % of the
// board) — a hotel duty manager, a transfer-pricing manager, city deputy directors. D127's "management" (SOC 11, every
// kind of manager) fell through to its primary code 11, and product management is the taxonomy's only code-11 category.
import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { classifyPosting, taxonomy } from "../services/jobs/taxonomyClassify.js";
import { classifyRange } from "../services/jobs/taxonomyBackfill.js";

const c = (title, boardCategory = "management") => classifyPosting({ title, description: "", boardCategory }, taxonomy());

test("a171ManagerIsNotProductManagement: a manager with no other evidence is left unclassified", () => {
  for (const t of ["Duty Manager", "Senior Manager - US Transfer Pricing", "DEPUTY DIRECTOR", "Director of Facilities", "Shipyard Material Manager"]) {
    const v = c(t);
    assert.notEqual(v.category, "product-management", `${t} → ${v.category}/${v.subcategory} (${v.reason})`);
    assert.doesNotMatch(String(v.reason), /^d127-only:management/, t);
  }
  assert.equal(c("Senior Product Manager").category, "product-management", "a real product manager still is one");
  assert.equal(c("Account Executive", "sales").category, "sales-cs", "the other D127 hints are untouched");
});

test("a171BackfillReReadsTheMisfiled: a row the old fallback wrote is read again under the same taxonomy version", () => {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  const tax = taxonomy();
  const ins = db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, company, title, _hash, scraped_at, direct_apply, is_active, board_category)
    VALUES (?, 't', 'Acme Hotels', ?, ?, unixepoch(), 0, 1, 'management')`);
  ins.run("j1", "Duty Manager", "h1"); ins.run("j2", "Senior Product Manager", "h2");
  db.prepare(`INSERT INTO job_taxonomy (job_id, category, subcategory, confidence, reason, version, classified_at) VALUES
    ('j1', 'product-management', 'pm.general', 0.4, 'd127-only:management', ?, unixepoch()),
    ('j2', 'product-management', 'pm.core', 0.9, 'alias:product manager', ?, unixepoch())`).run(tax.version, tax.version);
  const r = classifyRange(db, 0, 100, tax);
  assert.deepEqual(r.results.map(x => x[0]), ["j1"], "only the misfiled row is read again");
  assert.notEqual(r.results[0][1], "product-management");
});
