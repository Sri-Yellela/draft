// ⭐ D197 Wave 1 #1 (47i) · THE SHELL — the dock in the plate system, to the owner-approved canvas board `Shell`
// (docs/sketches/final/project/Shell.dc.html; the design doc's addendum shell bullet; A237). ⛔ CHANGED ON PURPOSE from D167's
// dock (this file pinned D167 from 11-06 to 47h): the rail is the PLATE's (paper rail, 1.5 px ink border, 20 px radius, 4 px
// hard shadow, 84 px wide; the active item a white tile with a 1.5 px ink border and a 3 px ink shadow; badges ink mono tags;
// the /d logo an ink d with a clay slash on a white 1.5 px-bordered 44 px tile), drawn by the plate library's ONE Dock
// (plate/Shell.jsx) that components/AppNav.jsx renders; on wide screens a vertical RAIL at the LEFT, 14 px from the edge, the
// area nav across the top of the content column beside it (plate content centred in its 1,180 px column; at 2560 the extra
// width is margin, never a dock on top); below 980 px the rail becomes the phone's bottom bar and the area nav's top bar holds
// the /d tile and search. Every D167 item is kept (D200 Rule 1): the places and their order and badges, Profile's quick peek
// (now with the notifications list, A236 (b)), M, the Esc chain, Tiny floating (D190), the dock's search (now in the area nav:
// Ctrl K; the phone's search button). RETIRED with the 60 px rail (the board draws the names always): the hover-expand to
// 196 px and the /d → /draft draw-out — the checks that pinned them now pin "names always shown, one width".
// The real-Chrome tests read `scripts/fidelityShots.mjs --styles dock167` (2560 + 1280, reduced motion at "rm") and
// `--styles dock167place` (1280 · 1440 · 1920 · 2560 · 980 · 979 · 390, and a resize across 980).
// The look itself is gated pixel by pixel against the board: scripts/d196Regress.mjs pairs shell-rail / shell-active /
// shell-areanav / shell-phonebar (D196 F5, ≤ 2 %).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";
import { probe as fidelityProbe } from "../test-support/fidelityProbe.mjs";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const NAV = read("client/src/components/AppNav.jsx");
const CSS = read("client/src/components/AppNav.css");
const SHELL = read("client/src/plate/Shell.jsx");
const PLATE = read("client/src/plate/plate.css");
const TOP = read("client/src/components/TopBar.jsx");
const SIZES = ["2560", "1280", "rm"];

const probes = {};
function run(t, screen) {
  if (!(screen in probes)) probes[screen] = fidelityProbe(screen);
  if (probes[screen].skipped) { t.skip(probes[screen].skipped); return null; }
  return probes[screen];
}
const measured = (t) => run(t, "dock167");
const placed = (t) => run(t, "dock167place");

