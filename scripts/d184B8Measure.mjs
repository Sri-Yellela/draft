#!/usr/bin/env node
// ⭐ D184 B-8 (46y) · MEASURE THE CONTEXTUAL TIEBREAKER AT PRODUCTION SIZE — the board-fit precompute's whole-board pass for
// one profile, forced, WITHOUT and WITH the tiebreaker, on a COPY of a scale fixture (scripts/scaleFixture.mjs); and the
// board's first page with and without the extra order keys. No server boot (no key, no mail, no crawl): the same modules the
// server wires — createBoardFitPrecompute, the score worker (createScorePool), the read pool (createReadPool) — with the
// package's basis + scorer (term weights left out — the same for both runs).
//
//   node scripts/d184B8Measure.mjs --fixture tmp/scale-100k --run tmp/b8run [--profile-user 1] [--keep]
//
// ⛔ The fixture's traps (memory "scale fixture traps"): example.com merged every posting into ONE company record, so the
// copy's company records are rebuilt from the posting's own company names (3,000 synthetic companies) and their stacks from
// job_tech (≥ 2 postings, as company_tech's own rule); no profile is placed, so the measured profile is placed on the most
// common subcategory. The fixture itself is never written; --run must not be under data/.
// Prints one JSON line per measurement and a summary.
import fs from "node:fs";
import path from "node:path";
import { monitorEventLoopDelay, performance } from "node:perf_hooks";
import Database from "better-sqlite3";
import { MIGRATIONS } from "./migrations.js";
import { applyPendingMigrations } from "./applyMigrations.js";
import { createBoardFitPrecompute, atsBasisHash } from "../services/jobs/boardFitPrecompute.js";
import { createScorePool } from "../services/jobs/scoreWorker.js";
import { createReadPool } from "../services/db/readWorker.js";
import { withPostingText } from "../services/jobs/descriptionText.js";
import { buildRuntimeAtsBasis, scoreAtsLocally } from "../services/localAtsScorer.js";
import { resumeSideOf } from "../services/jobs/boardContextual.js";
import { DEFAULT_CONTEXTUAL_WEIGHTS } from "@draft/ats-scorer";
import { buildOrderKeys, orderByClause } from "../services/jobs/jobCursor.js";
import { slimOf } from "../services/atsReportRead.js";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const FIXTURE = path.resolve(arg("--fixture", "tmp/scale-100k"));
const RUN = path.resolve(arg("--run", "tmp/b8run"));
const ONLY = arg("--only", null);   // "off" | "on" — one pass (memory)
if (RUN.startsWith(path.resolve("data"))) { console.error("REFUSING: --run must not be under data/"); process.exit(2); }
fs.mkdirSync(RUN, { recursive: true });
const DB = path.join(RUN, "resume_master.db");
const out = (o) => console.log(JSON.stringify(o));

