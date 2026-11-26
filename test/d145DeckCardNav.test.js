// ⭐ D145 STEP 3 · THE DECK CARD AND NAVIGATION (owner 11-03, declutter-v7 — docs/sketches/declutter-v7.html). The twelve tests the D145 row names. What the card SAYS is one pure function
// (client/src/lib/deckCardFacts.js), tested on cards; where it is DRAWN is DeckView.jsx, pinned at the source. The real
// Chrome walk of the same rules, at 1280 and 390 in four themes, is scripts/d145DeckShots.mjs (90 checks, 11-03).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const { cardFacts, sincePosted, jobTypeOf } = await import("../client/src/lib/deckCardFacts.js");
const { TEXT_SCALE, ts, TYPE_SCALE_VAR } = await import("../client/src/themes/shapes.js");
const { LAYOUT_OPTION_IDS } = await import("../shared/appearance.js");
const deck = read("client/src/panels/DeckView.jsx");
const face = deck.slice(at(deck, "function CardFace("), at(deck, "// ── one card in the fan"));
const nav = read("client/src/components/AppNav.jsx");
const navCss = read("client/src/components/AppNav.css");

const NOW = Date.parse("2026-11-03T12:00:00Z");
const CARD = {
  band: "strong", score: 86.4,
  why: { matched: ["Python", "SQL", "Spark", "AWS"], missing: ["Kafka", "Airflow"], matchedTotal: 13, missingTotal: 2 },
  report: { depthHeadline: "Your résumé shows the stack; Kafka is the gap." },
  job: { id: "j1", company: "Northwind", location: "Boston, MA", title: "Senior Data Engineer", salaryMin: 165000, salaryMax: 190000,
         contractType: "FULL_TIME", workplaceType: "hybrid", postedAt: "2026-11-03T03:00:00Z", tagLevel: "senior",
         description: "We need 5+ years of experience in data engineering.", isActive: true,
         eligibility: { status: "eligible" }, sponsorship: { level: "often", line: "about 140 visa filings last year" } },
};

// 47j R2 (changed on purpose): D196 FIX-4 put Pass · Save · Send · Draft IN the board's ticket (TicketActions) and R2 deleted
// the classic row under the card; the D145 rule that holds is "no key hints on the buttons". ActionButton stays (the landing).
test("d145DeckButtonsOutsideCard → FIX-4 / 47j R2: Pass · Save · Draft are the ticket's own row, with no key hints", () => {
  assert.doesNotMatch(face, /<ActionButton/, "an action button inside the card face");
  assert.doesNotMatch(deck, /<div data-deck-actions style=/, "the classic row under the card is back");
  const tf = fs.readFileSync("client/src/plate/MarketCardFace.jsx", "utf8").replace(/\r\n/g, "\n");
  const actions = tf.slice(at(tf, "export function TicketActions("), at(tf, "\n}\n", at(tf, "export function TicketActions(")));
  for (const l of ["pass", "save", "draft"]) assert.match(actions, new RegExp(`data-deck-action="${l}"`));
  assert.doesNotMatch(actions, /hint=|<kbd/, "a key hint on a button (D145: none)");
  // D149: the ‹ › step buttons went with the controls row; ActionButton runs to the next function.
  const btn = deck.slice(at(deck, "function ActionButton("), at(deck, "\nfunction ", at(deck, "function ActionButton(") + 10));
  assert.doesNotMatch(btn, /kbd/, "the button draws a key hint");
  assert.match(btn, /background: hov \? C\.ACCENT_HOVER : C\.ACCENT/, "Draft in the accent");
  assert.match(btn, /background: C\.SURFACE_2, color: C\.INK/, "Pass and Save raised neutral");
});

