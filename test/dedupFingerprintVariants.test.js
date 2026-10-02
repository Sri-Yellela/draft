// A49 fix 2 — the cross-source fingerprint keys on the PLACE (and the company and the role), not on
// how a source spelled it. ⛔ And it never merges one role in different cities.
//
// Measured on the local board (scripts/a49FingerprintMeasure.mjs, 1,624 US rows, each echoed as an
// adzuna row through the real deduper): "City, ST" merged 35.3% -> 99.3%, "City, State" 5.0% -> 99.3%,
// ", Inc." 0% -> 99.7%, " - Remote" 0% -> 99.7%; folds into a row in a different city 0 -> 0; real-board
// merges on replay 0 -> 0; the 66 one-role-several-cities groups collapsed 0 -> 0.
import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { computeFingerprint } from "../services/jobs/schema.js";
import { reconcileFingerprint, upsertCanonicalJob } from "../services/jobs/aggregator.js";
import { normalizeJob } from "../services/jobs/schema.js";

const fp = (location, over = {}) => computeFingerprint({ company: "Examplecorp", title: "Backend Engineer", location, ...over });
const same = (a, b, msg) => assert.equal(fp(a), fp(b), msg || `${a} ≡ ${b}`);
const apart = (a, b, msg) => assert.notEqual(fp(a), fp(b), msg || `${a} ≠ ${b}`);

test("one city, every spelling the board and the aggregators use, is one key", () => {
  for (const v of ["San Francisco, CA", "San Francisco, California", "San Francisco, California, United States",
                   "San Francisco, United States", "Hybrid - San Francisco", "US-San Francisco", "SF",
                   "San Francisco, CA | New York City, NY", "San Francisco, CA • New York, NY • United States"]) {
    same("San Francisco", v);
  }
  for (const v of ["New York, NY", "New York City, NY", "New York, New York, United States", "NYC", "New York, NY (HQ)"]) {
    same("New York, NY", v);
  }
  same("Austin, TX", "Austin, Texas");
});

test("a US-remote posting is one place however it is written", () => {
  for (const v of ["US - Remote", "US-Remote", "Remote (US)", "Remote - USA", "Remote in the US", "Remote, US", "US Remote"]) {
    same("Remote", v);
  }
  apart("Remote - Canada", "US - Remote", "a different market is a different job");
});

test("a legal-form suffix on the company and a workplace tag on the title do not split a posting", () => {
  same("Austin, TX", "Austin, TX", "");
  assert.equal(fp("Austin, TX", { company: "Examplecorp, Inc." }), fp("Austin, TX"));
  assert.equal(fp("Austin, TX", { company: "Examplecorp LLC" }), fp("Austin, TX"));
  assert.equal(fp("Austin, TX", { title: "Backend Engineer - Remote" }), fp("Austin, TX"));
  assert.equal(fp("Austin, TX", { title: "Backend Engineer (Remote, US)" }), fp("Austin, TX"));
  assert.notEqual(fp("Austin, TX", { company: "Examplecorp AI" }), fp("Austin, TX"), "only legal forms are stripped");
  assert.notEqual(fp("Austin, TX", { title: "Senior Backend Engineer" }), fp("Austin, TX"), "the role itself is kept");
});

test("⛔ different cities are NEVER one key — including the ambiguous names", () => {
  apart("San Francisco, CA", "New York, NY");
  apart("Portland, OR", "Portland, ME", "same city name, different states");
  apart("Portland", "Portland, OR", "a bare ambiguous name is not given a state");
  apart("Dublin", "Dublin, CA", "Dublin (Ireland) is not Dublin, California");
  apart("Washington", "Washington, DC");
  apart("London, UK", "London, ON");
  apart("San Francisco", "South San Francisco, CA");
  apart("Seattle, WA", "Bellevue, WA");
  same("SF, NYC, Remote", "San Francisco, CA", "a list's first city is its location, not 'remote'");
});

test("⛔ through the real deduper: an echo in another city gets its own row; the same city merges", () => {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  const VERDICT = { roleKey: "engineering", seniority: "mid", domain: "software", collar: "white", confidence: 0.9 };
  const write = (f) => {
    const job = normalizeJob({ title: "Backend Engineer", company: "Examplecorp", description: "d", ...f });
    const dedup = reconcileFingerprint(db, { ...job, company_icon_url: null });
    if (dedup.action === "fold") return dedup.intoJobId;
    upsertCanonicalJob(db, { jobId: job.id, canonical: dedup.job, verdict: VERDICT, contentHash: "h", searchQuery: "s",
      sourceLabel: "s", matchedBy: "t", dedup, now: 1_790_000_000 });
    return null;
  };
  write({ id: "4100001", req_id: "4100001", source: "greenhouse", location: "San Francisco",
          url: "https://boards.greenhouse.io/examplecorp/jobs/4100001" });
  assert.equal(write({ id: "a1", source: "adzuna", location: "San Francisco, California", company: "Examplecorp, Inc.",
                       url: "https://www.adzuna.com/land/ad/1" }), "greenhouse::4100001");
  assert.equal(write({ id: "a2", source: "adzuna", location: "Oakland, California",
                       url: "https://www.adzuna.com/land/ad/2" }), null, "a different city is a different job");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM scraped_jobs WHERE is_active = 1").get().n, 2);
});
