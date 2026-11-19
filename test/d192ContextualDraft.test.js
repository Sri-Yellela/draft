// ⭐ D192 (3) + (4) · draft's half of the contextual ATS score: the inputs from draft's own tables (services/atsContextual.js),
// the public company-stack lookup Resume Master uses standing alone, the weights Admin → Ops sets, and the wiring that keeps
// the existing skill-match report unchanged.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import {
  publicCompanyStack, companyStackOf, contextualFor, contextualWeights, setContextualWeights, companyIdByName, WEIGHTS_KEY,
} from "../services/atsContextual.js";
import { DEFAULT_CONTEXTUAL_WEIGHTS } from "@draft/ats-scorer";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8").replace(/\r\n/g, "\n");
const NOW = 1_800_000_000;

function fixture() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER);
    CREATE TABLE companies (id INTEGER PRIMARY KEY, slug TEXT UNIQUE, name TEXT, domain TEXT, parent_id INTEGER);
    CREATE TABLE company_aliases (alias_key TEXT PRIMARY KEY, company_id INTEGER, evidence TEXT, created_at INTEGER);
    CREATE TABLE company_facts (company_id INTEGER PRIMARY KEY, wikidata_id TEXT, industry TEXT, hq TEXT, founded INTEGER, employees INTEGER, status TEXT, fetched_at INTEGER);
    CREATE TABLE company_tech (company_id INTEGER, tech TEXT, grp TEXT, postings INTEGER, first_seen INTEGER, last_seen INTEGER, teams_json TEXT, computed_at INTEGER, PRIMARY KEY (company_id, tech));
    CREATE TABLE scraped_jobs (job_id TEXT PRIMARY KEY, title TEXT, company TEXT, description TEXT, description_text TEXT, level_read TEXT,
      is_active INTEGER, discovered_at INTEGER, retired_at INTEGER);
    CREATE TABLE job_company (job_id TEXT PRIMARY KEY, company_id INTEGER);
    CREATE TABLE job_taxonomy (job_id TEXT PRIMARY KEY, category TEXT, subcategory TEXT, confidence REAL, reason TEXT, version TEXT, classified_at INTEGER);
    CREATE TABLE domain_profiles (id INTEGER PRIMARY KEY, user_id INTEGER, is_active INTEGER, placement_category TEXT, placement_subcategory TEXT,
      placement_level TEXT, placement_also TEXT, placement_confidence REAL, placed_at INTEGER);
  `);
  db.prepare(`INSERT INTO companies (id, slug, name) VALUES (1, 'kestrel-payments', 'Kestrel Payments')`).run();
  db.prepare(`INSERT INTO company_aliases (alias_key, company_id, evidence) VALUES ('name:kestrelpayments', 1, 'name')`).run();
  db.prepare(`INSERT INTO company_facts (company_id, industry, status, fetched_at) VALUES (1, 'financial technology', 'ok', ?)`).run(NOW);
  const job = db.prepare(`INSERT INTO scraped_jobs (job_id, title, company, description_text, level_read, is_active, discovered_at) VALUES (?, ?, 'Kestrel Payments', ?, 'senior', 1, ?)`);
  for (let i = 0; i < 22; i++) {
    job.run(`k${i}`, "Senior Backend Engineer", "What you'll do\n- Build payment infrastructure for merchants\n- Lead a team of 5 engineers", NOW - 86400);
    db.prepare(`INSERT INTO job_company VALUES (?, 1)`).run(`k${i}`);
  }
  db.prepare(`INSERT INTO job_taxonomy (job_id, category, subcategory, version, classified_at) VALUES ('k0', 'software-engineering', 'swe.backend', '1', ?)`).run(NOW);
  const tech = db.prepare(`INSERT INTO company_tech VALUES (1, ?, ?, ?, ?, ?, '[]', ?)`);
  tech.run("Apache Kafka", "data", 14, NOW - 86400 * 200, NOW, NOW);
  tech.run("Terraform", "devops", 9, NOW - 86400 * 200, NOW, NOW);
  tech.run("Prefect", "data", 6, NOW - 86400 * 200, NOW, NOW);
  tech.run("Haskell", "languages", 1, NOW - 86400 * 200, NOW, NOW);           // one posting: below the page's evidence line
  db.prepare(`INSERT INTO domain_profiles VALUES (1, 7, 1, 'software-engineering', 'swe.backend', 'senior', NULL, 0.9, ?)`).run(NOW);
  return db;
}
const RESUME = "Experience\nSenior Software Engineer — Ledgerly\n- Built payment infrastructure for merchants in fintech on Kafka\n- Ran Airflow pipelines\nSkills\nGo, Kafka, Airflow";

test("d192PublicStackEndpointReturnsStack — the company page's stack in the contract's shape", () => {
  const db = fixture();
  const r = publicCompanyStack(db, "Kestrel Payments, Inc.", NOW);
  assert.equal(r.matched, true);
  assert.equal(r.slug, "kestrel-payments");
  assert.equal(r.industry, "financial technology");
  assert.deepEqual(r.techStack.map(t => t.name), ["Apache Kafka", "Terraform", "Prefect"], "Haskell (1 posting) is below the evidence line");
  assert.deepEqual(r.techStack[0], { name: "Apache Kafka", category: "data", postingShare: Math.round(1000 * 14 / 22) / 1000 });
  for (const k of Object.keys(r)) assert.ok(["matched", "name", "slug", "industry", "techStack"].includes(k), `no other field: ${k}`);
});

test("d192UnknownCompanyReturnsFalse", () => {
  const db = fixture();
  assert.deepEqual(publicCompanyStack(db, "Nobody Corp", NOW), { matched: false });
  assert.deepEqual(publicCompanyStack(db, "", NOW), { matched: false });
  assert.equal(companyIdByName(db, "KESTREL PAYMENTS"), 1);
});

test("the route: public, 60 a minute per IP, cached a day, no auth", () => {
  const s = read("server.js");
  assert.match(s, /const companyStackLimit = publicRateLimit\(\{ limit: 60, windowMs: 60_000 \}\);/);
  assert.match(s, /app\.get\("\/api\/public\/company-stack", companyStackLimit, \(req, res\) => \{\n\s+try \{ res\.set\("Cache-Control", "public, max-age=86400"\)\.json\(publicCompanyStack\(db,/);
});

test("contextualFor reads the posting's placement, the résumé's placement and the company's stack from draft's tables", () => {
  const db = fixture();
  const job = db.prepare(`SELECT * FROM scraped_jobs WHERE job_id = 'k0'`).get();
  const report = { score: 72, tier1_matched: ["kafka", "go"] };
  const c = contextualFor(db, { userId: 7, job, report, resumeText: RESUME, nowSec: NOW });
  assert.equal(c.contract, "2.0.0");
  assert.equal(c.parts.skill_match.score, 72, "the skill match passed through");
  assert.equal(c.parts.role_fit.relation, "same_role");
  assert.equal(c.parts.tech_stack.status, "ok");
  assert.deepEqual(c.similarities.stack, ["Apache Kafka"]);
  assert.deepEqual(c.similarities.ecosystem.map(e => [e.yours, e.theirs]), [["Apache Airflow", "Prefect"]]);
  assert.ok(c.similarities.domains.includes("fintech"), "the company record's industry is the posting's domain too");
  assert.ok(c.dissimilarities.some(d => d.kind === "stack_gap" && d.tech === "Terraform" && d.action === "learn"));
  assert.ok(c.dissimilarities.some(d => d.kind === "responsibility" && /team of 5/.test(d.phrase)));
  assert.equal(contextualFor(db, { userId: 7, job, report, resumeText: "" }), null, "no résumé, no block");
});

test("d192NoTechDataReturnsNoData — a company draft has no stack for", () => {
  const db = fixture();
  const c = contextualFor(db, { userId: 7, job: { job_id: "zz", company: "Nobody", description_text: "Build things" }, report: { score: 60 }, resumeText: RESUME, nowSec: NOW });
  assert.equal(c.parts.tech_stack.status, "no_data");
  assert.equal(c.parts.role_fit.status, "no_data", "an unclassified posting has no role fit");
  assert.equal(c.score, 60, "the score rests on what is known");
  assert.deepEqual(companyStackOf(db, null), { industry: null, techStack: [] });
});

test("d192WeightsConfigurable — Admin → Ops stores validated weights; a bad stored value falls back to the defaults", () => {
  const db = fixture();
  assert.deepEqual(contextualWeights(db), DEFAULT_CONTEXTUAL_WEIGHTS);
  assert.equal(setContextualWeights(db, { tech_stack: 0.3 }).tech_stack, 0.3);
  assert.equal(contextualWeights(db).tech_stack, 0.3);
  assert.throws(() => setContextualWeights(db, { nope: 1 }), TypeError);
  db.prepare(`UPDATE app_settings SET value = '{"nope":1}' WHERE key = ?`).run(WEIGHTS_KEY);
  assert.deepEqual(contextualWeights(db), DEFAULT_CONTEXTUAL_WEIGHTS);
  assert.deepEqual(setContextualWeights(db, null), DEFAULT_CONTEXTUAL_WEIGHTS);
  assert.equal(db.prepare(`SELECT COUNT(*) FROM app_settings WHERE key = ?`).pluck().get(WEIGHTS_KEY), 0);
  const s = read("server.js");
  assert.match(s, /app\.put\("\/api\/admin\/ats-contextual-weights", requireAdmin,/);
});

test("d192ExistingScoreUnchanged / d192DraftFeaturesUnchanged — the block rides beside the report, never inside it", () => {
  const s = read("server.js");
  assert.match(s, /\.\.\.\(withReport \? \{ report, contextual: contextualForBase\(userId, activeProfile, job, report\) \} : \{\}\)/);
  assert.doesNotMatch(s, /report\.contextual\s*=/, "nothing writes the block into the report");
  const ext = read("routes/extensionJob.js");
  assert.match(ext, /\.\.\.\(r\.contextual && typeof r\.contextual === "object" \? \{ contextual: r\.contextual \} : \{\}\)/);
  assert.doesNotMatch(read("services/atsContextual.js").replace(/^\s*\/\/.*$/gm, ""), /anthropic|callModel|modelGateway|fetch\(/, "no model, no network (D190)");
});
