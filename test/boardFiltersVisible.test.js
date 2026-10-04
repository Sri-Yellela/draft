// A73 (owner, 10-03) — "FILTERS DO NOTHING". Two causes, both fixed here.
//
// 1. A user-set filter on a sparsely classified column kept the unclassified rows (soft-null — "a row
//    is never hidden because we have not classified it") IN THEIR PLACES. On a mostly unenriched board
//    the top of the list did not move, so Remote/Senior/a skill read as dead controls. Now each such
//    filter also orders `(column IS NULL) ASC`: rows KNOWN to match lead, the unclassified follow, and
//    the response says how many are unclassified.
// 2. A failed /api/jobs threw into an effect nobody awaited; the previous board stayed on screen with
//    no word, indistinguishable from a filter that does nothing. Now the board says so.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { at } from "../test-support/sourceAnchors.js";
import { buildJobFilters } from "../services/jobs/jobQuery.js";
import { buildOrderKeys, orderByClause, FIT_KEYS } from "../services/jobs/jobCursor.js";
import { boardSearchSql } from "../services/jobs/boardSearch.js";

test("⭐ each user-set soft-null filter contributes a KNOWN-FIRST key; derived ones do not", () => {
  const f = buildJobFilters({ work_models: ["remote"], experience_levels: ["senior"], skills_include: ["python"],
                              employment_types: ["contract"], sponsorship_friendly: "1" });
  assert.deepEqual(f.established.filters, ["work_models", "employment_types", "experience_levels", "skills_include", "sponsorship_friendly"]);
  assert.equal(f.established.keys.length, 5);
  assert.match(f.established.unclassifiedSql, /sj\.workplace_type IS NULL/);
  // A DERIVED experience level ranks already (RANK_UNKNOWN) and adds no second key.
  const d = buildJobFilters({ experience_levels: ["senior"] }, { derivedKeys: ["experience_levels"] });
  assert.deepEqual(d.established.filters, []);
  assert.equal(d.established.unclassifiedSql, "");
  // Hard filters (source, salary) need none: they never keep an unclassified row.
  assert.deepEqual(buildJobFilters({ sources: ["greenhouse"], salary_min_usd: "100000" }).established.filters, []);
});

test("the known-first keys lead every sort, follow a search tier, and are absent when no filter is set", () => {
  const known = buildJobFilters({ work_models: ["remote"] }).established.keys;
  const def = buildOrderKeys("", [], { fit: true, established: known });
  assert.equal(def[0].sql, known[0].sql);
  assert.equal(def[1], FIT_KEYS[0]);
  assert.equal(buildOrderKeys("compHigh", [], { established: known })[0].sql, known[0].sql);
  const s = boardSearchSql(["ai"]);
  const searched = buildOrderKeys("", [], { search: s, established: known });
  assert.equal(searched[0].sql, s.sql);
  assert.equal(searched[1].sql, known[0].sql);
  assert.deepEqual(buildOrderKeys("", [], { fit: true, established: [] }), buildOrderKeys("", [], { fit: true }));
});

test("⭐ in SQLite: Remote shows the remote rows FIRST, the unclassified after, and drops the explicit mismatch", () => {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE scraped_jobs (job_id TEXT PRIMARY KEY, workplace_type TEXT, discovered_at INTEGER, scraped_at INTEGER, posted_at INTEGER, company TEXT);
           CREATE TABLE ats_only_reports (job_id TEXT, ats_score INTEGER);`);
  // Newest first by discovery — so before A73 the unclassified rows (newest) held the top.
  const rows = [["u1", null, 9], ["u2", null, 8], ["r1", "remote", 5], ["o1", "onsite", 7], ["r2", "remote", 4]];
  for (const [id, w, t] of rows) db.prepare("INSERT INTO scraped_jobs VALUES (?,?,?,?,NULL,NULL)").run(id, w, t, t);
  const f = buildJobFilters({ work_models: ["remote"] });
  const order = orderByClause(buildOrderKeys("", [], { fit: true, established: f.established.keys }));
  const got = db.prepare(`SELECT sj.job_id FROM scraped_jobs sj LEFT JOIN ats_only_reports aor ON aor.job_id = sj.job_id
                          WHERE 1=1 ${f.sql} ORDER BY ${order.sql}`).all(...f.params, ...order.params).map(r => r.job_id);
  assert.deepEqual(got, ["r1", "r2", "u1", "u2"]);
  const unc = db.prepare(`SELECT COUNT(*) n FROM scraped_jobs sj WHERE 1=1 ${f.sql} AND ${f.established.unclassifiedSql}`).get(...f.params).n;
  assert.equal(unc, 2);
});

test("the board passes the keys and discloses the unclassified count", () => {
  const src = fs.readFileSync("server.js", "utf8");
  assert.match(src, /established: richFilters\.established\.keys \}\);/);
  assert.match(src, /const unclassifiedSql = richFilters\.established\.unclassifiedSql;/);
  assert.match(src, /\.\.\.\(unclassified \? \{ unclassified \} : \{\}\),/);
});

test("⛔ a failed board request says so on the board — never the old board, silently", () => {
  const src = fs.readFileSync("client/src/panels/JobsPanel.jsx", "utf8").replace(/\r\n/g, "\n");
  const fetchJobs = src.slice(at(src, "const fetchJobs = useCallback", 0, "fetchJobs"), at(src, "fetchJobsRef.current = fetchJobs;", 0, "fetchJobs end"));
  assert.match(fetchJobs, /\} catch \(e\) \{[\s\S]*?setScrapeError\(`\$\{BOARD_ERROR_PREFIX\}[\s\S]*?throw e;\s*\} finally/);
  assert.match(fetchJobs, /setScrapeError\(prev => \(typeof prev === "string" && prev\.startsWith\(BOARD_ERROR_PREFIX\) \? null : prev\)\);/);
  // No un-awaited board fetch may leave a rejection unhandled.
  assert.doesNotMatch(src, /^\s*fetchJobs\([^)]*\);\s*(\/\/.*)?$/m, "a bare fetchJobs(...) statement — its failure goes nowhere");
  assert.doesNotMatch(src, /fetchJobsRef\.current\?\.\(1\);/, "a bare fetchJobsRef call");
});
