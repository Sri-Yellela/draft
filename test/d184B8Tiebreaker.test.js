// ⭐ D184 B-8 (46y) · THE CONTEXTUAL TIEBREAKER ON THE BOARD — the contextual score (D192) orders cards inside the same
// skill-match tier, band and score; nothing ahead of it moves. Computed in the board-fit precompute (posting side and company
// stacks through the read pool, each company's stack once per pass, the arithmetic in the score worker), stored beside the
// score (migration 278), behind the flag board_contextual_tiebreak.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { scoreContextual } from "@draft/ats-scorer";
import { MIGRATIONS } from "../scripts/migrations.js";
import { at, lastAt } from "../test-support/sourceAnchors.js";
import {
  buildOrderKeys, orderByClause, cursorProjection, cursorPredicate, FIT_KEYS, CONTEXTUAL_KEYS, NEWEST, ordersByScore,
} from "../services/jobs/jobCursor.js";
import { createBoardFitPrecompute } from "../services/jobs/boardFitPrecompute.js";
import {
  contextualScoreFor, contextualKey, resumeSideOf, createPassContext, dbRead, techStackShape,
} from "../services/jobs/boardContextual.js";
import { companyStackOf } from "../services/atsContextual.js";
import { FLAGS } from "../shared/flags.js";

const src = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const quiet = { log() {}, warn() {}, error() {} };

// ── the pure order ────────────────────────────────────────────────────────────────────────────────────────────────────
test("d184B8 order keys: the contextual keys come right after the fit band + score, default order with fit only", () => {
  const tier = { sql: "(0 - 1)", params: [] };
  const on = buildOrderKeys(undefined, [], { fit: true, skillTier: tier, contextual: true });
  const off = buildOrderKeys(undefined, [], { fit: true, skillTier: tier });
  const i = on.indexOf(FIT_KEYS[1]);
  assert.ok(i > 0, "the fit keys are there");
  assert.deepEqual(on.slice(i + 1, i + 1 + CONTEXTUAL_KEYS.length), [...CONTEXTUAL_KEYS], "contextual follows the score at once");
  assert.equal(on[i + 1 + CONTEXTUAL_KEYS.length], NEWEST[0], "then recency, as before");
  // without the switch the key list is exactly today's
  assert.deepEqual(on.filter(k => !CONTEXTUAL_KEYS.includes(k)), off);
  assert.ok(on.indexOf(on.find(k => k.sql === tier.sql)) < on.indexOf(FIT_KEYS[0]), "the skill tier still leads the band");
  // never under an explicit sort, a search, or with fit off
  for (const keys of [
    buildOrderKeys("dateDesc", [], { fit: true, contextual: true }),
    buildOrderKeys("atsScore", [], { fit: true, contextual: true }),
    buildOrderKeys(undefined, [], { fit: true, contextual: true, search: { sql: "1", params: [] } }),
    buildOrderKeys(undefined, [], { fit: false, contextual: true }),
  ]) assert.ok(!keys.some(k => CONTEXTUAL_KEYS.includes(k)));
  assert.ok(ordersByScore([CONTEXTUAL_KEYS[1]]), "the cursor epoch signs it");
});

