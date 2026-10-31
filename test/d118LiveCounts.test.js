// ⭐ D118 P1 · COUNTS MOVE WITH THE BOARD (owner 10-31: "a new job is ingested featuring python, that should reflect across
// the postings we show"). A posting ingested, changed, closed or expired moves the Atlas's live rows by itself — through
// the ONE matcher — and the nightly pass is the reconciliation, logging its drift. Synthetic companies and postings; an
// in-memory database built from the migrations; the routes through their real router.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { upsertNode, setStatus } from "../services/atlas/atlasStore.js";
import { computeAtlasStats } from "../services/atlas/atlasStats.js";
import { syncAtlasPostings, liveCached, liveRoleLevels, LIVE_CACHE_MS, liveSnapshot } from "../services/atlas/atlasLive.js";
import { atlasTermsFor, atlasTermsForPosting, peekNode } from "../services/atlas/atlasLinks.js";
import { computeYourMap, boardCounts } from "../services/atlas/atlasMe.js";
import { roleBoard } from "../services/atlas/atlasRolePage.js";
import { createAtlasRouter } from "../routes/atlas.js";
import { ingestJob } from "../services/jobs/jobGateway.js";
import { retireRows } from "../services/jobs/boardAge.js";
import { retireDuplicate } from "../services/jobs/dedupRetire.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
function fixtureDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  return db;
}
const node = (db, kind, name, { published = true } = {}) => {
  const { id } = upsertNode(db, { kind, name, source: "registry" });
  if (published) setStatus(db, db.prepare(`SELECT slug FROM atlas_nodes WHERE id = ?`).pluck().get(id), "published");
  return id;
};
let seq = 0;
const post = (db, { title = "Backend Engineer", company = "Co", text, level = null, skills = null, active = 1 } = {}) => {
  const id = `l${++seq}`;
  db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, _hash, title, company, url, description, is_active, level_read, skills_json)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(id, "q", `h${id}`, title, company, `https://x.test/${id}`, text, active, level, skills);
  return id;
};
/** The live count — straight from the row every surface reads, NO sync, NO nightly. */
const statOf = (db, id) => db.prepare(`SELECT postings FROM atlas_node_stats WHERE node_id = ?`).pluck().get(id) ?? 0;
const queued = (db) => db.prepare(`SELECT COUNT(*) FROM atlas_posting_dirty`).pluck().get();

function board() {
  const db = fixtureDb();
  const ids = {
    python: node(db, "skill", "Python"),
    kubernetes: node(db, "tool", "Kubernetes"),
    sql: node(db, "skill", "SQL"),
    backend: node(db, "role", "Backend Engineer"),
  };
  post(db, { text: "You will write Python services every day for our customers.", level: "mid" });
  post(db, { text: "Run Kubernetes clusters and write SQL reports.", level: "senior" });
  post(db, { title: "Data Analyst", text: "SQL dashboards in Python for the finance team." });
  computeAtlasStats(db, { now: 1000 });   // the baseline
  return { db, ids };
}

