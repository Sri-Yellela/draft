// ⭐ D105 P4 (owner 10-30) · THE ATLAS PAGES — search, one node's page, the neighbourhood graph, the top bar's Atlas,
// and Admin → Data → Atlas. The page is RENDERED (esbuild + react-dom/server) against the real API's answers where it
// matters (an in-memory database through routes/atlas.js), not grepped. Synthetic data throughout.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import Database from "better-sqlite3";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { at } from "../test-support/sourceAnchors.js";
import { MIGRATIONS } from "../scripts/migrations.js";
import { upsertNode, addEdge, addAlias, setStatus } from "../services/atlas/atlasStore.js";
import { createAtlasRouter } from "../routes/atlas.js";
import { firstRing, ringLayout, resolveSearch, computedLine, payLine, orderedResources, resourceMeta, relatedGroups, WIKI_LICENCE }
  from "../client/src/pages/atlas/atlasModel.js";
import { MODULES } from "../client/src/modules.manifest.js";
import { ADMIN_GROUPS } from "../client/src/panels/adminMap.js";
import paperLight from "../client/src/themes/paper-light.js";
import charcoalDark from "../client/src/themes/charcoal-dark.js";
import contrastLight from "../client/src/themes/contrast-light.js";
import contrastDark from "../client/src/themes/contrast-dark.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const ATLAS_FILES = ["client/src/pages/atlas/AtlasPage.jsx", "client/src/pages/atlas/AtlasGraph.jsx",
  "client/src/pages/atlas/atlasModel.js", "client/src/pages/atlas/AtlasPage.css", "client/src/panels/adminAtlas.jsx",
  // ⭐ D172 (changed on purpose): the redesign's files are Atlas files too — their tokens must exist in all four themes.
  "client/src/pages/atlas/LibraryPanel.jsx", "client/src/pages/atlas/LibraryPanel.css", "client/src/pages/atlas/YourRun.jsx",
  "client/src/pages/atlas/YourRun.css", "client/src/pages/atlas/TrackBoard.jsx", "client/src/pages/atlas/TrackBoard.css",
  "client/src/pages/atlas/LibraryGuides.jsx", "client/src/pages/atlas/LessonDeck.jsx",
  // ⭐ A228 (46r, changed on purpose): For a role / Compare roles retired; the skill map's files are Atlas files too.
  "client/src/pages/atlas/SkillMap.jsx", "client/src/pages/atlas/SkillMap.css", "client/src/pages/atlas/SkillMapBits.jsx", "client/src/pages/atlas/JobsHistogram.jsx",
  "client/src/pages/atlas/SkillTreemap.jsx", "client/src/pages/atlas/LearnNextChart.jsx", "client/src/pages/atlas/MoveRolesScatter.jsx"];

