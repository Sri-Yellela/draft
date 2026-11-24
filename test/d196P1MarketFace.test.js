// ⭐ D196 P1 · the market's card face in plates (plate/MarketCardFace.jsx) and its switch (plate/marketPlate.js).
//   d196P1KeepsFrameBacksFlip — the owner's three keeps (11-24): with the plate face on, DeckView still draws its own card
//                               frame (the fixed size, the corner), its CardBack behind the face, and the flip (data-flip,
//                               rotateY) — the plate branch replaces HomeCardFace and nothing else;
//   d196P1FaceKeepsDeckHooks  — the hooks the deck and its tests read are on the plate face (title line + heading id, the
//                               match signal, Open the posting with Enter, the company link);
//   d196P1FaceHonestData      — R2: no pay → "Pay not posted", no sponsorship data → no stamp, no logo → the letter tile,
//                               a 120-character title kept whole in the markup (CSS clamps it), ✓ only on matched tech;
//   d196P1BearingSameControls — the cartouche is BoardHeadline's sentence with BoardHeadline's controls (same words, slots,
//                               aria-pressed / aria-expanded / aria-controls, id) — only the look differs (R6);
//   d196P1HeroHonest          — the hero's figures are only the ones the facets counted; the plate marks you in your sector;
//                               no best match → no route, no pin, no BEST MATCH tag; with the defaults the plate is the board's;
//   d196P1SwitchOffByDefault  — the plate market is OFF until the owner's ok; ?plate=1 / ?plate=0 and the stored value.
// ⛔ Verified to fail before it was committed: the CardBack line removed from the plate branch, data-deck-open-posting
// dropped from the face, MARKET_PLATE_DEFAULT set true — each failed, naming it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { at } from "../test-support/sourceAnchors.js";
import { marketPlateOn, sectorRegion, MARKET_PLATE_DEFAULT } from "../client/src/plate/marketPlate.js";

const ROOT = process.cwd();
const CLIENT = path.join(ROOT, "client");
const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");

