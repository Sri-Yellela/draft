// ⭐ A111 P3 (11-02) · THE ATLAS FOR EVERY PROFESSIONAL FIELD — the seed is category-aware (D127), every category has its
// families, a non-computing role page publishes on board data (D105 P12), YOUR MAP reads a non-computing résumé, and the
// new per-role reading (services/atlas/atlasRoleFit.js) maps a résumé against a role without another category's skills.
// Synthetic people, nodes and postings only; an in-memory database from the migrations; no model, no network.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { upsertNode, addEdge, setStatus, slugOf } from "../services/atlas/atlasStore.js";
import { seedAtlasFromRegistry, readRegistry, atlasCategoryReport, defaultDomains, CS_DOMAINS } from "../services/atlas/atlasSeed.js";
import { seedAtlasFamilies, readFamilyMapping } from "../services/atlas/atlasFamilies.js";
import { seededDomains, domainCategory, domainFamily, categoryIndex, nodeCategories, roleCategory, allowedInCategory } from "../services/atlas/atlasCategories.js";
import { FAMILIES, FAMILY_KEYS, familyCategory, familiesOfCategory } from "../shared/atlasFamilies.js";
import { CATEGORIES } from "../services/jobs/professionalScope.js";
import { computeAtlasStats } from "../services/atlas/atlasStats.js";
import { autoPublish } from "../services/atlas/atlasPublish.js";
import { roleBoard } from "../services/atlas/atlasRolePage.js";
import { roleTree } from "../services/atlas/atlasTree.js";
import { computeYourMap } from "../services/atlas/atlasMe.js";
import { readRoleFit, roleFitReading, ROLE_FIT } from "../services/atlas/atlasRoleFit.js";
import { createAtlasRouter } from "../routes/atlas.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
function fixtureDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  return db;
}
const fam = (db, slug) => db.prepare(`SELECT family, family_by FROM atlas_nodes WHERE slug = ?`).get(slug);

// A synthetic business-analysis domain, as the vocabulary lane (A111 P2) will add one — beside the registry's own.
const BA_DOMAIN = Object.freeze({
  label: "Business Analysis", roleFamily: "finance",
  suggestedTitles: ["Business Analyst", "Senior Business Analyst"],
  keywords: ["requirements gathering", "process mapping", "user stories", "gap analysis", "stakeholder management", "UAT", "data analysis", "KPI tracking"],
  tools: ["Jira", "Visio", "Power BI", "SQL", "Excel", "Confluence", "Tableau"],
  actionVerbs: [],
});
const registryWithBa = () => ({ ...readRegistry(), business_analysis: BA_DOMAIN });

let jobSeq = 0;
const post = (db, title, text, level = null) => {
  const id = `a111-${++jobSeq}`;
  db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,url,search_query,_hash,description,is_active,level_read)
    VALUES (?,?,?,?,?,?,?,1,?)`).run(id, title, `Co${jobSeq % 4}`, `https://x.test/${id}`, "t", `h${id}`, text, level);
  return id;
};
const BA_RESUME = `Riley Synthetic
Business Analyst | riley@example.invalid

EXPERIENCE
Contoso Retail — Business Analyst
Mar 2021 – Present
- Ran requirements workshops with finance and store operations

SKILLS
Analysis: Requirements gathering, Process mapping, User stories, UAT, Process improvement, KPI tracking
Tools: SQL, Excel, Tableau, Jira, Visio, Kubernetes`;

