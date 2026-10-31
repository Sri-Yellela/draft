import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { upsertNode } from "../services/atlas/atlasStore.js";
import { describeAutoRun } from "../services/atlas/atlasPublish.js";
import { matchWikiTitles, classifyAnswer, resolveQueryTitle, isSoftware, probeWikipedia, wikiMatchSummary, WIKI_MATCH_CLASSES,
  PROBE_TITLES } from "../services/atlas/atlasWikidata.js";
import { at } from "../test-support/sourceAnchors.js";

// ⭐ BUG 10-31 (later): production's line after the F3 fix read "158 due · 150 asked · 4 request(s) · 0 failed ·
// 0 matched" — every request answered 200 and none was used. These read REAL answers (recorded from the agent's
// machine against the live API, 2026-10-31 — test/fixtures/atlasWiki/) and pin that every asked node is put in ONE
// class, so production's next press says which kind of zero it is. Nothing here touches the network.

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const REAL = JSON.parse(read("test/fixtures/atlasWiki/real-answers-agent-2026-10-31.json"));
function fixtureDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  return db;
}
const resp = (status, json = null) => ({ status, ok: status >= 200 && status < 300, json: async () => json, text: async () => JSON.stringify(json),
  headers: { get: () => "application/json; charset=utf-8" } });
const quiet = { pauseMs: 0, log: () => {} };
const realFetch = async (url) => resp(200, url.includes("wbgetentities") ? REAL.entities : REAL.query);

test("D105 BUG 10-31 · d105RealResponseFixtureMatches — on the recorded live answers Machine learning + Kubernetes match, PostgreSQL is software, Python is a disambiguation page", async () => {
  assert.deepEqual(REAL.titles, [...PROBE_TITLES]);
  const c = (t) => classifyAnswer(REAL.query, t);
  assert.deepEqual(c("Machine learning"), { cls: "matched", title: "Machine learning", item: "Q2539" });
  assert.deepEqual(c("Kubernetes"), { cls: "matched", title: "Kubernetes", item: "Q22661306" });
  assert.equal(c("Python").cls, "disambiguation");
  assert.equal(resolveQueryTitle(REAL.query, "Python"), null);
  assert.equal(isSoftware(REAL.entities.entities.Q192490.claims), true, "PostgreSQL is software on Wikidata");
  assert.equal(isSoftware(REAL.entities.entities.Q727490.claims), false, "scalability is not");
  // Found in the live answer: Q2539 (machine learning) carries P178 "developer", so P178 alone would call it software.
  // Harmless today — only TOOL nodes are software-checked — but P178 is the weakest of the markers.
  assert.equal(isSoftware(REAL.entities.entities.Q2539.claims), true);
  // Through the matcher, as production runs it: a skill, two tools, a role-ish concept, a disambiguation word.
  const db = fixtureDb();
  upsertNode(db, { kind: "skill", name: "Machine learning", source: "registry" });
  upsertNode(db, { kind: "tool", name: "Kubernetes", source: "registry" });
  upsertNode(db, { kind: "tool", name: "PostgreSQL", source: "registry" });
  upsertNode(db, { kind: "skill", name: "Scalability", source: "registry" });
  upsertNode(db, { kind: "skill", name: "Python", source: "registry" });
  const m = await matchWikiTitles(db, { fetchImpl: realFetch, ...quiet });
  assert.equal(m.requests, 2, "one title request + one software check");
  assert.equal(m.matched, 4, "Machine learning, Kubernetes, PostgreSQL, Scalability");
  assert.equal(m.classes.disambiguation, 1);
  const title = (slug) => db.prepare(`SELECT wiki_title FROM atlas_nodes WHERE slug = ?`).pluck().get(slug);
  assert.equal(title("machine-learning"), "Machine_learning");
  assert.equal(title("kubernetes"), "Kubernetes");
});

