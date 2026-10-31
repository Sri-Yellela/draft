// ⭐ D111 · d111ExcludesWithdrawn (owner 10-31, the Draft House tree's leftovers): an application the user WITHDREW is
// neither a reply nor silence — it is in no count of the callback rates, whatever had been heard before it. Synthetic
// applications only.
import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { callbackRates, answerOf, gatherCallbackApps } from "../services/callbackRates.js";

const DAY = 86400;
const NOW = Math.floor(Date.UTC(2026, 9, 31, 12) / 1000);
const old = (o = {}) => ({ appliedAt: NOW - 60 * DAY, role: "Backend Engineer", ...o });

test("D111 · d111ExcludesWithdrawn — a withdrawn application is in no count: not a reply, not silence", () => {
  // Old enough to count as silence, and with an inbox reply and a first response — withdrawn wins every time.
  for (const o of [{}, { inboxCategories: ["interview"] }, { firstResponseAt: NOW - 50 * DAY, furthestStage: "interview" }]) {
    assert.deepEqual(answerOf(old({ responseOutcome: "withdrawn", ...o }), { now: NOW }), { counted: false, replied: false, interviewed: false }, JSON.stringify(o));
  }
  // 15 silent + 5 withdrawn: the denominator is the 15, and the 5 move neither count.
  const apps = [...Array.from({ length: 15 }, () => old()), ...Array.from({ length: 5 }, () => old({ responseOutcome: "withdrawn", inboxCategories: ["rejection"] }))];
  const r = callbackRates(apps, { now: NOW });
  assert.equal(r.counted, 15);
  assert.equal(r.replied, 0);
  // And from the tables: "I withdrew it" (job_applications.response_outcome) is read through the one reader.
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'dana','x')").run();
  db.prepare("INSERT INTO job_applications (user_id, job_id, company, role, applied_at, response_outcome) VALUES (1, 'w', 'Northwind', 'SWE', ?, 'withdrawn')").run(NOW - 60 * DAY);
  const rows = gatherCallbackApps(db, 1);
  assert.equal(rows.length, 1);
  assert.equal(answerOf(rows[0], { now: NOW }).counted, false);
});
