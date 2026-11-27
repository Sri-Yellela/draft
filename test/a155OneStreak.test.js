// ⭐ A155 (45o) · Atlas's dropped D178 pieces — ONE streak lit by every real act (a check, an idea explained, a build,
// Today's question answered, a proof link added), the "weekdays only" choice (migration 251), and "Proven: you can add
// Kafka to your résumé" with one button. Synthetic data only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { streakRun, isWeekend, proofDays, atlasPrefs, setAtlasPrefs, monthOf } from "../services/atlas/points.js";

const DAY = 86400;
const dayNum = (iso) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86400000);

test("A155 · weekdays only: a weekend without proof neither breaks the streak nor uses the rest day", () => {
  assert.equal(isWeekend(dayNum("2026-11-07")), true, "Saturday");
  assert.equal(isWeekend(dayNum("2026-11-08")), true, "Sunday");
  assert.equal(isWeekend(dayNum("2026-11-09")), false, "Monday");
  // Thu 11-05, Fri 11-06 lit; weekend empty; Mon 11-09 lit; end on Mon
  const days = new Set(["2026-11-05", "2026-11-06", "2026-11-09"].map(dayNum));
  const end = dayNum("2026-11-09");
  assert.equal(streakRun(days, end).count, 1, "every day counts: two empty days in one week break it");
  const wk = streakRun(days, end, { weekdaysOnly: true });
  assert.equal(wk.count, 3, "weekdays only: the empty weekend is skipped");
  assert.equal(wk.rest.size, 0, "and the week's rest day is not spent on it");
  const m = monthOf(days, end * DAY + 3600, { weekdaysOnly: true });
  assert.ok(m.find((d) => d.day === dayNum("2026-11-07")).off, "the month draws the skipped weekend as off");
});

test("A155 · one set of proof days: points + Today's question answered + a proof link; the choice is stored per person", () => {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE proof_points (user_id INTEGER, earned_at INTEGER);
    CREATE TABLE daily_questions (user_id INTEGER, day TEXT, answered_at INTEGER);
    CREATE TABLE profile_evidence (user_id INTEGER, created_at INTEGER);
    CREATE TABLE atlas_prefs (user_id INTEGER PRIMARY KEY, weekdays_only INTEGER NOT NULL DEFAULT 0, updated_at INTEGER);`);
  db.prepare(`INSERT INTO proof_points VALUES (1, ?)`).run(dayNum("2026-11-02") * DAY + 100);
  db.prepare(`INSERT INTO daily_questions VALUES (1, '2026-11-03', 1), (1, '2026-11-04', NULL)`).run();
  db.prepare(`INSERT INTO profile_evidence VALUES (1, ?)`).run(dayNum("2026-11-05") * DAY + 100);
  db.prepare(`INSERT INTO proof_points VALUES (2, ?)`).run(dayNum("2026-11-04") * DAY);   // another person's proof
  const d = proofDays(db, 1);
  assert.deepEqual([...d].sort(), ["2026-11-02", "2026-11-03", "2026-11-05"].map(dayNum), "an unanswered question lights nothing");
  assert.deepEqual(atlasPrefs(db, 1), { weekdaysOnly: false }, "no row = the default");
  assert.deepEqual(setAtlasPrefs(db, 1, { weekdaysOnly: true }), { weekdaysOnly: true });
  assert.deepEqual(setAtlasPrefs(db, 1, { weekdaysOnly: "yes" }), { weekdaysOnly: false }, "only a literal true turns it on");
});

// ⛔ 47m (changed on purpose): "A155 · the migration, the route, Today's question shows the one streak, the one-" retired — Your run is the Logbook on Your map (D197 #11, pages/atlas/Logbook.jsx).
