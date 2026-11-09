import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { upsertNode, setStatus } from "../services/atlas/atlasStore.js";
import { computeAtlasStats } from "../services/atlas/atlasStats.js";
import { computeYourMap, YOUR_MAP } from "../services/atlas/atlasMe.js";
import { roleTree, familyTree, closenessCounts, NO_AIM } from "../services/atlas/atlasTree.js";
import { seedAtlasFamilies, readFamilyMapping } from "../services/atlas/atlasFamilies.js";
import { updateNode, readNodeForEditor, AtlasEditError } from "../services/atlas/atlasEditor.js";
import { recordOpened, saveExplanation, saveBuild } from "../services/learn/learnEarned.js";
import { setMark } from "../services/learn/learnProgress.js";
import { seedCircleData } from "../services/learn/learnCircle.js";
import { mapRouteFor } from "../services/learn/learnMapRoute.js";
import { FAMILY_KEYS } from "../shared/atlasFamilies.js";
import { createAtlasRouter } from "../routes/atlas.js";

// ⭐ D116 M1 / M7 / M8 / M9 · THE TREE'S DATA (services/atlas/atlasTree.js) — what GET /api/atlas/me → tree and
// /api/atlas/tree/role|family/… answer. Synthetic people, nodes and postings; an in-memory database built from the
// migrations. Nothing here calls a model or the network. The drawing's own rules: test/d116TreeUi.test.js.

function fixtureDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  return db;
}
/** A PUBLISHED node in a family (or none). @returns its id */
const node = (db, kind, name, family = null, { published = true } = {}) => {
  const { id } = upsertNode(db, { kind, name, source: "registry" });
  const slug = db.prepare(`SELECT slug FROM atlas_nodes WHERE id = ?`).pluck().get(id);
  if (published) setStatus(db, slug, "published");
  if (family) db.prepare(`UPDATE atlas_nodes SET family = ?, family_by = 'seed' WHERE id = ?`).run(family, id);
  return id;
};
let jobSeq = 0;
const post = (db, title, text, level = null) => {
  const id = `j${++jobSeq}`;
  db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,url,search_query,_hash,description,is_active,level_read)
    VALUES (?,?,?,?,?,?,?,1,?)`).run(id, title, `Co${jobSeq % 7}`, `https://x.test/${id}`, "t", `h${id}`, text, level);
};
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
  const get = (p) => fetch(`http://127.0.0.1:${server.address().port}${p}`).then(async r => ({ status: r.status, headers: r.headers, body: await r.json() }));
  return { server, get };
}
const treeOf = (db, uid) => computeYourMap(db, uid).tree;
const bySlug = (t) => new Map(t.nodes.map(n => [n.slug, n]));

/** A small board: an infra family around Kubernetes / Docker, a data family around SQL. */
function board() {
  const db = fixtureDb();
  node(db, "role", "Backend Engineer");
  const ids = {};
  for (const [k, n, f] of [["tool", "Kubernetes", "infra"], ["tool", "Docker", "infra"], ["tool", "Terraform", "infra"], ["tool", "Prometheus", "infra"],
    ["skill", "SQL", "data"], ["tool", "Airflow", "data"], ["tool", "Python", "backend"], ["tool", "Haskell", null]]) ids[n] = node(db, k, n, f);
  return { db, ids };
}

