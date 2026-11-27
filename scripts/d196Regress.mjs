// ⭐ D196 F5 · VISUAL REGRESSION AGAINST THE SKETCH — the gate every phase passes before it is called done.
//
// The oracle is the canvas export itself: each artboard page (tmp/d196-canvas/<id>.html, unpacked from the committed
// docs/sketches/Atlas plate system.html by scripts/d196UnpackCanvas.mjs) rendered in headless Chrome. The build side is the
// same composition from the plate library with the sketch's example data (client/src/plate/fixtures.jsx), bundled with
// esbuild into a standalone page. Both are cropped to the same element (found by selector on each side, so the crop
// follows the layout instead of guessing pixels), and compared pixel by pixel in the browser:
//   a pixel differs when any channel differs by more than TOLERANCE (anti-aliasing and font hinting stay under it);
//   masked rectangles (dynamic text) are skipped; the difference is differing / compared pixels.
// The gate: ≤ 2 % per pair (D196 F5). A failing pair is fixed in the component, never by raising the threshold.
// Output (tmp/d196-regress/<pair>/): board.png, build.png, diff.png (differences in clay), pair.png (sketch | build) and
// report.json — the side-by-side goes in NOW for the owner.
//
// Usage: node scripts/d196Regress.mjs [--pair <name>] [--width 1280|390] [--threshold 2]
// ⚠ Drives a real Chrome (services/browserLauncher.js): run it with memory to spare, one pair at a time on the 8 GB machine.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { unpackCanvas, DEFAULT_OUT as CANVAS } from "./d196UnpackCanvas.mjs";
import { SOURCES } from "./d196PortDrawings.mjs";
import { finalBoards, serveFinal } from "./d196FinalCanvas.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "tmp", "d196-regress");
export const THRESHOLD_PCT = 2;
export const TOLERANCE = 40;   // per channel, 0–255
export const LAUNCH_ARGS = Object.freeze(["--disable-lcd-text"]);

/** ⭐ 47h (lane atlas): reload a board page with its JS timers off (a still frame of a page that ticks on setInterval). */
async function atFreezeTimers(page) {
  await page.evaluateOnNewDocument(() => { window.setInterval = () => 0; });
  await page.reload({ waitUntil: "load", timeout: 60000 });
}

// ✅ OWNER 11-26 (decision 3): every ys pair at 390 and ys-want at 1280 are owner-accepted LOOKs (a phone sketch, if drawn, replaces them)
const YS_LOOK_390 = "owner-accepted LOOK (11-26): the YourSurvey board keeps its desktop rail at 390 — not a phone design; the build's 390 layout (16 px gutter, words whole) stands";
function ysPair(k) { return { lookAt: { 390: YS_LOOK_390,
  ...(k === "want" ? { 1280: "owner-accepted LOOK (11-26): the wants rows are worded from the person's own data (3.85 % at 47i) — the data-worded piece stands" } : {}) } }; }
