// ⛔ A139 (45h) · THE WHOLE-BOARD PASSES SCORE ONLY ACCOUNTS THAT MAY LOOK SOON. Production 11-07: after the trial's
// removal every former trial account joined the boot pass (≈ 26 s each the first time, ≈ 1 s after; a new account's
// first full score 160 s), most never to return. runAll({ idle }) leaves an idle account for later; it is scored the
// moment it loads its board (the "board" trigger is schedule(), never filtered). Synthetic accounts.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { createBoardFitPrecompute } from "../services/jobs/boardFitPrecompute.js";
import { LOCAL_ATS_SOURCE } from "../services/localAtsScorer.js";
import { at } from "../test-support/sourceAnchors.js";

function board() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  for (const [uid, pid] of [[7, 70], [8, 80]]) {
    db.prepare("INSERT INTO users (id, username, password_hash) VALUES (?, ?, 'x')").run(uid, `u${uid}`);
    db.prepare(`INSERT INTO domain_profiles (id, user_id, profile_name, role_family, domain, seniority, target_titles, selected_keywords,
        selected_verbs, selected_tools, is_active, created_at, updated_at, include_summary, generate_at_queue)
      VALUES (?, ?, 'Eng', 'engineering', 'engineering', 'mid', '[]', '[]', '[]', '[]', 1, 1, 1, 0, 0)`).run(pid, uid);
  }
  db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, company, title, _hash, scraped_at, discovered_at, is_active, description)
    VALUES ('j1', 'q', 'Co', 'Analyst', 'h1', 1, 1, 1, 'Build reports in SQL.')`).run();
  return db;
}
function precompute(db) {
  const scoredFor = [];
  const pc = createBoardFitPrecompute({
    db, log: { log() {}, warn() {}, error() {} },
    basisFor: () => ({ runtimeBasis: { resumeText: "r" }, basisHash: "H1" }),
    scoreJob: () => ({ score: 50, source: LOCAL_ATS_SOURCE }),
    store: ({ userId, profileId, jobId, report, basisHash, jobHash }) => { scoredFor.push(userId); db.prepare(`INSERT INTO ats_only_reports
      (user_id, domain_profile_id, job_id, ats_report, ats_score, scorer_version, scored_at, basis_hash, job_hash) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`)
      .run(userId, profileId, jobId, JSON.stringify(report), report.score, LOCAL_ATS_SOURCE, basisHash, jobHash); },
  });
  return { pc, scoredFor };
}

test("a139BoardFitIdleAccounts: an idle account is left out of the whole-board pass and counted", async () => {
  const db = board();
  const { pc, scoredFor } = precompute(db);
  const { summary } = await pc.runAll({ reason: "boot", idle: (uid) => uid === 8 });
  assert.equal(summary.profiles, 1);
  assert.equal(summary.idleSkipped, 1);
  await new Promise(r => setTimeout(r, 50));
  assert.ok(scoredFor.every(u => u === 7), "only the active account was scored");
});

test("a139BoardFitIdleAccounts: one named account (an admin's precompute) is never filtered as idle", async () => {
  const db = board();
  const { pc } = precompute(db);
  const { summary } = await pc.runAll({ reason: "admin", userId: 8, idle: () => true });
  assert.equal(summary.profiles, 1);
  assert.equal(summary.idleSkipped, 0);
});

test("a139BoardFitIdleAccounts: server.js — idle is 30 days without a board load or a sign-up, and never an Apply for me / Ask me first account", () => {
  const SERVER = fs.readFileSync("server.js", "utf8").replace(/\r\n/g, "\n");
  const fn = SERVER.slice(at(SERVER, "function boardFitIdle(userId) {"), at(SERVER, "function scheduleBoardFitForAll(reason) {"));
  assert.match(fn, /\(u\.board_seen_at \|\| 0\) >= since \|\| \(u\.created_at \|\| 0\) >= since/);
  assert.match(fn, /u\.send_mode === "auto" \|\| \/"picks":true\/\.test/);
  assert.match(SERVER, /boardFit\(\)\.runAll\(\{ reason, idle: boardFitIdle \}\)/);
  const board = SERVER.slice(at(SERVER, "function scheduleBoardFit(userId, reason, profile = null) {"), at(SERVER, "// ⛔ A139 (45h): the whole-board passes"));
  assert.doesNotMatch(board, /boardFitIdle\(/, "a board load always scores — that is how an idle account catches up");
});
