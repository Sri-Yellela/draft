import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { upsertNode, readNode } from "../services/atlas/atlasStore.js";
import { updateNode } from "../services/atlas/atlasEditor.js";
import { autoPublish } from "../services/atlas/atlasPublish.js";
import { exportForDrafting, importDrafted, draftedDefinitions, acceptDraft, rejectDraft, acceptAllDrafts, DEFINITION_INSTRUCTIONS,
  DEFINITION_EXPORT_MAX } from "../services/atlas/atlasDefinitions.js";

// ⭐ D105 P11 (owner 10-31, "yes to all three") — model-drafted definitions the owner reviews, with no model call from
// draft: export → the owner's chat → import as drafts → Accept · Edit · Reject. Synthetic nodes only.

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
function fixtureDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  return db;
}
const stats = (db, slug, postings, top = []) => {
  const id = db.prepare(`SELECT id FROM atlas_nodes WHERE slug = ?`).pluck().get(slug);
  db.prepare(`INSERT OR REPLACE INTO atlas_node_stats (node_id, postings, top_skills_json, computed_at) VALUES (?,?,?,1)`).run(id, postings, JSON.stringify(top));
};
const node = (db, slug) => db.prepare(`SELECT status, definition, definition_draft, definition_by FROM atlas_nodes WHERE slug = ?`).get(slug);
const GOOD = "Terraform is an infrastructure-as-code tool. Teams use it to describe cloud resources in files and apply the changes safely.";

test("D105 P11 · d105DraftedNeverPublishes — an imported definition waits as a draft: not public, not counted by the bar", () => {
  const db = fixtureDb();
  upsertNode(db, { kind: "tool", name: "Terraform", source: "registry" });
  stats(db, "terraform", 40, [{ slug: "aws", name: "AWS", postings: 30 }, { slug: "k8s", name: "Kubernetes", postings: 20 }]);
  const ex = exportForDrafting(db);
  assert.deepEqual(ex.nodes, [{ slug: "terraform", name: "Terraform", kind: "tool", postings: 40, seenWith: ["AWS", "Kubernetes"] }]);
  assert.ok(ex.text.startsWith(DEFINITION_INSTRUCTIONS));
  for (const rule of [/One or two plain sentences: what it is, and what it is used for at work/, /No marketing, no claims about popularity/,
    /Do not copy text/, /No links/]) assert.match(DEFINITION_INSTRUCTIONS, rule);
  assert.deepEqual(importDrafted(db, JSON.stringify({ definitions: [{ slug: "terraform", definition: GOOD }] })), { ok: true, drafted: 1 });
  assert.deepEqual(node(db, "terraform"), { status: "draft", definition: null, definition_draft: GOOD, definition_by: "drafted" });
  assert.deepEqual(autoPublish(db).published, [], "40 postings and a draft is NOT the bar");
  db.prepare(`UPDATE atlas_nodes SET status = 'published' WHERE slug = 'terraform'`).run();
  assert.equal(readNode(db, "terraform").definition, null, "the public page never shows a draft");
  db.prepare(`UPDATE atlas_nodes SET status = 'draft' WHERE slug = 'terraform'`).run();
  assert.equal(exportForDrafting(db).nodes.length, 0, "a node with a draft waiting is not exported again");
  assert.deepEqual(draftedDefinitions(db).map(d => [d.slug, d.draft]), [["terraform", GOOD]]);
  assert.equal(rejectDraft(db, "terraform"), true);
  assert.deepEqual(node(db, "terraform"), { status: "draft", definition: null, definition_draft: null, definition_by: null });
  assert.equal(exportForDrafting(db).nodes.length, 1, "rejected: exported again next time");
});

