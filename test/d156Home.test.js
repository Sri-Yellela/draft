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
//   ⭐ (1d) the filtering sentence in its original font and style (67be9da, before D147's restyle).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const DECK = read("client/src/panels/DeckView.jsx");
const NAV = read("client/src/components/AppNav.jsx");
const NAVCSS = read("client/src/components/AppNav.css");
const APP = read("client/src/App.jsx");
const BAR = read("client/src/components/BoardBar.jsx");
const BUBCSS = read("client/src/components/JobBubble.css");

let probe = null;
function measured(t) {
  if (probe === null) {
    probe = JSON.parse(execFileSync(process.execPath, ["scripts/fidelityShots.mjs", "--styles", "home156"],
      { encoding: "utf8", timeout: 280000, stdio: ["ignore", "pipe", "ignore"] }).trim().split("\n").pop());
  }
  if (probe.skipped) { t.skip(probe.skipped); return null; }
  return probe;
}

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
  assert.match(css, /@media \(min-width: 1440px\) \{ \.home \{ --home-deck-track: minmax\(640px, \.75fr\); \} \.home__deck \{ width: auto; min-width: 640px; \} \}/);
  assert.match(css, /\.home \{ --home-gutter: clamp\(24px, 5\.625vw - 48px, 96px\);[^}]*grid-template-columns: var\(--home-deck-track, auto\) minmax\(0, 1fr\); gap: var\(--home-gap\);/,
    "less page margin (was 44 40 90, 56 between the columns); D163: growing with the screen");
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
  assert.match(DECK, /<FlipButton dir=\{-1\} disabled=\{stepTarget\(s, -1\) == null\} onFlip=\{step\} \/>/);
  assert.match(DECK, /aria-keyshortcuts=\{dir > 0 \? "J ArrowDown" : "K ArrowUp"\}/);
  assert.match(DECK, /<ActionButton label="Pass" ariaKeys="X ArrowLeft"/);
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
  // D179 (45l; brought to the code in 45o): the company NAME is a link to its page (b2c50d3); Open the posting still turns the card.
  assert.doesNotMatch(face.replace(/<Link to=\{companyPath\(job\.company\)\}/g, ""), /<Link /, "Open the posting turns the card, it does not navigate");
});

test("d156FilterSentenceOriginalStyle (pure): the marked look and the sentence type restored from 67be9da", () => {
  const fh = read("client/src/components/FullHouse.css");
  const marked = fh.slice(at(fh, '[data-sentence="marked"] {'), at(fh, "}", at(fh, '[data-sentence="marked"] {')));
  assert.match(marked, /--tok-pad: 0 \.08em; --tok-margin: 0; --tok-edge: transparent; --tok-fill: transparent; --tok-radius: 2px;\n  --tok-depth: inset 0 -\.16em 0 var\(--c-accent-quiet\);\n  --tok-hover-fill: var\(--c-accent-quiet\); --tok-hover-edge: transparent; --tok-hover-depth: inset 0 -\.16em 0 var\(--c-accent-ink\);\n  --tok-on-pad: 0 \.3em; --tok-on-margin: 0 \.04em;/);
  assert.doesNotMatch(marked, /--tok-on-fill|--tok-border-w/, "a set filter is the orange box again");
  assert.doesNotMatch(fh, /--fh-sentence-family: var\(--font-display\)/, "D147's serif sentence withdrawn");
  assert.match(fh, /\.fh\[data-fh-d147\] \{ --fh-sentence-size: calc\(min\(30px, 6\.4vw\) \* var\(--type-scale, 1\)\); \}/);
  const type = read("client/src/styles/type.js");
  assert.match(type, /SENTENCE_FAMILY: LOGO_FACE\.family,\n  SENTENCE_SIZE: `min\(\$\{MARK_SIZES\.nav\}px, 6\.4vw\)`,\n  SENTENCE_LINE: "1\.5",\n  SENTENCE_WEIGHT: LOGO_FACE\.weight,\n  SENTENCE_STYLE: LOGO_FACE\.style,/);
});

