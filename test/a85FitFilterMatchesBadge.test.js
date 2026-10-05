// A85 — the fit filter and the card's badge read ONE definition of "this stored score is current".
// The badge is presentedScore (basis_hash = the caller's current basis AND job_hash = the posting's
// inputs now); the filter used to band the raw cell, so a stale score filed a card under "Strong"
// while its badge was blank. Now both answer the same question, and this pins it row by row.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import {
  registerScoreFreshness, currentScoreSql, atsJobInputHash, presentedScore, storedScoreSql,
} from "../services/jobs/boardFitPrecompute.js";
import { fitBandsSql } from "../services/jobs/jobCursor.js";
import { at } from "../test-support/sourceAnchors.js";

const BASIS = "0123456789abcdef0123456789abcdef";
const OLD_BASIS = "fedcba9876543210fedcba9876543210";

function fixture() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  registerScoreFreshness(db);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1, 'u1', 'x')").run();
  db.prepare(`INSERT INTO domain_profiles (id, user_id, profile_name, role_family, domain, seniority, target_titles,
      selected_keywords, selected_verbs, selected_tools, is_active, created_at, updated_at, include_summary, generate_at_queue)
    VALUES (7, 1, 'Eng', 'engineering', 'engineering', 'mid', '[]', '[]', '[]', '[]', 1, 1, 1, 0, 0)`).run();
  const job = (id, title) => {
    db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, company, title, _hash, scraped_at, is_active, description)
      VALUES (?, 'q', 'Acme', ?, ?, 1, 1, 'Build things.')`).run(id, title, id);
    return db.prepare("SELECT * FROM scraped_jobs WHERE job_id = ?").get(id);
  };
  const score = (row, { basis = BASIS, hash = atsJobInputHash(row), value = 70 } = {}) =>
    db.prepare(`INSERT INTO ats_only_reports (user_id, domain_profile_id, job_id, ats_report, ats_score, scorer_version,
        scored_at, basis_hash, job_hash) VALUES (1, 7, ?, '{}', ?, 'local', 1, ?, ?)`).run(row.job_id, value, basis, hash);
  score(job("current", "Engineer"));
  const edited = job("edited", "Engineer");
  score(edited);
  db.prepare("UPDATE scraped_jobs SET description = 'The posting changed after it was scored.' WHERE job_id = 'edited'").run();
  score(job("old_resume", "Engineer"), { basis: OLD_BASIS });
  job("unscored", "Engineer");
  return db;
}

const JOIN = `FROM scraped_jobs sj LEFT JOIN ats_only_reports aor
  ON aor.job_id = sj.job_id AND aor.user_id = 1 AND aor.domain_profile_id IS 7`;

test("A85: the fit filter keeps exactly the rows whose badge shows a score", () => {
  const db = fixture();
  const strong = db.prepare(`SELECT sj.job_id ${JOIN} WHERE ${fitBandsSql(["strong"], { scoreSql: currentScoreSql(BASIS) })}
    ORDER BY sj.job_id`).all().map(r => r.job_id);
  assert.deepEqual(strong, ["current"], "a stale score (edited posting, earlier résumé) is in no band");
  // The raw cell — the old behaviour — would have filed all three scored rows under Strong.
  const raw = db.prepare(`SELECT sj.job_id ${JOIN} WHERE ${fitBandsSql(["strong"])} ORDER BY sj.job_id`).all().map(r => r.job_id);
  assert.deepEqual(raw, ["current", "edited", "old_resume"]);
  // Row by row, the filter's verdict equals the badge's.
  const rows = db.prepare(`SELECT sj.job_id, aor.ats_score AS matchScore, ${storedScoreSql("sj", "aor")},
      ${currentScoreSql(BASIS)} AS current ${JOIN}`).all();
  for (const r of rows) {
    assert.equal(r.current ?? null, presentedScore(r, { basisHash: BASIS }), r.job_id);
  }
  // No basis (no base résumé): no stored score is current — for the badge and for the filter.
  assert.equal(currentScoreSql(null), "NULL");
  assert.equal(currentScoreSql("not-a-hash'; DROP TABLE x"), "NULL", "only our own hex digest is ever inlined");
});

test("A85: server.js bands the fit filter on the current score and hands the same expression to the facets", () => {
  const server = fs.readFileSync("server.js", "utf8");
  const handler = server.slice(at(server, "async function boardPageResponse("));
  assert.match(handler, /fitScoreSql = currentScoreSql\(atsBasisForProfile\(req\.user\.id, sessionActiveProfile\)\?\.basisHash \?\? null\)/);
  assert.match(handler, /fitBandsSql\(fitBands, \{ scoreSql: fitScoreSql \}\)/);
  assert.match(handler, /unclassifiedSql: richFilters\.established\.unclassifiedSql,\s*fitScoreSql,/);
  assert.match(server, /registerScoreFreshness\(db\);/);
  const facets = fs.readFileSync("services/jobs/boardFacets.js", "utf8");
  assert.match(facets, /scoreSql: ctx\?\.fitScoreSql \?\? FIT_SCORE_SQL/);
});
