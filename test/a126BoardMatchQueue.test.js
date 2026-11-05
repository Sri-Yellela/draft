// A126 (7)(8) (hotfix 11-05) · a posting reaches the board after the engines, not before.
//   · boardFitPrecompute.scoreIds scores NAMED postings (outside the profile's precompute scope) with the same scorer
//     and store, and skips what is already scored against the current basis;
//   · server.js's board gates discovery views on a current-basis score, counts what it held back (`beingMatched`) and
//     queues it (enqueueBoardMatch), and the open board refreshes on `board_scored`;
//   · the board's view cache and last-shown view live at module scope, so a return to Home renders at once.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { createBoardFitPrecompute } from "../services/jobs/boardFitPrecompute.js";

const USER = 7, PROFILE = 70;
const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

function boardDb(n) {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (?, 'u7', 'x')").run(USER);
  db.prepare(`INSERT INTO domain_profiles
      (id, user_id, profile_name, role_family, domain, seniority, target_titles, selected_keywords,
       selected_verbs, selected_tools, is_active, created_at, updated_at, include_summary, generate_at_queue)
    VALUES (?, ?, 'Eng', 'engineering', 'engineering', 'mid', '[]', '[]', '[]', '[]', 1, 1, 1, 0, 0)`).run(PROFILE, USER);
  const ins = db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, company, title, _hash, scraped_at, discovered_at, is_active, description)
                          VALUES (?, 'q', 'Synthetic Co', 'Engineer', ?, 1, 1, 1, 'Build services in Go.')`);
  for (let i = 0; i < n; i++) ins.run(`j${String(i).padStart(3, "0")}`, `h${i}`);
  return db;
}
const store = (db) => ({ userId, profileId, jobId, report, basisHash, jobHash }) => db.prepare(`
  INSERT INTO ats_only_reports (user_id, domain_profile_id, job_id, ats_report, ats_score, scorer_version, scored_at, basis_hash, job_hash)
  VALUES (?, ?, ?, ?, ?, 'v', 1, ?, ?)`).run(userId, profileId, jobId, JSON.stringify(report), report.score, basisHash, jobHash);
const quiet = { log() {}, warn() {}, error() {} };

test("A126 (7) · scoreIds scores the named postings once, against the current basis, through the same store", async () => {
  const db = boardDb(12);
  let calls = 0;
  const bf = createBoardFitPrecompute({
    db, log: quiet, store: store(db), batchSize: 5,
    basisFor: () => ({ runtimeBasis: { resumeText: "r" }, basisHash: "B1" }),
    scoreJob: () => { calls++; return { score: 61 }; },
  });
  const profile = db.prepare("SELECT * FROM domain_profiles WHERE id = ?").get(PROFILE);
  const ids = ["j001", "j002", "j003", "j004", "j005", "j006", "j007"];
  const r1 = await bf.scoreIds({ userId: USER, profile, jobIds: ids });
  assert.equal(r1.status, "scored");
  assert.equal(r1.scored, 7);
  assert.equal(calls, 7);
  const rows = db.prepare("SELECT job_id, basis_hash, ats_score FROM ats_only_reports WHERE user_id = ? ORDER BY job_id").all(USER);
  assert.deepEqual(rows.map(r => r.job_id), ids);
  assert.ok(rows.every(r => r.basis_hash === "B1" && r.ats_score === 61));
  // asked again with two new ids: only the two new ones are scored
  const r2 = await bf.scoreIds({ userId: USER, profile, jobIds: [...ids, "j008", "j009"] });
  assert.equal(r2.scored, 2);
  assert.equal(calls, 9, "already-scored postings are not scored again");
  // a retired posting is skipped
  db.prepare("UPDATE scraped_jobs SET is_active = 0 WHERE job_id = 'j010'").run();
  const r3 = await bf.scoreIds({ userId: USER, profile, jobIds: ["j010"] });
  assert.equal(r3.scored, 0);
});

test("A126 (7) · scoreIds never scores for a profile with no basis, nor a skipped (trial) account", async () => {
  const db = boardDb(3);
  const profile = db.prepare("SELECT * FROM domain_profiles WHERE id = ?").get(PROFILE);
  const noBasis = createBoardFitPrecompute({ db, log: quiet, store: store(db), basisFor: () => null, scoreJob: () => ({ score: 1 }) });
  assert.equal((await noBasis.scoreIds({ userId: USER, profile, jobIds: ["j000"] })).status, "no_basis");
  const trial = createBoardFitPrecompute({ db, log: quiet, store: store(db), skipUser: () => true,
    basisFor: () => ({ runtimeBasis: {}, basisHash: "B1" }), scoreJob: () => ({ score: 1 }) });
  assert.equal((await trial.scoreIds({ userId: USER, profile, jobIds: ["j000"] })).status, "skipped");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM ats_only_reports").get().n, 0);
});

test("A126 (7) · server.js: discovery views are gated on a current-basis score; the held-back postings are counted and queued", () => {
  const src = read("server.js");
  assert.match(src, /DRAFT_BOARD_SCORED_ONLY/);
  assert.match(src, /&& !savedTab && !importedTab && !pendingTab && req\.query\.curate !== 'off';/,
    "★ / + / /d and curate=off are the person's own lists — never gated");
  assert.match(src, /AND aor\.id IS NOT NULL AND aor\.basis_hash = '\$\{gateBasis\}'/);
  assert.match(src, /\$\{gate \? scoreGateSql : ''\}/, "the gate is one predicate of the board's own WHERE — the list, its count and facets agree");
  assert.match(src, /enqueueBoardMatch\(req\.user\.id, sessionActiveProfile, held\.map\(r => r\.id\)\)/);
  assert.match(src, /\.\.\.\(beingMatched \? \{ beingMatched \} : \{\}\)/);
  assert.match(src, /emitToUser\(userId, \{ type: "board_scored"/);
});

test("A126 (7)(8) · the board refreshes on board_scored, says what is being matched, and keeps its views across navigation", () => {
  const src = read("client/src/panels/JobsPanel.jsx");
  assert.match(src, /board_scored: \(\) => \{/);
  assert.match(src, /data-being-matched=""/);
  assert.match(src, /^const BOARD_VIEW_CACHE = new Map\(\);$/m, "the view cache is module-scoped, not a per-mount ref");
  assert.match(src, /const viewCacheRef = useRef\(BOARD_VIEW_CACHE\);/);
  assert.match(src, /useState\(\(\) => BOARD_LAST\?\.jobs \|\| \[\]\)/, "a remount starts from the last-shown view");
  assert.match(src, /String\(BOARD_LAST\.profileKey\) === String\(profileKey\)/, "never another profile's cards");
});
