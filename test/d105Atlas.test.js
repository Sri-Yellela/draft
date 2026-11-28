import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { upsertNode, addEdge, addAlias, aliasesOf, searchNodes, readNode, setStatus, slugOf, EDGE_TYPES } from "../services/atlas/atlasStore.js";
import { seedAtlasFromRegistry, CS_DOMAINS } from "../services/atlas/atlasSeed.js";
import { computeAtlasStats } from "../services/atlas/atlasStats.js";
import { loadConfirmedSynonyms } from "../services/kb/skillSynonyms.js";
import { createAtlasRouter } from "../routes/atlas.js";

// ⭐ D105 (owner 10-30) · THE ATLAS — P1 data, P2 seed, P3 board stats, and the public read API. Synthetic postings.

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
function fixtureDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  return db;
}
const post = (db, id, title, text, { pmin = null, pmax = null, skills = null } = {}) =>
  db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,url,search_query,_hash,description,is_active,salary_min_usd,salary_max_usd,skills_json)
    VALUES (?,?,?,?,?,?,?,1,?,?,?)`).run(id, title, "Co", `https://x.test/${id}`, "t", `h${id}`, text, pmin, pmax, skills);

test("D105 · d105OneThesaurus — no Atlas alias table; an alias added in the Atlas is a confirmed alias the SCORER reads", () => {
  const db = fixtureDb();
  const tables = db.prepare(`SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name LIKE 'atlas_%'`).all();
  // D114 P5 adds atlas_link_counts (day · event · n) — a count, not an alias table; the check below still holds for it.
  // D118 P2 (b) adds atlas_changes (one change counter the in-memory indexes key on) — not an alias table either.
  // D118 P1 adds the live counts' four (each posting's reading, per role × level counts, the store's state, the queue).
  // D169 (migration 223) adds atlas_skill_holds — a typed skill with no published node, held for the curator; not an alias.
  // 45o A155 (3dc0b800, migration 251) adds atlas_prefs (weekdays_only per person) and 45q D185-3 (f90068ed) adds
  // atlas_backlog (rising-skill content drafts); 45l D179 P6 (be7b2642, migration 241) adds atlas_taxonomy_roles (the
  // taxonomy subcategory -> role draft map) — none holds aliases (pin moved on purpose).
  assert.deepEqual(tables.map(t => t.name).sort(), ["atlas_backlog", "atlas_changes", "atlas_edges", "atlas_link_counts", "atlas_live_state", "atlas_mentions" /* 47o, migration 284: "Linked from" */, "atlas_node_stats", "atlas_nodes",
    "atlas_posting_dirty", "atlas_posting_match", "atlas_prefs", "atlas_question_routes" /* 47m, migration 283 */, "atlas_redirects" /* 47o, migration 284: an old address → its entry, not an alias */, "atlas_resources", "atlas_role_level_stats", "atlas_skill_holds", "atlas_taxonomy_roles", "atlas_wiki_cache"]);
  assert.ok(tables.every(t => !/alias/i.test(t.sql)), "aliases live in skill_synonyms only");
  assert.ok(!EDGE_TYPES.includes("alias_of"));
  assert.throws(() => addEdge(db, 1, 2, "alias_of"), /aliases live in skill_synonyms/);
  const k = upsertNode(db, { kind: "tool", name: "Kubernetes" }).id;
  assert.equal(addAlias(db, k, "k8s"), true);
  assert.deepEqual(aliasesOf(db, "kubernetes"), ["k8s"]);
  assert.deepEqual(loadConfirmedSynonyms(db).get("kubernetes"), ["k8s"], "the scorer's own map now holds it");
});

test("D105 · d105AliasSearch — 'k8s' lands on Kubernetes; drafts are invisible to the public search", () => {
  const db = fixtureDb();
  const k = upsertNode(db, { kind: "tool", name: "Kubernetes" }).id;
  upsertNode(db, { kind: "tool", name: "Kubeflow" });
  addAlias(db, k, "k8s");
  assert.deepEqual(searchNodes(db, "k8s"), [], "nothing published yet");
  setStatus(db, "kubernetes", "published");
  setStatus(db, "kubeflow", "published");
  assert.deepEqual(searchNodes(db, "k8s").map(r => [r.slug, r.via]), [["kubernetes", "alias"]]);
  assert.deepEqual(searchNodes(db, "kube").map(r => r.slug), ["kubeflow", "kubernetes"]);
  assert.equal(slugOf("C++"), "c-plus-plus");
  assert.equal(slugOf("CI/CD"), "ci-cd");
});

