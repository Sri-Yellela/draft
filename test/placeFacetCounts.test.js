// ⚡ 10-06 (33): the location facet is COUNTED in one pass (placeFacetCounts) instead of asking the SQL
// predicate (placesFilterSql) once per option — 74 options × correlated EXISTS made every facets call
// 9–10 s, and the client fetches facets on every word press and every search. The SQL stays the
// definition; this test holds the two equal for EVERY option over real location strings.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { parsePlaces } from "../services/jobs/jobTags.js";
import { placesFilterSql, placeFacetCounts } from "../services/jobs/tagFilters.js";
import { PLACES } from "../shared/jobTagVocabulary.js";

// Real strings from the 10-06 local board, plus the edge cases the predicate distinguishes.
const LOCATIONS = [
  "Boston, MA", "Cambridge, MA", "Massachusetts", "San Francisco, CA", "San Francisco, CA, Seattle WA, New York, NY",
  "New York, NY (HQ)", "Austin, TX", "Remote in the US", "US - Remote", "US", "United States", "US, Canada",
  "London", "Toronto, Canada", "Japan", "Dublin, Ireland", "Hybrid - San Francisco", "Washington, DC",
  "Seattle, Washington, United States", "Denver, CO; Remote", "N/A", null, "Chicago, IL or Remote",
  "California", "Texas", "Portland, OR", "Atlanta, GA", "Pittsburgh, PA", "Salt Lake City, UT",
];

function fixture() {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE scraped_jobs (job_id TEXT PRIMARY KEY, tag_basis TEXT);
           CREATE TABLE job_tag_places (job_id TEXT, country TEXT, state TEXT, metro TEXT);`);
  const byJob = new Map();
  LOCATIONS.forEach((loc, i) => {
    const id = `j${i}`;
    db.prepare("INSERT INTO scraped_jobs VALUES (?, 'b')").run(id);
    const places = parsePlaces(loc);
    for (const p of places) db.prepare("INSERT INTO job_tag_places VALUES (?, ?, ?, ?)").run(id, p.country, p.state, p.metro);
    byJob.set(id, places);
  });
  db.prepare("INSERT INTO scraped_jobs VALUES ('untagged', NULL)").run();
  byJob.set("untagged", []);
  return { db, byJob };
}

test("placeFacetCounts equals placesFilterSql for EVERY location option — count and known", () => {
  const { db, byJob } = fixture();
  const values = PLACES.options.map(o => o.value);
  const counts = placeFacetCounts(byJob, values);
  let checked = 0;
  for (const v of values) {
    const f = placesFilterSql([v]);
    const count = db.prepare(`SELECT COUNT(*) AS n FROM scraped_jobs sj WHERE ${f.sql}`).get().n;
    const known = db.prepare(`SELECT COUNT(*) AS n FROM scraped_jobs sj WHERE (${f.sql}) AND NOT ${f.unknownSql}`).get().n;
    assert.deepEqual(counts.get(v), { count, known }, v);
    checked++;
  }
  assert.equal(checked, 74);
  assert.ok(counts.get("metro:boston").known >= 2, "the fixture exercises a real match");
});

test("the facets' location clause counts through placeFacetCounts, in one read of the board's places", () => {
  const src = fs.readFileSync("services/jobs/boardFacets.js", "utf8");
  // A126 (hotfix 11-05): async, reading through readerOf(ctx) — the worker pool when the board hands one.
  assert.match(src, /compute: async \(ctx\) => \{\s*const \{ joinClause, whereClause, baseArgs \} = ctx;\s*const read = readerOf\(ctx\);/);
  assert.match(src, /placeFacetCounts\(byJob, PLACES\.options\.map\(o => o\.value\)\)/);
  assert.match(src, /if \(clause\.compute\) return clause\.compute\(ctx\);/);
});
