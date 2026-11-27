import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

/**
 * TASK AH2 — four tabs, four surfaces, one session.
 *
 * The behavioural proof is scripts/ah2MultiTab.mjs, which drives real Chrome: five surfaces in five
 * tabs at once, a real ctrl-click that really opens a sixth, and two tabs showing two different job
 * details. These tests pin the shapes that made it possible, because two of the three defects were
 * invisible to any amount of source reading and one of them was the ABSENCE of markup.
 *
 * WHAT WAS ACTUALLY WRONG, which is not what the report assumed
 * The panels were already deep-linkable — /app/auto-apply has always rendered Auto Apply when you
 * reach it. What did not exist was any way to GET a second tab: the tab row was
 * `<button onClick={navigate}>`, and a button cannot be ctrl/cmd-clicked, middle-clicked or
 * "Open link in new tab"-ed, and is not a link to assistive tech either.
 *
 * The two genuine bugs:
 *   - a job detail had NO ADDRESS. selectedJob was React state; /app/jobs/<id> redirected to the
 *     bare board. One selectedJob per mount, so two details could never coexist.
 *   - the board's view state was shared PER ORIGIN. rm_jobs_profile_ui_v1 held boardTab,
 *     localSearch, sortBy, currentPage and every filter in localStorage keyed by profile, so two
 *     tabs overwrote each other. currentPage cannot be shared by construction.
 */

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const APP      = read("client/src/App.jsx");
const TOPBAR   = read("client/src/components/TopBar.jsx");
const JOBCARD  = read("client/src/components/JobCard.jsx");
const PANEL    = read("client/src/panels/JobsPanel.jsx");
const JOBURL   = read("client/src/lib/jobUrl.js");
const CONTEXT  = read("client/src/contexts/JobBoardContext.jsx");
const SERVER   = read("server.js");

