// Queue 37 — draft is US-only, and the board must hold that at ingestion.
//
// ⛔ The property under test above all others: AN UNPARSEABLE LOCATION IS NOT INCLUDED. This board
// went to zero four times through NULLs propagating into a filter; a gate that reads "unknown" as
// "keep" is the same defect pointed the other way, and it would pass every test that only checks
// that London is refused.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { classifyLocation, usEligibility, remoteRegionFromText, officeLocations } from "../services/jobs/usLocation.js";
import { holdOutOfMarket, OUT_OF_MARKET_PREFIX } from "../services/jobs/aggregator.js";
import { runHiringSignalsRollup } from "../services/jobs/hiringSignals.js";
import { at } from "../test-support/sourceAnchors.js";
import { planRetirement, run as runRetirement } from "../scripts/q37RetireOutOfMarket.mjs";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8").replace(/\r\n/g, "\n");

test("queue 37: US locations — states, codes, cities, the country, regions that contain it, multi-location", () => {
  for (const loc of [
    "San Francisco", "San Francisco, CA", "New York, NY (HQ)", "Pittsburgh, PA", "Washington, DC",
    "Seattle, Washington, United States", "United States", "US", "USA", "US-Remote", "Remote (US)",
    "Remote - United States", "Remote in the US", "North America", "AMER", "US / Canada",
    "Portland, OR", "Salem, OR", "New Mexico", "Dublin, CA", "NYC-Privy", "CHI, ATL", "SF, NYC, SEA",
    // ⭐ any US location makes the posting actionable for a US user
    "London, UK; San Francisco, CA", "Dublin, IE; London, UK; New York City, NY; Remote-Friendly, United States",
    "US-San Francisco; US-New York City; CA-Toronto; CA-Remote",
    "San Francisco, CA, New York, NY, Portland, OR, or Remote within Canada or United States",
  ]) assert.equal(classifyLocation(loc).verdict, "us", loc);
});

test("queue 37: non-US locations — including the codes that collide with US states", () => {
  for (const loc of [
    "Singapore", "London, UK", "London", "Dublin", "Dublin, Ireland", "Tokyo, Japan", "Bengaluru",
    "Hyderabad, India", "Toronto", "Vancouver, British Columbia, Canada", "Ontario - Remote", "Europe",
    "Latin America", "CA-Toronto", "Mexico City, MX", "Zürich, CH", "Dublin, IE", "CDMX", "Remote - Canada",
    // ⛔ the collisions: IN is India here, not Indiana; CA after a Canadian city is Canada
    "Bangalore, IN", "Toronto, CA", "Berlin, DE",
  ]) assert.equal(classifyLocation(loc).verdict, "non_us", loc);
});

test("queue 37: ⛔ NULL, blank and unreadable locations are UNKNOWN and are NOT admitted", () => {
  for (const loc of [null, undefined, "", "   ", "N/A", "n/a", "na", "LOCATION", "Not specified",
                     "Location not specified", "TBD", "Various"]) {
    assert.equal(classifyLocation(loc).verdict, "unknown", String(loc));
    const e = usEligibility({ location: loc, description: "" });
    assert.equal(e.admit, false, `${String(loc)} must not be admitted`);
    assert.equal(e.reason, "location_unparseable");
  }
  // No argument at all is the most NULL a row can be.
  assert.equal(usEligibility().admit, false);
  assert.equal(usEligibility({}).admit, false);
});

test("queue 37: an unqualified Remote is admitted ONLY on positive US evidence in the description", () => {
  const remote = (description) => usEligibility({ location: "Remote", description });
  assert.equal(classifyLocation("Remote").verdict, "remote_unqualified");
  assert.equal(remote("").admit, false, "silent → held out");
  assert.equal(remote(null).admit, false);
  assert.equal(remote("A great team. Competitive pay.").reason, "remote_region_unstated");
  assert.equal(remote("You must be based in the United States.").admit, true);
  assert.equal(remote("This role is remote within the US.").admit, true);
  assert.equal(remote("Candidates should work US time zones.").admit, true);
  assert.equal(remote("Candidates must be located in EMEA.").admit, false);
  assert.equal(remote("Candidates must be located in EMEA.").reason, "remote_non_us_by_description");
  // Both — not evidence either way, so not admitted.
  assert.equal(remoteRegionFromText("Based in the US or based in Europe."), null);
  assert.equal(remote("Based in the US or based in Europe.").admit, false);
});

test("queue 37: a source's structured offices can ADMIT a posting whose location field is unreadable, never refuse one", () => {
  assert.deepEqual(officeLocations({ offices: [{ name: "SF", location: "San Francisco, CA" }] }), ["San Francisco, CA"]);
  assert.deepEqual(officeLocations({ locations: [{ location: "Alameda HQ", city: "Alameda", region: "CA", country: "US" }] }),
                   ["Alameda HQ, Alameda, CA, US"]);
  assert.deepEqual(officeLocations(null), []);
  assert.equal(usEligibility({ location: "N/A", offices: ["San Francisco, CA"] }).reason, "us_office");
  assert.equal(usEligibility({ location: "N/A", offices: ["London, UK"] }).admit, false);
  assert.equal(usEligibility({ location: "Austin, TX", offices: ["London, UK"] }).admit, true);
});

