import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { at } from "../test-support/sourceAnchors.js";
import { recordJobHistory } from "../services/jobs/jobHistory.js";
import { ghostScoreOf, ghostLine, GHOST_WEIGHTS, GHOST_THRESHOLDS, GHOST_LEVEL } from "../shared/ghostScore.js";
import {
  scoreGhosts, ghostForRows, ghostCalibration, calibrateGhostThreshold, currentNotHiringMin, CALIBRATION_MIN,
} from "../services/jobs/ghostScore.js";
import { buildJobFilters } from "../services/jobs/jobQuery.js";
import { buildOrderKeys, orderByClause } from "../services/jobs/jobCursor.js";
import { applyLine } from "../shared/postingLevel.js";

// ⭐ D137 (owner 11-02) · THE GHOST SCORE — likely-dead postings scored with evidence; only the provably dead are
// hidden. Synthetic companies, postings and people.

const DAY = 86400;
const NOW = Math.floor(Date.UTC(2026, 10, 2, 12) / 1000);
const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const TEXT = "We are hiring a backend engineer to build payment systems in Go and Postgres. You will own services end to end, " +
  "work with product on design, review code, mentor others and keep our APIs fast and reliable for millions of users.";

function fixtureDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1,'a','x'), (2,'b','x'), (3,'c','x')").run();
  return db;
}
const post = (db, id, { title = "Backend Engineer", company = "Acme, Inc.", location = "Boston, MA", text = TEXT, first, updated = first, active = 1 } = {}) =>
  db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,location,url,search_query,_hash,description,scraped_at,discovered_at,updated_at,is_active)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, title, company, location, `https://x.test/${id}`, "t", `h${id}`, text, first, first, updated, active);
const apply = (db, user, jobId, { at: appliedAt, outcome = null, source = null, firstResponse = null } = {}) =>
  db.prepare(`INSERT INTO job_applications (user_id, job_id, company, role, applied_at, response_outcome, outcome_source, first_response_at)
    VALUES (?,?,?,?,?,?,?,?)`).run(user, jobId, "Acme", "Backend Engineer", appliedAt, outcome, source, firstResponse);
const level = (db, id) => db.prepare("SELECT ghost_level FROM scraped_jobs WHERE job_id = ?").pluck().get(id);

test("D137 · the score — conservative: no single age or repost fact reaches Likely not hiring; a talent-pool title does", () => {
  assert.equal(ghostScoreOf({ title: "Backend Engineer", liveness: { openDays: 3, reposts: 0 } }).level, GHOST_LEVEL.HIRING);
  assert.equal(ghostScoreOf({ liveness: { openDays: 110, reposts: 0 } }).level, GHOST_LEVEL.UNCERTAIN, "open long alone: uncertain");
  assert.equal(ghostScoreOf({ liveness: { openDays: 10, reposts: 4 } }).level, GHOST_LEVEL.UNCERTAIN, "reposts alone: uncertain");
  assert.equal(ghostScoreOf({ liveness: { openDays: 95, reposts: 3 } }).level, GHOST_LEVEL.NOT_HIRING, "open 90+ AND reposted 3+");
  const pool = ghostScoreOf({ title: "Software Engineer — Talent Pool" });
  assert.equal(pool.level, GHOST_LEVEL.NOT_HIRING);
  assert.equal(ghostScoreOf({ title: "Recruiter", text: "Build our talent pipeline with hiring managers." }).level, GHOST_LEVEL.HIRING,
    "a recruiter's job is not a sign");
  assert.equal(ghostScoreOf({ text: "This is an evergreen role and is not tied to a current opening." }).level, GHOST_LEVEL.UNCERTAIN);
  assert.equal(ghostScoreOf({ text: "By applying, you'll be considered for future openings as they arise." }).level, GHOST_LEVEL.UNCERTAIN);
  assert.equal(ghostScoreOf({ text: "**This is a Pipeline Requisition for upcoming awards" }).level, GHOST_LEVEL.UNCERTAIN);
  // Real roles, measured on the 11-02 crawl copy — boilerplate, not a sign.
  for (const text of ["Strong performance may lead to consideration for future opportunities at Stripe.",
    "We greatly appreciate your understanding and hope to consider you for future opportunities.",
    "This is a pipeline role feeding four areas. Depending on your background you'll focus on one."]) {
    assert.equal(ghostScoreOf({ text }).level, GHOST_LEVEL.HIRING, text);
  }
  // An answer overrides every guess.
  const answered = ghostScoreOf({ title: "Talent Pool", liveness: { openDays: 100, reposts: 5 }, replied: 1 });
  assert.equal(answered.level, GHOST_LEVEL.HIRING);
  assert.match(answered.evidence[0].text, /heard back/);
});