test("D105 BUG 10-31 · d105ClassificationCounts — every asked node lands in exactly one class, stored in wiki_match, counted and listed for the admin", async () => {
  const db = fixtureDb();
  const names = { "Machine learning": "skill", "Python": "skill", "Machine Learning Ops": "skill", "Zzqx Framework": "skill", "Selenium": "tool",
    "Orphan Title": "skill", "Bare Tool": "tool" };
  for (const [name, kind] of Object.entries(names)) upsertNode(db, { kind, name, source: "registry" });
  const answer = { query: {
    redirects: [{ from: "Machine Learning Ops", to: "MLOps" }],
    pages: [
      { title: "Machine learning", pageprops: { wikibase_item: "Q2539" } },
      { title: "Python", pageprops: { disambiguation: "", wikibase_item: "Q747452" } },
      { title: "MLOps", pageprops: { wikibase_item: "Q1" } },
      { title: "Zzqx Framework", missing: true },
      { title: "Selenium", pageprops: { wikibase_item: "Q876" } },
      { title: "Bare Tool", pageprops: {} },
      // "Orphan Title" was asked and the answer does not mention it at all
    ] } };
  const fetchImpl = async (url) => resp(200, url.includes("wbgetentities") ? { entities: { Q876: { claims: { P31: [{}] } } } } : answer);
  const m = await matchWikiTitles(db, { fetchImpl, ...quiet });
  assert.deepEqual(m.classes, { matched: 1, missing: 1, not_in_answer: 1, disambiguation: 1, inexact: 1, not_software: 1, no_item: 1 });
  assert.equal(Object.values(m.classes).reduce((a, b) => a + b, 0), m.asked, "one class per asked node");
  assert.deepEqual(Object.keys(m.classes), [...WIKI_MATCH_CLASSES]);
  const s = wikiMatchSummary(db);
  assert.deepEqual(s.counts, m.classes);
  assert.deepEqual(s.nodes.not_in_answer, [{ slug: "orphan-title", name: "Orphan Title", kind: "skill" }]);
  assert.deepEqual(s.nodes.inexact.map(n => n.name), ["Machine Learning Ops"]);
  assert.equal(s.neverAnswered, 0);
  // formatversion 1 (pages as an object keyed by id) is read too, not silently "not in the answer".
  assert.equal(classifyAnswer({ query: { pages: { 233488: { title: "Machine learning", pageprops: { wikibase_item: "Q2539" } } } } }, "Machine learning").cls, "matched");
  assert.equal(classifyAnswer({ query: { pages: { "-1": { title: "Nope", missing: "" } } } }, "Nope").cls, "missing");
  // The migration that stores it.
  const mig = read("scripts/migrations.js");
  assert.match(mig, /id: "190_atlas_wiki_match",\n\s+sql: `\n\s+ALTER TABLE atlas_nodes ADD COLUMN wiki_match TEXT;/);
  // The admin view: the counts with their nodes, and the probe.
  const route = read("routes/atlas.js");
  assert.match(route, /router\.get\("\/wiki\/classes", \(_req, res\) => res\.json\(wikiMatchSummary\(db\)\)\)/);
  assert.match(route, /router\.get\("\/wiki\/probe", async/);
  assert.ok(at(route, `router.get("/wiki/probe"`) < at(route, `router.post("/:slug/status"`));
  const panel = read("client/src/panels/adminAtlas.jsx");
  assert.match(panel, /<AtlasWikiAnswers reloadKey=\{said\} say=\{setSaid\} \/>/);
  assert.match(panel, /data-atlas-probe="">Show a real answer<\/DepthButton>/);
});

test("D105 BUG 10-31 · d105ResultLineShowsNotSoftware — the line carries items, not-software, the unmatched classes and any non-200 answers", () => {
  const { line } = describeAutoRun({
    titles: { due: 158, asked: 150, notAsked: 8, requests: 4, failed: 0, matched: 0, items: 0, notSoftware: 22, reasons: { 200: 4 },
      classes: { matched: 0, missing: 0, not_in_answer: 128, disambiguation: 0, inexact: 0, not_software: 22, no_item: 0 } },
    wikidata: { due: 0, official: 0 }, wikipedia: { due: 0, fetched: 0 }, autoPublish: { published: [] } });
  assert.match(line, /^Titles: 158 due · 150 asked · 8 not askable · 4 request\(s\) · 0 failed · 0 matched · 0 item\(s\) · 22 not software \(unmatched: 128 not in the answer, 22 not software\) · Wikidata:/);
  assert.doesNotMatch(line, /answers/, "all 200: no answers clause");
  assert.match(describeAutoRun({ titles: { reasons: { 200: 2, "200 without query": 1 }, failed: 1, requests: 3 }, autoPublish: { published: [] } }).line,
    /answers 200 without query ×1/);
});

test("D105 BUG 10-31 · d105ProbeReadsRealAnswer — the probe returns the raw answers as received, how each title is read, and writes nothing", async () => {
  const asked = [];
  const p = await probeWikipedia({ fetchImpl: async (url, init) => { asked.push(init.headers["user-agent"]); return realFetch(url); } });
  assert.equal(asked.length, 2);
  assert.deepEqual(Object.fromEntries(Object.entries(p.read).map(([t, c]) => [t, c.cls])),
    { "Machine learning": "matched", Kubernetes: "matched", PostgreSQL: "matched", Scalability: "matched", Python: "disambiguation" });
  assert.equal(p.query.status, 200);
  assert.equal(p.query.contentType, "application/json; charset=utf-8");
  assert.equal(p.entities.body.entities.Q192490.software, true);
  assert.ok(p.query.url.startsWith("https://en.wikipedia.org/w/api.php?action=query"));
  const off = await probeWikipedia({ fetchImpl: async () => { throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNRESET" } }); } });
  assert.deepEqual([off.query.status, off.query.error, off.entities], [null, "ECONNRESET", null]);
  assert.doesNotMatch(read("services/atlas/atlasWikidata.js").slice(at(read("services/atlas/atlasWikidata.js"), "export async function probeWikipedia"),
    at(read("services/atlas/atlasWikidata.js"), "export function wikiMatchSummary")), /db\.|prepare\(/, "read-only: no database");
});
