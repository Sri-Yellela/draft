// ⛔ D78 A · THE AGE LIMIT — posted within 120 days. Each red when removed:
// a 121-day-old NEW posting is rejected at ingest (never written) · a NULL-dated posting is KEPT · an existing
// posting past the limit is retired at the crawl only once enforced, and an APPLIED one never · the sweep retires
// an old unreferenced row, KEEPS an applied one, RETIRES (never deletes) a starred one · the sweep refuses past its
// ceiling and its dry run changes nothing · Greenhouse's date is first_published, not updated_at · the crawl runs
// the gate BEFORE the hash check (an unchanged row's touch would re-activate a retired one).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { ageOf, ageGate, sweepAged, readPolicy, setPolicy, CEILING_SHARE } from "../services/jobs/boardAge.js";
import { normalizeGreenhouseJob } from "../services/jobs/sources/greenhouse.js";

const DAY = 86400;
const NOW = Math.floor(Date.parse("2026-10-09T12:00:00Z") / 1000);
const daysAgo = (d) => new Date((NOW - d * DAY) * 1000).toISOString();
function db0() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1, 'u1', 'x')").run();
  return db;
}
const insert = (db, id, posted, extra = {}) => db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, _hash, title, company, url, source, posted_at, is_active, discovered_at)
  VALUES (?, 't', ?, 'Software Engineer', ?, ?, 'greenhouse', ?, 1, ?)`).run(id, `h-${id}`, extra.company || "Acme", `https://example.com/${id}`, posted, extra.discovered ?? NOW - DAY);
const active = (db, id) => db.prepare("SELECT is_active FROM scraped_jobs WHERE job_id = ?").pluck().get(id);
const reason = (db, id) => db.prepare("SELECT reason FROM rejected_jobs WHERE job_id = ?").pluck().get(id);

test("⛔ D78 A: the age of a posting — posted_at when it parses, else first seen; a NULL date is never 'old'", () => {
  assert.equal(ageOf({ posted_at: daysAgo(121) }, { now: NOW }).tooOld, true);
  assert.equal(ageOf({ posted_at: daysAgo(119) }, { now: NOW }).tooOld, false);
  const nul = ageOf({ posted_at: null }, { now: NOW });
  assert.deepEqual([nul.tooOld, nul.basis], [false, "first_seen"], "a new posting with no date is kept");
  assert.equal(ageOf({ posted_at: "not a date", first_seen: NOW - 200 * DAY }, { now: NOW }).tooOld, true, "an unreadable date falls back to first seen");
});

test("⛔ D78 A: a 121-day-old NEW posting is rejected at ingest; a NULL-dated new one is kept", () => {
  const db = db0();
  const job = { title: "Software Engineer", company: "Acme", source: "greenhouse", posted_at: daysAgo(121) };
  assert.equal(ageGate(db, job, "new-old", { exists: false, now: NOW }), "rejected_new");
  assert.equal(reason(db, "new-old"), "too_old");
  assert.equal(db.prepare("SELECT COUNT(*) FROM scraped_jobs").pluck().get(), 0, "never written");
  assert.equal(ageGate(db, { ...job, posted_at: null }, "new-null", { exists: false, now: NOW }), "keep");
});

test("⛔ D78 A: an EXISTING posting past the limit is retired at the crawl only once ENFORCED — and an applied one never", () => {
  const db = db0();
  insert(db, "old", daysAgo(150));
  insert(db, "applied", daysAgo(150));
  db.prepare("INSERT INTO user_jobs (user_id, job_id, applied) VALUES (1, 'applied', 1)").run();
  const job = { title: "Software Engineer", company: "Acme", source: "greenhouse", posted_at: daysAgo(150) };
  assert.equal(readPolicy(db).age_enforce, 0, "it starts report-only");
  assert.equal(ageGate(db, job, "old", { exists: true, now: NOW }), "would_age_out");
  assert.equal(active(db, "old"), 1, "report-only changes nothing");
  setPolicy(db, { age_enforce: true });
  assert.equal(ageGate(db, job, "old", { exists: true, now: NOW, policy: readPolicy(db) }), "aged_out");
  assert.deepEqual([active(db, "old"), reason(db, "old")], [0, "aged_out"]);
  assert.equal(ageGate(db, job, "applied", { exists: true, now: NOW, policy: readPolicy(db) }), "keep", "an application keeps its posting");
});

