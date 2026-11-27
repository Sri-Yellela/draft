// ⭐ D199 C1–C6 + C8 and D200 on the market (owner 11-25, 47h) — the market rebuilt to the approved `Market` board.
//   d199TwoSections · d199SearchSortFiltersPresent · d199SentenceAndChipsOneState · d199PagedNotInfinite ·
//   d199StatsBoxFollowsFilters · d199StatsCellAppliesFilter · d199MapAreaFromCounts · d199MapSectorClickFilters ·
//   d199MapKeyboardLegend · d199PlateDrawingsTokensOnly · d199DeckTicketFixedWidth · d199FieldCardGrows ·
//   d199DeckPagesBoardList · d199IndexBubblePushesLeft · d200EveryMarkAnswers · d200H1bStampOpensFilings ·
//   d200LogoOpensTechnographics · d200HeaderOneLine
// Fast tier: pure functions, source reads and static markup (esbuild + react-dom/server). The look is F5's
// (scripts/d196Regress.mjs, the eight final-market-* pairs); the live walk is the browser tier's.
// ⛔ Verified to fail before it was committed (each by hand): BoardMore drawn on the plate again; the stats box fed the
// counts strip's boardCounts; a #hex fill in MarketMap.jsx; --pl-map-ink added to the theme block; the deck column back
// to flex 999; the Index actions cell positioned absolute; the stamp drawn without its popover — each failed, naming it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { at } from "../test-support/sourceAnchors.js";
import { readPageParam, pageInSearch, pagerTiles, pageLine } from "../client/src/lib/boardPaging.js";
import { boardPageCards, carryDeck, deckPagePosition } from "../client/src/plate/marketPlate.js";
import { hiringTrend, companyBrief } from "../client/src/lib/companyBrief.js";
import { marketFigures, sentenceParts } from "../client/src/lib/filterSentenceModel.js";
import { fieldCardView } from "../shared/contextualView.js";

const ROOT = process.cwd();
const CLIENT = path.join(ROOT, "client");
const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

