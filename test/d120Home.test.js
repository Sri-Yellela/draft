// ⭐ D120 P2 (owner 10-31) · THE ATLAS HOME IS YOUR MAP — "very text rich with no direction … the atlas homepage should be
// the user profile radial map and course map and the content that comes with this. alongside existing stuff … Explore
// by role can be moved to one side of the page." The home drawn from a REAL GET /api/atlas/me answer (computeYourMap on
// synthetic people, nodes and postings) and the REAL course (the owner's tracker + the D117 data, imported in memory),
// rendered by esbuild + react-dom/server. No network, no model.
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
import { computeYourMap, YOUR_MAP } from "../services/atlas/atlasMe.js";
import { learnContent } from "../services/learn/learnContent.js";
import { seedCircleData, circleOf } from "../services/learn/learnCircle.js";
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
        import { AtlasHome, directionLine } from ${abs("pages/atlas/YourMap.jsx")};
        import { CourseView } from ${abs("pages/atlas/YourCourse.jsx")};
        export { directionLine };
        export const home = (me, data) => renderToStaticMarkup(h(MemoryRouter, null, h(AtlasHome, { me, base: "/atlas",
          search: h("section", { "data-atlas-home-search": "" }, "search"), course: h(CourseView, { base: "/atlas", signedIn: !!me.signedIn, data }) })));`,
      resolveDir: CLIENT, loader: "jsx" },
    bundle: true, write: false, format: "esm", platform: "node", jsx: "automatic",
    loader: { ".css": "empty", ".js": "jsx", ".png": "empty", ".svg": "empty" }, logLevel: "silent", define: { "process.env.NODE_ENV": '"production"' },
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d120-home-")), file = path.join(dir, "ui.mjs");
  fs.writeFileSync(file, out.outputFiles[0].text);
  try { ui = await import(pathToFileURL(file).href); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  return ui;
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
  // the tree draws nodes of a family (D116 M1)
  for (const [n, f] of [["Python", "data"], ["SQL", "data"], ["Kubernetes", "infra"], ["Docker", "infra"]]) db.prepare(`UPDATE atlas_nodes SET family = ? WHERE name = ?`).run(f, n);
  computeAtlasStats(db, { boardEdges: false });
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (7,'synthetic7','x')").run();
  db.prepare("INSERT INTO user_profile (user_id) VALUES (7)").run();
  for (const [i, s] of ["Python", "SQL"].entries()) db.prepare("INSERT INTO profile_skills (user_id, name, position) VALUES (7,?,?)").run(s, i);
  seedCircleData(db);
  const learn = learnContent(db);
  return { db, course: { learn, circle: circleOf(db, learn), marks: {}, myRoute: null } };
}
const order = (html, ...marks) => marks.map(m => at(html, m));

test("D120 P2 · d120DirectionLineFirst — the one line of direction leads the main column, before the map, the course and the sections", async () => {
  const { home, directionLine } = await loadUi();
  const { db, course } = world();
  const me = computeYourMap(db, 7);
  assert.equal(me.map, true);
  const dir = directionLine(me.tree);
  assert.ok(dir, "Next up exists on this tree");
  assert.match(dir.text, /^Next up: (Kubernetes|Docker) · \d+ % close/);
  const html = home(me, course);
  const [d, map, c, sec] = order(html, "data-atlas-direction=", "data-your-map=", "data-atlas-course=", "data-map-section=");
  assert.ok(d < map && map < c && c < sec, "direction → map → course → sections");
  assert.match(html, /data-atlas-direction-open=""/, "with a way to act on it");
});

test("D120 P2 · d120HomeShowsTreeAndCircle — the home carries the tree AND the course circle, each its own component", async () => {
  const { home } = await loadUi();
  const { db, course } = world();
  const html = home(computeYourMap(db, 7), course);
  assert.match(html, /data-your-map=""/);
  assert.match(html, /data-atlas-course="you"[\s\S]*data-learn-circle=""/, "the course block draws D117's CircleSvg");
  assert.match(html, /data-atlas-course-continue="/, "Continue: the first unfinished piece");
  const src = read("client/src/pages/atlas/YourCourse.jsx");
  assert.match(src, /import \{ CircleSvg \} from "\.\/LearnCircle\.jsx";/, "the circle reused, not redrawn");
  assert.doesNotMatch(src, /<svg/, "no second circle drawing");
});

test("D120 P2 · d120ExploreByRoleInSide — Explore by role, the families, search and recent pages sit in the side column", async () => {
  const { home } = await loadUi();
  const { db, course } = world();
  const me = computeYourMap(db, 7);
  assert.ok(me.exploreByRole.items.length >= 1 && Array.isArray(me.recent));
  assert.ok(me.recent.length >= 1 && me.recent.length <= YOUR_MAP.RECENT_PUBLISHED);
  const html = home(me, course);
  const side = html.slice(at(html, "data-atlas-home-side="));
  for (const m of ["data-atlas-home-search=", "data-atlas-explore=", "data-atlas-home-families=", "data-atlas-home-recent="]) assert.ok(side.includes(m), m);
  assert.ok(!html.slice(0, at(html, "data-atlas-home-side=")).includes("data-atlas-explore="), "Explore by role is not in the main column");
  // ⭐ D178-2 (changed on purpose): a family says how many are proven and how many only claimed — never a flat "you have N of M".
  assert.match(side, /(?:\d+ (?:proven|claimed|learned) · )*(?:none yet · )?of \d+/);
});

test("D120 P2 · d120SignedOutNotEmpty — signed out: search · Learn (the full circle) · Explore by role, never an empty page", async () => {
  const { home } = await loadUi();
  const { db, course } = world();
  const me = computeYourMap(db, null);
  assert.equal(me.signedIn, false);
  const html = home(me, course);
  assert.match(html, /data-atlas-home="explore"/);
  assert.match(html, /data-atlas-course="all"[\s\S]*data-learn-circle=""/, "the full circle");
  assert.match(html, /Learn — From silicon to software/);
  for (const m of ["data-atlas-home-search=", "data-atlas-explore="]) assert.ok(html.includes(m), m);
  assert.doesNotMatch(html, /data-atlas-course-progress="">\d+ finished/, "no progress for a reader with none");
});

test("D120 P2 · d120NarrowStacks — the side column is ≈ 320px and drops under the main one below 980px; nothing is wider than its column", () => {
  const css = read("client/src/pages/atlas/AtlasPage.css");
  assert.match(css, /\.atl-home \{ display: grid; grid-template-columns: minmax\(0, 1fr\) minmax\(0, 320px\);/);
  assert.match(css, /@media \(max-width: 980px\) \{ \.atl-home \{ grid-template-columns: minmax\(0, 1fr\); \} \}/);
  assert.match(css, /\.atl-home__main, \.atl-home__side \{[^}]*min-width: 0;/);
  assert.doesNotMatch(css.slice(at(css, "D120 P2 · THE HOME")), /#[0-9a-f]{3,8}\b|rgba?\(|999px|border-radius:\s*50%/i, "tokens only, no capsule");
  const page = read("client/src/pages/atlas/AtlasPage.jsx");
  assert.match(page, /\{!slug && q && <AtlasSearch base=\{base\} q=\{q\} \/>\}/, "a query is still the search page");
});
