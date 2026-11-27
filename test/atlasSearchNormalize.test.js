// ⭐ BUG 10-31 (owner: "the search is not normalised") — ONE normaliser for the Atlas search, the Learn concept search
// (D115) and D114's matcher. Synthetic nodes; the search through its real store.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { upsertNode, setStatus, addAlias, searchNodes } from "../services/atlas/atlasStore.js";
import { searchKey, searchWords, editDistance, typoAllowance, matchCandidate, spellings, foldChars } from "../shared/atlasSearchNormalize.js";
import { linkSegments } from "../shared/atlasLinks.js";
import { formsOf } from "../services/atlas/atlasLinks.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
function atlas() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  const add = (kind, name, extra = {}) => { const n = upsertNode(db, { kind, name, source: "registry", ...extra });
    const slug = db.prepare(`SELECT slug FROM atlas_nodes WHERE id = ?`).pluck().get(n.id); setStatus(db, slug, "published"); return { id: n.id, slug }; };
  const k8s = add("tool", "Kubernetes", { definition: "Runs containers across many machines." });
  add("tool", "Node.js"); add("skill", "CI/CD"); add("tool", "C++"); add("tool", "C#"); add("tool", ".NET");
  add("skill", "API design"); add("tool", "Go"); add("skill", "Machine learning"); add("tool", "Kafka");
  add("skill", "Databases", { definition: "Storing data so it can be queried." });
  add("tool", "Helm", { definition: "Packages Kubernetes apps as charts." });
  const ml = db.prepare(`SELECT id FROM atlas_nodes WHERE slug = 'machine-learning'`).pluck().get();
  addAlias(db, k8s.id, "k8s"); addAlias(db, ml, "ml");
  return db;
}
const top = (db, q) => searchNodes(db, q)[0] || null;

test("BUG 10-31 · atlasSearchCase — case and accents do not matter", () => {
  const db = atlas();
  for (const q of ["kubernetes", "KUBERNETES", "KuBeRnEtEs"]) assert.equal(top(db, q)?.slug, "kubernetes", q);
  assert.equal(searchKey("Résumé"), searchKey("resume"));
  assert.equal(foldChars("Résumé"), "resume", "char for char, so a match maps back onto the text");
  assert.equal(foldChars("Résumé").length, "Résumé".length);
});

test("BUG 10-31 · atlasSearchPunctuation — c++ · c# · .net · node.js = nodejs = node js · ci/cd = cicd = ci cd", () => {
  assert.equal(searchKey("C++"), "cpp");
  assert.equal(searchKey("c#"), "csharp");
  assert.equal(searchKey(".NET"), "dotnet");
  assert.equal(searchKey("node.js"), searchKey("nodejs")); assert.equal(searchKey("nodejs"), searchKey("node js"));
  assert.equal(searchKey("ci/cd"), searchKey("cicd")); assert.equal(searchKey("cicd"), searchKey("ci cd"));
  const db = atlas();
  for (const [q, slug] of [["c++", "c-plus-plus"], ["cpp", "c-plus-plus"], ["c#", "c-sharp"], ["csharp", "c-sharp"], [".net", "net"], ["dotnet", "net"],
    ["nodejs", "node-js"], ["node js", "node-js"], ["Node.JS", "node-js"], ["cicd", "ci-cd"], ["ci cd", "ci-cd"], ["CI/CD", "ci-cd"]]) {
    const hit = top(db, q);
    assert.ok(hit, q);
    assert.equal(db.prepare(`SELECT name FROM atlas_nodes WHERE slug = ?`).pluck().get(hit.slug) !== null, true);
    assert.equal(searchKey(hit.name), searchKey(q), `${q} → ${hit.name}`);
    assert.equal(hit.via, "name", q);
  }
  // …and D114's matcher in a posting: the separator spellings link too.
  const terms = [{ slug: "node-js", forms: formsOf({ name: "Node.js", term: "node js" }) }];
  assert.deepEqual(spellings("Node.js"), ["Node.js", "Nodejs", "Node js"]);
  assert.deepEqual(linkSegments("We write NodeJS services.", terms).filter(s => s.slug).map(s => s.text), ["NodeJS"]);
});

