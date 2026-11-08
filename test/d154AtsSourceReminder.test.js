import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { atsMissingTerms } from "../services/learn/dailyQuestion.js";
import { readReminder, setReminder, dueReminders, runDailyReminders, localNow } from "../services/learn/dailyReminder.js";
import { NOTIFY_EVENTS, eventText } from "../services/notify.js";
import { MERGE_PLAN } from "../services/accountService.js";

// ⭐ D154 P1 (45m) · source (4) — skills the ATS shows missing in the jobs a person saved or applied to — and the
// reminder, off by default. Synthetic person and jobs.

function freshDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'dana','x')").run();
  return db;
}
const t = (iso) => Math.floor(Date.parse(iso) / 1000);

test("d154AtsMissingSource — the saved / applied jobs' missing skills, most-asked first; never the whole board", () => {
  const db = freshDb();
  db.prepare("INSERT INTO user_jobs (user_id, job_id, starred, applied) VALUES (1,'j1',1,0), (1,'j2',0,1), (1,'j3',0,0)").run();
  const rep = (m) => JSON.stringify({ tier1_missing: m });
  db.prepare("INSERT INTO ats_only_reports (user_id, job_id, ats_report) VALUES (1,'j1',?),(1,'j2',?),(1,'j3',?)")
    .run(rep(["Apache Kafka", "Terraform"]), rep(["Apache Kafka"]), rep(["Rust"]));
  assert.deepEqual(atsMissingTerms(db, 1), ["apache kafka", "terraform"], "j3 (only scored by the board) is not read");
});

test("d154ReminderOffByDefault — no reminder until the person turns it on; one a day at their hour; none once answered", async () => {
  const db = freshDb();
  assert.deepEqual(NOTIFY_EVENTS.daily_question.defaults, { push: false, email: false });
  assert.equal(readReminder(db, 1).on, false);
  assert.equal(dueReminders(db, t("2026-11-09T23:00:00Z")).length, 0);
  setReminder(db, 1, { on: true, hour: 9, tzOffsetMin: 300, channel: "push" });
  assert.deepEqual(localNow(t("2026-11-09T14:10:00Z"), 300), { day: "2026-11-09", hour: 9 });
  assert.equal(dueReminders(db, t("2026-11-09T13:30:00Z")).length, 0, "before their hour");
  let n = 0;
  assert.equal(await runDailyReminders(db, async () => { n++; }, t("2026-11-09T14:10:00Z")), 1);
  assert.equal(await runDailyReminders(db, async () => { n++; }, t("2026-11-09T18:00:00Z")), 0, "once a day");
  db.prepare("INSERT INTO daily_questions (user_id, day, question_id, reason, answered_at, created_at) VALUES (1,'2026-11-10','q','any',1,1)").run();
  assert.equal(dueReminders(db, t("2026-11-10T15:00:00Z")).length, 0, "answered → no reminder");
  setReminder(db, 1, { on: false });
  assert.equal(dueReminders(db, t("2026-11-11T15:00:00Z")).length, 0);
  assert.throws(() => setReminder(db, 1, { on: true, hour: 25 }), /0 to 23/);
  assert.ok(!/kafka|job|company/i.test(eventText("daily_question").body), "the words name no skill or job");
  assert.equal(MERGE_PLAN.daily_reminders, "keepInto");
});
