// ⭐ D105 P12 (owner 10-31) · ROLE PAGES PUBLISH ON BOARD DATA — a node of kind role with ≥ 5 open jobs publishes
// with no Wikipedia summary and no definition; its page is the board's own data (top skills with shares, levels from
// D106, pay where postings state it, companies hiring, D116's "to reach the next level"). Every other kind keeps the
// old bar. Synthetic nodes, companies and postings; an in-memory database; nothing here touches the network.
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
import { computeAtlasStats } from "../services/atlas/atlasStats.js";
import { autoPublish, readiness, READINESS_COLUMNS, BOARD_DATA_KINDS } from "../services/atlas/atlasPublish.js";
import { createAtlasRouter } from "../routes/atlas.js";

// ── the page, rendered (the same esbuild + react-dom/server harness as d105AtlasPages) ───────────────────────────
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
        import { AtlasNodeView } from ${abs("pages/atlas/AtlasPage.jsx")};
        export const nodeView = (node) => renderToStaticMarkup(h(MemoryRouter, null, h(AtlasNodeView, { base: "/atlas", node, onWalk: () => {} })));`,
      resolveDir: CLIENT, loader: "jsx",
    },
    bundle: true, write: false, format: "esm", platform: "node", jsx: "automatic",
    loader: { ".css": "empty", ".js": "jsx", ".png": "empty", ".svg": "empty", ".jpg": "empty", ".webp": "empty", ".woff2": "empty" }, logLevel: "silent",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d105-role-ui-"));
  const file = path.join(dir, "ui.mjs");
  fs.writeFileSync(file, result.outputFiles[0].text);
  try { ui = await import(pathToFileURL(file).href); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
  return ui;
}

// ── the board ──────────────────────────────────────────────────────────────────────────────────────────────────
function fixtureDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  return db;
}
const status = (db, slug) => db.prepare(`SELECT status FROM atlas_nodes WHERE slug = ?`).pluck().get(slug);
const why = (db, slug) => readiness(db.prepare(`SELECT ${READINESS_COLUMNS} FROM atlas_nodes n LEFT JOIN atlas_node_stats s ON s.node_id = n.id WHERE n.slug = ?`).get(slug));
let seq = 0;
function post(db, title, text, { level = null, company = "Synthetic Co", pay = null } = {}) {
  const id = `r${++seq}`;
  db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,url,search_query,_hash,description,is_active,level_read,salary_min_usd,salary_max_usd)
    VALUES (?,?,?,?,?,?,?,1,?,?,?)`).run(id, title, company, `https://x.test/${id}`, "t", `h${id}`, text, level, pay?.[0] ?? null, pay?.[1] ?? null);
}
/**
 * Backend Engineer: 62 jobs, no definition, no Wikipedia — 20 early (Python), 20 mid (Python + Kubernetes), 20
 * senior (Python + Kubernetes + Terraform, pay stated), 2 with no level read. Data Engineer: 4 postings.
 */
function board() {
  const db = fixtureDb();
  for (const [kind, name] of [["role", "Backend Engineer"], ["role", "Data Engineer"], ["skill", "Python"], ["tool", "Kubernetes"], ["tool", "Terraform"]])
    upsertNode(db, { kind, name, source: "registry" });
  for (let i = 0; i < 20; i++) post(db, "Backend Engineer", "You write Python.", { level: "early", company: "Acme Synthetic" });
  for (let i = 0; i < 20; i++) post(db, "Backend Engineer", "Python services on Kubernetes.", { level: "mid", company: "Globex Synthetic" });
  for (let i = 0; i < 20; i++) post(db, "Senior Backend Engineer", "Python, Kubernetes and Terraform.", { level: "senior", company: "Globex Synthetic", pay: [150000, 170000] });
  for (let i = 0; i < 2; i++) post(db, "Backend Engineer", "Python.", { company: "Initech Synthetic" });
  for (let i = 0; i < 4; i++) post(db, "Data Engineer", "Python pipelines.");
  computeAtlasStats(db, { boardEdges: false });
  return db;
}

test("D105 P12 · d105RolePublishesOnBoardData — a role with ≥ 5 open jobs publishes with no Wikipedia summary and no definition", () => {
  const db = board();
  assert.deepEqual(BOARD_DATA_KINDS, ["role"]);
  assert.equal(db.prepare(`SELECT COUNT(*) FROM atlas_wiki_cache`).pluck().get(), 0, "no summary anywhere");
  assert.equal(db.prepare(`SELECT definition FROM atlas_nodes WHERE slug = 'backend-engineer'`).pluck().get(), null, "no definition");
  // The admin list says the role is ready before the run…
  assert.equal(why(db, "backend-engineer").ready, true);
  assert.deepEqual(why(db, "backend-engineer").missing, []);
  assert.deepEqual(why(db, "data-engineer").missing, ["postings 4 of 5"], "the postings half of the bar still holds for a role");
  const r = autoPublish(db);
  assert.deepEqual(r.published, ["backend-engineer"], "the role, and nothing without a summary or a definition");
  assert.equal(status(db, "backend-engineer"), "published");
  assert.equal(status(db, "data-engineer"), "draft", "4 jobs is under the bar");
  for (const s of ["python", "kubernetes", "terraform"]) assert.equal(status(db, s), "draft", `${s}: a skill still needs a summary or a definition`);
  // ⛔ The owner's un-publish still wins for a role.
  setStatus(db, "backend-engineer", "draft", "owner");
  assert.deepEqual(autoPublish(db).published, []);
  assert.equal(status(db, "backend-engineer"), "draft");
});

