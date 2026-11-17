// ⭐ D116 M2–M6, M8, M10 · THE TREE AS DRAWN — the layout (client/src/pages/atlas/atlasTreeLayout.js), its words and
// choices (atlasTreeModel.js) and the drawing (AtlasTree.jsx, rendered by esbuild + react-dom/server as d105's pages
// are). The data's own rules are test/d116Tree.test.js. Synthetic trees, plus one measured on a copy of the local
// board (test/fixtures/d116TreeBoard.json — aggregate counts, synthetic users) for the no-overlap rule.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { at } from "../test-support/sourceAnchors.js";
import {
  layoutTree, baseRadius, squareSize, tooClose, pathBack, pathEdges, fitView, viewFor, flight, bandsFor, GEOM,
} from "../client/src/pages/atlas/atlasTreeLayout.js";
import {
  ariaFor, rowLine, familyList, tabOrder, waypoints, tourOrder, flyRouteLabel, selectionView, newlyLearned, progressArc,
} from "../client/src/pages/atlas/atlasTreeModel.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
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
        import AtlasTree, { SidePanel } from ${abs("pages/atlas/AtlasTree.jsx")};
        const wrap = (el) => renderToStaticMarkup(h(MemoryRouter, null, el));
        export const tree = (t) => wrap(h(AtlasTree, { tree: t, base: "/atlas" }));
        export const side = (t, state) => wrap(h(SidePanel, { tree: t, page: t.page, base: "/atlas", state: { sel: null, focusFam: null, special: null, lastFam: null, ...state }, onChoose() {}, onFamily() {} }));