function orderDb() {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE scraped_jobs (job_id TEXT PRIMARY KEY, discovered_at INTEGER, scraped_at INTEGER, posted_at INTEGER, company TEXT, tier INTEGER);
           CREATE TABLE ats_only_reports (job_id TEXT PRIMARY KEY, ats_score INTEGER, contextual_score INTEGER);`);
  return db;
}
const ROWS = [
  // id,   tier, score, ctx,  discovered (newer = larger)
  ["a",    0,    70,    40,   9],
  ["b",    0,    70,    90,   1],
  ["c",    0,    70,    null, 99],
  ["d",    0,    70,    60,   5],
  ["e",    0,    80,    10,   1],   // a higher score wins whatever its contextual number
  ["f",    1,    95,    99,   1],   // a lower skill tier stays below, whatever its score / contextual
  ["g",    0,    null,  null, 50],  // NOT ESTABLISHED (band 2) between Moderate and Weak, as before
  ["h",    0,    10,    95,   1],   // Weak stays last in its tier
  ["i",    0,    70,    90,   7],   // ties b on contextual → the newer first
];
function walk(db, keys, pageSize) {
  const ids = [];
  let values = null;
  for (let guard = 0; guard < 50; guard++) {
    const cp = values ? cursorPredicate(keys, values) : { sql: "", params: [] };
    const proj = cursorProjection(keys), ob = orderByClause(keys);
    const sql = `SELECT sj.job_id AS job_id ${proj.sql} FROM scraped_jobs sj LEFT JOIN ats_only_reports aor ON aor.job_id = sj.job_id
      ${cp.sql ? `WHERE ${cp.sql}` : ""} ORDER BY ${ob.sql} LIMIT ${pageSize}`;
    const rows = db.prepare(sql).all(...proj.params, ...cp.params, ...ob.params);
    if (!rows.length) break;
    ids.push(...rows.map(r => r.job_id));
    const last = rows[rows.length - 1];
    values = keys.map((_, k) => last[`__cursor_k${k}`]);
  }
  return ids;
}
test("d184B8 tier order: inside one tier, band and score the contextual number decides (nulls last, then recency); nothing else moves", () => {
  const db = orderDb();
  for (const [id, tier, score, ctx, disc] of ROWS) {
    db.prepare("INSERT INTO scraped_jobs VALUES (?, ?, ?, NULL, 'Co', ?)").run(id, disc, disc, tier);
    db.prepare("INSERT INTO ats_only_reports VALUES (?, ?, ?)").run(id, score, ctx);
  }
  const tier = { sql: "sj.tier", params: [] };
  const on = buildOrderKeys(undefined, [], { fit: true, skillTier: tier, contextual: true });
  const off = buildOrderKeys(undefined, [], { fit: true, skillTier: tier });
  const full = (keys) => { const ob = orderByClause(keys); return db.prepare(`SELECT sj.job_id FROM scraped_jobs sj LEFT JOIN ats_only_reports aor ON aor.job_id = sj.job_id ORDER BY ${ob.sql}`).pluck().all(...ob.params); };
  assert.deepEqual(full(on), ["e", "i", "b", "d", "a", "c", "g", "h", "f"]);
  assert.deepEqual(full(off), ["e", "c", "a", "i", "d", "b", "g", "h", "f"], "today's order: recency inside a score");
  // the same members per (tier, band, score) group either way — only the order inside a group changed
  const groups = (ids) => ids.map(id => ROWS.find(r => r[0] === id)).map(r => `${r[1]}:${r[2]}`);
  assert.deepEqual(groups(full(on)), groups(full(off)));
  // the keyset cursor walks the new order without a skip or a repeat, at every page size
  for (const n of [1, 2, 3, 4]) assert.deepEqual(walk(db, on, n), full(on), `page size ${n}`);
});

// ── the computation ───────────────────────────────────────────────────────────────────────────────────────────────────
test("d184B8 contextualScoreFor is scoreContextual's number on the board's inputs; null when the skill match declined", () => {
  const resume = resumeSideOf({ placement_category: "engineering", placement_subcategory: "engineering.backend", placement_level: "mid",
    placement_also: JSON.stringify({ category: "engineering", subcategory: "engineering.platform" }) },
    "Backend engineer. Built Kafka pipelines in Go and PostgreSQL. Designed APIs used by thousands.");
  assert.deepEqual(resume.also, { subcategory: "engineering.platform" });
  assert.ok(resume.tech.includes("Apache Kafka"), resume.tech.join(","));
  const company = { industry: null, techStack: [{ name: "Kafka", category: "data", postingShare: 0.6 }, { name: "Terraform", category: "devops", postingShare: 0.4 }] };
  const job = { job_id: "j1", level_read: "senior", description_text: "What you'll do:\n- Build Kafka pipelines in Go\n- Design APIs for partners" };
  const item = { category: "engineering", subcategory: "engineering.backend", company };
  const n = contextualScoreFor(job, { score: 62 }, item, { resume, weights: null });
  const direct = scoreContextual({ skillMatch: 62, posting: { category: "engineering", subcategory: "engineering.backend", level: "senior", text: job.description_text },
    resume, company, weights: null }).score;
  assert.equal(n, direct);
  assert.equal(typeof n, "number");
  assert.equal(contextualScoreFor(job, { score: null }, item, { resume, weights: null }), null);
  // the key moves with the placement and the weights, not with the résumé text (basis_hash covers that)
  const k = contextualKey(resume, { skill_match: 0.5 });
  assert.equal(k, contextualKey({ ...resume, text: "other" }, { skill_match: 0.5 }));
  assert.notEqual(k, contextualKey({ ...resume, level: "senior" }, { skill_match: 0.5 }));
  assert.notEqual(k, contextualKey(resume, { skill_match: 0.6 }));
});

// ── the precompute: a stack per company per pass, the number stored, the key re-scores ────────────────────────────────────
const USER = 7, PROFILE = 70;
function boardDb(nJobs, nCompanies) {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (?, 'u7', 'x')").run(USER);
  db.prepare(`INSERT INTO domain_profiles
      (id, user_id, profile_name, role_family, domain, seniority, target_titles, selected_keywords,
       selected_verbs, selected_tools, is_active, created_at, updated_at, include_summary, generate_at_queue,
       placement_category, placement_subcategory, placement_level, placed_at)
    VALUES (?, ?, 'Eng', 'engineering', 'engineering', 'mid', '[]', '[]', '[]', '[]', 1, 1, 1, 0, 0,
       'engineering', 'engineering.backend', 'mid', 1)`).run(PROFILE, USER);
  const now = Math.floor(Date.now() / 1000);
  for (let c = 1; c <= nCompanies; c++) {
    db.prepare("INSERT INTO companies (id, slug, name) VALUES (?, ?, ?)").run(c, `co-${c}`, `Synthetic Co ${c}`);
    db.prepare("INSERT INTO company_tech (company_id, tech, grp, postings, first_seen, last_seen, teams_json, computed_at) VALUES (?, 'Kafka', 'data', ?, ?, ?, '[]', ?)")
      .run(c, 2 + (c % 3), now - 86400, now, now);
  }
  const ins = db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, company, title, _hash, scraped_at, discovered_at, is_active, description, level_read)
                          VALUES (?, 'q', ?, 'Engineer', ?, ?, ?, 1, ?, ?)`);
  for (let i = 0; i < nJobs; i++) {
    const id = `j${String(i).padStart(3, "0")}`, c = 1 + (i % nCompanies);
    ins.run(id, `Synthetic Co ${c}`, `h${i}`, now, now, i % 2 ? "What you'll do:\n- Build Kafka pipelines in Go" : "Sell things.", i % 3 ? "mid" : "senior");
    db.prepare("INSERT INTO job_company (job_id, company_id) VALUES (?, ?)").run(id, c);
    db.prepare("INSERT INTO job_taxonomy (job_id, category, subcategory, version, classified_at) VALUES (?, 'engineering', ?, 'v', 1)")
      .run(id, i % 4 ? "engineering.backend" : "engineering.frontend");
  }
  return db;
}
const storeWithCtx = (db) => ({ userId, profileId, jobId, report, basisHash, jobHash, contextual }) => {
  db.prepare("DELETE FROM ats_only_reports WHERE user_id = ? AND job_id = ? AND domain_profile_id IS ?").run(userId, jobId, profileId);
  db.prepare(`INSERT INTO ats_only_reports (user_id, domain_profile_id, job_id, ats_report, ats_score, scorer_version, scored_at, basis_hash, job_hash, contextual_score, contextual_key)
    VALUES (?, ?, ?, ?, ?, 'v', 1, ?, ?, ?, ?)`).run(userId, profileId, jobId, JSON.stringify(report), report.score, basisHash, jobHash, contextual?.score ?? null, contextual?.key ?? null);
};
const RESUME = "Backend engineer. Built Kafka pipelines in Go.";
function make(db, { on = true, weights = null, read = undefined } = {}) {
  let reads = 0;
  const r = read || { all: async (sql, params = []) => { reads++; return db.prepare(sql).all(...params); }, get: async (sql, params = []) => db.prepare(sql).get(...params) };
  const pre = createBoardFitPrecompute({
    db, log: quiet, store: storeWithCtx(db), read: r, batchSize: 10,
    basisFor: () => ({ runtimeBasis: { resumeText: RESUME }, basisHash: "B1" }),
    scoreJob: (job) => ({ score: 40 + (Number(job.job_id.slice(1)) % 3) * 10 }),
    contextual: on ? (_u, p) => ({ resume: resumeSideOf(db.prepare("SELECT * FROM domain_profiles WHERE id = ?").get(p.id), RESUME), weights }) : null,
  });
  return { pre, reads: () => reads };
}
const prof = (db) => db.prepare("SELECT * FROM domain_profiles WHERE id = ?").get(PROFILE);
const rows = (db) => db.prepare("SELECT job_id, ats_score, contextual_score, contextual_key FROM ats_only_reports ORDER BY job_id").all();