test("D116 M1 · d116FamilyFieldStored — `family` is a stored column, seeded ONCE from the reviewed file, the curator's choice sticks; no family → not drawn", () => {
  const db = fixtureDb();
  const cols = db.prepare(`PRAGMA table_info(atlas_nodes)`).all().map(c => c.name);
  assert.ok(cols.includes("family") && cols.includes("family_by"), "migration 201 adds family + family_by");
  assert.ok(MIGRATIONS.some(m => m.id === "201_atlas_node_family"));
  for (const n of ["Kubernetes", "Docker", "Python", "Haskell"]) upsertNode(db, { kind: "tool", name: n, source: "registry" });
  const fam = (slug) => db.prepare(`SELECT family, family_by FROM atlas_nodes WHERE slug = ?`).get(slug);
  const mapping = new Map([["kubernetes", "infra"], ["docker", "infra"], ["python", "backend"], ["not-a-node", "ml"]]);
  assert.deepEqual(seedAtlasFamilies(db, mapping), { assigned: 3, missing: ["not-a-node"] });
  assert.deepEqual(fam("kubernetes"), { family: "infra", family_by: "seed" });
  // The curator moves Docker and clears Python — both stick through a second seed.
  updateNode(db, "docker", { family: "backend" }, "curator-a");
  updateNode(db, "python", { family: "" }, "curator-a");
  assert.deepEqual(seedAtlasFamilies(db, mapping), { assigned: 0, missing: ["not-a-node"] });
  assert.deepEqual(fam("docker"), { family: "backend", family_by: "curator-a" });
  assert.deepEqual(fam("python"), { family: null, family_by: "curator-a" });
  assert.equal(readNodeForEditor(db, "docker").family, "backend");
  // 45n D179 (2b37211d) made "frontend" a real family — the unknown-family example moved to a key that is none (pin moved on purpose).
  assert.throws(() => updateNode(db, "docker", { family: "not_a_family" }), (e) => e instanceof AtlasEditError && e.code === "bad_family");
  // The reviewed file: every family known, no slug twice.
  const file = readFamilyMapping();
  assert.ok(file.size > 100);
  for (const f of file.values()) assert.ok(FAMILY_KEYS.includes(f));
  // A node with no family is not drawn — it stays out of the tree, not out of the Atlas.
  const { db: b, ids } = board();
  for (let i = 0; i < 5; i++) post(b, "Backend Engineer", "Kubernetes, Docker and Haskell.");
  computeAtlasStats(b, { boardEdges: false });
  person(b, 7, { skills: ["Kubernetes"] });
  const t = treeOf(b, 7);
  assert.ok(bySlug(t).has("docker"));
  assert.ok(!bySlug(t).has("haskell"), "Haskell has no family: not on the tree");
  assert.equal(b.prepare("SELECT status FROM atlas_nodes WHERE id = ?").pluck().get(ids.Haskell), "published", "…and stays a published page");
});

test("D116 M1 · d116TreeDistanceIsCloseness — closeness = the share of a node's postings that also ask for 2+ of the user's skills (from the live rows)", () => {
  const { db } = board();
  // Terraform: 10 postings; 6 also ask for Kubernetes AND Docker (2 of the user's), 2 ask for Kubernetes only, 2 for none.
  for (let i = 0; i < 6; i++) post(db, "Backend Engineer", "Terraform, Kubernetes and Docker.");
  for (let i = 0; i < 2; i++) post(db, "Backend Engineer", "Terraform and Kubernetes.");
  for (let i = 0; i < 2; i++) post(db, "Backend Engineer", "Terraform only.");
  computeAtlasStats(db, { boardEdges: false });
  person(db, 7, { skills: ["Kubernetes", "Docker"] });
  const t = bySlug(treeOf(db, 7));
  assert.equal(t.get("terraform").postings, 10);
  assert.equal(t.get("terraform").closeness, 60);
  // The user's own skill: "also" — itself not counted (Kubernetes' 8 postings, 6 with Docker too: one other, not two).
  assert.equal(t.get("kubernetes").closeness, 0);
  // The rule itself, on readings: 2 of mine (not counting the node) → close.
  const c = closenessCounts([{ asked: [1, 2, 3] }, { asked: [1, 2] }, { asked: [1] }], new Set([2, 3]));
  assert.deepEqual([c.get(1).postings, c.get(1).close], [3, 1]);
  assert.equal(YOUR_MAP.CLOSE_MIN_MINE, 2);
  // ⭐ D118: a posting ingested NOW moves the tree at once (the live rows, no nightly pass).
  post(db, "Backend Engineer", "Terraform, Kubernetes and Docker.");
  const after = bySlug(treeOf(db, 7)).get("terraform");
  assert.deepEqual([after.postings, after.closeness], [11, 64]);
});

