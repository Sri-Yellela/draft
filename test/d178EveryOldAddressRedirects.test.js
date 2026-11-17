// ⭐ D178-1 · d178EveryOldAddressRedirects · d178NoOldFeatureUnreachable — docs/D178_ATLAS_INVENTORY.md accounts for every
// Atlas address, panel, Learn view and reader-facing route, each with its home in the redesign; and every address still
// resolves today (the redirects move with D178-3, when each new home exists — nothing is left loose meanwhile).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PANEL_IDS, PANEL_ALIASES, panelFor, isPanelSlug, courseIdOf } from "../client/src/pages/atlas/atlasPanels.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const inv = read("docs/D178_ATLAS_INVENTORY.md");

test("d178NoOldFeatureUnreachable: every panel, alias and Learn view is in the inventory with a home", () => {
  for (const id of PANEL_IDS) assert.ok(inv.includes(id === "overview" ? "`/atlas` (`overview`)" : `\`/atlas/${id}\``), `panel ${id}`);
  for (const a of Object.keys(PANEL_ALIASES)) assert.ok(inv.includes(`(\`${a}\` alias)`), `alias ${a}`);
  // ⭐ D178 (45j, changed on purpose): the tabs are retired — LearnView is the circle only — and each old view is in the
  // inventory with the address of its home, which resolves.
  const learn = read("client/src/pages/atlas/LearnView.jsx");
  assert.ok(!learn.includes("const TABS = ["), "Learn's tabs are retired");
  for (const [t, home] of [["circle", "/atlas/library/silicon-to-software?view=circle"], ["path", "/atlas/library/silicon-to-software"],
    ["patterns", "/atlas/library/coding-interview-patterns"], ["concepts", "/atlas/glossary"]]) {
    assert.match(inv, new RegExp(`\\| \`${t}\` \\|[^\\n]*\`${home.replace(/[?]/g, "\\?")}\``), `Learn view ${t} → ${home}`);
    assert.ok(isPanelSlug(home.slice("/atlas/".length).split("?")[0]) || courseIdOf(home.slice("/atlas/".length).split("?")[0]), `${home} resolves`);
  }
  for (const a of ["`/atlas/learn#step-<id>`", "`/atlas/family/<key>`", "`/atlas/<node slug>`", "`/atlas?q=…`", "`/atlas/library/<course>`"]) assert.ok(inv.includes(a), a);
});

test("d178NoOldFeatureUnreachable: every reader-facing Atlas and Learn route is listed", () => {
  const atlas = read("routes/atlas.js");
  const pub = atlas.slice(at(atlas, "export function createAtlasRouter("), at(atlas, "export function createAtlasAdminRouter("));
  const learn = read("routes/learn.js");
  const routes = (src, base) => [...src.matchAll(/router\.(get|post|put|delete)\("([^"]+)"/g)].map(m => `${m[1].toUpperCase()} ${base}${m[2]}`);
  const all = [...routes(pub, "/api/atlas"), ...routes(learn, "/api/learn")];
  assert.ok(all.length >= 25);
  const missing = all.filter(r => !inv.includes(`\`${r}\``));
  assert.deepEqual(missing, [], `routes not in docs/D178_ATLAS_INVENTORY.md: ${missing.join(", ")}`);
});

test("d178EveryOldAddressRedirects: today, every old address still resolves to its own feature (nothing 404s)", () => {
  for (const id of PANEL_IDS) assert.equal(panelFor(id), id, id);
  assert.equal(panelFor("check"), "your-skills");
  assert.equal(panelFor("family/data"), "your-map");
  assert.equal(panelFor("kafka"), "roles-and-skills");
  assert.equal(panelFor("", "kafka"), "roles-and-skills");
  assert.equal(courseIdOf("library/silicon-to-software"), "silicon-to-software");
  // ⭐ D178 (45j, changed on purpose): the redirects are in — each old address resolves to its new home.
  assert.ok(isPanelSlug("learn") && isPanelSlug("overview") && isPanelSlug("your-route"), "the old slugs stay reserved");
  assert.equal(panelFor("learn"), "library", "/atlas/learn → the course's circle view");
  assert.equal(panelFor("your-route"), "your-map", "/atlas/your-route → Your map");
  assert.equal(panelFor("overview"), "overview");
  const page = read("client/src/pages/atlas/AtlasPage.jsx");
  assert.ok(page.includes('{learning && <Navigate replace to={`${base}/library/silicon-to-software?view=circle${location.hash || ""}`} />}'), "Learn's redirect keeps #step-<id>");
  // ⭐ 46u (owner 11-17, changed on purpose): signed in, Atlas opens on Your map (D178 opened Your run).
  assert.ok(page.includes('const panel = panelFor(slug, q) === "overview" && signedIn ? "your-map" : panelFor(slug, q);'), "signed in, Atlas opens on Your map");
  const route = /^atlas(?:\/(?:family|library))?(?:\/[^/]+)?$/;
  assert.ok(read("client/src/App.jsx").includes(String.raw`const atlasRoute = /^atlas(?:\/(?:family|library))?(?:\/[^/]+)?$/.test(routeKey);`), "App.jsx's route rule is the one tested here");
  for (const a of ["atlas", "atlas/your-route", "atlas/learn", "atlas/family/data", "atlas/library/sw-f-01", "atlas/kafka"]) assert.match(a, route, `/app/${a} is not bounced`);
});