test("d156DockIconsSameSizeThemeAccent / d156ShortLogoInDock (pure): 30 px icons, the accent stroke, /d, the picture", () => {
  assert.match(NAV, /export const DOCK_ICON_PX = 30;/);
  assert.match(NAVCSS, /--appnav-ico: 30px;/);
  assert.match(NAVCSS, /\.appnav-svg \{[^}]*stroke: var\(--c-accent\);/, "the house and the globe in the theme's accent");
  // ⭐ (1c): swapped — the jobs page is "/d · draft", the tracker is the house, "Home".
  // ⭐ D167 (owner 11-06, changed on purpose): + Interview (the microphone); the jobs' icon is the drawing-out wordmark (<DraftMark drawOut />); names only.
  // D180 P1 (45o, on purpose): + network (drawn only while the network switch is on).
  // 46f (on purpose): + Feed and Messages' icons, their own places under the network switch.
  assert.match(NAV, /const ICONS = \{ atlas: \(\) => <GlobeIcon \/>, "auto-apply" ?: \(\) => <HouseIcon \/>, interview: \(\) => <MicIcon \/>, network: \(\) => <PeopleIcon \/>, feed: \(\) => <FeedIcon \/>, messages: \(\) => <EnvelopeIcon \/> \};/);
  assert.match(NAV, /<DraftMark drawOut \/>/);
  // D180 P1 (45o, on purpose): + network. 46f (on purpose): + feed, messages.
  assert.match(NAV, /export const DOCK_NAMES = Object\.freeze\(\{ today: "draft", "auto-apply" ?: "Home", atlas: "Atlas", interview: "Interview", network: "Network", feed: "Feed", messages: "Messages" \}\);/, "slash for short, draft for long — the jobs");
  assert.match(NAV, /\{url \? <img src=\{url\} alt="" \/> : <span className="appnav-initials" aria-hidden="true">\{initialsOf\(profile\.name\)\}<\/span>\}/);
  assert.doesNotMatch(NAV, /appnav-emboss|appnav-handle|DOCK_REVEAL_PX/, "D152 (4)'s embossed logo, edge handle and edge reveal are gone");
});