test("D116 M2 · d116TreeParentIsMostAskedWith — a skill you don't have hangs off the skill of yours IN ITS FAMILY it is most asked with (ties → more postings), else the trunk", () => {
  const { db } = board();
  // Prometheus (infra): with Kubernetes ×3, with Docker ×3 (a tie — Kubernetes has more postings), with SQL ×5 (another family).
  for (let i = 0; i < 3; i++) post(db, "Backend Engineer", "Prometheus and Kubernetes.");
  for (let i = 0; i < 3; i++) post(db, "Backend Engineer", "Prometheus and Docker.");
  for (let i = 0; i < 5; i++) post(db, "Backend Engineer", "Prometheus and SQL.");
  for (let i = 0; i < 4; i++) post(db, "Backend Engineer", "Kubernetes alone.");
  for (let i = 0; i < 3; i++) post(db, "Backend Engineer", "Airflow and Python.");
  computeAtlasStats(db, { boardEdges: false });
  person(db, 7, { skills: ["Kubernetes", "Docker", "SQL"] });
  const t = bySlug(treeOf(db, 7));
  const p = t.get("prometheus");
  assert.equal(p.askedWith[0].slug, "sql", "SQL is asked with it most…");
  assert.equal(p.parent, "kubernetes", "…but SQL is Data: the parent is the infra skill, the tie to the one with more postings");
  assert.equal(t.get("airflow").parent, null, "asked with none of the user's data skills → the trunk");
  assert.equal(t.get("kubernetes").parent, null, "the user's own skills sit on the trunk");
});

test("D116 M1 · d116TreeSizeIsPostings — each node's postings are the live count (D118); the user's own say 'N postings'", () => {
  const { db } = board();
  for (let i = 0; i < 9; i++) post(db, "Backend Engineer", "Docker.");
  for (let i = 0; i < 4; i++) post(db, "Backend Engineer", "Airflow.");
  computeAtlasStats(db, { boardEdges: false });
  person(db, 7, { skills: ["Docker"] });
  const t = bySlug(treeOf(db, 7));
  assert.equal(t.get("docker").postings, 9);
  assert.equal(t.get("docker").sub, "9 postings");
  assert.equal(t.get("airflow").postings, 4);
  assert.equal(t.get("airflow").sub, "0 % close · 4");
  db.prepare(`UPDATE scraped_jobs SET is_active = 0 WHERE description = 'Airflow.' AND id IN (SELECT id FROM scraped_jobs WHERE description = 'Airflow.' LIMIT 1)`).run();
  assert.equal(bySlug(treeOf(db, 7)).get("airflow").postings, 3, "a closed posting moves it at once");
});

/** A role with ≥ 20 mid and ≥ 20 senior postings: Terraform 20 % → 60 %, Prometheus 30 % → 35 %. */
function levelled() {
  const { db, ids } = board();
  const n = 20;
  for (let i = 0; i < n; i++) post(db, "Backend Engineer", `Kubernetes. ${i < 4 ? "Terraform." : ""} ${i < 6 ? "Prometheus." : ""}`, "mid");
  for (let i = 0; i < n; i++) post(db, "Backend Engineer", `Kubernetes. ${i < 12 ? "Terraform." : ""} ${i < 7 ? "Prometheus." : ""} ${i < 3 ? "Docker." : ""}`, "senior");
  computeAtlasStats(db, { boardEdges: false });
  return { db, ids };
}

test("D116 M3 · d116TreeRingThreeStates — green = have · orange = rises toward senior (senior − mid ≥ 10 points) · blue = other", () => {
  const { db } = levelled();
  person(db, 7, { skills: ["Kubernetes"], years: 3, titles: ["Backend Engineer"] });
  const t = bySlug(treeOf(db, 7));
  assert.equal(t.get("kubernetes").ring, "have");
  assert.deepEqual([t.get("terraform").ring, t.get("terraform").midShare, t.get("terraform").seniorShare, t.get("terraform").rise], ["rises", 20, 60, 40]);
  assert.deepEqual([t.get("prometheus").ring, t.get("prometheus").rise], ["other", 5]);
  assert.equal(t.get("docker").ring, "rises", "0 % of mid, 15 % of senior");
});