test("queue 37: the ingestion gate retires and records a held-out row, and clears the record when admitted", () => {
  const calls = [];
  const stmts = {
    demoteStmt: { run: (id) => calls.push(["demote", id]) },
    rejectStmt: { run: (r) => calls.push(["reject", r.job_id, r.reason]) },
    clearOutOfMarketStmt: { run: (id) => calls.push(["clear", id]) },
  };
  assert.equal(holdOutOfMarket({ location: "London, UK", title: "T", company: "C", source: "lever" }, "a", stmts, 1), true);
  assert.equal(holdOutOfMarket({ location: null, title: "T", company: "C" }, "b", stmts, 1), true);
  assert.equal(holdOutOfMarket({ location: "Austin, TX" }, "c", stmts, 1), false);
  assert.deepEqual(calls, [
    ["demote", "a"], ["reject", "a", OUT_OF_MARKET_PREFIX + "non_us_location"],
    ["demote", "b"], ["reject", "b", OUT_OF_MARKET_PREFIX + "location_unparseable"],
    ["clear", "c"],
  ]);
});

test("queue 37: ⛔ the gate runs BEFORE the content-hash check in both ingestion loops", () => {
  // The cheap "unchanged" path calls touchSeenStmt, which sets is_active = 1. A gate after it lets
  // every stored non-US row ride back onto the board on each crawl.
  const agg = read("../services/jobs/aggregator.js");
  const loop = (start, end) => agg.slice(at(agg, start), at(agg, end, at(agg, start)));
  for (const [name, body] of [
    ["cacheJobs", loop("for (const job of fetchedJobs) {", "upsertCanonicalJob(db, {")],
    ["cacheJoboFeed", loop("function processJob(rawJob) {", "upsertCanonicalJob(db, {")],
  ]) {
    const gate = at(body, "holdOutOfMarket(", 0, name);
    assert.ok(gate < at(body, "fingerprintJob(job)", 0, name), `${name}: the gate must precede the hash`);
    assert.ok(gate < at(body, "touchSeenStmt.run(", 0, name), `${name}: the gate must precede the touch`);
  }
});

test("queue 37: the server.js write path is gated too, and the legacy default no longer asserts a US location", () => {
  const server = read("../server.js");
  // There were two; the LinkedIn insert path went with scrapeJobs, deleted 10-02 (18).
  assert.doesNotMatch(server, /const collarVerdict = unifiedClassifyJob\(/);
  const wb = at(server, "// Non-blocking write-back of live search results");
  const writeBack = server.slice(wb, at(server, "insert.run({", wb));
  assert.match(writeBack, /usEligibility\(/, "the live-search write-back must be gated");
  assert.doesNotMatch(read("../services/jobNormalization.js"), /\|\|\s*"United States";/, "normaliseItem must not default a blank location to the US");
});

function signalsDb() {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE scraped_jobs (job_id TEXT PRIMARY KEY, company TEXT, location TEXT, title TEXT, source TEXT,
             description TEXT, is_active INTEGER, discovered_at INTEGER, updated_at INTEGER, bucket_domain TEXT);
           CREATE TABLE rejected_jobs (job_id TEXT PRIMARY KEY, title TEXT, company TEXT, source TEXT, reason TEXT, rejected_at INTEGER);
           CREATE TABLE company_hiring_signals (company TEXT NOT NULL, window_start INTEGER NOT NULL, window_end INTEGER NOT NULL,
             open_count INTEGER NOT NULL DEFAULT 0, new_count INTEGER NOT NULL DEFAULT 0, expired_count INTEGER NOT NULL DEFAULT 0,
             domain_breakdown_json TEXT, growth_score REAL, updated_at INTEGER NOT NULL, PRIMARY KEY (company, window_end));`);
  const now = Math.floor(Date.now() / 1000);
  const ins = db.prepare("INSERT INTO scraped_jobs VALUES (?,?,?,?,?,?,?,?,?,NULL)");
  for (let i = 0; i < 300; i++) ins.run(`us${i}`, "Acme", "Austin, TX", "Engineer", "greenhouse", "", 1, now - 86400, now);
  for (let i = 0; i < 100; i++) ins.run(`uk${i}`, "Acme", "London, UK", "Engineer", "greenhouse", "", 1, now - 86400, now);
  return db;
}

test("queue 37: retiring the non-US rows is not read as roles closing (hiring signals), and the script is dry-run by default", () => {
  const db = signalsDb();
  const silent = () => {};
  const dry = runRetirement({ db, log: silent });
  assert.equal(dry.applied, false);
  assert.equal(dry.retire.length, 100);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM scraped_jobs WHERE is_active = 1").get().n, 400, "a dry run writes nothing");

  const applied = runRetirement({ db, apply: true, log: silent });
  assert.equal(applied.applied, true);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM scraped_jobs WHERE is_active = 1").get().n, 300);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM rejected_jobs WHERE reason LIKE 'out_of_market:%'").get().n, 100);

  const errors = console.error, logs = console.log;
  console.error = silent; console.log = silent;
  try { runHiringSignalsRollup(db); } finally { console.error = errors; console.log = logs; }
  const snap = db.prepare("SELECT * FROM company_hiring_signals WHERE company = 'Acme'").get();
  assert.equal(snap.open_count, 300);
  assert.equal(snap.expired_count, 0, "the 100 retired London rows are not 100 roles that closed");
  assert.equal(snap.new_count, 300, "nor are they new US roles");
});

test("queue 37: the retirement brake refuses a pass that would retire most of the board", () => {
  const plan = planRetirement([{ job_id: "a", location: "London" }, { job_id: "b", location: null }, { job_id: "c", location: "Austin, TX" }]);
  assert.equal(plan.retire.length, 2, "NULL is retired with the foreign row");
  const db = signalsDb();
  db.prepare("UPDATE scraped_jobs SET location = 'Paris' WHERE job_id LIKE 'us%' AND CAST(substr(job_id, 3) AS INTEGER) < 200").run();
  const r = runRetirement({ db, apply: true, log: () => {} });
  assert.equal(r.refused, true);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM scraped_jobs WHERE is_active = 1").get().n, 400, "refused means nothing written");
});