test("D118 P1 · d118IngestMovesCounts — a new posting asking for Python → Python's count +1 on the next read, without the nightly pass", async () => {
  const { db, ids } = board();
  assert.equal(statOf(db, ids.python), 2);
  assert.equal(peekNode(db, "python").postings, 2);

  // (a) A row written by ANY path (here a bare INSERT — a script) is queued by the trigger and counted on the next read.
  post(db, { text: "We need Python and Kubernetes on day one.", level: "mid" });
  assert.equal(queued(db), 1, "the trigger queued it");
  assert.equal(peekNode(db, "python").postings, 3, "the popup's count, on the next read");
  assert.equal(statOf(db, ids.python), 3, "the row itself moved");
  assert.equal(queued(db), 0);
  // The same live rows feed YOUR MAP and the role page: Backend Engineer now has 3 postings, 2 of them asking for Python.
  const role = roleBoard(db, "backend-engineer");
  assert.equal(role.postings, 3);
  assert.equal(role.topSkills.find(s => s.slug === "python").postings, 2);
  assert.equal(liveRoleLevels(db).roles.get(ids.backend).levels.get("mid").skill.get(ids.python), 2, "per level read");
  assert.equal(boardCounts(db, []).postings, 4, "YOUR MAP's board total");

  // (b) The ingest path moves the counts INSIDE its own transaction — the row moves before anything reads it.
  ingestJob(db, { job: { id: "greenhouse:northwind:7", title: "Backend Engineer", company: "Northwind", location: "Boston, MA",
    url: "https://job-boards.greenhouse.io/northwind/jobs/7", source: "greenhouse", description: "Python and SQL services. Boston, MA." }, origin: "capture" });
  assert.equal(queued(db), 0, "drained by the ingest itself");
  assert.equal(statOf(db, ids.python), 4);
  assert.equal(statOf(db, ids.sql), 3, "2 before + this one");
  assert.equal(statOf(db, ids.backend), 4, "the role counts too");

  // (c) Over HTTP: the Atlas page's "On the board" and the popup.
  post(db, { text: "Python, again.", company: "Zed" });
  const app = express();
  app.use("/api/atlas", createAtlasRouter(db));
  const server = app.listen(0);
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await (await fetch(`${base}/api/atlas/node/python`)).json()).onTheBoard.postings, 5);
    assert.equal((await (await fetch(`${base}/api/atlas/peek/python`)).json()).postings, 5);
  } finally { server.close(); }
});

test("D118 P1 · d118CloseMovesCounts — closed, expired, retired as a duplicate, deleted or rewritten: the count goes down at once", () => {
  const { db, ids } = board();
  const a = post(db, { text: "Python one.", company: "A" });
  const b = post(db, { text: "Python two.", company: "B" });
  const c = post(db, { text: "Python three.", company: "C" });
  const d = post(db, { text: "Python four.", company: "D", level: "senior" });
  const e = post(db, { text: "Python five.", company: "E" });
  syncAtlasPostings(db);
  assert.equal(statOf(db, ids.python), 7);

  // the crawl's retire (aged out / stale) — services/jobs/boardAge.js retireRows, in its own transaction
  retireRows(db, [{ job_id: a, title: "Backend Engineer", company: "A", source: "x" }], "aged_out");
  assert.equal(statOf(db, ids.python), 6, "retired: drained inside the retire's transaction");
  // a dedup retire — services/jobs/dedupRetire.js
  retireDuplicate(db, { fromJobId: b, toJobId: c });
  assert.equal(statOf(db, ids.python), 5);
  // the expiry cleanup's DELETE (runExpiredJobsCleanup) — queued by the delete trigger, drained on the next read
  db.prepare(`DELETE FROM scraped_jobs WHERE job_id = ?`).run(c);
  assert.equal(peekNode(db, "python").postings, 4);
  // a manual close (any UPDATE … is_active = 0)
  db.prepare(`UPDATE scraped_jobs SET is_active = 0 WHERE job_id = ?`).run(d);
  assert.equal(peekNode(db, "python").postings, 3);
  assert.equal(liveRoleLevels(db).roles.get(ids.backend).levels.get("senior")?.skill.get(ids.python) ?? 0, 0, "and out of its level's counts");
  // an update that no longer asks for Python
  db.prepare(`UPDATE scraped_jobs SET description = 'Go services only.' WHERE job_id = ?`).run(e);
  assert.equal(peekNode(db, "python").postings, 2);
  // reopened → counted again
  db.prepare(`UPDATE scraped_jobs SET is_active = 1 WHERE job_id = ?`).run(d);
  assert.equal(peekNode(db, "python").postings, 3);

  // ⛔ Every writer that closes postings calls the live pass (the triggers catch the rest on the next read).
  const server = read("server.js");
  const cleanup = server.slice(at(server, "function runExpiredJobsCleanup()"), at(server, "// Cascade: remove orphaned user records for expired jobs"));
  assert.ok(at(cleanup, "atlasPostingsChanged(db)") > at(cleanup, "DELETE FROM scraped_jobs WHERE ${EXPIRED_PREDICATE}"), "the expiry cleanup");
  const agg = read("services/jobs/aggregator.js");
  assert.ok(at(agg, "if (byDate.changes || byStale.changes) atlasPostingsChanged(db);") > at(agg, "byStale = markStale.run("), "the crawl's expiry prune");
  assert.ok(at(agg, "atlasPostingsChanged(db);\n        return { cached, unchanged") > 0, "the crawl's upsert transaction");
  assert.match(read("routes/jobData.js"), /retire\.run\(now, j\);[\s\S]{0,200}atlasPostingsChanged\(db\);/, "an import revert (the manual close)");
});