test("D116 M5 · d116TreeFactsVerbatim — the owner's three sentences, measured: closeness, mid → senior, the route; and the user's own skill", () => {
  const { db } = levelled();
  person(db, 7, { skills: ["Kubernetes", "Prometheus"], years: 3, titles: ["Backend Engineer"] });
  const tr = treeOf(db, 7);
  const t = bySlug(tr);
  const tf = t.get("terraform");
  assert.equal(tf.facts.closeness, "Terraform is asked for in 16 open postings, and 69 % of those also ask for two or more skills you have (Kubernetes and Prometheus).");
  assert.equal(tf.facts.slope, "20 % of mid Backend Engineer postings, 60 % of senior (+40 points).");
  assert.equal(tf.routeStep, 2);
  assert.equal(tf.facts.route, "Step 2 of 2. It's 69 % close to what you know, so it comes early.");
  const k = t.get("kubernetes");
  assert.equal(k.facts.postings, "Asked for in 40 open postings");
  assert.deepEqual(k.facts.opensToward.map(o => o.name), ["Terraform", "Docker"]);
  // Next up: the highest closeness × log(postings) — Terraform (69 % × log 16) over Docker (100 % × log 3).
  assert.equal(tr.nextUp, "terraform");
  assert.deepEqual(tr.user, { role: { slug: "backend-engineer", name: "Backend Engineer" }, level: "mid", aim: { slug: "backend-engineer", name: "Backend Engineer", level: "senior" } });
});

test("D116 M9 · d116TreeNoAimMessage — no target role: no mid → senior, no route, 'Set an aim to see what seniority adds'; under 20 postings at a level: no line", () => {
  const { db } = levelled();
  person(db, 7, { skills: ["Kubernetes"], years: 3 });
  const tr = treeOf(db, 7);
  assert.deepEqual(tr.noAim, NO_AIM);
  assert.equal(NO_AIM.line, "Set an aim to see what seniority adds");
  assert.equal(NO_AIM.path, "/app/job-profiles");
  const tf = bySlug(tr).get("terraform");
  assert.deepEqual([tf.facts.slope, tf.facts.route, tf.midShare, tf.ring], [null, null, null, "other"]);
  assert.deepEqual(tr.route, []);
  // A role with 19 senior postings read: measured at neither level.
  const { db: thin } = board();
  for (let i = 0; i < 20; i++) post(thin, "Backend Engineer", "Kubernetes. Terraform.", "mid");
  for (let i = 0; i < 19; i++) post(thin, "Backend Engineer", "Kubernetes. Terraform.", "senior");
  computeAtlasStats(thin, { boardEdges: false });
  person(thin, 8, { skills: ["Kubernetes"], years: 3, titles: ["Backend Engineer"] });
  const t8 = treeOf(thin, 8);
  assert.equal(t8.noAim, undefined);
  assert.equal(bySlug(t8).get("terraform").facts.slope, null);
  assert.equal(bySlug(t8).get("terraform").midShare, null);
});