test("D105 · d105NoModelSeed — the seed reads the scorer's own registry, every categorised domain (A111 P3; was CS only), all DRAFT; idempotent", () => {
  const db = fixtureDb();
  const first = seedAtlasFromRegistry(db);
  assert.ok(first.byKind.role > 20 && first.byKind.skill > 50 && first.byKind.tool > 50, JSON.stringify(first));
  assert.deepEqual(seedAtlasFromRegistry(db), { nodes: 0, edges: 0, byKind: { role: 0, skill: 0, tool: 0 } }, "a second run adds nothing");
  assert.equal(db.prepare(`SELECT COUNT(*) FROM atlas_nodes WHERE status != 'draft'`).pluck().get(), 0, "a person publishes");
  assert.ok(db.prepare(`SELECT 1 FROM atlas_nodes WHERE slug = 'backend-engineer' AND kind = 'role'`).get());
  // ⭐ A111 P3 (11-02, changed on purpose): the seed is no longer computing-only (D127) — a held field still stays out.
  assert.ok(db.prepare(`SELECT 1 FROM atlas_nodes WHERE slug = 'variance-analysis'`).get(), "a business domain is seeded now");
  assert.equal(db.prepare(`SELECT 1 FROM atlas_nodes WHERE slug = 'patient-care'`).get(), undefined, "healthcare is held (D127)");
  assert.ok(CS_DOMAINS.every(d => d === "data" || d.startsWith("engineering")));
  // A curator's edit survives a re-seed.
  db.prepare(`UPDATE atlas_nodes SET name = 'Backend engineer (curated)' WHERE slug = 'backend-engineer'`).run();
  seedAtlasFromRegistry(db);
  assert.equal(db.prepare(`SELECT name FROM atlas_nodes WHERE slug = 'backend-engineer'`).pluck().get(), "Backend engineer (curated)");
  for (const f of ["services/atlas/atlasSeed.js", "services/atlas/atlasStore.js", "services/atlas/atlasStats.js"]) {
    assert.doesNotMatch(read(f), /callModel|anthropic|openai|modelCall/i, `${f} calls no model`);
  }
});

