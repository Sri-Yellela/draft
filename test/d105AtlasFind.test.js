import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { upsertNode } from "../services/atlas/atlasStore.js";
import { wikiCandidates, pickWikiTitle, redirectPreview, acceptPicks, COMPUTING_QUALIFIER } from "../services/atlas/atlasWikiFind.js";
import { matchWikiTitles } from "../services/atlas/atlasWikidata.js";
import { WIKI_UA } from "../services/atlas/atlasWiki.js";

// ⭐ D105 P10 (owner 10-31: "yes to all three") — Find on Wikipedia. Shapes are the live API's, read 2026-10-31
// (extracts + pageprops, generator=links, list=search); synthetic nodes; every call goes through an injected fetcher.

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
function fixtureDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  return db;
}
const resp = (json) => ({ status: 200, ok: true, json: async () => json });
const PAGES = {
  "Distributed computing": { item: "Q180634", extract: "Distributed computing is a field of computer science that studies distributed systems." },
  "Python (programming language)": { item: "Q28865", extract: "Python is a high-level, general-purpose programming language." },
  "Python (mythology)": { item: "Q5", extract: "In Greek mythology, Python was the serpent." },
  "Python (film)": { item: "Q6", extract: "Python is a 2000 film." },
  "SQL": { item: "Q47607", extract: "Structured Query Language (SQL) is a domain-specific language." },
  "Predictive modelling": { item: "Q7239673", extract: "Predictive modelling uses statistics to predict outcomes." },
  "Predictive analytics": { item: "Q1053367", extract: "Predictive analytics encompasses statistical techniques." },
  "Python": { item: "Q747452", extract: "Python may refer to:", disambiguation: true },
};
const REDIRECTS = { "Distributed systems": "Distributed computing" };
const asked = [];
const fetchImpl = async (url, init) => {
  const p = new URL(url).searchParams;
  asked.push({ p, ua: init.headers["user-agent"] });
  if (p.get("generator") === "links") return resp({ query: { pages: ["Python (programming language)", "Python (mythology)", "Python (film)"].map(title => ({ title })) } });
  if (p.get("list") === "search") return resp({ query: { search: [{ title: "Predictive modelling" }, { title: "Python" }, { title: "Predictive analytics" }] } });
  // As the live API does: the first letter is capitalised and reported under `normalized`, then redirects followed.
  const sent = (p.get("titles") || "").split("|");
  const normalized = sent.filter(t => t[0] !== t[0].toUpperCase()).map(t => ({ from: t, to: t[0].toUpperCase() + t.slice(1) }));
  const titles = sent.map(t => t[0].toUpperCase() + t.slice(1));
  const redirects = titles.filter(t => REDIRECTS[t]).map(t => ({ from: t, to: REDIRECTS[t] }));
  const pages = titles.map(t => REDIRECTS[t] || t).map(t => PAGES[t]
    ? { title: t, ...(p.get("prop")?.includes("extracts") ? { extract: PAGES[t].extract } : {}),
        pageprops: { wikibase_item: PAGES[t].item, ...(PAGES[t].disambiguation ? { disambiguation: "" } : {}) } }
    : { title: t, missing: true });
  return resp({ query: { normalized, redirects, pages } });
};

test("D105 P10 · d105RedirectTargetFirst — a redirect node is offered its target first; the whole group is previewed, then accepted together", async () => {
  const db = fixtureDb();
  upsertNode(db, { kind: "skill", name: "distributed systems", source: "registry" });
  upsertNode(db, { kind: "skill", name: "Nowhere Redirect", source: "registry" });
  db.prepare(`UPDATE atlas_nodes SET wiki_match = 'inexact'`).run();
  const one = await wikiCandidates(fetchImpl, { name: "Distributed systems", wiki_match: "inexact" });
  assert.equal(one.candidates[0].title, "Distributed computing");
  assert.equal(one.candidates[0].item, "Q180634");
  assert.match(one.candidates[0].extract, /^Distributed computing is a field/);
  const preview = await redirectPreview(db, fetchImpl);
  assert.deepEqual(preview.map(r => [r.slug, r.title]), [["distributed-systems", "Distributed computing"], ["nowhere-redirect", null]]);
  const ready = preview.filter(r => r.title).map(r => ({ slug: r.slug, title: r.title, wikidataId: r.item }));
  const picked = acceptPicks(db, ready, "curator@example.test");
  assert.equal(picked.length, 1);
  assert.equal(db.prepare(`SELECT wiki_title FROM atlas_nodes WHERE slug = 'nowhere-redirect'`).pluck().get(), null, "only the previewed picks");
  assert.throws(() => acceptPicks(db, [{ slug: "distributed-systems", title: "X" }, { slug: "nope", title: "Y" }], "c"), /not_found/);
  assert.equal(db.prepare(`SELECT wiki_title FROM atlas_nodes WHERE slug = 'distributed-systems'`).pluck().get(), "Distributed_computing", "all or nothing");
});