test("D116 M1 · d116TreeCapTwelvePerFamily — at most 12 nodes of a family on the tree (highest postings × closeness); the rest in its list; the user's own always shown", () => {
  const db = fixtureDb();
  const mine = ["Alpha One", "Alpha Two"];
  for (const n of mine) node(db, "tool", n, "ml");
  const others = Array.from({ length: 14 }, (_, i) => `Beta ${String.fromCharCode(65 + i)}`);
  for (const n of others) node(db, "tool", n, "ml");
  // Beta A … N: 14 … 1 postings each, every one with both of the user's skills (closeness 100 %).
  others.forEach((n, i) => { for (let k = 0; k < 14 - i; k++) post(db, "Analyst", `${n}. Alpha One. Alpha Two.`); });
  computeAtlasStats(db, { boardEdges: false });
  person(db, 7, { skills: mine });
  const tr = treeOf(db, 7);
  const f = tr.families.find(x => x.key === "ml");
  assert.equal(YOUR_MAP.TREE_PER_FAMILY, 12);
  assert.deepEqual([f.total, f.drawn, f.more], [16, 12, 4]);
  const drawn = tr.nodes.filter(n => n.onTree).map(n => n.name);
  for (const n of mine) assert.ok(drawn.includes(n), `${n}: the user's own is always shown`);
  assert.ok(!drawn.includes("Beta N") && !drawn.includes("Beta K"), "the lowest postings × closeness wait in the list");
  // ⭐ D178-2 (changed on purpose): a family says how many are proven and how many only claimed — never a flat "you have N of M".
  assert.equal(f.tag, "ML · 2 claimed · of 16");
  // The list: yours first (by postings), then closest → furthest — every member, drawn or not.
  assert.deepEqual(f.order.slice(0, 3), ["alpha-one", "alpha-two", "beta-a"]);
  assert.equal(f.order.length, 16);
});

test("D116 M4 · d116TreeFlyMyRouteOrder (data) — the route: the aim role's top skills not yet had, closest first, numbered", () => {
  const { db } = levelled();
  person(db, 7, { skills: ["Kubernetes", "Prometheus"], years: 3, titles: ["Backend Engineer"] });
  const tr = treeOf(db, 7);
  assert.deepEqual(tr.route, ["docker", "terraform"], "Docker 100 % close, Terraform 69 %");
  const t = bySlug(tr);
  assert.deepEqual([t.get("docker").routeStep, t.get("terraform").routeStep, t.get("kubernetes").routeStep], [1, 2, null]);
  assert.ok(t.get("docker").closeness >= t.get("terraform").closeness);
});

test("D116 M7 · d116TreeRoleAndFamilyPages (data) — a role: its top skills, share of its postings, 'You cover …'; a family: share of postings asking for any of its skills; signed out: no rings", async () => {
  const { db } = levelled();
  person(db, 7, { skills: ["Kubernetes"], years: 3, titles: ["Backend Engineer"] });
  const r = roleTree(db, "backend-engineer", 7);
  assert.equal(r.page, "role");
  assert.equal(r.centre.postings, 40);
  const s = bySlug(r);
  assert.deepEqual([s.get("kubernetes").share, s.get("terraform").share, s.get("prometheus").share, s.get("docker").share], [100, 40, 33, 8]);
  assert.deepEqual([s.get("kubernetes").ring, s.get("terraform").ring, s.get("prometheus").ring], ["have", "rises", "other"]);
  assert.equal(r.cover.line, "You cover 1 of 4; missing Terraform 40 %, Prometheus 33 %, Docker 8 %");
  const out = roleTree(db, "backend-engineer", null);
  assert.ok(out.nodes.every(n => n.have && n.ring === null), "signed out: all coloured, no rings");
  assert.equal(out.cover, null);
  assert.equal(roleTree(db, "kubernetes", null), null, "not a role");
  const f = familyTree(db, "infra", 7);
  assert.equal(f.centre.postings, 40, "every posting asks for an infra skill");
  assert.deepEqual(bySlug(f).get("terraform").share, 40);
  // 45n D179 (2b37211d): "frontend" is a family now; the unknown-family case uses a key that is none (pin moved on purpose).
  assert.equal(familyTree(db, "not_a_family", null), null);
  // The routes: public, 404 for an unknown, private when signed in.
  const anon = await serve(db);
  const me = await serve(db, { id: 7 });
  try {
    const a = await anon.get("/api/atlas/tree/role/backend-engineer");
    assert.equal(a.status, 200);
    assert.match(a.headers.get("cache-control"), /^public/);
    assert.equal((await anon.get("/api/atlas/tree/family/infra")).body.page, "family");
    assert.equal((await anon.get("/api/atlas/tree/family/nope")).status, 404);
    assert.equal((await anon.get("/api/atlas/tree/role/nope")).status, 404);
    const m = await me.get("/api/atlas/tree/role/backend-engineer");
    assert.equal(m.headers.get("cache-control"), "private, no-store");
    assert.equal(m.body.cover.have, 1);
    const map = await me.get("/api/atlas/me");
    assert.equal(map.body.tree.page, "you", "one response draws the whole map");
  } finally { anon.server.close(); me.server.close(); }
});

