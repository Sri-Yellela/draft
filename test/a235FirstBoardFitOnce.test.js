// A235: a new profile's first board-fit ran TWICE. loadOrCreateSimpleApplyProfile returned the
// freshly built object on creation (no structuredFacts / updatedAt) but the stored row afterwards,
// and buildRuntimeAtsBasis hashes structuredFacts — so the basis changed at the next read and every
// board-fit row went stale. Creation must hand back exactly what a later read returns.
import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { loadOrCreateSimpleApplyProfile, loadSimpleApplyProfile } from "../services/simpleApplyProfile.js";

function db() {
  const d = new Database(":memory:");
  d.exec(`
    CREATE TABLE base_resume (user_id INTEGER PRIMARY KEY, name TEXT, content TEXT NOT NULL,
      enhanced_content TEXT, enhanced_at INTEGER, enhanced_ats_delta INTEGER,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE simple_apply_profiles (user_id INTEGER PRIMARY KEY,
      titles_json TEXT NOT NULL DEFAULT '[]', keywords_json TEXT NOT NULL DEFAULT '[]',
      skills_json TEXT NOT NULL DEFAULT '[]', search_terms_json TEXT NOT NULL DEFAULT '[]',
      source_hash TEXT, years_experience INTEGER,
      citizenship_status TEXT, work_authorization TEXT, requires_sponsorship INTEGER NOT NULL DEFAULT 0,
      has_clearance INTEGER NOT NULL DEFAULT 0, clearance_level TEXT, degree_level TEXT,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()));
  `);
  d.prepare("INSERT INTO base_resume (user_id, name, content) VALUES (?, ?, ?)")
    .run(7, "r.pdf", "Senior Data Engineer with Python, SQL, Spark, AWS. 6 years of experience building pipelines.");
  return d;
}

test("A235: the profile returned on creation equals the one every later read returns", () => {
  const d = db();
  const created = loadOrCreateSimpleApplyProfile(d, 7, ["Data Engineer"]);
  const again = loadOrCreateSimpleApplyProfile(d, 7, ["Data Engineer"]);
  assert.deepEqual(created, again);
  assert.deepEqual(created, loadSimpleApplyProfile(d, 7));
  assert.ok("structuredFacts" in created, "the stored row's structuredFacts travel with the first answer");
});
