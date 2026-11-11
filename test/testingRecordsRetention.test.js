// ⛔ Owner 11-07: "survey results are exempt, everything else write code to automatically delete and show as no longer
// available if pursued." The privacy page keeps the early-testing records 90 days; this deletes them after (synthetic).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { sweepTestingRecords, retentionNote, RETENTION_DAYS, SWEPT_TABLES, EXEMPT_TABLES } from "../services/testingRecords.js";
import { testerContacts } from "../services/testerContacts.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const NOW = 1_800_000_000, DAY = 86400;

test("testingRecordsSweptAt90DaysSurveysKept: events and feedback older than 90 days go; survey answers never do", () => {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (21, 'tester', 'x')").run();
  const old = NOW - (RETENTION_DAYS + 1) * DAY, recent = NOW - 5 * DAY;
  for (const at of [old, recent]) {
    db.prepare("INSERT INTO trial_events (user_id, event, detail, created_at) VALUES (21, 'page', 'home', ?)").run(at);
    db.prepare("INSERT INTO trial_feedback (user_id, screen, body, created_at) VALUES (21, 'home', 'a note', ?)").run(at);
  }
  db.prepare("INSERT INTO trial_surveys (user_id, answers, created_at) VALUES (21, '{}', ?)").run(old);
  assert.equal(retentionNote(db), null, "nothing to say before a sweep");
  const r = sweepTestingRecords(db, { now: NOW });
  assert.deepEqual(r.deleted, { trial_events: 1, trial_feedback: 1 });
  const n = (t) => db.prepare(`SELECT COUNT(*) FROM ${t}`).pluck().get();
  assert.deepEqual([n("trial_events"), n("trial_feedback"), n("trial_surveys")], [1, 1, 1], "the recent rows and the old SURVEY answer stay");
  assert.deepEqual(SWEPT_TABLES, ["trial_events", "trial_feedback"]);
  assert.ok(EXEMPT_TABLES.includes("trial_surveys") && EXEMPT_TABLES.includes("standalone_surveys"));
  const note = retentionNote(db);
  assert.equal(note.before, NOW - RETENTION_DAYS * DAY);
  assert.match(note.text, /no longer available/);
  assert.match(testerContacts(db).retention.text, /older than 90 days are no longer available/, "pursued: Admin → Testers says so");
});

test("testingRecordsSweptDaily: the nightly job, the admin's note, and the policy that promises it", () => {
  const s = read("server.js");
  assert.match(s, /cron\.schedule\("40 3 \* \* \*", \(\) => \{\n\s+try \{\n\s+const r = sweepTestingRecords\(db\);/);
  assert.match(read("client/src/panels/adminTesterDetails.jsx"), /\{d\.retention && <p data-testing-retention="" [^>]*>\{d\.retention\.text\}<\/p>\}/);
  const policy = read("client/src/pages/marketing/PrivacyPage.jsx");
  assert.match(policy, /They are kept with your account for 90 days and then\n\s+deleted automatically; survey answers are kept\./);
  assert.doesNotMatch(policy, /\btrial\b|guided tour/i);
});

// ⭐ 46f · 45f's "not done": the Testers REPORT panel shows the retention line too (the JSON always carried it).
test("testingRecordsRetention: the Testers report panel says what the 90-day sweep removed", async () => {
  const fsm = await import("node:fs");
  const src = fsm.readFileSync("client/src/panels/adminTesters.jsx", "utf8");
  if (!/\{d\.retention && <p data-testing-retention="" style=\{\{ \.\.\.muted, margin: "0 0 10px" \}\}>\{d\.retention\.text\}<\/p>\}/.test(src)) throw new Error("the report panel draws d.retention.text");
});
