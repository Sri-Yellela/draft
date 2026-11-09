// D185-3 (45q, owner 11-09) · rising skills → the Atlas content backlog: the share of NEW postings asking for a skill
// against the window before, with minimums; a draft outline is a brief for review — it writes no lesson, publishes nothing.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { rankRising, risingSkills, contentBacklog, draftOutline, reviewOutline, sourcesFor, outlineFor, MIN_RECENT_POSTINGS, MIN_SUBCATEGORY_POSTINGS } from "../services/atlas/risingSkills.js";

const NOW = Date.parse("2026-11-09T12:00:00Z") / 1000;
const DAY = 86400;
const read = (db) => ({ all: async (sql, p = []) => db.prepare(sql).all(...p) });

function world() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  let n = 0;
  const post = (ago, tech) => {
    const id = `r${++n}`;
    db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, company, title, _hash, is_active, discovered_at) VALUES (?, 'q', 'Co', 'Eng', ?, 1, ?)`).run(id, id, NOW - ago * DAY);
    db.prepare("INSERT INTO job_taxonomy (job_id, category, subcategory, version, classified_at) VALUES (?, 'software-engineering', 'swe.backend', 'v1', 1)").run(id);
    for (const t of tech) db.prepare("INSERT INTO job_tech (job_id, tech) VALUES (?, ?)").run(id, t);
  };
  // Baseline (31–120 days ago): 100 postings, 5 ask for Rust, 50 for Python.
  for (let i = 0; i < 100; i++) post(60, [...(i < 5 ? ["Rust"] : []), ...(i < 50 ? ["Python"] : [])]);
  // Recent (last 30 days): 100 postings, 30 ask for Rust (5% → 30%), 50 for Python (flat), 3 for Zig (too few).
  for (let i = 0; i < 100; i++) post(5, [...(i < 30 ? ["Rust"] : []), ...(i < 50 ? ["Python"] : []), ...(i < 3 ? ["Zig"] : [])]);
  return db;
}

test("d185RisingSkillsDraftOnly: rising = a growing share of NEW postings, past the minimums; flat and thin skills are not", async () => {
  const db = world();
  const rising = await risingSkills(read(db), { now: NOW });
  assert.deepEqual(rising.map(r => r.tech), ["Rust"]);
  assert.equal(rising[0].baselineShare, 5);
  assert.equal(rising[0].recentShare, 30);
  assert.equal(rising[0].pointsUp, 25);
  assert.equal(rankRising([{ subcategory: "s", tech: "X", recent: MIN_RECENT_POSTINGS, baseline: 0 }],
    new Map([["s", { recent: MIN_SUBCATEGORY_POSTINGS - 1, baseline: 100 }]])).length, 0, "a thin subcategory says nothing");
  const backlog = await contentBacklog(db, read(db), { now: NOW });
  assert.equal(backlog.rows[0].tech, "Rust");
  assert.equal(backlog.rows[0].unansweredAsks, null, "D177's asks join once the ask log exists");
});

test("d185RisingSkillsDraftOnly: an outline is a DRAFT brief — the register's sources marked adapt or link; no atlas node, no lesson, no publish", async () => {
  const db = world();
  const nodesBefore = db.prepare("SELECT COUNT(*) FROM atlas_nodes").pluck().get();
  const row = (await contentBacklog(db, read(db), { now: NOW })).rows[0];
  const reg = { sources: [
    { id: "open-one", publisher: "Pub", name: "Rust by Example", url: "https://x", topics: ["rust"], licenceClass: "open-reuse" },
    { id: "shut-one", publisher: "Vendor", name: "Docs", url: "https://y", topics: ["Rust ownership"], licenceClass: "link-only" },
    { id: "unchecked", publisher: "Blog", name: "Rust tips", url: "https://z", topics: [], licenceClass: "to-verify" },
  ] };
  assert.deepEqual(sourcesFor("Rust", reg).map(s => [s.id, s.use]), [["open-one", "adapt"], ["shut-one", "link"], ["unchecked", "link"]],
    "to-verify is link-only until checked (D176)");
  const item = draftOutline(db, row, { reg, by: "owner" });
  assert.equal(item.status, "draft");
  assert.equal(item.outline.status, "draft");
  assert.match(item.outline.steps[1], /adapted from Pub Rust by Example/);
  assert.equal(db.prepare("SELECT COUNT(*) FROM atlas_nodes").pluck().get(), nodesBefore, "no atlas node is written");
  const accepted = reviewOutline(db, item.id, { status: "accepted", by: "owner" });
  assert.equal(accepted.status, "accepted");
  assert.equal(db.prepare("SELECT COUNT(*) FROM atlas_nodes WHERE status = 'published'").pluck().get(), 0, "accepting publishes nothing");
  assert.throws(() => reviewOutline(db, item.id, { status: "published" }), /Accept or reject/);
  assert.equal(outlineFor({ tech: "Zig", subcategory: "s", recentShare: 1, baselineShare: 0 }, { sources: [] }).sources.length, 0);
  const src = fs.readFileSync(new URL("../services/atlas/risingSkills.js", import.meta.url), "utf8");
  assert.ok(!/INSERT INTO atlas_nodes|UPDATE atlas_nodes|setStatus\(|autoPublish/.test(src), "the backlog never touches the Atlas's own nodes");
});
