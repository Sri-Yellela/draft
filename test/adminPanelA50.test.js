// A50 — the admin panel: wrong numbers fixed, curl-only surfaces given a UI, the daily glance.
//
// Each test names the defect it pins. Synthetic data only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { createAdminRouter } from "../routes/admin.js";
import { buildGlance, utcDayStart } from "../services/adminGlance.js";
import { createBoardFitPrecompute, atsJobInputHash } from "../services/jobs/boardFitPrecompute.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
// Comments stripped: several of these files EXPLAIN in prose what was removed, and the explanation
// must not read as the thing still being there.
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1")
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
// A region anchor that THROWS when missing — never a bare indexOf inside slice (sourceAnchorGuard).
function at(text, needle, from = 0) {
  const i = text.indexOf(needle, from);
  if (i < 0) throw new Error(`anchor not found: ${needle}`);
  return i;
}

function analyticsServer({ withIngestTables = true } = {}) {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT NOT NULL, created_at INTEGER DEFAULT 0, aplus_resume INTEGER DEFAULT 0);
    CREATE TABLE usage_events (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, event_type TEXT NOT NULL,
      event_subtype TEXT, input_tokens INTEGER DEFAULT 0, output_tokens INTEGER DEFAULT 0, cache_read_tokens INTEGER DEFAULT 0,
      cache_creation_tokens INTEGER DEFAULT 0, cached INTEGER DEFAULT 0, model TEXT, cost_usd REAL DEFAULT 0,
      ats_score_before INTEGER, ats_score_after INTEGER, duration_ms INTEGER, job_id TEXT, company TEXT,
      success INTEGER NOT NULL DEFAULT 1, error_text TEXT, purpose TEXT, provider TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE cache_events (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, event_type TEXT NOT NULL,
      layer TEXT, domain_module TEXT, tokens_saved INTEGER DEFAULT 0, cost_saved_usd REAL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE user_limits (id INTEGER PRIMARY KEY, user_id INTEGER UNIQUE);
    -- scrape_events exists and holds a row: if anything still read it, the number would show up.
    CREATE TABLE scrape_events (id INTEGER PRIMARY KEY, user_id INTEGER, inserted_count INTEGER, created_at INTEGER);
    INSERT INTO scrape_events VALUES (1, 1, 999, unixepoch());
    INSERT INTO users (id, username) VALUES (1, 'synthetic-admin');
  `);
  if (withIngestTables) {
    const now = Math.floor(Date.now() / 1000);
    db.exec(`
      CREATE TABLE scraped_jobs (id INTEGER PRIMARY KEY, job_id TEXT, discovered_at INTEGER, scraped_at INTEGER);
      CREATE TABLE pipeline_runs (id INTEGER PRIMARY KEY, run_kind TEXT, source TEXT, status TEXT, started_at INTEGER);
    `);
    const ins = db.prepare("INSERT INTO scraped_jobs (job_id, discovered_at, scraped_at) VALUES (?, ?, ?)");
    ins.run("in-range-1", now - 3600, now);
    ins.run("in-range-2", now - 7200, now);
    ins.run("old", now - 90 * 86400, now);          // re-crawled today, first seen long ago: NOT discovered
    const run = db.prepare("INSERT INTO pipeline_runs (run_kind, source, status, started_at) VALUES (?, ?, ?, ?)");
    run.run("source_sync", "greenhouse", "ok", now - 3600);
    run.run("source_sync", "lever", "failed", now - 3500);
    run.run("enrichment", null, "ok", now - 3400);  // not a crawl
  }
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 1, isAdmin: true }; next(); });
  app.use("/api/admin/analytics", createAdminRouter(db));
  const server = app.listen(0);
  return { db, server, base: `http://127.0.0.1:${server.address().port}/api/admin/analytics` };
}

test("A50 #1: 'Jobs Scraped' no longer reads scrape_events — it reports postings first seen and crawl runs", async () => {
  const src = code(read("routes/admin.js"));
  assert.doesNotMatch(src, /FROM\s+scrape_events/i,
    "routes/admin.js reads scrape_events again — nothing has written it since cleanup 5.8, so it is a permanent 0");
  const { server, base } = analyticsServer();
  try {
    const ov = await fetch(`${base}/overview`).then(r => r.json());
    assert.equal(ov.postingsDiscovered, 2, "discovered_at in range, not scraped_at (a re-crawl is not a discovery)");
    assert.equal(ov.crawlRuns, 2, "source_sync runs only — an enrichment run is not a crawl");
    assert.equal(ov.crawlRunsFailed, 1);
    assert.ok(!("totalScrapes" in ov) && !("totalJobsInserted" in ov), "the dead scrape_events fields are gone");
    const users = await fetch(`${base}/users`).then(r => r.json());
    assert.ok(!("jobScrapes" in users[0]), "per-user scrapes were 0 for everyone; the column is removed");
  } finally { server.close(); }
});

test("A50 #1: a database without the ingestion tables reports null ('not measurable'), never a confident 0", async () => {
  const { server, base } = analyticsServer({ withIngestTables: false });
  try {
    const ov = await fetch(`${base}/overview`).then(r => r.json());
    assert.equal(ov.postingsDiscovered, null);
    assert.equal(ov.crawlRuns, null);
  } finally { server.close(); }
  const panel = code(read("client/src/panels/AdminPanel.jsx"));
  assert.match(panel, /Postings Discovered/);
  assert.doesNotMatch(panel, /Jobs Scraped|totalJobsInserted|jobScrapes/);
});

test("A50 #1: the raw ledger UI draws success / error_text (the Groq outage would have been invisible)", () => {
  const panel = code(read("client/src/panels/AdminPanel.jsx"));
  assert.match(panel, /callFailed\(call\)/, "the ledger row no longer checks the call's result");
  assert.match(panel, /\{callFailed\(call\) \? \(\s*<div[\s\S]{0,300}?FAILED · \{call\.error_text/,
    "the Result cell must branch on the call's success and print error_text when it failed");
  assert.match(panel, /<div>Result<\/div>/);
  // and the route still returns both — the UI fix is worthless if the field goes away under it
  assert.match(code(read("routes/admin.js")), /ue\.success,\s*\n\s*ue\.error_text/);
  // the raw ledger stays the honest definition: every model call, no allowlist
  assert.match(code(read("routes/admin.js")), /AND ue\.model IS NOT NULL/);
});

test("A50 #1: the Backups copy states the byte budget, with the numbers backup.js actually uses", () => {
  const panel = read("client/src/panels/adminOps.jsx");   // D83 (39d): the backups moved into Today → Disk and backups
  assert.ok(!/kept for the last 30 snapshots/.test(code(panel)), "the count-only retention claim is back");
  const backup = read("packages/sqlite-backup/src/index.js");   // A65: the policy's home
  const maxCount = Number(backup.match(/envInt\("BACKUP_MAX_COUNT", (\d+)\)/)[1]);
  const minKeep = Number(backup.match(/envInt\("BACKUP_MIN_KEEP", (\d+)\)/)[1]);
  const share = Number(backup.match(/: (0\.\d+);\s*\n\}\)\(\);/)[1]);
  assert.match(panel, new RegExp(`at most ${maxCount} snapshots and at most ${Math.round(share * 100)}% of the\\s+volume`),
    "the copy's count cap / disk share no longer match scripts/backup.js");
  assert.match(panel, new RegExp(`never fewer than ${minKeep}`));
  assert.match(panel, /byte budget/);
});

test("A50 #1: 'A+ Resume' says it SWAPS the user's Generate, and asks first", () => {
  // The copy is only true while the server still swaps — if the swap goes, this fails and says so.
  assert.match(read("server.js"), /if \(userFlags\?\.aplus_resume\) tool = "a_plus_resume";/,
    "the silent swap in /api/generate is gone — update the A+ override copy in AdminPanel.jsx");
  // D88 (39d): the A+ override is the a_plus_default row of a person's Feature access (panels/adminPeople.jsx).
  const panel = code(read("client/src/panels/adminPeople.jsx"));
  const fnStart = at(panel, "const setOverride = (f) => setAction({");
  const fn = panel.slice(fnStart, at(panel, "const clearOverride", fnStart));
  // the write is the action's `run`, which only ActionDialog's confirm calls — and only once a reason is given
  assert.match(fn, /run: \(v\) => post\("\/overrides", \{ feature: f\.key, reason: v\.reason,/);
  const dialog = panel.slice(at(panel, "function ActionDialog("), at(panel, "export function PeopleList("));
  assert.match(dialog, /if \(!ready\) return;/, "the confirm must GATE the write");
  assert.ok(at(dialog, "if (!ready) return;") < at(dialog, "await action.run("));
  assert.match(fn, /f\.key === "a_plus_default" && <> When on, this user's Generate is silently replaced by the A\+ Resume prompt/);
  assert.match(panel, /silently replaced by the A\+ Resume prompt/);
});

test("A50 #1: no admin file carries the stale 'SCHEDULED FOR REMOVAL' banner", () => {
  for (const f of ["client/src/panels/AdminPanel.jsx", "client/src/pages/admin/DBInspector.jsx",
                   "routes/admin.js", "routes/adminDb.js"]) {
    assert.doesNotMatch(read(f).split("\n")[0], /SCHEDULED FOR REMOVAL/, `${f} line 1`);
  }
  assert.ok(!/Lucy/.test(code(read("client/src/panels/AdminPanel.jsx"))), "the yellow \"Lucy\" labels are back");
});

// ── step 3: the glance ────────────────────────────────────────────────────────────────────────
function glanceDb(now) {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE usage_events (id INTEGER PRIMARY KEY, user_id INTEGER, purpose TEXT, cost_usd REAL, success INTEGER DEFAULT 1, created_at INTEGER);
    CREATE TABLE usage_tracking_failures (id INTEGER PRIMARY KEY, created_at INTEGER);
    CREATE TABLE apply_runs (id INTEGER PRIMARY KEY, status TEXT);
    CREATE TABLE apply_run_jobs (id INTEGER PRIMARY KEY, status TEXT, started_at INTEGER, finished_at INTEGER, created_at INTEGER);
  `);
  const day = utcDayStart(now);
  const ue = db.prepare("INSERT INTO usage_events (user_id, purpose, cost_usd, success, created_at) VALUES (0, ?, ?, ?, ?)");
  ue.run("enrich_job", 0.25, 1, day + 10);
  ue.run("enrich_job", 0, 0, day + 20);         // a failed call today
  ue.run("generate", 1.5, 1, day + 30);
  ue.run("enrich_job", 9, 1, day - 10);         // yesterday: NOT today
  db.prepare("INSERT INTO usage_tracking_failures (created_at) VALUES (?)").run(day + 40);
  db.exec(`INSERT INTO apply_runs (status) VALUES ('running'), ('completed'), ('queued');`);
  const aj = db.prepare("INSERT INTO apply_run_jobs (status, finished_at, created_at) VALUES (?, ?, ?)");
  aj.run("submitted", now - 100, now - 200);
  aj.run("held_review", null, now - 300);
  aj.run("submitted", now - 3 * 86400, now - 3 * 86400);   // outside 24h
  return db;
}
const HEALTH = {
  generatedAt: 1000,
  alertCounts: { critical: 1, warn: 0 },
  alerts: [{ severity: "critical", kind: "source", subject: "lever", detail: "last run failed" }],
  sources: [
    { name: "greenhouse", health: "ok", active: 10, lastRun: { at: 900, status: "ok", written: 3, unchanged: 7, dropped: 1, ejected: 0 }, lastSuccessAt: 900 },
    { name: "lever", health: "failed", active: 0, lastRun: { at: 950, status: "failed", written: 0, unchanged: 0, dropped: 0, ejected: 0 } },
    { name: "adzuna", health: "live_search_only", active: 0, lastRun: null },
  ],
  enrichment: {
    activeTotal: 100, waitingForEnrichment: 40, noDescription: 2, lastEnrichedAt: 800,
    coverage: [{ column: "skills_json", nonNull: 60, total: 100, pct: 60 }, { column: "salary_min", nonNull: 0, total: 100, pct: 0 }],
    recentRuns: [{ started_at: 800, health: "ok", written: 25, failed: 0 }],
  },
};

test("A50 #3: the glance SELECTS from pipelineHealth() — it refuses to run without it and never recomputes it", () => {
  assert.throws(() => buildGlance(new Database(":memory:"), {}), /pipelineHealth/);
  const src = code(read("services/adminGlance.js"));
  assert.doesNotMatch(src, /FROM\s+scraped_jobs|FROM\s+pipeline_runs|FROM\s+source_companies/i,
    "the glance derives ingestion/enrichment itself — that is a second health computation");
  assert.match(code(read("server.js")),
    /app\.get\("\/api\/admin\/glance", requireAdmin,[\s\S]{0,200}health: adminDbRouter\.pipelineHealth\(\)/,
    "the glance route must hand buildGlance the SAME pipelineHealth() the nightly alert reads");
});

test("A50 #3: every glance section states when it was measured, and today's numbers are today's", () => {
  const now = utcDayStart(1_800_000_000) + 50_000;
  const g = buildGlance(glanceDb(now), { health: HEALTH, now,
    enrichBudget: { maxUsd: 1, maxRows: 300 }, fullAuto: { disabled: true, source: "override" } });
  for (const k of ["ingestion", "enrichment", "scoring", "apply", "spend"]) {
    assert.ok(Number.isFinite(g[k].measuredAt), `${k} has no measuredAt`);
  }
  assert.equal(g.ingestion.lastCrawlAt, 950);
  assert.deepEqual(g.ingestion.sourcesNeedingAttention, ["lever"], "live_search_only is benign, failed is not");
  assert.equal(g.ingestion.sources[0].refused, 1);
  assert.equal(g.enrichment.waiting, 40);
  assert.deepEqual(g.enrichment.columnsAtZero, ["salary_min"]);
  assert.equal(g.enrichment.today.costUsd, 0.25, "yesterday's enrichment spend leaked into today");
  assert.equal(g.enrichment.today.failedCalls, 1);
  assert.equal(g.enrichment.today.capUsd, 1);
  assert.equal(g.scoring.enrichedShare, 0.6);
  assert.ok(Math.abs(g.scoring.expectedDeclineShare - 0.12) < 1e-9, "40% unenriched x ~30% (A48)");
  assert.equal(g.spend.costUsd, 1.75);
  assert.equal(g.spend.failedCalls, 1);
  assert.equal(g.spend.trackingFailuresToday, 1, "spend NOT in the totals must be said beside them");
  assert.equal(g.apply.runsInFlight, 2);
  assert.deepEqual(Object.fromEntries(g.apply.byStatus.map(r => [r.status, r.n])), { submitted: 1, held_review: 1 });
  assert.equal(g.apply.fullAuto.disabled, true);
});

test("A50 #3: a database missing a table reports that section as unavailable instead of failing the glance", () => {
  const g = buildGlance(new Database(":memory:"), { health: HEALTH, now: 2000 });
  assert.equal(g.spend.costUsd, null);
  assert.equal(g.apply.byStatus, null);
  assert.equal(g.ingestion.sources.length, 3, "ingestion still comes through from health");
});

// ── step 2: the curl-only surfaces ────────────────────────────────────────────────────────────
test("A50 #2: every mutating control in the Operations tab asks first and states what it will do", () => {
  const ops = code(read("client/src/panels/adminOps.jsx"));
  // kill switch: one function, confirm before the write
  const actStart = at(ops, "const act = async");
  const act = ops.slice(actStart, at(ops, "return (", actStart));
  // D83 rebuild #7 (39d): the confirm is the in-page one (useConfirm's ask) — still before the write.
  assert.ok(act.indexOf("await ask(") > -1 && act.indexOf("await ask(") < act.indexOf('api("/api/admin/full-auto"'),
    "the kill switch writes before (or without) asking");
  assert.match(act, /Real applications will be submitted to employers/, "pinning ON must say what it resumes");
  // board-fit: Dry run sends dryRun:true EXPLICITLY; the real run asks and names the count
  assert.match(ops, /JSON\.stringify\(\{ \.\.\.params\(\), dryRun: true \}\)/);
  const real = ops.slice(at(ops, "const runReal"), at(ops, "const body = result"));
  assert.ok(real.indexOf("await ask(") > -1 && real.indexOf("await ask(") < real.indexOf("api("),
    "the board-fit pass runs without asking");
  assert.match(real, /Score \$\{num\(todo\)\} posting/);
  assert.match(ops, /disabled=\{!planFresh \|\| todo === 0/, "Score must stay locked until a dry run of the SAME parameters");
  // read-only surfaces exist
  for (const route of ["/api/version", "/api/admin/analytics/spend", "/api/admin/users/${userId}/applications", "/api/admin/glance"]) {
    assert.ok(ops.includes(route), `${route} has no UI`);
  }
  const panel = read("client/src/panels/AdminPanel.jsx");
  // D83's map (39d): Operations is split across the groups; Today's glance still opens first.
  assert.match(panel, /\{at\("today", "glance"\) && <GlanceTab theme=\{theme\}\/>\}/);
  assert.match(fs.readFileSync("client/src/panels/adminMap.js", "utf8"), /\{ id: "today", label: "Today", question: "What needs me\?", sections: \[\s*\["glance", "At a glance"\]/);
  assert.match(read("client/src/panels/adminPeople.jsx"), /<UserApplications userId=\{id\} theme=\{theme\}\/>/);   // D88: on a person's page
});

test("A50 #2: a board-fit DRY RUN with force plans the forced pass (it used to drop `force`)", async () => {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE scraped_jobs (job_id TEXT PRIMARY KEY, is_active INTEGER, title TEXT, company TEXT, category TEXT,
                               description TEXT, skills_json TEXT, normalized_title TEXT);
    CREATE TABLE ats_only_reports (id INTEGER PRIMARY KEY, job_id TEXT, user_id INTEGER, domain_profile_id INTEGER,
                                   basis_hash TEXT, job_hash TEXT);
    CREATE TABLE domain_profiles (id INTEGER PRIMARY KEY, user_id INTEGER, is_active INTEGER);
    INSERT INTO domain_profiles VALUES (7, 1, 1);
  `);
  for (const id of ["a", "b", "c"]) {
    // A52 (migration 118): a stored row is fresh only when the POSTING's hash matches too, so the
    // fixture carries the columns the scorer reads and stamps the real job_hash.
    const job = { title: "Engineer " + id, company: "Acme", category: null, description: "d", skills_json: null, normalized_title: null };
    db.prepare("INSERT INTO scraped_jobs VALUES (?, 1, ?, ?, ?, ?, ?, ?)").run(id, job.title, job.company, job.category, job.description, job.skills_json, job.normalized_title);
    db.prepare("INSERT INTO ats_only_reports (job_id, user_id, domain_profile_id, basis_hash, job_hash) VALUES (?, 1, 7, 'h', ?)").run(id, atsJobInputHash(job));
  }
  const pc = createBoardFitPrecompute({
    db, log: { log() {}, warn() {}, error() {} },
    basisFor: () => ({ runtimeBasis: {}, basisHash: "h" }),
    scoreJob: () => { throw new Error("a dry run must not score"); },
    store: () => { throw new Error("a dry run must not write"); },
  });
  const plain = await pc.runAll({ dryRun: true });
  assert.equal(plain.summary.todo, 0, "every row is fresh");
  const forced = await pc.runAll({ dryRun: true, force: true });
  assert.equal(forced.summary.todo, 3, "the dry run of a forced pass must show the forced pass's size");
});

// 10-02 (18): the deploy card printed the refresh health as Object.entries() joined, so the field an
// operator reads it for came out as `lastRun: [object Object]` (seen on a local admin screenshot).
test("the deploy card states the term-weight refresh as a sentence, never [object Object]", () => {
  const ops = read("client/src/panels/adminOps.jsx");
  const start = at(ops, "function refreshLine(r) {");
  const src = ops.slice(start, at(ops, "\n}\n", start) + 2);
  const refreshLine = new Function("ago", "num", `${src}; return refreshLine;`)(() => "2h ago", String);
  const failed = refreshLine({ consecutiveFailures: 1, failuresBeforeCliff: 3,
    lastRun: { status: "failed", at: 1, error: "corpus too small" } });
  assert.doesNotMatch(failed, /object Object/);
  assert.match(failed, /last run failed 2h ago — corpus too small/);
  assert.match(refreshLine({ consecutiveFailures: 0, failuresBeforeCliff: 3, lastRun: null }), /^no run recorded · 0 consecutive/);
  assert.match(ops, /\["weight refresh", refreshLine\(w\.refresh\)/);
});
