// ⭐ D74 P1 · "NEW SINCE YOUR LAST VISIT" — on FIRST SEEN. Each red when removed:
// a reload inside a visit does NOT move the cutoff; a load after a 30-minute gap starts a new visit and the
// cutoff becomes the previous visit's last load · a first visit reads the last day · the lens filters on
// FIRST SEEN (discovered_at), never the posted date · GET /api/jobs rolls the visit and the facets do not ·
// the option is in the one table, the sentence's words and the mobile contract.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { touchBoardVisit, visitSince, FIRST_SEEN_SQL, VISIT_GAP_SEC, FIRST_VISIT_SEC } from "../services/boardVisit.js";
import { POSTING_AGE } from "../shared/jobFilterOptions.js";
import { SENTENCE_WORDS, PANEL_WORDS } from "../shared/filterSentence.js";
import { at } from "../test-support/sourceAnchors.js";

const T = 1_900_000_000;
function db0() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1, 'u1', 'x')").run();
  return db;
}

test("⭐ D74 P1: a visit holds its cutoff across reloads; a 30-minute gap starts the next visit", () => {
  const db = db0();
  assert.equal(visitSince(db, 1, { now: T }), T - FIRST_VISIT_SEC, "a first visit reads the last day");
  touchBoardVisit(db, 1, { now: T });                                   // visit 1 begins
  touchBoardVisit(db, 1, { now: T + 600 });                             // reload, same visit
  assert.equal(visitSince(db, 1, { now: T + 600 }), T + 600 - FIRST_VISIT_SEC, "still the first visit: no previous one yet");
  touchBoardVisit(db, 1, { now: T + 1200 });                            // last load of visit 1
  const v2 = T + 1200 + VISIT_GAP_SEC;                                  // back after the gap
  assert.equal(touchBoardVisit(db, 1, { now: v2 }).newVisit, true);
  assert.equal(visitSince(db, 1, { now: v2 }), T + 1200, "the cutoff is the previous visit's LAST load");
  touchBoardVisit(db, 1, { now: v2 + 300 });                            // reload inside visit 2
  assert.equal(visitSince(db, 1, { now: v2 + 300 }), T + 1200, "a reload does not move the cutoff");
});

test("⭐ D74 P1: the lens filters on FIRST SEEN, never the posted date", () => {
  const db = db0();
  const ins = db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, _hash, title, company, url, source, posted_at, is_active, discovered_at)
    VALUES (?, 't', ?, 'Engineer', 'Acme', ?, 'greenhouse', ?, 1, ?)`);
  ins.run("new-old-date", "h1", "https://x/1", "2026-01-01T00:00:00Z", T - 60);           // first seen just now, posted long ago
  ins.run("old-new-date", "h2", "https://x/2", new Date(T * 1000).toISOString(), T - 5 * 86400); // seen days ago, "posted" today
  const ids = db.prepare(`SELECT job_id FROM scraped_jobs sj WHERE ${FIRST_SEEN_SQL}`).pluck().all(T - 3600);
  assert.deepEqual(ids, ["new-old-date"]);
  assert.match(FIRST_SEEN_SQL, /discovered_at/);
  assert.doesNotMatch(FIRST_SEEN_SQL, /posted_at/);
});

test("⭐ D74 P1: GET /api/jobs rolls the visit; the board resolves `visit`; the facets only READ it", () => {
  const src = fs.readFileSync("server.js", "utf8").replace(/\r\n/g, "\n");
  const route = src.slice(at(src, 'app.get("/api/jobs", requireAuth'), at(src, "\n});", at(src, 'app.get("/api/jobs", requireAuth')));
  assert.match(route, /touchBoardVisit\(db, req\.user\.id\)/, "a board load is a visit");
  const facets = src.slice(at(src, 'app.get("/api/jobs/facets"'), at(src, "\n});", at(src, 'app.get("/api/jobs/facets"')));
  assert.doesNotMatch(facets, /touchBoardVisit/, "counting is not visiting");
  assert.match(facets, /visitSinceSec: visitSince\(db, req\.user\.id/);
  assert.match(src, /else if \(ageFilter === "visit"\) \{[\s\S]{0,400}FIRST_SEEN_SQL[\s\S]{0,200}visitSince\(db, req\.user\.id/);
});

test("D74 P1: the option lives in the one table, the sentence's words and the mobile contract", () => {
  const o = POSTING_AGE.options.find((x) => x.value === "visit");
  assert.ok(o && o.sinceVisit === true && o.days === null);
  assert.equal(SENTENCE_WORDS.posted.visit, "new since your last visit");
  assert.equal(PANEL_WORDS.posted.visit, "since your last visit");
  const contract = JSON.parse(fs.readFileSync("contract/mobile-api.v1.json", "utf8"));
  assert.ok(JSON.stringify(contract).includes('"visit"'), "the contract's ageFilter enum carries it");
});