test("d184B8 precompute: every scored row carries the contextual number + key; each company's stack read once per pass, in bulk", async () => {
  const db = boardDb(60, 7);
  const { pre } = make(db);
  const r = await pre.runFor({ userId: USER, profile: prof(db) });
  assert.equal(r.status, "scored"); assert.equal(r.scored, 60);
  assert.equal(r.contextual.companies, 7, "7 companies in the cache");
  assert.equal(r.contextual.stackReads, 3, "ONE bulk read (3 queries) for all 7 companies — not one per posting");
  assert.equal(r.contextual.postingReads, 6, "one posting-side read per batch of 10");
  const all = rows(db);
  const key = all[0].contextual_key;
  assert.ok(key && all.every(x => x.contextual_key === key && typeof x.contextual_score === "number"));
  // the stored number is contextualScoreFor's on the same inputs, and the cache's stack is companyStackOf's for that company
  const job = db.prepare("SELECT * FROM scraped_jobs WHERE job_id = 'j001'").get();
  const stack = companyStackOf(db, 2);
  const n = contextualScoreFor(job, { score: 50 }, { category: "engineering", subcategory: "engineering.backend", company: stack },
    { resume: resumeSideOf(prof(db), RESUME), weights: null });
  assert.equal(all.find(x => x.job_id === "j001").contextual_score, n);
  // nothing changed → nothing to do
  assert.equal((await pre.runFor({ userId: USER, profile: prof(db) })).status, "nothing_to_do");
});

