// D82 A: the stale-prune rule is a TIME, not only a count.
//
// A posting is retired (is_active = 0) only when it was absent from two SUCCESSFUL crawls of its
// source AND at least 48 hours have passed since it was last seen. At one crawl a day the count
// alone meant ~48 h; at four a day it would mean twelve hours, so a short outage on a company's
// board would retire live postings. A failed or empty crawl does not count as a "missed" crawl:
// the watermark only advances on a non-empty fetch.
//
// These drive WHOLE crawls through cacheJobs — the real upsert, prune and watermark path — with a
// fake source (opts.sources) and a controlled clock. Synthetic postings only.
import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { cacheJobs } from "../services/jobs/aggregator.js";
import { normalizeJob } from "../services/jobs/schema.js";

const HOUR = 3600;
const T0 = 1_900_000_000; // a fixed epoch second; every crawl is T0 + n hours

function freshDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("UPDATE company_ats_list SET active = 0").run();
  db.prepare("INSERT OR IGNORE INTO company_ats_list (company, ats_type, ats_slug, active) VALUES ('Synthco', 'greenhouse', 'synthco', 1)").run();
  return db;
}

function posting(n, title) {
  return normalizeJob({
    id: `d82-${n}`, req_id: `d82-${n}`, title, company: "Synthco", location: "Austin, TX",
    url: `https://job-boards.greenhouse.io/synthco/jobs/${n}`, source: "greenhouse",
    description: `Synthco is hiring a ${title} in Austin, TX. You will build backend services in Go and Python, ` +
                 "design APIs, and operate distributed systems on AWS. 3+ years of software engineering experience.",
    posted_at: new Date((T0 - 2 * 24 * HOUR) * 1000).toISOString(),
  });
}
const X = posting(1, "Backend Software Engineer");   // the posting that disappears
const Y = posting(2, "Senior Software Engineer");     // keeps the fetch non-empty

// One crawl at T0 + hours. `jobs` is what the board returns; a function lets a crawl throw.
async function crawlAt(db, hours, jobs) {
  const source = {
    name: "greenhouse",
    isConfigured: () => true,
    search: async () => { if (typeof jobs === "function") return jobs(); return { jobs }; },
  };
  const realNow = Date.now;
  Date.now = () => (T0 + hours * HOUR) * 1000;
  try { await cacheJobs(db, null, { sources: [source] }); }
  finally { Date.now = realNow; }
  const run = db.prepare("SELECT status FROM pipeline_runs WHERE source = 'greenhouse' ORDER BY id DESC LIMIT 1").get();
  return run?.status;
}
const xActive = (db) => db.prepare("SELECT is_active FROM scraped_jobs WHERE job_id = ?").get(X.id)?.is_active;

test("the harness: a crawl lands both postings and records an ok run", async () => {
  const db = freshDb();
  assert.equal(await crawlAt(db, 0, [X, Y]), "ok");
  assert.equal(xActive(db), 1, "X is on the board after the first crawl");
});

test("missed by two successful crawls inside 48 h -> NOT retired (a short outage at a fast cadence)", async () => {
  const db = freshDb();
  assert.equal(await crawlAt(db, 0, [X, Y]), "ok");
  assert.equal(await crawlAt(db, 6, [Y]), "ok");     // miss 1
  assert.equal(await crawlAt(db, 12, [Y]), "ok");    // miss 2 — the old count rule retired here
  assert.equal(xActive(db), 1, "two misses in 12 h must not retire a posting");
  assert.equal(await crawlAt(db, 40, [Y]), "ok");    // miss 3, still under 48 h unseen
  assert.equal(xActive(db), 1, "40 h unseen is still under the 48 h floor");
  assert.equal(await crawlAt(db, 46, [X, Y]), "ok"); // it comes back
  assert.equal(xActive(db), 1);
});

test("missed by two successful crawls AND >= 48 h unseen -> retired; 48 h with ONE miss is not enough", async () => {
  const db = freshDb();
  assert.equal(await crawlAt(db, 0, [X, Y]), "ok");
  assert.equal(await crawlAt(db, 50, [Y]), "ok");    // 50 h unseen but only ONE successful crawl missed it
  assert.equal(xActive(db), 1, "time alone is not enough: the count still applies");
  assert.equal(await crawlAt(db, 56, [Y]), "ok");    // second miss, 56 h unseen
  assert.equal(xActive(db), 0, "two misses and >= 48 h unseen retires it");
  assert.equal(await crawlAt(db, 62, [X, Y]), "ok"); // reappears -> reactivated
  assert.equal(xActive(db), 1, "a retired posting that comes back is reactivated");
});

test("a failed or empty crawl does not count as a miss, however long it has been", async () => {
  const db = freshDb();
  assert.equal(await crawlAt(db, 0, [X, Y]), "ok");
  assert.equal(await crawlAt(db, 24, []), "no_results");                                       // empty
  assert.equal(await crawlAt(db, 36, () => { throw new Error("board down"); }), "failed");     // threw
  assert.equal(await crawlAt(db, 60, [Y]), "ok");    // the FIRST successful crawl without X, 60 h on
  assert.equal(xActive(db), 1, "one successful miss — the empty and failed crawls did not count");
  assert.equal(await crawlAt(db, 66, [Y]), "ok");    // the second successful miss
  assert.equal(xActive(db), 0);
});