test("D105 P10 · d105DisambigComputingOnly — a disambiguation page offers only its computing entries, never the page itself", async () => {
  const r = await wikiCandidates(fetchImpl, { name: "Python", wiki_match: "disambiguation" });
  assert.deepEqual(r.candidates.map(c => c.title), ["Python (programming language)"]);
  for (const t of ["React (software)", "Java (programming language)", "Spark (cluster computing)", "Go (programming language)"]) assert.match(t, COMPUTING_QUALIFIER, t);
  for (const t of ["Python (mythology)", "Python (film)", "Java (island)", "Rust (fungus)", "Python"]) assert.doesNotMatch(t, COMPUTING_QUALIFIER, t);
  // A missing node is offered search results — disambiguation pages filtered out — and the definition route.
  const m = await wikiCandidates(fetchImpl, { name: "predictive modelling", wiki_match: "missing" });
  assert.deepEqual(m.candidates.map(c => c.title), ["Predictive modelling", "Predictive analytics"]);
  assert.equal(m.writeDefinition, true);
  assert.ok(asked.every(a => a.ua === WIKI_UA));
  assert.ok(asked.every(a => a.p.get("maxlag") === "5"));
});

test("D105 P10 · d105UseAnywayTool — a tool that is 'not software' on Wikidata is offered its own article with 'Use it anyway'", async () => {
  const r = await wikiCandidates(fetchImpl, { name: "SQL", wiki_match: "not_software" });
  assert.deepEqual(r.candidates, [{ title: "SQL", item: "Q47607", extract: "Structured Query Language (SQL) is a domain-specific language.", useAnyway: true }]);
  assert.equal(r.writeDefinition, false);
  const panel = read("client/src/panels/adminAtlas.jsx");
  assert.match(panel, /\{c\.useAnyway \? "Use it anyway" : "Use this"\}/);
  assert.match(panel, /<span style=\{quiet\}>From Wikipedia<\/span>/, "the sentence is shown as Wikipedia's");
  assert.match(panel, /data-atlas-redirect-accept="">Accept all \{ready\.length\}<\/Btn>/);
});

test("D105 P10 · d105FindStoresWikidataId — a pick stores the title AND the Wikidata ID, by the curator; the old summary goes; the matcher never overwrites it", async () => {
  const db = fixtureDb();
  upsertNode(db, { kind: "tool", name: "Python", source: "registry" });
  const id = db.prepare(`SELECT id FROM atlas_nodes WHERE slug = 'python'`).pluck().get();
  db.prepare(`INSERT INTO atlas_wiki_cache (node_id, title, extract, page_url, fetched_at) VALUES (?, 'Python', 'A snake.', 'https://en.wikipedia.org/wiki/Python', 1)`).run(id);
  db.prepare(`UPDATE atlas_nodes SET wiki_match = 'disambiguation', wiki_checked_at = 1 WHERE id = ?`).run(id);
  const n = pickWikiTitle(db, "python", { title: "Python (programming language)", wikidataId: "Q28865" }, "curator@example.test");
  assert.deepEqual(n, { slug: "python", wiki_title: "Python_(programming_language)", wikidata_id: "Q28865", wiki_title_by: "curator@example.test", wiki_match: "matched" });
  assert.equal(db.prepare(`SELECT COUNT(*) FROM atlas_wiki_cache WHERE node_id = ?`).pluck().get(id), 0, "the snake's summary is dropped");
  assert.equal(db.prepare(`SELECT wikidata_checked_at FROM atlas_nodes WHERE id = ?`).pluck().get(id), null, "Wikidata's links are read for the new item");
  let calls = 0;
  await matchWikiTitles(db, { fetchImpl: async () => { calls++; return resp({ query: { pages: [] } }); }, pauseMs: 0, log: () => {} });
  assert.equal(calls, 0, "a curator's title with its item is not due");
  assert.throws(() => pickWikiTitle(db, "python", { title: "X", wikidataId: "not-a-q" }), /bad_wikidata_id/);
  assert.throws(() => pickWikiTitle(db, "python", { title: "  " }), /bad_title/);
  const route = read("routes/atlas.js");
  assert.match(route, /router\.post\("\/node\/:slug\/wiki-pick", \(req, res\) => editing\(res, \(\) =>/);
  assert.match(route, /pickWikiTitle\(db, req\.params\.slug, \{ title: req\.body\?\.title, wikidataId: req\.body\?\.wikidataId \}, curator\(req\)\)/);
});