let mod = null;
async function load() {
  if (mod) return mod;
  const esbuild = createRequire(path.join(CLIENT, "package.json"))("esbuild");
  const out = path.join(ROOT, "tmp", "d196-render", `p1face-${process.pid}.mjs`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const entry = `
    import * as React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import { MemoryRouter } from "react-router-dom";
    import MarketCardFace, { openingFromCard, pickStack } from ${JSON.stringify(path.join(CLIENT, "src/plate/MarketCardFace.jsx"))};
    export { openingFromCard, pickStack };
    import PlateBearing from ${JSON.stringify(path.join(CLIENT, "src/plate/PlateBearing.jsx"))};
    import BoardHeadline from ${JSON.stringify(path.join(CLIENT, "src/components/BoardHeadline.jsx"))};
    import MarketHero, { marketCells, youOnPlate, SECTOR_SPOTS } from ${JSON.stringify(path.join(CLIENT, "src/plate/MarketHero.jsx"))};
    import MarketSurveyPlate from ${JSON.stringify(path.join(CLIENT, "src/plate/drawings/MarketSurveyPlate.jsx"))};
    export { marketCells, youOnPlate, SECTOR_SPOTS };
    export const renderHero = (props) => renderToStaticMarkup(React.createElement(MarketHero, props));
    export const renderPlate = (props) => renderToStaticMarkup(React.createElement(MarketSurveyPlate, props));
    export const renderBearing = (props) => renderToStaticMarkup(React.createElement(PlateBearing, props));
    export const renderHeadline = (props) => renderToStaticMarkup(React.createElement(BoardHeadline, props));
    export const render = (props) => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(MarketCardFace, props)));
  `;
  await esbuild.build({
    stdin: { contents: entry, resolveDir: CLIENT, loader: "jsx" }, bundle: true, format: "esm", platform: "node", outfile: out,
    jsx: "automatic", logLevel: "error", loader: { ".css": "empty", ".woff": "empty", ".woff2": "empty" },
    define: { "process.env.NODE_ENV": '"production"', "import.meta.env": "{}" }, nodePaths: [path.join(CLIENT, "node_modules")],
    // react-dom/server's node build requires node builtins: give the ESM bundle a real require (as test-support/renderPlate.mjs)
    banner: { js: 'import { createRequire as __p1CR } from "node:module"; const require = __p1CR(import.meta.url);' },
  });
  mod = await import(pathToFileURL(out).href);
  return mod;
}

const NOW = Date.parse("2026-11-24T12:00:00Z");
const card = (job = {}, extra = {}) => ({
  score: 91, why: { matched: ["React", "TypeScript"], missing: ["Datadog RUM"] },
  job: { id: "j1", company: "Kestrel Payments", location: "Boston, MA", title: "Frontend Engineer II, Checkout", postedAt: "2026-11-23T12:00:00Z",
    salaryMin: 150000, salaryMax: 175000, worksWith: ["React", "TypeScript", "GraphQL"], sponsorship: { level: "often" }, ...job },
  ...extra,
});
const SIZE = { width: 300, height: 420 };

test("D196 P1 · d196P1KeepsFrameBacksFlip — the plate branch swaps the face only", () => {
  const s = read("client/src/panels/DeckView.jsx");
  const i = at(s, "{showFace && home && plateFace && <MarketCardFace");
  const fan = s.slice(at(s, "function FanCard("), at(s, "function leaveFor("));
  assert.ok(fan.includes("{showFace && home && plateFace && <MarketCardFace"), "the plate face is FanCard's");
  assert.ok(fan.includes("{showFace && home && !plateFace && <HomeCardFace"), "the old face stays when the switch is off");
  const after = s.slice(i, i + 2400);
  assert.ok(after.includes("<CardBack company={card.job.company}"), "the deck's own back stays behind the plate face");
  const before = s.slice(i - 3600, i);
  assert.ok(before.includes("<div data-flip"), "the flip wraps the plate face");
  assert.ok(before.includes("rotateY(${faceUp ? 0 : 180}deg)"), "the flip still turns the card");
  assert.ok(before.includes("height: size.height, overflow: \"hidden\""), "the fixed home frame stays");
  assert.ok(!/<DeckPile/.test(s), "never the sketch's plain sheets (DeckPile) behind the card");
});

test("D196 P1 · d196P1FaceKeepsDeckHooks", async () => {
  const { render } = await load();
  const html = render({ card: card(), isFront: true, size: SIZE, landscape: false, headingRef: null });
  for (const hook of ["data-deck-face", "data-deck-title-line", 'id="deck-title-j1"', "data-deck-signal", "data-deck-open-posting", 'aria-keyshortcuts="Enter"', "data-company-link", "data-plate-face"]) {
    assert.ok(html.includes(hook), `missing ${hook}`);
  }
  assert.match(html, /91%/);
  assert.match(html, /class="plate pl-mface/);
  const back = render({ card: card(), isFront: false, size: SIZE, landscape: false });
  assert.match(back, /data-deck-open-posting="" tabindex="-1"/, "a card behind the front is not in the tab order");
  const bare = render({ card: card(), isFront: false, size: SIZE, landscape: false, bare: true });
  assert.ok(!bare.includes("data-deck-signal"), "bare = no match corner");
});

test("D196 P1 · d196P1FaceHonestData — nothing invented (R2)", async () => {
  const { render, openingFromCard } = await load();
  const o = openingFromCard(card(), NOW);
  assert.equal(o.posted, "24 HOURS AGO");
  assert.deepEqual(o.stack.map((t) => [t.name, t.yours]), [["React", true], ["TypeScript", true], ["GraphQL", false]]);
  assert.equal(o.region, "IV", "no sector on the card → IV");
  const { pickStack } = await load();
  const many = ["A", "B", "C", "D", "E"].map((n) => ({ name: n, yours: true })).concat([{ name: "Gap", yours: false }]);
  assert.deepEqual(pickStack(many, 3).map((t) => t.name), ["A", "B", "Gap"], "the gap is never cut for another ✓");
  assert.deepEqual(pickStack(many.slice(0, 5), 3).map((t) => t.name), ["A", "B", "C"]);
  const bare = card({ salaryMin: null, salaryMax: null, sponsorship: null, companyIconUrl: null, worksWith: [],
    title: "Senior Staff Software Engineer, Frontend Platform and Design Systems Infrastructure (Payments, Checkout, Billing and Risk)" });
  const html = render({ card: bare, isFront: true, size: { width: 250, height: 350 }, landscape: false });
  assert.match(html, /Pay not posted/);
  assert.ok(!html.includes("FILED H-1B"), "no sponsorship data → no stamp");
  assert.ok(!/\bno sponsorship\b/i.test(html), "nothing says no");
  assert.match(html, /class="pl-letter[^"]*"[^>]*>K</, "no logo → the letter tile");
  assert.ok(html.includes("Billing and Risk)"), "the long title is whole in the markup");
  assert.ok(!html.includes("WORKS WITH"), "no stack → no empty label");
  assert.match(html, /data-tier="sm"/);
  const sponsored = render({ card: card(), isFront: true, size: { width: 600, height: 372 }, landscape: true });
  assert.match(sponsored, /FILED H-1B/);
  assert.match(sponsored, /data-tier="lg"/);
});

test("D196 P1 · d196P1SwitchOffByDefault", () => {
  assert.equal(MARKET_PLATE_DEFAULT, false, "off until the owner's ok to P1's side-by-sides");
  assert.equal(marketPlateOn("", null), false);
  assert.equal(marketPlateOn("?plate=1", null), true);
  assert.equal(marketPlateOn("?plate=0", "1"), false);
  assert.equal(marketPlateOn("", "1"), true);
  assert.equal(marketPlateOn("?x=1", "0"), false);
  assert.equal(sectorRegion("Software engineering"), "IV");
  assert.equal(sectorRegion("Data and AI"), "VIII");
  assert.equal(sectorRegion("Project management"), "VII");
  assert.equal(sectorRegion("Business and finance"), "V");
  assert.equal(sectorRegion("Design"), "VI");
  assert.equal(sectorRegion("Nursing"), "IV", "a sector with no ramp falls back to IV");
});

test("D196 P1 · d196P1BearingSameControls — the cartouche is the same sentence and the same controls (R6)", async () => {
  const { renderBearing, renderHeadline } = await load();
  const strip = (h) => h.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  const controls = (h) => [...h.matchAll(/<button[^>]*data-slot="([^"]+)"[^>]*>/g)].map((m) => {
    const a = (k) => (m[0].match(new RegExp(`${k}="([^"]*)"`)) || [])[1] ?? null;
    return [m[1], a("aria-pressed"), a("aria-expanded"), a("aria-controls")];
  });
  const sentenceOf = (h) => h.slice(at(h, 'id="fh-sentence"'), at(h, "</h1>"));
  for (const [params, open] of [[{}, null], [{ tech: "React", location: "Boston" }, "location"], [{ level: "mid" }, "level"]]) {
    const old = renderHeadline({ params, open });
    const plate = renderBearing({ params, open, allSlot: "all" });
    assert.ok(plate.includes('id="fh-sentence"'), "the sentence keeps its id");
    assert.ok(plate.includes('id="fh-all-filters"'), "All filters keeps its id");
    assert.equal(strip(sentenceOf(plate).replace(/^[^>]*>/, "")), strip(sentenceOf(old).replace(/^[^>]*>/, "")), "the same words");
    assert.deepEqual(controls(sentenceOf(plate)), controls(sentenceOf(old)), "the same controls and states");
  }
  const app = read("client/src/App.jsx");
  const slot = app.slice(at(app, "function BoardHeadlineSlot()"), at(app, "function RouteCommitSignal()"));
  assert.ok(slot.includes("if (!plate) return"), "the switch picks the cartouche");
  const plateBranch = slot.slice(at(slot, "<PlateBearing "));
  assert.ok(at(plateBranch, "<PlateBearing ") < at(plateBranch, "<WordPanel "), "WordPanel opens beneath the cartouche, as beneath the sentence");
});