test("d184B8 precompute: a new placement or new weights re-score (the key); the switch off computes and marks nothing", async () => {
  const db = boardDb(20, 3);
  await make(db).pre.runFor({ userId: USER, profile: prof(db) });
  db.prepare("UPDATE domain_profiles SET placement_level = 'senior' WHERE id = ?").run(PROFILE);
  const r = await make(db).pre.runFor({ userId: USER, profile: prof(db) });
  assert.equal(r.ctxStale, 20); assert.equal(r.scored, 20);
  const r2 = await make(db, { weights: { skill_match: 0.4, role_fit: 0.3, responsibility_overlap: 0.15, tech_stack: 0.15 } }).pre.runFor({ userId: USER, profile: prof(db) });
  assert.equal(r2.ctxStale, 20);
  // off: the stored keys are not "stale" and nothing reads a stack
  const off = make(db, { on: false });
  const r3 = await off.pre.runFor({ userId: USER, profile: prof(db) });
  assert.equal(r3.status, "nothing_to_do"); assert.equal(r3.contextual, undefined);
  // off, on a board scored before the tiebreaker: nothing is marked stale either
  const db2 = boardDb(10, 2);
  await make(db2, { on: false }).pre.runFor({ userId: USER, profile: prof(db2) });
  assert.ok(rows(db2).every(x => x.contextual_score == null && x.contextual_key == null));
  assert.equal((await make(db2, { on: false }).pre.runFor({ userId: USER, profile: prof(db2) })).status, "nothing_to_do");
  // …and turned on, that board is re-scored once with the number
  const on = await make(db2).pre.runFor({ userId: USER, profile: prof(db2) });
  assert.equal(on.ctxStale, 10);
  assert.ok(rows(db2).every(x => x.contextual_key));
});