// ── M8 · the course unlocks the tree ────────────────────────────────────────────────────────────

/** Kubernetes is taught by the tracker's step o4 (items o4-vm · o4-docker · o4-k8s, three checkpoints). */
function course() {
  const { db } = levelled();
  person(db, 7, { skills: ["Docker"], years: 3, titles: ["Backend Engineer"] });
  return db;
}
// ⭐ D117 C8 (changed on purpose): a step is finished by what the learner DID — its three links opened from draft, its three
// checkpoints explained in 25+ words of their own, and (o4 has a required Build) the link to what they built. No ticks.
const OWN = "A container packages an application with its libraries so it runs the same anywhere, and the orchestrator schedules many of them across machines, restarts failures and spreads load for me.";
const openO4 = (db, uid, ids) => { for (const id of ids) assert.ok(recordOpened(db, uid, id).ok, id); };
const explainO4 = (db, uid, ns) => { for (const n of ns) assert.ok(saveExplanation(db, uid, `o4#c${n}`, OWN).ok, n); };
const completeO4 = (db, uid) => {
  openO4(db, uid, ["o4-vm", "o4-docker", "o4-k8s"]); explainO4(db, uid, [0, 1, 2]);
  assert.ok(saveBuild(db, uid, "o4", { url: "https://github.com/example-learner/k8s-lab" }).ok);
};

test("D116 M8 · d116UnlockOnStepComplete — every required item done and every checkpoint explained → the node is LEARNED: coloured, counted in its family", () => {
  const db = course();
  let k = bySlug(treeOf(db, 7)).get("kubernetes");
  assert.deepEqual([k.state, k.learned, k.courseStep.stepId, k.courseStep.path], ["not_yet", false, "o4", "/learn#step-o4"]);
  completeO4(db, 7);
  const tr = treeOf(db, 7);
  k = bySlug(tr).get("kubernetes");
  assert.deepEqual([k.state, k.learned, k.have, k.ring], ["learned", true, false, "have"]);
  // ⭐ D178-2 (changed on purpose): a family says how many are proven and how many only claimed — never a flat "you have N of M".
  assert.equal(tr.families.find(f => f.key === "infra").tag, "INFRA · 1 claimed · 1 learned · of 4");
  assert.equal(k.facts.addToProfile, "Add Kubernetes to my Profile");
});

test("D116 M8 · d116LearningShowsProgressArc — some of the step done → learning, '3 of 7 in its step' (D117 C8: 3 opened + 3 explained + the build)", () => {
  const db = course();
  openO4(db, 7, ["o4-vm", "o4-docker"]); explainO4(db, 7, [0]);
  const k = bySlug(treeOf(db, 7)).get("kubernetes");
  assert.deepEqual([k.state, k.progress, k.facts.progress], ["learning", { done: 3, total: 7 }, "3 of 7 in its step"]);
});

test("D116 M8 · d116LearnedNotOnResumeUntilAdded — learned never writes the Profile; closeness keeps counting only Profile skills", () => {
  const db = course();
  const before = db.prepare(`SELECT name, source FROM profile_skills WHERE user_id = 7 ORDER BY id`).all();
  const tBefore = bySlug(treeOf(db, 7)).get("terraform").closeness;
  completeO4(db, 7);
  const tr = treeOf(db, 7);
  assert.deepEqual(db.prepare(`SELECT name, source FROM profile_skills WHERE user_id = 7 ORDER BY id`).all(), before, "the Profile is untouched");
  assert.equal(computeYourMap(db, 7).haveSkills.total, 1, "'You have' is the Profile's");
  assert.equal(bySlug(tr).get("kubernetes").have, false);
  assert.equal(bySlug(tr).get("terraform").closeness, tBefore, "closeness counts only the Profile's skills");
});

