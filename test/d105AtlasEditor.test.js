import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { upsertNode, addEdge, addAlias, aliasesOf, setStatus, readNode, resolveTerms } from "../services/atlas/atlasStore.js";
import { mergeNodes, addResource, updateResource, cleanResourceUrl, AtlasEditError, addTypedEdge } from "../services/atlas/atlasEditor.js";
import { checkAtlasLinks, nextCheckStatus, probeUrl, LINK_CHECK_UA } from "../services/atlas/atlasLinkCheck.js";
import { refreshWikiSummaries, parseSummary, summaryUrl, WIKI_UA, WIKI_MAX_AGE_SEC } from "../services/atlas/atlasWiki.js";
import { atlasSitemapRoutes } from "../services/atlas/atlasSitemap.js";
import { loadConfirmedSynonyms } from "../services/kb/skillSynonyms.js";
import { createAtlasRouter, createAtlasAdminRouter } from "../routes/atlas.js";
import { createRequireAdmin } from "../services/adminGuard.js";
import { buildAtsReport, atlasBase } from "../shared/atsReportElement.js";
import { cleanReport } from "../shared/atsReportModel.js";
import { atsFacts } from "../extension/boardJob.js";
import { atlasForReport, reportModel, _resetAtlasSlugs } from "../extension/resumePanel.js";
import { miniDocument } from "../test-support/miniDom.mjs";
import { at } from "../test-support/sourceAnchors.js";

// ⭐ D105 P5 (links in) + P6 (the curator's editor, the dead-link checker) + the sitemap + Wikipedia's summary.
// Synthetic nodes only; every network call goes through an injected fetcher — nothing here touches the network.

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
function fixtureDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  return db;
}
const resp = (status, json = null) => ({ status, ok: status >= 200 && status < 300, body: null, json: async () => json });

async function serve(db, { admin = false, fetchImpl } = {}) {
  const app = express();
  app.use(express.json());
  if (admin) app.use((req, _r, n) => { req.admin = { email: "curator@example.test" }; n(); });
  const requireAdmin = createRequireAdmin({ isExtensionRequest: () => false, legacy: () => false, log: {} });
  app.use("/api/atlas", createAtlasRouter(db));
  app.use("/api/admin/atlas", requireAdmin, createAtlasAdminRouter(db, { fetchImpl, linkPauseMs: 0, wikiPauseMs: 0 }));
  const server = app.listen(0);
  const base = () => `http://127.0.0.1:${server.address().port}`;
  const call = (method, p, body) => fetch(`${base()}${p}`, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));
  return { server, get: (p) => call("GET", p), post: (p, b) => call("POST", p, b), patch: (p, b) => call("PATCH", p, b), del: (p) => call("DELETE", p) };
}

test("D105 P5 · d105ResolveOnlyPublished — a term resolves to a PUBLISHED node by term or confirmed alias; a draft or nothing is absent", async () => {
  const db = fixtureDb();
  const k = upsertNode(db, { kind: "tool", name: "Kubernetes" }).id;
  upsertNode(db, { kind: "tool", name: "Docker" });               // stays a draft
  upsertNode(db, { kind: "skill", name: "Python" });
  addAlias(db, k, "k8s");
  assert.deepEqual(resolveTerms(db, ["Kubernetes", "k8s", "Docker", "Python"]), {}, "nothing published, nothing links");
  setStatus(db, "kubernetes", "published");
  setStatus(db, "python", "published");
  assert.deepEqual(resolveTerms(db, ["Kubernetes", "k8s", "Docker", "Python", "Cobol", "", "k8s"]),
    { Kubernetes: "kubernetes", k8s: "kubernetes", Python: "python" }, "keys are the caller's own strings; Docker (draft) and Cobol (none) absent");
  setStatus(db, "kubernetes", "draft");
  assert.deepEqual(resolveTerms(db, ["k8s"]), {}, "unpublishing takes the link away — never a dead one");

  const s = await serve(db);
  try {
    const r = await s.get(`/api/atlas/resolve?terms=${encodeURIComponent("Python,Docker,k8s")}`);
    assert.equal(r.status, 200, "public — no sign-in");
    assert.deepEqual(r.body, { slugs: { Python: "python" } });
    assert.deepEqual((await s.get("/api/atlas/resolve")).body, { slugs: {} });
  } finally { s.server.close(); }
});

