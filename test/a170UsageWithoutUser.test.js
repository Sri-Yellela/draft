// ⭐ A170 (46b): usage that could be recorded nowhere — a model call with no user (null / undefined) failed
// usage_events.user_id's NOT NULL insert and its [usage] line was skipped. Now it is recorded against the system row
// (id 0, migration 075), and a failure that still happens says the tokens and dollars in its loud line.
import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { trackApiCall } from "../services/usageTracker.js";

const freshDb = () => { const db = new Database(":memory:"); for (const m of MIGRATIONS) db.exec(m.sql); return db; };
const usage = { input_tokens: 1200, output_tokens: 300 };

test("a170NullUserRecordedAsSystem: null and undefined users land on the system row with their cost", () => {
  const db = freshDb();
  const info = console.info; console.info = () => {};
  try {
    for (const userId of [null, undefined]) trackApiCall(db, { userId, eventType: "enrich", purpose: "enrich", model: "claude-haiku-4-5", usage });
  } finally { console.info = info; }
  const rows = db.prepare("SELECT user_id, input_tokens, cost_usd FROM usage_events").all();
  assert.equal(rows.length, 2);
  assert.ok(rows.every(r => r.user_id === 0 && r.input_tokens === 1200), JSON.stringify(rows));
  assert.equal(db.prepare("SELECT COUNT(*) FROM usage_tracking_failures").pluck().get(), 0);
});

test("a170FailureSaysTheSpend: a record that still fails names the tokens and dollars, loudly", () => {
  const db = freshDb();
  const lines = [];
  const err = console.error, info = console.info; console.error = (l) => lines.push(String(l)); console.info = () => {};
  try { trackApiCall(db, { userId: 999, eventType: "x", purpose: "x", model: "claude-haiku-4-5", usage }); }   // no such user → FK fails
  finally { console.error = err; console.info = info; }
  assert.ok(lines.some(l => /FAILED TO RECORD USAGE/.test(l) && /in=1200 out=300/.test(l) && /costUsd=\d/.test(l)), lines.join("\n"));
  assert.equal(db.prepare("SELECT COUNT(*) FROM usage_tracking_failures").pluck().get(), 1);
});
