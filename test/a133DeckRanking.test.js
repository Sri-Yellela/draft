// ⛔ A133 (owner 11-06) — the deck's content was frozen: the same cards for days, 65 % cards while 90 % postings existed.
// Measured on the 18k copy (45a): the deal took the top of the board's CURATED order (title / role / skills rank keys
// ahead of the ATS fit) and an undecided card is eligible again the next day, so 11-05 and 11-07 dealt the same ten.
// The fix: candidates by ATS (sort=atsScore through the same board function), ranked by shared/dealRanking.js —
// ATS + best bets + role similarity, earlier days' undecided cards rotated down — in the first deal and the re-deal.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { at } from "../test-support/sourceAnchors.js";
import { todaysDeck } from "../services/dailyDraft.js";
import { dealScoreOf, rankDeal, rotationOf, roleSimilarityRaw, terms, responsibilitiesOf, DEAL_WEIGHTS, ROTATION_FLOOR } from "../shared/dealRanking.js";

const mk = () => {
  const d = new Database(":memory:");
  d.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY);
          CREATE TABLE apply_run_jobs (id INTEGER PRIMARY KEY, user_id INTEGER, job_id TEXT, status TEXT);
          CREATE TABLE user_jobs (user_id INTEGER, job_id TEXT, starred INTEGER DEFAULT 0, disliked INTEGER DEFAULT 0);
          INSERT INTO users (id) VALUES (1);`);
  d.exec(MIGRATIONS.find(m => m.id === "111_daily_drafts").sql);
  return d;
};
const job = (id, score, extra = {}) => ({ id, title: `Engineer ${id}`, company: "Acme", matchScore: score, ...extra });
const boardOf = (jobs) => async () => ({ ok: true, jobs, nextCursor: null });
const scoresOf = (jobs) => { const m = new Map(jobs.map(j => [j.id, j.matchScore])); return (id) => m.get(id) ?? null; };

test("a133DeckNotFrozenForUsers: the deal reads the board by ATS, the trial's frozen deck stays behind its gate, and the deck differs day to day", async () => {
  const src = fs.readFileSync("server.js", "utf8");
  const route = src.slice(at(src, 'app.get("/api/draft/today"'), at(src, "// GET /api/company-logo/:key"));
  assert.match(route, /query: \{ pageSize: "50", sort: "atsScore", \.\.\.\(cursor \? \{ cursor \} : \{\}\) \}/, "candidates are the board's top BY ATS");
  assert.match(route, /const trialSample = trialSampleOf\(db, req\.user\.id\);\s*\n\s*if \(trialSample\) return res\.json\(await trialDeckResponse/,
    "the frozen sample deck is served only when the account IS a sample trial");
  const trial = fs.readFileSync("services/trialDeck.js", "utf8");
  assert.match(trial, /export function trialSampleOf\(db, userId\) \{\s*\n\s*if \(!isTrial\(db, userId\)\) return null;/);

  // 20 equally good postings, deck of 10: yesterday's undecided ten rotate down, so today's deal is different.
  const jobs = Array.from({ length: 20 }, (_, i) => job(`j${i}`, 70));
  const d = mk();
  const day1 = await todaysDeck(d, { userId: 1, profileId: 1, date: "2026-11-06", fetchBoardPage: boardOf(jobs), scoreFor: scoresOf(jobs) });
  const day2 = await todaysDeck(d, { userId: 1, profileId: 1, date: "2026-11-07", fetchBoardPage: boardOf(jobs), scoreFor: scoresOf(jobs) });
  const a = day1.cards.map(c => c.job.id), b = day2.cards.map(c => c.job.id);
  assert.equal(a.length, 10); assert.equal(b.length, 10);
  assert.equal(b.filter(id => a.includes(id)).length, 0, "with equal alternatives, none of yesterday's undecided cards is re-dealt");
  // A clearly better card stays even though it was shown yesterday.
  const jobs2 = [job("star", 95), ...Array.from({ length: 20 }, (_, i) => job(`k${i}`, 60))];
  const d2 = mk();
  await todaysDeck(d2, { userId: 1, profileId: 1, date: "2026-11-06", fetchBoardPage: boardOf(jobs2), scoreFor: scoresOf(jobs2) });
  const next = await todaysDeck(d2, { userId: 1, profileId: 1, date: "2026-11-07", fetchBoardPage: boardOf(jobs2), scoreFor: scoresOf(jobs2) });
  assert.ok(next.cards.some(c => c.job.id === "star"), "a 95 shown yesterday still beats fresh 60s");
  d.close(); d2.close();
});

test("a133RedealLiftsBetterPick: a 90 % posting that lands after the deal replaces the weakest undecided card; decided cards stay", async () => {
  const d = mk();
  const first = Array.from({ length: 12 }, (_, i) => job(`m${i}`, 65));
  const date = "2026-11-06";
  await todaysDeck(d, { userId: 1, profileId: 1, date, fetchBoardPage: boardOf(first), scoreFor: scoresOf(first) });
  d.prepare("INSERT INTO user_jobs (user_id, job_id, starred) VALUES (1, 'm0', 1)").run();   // saved = decided
  // The board now holds a 90 — and it sits BELOW the 65s in the page order (the curated order did exactly this).
  const later = [...first, job("ninety", 90)];
  const deck = await todaysDeck(d, { userId: 1, profileId: 1, date, fetchBoardPage: boardOf(later), scoreFor: scoresOf(later), refresh: true });
  assert.equal(deck.reshuffled, true);
  const ids = deck.cards.map(c => c.job.id);
  assert.ok(ids.includes("ninety"), "the 90 reaches the deck");
  assert.ok(ids.includes("m0"), "the decided card is the day's record and stays");
  assert.equal(ids.length, 10);
  // Nothing better → no re-deal.
  const again = await todaysDeck(d, { userId: 1, profileId: 1, date, fetchBoardPage: boardOf(later), scoreFor: scoresOf(later), refresh: true });
  assert.equal(again.reshuffled, false);
  d.close();
});

test("a133DealRankingBlend: ATS 50 + best bets 30 + role similarity 20 over the known signals, rotation with a floor", () => {
  assert.deepEqual({ ...DEAL_WEIGHTS }, { ats: 50, bet: 30, similarity: 20 });
  assert.equal(dealScoreOf({ ats: 90, bet: 60, similarity: 1 }), (45 + 18 + 20) / 100);
  assert.equal(dealScoreOf({ ats: 90 }), 0.9, "absent signals leave both sides of the sum");
  assert.equal(dealScoreOf({}), null);
  assert.equal(rotationOf(1), 0.88);
  assert.equal(rotationOf(50), ROTATION_FLOOR);
  // The board's order put the 65 first; the blend puts the 90 first.
  const pool = [{ job: { id: "a" } }, { job: { id: "b" } }];
  const s = { a: 65, b: 90 };
  assert.deepEqual(rankDeal(pool, { scoreFor: (id) => s[id] }).map(c => c.job.id), ["b", "a"]);
  // Best bets breaks an ATS tie.
  const bets = { a: 30, b: 80 };
  assert.deepEqual(rankDeal(pool, { scoreFor: () => 70, betFor: (j) => ({ score: bets[j.id] }) }).map(c => c.job.id), ["b", "a"]);
  // Role similarity: a backend résumé ranks the backend posting above the design one at equal ATS.
  const resume = "Backend engineer. Built distributed APIs in Go and Postgres; owned payment services, Kafka pipelines, on-call.";
  const backend = { id: "be", title: "Backend Engineer, Payments", description: "Responsibilities:\nBuild distributed APIs and payment services in Go with Postgres and Kafka.\nRequirements:\n5 years" };
  const design = { id: "ds", title: "Product Designer", description: "What you'll do:\nDesign user flows, prototypes in Figma, and run usability research with customers.\nQualifications:\nportfolio" };
  assert.ok(roleSimilarityRaw(terms(resume), backend) > roleSimilarityRaw(terms(resume), design));
  assert.match(responsibilitiesOf(backend.description), /distributed APIs/);
  assert.doesNotMatch(responsibilitiesOf(backend.description), /5 years/, "the section stops at the next heading");
  const ranked = rankDeal([{ job: design }, { job: backend }], { scoreFor: () => 70, resumeText: resume });
  assert.deepEqual(ranked.map(c => c.job.id), ["be", "ds"]);
  assert.equal(ranked[0].signals.similarity, 1);
  // Yesterday's card gives way to an equal fresh one.
  assert.deepEqual(rankDeal(pool, { scoreFor: () => 70, shownBefore: new Map([["a", 1]]) }).map(c => c.job.id), ["b", "a"]);
});