test("d184B8 precompute: a posting side that cannot be read writes the score with NO key (retried next pass), never fails the pass", async () => {
  const db = boardDb(10, 2);
  const broken = { all: async (sql, params) => { if (/job_taxonomy/.test(sql)) throw new Error("pool down"); return db.prepare(sql).all(...params); }, get: async (sql, params) => db.prepare(sql).get(...params) };
  const r = await make(db, { read: broken }).pre.runFor({ userId: USER, profile: prof(db) });
  assert.equal(r.status, "scored"); assert.equal(r.contextual.failed, 10);
  assert.ok(rows(db).every(x => typeof x.ats_score === "number" && x.contextual_key == null));
  assert.equal((await make(db).pre.runFor({ userId: USER, profile: prof(db) })).ctxStale, 10);
});

test("d184B8 the stack cache: one shape with companyStackOf; ids read in bulk chunks; a company read once across batches", async () => {
  const db = boardDb(30, 5);
  const pass = createPassContext({ read: dbRead(db), resume: resumeSideOf(prof(db), RESUME), weights: null });
  const jobs = db.prepare("SELECT job_id FROM scraped_jobs ORDER BY job_id").all();
  await pass.itemsFor(jobs.slice(0, 10)); await pass.itemsFor(jobs.slice(10));
  assert.equal(pass.stats.stackReads, 3, "the second batch's companies were all cached");
  for (let c = 1; c <= 5; c++) assert.deepEqual(pass.stacks.get(c).techStack, companyStackOf(db, c).techStack, `company ${c}`);
  assert.deepEqual(techStackShape([], 0), []);
});

// ── the wiring ─────────────────────────────────────────────────────────────────────────────────────────────────────────
test("d184B8 wiring: migration 278 byte-identical and additive; the flag is the kill switch (on by default, measured); server, worker, store wired", () => {
  const block = (f) => { const s = fs.readFileSync(f, "utf8"); const i = at(s, 'id: "278_ats_only_reports_contextual"'); return s.slice(lastAt(s, "    {", i), at(s, "    },", i) + 6); };
  assert.equal(block("server.js"), block("scripts/migrations.js"));
  const sql = block("server.js").replace(/^\s*\/\/.*$/gm, "");
  assert.match(sql, /ALTER TABLE ats_only_reports ADD COLUMN contextual_score INTEGER;/);
  assert.match(sql, /ALTER TABLE ats_only_reports ADD COLUMN contextual_key TEXT;/);
  assert.doesNotMatch(sql, /\b(DROP|DELETE|UPDATE|DEFAULT)\b/);
  assert.equal(FLAGS.board_contextual_tiebreak.env, "BOARD_CONTEXTUAL_TIEBREAK");
  assert.equal(FLAGS.board_contextual_tiebreak.default, "on", "on by default — measured safe at 100k (docs/D184_B8_DESIGN.md §4)");

  const server = src("server.js");
  assert.match(server, /contextual: flagOn\(db, BOARD_CONTEXTUAL_FLAG\) \}\);/, "the board's order reads the switch");
  assert.match(server, /contextual: \(userId, profile\) => \{\n\s+if \(!flagOn\(db, BOARD_CONTEXTUAL_FLAG\)\) return null;/, "the precompute reads it");
  assert.match(server, /return scorePool\.score\(\{ items, weights, synonyms: atsSynonyms\(\), runtimeBasis, ctx \}\);/);
  assert.match(server, /job_hash, contextual_score, contextual_key\)/, "the one writer stores both columns");
  assert.match(server, /args\.contextual === undefined\n\s+\? \(keep\.get\(/, "other writers keep the number on the same basis + posting");
  const worker = src("services/jobs/scoreWorker.js");
  assert.match(worker, /contextual: contextualScoreFor\(job, report, ctx\.items\?\.\[i\], ctx\.shared\)/);
  // ⛔ the per-pass reads go through `read` (the pool); the module never calls stackFor / companyStackOf per posting
  const bc = src("services/jobs/boardContextual.js");
  assert.doesNotMatch(bc, /stackFor\(|companyStackOf\(/);
  assert.doesNotMatch(bc.replace(/export const dbRead = [^\n]*/, ""), /db\.prepare/, "only the tests' wrapper touches a connection");
  // ⛔ no model (D190)
  assert.doesNotMatch(bc, /anthropic|openai|modelGateway/i);
});
