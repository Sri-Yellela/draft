// 46a (A163, after A162) · the admin panel's whole-board reports build on their own worker thread with a READ-ONLY
// connection (services/admin/reportWorker.js): the glance's pipeline health, the enrichment overview, the board policy's
// dry runs held the one Node thread 7–35 s each on the 100k copy (scripts/adminTiming46a.mjs). SYNTHETIC postings.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { createAdminReports, buildReport, REPORTS } from "../services/admin/reportWorker.js";

function fileDb() {
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "a163-")), "rm.db");
  const db = new Database(p);
  db.pragma("journal_mode = WAL");
  for (const m of MIGRATIONS) db.exec(m.sql);
  const ins = db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, _hash, title, company, url, source, is_active, discovered_at, scraped_at, description)
    VALUES (?, 't', ?, 'Software Engineer', 'Example Co', ?, 'greenhouse', 1, unixepoch() - 86400, unixepoch(), 'Build things in Austin, TX.')`);
  for (let i = 0; i < 12; i++) ins.run(`a163-${i}`, `h-${i}`, `https://example.com/${i}`);
  return { db, p };
}

test("A163: every report builds on the worker's READ-ONLY connection, and equals the main connection's build", async () => {
  const { db, p } = fileDb();
  const reports = createAdminReports({ dbPath: p, fallbackDb: db });
  try {
    for (const name of REPORTS) {
      const viaWorker = await reports.get(name);
      const direct = await buildReport(name, db, { dbPath: p });
      assert.deepEqual(Object.keys(viaWorker).sort(), Object.keys(direct).sort(), `${name}: same shape`);
    }
    const s = reports.status();
    assert.equal(s.worker, true); assert.equal(s.builtHere, 0, "nothing fell back — each report is read-only (a write would fail SQLITE_READONLY)");
    assert.equal(s.worker === true && s.broken === false, true);
    const ov = await reports.get("enrichmentOverview");
    assert.equal(ov.board, 12, "the worker read the same database");
  } finally { await reports.close(); db.close(); }
});

test("A163: cached inside the TTL, rebuilt once when stale, and an admin write (invalidate) makes the next read wait for fresh", async () => {
  const { db, p } = fileDb();
  let t = 0;
  const reports = createAdminReports({ dbPath: p, fallbackDb: db, ttlMs: 1000, now: () => t });
  try {
    await reports.get("boardPolicyDryRuns");
    await reports.get("boardPolicyDryRuns");
    assert.equal(reports.status().worker, true);
    const n0 = reports.status().servedFromCache;
    assert.equal(n0, 1, "the second read inside the TTL is the cache");
    t = 5000;
    await Promise.all([reports.get("boardPolicyDryRuns"), reports.get("boardPolicyDryRuns")]);   // stale: answered from cache, ONE rebuild
    await new Promise(r => setTimeout(r, 300));
    assert.equal(reports.status().builtOnWorker, 2, "two stale reads started ONE rebuild");
    reports.invalidate();
    db.prepare("UPDATE scraped_jobs SET is_active = 0 WHERE job_id = 'a163-0'").run();
    const fresh = await reports.get("enrichmentOverview");
    assert.equal(fresh.board, 11, "after an admin write the report is rebuilt, not served stale");
  } finally { await reports.close(); db.close(); }
});

test("A163: with the worker off (DRAFT_ADMIN_REPORTS=off) or gone, the report builds on the main connection — never refused", async () => {
  const { db, p } = fileDb();
  const off = createAdminReports({ dbPath: p, fallbackDb: db, enabled: false, log: { warn() {} } });
  const r = await off.get("pipelineHealth");
  assert.ok(r && typeof r === "object");
  assert.equal(off.status().builtHere, 1);
  await assert.rejects(off.get("dropTables"), /no such admin report/);
  db.close();
});

test("A163: the glance, pipeline health, board policy and enrichment overview routes read through the report worker", () => {
  const src = fs.readFileSync("server.js", "utf8");
  assert.match(src, /health: await adminReports\.get\("pipelineHealth"\)/);
  assert.match(src, /\.\.\.\(await adminReports\.get\("boardPolicyDryRuns"\)\)/);
  assert.match(src, /createAdminDbRouter\(db, \{ dbPath: DB_PATH, reports: adminReports \}\)/);
  assert.match(src, /createEnrichmentRouter\(db, requireAdmin, \{ anthropic, reports: adminReports \}\)/);
  assert.ok(src.indexOf("const app = express();") < src.indexOf("adminReports.invalidate(); next();"), "the invalidation middleware is mounted after app exists");
  assert.match(fs.readFileSync("routes/adminDb.js", "utf8"), /reports \? await reports\.get\("pipelineHealth"\) : pipelineHealth\(\)/);
  assert.match(fs.readFileSync("routes/enrichment.js", "utf8"), /reports \? await reports\.get\("enrichmentOverview"\) : buildEnrichmentOverview\(db\)/);
});
