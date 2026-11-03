import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { at } from "../test-support/sourceAnchors.js";
import {
  bestBetOf, bestBetLine, shortlistSize, BEST_BET_WEIGHTS, BEST_BET_BANDS, SHORTLIST_DEFAULT, CALIBRATED_MIN,
} from "../shared/bestBets.js";
import {
  bestBetsFor, bestBetSignalsFor, refitBestBets, calibratedChance, outcomeRows, SIGNAL_KEYS,
} from "../services/bestBets.js";
import { recordSubmission } from "../services/applicationRecords.js";
import { recordJobHistory } from "../services/jobs/jobHistory.js";
import { choosePicks } from "../services/picks.js";
import { AUTO_DEFAULTS, normaliseAutoSettings } from "../shared/autoSettings.js";

// ⭐ D136 (owner 11-02) · BEST BETS — a precision shortlist, ranked by signals, with reasons. Synthetic people and postings.

const DAY = 86400;
const NOW = Math.floor(Date.UTC(2026, 10, 2, 12) / 1000);
const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const TEXT = [
  "We are hiring a backend engineer to own services end to end and keep our APIs fast.",
  "Requirements", "- Go, Postgres, Kubernetes and gRPC in production",
  "Preferred qualifications", "- Rust",
].join("\n");

function fixtureDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1,'a','x')").run();
  return db;
}
const post = (db, id, { title = "Backend Engineer", company = "Acme", text = TEXT, first = NOW - DAY, active = 1, ghost = null, level = null } = {}) =>
  db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,location,url,search_query,_hash,description,scraped_at,discovered_at,updated_at,is_active,ghost_level,level_read)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, title, company, "Boston, MA", `https://acme.test/${id}`, "t", `h${id}`, text, first, first, first, active, ghost, level);
const report = (db, jobId, { matched, missing, score }) =>
  db.prepare(`INSERT INTO ats_only_reports (user_id, domain_profile_id, job_id, ats_report, ats_score) VALUES (1, NULL, ?, ?, ?)`)
    .run(jobId, JSON.stringify({ tier1_matched: matched, tier1_missing: missing }), score);
const page = (jobs, total = jobs.length) => async () => ({ ok: true, jobs, nextCursor: null, total });

