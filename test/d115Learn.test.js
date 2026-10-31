// ⭐ D115 · LEARN — the owner's "From silicon to software" tracker, integrated as is. P1 (one data file) and P4(a) (its
// definitions fill the Atlas), with migration 194 (the concept / pattern kinds) and the runner's foreignKeys: "off".
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { applyPendingMigrations } from "../scripts/applyMigrations.js";
import { extractTracker, countsOf, idsOf, buildLearnFile, TRACKER_HTML, LEARN_JSON } from "../scripts/learn/extractTracker.mjs";
import { learnContent, stepsOf } from "../services/learn/learnContent.js";
import { importLearnConcepts } from "../services/atlas/atlasLearnImport.js";
import { upsertNode, setStatus } from "../services/atlas/atlasStore.js";
import { updateNode } from "../services/atlas/atlasEditor.js";
import { autoPublish, readiness, READINESS_COLUMNS } from "../services/atlas/atlasPublish.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8");
const HTML = read(TRACKER_HTML);
const LEARN = learnContent();
function fixtureDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  return db;
}
const INDEX_ONLY = (items) => ({ INDEX: items.map(([term, def, st = "s1"]) => ({ term, def, st })) });

test("D115 P1 · d115ExtractCounts — 8 parts · 28 phases · 108 steps · 373 items · 324 checkpoints · 28 patterns · 385 concepts", () => {
  const c = countsOf(extractTracker(HTML));
  assert.deepEqual([c.parts, c.phases, c.steps, c.items, c.checkpoints, c.patterns, c.concepts], [8, 28, 108, 373, 324, 28, 385]);
  assert.deepEqual(c.byKind, { Book: 47, Video: 113, Sandbox: 15, Build: 64, Course: 40, Article: 71, Project: 6, Guide: 2, Practice: 9, Atlas: 1, Playlist: 4, Lab: 1 });
  assert.equal(c.optional, 87);
  assert.equal(c.advancedSteps, 14, "the tracker's own advanced marker is lv: 'a' (Basics first hides those)");
  assert.deepEqual(LEARN.source.counts, c, "the committed file is the HTML's data");
  assert.equal(stepsOf(LEARN).length, 108);
  assert.deepEqual(stepsOf(LEARN)[0].n, 1);
});

test("D115 P1 · d115IdsStable — every id kept exactly (p1, s1, s1-code …), unique, and the committed file matches the HTML", () => {
  const ids = idsOf(LEARN);
  assert.equal(new Set(ids).size, ids.length, "no duplicate id");
  for (const id of ["p1", "s1", "s1-code", "pattern:hash"]) assert.ok(ids.includes(id), id);
  const fresh = buildLearnFile(HTML, { at: LEARN.source.extracted });
  assert.deepEqual(fresh, LEARN, "re-extracting the HTML gives the committed file (node scripts/learn/extractTracker.mjs --check)");
  assert.ok(fs.existsSync(LEARN_JSON));
  assert.match(read("scripts/learn/extractTracker.mjs"), /vm\.runInNewContext\(code, Object\.create\(null\), \{ timeout: 2000 \}\)/, "an EMPTY context: it can only build arrays");
});

