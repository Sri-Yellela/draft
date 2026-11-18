// The signed-out landing — ⭐ 46v 0d (owner 11-18, from the sketch https://claude.ai/artifact/DTSTvRwRUfLpmGjZBXu6p3:
// "I say A, and instead of the grid type feature list, use the shelf leaving the rest as is, and then also use c below it
// when scrolled down. also put an auto scroll scrolling at 1s for the job cards deck and remove text on it like the ats
// match. use the same card as we use inside the site. and also the draft button seems to have /dDraft").
// This file was test/landingFindFitApply.test.js (queue 31's find → fit → apply line, which left with the old landing);
// its checks on the footer, the sign-in screen and the functional approval sentence are kept below, unchanged.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const landing = codeOnly(read("client/src/pages/LandingPage.jsx"));
const deck = read("client/src/panels/DeckView.jsx");

test("46v · A's hero deals draft's OWN home card — the deck's frame and face, no second card", () => {
  assert.match(landing, /import \{ HomeCardStill, HomeCardBackStill, CardBackDefs, ActionButton \} from "\.\.\/panels\/DeckView\.jsx";/);
  assert.match(landing, /<HomeCardStill card=\{\{ job \}\}/, "a public job, as a card with no score and no band");
  // HomeCardStill is FanCard's home article (opaque glass, radius 26, SHADOW_GLASS) around the same HomeCardFace
  const still = deck.slice(at(deck, "export function HomeCardStill"), at(deck, "export function HomeCardBackStill"));
  assert.match(still, /<HomeCardFace card=\{card\}/);
  assert.match(still, /\.\.\.glass\(\{ radius: 26 \}\), backgroundColor: C\.SURFACE_SOLID/);
  assert.match(still, /boxShadow: C\.SHADOW_GLASS/);
  assert.ok(fs.readFileSync("client/src/modules.manifest.js", "utf8").includes('{ from: "pages/LandingPage.jsx", to: "panels/DeckView.jsx"'), "the composition is declared (A93)");
});