test("D105 · d105BoardStatsComputed — postings, co-skills, roles and pay come from active postings; an English 'go' is not Go", () => {
  const db = fixtureDb();
  const role = upsertNode(db, { kind: "role", name: "Backend Engineer" }).id;
  const py = upsertNode(db, { kind: "tool", name: "Python" }).id;
  const k8s = upsertNode(db, { kind: "tool", name: "Kubernetes" }).id;
  upsertNode(db, { kind: "tool", name: "Go" });
  addEdge(db, role, py, "requires", "registry");
  addAlias(db, k8s, "k8s");
  post(db, "1", "Backend Engineer", "We build APIs in Python and deploy on k8s. Ready to go.", { pmin: 150000, pmax: 190000 });
  post(db, "2", "Senior Backend Engineer", "Python services on Kubernetes.", { pmin: 1, pmax: 1 });
  post(db, "3", "Data Analyst", "SQL and Python dashboards; we write Go.", { skills: JSON.stringify(["Go", "SQL"]) });
  db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,url,search_query,_hash,description,is_active) VALUES ('4','Backend Engineer','Co','u','t','h4','Python',0)`).run();
  // ⭐ P9 (10-31): the pass also reports the board edges it wrote — none here (no pair is asked together 3 times).
  // ⭐ D118 P1: and the drift it corrected in the live counts — null on the first pass (no live baseline before it).
  assert.deepEqual(computeAtlasStats(db, { now: 1000 }), { postings: 3, nodes: 4, boardEdges: 0, drift: null });
  const stat = (slug) => readNode(db, slug, { publishedOnly: false }).onTheBoard;
  assert.equal(stat("python").postings, 3);
  assert.equal(stat("kubernetes").postings, 2, "the alias counts");
  assert.equal(stat("go").postings, 1, "only where the posting's own skills list names it");
  assert.deepEqual(stat("python").topRoles, [{ slug: "backend-engineer", name: "Backend Engineer", postings: 2 }]);
  assert.deepEqual(stat("backend-engineer").pay, { minUsd: 170000, medianUsd: 170000, maxUsd: 170000, n: 1 }, "a $1 'salary' is not pay");
  assert.equal(stat("backend-engineer").postings, 2, "the inactive posting is not on the board");
  // Rewritten whole each run: nothing typed by hand survives it.
  db.prepare(`UPDATE atlas_node_stats SET postings = 999`).run();
  computeAtlasStats(db);
  assert.equal(stat("python").postings, 3);
  assert.doesNotMatch(read("routes/atlas.js"), /UPDATE atlas_node_stats|INSERT INTO atlas_node_stats/, "no route writes a number");
});

test("D105 · d105WikiAttributed — Wikipedia's text is its own block with the licence line and link, never the definition", () => {
  const db = fixtureDb();
  const id = upsertNode(db, { kind: "tool", name: "Kubernetes", definition: "draft's own words." }).id;
  setStatus(db, "kubernetes", "published");
  assert.equal(readNode(db, "kubernetes").wikipedia, null);
  db.prepare(`INSERT INTO atlas_wiki_cache (node_id, title, extract, page_url, fetched_at) VALUES (?,?,?,?,?)`)
    .run(id, "Kubernetes", "Kubernetes is an open-source container orchestration system…", "https://en.wikipedia.org/wiki/Kubernetes", 1);
  const n = readNode(db, "kubernetes");
  assert.equal(n.definition, "draft's own words.");
  assert.equal(n.wikipedia.licence.line, "From Wikipedia, CC BY-SA 4.0");
  assert.equal(n.wikipedia.licence.url, "https://creativecommons.org/licenses/by-sa/4.0/");
  assert.equal(n.wikipedia.pageUrl, "https://en.wikipedia.org/wiki/Kubernetes");
});

async function serve(db, user = null) {
  const app = express();
  app.use(express.json());
  if (user) app.use((req, _r, n) => { req.user = user; n(); });
  app.use("/api/atlas", createAtlasRouter(db));
  const server = app.listen(0);
  const get = (p) => fetch(`http://127.0.0.1:${server.address().port}${p}`).then(async r => ({ status: r.status, body: await r.json() }));
  return { server, get };
}

test("D105 · d105PublicNoAuth + d105YouOnlyWhenSignedIn — published pages open without sign-in; 'You' only for the signed-in reader", async () => {
  const db = fixtureDb();
  const role = upsertNode(db, { kind: "role", name: "Backend Engineer" }).id;
  for (const name of ["Python", "Kubernetes", "Terraform"]) addEdge(db, role, upsertNode(db, { kind: "tool", name }).id, "requires", "registry");
  for (const s of ["backend-engineer", "python", "kubernetes", "terraform"]) setStatus(db, s, "published");
  upsertNode(db, { kind: "skill", name: "Secret Draft" });
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (7,'dana','x')").run();
  db.prepare("INSERT INTO profile_skills (user_id, name) VALUES (7, 'Python'), (7, 'Kubernetes')").run();

  const anon = await serve(db);
  try {
    const page = await anon.get("/api/atlas/node/backend-engineer");
    assert.equal(page.status, 200);
    assert.equal(page.body.you, undefined, "no reader, no 'You'");
    assert.deepEqual(page.body.related.map(r => r.slug).sort(), ["kubernetes", "python", "terraform"]);
    assert.equal((await anon.get("/api/atlas/node/secret-draft")).status, 404, "a draft is the curator's");
    assert.deepEqual((await anon.get("/api/atlas/search?q=pyth")).body.results.map(r => r.slug), ["python"]);
  } finally { anon.server.close(); }

  const signed = await serve(db, { id: 7 });
  try {
    const you = (await signed.get("/api/atlas/node/backend-engineer")).body.you;
    assert.equal(you.status, "have");
    assert.deepEqual(you.missing.map(m => m.slug), ["terraform"]);
    assert.equal((await signed.get("/api/atlas/node/python")).body.you, null, "only role pages compare");
  } finally { signed.server.close(); }

  const server = read("server.js");
  assert.match(server, /app\.use\("\/api\/atlas", createAtlasRouter\(db\)\);/, "mounted without requireAuth");
  assert.match(server, /app\.use\("\/api\/admin\/atlas", requireAdmin, createAtlasAdminRouter\(db\)\);/);
});
