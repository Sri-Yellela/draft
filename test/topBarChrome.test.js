// The top bar's chrome: what was removed, what only MOVED, and what had to stay put.
//
// The risk in this one is the unread count. Moving notifications into the profile menu is only
// safe if the fact that there ARE unread ones survives the move — otherwise they become invisible
// until someone happens to open a menu, which is strictly worse than the bell that was there.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";
import { LEGACY_BRAND } from "../shared/brand.js";

const read = (p) => fs.readFileSync(p, "utf8");
const topBar = read("client/src/components/TopBar.jsx");
const usb    = read("client/src/components/UnifiedSearchBar.jsx");

const stripComments = (t) => t
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*(?:\/\/|\*).*$/gm, "");

const topBarCode = stripComments(topBar);

test("quick actions is gone entirely, not hidden", () => {
  // A ⚡ button opening three items: "Search new role" and "ATS sort", which both only navigated to
  // the jobs tab — the same thing the JOBS tab beside them already did, and neither searched nor
  // sorted anything — and "Export PDF", which called window.print() on the whole app chrome.
  // Nothing is preserved elsewhere because there was no behaviour to preserve.
  assert.ok(!/function QuickActions/.test(topBarCode), "the QuickActions component is back");
  assert.ok(!/<QuickActions/.test(topBarCode), "QuickActions is rendered again");
  assert.ok(!/Quick actions|Quick Actions/.test(topBarCode), "the quick-actions control is back");
  assert.ok(!/window\.print\(\)/.test(topBarCode), "the Export PDF action is back");
});

