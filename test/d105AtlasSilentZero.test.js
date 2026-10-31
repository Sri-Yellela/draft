import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { upsertNode } from "../services/atlas/atlasStore.js";
import { seedAtlasFromRegistry } from "../services/atlas/atlasSeed.js";
import { runAtlasAutoPipeline, describeAutoRun, askWikipediaAgain } from "../services/atlas/atlasPublish.js";
import { matchWikiTitles, wikidataResources } from "../services/atlas/atlasWikidata.js";
import { refreshWikiSummaries, WIKI_UA } from "../services/atlas/atlasWiki.js";
import { at } from "../test-support/sourceAnchors.js";

// ⭐ BUG 10-31 (owner's screenshot, production Admin → Atlas): "0 Wikipedia title(s) matched, 0 official link(s), 0
// summaries read, 0 page(s) published" while the same code matched 54 locally. Whatever production's cause, the line
// named none — a refused request, an API error and "nothing due" all read as the same zero. These pin that a failure is
// an error in the line, that only an answer stamps a node, and that the curator can clear the 30-day mark.
// Synthetic nodes; every network call goes through an injected fetcher.

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
function fixtureDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  return db;
}
const resp = (status, json = null) => ({ status, ok: status >= 200 && status < 300, json: async () => json });
const quiet = { pauseMs: 0, wikiPauseMs: 0, log: () => {} };
const checkedAt = (db, slug) => db.prepare(`SELECT wiki_checked_at FROM atlas_nodes WHERE slug = ?`).pluck().get(slug);
const stats = (db, slug, postings) => {
  const id = db.prepare(`SELECT id FROM atlas_nodes WHERE slug = ?`).pluck().get(slug);
  db.prepare(`INSERT OR REPLACE INTO atlas_node_stats (node_id, postings, computed_at) VALUES (?,?,1)`).run(id, postings);
};

test("D105 BUG 10-31 · d105WikimediaUserAgent — every Wikimedia request (titles, Wikidata, summaries) sends draft's UA, and each request is logged with its status and that UA", async () => {
  const db = fixtureDb();
  upsertNode(db, { kind: "skill", name: "Kubernetes", source: "registry" });
  stats(db, "kubernetes", 9);
  const uas = [], lines = [];
  const fetchImpl = async (url, init) => {
    uas.push(init.headers["user-agent"]);
    if (url.includes("/w/api.php")) return resp(200, { query: { pages: [{ title: "Kubernetes", pageprops: { wikibase_item: "Q1" } }] } });
    return resp(200, { type: "standard", title: "Kubernetes", extract: "An orchestrator." });
  };
  await runAtlasAutoPipeline(db, { fetchImpl, ...quiet, log: (l) => lines.push(l) });
  assert.ok(uas.length >= 2);
  assert.ok(uas.every(u => u === WIKI_UA));
  assert.match(WIKI_UA, /^draft-atlas\/\d+\.\d+ \(https:\/\/jobsviadraft\.com/, "names the client and a contact");
  assert.equal(lines.length, 1, "one line per title request");
  assert.match(lines[0], /titles request 1: 200 \(1 asked\) ua="draft-atlas/);
});

test("D105 BUG 10-31 · d105FetchFailureReportedNotZero — a 403, a network error or a 5xx is an ERROR in the line, never '0 matched'; nothing is stamped", async () => {
  for (const [name, fetchImpl, reason] of [
    ["403", async () => resp(403), "403"],
    ["network", async () => { throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } }); }, "network: ENOTFOUND"],
    ["503", async () => resp(503), "503"],
  ]) {
    const db = fixtureDb();
    for (const n of ["Kubernetes", "Terraform"]) upsertNode(db, { kind: "skill", name: n, source: "registry" });
    db.prepare(`INSERT INTO atlas_wiki_cache (node_id, title, extract, page_url, fetched_at) VALUES (1, 'K', 'x', 'https://en.wikipedia.org/wiki/K', 1)`).run();
    db.prepare(`UPDATE atlas_nodes SET wiki_title = 'Kubernetes', wiki_title_by = 'owner' WHERE slug = 'kubernetes'`).run();
    const r = await runAtlasAutoPipeline(db, { fetchImpl, ...quiet });
    assert.equal(r.ok, false, name);
    assert.equal(r.titles.failed, 1, name);
    assert.deepEqual(r.titles.reasons, { [reason]: 1 }, name);
    assert.match(r.line, new RegExp(`^Wikipedia unreachable: 1 of 1 title request\\(s\\) failed \\(${reason} ×1\\)`), name);
    assert.match(r.line, new RegExp(`Wikipedia summaries: 1 of 1 failed \\(${reason} ×1\\)`), name);
    assert.equal(checkedAt(db, "terraform"), null, `${name}: a failed request stamps nothing`);
  }
  // A step that throws is named too — `titles: { error }` used to read as "0 matched".
  assert.match(describeAutoRun({ titles: { error: "no such column: wiki_checked_at" }, autoPublish: { published: [] } }).line,
    /^Titles step crashed: no such column: wiki_checked_at/);
});

