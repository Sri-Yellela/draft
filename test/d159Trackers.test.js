// ⭐ D159 T2–T4 (46y) · TRACKERS: a saved search with "new since last seen", a followed company as a feed, a pasted careers
// page / ATS board that follows a crawled company at once or goes to the D82 candidate pool and resolves after approval.
// One fully migrated in-memory db; the "read workers" are the db. Synthetic companies only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { MERGE_PLAN } from "../services/accountService.js";
import {
  readPage, trackPage, resolvePending, listTrackers, companyNewCounts, markCompanySeen, markSearchSeen, searchLabel, untrackPage,
} from "../services/trackers.js";
import { poolCandidates } from "../services/companyCandidates.js";

const NOW = Date.parse("2026-11-20T15:00:00Z") / 1000;
const read = (db) => ({ all: async (sql, p = []) => db.prepare(sql).all(...p), get: async (sql, p = []) => db.prepare(sql).get(...p) });
const src = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

function world() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash, password_set) VALUES (7, 'maya', 'h:x', 1)").run();
  db.prepare("INSERT INTO users (id, username, password_hash, password_set) VALUES (8, 'omar', 'h:x', 1)").run();
  db.prepare(`INSERT INTO domain_profiles (id, user_id, profile_name, role_family, domain, is_active) VALUES (70, 7, 'Backend', 'engineering', 'software', 1)`).run();
  // a crawled company: its board pair, its record and the board's alias (what the record walk writes)
  db.prepare("INSERT OR IGNORE INTO company_ats_list (company, ats_type, ats_slug) VALUES ('Northwind Labs', 'lever', 'northwind')").run();
  db.prepare("INSERT INTO companies (id, slug, name) VALUES (501, 'northwind-labs', 'Northwind Labs')").run();
  db.prepare("INSERT INTO company_aliases (alias_key, company_id, evidence) VALUES ('ats:lever:northwind', 501, 'test')").run();
  db.prepare("INSERT INTO company_aliases (alias_key, company_id, evidence) VALUES ('domain:northwind.example', 501, 'test')").run();
  return db;
}
let n = 0;
function posting(db, { company = 501, seenAgo = 600, ghost = null, active = 1 } = {}) {
  const id = `t${++n}`;
  db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, company, title, _hash, source, is_active, ghost_level, discovered_at)
    VALUES (?, 'q', 'Northwind Labs', ?, ?, 'lever', ?, ?, ?)`).run(id, `Engineer ${id}`, id, active, ghost, NOW - seenAgo);
  db.prepare("INSERT INTO job_company (job_id, company_id) VALUES (?, ?)").run(id, company);
  return id;
}

test("D159 · readPage reads a board with the ONE link parser, a careers site by its domain, and refuses non-links", () => {
  assert.deepEqual((({ kind, atsType, slug }) => ({ kind, atsType, slug }))(readPage("https://jobs.lever.co/northwind")), { kind: "board", atsType: "lever", slug: "northwind" });
  assert.equal(readPage("https://boards.greenhouse.io/acmeco").atsType, "greenhouse");
  assert.equal(readPage("https://jobs.ashbyhq.com/acmeco").atsType, "ashby");
  assert.deepEqual(readPage("https://careers.northwind.example/jobs"), { kind: "site", domain: "northwind.example" });
  assert.equal(readPage("not a url").reason, "not_a_url");
  assert.equal(readPage("javascript:alert(1)").reason, "not_a_url");
  assert.equal(readPage("https://www.linkedin.com/jobs/view/1").kind, "none", "a job board we never read is not a careers page");
});

test("D159 T4 · d159TrackUrlFollowsCrawledBoard — a board we crawl is followed at once (company_follows, T1's table)", () => {
  const db = world();
  let pooled = 0;
  const r = trackPage(db, 7, "https://jobs.lever.co/northwind", { pool: () => { pooled++; return {}; }, now: NOW });
  assert.equal(r.status, "following");
  assert.equal(r.company.slug, "northwind-labs");
  assert.equal(pooled, 0, "a crawled board never goes to the candidate pool");
  assert.ok(db.prepare("SELECT 1 FROM company_follows WHERE user_id = 7 AND company_id = 501").get());
  assert.equal(listTrackers(db, 7).pages.length, 0, "a resolved page is the company follow, not a second row on the list");
  // a careers SITE on a known domain follows too
  assert.equal(trackPage(db, 8, "https://careers.northwind.example/jobs", { now: NOW }).status, "following");
});

test("D159 T3 · d159TrackUrlAddsSource — an unknown board goes to the D82 candidate pool, waits, then resolves after approval", () => {
  const db = world();
  const r = trackPage(db, 7, "https://boards.greenhouse.io/zephyrdata", { pool: poolCandidates, now: NOW });
  assert.equal(r.status, "pending");
  const c = db.prepare("SELECT * FROM company_candidates WHERE ats_type = 'greenhouse' AND ats_slug = 'zephyrdata'").get();
  assert.ok(c, "pooled for the nightly probe and the owner's approval");
  assert.equal(c.source, "user");
  assert.equal(c.status, "new");
  assert.equal(db.prepare("SELECT COUNT(*) FROM company_ats_list WHERE ats_slug = 'zephyrdata'").pluck().get(), 0, "⛔ never added without the owner");
  assert.equal(listTrackers(db, 7).pages[0].status, "pending");
  assert.equal(resolvePending(db, 7, { now: NOW }), 0, "still waiting");
  // the owner approves (addCompany), the crawl links postings → the board's alias exists
  db.prepare("INSERT INTO company_ats_list (company, ats_type, ats_slug) VALUES ('Zephyrdata', 'greenhouse', 'zephyrdata')").run();
  db.prepare("INSERT INTO companies (id, slug, name) VALUES (502, 'zephyrdata', 'Zephyrdata')").run();
  db.prepare("INSERT INTO company_aliases (alias_key, company_id, evidence) VALUES ('ats:greenhouse:zephyrdata', 502, 'test')").run();
  assert.equal(resolvePending(db, 7, { now: NOW }), 1);
  assert.ok(db.prepare("SELECT 1 FROM company_follows WHERE user_id = 7 AND company_id = 502").get());
  assert.equal(listTrackers(db, 7).pages.length, 0);
  // the same paste again is the same row (UNIQUE user + url), and untrack is scoped to the person
  const again = trackPage(db, 7, "https://boards.greenhouse.io/zephyrdata", { now: NOW });
  assert.equal(again.status, "following");
  const id = db.prepare("SELECT id FROM tracked_pages WHERE user_id = 7").pluck().get();
  assert.throws(() => untrackPage(db, 8, id), /not on your list/);
});

test("D159 T3 · a page with no readable board is kept as unsupported — nothing fetched, nothing pooled", () => {
  const db = world();
  let pooled = 0;
  const r = trackPage(db, 7, "https://careers.unknown-co.example/open-roles", { pool: () => { pooled++; return {}; }, now: NOW });
  assert.equal(r.status, "unsupported");
  assert.equal(pooled, 0);
  assert.equal(listTrackers(db, 7).pages[0].status, "unsupported");
  assert.throws(() => trackPage(db, 7, "ftp://x", { now: NOW }), /not a web address/);
});

test("D159 T1/T4 · d159FollowCompanyAlerts — the feed counts live, non-ghost postings first seen since last seen, on the read workers", async () => {
  const db = world();
  trackPage(db, 7, "https://jobs.lever.co/northwind", { now: NOW - 3600 });   // followed an hour ago
  posting(db, { seenAgo: 7200 });                // before the follow — not new
  posting(db, { seenAgo: 600 });                 // new
  posting(db, { seenAgo: 300 });                 // new
  posting(db, { seenAgo: 300, ghost: 2 });       // ⛔ D137: Likely not hiring
  posting(db, { seenAgo: 300, active: 0 });      // closed
  assert.equal((await companyNewCounts(read(db), 7)).get(501), 2);
  markCompanySeen(db, 7, 501, { now: NOW });
  assert.equal((await companyNewCounts(read(db), 7)).get(501) || 0, 0, "seen → nothing new");
  assert.throws(() => markCompanySeen(db, 8, 501, { now: NOW }), /don't follow/);
});

test("D159 T2 · d159SavedSearchNewCount — the saved search (FE-3's one slot) is listed with its sentence and its lastSeenAt", () => {
  const db = world();
  db.prepare("UPDATE domain_profiles SET tracked_search_json = ? WHERE id = 70")
    .run(JSON.stringify({ params: "work_models=remote&ageFilter=", name: null, savedAt: NOW - 86400 }));
  const s = listTrackers(db, 7).searches[0];
  assert.equal(s.profileId, 70);
  assert.equal(s.lastSeenAt, NOW - 86400, "never opened → counted from when it was saved");
  assert.match(s.label, /remote/i, "the label is the filter sentence");
  markSearchSeen(db, 7, 70, { now: NOW });
  assert.equal(listTrackers(db, 7).searches[0].lastSeenAt, NOW);
  assert.equal(JSON.parse(db.prepare("SELECT tracked_search_json FROM domain_profiles WHERE id = 70").pluck().get()).params,
    "work_models=remote&ageFilter=", "the saved search itself is untouched");
  assert.throws(() => markSearchSeen(db, 8, 70, { now: NOW }), /no saved search/);
  assert.equal(typeof searchLabel(""), "string");
});

test("D159 · the search count is the BOARD's own statement (boardPageResponse measure + first seen), mounted behind requireAuth", () => {
  const server = src("server.js");
  assert.match(server, /app\.use\("\/api\/trackers", requireAuth, createTrackersRouter\(db, \{ read: readPool, countSearch:/);
  assert.match(server, /boardPageResponse\(\{ user, boardProfileId: profileId, query: Object\.fromEntries\(new URLSearchParams\(String\(params \|\| ""\)\)\) \}, \{ measure:/);
  assert.match(server, /AND \$\{FIRST_SEEN_SQL\}`, \[\.\.\.baseArgs, since\]/);
  const svc = src("services/trackers.js");
  assert.match(svc, /import \{ poolCandidates \} from "\.\/companyCandidates\.js"/, "A93: the D82 pool, never a second add path");
  assert.doesNotMatch(svc, /addCompany|axios|fetch\(/, "⛔ no add and no fetch on a request path");
  assert.doesNotMatch(svc, /callTask|anthropic|modelClient/i, "⛔ D190: no model");
  const panel = src("client/src/panels/JobsPanel.jsx");
  assert.match(panel, /api\(`\/api\/trackers\/searches\/\$\{activeDomainProfile\.id\}\/seen`, \{ method: "POST" \}\)/, "opening the saved search marks it seen");
});

test("D159 · migration 279 is in both runners, and the account merge knows tracked_pages", () => {
  assert.ok(MIGRATIONS.some((m) => m.id === "279_trackers"));
  assert.equal(MERGE_PLAN.tracked_pages, "keepInto");
});
