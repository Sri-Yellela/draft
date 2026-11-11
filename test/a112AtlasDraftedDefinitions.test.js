import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { upsertNode, readNode } from "../services/atlas/atlasStore.js";
import { autoPublish } from "../services/atlas/atlasPublish.js";
import { unpublishDefinition, seedDraftedDefinitions, readDraftedFile, textRefusal, rejectDraft, acceptDraft, draftedDefinitions,
  DRAFTED_FILE } from "../services/atlas/atlasDefinitions.js";
import { readFamilyMapping } from "../services/atlas/atlasFamilies.js";
import { isFamily } from "../shared/atlasFamilies.js";

// ⭐ A112/Atlas (11-03) — the agent's drafted definitions for the non-computing families go in as DRAFTS the owner
// reviews (D105 P11's road), offered once per slug. Synthetic nodes only.

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
function fixtureDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  return db;
}
const node = (db, slug) => db.prepare(`SELECT status, definition, definition_draft, definition_by FROM atlas_nodes WHERE slug = ?`).get(slug);
const stats = (db, slug, postings) => {
  const id = db.prepare(`SELECT id FROM atlas_nodes WHERE slug = ?`).pluck().get(slug);
  db.prepare(`INSERT OR REPLACE INTO atlas_node_stats (node_id, postings, top_skills_json, computed_at) VALUES (?,?,'[]',1)`).run(id, postings);
};
const PROSPECTING = "Finding and researching potential customers who fit the company's target profile. It fills the top of the sales pipeline.";

test("A112/Atlas · draftedFileObeysImportRules — every definition in the file passes the chat import's rules, under a real family", () => {
  const raw = JSON.parse(fs.readFileSync(DRAFTED_FILE, "utf8"));
  for (const fam of Object.keys(raw.definitions)) assert.ok(isFamily(fam), `${fam} is a family`);
  const defs = readDraftedFile();
  assert.ok(defs.size >= 200, `batch 1 holds ${defs.size}`);
  const bad = [...defs].map(([slug, d]) => [slug, textRefusal(d)]).filter(([, why]) => why);
  assert.deepEqual(bad, [], "no definition is too long, too short, over two sentences or linked");
  const mapping = readFamilyMapping();
  const misfiled = Object.entries(raw.definitions).flatMap(([fam, ds]) => Object.keys(ds)
    .filter(s => mapping.has(s) && mapping.get(s) !== fam).map(s => `${s}: ${fam} ≠ ${mapping.get(s)}`));
  assert.deepEqual(misfiled, [], "a definition sits under the family families.json gives its node");
});

test("A112/Atlas + owner 11-10 · draftedSeedPublishes — the seed writes the definition (definition_by 'auto'); the bar then publishes the page", () => {
  const db = fixtureDb();
  upsertNode(db, { kind: "skill", name: "prospecting", source: "registry" });
  stats(db, "prospecting", 40);
  const r = seedDraftedDefinitions(db, new Map([["prospecting", PROSPECTING], ["no-such-node", PROSPECTING]]));
  assert.deepEqual(r, { published: ["prospecting"], missing: ["no-such-node"], refused: [] });
  assert.deepEqual(node(db, "prospecting"), { status: "draft", definition: PROSPECTING, definition_draft: null, definition_by: "auto" });
  assert.deepEqual(draftedDefinitions(db), [], "no accept loop");
  assert.deepEqual(autoPublish(db).published, ["prospecting"], "40 postings + a definition is the bar");
});

test("A112/Atlas · draftedOfferedOnce — a rejected draft is not offered again; a node with its own words is never touched", () => {
  const db = fixtureDb();
  upsertNode(db, { kind: "skill", name: "prospecting", source: "registry" });
  upsertNode(db, { kind: "tool", name: "Salesforce", source: "registry" });
  db.prepare(`UPDATE atlas_nodes SET definition = 'The owner''s own words about Salesforce.', definition_by = 'owner' WHERE slug = 'salesforce'`).run();
  const map = new Map([["prospecting", PROSPECTING], ["salesforce", "A customer relationship management platform for sales teams."]]);
  assert.deepEqual(seedDraftedDefinitions(db, map).published, ["prospecting"]);
  assert.equal(node(db, "salesforce").definition, "The owner's own words about Salesforce.", "the owner's definition stands");
  assert.equal(unpublishDefinition(db, "prospecting"), true);
  assert.deepEqual(seedDraftedDefinitions(db, map), { published: [], missing: [], refused: [] }, "an unpublished one is never offered again");
  assert.equal(node(db, "prospecting").definition, null);
});

test("A112/Atlas · draftedSeedRefusesBadText — a definition that breaks the rules is reported, not drafted, and offered again once fixed", () => {
  const db = fixtureDb();
  upsertNode(db, { kind: "skill", name: "prospecting", source: "registry" });
  const r = seedDraftedDefinitions(db, new Map([["prospecting", "One. Two. Three sentences is too many here."]]));
  assert.deepEqual(r.refused, [{ slug: "prospecting", reason: "more than two sentences" }]);
  assert.equal(node(db, "prospecting").definition_draft, null);
  assert.deepEqual(seedDraftedDefinitions(db, new Map([["prospecting", PROSPECTING]])).published, ["prospecting"]);
});

test("A112/Atlas · draftedSeedAtBoot — server.js seeds the drafts after the families, inside its own try", () => {
  const src = read(new URL("../server.js", import.meta.url));
  const fam = src.indexOf("const f = seedAtlasFamilies(db);");
  const drafted = src.indexOf("const d = seedDraftedDefinitions(db);");
  assert.ok(fam > 0 && drafted > fam, "after the families");
  assert.match(src.slice(drafted - 200, drafted), /try \{\s*$/);
});