test("D105 P6 · d105MergeKeepsOneThesaurus — a merge moves edges and resources and adds the loser's term to skill_synonyms; no second table", () => {
  const db = fixtureDb();
  const tablesBefore = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`).pluck().all();
  const kube = upsertNode(db, { kind: "tool", name: "Kubernetes" }).id;
  const kubeDup = upsertNode(db, { kind: "tool", name: "K8s" }).id;
  const docker = upsertNode(db, { kind: "tool", name: "Docker" }).id;
  const role = upsertNode(db, { kind: "role", name: "Platform Engineer" }).id;
  addEdge(db, role, kubeDup, "requires", "registry");
  addEdge(db, kubeDup, docker, "used_with");
  addEdge(db, kubeDup, kube, "alternative_to");                   // would become a self-edge — dropped
  addAlias(db, kubeDup, "kube");                                   // the loser's own alias travels too
  addResource(db, "k8s", { url: "https://example.test/k8s-course", title: "A course", level: "beginner", format: "course", hours: 6, cost: "free" });
  addResource(db, "kubernetes", { url: "https://example.test/shared", title: "Shared" });
  addResource(db, "k8s", { url: "https://example.test/shared", title: "Shared (dup)" });

  const r = mergeNodes(db, "kubernetes", "k8s", "curator");
  assert.equal(r.winner, "kubernetes");
  assert.deepEqual(r.aliases.sort(), ["k8s", "kube"]);
  assert.equal(db.prepare(`SELECT COUNT(*) FROM atlas_nodes WHERE slug = 'k8s'`).pluck().get(), 0, "the loser is gone");
  const edges = db.prepare(`SELECT from_id, to_id, type FROM atlas_edges ORDER BY type`).all();
  assert.deepEqual(edges, [{ from_id: role, to_id: kube, type: "requires" }, { from_id: kube, to_id: docker, type: "used_with" }]);
  assert.deepEqual(db.prepare(`SELECT url FROM atlas_resources WHERE node_id = ? ORDER BY url`).pluck().all(kube),
    ["https://example.test/k8s-course", "https://example.test/shared"], "moved; the duplicate address kept once");
  // ⛔ ONE THESAURUS — the scorer's own table holds the alias, confirmed; the schema gained nothing.
  assert.deepEqual(aliasesOf(db, "kubernetes").sort(), ["k8s", "kube"]);
  assert.ok(loadConfirmedSynonyms(db).get("kubernetes").includes("k8s"), "the scorer reads it");
  assert.deepEqual(db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`).pluck().all(), tablesBefore);
  assert.ok(!/CREATE TABLE/i.test(read("services/atlas/atlasEditor.js")));
  assert.match(read("services/atlas/atlasEditor.js"), /addAlias\(db, w\.id, t, by\)/, "through atlasStore's addAlias");
  assert.throws(() => mergeNodes(db, "kubernetes", "kubernetes"), AtlasEditError);
  assert.throws(() => addTypedEdge(db, "kubernetes", "docker", "alias_of"), /aliases live in skill_synonyms/);
});