test("⛔ D78 A: the sweep retires an old unreferenced row, KEEPS an applied one, RETIRES (never deletes) a starred one; its dry run changes nothing", () => {
  const db = db0();
  for (let i = 0; i < 10; i++) insert(db, `fresh${i}`, daysAgo(10));
  insert(db, "old", daysAgo(200));
  insert(db, "applied", daysAgo(200));
  insert(db, "starred", daysAgo(200));
  insert(db, "nodate", null, { discovered: NOW - 300 * DAY });
  db.prepare("INSERT INTO user_jobs (user_id, job_id, applied) VALUES (1, 'applied', 1)").run();
  db.prepare("INSERT INTO user_jobs (user_id, job_id, starred) VALUES (1, 'starred', 1)").run();
  const dry = sweepAged(db, { now: NOW });
  assert.equal(dry.dryRun, true);
  assert.equal(dry.candidates, 3, "old + starred + the no-date row by first seen");
  assert.equal(db.prepare("SELECT COUNT(*) FROM scraped_jobs WHERE is_active = 1").pluck().get(), 14, "the dry run changed nothing");
  const run = sweepAged(db, { dryRun: false, now: NOW });
  assert.equal(run.retired, 3);
  assert.deepEqual(["old", "starred", "nodate", "applied"].map(id => active(db, id)), [0, 0, 0, 1]);
  assert.equal(db.prepare("SELECT COUNT(*) FROM scraped_jobs WHERE job_id = 'starred'").pluck().get(), 1, "retired, NEVER deleted");
  assert.equal(db.prepare("SELECT COUNT(*) FROM user_jobs WHERE job_id = 'starred'").pluck().get(), 1, "it stays in the user's own list");
  assert.equal(reason(db, "starred"), "aged_out", "the reason is the undo");
});

test("⛔ D78 A: the sweep refuses past its ceiling unless forced", () => {
  const db = db0();
  for (let i = 0; i < 6; i++) insert(db, `old${i}`, daysAgo(200));
  for (let i = 0; i < 4; i++) insert(db, `fresh${i}`, daysAgo(5));
  const r = sweepAged(db, { dryRun: false, now: NOW });
  assert.ok(0.6 > CEILING_SHARE);
  assert.equal(r.refused, true);
  assert.equal(db.prepare("SELECT COUNT(*) FROM scraped_jobs WHERE is_active = 1").pluck().get(), 10, "refused = nothing retired");
  assert.equal(sweepAged(db, { dryRun: false, force: true, now: NOW }).retired, 6);
});

test("⛔ D78 A: Greenhouse's date is first_published — updated_at is re-stamped and made every posting look fresh", () => {
  const j = normalizeGreenhouseJob({ id: 1, title: "Software Engineer", absolute_url: "https://boards.greenhouse.io/acme/jobs/1", location: { name: "Boston, MA" },
    content: "Build things", updated_at: "2026-10-07T19:02:27-04:00", first_published: "2026-04-01T10:00:00-04:00" }, "Acme");
  assert.equal(j.posted_at, "2026-04-01T10:00:00-04:00");
  const fallback = normalizeGreenhouseJob({ id: 2, title: "Engineer", absolute_url: "https://boards.greenhouse.io/acme/jobs/2", location: { name: "Boston, MA" },
    content: "x", updated_at: "2026-10-07T19:02:27-04:00" }, "Acme");
  assert.equal(fallback.posted_at, "2026-10-07T19:02:27-04:00", "updated_at only when first_published is missing");
});

test("⛔ D78 A: the crawl runs the age gate BEFORE the hash check, and records what it held", () => {
  const src = fs.readFileSync("services/jobs/aggregator.js", "utf8").replace(/\r\n/g, "\n");
  const gate = src.indexOf("const age = ageGate(db, job, jobId");
  const hash = src.indexOf("const contentHash = fingerprintJob(job);");
  assert.ok(gate > 0 && hash > gate, "the gate precedes the hash check");
  assert.match(src, /tooOld, agedOut, wouldAgeOut \},/);
});
