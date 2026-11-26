// ⭐ D156 · HOME, REVISED (owner 11-05; the second pass (1b) wins where it differs). Measured in a real Chrome at 1440 (the
// landscape card), 1280 and 390 by `scripts/fidelityShots.mjs --styles home156`; the pure parts read the sources.
//   (1) / (1b) the card keeps a FIXED size and NOTHING scrolls inside it; Pass · Save · Draft never over it; the deck and
//       the list never overlap at any scroll; the deck flips by ‹ ›, the arrow keys, the wheel / a trackpad (one card per
//       gesture) and a swipe; no reason sentence.
//   (2) ≥ 1440 px: the card is landscape (600 × 372) with the stats on it; less page margin.
//   (3) / (1b) the dock: a slim rail of four 30 px icons (the house and the globe in the theme's accent, the short logo
//       /d, the picture or initials), expanding to the names on hover / focus and pushing the page.
//   (4) All jobs · Starred · Imported with counts, and Import a job inline (the existing import route).
//   (5) the sort is an icon in the search field, its menu For you · Best fit · Newest · Salary · Company.
//   (1b) the bubbles follow D1: only the hovered one grows (1.55), its neighbour gives the width, the row's height
//       constant, driven by the options rail opening 0 → 124 px over 0.42 s cubic-bezier(.3, .8, .25, 1).
//   ⭐ (1c) (wins over (1)–(3) and (1b)): the deck BEHAVES AS DeckView ALWAYS HAS — one flick one card (60 / 140 ms), J / K,
//       ↑ ↓, ‹ ›; swipe right drafts, left passes; the flip timings — only the card's content changed. The card BECOMES
//       THE LONG POST (scroll down on it, a press, Enter, "Open the posting"), drawn in the deck's slot; no separate posting
//       panel; a bubble's posting opens on the deck too; the folded card uses its space; the dock swapped (/d draft = the
//       jobs first, the house = Home, the dashboard and applications).
//   ⭐ (1d) the filtering sentence in its original font and style (7ebed68, before D147's restyle).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const DECK = read("client/src/panels/DeckView.jsx");
const NAV = read("client/src/components/AppNav.jsx");
const NAVCSS = read("client/src/components/AppNav.css");
const APP = read("client/src/App.jsx");
const BAR = read("client/src/components/BoardBar.jsx");
const BUBCSS = read("client/src/components/JobBubble.css");


