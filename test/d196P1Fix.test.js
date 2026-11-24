// ⭐ D196 P1 FIX (owner 11-24, 47f) · the fast checks of the owner's FIX block (the browser ones: d196P1FixBrowser):
//   d196TicketAnatomyComplete        — FIX-4: the ticket carries the board's parts top to bottom (strip with POSTED and
//                                      LIVE, letter tile, company link, place, the match % + MATCH, the serif title, pay /
//                                      type / mode, WORKS WITH chips ✓ / dashed, the FILED H-1B stamp, the tear, Pass · Save
//                                      · Send · Draft this job — Draft the one clay button); no "Open the posting";
//   d196TicketActionsAreTheDecks     — FIX-4 / A93: the four call DeckView's decide() and sendTop (no second implementation);
//                                      the classic action row is not drawn under the plate ticket;
//   d196FieldCardThreeNumbersLabelled — FIX-5: always ROLE FIT · STACK · DUTIES, each labelled, "—" for one not scored;
//   d196DeckAtBoardSize              — FIX-2: the ticket is the column less the backs' 18 px; the two backs at the board's
//                                      poses (1° at 10 / −8, 2.2° at 18 / −14, 12 px shorter); the frame, the deck's own
//                                      CardBack and the flip are FanCard's;
//   d196PlatePageOneGround           — FIX-1: one plate root under the whole page, no market section transparent; the
//                                      plate takes the person's theme (paper = canvas …) except under the sketch's pin.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { at } from "../test-support/sourceAnchors.js";
import { plateTicketSize, plateFanTransform, PLATE_DECK_PAD } from "../client/src/plate/deckGeometry.js";
import { fieldCardView } from "../shared/contextualView.js";

const ROOT = process.cwd(), CLIENT = path.join(ROOT, "client");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8").replace(/\r\n/g, "\n");

