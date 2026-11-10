// A173 (46c) · the expiry DELETE runs in slices that yield to requests. Production 11-10 16:24Z: one statement expired 2,552
// postings inside the boot warm-up and ready moved 5.5 s → 25.9 s while the old container was already stopped. The pass now
// deletes ≤ EXPIRY_SLICE_ROWS a statement with the SAME predicate, yields between slices, never deletes more than the brake
// counted, and the boot step does not await the slices (the rollups, the count and the brake still run inside the step).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { at } from "../test-support/sourceAnchors.js";

const server = fs.readFileSync("server.js", "utf8").replace(/\r\n/g, "\n");
const fn = server.slice(at(server, "function runExpiredJobsCleanup() {"), at(server, 'cron.schedule("0 3 * * *"'));
const allowed = fn.slice(at(fn, "if (scope.allowed)"), at(fn, "} else {", at(fn, "if (scope.allowed)")));

test("a173ExpirySliced (source): the allowed branch deletes in capped slices with a yield between, one pass at a time", () => {
  assert.match(server, /const EXPIRY_SLICE_ROWS = 25;/);
  assert.match(fn, /if \(expiryInFlight\) return expiryInFlight;/, "the cron, the boot step and the cache cleanup never overlap");
  assert.match(fn, /async function runExpiredJobsCleanupPass\(\)/);
  assert.match(allowed, /DELETE FROM scraped_jobs WHERE \$\{EXPIRED_PREDICATE\}\n\s+AND id IN \(SELECT id FROM scraped_jobs WHERE \$\{EXPIRED_PREDICATE\} LIMIT \?\)/,
    "the same predicate on both sides — a row re-seen between slices no longer matches");
  assert.match(allowed, /while \(deletedJobs\.changes < wouldDelete\)/, "never more than the count the brake assessed");
  assert.match(allowed, /await new Promise\(r => setImmediate\(r\)\)/, "requests are answered between slices");
  assert.ok(at(fn, "assessCleanupScope(") < at(fn, "DELETE FROM scraped_jobs"), "the brake still precedes the delete");
});

test("a173ExpirySliced (source): the boot step does not await the slices; the cron and the cache cleanup handle the promise", () => {
  const step = server.slice(at(server, 'BOOT.add("startup expired-jobs cleanup"'), at(server, "// The board's fit, reconciled once after boot."));
  assert.match(step, /try \{ runExpiredJobsCleanup\(\)\.catch\(/, "not returned to BOOT, so ready does not wait on a large expiry");
  assert.doesNotMatch(step, /return runExpiredJobsCleanup|await runExpiredJobsCleanup/);
  assert.match(server, /cron\.schedule\("0 3 \* \* \*", \(\) => runExpiredJobsCleanup\(\)\.catch\(/);
  const cache = server.slice(at(server, "async function runCacheCleanup()"), at(server, "// ── Anthropic"));
  assert.match(cache, /await runExpiredJobsCleanup\(\);/, "it counts what is left only after the pass has finished");
});

test("a173ExpirySliced: the slice statement, run as the pass runs it, deletes exactly the expired rows ≤ 25 at a time and stops at the count", async () => {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE scraped_jobs (id INTEGER PRIMARY KEY, job_id TEXT UNIQUE, scraped_at INTEGER);
           CREATE TABLE user_jobs (job_id TEXT, applied INTEGER DEFAULT 0);`);
  const CUT = 1_000_000;
  const ins = db.prepare("INSERT INTO scraped_jobs (job_id, scraped_at) VALUES (?, ?)");
  db.transaction(() => {
    for (let i = 0; i < 130; i++) ins.run(`old-${i}`, CUT - 10);      // expired
    for (let i = 0; i < 40; i++) ins.run(`new-${i}`, CUT + 10);       // fresh
  })();
  for (const j of ["old-3", "old-77"]) db.prepare("INSERT INTO user_jobs (job_id, applied) VALUES (?, 1)").run(j);
  const EXPIRED_PREDICATE = "scraped_at < ? AND job_id NOT IN (SELECT job_id FROM user_jobs)";
  // the server's own statement text, with the test's predicate in its place
  const tpl = allowed.slice(at(allowed, "db.prepare(`") + "db.prepare(`".length, at(allowed, "`);", at(allowed, "db.prepare(`")));
  const sql = tpl.split("${EXPIRED_PREDICATE}").join(EXPIRED_PREDICATE);
  const expireSlice = db.prepare(sql);
  const wouldDelete = db.prepare(`SELECT COUNT(*) FROM scraped_jobs WHERE ${EXPIRED_PREDICATE}`).pluck().get(CUT);
  assert.equal(wouldDelete, 128);
  const deletedJobs = { changes: 0 };
  const sizes = [];
  let yields = 0;
  while (deletedJobs.changes < wouldDelete) {
    const n = expireSlice.run(CUT, CUT, Math.min(25, wouldDelete - deletedJobs.changes)).changes;
    deletedJobs.changes += n; sizes.push(n);
    if (n === 0 || deletedJobs.changes >= wouldDelete) break;
    if (yields === 1) db.prepare("UPDATE scraped_jobs SET scraped_at = ? WHERE job_id = 'old-129'").run(CUT + 5);   // a crawl re-sees one mid-pass
    await new Promise(r => setImmediate(r)); yields++;
  }
  assert.ok(sizes.every(n => n <= 25), `slices ${sizes}`);
  assert.equal(deletedJobs.changes, 127, "the re-seen posting stays; the count is never exceeded");
  assert.deepEqual(db.prepare("SELECT job_id FROM scraped_jobs WHERE job_id LIKE 'old-%' ORDER BY job_id").pluck().all(), ["old-129", "old-3", "old-77"]);
  assert.equal(db.prepare("SELECT COUNT(*) FROM scraped_jobs WHERE job_id LIKE 'new-%'").pluck().get(), 40);
  assert.ok(yields >= 4, "the loop yielded between slices");
});