test("46v · no match text on the landing's card: a card with no score and no band has no match (cardFacts)", async () => {
  const { cardFacts } = await import("../client/src/lib/deckCardFacts.js");
  // cardFacts alone still falls back to a band word ("Not enough signal") — so the still card is BARE: no match corner.
  const f = cardFacts({ job: { id: 1, title: "Data Analyst", company: "Northwind", location: "Boston, MA" } });
  assert.ok(f.match, "cardFacts says a band word for a card with no score");
  const still = deck.slice(at(deck, "export function HomeCardStill"), at(deck, "export function HomeCardBackStill"));
  assert.match(still, /<HomeCardFace card=\{card\} bare /);
  assert.match(deck, /\{facts\.match && !bare && \(/, "a bare face draws no match");
  assert.doesNotMatch(landing, /score|band=|ATS match|résumé match/i, "the landing hands the card nothing to score");
});

test("46v · the deck deals every second, pauses on hover / focus / a hidden tab, and is still under reduced motion", () => {
  assert.match(landing, /export const DEAL_EVERY_MS = 1000;/);
  assert.match(landing, /if \(reduced \|\| paused \|\| n < 2\) return undefined;/);
  assert.match(landing, /setInterval\(\(\) => \{ if \(!document\.hidden\) next\(\); \}, DEAL_EVERY_MS\)/);
  assert.match(landing, /onMouseEnter=\{\(\) => setPaused\(true\)\}/);
  assert.match(landing, /onFocusCapture=\{\(\) => setPaused\(true\)\}/);
});

test("46v · the deck's own buttons — Draft says Draft (never '/dDraft'), as the site's deck does", () => {
  assert.match(landing, /<ActionButton label="Pass" onClick=\{next\} \/>/);
  assert.match(landing, /<ActionButton label="Draft" primary /);
  assert.doesNotMatch(landing, /\/d\s*Draft|DraftMark/, "the sketch's '/d Draft' must not be built");
  assert.match(deck, /export function ActionButton\(\{ label,/);
});

test("46v · the features are the Library's books on a shelf (B), not a grid", () => {
  assert.match(landing, /import \{ BookShelf, BookSpine \} from "\.\.\/components\/BookShelf\.jsx";/);
  assert.match(landing, /<BookShelf>[\s\S]*<BookSpine key=\{b\.id\}/);
  assert.match(read("client/src/pages/atlas/LibraryGuides.jsx"), /export \{ BookSpine, BookShelf, bookShape, spineFont \} from "\.\.\/\.\.\/components\/BookShelf\.jsx";/,
    "the Library and the landing draw the same book (A93)");
  assert.doesNotMatch(landing, /grid-template-columns|className="notes"|FindFitApply|UnifiedSearchBar/);
});

test("46v · C below: the statement, the figures — each one true against the code — and the promises", async () => {
  assert.match(landing, /<Facts items=\{FIGURES\} \/>/);
  assert.match(landing, /<Promises items=\{PROMISE_ITEMS\} \/>/);
  // 10 = the deck's size; 16 = the sources registered in the aggregator (a commented-out line is not a source)
  assert.match(read("services/dailyDraft.js"), /export const DECK_SIZE = 10;/);
  assert.match(landing, /export const PICKS_A_DAY = 10;/);
  const agg = read("services/jobs/aggregator.js");
  const from = at(agg, "const SOURCES = ["), list = agg.slice(from, at(agg, "];", from));
  const sources = list.split("\n").filter((l) => /^\s+\w+Plugin,?\s*$/.test(l)).length;
  assert.match(landing, new RegExp(`export const SOURCE_COUNT = ${sources};`), `the aggregator registers ${sources} sources`);
  // the promises say what the code does: Ask me first waits; a CAPTCHA / eligibility answer is never guessed; never trained on
  const privacy = read("client/src/pages/marketing/PrivacyPage.jsx").replace(/\s+/g, " ");
  assert.match(privacy, /never answers a CAPTCHA or other human check/);
  assert.match(privacy, /never guesses an eligibility answer/);
  assert.match(privacy, /<Strong>Ask me first<\/Strong> \(the default — draft fills the application and waits for you to approve/);
});

test("46v · every link on the landing is a page that exists today", () => {
  const app = read("client/src/App.jsx");
  const links = [...new Set([...landing.matchAll(/to(?:=|: )"(\/[^"]*)"/g)].map((m) => m[1]))];
  assert.ok(links.length >= 5, links.join(", "));
  for (const to of links) assert.ok(app.includes(`path="${to}"`) || (to === "/atlas" && app.includes('base="/atlas"')), `${to} is not a route`);
});

// ── kept from landingFindFitApply (queue 31 / audit item 7 / A220) ──────────────────────────────────────────────────

// ⛔ Owner, 10-01 (WORKLOG audit item 7): the promises are DITCHED as a selling point — on the login page and the footer.
// ⭐ 46v (owner 11-18, changed on purpose): the LANDING carries C's ✓ / ✕ list again — the owner picked it from the sketch.
const PROMISE = /nothing is (sent|submitted) (until you approve|without you)|not claim anything you did not|not inflate your years|read every draft before anything is sent|built the other way round/i;

test("⛔ no promise is sold as a pitch — login or footer", () => {
  for (const p of ["client/src/components/AuthScreen.jsx", "client/src/components/Footer.jsx"]) {
    assert.doesNotMatch(codeOnly(read(p)), PROMISE, `${p} sells a promise`);
  }
});

test("⭐ the approval sentence stays where it is FUNCTIONAL — the auto-apply flow and the deck's Draft toast", () => {
  assert.match(read("client/src/contexts/AutoApplyContext.jsx"), /nothing is sent until you approve each one/);
  assert.match(read("client/src/panels/AutoApplyPanel.jsx"), /Nothing is submitted until you approve/);
  assert.match(read("client/src/lib/jobDecisions.js"), /nothing is sent until you approve it/);
  assert.match(read("client/src/panels/DeckView.jsx"), /<DecisionToast toast=\{toast\} onUndo=\{undo\} undoKey="U" \/>/);
});

test("⛔ the recruiter side is not promised (46q A220, owner: cut)", () => {
  assert.doesNotMatch(landing, /Hiring\?|Soon\./, "no promise of the unbuilt recruiter side (owner 11-16)");
});

test("the footer no longer sells one product", () => {
  const footer = read("client/src/components/Footer.jsx");
  assert.doesNotMatch(footer, /AI-powered resumes/);
  assert.match(footer, /Find the job\. Fit the résumé\. Apply\./);
});
