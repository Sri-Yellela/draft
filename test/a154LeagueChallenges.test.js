// ⭐ A154 / D172 (4) (45s, owner 11-08: "build league and challenges, can merge them later") · THIS WEEK'S LEAGUE, the pod's
// rank, the live count and the challenges — each behind its own switch (OFF). Synthetic people only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { setSetting } from "../services/appSettings.js";
import { LEAGUE, LEAGUE_SETTING, LIVE_COUNT_SETTING, joinLeague, leaveLeague, myLeague, podRank, liveCount, rollover, weekOf, weekStart, validHandle, podName, standings }
  from "../services/atlas/league.js";
import { CHALLENGE, CHALLENGES_SETTING, seededFive, answerRun, duelOpen, sharedBar } from "../services/atlas/challenges.js";
import atlasCompeteRoutes from "../routes/atlasCompete.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const DAY = 86400;
// A Wednesday 12:00 UTC well inside a week, so "yesterday" is in the same week.
const WED = weekStart(weekOf(Date.UTC(2026, 10, 11, 12) / 1000)) + 2 * DAY + 12 * 3600;

function freshDb(n = 8) {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  for (let i = 1; i <= n; i++) {
    db.prepare("INSERT INTO users (id, username, password_hash) VALUES (?, ?, 'x')").run(i, `person${i}`);
    db.prepare("INSERT INTO domain_profiles (id, user_id, profile_name, role_family, domain, is_active, placement_category) VALUES (?, ?, 'P', 'data', 'data', 1, 'data')").run(100 + i, i);
    db.prepare("INSERT INTO profile_education (user_id, school, position) VALUES (?, 'Northeastern University', 0)").run(i);
  }
  return db;
}
const points = (db, user, kind, ref, pts, at) => db.prepare("INSERT INTO proof_points (user_id, kind, ref, points, earned_at) VALUES (?, ?, ?, ?, ?)").run(user, kind, ref, pts, at);
const on = (db, key) => setSetting(db, key, true);

test("d172LeagueOptIn: nobody is in the league until they join with a handle; the pod is school × field; the handle is all that shows", () => {
  const db = freshDb();
  on(db, LEAGUE_SETTING);
  const before = myLeague(db, 1, { now: WED });
  assert.equal(before.member, false);
  assert.ok(validHandle(before.suggestion), "a suggested handle that says nothing about the person");
  assert.equal(db.prepare("SELECT COUNT(*) FROM league_members").pluck().get(), 0, "reading the league joins no one");
  assert.throws(() => joinLeague(db, 1, { handle: "x" }), /handle/);
  joinLeague(db, 1, { handle: "quiet-otter-12" }, { now: WED - DAY * 2 });
  assert.throws(() => joinLeague(db, 2, { handle: "quiet-otter-12" }), /handle/, "handles are unique");
  const l = myLeague(db, 1, { now: WED });
  assert.equal(l.member, true);
  assert.match(l.pod.name, /^Northeastern · .+ pod$/);
  assert.ok(!JSON.stringify(l).includes("person1"), "never the username");
  assert.equal(podName({ school: null, field: null }), "Any school · Any field pod");
});

test("d172LeagueBadgeCountdown + d172PodiumTopThree + d172MovementSinceYesterday: tier, reset countdown, top three, movement", () => {
  const db = freshDb();
  on(db, LEAGUE_SETTING);
  for (let i = 1; i <= 7; i++) joinLeague(db, i, { handle: `handle-${i}0` }, { now: WED - 3 * DAY });
  // yesterday: 1 leads, 2 second; today 3 jumps to first
  points(db, 1, "skill_checked", "sql", 120, WED - DAY);
  points(db, 2, "skill_checked", "python", 80, WED - DAY);
  points(db, 3, "learn_build", "b1", 200, WED - 3600);
  const l = myLeague(db, 3, { now: WED });
  assert.equal(l.tier.name, "Bronze"); assert.equal(l.tier.next, "Silver");
  assert.match(l.line, /^Bronze · Northeastern · .+ pod — 7 people\. Points from proof only\. The top 5 move up to Silver on Monday\.$/);
  assert.equal(l.resetsAt, weekStart(weekOf(WED) + 1)); assert.equal(l.resetsIn, l.resetsAt - WED);
  assert.deepEqual(l.podium.map(r => r.handle), ["handle-30", "handle-10", "handle-20"]);
  const by = Object.fromEntries(l.rows.map(r => [r.handle, r.move]));
  assert.equal(by["handle-30"], 2, "▲ 2 since yesterday"); assert.equal(by["handle-10"], -1, "▼ 1");
  assert.equal(l.promotionLine, 5);
  assert.equal(l.you.place, 1); assert.equal(l.gap, null, "in the promotion zone: no gap to close");
});