/** A board of business postings on an Atlas seeded from the registry + the BA domain, every node published (the bar met). */
function businessBoard() {
  const db = fixtureDb();
  const registry = registryWithBa();
  seedAtlasFromRegistry(db, { registry, domains: ["business_analysis", "finance", "operations", "marketing", "engineering"] });
  seedAtlasFamilies(db);
  for (let i = 0; i < 6; i++) {
    post(db, i % 2 ? "Senior Business Analyst" : "Business Analyst",
      "Lead requirements gathering and process mapping; write user stories and run UAT. Gap analysis with stakeholder management. "
      + "SQL, Excel and Tableau for data analysis; Jira and Confluence. Our platform team runs Kubernetes. SEO site.");
  }
  for (let i = 0; i < 6; i++) {
    post(db, "Operations Analyst", "SQL, Excel, Tableau and Jira daily. KPI tracking and process improvement, vendor management, forecasting.");
  }
  for (let i = 0; i < 5; i++) post(db, "Financial Analyst", "Financial modelling, variance analysis, Excel, SQL, budget forecasting.");
  computeAtlasStats(db, { boardEdges: false });
  db.prepare(`UPDATE atlas_nodes SET status = 'published', published_at = 1`).run();
  return { db, registry };
}
function person(db, id, { resume = null, skills = [], titles = null } = {}) {
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (?,?,'x')").run(id, `synthetic${id}`);
  db.prepare("INSERT INTO user_profile (user_id) VALUES (?)").run(id);
  for (const [i, s] of skills.entries()) db.prepare("INSERT INTO profile_skills (user_id, name, position) VALUES (?,?,?)").run(id, s, i);
  if (resume) db.prepare("INSERT INTO base_resume (user_id, name, content) VALUES (?, 'base.txt', ?)").run(id, resume);
  if (titles) db.prepare(`INSERT INTO domain_profiles (user_id, profile_name, role_family, domain, target_titles, is_active) VALUES (?,?,?,?,?,1)`)
    .run(id, titles[0], "finance", "business", JSON.stringify(titles));
}
async function serve(db, user = null) {
  const app = express();
  if (user) app.use((req, _r, n) => { req.user = user; n(); });
  app.use("/api/atlas", createAtlasRouter(db));
  const server = app.listen(0);
  const get = (p) => fetch(`http://127.0.0.1:${server.address().port}${p}`).then(async r => ({ status: r.status, body: await r.json() }));
  return { server, get };
}

test("A111 P3 · a111AtlasSeedsEveryCategory — every categorised registry domain is seeded, each node tagged with its family / category; held and generic lists stay out", () => {
  const registry = readRegistry();
  const domains = seededDomains(registry);
  // Computing is D78 B's five, unchanged and first; every other categorised domain follows.
  assert.deepEqual(domains.filter(d => d.category === "computing").map(d => d.key).sort(), [...CS_DOMAINS].sort());
  for (const k of ["finance", "marketing", "hr", "design", "legal", "operations", "pm_general", "pm_it", "mechanical_engineering"]) {
    assert.ok(defaultDomains(registry).includes(k), `${k} is seeded`);
  }
  for (const k of ["healthcare", "general", "other_profile_request"]) assert.equal(domainCategory(k, registry[k]), null, `${k} is not seeded`);
  // A domain the vocabulary lane adds is placed by the board's own title rule, with a family of its category.
  assert.equal(domainCategory("business_analysis", BA_DOMAIN), "business");
  assert.equal(domainFamily("business_analysis", BA_DOMAIN), "business_analysis");
  assert.equal(domainCategory("sales_development", { suggestedTitles: ["Account Executive", "Sales Development Representative"], keywords: [], tools: [] }), "sales");

  const db = fixtureDb();
  const first = seedAtlasFromRegistry(db);
  seedAtlasFamilies(db);
  assert.deepEqual(seedAtlasFromRegistry(db), { nodes: 0, edges: 0, byKind: { role: 0, skill: 0, tool: 0 } }, "idempotent");
  assert.equal(db.prepare(`SELECT COUNT(*) FROM atlas_nodes WHERE status != 'draft'`).pluck().get(), 0, "all DRAFT — the bar publishes");
  const { byCategory } = atlasCategoryReport(db);
  for (const c of new Set(domains.map(d => d.category))) {
    assert.ok(byCategory[c]?.nodes > 10 && byCategory[c].roles > 0, `${c}: ${JSON.stringify(byCategory[c])}`);
  }
  assert.ok(first.nodes > 600, `seeded ${first.nodes}`);
  assert.equal(db.prepare(`SELECT 1 FROM atlas_nodes WHERE slug = 'patient-care'`).get(), undefined, "healthcare is held (D127)");
  // Tagged: a non-computing node carries a family of its category (the reviewed file over the domain default).
  const index = categoryIndex(registry);
  for (const [slug, family] of [["variance-analysis", "fpa"], ["gaap", "accounting_audit"], ["seo", "marketing_digital"], ["paralegal", "legal_practice"],
    ["westlaw", "legal_practice"], ["product-roadmap", "product"], ["scrum-master", "project_management"], ["recruiter", "people"], ["solidworks", "eng_mechanical"]]) {
    assert.equal(fam(db, slug)?.family, family, slug);
  }
  assert.deepEqual(fam(db, "gaap"), { family: "accounting_audit", family_by: "seed" }, "the reviewed file re-tags a registry default");
  assert.equal(fam(db, "lean-manufacturing").family_by, "registry", "a node the file does not list keeps its domain default");
  const untagged = db.prepare(`SELECT slug, family FROM atlas_nodes`).all()
    .filter(n => !n.family && [...nodeCategories(n, index)].some(c => c !== "computing"));
  assert.deepEqual(untagged, [], "every non-computing node is tagged");
  // Computing keeps D116's reviewed families only — the registry seed gives it none.
  assert.equal(fam(db, "backend-engineer").family, null);
  assert.equal(fam(db, "kubernetes").family, "infra");
  assert.equal(fam(db, "python").family, "backend", "a tool in several categories keeps its reviewed family");
  // A curator's choice still wins over both.
  db.prepare(`UPDATE atlas_nodes SET family = 'consulting', family_by = 'curator-a' WHERE slug = 'variance-analysis'`).run();
  seedAtlasFromRegistry(db); seedAtlasFamilies(db);
  assert.deepEqual(fam(db, "variance-analysis"), { family: "consulting", family_by: "curator-a" });

  // The families: every D127 category has at least one; the file names only known families, no slug twice.
  for (const c of Object.keys(CATEGORIES)) assert.ok(familiesOfCategory(c).length >= 1, `${c} has a family`);
  assert.deepEqual(FAMILY_KEYS.slice(0, 5), ["ml", "systems", "infra", "data", "backend"], "computing's tree unchanged, first");
  const file = readFamilyMapping();
  for (const f of FAMILY_KEYS) assert.ok([...file.values()].includes(f), `families.json lists members of ${f}`);
  assert.equal(familyCategory("workplace_tools"), null, "Excel / Jira are no category's");
  // Every family is drawable: a colour token and a square, a branch and a waypoint rule (tokens only, no literal).
  const css = read("client/src/pages/atlas/AtlasTree.css");
  for (const f of FAMILIES) {
    assert.match(css, new RegExp(`\\.atree__sq--${f.key} \\{ fill: var\\(--atree-${f.key}\\)`), f.key);
    assert.match(css, new RegExp(`\\.atree__br--${f.key} \\{ stroke: var\\(--atree-${f.key}\\)`), f.key);
    assert.match(css, new RegExp(`--atree-${f.key}: var\\(--c-`), f.key);
  }
  for (const f of ["services/atlas/atlasSeed.js", "services/atlas/atlasCategories.js", "services/atlas/atlasRoleFit.js"]) {
    assert.doesNotMatch(read(f), /callModel|anthropic|openai|modelCall/i, `${f} calls no model (D17)`);
  }
});