// ── the page, rendered ──────────────────────────────────────────────────────────────────────────────
const CLIENT = path.resolve("client");
const requireClient = createRequire(path.join(CLIENT, "package.json"));
let ui;
async function loadUi() {
  if (ui) return ui;
  const esbuild = requireClient("esbuild");
  const abs = (p) => JSON.stringify(path.join(CLIENT, "src", p).split(path.sep).join("/"));
  const result = await esbuild.build({
    stdin: {
      contents: `
        import { createElement as h } from "react";
        import { renderToStaticMarkup } from "react-dom/server.browser";
        import { MemoryRouter } from "react-router-dom";
        import { AtlasNodeView, WikipediaBlock } from ${abs("pages/atlas/AtlasPage.jsx")};
        import AtlasGraph from ${abs("pages/atlas/AtlasGraph.jsx")};
        const wrap = (el) => renderToStaticMarkup(h(MemoryRouter, null, el));
        export const nodeView = (node) => wrap(h(AtlasNodeView, { base: "/atlas", node, onWalk: () => {} }));
        export const wiki = (w) => wrap(h(WikipediaBlock, { wiki: w }));
        export const graph = (node, max) => wrap(h(AtlasGraph, { node, max, hrefFor: (s) => "/atlas/" + s }));`,
      resolveDir: CLIENT, loader: "jsx",
    },
    bundle: true, write: false, format: "esm", platform: "node", jsx: "automatic",
    loader: { ".css": "empty", ".js": "jsx", ".png": "empty", ".svg": "empty", ".jpg": "empty", ".webp": "empty", ".woff2": "empty" }, logLevel: "silent",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d105-ui-"));
  const file = path.join(dir, "ui.mjs");
  fs.writeFileSync(file, result.outputFiles[0].text);
  try { ui = await import(pathToFileURL(file).href); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
  return ui;
}

// ── the real API, in memory ─────────────────────────────────────────────────────────────────────────
function fixtureDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  const role = upsertNode(db, { kind: "role", name: "Platform Engineer", definition: "Builds the systems other engineers ship on." }).id;
  const k8s = upsertNode(db, { kind: "tool", name: "Kubernetes", definition: "Runs containers across many machines." }).id;
  const helm = upsertNode(db, { kind: "tool", name: "Helm" }).id;
  const tf = upsertNode(db, { kind: "tool", name: "Terraform" }).id;
  const nomad = upsertNode(db, { kind: "tool", name: "Nomad" }).id;
  const go = upsertNode(db, { kind: "skill", name: "Go" }).id;           // second ring: Helm's neighbour, not Kubernetes's
  addEdge(db, role, k8s, "requires", "registry");
  addEdge(db, role, tf, "requires", "registry");
  addEdge(db, k8s, helm, "used_with", "owner");
  addEdge(db, k8s, nomad, "alternative_to", "owner");
  addEdge(db, helm, go, "used_with", "owner");
  for (const s of ["platform-engineer", "kubernetes", "helm", "terraform", "nomad", "go"]) setStatus(db, s, "published");
  addAlias(db, k8s, "k8s");
  db.prepare(`INSERT INTO atlas_wiki_cache (node_id, title, extract, page_url, fetched_at) VALUES (?,?,?,?,?)`)
    .run(k8s, "Kubernetes", "Kubernetes is an open-source container orchestration system.", "https://en.wikipedia.org/wiki/Kubernetes", 1);
  db.prepare(`INSERT INTO atlas_resources (node_id, url, title, level, format, hours, cost, checked_at) VALUES (?,?,?,?,?,?,?,?)`)
    .run(k8s, "https://paid.example/k8s", "A paid course", "intermediate", "course", 12, "$49", 1793318400);
  db.prepare(`INSERT INTO atlas_resources (node_id, url, title, level, format, hours, cost, checked_at) VALUES (?,?,?,?,?,?,?,?)`)
    .run(k8s, "https://free.example/k8s", "The free tutorial", "beginner", "tutorial", 3, "free", 1793318400);
  db.prepare(`INSERT INTO atlas_node_stats (node_id, postings, top_skills_json, top_roles_json, pay_min_usd, pay_median_usd, pay_max_usd, pay_n, computed_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(k8s, 42, JSON.stringify([{ slug: "helm", name: "Helm", postings: 17 }]),
    JSON.stringify([{ slug: "platform-engineer", name: "Platform Engineer", postings: 30 }]), 120000, 150000, 190000, 9, 1793318400);
  return db;
}
async function serve(db, user = null) {
  const app = express();
  app.use(express.json());
  if (user) app.use((req, _r, n) => { req.user = user; n(); });
  app.use("/api/atlas", createAtlasRouter(db));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const calls = [];
  // ⭐ the MOCK FETCH: the client's own api() runs unchanged; a relative path is answered by the real router.
  const realFetch = globalThis.fetch;
  globalThis.fetch = (p, opts) => { calls.push(String(p)); return realFetch(String(p).startsWith("/") ? base + p : p, opts); };
  return { calls, close: () => { globalThis.fetch = realFetch; server.close(); },
    get: (p) => realFetch(base + p).then(r => r.json()) };
}

test("D105 P4 · d105AliasSearch (client) — 'k8s' in the search box lands on Kubernetes, through the client's own api()", async () => {
  const db = fixtureDb();
  const s = await serve(db);
  try {
    const r = await resolveSearch("k8s");
    assert.equal(s.calls[0], "/api/atlas/search?q=k8s", "the box asks the public search route");
    assert.equal(r.go, "kubernetes");
    assert.equal(r.via, "alias", "resolved through skill_synonyms — the one thesaurus");
    assert.equal((await resolveSearch("Kubernetes")).via, "name");
    // BUG 10-31 (the normalised search): a prefix counts from 2 characters, so one letter lists nothing…
    assert.deepEqual((await resolveSearch("e")).results, []);
    assert.equal((await resolveSearch("kube")).go, "kubernetes", "…and a prefix with one answer is a place to go");
    // A partial word with several answers is a LIST, not a jump.
    const many = await resolveSearch("he", async () => ({ results: [{ slug: "helm", kind: "tool", name: "Helm", via: "prefix" },
      { slug: "heroku", kind: "tool", name: "Heroku", via: "prefix" }] }));
    assert.ok(many.results.length > 1);
    assert.equal(many.go, null);
    assert.deepEqual(await resolveSearch("   "), { q: "", results: [], go: null, via: null }, "an empty box asks nothing");
  } finally { s.close(); }
  // Mocked outright: one partial match is a place to go; nothing is a list of nothing.
  const one = await resolveSearch("pyt", async () => ({ results: [{ slug: "python", kind: "tool", name: "Python", via: "match" }] }));
  assert.equal(one.go, "python");
  assert.equal((await resolveSearch("zzz", async () => ({ results: [] }))).go, null);
  // The page wires it: an exact hit REPLACES the search address with the page, carrying what was typed.
  const page = read("client/src/pages/atlas/AtlasPage.jsx");
  assert.match(page, /if \(r\.go\) navigate\(`\$\{base\}\/\$\{encodeURIComponent\(r\.go\)\}`, \{ replace: true, state: \{ from: r\.q, via: r\.via \} \}\);/);
  assert.match(page, /“\{from\.q\}” is another name for \{node\.name\}\./);
});

test("D105 P4 · the graph draws the FIRST RING only — each neighbour once, never itself, never a neighbour's neighbour", async () => {
  const db = fixtureDb();
  const s = await serve(db);
  let node;
  try { node = await s.get("/api/atlas/node/kubernetes"); } finally { s.close(); }
  const { graph } = await loadUi();
  const ring = firstRing(node);
  assert.deepEqual(ring.ring.map(n => n.slug).sort(), ["helm", "nomad", "platform-engineer"]);
  const html = graph(node);
  const drawn = [...html.matchAll(/data-graph-node="([^"]+)"/g)].map(m => m[1]).sort();
  assert.deepEqual(drawn, ["helm", "nomad", "platform-engineer"]);
  assert.doesNotMatch(html, /data-graph-node="go"/, "Go is Helm's neighbour — the second ring is a walk, not the drawing");
  assert.match(html, /data-graph-centre="kubernetes"/);
  assert.match(html, /data-ring="3"/);
  // Click to walk, keyboard reachable: every neighbour is a real link (Tab reaches it, Enter follows it).
  for (const slug of drawn) assert.match(html, new RegExp(`<a href="/atlas/${slug}" class="atl__gnode" data-graph-node="${slug}" aria-label="[^"]+"`));
  // Duplicates and self-edges collapse; a crowded node caps the ring and says how many more are in the lists.
  const crowded = { slug: "x", name: "X", kind: "skill", related: [
    { type: "used_with", dir: "out", slug: "x", name: "X", kind: "skill" },
    ...Array.from({ length: 15 }, (_, i) => ({ type: "used_with", dir: i % 2 ? "in" : "out", slug: `n${i}`, name: `N${i}`, kind: "tool" })),
    { type: "requires", dir: "in", slug: "n1", name: "N1", kind: "tool" }] };
  assert.equal(firstRing(crowded).ring.length, 12);
  assert.equal(firstRing(crowded).more, 3);
  assert.ok(!firstRing(crowded).ring.some(n => n.slug === "x"));
  assert.match(graph(crowded), /\+3 more in the lists/);
  // The layout stays inside its box (it scales to a phone's column; nothing spills).
  for (const n of ringLayout(crowded).ring) { assert.ok(n.x > 0 && n.x < 440 && n.y > 0 && n.y < 300); }
  assert.equal(graph({ slug: "lone", name: "Lone", kind: "skill", related: [] }), "", "no neighbours, no graph");
});

test("D105 P4 · d105WikiAttributed (client) — the From Wikipedia block carries its licence line and links, apart from the definition", async () => {
  const db = fixtureDb();
  const s = await serve(db);
  let node;
  try { node = await s.get("/api/atlas/node/kubernetes"); } finally { s.close(); }
  const { nodeView, wiki } = await loadUi();
  const html = nodeView(node);
  const def = html.slice(at(html, "data-atlas-definition"), at(html, "data-atlas-board"));
  assert.match(def, /Runs containers across many machines\./);
  assert.doesNotMatch(def, /open-source container orchestration/, "Wikipedia's words are never merged into draft's definition");
  const block = html.slice(at(html, 'data-atlas-wiki=""'));
  assert.match(block, />From Wikipedia</);
  assert.match(block, /open-source container orchestration system\./);
  assert.match(block, /From Wikipedia, CC BY-SA 4\.0/);
  assert.match(block, /href="https:\/\/en\.wikipedia\.org\/wiki\/Kubernetes"/, "the article is linked");
  assert.match(block, /href="https:\/\/creativecommons\.org\/licenses\/by-sa\/4\.0\/"/, "the licence is linked");
  assert.ok(at(html, "data-atlas-wiki") > at(html, "data-atlas-definition"), "its own block, after draft's words");
  // Even a block that arrived without its licence never renders without the line.
  const bare = wiki({ title: "T", extract: "Some text.", pageUrl: "https://en.wikipedia.org/wiki/T" });
  assert.match(bare, new RegExp(WIKI_LICENCE.line.replace(/\./g, "\\.")));
  assert.match(bare, /creativecommons\.org\/licenses\/by-sa\/4\.0/);
  assert.equal(wiki(null), "", "no cache, no block");
});

test("D105 P4 · the page — name, aliases, kind; On the board with its provenance; typed Related lists; Resources free first", async () => {
  const db = fixtureDb();
  const s = await serve(db);
  let node;
  try { node = await s.get("/api/atlas/node/kubernetes"); } finally { s.close(); }
  const { nodeView } = await loadUi();
  const html = nodeView(node);
  assert.match(html, /<h1 class="atl__title">Kubernetes<\/h1>/);
  assert.match(html, /Also called: k8s/);
  assert.match(html, /class="mark mark--accent">Tool or tech</);
  assert.match(html, /<b>42<\/b> open jobs ask for it/);
  assert.match(html, /counted from 42 open jobs on 30 Oct 2026/);
  assert.match(html, /\$120k – \$190k, median \$150k/);
  assert.match(html, /href="\/atlas\/helm"/);
  assert.equal(computedLine({ postings: 1, computedAt: 1793318400 }), "counted from 1 open job on 30 Oct 2026");
  assert.equal(payLine(null), null, "no posting stated pay — no range is invented");
  // Related: the typed edges, named from this page's side.
  assert.deepEqual(relatedGroups(node.related).map(g => [g.title, g.items.map(i => i.slug)]),
    [["Asked for by", ["platform-engineer"]], ["Used with", ["helm"]], ["Alternatives", ["nomad"]]]);
  assert.match(html, /data-edge-group="alternative_to"><h3 class="atl__h3">Alternatives</);
  // Resources: free first; level · format · hours · cost · last checked; links out.
  const res = html.slice(at(html, "data-atlas-resources"), at(html, 'data-atlas-wiki=""'));
  assert.ok(at(res, "The free tutorial") < at(res, "A paid course"), "free first");
  assert.match(res, /beginner · tutorial · 3 h · Free · checked 30 Oct 2026/);
  assert.match(res, /href="https:\/\/free\.example\/k8s" target="_blank" rel="noopener noreferrer"/);
  assert.deepEqual(orderedResources([{ cost: "$5" }, { cost: "free" }]).map(r => r.cost), ["free", "$5"]);
  assert.deepEqual(resourceMeta({ format: "video" }), ["video", "not checked yet"]);
});

test("D105 P4 · d105YouOnlyWhenSignedIn (client) — 'You: have / partial / missing' only when the API sent `you`", async () => {
  const db = fixtureDb();
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (7,'dana','x')").run();
  db.prepare("INSERT INTO profile_skills (user_id, name) VALUES (7, 'Kubernetes')").run();
  const { nodeView } = await loadUi();
  const anon = await serve(db);
  let a; try { a = await anon.get("/api/atlas/node/platform-engineer"); } finally { anon.close(); }
  assert.doesNotMatch(nodeView(a), /data-atlas-you|You: /, "signed out: no comparison");
  const signed = await serve(db, { id: 7 });
  let b; try { b = await signed.get("/api/atlas/node/platform-engineer"); } finally { signed.close(); }
  const html = nodeView(b);
  assert.match(html, /data-atlas-you="partial"/);
  assert.match(html, /class="mark mark--warn">You: partial</);
  assert.match(html, /Missing: <span><a class="atl__link" href="\/atlas\/terraform"/);
  assert.doesNotMatch(nodeView({ ...b, you: null }), /data-atlas-you/, "a non-role page (you: null) shows nothing");
});

test("D105 P4 · d105FourThemes — the Atlas reads theme tokens only: no colour literal, and every token exists in all four themes", () => {
  const LITERAL = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|(["'`])(?:white|black)\1|:\s*(?:white|black)\s*[;}!]/g;
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
  const themes = [paperLight, charcoalDark, contrastLight, contrastDark];
  assert.equal(new Set(themes.map(t => t.id)).size, 4);
  const cssName = (k) => `--c-${k.toLowerCase().replace(/_/g, "-")}`;
  const used = new Set();
  for (const f of ATLAS_FILES) {
    const src = strip(read(f));
    assert.deepEqual(src.match(LITERAL) || [], [], `${f} paints a literal colour`);
    for (const m of src.matchAll(/var\((--c-[a-z0-9-]+)\)/g)) used.add(m[1]);
    assert.doesNotMatch(src, /var\(--color-/, `${f}: the Atlas reads the D91 tokens (--c-*), not the legacy aliases`);
  }
  assert.ok(used.size >= 10, "the stylesheet paints through tokens");
  for (const t of themes) {
    const names = new Set(Object.keys(t.tokens).map(cssName));
    for (const u of used) assert.ok(names.has(u), `${u} is not a token of ${t.id}`);
  }
  // The admin panel reads C.* — every one a token in every theme.
  for (const m of read("client/src/panels/adminAtlas.jsx").matchAll(/\bC\.([A-Z_]+)/g)) {
    for (const t of themes) assert.ok(m[1] in t.tokens, `C.${m[1]} is not a token of ${t.id}`);
  }
});

test("D105 P4 · phone width — nothing in the Atlas is wider than its column; no capsules (D60)", () => {
  const css = read("client/src/pages/atlas/AtlasPage.css");
  for (const m of css.replace(/@media[^{]*\{/g, "").matchAll(/(?<![-\w])(width|min-width)\s*:\s*(\d+)px/g)) assert.ok(Number(m[2]) <= 320, `a fixed ${m[1]} of ${m[2]}px overflows a phone`);
  assert.match(css, /\.atl \{[^}]*overflow-wrap: anywhere/);
  assert.match(css, /\.atl__graph svg \{[^}]*width: 100%;[^}]*max-width: 100%/);
  assert.match(css, /repeat\(auto-fit, minmax\(min\(180px, 100%\), 1fr\)\)/, "the columns collapse to one on a phone");
  assert.match(css, /\.atl__search \{[^}]*flex-wrap: wrap/);
  assert.match(css, /\.atl \{[^}]*padding: 32px var\(--page-gutter\) 64px/, "a 16px side gutter");
  assert.doesNotMatch(css, /border-radius:\s*(999|50%)/);
  const page = read("client/src/pages/atlas/AtlasPage.jsx");
  assert.match(page, /className="mark mark--/, "status and kind are marks");
  assert.match(page, /<DepthButton primary type="submit">Look up<\/DepthButton>/, "the one action is a depth box");
});

test("D105 P4 · the top bar gains Atlas; /atlas is public and a signed-in reader gets the same page in the app", () => {
  const app = read("client/src/App.jsx");
  const tabs = app.slice(at(app, "const appTabs = ["), at(app, "];", at(app, "const appTabs = [")));
  assert.deepEqual([...tabs.matchAll(/\{ id: "([^"]+)",\s*label: "([^"]+)" \}/g)].map(m => m[2]),
    ["Home", "Home", "Atlas"]); // ⭐ D146: The Table merged into Home · ⭐ D152: Daily Deck + Full House = Home
  // The tab routes through the ONE tab → path mapping (NAVIGABLE_TABS is derived from appTabs), and the page mounts.
  assert.match(app, /new Set\(\[\.\.\.appTabs\.map\(t => t\.id\)/);
  // + D116 M7: /app/atlas/family/:key is a page too.
  // ⭐ D172 (2) (changed on purpose): the rule also admits /app/atlas/library/<course>, a course page.
  // ⭐ D197 #6 (47h, changed on purpose): and /app/atlas/region/<n>, a region of Volume I.
  assert.match(app, /const atlasRoute = \/\^atlas\(\?:\\\/\(\?:family\|library\|region\)\)\?\(\?:\\\/\[\^\/\]\+\)\?\$\/\.test\(routeKey\);/);
  // ⭐ D167 (changed on purpose): Profile's and Interview's panel addresses are not bounced either.
  assert.match(app, /if \(!jobRoute && !atlasRoute && !companyRoute && profilePanel === undefined && interviewPanel === undefined[\s\S]{0,160}?routeKey !== CONSOLE_ROUTE && !NAVIGABLE_TABS\.has\(routeKey\)\)/, "/app/atlas/<slug> is not bounced");
  assert.match(app, /\{activeTab === "atlas"\s+&& <AtlasPage base="\/app\/atlas"\/>\}/);
  // Public: no gate around it — signed out, the page with the marketing chrome; signed in, the same page in the app.
  const route = app.slice(at(app, '<Route path="/atlas/*"'), at(app, "}/>", at(app, '<Route path="/atlas/*"')));
  assert.doesNotMatch(route, /UserRouteGate|AdminRouteGate|requireAuth/);
  assert.match(route, /<AtlasPage base="\/atlas" publicChrome\/>/);
  assert.match(route, /<SamePageInApp\/>/);   // ⛔ 47j w1-shell (changed on purpose): AtlasInApp renamed — /companies/<slug> uses it too
  assert.match(app, /return <Navigate to=\{`\/app\$\{pathname\}\$\{search\}`\} replace\/>;/);
  // The signed-out navs reach it too.
  assert.match(read("client/src/components/ScrollDock.jsx"), /\{ label: "Atlas",\s+to: "\/atlas" \}/);
  assert.match(read("client/src/components/NavBar.jsx"), /\{ to: '\/atlas',\s+label: 'Atlas'\s+\}/);
});

test("D105 P4 · Admin → Data → Atlas lists the drafts and publishes them; the module manifest logs every new file", () => {
  const data = ADMIN_GROUPS.find(g => g.id === "data");
  assert.ok(data.sections.some(([id, label]) => id === "atlas" && label === "Atlas"));
  const panel = read("client/src/panels/AdminPanel.jsx");
  // 45q D185-3 (pin moved on purpose): the Atlas tab now also draws the content backlog beside it.
  // A154 (45s): + the Compete switches (changed on purpose).
  assert.match(panel, /\{at\("data", "atlas"\) && <><AtlasTab\/><AtlasBacklogSection\/><AtlasCompeteSection\/><\/>\}/);
  const tab = read("client/src/panels/adminAtlas.jsx");
  assert.match(tab, /api\(`\/api\/admin\/atlas\$\{status \? `\?status=\$\{status\}` : ""\}`\)/);
  assert.match(tab, /`\/api\/admin\/atlas\/\$\{encodeURIComponent\(r\.slug\)\}\/status`, \{ method: "POST", body: JSON\.stringify\(\{ status: next \}\) \}/);
  assert.match(tab, /useState\("draft"\)/, "drafts first — the owner's first job is publishing");
  assert.doesNotMatch(tab, /\bconfirm\(/);
  // A93: the page's parts are one module; the admin tab is the admin console's.
  assert.deepEqual(MODULES.atlas.members.slice().sort(),
    ["App.jsx", "pages/atlas/AtlasGraph.jsx", "pages/atlas/AtlasPage.jsx", "pages/atlas/LearnView.jsx", "pages/atlas/atlasModel.js", "pages/atlas/learnModel.js",
      "pages/atlas/AtlasTree.jsx", "pages/atlas/YourMap.jsx", "pages/atlas/atlasTreeLayout.js", "pages/atlas/atlasTreeModel.js",
      "pages/atlas/LearnCircle.jsx", "pages/atlas/LearnWheel.jsx", "pages/atlas/learnWheel.js",
      "pages/atlas/Navigator.jsx", "pages/atlas/ReadinessCheck.jsx",
      "pages/atlas/AtlasPanels.jsx", "pages/atlas/atlasPanels.js", "pages/atlas/CompetePanels.jsx", "pages/atlas/competeModel.js", "pages/atlas/LibraryPanel.jsx", "pages/atlas/PathwayArt.jsx", "pages/atlas/libraryModel.js", "pages/atlas/YourRun.jsx", "pages/atlas/yourRunModel.js", "pages/atlas/TrackBoard.jsx", "pages/atlas/trackModel.js", "pages/atlas/LibraryGuides.jsx", "pages/atlas/LessonDeck.jsx",
      "pages/atlas/DeckPlay.jsx", "pages/atlas/deckPlay.js",   // ⭐ D194 (46z, moved on purpose): the played deck (Watch / Read)
      "pages/network/FeedDeck.jsx",   // ⭐ D194 P4 (47c, moved on purpose): the feed plays a shared deck with the Library's player
      "pages/atlas/BankAnswers.jsx", "pages/atlas/PieceQuestions.jsx",   // ⭐ D150 T14 (46y): the bank's answer parts (moved out of AtlasPanels) + a piece's questions
      "pages/atlas/SkillMap.jsx", "pages/atlas/SkillMapBits.jsx", "pages/atlas/JobsHistogram.jsx", "pages/atlas/SkillTreemap.jsx", "pages/atlas/LearnNextChart.jsx", "pages/atlas/MoveRolesScatter.jsx", "pages/atlas/skillMapModel.js",
      "pages/atlas/AtlasVolume.jsx", "pages/atlas/volumeModel.js"].sort());   // ⭐ D197 #5–#7 (47h, moved on purpose): Volume I, a region, the Library in the plate system   // ⭐ A228 (46r): + the skill map, − Your course, For a role, Compare roles (retired)   // + D172 (2) the Library, + D115 Learn, + D116 the tree, + D117 the circle, + D120 the course on the home, + D117 C12 the deck, + D143 the navigator, + D142 the check, + D167 its own navigation
  assert.deepEqual(MODULES.atlas.css, ["pages/atlas/AtlasPage.css", "pages/atlas/LearnView.css", "pages/atlas/LearnCircle.css", "pages/atlas/AtlasTree.css", "pages/atlas/AtlasPanels.css", "pages/atlas/LibraryPanel.css", "pages/atlas/YourRun.css", "pages/atlas/TrackBoard.css", "pages/atlas/CompetePanels.css", "pages/atlas/SkillMap.css"]);   // ⭐ A228: − RoleReadiness.css (its tabs moved to LibraryPanel.css), + SkillMap.css   // ⭐ A136: the nav card is components/PlaceNav.jsx   // + D115 Learn, + D117 the circle, + D116 the tree, + D167 the nav
  assert.ok(MODULES.admin.members.includes("panels/adminAtlas.jsx"));
  for (const f of [...MODULES.atlas.members, ...MODULES.atlas.css]) assert.ok(fs.existsSync(`client/src/${f}`), f);
});
