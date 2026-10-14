// 10-14 · THE INGESTION FUNNEL — the owner's complaint: "the admin panel says only around 80 are accepted
// and 1800 refused for one of the providers". Production's greenhouse run that day (measured read-only):
// fetched 15,998 · written 80 · unchanged 2,328 · merged 0 · dropped 1,832 · ejected 46 · details
// outOfMarket 4,874 · tooOld 2,326 · outOfScope 3,659 · agedOut 0 · scopedOut 0. The glance showed
// `written` beside dropped + ejected, two of the run's seven gates, and hid the 2,328 still on the board.
//
// These pin: the funnel accounts for every fetched posting (and names the remainder); "on the board" is
// pipelineHealth()'s own accountedFor; a run refused entirely by D78's gates is all_rejected, not
// wrote_nothing; the refusal-reason breakdown shows a reason nobody listed; and the two admin surfaces
// draw the funnel instead of "written / refused".
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { createAdminDbRouter } from "../routes/adminDb.js";
import { recordPipelineRun } from "../services/jobs/pipelineRunLog.js";
import { buildGlance } from "../services/adminGlance.js";
import { runFunnel } from "../services/ingestFunnel.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");

function makeDb() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE scraped_jobs (
      job_id TEXT PRIMARY KEY, title TEXT, company TEXT, location TEXT,
      source TEXT, source_label TEXT, posted_at TEXT,
      discovered_at INTEGER, scraped_at INTEGER, updated_at INTEGER, is_active INTEGER DEFAULT 1,
      description TEXT, summary TEXT, normalized_title TEXT, experience_level TEXT,
      workplace_type TEXT, skills_json TEXT, salary_min_usd INTEGER, salary_max_usd INTEGER,
      salary_period TEXT, is_h1b_sponsor INTEGER, requires_work_auth INTEGER,
      is_clearance_required INTEGER, org_unit_raw TEXT,
      enriched_at INTEGER, content_hash TEXT, sources_seen TEXT, req_uid TEXT
    );
    CREATE TABLE pipeline_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_kind TEXT NOT NULL, source TEXT, status TEXT NOT NULL,
      started_at INTEGER NOT NULL, finished_at INTEGER, duration_ms INTEGER,
      fetched INTEGER NOT NULL DEFAULT 0, written INTEGER NOT NULL DEFAULT 0,
      unchanged INTEGER NOT NULL DEFAULT 0, merged INTEGER NOT NULL DEFAULT 0,
      dropped INTEGER NOT NULL DEFAULT 0, ejected INTEGER NOT NULL DEFAULT 0,
      failed INTEGER NOT NULL DEFAULT 0, skipped INTEGER NOT NULL DEFAULT 0,
      expired INTEGER NOT NULL DEFAULT 0, error_text TEXT, details_json TEXT
    );
    CREATE TABLE company_ats_list (
      id INTEGER PRIMARY KEY AUTOINCREMENT, company TEXT NOT NULL, ats_type TEXT NOT NULL,
      ats_slug TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, bucket_role TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()), UNIQUE(ats_type, ats_slug)
    );
    CREATE TABLE rejected_jobs (job_id TEXT PRIMARY KEY, title TEXT, company TEXT,
      source TEXT, reason TEXT, rejected_at INTEGER);
  `);
  return db;
}

// Production greenhouse, 10-14 — the figures in the owner's complaint.
const GREENHOUSE = {
  fetched: 15998, written: 80, unchanged: 2328, merged: 0, dropped: 1832, ejected: 46,
  details: { companies: 108, outOfMarket: 4874, tooOld: 2326, outOfScope: 3659, agedOut: 0, scopedOut: 0 },
};

function seedGreenhouse(db, now) {
  db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,source,discovered_at,scraped_at,is_active,description)
              VALUES ('g1','Engineer','Acme','greenhouse',?,?,1,'text')`).run(now, now);
  recordPipelineRun(db, { runKind: "source_sync", source: "greenhouse", status: "ok", startedAt: now - 60, ...GREENHOUSE });
}