test("D136 · d136WeightsOneFile — the weights, bands and shortlist bounds live in shared/bestBets.js only", () => {
  assert.ok(Object.isFrozen(BEST_BET_WEIGHTS) && Object.isFrozen(BEST_BET_BANDS));
  const svc = read("services/bestBets.js").replace(/^\s*\/\/.*$/gm, "");
  assert.match(svc, /bestBetOf\(/);
  assert.doesNotMatch(svc, /score\s*>=\s*\d{2}|band\s*=\s*"(best|good|long)"/, "no second banding in the service");
});

test("D136 · d136ReasonsOnCard — 'Best bet: you're eligible · posted 9 hours ago · 13 of 15 must-haves · they closed 6 roles in 60 days'", () => {
  const b = bestBetOf({ eligible: true, mustHaves: { have: 13, total: 15 }, levelGap: 0, hoursSinceFirstSeen: 9, ghostLevel: 0,
    velocity: { watchedDays: 90, closed60: 6 } });
  assert.equal(b.band, "best");
  assert.equal(bestBetLine(b), "Best bet: you're eligible · 13 of 15 must-haves · at your level · posted 9 hours ago · they closed 6 roles in 60 days");
  // An unknown signal weighs nothing either way: velocity not known is not "no closings".
  const base = { mustHaves: { have: 13, total: 15 }, hoursSinceFirstSeen: 9, ghostLevel: 0 };
  const unknown = bestBetOf(base), noClosings = bestBetOf({ ...base, velocity: { watchedDays: 90, closed60: 0 } });
  assert.ok(unknown.score > noClosings.score, "never marked down for what draft cannot see");
  assert.equal(bestBetOf({ ...base, velocity: { watchedDays: 20, closed60: 0 } }).score, unknown.score, "watched under 60 days: unknown");
  assert.equal(bestBetOf({ mustHaves: { have: 15, total: 15 }, hoursSinceFirstSeen: 1, ghostLevel: 2 }).band, "long",
    "Likely not hiring is never above Long shot");
  const ui = read("client/src/components/BestBets.jsx");
  assert.match(ui, /\{bestBet\.label\}/);
  assert.match(ui, /\{bestBet\.reasons\.join\(" · "\)\}/);
  assert.match(read("client/src/panels/JobsPanel.jsx"), /\{bestBets && <BestBets onOpen=\{onJobSelect\}/);
});

test("D136 · d136HardFiltersOut — not eligible, won't sponsor (for a needer), closed and already applied never enter; the rest are ranked", async () => {
  const db = fixtureDb();
  for (const id of ["good", "weak", "inel", "nospons", "closed", "applied"]) post(db, id);
  report(db, "good", { matched: ["Go", "Postgres", "Kubernetes", "gRPC"], missing: ["Rust"], score: 80 });
  report(db, "weak", { matched: ["Go"], missing: ["Postgres", "Kubernetes", "gRPC"], score: 40 });
  db.prepare("INSERT INTO application_records (user_id, job_id, state, origin) VALUES (1, 'applied', 'verified', 'manual')").run();
  db.prepare("INSERT INTO application_defaults (user_id, key, value, source) VALUES (1, 'sponsorship_now', 'yes', 'user')").run();
  const board = [
    { id: "weak" }, { id: "good" },
    { id: "inel", eligibility: { status: "ineligible", reasons: ["U.S. citizens only"] } },
    { id: "nospons", sponsorship: { level: "says_no" } },
    { id: "closed", isActive: false }, { id: "applied" },
  ];
  const r = await bestBetsFor(db, { userId: 1, size: 5, fetchBoardPage: page(board, 214), now: NOW });
  assert.deepEqual(r.bets.map(b => b.job.id), ["good", "weak"], "ranked by the score; the hard-filtered never appear");
  assert.equal(r.matches, 214, "the rest of the board is one press away — and counted");
  assert.deepEqual(r.bets[0].bestBet.reasons.slice(0, 2), ["you're eligible", "4 of 4 must-haves"],
    "the user set a sponsorship answer nothing contradicts; Rust is Preferred — a nice-to-have, not a must-have");
});

test("D136 · d136ShortlistDefaultFive — 5 by default, the user sets 3–20; Auto settings carry it", async () => {
  assert.equal(SHORTLIST_DEFAULT, 5);
  assert.equal(shortlistSize(undefined), 5);
  assert.equal(shortlistSize(1), 3);
  assert.equal(shortlistSize(50), 20);
  assert.equal(AUTO_DEFAULTS.bestBets, 5);
  assert.equal(normaliseAutoSettings({ bestBets: 12 }).value.bestBets, 12);
  assert.equal(normaliseAutoSettings({ bestBets: 2 }).ok, false);
  const db = fixtureDb();
  for (let i = 0; i < 9; i++) post(db, `j${i}`);
  const r = await bestBetsFor(db, { userId: 1, fetchBoardPage: page(Array.from({ length: 9 }, (_, i) => ({ id: `j${i}` }))), now: NOW });
  assert.equal(r.bets.length, 5);
  const server = read("server.js");
  const from = at(server, 'app.get("/api/best-bets", requireAuth', 0, "the route");
  assert.ok(at(server, "settings.bestBets", from, "reads the user's size") > from);
});

test("D136 · d136NoProbabilityUntilCalibrated — a band and reasons, never a chance, until 500 outcomes", () => {
  const db = fixtureDb();
  const b = bestBetOf({ mustHaves: { have: 9, total: 10 }, hoursSinceFirstSeen: 3, ghostLevel: 0 });
  assert.equal(calibratedChance(db, b), null);
  assert.deepEqual(refitBestBets(db, { rows: [] }), { ready: false, outcomes: 0, needed: CALIBRATED_MIN });
  for (const t of [b.label, ...b.reasons]) assert.doesNotMatch(t, /%|chance|probab/i, t);
  assert.match(read("client/src/components/BestBets.jsx"), /not a probability/);
});

test("D136 · d136OutcomeRecordedWithSignals — a verified send stores the signals it had, once", () => {
  const db = fixtureDb();
  post(db, "j", { first: NOW - 2 * DAY });
  report(db, "j", { matched: ["Go", "Postgres"], missing: ["Kubernetes", "gRPC"], score: 55 });
  recordJobHistory(db, { now: NOW });
  recordSubmission(db, { userId: 1, jobId: "j", input: { submittedAt: Date.now(), method: "company_site", evidenceText: "Thanks for applying to Acme" } });
  const row = db.prepare("SELECT * FROM application_signals WHERE user_id = 1 AND job_id = 'j'").get();
  assert.ok(row, "stored at the send");
  const { shares, signals } = JSON.parse(row.signals_json);
  assert.deepEqual(signals.mustHaves, { have: 2, total: 4 });
  assert.equal(shares.mustHaves, 0.5);
  assert.deepEqual(Object.keys(shares), [...SIGNAL_KEYS]);
  db.prepare("UPDATE job_applications SET first_response_at = ?, response_outcome = 'interview' WHERE job_id = 'j'").run(NOW);
  assert.deepEqual(outcomeRows(db, { now: NOW }).map(r => r.y), [1], "joined to how it ended");
});

test("D136 · d136RefitHoldout — the newest month is held out; the fit is kept only when it beats the average", () => {
  const db = fixtureDb();
  const rows = [];
  // 600 synthetic outcomes over five months: replies follow the must-have share.
  for (let i = 0; i < 600; i++) {
    const must = (i % 10) / 9;
    rows.push({ x: [must, 0.5, 0.5, 1, 0.5], y: (i * 7919 % 100) / 100 < must * 0.6 ? 1 : 0, sentAt: NOW - (150 - Math.floor(i / 4)) * DAY });
  }
  const f = refitBestBets(db, { rows, now: NOW });
  assert.equal(f.ready, true);
  assert.equal(f.train + f.test, 600);
  assert.equal(f.test, rows.filter(r => r.sentAt >= Math.max(...rows.map(x => x.sentAt)) - 30 * DAY).length, "the newest 30 days are the test");
  assert.ok(f.w[0] > 0, "more must-haves → more replies");
  assert.equal(f.used, f.testLogLoss < f.baselineLogLoss);
  assert.ok(f.used);
  const strong = calibratedChance(db, bestBetOf({ mustHaves: { have: 10, total: 10 }, ghostLevel: 0 }));
  const weak = calibratedChance(db, bestBetOf({ mustHaves: { have: 1, total: 10 }, ghostLevel: 0 }));
  assert.ok(strong > weak, "calibrated once there are 500+ outcomes");
});

test("D136 P2 · picks draw from the shortlist first — the best-bet score leads, the ATS match breaks ties", () => {
  const settings = { ...AUTO_DEFAULTS, filters: {} };
  const c = [
    { jobId: "high-ats", company: "A", score: 90, bestBet: 40 },
    { jobId: "best", company: "B", score: 60, bestBet: 85 },
    { jobId: "none", company: "C", score: 95 },
  ];
  assert.deepEqual(choosePicks(c, { remaining: 3, settings }).take.map(x => x.jobId), ["best", "high-ats", "none"]);
  assert.deepEqual(choosePicks(c.map(({ bestBet, ...r }) => r), { remaining: 3, settings }).take.map(x => x.jobId),
    ["none", "high-ats", "best"], "without best bets, the ATS match as before");
  assert.match(read("server.js"), /bestBetOf\(bestBetSignalsFor\(db, \{ userId, profileId, job: \{ id: j\.id \}, userLevel \}\)\)\.score/);
});

test("D136 · signals: the level against the user's, the crawl's first sighting, the ghost level", () => {
  const db = fixtureDb();
  db.prepare("INSERT INTO user_profile (user_id, years_of_experience) VALUES (1, 1)").run();
  post(db, "senior", { level: "senior", ghost: 2, first: NOW - 40 * DAY });
  recordJobHistory(db, { now: NOW });
  const s = bestBetSignalsFor(db, { userId: 1, job: { id: "senior" }, now: NOW });
  assert.equal(s.levelGap, 3);
  assert.equal(s.ghostLevel, 2);
  assert.equal(Math.round(s.hoursSinceFirstSeen / 24), 40);
});
