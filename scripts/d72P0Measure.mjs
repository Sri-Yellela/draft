#!/usr/bin/env node
// D72 P0 · MEASURE THE TAG LAYER — coverage, defaults posing as facts, drift between stores, and (where a
// gold exists) precision and recall, per dimension. ⛔ READ-ONLY, counts only — no posting text printed.
// No behaviour changes: it reads the registry (shared/tagRegistry.js) and the database.
//
//   node scripts/d72P0Measure.mjs [--db <path>] [--gold <dir of graded CSVs>] [--json]
//   node scripts/d72P0Measure.mjs --db <source> --copy <new path>   measure a MIGRATED COPY: .backup() the
//        source (opened read-only), apply the migrations it lacks, run the description pass and the tagger
//        on the copy, then measure the copy — for a database older than the code (the D59 / D71 pattern)
//
// GOLD TODAY: the owner's own tags (tag_owner_json, written through /api/admin/job-tags) ARE ground truth
// (strategy §2 rule 2) — for every row the owner tagged, the tagger's reading WITHOUT the owner is compared
// with the owner's. With --gold, the graded files scripts/d72GoldExport.mjs wrote are read too.
// ⚠ Coverage is not accuracy (strategy §8): a dimension with no gold reports precision "—" and stays
// `experimental`, whatever its coverage.
import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MEASURABLE, TAG_DIMENSIONS } from "../shared/tagRegistry.js";
import { deriveTags, tagStaleJobs } from "../services/jobs/jobTags.js";
import { backfillDescriptionText } from "../services/jobs/descriptionText.js";
import { MIGRATIONS } from "./migrations.js";

const argv = process.argv.slice(2);
const flag = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : null; };
const dataDir = process.env.RM_DATA_DIR || path.join(process.cwd(), "data");
const dbPath = flag("db") || path.join(dataDir, "resume_master.db");
const goldDir = flag("gold");
const copyTo = flag("copy");
let db;
if (copyTo) {
  if (fs.existsSync(copyTo)) { console.error(`refusing: ${copyTo} exists`); process.exit(2); }
  const src = new Database(dbPath, { readonly: true, fileMustExist: true });
  await src.backup(copyTo); src.close();
  db = new Database(copyTo);
  const applied = new Set(db.prepare("SELECT id FROM schema_migrations").all().map(r => r.id));
  for (const m of MIGRATIONS) if (!applied.has(m.id)) { db.exec(m.sql); db.prepare("INSERT INTO schema_migrations (id) VALUES (?)").run(m.id); }
  for (;;) { const r = backfillDescriptionText(db, { dryRun: false, limit: 5000 }); if (r.refused || r.batch === 0 || r.due <= r.batch) break; }
  tagStaleJobs(db);
} else {
  db = new Database(dbPath, { readonly: true, fileMustExist: true });
}
const has = (t) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(t);
const cols = new Set(db.prepare("PRAGMA table_info(scraped_jobs)").all().map(c => c.name));
const ACTIVE = "sj.is_active = 1";
const one = (sql, ...a) => { try { return db.prepare(sql).get(...a); } catch (e) { return { error: e.message.slice(0, 80) }; } };
const n = (sql) => one(`SELECT COUNT(*) AS n FROM scraped_jobs sj WHERE ${ACTIVE} AND (${sql})`).n ?? null;
const active = n("1");
const pct = (x) => (x == null || !active ? null : +(100 * x / active).toFixed(1));

// ── 1 · coverage, overall and by source ──────────────────────────────────────────────────────────
const sources = db.prepare(`SELECT source, COUNT(*) AS n FROM scraped_jobs sj WHERE ${ACTIVE} GROUP BY source ORDER BY n DESC`).all();
const coverage = MEASURABLE.map(dim => {
  const filled = n(dim.coverage);
  const bySource = {};
  for (const s of sources) {
    const r = one(`SELECT COUNT(*) AS n FROM scraped_jobs sj WHERE ${ACTIVE} AND sj.source = ? AND (${dim.coverage})`, s.source);
    bySource[s.source] = s.n ? +(100 * (r.n ?? 0) / s.n).toFixed(1) : null;
  }
  const stated = dim.stated ? n(dim.stated) : null;
  return { dimension: dim.key, class: dim.class, filled, coverage: pct(filled), stated, bySource };
});

