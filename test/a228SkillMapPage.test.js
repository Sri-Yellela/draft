// ⭐ A228 (46r, owner 11-16 "Build it") · THE SKILL MAP PAGE — the pure drawing model (client/src/pages/atlas/skillMapModel.js)
// and the page RENDERED (esbuild + react-dom/server, no network) from a synthetic GET /api/atlas/skill-map answer, against the
// approved sketch docs/sketches/A228-ab-combined.html: the four sections in its order, its plain words (jobs — never postings
// / asks / coverage), the three states named in a legend, a "Show as a table" per chart, the level tiles only when the
// server sends levels, tokens only, no capsules. a228Squarify · a228Histogram · a228LabelNudge · a228PageOrder ·
// a228PlainWords (the verb "ask for" is the sketch's own; the noun "asks" is not) · a228LevelsHidden · a228TokensOnly.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { squarify, familyGroups, histogramBars, nudgeLabels, routePoints, monogram, niceTop, fit } from "../client/src/pages/atlas/skillMapModel.js";

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
        import { SkillMapView, stepHref, heroLine } from ${abs("pages/atlas/SkillMap.jsx")};
        export { stepHref, heroLine };
        export const page = (m, view = "map") => renderToStaticMarkup(h(MemoryRouter, null, h(SkillMapView, { m, base: "/app/atlas", view })));`,
      resolveDir: CLIENT, loader: "jsx" },
    bundle: true, write: false, format: "esm", platform: "node", jsx: "automatic",
    loader: { ".css": "empty", ".js": "jsx", ".png": "empty", ".svg": "empty" }, logLevel: "silent", define: { "process.env.NODE_ENV": '"production"' },
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "a228-ui-")), file = path.join(dir, "ui.mjs");
  fs.writeFileSync(file, out.outputFiles[0].text);
  try { ui = await import(pathToFileURL(file).href); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  return ui;
}

const ask = (id, name, familyName, share, state, jobs) => ({ id, slug: name.toLowerCase().replace(/\W+/g, "-"), name, family: null, familyName, share, jobs, state, thumb: null });
/** A synthetic answer of GET /api/atlas/skill-map (the shape services/atlas/skillMap.js returns). */
const ANSWER = (over = {}) => ({
  found: true, role: { id: 9, slug: "data-engineer", name: "Data Engineer", open: 1842, judged: 1800, published: true },
  aim: { id: 9, slug: "data-engineer", name: "Data Engineer", thumb: null }, current: { id: 4, slug: "backend-engineer", name: "Backend Engineer", thumb: null },
  threshold: 0.6, skills: { proven: 3, claimed: 8 }, applicable: 412,
  histogram: [20, 40, 80, 160, 300, 420, 380, 250, 100, 50].map((jobs, i) => ({ from: i / 10, to: (i + 1) / 10, jobs })),
  levels: null,
  asks: [ask(1, "SQL", "Data", 0.91, "proven", 1638), ask(2, "Python", "Backend", 0.84, "proven", 1512), ask(3, "Apache Spark", "Data", 0.58, "missing", 1044),
    ask(4, "Apache Airflow", "Data", 0.47, "missing", 846), ask(5, "AWS", "Infra", 0.46, "claimed", 828), ask(6, "Kafka", "Data", 0.33, "claimed", 594)],
  route: { hours: 52, estimated: true, steps: [
    { id: 3, slug: "apache-spark", name: "Apache Spark", kind: "learn", gain: 214, total: 626, hours: 30, estimated: false, published: true, stepId: "o4", thumb: null,
      companies: [{ name: "Kestrel Analytics", iconUrl: null, jobs: 40 }, { name: "Northwind Data", iconUrl: null, jobs: 31 }] },
    { id: 6, slug: "kafka", name: "Kafka", kind: "prove", gain: 90, total: 716, hours: 20, estimated: true, published: true, stepId: null, thumb: null, companies: [] }] },
  move: [
    { id: 9, slug: "data-engineer", name: "Data Engineer", open: 1842, judged: 1800, coverage: 0.52, applicable: 412, carries: [], missing: [], hoursTo30: 30, isAim: true, isCurrent: false, isShown: true },
    { id: 4, slug: "backend-engineer", name: "Backend Engineer", open: 3940, judged: 3900, coverage: 0.61, applicable: 1300, carries: [{ id: 1, name: "SQL", thumb: null }], missing: [{ id: 7, name: "Go", thumb: null }], hoursTo30: 0, isAim: false, isCurrent: true, isShown: false },
    { id: 5, slug: "platform-engineer", name: "Platform Engineer", open: 1120, judged: 1100, coverage: 0.35, applicable: 60, carries: [], missing: [], hoursTo30: null, isAim: false, isCurrent: false, isShown: false }],
  roles: [{ id: 9, slug: "data-engineer", name: "Data Engineer", isAim: true }, { id: 4, slug: "backend-engineer", name: "Backend Engineer", isCurrent: true }, { id: 5, slug: "platform-engineer", name: "Platform Engineer" }],
  ...over,
});
const visible = (html) => html.replace(/<(script|style)[\s\S]*?<\/\1>/g, "").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ");

test("a228Squarify: the treemap fills its box exactly once — areas proportional, nothing outside, nothing overlapping", () => {
  const items = [6, 6, 4, 3, 2, 2, 1].map((v, i) => ({ id: i, v }));
  const out = squarify(items, 0, 0, 600, 400);
  assert.equal(out.length, items.length);
  const area = out.reduce((a, r) => a + r.w * r.h, 0);
  assert.ok(Math.abs(area - 600 * 400) < 1e-6, "the tiles cover the box");
  for (const r of out) {
    assert.ok(r.x >= -1e-9 && r.y >= -1e-9 && r.x + r.w <= 600 + 1e-6 && r.y + r.h <= 400 + 1e-6, "inside");
    assert.ok(Math.abs(r.w * r.h - (r.v / 24) * 600 * 400) < 1e-6, "area ∝ value");
  }
  for (const a of out) for (const b of out) if (a !== b) {
    const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    assert.ok(ox <= 1e-6 || oy <= 1e-6, "no overlap");
  }
  assert.deepEqual(squarify([{ v: 0 }], 0, 0, 10, 10), [], "a zero item draws nothing");
  const fams = familyGroups(ANSWER().asks);
  assert.deepEqual(fams.map(f => f.id), ["Data", "Backend", "Infra"], "families biggest first");
  assert.deepEqual(fams[0].kids.map(k => k.name), ["SQL", "Apache Spark", "Apache Airflow", "Kafka"]);
  assert.equal(monogram("Apache Spark"), "AS");
  assert.equal(monogram("dbt"), "DB");
  assert.equal(fit("Apache Airflow", 40, 7), "Apac…");
});

test("a228Histogram: the bars at or past the line are the jobs you can apply for; the scale is a clean step", () => {
  const g = histogramBars(ANSWER().histogram, 0.6, 700);
  assert.deepEqual(g.bars.map(b => b.ok), [false, false, false, false, false, false, true, true, true, true]);
  assert.equal(g.xReach, g.pl + 0.6 * (700 - g.pl));
  assert.ok(g.bars.every(b => b.h >= 0 && b.y >= 0));
  assert.equal(g.ticks.at(-1) % 50, 0);
  const p = routePoints(412, ANSWER().route.steps);
  assert.deepEqual(p.map(x => [x.total, x.hours]), [[412, 0], [626, 30], [716, 50]], "running hours, running totals");
  assert.equal(niceTop(3940), 5000);
  assert.equal(niceTop(1842), 2000);
});

test("a228LabelNudge: a scatter label that would overlap one already placed moves below it; far-right labels sit left", () => {
  const pts = nudgeLabels([{ cx: 100, cy: 50, name: "Backend Engineer" }, { cx: 110, cy: 52, name: "Data Engineer" }, { cx: 880, cy: 200, name: "ML Engineer" }], 900);
  assert.equal(pts[0].ly, 50);
  assert.ok(pts[1].ly >= pts[0].ly + 15, "moved below the first");
  assert.equal(pts[2].anchor, "end", "far right → its label to the left of the dot");
});

test("a228PageOrder: the sketch's four sections in order, one reading — the number, what the jobs want, Learn next, the moves", async () => {
  const u = await loadUi();
  const html = u.page(ANSWER());
  assert.deepEqual([...html.matchAll(/data-skm-section="([^"]+)"/g)].map(m => m[1]), ["number", "wants", "learn", "move"]);
  assert.match(html, /data-skm-applicable="412"[^>]*>412<\/b><span class="skm-small">jobs you can apply for today<\/span>/);
  assert.match(html, /Backend Engineer → aiming for Data Engineer/);
  assert.equal(u.heroLine(ANSWER()), "Out of 1,842 open Data Engineer jobs, you have most of what these ask for. Learn Apache Spark and that grows by 214.");
  // every chart: an SVG drawn from tokens, hover/focus marks (data-tip + tabindex), and a table view
  for (const k of ["data-skm-histogram", "data-skm-treemap=\"map\"", "data-skm-route", "data-skm-scatter"]) assert.match(html, new RegExp(k), k);
  assert.equal((html.match(/<summary>Show as a table<\/summary>/g) || []).length, 4);
  assert.ok((html.match(/tabindex="0"[^>]*data-tip=|data-tip=[^>]*tabindex="0"/g) || []).length >= 10, "marks are focusable and carry words");
  // the map: Map | List, one view at a time; the List is the same skills as ranked bars
  assert.match(html, /aria-pressed="true"[^>]*>Map<\/button><button type="button" aria-pressed="false"[^>]*>List</);
  const list = u.page(ANSWER(), "list");
  assert.match(list, /data-skm-treemap="list"/);
  assert.doesNotMatch(list, /data-skm-treemap="map"/);
  // the three states: one hue — solid, hatched, dashed — and NAMED in the legend (never colour alone)
  assert.match(html, /data-skm-legend=""[\s\S]*Proven[\s\S]*On your résumé[\s\S]*Not yet/);
  assert.match(html, /class="skm-f-claimed" fill="url\(#skm-hatch-/);
  assert.match(html, /data-skm-tile="sql" data-state="proven"/);
  // Learn next: the skill's mark, "+N jobs", the hours, the companies (CompanyLogo), the button to the piece
  assert.match(html, /data-skm-step="apache-spark" data-kind="learn"[\s\S]*?Learn Apache Spark[\s\S]*?\+214 jobs[\s\S]*?about 30 h[\s\S]*?data-company-logo=/);
  assert.match(html, /data-skm-step="kafka" data-kind="prove"[\s\S]*?Prove Kafka/);
  assert.equal(u.stepHref("/app/atlas", ANSWER().route.steps[0]), "/app/atlas/library/silicon-to-software?view=circle#step-o4");
  assert.equal(u.stepHref("/app/atlas", ANSWER().route.steps[1]), "/app/atlas/your-skills?prove=Kafka");
  assert.match(html, /data-skm-next="" data-href="\/app\/atlas\/library\/silicon-to-software\?view=circle#step-o4"/);
  // the moves: a card per role, its meter, what carries over / to learn, Aim for this
  assert.equal((html.match(/data-skm-card=/g) || []).length, 3);
  assert.match(html, /data-skm-card="backend-engineer"[\s\S]*?You have 61% of it · 1,300 jobs to apply for now/);
  assert.match(html, />Aim for this</);
});

test("a228PlainWords: jobs, not postings / asks / coverage — on every visible word of the page", async () => {
  const u = await loadUi();
  const text = visible(u.page(ANSWER())) + visible(u.page(ANSWER(), "list"));
  assert.doesNotMatch(text, /postings?|asks|coverage|within reach|proficien/i);
  for (const h of ["jobs you can apply for today", "How close you are to each job", "What Data Engineer jobs want", "Learn next", "Jobs you could move to"]) assert.ok(text.includes(h), h);
  // ⛔ D190: the page reads one counted answer; it calls no model
  const src = ["SkillMap.jsx", "SkillTreemap.jsx", "JobsHistogram.jsx", "LearnNextChart.jsx", "MoveRolesScatter.jsx", "SkillMapBits.jsx", "skillMapModel.js"]
    .map(f => read(`client/src/pages/atlas/${f}`)).join("\n");
  assert.deepEqual([...src.matchAll(/api\(\s*[`"]([^`"?$]+)/g)].map(m => m[1]).sort(), ["/api/atlas/skill-map", "/api/navigator/aim"]);
});