test("D137 · d137WeightsOneFile — every weight and cut is in shared/ghostScore.js; the service reads them, never restates them", () => {
  assert.ok(Object.isFrozen(GHOST_WEIGHTS) && Object.isFrozen(GHOST_THRESHOLDS));
  const svc = read("services/jobs/ghostScore.js").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(svc, /points\s*[+]=\s*\d|level\s*=\s*points\s*>=\s*\d/, "no second scoring in the service");
  assert.match(svc, /ghostScoreOf\(/);
});

test("D137 · d137EvidenceShown — each reason is a fact the user can read; the card, the posting and the line say them", () => {
  const g = ghostScoreOf({ liveness: { openDays: 94, reposts: 4, kind: "reposted", label: "Reposted 4 times since June" } });
  assert.equal(g.level, GHOST_LEVEL.NOT_HIRING);
  assert.deepEqual(g.evidence.map(e => e.text), ["Reposted 4 times since June", "Open 94 days"]);
  assert.equal(ghostLine({ level: 2, evidence: g.evidence }), "Likely not hiring · Reposted 4 times since June · Open 94 days");
  assert.equal(ghostLine({ level: 0, evidence: [] }), null, "nothing against it, nothing said");
  assert.equal(applyLine({ score: 50, ghost: { level: 2 } }).verdict, "doubtful");
  assert.match(applyLine({ score: 50, ghost: { level: 2 } }).text, /likely not hiring/);
  assert.equal(applyLine({ score: 50 }).text, "Good match.", "no ghost, the line as before");
  const card = read("client/src/components/JobCard.jsx");
  assert.match(card, /<GhostMark ghost=\{job\.ghost\}\/>/);
  assert.match(card, /ghost: job\?\.ghost \}\);/);
  const panel = read("client/src/components/PostingPanel.jsx");
  assert.match(panel, /<PostingGhost ghost=\{job\.ghost\} \/>/);
  const server = read("server.js");
  const from = at(server, "const ghost = (() => { try { return ghostForRows(db, pageRows);", 0, "the board reads the evidence");
  assert.ok(at(server, "{ ghost: ghost.get(String(j.job_id)) }", from, "and sends it per posting") > from);
});

test("D137 · scoreGhosts — from the history and the applications; stored as the column + the evidence; never deactivates", () => {
  const db = fixtureDb();
  // Reposted 3 times and open 95 days → Likely not hiring.
  post(db, "r1", { first: NOW - 400 * DAY, updated: NOW - 330 * DAY, active: 0 });
  post(db, "r2", { title: "Backend Engineer (R-2)", first: NOW - 300 * DAY, updated: NOW - 230 * DAY, active: 0 });
  post(db, "r3", { first: NOW - 200 * DAY, updated: NOW - 130 * DAY, active: 0 });
  post(db, "r4", { title: "Backend Engineer – REQ 99881", first: NOW - 95 * DAY, updated: NOW - DAY });
  // A fresh posting at another company → nothing against it.
  post(db, "fresh", { company: "Fresh Co", title: "Data Engineer", first: NOW - 3 * DAY });
  // A talent pool.
  post(db, "pool", { company: "Pool Co", title: "Engineering Talent Community", first: NOW - 10 * DAY });
  recordJobHistory(db, { now: NOW });
  const r = scoreGhosts(db, { now: NOW });
  assert.equal(r.scored, 3, "the active postings");
  assert.equal(level(db, "r4"), 2);
  assert.equal(level(db, "pool"), 2);
  assert.equal(level(db, "fresh"), null, "nothing against it is stored as NULL");
  assert.equal(db.prepare("SELECT COUNT(*) FROM scraped_jobs WHERE is_active = 1").pluck().get(), 3, "nothing deactivated");
  const ev = ghostForRows(db, [{ job_id: "r4" }, { job_id: "fresh" }]);
  assert.deepEqual(ev.get("r4").evidence, ["Reposted 3 times since September 2025", "Open 95 days"]);
  assert.equal(ev.has("fresh"), false);
  assert.equal(scoreGhosts(db, { now: NOW }).changed, 0, "idempotent");
});

