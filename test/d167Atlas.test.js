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
        import { GlossaryView, OverviewView, MarketView, AuditCard, searchGlossary } from ${abs("pages/atlas/AtlasPanels.jsx")};
        export { searchGlossary };
        const at = (url, el) => renderToStaticMarkup(h(MemoryRouter, { initialEntries: [url] }, el));
        export const page = (url, base = "/atlas") => at(url, h(AtlasPage, { base }));
        export const skillMap = (m) => at("/app/atlas/your-map", h(SkillMapView, { m, base: "/app/atlas" }));
        export const glossary = (terms, q = "", concepts = []) => at("/atlas/glossary", h(GlossaryView, { base: "/atlas", terms, q, concepts }));
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

test("D167 · d167AtlasHasOwnNav — the card: the eyebrow, the serif headline, three groups in the sketch's order", async () => {
  assert.deepEqual(ATLAS_NAV.map(g => [g.group, g.panels.map(p => p.label)]), [
    // ⭐ D172 (3) (changed on purpose): Your run, first in You, as the approved sketch draws it.
    // ⭐ D178 (changed on purpose, the nav regrouped): Overview is the signed-out front page; Your route is in Your map.
    // ⭐ 46u (owner 11-17, changed on purpose): "move your map to the top in atlas and make it the default screen".
    ["You", ["Your map", "Your run", "Your skills"]],
    // ⭐ D172 (2) (changed on purpose): the Library, first in Grow, as the approved sketch draws it.
    // ⭐ D178 (changed on purpose): Learn is the course's circle view, inside the Library.
    // ⭐ A154 (45o, on purpose): How it works — the D172 sketch's panel, second in Grow.
    ["Grow", ["Library", "How it works", "Today's question", "The audit"]],
    ["Explore", ["Roles and skills", "This week's market", "Glossary"]],
  ]);
  const u = await loadUi();
  const html = u.page("/atlas/glossary");
  const nav = navOf(html);
  assert.match(html, /<div class="pl pl--fill" data-place="atlas">/, "the place, inside Atlas's own padded page");
  assert.match(nav, /<p class="pl__eb">Your way through the market<\/p><h1 class="pl__title">Atlas<\/h1>/);
  assert.deepEqual([...nav.matchAll(/<h2 class="pl__glabel">([^<]+)<\/h2>/g)].map(m => m[1]), ["You", "Grow", "Explore"]);
  assert.deepEqual([...nav.matchAll(/data-place-item="([^"]+)"/g)].map(m => m[1]), PANEL_IDS);
  // Real links (keyboard: Tab + Enter, the back button, a reload) — never a button that only swaps state.
  for (const id of PANEL_IDS) assert.match(nav, new RegExp(`<a [^>]*href="${id === "overview" ? "/atlas" : `/atlas/${id}`}"[^>]*data-place-item="${id}"|<a [^>]*data-place-item="${id}"[^>]*href="${id === "overview" ? "/atlas" : `/atlas/${id}`}"`), id);
  assert.doesNotMatch(nav, /<button/);
  // The sketch's style: serif headline, accent eyebrow, a card (rounded, not a capsule) — PlaceNav's, for every place.
  const css = read("client/src/components/PlaceNav.css");
  assert.match(css, /\.pl__eb \{[^}]*color: var\(--c-accent-ink\)/);
  assert.match(css, /\.pl__title \{[^}]*var\(--font-display\)/);
  assert.match(css, /\.pl__nav \{[^}]*border-radius: 24px/);
  for (const f of ["client/src/components/PlaceNav.css", "client/src/pages/atlas/AtlasPanels.css"]) {
    const c = read(f);
    assert.doesNotMatch(c, /border-radius:\s*(999|50%)/, `${f}: no pills (D60)`);
    assert.doesNotMatch(c.replace(/var\(--[a-z0-9-]+\)/g, ""), /#[0-9a-fA-F]{3,8}\b|rgba?\(/, `${f}: every colour a theme token`);
  }
  // ⛔ A136: one implementation — Atlas's own card is gone.
  assert.ok(!fs.existsSync("client/src/pages/atlas/AtlasNav.jsx") && !fs.existsSync("client/src/pages/atlas/AtlasNav.css"));
});

test("D167 · d167AtlasHasOwnNav — every panel has its own address, lit in the nav; the arrow keys move inside the card", async () => {
  const u = await loadUi();
  for (const id of PANEL_IDS) {
    const html = u.page(`/atlas/${id}`);
    assert.match(html, new RegExp(`data-atlas-panel="${id}"`), id);
    assert.deepEqual(currentOf(html), [id], `${id} is the current entry`);
    assert.equal(panelHref("/atlas", id), id === "overview" ? "/atlas" : `/atlas/${id}`);
  }
  // The app mount: the same panels under /app/atlas.
  const app = u.page("/app/atlas/glossary", "/app/atlas");
  assert.match(app, /href="\/app\/atlas\/glossary"/);
  assert.deepEqual(currentOf(app), ["glossary"]);
  // The app's route already accepts /app/atlas/<one segment> (App.jsx atlasRoute) — the panels need no new route.
  // ⭐ D172 (2) (changed on purpose): the rule also admits /app/atlas/library/<course>, a course page.
  assert.match(read("client/src/App.jsx"), /const atlasRoute = \/\^atlas\(\?:\\\/\(\?:family\|library\)\)\?\(\?:\\\/\[\^\/\]\+\)\?\$\/\.test\(routeKey\);/);
  // Keyboard: ↑ / ↓ / Home / End move focus between the card's links (wrapping); Tab reaches every one (real <a href>).
  const nav = read("client/src/components/PlaceNav.jsx");
  assert.match(nav, /const MOVE = \{ ArrowDown: 1, ArrowUp: -1, Home: "first", End: "last" \};/);
  assert.match(nav, /\(i \+ k \+ links\.length\) % links\.length/);
  assert.match(nav, /aria-current=\{it\.id === current \? "page" : undefined\}/);
  assert.match(read("client/src/components/PlaceNav.css"), /\.pl__item:focus-visible \{ outline: 2px solid var\(--c-accent-ink\)/);
  // The panel is a labelled region beside the card (a <section> with a name is a region).
  assert.match(u.page("/atlas/the-audit"), /<section class="pl__panel" data-place-panel="the-audit" id="atlas-panel" aria-label="The audit">/);
});

// ── d167AtlasKeepsEverySurface ───────────────────────────────────────────────────────────────────

test("D167 · d167AtlasKeepsEverySurface — every older address still opens, and lights the panel it now lives in", async () => {
  assert.equal(panelFor("", ""), "overview");
  assert.equal(panelFor("", "k8s"), "roles-and-skills", "the search");
  assert.equal(panelFor("kubernetes"), "roles-and-skills", "a node's page");
  assert.equal(panelFor("data-engineer"), "roles-and-skills", "a role's page");
  assert.equal(panelFor("family/data"), "your-map", "a family's page");
  // ⭐ D178 (changed on purpose): /atlas/learn redirects to the course's circle view and lights the Library.
  assert.equal(panelFor("learn"), "library");
  assert.equal(panelFor("your-route"), "your-map", "D178: Your route is folded into Your map");
  assert.equal(panelFor("overview"), "overview", "D178: /atlas/overview is still the front page");
  assert.equal(panelFor("check"), "your-skills", "D142's check");
  assert.ok(isPanelSlug("check") && isPanelSlug("glossary") && !isPanelSlug("kubernetes") && !isPanelSlug("family/data"));
  const u = await loadUi();
  // A node's address is still a node page (loads the node), inside Roles and skills.
  const node = u.page("/atlas/kubernetes");
  assert.match(node, /data-atlas-page="node"/);
  assert.deepEqual(currentOf(node), ["roles-and-skills"]);
  assert.match(node, /data-atlas-search=""/, "the search box above a node page");
  assert.deepEqual(currentOf(u.page("/atlas?q=k8s")), ["roles-and-skills"]);
  assert.match(u.page("/atlas/family/data"), /data-atlas-page="family"/);
  assert.deepEqual(currentOf(u.page("/atlas/family/data")), ["your-map"]);
  assert.match(u.page("/atlas/learn"), /data-atlas-page="learn"/);
  assert.match(u.page("/atlas/check"), /data-atlas-page="check"[^>]*data-atlas-panel="your-skills"|data-atlas-panel="your-skills"[^>]*data-atlas-page="check"/);
  // Roles and skills draws the search (and, from /api/atlas/me, Explore by role and the recent pages).
  assert.match(u.page("/atlas/roles-and-skills"), /data-atlas-home-search=""[\s\S]*data-atlas-search=""/);
});

test("D167 · d167AtlasKeepsEverySurface — each existing surface is mounted by its panel (the map, docs/D167_ATLAS_MAP.md)", async () => {
  const page = read("client/src/pages/atlas/AtlasPage.jsx");
  const panels = read("client/src/pages/atlas/AtlasPanels.jsx");
  const map = read("client/src/pages/atlas/YourMap.jsx");
  // 1–3 search, node and role pages · 4 a family · 13 Learn — unchanged, inside the shell.
  assert.match(page, /\{!slug && q && <AtlasSearch base=\{base\} q=\{q\} \/>\}/);
  assert.match(page, /<AtlasNodeView base=\{base\} node=\{page\.node\}/);
  assert.match(page, /\{familyKey && <FamilyMap base=\{base\} familyKey=\{familyKey\} \/>\}/);
  // ⭐ D178 (changed on purpose): Learn's address redirects to the course's circle view, which mounts the full Learn view.
  assert.ok(page.includes('{learning && <Navigate replace to={`${base}/library/silicon-to-software?view=circle${location.hash || ""}`} />}'));
  assert.ok(read("client/src/pages/atlas/LibraryPanel.jsx").includes('{view === "circle" && <div data-course-circle-view=""><LearnView signedIn={signedIn} /></div>}'));
  // ⭐ D178: Your route's navigator is drawn inside Your map — ⭐ A228 (moved on purpose): below the skill map, inside the
  // closed "Your route, step by step".
  assert.ok(page.includes('<section className="atl__section" data-atlas-route-in-map=""><YourRoutePanel base={base} signedIn={signedIn} /></section>'));
  // 5, 8, 10, 12 · Your map — ⭐ A228 (46r, owner 11-16 "Build it", moved on purpose): the skill map (SkillMap.jsx) replaces
  // the tree, the course, the five sections and the families on this panel (the tree stays on role and family pages).
  assert.match(page, /\{panel === "your-map" && !familyKey && \(/);
  assert.match(page, /<SkillMap base=\{base\} signedIn=\{signedIn\} \/>/);
  assert.doesNotMatch(page, /<YourMap /);
  // 7 · the navigator is Your route; 6 · its next step (or D120's line) is Overview's Next step.
  assert.match(panels, /<Navigator base=\{base\} fallback=/);
  assert.match(panels, /nav\?\.ready && nav\.next \? \{ text: nav\.next\.text \} : \(me\?\.tree \? directionLine\(me\.tree\) : null\)/);
  // 9, 11 · Explore by role and recently published are Roles and skills'.
  assert.match(panels, /export function RolesPanel[\s\S]*<ExploreByRole roles=\{me\.exploreByRole\?\.items\} base=\{base\} \/>[\s\S]*<Recent items=\{me\.recent\} base=\{base\} \/>/);
  // 14 · D142's check is the Your skills slot (D169 replaces it at merge).
  // ⭐ D169 (merged 45b): the slot holds D169's panel (List + Map), and D142's full check below it keeps its home.
  // ⭐ D178-3 (changed on purpose): the list and map sit under Your skills' "All my skills" tab, beside "For a role".
  // ⭐ A228 (changed on purpose): the ring Map, For a role and Compare roles are retired — the slot is the list + the check.
  assert.match(panels, /data-skills-all="">\n\s+<YourSkillsPanel signedIn=\{signedIn\} base=\{base\} \/>/);
  assert.doesNotMatch(panels, /RoleReadiness|CompareRoles|data-skills-tab=/);
  assert.match(panels, /data-atlas-readiness="" aria-label="The full readiness check">\n\s+<ReadinessCheck signedIn=\{signedIn\} \/>/);
  // 19 · the audit's role card and its counts.
  assert.match(panels, /api\(`\/api\/audit\/role\/\$\{encodeURIComponent\(pick\)\}`\)/);
  assert.match(panels, /api\("\/api\/audit\/roles"\)/);
  // ⭐ A228 (moved on purpose): the old home (AtlasHome / ExploreHome and its parts switch) is retired with the market tree;
  // YourMap.jsx keeps only what other panels read — the role / family trees, Explore by role, Recent, the direction line.
  assert.doesNotMatch(map, /ALL_PARTS|export function AtlasHome|export default function YourMap/);
  assert.match(map, /export function RoleMap[\s\S]*export function FamilyMap/);
  // The mapping doc: 22 surfaces, every panel named, the curator tools kept in Admin.
  const doc = read("docs/D167_ATLAS_MAP.md");
  const rows = [...doc.matchAll(/^\| (\d+) \| \*\*/gm)].map(m => Number(m[1]));
  assert.deepEqual(rows, Array.from({ length: 22 }, (_, i) => i + 1));
  for (const g of ATLAS_NAV) for (const p of g.panels) assert.ok(doc.includes(`**${p.label}**`) || doc.includes(`| ${p.label} |`), p.label);
  assert.match(doc, /\*\*stay in Admin\*\*/);
  // A panel id never collides with a published node's slug in the fixtures' common names.
  for (const name of ["Python", "SQL", "Kubernetes", "Data Engineer", "Machine learning", "Learning", "Market", "Audit", "Roles"]) assert.ok(!isPanelSlug(slugOf(name)), name);
});

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
  assert.deepEqual([...html.matchAll(/data-skm-section="([^"]+)"/g)].map(m => m[1]), ["number", "wants", "learn", "move"]);
  assert.doesNotMatch(html, /data-your-map=""|data-map-section=|data-atlas-home-families=""|data-atlas-explore=""|data-atlas-home-recent=""/);
});

test("D167 · panels whose feature is not built say so, and draw only numbers that exist", async () => {
  const u = await loadUi();
  // Overview: stat cards only from the readiness record and the navigator; no streak, no invented count.
  assert.deepEqual(overviewStats({}), []);
  const stats = overviewStats({ readiness: [{ state: "checked" }, { state: "built" }, { state: "claimed" }], nav: { ready: true, bridges: [{}, {}], route: { role: "Data Engineer", skills: [{}, {}, {}] } } });
  assert.deepEqual(stats.map(s => [s.value, s.panel]), [["2 of 3", "your-skills"], ["2", "your-map"], ["3", "your-map"]]);
  const out = u.overview({ me: { signedIn: false } });
  assert.doesNotMatch(out, /data-atlas-overview-stats/);
  assert.match(out, /One question a day, about two minutes/);   // D154 P1 (45l, on purpose): built
  assert.doesNotMatch(out, /streak/i);
  const signed = u.overview({ me: { signedIn: true, map: true, targetRoles: [{ name: "Data Engineer" }] }, readiness: [{ state: "checked" }], nav: { ready: true, next: { text: "Next up: Kafka" }, bridges: [], route: null } });
  assert.match(signed, /<h1 class="atl__title">Data Engineer<\/h1>/);
  assert.match(signed, /Next up: Kafka/);
  assert.match(signed, /data-atlas-stat="skills"[^>]*><b>1 of 1<\/b>/);
  // Today's question and the market say they are not built.
  assert.match(u.page("/atlas/todays-question"), /data-atlas-panel-body="todays-question"/);   // D154 P1 (45l, on purpose): built
  const m = u.market([{ slug: "data-engineer", title: "Data Engineer", openPostings: 120 }], { "data-engineer": { openThisWeek: 120, newThisWeek: 17 } });
  // ⭐ A233 (46u, changed on purpose): a note card, no ticket code on the page; jobs, not postings.
  assert.match(m, /The weekly view is still being built/);
  assert.doesNotMatch(m, /D150|T09/);
  assert.match(m, /<b>17<\/b><span>new Data Engineer jobs this week · 120 open<\/span>/);
  assert.match(u.market([], {}), /Not enough jobs are sorted into roles yet\./);
  // The audit's card: the board's numbers, the hidden pay said why, its sentence.
  const c = u.card({ slug: "data-engineer", title: "Data Engineer", openThisWeek: 31, newThisWeek: 4, asOf: "2026-11-06", said: "Market data from 31 open postings, not a promise.",
    payRange: { hidden: true, n: 3, why: "Pay is shown once at least 20 of these postings state it (3 do)." }, topRequirements: [{ slug: "sql", name: "SQL", share: 71 }] });
  assert.match(c, /<b>31<\/b> open postings · <b>4<\/b> new in the last 7 days/);
  assert.match(c, /Pay is shown once at least 20/);
  assert.match(c, /href="\/atlas\/sql"[^>]*>SQL<\/a><span class="atl__count"> · 71 % of its postings/);
  // ⭐ D178 (retired on purpose): the Learn panel's stages left with the Learn nav item — the course page's half ring and
  // modules show a module's earned progress now (d178CoursePage).
});

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

test("D167 · d167GlossaryOneSourceWithPopups — the panel: plain words, postings, the one search, Open in Atlas", async () => {
  const { db, slugs } = world();
  const terms = JSON.parse(JSON.stringify(glossaryTerms(db)));
  const u = await loadUi();
  const html = u.glossary(terms);
  assert.match(html, /<h1 class="atl__title">The words the market uses<\/h1>/);
  assert.match(html, /aria-label="Search the glossary"/);
  assert.match(html, /data-glossary-count="">4 terms</);
  assert.match(html, new RegExp(`data-glossary-term="${slugs.k}"[\\s\\S]*?Kubernetes is an orchestration system\\.[\\s\\S]*?From <a href="https://en\\.wikipedia\\.org/wiki/Kubernetes"[^>]*>Wikipedia</a> \\(CC BY-SA\\)[\\s\\S]*?data-glossary-postings="312">312 postings<[\\s\\S]*?href="/atlas/${slugs.k}"[^>]*>Open in Atlas</a>`));
  assert.match(html, /No plain-words definition yet\./);
  // ⭐ D178: the concept index joins — a concept is a row of its own, by name among the terms, with Learn it and no count.
  const withConcepts = u.glossary(terms, "", [{ name: "Cache", meaning: "A fast copy kept close.", learn: { stepId: "s9", label: "Part 1 · Step 9" } }]);
  assert.match(withConcepts, /data-glossary-count="">5 terms</);
  assert.match(withConcepts, /data-glossary-concept="Cache"[\s\S]*?A fast copy kept close\.[\s\S]*?data-glossary-learn="s9"[^>]*href="\/atlas\/library\/silicon-to-software\?view=circle#step-s9"/);
  const names = [...withConcepts.matchAll(/<b>([^<]+)<\/b>/g)].map(m => m[1]);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })), "one list, by name");
  assert.doesNotMatch(withConcepts.slice(at(withConcepts, 'data-glossary-concept="Cache"'), at(withConcepts, "</li>", at(withConcepts, 'data-glossary-concept="Cache"'))), /data-glossary-postings|data-glossary-open/);
  // The search is the ONE normaliser: a prefix, a typo, then a word of the meaning.
  assert.deepEqual(u.searchGlossary(terms, "kube").map(t => t.slug), [slugs.k]);
  assert.deepEqual(u.searchGlossary(terms, "terrafrom").map(t => t.slug), [slugs.t]);
  assert.deepEqual(u.searchGlossary(terms, "orchestration").map(t => t.slug), [slugs.k]);
  assert.match(u.glossary(terms, "kube"), /data-glossary-count="">1 of 4 terms</);
  // The popup and the panel read the same server function, each through its own route.
  assert.match(read("client/src/lib/atlasLinks.js"), /api\(`\/api\/atlas\/peek\/\$\{encodeURIComponent\(slug\)\}`\)/);
  assert.match(read("client/src/pages/atlas/AtlasPanels.jsx"), /api\("\/api\/atlas\/glossary"\)/);
  assert.match(read("client/src/pages/atlas/AtlasPanels.jsx"), /import \{ matchCandidate \} from "\.\.\/\.\.\/\.\.\/\.\.\/shared\/atlasSearchNormalize\.js";/);
});
