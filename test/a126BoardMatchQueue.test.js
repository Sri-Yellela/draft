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
  // D151 (45k): the held read is kept per user + statement (heldCountCache.js); a miss or a refresh reads and queues.
  assert.match(src, /enqueueBoardMatch\(req\.user\.id, heldProfile, held\.map\(r => r\.id\)\)/);
  assert.match(src, /await heldCounts\.get\(heldKey\(req\.user\.id, heldStatement, baseArgs\)/);
  // A239 (47g, moved on purpose): the counts are aged / dropped between the held count and the event
  assert.match(src, /heldCounts\.clearUser\(userId\); if \(q\.ids\.size\) facetsCache\.markStale\(userId\); else facetsCache\.clearUser\(userId\); emitToUser\(userId, \{ type: "board_scored"/);
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

// ── A126 (9) · today's deal is re-dealt when the board now holds a better match ───────────────────────────────────
import { todaysDeck } from "../services/dailyDraft.js";
const DATE = "2026-11-05";
const job = (id, score) => ({ id, jobId: id, title: `T ${id}`, company: "Synthetic Co", matchScore: score });
const boardOf = (jobs) => async () => ({ ok: true, jobs, nextCursor: null });

test("A126 (9) · a better match replaces the weakest undecided card; a decided card stays; no better match, no change", async () => {
  const db = boardDb(0);
  const scores = new Map([["a", 66], ["b", 60], ["c", 58]]);
  const scoreFor = (id) => scores.get(id) ?? null;
  const first = await todaysDeck(db, { userId: USER, profileId: PROFILE, date: DATE, size: 3, scoreFor,
    fetchBoardPage: boardOf([job("a", 66), job("b", 60), job("c", 58)]) });
  assert.equal(first.dealtNow, true);
  assert.deepEqual(first.cards.map(c => c.job.id), ["a", "b", "c"]);
  // the person saves "c" (a decision): it must stay in today's deck
  db.prepare("INSERT INTO user_jobs (user_id, job_id, domain_profile_id, starred) VALUES (?, 'c', ?, 1)").run(USER, PROFILE);
  // no better match on the board → nothing changes, even with refresh
  const same = await todaysDeck(db, { userId: USER, profileId: PROFILE, date: DATE, size: 3, scoreFor, refresh: true,
    fetchBoardPage: boardOf([job("a", 66), job("b", 60)]) });
  assert.equal(same.reshuffled, false);
  // a 90 % match lands on the board (the match queue scored it)
  scores.set("n", 90);
  const re = await todaysDeck(db, { userId: USER, profileId: PROFILE, date: DATE, size: 3, scoreFor, refresh: true,
    fetchBoardPage: boardOf([job("n", 90), job("a", 66), job("b", 60)]) });
  assert.equal(re.reshuffled, true);
  const ids = re.cards.map(c => c.job.id);
  assert.ok(ids.includes("n"), "the better match is dealt");
  assert.ok(ids.includes("c"), "the decided card stays");
  assert.ok(!ids.includes("b"), "the weakest undecided card makes room");
  assert.equal(ids.length, 3);
  // without refresh (the route's throttle), the deal is read as it is
  scores.set("m", 95);
  const held = await todaysDeck(db, { userId: USER, profileId: PROFILE, date: DATE, size: 3, scoreFor,
    fetchBoardPage: boardOf([job("m", 95), job("n", 90), job("a", 66)]) });
  assert.equal(held.reshuffled, false);
  assert.deepEqual(held.cards.map(c => c.job.id), ids);
});

test("A126 (9) · the deck keeps its place when a refresh answers the same cards, re-deals with the deal animation, refreshes live", () => {
  const src = read("client/src/panels/DeckView.jsx");
  assert.match(src, /if \(sameCards\) \{ setLoad\(\{ status: "ready", error: null \}\); return; \}/);
  assert.match(src, /setDealing\(!!deck\.dealtNow \|\| !!deck\.reshuffled \|\| reshuffleNextRef\.current\)/);
  assert.match(src, /board_scored: \(\) => queueDeckRefresh\(\),/);
  assert.match(src, /if \(deckBusyRef\.current\) \{ queueDeckRefresh\(\); return; \}/, "never while a card is open or a decision is in flight");
  const server = read("server.js");
  assert.match(server, /const DECK_REDEAL_EVERY_MS = 3 \* 60_000;/);
  // the re-deal is OFF the request path: the answer reads the deal as it stands; the re-deal runs after the response
  assert.match(server, /res\.on\("finish", \(\) => \{\s*todaysDeck\(db, \{[^}]*refresh: true \}\)/);
  assert.match(server, /emitToUser\(redealUser, \{ type: "deck_reshuffled"/);
  assert.match(src, /deck_reshuffled: \(\) => \{/);
});