// ── pure ──────────────────────────────────────────────────────────────────────────────────────────────────────────
test("d197ShellOneDock (pure): the live dock IS the plate's Dock — D167's places, names and badges, Profile → the peek, Ask draft → Tiny", () => {
  assert.match(NAV, /import \{ Dock, AreaNav, useSearchShortcut \} from "\.\.\/plate\/Shell\.jsx";/);
  assert.match(NAV, /<Dock home=\{home\} items=\{items\} ask=\{ask\} current=\{current\} bar=\{bar\} onGo=\{go\} navRef=\{dockRef\}/);
  assert.doesNotMatch(NAV, /function NavItems|function ProfileItem|className="appnav-dock"/, "no second dock (A93)");
  // the places, in D167's order (DOCK_PLACES), and their names (DOCK_NAMES) — Network · Feed · Messages under the switch (D180 / 46f)
  assert.match(NAV, /export const DOCK_PLACES = Object\.freeze\(\["today", "auto-apply", "atlas", "interview", "profile"\]\);/);
  assert.match(NAV, /export const DOCK_NAMES = Object\.freeze\(\{ today: "draft", "auto-apply" : "Home", atlas: "Atlas", interview: "Interview", network: "Network", feed: "Feed", messages: "Messages" \}\);/);
  assert.match(NAV, /const DOCK_ICON = Object\.freeze\(\{ "auto-apply" : "home", atlas: "atlas", interview: "interview", network: "network", feed: "feed", messages: "messages" \}\);/);
  assert.match(NAV, /export const INTERVIEW_PATH = "\/app\/interview";/);
  // the /d tile is the jobs' entry (the market); Profile is a button that opens the peek; the rail's Ask draft opens Tiny
  assert.match(NAV, /attrs: \{ "data-nav-item": brand\.id, "data-nav-brand": "" \}/);
  assert.match(NAV, /items\.push\(\{ id: "profile", label: "Profile", onPress: pressProfile, itemRef: profRef/);
  assert.match(NAV, /const ask = bar \? null : \{ onPress: pressAsk, attrs: \{ "data-nav-item": "ask", "aria-expanded": !!askOpen, "aria-controls": "appnav-ask"/);
  assert.match(NAV, /<TinyBubble open=\{askOpen\} onPress=\{pressAsk\} btnRef=\{askBtnRef\} \/>/, "Tiny's own bubble stays (D190)");
  // the dock's draw: the board's look, from plate tokens (no theme colour in the dock's own rules)
  assert.match(PLATE, /\.pl-dock \{ flex: 0 0 auto; width: var\(--pl-dock-width\);[^}]*border: var\(--pl-border\); border-radius: var\(--pl-r-plate\); box-shadow: var\(--pl-s4\);/);
  assert.match(PLATE, /\.pl-dock__item\[aria-current="page"\], \.plate a\.pl-dock__item\[aria-current="page"\] \{ background: var\(--pl-card\); border: var\(--pl-border\); box-shadow: var\(--pl-s3\); \}/);
  assert.match(PLATE, /\.pl-badge \{ position: absolute;[^}]*font-family: var\(--pl-mono\);[^}]*background: var\(--pl-ink\); color: var\(--pl-on-ink\);/);
  const place = CSS.slice(at(CSS, "/* ⭐ D197 Wave 1 #1 · A237 · THE SHELL"), at(CSS, "/* ── the side panel"));
  assert.doesNotMatch(place, /--c-|#[0-9a-f]{3,6}\b|rgba?\(/i, "the placing rules carry no colour (FIX-1)");
});

test("d197ShellPlace (pure): the rail from 980 px up, the bottom bar below; the shell padded by the rail, never under it", async () => {
  const { dockPlace, SIDE_MIN_PX, DOCK_RAIL_PX, DOCK_EDGE_PX } = await import("../client/src/components/dockPlace.js");
  assert.equal(SIDE_MIN_PX, 980); assert.equal(DOCK_RAIL_PX, 84); assert.equal(DOCK_EDGE_PX, 14);
  for (const vw of [980, 1280, 1920, 2560, 5120]) assert.equal(dockPlace({ vw }), "side", vw);
  for (const vw of [979, 600, 390, 320]) assert.equal(dockPlace({ vw }), "phone", vw);
  assert.match(CSS, /\.appnav-plate > nav\[data-nav-dock\]\[data-place="side"\] \{\n  position: fixed; left: 14px; top: 14px; margin: 0;/);
  assert.match(CSS, /\.appnav-plate > nav\[data-nav-dock\]\[data-place="phone"\] \{\n  position: fixed; left: 0; right: 0; bottom: 0;/);
  assert.match(CSS, /:root\[data-dock-place="side"\] \[data-app-shell\] \{ padding-left: 98px; \}/, "14 + 84: the content column starts beside the rail");
  assert.match(NAV, /window\.addEventListener\("resize", schedule\);/, "re-placed on every resize");
  assert.doesNotMatch(CSS + NAV, /data-dock-push|--appnav-rail-w|--appnav-top-reserve/, "the D167 push and the top reserve are gone");
  // the chrome strip reserves nothing: the area nav is the content column's first thing (the board)
  assert.match(TOP, /height: 0,/);
  // Tiny (D190) floats: the bubble at the bottom-right, a perfect circle; on the bottom bar it sits above the bar
  assert.match(CSS, /\.appnav-tiny \{\n  position: fixed; right: 20px; bottom: 20px;/);
  assert.match(CSS, /width: 60px; height: 60px; aspect-ratio: 1; border-radius: 50%;/);
  assert.match(CSS, /:root\[data-dock-place="phone"\] \.appnav-tiny \{ bottom: calc\(86px \+ env\(safe-area-inset-bottom, 0px\)\); \}/);
  assert.doesNotMatch(CSS, /\[data-ask-open="true"\][^{]*\[data-app-(shell|chrome)\][^{]*\{[^}]*padding/, "the shell is never padded for Tiny");
});

test("d197ShellKeys (pure): M into the dock and out; Esc — the peek, then Tiny, then the dock; one Ctrl K; the area nav's menus close", () => {
  const keys = NAV.slice(at(NAV, "  // ⛔ 45n (owner 11-08, decision (10)): the dock is the one navigation. ⭐ D197 #1"));
  assert.match(keys, /if \(e\.key === "Escape" && peekOpen\) \{ closePeek\(\); profRef\.current\?\.focus\(\{ preventScroll: true \}\); return; \}/);
  assert.match(keys, /if \(e\.key === "Escape" && askOpen\) \{ setAskOpen\(false\);/);
  assert.match(keys, /if \(el\?\.closest\?\.\("input,textarea,select,\[contenteditable=''\],\[contenteditable='true'\]"\)\) return;/, "never while typing");
  assert.match(NAV, /"aria-keyshortcuts": "M"/);
  // §6 item 5: ONE window listener for Ctrl / Cmd K (plate/Shell.jsx), not one per search
  assert.equal((SHELL.match(/window\.addEventListener\("keydown"/g) || []).length, 1);
  assert.match(SHELL, /if \(SHORTCUT_TARGETS\.length === 1\) window\.addEventListener\("keydown", onShortcut\);/);
  assert.match(SHELL, /const onDown = \(e\) => \{ if \(!rootRef\.current\?\.contains\(e\.target\)\) setOpen\(null\); \};/, "a press outside closes an area-nav menu");
  assert.match(SHELL, /if \(e\.key !== "Escape"\) return;\n      e\.stopPropagation\(\);\n      setOpen\(null\);/, "Esc closes it");
});

test("d197ShellSearch (pure): the dock's search (people / companies / roles) lives in the area nav — one suggest (A93)", () => {
  assert.match(NAV, /export function ShellSearchInput\(/);
  assert.match(NAV, /<UsbSuggest field="title" value=\{q\} onChange=\{setQ\}\n      onPickRole=\{\(r\) => toBoard\(\{ role: \{ id: r\.id, categoryId: r\.categoryId \} \}\)\}/);
  assert.match(NAV, /renderInput: \(\{ className, placeholder: ph \}\) => <ShellSearchInput className=\{className\} placeholder=\{ph\} inputRef=\{inputRef\} \/>/);
  assert.match(NAV, /onOpen: \(\) => setSheet\(\(s\) => !s\), sheet: sheet \? <DockSearch onClose=\{\(\) => setSheet\(false\)\} \/> : null/, "the phone's search button opens the sheet");
  assert.match(read("client/src/App.jsx"), /<AppAreaNavSlot activeTab=\{home \? "today" : activeTab\} marketPlate=\{!!marketPlate\}/);
});

test("d167ProfilePeekBasics → d197 (pure): the peek's items link to Profile's panels; the mode switch; the notifications list (A236 (b))", () => {
  for (const id of ["answers", "connections", "appearance", "notifications"]) assert.ok(NAV.includes(`link("${id}", `), id);
  assert.match(NAV, /<a href=\{ABOUT_HREF\} className="appnav-peek__name"/);
  assert.match(NAV, /export const profileHref = \(panel\) => \(panel \? `\/app\/profile\/\$\{panel\}` : "\/app\/profile"\);/);
  assert.match(NAV, /onClick=\{\(\) => \{ if \(fullAuto\) setApplyMode\?\.\("semi"\); \}\}>Ask me first<\/button>/);
  assert.match(NAV, /onClick=\{mode\.selectable \? \(\) => \{ if \(!fullAuto\) setApplyMode\?\.\("auto"\); \} : undefined\}>Apply for me<\/button>/);
  assert.match(NAV, /data-peek-notifs="" aria-expanded=\{notifsOpen\}/);
  assert.match(NAV, /onClick=\{\(\) => profile\.onMarkAll\?\.\(\)\}>Mark all read<\/button>/);
  assert.match(TOP, /notifs, onLoadNotifs: loadNotifs, onMarkAll: markAll \} : null\} \/>/, "the badge's own hook feeds the list — one state");
  assert.match(TOP, /email: user\.email \|\| "", onSignOut: onLogout,/);
  const peek = CSS.slice(at(CSS, "THE PROFILE QUICK PEEK"));
  assert.doesNotMatch(peek, /999px|border-radius: 50%;[^}]*(button|seg)/, "no pills");
  assert.match(peek, /border-radius: var\(--pl-r-plate\); background: var\(--pl-card\); color: var\(--pl-ink\);\n  border: var\(--pl-border\); box-shadow: var\(--pl-s4\);/, "the plate's card");
});

// ── real Chrome ───────────────────────────────────────────────────────────────────────────────────────────────────
test("d197ShellRail (real Chrome): the places in order, the board's rule and Ask draft, names always shown, the plate look", { timeout: 300000 }, (t) => {
  const out = measured(t); if (!out) return;
  for (const s of SIZES) {
    const r = out[s].dock.rest;
    assert.deepEqual(r.places, ["today", "auto-apply", "atlas", "interview", "profile", "ask"], s);
    assert.deepEqual(r.labels, ["Home", "Atlas", "Interview", "Profile", "Ask draft"], `${s}: the jobs' name is the /d tile itself`);
    assert.equal(r.shown, 5, `${s}: every name shown at rest (the board)`);
    assert.equal(r.rule, true); assert.equal(r.sep, true);
    assert.deepEqual(r.rail, { left: 14, top: 14, width: 84 }, `${s}: the rail at the left, 14 px from the edges, 84 wide`);
    assert.match(r.border, /^1(\.5)?px$/, "1.5 px (Chrome computes 1 px at DPR 1, as on the board)"); assert.equal(r.radius, "20px"); assert.match(r.shadow, /4px 4px 0px/);
    assert.equal(r.current.id, "today", `${s}: the market is current (the /d tile)`);
    assert.equal(r.logo.w, 44); assert.equal(r.logo.h, 44); assert.equal(r.logo.text, "/d"); assert.match(r.logo.border, /^1(\.5)?px$/);
    assert.equal(out[s].dock.hoverWidth, 84, `${s}: hovering never widens it (the hover-expand retired with the 60 px rail)`);
  }
});

test("d197ShellKeys (real Chrome): M takes the keyboard into the dock and out; Ctrl K focuses the area nav's search", { timeout: 300000 }, (t) => {
  const out = measured(t); if (!out) return;
  for (const s of SIZES) {
    const d = out[s].dock;
    assert.equal(d.mIn.inDock, true, `${s}: M → the dock`); assert.equal(d.mIn.item, "today"); assert.equal(d.mIn.open, "true");
    assert.equal(d.mOut.inDock, false, `${s}: M again → out`); assert.equal(d.mOut.open, null);
    assert.equal(d.ctrlK.focused, true, `${s}: Ctrl K → the dock's search`); assert.equal(d.ctrlK.inAreaNav, true);
  }
});

test("d197ShellPlace (real Chrome): the rail beside the content column at every wide width; the bottom bar below 980; no sideways scroll", { timeout: 300000 }, (t) => {
  const out = placed(t); if (!out) return;
  for (const s of ["1280", "1440", "1920", "2560", "980"]) {
    const r = out[s].node.rest;
    assert.equal(r.place, "side", s); assert.equal(r.bar, false); assert.equal(r.dockPosition, "fixed");
    assert.equal(Math.round(r.dock.left), 14, `${s}: 14 px from the left`); assert.equal(Math.round(r.dock.top), 14, `${s}: and the top`);
    assert.equal(Math.round(r.dock.width), 84);
    assert.equal(r.shellPadLeft, "98px", `${s}: the content column starts beside the rail`);
    assert.ok(r.areaNav.left >= r.dock.right - 0.5, `${s}: the area nav never under the rail`);
    assert.ok(r.areaNav.top <= 1, `${s}: the area nav is the column's top (${r.areaNav.top})`);
    assert.ok(r.row.width <= 1180 + 0.5, `${s}: the nav row in its 1,180 px column (${r.row.width})`);
    const col = { left: 98, right: r.vw };
    assert.ok(Math.abs((r.row.left + r.row.right) / 2 - (col.left + col.right) / 2) <= 1, `${s}: centred in the column`);
    assert.ok(r.searchBox, `${s}: the dock's search in the area nav`);
    assert.deepEqual(r.views, ["All jobs", "Starred", "Imported"], `${s}: the classic market's views`);
    assert.ok(r.scrollW <= r.vw, `${s}: no sideways scroll (${r.wide})`);
    const p = out[s].node.peek;
    assert.equal(p.open, "true"); assert.ok(p.left >= p.dockRight + 8, `${s}: the peek beside the rail`);
  }
  assert.ok(out["2560"].node.rest.row.left - 98 > 500, "2560: the extra width is margin, never a dock on top");
  for (const s of ["979", "phone"]) {
    const r = out[s].node.rest;
    assert.equal(r.place, "phone", s); assert.equal(r.bar, true);
    assert.equal(Math.round(r.dock.left), 0); assert.equal(Math.round(r.dock.right), r.vw, `${s}: the bar spans the screen`);
    assert.equal(Math.round(r.dock.bottom), r.vh, `${s}: at the foot`);
    assert.deepEqual(r.labels, ["Market", "Home", "Atlas", "Interview", "Profile"], `${s}: the same items (Ask draft by Tiny's bubble)`);
    assert.equal(r.shellPadLeft, "0px");
    assert.ok(r.topBar, `${s}: the area nav's top bar (the /d tile, search)`); assert.equal(r.searchButton, true);
    assert.ok(r.tiny.bottom <= r.dock.top, `${s}: Tiny's bubble above the bar`);
    assert.ok(r.scrollW <= r.vw, `${s}: no sideways scroll (${r.wide})`);
    const p = out[s].node.peek;
    assert.equal(p.open, "true"); assert.ok(p.bottom <= p.dockTop - 8, `${s}: the peek above the bar`); assert.ok(p.left >= 0 && p.right <= p.vw);
  }
  assert.equal(out["1920"].node.resized.place, "phone", "1920 → 900: the bar");
  assert.equal(out.phone.node.resized.place, "side", "390 → 1280: the rail");
});

test("d167TinyFloats → d197 (real Chrome): the fox bubble opens a card OVER the page; the rail's Ask draft opens it too", { timeout: 300000 }, (t) => {
  const out = measured(t); if (!out) return;
  for (const s of SIZES) {
    const a = out[s].dock.ask;
    assert.equal(a.open, "true"); assert.equal(a.html, "true"); assert.equal(a.stub, true);
    assert.equal(a.bubble.width, 60); assert.equal(a.bubble.height, 60);
    assert.equal(a.bubble.right, 20); assert.equal(a.bubble.bottom, 20);
    assert.equal(a.position, "fixed"); assert.equal(a.width, 380);
    assert.equal(a.vw - a.right, 20, `${s}: the card lines up with the bubble`);
    assert.equal(a.shellPadRight, "0px"); assert.equal(a.contentRight, a.contentRightShut, `${s}: the page keeps its width`);
    assert.equal(a.dockAsk, "true", `${s}: the rail's Ask draft says Tiny is open`);
    assert.equal(out[s].dock.askAfterEsc.open, "false");
    assert.equal(out[s].dock.askFromDock.open, "true", `${s}: the rail's Ask draft opens Tiny`);
  }
});

test("d167ProfilePeekBasics → d197 (real Chrome): beside the rail, the person, the links, the mode, the notifications list, Sign out", { timeout: 300000 }, (t) => {
  const out = measured(t); if (!out) return;
  for (const s of SIZES) {
    const d = out[s].dock, p = d.peekRest;
    assert.equal(d.peekAt150, "false", `${s}: a pass over the picture does not open it`);
    assert.equal(p.open, "true", `${s}: resting ≈ 350 ms opens it`);
    assert.ok(p.left >= p.dockRight + 8, `${s}: never covers the dock (${p.left} vs ${p.dockRight})`);
    assert.equal(p.name, "Ada Lovelace"); assert.equal(p.email, "ada@example.invalid");
    assert.deepEqual(p.links.map(([, h]) => h), ["/app/profile/about#profile-about", ...["answers", "connections", "appearance"].map((x) => `/app/profile/${x}`), "/app/profile"]);
    assert.deepEqual(p.mode.map(([l, pr]) => [l, pr]), [["Ask me first", "true"], ["Apply for me", "false"]]);
    assert.deepEqual(d.modeAfterApplyForMe, ["false", "true"]);
    assert.equal(p.signOut, true);
    assert.match(p.border, /^1(\.5)?px$/); assert.equal(p.radius, "20px"); assert.match(p.shadow, /4px 4px 0px/);
    // A236 (b): the list, in place
    assert.match(p.notifRow, /^Notifications\s*1\b/);
    const n = d.peekNotifs;
    assert.deepEqual(n.list.map(([st]) => st), ["unread", "read"]);
    assert.match(n.list[0][1], /Kestrel Payments needs one answer from you/);
    assert.equal(n.markAll, true);
    assert.ok(n.links.some(([l, h]) => l === "What to send me" && h === "/app/profile/notifications"), "what to send stays one link away");
    assert.deepEqual(d.peekAfterMarkAll.list, ["read", "read"]); assert.equal(d.peekAfterMarkAll.badge, null, `${s}: Mark all read clears the badge`);
  }
});

test("d167PeekClosesEscOutsideLeave (real Chrome): leaving it, Esc, a press outside", { timeout: 300000 }, (t) => {
  const out = measured(t); if (!out) return;
  for (const s of SIZES) {
    const d = out[s].dock;
    assert.equal(d.peekAfterLeave, "false", `${s}: leaving closes it`);
    assert.equal(d.peekAfterPress, "true", `${s}: a press opens it`);
    assert.equal(d.peekAfterEsc, "false", `${s}: Esc closes it`);
    assert.equal(d.peekAfterPress2, "true");
    assert.equal(d.peekAfterOutside, "false", `${s}: a press outside closes it`);
  }
});