test("D137 · d137OnlyProvablyClosedHidden + d137RankedDownNotRemoved — flagged stays on the board, last; closed is gone", () => {
  const db = fixtureDb();
  post(db, "pool", { company: "Pool Co", title: "Future Opportunities — Engineering", first: NOW - 2 * DAY });
  post(db, "fresh", { company: "Fresh Co", title: "Data Engineer", first: NOW - 3 * DAY });
  post(db, "closed", { company: "Gone Co", title: "Backend Engineer", first: NOW - 4 * DAY, active: 0 });
  recordJobHistory(db, { now: NOW });
  scoreGhosts(db, { now: NOW });
  const board = (keys) => {
    const f = buildJobFilters({});
    const order = orderByClause(keys);
    return db.prepare(`SELECT sj.job_id FROM scraped_jobs sj LEFT JOIN ats_only_reports aor ON 0 WHERE sj.is_active = 1 ${f.sql} ORDER BY ${order.sql}`)
      .all(...f.params, ...order.params).map(r => r.job_id);
  };
  // Newest first would put the pool (2 days old) on top; ranked down it is last, and still there.
  assert.deepEqual(board(buildOrderKeys("dateDesc", [], { ghost: false })), ["pool", "fresh"]);
  assert.deepEqual(board(buildOrderKeys("dateDesc", [], { ghost: true })), ["fresh", "pool"]);
  assert.deepEqual(board(buildOrderKeys(undefined, [], { ghost: true })), ["fresh", "pool"], "the curated order too");
  assert.equal(buildOrderKeys("dateDesc", [], {}).length, buildOrderKeys("dateDesc", [], { ghost: false }).length, "off adds no key");
});

test("D137 · d137FilterOffByDefault — 'Hide likely not hiring' leaves out only Likely not hiring, and only when asked", () => {
  const db = fixtureDb();
  post(db, "pool", { company: "Pool Co", title: "General Application", first: NOW - 2 * DAY });
  post(db, "long", { company: "Long Co", title: "Backend Engineer", first: NOW - 100 * DAY });
  post(db, "fresh", { company: "Fresh Co", title: "Data Engineer", first: NOW - 3 * DAY });
  recordJobHistory(db, { now: NOW });
  scoreGhosts(db, { now: NOW });
  assert.equal(level(db, "long"), 1, "open 100 days alone is Uncertain");
  const ids = (params) => { const f = buildJobFilters(params);
    return db.prepare(`SELECT job_id FROM scraped_jobs sj WHERE sj.is_active = 1 ${f.sql} ORDER BY job_id`).all(...f.params).map(r => r.job_id); };
  assert.deepEqual(ids({}), ["fresh", "long", "pool"], "off: everything");
  assert.deepEqual(ids({ hide_ghost: "1" }), ["fresh", "long"], "on: Uncertain stays");
  assert.equal(buildJobFilters({}).sql.includes("ghost_level"), false);
  const panel = read("client/src/panels/JobsPanel.jsx");
  assert.match(panel, /hideGhost: false,/, "the default filter state is off");
  assert.match(panel, /if \(hideGhost\)\s+p\.set\("hide_ghost", "1"\);/);
  const from = at(panel, 'p.set("hide_ghost", "1");', 0, "JobsPanel buildParams");
  const deps = panel.slice(from, at(panel, "]);", from, "buildParams' dependency list") + 3);
  assert.match(deps, /trulyEntry, hideGhost,/, "the querystring callback re-creates when the toggle changes");
  assert.match(panel, /setHideGhost\(p\.get\("hide_ghost"\) === "1"\);/, "a saved search restores it");
});

