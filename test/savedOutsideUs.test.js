import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { ingestJob } from "../services/jobs/jobGateway.js";
import { mapJobRow } from "../services/jobs/mapJobRow.js";
import { at } from "../test-support/sourceAnchors.js";

// A62 follow-up (10-02, 18). A capture the US-only gate holds off the shared board is kept for its
// owner (starred, in Saved) and set is_active = 0 — the same state an expired listing is retired
// to. The Saved tab read is_active alone, so it told the owner the posting was "NO LONGER LISTED".
// It is listed; the board is US-only. These pin the distinction end to end: what the gateway
// writes, what the Saved query reads, what mapJobRow publishes and what the card says.

const SERVER = fs.readFileSync("server.js", "utf8").replace(/\r\n/g, "\n");
const CARD = fs.readFileSync("client/src/components/JobCard.jsx", "utf8").replace(/\r\n/g, "\n");

// The projection exactly as the board SELECT carries it, so the behavioural test runs the real SQL.
function heldSql() {
  const start = at(SERVER, "uj.disliked,\n                (sj.is_active = 0 AND EXISTS");
  const expr = SERVER.slice(at(SERVER, "(sj.is_active = 0", start), at(SERVER, " AS held_outside_us", start));
  return `${expr} AS held_outside_us`;
}

function db() {
  const d = new Database(":memory:");
  for (const m of MIGRATIONS) d.exec(m.sql);
  d.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'a','x')").run();
  return d;
}

test("a capture the gateway holds outside the US reads as held, and an expired row does not", () => {
  const d = db();
  const abroad = { id: "greenhouse:acme:9", title: "Backend Engineer", company: "Acme", location: "London, United Kingdom",
                   url: "https://job-boards.greenhouse.io/acme/jobs/9", source: "greenhouse", description: "London, UK. Go." };
  const home = { id: "greenhouse:acme:10", title: "Backend Engineer", company: "Acme", location: "Austin, TX",
                 url: "https://job-boards.greenhouse.io/acme/jobs/10", source: "greenhouse", description: "Austin, TX. Go." };
  assert.equal(ingestJob(d, { job: abroad, origin: "capture", userId: 1 }).outOfMarket, true);
  assert.equal(ingestJob(d, { job: home, origin: "capture", userId: 1 }).outOfMarket, false);
  d.prepare("UPDATE scraped_jobs SET is_active = 0 WHERE job_id = ?").run(home.id); // expired, not held

  const read = (id) => d.prepare(`SELECT sj.is_active, ${heldSql()} FROM scraped_jobs sj WHERE sj.job_id = ?`).get(id);
  const held = mapJobRow({ job_id: abroad.id, ...read(abroad.id) });
  const expired = mapJobRow({ job_id: home.id, ...read(home.id) });
  assert.equal(held.isActive, false);
  assert.equal(held.heldOutsideUs, true, "the gate's own record must reach the card");
  assert.equal(expired.isActive, false);
  assert.equal(expired.heldOutsideUs, false, "an expired listing must still read as closed");
  d.close();
});

test("a live row is never held, whatever the reject log says", () => {
  // Only an inactive row can be held: a stale reject record must not relabel a posting on the board.
  const d = db();
  const job = { id: "greenhouse:acme:11", title: "Backend Engineer", company: "Acme", location: "Austin, TX",
                url: "https://job-boards.greenhouse.io/acme/jobs/11", source: "greenhouse", description: "Austin, TX." };
  ingestJob(d, { job, origin: "capture", userId: 1 });
  d.prepare("INSERT OR REPLACE INTO rejected_jobs (job_id, title, company, source, reason, rejected_at) VALUES (?, '', '', '', 'out_of_market:non_us', 0)").run(job.id);
  const row = d.prepare(`SELECT sj.is_active, ${heldSql()} FROM scraped_jobs sj WHERE sj.job_id = ?`).get(job.id);
  assert.equal(mapJobRow({ job_id: job.id, ...row }).heldOutsideUs, false);
  assert.equal(mapJobRow({}).heldOutsideUs, false, "absent means not held");
  d.close();
});

test("Pipeline Health's job list labels an inactive row by why it is off the board, not as UNENRICHED", () => {
  // The scrape monitor lists inactive rows too; it labelled them by enrichment alone, so the held
  // capture read "UNENRICHED" — seen on the admin screenshots, 10-02 (18).
  const routes = fs.readFileSync("routes/adminDb.js", "utf8").replace(/\r\n/g, "\n");
  const monitor = routes.slice(at(routes, 'router.get("/scrape-monitor"'), at(routes, "FROM scraped_jobs sj", at(routes, 'router.get("/scrape-monitor"')));
  const expr = monitor.slice(at(monitor, "(sj.is_active = 0 AND EXISTS"), at(monitor, " AS held_outside_us"));
  const d = db();
  const abroad = { id: "greenhouse:acme:12", title: "Data Engineer", company: "Acme", location: "Dublin, Ireland",
                   url: "https://job-boards.greenhouse.io/acme/jobs/12", source: "greenhouse", description: "Dublin, Ireland." };
  ingestJob(d, { job: abroad, origin: "capture", userId: 1 });
  assert.equal(d.prepare(`SELECT ${expr} AS h FROM scraped_jobs sj WHERE sj.job_id = ?`).get(abroad.id).h, 1);
  d.close();
  const inspector = fs.readFileSync("client/src/pages/admin/DBInspector.jsx", "utf8").replace(/\r\n/g, "\n");
  const labelAt = at(inspector, "const statusLabel = (job) => {");
  const label = inspector.slice(labelAt, at(inspector, 'label:"UNENRICHED"', labelAt));
  assert.match(label, /job\.is_active === 0\) return job\.held_outside_us\s*\? \{ label:"OUTSIDE US"/,
    "the inactive check must come before the enrichment labels");
});

test("the card says OUTSIDE THE US instead of NO LONGER LISTED for a held row", () => {
  assert.match(CARD, /Outside the US/);   // D60: a mark in the logo face, mixed case
  assert.match(CARD, /\{job\.heldOutsideUs \? <OutsideUsPill\/> : job\.isActive === false && <ClosedPill\/>\}/,
    "held takes precedence; otherwise an inactive row is closed");
});