test("D105 BUG 10-31 · d105ApiErrorNotStamped — an Action-API `error` (any code but maxlag) or an answer with no page list fails the batch; no node is hidden for 30 days", async () => {
  for (const body of [{ error: { code: "badvalue", info: "Unrecognized value" } }, { batchcomplete: true }, null]) {
    const db = fixtureDb();
    for (const n of ["Kubernetes", "Terraform", "Kafka"]) upsertNode(db, { kind: "skill", name: n, source: "registry" });
    const m = await matchWikiTitles(db, { fetchImpl: async () => resp(200, body), ...quiet });
    assert.deepEqual([m.failed, m.asked, m.matched], [1, 0, 0], JSON.stringify(body));
    for (const s of ["kubernetes", "terraform", "kafka"]) assert.equal(checkedAt(db, s), null, `${s} after ${JSON.stringify(body)}`);
    assert.equal((await matchWikiTitles(db, { fetchImpl: async () => resp(200, body), ...quiet })).due, 3, "asked again on the next press");
  }
  const db = fixtureDb();
  upsertNode(db, { kind: "skill", name: "Kubernetes", source: "registry" });
  const m = await matchWikiTitles(db, { fetchImpl: async () => resp(200, { error: { code: "maxlag" } }), ...quiet });
  assert.equal(m.stopped, true);
  assert.match(describeAutoRun({ titles: m, autoPublish: { published: [] } }).line, /slow down \(maxlag ×1\)/);
  // Wikidata's answer without `entities` fails the same way, unmarked.
  db.prepare(`UPDATE atlas_nodes SET kind = 'tool', wikidata_id = 'Q1' WHERE slug = 'kubernetes'`).run();
  const w = await wikidataResources(db, { fetchImpl: async () => resp(200, { error: { code: "no-such-entity" } }), ...quiet });
  assert.deepEqual([w.failed, w.reasons], [1, { "api error: no-such-entity": 1 }]);
  assert.equal(db.prepare(`SELECT wikidata_checked_at FROM atlas_nodes WHERE slug = 'kubernetes'`).pluck().get(), null);
});

test("D105 BUG 10-31 · d105UnaskedNodeNotStamped — a node never asked (ambiguous word, stack, one-letter term) is counted 'not askable' and never stamped", async () => {
  const db = fixtureDb();
  upsertNode(db, { kind: "tool", name: "Rust", source: "registry" });   // the scorer's ambiguous word
  upsertNode(db, { kind: "skill", name: "Kubernetes", source: "registry" });
  db.prepare(`UPDATE atlas_nodes SET term = '' WHERE slug = 'kubernetes'`).run();   // F1: a node seeded with no term
  let calls = 0;
  const m = await matchWikiTitles(db, { fetchImpl: async () => { calls++; return resp(200, { query: { pages: [] } }); }, ...quiet });
  assert.equal(calls, 0, "nothing to ask: no request");
  assert.deepEqual([m.due, m.asked, m.notAsked], [2, 0, 2]);
  assert.equal(checkedAt(db, "rust"), null);
  assert.equal(checkedAt(db, "kubernetes"), null, "fixing the term later makes it askable at once, not in 30 days");
  assert.match(describeAutoRun({ titles: m, autoPublish: { published: [] } }).line, /2 due · 0 asked · 2 not askable · 0 request\(s\)/);
  // An ANSWER that says "no article" still stamps — that is the 30-day recheck working as designed.
  upsertNode(db, { kind: "skill", name: "Zzqx Framework", source: "registry" });
  await matchWikiTitles(db, { fetchImpl: async () => resp(200, { query: { pages: [{ title: "Zzqx Framework", missing: true }] } }), ...quiet, now: () => 1_900_000_000 });
  assert.equal(checkedAt(db, "zzqx-framework"), 1_900_000_000);
});

test("D105 BUG 10-31 · d105ResultLineShowsCounters — the admin button and the nightly log show due · asked · requests · failed, from ONE formatter", () => {
  const ok = describeAutoRun({ titles: { due: 169, asked: 161, notAsked: 8, requests: 6, failed: 0, matched: 41, reasons: { 200: 6 } },
    wikidata: { due: 20, official: 18 }, wikipedia: { due: 41, fetched: 41, failed: 0 }, autoPublish: { published: ["a", "b"] } });
  assert.equal(ok.ok, true);
  assert.equal(ok.line, "Titles: 169 due · 161 asked · 8 not askable · 6 request(s) · 0 failed · 41 matched · Wikidata: 18 official link(s) of 20 due · Summaries: 41 of 41 read · 2 page(s) published");
  // Nothing due at all says why, and points at the button.
  const idle = describeAutoRun({ titles: { due: 0, asked: 0, requests: 0, failed: 0, matched: 0 }, wikidata: { due: 0 }, wikipedia: { due: 0, fetched: 0 }, autoPublish: { published: [] } });
  assert.match(idle.line, /nothing was due — every unmatched node was asked in the last 30 days; "Ask Wikipedia again" clears that$/);
  const panel = read("client/src/panels/adminAtlas.jsx");
  const runAuto = panel.slice(at(panel, "const runAuto = async"), at(panel, "const askAgain = async"));
  assert.match(runAuto, /setSaid\(\{ ok: !!r\.ok, text: `Auto-publish: \$\{r\.line\}` \}\)/);
  assert.doesNotMatch(runAuto, /titles\?\.matched \?\? 0/, "the old line that hid the counters is gone");
  const src = read("server.js");
  assert.match(src, /\(r\.ok \? console\.log : console\.error\)\(`\[Cron\] atlas auto: \$\{r\.line\}`\)/);
});

