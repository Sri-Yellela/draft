// ⭐ D167 (owner APPROVED 11-06, docs/sketches/Atlas.html) · ATLAS AS A PRODUCT WITH ITS OWN NAVIGATION — a card of panels
// beside the site's dock (You · Grow · Explore), every panel addressable at /atlas/<panel>, every surface that existed
// kept (docs/D167_ATLAS_MAP.md), and a Glossary from the SAME definitions as D114's popup (one source, D115).
// Synthetic nodes and postings; the server through its real router in memory; the client RENDERED (esbuild +
// react-dom/server, no network — effects do not run, so data panels are rendered through their pure views).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import Database from "better-sqlite3";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { MIGRATIONS } from "../scripts/migrations.js";
import { upsertNode, setStatus } from "../services/atlas/atlasStore.js";
import { peekNode, glossaryTerms, meaningOf } from "../services/atlas/atlasLinks.js";
import { createAtlasRouter } from "../routes/atlas.js";
import { ATLAS_NAV, PANEL_IDS, panelFor, isPanelSlug, panelHref, overviewStats } from "../client/src/pages/atlas/atlasPanels.js";
import { slugOf } from "../services/atlas/atlasStore.js";
import { computeAtlasStats } from "../services/atlas/atlasStats.js";
import { computeYourMap } from "../services/atlas/atlasMe.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const CLIENT = path.resolve("client");
let ui;
async function loadUi() {
  if (ui) return ui;
  const esbuild = createRequire(path.join(CLIENT, "package.json"))("esbuild");
  const abs = (p) => JSON.stringify(path.join(CLIENT, "src", p).split(path.sep).join("/"));
  const out = await esbuild.build({
    stdin: { contents: `import { createElement as h } from "react"; import { renderToStaticMarkup } from "react-dom/server.browser";
        import { MemoryRouter } from "react-router-dom";
        import AtlasPage from ${abs("pages/atlas/AtlasPage.jsx")};
        import { SkillMapView } from ${abs("pages/atlas/SkillMap.jsx")};
        import { OverviewView, MarketView, AuditCard } from ${abs("pages/atlas/AtlasPanels.jsx")};   // 47m (D201): the Glossary is the Gazetteer
        const at = (url, el) => renderToStaticMarkup(h(MemoryRouter, { initialEntries: [url] }, el));
        export const page = (url, base = "/atlas") => at(url, h(AtlasPage, { base }));
        export const skillMap = (m) => at("/app/atlas/your-map", h(SkillMapView, { m, base: "/app/atlas" }));
        export const overview = (props) => at("/atlas", h(OverviewView, { base: "/atlas", ...props }));
        export const market = (roles, cards) => at("/atlas/this-weeks-market", h(MarketView, { base: "/atlas", roles, cards }));
        export const card = (c) => at("/atlas/the-audit", h(AuditCard, { base: "/atlas", card: c }));`,
      resolveDir: CLIENT, loader: "jsx" },
    bundle: true, write: false, format: "esm", platform: "node", jsx: "automatic",
    loader: { ".css": "empty", ".js": "jsx", ".png": "empty", ".svg": "empty" }, logLevel: "silent", define: { "process.env.NODE_ENV": '"production"' },
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d167-ui-")), file = path.join(dir, "ui.mjs");
  fs.writeFileSync(file, out.outputFiles[0].text);
  try { ui = await import(pathToFileURL(file).href); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  return ui;
}

// ⭐ A136: Atlas's card is components/PlaceNav.jsx — the one implementation Profile and Interview use.
const navOf = (html) => html.slice(at(html, '<aside class="pl__nav" aria-label="Atlas"'), at(html, "</aside>", at(html, '<aside class="pl__nav" aria-label="Atlas"')) + 8);
const currentOf = (html) => [...navOf(html).matchAll(/<a [^>]*data-place-item="([^"]+)"[^>]*>/g)].filter(m => /aria-current="page"/.test(m[0])).map(m => m[1]);

/** A synthetic reader with a map (D120's fixture shape): five published nodes, five postings, two profile skills. */
function mapWorld() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  for (const [kind, n] of [["skill", "Python"], ["skill", "SQL"], ["tool", "Kubernetes"], ["tool", "Docker"], ["role", "Data Engineer"]]) {
    upsertNode(db, { kind, name: n, source: "registry" });
    setStatus(db, slugOf(n), "published");
  }
  let j = 0;
  for (const t of ["Python SQL Docker Kubernetes", "Python SQL Kubernetes", "Python SQL Docker", "Python SQL Kubernetes Docker", "SQL Python"]) {
    const id = `j${++j}`;
    db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,url,search_query,_hash,description,is_active) VALUES (?,?,?,?,?,?,?,1)`)
      .run(id, "Data Engineer", "Co", `https://x.test/${id}`, "t", `h${id}`, t);
  }
  for (const [n, f] of [["Python", "data"], ["SQL", "data"], ["Kubernetes", "infra"], ["Docker", "infra"]]) db.prepare(`UPDATE atlas_nodes SET family = ? WHERE name = ?`).run(f, n);
  computeAtlasStats(db, { boardEdges: false });
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (7,'synthetic7','x')").run();
  db.prepare("INSERT INTO user_profile (user_id) VALUES (7)").run();
  for (const [i, s] of ["Python", "SQL"].entries()) db.prepare("INSERT INTO profile_skills (user_id, name, position) VALUES (7,?,?)").run(s, i);
  return db;
}

// ── d167AtlasHasOwnNav ───────────────────────────────────────────────────────────────────────────

// ⛔ 47m (changed on purpose): "D167 · d167AtlasHasOwnNav — the card: the eyebrow, the serif headline, three gro" retired — the surface it pinned was rebuilt in the plate system (47m M5).

// ⛔ 47m (changed on purpose): "D167 · d167AtlasHasOwnNav — every panel has its own address, lit in the nav; the" retired — the surface it pinned was rebuilt in the plate system (47m M5).

// ── d167AtlasKeepsEverySurface ───────────────────────────────────────────────────────────────────

// ⛔ 47m (changed on purpose): "D167 · d167AtlasKeepsEverySurface — every older address still opens, and lights " retired — the surface it pinned was rebuilt in the plate system (47m M5).

// ⛔ 47m (changed on purpose): "D167 · d167AtlasKeepsEverySurface — each existing surface is mounted by its pane" retired — the classic Library / course pages are deleted (D201): courses are Gazetteer routes (pages/atlas/AtlasGazetteer.jsx).

// ⭐ A228 (46r, moved on purpose): "Your map keeps the tree, sections and families" became the skill map's own reading — its
// four sections top to bottom, from one answer of GET /api/atlas/skill-map. Explore by role and Recent stay Roles and skills'.
test("D167 · d167AtlasKeepsEverySurface — Your map is the skill map; the moved pieces draw elsewhere", async () => {
  const u = await loadUi();
  const me = computeYourMap(mapWorld(), 7);
  assert.ok(me.exploreByRole.items.length && me.recent.length, "Roles and skills still reads /api/atlas/me");
  const step = { id: 3, slug: "kubernetes", name: "Kubernetes", kind: "learn", gain: 2, total: 5, hours: 8, estimated: false, published: true, stepId: null, thumb: null,
    companies: [{ name: "Co", iconUrl: null, jobs: 2 }] };
  const html = u.skillMap({ found: true, role: { id: 5, slug: "data-engineer", name: "Data Engineer", open: 5, judged: 5 }, aim: null, current: null, threshold: 0.6,
    skills: { proven: 0, claimed: 2 }, applicable: 3, levels: null,
    histogram: Array.from({ length: 10 }, (_, i) => ({ from: i / 10, to: (i + 1) / 10, jobs: i === 7 ? 3 : i === 3 ? 2 : 0 })),
    asks: [{ id: 1, slug: "python", name: "Python", family: "data", familyName: "Data", jobs: 5, share: 1, state: "claimed", thumb: null }],
    route: { steps: [step], hours: 8, estimated: false },
    move: [{ id: 5, slug: "data-engineer", name: "Data Engineer", open: 5, judged: 5, coverage: 0.5, applicable: 3, carries: [], missing: [], hoursTo30: 0, isAim: false, isCurrent: false, isShown: true }],
    roles: [{ id: 5, slug: "data-engineer", name: "Data Engineer" }] });
  assert.deepEqual([...html.matchAll(/data-skm-section="([^"]+)"/g)].map(m => m[1]), ["number", "close", "wants", "learn", "move", "route"]);   // ⭐ D200 (a) (47i, on purpose): the YourSurvey board's six — + How close (01) and The whole route (05)
  assert.doesNotMatch(html, /data-your-map=""|data-map-section=|data-atlas-home-families=""|data-atlas-explore=""|data-atlas-home-recent=""/);
});

// ⛔ 47m (changed on purpose): "D167 · panels whose feature is not built say so, and draw only numbers that exis" retired — the surface it pinned was rebuilt in the plate system (47m M5).

// ── d167GlossaryOneSourceWithPopups ──────────────────────────────────────────────────────────────

function world() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  const pub = (kind, name, extra = {}) => {
    upsertNode(db, { kind, name, source: "registry", ...extra });
    const slug = slugOf(name);
    setStatus(db, slug, "published");
    return slug;
  };
  const k = pub("tool", "Kubernetes");
  const t = pub("tool", "Terraform", { definition: "Describes cloud infrastructure as code, so a change is reviewed like code." });
  const i = pub("concept", "Idempotent", { definition: "Safe to run twice: doing it again leaves the same result." });
  const z = pub("concept", "Backpressure");   // no definition, no Wikipedia — said honestly
  upsertNode(db, { kind: "tool", name: "Secret Draft", source: "registry", definition: "A draft never shows." });
  const id = (s) => db.prepare(`SELECT id FROM atlas_nodes WHERE slug = ?`).pluck().get(s);
  db.prepare(`INSERT INTO atlas_wiki_cache (node_id, title, extract, page_url, fetched_at) VALUES (?, 'Kubernetes', 'Kubernetes is an orchestration system. It was designed by Google.', 'https://en.wikipedia.org/wiki/Kubernetes', 1)`).run(id(k));
  db.prepare(`INSERT INTO atlas_wiki_cache (node_id, title, extract, page_url, fetched_at) VALUES (?, 'Terraform', 'Terraform is software. It is by HashiCorp.', 'https://en.wikipedia.org/wiki/Terraform', 1)`).run(id(t));
  for (const [s, n] of [[k, 312], [t, 88], [i, 655]]) db.prepare(`INSERT INTO atlas_node_stats (node_id, postings, computed_at) VALUES (?, ?, 1)`).run(id(s), n);
  return { db, slugs: { k, t, i, z } };
}

async function serve(db) {
  const app = express();
  app.use(express.json());
  app.use("/api/atlas", createAtlasRouter(db));
  const srv = app.listen(0);
  await new Promise(r => srv.once("listening", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  return { get: async (p) => { const r = await fetch(base + p); return { status: r.status, headers: r.headers, json: await r.json() }; }, close: () => new Promise(r => srv.close(r)) };
}

test("D167 · d167GlossaryOneSourceWithPopups — every published term, and each says exactly what its popup says", async () => {
  const { db, slugs } = world();
  const terms = glossaryTerms(db);
  assert.deepEqual(terms.map(t => t.name), ["Backpressure", "Idempotent", "Kubernetes", "Terraform"], "published only, by name — the draft never shows");
  for (const t of terms) {
    const p = peekNode(db, t.slug);
    assert.deepEqual([t.meaning, t.fromWikipedia, t.wikipediaUrl, t.postings, t.kind, t.name], [p.meaning, p.fromWikipedia, p.wikipediaUrl, p.postings, p.kind, p.name], t.slug);
  }
  const by = Object.fromEntries(terms.map(t => [t.slug, t]));
  assert.deepEqual([by[slugs.k].meaning, by[slugs.k].fromWikipedia, by[slugs.k].postings], ["Kubernetes is an orchestration system.", true, 312]);
  assert.equal(by[slugs.t].fromWikipedia, false, "draft's own definition wins over Wikipedia's");
  assert.deepEqual([by[slugs.z].meaning, by[slugs.z].postings], [null, 0]);
  // ONE function makes the meaning for both, and nothing else carves a meaning.
  const src = read("services/atlas/atlasLinks.js");
  assert.match(src, /\.\.\.meaningOf\(\{ definition: n\.definition, wikiExtract: n\.wikipedia\?\.extract, wikiPageUrl: n\.wikipedia\?\.pageUrl \}\)/, "the popup");
  assert.match(src, /\.map\(r => \(\{ slug: r\.slug, name: r\.name, kind: r\.kind, \.\.\.meaningOf\(r\), postings: r\.postings \}\)\)/, "the glossary");
  assert.equal(src.match(/slice\(0, PEEK_MEANING_CHARS\)/g).length, 2, "the carve lives in meaningOf and firstSentence only");
  assert.deepEqual(meaningOf({}), { meaning: null, fromWikipedia: false, wikipediaUrl: null });
  // Publishing / unpublishing shows at once through the route (its cache follows the Atlas's change stamp).
  const s = await serve(db);
  try {
    const r = await s.get("/api/atlas/glossary");
    assert.equal(r.status, 200);
    // ⭐ D178 (changed on purpose): the concept index joins the Glossary — the Atlas's terms (each with its lesson when the
    // path teaches it) plus the course's other concepts; the terms keep exactly the popup's words.
    assert.equal(r.json.total, r.json.terms.length + r.json.concepts.length);
    assert.equal(r.json.terms.length, 4);
    assert.ok(r.json.concepts.length > 300, "the course's concepts");
    assert.match(r.headers.get("cache-control"), /^public, max-age=60$/);
    assert.deepEqual(r.json.terms.map(({ learn, ...t }) => t), JSON.parse(JSON.stringify(terms)));
    setStatus(db, slugs.z, "draft");
    assert.equal((await s.get("/api/atlas/glossary")).json.terms.length, 3, "an unpublished term leaves the glossary at once");
  } finally { await s.close(); }
});

// ⛔ 47m (changed on purpose): "D167 · d167GlossaryOneSourceWithPopups — the panel: plain words, postings, the o" retired — the surface it pinned was rebuilt in the plate system (47m M5).