// ✅ OWNER 11-26 (decision 3): the survey sheet's hero / hiring / sponsor / match / tickets and the ledger's tickets at 390
const SHEET_LOOK_390 = "owner-accepted LOOK (11-26): the board keeps its desktop rail at 390 — not a phone design; the build's 390 layout (16 px gutter, words whole, live-data wording) stands";
/** The pairs: a board, the element to crop on each side, and the fixture that builds it. */
export const PAIRS = {
  // ⭐ D197 Wave 1 #1 (47i) · THE SHELL against the approved canvas's `Shell` board (source "final"). The build side is the
  // live dock's own component (plate/Shell.jsx's Dock / AreaNav — components/AppNav.jsx renders them) with the board's data.
  // The rail: figure A's (the market's — the /d tile current), its 4 px shadow inside the pad.
  "shell-rail": { source: "final", board: "Shell", fixture: "ShellRailMarket", boardSel: 'nav[aria-label="Main"]', buildSel: 'nav[aria-label="Main"]', pad: 6, subpixel: true },
  // the active item: figure B's (the ledger's) Home tile — white, 1.5 px ink, 3 px ink shadow, the name in 800
  "shell-active": { source: "final", board: "Shell", fixture: "ShellRailLedger", boardSel: 'nav[aria-label="Main"]:has(+ div nav[aria-label="Ledger"]) [aria-current="page"]',
    buildSel: 'nav[aria-label="Main"] [aria-current="page"]', pad: 4, subpixel: true },
  // the area nav: figure A's market header (the views, More, search with Ctrl K, the drafts chip, the 12 px ruler) across
  // the 1131 px content column beside the rail
  "shell-areanav": { source: "final", board: "Shell", fixture: "ShellRailMarket", boardSel: 'header:has(nav[aria-label="The market"])', buildSel: "header.pl-areanav", pad: 0, subpixel: true },
  // the phone's bottom bar: figure D's (the 390 px phone frame's last child)
  // the phone's top bar: figure D's first row (the /d tile, the search button)
  "shell-phonetop": { source: "final", board: "Shell", fixture: "ShellPhoneTop", boardSel: 'div[style*="height: 760px"] > div:first-child', buildSel: ".pl-topbar", pad: 0, subpixel: true },
  "shell-phonebar": { source: "final", board: "Shell", fixture: "ShellPhoneBar", boardSel: 'nav[aria-label="Main"]:last-child', buildSel: "nav.pl-dock--bar", pad: 0, subpixel: true },
  // ⭐ D197 Wave 1 #5–#7 (47h, lane atlas) · ATLAS'S THREE BOARDS (final canvas `Home`, `Map`, `Library`). The build side is
  // plate/AtlasHome.jsx · AtlasRegion.jsx · AtlasLibrary.jsx with the boards' data (fixtures.jsx). The board's own header is
  // the Atlas area nav now (the shell's, paired below against the Shell board's figure C), so each pair crops a section.
  // The hero's label tape: the board turns its word on a JS timer (reduced motion doesn't stop it), so the board page is
  // reloaded with its timers off — both sides show the first word ("computers.").
  "atlas-home-hero": { source: "final", board: "Home", fixture: "AtlasHomeBoard", boardSel: "section#top", buildSel: "section#top", pad: 0, reduced: true, subpixel: true,
    boardPrep: atFreezeTimers },
  "atlas-home-regions": { source: "final", board: "Home", fixture: "AtlasHomeBoard", boardSel: "section:nth-of-type(2)", buildSel: "section.pl-at-regions", pad: 0, reduced: true, subpixel: true, boardPrep: atFreezeTimers },
  "atlas-home-footer": { source: "final", board: "Home", fixture: "AtlasHomeBoard", boardSel: "footer", buildSel: "footer.pl-at-foot", pad: 0, reduced: true, subpixel: true, boardPrep: atFreezeTimers },
  "atlas-home-volumes": { source: "final", board: "Home", fixture: "AtlasVolumesBoard", boardSel: "header .at-drop", buildSel: ".pl-at-vols", pad: 10, reduced: true, subpixel: true,
    boardPrep: async (page) => { await atFreezeTimers(page); await page.evaluate(() => document.querySelector("header button[aria-expanded]")?.click()); await new Promise((r) => setTimeout(r, 400)); } },
  // Atlas's area nav: the Shell board's figure C (the VOL. I pill, the views with Your map current, More, search, the run chip)
  "atlas-areanav": { source: "final", board: "Shell", fixture: "ShellRailAtlas", boardSel: 'header:has(nav[aria-label="Vol. I"])', buildSel: "header.pl-areanav", pad: 0, subpixel: true },
  "atlas-map-header": { source: "final", board: "Map", fixture: "AtlasMapBoard", boardSel: "main#region > section", buildSel: "main#region > section", pad: 8, reduced: true, subpixel: true },
  "atlas-map-terrain": { source: "final", board: "Map", fixture: "AtlasMapBoard", boardSel: "main#region > div", buildSel: ".pl-at-views", pad: 8, reduced: true, subpixel: true },
  "atlas-map-route": { source: "final", board: "Map", fixture: "AtlasMapBoard", boardSel: "main#region > div", buildSel: ".pl-at-views", pad: 8, reduced: true, subpixel: true, boardTab: "Route",
    buildPrep: async (page) => { await page.evaluate(() => document.getElementById("pl-at-tab-route")?.click()); await new Promise((r) => setTimeout(r, 300)); } },
  "atlas-map-index": { source: "final", board: "Map", fixture: "AtlasMapBoard", boardSel: "main#region > div", buildSel: ".pl-at-views", pad: 8, reduced: true, subpixel: true, boardTab: "Index",
    buildPrep: async (page) => { await page.evaluate(() => document.getElementById("pl-at-tab-index")?.click()); await new Promise((r) => setTimeout(r, 300)); } },
  "atlas-library-notes": { source: "final", board: "Library", fixture: "AtlasLibraryBoard", boardSel: "#lib", buildSel: "#lib", pad: 0, reduced: true, subpixel: true },
  "atlas-library-sources": { source: "final", board: "Library", fixture: "AtlasLibraryBoard", boardSel: "#lib", buildSel: "#lib", pad: 0, reduced: true, subpixel: true,
    boardPrep: async (page) => { await page.evaluate(() => [...document.querySelectorAll("aside nav button")].find((b) => b.textContent.includes("Primary sources"))?.click()); await new Promise((r) => setTimeout(r, 500)); },
    buildPrep: async (page) => { await page.evaluate(() => document.querySelector('[data-collection="sources"]')?.click()); await new Promise((r) => setTimeout(r, 300)); } },
  "shell-market-dock": { board: "The market · draft", fixture: "ShellMarket", boardSel: 'nav[aria-label="Main"]', buildSel: 'nav[aria-label="Main"]', pad: 6 },
  "shell-market-nav": { board: "The market · draft", fixture: "ShellMarket", boardSel: "header", buildSel: "header.pl-areanav", pad: 0 },
  // P1 · the card face: the owner kept the deck's form factor (11-24), so the face can never be the board's size — this pair
  // is a LOOK for the owner (pair.png), not a pixel gate; its report says so instead of passing or failing.
  // FIX-2 (47f, the owner: "retain the frame and flip but also make it pixel diffable"): the ticket at the board's size, drawn
  // by DeckView's own FanCard (PlateDeckStill) — now a GATE. The pad takes in the 6 px shadow; the backs' slivers above and
  // to the right are the deck's own CardBack (the owner's keep), compared as they are.
  "market-face": { board: "The market · draft", fixture: "MarketFace", boardSel: "article[aria-label]", buildSel: '[data-fan-offset="0"] article', pad: 6, reduced: true, subpixel: true,
    // the two strings the build can't back (D196 R2: never invented): the board's "· CHECKED TODAY" (a dealt card has no
    // check date) and the stamp's "· FY25" (no filing year on the card) — masked; everything else is compared
    // + the back sheets' slivers in the 6 px pad above and right of the ticket (the deck's own CardBack — the keep)
    masks: [[600, 12, 200, 16], [588, 226, 206, 56], [0, 0, 820, 7], [813, 0, 7, 376]],
    // at 390 (the board's artboard, its desktop dock kept: a 226 px ticket): CHECKED TODAY on the strip's second line, and
    // the stamp — the board's covers the last chip, the build's hangs on the tear line (the noted deviation)
    masksAt: { 390: [[60, 34, 150, 16], [0, 566, 238, 76], [0, 0, 238, 7], [231, 0, 7, 829]] } },
  // P1 · the bearing: the board's sentence carries clauses the live model words differently (the résumé's own role, level,
  // sponsorship), so this too is a look at the cartouche's frame and type, not a pixel gate.
  "market-bearing": { board: "The market · draft", fixture: "MarketBearing", boardSel: "section:nth-of-type(2)", buildSel: "[data-market-bearing-fixture]", pad: 0, look: true },
  // ⛔ 47h (D199 / D200): the v3 board's market-hero / market-openings / market-index GATES are retired — the approved `Market`
  // board supersedes that export and the page was rebuilt to it; their gates are the final-market-* pairs below.
  "market-field": { board: "The market · draft", fixture: "MarketOpeningsBoard", boardSel: 'aside[aria-label="Why this opening fits you"]', buildSel: 'aside[aria-label="Why this opening fits you"]', pad: 6, reduced: true, look: true },
  // v2 (47e, order item 4): each ported drawing against its own element on the v2 boards, drawn at the board's width
  // (`matchWidth`: the build page reads the board element's width from its address) — the port's fidelity, pixel for pixel.
  "v2-elevation": { source: "v2", board: "Atlas place: Webhooks, Region IV grid D3", fixture: "PortedDrawing", drawing: "PlaceElevationProfile", boardSel: 'svg[aria-label^="Elevation profile"]', buildSel: "svg[role=img]", pad: 0, matchWidth: true, reduced: true, ground: "#FFFFFF", cornerMasks: 24 },
  "v2-signpost": { source: "v2", board: "Atlas place: Webhooks, Region IV grid D3", fixture: "PortedDrawing", drawing: "PlaceSignpost", boardSel: 'svg[aria-label^="A trailhead signpost"]', buildSel: "svg[role=img]", pad: 0, matchWidth: true, reduced: true, ground: "#FFFFFF", cornerMasks: 24 },
  "v2-volume": { source: "v2", board: "Atlas home: Volume I, Computing", fixture: "PortedDrawing", drawing: "AtlasVolumePlate", boardSel: 'svg[aria-label^="Plate of Volume I"]', buildSel: "svg[role=img]", pad: 0, matchWidth: true, reduced: true, ground: "#FFFFFF", cornerMasks: 24,
    hideOnBoard: '.at-bob1, .at-bob2, .at-bob3, svg[aria-label^="Plate of Volume I"] ~ *' },
  "v2-tile": { source: "v2", board: "Atlas place: Webhooks, Region IV grid D3", fixture: "PortedDrawing", drawing: "PlaceIsometricTile", boardSel: 'svg[aria-label^="An isometric map tile"]', buildSel: "svg[role=img]", pad: 0, matchWidth: true, reduced: true, ground: "#FFFFFF", cornerMasks: 24 },
  "v2-seal": { source: "v2", board: "Atlas place: Webhooks, Region IV grid D3", fixture: "PortedDrawing", drawing: "PlaceHazardSeal", boardSel: 'svg[aria-label^="A door with a wax seal"]', buildSel: "svg[role=img]", pad: 0, matchWidth: true, reduced: true, ground: "#FFFFFF", cornerMasks: 24 },
  "v2-timeout": { source: "v2", board: "Atlas place: Webhooks, Region IV grid D3", fixture: "PortedDrawing", drawing: "PlaceHazardTimeout", boardSel: 'svg[aria-label^="A stopwatch beside"]', buildSel: "svg[role=img]", pad: 0, matchWidth: true, reduced: true, ground: "#FFFFFF", cornerMasks: 24 },
  "v2-duplicate": { source: "v2", board: "Atlas place: Webhooks, Region IV grid D3", fixture: "PortedDrawing", drawing: "PlaceHazardDuplicate", boardSel: 'svg[aria-label^="Two identical letters"]', buildSel: "svg[role=img]", pad: 0, matchWidth: true, reduced: true, ground: "#FFFFFF", cornerMasks: 24 },
  "market-tickets": { board: "The market · draft", fixture: "MarketTicketsBoard", boardSel: "section:nth-of-type(4)", buildSel: "section[aria-labelledby=mk-onward]", pad: 0, look: true },
  // ⭐ D199 / D200 (47h) · THE MARKET, REBUILT — against the APPROVED `Market` board (docs/sketches/final/project, A244), each
  // piece its own gate (D196: no "look" exemptions). The build side is the app's own components with the board's example
  // data (fixtures MarketHeroFinal / MarketSectionFinal). Masks are the board's example data the build can't back, each named.
  "final-market-hero": { source: "final", board: "Market", fixture: "MarketHeroFinal", boardSel: 'section[aria-labelledby="mk-title"]', buildSel: 'section[aria-labelledby="mk-title"]', pad: 0, reduced: true, subpixel: true, waitBuild: 1500,
    // the you-are-here ping is an SVG <animate> (not stopped by reduced motion) on both sides — its 24 px ring is masked; the
    // caption's "(BUILD)" is the board's note to the builder, not page text
    masks: [] },
  "final-market-head": { source: "final", board: "Market", fixture: "MarketSectionFinal", boardSel: "#bearing", buildSel: ".pl-leg", pad: 0, subpixel: true, reduced: true },
  "final-market-cartouche": { source: "final", board: "Market", fixture: "MarketSectionFinal", boardSel: "section:nth-of-type(2) > div:nth-of-type(2)", buildSel: ".pl-cartouche", pad: 6, subpixel: true, reduced: true },
  "final-market-tabs": { source: "final", board: "Market", fixture: "MarketSectionFinal", boardSel: '[role="tablist"][aria-label="View openings"]', buildSel: '[role="tablist"][aria-label="View openings"]', pad: 4, subpixel: true, reduced: true },
  "final-market-field": { source: "final", board: "Market", fixture: "MarketSectionFinal", boardSel: 'aside[aria-label="Why this opening fits you"]', buildSel: 'aside[aria-label="Why this opening fits you"]', pad: 6, subpixel: true, reduced: true, waitBuild: 1500 },
  "final-market-deck": { source: "final", board: "Market", fixture: "MarketSectionFinal", boardSel: "section:nth-of-type(2) .at-in > div:first-child", buildSel: ".pl-market-deck > :first-child", pad: 0, subpixel: true, reduced: true, waitBuild: 1500,
    // masked, as market-openings was: the two back sheets' slivers (the board draws plain sheets; the deck keeps its own
    // CardBack, the owner's keep), the stamp's "· FY25" (no filing year on a card), and the position line — the owner's
    // 11-25 answer words it for the board's whole list ("1 OF 11,247 · PAGE 1"), after the board was drawn; and ‹ on the first
    // card (disabled — honest; the board's wraps round)
    masks: [[0, 0, 560, 22], [538, 0, 22, 425], [316, 286, 206, 62], [56, 438, 290, 22], [460, 426, 56, 48]],
    // the same five at 390 (the ticket 226 wide, the position line on two lines, the stamp: the board's over the last chip, the
    // build's on the tear line — the deck's own placement, kept from market-face's 390 masks)
    masksAt: { 390: [[0, 0, 244, 14], [226, 0, 18, 845], [0, 578, 244, 92], [0, 842, 244, 32], [0, 876, 50, 49]] } },
  "final-market-pager": { source: "final", board: "Market", fixture: "MarketSectionFinal", boardSel: 'nav[aria-label="Pages"]', buildSel: 'nav[aria-label="Pages"]', pad: 4, subpixel: true, reduced: true,
    // the page line and the last tile: the board's 24 per page (469 pages) vs the owner's "use 50" (225) — the only change;
    // at 1280 they differ by under 2 % unmasked, at 390 (two lines of the line, the tiles wrapped) they're masked
    // + at 390 the first tile: the board's script styles ‹ Prev on page 1 as the CURRENT tile (its target page is page 1);
    // the build's Prev is disabled there and drawn as a plain tile (at 1280 the same difference stays under 2 % unmasked)
    masks: [], masksAt: { 390: [[0, 0, 252, 34], [48, 86, 56, 50], [0, 36, 80, 52]] } },
  // masked: each row's 44 px actions cell at rest — the board's shows a clipped sliver of its Draft button (its flex-end cell
  // overflows LEFT, under the STATUS tag: A201's probe read "Draft" over "NEW" at 768); the build draws the ⋯ the board's markup
  // has there and keeps Star / Draft out of the layout until hover / focus
  "final-market-index": { source: "final", board: "Market", fixture: "MarketSectionFinal", boardTab: "Index", buildHash: "tab=index", boardSel: "section:nth-of-type(2) .at-in", buildSel: ".pl-tabpanel:not([hidden])", pad: 0, subpixel: true, reduced: true,
    masks: [[1074, 74, 60, 368]], masksAt: { 390: [[196, 86, 48, 368]] } },
  // ⭐ D198 E1 (47h) · THE EXPLAINER, BEAT BY BEAT — v4's *Explainer · Big O, acted out* (the board scales its 405 × 720 inner
  // frame by 1.12 into its column; the run takes the scale off, so both sides are the frame at its own size). Each side's
  // beat is pressed in its own list; on your turn the build's right answer is pressed (the board draws it answered).
  ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`xp-beat-${i + 1}`, { source: "v4", board: "Explainer · Big O, acted out", fixture: "ExplainerBoard",
    boardSel: '[aria-label^="The Big O explainer"] > div > div', buildSel: ".pl-xp__frame", pad: 0, reduced: true, subpixel: true, waitBuild: 1200,
    boardPrep: async (page) => { await page.addStyleTag({ content: '[aria-label^="The Big O explainer"] > div { transform: none !important; }' });
      await page.evaluate((k) => document.querySelectorAll("ol li button")[k]?.click(), i); await new Promise((r) => setTimeout(r, 600)); },
    buildPrep: async (page) => { await page.evaluate((k) => document.querySelectorAll(".pl-xp__beat")[k]?.click(), i); await new Promise((r) => setTimeout(r, 300));
      if (i === 8) await page.evaluate(() => [...document.querySelectorAll(".pl-xp__opt")].find((b) => b.textContent.includes("Hash map"))?.click()); },
    // where it runs: the board shows the template's "[N]" — the build fills the market's count (never "[N]"): the figure is masked
    ...(i === 7 ? { masks: [[38, 482, 140, 18]] } : {}) }])),
  // ⭐ D202 (47h, the card lane) · THE FIELD CARD ⇄ THE ATS CARD — the final canvas's ATSCard board, each face and each tab.
  // The board's own controls are pressed (Turn over, then the tab); the build opens on the same face and tab.
  ...Object.fromEntries([["front", null], ["words", "Every word"], ["context", "Context"], ["claim", "You could claim"], ["hist", "History"]].map(([k, tab]) => [`fit-${k}`, {
    source: "final", board: "ATSCard", fixture: { front: "FitCardFront", words: "FitCardWords", context: "FitCardContext", claim: "FitCardClaim", hist: "FitCardHistory" }[k],
    boardSel: tab ? 'article[aria-label="The ATS card: your résumé against this job"]' : 'article[aria-label="Field card: why this opening fits you"]',
    buildSel: tab ? 'article[aria-label="The ATS card: your résumé against this job"]' : 'aside[aria-label="Why this opening fits you"]',
    pad: 6, reduced: true, subpixel: true,
    // context: the board's example prose the build words from each dissimilarity's kind ("No experiments (A/B) in your
    // bullets", "Team leadership not shown — and not asked at mid" — no kind the scorer emits reads like that), and its stack
    // line's count ("FROM 38 KESTREL POSTINGS" over rows that say "of 9") and "Checkout postings" (no team on a stack row)
    ...(k === "context" ? { masks: [[310, 507, 295, 68], [190, 592, 220, 14], [232, 613, 140, 17]] } : {}),
    ...(tab ? { boardPrep: async (page) => {
      await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Turn over"))?.click());
      await new Promise((r) => setTimeout(r, 300));
      await page.evaluate((t) => [...document.querySelectorAll('button[role="tab"]')].find((b) => b.textContent.includes(t))?.click(), tab);
      await new Promise((r) => setTimeout(r, 300)); } } : {}),
  }])),
  // ⭐ D199 C7 (47h, the card lane) · THE OPENING SHEET — the final canvas's Opening board, section by section (the board's
  // sections are siblings in its column: the header, then 01–05), and the sticky action bar.
  ...Object.fromEntries([["head", 1, "section.pl-op__top"], ["role", 2, 'section[aria-labelledby="op-role"]'], ["fit", 3, 'section[aria-labelledby="op-fit"]'],
    ["stack", 4, 'section[aria-labelledby="op-stack"]'], ["posting", 5, 'section[aria-labelledby="op-posting"]'], ["company", 6, 'section[aria-labelledby="op-company"]'],
    ["bar", 0, "[data-opening-actions]"]].map(([k, n, sel]) => [`op-${k}`, {
    source: "final", board: "Opening", fixture: "OpeningSheetBoard", boardSel: n ? `section:nth-of-type(${n})` : 'div[style*="sticky"]', buildSel: sel,
    pad: 0, reduced: true, subpixel: true,
    // the sections above differ in height (01's lines are the posting's own), so each piece is put at the board piece's own
    // sub-pixel offset after layout — measured, never computed (as ExplainerBoard does)
    buildPrep: async (page) => { await page.evaluate((s) => {
      const want = Number(new URLSearchParams(location.hash.slice(1)).get("oy")) || 0;
      const el = document.querySelector(s); const wrap = document.querySelector("[data-opening-fixture]");
      if (!el || !wrap) return;
      const got = (el.getBoundingClientRect().top + scrollY) % 1;
      wrap.style.paddingTop = `${parseFloat(getComputedStyle(wrap).paddingTop) + (((want - got) % 1) + 1) % 1}px`;
    }, sel); await new Promise((r) => setTimeout(r, 100)); },
    ...(opPair(k) || {}) }])),
  // ⭐ D197 Wave 1 #4 (47h) · THE SURVEY SHEET, section by section against the final `Survey` board — the page's own
  // component (plate/SurveySheet.jsx) on the board's data, shaped as the API answers (plate/sheetFixtures.jsx).
  ...Object.fromEntries(["hero", "stack", "hiring", "sponsor", "match", "tickets"].map((k, i) => [`survey-${k}`, { source: "final", board: "Survey",
    fixture: "SurveyBoard", subpixel: true, boardSel: `section:nth-of-type(${i + 1})`, buildSel: `.pl-sheetpage > section:nth-of-type(${i + 1})`, pad: 0, reduced: true,
    // 02: the newest open roles under the two figures are the page's own (today's list, kept — D200 Rule 1); the board ends at the figures
    ...(k === "hiring" ? { cropTo: { 1280: 503, 390: 826 } } : {}),   // 47i: and at 390 (the board ends at the figures there too)
    ...(k !== "stack" ? { lookAt: { 390: SHEET_LOOK_390 } } : {}),   // owner 11-26, decision 3
    // the title block: the board's dock (x 14–98) throws its 4 px shadow into the section's first pixels — the page's frame
    ...(k === "hero" ? { masks: [[0, 0, 6, 420]] } : {}),
    // 03: the board's cells (H-1B APPLICATIONS · FOR SOFTWARE ROLES · CERTIFIED · PERM) and MOST FILED TITLES are figures our
    // records don't hold; the sheet draws what sponsorshipFactFor has (certified LCAs · median wage · USCIS approvals ·
    // approved %) and the source in their place (docs/revamp/survey.md, disagreement 2) — the words masked, the card compared
    ...(k === "sponsor" ? { masks: [[44, 150, 1076, 92]] } : {}) }])),
  // ⭐ D197 Wave 1 #3 (47h) · THE LEDGER (Home) against the final `Ledger` board, piece by piece (plate/Ledger.jsx on the board's
  // data, plate/sheetFixtures.jsx). The header is a LOOK pair: D200 Rule 3 replaces the board's 100 px "The ledger." + lead
  // with one plain serif line on a working page (docs/revamp/ledger.md, disagreement 1).
  "ledger-hero": { source: "final", board: "Ledger", fixture: "LedgerBoard", subpixel: true, boardSel: 'section[aria-labelledby="lg-title"]', buildSel: 'section[aria-labelledby="lg-title"]', pad: 0, reduced: true, look: true },
  "ledger-run": { source: "final", board: "Ledger", fixture: "LedgerBoard", subpixel: true, boardSel: 'section[aria-labelledby="lg-title"] figure', buildSel: ".pl-lg-run", pad: 0, reduced: true ,
    // 47i, 390: Run now's kicker and the worker's line are the run's live words (runNow / worker from the auto-apply status —
    // "2 OF 10 SENT TODAY · NEXT 6:30 PM", "Running · 2 of 10 today"), the board's sample phrasing beside them; at 292 px they
    // wrap to two lines, so they're masked there; the ticket, its notches, the dial and the stops are compared
    masksAt: { 390: [[0, 108, 244, 44], [30, 262, 214, 26]] } },
  "ledger-needs": { source: "final", board: "Ledger", fixture: "LedgerBoard", subpixel: true, boardSel: "section:nth-of-type(2)", buildSel: "[data-home-needs]", pad: 0, reduced: true },
  "ledger-banner": { source: "final", board: "Ledger", fixture: "LedgerBoard", subpixel: true, boardSel: "section:nth-of-type(3) > div:nth-of-type(2)", buildSel: "[data-held-before-update]", pad: 0, reduced: true },
  "ledger-register": { source: "final", board: "Ledger", fixture: "LedgerBoard", subpixel: true, boardSel: "section:nth-of-type(3) > div:nth-of-type(3)", buildSel: "[data-ledger-register] .pl-register", pad: 0, reduced: true },
  "ledger-tickets": { source: "final", board: "Ledger", fixture: "LedgerBoard", subpixel: true, boardSel: "section:nth-of-type(4)", buildSel: "[data-ledger-tickets]", pad: 0, reduced: true, lookAt: { 390: SHEET_LOOK_390 } },
  // ⭐ D200 (a) (47h, the yoursurvey lane) · YOUR SURVEY — the final canvas's YourSurvey board, section by section (the
  // board's sections are siblings in its column: the head, then 01–05); the build is SkillMapView from the board's data
  // (pages/atlas/yourSurveyFixtures.jsx), each section put at the board piece's own sub-pixel offset.
  ...Object.fromEntries([["head", 1, "number"], ["close", 2, "close"], ["want", 3, "wants"], ["learn", 4, "learn"], ["move", 5, "move"], ["route", 6, "route"]]
    .map(([k, n, s]) => [`ys-${k}`, { source: "final", board: "YourSurvey", fixture: "YourSurveyBoard", boardSel: `section:nth-of-type(${n})`,
      buildSel: `[data-skm-section="${s}"]`, pad: 0, reduced: true, subpixel: true, ...(ysPair(k) || {}) }])),
  // ⭐ D197 Wave 2 #18 · M5 (47m, lane outside) · THE EMAIL HEADER PLATES — DrawingsPublic's Drawing 23 (approved 11-27), each
  // plate against its own svg on the board, drawn at the board's width (`matchWidth`) from the SAME drawing the PNGs are
  // rasterised from (shared/emailPlates.js plateSvgs), with the board's example words (DRAWING_23_WORDS) — like with like.
  // ⚠ Not run yet (47m: no browser runs); the shipped PNG's own faces (Georgia / Consolas at build time) are not this pair's.
  ...Object.fromEntries([["dispatch", "4 new openings that fit"], ["run-report", "Sent 6, held 2"], ["digest", "Your week on the map"]]
    .map(([k, t]) => [`email-plate-${k}`, { source: "final", board: "DrawingsPublic", fixture: "EmailPlateBoard", drawing: k,
      boardSel: `svg[aria-label="An email header plate for ${t}"]`, buildSel: "svg[role=img]", pad: 0, matchWidth: true, reduced: true }])),
  // ⭐ 47m (lane practice, D197 Wave 2 #11 / #12 / #13 M5) · the row-4 boards ProvingGround, AskRoute and DrawingsAtlas (1–4),
  // written, NOT RUN in the lane (the coordinator runs every pair after the merge). The six drawings are ported path for path
  // (scripts/d196PortDrawings.mjs, their words as props defaulting to the board's) — gated like the v2 drawings. The page
  // pieces draw the LIVE components on the board's data (plate/practiceFixtures.jsx); where the board's example words differ
  // from what the live page draws from its data, the pair is a LOOK (the reason beside it).
  ...Object.fromEntries([
    ["pg-hill", "ProvingGround", "ProvingGroundHill", 'svg[aria-label^="The proving ground"]'],
    ["pg-chair", "ProvingGround", "ProvingGroundChair", 'svg[aria-label^="The interviewer\'s chair"]'],
    ["lb-leg", "DrawingsAtlas", "LogbookDaysLeg", 'svg[aria-label^="Today\'s three quests"]'],
    ["lb-cairn", "DrawingsAtlas", "LogbookSummitCairn", 'svg[aria-label^="A cairn of stones"]'],
    ["lb-today", "DrawingsAtlas", "TodaySquareInset", 'svg[aria-label^="A small inset of Region III"]'],
    ["lb-tier", "DrawingsAtlas", "LogbookTierStamp", 'svg[aria-label^="A round double-ringed stamp"]'],
  ].map(([k, board, drawing, sel]) => [k, { source: "final", board, fixture: "PortedDrawing", drawing, boardSel: sel, buildSel: "svg[role=img]",
    pad: 0, matchWidth: true, reduced: true, ground: "#FFFFFF" }])),
  // the Proving ground's Coming up — a LOOK: the board's hero is one row (the hill beside the title, the strip and the two
  // tickets in one column); the live page keeps the plate hero (title + strip | the hill) with the tickets as section 01, and
  // its hill draws no lit bench and no "you" (nothing proves a round yet — interview.md, agent's pick)
  "pg-coming": { source: "final", board: "ProvingGround", fixture: "ProvingGroundBoard", boardSel: 'section#coming[aria-label="Coming up"]',
    buildSel: '[data-upcoming-list]', pad: 4, reduced: true, look: true },
  "pg-hero": { source: "final", board: "ProvingGround", fixture: "ProvingGroundBoard", boardSel: 'div[style*="box-shadow: 6px 6px 0"]:has(svg[aria-label^="The proving ground"])',
    buildSel: ".pl-iv__hero", pad: 0, reduced: true, look: true },
  // Ask draft's route card — the board's card in its 430 px column; the waypoint ticket's second line is the board's
  // ("its BUILD question, about 4 min") where the build names the entry ("its Gazetteer entry" — the engine's lessons carry no
  // practice step) — a LOOK until an entry's practice steps reach the engine
  "askroute-card": { source: "final", board: "AskRoute", fixture: "AskRouteBoard", boardSel: 'aside[aria-label="Ask draft"] li div[style*="border-radius: 12px; overflow: hidden; background: #FFFFFF"]',
    buildSel: ".pl-askroute", pad: 0, reduced: true, subpixel: true, look: true },
};
// what each Your survey pair keeps out of the pixel gate, and why (D196: masks only for example data, with the reason)
// ✅ OWNER 11-26 (end of 47i, decision 3 — "go with your recs"): every ys pair at 390 and ys-want at 1280 are owner-accepted
// LOOKs. The board keeps its desktop rail at 390 (not a phone design); ys-want's "what you want" rows are worded from the
// person's own data. A phone sketch, if one is drawn later, replaces these.
// what each Opening pair keeps out of the pixel gate, and why (D196: masks only for example data, with the reason)
function opPair(k) { return {
  // 02: the board drew the contextual-score card before D202; the approved D202 card (FitCard, gated on its own board by the
  // fit-* pairs) replaces it there — a look, not a gate
  fit: { look: true },
  // 01: the board says the posting "simply" — its four lines and its must / nice lists are paraphrases, not the posting's
  // words (its own section 04 has three duties and two asks); D190 keeps a model out, so the build shows the posting's own
  // lines and the two can't be the same size — a look
  role: { look: true },
  // the left 6 px: the board's rail edge beside its column; "3 / 5" (the board's rows give 4 of the top 5 on your résumé)
  head: { masks: [[0, 0, 6, 438], [384, 352, 40, 30]] },
  // 03: the board's stack is a TEAM's ("FOR THIS TEAM", "What Checkout builds with", "· Checkout" on each row, NEW THIS
  // QUARTER) — draft's technographics are the company's (no team on a row, no first-seen date), and it lists React (8) above
  // TypeScript (9), where the build orders by share
  stack: { masks: [[0, 0, 6, 365], [110, 0, 560, 72], [20, 95, 720, 25], [70, 155, 1080, 70], [1005, 230, 150, 70], [200, 312, 960, 34]] },
  // 05: "Kestrel’s" (the board's short name) — the build says the company's name whole
  company: { masks: [[0, 0, 6, 438], [150, 98, 250, 22]] },
}[k]; }
// D198 (47h): the explainer's oracle — v4's export holds only the two explainer pages (A236), so it is not a SOURCES drawing set
const XP_SOURCE = { file: path.join(ROOT, "docs", "sketches", "Atlas plate system v4.html"), out: path.join(ROOT, "tmp", "d196-canvas-v4"), name: "docs/sketches/Atlas plate system v4.html" };