let mod = null;
async function load() {
  if (mod) return mod;
  const esbuild = createRequire(path.join(CLIENT, "package.json"))("esbuild");
  const out = path.join(ROOT, "tmp", "d196-render", `p1fix-${process.pid}.mjs`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const entry = `
    import * as React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import { MemoryRouter } from "react-router-dom";
    import MarketCardFace, { postedWords } from ${JSON.stringify(path.join(CLIENT, "src/plate/MarketCardFace.jsx"))};
    import { FieldCard } from ${JSON.stringify(path.join(CLIENT, "src/plate/Cards.jsx"))};
    export { postedWords };
    export const face = (props) => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(MarketCardFace, props)));
    export const field = (props) => renderToStaticMarkup(React.createElement(FieldCard, props));
  `;
  await esbuild.build({
    stdin: { contents: entry, resolveDir: CLIENT, loader: "jsx" }, bundle: true, format: "esm", platform: "node", outfile: out,
    jsx: "automatic", logLevel: "error", loader: { ".css": "empty", ".woff": "empty", ".woff2": "empty" },
    define: { "process.env.NODE_ENV": '"production"', "import.meta.env": "{}" }, nodePaths: [path.join(CLIENT, "node_modules")],
    banner: { js: 'import { createRequire as __fixCR } from "node:module"; const require = __fixCR(import.meta.url);' },
  });
  mod = await import(pathToFileURL(out).href);
  return mod;
}

const card = (job = {}) => ({
  score: 91, why: { matched: ["React", "TypeScript"], missing: ["Datadog RUM"] },
  job: { id: "k1", company: "Kestrel Payments", location: "Boston, MA", title: "Sr. Lead Software Engineer, Messaging Platform",
    postedAt: new Date(Date.now() - 2 * 3600e3).toISOString(), salaryMin: 150000, salaryMax: 180000, contractType: "Full-time", workplaceType: "hybrid",
    worksWith: ["React", "TypeScript", "Datadog RUM"], sponsorship: { level: "often" }, ...job },
});

test("FIX-4 · d196TicketAnatomyComplete — the board's parts, in the board's order", async () => {
  const { face } = await load();
  const html = face({ card: card(), isFront: true, size: { width: 808, height: 364 } });
  const order = ["OPENING · POSTED 2 H AGO", ">LIVE<", 'class="pl-letter', "data-company-link", "Boston, MA", ">91%<", ">MATCH<",
    "<h2", "Sr. Lead Software Engineer, Messaging Platform", "$150k", "Full-time", "Hybrid", "WORKS WITH · ✓ ON YOUR RÉSUMÉ",
    'data-yours="true"', 'data-yours="false"', "FILED H-1B", "pl-opening__tear", 'data-deck-action="pass"', 'data-deck-action="save"',
    'data-deck-action="send"', 'data-deck-action="draft"'];
  let from = 0;
  for (const piece of order) { const i = html.indexOf(piece, from); assert.ok(i >= 0, `missing or out of order: ${piece}`); from = i; }
  assert.equal((html.match(/pl-tbtn--draft/g) || []).length, 1, "Draft this job is the one clay button");
  assert.ok(!/Open the posting/.test(html), "no Open the posting on the board's ticket");
  assert.ok(!/-webkit-line-clamp|line-clamp/.test(html), "the title is never clamped");
  const none = face({ card: card({ sponsorship: null, salaryMin: null, salaryMax: null }), isFront: true, size: { width: 808, height: 364 } });
  assert.ok(!none.includes("FILED H-1B"), "no filings → no stamp (nothing says no)");
  assert.ok(none.includes("Pay not posted"));
});

test("FIX-4 · postedWords — the board's strip words", async () => {
  const { postedWords } = await load();
  assert.equal(postedWords("2 hours"), "POSTED 2 H AGO");
  assert.equal(postedWords("1 day"), "POSTED 1 DAY AGO");
  assert.equal(postedWords("3 days"), "POSTED 3 DAYS AGO");
  assert.equal(postedWords("5 weeks"), "POSTED 5 WEEKS AGO");
  assert.equal(postedWords(null), null);
});

test("FIX-4 · d196TicketActionsAreTheDecks — the ticket's four call DeckView's own decide / sendTop", () => {
  const face = read("client/src/plate/MarketCardFace.jsx");
  assert.match(face, /onDecide\?\.\(DECISIONS\.PASSED\)/); assert.match(face, /onDecide\?\.\(DECISIONS\.SAVED\)/);
  assert.match(face, /onDecide\?\.\(DECISIONS\.DRAFTED\)/); assert.match(face, /act\(onSend\)/);
  assert.ok(!/api\(|fetch\(|commitDecision/.test(face), "the face decides nothing itself (A93: one implementation, DeckView's)");
  const deck = read("client/src/panels/DeckView.jsx");
  const fan = deck.slice(at(deck, "function FanCard("), at(deck, "function leaveFor("));
  assert.ok(fan.includes("onDecide={onDecide} onSend={onSend} />"), "FanCard hands the face the deck's decide and send");
  assert.ok(deck.includes("plate={plateDeck} onSend={sendTop}"), "the deck passes its own sendTop");
  assert.ok(deck.includes("{!plateDeck && <div data-deck-actions"), "the classic action row is not drawn under the plate ticket");
  assert.ok(fan.includes("<CardBack company={card.job.company}"), "the deck's own back stays (the owner's keep)");
  assert.ok(fan.includes("rotateY(${faceUp ? 0 : 180}deg)"), "the flip stays");
});

test("FIX-5 · d196FieldCardThreeNumbersLabelled — always three, each labelled, — for one not scored", async () => {
  const v = fieldCardView({ report: { score: 70 }, contextual: { score: 60, parts: {
    role_fit: { status: "pending" }, tech_stack: { status: "ok", score: 69, exact: [], gaps: [] },
    responsibility_overlap: { status: "ok", score: 17, matched: [], missing: [] } } } });
  assert.deepEqual(v.figures.items.map((f) => [f.label, f.value]), [["ROLE FIT", null], ["STACK", 69], ["DUTIES", 17]]);
  assert.equal(v.figures.value, "— · 69 · 17", "role's place is held, so 69 is never read as the role fit");
  const { field } = await load();
  const html = field({ alike: ["x"], gaps: [], figures: v.figures });
  for (const l of ["ROLE FIT", "STACK", "DUTIES"]) assert.ok(html.includes(`>${l}</dt>`), `labelled: ${l}`);
  assert.match(html, /not scored yet/);
  assert.equal((html.match(/data-fig=/g) || []).length, 3);
});

test("FIX-2 · d196DeckAtBoardSize — the board's ticket and its two sheets", () => {
  assert.deepEqual(PLATE_DECK_PAD, { top: 14, right: 18 });
  assert.deepEqual(plateTicketSize(826, 364), { width: 808, height: 364 }, "the column less the backs' 18 px; the face's height");
  assert.equal(plateTicketSize(826, 0).height, 460, "a first-paint guess before the face is measured");
  assert.equal(plateTicketSize(100, 300).width, 200, "never below 200");
  const near = plateFanTransform(1), far = plateFanTransform(2);
  assert.deepEqual([near.x, near.y, near.rotate, near.dw, near.shown], [10, -8, 1, 2, true], "inset 6 6 20 10, rotate 1°");
  assert.deepEqual([far.x, far.y, far.rotate, far.dw, far.shown], [18, -14, 2.2, 0, true], "inset 0 0 26 18, rotate 2.2°");
  assert.equal(plateFanTransform(3).shown, false, "three tickets at most (R3)");
  assert.equal(plateFanTransform(-1).shown, false);
  const deck = read("client/src/panels/DeckView.jsx");
  assert.ok(deck.includes("Math.max(0, size.height - 12)"), "a back sheet is 12 px shorter than the ticket");
  assert.ok(deck.includes('maxWidth: plateDeck ? "none"'), "the plate deck fills its column (no Home 640 / 390 cap)");
  const css = read("client/src/plate/plate.css");
  assert.match(css, /\.pl-market-deck > :first-child \{ flex: 999 1 560px; min-width: 0; \}/);
  assert.match(css, /\.pl-market-deck__side \{ flex: 1 1 280px; max-width: 360px; min-width: 0; \}/);
  assert.match(css, /\.pl-deckstage \{ padding: 14px 18px 0 0; \}/);
});

test("FIX-1 · d196PlatePageOneGround — one opaque root, the theme's palette, the sketch's pin", () => {
  const app = read("client/src/App.jsx");
  assert.ok(app.includes('<PlateRoot className="pl-marketpage" data-plate-page="market"><MarketHeroSlot /><MarketBearingSlot /><MarketOpeningsSlot'),
    "the hero, the bearing and the openings sit in ONE plate root");
  const css = read("client/src/plate/plate.css");
  assert.match(css, /\.pl-marketpage \{ background: var\(--pl-paper\); min-height:/);
  for (const sec of ["pl-markethero", "pl-marketopenings", "pl-marketbearing"]) {
    assert.match(css, new RegExp(`\\.${sec} \\{ background: var\\(--pl-paper\\);`), `${sec} is opaque`);
    assert.doesNotMatch(css, new RegExp(`\\.${sec} \\{ background: transparent`), `${sec} is never transparent`);
  }
  const tokens = read("client/src/styles/plate.css");
  assert.match(tokens, /:root\[data-theme\]:not\(\[data-plate-palette="sketch"\]\) \.plate \{\n  --pl-paper: var\(--c-canvas\);/);
  for (const t of ["--pl-card: var(--c-surface-solid)", "--pl-ink: var(--c-ink)", "--pl-clay: var(--c-accent)", "--pl-lit: var(--c-success)"]) assert.ok(tokens.includes(t), t);
  assert.match(tokens, /:root\[data-theme\$="-dark"\]:not\(\[data-plate-palette="sketch"\]\) \.plate \{\n  --pl-shade:/, "dark themes: a deeper ground for the hard shadow");
  assert.match(read("scripts/d196Regress.mjs"), /<html data-plate-palette="sketch">/, "the F5 oracle compares the sketch's palette");
});