`,
      resolveDir: CLIENT, loader: "jsx",
    },
    bundle: true, write: false, format: "esm", platform: "node", jsx: "automatic",
    loader: { ".css": "empty", ".js": "jsx", ".png": "empty", ".svg": "empty", ".jpg": "empty", ".webp": "empty", ".woff2": "empty" }, logLevel: "silent",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d116-tree-ui-"));
  const file = path.join(dir, "ui.mjs");
  fs.writeFileSync(file, result.outputFiles[0].text);
  try { ui = await import(pathToFileURL(file).href); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
  return ui;
}

// ── a synthetic tree, as GET /api/atlas/me → tree answers it ────────────────────────────────────
const N = (o) => ({ kind: "tool", have: false, learned: false, state: "not_yet", progress: null, askedWith: [], parent: null, ring: "other", rises: false,
  rise: null, midShare: null, seniorShare: null, routeStep: null, routeTotal: null, nextUp: false, onTree: true, courseStep: null, facts: {}, ...o,
  sub: o.sub ?? (o.have ? `${o.postings} postings` : `${o.closeness} % close · ${o.postings}`) });
function you() {
  const nodes = [
    N({ slug: "kubernetes", name: "Kubernetes", family: "infra", have: true, state: "have", ring: "have", postings: 411, closeness: 40,
      facts: { postings: "Asked for in 411 open postings", opensToward: [{ slug: "terraform", name: "Terraform" }] } }),
    N({ slug: "docker", name: "Docker", family: "infra", have: true, state: "have", ring: "have", postings: 530, closeness: 50,
      facts: { postings: "Asked for in 530 open postings", opensToward: [] } }),
    N({ slug: "terraform", name: "Terraform", family: "infra", postings: 480, closeness: 66, parent: "kubernetes", ring: "rises", rises: true, rise: 11, midShare: 8, seniorShare: 19,
      askedWith: [{ slug: "kubernetes", name: "Kubernetes", family: "infra", together: 90 }, { slug: "docker", name: "Docker", family: "infra", together: 40 }], routeStep: 1, routeTotal: 2,
      facts: { closeness: "Terraform is asked for in 480 open postings, and 66 % of those also ask for two or more skills you have (Kubernetes and Docker).",
        slope: "8 % of mid Backend Engineer postings, 19 % of senior (+11 points).", route: "Step 1 of 2. It's 66 % close to what you know, so it comes early.", progress: null, addToProfile: null },
      courseStep: { stepId: "o4", label: "Part 4", title: "Virtual machines, containers and the cloud", path: "/learn#step-o4" } }),
    N({ slug: "prometheus", name: "Prometheus", family: "infra", postings: 280, closeness: 57, parent: "kubernetes", state: "learning", progress: { done: 3, total: 5 },
      askedWith: [{ slug: "kubernetes", name: "Kubernetes", family: "infra", together: 50 }], facts: { closeness: "x", slope: null, route: null, progress: "3 of 5 in its step", addToProfile: null } }),
    N({ slug: "sql", name: "SQL", family: "data", have: true, state: "have", ring: "have", postings: 880, closeness: 30, facts: { postings: "Asked for in 880 open postings", opensToward: [] } }),
    N({ slug: "spark", name: "Spark", family: "data", postings: 640, closeness: 58, parent: "sql", routeStep: 2, routeTotal: 2, nextUp: true,
      askedWith: [{ slug: "sql", name: "SQL", family: "data", together: 300 }, { slug: "kubernetes", name: "Kubernetes", family: "infra", together: 30 }], facts: { closeness: "y", slope: null, route: "z" } }),
    N({ slug: "dbt", name: "dbt", family: "data", postings: 240, closeness: 40, learned: true, state: "learned", ring: "have",
      facts: { closeness: "w", addToProfile: "Add dbt to my Profile" } }),
    N({ slug: "airflow", name: "Airflow", family: "data", postings: 30, closeness: 20, onTree: false, facts: {} }),
  ];
  return {
    page: "you", user: { role: { slug: "backend-engineer", name: "Backend Engineer" }, level: "mid", aim: { slug: "backend-engineer", name: "Backend Engineer", level: "senior" } },
    nextUp: "spark", route: ["terraform", "spark"],
    families: [
      { key: "infra", name: "Infra", haveCount: 2, learnedCount: 0, total: 4, drawn: 4, more: 0, order: ["docker", "kubernetes", "terraform", "prometheus"], tag: "INFRA · you have 2 of 4" },
      { key: "data", name: "Data", haveCount: 1, learnedCount: 1, total: 4, drawn: 3, more: 1, order: ["sql", "dbt", "spark", "airflow"], tag: "DATA · you have 2 of 4 · 1 learned" },
    ],
    nodes,
  };
}
const role = (signedIn = true) => ({
  page: "role", centre: { slug: "data-engineer", name: "Data Engineer", postings: 388 }, signedIn,
  cover: signedIn ? { have: 1, of: 2, missing: [{ slug: "spark", name: "Spark", share: 64 }], line: "You cover 1 of 2; missing Spark 64 %" } : null,
  families: [{ key: "data", name: "Data", haveCount: signedIn ? 1 : 2, total: 2, drawn: 2, more: 0, order: ["sql", "spark"] }],
  nodes: [N({ slug: "sql", name: "SQL", family: "data", have: true, state: "have", ring: signedIn ? "have" : null, postings: 880, share: 86, sub: "86 % of postings" }),
    N({ slug: "spark", name: "Spark", family: "data", have: !signedIn, state: signedIn ? "not_yet" : "have", ring: signedIn ? "rises" : null, postings: 640, share: 64, sub: "64 % of postings" })],
});
const BOARD = JSON.parse(fs.readFileSync("test/fixtures/d116TreeBoard.json", "utf8"));

test("D116 M3 · d116TreeColouredIfHave — a skill you have (or learned) is filled in its family's colour, with the green ring", async () => {
  const html = (await loadUi()).tree(you());
  const sq = (slug) => html.match(new RegExp(`data-tree-node="${slug}"[^]*?class="atree__sq ([^"]+)"`))[1];
  assert.equal(sq("kubernetes"), "atree__sq--infra");
  assert.equal(sq("sql"), "atree__sq--data");
  assert.equal(sq("dbt"), "atree__sq--data", "learned (M8) fills too");
  assert.match(html, /data-tree-node="kubernetes" data-ring="have"/);
});

