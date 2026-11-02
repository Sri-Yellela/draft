// A112: the crawler boost takes the crawl list from ~200 companies to thousands. A plugin fetches every company it is
// handed at once, and cacheJobs held a whole source's postings in memory until one transaction — so the crawl now
// hands each source CRAWL_CHUNK companies at a time, writes each chunk, and prunes / advances the watermark ONCE,
// after the last chunk, and not at all when a chunk's fetch throws.
//
// These drive whole crawls through cacheJobs with a fake source (opts.sources), as d82RetireRule does. Synthetic
// companies and postings only.
import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { cacheJobs, CRAWL_CHUNK } from "../services/jobs/aggregator.js";
import { normalizeJob } from "../services/jobs/schema.js";

const HOUR = 3600;
const T0 = 1_900_000_000;
const N = CRAWL_CHUNK * 2 + 7;   // three chunks

function freshDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("UPDATE company_ats_list SET active = 0").run();
  const add = db.prepare("INSERT INTO company_ats_list (company, ats_type, ats_slug, active) VALUES (?, 'greenhouse', ?, 1)");
  for (let i = 0; i < N; i++) add.run(`Synthco ${i}`, `synthco${i}`);
  return db;
}

const posting = (slug, company) => normalizeJob({
  id: `a112-${slug}`, req_id: `a112-${slug}`, title: "Backend Software Engineer", company, location: "Austin, TX",
  url: `https://job-boards.greenhouse.io/${slug}/jobs/1`, source: "greenhouse",
  description: `${company} is hiring a Backend Software Engineer in Austin, TX. You will build backend services in Go and ` +
               "Python, design APIs, and operate distributed systems on AWS. 3+ years of software engineering experience.",
  posted_at: new Date((T0 - 2 * 24 * HOUR) * 1000).toISOString(),
});

async function crawlAt(db, hours, { failChunk = -1, skip = new Set() } = {}) {
  const calls = [];
  const source = {
    name: "greenhouse",
    isConfigured: () => true,
    search: async ({ _companies }) => {
      calls.push(_companies.length);
      if (calls.length - 1 === failChunk) throw new Error("board unreachable");
      return { jobs: _companies.filter((c) => !skip.has(c.ats_slug)).map((c) => posting(c.ats_slug, c.company)) };
    },
  };
  const realNow = Date.now;
  Date.now = () => (T0 + hours * HOUR) * 1000;
  try { await cacheJobs(db, null, { sources: [source] }); } finally { Date.now = realNow; }
  const run = db.prepare("SELECT status, fetched FROM pipeline_runs WHERE source = 'greenhouse' ORDER BY id DESC LIMIT 1").get();
  return { calls, run };
}
const active = (db) => db.prepare("SELECT COUNT(*) FROM scraped_jobs WHERE is_active = 1").pluck().get();
const isActive = (db, slug) => db.prepare("SELECT is_active FROM scraped_jobs WHERE job_id = ?").pluck().get(`greenhouse::a112-${slug}`);

test("A112: the source is handed CRAWL_CHUNK companies at a time, and every chunk's postings land", async () => {
  const db = freshDb();
  const { calls, run } = await crawlAt(db, 0);
  assert.deepEqual(calls, [CRAWL_CHUNK, CRAWL_CHUNK, 7]);
  assert.equal(run.status, "ok");
  assert.equal(run.fetched, N);
  assert.equal(active(db), N);
});

test("A112: the prune reads the chunked pass as one crawl — a posting in the LAST chunk still retires on the D82 rule", async () => {
  const db = freshDb();
  const last = `synthco${N - 1}`, first = "synthco0";
  await crawlAt(db, 0);
  await crawlAt(db, 50, { skip: new Set([last, first]) });
  await crawlAt(db, 56, { skip: new Set([last, first]) });
  assert.equal(isActive(db, last), 0, "absent two successful crawls and > 48 h: retired");
  assert.equal(isActive(db, first), 0);
  assert.equal(isActive(db, "synthco1"), 1, "seen in every chunked crawl: kept");
});

test("A112: a chunk that throws — earlier chunks are kept, nothing is pruned, the watermark does not move", async () => {
  const db = freshDb();
  await crawlAt(db, 0);
  const wm = db.prepare("SELECT last_watermark FROM sync_state WHERE source = 'greenhouse'").pluck().get();
  const { run } = await crawlAt(db, 60, { failChunk: 1, skip: new Set(["synthco0"]) });
  assert.equal(run.status, "failed");
  assert.equal(db.prepare("SELECT last_watermark FROM sync_state WHERE source = 'greenhouse'").pluck().get(), wm);
  assert.equal(active(db), N, "a failed crawl retires nothing");
});