// ── 1 · the copy, migrated and made realistic (once per --run dir) ──
if (!fs.existsSync(path.join(RUN, "prepared"))) {
  const t = Date.now();
  for (const f of fs.readdirSync(RUN)) if (/^resume_master\.db/.test(f)) fs.rmSync(path.join(RUN, f));
  fs.copyFileSync(path.join(FIXTURE, "resume_master.db"), DB);
  const db = new Database(DB);
  db.pragma("journal_mode = WAL");
  applyPendingMigrations(db, MIGRATIONS);
  const now = Math.floor(Date.now() / 1000);
  db.transaction(() => {
    db.prepare("DELETE FROM job_company").run();
    db.prepare("DELETE FROM company_tech").run();
    db.prepare("DELETE FROM company_facts").run();
    db.prepare("DELETE FROM companies").run();
    db.prepare(`INSERT INTO companies (slug, name) SELECT DISTINCT lower(replace(company, ' ', '-')), company FROM scraped_jobs WHERE company IS NOT NULL`).run();
    db.prepare(`INSERT INTO job_company (job_id, company_id) SELECT sj.job_id, c.id FROM scraped_jobs sj JOIN companies c ON c.name = sj.company`).run();
    db.prepare(`INSERT INTO company_tech (company_id, tech, grp, postings, first_seen, last_seen, teams_json, computed_at)
      SELECT jc.company_id, jt.tech, 'tools', COUNT(*), ? - 86400 * 30, ?, '[]', ? FROM job_tech jt JOIN job_company jc ON jc.job_id = jt.job_id
      GROUP BY jc.company_id, jt.tech HAVING COUNT(*) >= 2`).run(now, now, now);
    db.prepare(`INSERT INTO company_facts (company_id, industry, status, fetched_at) SELECT id, CASE id % 3 WHEN 0 THEN 'fintech' WHEN 1 THEN 'healthcare' ELSE NULL END, 'ok', ? FROM companies`).run(now);
    const top = db.prepare(`SELECT category, subcategory, COUNT(*) n FROM job_taxonomy WHERE subcategory IS NOT NULL GROUP BY 1, 2 ORDER BY n DESC LIMIT 1`).get();
    db.prepare(`UPDATE domain_profiles SET placement_category = ?, placement_subcategory = ?, placement_level = 'mid', placed_at = ? WHERE is_active = 1`)
      .run(top?.category ?? null, top?.subcategory ?? null, now);
    // re-seen within 6 days (scaleSuite's re-date: a stale scraped_at retires 92 % at a boot — not booted here, kept alike)
    db.prepare(`UPDATE scraped_jobs SET scraped_at = ? - (id * 7919 % 518400)`).run(now);
  })();
  db.pragma("wal_checkpoint(TRUNCATE)");
  const counts = {
    active: db.prepare("SELECT COUNT(*) FROM scraped_jobs WHERE is_active = 1").pluck().get(),
    companies: db.prepare("SELECT COUNT(*) FROM companies").pluck().get(),
    stackRows: db.prepare("SELECT COUNT(*) FROM company_tech").pluck().get(),
    reports: db.prepare("SELECT COUNT(*) FROM ats_only_reports").pluck().get(),
  };
  db.close();
  fs.writeFileSync(path.join(RUN, "prepared"), JSON.stringify(counts));
  out({ step: "prepared", ms: Date.now() - t, ...counts });
}

// ── 2 · the pass, off then on ──
const db = new Database(DB);
db.pragma("journal_mode = WAL");
const profile = db.prepare(`SELECT dp.* FROM domain_profiles dp JOIN profile_base_resumes r ON r.profile_id = dp.id
  WHERE dp.is_active = 1 ORDER BY dp.user_id LIMIT 1`).get();
const resumeText = db.prepare("SELECT content FROM profile_base_resumes WHERE profile_id = ?").pluck().get(profile.id);
const category = db.prepare(`SELECT board_category FROM scraped_jobs WHERE is_active = 1 AND board_category IS NOT NULL AND board_category <> 'held'
  GROUP BY 1 ORDER BY COUNT(*) DESC LIMIT 1`).pluck().get();
const runtimeBasis = buildRuntimeAtsBasis({ resumeText, signalProfile: null, domainProfile: profile, claims: [] });
const basis = { runtimeBasis, basisHash: atsBasisHash(runtimeBasis, { scorerVersion: "b8-measure" }) };
const scorePool = createScorePool({ size: 1 });
const read = createReadPool({ dbPath: DB, fallbackDb: db, size: 1 });
for (let i = 0; i < 100 && (scorePool.status().ready < 1 || read.status().ready < 1); i++) await new Promise(r => setTimeout(r, 100));
const del = db.prepare("DELETE FROM ats_only_reports WHERE user_id=? AND job_id=? AND domain_profile_id IS ?");
const ins = db.prepare(`INSERT INTO ats_only_reports (user_id, domain_profile_id, job_id, ats_report, ats_score, scorer_version, scored_at, basis_hash, job_hash, contextual_score, contextual_key)
  VALUES (?, ?, ?, ?, ?, 'b8', unixepoch(), ?, ?, ?, ?)`);
const store = ({ userId, profileId, jobId, report, basisHash, jobHash, contextual }) => {
  del.run(userId, jobId, profileId);
  ins.run(userId, profileId, jobId, JSON.stringify(slimOf(report)), report.score ?? null, basisHash, jobHash, contextual?.score ?? null, contextual?.key ?? null);
};
const scoreBatch = (jobs, rb, ctx) => scorePool.score({ items: jobs.map(j => ({ job: withPostingText(j), wk: "__none__" })), weights: { __none__: null }, synonyms: null, runtimeBasis: rb, ctx });