test("D116 M3 · d116TreeGreyIfNot — a skill you don't have yet is grey (--c-off), its name in grey text", async () => {
  const html = (await loadUi()).tree(you());
  assert.match(html, /data-tree-node="terraform"[^]*?class="atree__sq atree__sq--off"[^]*?class="atree__nm atree__nm--off"/);
  const css = read("client/src/pages/atlas/AtlasTree.css");
  assert.match(css, /\.atree__sq--off \{ fill: var\(--c-off\);/);
  assert.match(css, /--c-off: var\(--c-border-strong\);/);
});

test("D116 M2 · d116TreeDistanceIsCloseness (layout) — yours at 128 (two rings 108 / 150 past 3), others 160 + (100 − closeness) × 3.4; pages 120 + (100 − share) × 2.6", () => {
  assert.equal(baseRadius("you", { have: true }, { havesInFamily: 3 }), 128);
  assert.deepEqual([0, 1, 2].map(i => baseRadius("you", { have: true }, { havesInFamily: 4, haveIndex: i })), [108, 150, 108]);
  assert.equal(baseRadius("you", { closeness: 81 }), 160 + 19 * 3.4);
  assert.equal(baseRadius("you", { closeness: 40 }), 160 + 60 * 3.4);
  assert.equal(baseRadius("role", { share: 64 }), 120 + 36 * 2.6);
  const L = layoutTree(you());
  for (const [slug, p] of L.pos) assert.ok(p.r >= p.base, `${slug} is never drawn closer than it measured`);
  // Closer = nearer the centre, when nothing has to be moved clear.
  assert.ok(L.pos.get("terraform").r < L.pos.get("prometheus").r);
  assert.deepEqual(bandsFor("you").map(b => b[1]), ["YOURS", "VERY CLOSE · 75 %+", "CLOSE · 60–75 %", "A STRETCH · UNDER 60 %"]);
});

test("D116 M2 · d116TreeSizeIsPostings — the square is √postings × 0.95, clamped 15–32", () => {
  assert.equal(squareSize(400), 19);
  assert.equal(squareSize(1), 15);
  assert.equal(squareSize(10000), 32);
  const L = layoutTree(you());
  assert.equal(L.pos.get("sql").size, Math.min(32, Math.sqrt(880) * 0.95));
});

test("D116 M2 · d116TreeNoOverlap — no two squares closer than their half-sizes + 10, on all three pages, on the real board (and a crowded synthetic sector)", () => {
  const all = [...BOARD.you, ...BOARD.role, ...BOARD.family];
  assert.ok(BOARD.you.length && BOARD.role.length && BOARD.family.length);
  let pages = 0;
  for (const t of all) {
    const L = layoutTree(t);
    const ps = [...L.pos.entries()];
    assert.ok(ps.length > 5, `${t.page} has a tree`);
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++)
      assert.ok(!tooClose(ps[i][1], ps[j][1]), `${t.page} ${t.centre?.name || "you"}: ${ps[i][0]} and ${ps[j][0]} overlap`);
    pages++;
  }
  assert.ok(pages >= 10);
  // Twelve big squares at the same closeness in one narrow sector: the layout moves them clear, outward only.
  const crowd = { page: "you", families: FAMS5.map(k => ({ key: k, name: k, order: k === "ml" ? CROWD.map(n => n.slug) : [] })), nodes: CROWD };
  const L = layoutTree(crowd);
  const ps = [...L.pos.values()];
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) assert.ok(!tooClose(ps[i], ps[j]));
  assert.ok(ps.some(p => p.r > p.base), "some were moved");
});
const FAMS5 = ["ml", "systems", "infra", "data", "backend"];
const CROWD = Array.from({ length: 12 }, (_, i) => N({ slug: `c${i}`, name: `Crowd ${i}`, family: "ml", postings: 900, closeness: 70 }));