// ── 2 · defaults posing as facts ─────────────────────────────────────────────────────────────────
const defaults = {
  "experience_level = 'mid'": n("sj.experience_level = 'mid'"),
  "… of those, tag_level unknown (the 'mid' is the only level on file)": n("sj.experience_level = 'mid' AND sj.tag_level IS NULL"),
  "bucket_seniority = 'mid'": cols.has("bucket_seniority") ? n("sj.bucket_seniority = 'mid'") : null,
  "bucket_domain = 'general'": cols.has("bucket_domain") ? n("sj.bucket_domain = 'general'") : null,
  "tag_us = 'unknown' (a string)": n("sj.tag_us = 'unknown'"),
  "automation_tier = 'unknown' (a string)": n("sj.automation_tier = 'unknown'"),
  "location = placeholder or ''": n("sj.location = 'Location not specified' OR TRIM(COALESCE(sj.location,'')) = ''"),
  "min_years_exp filled (no writer)": n("sj.min_years_exp IS NOT NULL"),
  "ghost_score = 0 (no writer; served)": cols.has("ghost_score") ? n("sj.ghost_score = 0") : null,
  "collar = 'white' (always)": cols.has("collar") ? n("sj.collar = 'white'") : null,
};
const candidateDefaults = {
  "domain_profiles.seniority = 'mid'": one("SELECT COUNT(*) AS n, SUM(seniority='mid') AS mid FROM domain_profiles"),
  "user_profile.requires_sponsorship = 0 with sponsorship_need NULL": one("SELECT COUNT(*) AS n, SUM(COALESCE(requires_sponsorship,0)=0 AND sponsorship_need IS NULL) AS dflt FROM user_profile"),
  "user_profile.has_clearance = 0": one("SELECT COUNT(*) AS n, SUM(COALESCE(has_clearance,0)=0) AS zero FROM user_profile"),
};

// ── 3 · drift between stores of one fact (both filled, different value) ──────────────────────────
const drift = {
  "level: tag_level vs experience_level": one(`SELECT SUM(sj.tag_level IS NOT NULL AND sj.experience_level IS NOT NULL) AS both,
      SUM(sj.tag_level IS NOT NULL AND sj.experience_level IS NOT NULL AND sj.tag_level != sj.experience_level) AS differ FROM scraped_jobs sj WHERE ${ACTIVE}`),
  "workstyle: tag_workplace vs workplace_type": one(`SELECT SUM(sj.tag_workplace IS NOT NULL AND sj.workplace_type IS NOT NULL) AS both,
      SUM(sj.tag_workplace IS NOT NULL AND sj.workplace_type IS NOT NULL AND sj.tag_workplace != sj.workplace_type) AS differ FROM scraped_jobs sj WHERE ${ACTIVE}`),
  "employment: tag_employment vs employment_type": one(`SELECT SUM(sj.tag_employment IS NOT NULL AND sj.employment_type IS NOT NULL) AS both,
      SUM(sj.tag_employment IS NOT NULL AND sj.employment_type IS NOT NULL AND sj.tag_employment != sj.employment_type) AS differ FROM scraped_jobs sj WHERE ${ACTIVE}`),
  "US: tag_us vs the active gate (active rows tagged non_us)": { activeNonUs: n("sj.tag_us = 'non_us'") },
};

// ── 4 · precision vs the OWNER's tags (tag_owner_json) ───────────────────────────────────────────
const OWNER_DIMS = { level: "level", job_function: "function", employment: "employment_type", workplace: "workstyle" };
const ownerRows = cols.has("tag_owner_json")
  ? db.prepare(`SELECT sj.*, COALESCE(sj.description_text, sj.description) AS description FROM scraped_jobs sj
                WHERE sj.tag_owner_json IS NOT NULL AND sj.tag_owner_json NOT IN ('', '{}')`).all() : [];