// ── pure ──────────────────────────────────────────────────────────────────────────────────────────────────────────
test("d156LandscapeCardAt1440WithStats (pure): 600 × 372 at ≥ 1440, the 640 column; 300 × 420 and 250 × 350 below", async () => {
  const { homeCardSize, homeDeckColumn, homeLandscape, HOME_WIDE, HOME_FAN_WIDE } = await import("../client/src/lib/fanGeometry.js");
  assert.deepEqual(homeCardSize(1440), { width: 600, height: 372 });
  assert.deepEqual(homeCardSize(1920), { width: 600, height: 372 });
  assert.deepEqual(homeCardSize(1439), { width: 300, height: 420 });
  assert.deepEqual(homeCardSize(390), { width: 250, height: 350 }, "the phone: the screen less the rail and gutters (80), less the fan's 60");
  assert.equal(homeLandscape(1440), true); assert.equal(homeLandscape(1280), false);
  assert.equal(homeDeckColumn(1440), HOME_WIDE.column); assert.equal(homeDeckColumn(1280), 390);
  // the second back (6°) stays inside the column and above the buttons
  const r = (2 * HOME_FAN_WIDE.spread * Math.PI) / 180;
  assert.ok(HOME_WIDE.width * Math.cos(r) + HOME_WIDE.height * Math.sin(r) - HOME_WIDE.width <= HOME_WIDE.column - HOME_WIDE.width);
  assert.ok(HOME_WIDE.width * Math.sin(r) < HOME_WIDE.below);
  const css = read("client/src/components/FullHouse.css");
  // ⭐ D163 changed these on purpose (owner 11-05, "use the space"): from 1440 the deck's column is AT LEAST 640 (the
  // landscape card and its fan) and takes a share of a wide screen, the deck centred in it; the page's gutters and the gap
  // between the columns grow with the screen (24 → 96, 32 → 64) and the content is 1680 wide at most
  // (test/d163UseTheSpace.test.js). At 1280 the gutters are still D156 (2)'s 24.
  // 47j R2 (changed on purpose): the classic grid (`.home`, its tracks and gutters) is deleted; the deck's section keeps its
  // 640 at ≥ 1440 (the plate market's section still wears .home__deck)
  assert.match(css, /@media \(min-width: 1440px\) \{ \.home__deck \{ width: auto; min-width: 640px; \} \}/);
  assert.doesNotMatch(css, /(^|\n)\.home \{|:root \.home \{|\.home \{ --home-deck-track/, "the classic grid is back");
});

test("d156NoReasonSentence (pure): the card's facts carry at most four small stats, skills matched first; no reason line", async () => {
  const { cardFacts, HOME_STATS_MAX } = await import("../client/src/lib/deckCardFacts.js");
  const f = cardFacts({ job: { id: "x", description: "5+ years of Python", tagLevel: "senior", postedAt: new Date(Date.now() - 9 * 3600e3).toISOString(),
    sponsorship: { level: "often" } }, score: 66, why: { matchedTotal: 13, missingTotal: 2 },
    bestBet: { reasons: ["you're eligible", "7 of 7 must-haves"] } });
  assert.equal(HOME_STATS_MAX, 4);
  assert.equal(f.reason, undefined, "the reason sentence is gone");
  assert.deepEqual(f.homeStats.map(s => s.key), ["skills", "experience", "level", "posted"], "known ones only, at most four");
  assert.deepEqual(f.homeStats[0], { key: "skills", value: "13 of 15", label: "skills matched" });
  assert.equal(f.homeStats[3].label, "since posted");
  assert.deepEqual(cardFacts({ job: { id: "y" } }).homeStats, [], "nothing known → no stats, never a 'not stated'");
  assert.doesNotMatch(DECK, /data-deck-reason|facts\.reason/);
});

test("d156DeckBehaviourAsDeckView (pure): one flick one card, the flip timings, swipe right drafts / left passes, the keys", () => {
  // ⛔ (1b)'s per-gesture flip, its arrow-key flip and its swipe-flips are gone (owner 11-05 (1c): "retain how the cards
  // flipped and how they behaved … from the previous version of the daily deck").
  assert.doesNotMatch(DECK, /WHEEL_GESTURE_GAP_MS|WHEEL_FLIP_COOLDOWN_MS|onHomeWheel|onFlip\?\.\(info/);
  // ⭐ D178-3 (changed on purpose): the gesture is ONE copy, lib/deckWheel.js, shared with Atlas's lesson deck — same numbers, same rule.
  const WHEEL = fs.readFileSync("client/src/lib/deckWheel.js", "utf8");
  assert.match(WHEEL, /export const WHEEL_STEP = 60; /); assert.match(WHEEL, /export const WHEEL_SETTLE_MS = 140; /);
  assert.match(DECK, /const onWheel = deckWheelHandler\(\{/);
  assert.match(WHEEL, /if \(Math\.abs\(acc\) >= WHEEL_STEP\) \{ acc = 0; settleUntil = t \+ WHEEL_SETTLE_MS; step\(dir\); \}/);
  assert.match(DECK, /const FLIP_EASE = "cubic-bezier\(0\.34, 1\.32, 0\.5, 1\)";/);
  assert.match(DECK, /transition: reduced \? "none" : `transform 520ms \$\{FLIP_EASE\} 40ms`/);
  assert.match(DECK, /const POSITION_EASE = "cubic-bezier\(0\.22, 1, 0\.36, 1\)";/);
  assert.match(DECK, /transform 460ms \$\{POSITION_EASE\}/);
  assert.match(DECK, /const SWIPE_COMMIT_PX = 80;/);
  assert.match(DECK, /if \(info\.offset\.x > SWIPE_COMMIT_PX\) onDecide\(DECISIONS\.DRAFTED\);\n\s+else if \(info\.offset\.x < -SWIPE_COMMIT_PX\) onDecide\(DECISIONS\.PASSED\);/);
  assert.match(DECK, /\{isFront && <motion\.div aria-hidden data-deck-stamp="draft"/, "the stamps are back on Home's card");
  assert.match(DECK, /if \(k === "d" \|\| k === "D" \|\| k === "ArrowRight"\) \{ e\.preventDefault\(\); decide\(DECISIONS\.DRAFTED\); \}/);
  // 47j R2 (changed on purpose): the classic count row's ‹ › and action row are deleted — the plate position row's squares
  // (PlatePosRow) and the ticket's own Pass (TicketActions) carry the same step and the same keys
  assert.match(DECK, /<FlipButton dir=\{-1\} disabled=\{!prev\} onFlip=\{onFlip\}/);
  assert.match(DECK, /<PlatePosRow [^>]*onFlip=\{step\} \/>/);
  assert.match(DECK, /aria-keyshortcuts=\{dir > 0 \? "J ArrowDown" : "K ArrowUp"\}/);
  assert.match(read("client/src/plate/MarketCardFace.jsx"), /data-deck-action="pass" aria-keyshortcuts="X ArrowLeft"/);
  assert.doesNotMatch(DECK, /<ActionButton label="Pass" ariaKeys="X ArrowLeft"/, "the classic action row is back on the market");
});

test("d156CardExpandsIntoLongPost / d156NoSeparatePostingPanel / d156ListPostingOpensOnDeck (pure)", () => {
  const url = read("client/src/lib/jobUrl.js");
  for (const e of ["OPEN_POSTING_EVENT", "CLOSE_POSTING_EVENT", "POSTING_ON_DECK_EVENT", "DECK_DECIDE_EVENT", "DECK_POST_SLOT_ID"]) assert.match(url, new RegExp(`export const ${e} = `));
  // the deck: a press, Enter, "Open the posting" open it (⭐ D168, changed on purpose: never the wheel — test/d168OneWayToOpen)
  assert.doesNotMatch(DECK, /FOLD_SETTLE_MS|onPostWheel/, "D168: no scroll-down-opens, no scroll-up-folds");
  assert.match(DECK, /if \(home\) onOpenPost\?\.\(\); else onWhy\?\.\(true\);/);
  assert.match(DECK, /if \(home\) openPost\(\); else setWhy\(v => !v\);/);
  assert.match(DECK, /<div id=\{DECK_POST_SLOT_ID\} ref=\{slotRef\} data-deck-post-slot=""/);
  // ⭐ D168: at the swap (showPost), after the fade-out — not the moment the board asks.
  assert.match(DECK, /<div data-deck-content="" style=\{home && showPost \? \{ display: "none" \} : undefined\}>/, "the fan steps aside while the post is open");
  const fh = read("client/src/components/FullHouse.css");
  assert.match(fh, /\.home__deck:has\(\[data-deck-reading="true"\]\) \{ position: relative; top: auto; \}/, "not sticky while reading");
  // the board: the posting is portalled onto the deck; the in-place posting beside the list is gone
  const jp = read("client/src/panels/JobsPanel.jsx");
  // ⭐ D168 (changed on purpose): the posting drawn is deckPostJob — the beside-mode selection, held a fade longer as it goes.
  assert.match(jp, /const deckPostTarget = besideMode \? selectedJob : null;/);
  assert.match(jp, /\{deckPostJob && deckSlot && createPortal\(\n\s+<JobDetailPanel key="panel-jd" slot=\{0\} fullScreen=\{false\} beside onDeck job=\{deckPostJob\}/);
  assert.doesNotMatch(jp, /post=\{besideMode/);
  assert.doesNotMatch(read("client/src/components/JobBubble.jsx"), /data-board-post|jb-board__post/);
  assert.doesNotMatch(fh, /\[data-board-post\]/);
  // a deck card's Pass · Save · Draft are the deck's; any posting then folds, the day's card returns
  assert.match(jp, /if \(postOriginRef\.current === "deck"\) \{\n\s+window\.dispatchEvent\(new CustomEvent\(DECK_DECIDE_EVENT/);
  assert.match(jp, /const handleJobSelect = useCallback\(\(job\) => \{\n\s+clearDeepLink\(\);[^\n]*\n\s+setPostOrigin\("board"\);/);
});

test("d156FoldedCardFillsSpace (pure): the title centred, the stats 2 × 2 (larger 22 px cells on the landscape card)", () => {
  const face = DECK.slice(at(DECK, "function HomeCardFace("), at(DECK, "// The expanded card's type"));
  assert.match(face, /margin: "auto 0", outline: "none"/, "the title centred in its column");
  assert.match(face, /gridTemplateColumns: "1fr 1fr", gap: 8/);
  assert.match(face, /fontSize: ts\(landscape \? 22 : small \? 15 : 17\)/);
  assert.match(face, /data-deck-open-posting="" [^>]*\n\s+onClick=\{\(e\) => \{ e\.stopPropagation\(\); onOpenPost\?\.\(\); \}\}/);
  // D179 (45l; brought to the code in 45o): the company NAME is a link to its page (66fe3b1); Open the posting still turns the card.
  assert.doesNotMatch(face.replace(/<Link to=\{companyPath\(job\.company\)\}/g, ""), /<Link /, "Open the posting turns the card, it does not navigate");
});

test("d156FilterSentenceOriginalStyle (pure): the marked look and the sentence type restored from 7ebed68", () => {
  const fh = read("client/src/components/FullHouse.css");
  const marked = fh.slice(at(fh, '[data-sentence="marked"] {'), at(fh, "}", at(fh, '[data-sentence="marked"] {')));
  assert.match(marked, /--tok-pad: 0 \.08em; --tok-margin: 0; --tok-edge: transparent; --tok-fill: transparent; --tok-radius: 2px;\n  --tok-depth: inset 0 -\.16em 0 var\(--c-accent-quiet\);\n  --tok-hover-fill: var\(--c-accent-quiet\); --tok-hover-edge: transparent; --tok-hover-depth: inset 0 -\.16em 0 var\(--c-accent-ink\);\n  --tok-on-pad: 0 \.3em; --tok-on-margin: 0 \.04em;/);
  assert.doesNotMatch(marked, /--tok-on-fill|--tok-border-w/, "a set filter is the orange box again");
  assert.doesNotMatch(fh, /--fh-sentence-family: var\(--font-display\)/, "D147's serif sentence withdrawn");
  // ⛔ 47j w1-market (changed on purpose): `.fh[data-fh-d147]` is deleted with the classic header (the market's is the plate cartouche)
  assert.doesNotMatch(fh, /\.fh\[data-fh-d147\]\s*\{/);
  const type = read("client/src/styles/type.js");
  assert.match(type, /SENTENCE_FAMILY: LOGO_FACE\.family,\n  SENTENCE_SIZE: `min\(\$\{MARK_SIZES\.nav\}px, 6\.4vw\)`,\n  SENTENCE_LINE: "1\.5",\n  SENTENCE_WEIGHT: LOGO_FACE\.weight,\n  SENTENCE_STYLE: LOGO_FACE\.style,/);
});

test("d156DockIconsSameSizeThemeAccent → D197 #1 / d156ShortLogoInDock (pure): the plate's line icons, one size; /d; the picture", () => {
  // ⭐ D197 #1 (the Shell board, changed on purpose): the dock is the plate's Dock — every place's line icon at one size
  // (20 px on the rail, 19 on the phone's bar) stroked in the current text colour, the plate's ink (plate/icons.jsx)
  const SHELL = read("client/src/plate/Shell.jsx");
  assert.match(SHELL, /<DockIcon item=\{it\} size=\{bar \? 19 : 20\}\/>/);
  assert.match(read("client/src/plate/icons.jsx"), /Stroke is the current text colour/);
  // ⭐ (1c): swapped — the jobs page is "/d · draft", the tracker is the house, "Home".
  // ⭐ D167 (owner 11-06, changed on purpose): + Interview (the microphone); the jobs' icon is the drawing-out wordmark (<DraftMark drawOut />); names only.
  // D180 P1 (45o, on purpose): + network (drawn only while the network switch is on).
  // 46f (on purpose): + Feed and Messages' icons, their own places under the network switch.
  assert.match(NAV, /const DOCK_ICON = Object\.freeze\(\{ "auto-apply" : "home", atlas: "atlas", interview: "interview", network: "network", feed: "feed", messages: "messages" \}\);/);
  // the /d mark: the plate's PlateLogo tile on the rail, the short mark on the phone's bar (D197 #1, changed on purpose — was <DraftMark drawOut logo />)
  assert.match(SHELL, /<PlateLogo\/><\/a>/);
  // D180 P1 (45o, on purpose): + network. 46f (on purpose): + feed, messages.
  assert.match(NAV, /export const DOCK_NAMES = Object\.freeze\(\{ today: "draft", "auto-apply" ?: "Home", atlas: "Atlas", interview: "Interview", network: "Network", feed: "Feed", messages: "Messages" \}\);/, "slash for short, draft for long — the jobs");
  assert.match(NAV, /\.\.\.\(avatarUrl \? \{ img: avatarUrl \} : \{ initials: initialsOf\(profile\.name\) \}\),/);
  assert.doesNotMatch(NAV, /appnav-emboss|appnav-handle|DOCK_REVEAL_PX/, "D152 (4)'s embossed logo, edge handle and edge reveal are gone");
});

// ⭐ D167 (owner 11-06, changed on purpose) — "the dock goes where the space is" supersedes D156 (3)'s push: the dock never pads the page sideways; a
// side dock sits in a margin measured to fit it open, otherwise it goes to the top (test/d167Dock).
test("d156DockPushesPage → D167 → D197 #1 (pure): the dock never pushes the page", () => {
  // ⭐ D197 #1 · A237: the shell keeps the rail's column (98 px) always — opening or hovering never changes it
  assert.doesNotMatch(NAVCSS, /--appnav-rail-w|padding-left: var\(--appnav/);
  // ⭐ owner 11-15: Tiny replaces Ask draft, floating (changed on purpose) — nothing moves the page now, not even Ask draft
  assert.doesNotMatch(NAVCSS, /\[data-app-shell\] \{ transition: padding-right/, "nothing moves the page (Tiny floats over it)");
  assert.doesNotMatch(read("client/src/components/FullHouse.css"), /data-dock-open/, "Home has no dock rule of its own");
});

test("d156StarredImportedViews / d156ImportAJobInline / d156SortIconInSearch (pure)", () => {
  // 47j R2 (changed on purpose): the views are the area nav's (MARKET_AREA_VIEWS) — Today's picks + the same three
  const tabs = APP.slice(at(APP, "const MARKET_AREA_VIEWS = ["), at(APP, "];", at(APP, "const MARKET_AREA_VIEWS = [")));
  assert.deepEqual([...tabs.matchAll(/id: "(\w+)", label: "([^"]+)"/g)].map(m => [m[1], m[2]]), [["picks", "Today’s picks"], ["all", "All jobs"], ["saved", "Starred"], ["imported", "Imported"]],
    "no Drafted / Pending view, no Companies tab (A157, 45q, owner 11-09)");
  assert.match(APP, /<BoardViews onImported=\{\(\) => setJobBoardRefreshKey\(k => k \+ 1\)\} \/>/);
  assert.match(APP, /onImported=\{\(\) => \{ setBoardTab\?\.\("imported"\); onImported\?\.\(\); \}\}/);
  assert.match(BAR, /await api\("\/api\/import\/job", \{ method: "POST", body: JSON\.stringify\(isLink \? \{ url: v \} : \{ text: v \}\) \}\)/,
    "the existing import route, not a second import");
  // 47j R2 (changed on purpose): the sort sits beside the search in the cartouche's row (the classic in-field icon is deleted)
  assert.match(APP, /<MarketSearchRow search=\{<BoardSearchBar [\s\S]{0,160}?\/>\}\s*sort=\{<MarketSortSlot \/>\} \/>/, "the sort beside the search");
  assert.match(APP, /more=\{\[\{ id: "import", label: "Import a job"/, "Import a job reachable from the area nav");
  assert.doesNotMatch(APP, /BoardTitleRow|fh-title/, "no Sort button at the top");
});

// 47j R2 (changed on purpose): D1's bubble PAIR (.jb-pair, hovered 1.55) is deleted with the classic market's rows.
test("d156BubbleD1Growth → 47j R2 (pure): the bubble pair is deleted with the classic market", () => {
  assert.doesNotMatch(BUBCSS.replace(/\/\*[\s\S]*?\*\//g, ""), /\.jb-pair\b/, "the classic bubble pair's rules are back");
});

// ── real Chrome ───────────────────────────────────────────────────────────────────────────────────────────────────
// ⛔ 47j R2: the real-Chrome half (probe `home156`, the classic market) is retired with it — its carry-overs are measured on the
// plate market by d196MarketLiveBehaviour (probe `plate156`).