test("D116 M2 · d116TreeDeterministic — the same data always draws the same tree (whatever order the nodes arrive in)", () => {
  const a = layoutTree(you()), b = layoutTree(you());
  const shuffled = you(); shuffled.nodes.reverse();
  const c = layoutTree(shuffled);
  const dump = (L) => JSON.stringify([[...L.pos.entries()], L.edges, L.tags, L.bounds]);
  assert.equal(dump(a), dump(b));
  assert.equal(dump(a), dump(c));
  // The angular order: each of yours followed by its children, then the trunk's children.
  assert.deepEqual(a.order.filter(s => ["docker", "kubernetes", "terraform", "prometheus"].includes(s)), ["docker", "kubernetes", "terraform", "prometheus"]);
  assert.ok(!a.pos.has("airflow"), "a node not on the tree is not drawn");
  // Terraform hanging off Docker sits right after Docker, before Kubernetes — not in plain list order.
  const t2 = you(); t2.nodes.find(n => n.slug === "terraform").parent = "docker";
  assert.deepEqual(layoutTree(t2).order.filter(s => ["docker", "kubernetes", "terraform", "prometheus"].includes(s)), ["docker", "terraform", "kubernetes", "prometheus"]);
});

test("D116 M4 · d116TreePathBackToYou — a chosen skill lights its branch back to the centre and dashes to its other asked-with skills; the rest dims", () => {
  const t = you(), L = layoutTree(t);
  const p = pathBack("terraform", t, L);
  assert.deepEqual(p, ["terraform", "kubernetes", "trunk:infra", "centre"]);
  assert.deepEqual([...pathEdges(p)].sort(), ["kubernetes>terraform", "trunk:infra", "trunk:infra>kubernetes"].sort());
  const v = selectionView(t, L, { sel: "terraform" });
  assert.deepEqual(v.links, ["docker"], "the dashed link goes to Docker, not to Kubernetes (its parent)");
  assert.equal(v.dimNode("docker"), false);
  assert.equal(v.dimNode("sql"), true);
  assert.equal(v.dimEdge({ id: "trunk:data", family: "data" }), true);
  assert.equal(v.dimEdge({ id: "trunk:infra", family: "infra" }), false);
  // A node with no drawn parent hangs off its trunk.
  assert.deepEqual(pathBack("sql", t, L), ["sql", "trunk:data", "centre"]);
});

