import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { upsertNode, setStatus, addEdge, addAlias } from "../services/atlas/atlasStore.js";
import { computeAtlasStats } from "../services/atlas/atlasStats.js";
import { computeYourMap, boardCounts, YOUR_MAP, UPLOAD_PROMPT } from "../services/atlas/atlasMe.js";
import { learnStepForNode } from "../services/learn/learnLinks.js";
import { learnContent, stepsOf } from "../services/learn/learnContent.js";
import { recordOpened } from "../services/learn/learnEarned.js";
import { stepState } from "../shared/learnStepState.js";
import { createAtlasRouter } from "../routes/atlas.js";
import { at } from "../test-support/sourceAnchors.js";

// ⭐ D116 · YOUR MAP — the Atlas home computed from the reader's own profile (GET /api/atlas/me). Synthetic people,
// nodes and postings only; an in-memory database built from the migrations. Nothing here calls a model or the network.

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
function fixtureDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  return db;
}
/** A PUBLISHED node (or a draft). @returns its id */
const node = (db, kind, name, { published = true } = {}) => {
  const { id } = upsertNode(db, { kind, name, source: "registry" });
  if (published) setStatus(db, db.prepare(`SELECT slug FROM atlas_nodes WHERE id = ?`).pluck().get(id), "published");
  return id;
};
let jobSeq = 0;
const post = (db, title, text, level = null) => {
  const id = `j${++jobSeq}`;
  db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,url,search_query,_hash,description,is_active,level_read)
    VALUES (?,?,?,?,?,?,?,1,?)`).run(id, title, "Co", `https://x.test/${id}`, "t", `h${id}`, text, level);
};
const demand = (db, id, postings, topSkills = []) =>
  db.prepare(`INSERT OR REPLACE INTO atlas_node_stats (node_id, postings, top_skills_json, top_roles_json, computed_at) VALUES (?,?,?,'[]',1)`)
    .run(id, postings, JSON.stringify(topSkills));
function person(db, id, { skills = [], years = null, titles = null } = {}) {
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (?,?,'x')").run(id, `synthetic${id}`);
  for (const [i, s] of skills.entries()) db.prepare("INSERT INTO profile_skills (user_id, name, position) VALUES (?,?,?)").run(id, s, i);
  db.prepare("INSERT INTO user_profile (user_id, years_of_experience) VALUES (?,?)").run(id, years);
  if (titles) db.prepare(`INSERT INTO domain_profiles (user_id, profile_name, role_family, domain, target_titles, is_active) VALUES (?,?,?,?,?,1)`)
    .run(id, titles[0], "engineering", "software", JSON.stringify(titles));
}
async function serve(db, user = null) {
  const app = express();
  if (user) app.use((req, _r, n) => { req.user = user; n(); });
  app.use("/api/atlas", createAtlasRouter(db));
  const server = app.listen(0);
  const get = (p) => fetch(`http://127.0.0.1:${server.address().port}${p}`).then(async r => ({ status: r.status, body: await r.json() }));
  return { server, get };
}
const names = (items) => items.map(i => i.name);