test("A111 P3 · a111NonCsRolePublishesOnBoardData — a business role with ≥ 5 postings publishes with no summary and its page is the board's, its own category only", () => {
  const db = fixtureDb();
  const registry = registryWithBa();
  seedAtlasFromRegistry(db, { registry, domains: ["business_analysis", "engineering"] });
  seedAtlasFamilies(db);
  for (let i = 0; i < 6; i++) post(db, "Business Analyst", "Requirements gathering, user stories and UAT; SQL and Excel. The platform team runs Kubernetes.");
  computeAtlasStats(db, { boardEdges: false });
  const { published } = autoPublish(db);
  assert.ok(published.includes("business-analyst"), "a role publishes on the postings bar alone (D105 P12)");
  assert.ok(!published.includes("requirements-gathering"), "a skill still needs a summary or a definition");
  db.prepare(`UPDATE atlas_nodes SET status = 'published' WHERE slug IN ('requirements-gathering', 'user-stories', 'uat', 'sql', 'excel', 'kubernetes')`).run();
  const page = roleBoard(db, "business-analyst");
  assert.equal(page.postings, 6);
  const names = page.topSkills.map(s => s.slug);
  for (const s of ["requirements-gathering", "user-stories", "uat", "sql", "excel"]) assert.ok(names.includes(s), s);
  assert.ok(!names.includes("kubernetes"), "another category's skill is not on a business role's page");
  assert.equal(page.topSkills.find(s => s.slug === "uat").share, 100);
  assert.ok(Array.isArray(page.nextLevel) && page.nextLevel.length === 2);
  const tree = roleTree(db, "business-analyst");
  assert.ok(!tree.nodes.some(n => n.slug === "kubernetes"), "nor on its tree");
  // A computing role's page is unchanged by the rule: its own skills stay.
  for (let i = 0; i < 5; i++) post(db, "Backend Engineer", "Python microservices on Kubernetes.");
  computeAtlasStats(db, { boardEdges: false });
  autoPublish(db);
  db.prepare(`UPDATE atlas_nodes SET status = 'published' WHERE slug IN ('python', 'microservices')`).run();
  const be = roleBoard(db, "backend-engineer").topSkills.map(s => s.slug);
  for (const s of ["kubernetes", "python", "microservices"]) assert.ok(be.includes(s), s);
});

