// ⭐ D120 P2 (owner 10-31) · THE ATLAS HOME WAS YOUR MAP — "very text rich with no direction". ⭐ A228 (46r, owner 11-16
// "Build it"): that home (AtlasHome / ExploreHome — the tree, Your course, the five sections and the families in a side
// column) is RETIRED; Your map is the skill map now (test/a228SkillMapPage.test.js). Its tests went with its code. What
// stays of D120 is the ONE line of direction — Overview's "Next step" falls back to it (AtlasPanels.jsx OverviewView) —
// read from a REAL GET /api/atlas/me answer (computeYourMap on synthetic people, nodes and postings). No network, no model.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { upsertNode, setStatus } from "../services/atlas/atlasStore.js";
import { computeAtlasStats } from "../services/atlas/atlasStats.js";
import { computeYourMap } from "../services/atlas/atlasMe.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const CLIENT = path.resolve("client");
async function loadUi() {
  const esbuild = createRequire(path.join(CLIENT, "package.json"))("esbuild");
  const abs = (p) => JSON.stringify(path.join(CLIENT, "src", p).split(path.sep).join("/"));
  const out = await esbuild.build({
    stdin: { contents: `export { directionLine } from ${abs("pages/atlas/YourMap.jsx")};`, resolveDir: CLIENT, loader: "jsx" },
    bundle: true, write: false, format: "esm", platform: "node", jsx: "automatic",
    loader: { ".css": "empty", ".js": "jsx", ".png": "empty", ".svg": "empty" }, logLevel: "silent", define: { "process.env.NODE_ENV": '"production"' },
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d120-home-")), file = path.join(dir, "ui.mjs");
  fs.writeFileSync(file, out.outputFiles[0].text);
  try { return await import(pathToFileURL(file).href); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

function world() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  for (const [kind, n] of [["skill", "Python"], ["skill", "SQL"], ["tool", "Kubernetes"], ["tool", "Docker"], ["role", "Data Engineer"]]) {
    upsertNode(db, { kind, name: n, source: "registry" });
    setStatus(db, db.prepare(`SELECT slug FROM atlas_nodes WHERE name = ?`).pluck().get(n), "published");
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

test("D120 P2 · d120DirectionLine — the one line of direction (Next up), read from the tree; Overview falls back to it", async () => {
  const { directionLine } = await loadUi();
  const me = computeYourMap(world(), 7);
  assert.equal(me.map, true);
  const dir = directionLine(me.tree);
  assert.ok(dir, "Next up exists on this tree");
  assert.match(dir.text, /^Next up: (Kubernetes|Docker) · \d+ % close/);
  assert.equal(directionLine({ nodes: [], nextUp: null }), null);
  assert.match(read("client/src/pages/atlas/AtlasPanels.jsx"), /me\?\.tree \? directionLine\(me\.tree\) : null/);
});

// ⛔ 47m (changed on purpose): "D120 P2 · retired with A228 — the old home, its course block and its grid are go" retired — the surface it pinned was rebuilt in the plate system (47m M5).