test("D116 · d116HaveFromProfile — the profile's skills that are PUBLISHED nodes, grouped by kind, each with its open-posting count", async () => {
  const db = fixtureDb();
  node(db, "skill", "Python"); node(db, "skill", "SQL");
  const k8s = node(db, "tool", "Kubernetes");
  node(db, "skill", "Secret Draft", { published: false });
  addAlias(db, k8s, "k8s");
  for (let i = 0; i < 3; i++) post(db, "Analyst", "Python and SQL every day.");
  post(db, "Analyst", "Python only.");
  post(db, "Ops", "Kubernetes clusters.");
  computeAtlasStats(db, { boardEdges: false });
  // "k8s" is the person's word for Kubernetes (a confirmed alias); Haskell is no node; the draft is not shown.
  person(db, 7, { skills: ["Python", "SQL", "k8s", "Haskell", "Secret Draft"] });
  const me = computeYourMap(db, 7);
  assert.equal(me.map, true);
  assert.equal(me.haveSkills.total, 3);
  assert.deepEqual(me.haveSkills.groups.map(g => [g.kind, names(g.items), g.items.map(i => i.postings)]),
    [["skill", ["Python", "SQL"], [4, 3]], ["tool", ["Kubernetes"], [1]]]);
  assert.equal(me.haveSkills.groups[0].items[0].line, "Asked for in 4 open postings");
  assert.equal(me.haveSkills.groups[1].items[0].line, "Asked for in 1 open posting");
  // Capped at 12 per group, with the total ("see all"); ?all= returns that section whole.
  for (let i = 0; i < 14; i++) node(db, "skill", `Synthetic Skill ${String.fromCharCode(65 + i)}`);
  db.prepare("INSERT INTO profile_skills (user_id, name) SELECT 7, name FROM atlas_nodes WHERE name LIKE 'Synthetic Skill %'").run();
  const capped = computeYourMap(db, 7).haveSkills.groups[0];
  assert.equal(capped.items.length, YOUR_MAP.PER_SECTION);
  assert.equal(capped.total, 16);
  assert.equal(computeYourMap(db, 7, { all: "haveSkills" }).haveSkills.groups[0].items.length, 16);
  // Through the route, signed in: the same answer, private.
  const s = await serve(db, { id: 7 });
  try {
    const r = await s.get("/api/atlas/me");
    assert.equal(r.status, 200);
    assert.equal(r.body.haveSkills.total, 17);
    assert.equal((await s.get("/api/atlas/me?all=haveSkills")).body.haveSkills.groups[0].items.length, 16);
  } finally { s.server.close(); }
});

test("D116 · d116NextLevelFromBoardShares — a skill at 22 % of mid / 61 % of senior postings surfaces; under the posting minimum, nothing does", () => {
  const db = fixtureDb();
  node(db, "role", "Backend Engineer"); node(db, "role", "Data Engineer");
  node(db, "skill", "Python"); node(db, "tool", "Kubernetes"); node(db, "tool", "Terraform"); node(db, "tool", "Airflow");
  const backend = (level, n, withK8s, withTf) => {
    for (let i = 0; i < n; i++) post(db, "Backend Engineer", `Python. ${i < withK8s ? "Kubernetes." : ""} ${i < withTf ? "Terraform." : ""}`, level);
  };
  backend("mid", 100, 22, 30);       // Kubernetes 22 % · Terraform 30 %
  backend("senior", 100, 61, 35);    // Kubernetes 61 % · Terraform 35 % (+5 points: under the rise)
  for (let i = 0; i < 40; i++) post(db, "Backend Engineer", "Kubernetes everywhere.", null);   // no level read: not counted
  // Data Engineer: Airflow 0 % → 90 %, but only 19 mid postings were read — under the minimum, so not measured.
  for (let i = 0; i < 19; i++) post(db, "Data Engineer", "Python.", "mid");
  for (let i = 0; i < 30; i++) post(db, "Data Engineer", `Python. ${i < 27 ? "Airflow." : ""}`, "senior");
  computeAtlasStats(db, { boardEdges: false });
  person(db, 7, { skills: ["Python"], years: 3, titles: ["Backend Engineer", "Data Engineer"] });   // 3 years → mid
  const me = computeYourMap(db, 7);
  assert.deepEqual(names(me.targetRoles), ["Backend Engineer", "Data Engineer"]);
  const nl = me.nextLevel;
  assert.deepEqual(names(nl.items), ["Kubernetes"], "Python is on the profile; Terraform rose 5 points; Airflow's role is under the minimum");
  const k = nl.items[0];
  assert.deepEqual([k.from, k.to, k.rise], [{ level: "mid", share: 22 }, { level: "senior", share: 61 }, 39]);
  assert.equal(k.line, "In 61 % of senior Backend Engineer postings vs 22 % of mid");
  assert.equal(k.role.name, "Backend Engineer");
  const data = nl.roles.find(r => r.name === "Data Engineer");
  assert.deepEqual([data.reason, data.postings], ["too_few_postings", { from: 19, to: 30 }]);
  assert.equal(YOUR_MAP.NEXT_LEVEL_MIN_POSTINGS, 20);
  assert.equal(YOUR_MAP.NEXT_LEVEL_RISE_POINTS, 10);
  // The counts the nightly stats pass kept are the counts a pass of YOUR MAP's own makes (after a restart): one matcher.
  const nodes = db.prepare(`SELECT id, kind, term FROM atlas_nodes`).all();
  const kept = boardCounts(db, nodes), fresh = boardCounts(db, nodes, { reuse: false });
  assert.notEqual(kept, fresh);
  assert.deepEqual(fresh, kept);
  assert.deepEqual([kept.postings, kept.levelRead], [289, 249]);
  // A missing piece is an empty section with its reason — never an error.
  person(db, 8, { skills: ["Python"], years: 9, titles: ["Backend Engineer"] });
  assert.deepEqual([computeYourMap(db, 8).nextLevel.items, computeYourMap(db, 8).nextLevel.reason], [[], "top_level"]);
  person(db, 9, { skills: ["Python"], titles: ["Backend Engineer"] });
  assert.equal(computeYourMap(db, 9).nextLevel.reason, "no_level");
  person(db, 10, { skills: ["Python"], years: 3 });
  assert.equal(computeYourMap(db, 10).nextLevel.reason, "no_target_role");
});

