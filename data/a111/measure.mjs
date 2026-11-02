// A111 P1 (D127 P2) — MEASURE on a COPY of the local database. ⛔ Never point this at data/resume_master.db or production.
//
//   node data/a111/measure.mjs prepare <copy.db>     migrations (scripts/migrations.js) + the boot's category backfill
//   (then run the tranche against the copy: see data/a111/README in the commit message — RM_DATA_DIR / BACKUP_DATA_DIR)
//   node data/a111/measure.mjs after   <copy.db> [--detail 1500] [--a111 data/a111/approve-me.json]
//        the passes production runs after a crawl (Workday / SmartRecruiters detail descriptions — polite, concurrency 2 —
//        the description normaliser, the level reader, the category backfill), then the report: active / held per
//        category (all, and the A111 employers alone), the trial samples' good picks (offeredSamples), and for a
//        synthetic résumé of each target category the number of good picks (picksFor, uncapped) and raw candidates.
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const [phase, dbPath] = process.argv.slice(2);
const flag = (k, d = null) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
if (!dbPath || !["prepare", "after"].includes(phase)) { console.error("usage: measure.mjs prepare|after <copy.db>"); process.exit(2); }
const real = path.resolve(dbPath).toLowerCase();
if (/[\\/]draft[\\/]data[\\/]resume_master\.db$/.test(real) || real.startsWith("/app")) { console.error("refusing: that is not a copy"); process.exit(2); }

const db = new Database(dbPath);
db.pragma("busy_timeout = 15000");

if (phase === "prepare") {
  const { MIGRATIONS } = await import("../../scripts/migrations.js");
  const { applyPendingMigrations } = await import("../../scripts/applyMigrations.js");
  const { backfillCategories } = await import("../../services/jobs/boardScope.js");
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at INTEGER NOT NULL DEFAULT (unixepoch()))");
  const n = applyPendingMigrations(db, MIGRATIONS, { onApplied: (m) => console.log(`applied ${m.id}`) });
  console.log(JSON.stringify({ migrationsApplied: n, categories: backfillCategories(db) }));
  db.close();
  process.exit(0);
}

// ── after the crawl ──────────────────────────────────────────────────────────────────────────
const { fillMissingDescriptions } = await import("../../services/jobs/detailFetch.js");
const { backfillDescriptionText, registerDescriptionBasis } = await import("../../services/jobs/descriptionText.js");
const { readStaleLevels } = await import("../../services/jobs/levelRead.js");
const { backfillCategories } = await import("../../services/jobs/boardScope.js");
const { offeredSamples, picksFor, clearPicksCache } = await import("../../services/trialPicks.js");

const detail = Number(flag("detail", 1500));
const out = {};
if (detail > 0) {
  const r = await fillMissingDescriptions(db, { limit: detail, perCompany: 60, concurrency: 2, log: { log() {}, info() {}, warn() {}, error() {} } });
  out.detail = { selected: r.selected, attempted: r.attempted, withText: r.withText, failed: r.failed, byReason: r.byReason };
}
try { registerDescriptionBasis(db); } catch { /* older */ }
out.descriptionText = (({ due, written, refused, requirements }) => ({ due, written, refused, requirements }))(backfillDescriptionText(db, { dryRun: false, limit: 100000, ceiling: 100000 }));
out.withoutDescription = db.prepare(`SELECT source, COUNT(*) n FROM scraped_jobs WHERE is_active = 1 AND COALESCE(LENGTH(description), 0) = 0 GROUP BY 1`).all();
let lv, levels = 0;
do { lv = readStaleLevels(db, { limit: 5000 }); levels += lv.read; } while (lv.read > 0);
out.levelsRead = levels;
out.categoriesBackfilled = backfillCategories(db);

const a111File = flag("a111", "data/a111/approve-me.json");
const a111 = JSON.parse(fs.readFileSync(a111File, "utf8"));
const a111Names = new Set(a111.map(r => r.company.toLowerCase()));
const rows = db.prepare(`SELECT company, board_category AS c FROM scraped_jobs WHERE is_active = 1 AND duplicate_of IS NULL`).all();
const tally = (list) => list.reduce((t, r) => ((t[r.c ?? "null"] = (t[r.c ?? "null"] || 0) + 1), t), {});
out.active = { all: rows.length, byCategory: tally(rows) };
const mine = rows.filter(r => a111Names.has(String(r.company).toLowerCase()));
out.activeA111 = { all: mine.length, byCategory: tally(mine) };
out.heldByReason = Object.fromEntries(db.prepare(`SELECT category_reason r, COUNT(*) n FROM scraped_jobs WHERE is_active = 1 AND board_category = 'held'
  GROUP BY 1 ORDER BY 2 DESC`).all().map(x => [x.r, x.n]));