test("D105 P12 · d105RolePageShowsBoardSections — the role page is the board's data: skills with shares, levels, pay, companies, the next level", async () => {
  const db = board();
  autoPublish(db);
  for (const s of ["python", "kubernetes", "terraform"]) setStatus(db, s, "published");
  const app = express();
  app.use("/api/atlas", createAtlasRouter(db));
  const server = app.listen(0);
  const get = (p) => fetch(`http://127.0.0.1:${server.address().port}${p}`).then(r => r.json());
  try {
    const node = await get("/api/atlas/node/backend-engineer");
    const rb = node.roleBoard;
    assert.ok(rb, "a role's answer carries its board data");
    assert.equal(rb.postings, 62);
    assert.deepEqual(rb.topSkills.map(s => [s.name, s.postings, s.share]), [["Python", 62, 100], ["Kubernetes", 40, 65], ["Terraform", 20, 32]]);
    assert.deepEqual(rb.levels.read.map(l => [l.level, l.postings]), [["entry", 0], ["early", 20], ["mid", 20], ["senior", 20]]);
    assert.equal(rb.levels.unread, 2);
    assert.deepEqual(rb.pay, { minUsd: 160000, medianUsd: 160000, maxUsd: 160000, n: 20 });
    assert.deepEqual(rb.companies.items, [{ company: "Globex Synthetic", postings: 40 }, { company: "Acme Synthetic", postings: 20 }, { company: "Initech Synthetic", postings: 2 }]);
    assert.deepEqual(rb.nextLevel.map(s => [s.from, s.to, s.items.map(i => i.name)]),
      [["early-career", "mid", ["Kubernetes"]], ["mid", "senior", ["Terraform"]]], "D116's rule, every step, for this role");
    assert.equal(rb.nextLevel[0].items[0].line, "In 100 % of mid Backend Engineer postings vs 0 % of early-career");
    // A non-role answer carries none of it.
    assert.equal((await get("/api/atlas/node/kubernetes")).roleBoard, undefined);

    const { nodeView } = await loadUi();
    const html = nodeView(node);
    for (const part of ["data-atlas-role-board", "data-role-skills", "data-role-levels", "data-role-pay", "data-role-companies", "data-atlas-next-level"])
      assert.ok(html.includes(part), `the page draws ${part}`);
    assert.match(html, /Python<\/a><span class="atl__count" data-share="100"> · 100 % of jobs/);
    assert.match(html, /Early career<span class="atl__count"> · 20 jobs · 32 %/);
    assert.match(html, /\$160k, median \$160k/);
    assert.match(html, /Globex Synthetic<span class="atl__count"> · 40/);
    assert.match(html, /Early-career → mid/);
    assert.match(html, /In 100 % of senior Backend Engineer postings vs 0 % of mid/);
    assert.doesNotMatch(html, /definition has not been written yet/, "a role page on board data is not an empty definition");
    assert.ok(!html.includes("data-atlas-definition"));
    // A definition, when it exists, shows on top.
    const withDef = nodeView({ ...node, definition: "Builds the server side of a product." });
    assert.ok(withDef.includes("Builds the server side of a product."));
    assert.ok(withDef.indexOf("data-atlas-definition") < withDef.indexOf("data-atlas-board"), "the definition above the board's data");
    // A step with too few postings read says so instead of listing nothing.
    const thin = nodeView({ ...node, roleBoard: { ...rb, nextLevel: [{ from: "mid", to: "senior", postings: { from: 3, to: 9 }, reason: "too_few_postings", items: [] }] } });
    assert.match(thin, /Not enough jobs read at both levels to measure yet \(3 mid · 9 senior\)/);
  } finally { server.close(); }
});

test("D105 P12 · d105NonRoleBarUnchanged — a skill, tool, stack, concept or pattern still needs a summary or a definition (and a concept, a person)", () => {
  const db = fixtureDb();
  for (const [kind, name] of [["skill", "Rust"], ["tool", "Ansible"], ["stack", "LAMP"], ["skill", "Haskell"], ["tool", "Nomad"], ["concept", "Logic gate"], ["pattern", "Two pointers"]])
    upsertNode(db, { kind, name, source: "registry" });
  const stat = (slug, n) => db.prepare(`INSERT OR REPLACE INTO atlas_node_stats (node_id, postings, computed_at) SELECT id, ?, 1 FROM atlas_nodes WHERE slug = ?`).run(n, slug);
  for (const s of ["rust", "ansible", "lamp", "haskell", "nomad", "logic-gate", "two-pointers"]) stat(s, 40);
  // Neither a summary nor a definition: every non-role kind stays a draft, however many postings.
  db.prepare(`UPDATE atlas_nodes SET definition = 'A systems language.' WHERE slug = 'haskell'`).run();
  db.prepare(`INSERT INTO atlas_wiki_cache (node_id, title, extract, page_url, fetched_at) SELECT id, 'Nomad', 'A scheduler.', 'https://en.wikipedia.org/wiki/Nomad', 1 FROM atlas_nodes WHERE slug = 'nomad'`).run();
  db.prepare(`UPDATE atlas_nodes SET definition = 'A circuit.' WHERE slug = 'logic-gate'`).run();
  const r = autoPublish(db);
  assert.deepEqual(r.published.sort(), ["haskell", "nomad"], "a definition or a summary — the old bar, exactly");
  for (const s of ["rust", "ansible", "lamp", "two-pointers"]) {
    assert.equal(status(db, s), "draft", s);
    assert.ok(why(db, s).missing.includes("no Wikipedia summary or definition"), `${s}: the admin line still names the missing text`);
  }
  assert.equal(status(db, "logic-gate"), "draft", "a concept is still published by hand, definition or not");
  assert.equal(why(db, "haskell").ready, true);
});