test("D196 P1 · d196P1HeroHonest — the hero draws only what the board counted", async () => {
  const { renderHero, renderPlate, marketCells, youOnPlate, SECTOR_SPOTS } = await load();
  const { marketFigures } = await import("../client/src/lib/filterSentenceModel.js");
  assert.deepEqual(marketCells({ fit: 412, newToday: null, filed: 167, strong: undefined }).map((c) => c.label), ["FIT YOUR BEARING", "FILED H-1B"]);
  assert.deepEqual(marketCells({}), []);
  assert.deepEqual(marketFigures(null), { fit: null, newToday: null, filed: null, strong: null }, "no facets answer → no figures, never zeros");
  assert.deepEqual(youOnPlate("Data and AI · Machine learning").spot, SECTOR_SPOTS.VIII);
  assert.deepEqual(youOnPlate(null).spot, SECTOR_SPOTS.IV);
  // the board's plate with no props is the board's: the route and pin at the canvas's coordinates
  const board = renderPlate({});
  assert.match(board, /d="M192 166 C 250 150, 300 120, 352 102"/);
  assert.match(board, /translate\(352 102\)/);
  assert.match(board, /translate\(192 166\)/);
  assert.ok(!/visibility="hidden"/.test(board));
  const html = renderHero({ figures: { fit: 412, newToday: 179 }, sector: "Data and AI", role: "Data and AI", level: "mid", week: 47 });
  assert.match(html, /The market/);
  assert.match(html, /FIT YOUR BEARING/);
  assert.ok(!html.includes("FILED H-1B"), "a figure the facets didn't count is left out");
  assert.ok(!html.includes("BEST MATCH"), "no best match known → no tag");
  assert.match(html, /translate\(480 120\)/, "you are marked in your sector");
  assert.equal((html.match(/visibility="hidden"/g) || []).length, 2, "no route and no pin without a best match");
  assert.match(html, /YOU ARE HERE/);
  assert.ok(!/Kestrel|Maya|Boston/.test(html), "none of the board's example data reaches the real page");
});