test("D137 · d137UserReportOnePress — The Table's 'Still nothing' is the report; an answer clears the flag", () => {
  const db = fixtureDb();
  post(db, "j", { first: NOW - 70 * DAY });   // open 70 days: 1 point
  recordJobHistory(db, { now: NOW });
  apply(db, 1, "j", { at: NOW - 40 * DAY, outcome: "no_response", source: "manual" });
  apply(db, 2, "j", { at: NOW - 35 * DAY, outcome: "no_response", source: "manual" });
  scoreGhosts(db, { now: NOW });
  assert.equal(level(db, "j"), 1, "70 days + 2 reports = 3 points: Uncertain, not yet a flag");
  assert.deepEqual(ghostForRows(db, [{ job_id: "j" }]).get("j").evidence,
    ["Open 70 days", '2 people who applied marked it "no reply in 30 days"']);
  apply(db, 3, "j", { at: NOW - 31 * DAY, firstResponse: NOW - 20 * DAY, outcome: "interview", source: "manual" });
  scoreGhosts(db, { now: NOW });
  assert.equal(level(db, "j"), null, "someone heard back");
  // The one press: The Table records "no reply" through the response route, source manual.
  const table = read("client/src/components/ApplicationHistory.jsx");
  assert.match(table, /body: JSON\.stringify\(\{ outcome: RESPONSE_OUTCOME\.NO_RESPONSE, source: "manual" \}\)/);
});

test("D137 · d137FalseFlagRateUnder5Pct — monthly: ≥ 1 in 20 flagged postings replying raises the cut; it never falls", () => {
  const db = fixtureDb();
  const flag = (id, flaggedAt) => db.prepare(`INSERT INTO job_ghost (job_id, level, points, evidence_json, scored_at, flagged_at)
    VALUES (?, 2, 6, '[]', ?, ?)`).run(id, flaggedAt, flaggedAt);
  for (let i = 0; i < CALIBRATION_MIN; i++) {
    flag(`g${i}`, NOW - 90 * DAY);
    apply(db, 1 + (i % 3), `g${i}`, { at: NOW - 60 * DAY });   // silent past 30 days
  }
  // Applied BEFORE the flag: not the flag's outcome.
  apply(db, 2, "g0", { at: NOW - 120 * DAY, firstResponse: NOW - 110 * DAY, outcome: "interview" });
  let m = ghostCalibration(db, { now: NOW });
  assert.deepEqual([m.withOutcomes, m.replied], [CALIBRATION_MIN, 0]);
  let c = calibrateGhostThreshold(db, { now: NOW });
  assert.equal(c.raised, false);
  assert.equal(currentNotHiringMin(db), GHOST_THRESHOLDS.notHiringMin);
  assert.equal(calibrateGhostThreshold(db, { now: NOW + DAY }).ran, false, "once a month");
  // One reply after the flag = 1 in 20 → the cut rises.
  db.prepare("UPDATE job_applications SET first_response_at = ?, response_outcome = 'interview' WHERE job_id = 'g5'").run(NOW - 50 * DAY);
  c = calibrateGhostThreshold(db, { now: NOW + 30 * DAY });
  assert.equal(c.raised, true);
  assert.equal(currentNotHiringMin(db), GHOST_THRESHOLDS.notHiringMin + 1);
});

test("D137 · flagged_at is the FIRST flag and is never cleared — a reply moves the level, not the record", () => {
  const db = fixtureDb();
  post(db, "p", { company: "Pool Co", title: "Talent Pool", first: NOW - 2 * DAY });
  recordJobHistory(db, { now: NOW });
  scoreGhosts(db, { now: NOW });
  const flaggedAt = db.prepare("SELECT flagged_at FROM job_ghost WHERE job_id = 'p'").pluck().get();
  assert.ok(flaggedAt);
  apply(db, 1, "p", { at: NOW, firstResponse: NOW + DAY, outcome: "interview" });
  scoreGhosts(db, { now: NOW + 2 * DAY });
  assert.equal(db.prepare("SELECT flagged_at FROM job_ghost WHERE job_id = 'p'").pluck().get(), flaggedAt);
  assert.equal(level(db, "p"), null);
});

test("D137 · the nightly tick and the boot cleanup score after D107's rollup", () => {
  const server = read("server.js");
  const cron = at(server, "const g = scoreGhosts(db);", 0, "the 04:00 tick");
  assert.ok(cron > at(server, "const h = recordJobHistory(db);", 0, "after the history"));
  assert.ok(at(server, "calibrateGhostThreshold(db)", cron, "then the monthly calibration") > cron);
  const boot = at(server, "function runExpiredJobsCleanup()", 0, "the cleanup");
  assert.ok(at(server, "scoreGhosts(db)", boot, "scores before anything is deleted") < at(server, "STARRED ROWS ARE RETIRED", boot, "the delete"));
});