test("notifications moved INTO the profile menu, whole", () => {
  // Not a reduced version: the list, the per-item unread dot, the type icons, the relative
  // timestamps and mark-all-read all came across.
  assert.ok(!/function NotificationsBell/.test(topBarCode), "the standalone bell is back in the bar");
  assert.match(topBar, /function useNotifications\(\)/);
  assert.match(topBar, /function NotificationsSection\(/);
  // Rendered inside the Profile panel (D149: the avatar menu's new home), not beside it in the bar.
  const menu = topBar.slice(at(topBar, "function ProfileMenuPanel"));
  assert.match(menu, /<NotificationsSection theme=\{theme\} notifs=\{notifs\} unread=\{unread\} markAll=\{markAll\}\/>/);
  // Everything the bell did:
  assert.match(topBar, /api\("\/api\/notifications"\)/);
  assert.match(topBar, /api\("\/api\/notifications\/read-all", \{ method: "PATCH" \}\)/);
  assert.match(topBar, /Mark all read/);
  assert.match(topBar, /No notifications yet/);
  assert.match(topBar, /NOTIF_TYPE_ICONS/);
  assert.match(topBar, /notifTimeAgo/);
  // Live updates still arrive while the menu is closed.
  assert.match(topBar, /notification:\s*\(\) => setUnread\(n => n \+ 1\)/);
});

test("the unread count stays OUTSIDE the menu — D149: on the Profile button of the Dock and the Menu", () => {
  // This is the load-bearing half of the move. Same "9+" cap the bell used.
  const nav = fs.readFileSync("client/src/components/AppNav.jsx", "utf8").replace(/\r\n/g, "\n");
  // ⭐ D156 (3), changed on purpose: the badge is ONE small component (Badge) every dock icon and Menu entry wears — on the
  // Profile icon in the dock, beside the name in the Menu.
  const item = nav.slice(at(nav, "function ProfileItem("), at(nav, "export default function AppNav("));
  assert.match(item, /<Badge n=\{profile\.badge\} label=\{profile\.badgeLabel\} \/>/, "the Profile button carries no unread badge");
  const badge = nav.slice(at(nav, "function Badge("), at(nav, "function NavItems("));
  assert.match(badge, /if \(!\(n > 0\)\) return null;/);
  assert.match(badge, /\{n > 9 \? "9\+" : n\}/);
  // And it is announced, not just painted — the number is aria-hidden; the label says it in words.
  assert.match(badge, /<span aria-hidden="true">/);
  assert.match(badge, /<span className="sr-only">\{`, \$\{label\}`\}<\/span>/);
  assert.match(topBar, /badgeLabel: `\$\{unread\} unread notification\$\{unread === 1 \? "" : "s"\}`/);
  // One source of truth for both renderings: the hook, in TopBar, feeding the badge AND the panel's list.
  assert.match(topBar, /const \{ notifs, unread, load: loadNotifs, markAll \} = useNotifications\(\);/);
});

test("the profile menu kept everything it already had", () => {
  // Notifications were inserted into this menu, not swapped in for something.
  const menu = topBar.slice(at(topBar, "function ProfileMenuPanel"));
  // "Accent Color" WAS in this list. docs/UI_REDESIGN.md step 2 removed it on purpose — the
  // per-session accent and the picker that chose among four were killed by the owner (2026-09-27),
  // and the accent is the logo orange, always. So it is asserted GONE, not merely dropped from here:
  // test/colorTokens.test.js pins the picker's absence from comment-stripped source.
  // D18: "Manage Job Profiles" MOVED into the menu's Settings group as "Job Profiles" — moved, not lost.
  for (const kept of [/PROFILE/, /Job Profile/, />Settings<\/div>[\s\S]{0,400}Job Profiles/, /<ProfileSelectorDropdown/,
                      /Sign Out|onLogout/]) {
    assert.match(menu, kept, `the profile menu lost ${kept}`);
  }
  assert.doesNotMatch(menu, /Accent Color/, "the killed accent picker is back in the profile menu");
});

// THE LOGO IS WHITE, AND THIS TEST USED TO ASSERT THE OPPOSITE.
//
// W6 made the app mark translucent — `rgba(255,255,255,0.06)` behind a `--border-glass` hairline,
// with `theme.text` / `theme.textMuted` glyphs — and locked that in here with three negative
// assertions ("the solid white stamp is back in the app bar"). Those assertions were the reason
// the regression was safe to keep: the mark had no edge of its own on a top bar that is fully
// transparent at rest, and the guard said that was correct.
//
// Read from `topBarCode`, not `topBar`: the component now carries a comment quoting the very
// literals under test, and matching a comment instead of code is how a source-string test passes
// while the code says something else.
// The end landmark was `function Divider`, which is gone: both dividers rendered behind
// `{scrolled && ...}`, and `scrolled` came from a scroll progress that was permanently 0, so neither
// ever appeared. The next function is the boundary now — and it has to BE a function, because these
// tests read comment-stripped source, so a `// ── section` header is not there to find.
const logoOf = (src) => {
  const start = src.indexOf("function AnimatedLucyLogo");
  const end = src.indexOf("function useNotifications", start);
  assert.ok(start >= 0 && end > start, "AnimatedLucyLogo / useNotifications boundary moved");
  return src.slice(start, end);
};

test("the app logo is the REDESIGNED mark — /draft and /d, by construction, because there is one", () => {
  // 09-30, the owner: use the redesigned mark the extension carries, expanded and condensed, like for
  // like. The white, black-bordered "DRAFT" stamp these assertions used to pin is retired.
  //
  // What stays pinned is the structural rule that survived every redesign: TopBar RENDERS the one
  // shared component and never draws the mark itself.
  const logo = logoOf(topBarCode);
  assert.match(logo, /<StampLogo\b/, "the app bar must RENDER the shared mark, not redraw it");
  assert.ok(!/wordmark\.png|monogram\.png/.test(topBarCode), "TopBar imports the artwork itself — a second implementation starting");
  assert.ok(!/background: "#ffffff"|rotate\(-2deg\)|Barlow Condensed/.test(logo),
    "TopBar is declaring the old stamp's chrome again");

  // The mark, asserted once, where it lives: the owner's artwork, both states, an accessible name.
  const stamp = stripComments(read("client/src/components/StampLogo.jsx"));
  // D19: the artwork is drawn as two masks per state (slash, letters), cut from these same PNGs by
  // scripts/d19SplitMark.mjs — test/d19MarkLightMode.test.js proves the masks are fresh from the art.
  for (const part of ["wordmark-slash", "wordmark-letters", "monogram-slash", "monogram-letters"]) {
    assert.match(stamp, new RegExp(`from '\\.\\./assets/brand/${part}\\.png';`), `the mark does not draw ${part} from the artwork`);
  }
  assert.match(stamp, /role="img" aria-label=\{WORDMARK\}/, "the mark has no accessible name");
  for (const f of ["client/src/assets/brand/wordmark.png", "client/src/assets/brand/monogram.png"]) {
    assert.ok(fs.existsSync(f) && fs.statSync(f).size > 1000, `${f} is missing or empty`);
  }
  // The old stamp's chrome and its glass treatment stay gone.
  assert.ok(!/'#ffffff'|#0f0f0f|rotate\(-2deg\)/.test(stamp), "the old white stamp is back");
  assert.ok(!/rgba\(255,255,255,0\.06\)|--border-glass|backdropFilter/.test(stamp), "a glass treatment is on the mark");
});

test("⛔ the mark's container does not clip it — the 33-pixel finding, kept", () => {
  // Measured on the running app (1440x900, dSF 6): a box-level clip shaved the mark's corner and
  // glyph bearings by 33 device pixels. The mark is artwork now, but the rule is the same: the ONLY
  // overflow in the component is the collapsing tail's — never the mark's own box.
  const stamp = stripComments(read("client/src/components/StampLogo.jsx"));
  const overflows = stamp.match(/overflow:/g) || [];
  assert.equal(overflows.length, 1,
    "the mark should declare overflow exactly once, on the collapsing tail — a second one is " +
    "almost certainly the box clip coming back");
  const outer = stamp.slice(at(stamp, 'role="img"', 0, "the mark's box"), at(stamp, "}}>", at(stamp, 'role="img"', 0, "box")));
  assert.ok(!/overflow/.test(outer), "the mark's own box clips it again");

  // The collapse stays retired in the APP bar (its progress was permanently 0).
  const logo = logoOf(topBarCode);
  assert.ok(!/textMaxW|textOpacity/.test(logo),
    "the collapse interpolation is back in the app bar — it needs a live scroll progress first");
  assert.ok(!/progress=/.test(logo), "the app bar is driving the collapse again");
});

test("⛔ THERE IS ONE MARK, AND EVERY SURFACE CALLS IT", () => {
  // This test used to compare the fill and border of THREE separate implementations and call them
  // "the same mark". They were never the same mark — they were three drawings that happened to
  // agree on two declarations, and agreeing on colours is not the property anyone wanted. The app
  // copy spelled the LEGACY BRAND while this passed, because the brand was not among the things
  // being compared.
  //
  // Sameness is structural now: one component, and the other surfaces render it.
  const stamp = read("client/src/components/StampLogo.jsx");
  assert.match(stamp, /export function StampLogo/, "the one implementation must exist");

  for (const f of ["client/src/components/TopBar.jsx",
                   "client/src/components/ScrollDock.jsx",
                   "client/src/components/NavBar.jsx",
                   "client/src/pages/LandingPage.jsx"]) {
    const src = stripComments(read(f));
    assert.match(src, /<StampLogo\b/, `${f} must render the shared mark`);
    // The tell of a copy starting: any surface re-declaring the mark's own chrome.
    assert.ok(!/Barlow Condensed[^]{0,400}rotate\(-2deg\)/.test(src),
      `${f} is drawing the stamp itself again — that is a second implementation`);
  }

  // The mark is ARTWORK now (09-30), so a rename is new art, not a string; what is still derived is
  // its accessible name — from the one brand definition, never spelled here.
  assert.match(stamp, /aria-label=\{WORDMARK\}/, "the mark's name must come from shared/brand.js");
});

test("the actions row's vertical rhythm matches the bar's horizontal spacing", () => {
  // Measured before W6 at 1440x900: 21px above the row and 0px between it and the search field —
  // pressed against the input with all the air on the wrong side. The row's own padding was
  // "8px 12px 0", which added above and contributed nothing below. After: 21px above, 21px below,
  // against 20px card padding on the left and right.
  //
  // Y4 emptied this row of TABS — they are in the top bar now — but the row itself survives as the
  // board's ACTIONS row, and the rhythm is a property of the row, not of what is in it. It is also
  // now `justify-content: space-between`, because with the tabs gone, right-aligning everything left
  // the whole left half of a 920px card empty.
  assert.ok(!/padding: "8px 12px 0", alignItems: "center"/.test(usb),
    "the row is top-heavy again");
  assert.match(usb, /padding: "0 12px 10px", marginBottom: 10,/);
  assert.match(usb, /justifyContent: "space-between",/);
});

test("the tab row moved into the top bar, whole, and from appTabs — ⭐ D145: and from there into the Dock / the Menu", () => {
  // Y4. The app's primary navigation was a slot on the search bar, so it appeared and disappeared
  // with a control that is only meaningful on the Jobs board. ⭐ D145 Step 3 (owner 11-03, changed on purpose): the bar's
  // tab row is REMOVED; the bar mounts AppNav (the Dock or the Menu, the user's choice), fed the same `tabs`.
  const app = read("client/src/App.jsx");
  const nav = read("client/src/components/AppNav.jsx");
  assert.match(topBarCode, /<AppNav tabs=\{tabs\} activeTab=\{activeTab\} hrefForTab=\{hrefForTab\} onTabChange=\{onTabChange\}\s+profile=/);   // D149: + the Profile entry
  assert.doesNotMatch(topBarCode, /className="tbar-tab"|className="tbar-nav"/, "the old tab row is back");
  // Rendered in a real <nav>, from the tabs it is GIVEN — not from a list of its own.
  assert.match(nav, /<nav aria-label="Main"/);
  // ⭐ D167 (owner 11-06, changed on purpose): through placesOf(tabs) — the given tabs, plus Interview's place when the tabs don't carry it yet.
  assert.match(nav, /const list = \(tabs \|\| \[\]\)\.filter\(\(t\) => t\.id !== "console"\);/);
  // D180 P1 (45o, changed on purpose): + the Network place and its unread badge, only while the network is on.
  assert.match(nav, /return placesOf\(tabs, network, netUnread\)\.map\(\(t\) => \{/);
  assert.match(nav, /aria-current=\{activeTab === t\.id \? "page" : undefined\}/);
  assert.ok(!/id: "console"|id: "auto-apply"|id: "database"/.test(topBarCode + nav),
    "TopBar / AppNav grew its own tab list — that is the fourth copy, and the previous three all drifted");
  assert.match(app, /tabs=\{appTabs\}/, "the bar is no longer fed from appTabs");
  // ⛔ D60: a nav button is a box, never a capsule, never an uppercase label.
  const css = read("client/src/components/AppNav.css");
  assert.doesNotMatch(css, /text-transform: uppercase|border-radius: 999px/);

  // ...and the search bar no longer renders tabs at all, so there is exactly one tab list.
  assert.ok(!/onTabChange\?\.\(t\.id\)/.test(usb), "the search bar still renders a tab row");
  assert.ok(!/tabs,\s*\n\s*activeTab,\s*\n\s*onTabChange,/.test(usb),
    "the search bar still takes tab props");
});

test("the AUTO APPLY needs-review count survived the move", () => {
  // Y4's requirement 2. The count is the ONLY thing the apply pipeline renders outside its own
  // panel, and a review queue nobody sees is worse than a cluttered bar. It rode on the tab row, so
  // it had to travel with it — ⭐ D145: to the Draft House button of the Dock and the Menu.
  const app = read("client/src/App.jsx");
  assert.match(app, /function AppTopBar\(\{ tabs, \.\.\.props \}\)/);
  assert.match(app, /const \{ needsAttentionCount = 0 \} = useAutoApply\(\);/);
  assert.match(app, /needsAttentionCount === 1 \? "draft needs" : "drafts need"\} your attention/);
  // The count and its sentence are data on the tab; AppNav draws them, and only when something needs a human.
  assert.match(app, /t\.id === "auto-apply" \? \{ \.\.\.t, badge: needsAttentionCount, badgeLabel: attention \} : t/);
  const nav = read("client/src/components/AppNav.jsx");
  // ⭐ D156 (3): one Badge — a small number on the dock's icon, beside the name in the Menu; drawn only when n > 0.
  assert.match(nav, /<Badge n=\{t\.badge\} label=\{t\.badgeLabel\} \/>/);
  assert.match(nav, /if \(!\(n > 0\)\) return null;/);
  assert.match(nav, /<span aria-hidden="true">\{n > 9 \? "9\+" : n\}<\/span><span className="sr-only">\{`, \$\{label\}`\}<\/span>/);
  assert.match(app, /<AppTopBar/, "the decorator is defined but never rendered");
});