const vsOwner = {};
for (const r of ownerRows) {
  let owner; try { owner = JSON.parse(r.tag_owner_json); } catch { continue; }
  const t = deriveTags(r);                                     // the tagger's own reading, owner ignored
  const mine = { level: t.level, job_function: t.job_function, employment: t.employment, workplace: t.workplace };
  for (const [k, dim] of Object.entries(OWNER_DIMS)) {
    if (owner[k] == null || owner[k] === "") continue;
    const m = (vsOwner[dim] ??= { owner: 0, taggerSaid: 0, agree: 0 });
    m.owner++;
    if (mine[k] != null) { m.taggerSaid++; if (mine[k] === owner[k]) m.agree++; }
  }
}

// ── 5 · precision / recall from graded gold files ────────────────────────────────────────────────
// A graded row: extracted (what the tagger has) vs gold (the grader's answer; "none" = the posting does
// not state it). precision = agree / (extracted present & graded) · recall = agree / (gold ≠ none).
const gold = {};
if (goldDir && fs.existsSync(goldDir)) {
  for (const f of fs.readdirSync(goldDir).filter(f => f.endsWith(".csv"))) {
    const lines = fs.readFileSync(path.join(goldDir, f), "utf8").replace(/\r\n/g, "\n").split("\n").filter(Boolean);
    const head = parseCsvLine(lines.shift());
    const ix = (k) => head.indexOf(k);
    for (const line of lines) {
      const c = parseCsvLine(line);
      const dim = c[ix("dimension")], ex = (c[ix("extracted")] || "").trim(), g = (c[ix("gold")] || "").trim();
      if (!dim || !g) continue;                                  // ungraded
      const m = (gold[dim] ??= { graded: 0, extracted: 0, agree: 0, goldStated: 0, found: 0 });
      m.graded++;
      const norm = (v) => v.toLowerCase().replace(/\s+/g, " ");
      if (ex) { m.extracted++; if (norm(ex) === norm(g)) m.agree++; }
      if (g.toLowerCase() !== "none") { m.goldStated++; if (ex && norm(ex) === norm(g)) m.found++; }
    }
  }
}
function parseCsvLine(s) {
  const out = []; let cur = "", q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === '"' && s[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ",") { out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur); return out;
}

// ── 6 · the table: dimension · class · coverage · precision · recall · readiness ─────────────────
const THRESHOLD = { HARD: 98, SOFT: 90, INFO: 90 };            // the strategy's PROPOSAL (§8) — the owner sets them
const table = TAG_DIMENSIONS.map(dim => {
  const cov = coverage.find(c => c.dimension === dim.key);
  const g = gold[dim.key], o = vsOwner[dim.key];
  const precision = g?.extracted ? +(100 * g.agree / g.extracted).toFixed(1) : o?.taggerSaid ? +(100 * o.agree / o.taggerSaid).toFixed(1) : null;
  const recall = g?.goldStated ? +(100 * g.found / g.goldStated).toFixed(1) : o?.owner ? +(100 * o.agree / o.owner).toFixed(1) : null;
  const basis = g ? `gold n=${g.graded}` : o ? `owner tags n=${o.owner}` : null;
  const readiness = precision == null ? "experimental (unmeasured)"
    : precision >= (THRESHOLD[dim.class] ?? 90) ? "ready (proposed threshold)" : "experimental";
  return { dimension: dim.key, subject: dim.subject, class: dim.class, coverage: cov?.coverage ?? null, precision, recall, basis, readiness };
});

const report = { db: copyTo ? `${dbPath} (migrated copy)` : dbPath, active, sources, coverage, defaults, candidateDefaults, drift, ownerTaggedRows: ownerRows.length, vsOwner, gold, table };
if (argv.includes("--json")) { console.log(JSON.stringify(report, null, 2)); process.exit(0); }
console.log(`D72 P0 — ${report.db}, ${active} active postings\n`);
console.table(table.map(r => ({ ...r, coverage: r.coverage ?? "—", precision: r.precision ?? "—", recall: r.recall ?? "—", basis: r.basis ?? "—" })));
console.log("\ncoverage by source (%):"); console.table(Object.fromEntries(coverage.map(c => [c.dimension, c.bySource])));
console.log("\ndefaults posing as facts:"); console.table(defaults);
console.log("candidate defaults:", JSON.stringify(candidateDefaults));
console.log("drift:", JSON.stringify(drift));
console.log(`owner-tagged rows: ${ownerRows.length}`, JSON.stringify(vsOwner));