async function getJson(db, path) {
  const app = express();
  app.use((req, _res, next) => { req.user = { isAdmin: true }; next(); });
  app.use("/api/admin/db", createAdminDbRouter(db, {}));
  const server = app.listen(0);
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/db/${path}`);
    return { status: res.status, body: await res.json() };
  } finally { server.close(); }
}

const partsSum = (f) => [...f.refused, ...f.retired, ...f.onBoardParts].reduce((t, p) => t + p.n, 0);

test("the glance's funnel for production's greenhouse run accounts for every fetched posting, the remainder named", () => {
  const db = makeDb();
  const now = Math.floor(Date.now() / 1000);
  seedGreenhouse(db, now);
  const health = createAdminDbRouter(db, {}).pipelineHealth();
  const g = buildGlance(db, { health, now });
  const gh = g.ingestion.sources.find(s => s.name === "greenhouse");
  const f = gh.funnel;
  assert.ok(f, "the glance carries the funnel pipelineHealth() computed");
  assert.equal(f.fetched, 15998);
  const by = Object.fromEntries([...f.refused, ...f.retired, ...f.onBoardParts].map(p => [p.key, p.n]));
  assert.deepEqual(by, { outOfMarket: 4874, tooOld: 2326, blueCollar: 46, noRoleFamily: 1832, outOfScope: 3659,
    agedOut: 0, scopedOut: 0, newOrChanged: 80, unchanged: 2328, duplicate: 0 });
  // 15,145 counted; 853 are postings the crawl stops without counting (already retired, re-seen).
  assert.equal(partsSum(f) + f.uncounted, f.fetched, "the parts plus the stated remainder are the fetch");
  assert.equal(f.uncounted, 853);
  assert.match(f.uncountedNote, /already retired/);
  assert.equal(f.refusedTotal, 12737, "every refusal, not dropped + ejected (1,878)");
  assert.equal(gh.onBoard, 2408, "the headline is what is on the board — not written (80)");
  assert.equal(gh.heldOff, 12737);
  assert.equal("refused" in gh, false, "the two-gate `refused` figure is gone from the glance");
  assert.match(g.ingestion.funnelNote, /standing pool, not new refusals/);
});

test("'on the board' is pipelineHealth()'s accountedFor — written + unchanged + merged — one definition", () => {
  const f = runFunnel({ fetched: 30, written: 4, unchanged: 7, merged: 3, dropped: 16, details_json: "{}" });
  assert.equal(f.onBoard, 14);
  assert.equal(f.uncounted, 0);
  const src = read("routes/adminDb.js");
  assert.match(src, /const accountedFor = funnel\?\.onBoard \?\? 0;/, "the classifier reads the funnel's figure");
  assert.match(src, /const rejected {5}= funnel\?\.heldOff \?\? 0;/);
  // A merged posting folded into another source's row is on the board under that row (aggregator.js).
  assert.match(read("services/jobs/aggregator.js"), /if \(dedup\.action === 'fold'\) \{\s*merged\+\+;\s*continue;/);
});

test("a run whose whole fetch is too old or outside computer science is all_rejected (warn), not wrote_nothing", async () => {
  const db = makeDb();
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,source,discovered_at,scraped_at,is_active,description)
              VALUES ('a1','Engineer','Acme','ashby',?,?,1,'text')`).run(now, now);
  recordPipelineRun(db, { runKind: "source_sync", source: "ashby", status: "ok", startedAt: now - 60,
    fetched: 50, written: 0, unchanged: 0, details: { tooOld: 20, outOfScope: 30 } });
  const { body } = await getJson(db, "pipeline-health");
  const s = body.sources.find(x => x.name === "ashby");
  assert.equal(s.health, "all_rejected");
  assert.equal(s.rejectedShare, 1, "too old and out of scope are refusals in the share");
  const a = body.alerts.find(x => x.kind === "source" && x.subject === "ashby");
  assert.equal(a.severity, "warn");
  assert.match(a.detail, /20 too old/);
  assert.match(a.detail, /30 outside computer science/);
});

test("rejectedShare counts every gate — production greenhouse refused 80% of its fetch, not 12%", async () => {
  const db = makeDb();
  seedGreenhouse(db, Math.floor(Date.now() / 1000));
  const { body } = await getJson(db, "pipeline-health");
  const s = body.sources.find(x => x.name === "greenhouse");
  assert.equal(s.health, "ok");
  assert.equal(s.rejectedShare, Number((12737 / 15998).toFixed(3)));
  assert.equal(s.funnel.onBoard, 2408);
});

test("the refusal-reason breakdown is distinct postings by source × reason, and shows a reason nobody listed", async () => {
  const db = makeDb();
  const ins = db.prepare("INSERT INTO rejected_jobs VALUES (?,?,?,?,?,?)");
  ins.run("j1", "t", "Acme", "greenhouse", "no_role", 10);
  ins.run("j2", "t", "Acme", "greenhouse", "no_role", 20);
  ins.run("j3", "t", "Acme", "greenhouse", "out_of_market:non_us", 30);
  ins.run("j4", "t", "Beta", "ashby", "too_old", 40);
  ins.run("j5", "t", "Beta", "ashby", "a_reason_from_the_future", 50);
  // A re-seen refusal rewrites its row (job_id is the key) — it is one posting, not two.
  db.prepare("INSERT OR REPLACE INTO rejected_jobs VALUES (?,?,?,?,?,?)").run("j1", "t", "Acme", "greenhouse", "no_role", 60);
  const { status, body } = await getJson(db, "refusal-reasons");
  assert.equal(status, 200);
  const get = (src, reason) => body.rows.find(r => r.source === src && r.reason === reason);
  assert.equal(get("greenhouse", "no_role").postings, 2);
  assert.equal(get("greenhouse", "no_role").lastAt, 60);
  assert.equal(get("greenhouse", "out_of_market:non_us").family, "out_of_market");
  assert.equal(get("ashby", "a_reason_from_the_future").postings, 1, "an unknown reason is shown, not filtered");
  assert.deepEqual(body.bySource, { greenhouse: 3, ashby: 2 });
  // The inspector renders whatever reason string arrives — no allow-list that would hide `no_role`.
  const insp = read("client/src/pages/admin/DBInspector.jsx");
  assert.match(insp, /api\(`\/api\/admin\/db\/refusal-reasons`\)/);
  assert.match(insp, /\{r\.reason\}/);
  assert.doesNotMatch(insp, /"no_role"|'no_role'/, "no hard-coded reason list");
});