test("D116 · d116AdjacentExcludesHave — used_with neighbours NOT on the profile, by demand, naming the skills they go with", () => {
  const db = fixtureDb();
  const [py, k8s, go, helm, django, secret] = [["skill", "Python"], ["tool", "Kubernetes"], ["skill", "Go"], ["tool", "Helm"], ["tool", "Django"]]
    .map(([k, n]) => node(db, k, n)).concat(node(db, "tool", "Secret Draft", { published: false }));
  const role = node(db, "role", "Backend Engineer");
  demand(db, py, 90); demand(db, k8s, 50); demand(db, go, 30); demand(db, helm, 20); demand(db, django, 10); demand(db, secret, 99);
  addEdge(db, py, k8s, "used_with", "board");      // both on the profile — never adjacent
  addEdge(db, py, django, "used_with", "registry");
  addEdge(db, helm, k8s, "used_with", "board");    // either direction
  addEdge(db, go, k8s, "used_with", "board"); addEdge(db, py, go, "used_with", "owner");
  addEdge(db, k8s, secret, "used_with", "board");  // a draft — never in an answer
  addEdge(db, py, role, "used_with", "owner");     // a role is no adjacent skill
  person(db, 7, { skills: ["Python", "Kubernetes"] });
  const adj = computeYourMap(db, 7).adjacent;
  assert.deepEqual(names(adj.items), ["Go", "Helm", "Django"]);
  assert.ok(!adj.items.some(i => ["Python", "Kubernetes", "Secret Draft"].includes(i.name)));
  assert.deepEqual(names(adj.items[0].with), ["Python", "Kubernetes"], "by their demand");
  assert.equal(adj.items[0].line, "Often asked with Python and Kubernetes");
  assert.equal(adj.items[1].line, "Often asked with Kubernetes");
});

test("D116 · d116BranchCoverage — other roles where the user covers ≥ 40 % of the top 15 required; by coverage, then demand", () => {
  const db = fixtureDb();
  const skill = (n, d) => { const id = node(db, "skill", n); demand(db, id, d); return id; };
  const roleWith = (name, postings, needs) => { const r = node(db, "role", name); demand(db, r, postings); for (const id of needs) addEdge(db, r, id, "requires", "board"); return r; };
  const [py, sql, spark, airflow, dbt] = [["Python", 100], ["SQL", 90], ["Spark", 30], ["Airflow", 20], ["dbt", 10]].map(([n, d]) => skill(n, d));
  const [looker, tableau, pytorch, cuda, mlflow, kubeflow, go, docker] =
    ["Looker", "Tableau", "PyTorch", "CUDA", "MLflow", "Kubeflow", "Go", "Docker"].map(n => skill(n, 5));
  roleWith("Data Engineer", 40, [py, sql, spark, airflow, dbt]);                 // 2 of 5 = 40 %
  roleWith("Analytics Engineer", 50, [py, sql, dbt, looker, tableau]);           // 2 of 5 = 40 %, more demand
  roleWith("ML Engineer", 80, [py, pytorch, cuda, mlflow, kubeflow]);            // 1 of 5 = 20 %
  roleWith("Backend Engineer", 99, [py, sql, go, docker, spark]);                // the TARGET role — not a branch
  roleWith("Tiny Role", 5, [py, sql]);                                           // 2 of 2 — too few to judge
  // Platform Engineer requires 16; its top 15 by demand count — the 16th (the least asked) does not.
  const plat = Array.from({ length: 16 }, (_, i) => skill(`Platform Skill ${String.fromCharCode(65 + i)}`, 200 - i));
  roleWith("Platform Engineer", 30, plat);
  const mine = ["Python", "SQL", ...plat.slice(0, 9).map((_, i) => `Platform Skill ${String.fromCharCode(65 + i)}`)];
  person(db, 7, { skills: mine, titles: ["Backend Engineer"] });
  const br = computeYourMap(db, 7).branches;
  assert.deepEqual(names(br.items), ["Platform Engineer", "Analytics Engineer", "Data Engineer"]);
  const [p, , d] = br.items;
  assert.deepEqual([p.covered, p.of, p.coverage, p.missing.length], [9, 15, 0.6, 6]);
  assert.ok(!p.missing.some(m => m.name === "Platform Skill P"), "the 16th is not in the top 15");
  assert.deepEqual([d.covered, d.of, names(d.missing)], [2, 5, ["Spark", "Airflow", "dbt"]]);
  assert.equal(d.line, "You cover 2 of 5 for Data Engineer — missing: Spark, Airflow, dbt");
  assert.equal(YOUR_MAP.BRANCH_MIN_COVERAGE_PERCENT, 40);
  assert.equal(YOUR_MAP.BRANCH_TOP_REQUIRED, 15);
});