test("A111 P3 · a111AtlasMeNonCs — a business analyst's résumé (parsed, Profile never opened) draws YOUR MAP: have, branches, the target role, from real nodes", async () => {
  const { db } = businessBoard();
  person(db, 41, { resume: BA_RESUME, titles: ["Business Analyst"] });
  const me = computeYourMap(db, 41);
  assert.equal(me.map, true, me.reason);
  assert.equal(me.skillsFrom, "resume");
  assert.deepEqual(me.targetRoles.map(r => r.slug), ["business-analyst"]);
  const have = me.haveSkills.groups.flatMap(g => g.items).map(i => i.slug).sort();
  for (const s of ["requirements-gathering", "process-mapping", "user-stories", "uat", "kpi-tracking", "process-improvement", "sql", "excel", "tableau", "jira", "visio"]) assert.ok(have.includes(s), `${s} in ${have}`);
  assert.ok(me.haveSkills.total >= 8);
  const branches = me.branches.items.map(b => b.slug);
  assert.ok(branches.includes("operations-analyst"), `branches: ${branches}`);
  const ops = me.branches.items.find(b => b.slug === "operations-analyst");
  assert.ok(ops.covered >= 6 && ops.of === 15, ops.line);
  assert.ok(!branches.includes("business-analyst"), "the target role is not a branch of itself");
  // The tree draws the business families.
  const fams = me.tree.families.map(f => f.key);
  assert.ok(fams.includes("business_analysis"), `families drawn: ${fams}`);
  // Through the route, signed in.
  const { server, get } = await serve(db, { id: 41 });
  try {
    const r = await get("/api/atlas/me");
    assert.equal(r.status, 200);
    assert.ok(r.body.haveSkills.total >= 8 && r.body.branches.total >= 1);
  } finally { server.close(); }
});