test("D105 BUG 10-31 · d105AskAgainClearsChecked — 'Ask Wikipedia again' clears the 30-day mark on unmatched nodes only; a curator's title is untouched", async () => {
  const db = fixtureDb();
  for (const n of ["Kubernetes", "Terraform", "Kafka"]) upsertNode(db, { kind: "skill", name: n, source: "registry" });
  db.prepare(`UPDATE atlas_nodes SET wiki_checked_at = 5`).run();
  db.prepare(`UPDATE atlas_nodes SET wiki_title = 'Apache_Kafka', wiki_title_by = 'owner' WHERE slug = 'kafka'`).run();
  db.prepare(`UPDATE atlas_nodes SET wiki_title = NULL, wiki_title_by = 'owner' WHERE slug = 'terraform'`).run();   // the curator cleared it
  assert.equal((await matchWikiTitles(db, { fetchImpl: async () => resp(500), ...quiet, now: () => 10 })).due, 0, "all marked: nothing due");
  assert.deepEqual(askWikipediaAgain(db), { cleared: 1 });
  assert.equal(checkedAt(db, "kubernetes"), null);
  assert.equal(checkedAt(db, "kafka"), 5, "a curator's title is not re-asked by name");
  assert.equal(checkedAt(db, "terraform"), 5, "a title the curator cleared stays cleared");
  const route = read("routes/atlas.js");
  assert.match(route, /router\.post\("\/wiki\/ask-again", \(_req, res\) => res\.json\(\{ ok: true, \.\.\.askWikipediaAgain\(db\) \}\)\)/);
  assert.ok(at(route, `router.post("/wiki/ask-again"`) < at(route, `router.post("/:slug/status"`));
  assert.match(read("client/src/panels/adminAtlas.jsx"), /data-atlas-ask-again="">Ask Wikipedia again<\/DepthButton>/);
});

test("D105 BUG 10-31 · d105RegistrySeedHasTerm — every node the registry seed creates has a term the matcher can ask", () => {
  const db = fixtureDb();
  const s = seedAtlasFromRegistry(db);
  assert.ok(s.nodes > 100, `seeded ${s.nodes}`);
  const rows = db.prepare(`SELECT name, term FROM atlas_nodes WHERE source = 'registry'`).all();
  assert.equal(rows.length, s.nodes);
  for (const r of rows) assert.ok(String(r.term ?? "").trim().length >= 1, `${r.name} has no term`);
});

test("D105 BUG 10-31 · d105AutoPublishFillsEmptyCache — one press on an empty cache matches the title, reads the summary and publishes; no 'Refresh Wikipedia' first", async () => {
  const db = fixtureDb();
  upsertNode(db, { kind: "skill", name: "Kubernetes", source: "registry" });
  stats(db, "kubernetes", 12);
  assert.equal(db.prepare(`SELECT COUNT(*) FROM atlas_wiki_cache`).pluck().get(), 0);
  const fetchImpl = async (url) => {
    if (url.includes("/w/api.php")) return resp(200, { query: { pages: [{ title: "Kubernetes", pageprops: { wikibase_item: "Q22661306" } }] } });
    if (url.startsWith("https://en.wikipedia.org/api/rest_v1/page/summary/Kubernetes")) return resp(200, { type: "standard", title: "Kubernetes", extract: "An orchestrator." });
    return resp(404);
  };
  const r = await runAtlasAutoPipeline(db, { fetchImpl, ...quiet });
  assert.deepEqual([r.titles.matched, r.wikipedia.fetched, r.autoPublish.published], [1, 1, ["kubernetes"]]);
  assert.equal(r.ok, true);
  assert.match(r.line, /1 matched · .* Summaries: 1 of 1 read · 1 page\(s\) published$/);
  // and the summaries step on its own reports a refusal instead of "0 read"
  const db2 = fixtureDb();
  upsertNode(db2, { kind: "skill", name: "Kubernetes", source: "registry" });
  db2.prepare(`UPDATE atlas_nodes SET wiki_title = 'Kubernetes'`).run();
  const w = await refreshWikiSummaries(db2, { fetchImpl: async () => resp(403), pauseMs: 0, log: () => {} });
  assert.deepEqual([w.fetched, w.failed, w.reasons], [0, 1, { 403: 1 }]);
});