test("BUG 10-31 · atlasSearchPlural — apis → api, databases → database (both sides, consistently)", () => {
  assert.deepEqual(searchWords("APIs"), ["api"]);
  assert.equal(searchKey("databases"), searchKey("database"));
  assert.equal(searchKey("Kubernetes"), searchKey("kubernetes"));
  assert.deepEqual(searchWords("class bus analysis"), ["class", "bus", "analysis"], "ss / us / is are not plurals");
  const db = atlas();
  assert.equal(top(db, "database")?.slug, "databases");
  assert.equal(top(db, "apis")?.slug, "api-design", "a prefix of a word, after the plural");
});

// ⛔ 47m (changed on purpose): "BUG 10-31 · atlasSearchAlias — k8s → Kubernetes, ml → machine learning, through " retired — the surface it pinned was rebuilt in the plate system (47m M5).

test("BUG 10-31 · atlasSearchPrefix — from two characters; one letter asks nothing", () => {
  const db = atlas();
  assert.equal(top(db, "ku")?.slug, "kubernetes");
  assert.equal(top(db, "kube")?.via, "prefix");
  assert.equal(top(db, "mach")?.slug, "machine-learning");
  assert.equal(top(db, "machine lea")?.slug, "machine-learning", "several words");
  assert.deepEqual(searchNodes(db, "k"), []);
});

test("BUG 10-31 · atlasSearchTypo — \"kuberntes\" → Kubernetes; distance 1 for 5–8 characters, 2 above; \"go\" never fuzzes", () => {
  const db = atlas();
  const hit = top(db, "kuberntes");
  assert.deepEqual([hit.slug, hit.via, hit.why], ["kubernetes", "typo", "kuberntes → Kubernetes"]);
  assert.equal(top(db, "kafak")?.slug, "kafka", "5 characters: one typo");
  assert.deepEqual([typoAllowance("go"), typoAllowance("kafka"), typoAllowance("postgres"), typoAllowance("kubernetes")], [0, 1, 1, 2]);
  assert.equal(searchNodes(db, "gp").length, 0, "\"gp\" is not \"go\"");
  assert.equal(searchNodes(db, "ko").length, 0);
  assert.equal(editDistance("kubernete", "kuberntes", 2), 2);
  assert.equal(matchCandidate("kfk", { name: "Kafka" }), null, "3 characters: no typos");
});

test("BUG 10-31 · atlasSearchRanking — exact name → alias → prefix → typo → a match in a definition", () => {
  const db = atlas();
  const r = searchNodes(db, "kubernetes");
  assert.deepEqual(r.map(x => [x.slug, x.via]), [["kubernetes", "name"], ["helm", "definition"]], "Helm's definition mentions it — last");
  assert.deepEqual(searchNodes(db, "containers").map(x => [x.slug, x.via, x.why]), [["kubernetes", "definition", "in its definition"]]);
  const order = ["name", "alias", "prefix", "typo", "definition"];
  const mixed = [matchCandidate("go", { name: "Go" }), matchCandidate("k8s", { name: "Kubernetes", aliases: ["k8s"] }), matchCandidate("kub", { name: "Kubernetes" }),
    matchCandidate("kubrenetes", { name: "Kubernetes" }), matchCandidate("machines", { name: "Kubernetes", definition: "Runs on many machines." })];
  assert.deepEqual(mixed.map(m => m.via), order);
  assert.deepEqual(mixed.map(m => m.rank), [0, 1, 2, 3, 4]);
});

test("BUG 10-31 · atlasSearchOneNormaliser — the Atlas search and D114's matcher import the same module (the Learn concept search joins it with D115)", () => {
  const users = ["services/atlas/atlasStore.js", "shared/atlasLinks.js", "services/atlas/atlasLinks.js"];
  for (const p of users) assert.match(read(p), /from "(?:\.\.\/\.\.\/shared|\.)\/atlasSearchNormalize\.js";/, p);
  assert.doesNotMatch(read("services/atlas/atlasStore.js").slice(read("services/atlas/atlasStore.js").indexOf("export function searchNodes")), /LIKE \?/, "no second matcher left in the search");
});