test("D116 · d116LearnNextLinksSteps — the learning-path steps that teach the top gaps, with the user's progress", () => {
  const db = fixtureDb();
  const py = node(db, "skill", "Python");
  const git = node(db, "tool", "Git"), linux = node(db, "tool", "Linux"), untaught = node(db, "tool", "Synthetic Untaught Tool");
  demand(db, py, 50); demand(db, git, 40); demand(db, linux, 30); demand(db, untaught, 20);
  for (const id of [git, linux, untaught]) addEdge(db, py, id, "used_with", "board");
  person(db, 7, { skills: ["Python"] });
  const gitStep = learnStepForNode(db, { name: "Git", term: "git" });
  const linuxStep = learnStepForNode(db, { name: "Linux", term: "linux" });
  assert.ok(gitStep && linuxStep, "the owner's path teaches Git and Linux");
  const step = stepsOf(learnContent()).find(s => s.id === gitStep.stepId);
  const first = step.items.find(it => !it.o && it.u);
  assert.ok(recordOpened(db, 7, first.id).ok, "opened from draft (D117 C8)");
  const ln = computeYourMap(db, 7).learnNext;
  assert.deepEqual(ln.items.map(i => i.stepId), [gitStep.stepId, linuxStep.stepId], "in the gaps' order; a gap no step teaches adds nothing");
  const g = ln.items[0];
  assert.equal(g.label, gitStep.label);
  assert.equal(g.path, `/learn#step-${gitStep.stepId}`);
  assert.deepEqual(g.teaches, [{ slug: "git", name: "Git", from: "adjacent" }]);
  assert.deepEqual(g.progress, stepState(step, { [first.id]: 1 }), "the Learn view's own rule");
  assert.equal(g.progress.done, 1);
  assert.equal(ln.items[1].progress.done, 0);
});

test("D116 · d116SignedOutNotEmpty — signed out (or no skills): search, Learn, Explore by role and the upload line", async () => {
  const db = fixtureDb();
  const be = node(db, "role", "Backend Engineer"), de = node(db, "role", "Data Engineer"), dr = node(db, "role", "Secret Role", { published: false });
  node(db, "skill", "Python"); node(db, "skill", "Secret Draft", { published: false });
  demand(db, be, 300, [{ slug: "python", name: "Python", postings: 200 }, { slug: "secret-draft", name: "Secret Draft", postings: 100 }]);
  demand(db, de, 120, [{ slug: "python", name: "Python", postings: 90 }]);
  demand(db, dr, 999);
  person(db, 7, { skills: [] });
  const anon = await serve(db), signedIn = await serve(db, { id: 7 });
  try {
    for (const body of [(await anon.get("/api/atlas/me")).body, (await signedIn.get("/api/atlas/me")).body]) {
      assert.equal(body.map, false);
      assert.equal(body.prompt, "Upload a résumé and this page becomes your map.");
      assert.equal(body.prompt, UPLOAD_PROMPT);
      assert.match(body.search.hint, /Search/);
      assert.equal(body.learn.path, "/learn");
      assert.deepEqual(names(body.exploreByRole.items), ["Backend Engineer", "Data Engineer"], "biggest first; drafts never");
      assert.deepEqual(names(body.exploreByRole.items[0].topSkills), ["Python"]);
    }
    assert.equal((await anon.get("/api/atlas/me")).body.signedIn, false);
    // An empty board still answers with search, Learn and the line.
    const empty = computeYourMap(fixtureDb(), null);
    assert.deepEqual([empty.prompt, empty.learn.path, typeof empty.search.hint, empty.exploreByRole.total], [UPLOAD_PROMPT, "/learn", "string", 0]);
  } finally { anon.server.close(); signedIn.server.close(); }
  // The route never asks for sign-in: signed out is the fallback, not a 401.
  const route = read("routes/atlas.js");
  const me = route.slice(at(route, 'router.get("/me"'), at(route, 'router.post("/link-event"'));
  assert.doesNotMatch(me, /requireAuth/);
});

