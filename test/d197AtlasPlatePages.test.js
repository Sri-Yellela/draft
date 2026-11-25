// ⭐ D197 Wave 1 #5–#7 (47h, lane atlas) · ATLAS IN THE PLATE SYSTEM — Volume I (board `Home`), a region (board `Map`),
// the Library (board `Library`), and Atlas's area nav. The data is Atlas's own (pages/atlas/volumeModel.js), read from the
// real course; the pages are the boards' (plate/AtlasHome.jsx · AtlasRegion.jsx · AtlasLibrary.jsx, F5 in d196Regress's
// atlas-* pairs). D200 Rule 1 (nothing lost) and Rule 2 (every mark answers) are checked here.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { courseOf } from "../services/learn/learnCourse.js";
import { volumeOf, volumeStats, regionPlaces, regionTrails, libraryOf, COLLECTIONS, callNumber, atlasPlaces, REGION_META, gridOf, placeChecks } from "../client/src/pages/atlas/volumeModel.js";
import { ATLAS_NAV, COMPETE_NAV, panelFor, courseIdOf } from "../client/src/pages/atlas/atlasPanels.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const doc = JSON.parse(read("content/learn/silicon-to-software.json"));
const course = courseOf(doc, { sources: [] });
const allLessons = course.modules.flatMap((m) => m.lessons);
/** Every mark a lesson can earn (its links opened, its checkpoints explained, its build linked). */
const finish = (l) => Object.fromEntries([...l.toOpen, ...l.checks, ...(l.build ? [l.build] : [])].map((id) => [id, 1]));