let mod = null;
async function load() {
  if (mod) return mod;
  const esbuild = createRequire(path.join(CLIENT, "package.json"))("esbuild");
  const out = path.join(ROOT, "tmp", "d196-render", `d199-${process.pid}.mjs`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const src = (f) => JSON.stringify(path.join(CLIENT, "src", f));
  const entry = `
    import * as React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import { MemoryRouter } from "react-router-dom";
    import * as Controls from ${src("plate/MarketControls.jsx")};
    import * as Map from ${src("plate/MarketMap.jsx")};
    import MarketHero, { heroLine } from ${src("plate/MarketHero.jsx")};
    import MarketPager from ${src("plate/MarketPager.jsx")};
    import MarketCardFace from ${src("plate/MarketCardFace.jsx")};
    import { MarketIndexTable, RowBubble, indexRow } from ${src("plate/MarketIndex.jsx")};
    import * as Pop from ${src("plate/MarkPopover.jsx")};
    import MarketOpenings, { briefFacts, withPartReasons } from ${src("plate/MarketOpenings.jsx")};
    export { Controls, Map, heroLine, indexRow, Pop, briefFacts, withPartReasons };
    const h = React.createElement;
    export const r = (C, p) => renderToStaticMarkup(h(MemoryRouter, null, h(C, p)));
    export const C = { MarketHero, MarketPager, MarketCardFace, MarketIndexTable, RowBubble, MarketOpenings };
  `;
  await esbuild.build({
    stdin: { contents: entry, resolveDir: CLIENT, loader: "jsx" }, bundle: true, format: "esm", platform: "node", outfile: out,
    jsx: "automatic", logLevel: "error", loader: { ".css": "empty", ".woff": "empty", ".woff2": "empty" },
    define: { "process.env.NODE_ENV": '"production"', "import.meta.env": "{}" }, nodePaths: [path.join(CLIENT, "node_modules")],
    banner: { js: 'import { createRequire as __d199CR } from "node:module"; const require = __d199CR(import.meta.url);' },
  });
  mod = await import(pathToFileURL(out).href);
  return mod;
}
const app = () => read("client/src/App.jsx");
const css = () => strip(read("client/src/plate/plate.css"));

test("D199 C1 · d199TwoSections — the hero and ONE section (bearing → controls → openings → pager); Tickets out left the market", async () => {
  const a = app();
  assert.ok(a.includes('<PlateRoot className="pl-marketpage" data-plate-page="market"><MarketHeroSlot /><MarketSectionSlot deck={homeDeck} index={homeBoard} /></PlateRoot>'));
  const sec = a.slice(at(a, "function MarketSectionSlot("), at(a, "function MarketPagerSlot("));
  for (const [x, y] of [["<LegHeader n={1}", "<BoardHeadlineSlot />"], ["<BoardHeadlineSlot />", "<MarketOpenings "]]) assert.ok(at(sec, x) < at(sec, y), `${x} before ${y}`);
  assert.match(sec, /pager=\{<MarketPagerSlot \/>\}/);
  assert.ok(!/MarketTickets|tickets=/.test(sec) && !a.includes("MarketOpeningsSlot"), "no Tickets out on the market");
  const { r, C } = await load();
  const html = r(C.MarketOpenings, { deck: "DECK", index: "INDEX", pager: "PAGER" });
  assert.ok(html.includes("DECK") && html.includes("INDEX") && html.includes("PAGER"));
  assert.ok(!/Tickets out|mk-onward/.test(html), "the openings draw no third section");
  assert.ok(!/<section/.test(html), "the openings are part of the one section, not a section of their own");
});

test("D199 C2 · d199SearchSortFiltersPresent — search, sort, every filter chip, All filters, Clear all, the open panel — outside the Index tab", async () => {
  const a = app();
  const slot = a.slice(at(a, "function BoardHeadlineSlot()"), at(a, "function RouteCommitSignal()"));
  const plate = slot.slice(at(slot, "<PlateBearing "));
  for (const k of ["<MarketSearchRow search={<BoardSearchBar", "sort={<MarketSortSlot />}", "<BoardSortSlot />", "<MarketFilterRow ", "<WordPanel ", "<MarketStatsBox "]) assert.ok(plate.includes(k), k);
  const home = a.slice(at(a, "const homeBoard = ("), at(a, "return (\n    <JobBoardProvider>"));
  // 47j R2 (changed on purpose): the classic bar is deleted outright — the cartouche's row is the only search + sort
  assert.doesNotMatch(home, /<StickyBar|<BoardBar \/>/, "the board's own bar is back");
  const { Controls, r } = await load();
  assert.deepEqual(Controls.MARKET_FILTERS.map((f) => f.label), ["Role", "Level", "Workstyle", "Location", "Posted", "Fit", "Sponsorship", "Technology", "Salary & more", "Employment type"]);
  const html = r(Controls.MarketFilterRow, { params: {}, all: { id: "fh-all", slot: "all", open: false } });
  for (const f of Controls.MARKET_FILTERS) assert.ok(html.includes(`data-filter="${f.key}"`), f.key);
  assert.match(html, /id="fh-all"[^>]*>All filters</, "All filters kept (M1: nothing lost)");
  assert.match(html, />Clear all</);
  const sort = r(Controls.MarketSortButton, { label: "Best match" });
  assert.match(sort, /SORT<\/span>.*Best match/);
  // the sort keeps the code's five orders: the one SortPanel (BoardSortSlot), its rows from shared/filterSentence.js
  assert.ok(a.includes("function MarketSortSlot()") && /sortRows\(atsSortAvailable\)/.test(a.slice(at(a, "function MarketSortSlot()"))));
});

test("D199 C2 · d199SentenceAndChipsOneState — chips are the sentence's params; removing one changes the sentence", async () => {
  const { Controls } = await load();
  const params = { experience_levels: ["senior"], company_sponsorship: "filed", places: [] };
  const chips = Controls.filterChips(params);
  assert.equal(chips.find((c) => c.key === "level").active, true);
  assert.equal(chips.find((c) => c.key === "location").active, false, "the floor (the United States) is not a choice");
  const active = Controls.activeChips(params, { query: "react" });
  assert.deepEqual(active.map((c) => c.id), ["query", "level", "sponsorship"]);
  const level = active.find((c) => c.id === "level");
  assert.match(level.label, /^Level: senior$/);
  const after = { ...params, ...level.patch };
  assert.ok(!sentenceParts(after).slots.find((s) => s.key === "level").active, "the patch lifts the sentence's word too");
  assert.deepEqual(Controls.removePatch("domain"), { job_functions: [], category: "", subcategory: "" });
  // the two projections read the same params and write through the same onPatch
  const slot = app().slice(at(app(), "function BoardHeadlineSlot()"), at(app(), "function RouteCommitSignal()"));
  assert.match(slot, /<PlateBearing params=\{params\}/);
  assert.match(slot, /<MarketFilterRow params=\{params\}[^]*?onPatch=\{onPatch\}/);
  // Clear all = every clause + the drawer + the search, one writer (JobsPanel)
  const jp = read("client/src/panels/JobsPanel.jsx");
  assert.match(jp, /clearEverythingRef\.current = \(\) => \{\n\s*clearAllFilters\(\);\n\s*applyClausePatch\(/);
  // the search box follows the search in force (M1 caveat iii)
  assert.match(read("client/src/components/BoardBar.jsx"), /if \(v\.trim\(\) === committed\.current\) return;/);
});

test("D199 C3 · d199PagedNotInfinite — 50 a page, ?page= round-trips, Back / Forward page, nothing fetched at a page's end", async () => {
  for (const [s, n] of [["", 1], ["?page=3", 3], ["?job=x&page=12", 12], ["?page=0", 1], ["?page=abc", 1], ["?page=-2", 1]]) assert.equal(readPageParam(s), n, s);
  assert.equal(pageInSearch("?job=x", 4), "?job=x&page=4");
  assert.equal(pageInSearch("?job=x&page=4", 1), "?job=x", "page 1 leaves no param");
  assert.equal(readPageParam(pageInSearch("?plate=1", 7)), 7);
  assert.deepEqual(pagerTiles(1, 225).map((t) => t.kind === "page" ? t.page : t.kind), ["prev", 1, 2, 3, "gap", 225, "next"]);
  assert.deepEqual(pagerTiles(10, 225).map((t) => t.kind === "page" ? t.page : t.kind), ["prev", 1, "gap", 8, 9, 10, 11, 12, "gap", 225, "next"]);
  assert.equal(pagerTiles(1, 1).length, 0);
  assert.equal(pagerTiles(1, 5)[0].disabled, true);
  assert.equal(pageLine({ page: 2, totalPages: 225, pageSize: 50, total: 11247 }), "PAGE 2 OF 225 · 50 PER PAGE · 11,247 OPENINGS");
  assert.equal(pageLine({ page: 1, totalPages: 0, pageSize: 50, total: null }), null);
  const jp = read("client/src/panels/JobsPanel.jsx");
  assert.match(jp, /const PAGE_SIZE = 50;/);
  // 47j R2 (changed on purpose): BoardMore (the endless loading) is deleted with the classic market
  assert.doesNotMatch(jp, /<BoardMore\b|function BoardMore\(/, "BoardMore (the endless loading) is back");
  assert.match(jp, /window\.history\.pushState\(/);
  assert.match(jp, /window\.addEventListener\("popstate", onPop\)/);
  assert.match(jp, /readPageParam\(window\.location\.search\)/);
  assert.match(jp, /setBoardPager\?\.\(\{ page: currentPage, totalPages, total: totalJobs, pageSize: PAGE_SIZE, jobs, loading: boardLoading, goTo: pagerGoTo \}\)/);
  for (const f of fs.readdirSync("client/src/plate").filter((x) => /^Market.*\.jsx$/.test(x))) assert.ok(!/IntersectionObserver/.test(read(`client/src/plate/${f}`)), `${f} loads nothing on scroll`);
  const { r, C } = await load();
  const html = r(C.MarketPager, { page: 1, totalPages: 225, total: 11247, pageSize: 50 });
  assert.match(html, /aria-label="Pages"/);
  assert.match(html, /aria-current="page"[^>]*>1</);
  assert.match(html, /aria-label="Last page, 225"/);
});

test("D199 C4 · d199StatsBoxFollowsFilters — the box is the list's own facets answer, its cells the hero's four", async () => {
  const slot = app().slice(at(app(), "function BoardHeadlineSlot()"), at(app(), "function RouteCommitSignal()"));
  assert.match(slot, /<MarketStatsBox figures=\{marketFigures\(facets\)\} params=\{params\}/, "the same facets answer the panels count from (A239)");
  assert.ok(!/boardCounts\(/.test(slot), "never the counts strip's second source");
  const { Controls, r } = await load();
  const facets = { total: 412, views: { all: 412 }, clauses: { posted: [{ value: "1d", count: 9 }], sponsorship: [{ value: "filed", count: 167 }], fit: [{ value: "strong", count: 23 }] } };
  const cells = Controls.statsCells(marketFigures(facets), {});
  assert.deepEqual(cells.map((c) => [c.label, c.value]), [["FIT YOUR BEARING", 412], ["NEW TODAY", 9], ["FILED H-1B", 167], ["STRONG FIT", 23]]);
  assert.deepEqual(Controls.statsCells(marketFigures(null), {}).map((c) => c.value), [null, null, null, null], "no answer → no number, never 0");
  const on = r(Controls.MarketStatsBox, { figures: marketFigures(facets), params: { company_sponsorship: "filed" } });
  assert.match(on, /data-stat="filed" aria-pressed="true"/, "an active filter's cell shows it");
  assert.match(on, /data-stat="newToday" aria-pressed="false"/);
  const home = app().slice(at(app(), "const homeBoard = ("));
  // 47j R2 (changed on purpose): the counts strip is deleted — the stats box is the only one
  assert.doesNotMatch(home, /<BoardCounts \/>|function BoardCounts\(/, "the counts strip is back");
});

test("D199 C4 · d199StatsCellAppliesFilter — a tap applies the cell's filter, a second lifts it", async () => {
  const { Controls } = await load();
  assert.deepEqual(Controls.statPatch("newToday", {}), { ageFilter: "1d" });
  assert.deepEqual(Controls.statPatch("newToday", { ageFilter: "1d" }), { ageFilter: "" });
  assert.deepEqual(Controls.statPatch("filed", {}), { company_sponsorship: "filed" });
  assert.deepEqual(Controls.statPatch("strong", { fit_bands: ["moderate"] }), { fit_bands: ["strong"] });
  assert.deepEqual(Controls.statPatch("strong", { fit_bands: ["strong", "moderate"] }), { fit_bands: ["moderate"] });
  assert.equal(Controls.statPatch("fit", {}), null);
});

test("D199 C5 · d199MapAreaFromCounts — sectors from the facets' roles, area from their counts", async () => {
  const { Map, r } = await load();
  const opts = [{ value: "be", label: "Backend", group: "Software engineering", groupId: "swe", count: 1600 },
    { value: "fe", label: "Frontend", group: "Software engineering", groupId: "swe", count: 1000 },
    { value: "de", label: "Data engineering", group: "Data & AI", groupId: "data", count: 700 },
    { value: "x", label: "No group", count: 5 }];
  const s = Map.sectorsFromRoleOptions(opts);
  assert.deepEqual(s.map((x) => [x.id, x.n]), [["swe", 2600], ["data", 700]]);
  assert.deepEqual(s[0].subs.map((x) => x.label), ["Backend", "Frontend"]);
  // the board's own counts draw every slot whole; a sector with a smaller share than its slot shrinks
  for (const [i, n] of [4812, 2236, 1604, 1415, 588].entries()) assert.equal(Map.territoryScale(n, 10655, i), 1);
  assert.ok(Map.territoryScale(100, 10655, 0) < 1 && Map.territoryScale(100, 10655, 0) >= 0.55);
  const html = r(Map.MarketMap, { sectors: s, figures: {} });
  assert.match(html, /data-sector="swe" data-area-scale="1\.000"/);
  assert.equal((html.match(/data-area-scale=/g) || []).length, 2);
  assert.ok(!/data-capital/.test(html), "no capitals the page wasn't given");
  assert.ok(!/data-hatch/.test(html), "no hatch where the strong share isn't known");
});

test("D199 C5 · d199MapSectorClickFilters — a territory (or its legend button) sets the Role word to its category", async () => {
  const hero = app().slice(at(app(), "function MarketHeroSlot()"), at(app(), "function MarketSectionSlot("));
  assert.match(hero, /onPick=\{onPatch \? \(id\) => onPatch\(\{ category: id \|\| "", subcategory: "" \}\) : undefined\}/);
  assert.match(hero, /sectorsFromRoleOptions\(boardHeadline\?\.facets\?\.clauses\?\.role \|\| \[\]\)/);
  const { Map, r } = await load();
  const sectors = [{ id: "swe", name: "Software engineering", n: 10 }, { id: "data", name: "Data & AI", n: 5 }];
  const html = r(Map.MarketMap, { sectors, picked: "data", figures: { fit: 5, strong: 2 } });
  assert.match(html, /data-sector-button="data"/);
  assert.match(html, /aria-pressed="true" data-slot="1" data-sector-button="data"/);
  assert.match(html, /Back to all sectors/);
  assert.match(html, /data-hatch="data"/, "the picked sector's strong share is known — its hatch is drawn");
  for (const l of ["Zoom in", "Zoom out", "Recenter the map"]) assert.ok(html.includes(`aria-label="${l}"`), l);
  const src = read("client/src/plate/MarketMap.jsx");
  assert.match(src, /onPick\?\.\(id === picked \? null : id\)/, "tapping the picked sector again lifts the filter");
});

test("D199 C5 · d199MapKeyboardLegend — every sector is a button in the legend row; arrows move along it", async () => {
  const src = read("client/src/plate/MarketMap.jsx");
  for (const k of ["ArrowRight", "ArrowLeft", "Home", "End"]) assert.ok(src.includes(`"${k}"`), k);
  const { Map, r } = await load();
  const html = r(Map.MarketMap, { sectors: [{ id: "a", name: "A", n: 3 }, { id: "b", name: "B", n: 2 }, { id: "c", name: "C", n: 1 }] });
  assert.match(html, /role="group" aria-label="Sectors — tap one to filter to it"/);
  assert.equal((html.match(/data-sector-button=/g) || []).length, 3);
});

test("D199 · d199PlateDrawingsTokensOnly — the map takes only its own tokens, which no theme redefines (defect (c))", () => {
  const src = strip(read("client/src/plate/MarketMap.jsx"));
  assert.ok(!/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(src), "no colour literal in the drawing");
  assert.ok(!/\b(fill|stroke)=["'](?!none|url)/.test(src), "fills and strokes come from classes (the map tokens), not attributes");
  const c = css();
  const rules = [...c.matchAll(/\.pl-polmap__(ground|waves path|glow|land[^{]*|hatch|hatchline|held|heldtext|name[^{]*|cap|captext|route|ping|you|compass|needle|north)\s*\{([^}]*)\}/g)];
  assert.ok(rules.length >= 15, `the drawing's rules (${rules.length})`);
  for (const m of rules) for (const v of m[2].matchAll(/(?:fill|stroke|background)\s*:\s*([^;]+)/g)) {
    assert.match(v[1].trim(), /^(var\(--pl-map-[\w-]+\)|none|url\(#pmHatch\))$/, `.pl-polmap__${m[1]}: ${v[1]}`);
  }
  const tok = read("client/src/styles/plate.css");
  const themed = tok.slice(at(tok, ':root:not([data-plate-palette="sketch"]) .plate {'));
  assert.ok(!/--pl-map-/.test(themed.slice(0, at(themed, "}"))), "the theme block leaves the map's palette alone");
  assert.match(tok, /--pl-map-ground: #FBF8F4/);
});

test("D199 C6 · d199DeckTicketFixedWidth / d199FieldCardGrows — the deck column holds 560 px, the spare width is the field card's", () => {
  const c = css();
  assert.match(c, /\.pl-market-deck > :first-child \{ flex: 0 1 560px; width: 560px; max-width: 100%; min-width: 0; \}/);
  assert.match(c, /\.pl-market-deck__side \{ flex: 1 1 360px; min-width: 0; \}/);
  assert.match(c, /\.pl-market-deck__side \.pl-fieldcard \{ max-width: none; \}/);
});

test("D199 C6 · the field card's three scores are labelled and a missing one says why; duties drop context lines", async () => {
  const contextual = { score: 70, parts: {
    role_fit: { score: null, status: "no_data", reason: "posting_not_placed" }, tech_stack: { score: 69, status: "ok", exact: [], gaps: [] },
    responsibility_overlap: { score: null, status: "no_data", reason: "no_responsibility_lines", matched: [], missing: [] } } };
  const { withPartReasons } = await load();
  const v = withPartReasons(fieldCardView({ report: { score: 70 }, contextual }), contextual);
  assert.deepEqual(v.figures.items.map((f) => [f.label, f.value, f.why || null]), [["ROLE FIT", null, "POSTING NOT PLACED YET"], ["STACK", 69, null], ["DUTIES", null, "NO DUTIES LISTED"]]);
  assert.match(read("client/src/plate/Cards.jsx"), /<span className="pl-card__why">\{f\.why \|\| "NOT SCORED YET"\}<\/span>/, "never a bare —");
  const { briefFacts } = await load();
  assert.deepEqual(briefFacts({ filings: 214, fiscalYear: 2025, openJobs: 38, trend: { pct: 171, dir: "up", since: "June" } }).map((f) => `${f.pre || ""}${f.b}${f.t}`),
    ["214 H-1B filed, FY25", "Hiring ↑ 171 % since June", "38 open roles"]);
  assert.equal(briefFacts({ filings: null, openJobs: null })[0].t, "No H-1B record found", "a part not held says so");
});

test("D199 C3 · d199DeckPagesBoardList — the deck deals the board's page (not the daily deal), its counter the whole list's", () => {
  const cards = boardPageCards([{ jobId: "a", id: "a", title: "A", baseAtsScore: 91 }, { jobId: "b", title: "B", matchScore: null }, { jobId: "a" }]);
  assert.deepEqual(cards.map((c) => [c.job.id, c.score]), [["a", 91], ["b", null]], "one card a job, the board's own score");
  const next = { cards: [{ job: { id: "a" } }, { job: { id: "b" } }, { job: { id: "c" } }], index: 0 };
  const prev = { cards: [{ job: { id: "a" }, decision: "passed" }, { job: { id: "b" } }], index: 1 };
  const kept = carryDeck(next, prev);
  assert.equal(kept.cards[0].decision, "passed");
  assert.equal(kept.index, 1, "stays on the card you were on");
  assert.equal(deckPagePosition({ index: 24, page: 1, pageSize: 50, total: 11247 }), "25 OF 11,247 · PAGE 1");
  assert.equal(deckPagePosition({ index: 0, page: 2, pageSize: 50, total: 11247 }), "51 OF 11,247 · PAGE 2");
  const dv = read("client/src/panels/DeckView.jsx");
  assert.match(dv, /useEffect\(\(\) => \{ if \(!plateDeck\) fetchDeck\(\); \}, \[fetchDeck, plateDeck\]\);/, "no daily deal on the plate market");
  assert.match(dv, /initialDeck\(\{ date: localDate\(\), cards: boardPageCards\(pager\.jobs\)/);
  assert.match(dv, /data-deck-next-page=""/);
});

test("D199 C8 · d199IndexBubblePushesLeft — the actions cell grows in the row's flow; the title gives way; no ✱; ★ before a saved title", async () => {
  const c = css();
  assert.match(c, /\.pl-ixc--title \{ flex: 1 1 auto; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; \}/);
  // at rest Star / Draft are out of the layout and undrawn (opacity 0, still focusable); on hover / focus they join the flow
  assert.match(c, /\.pl-ixrow:not\(:hover\):not\(:focus-within\) \.pl-ixrow__star, \.pl-ixrow:not\(:hover\):not\(:focus-within\) \.pl-ixrow__draft(?:, \.pl-ixrow:not\(:hover\):not\(:focus-within\) \.pl-ixrow__send)? \{[^}]*position: absolute; right: 0; top: 0; opacity: 0; pointer-events: none; \}/);
  assert.match(c, /\.pl-ixrow:hover \.pl-ixrow__star, \.pl-ixrow:hover \.pl-ixrow__draft, [^{]*\{ animation: pl-ix-in \.25s/);
  const act = c.match(/\.pl-ixrow__act \{([^}]*)\}/)[1];
  assert.ok(!/position:\s*absolute|overflow:\s*hidden/.test(act), "never an overlay, never a clipping box");
  const { r, C, indexRow } = await load();
  const rows = [indexRow({ jobId: "1", title: "Frontend Engineer", company: "Kestrel", url: "#" }, 0, { saved: true }),
    indexRow({ jobId: "2", title: "UI Engineer", company: "Halcyon", url: "#", isH1bSponsor: true }, 1, { offset: 50 })];
  const html = r(C.MarketIndexTable, { rows }) + r(C.RowBubble, { job: rows[0].job, saved: true });
  assert.ok(!html.includes("✱"), "the asterisk is gone");
  assert.match(html, /<span class="pl-ixrow__saved" aria-label="Starred">★<\/span><a class="pl-gz__title"/);
  assert.match(html, />52</, "the # runs across pages (row 2 of page 2)");
  assert.match(html, /data-bubble-action="star"/);
});

test("D200 · d200EveryMarkAnswers — the stamp, the logo, the chips, the Index's H-1B and company, the stats cells all answer", async () => {
  const { r, C, indexRow, Controls } = await load();
  const card = { score: 91, why: { matched: ["React"] }, job: { id: "k", company: "Kestrel Payments", title: "Frontend Engineer", worksWith: ["React", "Go"], sponsorship: { level: "often" } } };
  const face = r(C.MarketCardFace, { card, isFront: true, size: { width: 542 } });
  assert.match(face, /data-mark-popover="h1b"[^]*?FILED H-1B/, "the stamp is a button that opens the filings");
  assert.match(face, /data-mark-popover="stack"[^]*?pl-letter/, "the letter tile opens the stack");
  assert.equal((face.match(/data-mark-popover="chip"/g) || []).length, 2, "every stack chip explains or filters");
  const ix = r(C.MarketIndexTable, { rows: [indexRow({ jobId: "1", title: "T", company: "Kestrel", url: "#", isH1bSponsor: true }, 0)] });
  assert.match(ix, /data-mark-popover="h1b"/);
  assert.match(ix, /data-mark-popover="stack"/);
  const box = r(Controls.MarketStatsBox, { figures: { fit: 1, newToday: 1, filed: 1, strong: 1 } });
  assert.equal((box.match(/<button[^>]*data-stat=/g) || []).length, 4, "every stats cell is a control");
});

test("D200 · d200H1bStampOpensFilings — the filings card says what the record holds, 'not a promise', and 'no filings found'", async () => {
  const { Pop } = await load();
  const b = companyBrief({ company: { name: "Kestrel", slug: "kestrel" }, sponsorship: { filings: 214, fiscalYear: 2025, uscis: { approvals: 120, fiscalYear: 2025 }, source: { through: "FY2026 Q1" } } });
  assert.match(Pop.filingsLines(b).head, /^214 certified LCAs in FY2025 · 120 H-1B approvals FY2025 \(USCIS\)$/);
  assert.match(Pop.filingsLines(companyBrief({ company: { name: "Northwind", slug: "n" }, sponsorship: null })).head, /^No H-1B filings found for Northwind/);
  const src = read("client/src/plate/MarkPopover.jsx");
  assert.ok(src.includes("Past filings, not a promise.") && src.includes("See the survey sheet →"));
  assert.match(read("client/src/lib/companyBrief.js"), /api\(`\/api\/public\/companies\/\$\{encodeURIComponent\(slug\)\}`\)/, "the survey sheet's own answer");
});

test("D200 · d200LogoOpensTechnographics — the stack from the company's own postings (stackFor), with your marks", () => {
  const page = { company: { name: "Kestrel", slug: "kestrel" }, openJobs: 38, hiringTrend: [{ month: "2026-06", postings: 7 }, { month: "2026-11", postings: 19 }],
    stack: { ofPostings: 38, groups: { lang: [{ tech: "Go", postings: 21 }], data: [{ tech: "PostgreSQL", postings: 18 }, { tech: "Kafka", postings: 12 }] } } };
  const b = companyBrief(page, { proven: ["Go"], listed: [], missing: [{ tech: "Kafka" }, { tech: "PostgreSQL" }] });
  assert.deepEqual(b.tech.map((t) => [t.name, t.postings, t.yours]), [["Go", 21, "proven"], ["PostgreSQL", 18, "missing"], ["Kafka", 12, "missing"]]);
  assert.deepEqual(hiringTrend(page.hiringTrend), { pct: 171, dir: "up", since: "June" });
  assert.equal(companyBrief(page, null).tech[0].yours, null, "signed out → no marks, never a guess");
  for (const f of ["client/src/lib/companyBrief.js", "client/src/plate/MarkPopover.jsx"]) assert.ok(!/company_technographics/.test(strip(read(f))), `${f}: not the old table`);
});

test("D200 Rule 3 · d200HeaderOneLine — a mono kicker, 'Openings for you', one line of counts; no 96–104 px title, no lead", async () => {
  const { r, C, heroLine } = await load();
  const html = r(C.MarketHero, { figures: { fit: 11247, newToday: 5 }, week: 48, sectors: [] });
  assert.match(html, /<h1 id="mk-title" class="pl-mk-hero__title">Openings for you<\/h1>/);
  assert.match(html, /11,247 fit your bearing · 5 new today/);
  assert.match(html, />THE MARKET</);
  assert.ok(!/pl-title|pl-lead/.test(html), "no page-title size, no restating lead");
  assert.equal(heroLine({}), null);
  assert.equal(heroLine({ fit: 3 }), "3 fit your bearing");
  assert.match(css(), /\.pl-mk-hero__title \{[^}]*font-size: var\(--pl-t-header\)/);
  assert.match(read("client/src/styles/plate.css"), /--pl-t-header: calc\(42px \* var\(--pl-scale\)\)/);
});

test("D199 C7 (47h) · the deck's card, an Index row and the field card's link open the opening sheet; a direct link can still decide", () => {
  const dv = read("client/src/panels/DeckView.jsx");
  assert.match(dv, /if \(plateDeck\) navigate\(openingSheetHref\(cur\.job\.id\)\);\n\s*else openPostingOnDeck\(cur\.job\.id\);/);
  const jp = read("client/src/panels/JobsPanel.jsx");
  assert.match(jp, /onOpen=\{\(job\) => navigateSheet\(job\)\}/);
  assert.match(jp, /navigateTo\(openingSheetHref\(id\)\)/);
  assert.match(read("client/src/plate/MarketIndex.jsx"), /href=\{openingSheetHref\(r\.id\)\}/);
  const mo = read("client/src/plate/MarketOpenings.jsx");
  assert.match(mo, /href=\{openingSheetHref\(jobId\)\} data-opening-sheet=""/);
  assert.match(mo, /import \{ openingSheetHref \} from "\.\/OpeningSheet\.jsx"/);
  // a direct visit to /app/jobs/<id>: the route is the console tab, so Home (the market and its board) mounts underneath and
  // registers boardDecide — the sheet's Pass / Save / Draft go through it (OpeningSheet's decide reads it at the press)
  const a = app();
  assert.match(a, /: openingRoute \|\| routeKey === CONSOLE_ROUTE \|\| LEGACY_CONSOLE_ROUTES\.has\(routeKey\)\n\s*\? "console"/);
  assert.match(a, /const home = activeTab === "today" \|\| activeTab === "console";/);
  assert.match(jp, /boardDecide: async \(job, decision\) => \{\n\s*const r = await decideJobRef\.current\?\.\(job, decision\);/);
  assert.match(jp, /const jobId = job\?\.jobId \|\| job\?\.id;/, "the sheet's job (by id, `id`) is decided like a board row");
});
