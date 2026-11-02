// Owner 11-02: "since this is a trial only with samples, lock down what picks we are showing and what jobs and everything
// … postings locked down to specific ones for each sample type a and b. this way theres no precompute at all."
// The site had frozen behind ~20 trial profiles' board-fit passes (17,278 postings each). Synthetic postings only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { clearPicksCache } from "../services/trialPicks.js";
import { readSampleDeck, sampleDeck, trialDeckResponse, trialBoardResponse, refreezeSampleDeck } from "../services/trialDeck.js";
import { createBoardFitPrecompute } from "../services/jobs/boardFitPrecompute.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

function board(n, from = 0) {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  add(db, n, from);
  return db;
}
function add(db, n, from = 0) {
  const ins = db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, _hash, title, company, url, source, is_active, discovered_at,
    description, board_category, bucket_seniority) VALUES (?, 't', ?, 'Software Engineer', ?, ?, 'greenhouse', 1, unixepoch() - ?, ?, 'computing', 'mid')`);
  for (let i = from; i < from + n; i++) {
    const id = `swe-${i}`;
    ins.run(id, `h-${id}`, `Co${i}`, `https://example.com/${id}`, i, `Build services in Java, Go and TypeScript; PostgreSQL, Redis, Docker, AWS. Team ${i}.`);
  }
}

test("trialFrozenDeck: a sample's 10 cards are chosen once, scored, frozen — and stay put when the board changes", async () => {
  clearPicksCache();
  const db = board(14);
  assert.equal(readSampleDeck(db, "A"), null, "nothing frozen before first use");
  const first = await sampleDeck(db, "A");
  assert.equal(first.length, 10);
  for (const c of first) {
    assert.ok(Number.isFinite(c.score) && c.band && c.job?.id === c.jobId, "each card carries its score, band and posting");
    assert.ok(c.report && Array.isArray(c.report.skillsMatched), "and the full report the deck's panel shows");
  }
  // the board moves (new postings, an old one retired) — the frozen cards do not
  add(db, 30, 100);
  db.prepare("UPDATE scraped_jobs SET is_active = 0 WHERE job_id = ?").run(first[0].jobId);
  clearPicksCache();
  assert.deepEqual((await sampleDeck(db, "A")).map(c => c.jobId), first.map(c => c.jobId));
  // an admin refreeze is the only way the set changes
  const again = await refreezeSampleDeck(db, "A");
  assert.equal(again.length, 10);
});

test("trialFrozenDeck: fewer than 10 picks is never frozen (the next request tries again)", async () => {
  clearPicksCache();
  const db = board(4);
  assert.equal((await sampleDeck(db, "A")).length, 4);
  assert.equal(readSampleDeck(db, "A"), null);
});

test("trialFrozenDeck: the deck and the board answer with the frozen cards, each tester's own decisions on them", async () => {
  clearPicksCache();
  const db = board(12);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (7, 't7', 'x')").run();
  const frozen = await sampleDeck(db, "A");
  db.prepare("INSERT INTO user_jobs (user_id, job_id, disliked) VALUES (7, ?, 1)").run(frozen[2].jobId);
  const deck = await trialDeckResponse(db, { userId: 7, profileId: 1, sampleId: "A", date: "2026-11-02" });
  assert.equal(deck.size, 10);
  assert.deepEqual(deck.cards.map(c => c.job.id), frozen.map(c => c.jobId));
  assert.equal(deck.cards[2].decision, "passed");
  assert.ok(deck.cards.every(c => Number.isFinite(c.score)), "the tour's match step shows each card's score");
  const page = await trialBoardResponse(db, { sampleId: "A" });
  assert.deepEqual(page.jobs.map(j => j.id), frozen.map(c => c.jobId));
  assert.equal(page.nextCursor, null);
});

test("trialNoPrecompute: skipUser keeps an account out of schedule and runAll; server.js skips every trial account", async () => {
  const db = board(1);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1, 'a', 'x'), (2, 'b', 'x')").run();
  db.prepare(`INSERT INTO domain_profiles (id, user_id, profile_name, role_family, domain, is_active) VALUES (1, 1, 'p', 'r', 'd', 1), (2, 2, 'p', 'r', 'd', 1)`).run();
  const scoredFor = [];
  const bf = createBoardFitPrecompute({ db, basisFor: () => null, scoreJob: () => ({}), store: () => {},
    skipUser: (uid) => uid === 2, log: { log() {}, info() {}, warn() {}, error() {} } });
  const s = await bf.schedule({ userId: 2, profile: { id: 2 }, reason: "t" });
  assert.equal(s.status, "skipped");
  const all = await bf.runAll({ dryRun: true });
  scoredFor.push(...all.results.map(r => r.userId));
  assert.ok(!scoredFor.includes(2) && all.summary.profiles === 1, "the skipped account is not in the all-users pass");
  const src = read("server.js");
  assert.match(src, /skipUser: \(userId\) => isTrialAccount\(db, userId\),/);
  assert.match(src, /if \(isTrialAccount\(db, userId\)\) return;   \/\/ owner 11-02/);
  assert.match(src, /if \(trialSample\) return res\.json\(await trialDeckResponse\(/);
  assert.match(src, /if \(trialSample\) return boardReply\(200, await trialBoardResponse\(db, \{ sampleId: trialSample \}\)\);/);
});