// A seeded pseudo-random walk over a board whose companies share sentences near the boilerplate line (30 % and ≥ 3):
// postings arrive, change, move company, close, reopen and are deleted — and the nightly recount finds nothing to fix.
test("D118 P1 · d118NightlyDriftZero — after ingests, updates and closes, the full recount finds the live rows exactly right (drift 0)", () => {
  const db = fixtureDb();
  const ids = ["Python", "Kubernetes", "SQL", "Go", "Terraform"].map(n => node(db, n === "Go" ? "skill" : "tool", n));
  node(db, "role", "Backend Engineer");
  node(db, "role", "Data Engineer");
  node(db, "skill", "Rust", { published: false });
  let s = 7;
  // The HIGH bits (an LCG's low bits cycle with a period of 2, 4, … — `s % 4` would tie every choice to the last).
  const rnd = (n) => { s = (s * 1103515245 + 12345) % 2147483648; return Math.floor((s / 2147483648) * n); };
  const ABOUT = ["Acme builds payment software with Python and Kubernetes for merchants everywhere.",
    "Our platform team ships Terraform modules for every product we run today.",
    "We value curiosity and write SQL reports about our customers every week."];
  const LINES = ["You will write Python services.", "Run Kubernetes in production.", "Requirements:\n- SQL and Go", "Ideally you have Terraform.", "Rust is a plus.", "Draw the checkout flows."];
  const TITLES = ["Backend Engineer", "Senior Backend Engineer", "Data Engineer", "Designer"];
  const COMPANIES = ["Acme", "Beta", "Gamma", ""];
  const LEVELS = [null, "entry", "mid", "senior"];
  const text = () => [ABOUT[rnd(3)], rnd(2) ? ABOUT[rnd(3)] : "", LINES[rnd(6)], LINES[rnd(6)]].join("\n");
  const live = [];
  const add = () => live.push(post(db, { title: TITLES[rnd(4)], company: COMPANIES[rnd(4)], text: text(), level: LEVELS[rnd(4)],
    skills: rnd(4) === 0 ? JSON.stringify(["Go", "SQL"]) : null }));
  for (let i = 0; i < 25; i++) add();
  assert.equal(computeAtlasStats(db, { now: 1 }).drift, null, "the first pass is the baseline");

  for (let step = 0; step < 300; step++) {
    const op = rnd(9);
    const id = live[rnd(live.length)];
    // INSERT OR REPLACE gives the posting a new row id and fires no delete trigger — its old reading must still go.
    if (op === 8) {
      db.prepare(`INSERT OR REPLACE INTO scraped_jobs (job_id, search_query, _hash, title, company, url, description, is_active)
        VALUES (?, 'q', ?, ?, ?, ?, ?, 1)`).run(id, `h${id}`, TITLES[rnd(4)], COMPANIES[rnd(4)], `https://x.test/${id}`, text());
      continue;
    }
    if (op <= 1) add();
    else if (op === 2) db.prepare(`UPDATE scraped_jobs SET is_active = 1 - is_active WHERE job_id = ?`).run(id);
    else if (op === 3) db.prepare(`UPDATE scraped_jobs SET description = ? WHERE job_id = ?`).run(text(), id);
    else if (op === 4) db.prepare(`UPDATE scraped_jobs SET company = ? WHERE job_id = ?`).run(COMPANIES[rnd(4)], id);
    else if (op === 5) db.prepare(`UPDATE scraped_jobs SET level_read = ?, title = ? WHERE job_id = ?`).run(LEVELS[rnd(4)], TITLES[rnd(4)], id);
    else if (op === 6 && live.length > 5) { db.prepare(`DELETE FROM scraped_jobs WHERE job_id = ?`).run(id); live.splice(live.indexOf(id), 1); }
    else db.prepare(`UPDATE scraped_jobs SET skills_json = ? WHERE job_id = ?`).run(rnd(2) ? JSON.stringify(["Go"]) : null, id);
    if (rnd(3) === 0) syncAtlasPostings(db);   // reads land between writes, and sometimes several writes queue up
  }
  syncAtlasPostings(db);
  const before = liveSnapshot(db);
  const r = computeAtlasStats(db, { now: 2 });
  assert.deepEqual(r.drift, { drift: 0, rowsOff: 0, vocabChanged: false }, "the nightly pass corrected nothing");
  assert.ok(before.postings > 0 && [...before.nodes.values()].some(v => v > 0));
  assert.ok(ids.every(id => statOf(db, id) >= 0));

  // …and it says when it DID correct something: a count edited behind the store's back is drift, measured.
  db.prepare(`UPDATE atlas_node_stats SET postings = postings + 2 WHERE node_id = ?`).run(ids[0]);
  assert.deepEqual(computeAtlasStats(db, { now: 3 }).drift, { drift: 2, rowsOff: 1, vocabChanged: false });
  // The cron logs it as a number.
  assert.match(read("server.js"), /console\.log\(`\[Cron\] atlas drift: \$\{a\.drift \? `\$\{a\.drift\.drift\}/);
});

test("D118 P1 · d118SpansAtIngest — the posting's D114 links are written with its reading, and served from it", () => {
  const { db, ids } = board();
  node(db, "concept", "Interpretability");
  const draft = node(db, "tool", "Terraform", { published: false });
  const job = post(db, { title: "Backend Engineer", company: "Acme", text: "Requirements:\n- Python and Terraform\n- Interpretability research", skills: null });
  syncAtlasPostings(db);
  const pid = db.prepare(`SELECT id FROM scraped_jobs WHERE job_id = ?`).pluck().get(job);
  const row = db.prepare(`SELECT linked, asked, vocab FROM atlas_posting_match WHERE posting_id = ?`).get(pid);
  const linked = row.linked.split(",").map(Number);
  assert.ok(linked.includes(ids.python) && linked.includes(draft) && linked.includes(ids.backend), "written at ingest — drafts too, and the role by its term");
  // Served from the stored reading: the published ones, as the matcher would link them now.
  const served = atlasTermsForPosting(db, job).map(t => t.slug).sort();
  assert.deepEqual(served, ["backend-engineer", "interpretability", "python"]);
  const fresh = atlasTermsFor(db, db.prepare(`SELECT title, company, description, skills_json FROM scraped_jobs WHERE job_id = ?`).get(job)).map(t => t.slug).sort();
  assert.deepEqual(served, fresh, "the stored links are the matcher's links");
  // Proof it is the stored reading that is read: a stored link that the text no longer has would still be served…
  db.prepare(`UPDATE atlas_posting_match SET linked = ? WHERE posting_id = ?`).run(String(ids.sql), pid);
  assert.deepEqual(atlasTermsForPosting(db, job).map(t => t.slug), ["sql"]);
  // …and an update rewrites it with the posting (the trigger → the live pass).
  db.prepare(`UPDATE scraped_jobs SET description = 'Kubernetes only.' WHERE job_id = ?`).run(job);
  assert.deepEqual(atlasTermsForPosting(db, job).map(t => t.slug).sort(), ["backend-engineer", "kubernetes"]);
  // Publishing the draft shows its link at once — no re-read needed (drafts are stored).
  db.prepare(`UPDATE scraped_jobs SET description = 'Terraform and Kubernetes.' WHERE job_id = ?`).run(job);
  assert.ok(!atlasTermsForPosting(db, job).some(t => t.slug === "terraform"));
  setStatus(db, "terraform", "published");
  assert.ok(atlasTermsForPosting(db, job).some(t => t.slug === "terraform"));
  // A closed posting has no stored reading: it is matched on the spot, as before.
  db.prepare(`UPDATE scraped_jobs SET is_active = 0 WHERE job_id = ?`).run(job);
  assert.ok(atlasTermsForPosting(db, job).some(t => t.slug === "kubernetes"));
  assert.equal(db.prepare(`SELECT COUNT(*) FROM atlas_posting_match WHERE posting_id = ?`).pluck().get(pid), 0);
});

test("D118 P1 · d118CacheInvalidatedOnChange — the popup and the page are kept ≤ 60 s and never past a count change; no hour-long cache", async () => {
  const { db, ids } = board();
  assert.equal(LIVE_CACHE_MS, 60_000);
  const app = express();
  app.use("/api/atlas", createAtlasRouter(db));
  const server = app.listen(0);
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const peek = async () => { const r = await fetch(`${base}/api/atlas/peek/python`); return { cc: r.headers.get("cache-control"), n: (await r.json()).postings }; };
    const page = async () => (await (await fetch(`${base}/api/atlas/node/python`)).json()).onTheBoard.postings;
    const first = await peek();
    assert.deepEqual(first, { cc: "public, max-age=60", n: 2 });
    assert.equal(await page(), 2);
    // A count change → the very next read is new, well inside the minute.
    post(db, { text: "Python, newly posted." });
    assert.equal((await peek()).n, 3);
    assert.equal(await page(), 3);
    // An Atlas change (the node renamed by the curator) → new too.
    db.prepare(`UPDATE atlas_nodes SET name = 'Python 3' WHERE id = ?`).run(ids.python);
    assert.equal((await (await fetch(`${base}/api/atlas/node/python`)).json()).name, "Python 3");
  } finally { server.close(); }

  // The server cache itself: one value while nothing moves, a new one after a change or after 60 s.
  let calls = 0;
  const compute = () => ({ n: ++calls });
  const v1 = liveCached(db, "k", compute, { now: 1_000_000 });
  assert.equal(liveCached(db, "k", compute, { now: 1_000_000 + 59_999 }), v1, "kept inside the minute");
  assert.notEqual(liveCached(db, "k", compute, { now: 1_000_000 + 60_000 }), v1, "never past 60 s");
  const v3 = liveCached(db, "k", compute, { now: 1_100_000 });
  post(db, { text: "Python again." });
  syncAtlasPostings(db);
  assert.notEqual(liveCached(db, "k", compute, { now: 1_100_001 }), v3, "never past a count change");

  // ⛔ No one-hour cache left on the Atlas's reads, and the browser keeps a popup a minute.
  assert.doesNotMatch(read("routes/atlas.js"), /max-age=3600/);
  assert.match(read("client/src/lib/atlasLinks.js"), /export const PEEK_KEEP_MS = 60_000;/);
});

test("D118 P1 · d118PerIngestCost — one ingest re-reads its own company only; every other company's counts stay cached", () => {
  const db = fixtureDb();
  node(db, "skill", "Python");
  for (let c = 0; c < 5; c++) for (let i = 0; i < 6; i++) post(db, { company: `Co${c}`, text: `Co${c} has been building tools for clinics since the year two thousand.\nPython ${i}.` });
  computeAtlasStats(db, { now: 1 });
  let reads = 0;
  const prepare = db.prepare.bind(db);
  db.prepare = (sql) => { if (/FROM atlas_posting_match WHERE company_key = \?|lower\(trim\(company\)\) = \?/.test(sql)) reads++; return prepare(sql); };
  try {
    post(db, { company: "Co1", text: "Co1 has been building tools for clinics since the year two thousand.\nPython 9." });
    syncAtlasPostings(db);
    post(db, { company: "Co1", text: "Python 10." });
    syncAtlasPostings(db);
  } finally { db.prepare = prepare; }
  assert.equal(reads, 0, "the company's counts were already in memory from the full pass and were adjusted in place — nothing re-read");
  assert.equal(computeAtlasStats(db, { now: 2 }).drift.drift, 0);
});
