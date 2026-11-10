// 46a (owner 11-10: "three attempts consumed $1.40 … no breakdown on what consumed what … we need more specific analytic
// logs") · GET /api/admin/costs counted the GENERATION purposes only. `breakdown` is every recorded call by purpose × model
// × key × who started it, 24 h and 7 days, with what FAILED calls cost beside it. SYNTHETIC rows.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { at } from "../test-support/sourceAnchors.js";

test("the costs route carries a breakdown of EVERY purpose, with failed spend, by model", () => {
  const src = fs.readFileSync("server.js", "utf8");
  const start = at(src, 'app.get("/api/admin/costs", requireAdmin');
  const body = src.slice(start, at(src, 'app.post("/api/admin/costs/funding-alert/clear"', start));
  assert.match(body, /FROM usage_events e WHERE e\.created_at >= \?\s+GROUP BY 1, 2, 3, 4/, "no purpose filter: every call");
  assert.match(body, /SUM\(CASE WHEN e\.success = 0 THEN e\.cost_usd END\)/, "what failed calls cost");
  assert.match(body, /breakdown: \{ last24h: \{ rows: b24, byModel: byModel\(b24\) \}, last7d:/);
  // the SQL itself runs on the real schema and groups as described
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1, 'a', 'x')").run();
  const add = db.prepare(`INSERT INTO usage_events (user_id, event_type, purpose, model, input_tokens, output_tokens, cost_usd, success, key_label, started_by)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  add.run("resume", "resume_tailor", "claude-sonnet-5", 2400, 1100, 0.0158, 0, "tools-prod", "user");
  add.run("resume", "resume_tailor", "claude-sonnet-5", 2300, 1300, 0.0176, 1, "tools-prod", "user");
  add.run("classify", "job_classify", "claude-haiku-4-5-20251001", 900, 60, 0.0012, 1, "draft-prod", "job");
  const sql = body.match(/db\.prepare\(`(SELECT COALESCE\(e\.purpose[\s\S]*?ORDER BY costUsd DESC)`\)/)[1];
  const rows = db.prepare(sql).all(0);
  const tailor = rows.find(r => r.purpose === "resume_tailor");
  assert.deepEqual([tailor.calls, tailor.failedCalls, tailor.costUsd, tailor.failedCostUsd, tailor.key], [2, 1, 0.0334, 0.0158, "tools-prod"]);
  assert.ok(rows.some(r => r.purpose === "job_classify" && r.model === "claude-haiku-4-5-20251001"), "a non-generation purpose is listed");
});
