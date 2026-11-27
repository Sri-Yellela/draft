import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { upsertNode, setStatus, readNode, addEdge, AUTO_PUBLISHER } from "../services/atlas/atlasStore.js";
import { updateNode, addResource } from "../services/atlas/atlasEditor.js";
import { computeAtlasStats, boardEdgesFrom, writeBoardEdges, BOARD_MIN_TOGETHER } from "../services/atlas/atlasStats.js";
import { autoPublish, readiness, READINESS_COLUMNS, AUTO_PUBLISH_MIN_POSTINGS } from "../services/atlas/atlasPublish.js";
import { matchWikiTitles, wikidataResources, pickUrl, resolveQueryTitle } from "../services/atlas/atlasWikidata.js";
import { WIKI_UA } from "../services/atlas/atlasWiki.js";
import { orderedResources } from "../client/src/pages/atlas/atlasModel.js";
import { at } from "../test-support/sourceAnchors.js";

// ⭐ D105 P7–P9 (amended 10-31) — the Atlas publishes itself. Synthetic nodes and postings only; every network call
// goes through an injected fetcher — nothing here touches the network.

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
function fixtureDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  return db;
}
const resp = (status, json = null) => ({ status, ok: status >= 200 && status < 300, json: async () => json });
const stats = (db, slug, postings) => {
  const id = db.prepare(`SELECT id FROM atlas_nodes WHERE slug = ?`).pluck().get(slug);
  db.prepare(`INSERT OR REPLACE INTO atlas_node_stats (node_id, postings, computed_at) VALUES (?,?,1)`).run(id, postings);
  return id;
};
const wiki = (db, id, extract = "An article's lead.") =>
  db.prepare(`INSERT OR REPLACE INTO atlas_wiki_cache (node_id, title, extract, page_url, fetched_at) VALUES (?,?,?,?,1)`)
    .run(id, "T", extract, "https://en.wikipedia.org/wiki/T");
const status = (db, slug) => db.prepare(`SELECT status FROM atlas_nodes WHERE slug = ?`).pluck().get(slug);

