// D185-5 (45q, owner 11-09) · outcomes as the north star: interviews / offers per resolved application and per active
// person, by week, split by who sent it — counts only, D111's vocabulary, the inbox and the person's own marks.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { outcomeMetrics, gatherOutcomeApps, weekOf, sentBy, countsOf } from "../services/outcomeMetrics.js";

const NOW = Date.parse("2026-11-09T12:00:00Z") / 1000;
const DAY = 86400;

test("d185OutcomesPerUser: interviews per resolved application and per active person; unresolved and withdrawn count nowhere", () => {
  const apps = [
    // person 1: two draft-sent; one interview (their own mark), one old silence
    { user_id: 1, job_id: "a", applied_at: NOW - 40 * DAY, apply_mode: "AUTO", source: "greenhouse", response_outcome: "interview", furthest_stage: "interview", first_response_at: NOW - 35 * DAY },
    { user_id: 1, job_id: "b", applied_at: NOW - 40 * DAY, apply_mode: "AUTO", source: "lever" },
    // person 2: sent themselves; an offer learnt from the inbox; and a fresh one with no answer yet (unresolved)
    { user_id: 2, job_id: "c", applied_at: NOW - 20 * DAY, apply_mode: "MANUAL", source: "ashby", inboxCategories: ["interview", "offer"] },
    { user_id: 2, job_id: "d", applied_at: NOW - 2 * DAY, apply_mode: "MANUAL", source: "ashby" },
    // person 3: withdrawn — in no count
    { user_id: 3, job_id: "e", applied_at: NOW - 40 * DAY, apply_mode: "AUTO", response_outcome: "withdrawn" },
    // a CSV import is the person's own, whatever its mode says
    { user_id: 3, job_id: "f", applied_at: NOW - 40 * DAY, apply_mode: "AUTO", source: "csv_import" },
  ];
  const m = outcomeMetrics(apps, { now: NOW, weeks: 12 });
  assert.equal(m.totals.all.sent, 6);
  assert.equal(m.totals.all.resolved, 4, "a, c: replied · b, f: 30+ days silent; d unresolved; e withdrawn");
  assert.equal(m.totals.all.interviews, 2);
  assert.equal(m.totals.all.offers, 1);
  assert.equal(m.totals.all.activeUsers, 3);
  assert.equal(m.totals.all.interviewedUsers, 2);
  assert.equal(m.totals.draft.sent, 3); assert.equal(m.totals.draft.interviews, 1);
  assert.equal(m.totals.self.sent, 3); assert.equal(m.totals.self.interviews, 1);
  assert.deepEqual(m.knownBy, { inbox: 1, mark: 1 });
  assert.equal(m.rules.noPercent, true);
  assert.ok(!JSON.stringify(m).includes("%"), "no percent leaves the service");
  assert.equal(m.weeks.length >= 12, true);
  assert.equal(new Set(m.weeks.map(w => w.week)).size, m.weeks.length, "each week once");
  assert.equal(m.weeks.reduce((s, w) => s + w.all.sent, 0), 6, "every application lands in its week");
});

test("d185OutcomesPerUser: the pieces — Monday weeks, who sent it, an offer counts only once resolved", () => {
  assert.equal(weekOf(Date.parse("2026-11-09T12:00:00Z") / 1000), "2026-11-09");   // a Monday
  assert.equal(weekOf(Date.parse("2026-11-15T23:00:00Z") / 1000), "2026-11-09");   // its Sunday
  assert.equal(sentBy({ apply_mode: "AUTO", source: "greenhouse" }), "draft");
  assert.equal(sentBy({ apply_mode: "MANUAL" }), "self");
  assert.equal(sentBy({ apply_mode: "AUTO", source: "csv_import" }), "self");
  assert.deepEqual(countsOf({ applied_at: NOW - DAY }, { now: NOW }), { counted: false, replied: false, interviewed: false, offered: false });
});

test("d185OutcomesPerUser: the reader takes the marks and the inbox's categories by name, never the rejection note", async () => {
  const db = new Database(":memory:");
  for (const mm of MIGRATIONS) db.exec(mm.sql);
  db.prepare("INSERT INTO users (id, username, password_hash, password_set) VALUES (5, 'r', 'h', 1)").run();
  db.prepare(`INSERT INTO job_applications (user_id, job_id, company, role, applied_at, apply_mode, response_outcome, rejection_note)
    VALUES (5, 'j1', 'Co', 'Eng', ?, 'AUTO', 'rejected', 'private words')`).run(NOW - 40 * DAY);
  const read = { all: async (sql, p = []) => db.prepare(sql).all(...p) };
  const rows = await gatherOutcomeApps(read, { now: NOW, weeks: 12 });
  assert.equal(rows.length, 1);
  assert.ok(!JSON.stringify(rows).includes("private words"));
  const src = fs.readFileSync(new URL("../services/outcomeMetrics.js", import.meta.url), "utf8");
  assert.ok(!/ja\.\*/.test(src.replace(/never ja\.\*/g, "")), "named columns only");
  const server = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8");
  assert.ok(server.includes('app.get("/api/admin/outcomes", requireAdmin'));
  assert.ok(server.includes("gatherOutcomeApps(readPool,"), "read on the workers");
});