test("D105 P6 · d105DeadLinkFlagged — two consecutive failures → dead (hidden); one success resets; polite and capped", async () => {
  const db = fixtureDb();
  upsertNode(db, { kind: "tool", name: "Terraform" });
  setStatus(db, "terraform", "published");
  const good = addResource(db, "terraform", { url: "https://good.example.test/a", title: "Good", cost: "free" });
  const flaky = addResource(db, "terraform", { url: "https://flaky.example.test/b", title: "Flaky" });
  const headless = addResource(db, "terraform", { url: "https://nohead.example.test/c", title: "No HEAD" });

  let flakyUp = false, inFlight = 0, maxInFlight = 0;
  const seen = [];
  const fetchImpl = async (url, init) => {
    inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
    seen.push({ url, method: init.method, ua: init.headers["user-agent"], signal: !!init.signal });
    await new Promise(r => setTimeout(r, 1));
    inFlight--;
    if (url.includes("good.")) return resp(200);
    if (url.includes("nohead.")) return resp(init.method === "HEAD" ? 405 : 200);
    if (flakyUp) return resp(200);
    if (init.method === "HEAD") throw new Error("timeout");
    return resp(503);
  };
  const run = () => checkAtlasLinks(db, { fetchImpl, pauseMs: 0 });
  const status = (id) => db.prepare(`SELECT check_status FROM atlas_resources WHERE id = ?`).pluck().get(id);

  let r = await run();
  assert.equal(r.checked, 3);
  assert.equal(status(good), "ok");
  assert.equal(status(headless), "ok", "HEAD refused → GET answered");
  assert.equal(status(flaky), "failing", "one failure is not dead");
  assert.equal(readNode(db, "terraform").resources.length, 3, "a failing link is still shown");
  r = await run();
  assert.equal(status(flaky), "dead", "two in a row");
  assert.deepEqual(r.newlyDead, [flaky]);
  assert.deepEqual(readNode(db, "terraform").resources.map(x => x.title).sort(), ["Good", "No HEAD"], "the page hides the dead one");
  flakyUp = true;
  await run();
  assert.equal(status(flaky), "ok", "one success resets");
  assert.equal(readNode(db, "terraform").resources.length, 3);
  assert.ok(db.prepare(`SELECT COUNT(*) FROM atlas_resources WHERE checked_at IS NULL`).pluck().get() === 0, "checked_at stamped");

  assert.equal(maxInFlight, 1, "one request at a time");
  assert.ok(seen.every(s => s.ua === LINK_CHECK_UA && /draft/.test(s.ua) && s.signal), "a User-Agent naming draft, and a timeout");
  assert.equal((await checkAtlasLinks(db, { fetchImpl, pauseMs: 0, cap: 1 })).checked, 1, "the per-run cap");
  assert.equal(nextCheckStatus("ok", false), "failing");
  assert.equal(nextCheckStatus("failing", true), "ok");
  assert.equal((await probeUrl("https://x.test", { fetchImpl: async () => { throw new Error("down"); } })).ok, false, "never throws");
  // The server runs it daily, and the curator's button runs the same code.
  const server = read("server.js");
  const cron = server.slice(at(server, "cron.schedule('30 5 * * *'"), at(server, 'cron.schedule("0 2 * * *"'));
  assert.match(cron, /await checkAtlasLinks\(db\)/);
  assert.match(read("client/src/panels/adminAtlas.jsx"), /api\("\/api\/admin\/atlas\/links\/check", \{ method: "POST" \}\)/);
});

