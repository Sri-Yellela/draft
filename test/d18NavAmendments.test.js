// D18 (owner, 10-03) — amends D10 and D6. AUTO APPLY reads DRAFT HOUSE (it rhymes with Full House
// beside it, so the card family holds across all four tabs); NO tab carries a symbol (the /d mark on
// the tab read as the same thing as the /draft logo beside it); Job Profiles lives in SETTINGS (the
// avatar menu's Settings group), so the route-only page is not an orphan; Recruiter is not a user tab.
//
// Display strings only: ids and /app/* routes stay (docs/BRAND.md).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const app = read("client/src/App.jsx");
const topBar = read("client/src/components/TopBar.jsx");

const tabsBlock = () => app.slice(at(app, "const appTabs = ["), at(app, "];", at(app, "const appTabs = [")));
// The function that decorates the tab row (the attention badge) — the ONE place a tab label can
// become a ReactNode, so the one place a symbol could come back.
const decorator = () => app.slice(at(app, "function AppTopBar("), at(app, "return <TopBar {...props} tabs={decorated} />;"));

test("D18: the AUTO APPLY tab reads Draft House — four two-word labels, ids unchanged", () => {
  const labels = [...tabsBlock().matchAll(/\{ id: "([^"]+)",\s*label: "([^"]+)" \}/g)].map(m => m[2]);
  // ⭐ D105 P4 (changed on purpose): the Atlas joins the row after the card family (D102's navigation gains one place).
  // ⭐ D146 (changed on purpose, 11-03): The Table merged into Draft House — one entry.
  // ⭐ D152 (1) / (4), changed on purpose: Daily Deck + Full House = Home (one word, like Atlas).
  assert.deepEqual(labels, ["Home", "Home", "Atlas"]);
  for (const l of labels.filter(l => l !== "Atlas" && l !== "Home")) assert.equal(l.split(" ").length, 2, `"${l}" is not a two-word label`);
  assert.match(tabsBlock(), /\{ id: "auto-apply",\s*label: "Home" \}/);
});

test("D18: NO symbol on any tab — the Draft House count rides on the button as data (D145: AppNav draws it)", () => {
  const fn = decorator();
  assert.doesNotMatch(fn, /<DraftMark/, "the Home tab carries the /d mark again (D18: no symbol on any tab)");
  assert.doesNotMatch(fn, /<svg|<img|[★⏳✦]/u, "a tab carries a symbol (D18)");
  // ⭐ D145 (changed on purpose): the count and its sentence are data on the tab, not a decorated label.
  assert.match(fn, /t\.id === "auto-apply" \? \{ \.\.\.t, badge: needsAttentionCount, badgeLabel: attention \} : t/);
  const nav = read("client/src/components/AppNav.jsx");
  // 45n D145 / D152 decision (10) (ffd57262): the Menu's "Main menu" panel is retired — only the dock's nav is left (pin moved on purpose).
  assert.doesNotMatch(nav, /<nav aria-label="Main menu"/);
  // ⭐ D197 #1 (pin moved on purpose): the dock's <nav> is the plate's Dock (plate/Shell.jsx) — the rail and the bar
  const shell = read("client/src/plate/Shell.jsx");
  for (const tag of ["<nav aria-label=\"Main\" className=\"pl-dock\" ref", "<nav aria-label=\"Main\" className=\"pl-dock pl-dock--bar\""]) {
    const row = shell.slice(at(shell, tag), at(shell, "</nav>", at(shell, tag)));
    assert.ok(row.length > 20, tag);
    assert.doesNotMatch(row, /<DraftMark|<svg|<img/);
  }
});

test("D18: Job Profiles lives in SETTINGS — the avatar menu's Settings group; the page stays route-only", () => {
  const settingsAt = at(topBar, ">Settings</div>");
  const group = topBar.slice(settingsAt, at(topBar, "Sign out", settingsAt));
  assert.match(group, /onTabChange\?\.\("job-profiles"\)[\s\S]{0,200}Job Profiles/);
  // Settings holds the other settings too — it is a group, not a lone relabelled link.
  assert.match(group, /Account &amp; security/);
  assert.match(group, /Integrations/);
  // Not a tab, still a route.
  assert.doesNotMatch(tabsBlock(), /id: "job-profiles"/);
  assert.match(app, /const ROUTE_ONLY_TABS = \[[^\]]*"job-profiles"[^\]]*\];/);
  // The old "Manage Job Profiles" link beside the profile switcher is gone — one home, in Settings.
  assert.doesNotMatch(topBar, /Manage Job Profiles/);
});

test("D18: Recruiter is not a user tab (D5 holds)", () => {
  assert.doesNotMatch(tabsBlock(), /id: "recruiter"/);
});

test("D18: no display string still sends the user to 'the Draft tab'", () => {
  const files = execFileSync("git", ["ls-files", "--", "client/src", "routes", "services", "server.js"], { encoding: "utf8" })
    .split("\n").filter(f => /\.(jsx?|mjs)$/.test(f));
  assert.ok(files.length > 100, `the scan sees only ${files.length} files`);
  const hits = [];
  for (const f of files) {
    read(f).split("\n").forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;           // comments describe the code
      if (/\b(on|in|from|to) the Draft tab\b/.test(line)) hits.push(`${f}:${i + 1}: ${line.trim().slice(0, 120)}`);
    });
  }
  assert.deepEqual(hits, [], "a display string names the old tab — it is Home (D18):\n" + hits.join("\n"));
  // D149 (11-03) changed this on purpose: the sketch's h1 at 44 px on the deck's page-title type (DH_TITLE).
  // ⛔ 47j w1-retire (changed on purpose): R3 — the classic "Home" h1 is deleted; the page is the ledger (its header, plate/Ledger.jsx), and
  // the dock still names the place Home
  assert.match(read("client/src/panels/AutoApplyPanel.jsx"), /<LedgerHeader week=/);
  assert.match(read("client/src/components/AppNav.jsx"), /"auto-apply" : "Home"/);
});

test("O56e → D145: the phone's tab row is gone — the Menu (or the dock, chosen) reaches every section at any width", () => {
  // ⭐ D145 Step 3 (changed on purpose): no row to tighten or fade. ⭐ D152 (4), changed on purpose: "Automatic" is the
  // dock at every width now — on a touch screen it opens from the left-edge handle (d152Home's real-Chrome walk at 390).
  assert.doesNotMatch(topBar, /tabsMore|TAB_ROW_FADE|className="tbar-nav"/);
  const css = read("client/src/components/AppNav.css");
  // 45n D145 / D152 decision (10) (ffd57262): the Menu and data-navigation are retired — the dock at every width (pin moved on purpose).
  assert.match(css, /:root \{ --appnav-dock: flex; --appnav-mark: none; \}/);
  // ⭐ D156 (3), changed on purpose: the dock is an always-visible rail of icons (no edge handle) — a phone keeps it, slimmer.
  // ⭐ D163, changed on purpose: no `top` of its own — the rail is vertically centred at every width (test/d163UseTheSpace).
  // ⭐ D167 (owner 11-06, changed on purpose): phones always put the dock AT THE TOP, centred, icons only (data-dock-place="phone").
  // ⭐ D197 #1 · A237 (the Shell board, changed on purpose): below 980 px the rail becomes the BOTTOM bar with the same items,
  // and the area nav's top bar holds the /d tile and search (test/d167Dock d197ShellPlace).
  assert.match(css, /\.appnav-plate > nav\[data-nav-dock\]\[data-place="phone"\] \{\n  position: fixed; left: 0; right: 0; bottom: 0;/);
});