test("d172GapToPromotionWithAction: below the line, the gap in points and the one move that closes it", () => {
  const db = freshDb();
  on(db, LEAGUE_SETTING);
  for (let i = 1; i <= 7; i++) joinLeague(db, i, { handle: `handle-${i}0` }, { now: WED - 3 * DAY });
  for (let i = 1; i <= 5; i++) points(db, i, "skill_checked", `s${i}`, 40 + i * 10, WED - DAY);   // 5th place = 60
  const l = myLeague(db, 7, { now: WED });
  assert.equal(l.you.place, 7);
  assert.equal(l.gap.points, 51);   // 60 − 0 + 1
  assert.match(l.gap.words, /^51 points to the promotion line\./);
  assert.ok(l.gap.move && l.gap.move.label && l.gap.move.points > 0, "one action named beside the gap");
  const pr = podRank(db, 7, { now: WED });
  assert.match(pr.line, /^#7 in your Northeastern · .+ pod · 51 points to move up$/);
});

test("d172FeedProofOnlyHandlesOnly: the pod's feed is proof events, newest first, three, handles only", () => {
  const db = freshDb();
  on(db, LEAGUE_SETTING);
  for (let i = 1; i <= 3; i++) joinLeague(db, i, { handle: `handle-${i}0` }, { now: WED - 3 * DAY });
  points(db, 1, "skill_checked", "spark", 40, WED - 300);
  points(db, 2, "learn_build", "b", 60, WED - 200);
  points(db, 3, "explained", "e", 10, WED - 100);
  points(db, 1, "explained", "e2", 10, WED - 50);
  const l = myLeague(db, 2, { now: WED });
  assert.equal(l.feed.length, LEAGUE.FEED);
  assert.deepEqual(l.feed.map(f => f.handle), ["handle-10", "handle-30", "handle-20"]);
  assert.ok(l.feed.every(f => !/person\d/.test(JSON.stringify(f))));
  const words = l.feed.map(f => f.words).join(" | ");
  assert.doesNotMatch(words, /fail|wrong|missed/i, "the feed shows proof, never failures");
});

test("d172LeaveAnyTime: leaving deletes the row — no pod, no feed, no rank; the footer says so", () => {
  const db = freshDb();
  on(db, LEAGUE_SETTING);
  joinLeague(db, 1, { handle: "steady-fox-11" });
  assert.match(myLeague(db, 1).footer, /because you joined it\. Your handle is all anyone sees/);
  assert.deepEqual(leaveLeague(db, 1), { left: true });
  assert.equal(db.prepare("SELECT COUNT(*) FROM league_members").pluck().get(), 0);
  assert.equal(myLeague(db, 1).member, false);
  assert.equal(podRank(db, 1), null);
});

test("Monday: the top five with points move up a tier, once; nobody moves down; Gold is the top", () => {
  const db = freshDb(8);
  on(db, LEAGUE_SETTING);
  const lastWeek = WED - 7 * DAY;
  rollover(db, { now: lastWeek });   // first ever read: marks the week before as done
  for (let i = 1; i <= 8; i++) joinLeague(db, i, { handle: `handle-${i}0` }, { now: lastWeek - DAY });
  for (let i = 1; i <= 6; i++) points(db, i, "skill_checked", `s${i}`, 10 * i, lastWeek);
  const r = rollover(db, { now: WED });
  assert.equal(r.promoted, 5);
  const tiers = db.prepare("SELECT user_id, tier FROM league_members ORDER BY user_id").all().map(x => x.tier);
  assert.deepEqual(tiers, [1, 2, 2, 2, 2, 2, 1, 1]);
  assert.equal(rollover(db, { now: WED }).promoted, 0, "once per week");
  assert.equal(standings([{ user_id: 1, handle: "a", joined_at: 2 }, { user_id: 2, handle: "b", joined_at: 1 }], new Map()).map(x => x.handle).join(), "b,a",
    "a tie goes to who joined first");
});

test("d172LiveCountReal: a real count of distinct people in the field, shown only at or above the minimum, behind its switch", () => {
  const db = freshDb(12);
  assert.equal(liveCount(db, 1, { now: WED }), null, "switch off → nothing");
  on(db, LIVE_COUNT_SETTING);
  for (let i = 1; i < LEAGUE.LIVE_MIN; i++) points(db, i, "explained", `e${i}`, 10, WED - 60);
  assert.equal(liveCount(db, 1, { now: WED }), null, "below the minimum → nothing, never a rounded-up number");
  points(db, LEAGUE.LIVE_MIN, "explained", "e", 10, WED - 60);
  points(db, LEAGUE.LIVE_MIN, "explained", "f", 10, WED - 30);   // one person twice still counts once
  points(db, 11, "explained", "old", 10, WED - LEAGUE.LIVE_WINDOW_S - 5);   // outside the window
  const lc = liveCount(db, 1, { now: WED });
  assert.equal(lc.n, LEAGUE.LIVE_MIN);
  assert.match(lc.line, new RegExp(`^${LEAGUE.LIVE_MIN} people practising .+ right now$`));
});

test("Challenges: the duel's five are the same for one seed; the server's clock decides in time; extended and untimed never penalised", () => {
  const pool = Array.from({ length: 12 }, (_, i) => ({ id: `q${i}`, type: "recall" }));
  assert.deepEqual(seededFive(pool, "pod#1#2900").map(q => q.id), seededFive([...pool].reverse(), "pod#1#2900").map(q => q.id));
  assert.equal(seededFive(pool, "x").length, CHALLENGE.QUESTIONS);
  assert.equal(duelOpen(Date.UTC(2026, 10, 13, 12)), true, "Friday");
  assert.equal(duelOpen(Date.UTC(2026, 10, 11, 12)), false, "Wednesday");
  const db = freshDb(1);
  for (let i = 0; i < 3; i++) db.prepare(`INSERT INTO learn_questions (id, role, level, type, stem, choices_json, correct, why_json, status, content_hash)
      VALUES (?, 'Data Engineer', 'mid', 'recall', 'A stem', '["a","b","c","d"]', 1, '["","right","",""]', 'live', 'h')`).run(`q${i}`);
  const t0 = 1_800_000_000_000;
  const mk = (mode) => Number(db.prepare(`INSERT INTO challenge_runs (user_id, kind, ref, questions_json, mode, total, served_at, started_at)
      VALUES (1, 'time_attack', 'data-engineer', '["q0","q1","q2"]', ?, 3, ?, 0)`).run(mode, t0).lastInsertRowid);
  const late = CHALLENGE.SECONDS * 1000 + CHALLENGE.GRACE_MS + 1;
  assert.equal(answerRun(db, 1, mk("timed"), { questionId: "q0", chosen: 1 }, { now: t0 + late }).inTime, false, "timed: late earns no credit");
  assert.equal(answerRun(db, 1, mk("extended"), { questionId: "q0", chosen: 1 }, { now: t0 + late }).inTime, true, "extended: ×2");
  assert.equal(answerRun(db, 1, mk("untimed"), { questionId: "q0", chosen: 1 }, { now: t0 + 10 * late }).inTime, true, "untimed");
  const id = mk("timed");
  assert.throws(() => answerRun(db, 1, id, { questionId: "q2", chosen: 1 }, { now: t0 }), /on screen/);
  answerRun(db, 1, id, { questionId: "q0", chosen: 1 }, { now: t0 + 1000 });
  answerRun(db, 1, id, { questionId: "q1", chosen: 0 }, { now: t0 + 2000 });
  const end = answerRun(db, 1, id, { questionId: "q2", chosen: 1 }, { now: t0 + 3000 });
  assert.equal(end.done, true); assert.equal(end.score, 2); assert.equal(end.line, "2 of 3 in time");
  assert.equal(sharedBar(db, "nope"), null);
  // ⛔ no points: challenges never write proof_points
  assert.equal(db.prepare("SELECT COUNT(*) FROM proof_points").pluck().get(), 0);
  assert.doesNotMatch(read("services/atlas/challenges.js"), /INSERT[^`]*proof_points/);
});

test("Each switch OFF by default: every league / challenge route answers 404 until the owner turns it on; the admin switch is audited", async () => {
  const db = freshDb(2);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (99, 'admin', 'x')").run();
  const app = express(); app.use(express.json());
  let who = 1;
  const requireAuth = (req, _res, next) => { req.user = { id: who }; next(); };
  const requireAdmin = (req, _res, next) => { req.user = { id: 99 }; next(); };
  atlasCompeteRoutes(app, db, { requireAuth, requireAdmin });
  const srv = app.listen(0); const base = `http://127.0.0.1:${srv.address().port}`;
  const call = async (m, p, body) => { const r = await fetch(base + p, { method: m, headers: { "content-type": "application/json" }, body: body && m !== "GET" ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json() }; };
  try {
    assert.deepEqual((await call("GET", "/api/atlas/compete")).body, { league: false, challenges: false, liveCount: false });
    for (const [m, p] of [["GET", "/api/atlas/league"], ["POST", "/api/atlas/league/join"], ["DELETE", "/api/atlas/league"], ["GET", "/api/atlas/challenges"],
      ["POST", "/api/atlas/challenges/time-attack"], ["POST", "/api/atlas/challenges/duel"], ["GET", "/api/atlas/bar/abcdefghij"]])
      assert.equal((await call(m, p, {})).status, 404, `${m} ${p} while off`);
    const put = await call("PUT", "/api/admin/atlas-compete", { league: true });
    assert.equal(put.body.league, true); assert.equal(put.body.challenges, false);
    assert.equal(db.prepare("SELECT COUNT(*) FROM admin_audit_log WHERE action = 'atlas_compete_switch'").pluck().get(), 1);
    const j = await call("POST", "/api/atlas/league/join", { handle: "bold-heron-33" });
    assert.equal(j.status, 200); assert.equal(j.body.member, true);
    assert.equal((await call("POST", "/api/atlas/challenges/duel", {})).status, 404, "the duel needs both switches");
  } finally { srv.close(); }
});

test("Wiring: migration 264 in both runners; the merge plan and export know both tables; Your run carries pod + live only through their switches", () => {
  const server = read("server.js"), mig = read("scripts/migrations.js");
  assert.match(server, /id: "264_atlas_league"/); assert.match(mig, /id: "264_atlas_league"/);
  assert.match(server, /atlasCompeteRoutes\(app, db, \{ requireAuth, requireAdmin \}\);\napp\.use\("\/api\/atlas", createAtlasRouter\(db\)\);/);
  const acct = read("services/accountService.js");
  assert.match(acct, /league_members: "keepInto", challenge_runs: "move"/);
  assert.match(acct, /"league_members", "challenge_runs"\]/);
  assert.match(read("routes/atlas.js"), /pod = podRank\(db, req\.user\.id\)[\s\S]*live = liveCount\(db, req\.user\.id\)[\s\S]*res\.json\(\{ \.\.\.run, pod, live \}\)/);
});

// ⛔ 47m (changed on purpose): "Client: Compete is drawn only for the switches that are on; its ids are reserved" retired — the surface it pinned was rebuilt in the plate system (47m M5).