test("D105 P6 · the admin routes refuse non-admins; for the curator they add, edit, link, list resources (https only) and merge", async () => {
  const db = fixtureDb();
  upsertNode(db, { kind: "tool", name: "Rust" });
  upsertNode(db, { kind: "tool", name: "Cargo" });
  const anon = await serve(db, { fetchImpl: async () => { throw new Error("no network in tests"); } });
  try {
    for (const [m, p, b] of [["post", "/api/admin/atlas/nodes", { kind: "skill", name: "X" }], ["get", "/api/admin/atlas/node/rust"],
      ["patch", "/api/admin/atlas/node/rust", { definition: "x" }], ["post", "/api/admin/atlas/merge", { winner: "rust", loser: "cargo" }],
      ["post", "/api/admin/atlas/node/rust/edges", { to: "cargo", type: "used_with" }], ["del", "/api/admin/atlas/node/rust/edges?to=cargo&type=used_with"],
      ["post", "/api/admin/atlas/node/rust/resources", { url: "https://a.test", title: "A" }], ["patch", "/api/admin/atlas/resources/1", { title: "B" }],
      ["del", "/api/admin/atlas/resources/1"], ["post", "/api/admin/atlas/links/check"], ["post", "/api/admin/atlas/wiki/refresh"],
      ["get", "/api/admin/atlas"], ["post", "/api/admin/atlas/rust/status", { status: "published" }]]) {
      assert.equal((await anon[m](p, b)).status, 403, `${m} ${p} refused`);
    }
    assert.equal(db.prepare(`SELECT COUNT(*) FROM atlas_nodes`).pluck().get(), 2, "nothing was written");
  } finally { anon.server.close(); }

  const s = await serve(db, { admin: true, fetchImpl: async () => resp(200) });
  try {
    const add = await s.post("/api/admin/atlas/nodes", { kind: "stack", name: "Rust Web", definition: "Rust services on the web." });
    assert.equal(add.status, 201);
    assert.deepEqual(add.body.node, { slug: "rust-web", kind: "stack", name: "Rust Web", status: "draft" });
    assert.equal((await s.post("/api/admin/atlas/nodes", { kind: "stack", name: "Rust Web" })).status, 409);
    assert.equal((await s.post("/api/admin/atlas/nodes", { kind: "alias", name: "Y" })).status, 400);
    const edited = await s.patch("/api/admin/atlas/node/rust", { definition: "A systems language.", wikiTitle: "Rust (programming language)" });
    assert.equal(edited.body.node.definition, "A systems language.");
    assert.equal(edited.body.node.wikiTitle, "Rust_(programming_language)");
    assert.equal((await s.post("/api/admin/atlas/node/rust/edges", { to: "cargo", type: "used_with" })).status, 201);
    assert.equal((await s.post("/api/admin/atlas/node/rust/edges", { to: "cargo", type: "alias_of" })).status, 400, "never alias_of");
    for (const url of ["http://a.test/x", "javascript:alert(1)", "https://user:pw@a.test/", "not a url"]) {
      assert.equal((await s.post("/api/admin/atlas/node/rust/resources", { url, title: "T" })).status, 400, url);
    }
    const res = await s.post("/api/admin/atlas/node/rust/resources", { url: "https://doc.rust-lang.test/book", title: "The book", level: "beginner", format: "book", hours: 20, cost: "free" });
    assert.equal(res.status, 201);
    assert.equal((await s.post("/api/admin/atlas/node/rust/resources", { url: "https://a.test", title: "T", level: "guru" })).status, 400);
    assert.equal((await s.patch(`/api/admin/atlas/resources/${res.body.id}`, { hours: 25, url: "http://plain.test" })).status, 400);
    assert.equal((await s.patch(`/api/admin/atlas/resources/${res.body.id}`, { hours: 25 })).body.ok, true);
    const view = (await s.get("/api/admin/atlas/node/rust")).body;
    assert.deepEqual(view.edges.map(e => [e.dir, e.type, e.slug]), [["out", "used_with", "cargo"]]);
    assert.equal(view.resources[0].hours, 25);
    const checked = await s.post("/api/admin/atlas/links/check");
    assert.equal(checked.status, 200);
    assert.equal(checked.body.checked, 1);
    assert.equal((await s.del("/api/admin/atlas/node/rust/edges?to=cargo&type=used_with")).status, 200);
    assert.equal((await s.del(`/api/admin/atlas/resources/${res.body.id}`)).status, 200);
    const merged = await s.post("/api/admin/atlas/merge", { winner: "rust", loser: "cargo" });
    assert.equal(merged.status, 200);
    assert.deepEqual(aliasesOf(db, "rust"), ["cargo"]);
    assert.equal((await s.post("/api/admin/atlas/merge", { winner: "rust", loser: "cargo" })).status, 404);
  } finally { s.server.close(); }
  assert.equal(cleanResourceUrl("https://Example.test/a b"), "https://example.test/a%20b");
});