test("D115 P1 · d115TextVerbatim — titles, goals, notes, checkpoints and definitions are the owner's words, byte for byte", () => {
  const s1 = LEARN.PARTS[0].phases[0].steps[0];
  assert.equal(s1.t, "Flashlights to the first CPU");
  assert.equal(s1.g, "See how on and off signals become symbols, then logic, then a processor.");
  assert.equal(s1.items[0].t, "Code: The Hidden Language of Computer Hardware and Software");
  assert.equal(s1.items[0].s, "Charles Petzold");
  // A sample straight from the HTML's source text: each must appear in it verbatim (the tracker's escapes aside).
  const unescape = (s) => s.replace(/\\'/g, "'");
  const src = unescape(HTML);
  const samples = [];
  for (const step of stepsOf(LEARN).filter((_, i) => i % 9 === 0)) samples.push(step.t, step.g, ...(step.c || []).slice(0, 1), ...(step.items || []).slice(0, 1).map(i => i.n).filter(Boolean));
  for (const t of LEARN.INDEX.filter((_, i) => i % 40 === 0)) samples.push(t.def);
  assert.ok(samples.length > 30);
  for (const s of samples) assert.ok(src.includes(s), `not verbatim: ${s.slice(0, 60)}`);
  assert.ok(LEARN.INDEX.some(t => t.term === "Bit" && t.def === "The smallest unit of information: one yes or no, a 1 or a 0."));
});

test("D115 · d115LinksOnly — every item is a LINK (an https URL), nothing of the sources is copied in", () => {
  const items = stepsOf(LEARN).flatMap(s => s.items || []);
  // A "Build" (make it yourself) and the in-page "Atlas" item carry no link at all — measured: 37 + 1 of the 373.
  const linkless = items.filter(it => !it.u);
  assert.deepEqual([...new Set(linkless.map(it => it.k))].sort(), ["Atlas", "Build"]);
  for (const it of items.filter(it => it.u)) assert.match(String(it.u), /^https:\/\//, `${it.id}: ${it.u}`);
  const longest = Math.max(...items.map(it => String(it.n || "").length));
  assert.ok(longest < 600, `an item's note is the owner's line about the source, not the source (${longest} chars)`);
  for (const p of LEARN.ATLAS) for (const [, slug] of p.pr || []) assert.match(String(slug), /^[a-z0-9-]+$/, "LeetCode problems by slug — a link");
});

test("D115 P4a · d115IndexFillsEmptyDefinitionsOnly — an empty definition is filled as the owner's; a person's, an accepted or a drafted one never", () => {
  const db = fixtureDb();
  for (const n of ["Kubernetes", "Git", "Linux", "Swift", "CUDA"]) upsertNode(db, { kind: "tool", name: n, source: "registry" });
  updateNode(db, "git", { definition: "Version control, in the curator's words." });
  db.prepare(`UPDATE atlas_nodes SET definition_draft = 'A drafted one.', definition_by = 'drafted' WHERE slug = 'linux'`).run();
  const r = importLearnConcepts(db, INDEX_ONLY([["Kubernetes", "Runs containers across machines."], ["Git", "The tracker's Git."], ["Linux", "The tracker's Linux."],
    ["SWIFT", "The banks' messaging network."], ["Logic gate", "A tiny circuit that outputs 1 or 0."], ["CUDA (Nvidia)", "Nvidia's GPU programming model."]]));
  assert.deepEqual(r.filled.sort(), ["cuda", "kubernetes"], "CUDA through its bare name");
  assert.deepEqual(r.kept.sort(), ["git", "linux"]);
  assert.deepEqual(r.created, ["logic-gate"]);
  assert.deepEqual(r.skipped, [{ term: "SWIFT", why: "an ambiguous word (the scorer's list)" }], "never the Swift language");
  const row = (s) => db.prepare(`SELECT kind, definition, definition_by, definition_draft, status, source FROM atlas_nodes WHERE slug = ?`).get(s);
  assert.deepEqual(row("kubernetes"), { kind: "tool", definition: "Runs containers across machines.", definition_by: "owner", definition_draft: null, status: "draft", source: "registry" });
  assert.equal(row("git").definition, "Version control, in the curator's words.");
  assert.deepEqual([row("linux").definition, row("linux").definition_draft], [null, "A drafted one."]);
  assert.deepEqual(row("logic-gate"), { kind: "concept", definition: "A tiny circuit that outputs 1 or 0.", definition_by: "owner", definition_draft: null, status: "draft", source: "learn" });
  assert.equal(row("swift").definition, null);
  // Idempotent.
  const again = importLearnConcepts(db, INDEX_ONLY([["Kubernetes", "x"], ["Logic gate", "y"]]));
  assert.deepEqual([again.filled, again.created], [[], []]);
  // A slug that is a DIFFERENT node already is reported, never written onto it.
  upsertNode(db, { kind: "role", name: "Compiler", source: "registry" });
  db.prepare(`UPDATE atlas_nodes SET term = 'compiler engineer', name = 'Compiler Engineer' WHERE slug = 'compiler'`).run();   // renamed; its slug stays
  const clash = importLearnConcepts(db, INDEX_ONLY([["Compiler", "Turns code into machine code."]]));
  assert.deepEqual(clash.skipped, [{ term: "Compiler", why: `its slug is already the role "compiler"` }]);
  // The real file: all 385 handled, none twice.
  const real = importLearnConcepts(fixtureDb(), LEARN);
  assert.equal(real.filled.length + real.created.length + real.kept.length + real.skipped.length, 385);
  assert.match(read("server.js"), /const r = importLearnConcepts\(db, learnContent\(db\)\);/, "at boot, after the registry seed — from the DATABASE's content (D118 P2)");
});

test("D115 P4a · a CONCEPT is never published by the board's count (measured false friends); it is published by hand", () => {
  const db = fixtureDb();
  importLearnConcepts(db, INDEX_ONLY([["CDN", "Servers near users that cache content."], ["Attention", "How a transformer weighs the words it reads."]]));
  for (const s of ["cdn", "attention"]) {
    const id = db.prepare(`SELECT id FROM atlas_nodes WHERE slug = ?`).pluck().get(s);
    db.prepare(`INSERT INTO atlas_node_stats (node_id, postings, computed_at) VALUES (?, 564, 1)`).run(id);
  }
  assert.deepEqual(autoPublish(db).published, [], "564 'postings' and the owner's definition: still a draft");
  const rd = readiness(db.prepare(`SELECT ${READINESS_COLUMNS} FROM atlas_nodes n LEFT JOIN atlas_node_stats s ON s.node_id = n.id WHERE n.slug = 'cdn'`).get());
  assert.deepEqual(rd.missing, ["a concept — published by hand (the board's word count is not its demand)"]);
  setStatus(db, "cdn", "published", "curator@example.test");
  assert.equal(db.prepare(`SELECT status FROM atlas_nodes WHERE slug = 'cdn'`).pluck().get(), "published", "by hand it publishes");
});

test("D115 · migration 194 rebuilds atlas_nodes with the two kinds and KEEPS every edge, stat, summary and resource (foreignKeys: off)", () => {
  const upTo = MIGRATIONS.findIndex(m => m.id === "194_atlas_concept_pattern_kinds");
  const m194 = MIGRATIONS[upTo];
  assert.equal(m194.foreignKeys, "off");
  const build = () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    db.exec("CREATE TABLE schema_migrations (id TEXT PRIMARY KEY, applied_at INTEGER)");
    applyPendingMigrations(db, MIGRATIONS.slice(0, upTo));
    const a = upsertNode(db, { kind: "tool", name: "Kubernetes" }).id, b = upsertNode(db, { kind: "tool", name: "Helm" }).id;
    db.prepare(`INSERT INTO atlas_edges (from_id, to_id, type, source) VALUES (?, ?, 'used_with', 'owner')`).run(a, b);
    db.prepare(`INSERT INTO atlas_node_stats (node_id, postings, computed_at) VALUES (?, 9, 1)`).run(a);
    db.prepare(`INSERT INTO atlas_wiki_cache (node_id, title, extract, page_url, fetched_at) VALUES (?, 'K', 'x', 'https://e/k', 1)`).run(a);
    db.prepare(`INSERT INTO atlas_resources (node_id, url, title, source) VALUES (?, 'https://e/r', 'r', 'owner')`).run(b);
    return db;
  };
  const counts = (db) => ["atlas_nodes", "atlas_edges", "atlas_node_stats", "atlas_wiki_cache", "atlas_resources"].map(t => db.prepare(`SELECT COUNT(*) FROM ${t}`).pluck().get());
  const db = build();
  const before = counts(db);
  applyPendingMigrations(db, [m194]);
  assert.deepEqual(counts(db), before, "nothing lost");
  assert.equal(db.pragma("foreign_keys", { simple: true }), 1, "foreign keys restored");
  assert.deepEqual(db.pragma("foreign_key_check"), []);
  db.prepare(`INSERT INTO atlas_nodes (slug, kind, name, term, source) VALUES ('logic-gate', 'concept', 'Logic gate', 'logic gate', 'learn')`).run();
  db.prepare(`INSERT INTO atlas_nodes (slug, kind, name, term, source) VALUES ('two-pointers', 'pattern', 'Two pointers', 'two pointers', 'learn')`).run();
  assert.throws(() => db.prepare(`INSERT INTO atlas_nodes (slug, kind, name, term, source) VALUES ('x', 'bogus', 'X', 'x', 'learn')`).run(), /CHECK/);
  // The CONTROL: the same SQL with foreign keys left on is the defect it guards against.
  const bad = build();
  applyPendingMigrations(bad, [{ ...m194, id: "194_control", foreignKeys: undefined }]);
  assert.deepEqual(counts(bad).slice(1), [0, 0, 0, 0], "with foreign keys on, the DROP cascades — why the flag exists");
  // A broken reference rolls the migration back.
  const rb = build();
  rb.pragma("foreign_keys = OFF");
  rb.prepare(`INSERT INTO atlas_edges (from_id, to_id, type, source) VALUES (999, 998, 'used_with', 'owner')`).run();
  rb.pragma("foreign_keys = ON");
  assert.throws(() => applyPendingMigrations(rb, [m194]), /foreign key check failed/);
  assert.equal(rb.prepare(`SELECT COUNT(*) FROM schema_migrations WHERE id = ?`).pluck().get(m194.id), 0, "not recorded: it runs again after the fix");
  assert.equal(rb.pragma("foreign_keys", { simple: true }), 1);
  // Backed up first in production.
  assert.match(read("server.js"), /\{ id: "194_atlas_concept_pattern_kinds", changes: "SELECT 1 FROM atlas_nodes LIMIT 1" \}/);
});

// ── P2–P4 ────────────────────────────────────────────────────────────────────────────────────────────
import express from "express";
import { createLearnRouter } from "../routes/learn.js";
import { createAtlasRouter } from "../routes/atlas.js";
import { importLearnPatterns, learnStepForNode } from "../services/learn/learnLinks.js";
import { publishLearnConcepts, LEARN_PUBLISHER } from "../services/atlas/atlasLearnImport.js";
import { stepState, nextStep, flatSteps, readLocal, writeLocal, localAsImport, LOCAL_KEY, searchConcepts } from "../client/src/pages/atlas/learnModel.js";

async function serve(db, user = null) {
  const app = express();
  app.use(express.json());
  const requireAuth = (req, res, next) => (user ? (req.user = user, next()) : res.status(401).json({ error: "unauthorized" }));
  app.use("/api/learn", createLearnRouter(db, { requireAuth }));
  app.use("/api/atlas", createAtlasRouter(db));
  const srv = app.listen(0);
  await new Promise(r => srv.once("listening", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const call = async (method, p, body) => { const r = await fetch(base + p, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, json: await r.json().catch(() => null) }; };
  return { call, close: () => new Promise(r => srv.close(r)) };
}
const usersDb = () => { const db = fixtureDb(); db.prepare(`INSERT INTO users (id, username, password_hash) VALUES (7, 'learner@example.test', 'x')`).run(); return db; };

test("D115 P3 · d115ProgressServerWhenSignedIn — marks follow the account: set, read back, cleared; unknown ids refused; the browser's are offered once", async () => {
  const db = usersDb();
  const s = await serve(db, { id: 7 });
  try {
    assert.equal((await s.call("GET", "/api/learn/")).json.INDEX.length, 385, "the content is public");
    assert.deepEqual((await s.call("PUT", "/api/learn/progress", { id: "s1-code", on: true })).json, { ok: true });
    assert.equal((await s.call("PUT", "/api/learn/progress", { id: "s1#c0", on: true })).status, 200);
    assert.equal((await s.call("PUT", "/api/learn/progress", { id: "no-such-item", on: true })).status, 404);
    assert.equal((await s.call("PUT", "/api/learn/progress", { id: "s1-code" })).status, 400);
    const marks = (await s.call("GET", "/api/learn/progress")).json.marks;
    assert.deepEqual(marks.map(m => [m.id, m.state]).sort(), [["s1#c0", "explained"], ["s1-code", "done"]]);
    // The browser's marks on sign-in: added where the account has none, the account's own date wins, junk dropped.
    const imp = await s.call("POST", "/api/learn/progress/import", { marks: [{ id: "s1-code", at: 1 }, { id: "s2#c0", at: 5 }, { id: "bogus", at: 5 }] });
    assert.deepEqual([imp.json.added, imp.json.ignored], [1, 1]);
    assert.notEqual(db.prepare(`SELECT at FROM learn_progress WHERE mark_id = 's1-code'`).pluck().get(), 1, "the account's mark kept its date");
    await s.call("PUT", "/api/learn/progress", { id: "s1-code", on: false });
    assert.equal(db.prepare(`SELECT COUNT(*) FROM learn_progress WHERE mark_id = 's1-code'`).pluck().get(), 0);
  } finally { await s.close(); }
  const anon = await serve(db, null);
  try { assert.equal((await anon.call("GET", "/api/learn/progress")).status, 401, "signed out: no account progress"); } finally { await anon.close(); }
  assert.match(read("services/accountService.js"), /learn_progress: "keepInto",/, "a merged account keeps its progress");
});

test("D115 P3 · d115LocalWhenSignedOut — the browser keeps the marks (guarded: blocked storage reads as none), and they become an import on sign-in", () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  assert.deepEqual(readLocal(storage), {});
  assert.equal(writeLocal({ "s1-code": 100, "s1#c0": 200 }, storage), true);
  assert.deepEqual(JSON.parse(store.get(LOCAL_KEY)), { "s1-code": 100, "s1#c0": 200 });
  assert.deepEqual(localAsImport(readLocal(storage)), [{ id: "s1-code", at: 100 }, { id: "s1#c0", at: 200 }]);
  const blocked = { getItem: () => { throw new Error("SecurityError"); }, setItem: () => { throw new Error("QuotaExceeded"); } };
  assert.deepEqual(readLocal(blocked), {});
  assert.equal(writeLocal({ a: 1 }, blocked), false);
  store.set(LOCAL_KEY, "not json"); assert.deepEqual(readLocal(storage), {});
  // The rules the grid and Up next read.
  const steps = flatSteps(LEARN);
  const s1 = steps[0];
  const all = Object.fromEntries([...s1.items.filter(i => !i.o).map(i => [i.id, 1]), ...s1.c.map((_, i) => [`s1#c${i}`, 1])]);
  assert.equal(stepState(s1, all).complete, true);
  assert.equal(stepState(s1, { [s1.items[0].id]: 1 }).started, true);
  assert.equal(nextStep(steps, all).id, steps[1].id);
  const firstAdv = steps.find(s => s.lv === "a");
  assert.notEqual(nextStep(steps.filter(s => s.n >= firstAdv.n), {}, { basicsOnly: true }).lv, "a", "Basics first skips advanced steps");
  const view = read("client/src/pages/atlas/LearnView.jsx");
  assert.match(view, /if \(signedIn\) api\("\/api\/learn\/progress", \{ method: "PUT"/);
  assert.match(view, /else if \(!writeLocal\(next\)\) setSaved\("unsaved"\);/);
  assert.match(view, /await api\("\/api\/learn\/progress\/import", \{ method: "POST", body: JSON\.stringify\(\{ marks: localAsImport\(local\) \}\) \}\); clearLocal\(\);/);
  assert.match(read("client/src/pages/atlas/AtlasPage.jsx"), /\{learning && <LearnView signedIn=\{base\.startsWith\("\/app"\)\} \/>\}/);
  // The Concepts view's search is the one normaliser.
  assert.equal(searchConcepts(LEARN.INDEX, "logic gates")[0].term, "Logic gate");
});

test("D115 P4b · d115StepLinkOnNode — a node the path teaches carries 'Learn it: Part … · … · Step n', first in its Resources", async () => {
  const db = fixtureDb();
  upsertNode(db, { kind: "tool", name: "Kubernetes", source: "registry" });
  setStatus(db, "kubernetes", "published");
  const st = learnStepForNode(db, { name: "Kubernetes", term: "kubernetes" });
  assert.match(st.label, /^Part \d · .+ · Step \d+$/);
  assert.equal(LEARN.INDEX.find(t => t.term === "Kubernetes").st, st.stepId, "the step the owner's index names");
  const s = await serve(db);
  try {
    const node = (await s.call("GET", "/api/atlas/node/kubernetes")).json;
    assert.deepEqual(node.learn, st);
    assert.equal((await s.call("GET", "/api/atlas/peek/kubernetes")).json.learnStep.stepId, st.stepId, "D114's popup goes to the step");
  } finally { await s.close(); }
  const page = read("client/src/pages/atlas/AtlasPage.jsx");
  const res = page.slice(at(page, '<h2 className="atl__h2" id="atl-res">Resources</h2>'));
  assert.ok(res.indexOf("node.learn &&") < res.indexOf("resources.map(r =>"), "above Wikidata's links");
  assert.match(res, /Learn it: \{node\.learn\.label\}/);
  assert.equal(learnStepForNode(db, { name: "Zzqx", term: "zzqx" }), null);
});

test("D115 P4c · d115PatternNodes — the 28 patterns are pattern nodes with LeetCode practice links; concepts of the same name are promoted, not duplicated", () => {
  const db = fixtureDb();
  importLearnConcepts(db, LEARN);
  const r = importLearnPatterns(db, LEARN);
  assert.equal(r.created.length + r.promoted.length, 28);
  assert.deepEqual(r.promoted.sort(), ["backtracking", "binary-search", "divide-and-conquer", "dynamic-programming"]);
  assert.equal(db.prepare(`SELECT COUNT(*) FROM atlas_nodes WHERE kind = 'pattern'`).pluck().get(), 28);
  const res = db.prepare(`SELECT r.url, r.format, r.cost, r.source FROM atlas_resources r JOIN atlas_nodes n ON n.id = r.node_id WHERE n.kind = 'pattern'`).all();
  assert.equal(res.length, LEARN.ATLAS.reduce((n, p) => n + (p.pr || []).length, 0));
  assert.ok(res.every(x => /^https:\/\/leetcode\.com\/problems\/[a-z0-9-]+\/$/.test(x.url) && x.format === "practice" && x.cost === "free" && x.source === "learn"));
  assert.ok(r.edges > 0);
  const arrays = db.prepare(`SELECT m.name FROM atlas_edges e JOIN atlas_nodes n ON n.id = e.from_id JOIN atlas_nodes m ON m.id = e.to_id WHERE n.slug = 'arrays-and-hashing'`).pluck().all();
  assert.ok(arrays.includes("Array"), arrays.join(", "));
  assert.deepEqual(importLearnPatterns(db, LEARN), { created: [], promoted: [], resources: 0, edges: 0 }, "idempotent");
  assert.match(read("server.js"), /const p = importLearnPatterns\(db, learnContent\(db\)\);/);
});

test("D115 · the 373 concepts are published as learning pages (owner 10-31) — a person's un-publish sticks", () => {
  const db = fixtureDb();
  importLearnConcepts(db, LEARN);
  setStatus(db, "logic-gate", "published"); setStatus(db, "logic-gate", "draft", "curator@example.test");   // a person unpublished it
  const r = publishLearnConcepts(db, { now: 1_900_000_000 });
  const concepts = db.prepare(`SELECT COUNT(*) FROM atlas_nodes WHERE kind = 'concept'`).pluck().get();
  assert.equal(r.published, concepts - 1, "every concept less the one a person unpublished");
  assert.equal(db.prepare(`SELECT status FROM atlas_nodes WHERE slug = 'logic-gate'`).pluck().get(), "draft");
  assert.deepEqual(db.prepare(`SELECT DISTINCT published_by FROM atlas_nodes WHERE kind = 'concept' AND status = 'published'`).pluck().all(), [LEARN_PUBLISHER]);
  assert.equal(publishLearnConcepts(db).published, 0, "idempotent");
  assert.match(read("server.js"), /const pub = publishLearnConcepts\(db\);/);
});

test("D115 · d115FourThemes — Learn draws in draft's tokens only; its squares are rounded squares, never capsules", () => {
  const css = read("client/src/pages/atlas/LearnView.css").replace(/\r\n/g, "\n");
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i, "no colour literal");
  assert.doesNotMatch(css, /999px|border-radius:\s*50%/, "no capsule, no circle on a square");
  assert.match(css, /\.lrn__cell \{\n  width: 16px; height: 16px; padding: 0; border-radius: 4px;/);
  for (const tok of ["--c-accent", "--c-border", "--c-surface-solid", "--c-ink"]) assert.ok(css.includes(`var(${tok})`), tok);
});