async function pass(on) {
  const pre = createBoardFitPrecompute({
    db, read, scoreBatch, store, log: { log() {}, warn() {}, error: (l) => console.error(l) },
    basisFor: () => basis,
    scoreJob: (job, rb) => scoreAtsLocally({ job: withPostingText(job), runtimeBasis: rb, termWeights: null, synonyms: null }),
    scopeFor: () => category,
    contextual: on ? (_u, p) => ({ resume: resumeSideOf(db.prepare("SELECT * FROM domain_profiles WHERE id = ?").get(p.id), resumeText), weights: { ...DEFAULT_CONTEXTUAL_WEIGHTS } }) : null,
  });
  if (global.gc) global.gc();
  const h = monitorEventLoopDelay({ resolution: 5 }); h.enable();
  const t = performance.now();
  const r = await pre.runFor({ userId: profile.user_id, profile, force: true, reason: on ? "b8-on" : "b8-off" });
  const ms = Math.round(performance.now() - t);
  h.disable();
  const res = { step: `pass-${on ? "on" : "off"}`, ms, status: r.status, scored: r.scored, active: r.active, offLoop: r.offLoop,
    loopMaxMs: Math.round(h.max / 1e6), loopP99Ms: Math.round(h.percentile(99) / 1e6), loopMeanMs: +(h.mean / 1e6).toFixed(2),
    longestSliceMs: r.longestSliceMs, longestCommitMs: r.longestCommitMs, commitMs: r.commitMs, longestPlanPageMs: r.longestPlanPageMs,
    contextual: r.contextual || null, readPool: read.status(), scorePool: scorePool.status(), rssMb: Math.round(process.memoryUsage().rss / 1048576) };
  out(res);
  return res;
}
// the pools' workers are unref'd (they never hold a server open) — this script holds itself open while it waits on them
const keepAlive = setInterval(() => {}, 1000);
const results = {};
if (ONLY !== "on") results.off = await pass(false);
if (ONLY !== "off") results.on = await pass(true);

// ── 3 · the board's first page, with and without the contextual keys (the read pool's query, timed on a worker-like connection) ──
const ro = new Database(DB, { readonly: true });
const boardMs = (contextual) => {
  const keys = buildOrderKeys(undefined, [], { fit: true, contextual });
  const ob = orderByClause(keys);
  const sql = `SELECT sj.job_id FROM scraped_jobs sj LEFT JOIN ats_only_reports aor ON aor.job_id = sj.job_id AND aor.user_id = ? AND aor.domain_profile_id IS ?
    WHERE sj.is_active = 1 AND (sj.board_category IS NULL OR sj.board_category = ?) ORDER BY ${ob.sql} LIMIT 50`;
  const st = ro.prepare(sql);
  st.all(profile.user_id, profile.id, category, ...ob.params);   // warm
  const runs = [];
  for (let i = 0; i < 5; i++) { const t = performance.now(); st.all(profile.user_id, profile.id, category, ...ob.params); runs.push(performance.now() - t); }
  runs.sort((a, b) => a - b);
  return Math.round(runs[2]);
};
results.board = { withoutMs: boardMs(false), withMs: boardMs(true) };
const filled = db.prepare(`SELECT COUNT(*) n, COUNT(contextual_score) c, COUNT(DISTINCT contextual_score) d FROM ats_only_reports WHERE user_id = ? AND domain_profile_id IS ? AND scorer_version = 'b8'`).get(profile.user_id, profile.id);
// how often the tiebreaker has anything to break: rows sharing a (band, score) with at least one other row
const ties = db.prepare(`SELECT SUM(n) FROM (SELECT COUNT(*) n FROM ats_only_reports WHERE user_id = ? AND domain_profile_id IS ? AND scorer_version = 'b8' AND ats_score IS NOT NULL GROUP BY ats_score HAVING n > 1)`).pluck().get(profile.user_id, profile.id);
out({ step: "board", ...results.board, rows: filled, rowsInATiedScore: ties, category, profileId: profile.id, placement: [profile.placement_category, profile.placement_subcategory] });
ro.close();
await scorePool.close(); await read.close?.(); db.close();
out({ step: "summary", fixture: FIXTURE, ...results });
clearInterval(keepAlive);
process.exit(0);