out.companiesActive = db.prepare("SELECT COUNT(*) FROM company_ats_list WHERE active = 1").pluck().get();

clearPicksCache();
out.samples = await offeredSamples(db);

// Synthetic résumés (fictional people) — one per target category, a SKILLS section the interim overlap rule reads.
const R = (name, title, exp, skills) => `${name}\nAustin, TX | ${name.toLowerCase().replace(/\W+/g, ".")}@example.com\n\nEXPERIENCE\n${title}, Example Co, Austin, TX | 2021 - Present\n${exp.map(e => `- ${e}`).join("\n")}\n\nEDUCATION\nB.A., Example State University, 2020\n\nSKILLS\n${skills.join("\n")}\n`;
const SYN = {
  business: R("Avery Sample", "Business Analyst", ["Built Excel and SQL models for budgeting and forecasting", "Ran variance analysis for month-end close"],
    ["Analysis: Excel, SQL, financial modeling, forecasting, budgeting, variance analysis, Tableau, Power BI", "Practice: requirements gathering, stakeholder management, process improvement, reporting, accounting, FP&A"]),
  management: R("Morgan Sample", "Project Manager", ["Led cross-functional projects to on-time delivery", "Owned budgets, schedules and risk registers"],
    ["Delivery: project management, program management, Agile, Scrum, Jira, roadmap, budget, risk management", "People: stakeholder management, cross-functional leadership, operations, process improvement, vendor management, PMP"]),
  marketing: R("Riley Sample", "Marketing Manager", ["Ran paid and lifecycle campaigns", "Owned the brand calendar and content strategy"],
    ["Channels: digital marketing, SEO, SEM, paid social, email marketing, lifecycle, content marketing, social media", "Tools: Google Analytics, HubSpot, Salesforce, Marketo, A/B testing, brand, campaigns, market research"]),
  sales: R("Casey Sample", "Account Executive", ["Closed new-logo deals against quota", "Built pipeline with outbound prospecting"],
    ["Selling: B2B sales, SaaS, pipeline, prospecting, negotiation, closing, quota, account management", "Tools: Salesforce, CRM, HubSpot, forecasting, customer success, territory planning, enterprise sales"]),
  legal: R("Jamie Sample", "Corporate Counsel", ["Drafted and negotiated commercial contracts", "Advised on privacy and regulatory compliance"],
    ["Practice: contracts, commercial agreements, negotiation, compliance, regulatory, privacy, litigation, employment law", "Skills: legal research, drafting, corporate governance, intellectual property, risk management, due diligence, JD, bar admission"]),
  arts_media: R("Quinn Sample", "Product Designer", ["Designed end-to-end flows for web and mobile", "Ran user research and usability tests"],
    ["Design: Figma, Sketch, Adobe Creative Suite, prototyping, wireframes, user research, usability testing, design systems", "Craft: UX, UI, interaction design, visual design, typography, accessibility, content strategy, storytelling"]),
  science: R("Drew Sample", "Research Scientist", ["Designed and ran assays for target validation", "Analysed data and presented to project teams"],
    ["Lab: cell culture, PCR, qPCR, flow cytometry, ELISA, Western blot, CRISPR, assay development", "Analysis: statistics, R, Python, data analysis, molecular biology, biochemistry, immunology, publications"]),
};
const cand = db.prepare(`SELECT COUNT(*) FROM scraped_jobs WHERE is_active = 1 AND duplicate_of IS NULL AND board_category = ?`).pluck();
out.categoryResumes = {};
for (const [category, resumeText] of Object.entries(SYN)) {
  const picks = await picksFor(db, { category, seniority: "mid", resumeText, limit: 100000 });
  out.categoryResumes[category] = { activeInCategory: cand.get(category), goodPicks: picks.length,
    byBasis: picks.reduce((t, p) => ((t[p.basis] = (t[p.basis] || 0) + 1), t), {}), tenOrMore: picks.length >= 10,
    top3: picks.slice(0, 3).map(p => `${p.title} · ${p.company}`) };
}
db.close();
console.log(JSON.stringify(out, null, 1));
