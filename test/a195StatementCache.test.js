// ⭐ A195 leftover (b) (46m) · fixed SQL prepared once per database (services/stmtCache.js) at the sites the 46l profile
// showed compiling SQL on every call (tmp/a195prof: better-sqlite3's Statement constructor among the top self time —
// aliasesOf under Your skills map, bestBetSignalsFor / eligibilityForJob under the deck).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { prepared, preparedCount } from "../services/stmtCache.js";

test("one statement per (database, SQL, pluck); separate databases never share one", () => {
  const a = new Database(":memory:"), b = new Database(":memory:");
  a.exec("CREATE TABLE t (x); INSERT INTO t VALUES (1), (2)"); b.exec("CREATE TABLE t (x); INSERT INTO t VALUES (9)");
  const s1 = prepared(a, "SELECT x FROM t ORDER BY x"), s2 = prepared(a, "SELECT x FROM t ORDER BY x");
  assert.equal(s1, s2);
  assert.deepEqual(prepared(a, "SELECT x FROM t ORDER BY x", { pluck: true }).all(), [1, 2], "pluck is its own statement");
  assert.deepEqual(prepared(a, "SELECT x FROM t ORDER BY x").all(), [{ x: 1 }, { x: 2 }], "…and does not change the plain one");
  assert.deepEqual(prepared(b, "SELECT x FROM t ORDER BY x").all(), [{ x: 9 }]);
  assert.equal(preparedCount(a), 2); assert.equal(preparedCount(b), 1);
  // a schema change after preparing: SQLite recompiles it itself
  a.exec("ALTER TABLE t ADD COLUMN y DEFAULT 5");
  assert.deepEqual(prepared(a, "SELECT * FROM t ORDER BY x").get(), { x: 1, y: 5 });
});

test("the hot sites use it, with FIXED SQL text only (no spliced values or IN lists)", () => {
  const sites = {
    "services/atlas/atlasStore.js": /prepared\(db, `SELECT CASE WHEN term = \? THEN equivalent ELSE term END AS alias FROM skill_synonyms/,
    "services/bestBets.js": /prepared\(db, `SELECT ats_report, ats_score FROM ats_only_reports WHERE user_id = \? AND domain_profile_id IS \? AND job_id = \?/,
    "services/jobEligibility.js": /prepared\(db, `SELECT \* FROM scraped_jobs WHERE job_id = \?`\)/,
    "services/atlas/atlasMe.js": /prepared\(db, `SELECT COUNT\(\*\) \|\| ':' \|\| COALESCE\(MAX\(computed_at\), 0\)/,
    "services/yourSkills.js": /prepared\(db, `SELECT \* FROM skill_proofs WHERE user_id = \? ORDER BY created_at, id`\)/,
  };
  for (const [f, re] of Object.entries(sites)) {
    const s = fs.readFileSync(f, "utf8");
    assert.match(s, re, f);
    for (const m of s.matchAll(/prepared\(db, `([^`]*)`/g)) assert.doesNotMatch(m[1], /\$\{/, `${f}: a prepared() SQL must be fixed text`);
  }
});
