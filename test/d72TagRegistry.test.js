// ⛔ D72 P0 · THE DIMENSION REGISTRY IS HELD TO THE SCHEMA (shared/tagRegistry.js).
//
// The registry is an inventory — it is only worth anything while it is TRUE. So: every scraped_jobs column
// it names exists; every tag-like column on scraped_jobs is claimed by a dimension (a new `tag_*`, `req_*`,
// `salary_*` … column added without a registry entry fails here, which is how a second store of one fact
// stops arriving unannounced); every class and subject is in its closed set; every coverage predicate runs.
import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { TAG_DIMENSIONS, TAG_CLASSES, SUBJECTS, MEASURABLE } from "../shared/tagRegistry.js";

function migratedDb() {
  const d = new Database(":memory:");
  for (const m of MIGRATIONS) d.exec(m.sql);
  return d;
}
const COLUMNS = new Set(migratedDb().prepare("PRAGMA table_info(scraped_jobs)").all().map(c => c.name));

// "scraped_jobs.salary_min/max/currency/period" → salary_min, salary_max, salary_currency, salary_period.
function columnsNamed(at) {
  const m = /^scraped_jobs\.([a-z0-9_/ ]+)/.exec(at);
  if (!m) return [];
  const parts = m[1].split("/").map(s => s.trim()).filter(Boolean);
  const stem = parts[0].includes("_") ? parts[0].slice(0, parts[0].lastIndexOf("_") + 1) : "";
  return parts.map((p, i) => (i === 0 || COLUMNS.has(p) ? p : stem + p));
}
const claimed = new Set(TAG_DIMENSIONS.flatMap(dim => dim.stores.flatMap(s => columnsNamed(s.at))));

test("D72: every dimension has a unique key, a known subject and a class from the closed set", () => {
  const keys = TAG_DIMENSIONS.map(d => d.key);
  assert.equal(new Set(keys).size, keys.length, "duplicate keys");
  for (const d of TAG_DIMENSIONS) {
    assert.ok(SUBJECTS.includes(d.subject), `${d.key}: subject ${d.subject}`);
    assert.ok(TAG_CLASSES.includes(d.class), `${d.key}: class ${d.class}`);
    assert.ok(typeof d.unknown === "string" && d.unknown, `${d.key}: how unknown is stored must be stated`);
  }
});

test("D72: every scraped_jobs column the registry names exists", () => {
  const missing = [...claimed].filter(c => !COLUMNS.has(c));
  assert.deepEqual(missing, [], "the registry names columns the schema does not have");
});

test("D72: every tag-like column on scraped_jobs is claimed by a dimension — no unannounced second store", () => {
  const TAG_LIKE = /^(tag_(?!basis|version|owner_json)|req_|salary_|pay_text_|experience_level$|workplace_type$|employment_type$|skills_json$|is_h1b_sponsor$|requires_work_auth$|is_clearance_required$|bucket_|automation_tier$|direct_apply$|posted_at$|min_years_exp$|max_years_exp$|years_experience$|ghost_score$|is_frequent_repost$|collar$|classification_confidence$|category$|work_type$|location$)/;
  const unclaimed = [...COLUMNS].filter(c => TAG_LIKE.test(c) && !claimed.has(c));
  assert.deepEqual(unclaimed, [], "add each to shared/tagRegistry.js with its dimension, role and how unknown is stored");
});

test("D72: every posting dimension's coverage predicate runs against the schema", () => {
  const d = migratedDb();
  assert.ok(MEASURABLE.length >= 10);
  for (const dim of MEASURABLE) {
    for (const sql of [dim.coverage, dim.stated].filter(Boolean)) {
      assert.doesNotThrow(() => d.prepare(`SELECT COUNT(*) FROM scraped_jobs sj WHERE ${sql}`).get(), `${dim.key}: ${sql}`);
    }
  }
});