test("a228LevelsHidden: the level tiles only when the server sends levels (null below its fill bar — the fixtures carry none)", async () => {
  const u = await loadUi();
  assert.doesNotMatch(u.page(ANSWER()), /data-skm-levels/);
  const html = u.page(ANSWER({ levels: [{ level: "mid", open: 900, applicable: 200 }, { level: "senior", open: 500, applicable: 60 }] }));
  assert.match(html, /data-skm-level="mid"[\s\S]*Mid-level[\s\S]*200[\s\S]*of 900 jobs[\s\S]*data-skm-level="senior"/);
  assert.match(u.page(ANSWER({ skills: { proven: 0, claimed: 0 } })), /data-skm-no-skills=""/);
});

test("a228TokensOnly: the skill map's look is theme tokens only, no capsule, reduced motion respected, the chart neutral a token", () => {
  const css = read("client/src/pages/atlas/SkillMap.css");
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ""), /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/, "every colour a theme token");
  assert.doesNotMatch(css, /border-radius:\s*(999|50%)/);
  assert.match(css, /\.skm-f-neutral \{ fill: var\(--c-chart-neutral\); \}/);
  assert.match(css, /\.skm-f-proven \{ fill: var\(--c-accent\); \}/);
  assert.match(css, /\.skm-f-missing \{[^}]*stroke-dasharray/);
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\)/, "motion only when the reader allows it");
  assert.match(css, /@media \(min-width: 1200px\) \{ \.skm-main \{ grid-template-columns: minmax\(0, 1\.9fr\) minmax\(360px, 1fr\);/, "the sketch's two columns from 1200 px; one below");
  for (const t of ["dusk-light", "dusk-dark", "plain-light", "plain-dark"]) assert.match(read(`client/src/themes/${t}.js`), /CHART_NEUTRAL: +"#[0-9A-F]{6}"/, t);
});
