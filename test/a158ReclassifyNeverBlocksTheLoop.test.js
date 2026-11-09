// ⛔ A158 (45r, owner 11-09) · production froze ≈ 30 s after `ready` on the 45q deploy: the taxonomy version bump (A141)
// re-read and re-classified every posting on the one Node thread, and the crawler-facing whole-board pages (sitemaps,
// landing pages) ran synchronous full-board reads there too. The owner: the taxonomy must keep working — not switched off —
// without freezing the site or delaying it. These tests hold the fix:
//   · the re-read's read + classify half runs on the offload worker; the main thread only writes, in short transactions;
//   · every posting still reaches the CURRENT version (nothing skipped, nothing turned off);
//   · with the worker unavailable the walk carries on in small paced slices — never a long block;
//   · the sitemaps and landing pages never call a whole-board reader with the main connection.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { createTaxonomyBackfill, classifyRange } from "../services/jobs/taxonomyBackfill.js";
import { taxonomy } from "../services/jobs/taxonomyClassify.js";
import { createOffload, offloadCache } from "../services/db/offloadWorker.js";

const TITLES = ["Senior Frontend Engineer", "Software Engineer", "Backend Engineer II", "Data Scientist", "Product Manager",
  "Construction Project Manager", "Account Executive", "Staff Software Engineer, iOS", "Mechanical Engineer", "Recruiter"];
const PARA = "You will build React and TypeScript interfaces, Kubernetes services, Kafka pipelines and PostgreSQL schemas with a small team. ";

function world(n) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "a158-"));
  const file = path.join(dir, "resume_master.db");
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  for (const m of MIGRATIONS) db.exec(m.sql);
  const ins = db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, company, title, _hash, is_active, board_category, description, discovered_at)
    VALUES (?, 'q', ?, ?, ?, 1, 'computing', ?, 1)`);
  db.transaction(() => {
    for (let i = 0; i < n; i++) ins.run(`j${i}`, `Co ${i % 50}`, TITLES[i % TITLES.length], `h${i}`, PARA.repeat(30));
  })();
  // Every posting already read at an OLD version — the 45q situation: a version bump re-reads all of them.
  db.prepare("INSERT INTO job_taxonomy (job_id, category, subcategory, version, classified_at) SELECT job_id, NULL, NULL, 'old', 1 FROM scraped_jobs").run();
  return { db, file, dir };
}

async function walk(db, opts) {
  const h = monitorEventLoopDelay({ resolution: 5 });
  h.enable();
  const t0 = Date.now();
  const status = await createTaxonomyBackfill(db, { log: { log() {}, warn() {}, error() {} }, ...opts }).run("test");
  h.disable();
  return { status, maxLagMs: h.max / 1e6, ms: Date.now() - t0 };
}

test("a158ReclassifyNeverBlocksTheLoop: a version re-read on the offload worker keeps the loop free and reaches every posting", async () => {
  const { db, file } = world(4000);
  const off = createOffload({ dbPath: file });
  try {
    const { status, maxLagMs } = await walk(db, { offload: (a) => off.run("taxonomyRange", a) });
    const v = taxonomy().version;
    assert.equal(status.state, "done");
    assert.equal(status.mode, "offload", `the walk fell back: ${status.error}`);
    assert.equal(db.prepare("SELECT COUNT(*) FROM job_taxonomy WHERE version IS NOT ?").pluck().get(v), 0, "every posting reaches the current version");
    assert.equal(status.classified, 4000);
    assert.ok(maxLagMs < 100, `event-loop lag ${maxLagMs.toFixed(1)} ms during the re-read (budget 100 ms)`);
    assert.ok(off.status().served > 0, "the classification ran on the worker");
  } finally { await off.close(); db.close(); }
});

test("a158ReclassifyNeverBlocksTheLoop: with no worker the walk continues on the main thread in small slices (never off, never one long block)", async () => {
  const { db } = world(1500);
  try {
    const { status, maxLagMs } = await walk(db, { offload: () => Promise.reject(new Error("offload worker not ready")) });
    assert.equal(status.state, "done");
    assert.equal(status.mode, "inline");
    assert.ok(status.offloadErrors >= 1);
    assert.equal(db.prepare("SELECT COUNT(*) FROM job_taxonomy WHERE version IS NOT ?").pluck().get(taxonomy().version), 0);
    assert.ok(maxLagMs < 100, `event-loop lag ${maxLagMs.toFixed(1)} ms in the fallback (budget 100 ms)`);
  } finally { db.close(); }
});

test("a158ReclassifyNeverBlocksTheLoop: classifyRange is the walk's read + classify half and writes nothing", () => {
  const { db } = world(300);
  try {
    const before = db.prepare("SELECT COUNT(*) FROM job_taxonomy WHERE version = 'old'").pluck().get();
    const r = classifyRange(db, 0, 200);
    assert.equal(r.results.length, 200);
    assert.ok(r.more);
    assert.equal(r.version, taxonomy().version);
    assert.equal(db.prepare("SELECT COUNT(*) FROM job_taxonomy WHERE version = 'old'").pluck().get(), before, "nothing written");
  } finally { db.close(); }
});

test("a158ReclassifyNeverBlocksTheLoop: offloadCache makes a value once for concurrent askers and serves it stale while refreshing", async () => {
  const cached = offloadCache({ ttlMs: 50 });
  let made = 0;
  const make = () => new Promise(r => setTimeout(() => r(++made), 20));
  const [a, b, c] = await Promise.all([cached("k", make), cached("k", make), cached("k", make)]);
  assert.deepEqual([a, b, c], [1, 1, 1]);
  await new Promise(r => setTimeout(r, 60));
  assert.equal(await cached("k", make), 1, "stale value served while the refresh runs");
  await new Promise(r => setTimeout(r, 30));
  assert.equal(await cached("k", make), 2);
  await assert.rejects(cached("bad", () => Promise.reject(new Error("x"))));
});

test("a158ReclassifyNeverBlocksTheLoop: the sitemaps and landing pages never read the whole board on the main connection", () => {
  const src = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8");
  for (const call of ["companiesSitemapRoutes(db", "jobsSitemapRoutes(db", "jobsSitemapPageCount(db", "landingSitemapRoutes(db", "renderLandingPage(db"]) {
    assert.ok(!src.includes(call), `server.js still calls ${call}…) on the main thread`);
  }
  for (const task of ["sitemapCompanies", "sitemapJobsPage", "sitemapJobsCount", "sitemapLanding", "landingPage"]) {
    assert.ok(src.includes(`"${task}"`), `server.js routes ${task} through the offload worker`);
  }
  assert.match(src, /createTaxonomyBackfill\(db, \{ offload:/, "the taxonomy walk is given the offload worker");
});