/** Pure: compare two RGBA buffers of the same size → { differing, compared, pct }. Masks are [x, y, w, h]. */
export function diffRgba(a, b, width, height, { tolerance = TOLERANCE, masks = [] } = {}) {
  let differing = 0, compared = 0;
  const masked = (x, y) => masks.some(([mx, my, mw, mh]) => x >= mx && x < mx + mw && y >= my && y < my + mh);
  const mark = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (masks.length && masked(x, y)) continue;
    const i = (y * width + x) * 4;
    compared++;
    if (Math.abs(a[i] - b[i]) > tolerance || Math.abs(a[i + 1] - b[i + 1]) > tolerance || Math.abs(a[i + 2] - b[i + 2]) > tolerance) { differing++; mark[y * width + x] = 1; }
  }
  return { differing, compared, pct: compared ? (100 * differing) / compared : 0, mark };
}

export async function buildFixturePage(name) {
  const require = createRequire(path.join(ROOT, "client", "package.json"));
  const esbuild = require("esbuild");
  const dir = path.join(OUT, "_build");
  fs.mkdirSync(dir, { recursive: true });
  const entry = `
    import { createRoot } from "react-dom/client";
    import { FIXTURES } from ${JSON.stringify(path.join(ROOT, "client/src/plate/fixtures.jsx"))};
    const C = FIXTURES[${JSON.stringify(name)}];
    createRoot(document.getElementById("root")).render(<C/>);
  `;
  await esbuild.build({
    stdin: { contents: entry, resolveDir: path.join(ROOT, "client"), loader: "jsx" },
    bundle: true, format: "iife", outfile: path.join(dir, `${name}.js`), jsx: "automatic", logLevel: "warning",
    loader: { ".woff2": "file", ".woff": "file" }, define: { "process.env.NODE_ENV": '"production"' },
  });
  // 47f (D196 THEMES): inside the app the plate takes the person's theme; the oracle is the SKETCH's palette, so the build
  // page pins it (styles/plate.css: html[data-plate-palette="sketch"] keeps the report's literal values) — like with like.
  const html = `<!doctype html><html data-plate-palette="sketch"><head><meta charset="utf-8"><link rel="stylesheet" href="${name}.css">
    <style>html,body{margin:0;background:var(--pl-paper, #F4EFE9)}</style></head><body><div id="root"></div><script src="${name}.js"></script></body></html>`;
  const file = path.join(dir, `${name}.html`);
  fs.writeFileSync(file, html);
  return pathToFileURL(file).href;
}