test("D197 #5 · Volume I is the course: 8 regions in the board's order, 108 places, lit only by the one earned rule", () => {
  const v = volumeOf(course, {});
  assert.equal(v.regions.length, 8);
  assert.equal(v.lessons, 108);
  assert.deepEqual(v.regions.map((r) => r.roman), ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"]);
  assert.deepEqual(v.regions.map((r) => r.kind), REGION_META.map((m) => m.kind));
  assert.deepEqual(v.regions.map((r) => r.total), [11, 14, 11, 18, 11, 5, 23, 15], "the board's per-region totals");
  assert.equal(v.regions[1].name, "The physical machine", "region II's board name is a placeholder — the module's own title is used");
  assert.equal(v.lit, 0, "nothing earned, nothing lit");
  assert.equal(v.here.id, allLessons[0].id, "with nothing started, you start at the first place");
  // opening one link is not lighting a place (D117 C8): the place lights only when every mark is earned
  const first = course.modules[0].lessons[0];
  assert.equal(volumeOf(course, { [first.toOpen[0]]: 1 }).lit, 0);
  const lit = volumeOf(course, finish(first));
  assert.equal(lit.regions[0].lit, 1);
  assert.equal(lit.regions[0].squares[0], "lit");
  assert.notEqual(lit.here.id, first.id, "you move on to the next unlit place");
  assert.deepEqual(volumeStats(v).map((c) => c.label), ["REGIONS", "LESSONS", "FIELD NOTES"]);
});

test("D197 #6 · a region: one next waypoint, every place on the 1400 × 720 terrain with its grid, stages rising to the summit", () => {
  const v = volumeOf(course, {});
  for (const m of course.modules) {
    const places = regionPlaces(m, {}, { regions: v.regions, course });
    assert.equal(places.length, m.lessons.length);
    assert.equal(places.filter((p) => p.state === "next").length, 1, `module ${m.n}: one next waypoint`);
    for (const p of places) {
      assert.ok(p.x >= 0 && p.x <= 1400 && p.y >= 0 && p.y <= 720, `${p.name} on the terrain`);
      assert.equal(p.grid, gridOf(p.x, p.y));
    }
    assert.equal(places[0].stage, "start");
    assert.equal(places[places.length - 1].stage, "master");
    assert.ok(places[places.length - 1].summit, "the last place is the summit");
    const trails = regionTrails(places, null);
    assert.equal(trails.length, places.length - 1, "with no circle data, the trail follows the order");
  }
  // a lit place, then the next: the walked trail and the marching one
  const m = course.modules[3];
  const marks = finish(m.lessons[0]);
  const places = regionPlaces(m, marks, { regions: v.regions, course });
  assert.equal(places[0].state, "lit");
  assert.equal(places[1].state, "next");
  assert.equal(regionTrails(places, null)[0].kind, "next");
  // checks = checkpoints (+ build), lit when explained / built
  const l = m.lessons[0];
  assert.equal(placeChecks(l, {}).total, l.checks.length + (l.build ? 1 : 0));
  assert.equal(placeChecks(l, marks).done, placeChecks(l, marks).total);
});

test("D197 #6 · interchanges come from the circle's links into another region", () => {
  const v = volumeOf(course, {});
  const m = course.modules[3], other = course.modules[0].lessons[0];
  const circle = { pieces: { [m.lessons[2].id]: { needs: [{ id: other.id }], opens: [] } } };
  const places = regionPlaces(m, {}, { circle, regions: v.regions, course });
  assert.deepEqual(places[2].interchange && [places[2].interchange.roman, places[2].interchange.n], ["I", 1]);
  assert.equal(places[1].interchange, null);
});

test("D197 #7 · the Library holds only outside resources — every link of an outside kind filed once, nothing draft makes", () => {
  const items = libraryOf(course, {});
  const outside = new Set(["Video", "Book", "Article", "Course", "Playlist", "Practice", "Sandbox", "Lab", "Guide"]);
  const expected = allLessons.flatMap((l) => l.links).filter((x) => x.url && outside.has(x.kind));
  assert.equal(items.length, expected.length, "every outside link is on a shelf");
  assert.equal(new Set(items.map((x) => x.id)).size, items.length, "and on one shelf only");
  assert.ok(items.every((x) => !["Build", "Project", "Atlas"].includes(x.kind)), "things the learner makes are not resources");
  assert.ok(items.every((x) => COLLECTIONS.some((c) => c.id === x.collection) && x.collection !== "glossary"));
  assert.equal(items.filter((x) => x.collection === "notes").length, volumeOf(course, {}).notes, "field notes = the videos, counted the same on Volume I");
  assert.equal(callNumber({ by: "L. Lamport", region: { roman: "IV" } }, 0), "IV.1 LAM");
  assert.equal(callNumber({ by: "J. Saltzer, D. Reed, D. Clark", region: { roman: "IV" } }, 1), "IV.2 SAL");
  assert.equal(callNumber({ by: "G. DeCandia et al.", region: { roman: "IV" } }, 3), "IV.4 DEC");
});

test("⛔ D200 Rule 1 · nothing lost — every Atlas panel is in Volume I's footer and the area nav (views or More)", () => {
  const groups = atlasPlaces("/atlas", { league: true, challenges: true });
  const hrefs = groups.flatMap((g) => g.links.map((l) => l.href));
  for (const id of [...ATLAS_NAV.flatMap((g) => g.panels.map((p) => p.id)), ...COMPETE_NAV.panels.map((p) => p.id), "overview"]) {
    assert.ok(hrefs.includes(id === "overview" ? "/atlas/overview" : `/atlas/${id}`), `${id} is reachable`);
  }
  assert.ok(hrefs.includes("/atlas/library/shelf"), "draft's own courses and guides (the old Library shelf)");
  // with the switches off, Compete's places are not offered (their addresses still say so)
  assert.ok(!atlasPlaces("/atlas", null).some((g) => g.label === "Compete"));
  // the area nav: the four views + More = every place
  const src = read("client/src/pages/atlas/AtlasVolume.jsx");
  for (const v of ['label: "Your survey"', 'label: "Library"', 'label: "Today’s question"', 'label: "League"']) assert.ok(src.includes(v), v);
  assert.match(src, /const more = atlasPlaces\(base, compete\)\.flatMap\(\(g\) => g\.links\)\.filter\(\(l\) => !inViews\.has\(l\.id\)\)/);
  // every old address still resolves to its page (AtlasPage), and the new ones exist
  const page = read("client/src/pages/atlas/AtlasPage.jsx");
  assert.match(page, /const regionN = slug && \/\^region\\\/\\d\+\$\/\.test\(slug\)/);
  assert.ok(page.includes('{courseId === "shelf" && <LibraryShelf base={base} signedIn={signedIn} />}'), "the shelf at /library/shelf");
  assert.ok(page.includes('{courseId && courseId !== "shelf" && (COURSES'), "every course / guide / deck page is unchanged");
  assert.equal(courseIdOf("library/shelf"), "shelf");
  for (const [slug, panel] of [["your-map", "your-map"], ["your-run", "your-run"], ["your-skills", "your-skills"], ["check", "your-skills"], ["library", "library"],
    ["library/silicon-to-software", "library"], ["how-it-works", "how-it-works"], ["todays-question", "todays-question"], ["the-audit", "the-audit"],
    ["roles-and-skills", "roles-and-skills"], ["this-weeks-market", "this-weeks-market"], ["glossary", "glossary"], ["league", "league"], ["challenges", "challenges"],
    ["overview", "overview"], ["family/data", "your-map"], ["kafka", "roles-and-skills"]]) assert.equal(panelFor(slug), panel, slug);
  // App: the nav slot draws Atlas's own nav
  const app = read("client/src/App.jsx");
  assert.ok(app.includes('if (activeTab === "atlas") return <AtlasAreaNav onHome={onHome} />;'));
});

test("⛔ D200 Rule 2 · every mark answers on Atlas's three pages", () => {
  const home = read("client/src/plate/AtlasHome.jsx"), region = read("client/src/plate/AtlasRegion.jsx"), lib = read("client/src/plate/AtlasLibrary.jsx");
  const page = read("client/src/pages/atlas/AtlasVolume.jsx");
  // Volume I: each figure links (regions → the plates, lessons → the course, field notes → the Library); each region plate,
  // each callout tag, the volumes panel's rows and the footer's places are links
  assert.match(page, /stats=\{vol \? volumeStats\(vol\)\.map\(\(c, i\) => \(\{ \.\.\.c, href: \[/);
  assert.match(home, /<a className="pl-at-rplate" href=\{r\.href\}/);
  assert.match(home, /<a className="pl-at-vols__row" href=\{r\.href\}/);
  assert.match(home, /tags\.here\.href \? <a className="pl-at-tag__line"/);
  // the region: the waypoint, every place (a button → its field card → Open this place), every index row, every interchange
  assert.match(region, /<a className="pl-at-waypoint" href=\{waypoint\.href\}/);
  assert.match(region, /<button type="button" className="pl-at-mk"/);
  assert.match(region, /<a className="pl-at-pcard__open" href=\{c\.href\}/);
  assert.match(region, /<button key=\{p\.id\} type="button" className="pl-at-index__row" role="row" onClick=\{\(\) => onOpen\(p\.id\)\}/);
  assert.match(region, /<a className="pl-at-ichange" href=/);
  // the Library: collections and chips are buttons, every resource opens, every catalogue card's button goes to its lesson
  assert.match(lib, /<button key=\{c\.id\} type="button" className="pl-at-lcat"/);
  assert.match(lib, /<button key=\{c\.id\} type="button" className="pl-at-lchip"/);
  assert.match(lib, /<a className="pl-at-note" href=\{href\}/);
  assert.match(lib, /action=\{\{ label: "I can explain it", href: lessonHref\(x\)/);
  // an empty collection says so (never nothing)
  assert.match(lib, /<span className="pl-at-empty__k">EMPTY DRAWER<\/span>/);
});

test("D200 Rule 3 · Atlas's three pages are destinations, so their serif titles stay (the one-line header is for working pages)", () => {
  const css = read("client/src/plate/atlasPlate.css");
  assert.match(css, /\.pl-at-h1 \{[^}]*font-size: var\(--pl-t-hero\)/, "Volume I keeps its 82 px title");
  assert.match(css, /\.pl-at-rhead__title \{[^}]*font-size: var\(--pl-t-region\)/, "a region keeps its 56 px title");
});

test("D60 · no capsule where the boards draw one (the interchange chip, the drawer pull)", () => {
  const css = read("client/src/plate/atlasPlate.css");
  assert.match(css, /\.pl-at-ichange, \.plate a\.pl-at-ichange \{[^}]*border-radius: var\(--pl-r-status\)/);
  assert.match(css, /\.pl-at-drawer__pull \{[^}]*border-radius: var\(--pl-r-sq-lg\)/);
  assert.doesNotMatch(css, /999px/);
});
