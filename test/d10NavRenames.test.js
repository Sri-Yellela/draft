// D10 (10-03): the top bar's card-game family — DAILY DECK · FULL HOUSE · DRAFT · THE TABLE — and no
// JOB PROFILES tab. Display strings only: every id and /app/* route stays (docs/BRAND.md).
//
// ⛔ Removing a tab must not orphan its page. Job Profiles is how a user adds a résumé, so the guard
// below pins the PAGE's route and every way in that is left once the tab is gone.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const app = read("client/src/App.jsx");
const topBar = read("client/src/components/TopBar.jsx");

const tabsBlock = () => app.slice(at(app, "const appTabs = ["), at(app, "];", at(app, "const appTabs = [")));

test("D10/D18: the bar reads Daily Deck · Full House · Draft House · The Table, in that order, ids unchanged", () => {
  const ids = [...tabsBlock().matchAll(/\{ id: "([^"]+)",\s*label: "([^"]+)" \}/g)].map(m => [m[1], m[2]]);
  assert.deepEqual(ids, [
    // ⭐ D152 (1) / (4), changed on purpose (11-04): the Daily Deck and Full House are ONE screen, one entry — Home.
    ["today", "Home"],
    ["auto-apply", "Home"],   // D18 amended D10's "Draft"
    // ⭐ D146 (changed on purpose, 11-03): The Table merged into Draft House — one entry; /app/database redirects.
    // ⭐ D105 P4 (changed on purpose): D102's navigation gains one place — the Atlas — after the card family.
    ["atlas", "Atlas"],
  ]);
});

test("D10: no Job Profiles TAB — but the page keeps its route and its ways in", () => {
  assert.doesNotMatch(tabsBlock(), /id: "job-profiles"/, "Job Profiles is back in the top bar");
  // The route: a route-only panel is in NAVIGABLE_TABS, so /app/job-profiles renders, not bounces.
  assert.match(app, /const ROUTE_ONLY_TABS = \[[^\]]*"job-profiles"[^\]]*\];/);
  assert.match(app, /activeTab === "job-profiles" && <JobProfilesPanel/);
  // The ways in: the Profile panel's SETTINGS group (D18; D149 moved the avatar menu into the Profile panel), Profile,
  // and the Daily Deck's set-up state.
  assert.match(topBar, />Settings<\/div>\s*<button onClick=\{\(\) => \{ onClose\(\); onTabChange\?\.\("job-profiles"\); \}\}[^\n]*\n[^\n]*\n\s*Job Profiles\s*\n/);
  assert.match(app, /onOpenJobProfiles=\{\(\) => handlePanelChange\("job-profiles"\)\}/);
  assert.match(read("client/src/panels/DeckView.jsx"), /\["\/app\/job-profiles", "Add your résumé →"\]/);
});

test("D10 → D145: the tab row is gone; the Dock / the Menu set each name on ONE line with its plain words under it", () => {
  // ⭐ D145 Step 3 (owner 11-03, changed on purpose): TabLabel (two-word names on two lines) went with the row.
  assert.doesNotMatch(topBar, /function TabLabel|<TabLabel /);
  const nav = read("client/src/components/AppNav.jsx");
  // ⭐ D156 (1c) (changed on purpose): the name is DOCK_NAMES' (draft / Home) or the section's own label.
  assert.match(nav, /<span className="appnav-name">\s*\{name\}/);
  assert.match(nav, /const name = DOCK_NAMES\[t\.id\] \|\| t\.label;/);
  // ⭐ D167 (owner 11-06, changed on purpose): NAMES ONLY — the plain line under each name is removed (test/d167Dock d167NoDescriptionsUnderNames).
  assert.doesNotMatch(nav, /NAV_PLAIN|className="appnav-plain"/);
});

test("D10: the bar is ~74px with a ~30px mark", () => {
  assert.match(topBar, /height: 74,/);
  assert.match(topBar, /<StampLogo size="nav"\/>/);
  // D47: the mark's sizes moved to styles/brandMark.js, shared with the sentence.
  assert.match(read("client/src/styles/brandMark.js"), /nav: 30/);
});

test("D10: in-app copy names the tabs by their new names", () => {
  const db = read("client/src/panels/DatabasePanel.jsx");
  const deck = read("client/src/panels/DeckView.jsx");
  for (const stale of [/(?:in|from the) Jobs tab/, /Save jobs on Today/]) assert.doesNotMatch(db, stale);
  assert.doesNotMatch(deck, />All jobs</);
  assert.doesNotMatch(deck, /"All jobs"\]/);
});
