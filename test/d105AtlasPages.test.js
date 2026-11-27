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
const ATLAS_FILES = ["client/src/pages/atlas/AtlasPage.jsx", 
  "client/src/pages/atlas/atlasModel.js", "client/src/pages/atlas/AtlasPage.css", "client/src/panels/adminAtlas.jsx",
  // ⭐ D172 (changed on purpose): the redesign's files are Atlas files too — their tokens must exist in all four themes.
  "client/src/pages/atlas/LibraryPanel.css", 
  "client/src/pages/atlas/YourRun.css", "client/src/pages/atlas/TrackBoard.jsx", "client/src/pages/atlas/TrackBoard.css",
  "client/src/pages/atlas/LibraryGuides.jsx", 
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

// ⛔ 47m (changed on purpose): "D105 P4 · d105AliasSearch (client) — 'k8s' in the search box lands on Kubernetes" retired — the surface it pinned was rebuilt in the plate system (47m M5).

// ⛔ 47m (changed on purpose): "D105 P4 · the graph draws the FIRST RING only — each neighbour once, never itsel" retired — the surface it pinned was rebuilt in the plate system (47m M5).

// ⛔ 47m (changed on purpose): "D105 P4 · d105WikiAttributed (client) — the From Wikipedia block carries its lic" retired — the surface it pinned was rebuilt in the plate system (47m M5).

// ⛔ 47m (changed on purpose): "D105 P4 · the page — name, aliases, kind; On the board with its provenance; type" retired — the surface it pinned was rebuilt in the plate system (47m M5).

// ⛔ 47m (changed on purpose): "D105 P4 · d105YouOnlyWhenSignedIn (client) — 'You: have / partial / missing' onl" retired — the surface it pinned was rebuilt in the plate system (47m M5).

// ⛔ 47m (changed on purpose): "D105 P4 · d105FourThemes — the Atlas reads theme tokens only: no colour literal," retired — the surface it pinned was rebuilt in the plate system (47m M5).

// ⛔ 47m (changed on purpose): "D105 P4 · phone width — nothing in the Atlas is wider than its column; no capsul" retired — the surface it pinned was rebuilt in the plate system (47m M5).

// ⛔ 47m (changed on purpose): "D105 P4 · the top bar gains Atlas; /atlas is public and a signed-in reader gets " retired — NavBar is deleted: the signed-out nav is PublicChrome (D197 #16).

// ⛔ 47m (changed on purpose): "D105 P4 · Admin → Data → Atlas lists the drafts and publishes them; the module m" retired — the classic Library / course pages are deleted (D201): courses are Gazetteer routes (pages/atlas/AtlasGazetteer.jsx).