test("D105 P11 · d105AcceptPublishesIfBar — accepting (as written or edited) makes it the definition, by the owner, and publishes when the bar is met", () => {
  const db = fixtureDb();
  upsertNode(db, { kind: "tool", name: "Terraform", source: "registry" });
  upsertNode(db, { kind: "tool", name: "Nomad", source: "registry" });
  stats(db, "terraform", 40); stats(db, "nomad", 2);
  importDrafted(db, { definitions: [{ slug: "terraform", definition: GOOD }, { slug: "nomad", definition: "Nomad is a workload scheduler. Teams use it to run jobs across machines." }] });
  const r = acceptDraft(db, "terraform", { definition: "Terraform describes cloud infrastructure as code. Teams apply it to change resources safely." }, "curator@example.test");
  assert.deepEqual(r.published, ["terraform"]);
  assert.deepEqual(node(db, "terraform"), { status: "published", definition: "Terraform describes cloud infrastructure as code. Teams apply it to change resources safely.",
    definition_draft: null, definition_by: "owner" });
  const all = acceptAllDrafts(db, ["nomad"]);
  assert.deepEqual(all, { accepted: 1, published: [] }, "2 postings: accepted, still under the bar");
  assert.equal(node(db, "nomad").status, "draft");
  assert.equal(acceptDraft(db, "nomad"), null, "nothing left to accept");
  // A definition the curator types in the editor is the owner's too (192 marks the ones already there).
  upsertNode(db, { kind: "skill", name: "Observability", source: "registry" });
  updateNode(db, "observability", { definition: "Seeing what a running system does from its outputs." });
  assert.equal(node(db, "observability").definition_by, "owner");
  assert.match(read("scripts/migrations.js"), /id: "192_atlas_definition_draft",[\s\S]*?UPDATE atlas_nodes SET definition_by = 'owner' WHERE TRIM\(COALESCE\(definition, ''\)\) != '';/);
});

test("D105 P11 · d105DraftImportValidates — one bad row refuses the whole file and names every problem", () => {
  const db = fixtureDb();
  for (const n of ["Terraform", "Kafka", "Redis", "Helm", "Envoy"]) upsertNode(db, { kind: "tool", name: n, source: "registry" });
  updateNode(db, "redis", { definition: "An in-memory data store." });
  const bad = importDrafted(db, "```json\n" + JSON.stringify({ definitions: [
    { slug: "terraform", definition: GOOD },
    { slug: "nope", definition: GOOD },
    { slug: "kafka", definition: "x".repeat(401) },
    { slug: "redis", definition: GOOD },
    { slug: "helm", definition: "Helm packages Kubernetes apps. It installs charts. It upgrades them." },
    { slug: "envoy", definition: "Envoy is a proxy; see https://envoyproxy.io for details." },
    { slug: "terraform", definition: GOOD },
  ] }) + "\n```");
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.errors, [
    { slug: "nope", reason: "unknown slug" },
    { slug: "kafka", reason: "longer than 400 characters" },
    { slug: "redis", reason: "already has a definition" },
    { slug: "helm", reason: "more than two sentences" },
    { slug: "envoy", reason: "contains a link" },
    { slug: "terraform", reason: "duplicate slug" },
  ]);
  assert.equal(db.prepare(`SELECT COUNT(*) FROM atlas_nodes WHERE definition_draft IS NOT NULL`).pluck().get(), 0, "all or nothing");
  assert.deepEqual(importDrafted(db, "not json").errors, [{ slug: null, reason: "not JSON" }]);
  assert.equal(importDrafted(db, { definitions: Array.from({ length: DEFINITION_EXPORT_MAX + 1 }, () => ({ slug: "terraform", definition: GOOD })) }).ok, false);
  assert.deepEqual(importDrafted(db, { definitions: [{ slug: "terraform", definition: "Too short." }] }).errors, [{ slug: "terraform", reason: "too short" }]);
});

test("D105 P11 · d105NoModelCall — draft drafts nothing itself: no model client in the module, the route or the panel; the owner pastes", () => {
  for (const p of ["services/atlas/atlasDefinitions.js", "routes/atlas.js", "client/src/panels/adminAtlas.jsx"]) {
    const src = read(p);
    assert.doesNotMatch(src, /@anthropic-ai\/sdk|callModel|anthropicModels|openai/i, p);
  }
  const panel = read("client/src/panels/adminAtlas.jsx");
  assert.match(panel, /1\. Copy this into a Claude chat\. 2\. Paste its JSON answer below\. Nothing is public until you accept it\./);
  assert.match(panel, /data-atlas-def-accept-all="">Accept all as written<\/DepthButton>/);
  const route = read("routes/atlas.js");
  assert.match(route, /router\.post\("\/definitions\/import", \(req, res\) => \{/);
  assert.ok(route.indexOf(`router.post("/definitions/accept-all"`) < route.indexOf(`router.post("/definitions/:slug/accept"`), "accept-all is not read as a slug");
});