async function shot(page, url, sel, width, pad, waitMs, reduced = false, ground = null, hide = null, clickText = null, prep = null) {
  await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: reduced ? "reduce" : "no-preference" }]);
  await page.goto(url, { waitUntil: "load", timeout: 60000 });
  // clickText (47f): press the board's own control first (its Index tab) — the board is a live page with state
  if (clickText) { await page.evaluate((t) => { const b = [...document.querySelectorAll('button[role="tab"]')].find((x) => x.textContent.includes(t)); b?.click(); }, clickText); await new Promise((r) => setTimeout(r, 400)); }
  if (prep) await prep(page);   // D198 (47h): a pair's own presses (the explainer's beat) before the still frame
  await page.waitForSelector(sel, { timeout: 30000 });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  // let the board's entrance animations finish (draw-on 3.5 s, view-in .35 s) — and stop the loops for a still frame
  await new Promise((r) => setTimeout(r, waitMs));
  await page.addStyleTag({ content: "*,*::before,*::after{animation-play-state:paused!important;transition:none!important}" });
  // a drawing compared on its own: the same ground behind it on both sides (the board's container tint and corner are the
  // page's, not the drawing's)
  if (ground) await page.addStyleTag({ content: `${sel}{background:${ground}!important}` });
  // the board page's HTML overlays on a drawing (callout tags, a moving token) are the page's, not the drawing's
  if (hide) await page.addStyleTag({ content: `${hide}{visibility:hidden!important}` });
  const box = await page.$eval(sel, (el) => { const r = el.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; });
  const clip = { x: Math.max(0, Math.floor(box.x - pad)), y: Math.max(0, Math.floor(box.y - pad)), width: Math.ceil(box.w + 2 * pad), height: Math.ceil(box.h + 2 * pad) };
  return { png: await page.screenshot({ clip, captureBeyondViewport: true }), clip, box };
}