test("both admin surfaces draw the funnel — the glance headline is 'on the board', not written / refused", () => {
  const ops = read("client/src/panels/adminOps.jsx");
  const insp = read("client/src/pages/admin/DBInspector.jsx");
  const comp = read("client/src/components/IngestFunnel.jsx");
  assert.match(ops, /import IngestFunnel from "\.\.\/components\/IngestFunnel\.jsx";/);
  assert.match(insp, /import IngestFunnel from "\.\.\/\.\.\/components\/IngestFunnel\.jsx";/);
  const glance = ops.slice(at(ops, "export function GlanceTab("), at(ops, 'title="Enrichment"'));
  assert.doesNotMatch(glance, /key: "refused"/, "the two-gate refused column is gone from the Ingestion card");
  assert.match(glance, /key: "onBoard", label: "on the board"/);
  assert.match(glance, /<IngestFunnel /);
  assert.match(insp, /<IngestFunnel /);
  assert.doesNotMatch(insp, /s\.lastRun\.dropped \+ s\.lastRun\.ejected/, "the inspector's Last Run no longer sums two gates as 'refused'");
  // Marks, not capsules (D60) — and the remainder and the recurrence are said on the surface.
  assert.match(comp, /markStyle\(/);
  assert.doesNotMatch(comp, /999|rounded-full/);
  assert.match(comp, /funnel\.uncountedNote/);
  assert.match(read("client/src/modules.manifest.js"), /"components\/IngestFunnel\.jsx":\s*\{[^}]*module: "admin"/);
});

test("the CS rescue's postings show under 'on the board' as a subset — never added to the sum", () => {
  // ing-crawl-fixes (9ef7e99): a no-family posting with a clear CS title is filed under 'general' and runs
  // on through the scope gate, dedup and the upsert, so it is inside written (or merged); `dropped` excludes it.
  const f = runFunnel({ fetched: 20, written: 6, unchanged: 4, merged: 0, dropped: 10,
    details_json: JSON.stringify({ rescued: 3 }) });
  assert.equal(f.onBoard, 10);
  assert.deepEqual(f.onBoardIncludes.map(p => [p.key, p.n]), [["rescued", 3]]);
  assert.equal(partsSum(f) + f.uncounted, 20);
  assert.equal(f.uncounted, 0, "counting the rescued again would make the parts exceed the fetch");
  assert.match(read("client/src/components/IngestFunnel.jsx"), /f\.onBoardIncludes/);
});

test("a company's lastSeenAt reads only the US gate's rows — a no_role refusal stamped tonight does not hide a stale slug", async () => {
  const db = makeDb();
  const now = Math.floor(Date.now() / 1000);
  const old = now - 5 * 86400;
  db.prepare("INSERT INTO company_ats_list (company, ats_type, ats_slug, active, created_at) VALUES ('Acme','greenhouse','acme',1,?)").run(old - 86400);
  db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,source,discovered_at,scraped_at,is_active,description)
              VALUES ('g1','Engineer','Acme','greenhouse',?,?,1,'text')`).run(old, old);
  recordPipelineRun(db, { runKind: "source_sync", source: "greenhouse", status: "ok", startedAt: now - 60,
    fetched: 2, written: 1, dropped: 1 });
  // Tonight's crawl refused one Acme posting for no role family — and did not return the active one.
  db.prepare("INSERT INTO rejected_jobs VALUES ('g2','Claims Manager','Acme','greenhouse','no_role',?)").run(now - 30);
  const { body } = await getJson(db, "pipeline-health");
  const c = body.companies.find(x => x.slug === "acme");
  assert.equal(c.lastSeenAt, old, "the no_role stamp is not a sighting of the company's board");
  assert.equal(c.health, "stale");
  assert.equal(c.heldOutOfMarket, 0);
  // The US gate's own rows still count as a sighting (A44, 10-02).
  db.prepare("INSERT INTO rejected_jobs VALUES ('g3','Engineer','Acme','greenhouse','out_of_market:non_us',?)").run(now - 20);
  const again = (await getJson(db, "pipeline-health")).body.companies.find(x => x.slug === "acme");
  assert.equal(again.lastSeenAt, now - 20);
  assert.equal(again.heldOutOfMarket, 1);
});