test("D105 · d105SitemapPublishedOnly — /atlas and the PUBLISHED pages are in sitemap.xml; a draft never is", () => {
  const db = fixtureDb();
  upsertNode(db, { kind: "tool", name: "Go" });
  upsertNode(db, { kind: "tool", name: "C++" });
  upsertNode(db, { kind: "skill", name: "Secret Draft" });
  setStatus(db, "go", "published");
  setStatus(db, "c-plus-plus", "published");
  const routes = atlasSitemapRoutes(db);
  assert.deepEqual(routes.map(r => r.path), ["/atlas", "/atlas/c-plus-plus", "/atlas/go"]);
  assert.ok(routes.slice(1).every(r => /^\d{4}-\d{2}-\d{2}$/.test(r.lastmod)));
  assert.deepEqual(atlasSitemapRoutes(new Database(":memory:")).map(r => r.path), ["/atlas"], "no table yet — still /atlas, never a throw");
  const server = read("server.js");
  const sitemap = server.slice(at(server, 'app.get("/sitemap.xml"'), at(server, 'app.get("/robots.txt"'));
  assert.match(sitemap, /\.\.\.atlasSitemapRoutes\(db\),/);
  assert.match(sitemap, /<lastmod>\$\{xmlEscape\(route\.lastmod\)\}<\/lastmod>/);
  assert.match(read("services/atlas/atlasSitemap.js"), /WHERE status = 'published'/);
});