// ── 1. the tab row is openable in a new tab ──────────────────────────────────────────────────
test("every nav tab is a real link, not a button", () => {
  // ⭐ D145: the tab row is the Dock / the Menu now (components/AppNav.jsx) — the same real links.
  const NAV = fs.readFileSync("client/src/components/AppNav.jsx", "utf8");
  // ⭐ D167 (owner 11-06, changed on purpose): the href is the section's own, or Interview's page (the dock's sixth place).
  // 45o D180 P1 (4aed9e88): Network's place gets its own page the same way (pin moved on purpose).
  // 46f: Feed and Messages' places get their own pages the same way (pin moved on purpose).
  // ⭐ D197 #1 (changed on purpose): the places are drawn by the plate's Dock (plate/Shell.jsx) — the same hrefs, real <a>s.
  assert.match(NAV, /const pathOf = \(id\) => \(id === "interview" \? INTERVIEW_PATH : id === "network" \? NETWORK_PATH : id === "feed" \? FEED_PATH : id === "messages" \? MESSAGES_PATH : undefined\);/);
  assert.match(NAV, /const href = hrefForTab\?\.\(t\.id\) \|\| pathOf\(t\.id\);/);
  const SHELL = fs.readFileSync("client/src/plate/Shell.jsx", "utf8");
  assert.match(SHELL, /<a \{\.\.\.common\} href=\{it\.href\} aria-current=\{current === it\.id \? "page" : undefined\}/);
  assert.match(SHELL, /if \(it\.onPress && !it\.href\) return <button type="button"/, "a button only for an item with no page (Profile → the peek, Ask draft → Tiny)");
  assert.doesNotMatch(NAV, /<button key=\{t\.id\}/);
  assert.doesNotMatch(TOPBAR, /<button key=\{t\.id\} onClick=\{\(\) => onTabChange/);
});

test("a modified click is left to the browser, a plain click still navigates in-app", () => {
  const NAV = fs.readFileSync("client/src/components/AppNav.jsx", "utf8");
  // ⭐ D197 #1 (pin moved on purpose): the plate Dock's click — a modified click is left to the browser
  const SHELL = fs.readFileSync("client/src/plate/Shell.jsx", "utf8");
  const nav = SHELL.slice(at(SHELL, "export function Dock("), at(SHELL, "/** One chip:"));
  assert.match(SHELL, /const plainClick = \(e\) => !\(e\.metaKey \|\| e\.ctrlKey \|\| e\.shiftKey \|\| e\.altKey \|\| e\.button !== 0\);/);
  assert.match(nav, /if \(!onGo \|\| !plainClick\(e\)\) return;/);
  assert.match(nav, /e\.preventDefault\(\); onGo\(it\.id, it\.href\);/);
  // ⭐ D156 (3): a press also folds the expanded dock back to its icons. ⭐ D167 (owner 11-06, changed on purpose): and closes the peek; Interview's page
  // is navigated to directly while it is not a tab of its own.
  // 45n D145 / D152 decision (10) (ffd57262): the Menu (setOpen) is retired — a press folds the dock and closes the peek (pin moved on purpose).
  assert.match(NAV, /const go = useCallback\(\(id, href\) => \{\r?\n\s+setWide\(false\); closePeek\(\);/);
});

test("the href and the click resolve through ONE mapping", () => {
  // A nav whose href points somewhere its own onClick does not is worse than no href at all:
  // left-click and middle-click would land in different places and only one of them would be a bug
  // anyone noticed.
  assert.match(APP, /const pathForTab = useCallback\(\(tab\) => \{/);
  assert.match(APP, /if \(tab === "jobs" \|\| tab === "console"\) return consolePath;/);
  assert.match(APP, /return NAVIGABLE_TABS\.has\(tab\) \? `\/app\/\$\{tab\}` : null;/);
  assert.match(APP, /hrefForTab=\{pathForTab\}/);
  assert.match(APP, /onTabChange=\{handlePanelChange\}/);
  // handlePanelChange must still route through the same rule rather than keeping its own copy.
  const handler = APP.slice(at(APP, "const handlePanelChange = useCallback"), at(APP, "useInactivityLogout(handleLogout"));   // ⛔ 47j w1-shell (changed on purpose): handleProfileActivate left with the account panel
  assert.match(handler, /NAVIGABLE_TABS\.has\(tab\)/);
});

// ── 2. a job detail has an address ───────────────────────────────────────────────────────────
// ⛔ 47m (changed on purpose): "the job-detail address is defined in exactly one place" retired — the surface it pinned was rebuilt in the plate system (47m M5).

test("a job card's title carries that address", () => {
  assert.match(JOBCARD, /function JobTitleLink\(\{ job, isLoggedOut, style, children \}\)/);
  assert.match(JOBCARD, /const href = jobDetailHref\(job\.jobId \|\| job\.id\)/);
  // Logged out there is no /app to link into, and the card's whole click already goes to the
  // employer's posting.
  assert.match(JOBCARD, /if \(isLoggedOut \|\| !href\) return <div style=\{style\}>\{children\}<\/div>/);
  // Used at BOTH title render sites — the card has a tier-1 and a tier-2 layout, and fixing one
  // would leave the affordance missing at whichever width renders the other.
  assert.equal((JOBCARD.match(/<JobTitleLink job=\{job\} isLoggedOut=\{isLoggedOut\}/g) || []).length, 2);
  assert.doesNotMatch(JOBCARD, /whiteSpace:"nowrap" \}\}>\n\s*\{job\.title\}\n\s*<\/div>/);
});

// ⛔ 47m (changed on purpose): "the panel resolves a deep-linked job BY ID, not by hoping it is on the page" retired — the surface it pinned was rebuilt in the plate system (47m M5).

// ⛔ 47m (changed on purpose): "the deep link survives the profile-cache restore that used to undo it" retired — the surface it pinned was rebuilt in the plate system (47m M5).

// ⛔ 47m (changed on purpose): "the deep link ends on an EXPLICIT signal, never on a timing guess" retired — the surface it pinned was rebuilt in the plate system (47m M5).

// ── 3. two tabs on the board do not fight ────────────────────────────────────────────────────
test("the board's view snapshot is per tab, with the origin-wide copy as a seed", () => {
  const reader = PANEL.slice(at(PANEL, "function readProfileUiCache"), at(PANEL, "function writeProfileUiCache"));
  // sessionStorage FIRST. Reading localStorage first would make the shared copy authoritative
  // again and reintroduce exactly the clobbering this fixes.
  assert.ok(reader.indexOf("sessionStorage.getItem") < reader.indexOf("localStorage.getItem"));

  const writer = PANEL.slice(at(PANEL, "function writeProfileUiCache"), at(PANEL, "// Upstream scrape requests"));
  assert.match(writer, /put\(sessionStorage\)/);
  assert.match(writer, /put\(localStorage\)/);
  // Two independent try blocks: a full localStorage quota must not be able to take the tab's own
  // copy down with it, which one shared try would have done.
  assert.match(writer, /const put = \(store\) => \{\s*try \{/);
});

test("currentPage is in the per-tab snapshot — it is the key that cannot be shared", () => {
  const writer = PANEL.slice(at(PANEL, "function writeProfileUiCache"), at(PANEL, "// Upstream scrape requests"));
  assert.match(writer, /"boardTab", "localSearch", "sortBy", "currentPage"/);
});

test("deleting a profile clears BOTH stores", () => {
  const fn = CONTEXT.slice(at(CONTEXT, "const deleteProfileCache"), at(CONTEXT, "return ("));
  assert.match(fn, /for \(const store of \[sessionStorage, localStorage\]\)/);
  // Clearing only the seed left a deleted profile's board state alive in whichever tab had it open.
  assert.match(fn, /delete all\[String\(profileId\)\]/);
});