test("d145MatchTopRightNoAts: the match is the header's right-hand side — a number when the card has one, else the band's word; never ATS", () => {
  const f = cardFacts(CARD, NOW);
  assert.deepEqual(f.match, { value: "86%", word: "résumé match", numeric: true });
  const banded = cardFacts({ ...CARD, score: undefined }, NOW);
  assert.deepEqual(banded.match, { value: "Strong", word: "résumé match", numeric: false }, "G5: no number unless the server sent one");
  const head = face.slice(at(face, '<div data-deck-head=""'), at(face, "<h2 id={titleId}"));
  assert.match(head, /justifyContent: "space-between"/);
  assert.ok(head.indexOf("<CompanyLogo") < head.indexOf("data-deck-signal-row"), "the match comes after the company, at the right");
  assert.doesNotMatch(face.replace(/\/\/[^\n]*|\{\/\*[\s\S]*?\*\/\}/g, ""), /\bATS\b/, "the card face says ATS");
  assert.doesNotMatch(JSON.stringify(f), /\bATS\b/);
});

test("d145InfoRowSalaryTypeMode: one info row — salary · job type · work mode, each a value over a grey label, only those on file", () => {
  const f = cardFacts(CARD, NOW);
  // 45n D182 (bb297b05, owner 11-08 decision (8)): values only — each value says what it is, the grey labels were
  // removed as restating the screen (pin moved on purpose).
  assert.deepEqual(f.info, [
    { key: "salary", value: "$165k–$190k" },
    { key: "type", value: "Full-time" },
    { key: "mode", value: "Hybrid" },
  ]);
  assert.deepEqual(cardFacts({ ...CARD, job: { ...CARD.job, salaryMin: null, salaryMax: null, contractType: null } }, NOW).info.map(i => i.key), ["mode"]);
  assert.equal(jobTypeOf({ postingFields: { employment: "Contract to hire" } }), "Contract");
  assert.match(face, /<div data-deck-info=""/);
  assert.match(face, /facts\.info\.map\(\(f\) => \(/);
});

test("d145NoPostedBesideLocation: the header says the location only — the time since posted is a stat", () => {
  assert.match(face, /\{job\.location && <div data-deck-location=""[^>]*>\{job\.location\}<\/div>\}/);
  assert.doesNotMatch(face, /ago\(job\)|meta\.join/, "the old meta line (location · mode · salary · ago) is back");
  assert.doesNotMatch(deck, /function ago\(/, "the old 'ago' helper survives unused");
  const f = cardFacts(CARD, NOW);
  assert.deepEqual(f.stats.find(s => s.key === "posted"), { key: "posted", value: "9 hours", line: "since it was posted" });
  assert.equal(sincePosted({ postedAt: "2026-10-20T12:00:00Z" }, NOW), "14 days");
  assert.equal(sincePosted({ postedAt: "2026-09-15T12:00:00Z" }, NOW), "7 weeks");
});

test("d145ExpandedUsesSequenceType: 'Why this job' is version A's type — eyebrow 14, headline 46 / 500 / −0.035 em (36 on phones), lead 19, stats 34, two per row", () => {
  const why = deck.slice(at(deck, "const WHY = {"), at(deck, "};", at(deck, "const WHY = {")));
  assert.match(why, /eyebrow: \{ color: C\.ACCENT_INK, fontSize: ts\(14\)/);
  assert.match(why, /headline: \{ fontWeight: 500, lineHeight: 1\.03, letterSpacing: "-0\.035em"/);
  assert.match(face, /fontSize: vertical \? ts\(36\) : ts\(46\)/);
  assert.match(face, /fontSize: vertical \? ts\(17\) : ts\(19\)/);
  assert.match(face, /gridTemplateColumns: "1fr 1fr"/, "two stat cards per row");
  assert.match(face, /fontSize: ts\(34\), fontWeight: 500, color: C\.ACCENT_INK/);
  assert.match(face, />Your résumé against this job</); assert.match(face, />From the posting</);
  const f = cardFacts(CARD, NOW);
  assert.equal(f.why.headline, "13 of 15 skills");
  assert.deepEqual(f.stats.map(s => s.key), ["experience", "level", "posted", "sponsorship"]);
  assert.equal(f.stats[0].value, "5+ years");
  assert.match(face, /data-deck-full-posting=""/, "the full posting stays one press away");
});

test("d145NothingSaidTwice: salary / type / mode only on the folded card, 'posted' only in the stats, a hover fact never a stat", () => {
  const f = cardFacts(CARD, NOW);
  const said = [...f.info.map(i => i.value), ...f.chips, ...f.stats.map(s => s.value), f.match.value, f.why.headline];
  assert.equal(new Set(said).size, said.length, `a fact said twice: ${said.join(" | ")}`);
  const statWords = f.stats.map(s => `${s.value} ${s.line}`).join(" ").toLowerCase();
  for (const c of f.chips) assert.ok(!statWords.includes(c.toLowerCase()), `the hover fact "${c}" repeats a stat`);
  for (const i of f.info) assert.ok(!statWords.includes(String(i.value).toLowerCase()), `the info row's ${i.key} repeats in the stats`);
  assert.ok(f.chips.length <= 2, "at most two hover facts");
  assert.deepEqual(f.chips, ["You're eligible", "Still open"]);
  assert.deepEqual(cardFacts({ ...CARD, job: { ...CARD.job, ghost: { level: 2 }, eligibility: null } }, NOW).chips, [], "no 'Still open' on a likely-not-hiring posting");
  // The card no longer draws the old coloured labels: the band mark, the ring, the green chips.
  assert.doesNotMatch(face, /bandMarkStyle|conic-gradient|markStyle\(C\.SUCCESS\)/);
});

// ⭐ D168 (owner 11-06, concept B — changed on purpose): the wheel NO LONGER opens or folds "Why this job" (nor the long
// post): over the deck it only turns it. The press, Enter and the "Why this job" button open it; a card change folds it.
test("d145ScrollExpandsAndFolds → D168: the wheel never opens or folds 'Why this job'; the press, Enter and the button do", () => {
  // ⭐ D178-3 (changed on purpose): the gesture is lib/deckWheel.js's handler; the deck passes it what a turn may do.
  const wheelAt = at(deck, "const onWheel = deckWheelHandler({");
  const wheel = deck.slice(wheelAt, at(deck, 'el.addEventListener("wheel", onWheel', wheelAt));
  assert.doesNotMatch(wheel, /setWhy|openPost|foldPost|onFront/, "the wheel has one job: turning the deck");
  // The keyboard and the press do the same; a card change folds it.
  // ⭐ D156 (1c) (changed on purpose): on Home Enter opens the card into its long post; elsewhere "Why this job".
  assert.match(deck, /k === "Enter" && tag !== "button" && tag !== "a"\) \{ e\.preventDefault\(\); if \(home\) openPost\(\); else setWhy\(v => !v\); \}/);
  assert.match(deck, /useEffect\(\(\) => \{ setExpanded\(false\); setWhy\(false\); \}, \[s\.index\]\);/);
  assert.match(face, /data-deck-why-button="" aria-expanded=\{!!why\}/);
});

// ⛔ 45n D145 / D152 decision (10) (ffd57262, owner 11-08): the side MENU is RETIRED — the dock (D167) is the one
// navigation. The Automatic · Dock · Menu option and its data-navigation switch are gone; these two tests now guard that
// the retirement holds and the dock stays the navigation everywhere (pins moved on purpose).
test("d145NavDockOrMenuSetting → 45n: no Navigation option; the dock is the one navigation at every width", () => {
  assert.equal(LAYOUT_OPTION_IDS.navigation, undefined, "the Navigation option is retired");
  assert.doesNotMatch(navCss.replace(/\/\*[\s\S]*?\*\//g, ""), /\[data-navigation=/, "a style still switches on data-navigation");
  assert.match(navCss, /:root \{ --appnav-dock: flex; --appnav-mark: none; \}/, "the dock, everywhere");
  assert.match(navCss, /\.appnav-dock \{\s*display: var\(--appnav-dock, flex\);/);
  // ⭐ D156 (3): an always-visible rail of icons at the left edge that expands on hover / focus — no edge reveal, no handle.
  assert.doesNotMatch(nav, /DOCK_REVEAL_PX|appnav-handle/);
  // ⭐ D197 #1 (changed on purpose): the plate rail shows its names always (the Shell board) — hovering never widens it;
  // the rail holds `wide` while the keyboard is in it (data-open / <html data-dock-open>).
  assert.doesNotMatch(nav, /onMouseEnter=\{canHover \? \(\) => setWide\(true\) : undefined\}/);
  assert.match(nav, /onFocus: \(\) => setWide\(true\),/);
  // The old tab row is gone from the top bar.
  const top = read("client/src/components/TopBar.jsx");
  assert.doesNotMatch(top, /className="tbar-tab"|className="tbar-nav"/);
  assert.match(top, /<AppNav tabs=\{tabs\} activeTab=\{activeTab\} hrefForTab=\{hrefForTab\} onTabChange=\{onTabChange\}\s+profile=/);   // D149: + the Profile entry
});

test("d145MenuPanelMatchesDock → 45n: the Menu's panel is gone; the dock draws the one list; Esc and M work the dock", () => {
  // ⭐ D197 #1 (changed on purpose): the one list is the plate's Dock (NavItems went with the 60 px rail)
  const items = [...nav.matchAll(/<Dock home=\{home\} items=\{items\}/g)];
  assert.equal(items.length, 1, "only the dock renders the places (the Menu's panel is retired)");
  assert.doesNotMatch(nav, /className="appnav-menu-btn"|className="appnav-scrim"/, "the Menu button / scrim came back");
  assert.match(nav, /if \(e\.key === "Escape"\) \{ if \(dockRef\.current\?\.contains\(document\.activeElement\)\) document\.activeElement\.blur\?\.\(\); setWide\(false\); return; \}/);
  assert.match(nav, /\(e\.key === "m" \|\| e\.key === "M"\)/);
  // ⭐ D197 #1 (changed on purpose): the names are always shown, so M takes the keyboard into the dock and back out
  assert.match(nav, /\(dock\.querySelector\('\[aria-current="page"\]'\) \|\| dock\.querySelector\("a,button"\)\)\?\.focus\(\{ preventScroll: true \}\);/, "M → the dock");
  // ⭐ D167 (owner 11-06, changed on purpose): names only — no plain line under a name.
  assert.doesNotMatch(nav, /NAV_PLAIN|today's picks and every job/);
  // ⭐ owner 11-15: Tiny replaces Ask draft, floating (changed on purpose) — no Ask item in the dock; ONE fox bubble instead.
  // ⭐ D197 #1 (changed on purpose): the Shell board draws Ask draft after the rail's rule — it opens the same Tiny
  assert.equal((nav.match(/<AskItem /g) || []).length, 0);
  assert.match(nav, /const ask = bar \? null : \{ onPress: pressAsk,/);
  assert.equal((nav.match(/<TinyBubble /g) || []).length, 1, "Tiny, the floating bubble");
});

// ⭐ D156 (3) changed this on purpose (owner 11-05: "use symbols for the menu dock: a home, a globe like atlas icon, draft
// icon … profile pic for the profile"): the DOCK is icons; the Menu's side panel stays words.
test("d145NoNavSymbols → d156: icons only in the Dock (house · /d · globe · picture); the Menu stays words", () => {
  // ⭐ D197 #1 (changed on purpose): the plate's Dock draws each place's line icon (plate/icons.jsx), the /d tile for the
  // jobs, the picture (or initials) for Profile; no symbol glyph in the items
  const shell = read("client/src/plate/Shell.jsx");
  const items = shell.slice(at(shell, "function DockIcon("), at(shell, "const plainClick ="));
  assert.match(items, /if \(item\.img\) return <img className="pl-avatar pl-avatar--img"/);
  assert.match(items, /if \(item\.initials\) return <span className="pl-avatar" aria-hidden="true">\{item\.initials\}<\/span>;/);
  assert.match(items, /return <Icon name=\{item\.icon\} size=\{size\}\/>;/);
  assert.match(shell, /<PlateLogo\/><\/a>/, "the /d tile");
  assert.doesNotMatch(items, /[☰≡★⏳✦→←↑↓]/u);
  // 45n D145 / D152 decision (10) (ffd57262): the Menu button is retired, so there is no word button to check (pin moved on purpose).
  assert.doesNotMatch(nav, /className="appnav-menu-btn"/, "the Menu button came back");
});

test("d145TextSizeScalesAll: Smaller · Default · Larger · Largest — one --type-scale the type tokens, the root and the redesigned screens multiply", () => {
  assert.deepEqual(LAYOUT_OPTION_IDS.text, { attribute: "data-text-size", values: ["smaller", "default", "larger", "largest"], default: "default" });
  assert.deepEqual({ ...TEXT_SCALE }, { smaller: 0.9, default: 1, larger: 1.12, largest: 1.25 });
  assert.equal(ts(46), `calc(46px * var(${TYPE_SCALE_VAR}, 1))`);
  const css = read("client/src/index.css");
  for (const [k, v] of Object.entries(TEXT_SCALE)) assert.match(css, new RegExp(`\\[data-text-size="${k}"\\]\\s*\\{ --type-scale: ${v}; \\}`));
  assert.match(css, /html \{ font-size: calc\(100% \* var\(--type-scale, 1\)\); \}/, "rem sizes follow it");
  const type = read("client/src/styles/type.js");
  for (const k of ["SECTION_TITLE", "CARD_TITLE", "EYEBROW", "LEAD"]) assert.match(type, new RegExp(`${k}: \\{[^}]*fontSize: ts\\(\\d+\\)`), `TYPE.${k} scales`);
  // The redesigned card writes every size through ts() — no bare px font size is left on it.
  assert.doesNotMatch(face.replace(/card\.error[\s\S]*?\)\}/, ""), /fontSize: \d/, "a font size on the card that does not scale");
  assert.match(navCss, /font-size: calc\(13px \* var\(--type-scale, 1\)\)/);
});

test("d145LargestNoClip390: on Largest at 390 px nothing forces a horizontal scroll — the walk measured it; the rules that make it so", () => {
  // Measured 11-03 by scripts/d145DeckShots.mjs: 390 × 844 on Largest, Menu and Dock, Dusk Dark and Charcoal Dark —
  // scrollWidth ≤ innerWidth with the card folded and with "Why this job" open.
  const shots = read("scripts/d145DeckShots.mjs");
  assert.match(shots, /\[390, 844, "dusk-dark", "menu", "largest"\]/);
  assert.match(shots, /\[390, 844, "charcoal-dark", "dock", "largest"\]/);
  assert.match(shots, /check\(where, "no horizontal scroll with \\"Why this job\\" open", o2 <= 0/);
  assert.match(face, /flexWrap: "wrap"/, "the info row wraps");
  assert.match(face, /overflowWrap: "anywhere"/, "a long stat value breaks rather than push the card wider");
  assert.match(face, /<div style=\{\{ minWidth: 0 \}\}>/, "the company block can shrink beside the match");
  // ⭐ D152 (4), changed on purpose: the dock is a 212 px left column — never wider than a 390 screen.
  assert.match(navCss, /\.appnav-dock \{[^}]*width: 212px;/);
  assert.match(navCss, /\.appnav-panel \{[^}]*width: min\(300px, 86vw\);/);
});
