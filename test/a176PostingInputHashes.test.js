// ⭐ A176 (46d) · the posting side of A85's "current" KEPT (posting_input_hashes, migration 269): written only by one
// INSERT … SELECT on the writer, dropped by triggers on any change to a hash input / insert / delete, read as
// COALESCE(kept, computed) — so the fit filter, the fit facet and the board-fit plan give the SAME answers, cheaply.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { at, lastAt } from "../test-support/sourceAnchors.js";
import { registerScoreFreshness, currentScoreSql, atsJobInputHash, presentedScore, storedScoreSql, postingInputHashSql } from "../services/jobs/boardFitPrecompute.js";
import { fillPostingInputHashes, postingInputHashCoverage } from "../services/jobs/postingInputHashes.js";

const BASIS = "0123456789abcdef0123456789abcdef";
const block = (f) => { const s = fs.readFileSync(f, "utf8"); const i = at(s, 'id: "269_posting_input_hashes"'); return s.slice(lastAt(s, "    {", i), at(s, "    },", i) + 6); };

function fixture(n = 6) {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  registerScoreFreshness(db);
  const ins = db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, company, title, _hash, scraped_at, is_active, description)
    VALUES (?, 'q', 'Acme', ?, ?, 1, 1, ?)`);
  for (let i = 0; i < n; i++) ins.run(`j${String(i).padStart(3, "0")}`, `Engineer ${i}`, `h${i}`, `Build thing ${i}.`);
  return db;
}
const kept = (db, id) => db.prepare("SELECT input_hash FROM posting_input_hashes WHERE job_id = ?").pluck().get(id) ?? null;
const row = (db, id) => db.prepare("SELECT * FROM scraped_jobs WHERE job_id = ?").get(id);

test("a176: migration 269 is byte-identical in both runners and only ADDS a table and its three triggers", () => {
  assert.equal(block("server.js"), block("scripts/migrations.js"));
  const sql = block("server.js").replace(/^\s*\/\/.*$/gm, "");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS posting_input_hashes \(/);
  assert.match(sql, /AFTER UPDATE OF job_id, title, company, category, description, skills_json, normalized_title, description_text, description_basis ON scraped_jobs/);
  assert.match(sql, /CREATE TRIGGER IF NOT EXISTS trg_pih_insert AFTER INSERT ON scraped_jobs/);
  assert.match(sql, /CREATE TRIGGER IF NOT EXISTS trg_pih_delete AFTER DELETE ON scraped_jobs/);
  assert.doesNotMatch(sql.replace(/CREATE TRIGGER IF NOT EXISTS trg_pih_\w+ AFTER[\s\S]*?BEGIN DELETE FROM posting_input_hashes WHERE[^;]*; END;/g, ""), /\b(DROP|DELETE|UPDATE|ALTER)\b/);
});

test("a176: the fill keeps exactly atsJobInputHash(row); every change to an input, a re-insert and a delete drop it", () => {
  const db = fixture();
  const r = fillPostingInputHashes(db, {});
  assert.equal(r.filled, 6); assert.equal(r.done, true);
  for (const id of ["j000", "j001", "j005"]) assert.equal(kept(db, id), atsJobInputHash(row(db, id)), id);
  // the same SQL the readers use answers the same hash, kept or computed
  const viaSql = (id) => db.prepare(`SELECT ${postingInputHashSql("sj")} FROM scraped_jobs sj WHERE sj.job_id = ?`).pluck().get(id);
  assert.equal(viaSql("j000"), atsJobInputHash(row(db, "j000")));
  db.prepare("UPDATE scraped_jobs SET description = 'Changed.' WHERE job_id = 'j000'").run();
  assert.equal(kept(db, "j000"), null, "an input changed → the kept hash is gone");
  assert.equal(viaSql("j000"), atsJobInputHash(row(db, "j000")), "…and the reader computes the new one");
  db.prepare("UPDATE scraped_jobs SET description_text = 'x' WHERE job_id = 'j001'").run();
  assert.equal(kept(db, "j001"), null, "description_text is an input (D59)");
  db.prepare("UPDATE scraped_jobs SET scraped_at = 99, is_active = 1 WHERE job_id = 'j002'").run();
  assert.equal(kept(db, "j002"), atsJobInputHash(row(db, "j002")), "a non-input column leaves it");
  const r3 = row(db, "j003");
  db.prepare(`INSERT OR REPLACE INTO scraped_jobs (id, job_id, search_query, company, title, _hash, scraped_at, is_active, description)
    VALUES (?, 'j003', 'q', 'Acme', 'Renamed', 'h3', 1, 1, 'Build thing 3.')`).run(r3.id);
  assert.equal(kept(db, "j003"), null, "a REPLACE re-insert drops it (its delete fires no trigger by default)");
  db.prepare("DELETE FROM scraped_jobs WHERE job_id = 'j004'").run();
  assert.equal(kept(db, "j004"), null);
  // the next sweep refills what was dropped, and nothing kept is ever stale
  fillPostingInputHashes(db, {});
  for (const id of ["j000", "j001", "j002", "j003", "j005"]) assert.equal(kept(db, id), atsJobInputHash(row(db, id)), id);
  assert.deepEqual(postingInputHashCoverage(db), { active: 5, kept: 5 });
});

test("a176: A85 still holds with kept hashes — the filter's current score equals the badge's, row by row", () => {
  const db = fixture(4);
  const score = (id, basis = BASIS) => db.prepare(`INSERT INTO ats_only_reports (user_id, domain_profile_id, job_id, ats_report, ats_score,
      scorer_version, scored_at, basis_hash, job_hash) VALUES (1, 7, ?, '{}', 70, 'local', 1, ?, ?)`).run(id, basis, atsJobInputHash(row(db, id)));
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1, 'u1', 'x')").run();
  db.prepare(`INSERT INTO domain_profiles (id, user_id, profile_name, role_family, domain, seniority, target_titles,
      selected_keywords, selected_verbs, selected_tools, is_active, created_at, updated_at, include_summary, generate_at_queue)
    VALUES (7, 1, 'Eng', 'engineering', 'engineering', 'mid', '[]', '[]', '[]', '[]', 1, 1, 1, 0, 0)`).run();
  for (const id of ["j000", "j001", "j002"]) score(id);
  fillPostingInputHashes(db, {});
  db.prepare("UPDATE scraped_jobs SET description = 'Edited after scoring.' WHERE job_id = 'j001'").run();
  const rows = db.prepare(`SELECT sj.job_id, aor.ats_score AS matchScore, ${storedScoreSql("sj", "aor")}, ${currentScoreSql(BASIS)} AS current
    FROM scraped_jobs sj LEFT JOIN ats_only_reports aor ON aor.job_id = sj.job_id AND aor.user_id = 1 AND aor.domain_profile_id IS 7
    ORDER BY sj.job_id`).all();
  for (const r of rows) assert.equal(r.current ?? null, presentedScore(r, { basisHash: BASIS }), r.job_id);
  assert.deepEqual(rows.map(r => r.current ?? null), [70, null, 70, null], "edited → stale; unscored → none");
});

test("a176: the fill walks in slices and resumes; a late slice still moves", () => {
  const db = fixture(9);
  let after = "", rounds = 0, total = 0;
  for (;;) {
    const r = fillPostingInputHashes(db, { afterJobId: after, scan: 4, batch: 2, deadline: 0 });   // the deadline already passed
    total += r.filled; rounds++;
    if (r.done) break;
    assert.notEqual(r.lastJobId, after, "every slice moves forward");
    after = r.lastJobId;
    assert.ok(rounds < 20);
  }
  assert.equal(total, 9);
});

test("a176: server.js runs the fill as a job; the plan pass and currentScoreSql read the kept hash", () => {
  const src = fs.readFileSync("server.js", "utf8");
  assert.match(src, /registerJob\("posting_input_hashes", async \(\{ payload, deadline \}\) => \{/);
  assert.match(src, /enqueueJob\(db, "posting_input_hashes", "sweep"\)/);
  const pre = fs.readFileSync("services/jobs/boardFitPrecompute.js", "utf8");
  assert.match(pre, /WHEN aor\.job_hash IS NOT \$\{hasKeptHashes \? postingInputHashSql\("sj"\) :/);
  assert.match(currentScoreSql(BASIS), /COALESCE\(\(SELECT pih\.input_hash FROM posting_input_hashes pih WHERE pih\.job_id = sj\.job_id\), ats_job_input_hash\(/);
});