/** Decode both PNGs in the page and diff them there (no image library in the repo). */
async function compareInPage(page, aPng, bPng, masks) {
  return page.evaluate(async (a64, b64, masksIn, tol) => {
    const load = (b) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = "data:image/png;base64," + b; });
    const [A, B] = await Promise.all([load(a64), load(b64)]);
    const w = Math.max(A.width, B.width), h = Math.max(A.height, B.height);
    const px = (im) => { const c = new OffscreenCanvas(w, h); const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.drawImage(im, 0, 0); return g.getImageData(0, 0, w, h).data; };
    const da = px(A), db = px(B);
    let differing = 0, compared = 0;
    const out = new OffscreenCanvas(w, h); const og = out.getContext("2d"); og.drawImage(B, 0, 0); og.fillStyle = "rgba(255,255,255,.6)"; og.fillRect(0, 0, w, h);
    const id = og.getImageData(0, 0, w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (masksIn.some(([mx, my, mw, mh]) => x >= mx && x < mx + mw && y >= my && y < my + mh)) continue;
      const i = (y * w + x) * 4; compared++;
      if (Math.abs(da[i] - db[i]) > tol || Math.abs(da[i + 1] - db[i + 1]) > tol || Math.abs(da[i + 2] - db[i + 2]) > tol) {
        differing++; id.data[i] = 194; id.data[i + 1] = 89; id.data[i + 2] = 58; id.data[i + 3] = 255;
      }
    }
    og.putImageData(id, 0, 0);
    const pair = new OffscreenCanvas(A.width + B.width + 24, h); const pg = pair.getContext("2d");
    pg.fillStyle = "#1B1B1B"; pg.fillRect(0, 0, pair.width, h); pg.drawImage(A, 0, 0); pg.drawImage(B, A.width + 24, 0);
    const toB64 = async (c) => { const blob = await c.convertToBlob({ type: "image/png" }); const buf = new Uint8Array(await blob.arrayBuffer()); let s = ""; for (let k = 0; k < buf.length; k += 32768) s += String.fromCharCode.apply(null, buf.subarray(k, k + 32768)); return btoa(s); };
    return { w, h, sizeA: [A.width, A.height], sizeB: [B.width, B.height], differing, compared, pct: compared ? 100 * differing / compared : 0, diff: await toB64(out), pair: await toB64(pair) };
  }, aPng.toString("base64"), bPng.toString("base64"), masks, TOLERANCE);
}

