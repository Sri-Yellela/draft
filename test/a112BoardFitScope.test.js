import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { createBoardFitPrecompute } from "../services/jobs/boardFitPrecompute.js";
import { LOCAL_ATS_SOURCE } from "../services/localAtsScorer.js";
import { at } from "../test-support/sourceAnchors.js";

// A112 (11-02): the crawler boost took the board to 79,184 postings, and the fit precompute scored EVERY active posting
// for every profile — 418,711 stored reports for 15 users. It now scores only what the profile's default board shows:
// its own category and unclassified rows, never 'held'. Synthetic postings.

const USER = 7, PROFILE = 70;
function board() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (?, 'u7', 'x')").run(USER);
  db.prepare(`INSERT INTO domain_profiles (id, user_id, profile_name, role_family, domain, seniority, target_titles, selected_keywords,
      selected_verbs, selected_tools, is_active, created_at, updated_at, include_summary, generate_at_queue)
    VALUES (?, ?, 'Eng', 'engineering', 'engineering', 'mid', '[]', '[]', '[]', '[]', 1, 1, 1, 0, 0)`).run(PROFILE, USER);
  const ins = db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, company, title, _hash, scraped_at, discovered_at, is_active, description, board_category)
    VALUES (?, 'q', 'Co', 'Analyst', ?, 1, 1, 1, 'Build reports in SQL.', ?)`);
  for (const [id, cat] of [["c1", "computing"], ["c2", "computing"], ["b1", "business"], ["s1", "sales"], ["h1", "held"], ["n1", null]]) ins.run(id, `h-${id}`, cat);
  return db;
}
function precompute(db, scopeFor) {
  const scored = [];
  const pc = createBoardFitPrecompute({
    db, log: { log() {}, warn() {}, error() {} }, scopeFor,
    basisFor: () => ({ runtimeBasis: { resumeText: "r" }, basisHash: "H1" }),
    scoreJob: (job) => { scored.push(job.job_id); return { score: 50, source: LOCAL_ATS_SOURCE }; },
    store: ({ userId, profileId, jobId, report, basisHash, jobHash }) => db.prepare(`INSERT INTO ats_only_reports
      (user_id, domain_profile_id, job_id, ats_report, ats_score, scorer_version, scored_at, basis_hash, job_hash) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`)
      .run(userId, profileId, jobId, JSON.stringify(report), report.score, LOCAL_ATS_SOURCE, basisHash, jobHash),
  });
  return { pc, scored };
}
const profile = (db) => db.prepare("SELECT * FROM domain_profiles WHERE id = ?").get(PROFILE);

test("A112: with a category, only that category and unclassified postings are scored — never another category, never held", async () => {
  const db = board();
  const { pc, scored } = precompute(db, () => "computing");
  const r = await pc.runFor({ userId: USER, profile: profile(db) });
  assert.equal(r.status, "scored");
  assert.deepEqual(scored.sort(), ["c1", "c2", "n1"]);
  assert.equal(r.active, 3, "the board the profile sees, not every active posting");
  assert.equal((await pc.runFor({ userId: USER, profile: profile(db) })).status, "nothing_to_do");
});

test("A112: no category (a profile that names none) — every category but held, as the board shows it", async () => {
  const db = board();
  const { pc, scored } = precompute(db, () => null);
  await pc.runFor({ userId: USER, profile: profile(db) });
  assert.deepEqual(scored.sort(), ["b1", "c1", "c2", "n1", "s1"]);
});

test("A112: server.js scopes the precompute with the board's own category rule", () => {
  const SERVER = fs.readFileSync("server.js", "utf8");
  const i = at(SERVER, "scopeFor: (_userId, profile) => {");
  const wiring = SERVER.slice(i, i + 300);
  assert.match(wiring, /profileCategory\(profile \|\| \{\}\)/);
});
