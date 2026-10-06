// A49 fix 5 — a duplicate dedup retired is soft-deleted with a logged reason, and stays restorable.
//
// Before: dedup demoted a row and never refreshed its scraped_at, so the 7-day expiry in
// runExpiredJobsCleanup hard-deleted it a week later — a wrong merge became unrecoverable on a timer.
// And runCacheCleanup ran a SECOND expiry on a 24h interval: `DELETE ... WHERE scraped_at < cutoff`
// with no exemption at all (starred, applied, retired), no brake, no cleanup_log row.
//
// The predicate under test is read out of server.js, so this exercises the real statement.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { reconcileFingerprint, upsertCanonicalJob } from "../services/jobs/aggregator.js";
import { normalizeJob } from "../services/jobs/schema.js";
import { restoreRetiredDuplicate } from "../services/jobs/dedupRetire.js";
import { at } from "../test-support/sourceAnchors.js";
import { userReferencedSql } from "../services/jobs/userReferences.js";

const server = fs.readFileSync("server.js", "utf8").replace(/\r\n/g, "\n");
const cleanup = server.slice(at(server, "function runExpiredJobsCleanup()"), at(server, 'cron.schedule("0 3 * * *"'));
// D43: the predicate interpolates the shared user-reference test; substitute it as the template does.
const PREDICATE = cleanup.slice(at(cleanup, "const EXPIRED_PREDICATE = `") + "const EXPIRED_PREDICATE = `".length,
                                at(cleanup, "`;", at(cleanup, "const EXPIRED_PREDICATE = `")))
  .replace('${userReferencedSql("scraped_jobs.job_id")}', userReferencedSql("scraped_jobs.job_id"));

const NOW = 1_790_000_000;
const OLD = NOW - 30 * 86400;
const VERDICT = { roleKey: "engineering", seniority: "mid", domain: "software", collar: "white", confidence: 0.9 };

function board() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  const write = (f) => {
    const job = normalizeJob({ title: "Backend Engineer", company: "Examplecorp", location: "Austin, TX", description: "d", ...f });
    const dedup = reconcileFingerprint(db, { ...job, company_icon_url: null });
    if (dedup.action === "fold") return;
    upsertCanonicalJob(db, { jobId: job.id, canonical: dedup.job, verdict: VERDICT, contentHash: "h", searchQuery: "s",
      sourceLabel: "s", matchedBy: "t", dedup, now: NOW });
  };
  write({ id: "a1", source: "adzuna", url: "https://www.adzuna.com/land/ad/1" });
  write({ id: "4100001", req_id: "4100001", source: "greenhouse", url: "https://boards.greenhouse.io/examplecorp/jobs/4100001" });
  write({ id: "a2", source: "adzuna", url: "https://www.adzuna.com/land/ad/2", location: "Denver, CO", title: "Data Engineer" });
  // Everything is a month old by scraped_at — the canonical row too, as on a board whose crawl stalled.
  db.prepare("UPDATE scraped_jobs SET scraped_at = ?").run(OLD);
  return db;
}

const expire = (db) => db.prepare(`DELETE FROM scraped_jobs WHERE ${PREDICATE}`).run(NOW - 7 * 86400).changes;
const ids = (db) => db.prepare("SELECT job_id FROM scraped_jobs ORDER BY job_id").all().map(r => r.job_id);

test("the retirement carries its reason and its canonical row", () => {
  const db = board();
  const r = db.prepare("SELECT is_active, duplicate_of, retired_reason, retired_at FROM scraped_jobs WHERE job_id = 'adzuna::a1'").get();
  assert.deepEqual({ ...r }, { is_active: 0, duplicate_of: "greenhouse::4100001", retired_reason: "duplicate", retired_at: r.retired_at });
  assert.ok(r.retired_at > 0);
});

test("⛔ the 7-day expiry does not delete a retired duplicate while its canonical row exists — so it can be restored", () => {
  const db = board();
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1, 'synthetic-a', 'x')").run();
  db.prepare("INSERT INTO user_jobs (user_id, job_id, starred) VALUES (1, 'greenhouse::4100001', 1)")
    .run(); // the canonical is kept by a Save; without one it would expire like any other row
  expire(db);
  assert.ok(ids(db).includes("adzuna::a1"), "the retired duplicate survives expiry");
  assert.ok(!ids(db).includes("adzuna::a2"), "an ordinary stale row still expires — the table cannot grow without bound");
  assert.equal(restoreRetiredDuplicate(db, "adzuna::a1", { now: NOW }).restored, true, "and it can still be restored");
});

test("once its canonical row is gone, a retired duplicate expires with the ordinary rule", () => {
  const db = board();
  expire(db);                       // canonical (unstarred, stale) goes in this pass
  assert.ok(!ids(db).includes("greenhouse::4100001"));
  expire(db);                       // the duplicate follows on the next
  assert.ok(!ids(db).includes("adzuna::a1"));
});

test("runCacheCleanup no longer runs its own unguarded DELETE — it runs the one expiry policy", () => {
  const fn = server.slice(at(server, "function runCacheCleanup()"), at(server, "// ── Anthropic"));
  assert.doesNotMatch(fn, /DELETE FROM scraped_jobs/, "a second expiry with no exemptions, no brake and no log");
  assert.match(fn, /runExpiredJobsCleanup\(\)/);
});