export async function runPair(name, { width = 1280, threshold = THRESHOLD_PCT, browser } = {}) {
  const p = PAIRS[name];
  if (!p) throw new Error(`no pair "${name}" (have: ${Object.keys(PAIRS).join(", ")})`);
  let boardUrl;
  if (p.source === "final") {
    // 47h (A244): the approved canvas's own board sources, served over http (scripts/d196FinalCanvas.mjs); board = the file stem
    if (!finalBoards().some((b) => b.stem === p.board)) throw new Error(`no board "${p.board}" on the final canvas (docs/sketches/final/project)`);
    boardUrl = `${(await serveFinal()).base}/${p.board}.dc.html`;
  } else {
    const src = p.source === "v4" ? XP_SOURCE : p.source ? SOURCES[p.source] : null;
    const index = src ? unpackCanvas(src.file, src.out) : unpackCanvas();
    const row = index.find((r) => r.title === p.board);
    if (!row) throw new Error(`no board "${p.board}" in ${src ? src.name : "the v3 export"}`);
    boardUrl = pathToFileURL(path.join(src ? src.out : CANVAS, row.file)).href;
  }
  let buildUrl = await buildFixturePage(p.fixture);
  const page = await browser.newPage();
  const board = await shot(page, boardUrl, p.boardSel, width, p.pad, 4000, !!p.reduced, p.ground, p.hideOnBoard, p.boardTab || null, p.boardPrep || null);
  // matchWidth: the build draws at the board element's EXACT width and at the same sub-pixel offset inside its first pixel,
  // so both rasterise on the same grid (the board's signpost sits at x = 994.73, 260.27 wide — drawn at 261 from x = 0 every
  // outline landed a fraction off and read as a difference)
  const frac = (v) => +(v - Math.floor(v)).toFixed(4);
  if (p.matchWidth || p.drawing) buildUrl += `#${new URLSearchParams({ ...(p.drawing ? { name: p.drawing } : {}),
    ...(p.matchWidth ? { w: String(board.box.w), h: String(board.box.h), ox: String(frac(board.box.x - p.pad)), oy: String(frac(board.box.y - p.pad)) } : {}) })}`;
  // subpixel (47f): a composed fixture (the deck's ticket) placed at the board element's own sub-pixel offset — the board's
  // ticket sits at a fractional y, and one whole pixel apart every glyph's edge read as a difference (7 % on FIX-2's run)
  else if (p.subpixel) buildUrl += `#${new URLSearchParams({ ox: String(frac(board.box.x)), oy: String(frac(board.box.y)), w: String(board.box.w), sel: p.buildSel })}`;   // sel (47i): the element a fixture places at that fraction
  if (p.buildHash) buildUrl += `${buildUrl.includes("#") ? "&" : "#"}${p.buildHash}`;   // 47h: a fixture's own switch (the Index tab)
  const build = await shot(page, buildUrl, p.buildSel, width, p.pad, p.waitBuild || 600, !!p.reduced, p.ground, null, null, p.buildPrep || null);
  // cornerMasks: the board container's rounded corners clip the drawing's corners there (the page's frame, not the drawing)
  const cm = p.cornerMasks, bw = board.clip.width, bh = board.clip.height;
  // masksAt[width]: a pair's masks at another width (the board lays the same parts out elsewhere at 390)
  const masks = [...((p.masksAt && p.masksAt[width]) || p.masks || []), ...(cm ? [[0, 0, cm, cm], [bw - cm, 0, cm, cm], [0, bh - cm, cm, cm], [bw - cm, bh - cm, cm, cm]] : [])];
  // cropTo[width]: compare only the top N px of both (what lies below is another pair's)
  const cut = p.cropTo && p.cropTo[width];
  const [bPng, uPng] = cut ? await Promise.all([board, build].map((x) => page.evaluate(async (b64, hh) => {
    const im = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = "data:image/png;base64," + b64; });
    const c = new OffscreenCanvas(im.width, Math.min(hh, im.height)); c.getContext("2d").drawImage(im, 0, 0);
    const buf = new Uint8Array(await (await c.convertToBlob({ type: "image/png" })).arrayBuffer());
    let s = ""; for (let k = 0; k < buf.length; k += 32768) s += String.fromCharCode.apply(null, buf.subarray(k, k + 32768)); return btoa(s);
  }, x.png.toString("base64"), cut).then((b64) => Buffer.from(b64, "base64")))) : [board.png, build.png];
  if (cut) { board.png = bPng; build.png = uPng; }
  const r = await compareInPage(page, board.png, build.png, masks);
  await page.close();
  const dir = path.join(OUT, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "board.png"), board.png);
  fs.writeFileSync(path.join(dir, "build.png"), build.png);
  fs.writeFileSync(path.join(dir, "diff.png"), Buffer.from(r.diff, "base64"));
  fs.writeFileSync(path.join(dir, "pair.png"), Buffer.from(r.pair, "base64"));
  const report = { pair: name, width, board: board.clip, build: build.clip, boardBox: board.box, buildBox: build.box, /* 47i: the raw (fractional) boxes */ sizeBoard: r.sizeA, sizeBuild: r.sizeB,
    differing: r.differing, compared: r.compared, pct: +r.pct.toFixed(3), threshold,
    // lookAt[width] (owner 11-26, decision 3): a pair the owner accepted as built at that width — a LOOK there, with its reason
    ...(p.lookAt && p.lookAt[width] ? { look: true, pass: true, note: p.lookAt[width] }
      : p.look ? { look: true, pass: true, note: "side by side for the owner's look — sizes differ on purpose (the deck's form factor)" }
      : { pass: r.pct <= threshold && r.sizeA.join() === r.sizeB.join() }) };
  fs.writeFileSync(path.join(dir, "report.json"), JSON.stringify(report, null, 2));
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const names = arg("--pair") ? arg("--pair").split(",") : arg("--prefix") ? Object.keys(PAIRS).filter((k) => arg("--prefix").split(",").some((p) => k.startsWith(p))) : Object.keys(PAIRS);   // 47i: a comma list, or --prefix survey-,ledger-
  const { launchBrowser } = await import("../services/browserLauncher.js");
  // 47f: text in a composited layer (the deck's 3-D flip — the owner's keep) rasterises in greyscale, the board's flat page
  // in LCD sub-pixel colour; the run compares the DESIGN, so both sides render greyscale (one Chrome flag for both).
  const browser = await launchBrowser({ headless: "new", extraArgs: LAUNCH_ARGS });
  let failed = 0;
  try {
    for (const n of names) {
      const r = await runPair(n, { width: Number(arg("--width", 1280)), threshold: Number(arg("--threshold", THRESHOLD_PCT)), browser });
      if (!r.pass) failed++;
      console.log(`${r.look ? "LOOK" : r.pass ? "PASS" : "FAIL"} ${n}: ${r.pct} % differ (${r.differing} / ${r.compared}), board ${r.sizeBoard.join("×")} vs build ${r.sizeBuild.join("×")} → tmp/d196-regress/${n}/pair.png`);
    }
  } finally { await browser.close(); }
  process.exit(failed ? 1 : 0);
}