test("D116 M4 · d116TreeFamilyListOrder — a family's list: yours first by postings, then closest → furthest, each row '81 % close · 380 postings · +23 toward senior'", async () => {
  const t = you();
  assert.deepEqual(familyList(t, "infra").map(n => n.slug), ["docker", "kubernetes", "terraform", "prometheus"]);
  assert.equal(rowLine(t.nodes.find(n => n.slug === "terraform")), "66 % close · 480 postings · +11 toward senior");
  assert.equal(rowLine(t.nodes.find(n => n.slug === "docker")), "You have it · 530 postings");
  const html = (await loadUi()).side(t, { focusFam: "data" });
  const rows = [...html.matchAll(/data-tree-row="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(rows, ["sql", "dbt", "spark", "airflow"], "every member — drawn or not — in the list");
  assert.match(html, /You have <b>2 of 4<\/b> \(1 learned\)\./, "as the tag counts: yours and learned");
  assert.match(html, /href="\/atlas\/family\/data"/, "the family's own page");
});

test("D116 M4 · d116TreeBackToList — a skill opened from its family's list offers ← Back to the list", async () => {
  const u = await loadUi();
  const html = u.side(you(), { sel: "terraform", lastFam: "infra" });
  assert.match(html, /data-tree-back="">← Back to the Infra list</);
  assert.doesNotMatch(u.side(you(), { sel: "terraform", lastFam: "data" }), /data-tree-back/, "only for its own family's list");
  assert.doesNotMatch(u.side(you(), { sel: "terraform" }), /data-tree-back/);
});

test("D116 M4 · d116TreeWaypointsFly — You · Your skills · Next up · Toward senior · the families, each flying the view to its place", () => {
  const t = you(), L = layoutTree(t);
  const w = waypoints(t);
  assert.deepEqual(w.map(x => x.label), ["You", "Your skills", "Next up: Spark", "Toward senior", "Infra", "Data"]);
  const centreOf = (v) => [v.x + v.w / 2, v.y + v.h / 2];
  const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6;
  assert.deepEqual(viewFor(w[0].target, L, t, 1.6), fitView(L, 1.6));
  assert.ok(near(centreOf(viewFor(w[1].target, L, t, 1.6)), [0, 0]));
  const sp = L.pos.get("spark");
  assert.ok(near(centreOf(viewFor(w[2].target, L, t, 1.6)), [sp.x, sp.y]), "Next up flies to its node");
  const s = L.sectors.data;
  const c = centreOf(viewFor(w[5].target, L, t, 1.6));
  assert.ok(Math.abs(Math.atan2(c[1], c[0]) - Math.atan2(Math.sin(s.mid), Math.cos(s.mid))) < 1e-6, "a family flies to its branch");
  // A node not on the tree flies to its family's branch.
  assert.deepEqual(viewFor({ kind: "node", slug: "airflow" }, L, t, 1.6), viewFor({ kind: "family", key: "data" }, L, t, 1.6));
  assert.deepEqual(flight(false), { jump: false, ms: 700 });
  // No aim: no "Toward senior".
  assert.ok(!waypoints({ ...t, user: { ...t.user, aim: null } }).some(x => x.id === "senior"));
});

test("D116 M4 · d116TreeFlyMyRouteOrder — Fly my route steps through the route in order", async () => {
  const t = you();
  assert.deepEqual(tourOrder(t), ["terraform", "spark"]);
  assert.equal(flyRouteLabel(t), "Fly my route to senior Backend Engineer ▸");
  assert.equal(GEOM.TOUR_MS, 2300);
  assert.match((await loadUi()).tree(t), /data-waypoint="tour"[^>]*>Fly my route to senior Backend Engineer ▸</);
});

test("D116 M5 · the side panel shows the server's sentences, the mid → senior bar, Enter the course and Jobs that ask for it", async () => {
  const u = await loadUi();
  const html = u.side(you(), { sel: "terraform" });
  assert.match(html, /Terraform is asked for in 480 open postings, and 66 % of those also ask for two or more skills you have \(Kubernetes and Docker\)\./);
  assert.match(html, /8 % of mid Backend Engineer postings, 19 % of senior \(\+11 points\)\./);
  assert.match(html, /class="atree__slope"/);
  assert.match(html, /Step 1 of 2\. It&#x27;s 66 % close to what you know, so it comes early\./);
  assert.match(html, /href="\/atlas\/learn#step-o4"[^>]*>Enter the course: Virtual machines, containers and the cloud</);
  assert.match(html, />Jobs that ask for it</);
  const mine = u.side(you(), { sel: "kubernetes" });
  assert.match(mine, /Asked for in 411 open postings\./);
  assert.match(mine, /It opens toward/);
  // M8: a learned node offers to add it to the Profile — the user's choice; nothing is written.
  assert.match(u.side(you(), { sel: "dbt" }), /href="\/app\/profile"[^>]*>Add dbt to my Profile</);
});

test("D116 M9 · d116TreeNoAimMessage (drawn) — no aim: the mid → senior fact is 'Set an aim…' with one press to the job profile", async () => {
  const t = you();
  t.user = { ...t.user, aim: null, role: null };
  t.noAim = { line: "Set an aim to see what seniority adds", path: "/app/job-profiles", label: "Set an aim" };
  const n = t.nodes.find(x => x.slug === "terraform");
  n.facts = { ...n.facts, slope: null, route: null };
  const html = (await loadUi()).side(t, { sel: "terraform" });
  assert.match(html, /data-tree-no-aim="">Set an aim to see what seniority adds\. <a [^>]*href="\/app\/job-profiles"/);
});

test("D116 M7 · d116TreeRoleAndFamilyPages — the same component, centred on a role or a family; signed out every square coloured, no rings", async () => {
  const u = await loadUi();
  const r = u.tree(role(true));
  assert.match(r, /data-tree-page="role"/);
  assert.match(r, />Data</); assert.match(r, />Engineer</);
  for (const b of ["IN 3 OF 4 POSTINGS", "HALF", "1 IN 4 OR FEWER"]) assert.ok(r.includes(b), b);
  assert.match(r, /data-tree-node="spark" data-ring="rises"/);
  assert.match(u.side(role(true), {}), /You cover 1 of 2; missing Spark 64 %\./);
  const out = u.tree(role(false));
  assert.doesNotMatch(out, /class="atree__ring/, "signed out: no rings");
  assert.doesNotMatch(out, /atree__sq--off/, "signed out: all coloured");
  const fam = { page: "family", centre: { key: "data", name: "Data", postings: 533 }, signedIn: false, more: [],
    families: [{ key: "data", name: "Data", haveCount: 2, total: 2, drawn: 2, more: 0, order: ["sql", "spark"] }], nodes: role(false).nodes };
  const L = layoutTree(fam);
  assert.equal(L.sectors.data.hi - L.sectors.data.lo, Math.PI * 1.95, "the full circle");
  for (const b of ["CORE · 50 %+", "COMMON", "SPECIALIST"]) assert.ok(u.tree(fam).includes(b), b);
  // The pages mount: a role page carries RoleMap; /atlas/family/<key> is FamilyMap.
  const page = read("client/src/pages/atlas/AtlasPage.jsx");
  // ⭐ D172 (changed on purpose): the role map is the role card's "Role map" pane; nodePanes offers it to roles only.
  assert.match(page, /map: <RoleMap base=\{base\} slug=\{node\.slug\} \/>/);
  assert.match(page, /\{familyKey && <FamilyMap base=\{base\} familyKey=\{familyKey\} \/>\}/);
  assert.match(read("client/src/pages/atlas/YourMap.jsx"), /api\(`\/api\/atlas\/tree\/family\/\$\{encodeURIComponent\(familyKey\)\}`\)/);
});

test("D116 M10 · d116TreeKeyboard — every node a real button, Tab walks a family in list order, Enter selects; Escape shows everything", async () => {
  const t = you();
  const html = (await loadUi()).tree(t);
  const inDom = [...html.matchAll(/<g class="atree__nd[^"]*" role="button" tabindex="0" aria-label="([^"]+)" data-tree-node="([^"]+)"/g)];
  assert.deepEqual(inDom.map(m => m[2]), tabOrder(t));
  assert.deepEqual(tabOrder(t), ["docker", "kubernetes", "terraform", "prometheus", "sql", "dbt", "spark"]);
  assert.equal(inDom.find(m => m[2] === "terraform")[1], "Terraform, you don&#x27;t have it yet, 66 % close, 480 postings");
  assert.equal(ariaFor(t.nodes.find(n => n.slug === "prometheus")), "Prometheus, learning, 3 of 5 in its step, 57 % close, 280 postings");
  assert.equal(ariaFor(t.nodes.find(n => n.slug === "docker")), "Docker, you have it, 530 postings");
  const src = read("client/src/pages/atlas/AtlasTree.jsx");
  assert.match(src, /if \(e\.key === "Enter" \|\| e\.key === " "\) \{ e\.preventDefault\(\); e\.stopPropagation\(\); onChoose\(n\.slug\); \}/);
  assert.match(src, /onKeyDown=\{\(e\) => \{ if \(e\.key === "Escape"\) home\(\); \}\}/);
  assert.match(html, /data-tree-tag="infra"[^>]*|role="button" tabindex="0" aria-label="Infra family/);
});

test("D116 M10 · d116TreeReducedMotion — reduced motion: flights jump, no pulse, no unlock animation", () => {
  assert.deepEqual(flight(true), { jump: true, ms: 0 });
  const css = read("client/src/pages/atlas/AtlasTree.css");
  const motion = css.slice(at(css, "@media (prefers-reduced-motion: no-preference)"));
  const block = motion.slice(0, at(motion, "\n}\n") + 2);
  assert.match(block, /atree__pulse \{ animation: atree-pulse/);
  assert.match(block, /atree__nd--unlock .atree__sq \{ animation: atree-fill/);
  // No animation is declared outside that block (the keyframes themselves aside).
  const outside = css.replace(block, "");
  assert.doesNotMatch(outside, /animation:/);
  const src = read("client/src/pages/atlas/AtlasTree.jsx");
  assert.match(src, /if \(f\.jump \|\| typeof requestAnimationFrame === "undefined"\) \{ apply\(T\); return; \}/);
  assert.match(src, /className=\{`atree atree--\$\{page\}\$\{reduced \? " atree--still" : ""\}`\}/);
});

test("D116 M10 · d116TreeFourThemes — tokens only, both themes and the contrast pair; rounded squares, never capsules; phone width", () => {
  const css = read("client/src/pages/atlas/AtlasTree.css");
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ""), /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|\bwhite\b|\bblack\b/i, "no colour literal");
  assert.doesNotMatch(css, /999px|border-radius:\s*50%/);
  for (const tok of ["--c-danger", "--c-violet", "--c-teal", "--c-warning", "--c-info", "--c-success", "--c-accent", "--c-surface-solid", "--c-ink"]) assert.ok(css.includes(`var(${tok})`), tok);
  assert.match(css, /\[data-contrast="aaa"\] \.atree__gloss \{ display: none; \}/, "contrast themes: no tint");
  assert.match(css, /\[data-contrast="aaa"\] \.atree__sq--off \{ stroke: var\(--c-ink\);/, "contrast themes: solid outlines");
  assert.match(css, /--c-branch: var\(--c-border-strong\);/);
  assert.match(css, /@media \(max-width: 940px\) \{ \.atree__top \{ grid-template-columns: minmax\(0, 1fr\); \}/, "the panel drops under the map");
  for (const k of FAMS5) assert.match(css, new RegExp(`\\.atree__sq--${k} \\{ fill: var\\(--atree-${k}\\)`));
  assert.doesNotMatch(read("client/src/pages/atlas/AtlasTree.jsx").replace(/^\s*\/\/.*$/gm, ""), /<canvas|getContext\(|from "three"/, "M9: plain SVG, no WebGL");
});

// ⭐ A228 (46r, owner 11-16 "Build it"): "D116 M6 · the five sections below the map" is deleted with its code — the five
// sections (mapSections) and the signed-out home (ExploreHome) were retired with the market tree; Your map is the skill map.

test("D116 M8 · d116UnlockReducedMotion — a node unlocks (the ring closes, the square fills) once, on the first draw after it was learned; never under reduced motion", () => {
  const t = you();
  assert.deepEqual(newlyLearned(t, null), [], "a first visit plays nothing");
  assert.deepEqual(newlyLearned(t, []), ["dbt"]);
  assert.deepEqual(newlyLearned(t, ["dbt"]), []);
  const src = read("client/src/pages/atlas/AtlasTree.jsx");
  assert.match(src, /if \(fresh\.length && !reduced\) setUnlocking\(new Set\(fresh\)\);/);
  assert.match(read("client/src/pages/atlas/AtlasTree.css"), /@keyframes atree-close \{ from \{ stroke-dasharray: 0 100; \} \}/);
});

test("D116 M8 · d116LearningShowsProgressArc (drawn) — a learning node's ring is an arc of its step's share done", async () => {
  const p = you().nodes.find(n => n.slug === "prometheus");
  assert.equal(progressArc(p), 60);
  const html = (await loadUi()).tree(you());
  assert.match(html, /data-tree-node="prometheus"[^]*?<rect class="atree__ring atree__ring--other"[^>]*pathLength="100" stroke-dasharray="60 100" data-arc="60"/);
});