test("D105 P7 · d105AutoPublishBar — ≥ 5 postings AND (a Wikipedia summary OR a definition); never fewer, never neither", () => {
  const db = fixtureDb();
  for (const n of ["Kubernetes", "Terraform", "Helm", "Ansible", "Nomad"]) upsertNode(db, { kind: "tool", name: n, source: "registry" });
  wiki(db, stats(db, "kubernetes", 5));                          // 5 + Wikipedia → published
  stats(db, "terraform", 9);
  db.prepare(`UPDATE atlas_nodes SET definition = 'Infrastructure as code.' WHERE slug = 'terraform'`).run();   // 9 + definition → published
  wiki(db, stats(db, "helm", 4));                                // 4 postings → draft
  stats(db, "ansible", 40);                                      // no summary, no definition → draft
  wiki(db, stats(db, "nomad", 12), "   ");                       // an empty extract is not a summary → draft
  const r = autoPublish(db, { now: () => 1_900_000_000 });
  assert.deepEqual(r.published, ["terraform", "kubernetes"], "by postings, most first");
  assert.equal(AUTO_PUBLISH_MIN_POSTINGS, 5);
  for (const s of ["helm", "ansible", "nomad"]) assert.equal(status(db, s), "draft", s);
  const row = db.prepare(`SELECT published_by, published_at FROM atlas_nodes WHERE slug = 'kubernetes'`).get();
  assert.deepEqual(row, { published_by: AUTO_PUBLISHER, published_at: 1_900_000_000 });
  assert.deepEqual(autoPublish(db).published, [], "idempotent");
  // The admin list's reasons.
  const why = (slug) => readiness(db.prepare(`SELECT ${READINESS_COLUMNS} FROM atlas_nodes n LEFT JOIN atlas_node_stats s ON s.node_id = n.id WHERE n.slug = ?`).get(slug));
  assert.deepEqual(why("helm").missing, ["postings 4 of 5"]);
  assert.deepEqual(why("ansible").missing, ["no Wikipedia summary or definition"]);
  assert.equal(why("kubernetes").ready, true);
  const panel = read("client/src/panels/adminAtlas.jsx");
  const line = panel.slice(at(panel, "function readinessLine"), at(panel, "/** Add a node by hand"));
  assert.match(line, /not published yet: \$\{rd\.missing\.join/);
  assert.match(line, /unpublished by \$\{rd\.heldBy\}/);
  assert.match(panel, /data-atlas-readiness=/);
  // The nightly cron re-checks the bar right after the stats.
  const src = read("server.js");
  // 46c (A123 (5)): the pass's read runs on the offload worker — runAtlasPass(); the bar is still re-checked after it.
  const cron = src.slice(at(src, "const a = await runAtlasPass();"), at(src, "console.error('[Cron] Atlas stats error:'"));
  assert.match(cron, /autoPublish\(db\)/);
});

// ⛔ 47m (changed on purpose): "D105 P7 · d105BelowBarStaysPublished — a page whose count falls under 5 stays pu" retired — the surface it pinned was rebuilt in the plate system (47m M5).

test("D105 P7 · d105OwnerUnpublishSticks — a person's un-publish is recorded and the bar never re-publishes it", () => {
  const db = fixtureDb();
  upsertNode(db, { kind: "tool", name: "Kubernetes", source: "registry" });
  wiki(db, stats(db, "kubernetes", 50));
  autoPublish(db);
  assert.equal(status(db, "kubernetes"), "published");
  setStatus(db, "kubernetes", "draft", "curator@example.test");
  assert.deepEqual(db.prepare(`SELECT status, unpublished_by, published_by FROM atlas_nodes WHERE slug = 'kubernetes'`).get(),
    { status: "draft", unpublished_by: "curator@example.test", published_by: null });
  for (let night = 0; night < 3; night++) assert.deepEqual(autoPublish(db).published, []);
  assert.equal(status(db, "kubernetes"), "draft", "the owner's un-publish wins");
  const rd = readiness(db.prepare(`SELECT ${READINESS_COLUMNS} FROM atlas_nodes n LEFT JOIN atlas_node_stats s ON s.node_id = n.id WHERE n.slug = 'kubernetes'`).get());
  assert.equal(rd.heldBy, "curator@example.test");
  // The person publishing it again clears the mark.
  setStatus(db, "kubernetes", "published", "curator@example.test");
  assert.equal(db.prepare(`SELECT unpublished_by FROM atlas_nodes WHERE slug = 'kubernetes'`).pluck().get(), null);
  // A curator clearing a wrong Wikipedia title keeps it clear: the matcher never refills an owner's title.
  upsertNode(db, { kind: "tool", name: "Nomad", source: "registry" });
  updateNode(db, "nomad", { wikiTitle: "" });
  assert.deepEqual(db.prepare(`SELECT wiki_title, wiki_title_by FROM atlas_nodes WHERE slug = 'nomad'`).get(), { wiki_title: null, wiki_title_by: "owner" });
});

test("D105 P8 · d105WikidataOfficialLink — exact titles only, the item's P856 + P2078 as 'wikidata' resources, the article second", async () => {
  const db = fixtureDb();
  upsertNode(db, { kind: "tool", name: "Kubernetes", source: "registry" });
  upsertNode(db, { kind: "tool", name: "Docker", source: "registry" });          // a disambiguation page
  upsertNode(db, { kind: "tool", name: "Rust", source: "registry" });            // the scorer's ambiguous word: never asked
  upsertNode(db, { kind: "skill", name: "Machine Learning Ops", source: "registry" });   // redirects elsewhere: not exact
  upsertNode(db, { kind: "role", name: "Software Engineer", source: "registry" });       // a case-only redirect: exact
  upsertNode(db, { kind: "tool", name: "Selenium", source: "registry" });        // the article is the element: not software
  const asked = [];
  const fetchImpl = async (url, init) => {
    asked.push({ url: decodeURIComponent(url), ua: init.headers["user-agent"] });
    if (url.startsWith("https://en.wikipedia.org/w/api.php")) {
      return resp(200, { query: {
        redirects: [{ from: "Machine Learning Ops", to: "MLOps" }, { from: "Software Engineer", to: "Software engineer" }],
        pages: [
          { title: "Kubernetes", pageprops: { wikibase_item: "Q22661306" } },
          { title: "Docker", pageprops: { disambiguation: "", wikibase_item: "Q910577" } },
          { title: "MLOps", pageprops: { wikibase_item: "Q1" } },
          { title: "Software engineer", pageprops: { wikibase_item: "Q2" } },
          { title: "Selenium", pageprops: { wikibase_item: "Q876" } },
        ] } });
    }
    return resp(200, { entities: { Q876: { claims: { P31: [{ rank: "normal", mainsnak: { snaktype: "value" } }] }, sitelinks: {} }, Q22661306: {
      claims: {
        P856: [
          { rank: "normal", mainsnak: { snaktype: "value", datavalue: { value: "https://k8s.io" } } },
          { rank: "preferred", mainsnak: { snaktype: "value", datavalue: { value: "https://kubernetes.io" } } },
          { rank: "deprecated", mainsnak: { snaktype: "value", datavalue: { value: "https://old.example" } } },
        ],
        P2078: [{ rank: "normal", mainsnak: { snaktype: "value", datavalue: { value: "https://kubernetes.io/docs/" } } }],
      },
      sitelinks: { enwiki: { site: "enwiki", title: "Kubernetes" } } } } });
  };
  const m = await matchWikiTitles(db, { fetchImpl, pauseMs: 0 });
  assert.equal(m.requests, 2, "one batched title request + one batched software check for the tools");
  assert.match(asked[1].url, /wbgetentities.*ids=Q22661306|Q876|wbgetentities.*ids=Q876|Q22661306/);
  assert.equal(m.notSoftware, 1);
  assert.ok(!asked[0].url.includes("Rust"), "an ambiguous word is never asked by name");
  assert.match(asked[0].url, /ppprop=disambiguation\|wikibase_item/);
  assert.match(asked[0].url, /maxlag=5/);
  const row = (slug) => db.prepare(`SELECT wiki_title, wiki_title_by, wikidata_id FROM atlas_nodes WHERE slug = ?`).get(slug);
  assert.deepEqual(row("kubernetes"), { wiki_title: "Kubernetes", wiki_title_by: "auto", wikidata_id: "Q22661306" });
  assert.deepEqual(row("software-engineer"), { wiki_title: "Software_engineer", wiki_title_by: "auto", wikidata_id: "Q2" });
  assert.equal(row("docker").wiki_title, null, "a disambiguation page is skipped");
  assert.equal(row("machine-learning-ops").wiki_title, null, "a redirect to another title is not exact");
  assert.equal(row("rust").wiki_title, null);
  assert.equal(row("selenium").wiki_title, null, "a tool whose article is not software on Wikidata is left for the curator");
  // An owner's title is never replaced.
  assert.equal(resolveQueryTitle({ query: { pages: [{ title: "X", missing: true }] } }, "X"), null);

  const w = await wikidataResources(db, { fetchImpl, pauseMs: 0 });
  assert.equal(w.official, 1);
  assert.ok(asked[2].url.startsWith("https://www.wikidata.org/w/api.php?action=wbgetentities"));
  assert.ok(asked[2].url.endsWith("ids=Q22661306"), "only TOOL nodes with an item are read");
  assert.ok(asked.every(a => a.ua === WIKI_UA), "a User-Agent naming draft and a contact");
  const res = db.prepare(`SELECT url, title, format, source FROM atlas_resources ORDER BY id`).all();
  assert.deepEqual(res, [
    { url: "https://kubernetes.io/", title: "Kubernetes — official website", format: null, source: "wikidata" },
    { url: "https://kubernetes.io/docs/", title: "Kubernetes documentation", format: "docs", source: "wikidata" },
    { url: "https://en.wikipedia.org/wiki/Kubernetes", title: "“Kubernetes” on Wikipedia", format: "article", source: "wikipedia" },
  ]);
  // The page: Wikidata's first, the article next, the curated free tutorial after them.
  setStatus(db, "kubernetes", "published");
  addResource(db, "kubernetes", { url: "https://tutorial.example/k8s", title: "A free tutorial", cost: "free" });
  assert.deepEqual(readNode(db, "kubernetes").resources.map(r => r.source), ["wikidata", "wikidata", "wikipedia", "owner"]);
  assert.deepEqual(orderedResources(readNode(db, "kubernetes").resources).map(r => r.title)[0], "Kubernetes — official website");
  // Read once per item: a resource the curator deletes stays deleted.
  db.prepare(`DELETE FROM atlas_resources WHERE url = 'https://kubernetes.io/'`).run();
  assert.equal((await wikidataResources(db, { fetchImpl, pauseMs: 0 })).due, 0);
  // pickUrl: never an ended statement, https only.
  assert.equal(pickUrl({ P856: [{ rank: "preferred", qualifiers: { P582: [{}] }, mainsnak: { snaktype: "value", datavalue: { value: "https://ended.example" } } },
    { rank: "normal", mainsnak: { snaktype: "value", datavalue: { value: "http://plain.example" } } }] }, "P856"), null);
  // A 429 stops the run; nothing is marked checked.
  upsertNode(db, { kind: "tool", name: "Terraform", source: "registry" });
  const limited = await matchWikiTitles(db, { fetchImpl: async () => resp(429), pauseMs: 0 });
  assert.equal(limited.stopped, true);
  assert.equal(db.prepare(`SELECT wiki_checked_at FROM atlas_nodes WHERE slug = 'terraform'`).pluck().get(), null);
});

test("D105 P9 · d105BoardEdgesThreshold — used_with at ≥ 10 % of either's postings, requires = a role's top 15; board edges only replaced", () => {
  const kinds = { 1: "skill", 2: "skill", 3: "skill", 4: "skill", 9: "role" };
  const agg = new Map([
    [1, { postings: 100, withSkill: new Map([[2, 10], [3, 9], [4, 2]]) }],   // 1–2: 10 % of 1's → edge; 1–3: 9 of 100 but…
    [2, { postings: 200, withSkill: new Map([[1, 10]]) }],
    [3, { postings: 90, withSkill: new Map([[1, 9]]) }],                     // …9 of 3's 90 = 10 % → edge (either)
    [4, { postings: 20, withSkill: new Map([[1, 2]]) }],                     // 2 of 20 = 10 % but under BOARD_MIN_TOGETHER
    [9, { postings: 30, withSkill: new Map([[1, 20], [2, 12], [3, 3], [4, 2]]) }],
  ]);
  const edges = boardEdgesFrom(agg, (id) => kinds[id]);
  const used = edges.filter(e => e.type === "used_with").map(e => `${e.from}-${e.to}`).sort();
  assert.deepEqual(used, ["1-2", "1-3"], "one edge per pair, the threshold either way, the floor applied");
  assert.equal(BOARD_MIN_TOGETHER, 3);
  assert.deepEqual(edges.filter(e => e.type === "requires").map(e => e.to), [1, 2, 3], "by share of the role's postings");
  // 9 of 100 and 9 of 95 → no edge at all.
  assert.deepEqual(boardEdgesFrom(new Map([[1, { postings: 100, withSkill: new Map([[2, 9]]) }], [2, { postings: 95, withSkill: new Map([[1, 9]]) }]]),
    () => "skill"), []);
  // The top 15 cap.
  const many = new Map([[100, { postings: 50, withSkill: new Map(Array.from({ length: 20 }, (_, i) => [i + 1, 30 - i])) }]]);
  assert.equal(boardEdgesFrom(many, (id) => (id === 100 ? "role" : "tool")).length, 15);

  // Written: only the previous BOARD edges are replaced; a registry edge on the same pair keeps its source.
  const db = fixtureDb();
  const a = upsertNode(db, { kind: "role", name: "Backend Engineer" }).id;
  const b = upsertNode(db, { kind: "skill", name: "Python" }).id;
  const c = upsertNode(db, { kind: "skill", name: "Go" }).id;
  const d = upsertNode(db, { kind: "tool", name: "Docker" }).id;
  addEdge(db, a, b, "requires", "registry");
  addEdge(db, d, c, "used_with", "owner");
  writeBoardEdges(db, [{ from: c, to: d, type: "used_with" }, { from: a, to: b, type: "requires" }, { from: a, to: c, type: "requires" }]);
  const all = () => db.prepare(`SELECT from_id, to_id, type, source FROM atlas_edges ORDER BY source, from_id, to_id`).all();
  assert.deepEqual(all().filter(e => e.source === "board"), [{ from_id: a, to_id: c, type: "requires", source: "board" }]);
  writeBoardEdges(db, [{ from: b, to: d, type: "used_with" }]);
  assert.deepEqual(all(), [
    { from_id: b, to_id: d, type: "used_with", source: "board" },
    { from_id: d, to_id: c, type: "used_with", source: "owner" },
    { from_id: a, to_id: b, type: "requires", source: "registry" },
  ], "yesterday's board edge is gone; the owner's and the registry's stay");
  // The nightly stats pass writes them.
  const stat = read("services/atlas/atlasStats.js");
  assert.match(stat.slice(at(stat, "export function computeAtlasStats"), at(stat, "return { postings, nodes: nodes.length, boardEdges")), /writeBoardEdges\(db, boardEdgesFrom\(agg/);
});

test("D105 · d105NoModelContent — the self-publishing Atlas writes no prose: no model call, no definition written", async () => {
  for (const f of ["services/atlas/atlasPublish.js", "services/atlas/atlasWikidata.js", "services/atlas/atlasStats.js", "services/atlas/atlasWiki.js"]) {
    const src = read(f);
    assert.doesNotMatch(src, /callModel|anthropic|openai|modelCall|generateText|completion/i, `${f} calls no model`);
    assert.doesNotMatch(src, /SET[^;`]*\bdefinition\s*=/i, `${f} never writes a definition`);
  }
  // Run the whole bar + the Wikidata step on a fixture: definitions are untouched, the summary is Wikipedia's own block.
  const db = fixtureDb();
  upsertNode(db, { kind: "tool", name: "Kubernetes", source: "registry" });
  const id = stats(db, "kubernetes", 7);
  wiki(db, id, "Kubernetes is an open-source container orchestration system.");
  db.prepare(`UPDATE atlas_nodes SET wikidata_id = 'Q22661306' WHERE id = ?`).run(id);
  await wikidataResources(db, { pauseMs: 0, fetchImpl: async () => resp(200, { entities: { Q22661306: { claims: {}, sitelinks: {} } } }) });
  autoPublish(db);
  const page = readNode(db, "kubernetes");
  assert.equal(page.status, "published");
  assert.equal(page.definition, null, "the definition stays a person's to write");
  assert.equal(page.wikipedia.licence.line, "From Wikipedia, CC BY-SA 4.0");
  assert.deepEqual(page.resources, [], "no official link stated → none invented");
});
