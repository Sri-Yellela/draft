import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { todaysDeck, selectDeal, validDraftDate, deckSnapshot, deckReport, DECK_SIZE } from "../services/dailyDraft.js";
import { ATS_BAND, ATS_BAND_CUTPOINTS } from "../shared/atsBands.js";

const STRONG = ATS_BAND_CUTPOINTS.strong + 5, MODERATE = ATS_BAND_CUTPOINTS.moderate + 2, WEAK = 3;

function db() {
  const d = new Database(":memory:");
  d.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY);
          CREATE TABLE apply_run_jobs (id INTEGER PRIMARY KEY, user_id INTEGER, job_id TEXT, status TEXT);
          CREATE TABLE user_jobs (user_id INTEGER, job_id TEXT, starred INTEGER DEFAULT 0, disliked INTEGER DEFAULT 0);
          INSERT INTO users (id) VALUES (1);`);
  // The real DDL, from the migration list — the test cannot drift from the schema.
  d.exec(MIGRATIONS.find(m => m.id === "111_daily_drafts").sql);
  return d;
}
const job = (id, score, extra = {}) => ({ id, title: "Role " + id, company: "Co", matchScore: score, ...extra });
// A board of pages, in the board's own order. Each call returns the next page.
function board(pages) {
  const calls = [];
  const fetchBoardPage = async (cursor) => {
    calls.push(cursor);
    const i = cursor == null ? 0 : Number(cursor);
    return { ok: true, jobs: pages[i] || [], nextCursor: i + 1 < pages.length ? String(i + 1) : null };
  };
  return { fetchBoardPage, calls };
}
const TODAY = new Date().toISOString().slice(0, 10);

test("the deal keeps the board's order and deals only Strong and Moderate", () => {
  const picked = selectDeal([job("a", WEAK), job("b", STRONG), job("c", null), job("d", MODERATE), job("e", STRONG)]);
  assert.deepEqual(picked.map(c => c.job.id), ["b", "d", "e"], "position is the fit signal — order must survive");
  assert.deepEqual(picked.map(c => c.band), [ATS_BAND.STRONG, ATS_BAND.MODERATE, ATS_BAND.STRONG]);
});

test("a card carries its band and NEVER the number (G5)", () => {
  const [c] = selectDeal([job("a", STRONG, { atsScore: 60, baseAtsScore: 55 })]);
  assert.equal(c.band, ATS_BAND.STRONG);
  assert.equal(c.job.matchScore, null, "the score leaked onto a card");
  for (const k of ["atsScore", "baseAtsScore"]) assert.equal(k in c.job, false, `${k} leaked onto a card`);
  assert.equal(deckSnapshot(job("b", 50)).title, "Role b", "the rest of the job shape must survive");
});

test("the deck is dealt once and frozen for the day — a re-ranked board does not reshuffle it", async () => {
  const d = db();
  const first = board([[job("a", STRONG), job("b", STRONG), job("c", MODERATE)]]);
  const deck1 = await todaysDeck(d, { userId: 1, profileId: 7, date: TODAY, fetchBoardPage: first.fetchBoardPage });
  assert.equal(deck1.dealtNow, true);
  // The board changes under the user: new jobs, a new order.
  const second = board([[job("z", STRONG), job("c", STRONG), job("a", STRONG)]]);
  const deck2 = await todaysDeck(d, { userId: 1, profileId: 7, date: TODAY, fetchBoardPage: second.fetchBoardPage });
  assert.equal(deck2.dealtNow, false);
  assert.equal(second.calls.length, 0, "a dealt day must not read the board again");
  assert.deepEqual(deck2.cards.map(c => c.job.id), ["a", "b", "c"]);
  assert.deepEqual(deck2.cards.map(c => c.position), [0, 1, 2]);
});

test("never padded: a thin day deals fewer, an empty day deals none and says so", async () => {
  const d = db();
  const thin = await todaysDeck(d, { userId: 1, profileId: 7, date: TODAY,
    fetchBoardPage: board([[job("a", STRONG), job("b", WEAK), job("c", null), job("d", WEAK)]]).fetchBoardPage });
  assert.equal(thin.size, 1);
  assert.equal(thin.thin, true);
  assert.equal(thin.reason, "thin");
  const empty = await todaysDeck(d, { userId: 1, profileId: 8, date: TODAY,
    fetchBoardPage: board([[job("x", WEAK), job("y", null)]]).fetchBoardPage });
  assert.equal(empty.size, 0);
  assert.equal(empty.reason, "empty");
  assert.equal(empty.thin, false);
});

test("the deal reads further down the board to fill the deck, and stops at the size", async () => {
  const d = db();
  const pages = [Array.from({ length: 50 }, (_, i) => job("w" + i, WEAK)),
                 Array.from({ length: 50 }, (_, i) => job("s" + i, STRONG))];
  const b = board(pages);
  const deck = await todaysDeck(d, { userId: 1, profileId: 7, date: TODAY, fetchBoardPage: b.fetchBoardPage });
  assert.equal(deck.size, DECK_SIZE);
  assert.deepEqual(deck.cards.map(c => c.job.id), Array.from({ length: DECK_SIZE }, (_, i) => "s" + i));
  assert.equal(b.calls.length, 2);
});

test("a decided job never re-deals; an undecided one — and an undone draft — is eligible again", async () => {
  const d = db();
  d.exec(`INSERT INTO apply_run_jobs (user_id, job_id, status) VALUES (1, 'drafted', 'held_review'), (1, 'undone', 'cancelled');
          INSERT INTO user_jobs (user_id, job_id, disliked) VALUES (1, 'passed', 1);
          INSERT INTO user_jobs (user_id, job_id, starred) VALUES (1, 'saved', 1);`);
  const deck = await todaysDeck(d, { userId: 1, profileId: 7, date: TODAY, fetchBoardPage: board([[
    job("drafted", STRONG), job("passed", STRONG), job("saved", STRONG), job("undone", STRONG), job("fresh", STRONG)]]).fetchBoardPage });
  assert.deepEqual(deck.cards.map(c => c.job.id), ["undone", "fresh"]);
});

test("a card's decision is read LIVE from where decisions live", async () => {
  const d = db();
  const deck = await todaysDeck(d, { userId: 1, profileId: 7, date: TODAY,
    fetchBoardPage: board([[job("a", STRONG), job("b", STRONG), job("c", STRONG), job("e", STRONG)]]).fetchBoardPage });
  assert.deepEqual(deck.cards.map(c => c.decision), [null, null, null, null]);
  d.exec(`INSERT INTO apply_run_jobs (user_id, job_id, status) VALUES (1, 'a', 'held_review'), (1, 'e', 'cancelled');
          INSERT INTO user_jobs (user_id, job_id, disliked) VALUES (1, 'b', 1);
          INSERT INTO user_jobs (user_id, job_id, starred) VALUES (1, 'c', 1);`);
  const again = await todaysDeck(d, { userId: 1, profileId: 7, date: TODAY, fetchBoardPage: board([]).fetchBoardPage });
  assert.deepEqual(again.cards.map(c => c.decision), ["drafted", "passed", "saved", null],
    "an undone (cancelled) draft reads as undecided");
});

test("a concurrent first deal cannot produce two decks", async () => {
  const d = db();
  const mk = () => board([[job("a", STRONG), job("b", MODERATE)]]).fetchBoardPage;
  const [x, y] = await Promise.all([
    todaysDeck(d, { userId: 1, profileId: 7, date: TODAY, fetchBoardPage: mk() }),
    todaysDeck(d, { userId: 1, profileId: 7, date: TODAY, fetchBoardPage: mk() }),
  ]);
  assert.deepEqual(x.cards.map(c => c.job.id), y.cards.map(c => c.job.id));
  assert.equal(d.prepare("SELECT COUNT(*) n FROM daily_drafts").get().n, 2);
});

test("a board that cannot be read is an error, never an empty deck", async () => {
  const d = db();
  await assert.rejects(todaysDeck(d, { userId: 1, profileId: 7, date: TODAY,
    fetchBoardPage: async () => ({ ok: false, error: "boom" }) }), /boom/);
  assert.equal(d.prepare("SELECT COUNT(*) n FROM daily_drafts").get().n, 0);
});

test("the date is the client's local day, within one day of the server's — and a real date", () => {
  const now = new Date("2026-09-30T12:00:00Z");
  for (const ok of ["2026-09-29", "2026-09-30", "2026-10-01"]) assert.equal(validDraftDate(ok, now), true, ok);
  for (const bad of ["2026-09-27", "2026-10-03", "2026-02-30", "30-09-2026", "", null, "2026-9-30"]) assert.equal(validDraftDate(bad, now), false, String(bad));
});

test("each card carries its evidence, frozen from the same report as its band", async () => {
  const d = db();
  const reports = { a: { tier1_matched: ["Go", "SQL", "AWS", "Docker", "K8s", "gRPC", "Redis"], tier1_missing: ["Kafka"] } };
  const deck = await todaysDeck(d, { userId: 1, profileId: 7, date: TODAY, reportFor: (id) => reports[id] || null,
    fetchBoardPage: board([[job("a", STRONG), job("b", STRONG)]]).fetchBoardPage });
  assert.deepEqual(deck.cards[0].why, { matched: ["Go", "SQL", "AWS", "Docker", "K8s", "gRPC"], missing: ["Kafka"], matchedTotal: 7, missingTotal: 1 });
  assert.deepEqual(deck.cards[1].why, { matched: [], missing: [], matchedTotal: 0, missingTotal: 0 }, "no report is empty evidence, not an error");
  assert.equal(deck.cards[1].report, null, "no report is no report — not one rebuilt from the chips");
  reports.a.tier1_matched = ["changed"];
  const again = await todaysDeck(d, { userId: 1, profileId: 7, date: TODAY, reportFor: (id) => reports[id],
    fetchBoardPage: board([]).fetchBoardPage });
  assert.equal(again.cards[0].why.matched[0], "Go", "the evidence is frozen with the deal");
});

// ── A40 — the FULL report behind the card, frozen with it, and never a number ─────────────────
test("⭐ the card carries the FULL report — every section the board shows — frozen with the deal", async () => {
  const d = db();
  const stored = {
    source: "local_ats_v4", score: 58, scorable: true, decline_reasons: [],
    weighting: { applied: true, terms: 412 },
    seniority_cap: { applied: true, cap: 40, raw_score: 61, reason: "A senior posting for an earlier-career profile." },
    tier1_matched: ["Go", "SQL"], tier1_missing: ["Kafka"],
    competencies_matched: ["mentoring"], competencies_missing: ["ownership"],
    action_verbs_matched: ["Built"], action_verbs_missing: ["Scaled"], action_verbs_generic: ["Managed"],
    claimed_matches: ["SQL"], experience: { requiredYears: 5, candidateYears: 6, fit: true, summary: "Meets 5+ years." },
    hard_constraint_misses: ["Security clearance"], resume_depth: { reason: "short_resume", headline: "Thin résumé", detail: "Add detail." },
  };
  const deck = await todaysDeck(d, { userId: 1, profileId: 7, date: TODAY, reportFor: () => stored,
    fetchBoardPage: board([[job("a", STRONG)]]).fetchBoardPage });
  assert.deepEqual(deck.cards[0].report, {
    scorable: true, declineReasons: [],
    skillsMatched: ["Go", "SQL"], skillsMissing: ["Kafka"],
    competenciesMatched: ["mentoring"], competenciesMissing: ["ownership"],
    verbsMatched: ["Built"], verbsMissing: ["Scaled"], verbsGeneric: ["Managed"], claimedMatches: ["SQL"],
    experience: "Meets 5+ years.", experienceFit: true, experienceState: "met", hardConstraintMisses: ["Security clearance"],
    seniorityNote: "A senior posting for an earlier-career profile.", depthHeadline: "Thin résumé", depthDetail: "Add detail.",
  });
});

test("⛔ NO NUMBER reaches the card's report — a whitelist, so a numeric field added later cannot leak", () => {
  const r = deckReport({ score: 58, best_possible_score: 72, seniority_cap: { applied: true, cap: 40, raw_score: 61, reason: "x" },
                         weighting: { applied: true, terms: 9 }, newNumericField: 99, tier1_matched: ["Go"] });
  const walk = (v) => (typeof v === "number" ? [v] : v && typeof v === "object" ? Object.values(v).flatMap(walk) : []);
  assert.deepEqual(walk(r), [], "a number in the frozen report");
  assert.equal(JSON.stringify(r).includes("score"), false);
});

test("⛔ a DECLINED report stays a decline — 'cannot judge', never a low score", () => {
  const r = deckReport({ score: null, scorable: false, decline_reasons: ["Too few scorable terms in the posting."] });
  assert.equal(r.scorable, false);
  assert.deepEqual(r.declineReasons, ["Too few scorable terms in the posting."]);
  assert.equal(deckReport({ score: null, decline_reasons: ["x"] }).scorable, false, "decline reasons alone mean declined");
});

test("a card frozen BEFORE A40 reads back in today's shape: totals filled, report null", async () => {
  const d = db();
  await todaysDeck(d, { userId: 1, profileId: 7, date: TODAY, fetchBoardPage: board([[job("a", STRONG)]]).fetchBoardPage });
  d.prepare("UPDATE daily_drafts SET card_json = ?").run(JSON.stringify({ job: { id: "a" }, why: { matched: ["Go"], missing: ["Kafka", "Rust"], matchedTotal: 3 } }));
  const deck = await todaysDeck(d, { userId: 1, profileId: 7, date: TODAY, fetchBoardPage: board([]).fetchBoardPage });
  assert.deepEqual(deck.cards[0].why, { matched: ["Go"], missing: ["Kafka", "Rust"], matchedTotal: 3, missingTotal: 2 });
  assert.equal(deck.cards[0].report, null);
});
