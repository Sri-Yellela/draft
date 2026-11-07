// ⭐ D172 (3) (owner APPROVED 11-06, docs/sketches/atlas-redesign-sketch.html → Your run) · d172RunPointsOnlyFromProof —
// points come only from proof (an idea explained in your own words, a build, a skill checked or built), never twice, never
// for clicking; the level, the streak and today's quests. Synthetic people only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { POINTS, LEVELS, proofEvents, syncPoints, levelOf, streakOf, yourRun } from "../services/atlas/points.js";
import { runLines, questHref } from "../client/src/pages/atlas/yourRunModel.js";
import { at, lastAt } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const DAY = 86400;
const NOW = 1_794_100_000;

function db() {
  const d = new Database(":memory:");
  d.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT);
    CREATE TABLE learn_explanations (user_id INTEGER, checkpoint_id TEXT, step_id TEXT, body TEXT, words INTEGER, created_at INTEGER, updated_at INTEGER);
    CREATE TABLE learn_builds (user_id INTEGER, step_id TEXT, url TEXT, kind TEXT, created_at INTEGER, updated_at INTEGER);
    CREATE TABLE learn_opened (user_id INTEGER, item_id TEXT, at INTEGER);
    CREATE TABLE skill_proofs (id INTEGER PRIMARY KEY, user_id INTEGER, skill_key TEXT, skill TEXT, state TEXT, via TEXT, url TEXT, label TEXT, kind TEXT, check_id INTEGER, created_at INTEGER);
    CREATE TABLE readiness_checks (id INTEGER PRIMARY KEY, user_id INTEGER, skill_key TEXT, mode TEXT, started_at INTEGER, finished_at INTEGER);
    INSERT INTO users VALUES (1, 'jordan'), (2, 'casey');`);
  // migration 226, exactly as both runners write it
  const src = read("scripts/migrations.js");
  const i = at(src, 'id: "226_proof_points"');
  d.exec(src.slice(at(src, "sql: `", i) + 6, at(src, "`,", i)));
  return d;
}

test("d172RunPointsOnlyFromProof: migration 226 is byte-identical in both runners, and only ADDS", () => {
  const block = (f) => { const s = fs.readFileSync(f, "utf8"); const i = at(s, 'id: "226_proof_points"'); return s.slice(lastAt(s, "    {", i), at(s, "    },", i) + 6); };
  assert.equal(block("server.js"), block("scripts/migrations.js"));
  assert.doesNotMatch(block("server.js").replace(/ON DELETE CASCADE/g, ""), /\b(DROP|DELETE|UPDATE|ALTER)\b/, "nothing removed or rewritten");
  assert.match(read("services/accountService.js"), /proof_points: "keepInto"/, "a merge keeps INTO's row on a clash");
});

test("d172RunPointsOnlyFromProof: explained, built, checked, built-by-link pay; opening a link and D142's check do not", () => {
  const d = db();
  d.prepare("INSERT INTO learn_explanations VALUES (1, 's1#c0', 's1', 'x', 30, ?, ?)").run(NOW - DAY, NOW - DAY);
  d.prepare("INSERT INTO learn_builds VALUES (1, 's2', 'https://example.com/r', 'repository', ?, ?)").run(NOW, NOW);
  d.prepare("INSERT INTO skill_proofs (user_id, skill_key, skill, state, via, created_at) VALUES (1, 'kafka', 'Kafka', 'checked', 'check', ?)").run(NOW - 2 * DAY);
  d.prepare("INSERT INTO skill_proofs (user_id, skill_key, skill, state, via, created_at) VALUES (1, 'kafka', 'Kafka', 'checked', 'check', ?)").run(NOW);   // a re-check
  d.prepare("INSERT INTO skill_proofs (user_id, skill_key, skill, state, via, url, created_at) VALUES (1, 'go', 'Go', 'built', 'link', 'https://example.com/g', ?)").run(NOW);
  d.prepare("INSERT INTO learn_opened VALUES (1, 's1-code', ?)").run(NOW);                        // a click
  d.prepare("INSERT INTO readiness_checks (user_id, skill_key, mode, started_at, finished_at) VALUES (1, 'sql', 'timed', ?, ?)").run(NOW, NOW);   // not a grade
  const ev = proofEvents(d, 1).map(e => `${e.kind}:${e.ref}:${e.points}`).sort();
  assert.deepEqual(ev, ["explained:s1#c0:10", "learn_build:s2:60", "skill_built:go:60", "skill_checked:kafka:40"]);
  assert.equal(syncPoints(d, 1), 4);
  assert.equal(syncPoints(d, 1), 0, "the same proof never pays twice");
  assert.equal(d.prepare("SELECT SUM(points) FROM proof_points WHERE user_id = 1").pluck().get(), 170);
  assert.equal(d.prepare("SELECT earned_at FROM proof_points WHERE kind = 'skill_checked'").pluck().get(), NOW - 2 * DAY, "a skill's FIRST check");
  assert.equal(proofEvents(d, 2).length, 0, "another person's proof is theirs");
  assert.deepEqual(POINTS, { explained: 10, learn_build: 60, skill_checked: 40, skill_built: 60 });
});

test("d172RunPointsOnlyFromProof: levels on the Library's ladder; the streak counts days in a row with proof", () => {
  assert.deepEqual(LEVELS.map(l => [l.n, l.name, l.at]), [[1, "Foundations", 0], [2, "Building blocks", 150], [3, "Grow past senior", 530], [4, "Lead", 1500]]);
  assert.deepEqual(levelOf(340), { n: 2, name: "Building blocks", at: 150, next: LEVELS[2], toNext: 190, pct: 50 });
  assert.equal(levelOf(0).n, 1);
  assert.equal(levelOf(2000).next, null);
  const today = Math.floor(NOW / DAY);
  // ⭐ D178-4 (changed on purpose): one rest day a week — day 3's gap is that week's rest day, so the streak runs on.
  assert.equal(streakOf(new Set([today, today - 1, today - 2, today - 4]), NOW), 4);
  assert.equal(streakOf(new Set([today - 2, today - 3]), NOW), 2, "yesterday can be the rest day");
  assert.equal(streakOf(new Set([today - 1, today - 2]), NOW), 2, "yesterday still counts — today isn't over");
  assert.equal(streakOf(new Set([today - 3]), NOW), 0);
});

test("d172RunPointsOnlyFromProof: yourRun — the total, level, streak, this week; quests only from what exists", () => {
  const d = db();
  d.prepare("INSERT INTO learn_explanations VALUES (1, 's1#c0', 's1', 'x', 30, ?, ?)").run(NOW, NOW);
  const r = yourRun(d, 1, { now: NOW });
  assert.equal(r.total, 10);
  assert.equal(r.level.n, 1);
  assert.equal(r.streak, 1);
  assert.equal(r.week, 10);
  assert.match(r.rule, /only from proof/);
  // The seed path is read (no learn_content table here): the next idea to explain is s1's second checkpoint.
  const ex = r.quests.find(q => q.id === "explain");
  assert.equal(ex.stepId, "s1"); assert.equal(ex.points, 10); assert.equal(ex.done, true, "an idea was explained today");
  assert.equal(r.quests.some(q => q.id === "prove"), false, "no skill with a check → no check quest (never invented)");
});

test("d172RunPointsOnlyFromProof: the words and links (pure)", () => {
  const run = { total: 340, streak: 4, level: levelOf(340), quests: [{ id: "explain", minutes: 2, done: false }, { id: "prove", minutes: 1, done: false }] };
  assert.deepEqual(runLines(run), { level: "Level 2: Building blocks", next: "340 of 530 points to Level 3", streak: "day streak", today: "Today · about 3 minutes" });
  assert.equal(runLines({ ...run, total: 2000, level: levelOf(2000), streak: 0, quests: [] }).next, "2000 points · the top level");
  assert.equal(questHref("/app/atlas", { id: "explain", stepId: "s1" }), "/app/atlas/learn#step-s1");
  assert.equal(questHref("/app/atlas", { id: "prove", skill: "Kafka" }), "/app/atlas/your-skills?prove=Kafka");
});

test("d172RunPointsOnlyFromProof: GET /api/atlas/run is signed-in and private; the panel and the quick check are wired", () => {
  const route = read("routes/atlas.js");
  assert.match(route, /router\.get\("\/run", \(req, res\) => \{\n    res\.set\("Cache-Control", "private, no-store"\);\n    if \(req\.user\?\.id == null\) return res\.status\(401\)/);
  assert.match(read("client/src/pages/atlas/AtlasPage.jsx"), /\{panel === "your-run" && <YourRun base=\{base\} signedIn=\{signedIn\} \/>\}/);
  assert.match(read("client/src/pages/atlas/YourSkillsPanel.jsx"), /get\("prove"\)[\s\S]{0,200}setOpenKey\(s\.key\)/, "?prove= opens that skill's own quick check");
  const css = read("client/src/pages/atlas/YourRun.css");
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i, "tokens only");
  assert.doesNotMatch(css, /border-radius:\s*(999px|50%)/, "no capsules");
});