test("A111 P3 · a111RoleAgainstResume — a business-analyst résumé against the business-analyst role: have / missing exact, never another category's skills", async () => {
  // ── the pure reading ──
  const sk = (slug, inRole, categories, extra = {}) => ({ slug, name: slug, kind: "skill", published: true, inRole, postings: inRole, curated: false, categories, ...extra });
  const pure = readRoleFit({
    role: { slug: "business-analyst", name: "Business Analyst", published: true, postings: 10 }, category: "business",
    skills: [sk("uat", 9, ["business"]), sk("sql", 8, ["business", "computing"]), sk("kubernetes", 7, ["computing"]),
      sk("seo", 6, ["marketing"]), sk("visio", 1, ["computing"], { curated: true }), sk("haskell", 5, []),
      sk("gap-analysis", 4, ["business"], { published: false }), { ...sk("attention", 9, []), kind: "concept" }],
    have: ["uat", "kubernetes", "seo"],
  });
  assert.deepEqual(pure.top.map(s => s.slug), ["uat", "sql", "gap-analysis", "visio"], "computing / marketing / uncategorised / concepts left out; a curated one kept");
  assert.deepEqual([pure.covered, pure.of], [1, 4]);
  assert.equal(pure.line, "You cover 1 of this role's top 4 — missing sql, gap-analysis and visio");
  assert.deepEqual(pure.missing.map(m => [m.slug, m.page]), [["sql", "/atlas/sql"], ["gap-analysis", null], ["visio", "/atlas/visio"]], "a draft is read, never linked");
  assert.equal(pure.top[0].share, 90);
  assert.equal(pure.role.page, "/atlas/business-analyst");
  assert.equal(pure.categoryLabel, "Business and finance");
  assert.equal(pure.rankedBy, "board");
  assert.ok(allowedInCategory("computing", [], {}) && !allowedInCategory("business", [], {}), "an uncategorised node is computing's (the Atlas before A111)");

  // ── from the database: the role, the board, the résumé ──
  const { db, registry } = businessBoard();
  const ba = db.prepare(`SELECT id FROM atlas_nodes WHERE slug = 'business-analyst'`).pluck().get();
  const k8s = db.prepare(`SELECT id FROM atlas_nodes WHERE slug = 'kubernetes'`).pluck().get();
  addEdge(db, ba, k8s, "requires", "board");   // a co-occurrence edge to another category — never in the reading
  const seo = db.prepare(`SELECT id FROM atlas_nodes WHERE slug = 'seo'`).pluck().get();
  assert.ok(seo, "marketing is seeded");
  assert.equal(roleCategory({ slug: "business-analyst", name: "Business Analyst" }, categoryIndex(registry)), "business");
  person(db, 42, { resume: BA_RESUME, titles: ["Business Analyst"] });
  const r = roleFitReading(db, { role: "business-analyst", userId: 42, registry });
  assert.equal(r.found, true);
  assert.equal(r.category, "business");
  const BA_TERMS = [...BA_DOMAIN.keywords, ...BA_DOMAIN.tools].map(slugOf);
  assert.deepEqual(r.top.map(s => s.slug).sort(), [...BA_TERMS].sort(), "the role's top 15 are its own list");
  assert.equal(r.of, ROLE_FIT.TOP);
  const HAVE = ["requirements-gathering", "process-mapping", "user-stories", "uat", "kpi-tracking", "sql", "excel", "tableau", "jira", "visio"];
  assert.deepEqual(r.have.map(h => h.slug).sort(), [...HAVE].sort());
  assert.deepEqual(r.missing.map(m => m.slug).sort(), BA_TERMS.filter(s => !HAVE.includes(s)).sort());
  assert.equal(r.covered, 10);
  assert.match(r.line, /^You cover 10 of this role's top 15 — missing /);
  const idx = categoryIndex(registry);
  for (const s of r.top) {
    const cats = nodeCategories(db.prepare(`SELECT slug, family FROM atlas_nodes WHERE slug = ?`).get(s.slug), idx);
    assert.ok(cats.has("business"), `${s.slug} is a business skill (${[...cats]})`);
  }
  assert.ok(!r.top.some(s => s.slug === "kubernetes" || s.slug === "seo"), "never another category's skills — even one the résumé lists");
  assert.equal(r.role.page, "/atlas/business-analyst");
  assert.equal(r.top.find(s => s.slug === "uat").share, 100, "6 of 6 BA postings");
  assert.ok(Array.isArray(r.nextLevel));

  // By a posting: the role from its title; the résumé as text (no account) — the trial's call.
  const jobId = db.prepare(`SELECT job_id FROM scraped_jobs WHERE title = 'Senior Business Analyst' LIMIT 1`).pluck().get();
  const byJob = roleFitReading(db, { jobId, resumeText: BA_RESUME, registry });
  assert.equal(byJob.role.slug, "senior-business-analyst");
  assert.equal(byJob.job.jobId, jobId);
  assert.deepEqual(byJob.have.map(h => h.slug).sort(), [...HAVE].sort(), "the résumé's text reads the same skills");
  const byTitle = roleFitReading(db, { role: "Business Analyst", terms: ["UAT"], registry });
  assert.deepEqual([byTitle.role.slug, byTitle.covered], ["business-analyst", 1]);
  assert.deepEqual(roleFitReading(db, { role: "Astronaut", registry }), { found: false, reason: "unknown_role", job: null });

  // The route: signed in, the reader's own; signed out, nothing marked as had; private either way.
  let { server, get } = await serve(db, { id: 42 });
  try {
    const a = await get("/api/atlas/role-fit?role=business-analyst");
    assert.deepEqual([a.status, a.body.signedIn, a.body.covered, a.body.of], [200, true, 10, 15]);
    const miss = await get("/api/atlas/role-fit?role=astronaut");
    assert.equal(miss.status, 404);
  } finally { server.close(); }
  ({ server, get } = await serve(db));
  try {
    const anon = await get(`/api/atlas/role-fit?job=${encodeURIComponent(jobId)}`);
    assert.deepEqual([anon.status, anon.body.signedIn, anon.body.covered, anon.body.of], [200, false, 0, 15]);
  } finally { server.close(); }
});