// ⭐ Amended 10-31 (D105 P7): drafts with a wiki title are read too — a matched summary is half of the auto-publish
// bar — published ones first; a node with no title is still never guessed here (the exact-title matcher is atlasWikidata.js).
test("D105 · Wikipedia's summary — nodes with a wiki title (published first, drafts too), weekly, a User-Agent with a contact, stops at 429", async () => {
  const db = fixtureDb();
  const k = upsertNode(db, { kind: "tool", name: "Kubernetes" }).id;
  upsertNode(db, { kind: "tool", name: "Helm" });
  upsertNode(db, { kind: "tool", name: "Go" });
  db.prepare(`UPDATE atlas_nodes SET wiki_title = 'Kubernetes' WHERE slug = 'kubernetes'`).run();
  db.prepare(`UPDATE atlas_nodes SET wiki_title = 'Helm_(package_manager)' WHERE slug = 'helm'`).run();   // a draft: read after the published one
  setStatus(db, "kubernetes", "published");
  setStatus(db, "go", "published");                                                                   // no wiki title: never guessed
  const asked = [];
  let now = 1_800_000_000;
  const fetchImpl = async (url, init) => {
    asked.push({ url, ua: init.headers["user-agent"] });
    return resp(200, { type: "standard", title: "Kubernetes", extract: "Kubernetes is an open-source container orchestration system.",
      thumbnail: { source: "https://upload.wikimedia.test/k.png" }, content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Kubernetes" } } });
  };
  const r = await refreshWikiSummaries(db, { fetchImpl, pauseMs: 0, now: () => now });
  assert.deepEqual(r, { due: 2, fetched: 2, skipped: 0, failed: 0, stoppedAt429: false, reasons: {} });   // reasons: BUG 10-31
  assert.deepEqual(asked.map(a => a.url), ["https://en.wikipedia.org/api/rest_v1/page/summary/Kubernetes",
    "https://en.wikipedia.org/api/rest_v1/page/summary/Helm_(package_manager)"], "published first; go (no title) never asked");
  assert.equal(readNode(db, "helm"), null, "a draft's cached summary is still not public");
  assert.ok(asked.every(a => a.ua === WIKI_UA && /draft/.test(a.ua) && /https:\/\//.test(a.ua)), "names the client and a contact");
  const page = readNode(db, "kubernetes");
  assert.equal(page.wikipedia.extract, "Kubernetes is an open-source container orchestration system.");
  assert.equal(page.wikipedia.pageUrl, "https://en.wikipedia.org/wiki/Kubernetes");
  assert.equal(page.wikipedia.licence.line, "From Wikipedia, CC BY-SA 4.0");
  assert.equal(page.definition, null, "never blended into draft's definition");
  now += 3600;
  assert.equal((await refreshWikiSummaries(db, { fetchImpl, pauseMs: 0, now: () => now })).due, 0, "cached for a week");
  now += WIKI_MAX_AGE_SEC;
  const limited = await refreshWikiSummaries(db, { fetchImpl: async () => resp(429), pauseMs: 0, now: () => now });
  assert.equal(limited.stoppedAt429, true);
  assert.equal(db.prepare(`SELECT extract FROM atlas_wiki_cache WHERE node_id = ?`).pluck().get(k), page.wikipedia.extract, "a 429 keeps the old text");
  assert.equal(parseSummary({ type: "disambiguation", extract: "Go may refer to" }, "Go"), null);
  assert.equal(parseSummary({ extract: "x", thumbnail: { source: "http://plain.test/a.png" } }, "A B").thumbnailUrl, null, "https only");
  assert.equal(summaryUrl("Rust (programming language)"), "https://en.wikipedia.org/api/rest_v1/page/summary/Rust_(programming_language)");
});

test("D105 P5 · skill tags link — the ATS report's boxes (web + extension dock), the legacy card's chips and the Profile's skills", async () => {
  // The ONE ATS component (web app + extension): a term with a published page gets a link beside its box; others none.
  const report = cleanReport({ source: "local_ats_v5", score: 60, tier1_matched: ["kubernetes"], tier1_missing: ["terraform", "cobol"],
    action_verbs_missing: ["design"], action_verbs_generic: ["managed"] });
  const card = buildAtsReport(miniDocument(), report, { atlas: { base: "/atlas/", slugs: { kubernetes: "kubernetes", terraform: "terraform", design: "design", managed: "managed" } } });
  const links = card.querySelectorAll("a[data-atlas-link]");
  assert.deepEqual(links.map(a => a.getAttribute("href")).sort(), ["/atlas/kubernetes", "/atlas/terraform"], "verbs and generic language never link");
  assert.ok(links.every(a => a.getAttribute("rel") === "noopener noreferrer" && a.getAttribute("target") === "_blank"));
  assert.equal(buildAtsReport(miniDocument(), report).querySelectorAll("a[data-atlas-link]").length, 0, "no slugs, no links");
  assert.equal(atlasBase("javascript:alert(1)"), "/atlas/");
  assert.equal(atlasBase("//evil.test/"), "/atlas/");
  assert.equal(atlasBase("https://jobsviadraft.com/atlas/"), "https://jobsviadraft.com/atlas/");
  // The extension: the worker asks the PUBLIC resolve (no credentials) once per term, and the dock mounts with it.
  _resetAtlasSlugs();
  const asked = [];
  const fetchImpl = async (url, init) => { asked.push({ url, init }); return resp(200, { slugs: { kubernetes: "kubernetes", cobol: "../x" } }); };
  const atlas = await atlasForReport("https://jobsviadraft.com", report, { fetchImpl });
  assert.deepEqual(atlas, { base: "https://jobsviadraft.com/atlas/", slugs: { kubernetes: "kubernetes" } }, "a slug that is not a slug is dropped");
  assert.equal(asked[0].init.credentials, "omit");
  assert.match(asked[0].url, /^https:\/\/jobsviadraft\.com\/api\/atlas\/resolve\?terms=/);
  await atlasForReport("https://jobsviadraft.com", report, { fetchImpl });
  assert.equal(asked.length, 1, "cached in the worker");
  const facts = atsFacts({ state: "ready", score: 60, band: "moderate" });
  assert.deepEqual(reportModel({ ...facts, report, atlas }).atlas, atlas, "the dock's model carries it to the page");
  assert.equal(reportModel({ ...facts, report }).atlas, null);
  const panel = read("extension/resumePanel.js");
  assert.match(panel, /ATS\.mountAtsReport\(cardHost, m\.report\.report, m\.report\.atlas \? \{ atlas: m\.report\.atlas \} : \{\}\)/);
  assert.match(panel, /const atlas = found\.ats\.report \? await atlasForReport\(url\(\), found\.ats\.report\)/);
  // ⭐ D152 (8): the link sits inside the term's plain row now (atlasLink), not beside a box (withAtlas).
  assert.match(read("extension/atsReport.js"), /function atlasLink\(doc, term, atlas\)/, "the extension's bundle carries it");
  // The web app: the wrapper resolves the report's terms and hands the element `atlas`.
  const wrapper = read("client/src/components/AtsReport.jsx");
  assert.match(wrapper, /const slugs = useAtlasSlugs\(terms\);/);
  assert.match(wrapper, /el\.atlas = Object\.keys\(slugs\)\.length \? \{ base: "\/atlas\/", slugs \} : null;/);
  // The legacy card's chips and the Profile's skills.
  const card2 = read("client/src/components/JobCard.jsx");
  const chips = card2.slice(at(card2, "function SkillChips("), at(card2, "// ── The ATS slot on a card"));
  assert.match(chips, /const slugs = useAtlasSlugs\(shown\);/);
  assert.match(chips, /slug\s+\? <a key=\{i\} href=\{atlasHref\(slug\)\}/);
  const profile = read("client/src/components/ProfileSections.jsx");
  assert.match(profile, /const atlasSlugs = useAtlasSlugs\(\(p\?\.sections\?\.skills \|\| \[\]\)\.map\(x => x\?\.name\)\);/);
  assert.match(profile, /<a href=\{atlasHref\(atlasSlugs\[/);
  // One request per batch, cached for the page; a failure draws no link.
  const lib = read("client/src/lib/atlasLinks.js");
  assert.match(lib, /fetcher\(`\/api\/atlas\/resolve\?terms=\$\{encodeURIComponent\(batch\.join\(","\)\)\}`\)/);
  assert.match(lib, /const cache = new Map\(\);/);
  const { resolveAtlasTerms, _resetAtlasCache } = await import("../client/src/lib/atlasLinks.js");
  _resetAtlasCache();
  let calls = 0;
  const fetcher = async () => { calls++; return { slugs: { Kubernetes: "kubernetes" } }; };
  assert.deepEqual(await resolveAtlasTerms(["Kubernetes", "Cobol"], { fetcher }), { Kubernetes: "kubernetes" });
  assert.deepEqual(await resolveAtlasTerms(["Cobol", "Kubernetes"], { fetcher }), { Kubernetes: "kubernetes" });
  assert.equal(calls, 1, "a term asked once is never asked again on this page");
  _resetAtlasCache();
  assert.deepEqual(await resolveAtlasTerms(["Go"], { fetcher: async () => { throw new Error("offline"); } }), {}, "a failure is no link");
});

test("D105 P6 · Admin → Data → Atlas carries the editor — add, merge, edges, resources, Check links now, Refresh Wikipedia", () => {
  const tab = read("client/src/panels/adminAtlas.jsx");
  assert.match(tab, /send\("\/api\/admin\/atlas\/nodes", \{ kind, name, definition \}\)/);
  assert.match(tab, /send\("\/api\/admin\/atlas\/merge", \{ winner: winner\.trim\(\), loser: loser\.trim\(\) \}\)/);
  assert.match(tab, /send\(`\/api\/admin\/atlas\/node\/\$\{enc\(slug\)\}\/edges`, \{ to: edge\.to\.trim\(\), type: edge\.type \}\)/);
  assert.match(tab, /send\(`\/api\/admin\/atlas\/node\/\$\{enc\(slug\)\}\/resources`, res\)/);
  assert.match(tab, /send\(`\/api\/admin\/atlas\/resources\/\$\{id\}`, body, "PATCH"\)/);
  assert.match(tab, /api\(`\/api\/admin\/atlas\/resources\/\$\{r\.id\}`, \{ method: "DELETE" \}\)/);
  assert.match(tab, /api\("\/api\/admin\/atlas\/wiki\/refresh", \{ method: "POST" \}\)/);
  // The edge types offered are the five typed ones — never alias_of; a merge asks first (the scorer's thesaurus moves).
  const types = tab.slice(at(tab, "const EDGE_TYPES = ["), at(tab, "const LEVELS"));
  assert.deepEqual([...types.matchAll(/\["(\w+)", "/g)].map(m => m[1]), ["requires", "part_of", "used_with", "alternative_to", "leads_to"]);
  assert.match(tab, /const \{ ask, dialog \} = useConfirm\(\);/);
  assert.doesNotMatch(tab, /\bconfirm\(/);
});