// ⭐ D167 (owner 11-06, changed on purpose) — "the dock goes where the space is" supersedes D156 (3)'s push: the dock never pads the page sideways; a
// side dock sits in a margin measured to fit it open, otherwise it goes to the top (test/d167Dock).
test("d156DockPushesPage → D167 (pure): the dock never pushes the page", () => {
  assert.doesNotMatch(NAVCSS, /--appnav-rail-w|padding-left: var\(--appnav/);
  assert.match(NAVCSS, /\[data-app-shell\] \{ transition: padding-right/, "only Ask draft moves the page (to the left of its panel)");
  assert.doesNotMatch(read("client/src/components/FullHouse.css"), /data-dock-open/, "Home has no dock rule of its own");
});

test("d156StarredImportedViews / d156ImportAJobInline / d156SortIconInSearch (pure)", () => {
  const tabs = APP.slice(at(APP, "const BOARD_TABS = ["), at(APP, "];", at(APP, "const BOARD_TABS = [")));
  assert.deepEqual([...tabs.matchAll(/\["(\w+)",\s+"([^"]+)"/g)].map(m => [m[1], m[2]]), [["all", "All jobs"], ["saved", "Starred"], ["imported", "Imported"]],
    "no Drafted / Pending view, no Companies tab (A157, 45q, owner 11-09)");
  assert.match(APP, /<BoardViews onImported=\{\(\) => setJobBoardRefreshKey\(k => k \+ 1\)\} \/>/);
  assert.match(APP, /onImported=\{\(\) => \{ setBoardTab\?\.\("imported"\); onImported\?\.\(\); \}\}/);
  assert.match(BAR, /await api\("\/api\/import\/job", \{ method: "POST", body: JSON\.stringify\(isLink \? \{ url: v \} : \{ text: v \}\) \}\)/,
    "the existing import route, not a second import");
  assert.match(APP, /<BoardSearchBar><BoardControlIcons \/><\/BoardSearchBar>/, "the sort icon inside the search field");
  assert.doesNotMatch(APP, /BoardTitleRow|fh-title/, "no Sort button at the top");
});

test("d156BubbleD1Growth (pure): hovered 1.55, the neighbour keeps 1, the rail 0 → 124 on 0.42 s cubic-bezier(.3,.8,.25,1)", () => {
  const block = BUBCSS.slice(at(BUBCSS, "D152 (5) · HOME: TWO COLUMNS OF BUBBLES"));
  assert.match(block, /\.jb-pair \.jb \{ flex: 1 1 0; min-width: 0; border-radius: 22px; padding: 16px 20px; gap: 14px;\n  transition: flex-grow \.42s cubic-bezier\(\.3,\.8,\.25,1\)/);
  assert.match(block, /\.jb-pair \.jb:hover, \.jb-pair \.jb:focus-within \{ flex-grow: 1\.55;/);
  assert.doesNotMatch(block, /\.jb-pair:hover \.jb \{ flex-grow: \.75; \}/, "the neighbour is not squeezed");
  assert.match(block, /\.jb-pair \.jb:hover \.jb__rail, \.jb-pair \.jb:focus-within \.jb__rail \{ max-width: 124px; \}/);
  assert.match(BUBCSS, /transition: max-width \.42s cubic-bezier\(\.3,\.8,\.25,1\)/, "the rail on the same clock");
  assert.match(block, /@media \(hover: none\) \{\n  \.jb-pair \.jb:hover, \.jb-pair \.jb:focus-within \{ flex-grow: 1; \}\n  \.jb-pair \.jb \.jb__rail \{ max-width: 124px; opacity: 1;/,
    "touch: the rail always, no growth");
});

// ── real Chrome ───────────────────────────────────────────────────────────────────────────────────────────────────
test("d156 real Chrome (1440 · 1280 · 390): the card, the flip, the dock, the views, import, sort, the bubbles", { timeout: 300000 }, (t) => {
  const out = measured(t);
  if (!out) return;
  const want = { wide: [600, 372, "landscape"], desktop: [300, 420, "portrait"], phone: [250, 350, "portrait"] };
  for (const [size, d] of Object.entries(out)) {
    const c = d.card;
    // d156LandscapeCardAt1440WithStats
    assert.deepEqual([c.box.width, c.box.height, c.orientation], want[size], `${size}: the card's size`);
    assert.ok(c.stats.length >= 1 && c.stats.length <= 4, `${size}: at most four stats on the card (${c.stats.length})`);
    assert.equal(c.stats[0].label, "skills matched");
    for (const st of c.stats) {
      assert.equal(st.inside, true, `${size}: the ${st.key} stat sits inside the card`);
      // ⭐ (1c) d156FoldedCardFillsSpace: larger cells on the landscape card (22 px), 17 px on the portrait, 15 on a phone
      assert.deepEqual([st.valueSize, st.labelSize], [{ wide: "22px", desktop: "17px", phone: "15px" }[size], "11.5px"], `${size}: the stats' type`);
    }
    assert.ok(Math.abs(d.folded.above - d.folded.below) <= 3, `${size}: the title centred between the head and the info row (${d.folded.above} / ${d.folded.below})`);
    assert.equal(d.folded.statCols, 2, `${size}: the stats two across`);
    // d156NothingScrollsInCard
    assert.equal(c.faceOverflows, false, `${size}: everything fits — nothing overflows the card`);
    assert.equal(c.scrollers, 0, `${size}: nothing scrolls inside the card`);
    assert.equal(c.articleOverflowY, "hidden");
    assert.equal(c.titleClamp, "3", `${size}: the title clamps to three lines`);
    assert.ok(c.titleLines <= 3);
    assert.equal(c.openPosting, "Open the posting"); assert.equal(c.openInside, true);
    // d156NoReasonSentence
    assert.equal(c.reason, false, `${size}: no reason sentence`); assert.equal(c.why, false, `${size}: no "Why this job" inside the card`);
    // d156ButtonsNeverOverCardContent
    assert.equal(d.buttons.position, "relative", `${size}: Pass · Save · Draft are not sticky on Home`);
    assert.equal(d.buttons.rest.over, false);
    assert.equal(d.fan.coverButtons, false, `${size}: the fan never covers the buttons`);
    assert.equal(d.fan.outside, false, `${size}: the fan stays in the deck's column`);
    // d156NoDeckListOverlapOnScroll
    for (const sc of d.scrolls) {
      assert.equal(sc.deckVsList, false, `${size} at y=${sc.y}: the deck and the list never overlap`);
      assert.equal(sc.deckVsBar, false, `${size} at y=${sc.y}: nor the deck and the sticky search`);
      assert.equal(sc.buttonsOverCard, false, `${size} at y=${sc.y}: the buttons never over the card`);
    }
    // ⭐ (1c) d156DeckBehaviourAsDeckView — one flick (60) one card, then a 140 ms settle; sideways too; J / K; ‹ ›
    const f = d.flip;
    assert.deepEqual([f.start, f.afterHalfFlick, f.afterOneFlick, f.duringSettle, f.afterSecondFlick, f.afterSidewaysBack], [1, 1, 2, 2, 3, 2],
      `${size}: one flick, one card`);
    assert.equal(f.pageScrolledByWheel, 0, `${size}: the wheel over the deck never scrolls the page while a turn is possible`);
    assert.equal(f.cardHeightAfterWheel, f.cardHeightBefore, `${size}: the wheel never lengthens the card`);
    assert.deepEqual([f.afterK, f.afterJ, f.afterNextButton, f.afterPrevButton], [1, 2, 3, 2], `${size}: K J › ‹`);
    assert.equal(f.prevKeys, "K ArrowUp");
    // a swipe left passes, with the PASS stamp on the way (the deck's own gesture)
    assert.equal(d.swipe.passed, true, `${size}: a left swipe passes`); assert.notEqual(d.swipe.after, d.swipe.before, `${size}: the next card is in front`);
    assert.equal(d.swipe.stampShown, true, `${size}: the PASS stamp shows during the drag`);
    // ⭐ (1c) d156CardExpandsIntoLongPost / d156NoSeparatePostingPanel / d156ListPostingOpensOnDeck
    const p = d.post;
    if (size === "phone") {
      // A phone (≤ 1000 px) keeps D149's full-screen posting: the scroll down opens it there, never in the deck's slot.
      // ✅ APPROVED 11-06 by the owner (O99 (b): the phone keeps the full-screen posting).
      assert.deepEqual([p.overlay, p.slotOpen, p.overlayClosed], [true, false, true], "phone: the full-screen posting, closed by Esc");
    } else {
    // ⭐ D168 (changed on purpose): a scroll down on the front card TURNS the deck; a press opens the long post.
    assert.equal(p.wheelOpened, false, `${size}: the wheel never opens the card`); assert.equal(p.wheelTurned, true, `${size}: it turns the deck`);
    assert.equal(p.openedByPress, true, `${size}: a press on the front card opens it into the long post`);
    assert.equal(p.postTitle, p.title, `${size}: the post is the front card's job`);
    assert.equal(p.factsInSlot, true); assert.equal(p.inSlot, true, `${size}: drawn in the deck's column`);
    assert.equal(p.stageHidden, true, `${size}: the fan is put away while it is open`);
    if (size !== "phone") assert.equal(p.deckPosition, "relative", `${size}: the deck column is not sticky while reading`);
    assert.equal(p.boardPost, false, `${size}: no posting panel beside the list`); assert.equal(p.listShown, true);
    assert.equal(p.foldLabel, "Fold it back");
    assert.equal(p.wheelFolded, false, `${size}: D168 — a scroll up never folds it`); assert.equal(p.backTo, p.title);
    assert.deepEqual([p.openedByEnter, p.foldedByEsc, p.openedByButton, p.foldedByButton], [true, true, true, true], `${size}: Enter / Esc / Open the posting / Fold it back`);
    if (size !== "phone") {
      assert.equal(p.listOpensOnDeck, true, `${size}: a bubble's posting opens on the deck`);
      assert.equal(p.listOrigin, "board"); assert.equal(p.listStillShown, true, `${size}: the list stays beside it`);
      assert.deepEqual([p.passFolds, p.passAdvanced], [true, true], `${size}: the post's Pass decides the deck's card and the next one returns`);
      assert.match(p.passSaid, /^Passed /);
    }
    }
    // ⭐ (1d) d156FilterSentenceOriginalStyle — the logo face, 800 italic, 1.5, -.015em; the highlighter underline
    const sn = d.sentence;
    assert.match(sn.family, /Poppins/); assert.deepEqual([sn.weight, sn.style], ["800", "italic"]);
    assert.equal(Math.round(parseFloat(sn.line) / parseFloat(sn.size) * 1000) / 1000, 1.5);
    assert.equal(Math.round(parseFloat(sn.spacing) / parseFloat(sn.size) * 1000), -15);
    assert.equal(sn.size, size === "phone" ? `${Math.min(30, 390 * 0.064).toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}px` : "30px");
    assert.equal(sn.color, sn.ink);
    assert.ok(sn.word.shadow.includes(sn.quiet) && /inset/.test(sn.word.shadow), `${size}: the quiet-accent highlighter underline (${sn.word.shadow})`);
    // d156DockIconsSameSizeThemeAccent / d156ShortLogoInDock / ⭐ (1c) d156DockDraftIsJobsHomeIsDashboard
    const k = d.dock;
    // ⭐ D167 (owner 11-06, changed on purpose): six places — + Interview, and Ask draft after the divider.
    // 45n (pin brought to the code in 45o): the dock's search icon comes first.
    assert.deepEqual(k.items, ["search", "today", "auto-apply", "atlas", "interview", "profile", "ask"]);
    // ⭐ D167 (owner 11-06, changed on purpose): THE DOCK GOES WHERE THE SPACE IS — at 1440 / 1280 it is a top row, on a
    // phone a top row of icons; its form, motion, placement and the peek are test/d167Dock's. What D156 asked still holds:
    // every line icon one size and in the theme's accent, the person's initials in a circle, no emboss and no edge handle.
    const icons = k.icons.filter(i => i.id !== "today");   // the jobs' icon is the wordmark (/d → /draft)
    for (const i of icons) assert.deepEqual([i.w, i.h], [30, 30], `${size}: ${i.id} 30 px`);
    for (const i of icons.filter(i => i.stroke)) assert.equal(i.stroke, k.accent, `${size}: ${i.id} in the accent`);
    const me = icons.find(i => i.text === "A");
    assert.ok(me, `${size}: initials when there is no picture`); assert.equal(me.radius, "50%");
    assert.equal(k.emboss, false); assert.equal(k.handle, false);
    assert.equal(k.rest.shownAtRest, true, `${size}: the dock is always visible`);
    assert.equal(k.rest.coversPage, false, `${size}: the dock never covers the page`);
    // d156StarredImportedViews
    assert.equal(d.views.below, true, `${size}: the views sit under the search`);
    // ⛔ A157 (45q, owner 11-09): the Companies tab is removed.
    assert.deepEqual(d.views.buttons.map(b => b.text), ["All jobs746", "Starred12", "Imported0"], `${size}: with their counts`);
    // d156ImportAJobInline
    assert.equal(d.views.importButton, "Import a job");
    assert.deepEqual([d.importBox.shown, d.importBox.inBoard, d.importBox.overlay], [true, true, false], `${size}: inline, not a dialog`);
    assert.equal(d.importBox.noteKind, "ok"); assert.match(d.importBox.note, /under Imported/);
    assert.equal(d.importBox.viewAfter, "imported", `${size}: the import lands under Imported`);
    // d156SortIconInSearch
    assert.deepEqual([d.sort.inSearch, d.sort.hasSvg, d.sort.topWord], [true, true, false], `${size}: an icon inside the search field, no Sort word at the top`);
    assert.equal(d.sort.label, "Sort: For you — change the order", `${size}: the icon's label says the current sort`);
    assert.deepEqual(d.sort.menu.rows, ["For you", "Best fit", "Newest", "Salary", "Company"]);
    assert.equal(d.sort.menu.checked, "", "the current one (For you) marked"); assert.equal(d.sort.menu.underField, true);
    assert.deepEqual(d.sort.afterPick, { label: "Sort: Newest — change the order", menuOpen: false });
    assert.equal(d.hscroll, false, `${size}: no sideways scroll`);
  }
  // d156BubbleD1Growth
  for (const size of ["wide", "desktop"]) {
    const b = out[size].bubbles;
    assert.equal(b.perPair, 2); assert.equal(b.samePair, true, `${size}: never reflowed to another row`);
    assert.deepEqual(b.restGrow, ["1", "1"]); assert.deepEqual(b.focusGrow, ["1.55", "1"], `${size}: only the hovered one grows; the neighbour keeps 1`);
    assert.equal(b.restW[0], b.restW[1]);
    assert.ok(b.focusW[0] > b.restW[0] && b.focusW[1] < b.restW[1], `${size}: the neighbour gives the width (${b.restW} → ${b.focusW})`);
    assert.ok(Math.abs(b.focusW[0] + b.focusW[1] - b.restW[0] - b.restW[1]) <= 1);
    assert.deepEqual(b.focusH, b.restH, `${size}: the row's height never changes`); assert.equal(b.focusRowH, b.rowH);
    assert.equal(b.restRail, "0px"); assert.ok(b.focusRail > 100 && b.focusRail <= 124, `${size}: the rail opened (${b.focusRail})`);
    assert.equal(b.cssGrow, "1.55"); assert.equal(b.cssRailOpen, "124px");
    assert.match(b.cssTransition, /flex-grow 0\.42s cubic-bezier\(0\.3, 0\.8, 0\.25, 1\)/);
    assert.match(b.cssRailTransition, /max-width 0\.42s cubic-bezier\(0\.3, 0\.8, 0\.25, 1\)/);
    assert.deepEqual([b.padding, b.gap, b.rowsGap], ["16px 20px", "18px", "18px"]);
  }
  const p = out.phone.bubbles;
  assert.equal(p.restRail, "124px", "touch shows the rail always"); assert.deepEqual(p.focusGrow, ["1", "1"], "… and nothing grows");
});