test("D116 M8 · d116UnlockRecomputesRoute — a learned node leaves the route, Next up and the sections as if the user had it", () => {
  const db = course();
  const m0 = computeYourMap(db, 7);
  assert.ok(m0.tree.route.includes("kubernetes"));
  completeO4(db, 7);
  const m1 = computeYourMap(db, 7);
  assert.ok(!m1.tree.route.includes("kubernetes"), "off the route");
  assert.notEqual(m1.tree.nextUp, "kubernetes");
  assert.ok(!m1.nextLevel.items.some(i => i.slug === "kubernetes"));
  assert.ok(!m1.adjacent.items.some(i => i.slug === "kubernetes"));
  assert.equal(m1.tree.route.length, m0.tree.route.length - 1);
});

test("D117 C8 · d116UnlockUsesC8 — M8's learned is C8's FINISHED: old ticks unlock nothing; opened + explained without the build is 'learning'; the build link finishes it and the finishing write names what it unlocked", () => {
  const db = course();
  seedCircleData(db);   // the pieces' own taught terms (C9): o4 teaches Kubernetes
  // D115's ticks on every o4 item and checkpoint — kept, and they count for nothing.
  for (const id of ["o4-vm", "o4-docker", "o4-k8s", "o4#c0", "o4#c1", "o4#c2"]) assert.ok(setMark(db, 7, id, true), id);
  let k = bySlug(treeOf(db, 7)).get("kubernetes");
  assert.deepEqual([k.state, k.learned, k.courseStep.stepId], ["not_yet", false, "o4"]);
  openO4(db, 7, ["o4-vm", "o4-docker", "o4-k8s"]); explainO4(db, 7, [0, 1, 2]);
  k = bySlug(treeOf(db, 7)).get("kubernetes");
  assert.deepEqual([k.state, k.learned, k.progress], ["learning", false, { done: 6, total: 7 }], "o4 asks for a build: not finished without it");
  const r = saveBuild(db, 7, "o4", { url: "https://github.com/example-learner/k8s-lab" });
  assert.deepEqual([r.finished, r.state.bar], [true, 100]);
  assert.ok(r.unlocked.some(u => u.slug === "kubernetes" && u.name === "Kubernetes"), "the finishing write names the nodes it unlocked (the toast's words)");
  k = bySlug(treeOf(db, 7)).get("kubernetes");
  assert.deepEqual([k.state, k.learned, k.have], ["learned", true, false]);
  assert.equal(saveBuild(db, 7, "o4", { url: "https://github.com/example-learner/k8s-lab-2" }).finished, false, "unlocked once, not on every write");
});

test("D117 C5 · 'From your map' — the user's own route: Your map's route skills → the pieces that teach them (the M8 seam), named for the aim", () => {
  const db = course();
  seedCircleData(db);
  const route = treeOf(db, 7).route;
  assert.ok(route.includes("kubernetes"));
  const r = mapRouteFor(db, 7);
  assert.equal(r.name, "From your map: senior Backend Engineer");
  assert.ok(r.targets.includes("o4") && r.skills.includes("Kubernetes"));
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (9,'synthetic9','x')").run();
  assert.deepEqual([mapRouteFor(db, 9).name, mapRouteFor(db, 9).targets], [null, []], "no map → no route");
});

test("D116 · d116TreeNoModel + one matcher — atlasTree.js reads no model and builds no matcher of its own", () => {
  const src = fs.readFileSync("services/atlas/atlasTree.js", "utf8");
  assert.doesNotMatch(src.replace(/^\s*\/\/.*$/gm, ""), /anthropic|openai|callModel|completion/i);
  assert.doesNotMatch(src, /new RegExp|\\b\$\{|matchAll\(/, "no term matching here — postingMatcher.js is the one matcher");
  assert.match(src, /import \{ postingMatcher, [^}]+\} from "\.\/atlasStats\.js"/);
  assert.doesNotMatch(src, /NEXT_LEVEL_|BRANCH_MIN_|BRANCH_TOP_REQUIRED|PER_SECTION/);
  void os; void path;
});