/** Every local module a file reaches through its imports (static and dynamic), itself included. */
function reach(entry) {
  const seen = new Set(), bare = new Set(), todo = [path.resolve(entry)];
  while (todo.length) {
    const f = todo.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    for (const m of fs.readFileSync(f, "utf8").matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["']([^"']+)["']/g)) {
      const spec = m[1];
      if (spec.startsWith(".")) todo.push(path.resolve(path.dirname(f), spec));
      else bare.add(spec);
    }
  }
  return { files: [...seen], bare: [...bare] };
}

test("D116 · d116NoModel — YOUR MAP reads no model: no model client anywhere atlasMe.js or the route reaches", () => {
  const MODEL = /modelCall|anthropic|openai|generativeai|groq|mistral|cohere/i;
  for (const entry of ["services/atlas/atlasMe.js", "routes/atlas.js"]) {
    const { files, bare } = reach(entry);
    assert.ok(files.length > 3, `${entry} reached its imports`);
    for (const f of files) for (const m of fs.readFileSync(f, "utf8").matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*)["']([^"']+)["']/g))
      assert.doesNotMatch(m[1], MODEL, `${path.relative(process.cwd(), f)} imports ${m[1]}`);
    assert.ok(!bare.some(b => MODEL.test(b)), `${entry}: ${bare.join(", ")}`);
  }
  assert.doesNotMatch(read("services/atlas/atlasMe.js").replace(/^\s*\/\/.*$/gm, ""), /callModel|anthropic|openai|completion|generateText/i);
});

test("D116 · d116ThresholdsOneFile — every threshold is one constant in YOUR_MAP, in atlasMe.js, and nowhere else", () => {
  assert.ok(Object.isFrozen(YOUR_MAP));
  assert.equal(YOUR_MAP.NEXT_LEVEL_RISE_POINTS, 10);
  assert.equal(YOUR_MAP.NEXT_LEVEL_MIN_POSTINGS, 20);
  assert.equal(YOUR_MAP.BRANCH_MIN_COVERAGE_PERCENT, 40);
  assert.equal(YOUR_MAP.BRANCH_TOP_REQUIRED, 15);
  assert.equal(YOUR_MAP.PER_SECTION, 12);
  const src = read("services/atlas/atlasMe.js");
  const start = at(src, "export const YOUR_MAP = Object.freeze({");
  const block = src.slice(start, at(src, "});", start) + 3);
  const rest = (src.slice(0, start) + src.slice(start + block.length)).replace(/^\s*\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
  // Outside the block: no threshold written as a number (a tuned value must not hide in the code that reads it).
  for (const m of rest.matchAll(/(?<![\w.])(\d+(?:\.\d+)?)(?![\w.])/g))
    assert.ok(["0", "1", "100"].includes(m[1]), `a bare number ${m[1]} in atlasMe.js outside YOUR_MAP: …${rest.slice(Math.max(0, m.index - 40), m.index + 20)}…`);
  assert.equal((src.match(/\bYOUR_MAP\s*=/g) || []).length, 1, "one thresholds object");
  // And no other Atlas file (or the route) carries D116's thresholds.
  const others = fs.readdirSync("services/atlas").filter(f => f.endsWith(".js") && f !== "atlasMe.js").map(f => `services/atlas/${f}`).concat("routes/atlas.js");
  for (const f of others) assert.doesNotMatch(read(f), /NEXT_LEVEL_|BRANCH_MIN_|BRANCH_TOP_REQUIRED|PER_SECTION/, f);
});
