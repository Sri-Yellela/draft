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
  assert.deepEqual(labels, ["Daily Deck", "Full House", "Draft House", "The Table"]);
  // Every label is two words, so TabLabel sets each on two lines — the same format across the row.
  for (const l of labels) assert.equal(l.split(" ").length, 2, `"${l}" is not a two-word label`);
  assert.match(tabsBlock(), /\{ id: "auto-apply",\s*label: "Draft House" \}/);
});

test("D18: NO symbol on any tab — the decorated Draft House label is text + the count, set by TabLabel", () => {
  const fn = decorator();
  assert.doesNotMatch(fn, /<DraftMark/, "the Draft House tab carries the /d mark again (D18: no symbol on any tab)");
  assert.doesNotMatch(fn, /<svg|<img|[★⏳✦]/u, "a tab carries a symbol (D18)");
  // The decorated label still goes through the shared two-line setter, so it matches the other three.
  assert.match(fn, /<TabLabel label=\{t\.label\}\/>/);
  assert.match(app, /import TopBar, \{ TabLabel \}\s+from "\.\/components\/TopBar\.jsx";/);
  assert.match(topBar, /export function TabLabel\(\{ label \}\)/);
  // The tab row renders labels and nothing else beside them.
  const row = topBar.slice(at(topBar, '<nav aria-label="Main"'), at(topBar, "</nav>", at(topBar, '<nav aria-label="Main"')));
  assert.doesNotMatch(row, /<DraftMark|<svg|<img/);
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
  assert.deepEqual(hits, [], "a display string names the old tab — it is Draft House (D18):\n" + hits.join("\n"));
  assert.match(read("client/src/panels/AutoApplyPanel.jsx"), /<h2 style=\{TYPE\.PAGE_TITLE\}>\s*Draft House\s*</);
});

test("O56e: on a phone the tab row tightens and FADES at the edge that still hides a tab — it reads as scrollable", () => {
  // Four two-line tabs + the full wordmark + the avatar need ~470px; a 390px phone shows ~3.5 tabs.
  // The row has always scrolled; nothing said so, and "The Table" sat wholly past the edge.
  assert.match(topBar, /const narrow = vw < 560;/);
  assert.match(topBar, /padding: narrow \? "5px 8px" : "5px 14px"/);
  // The cue is driven by a measurement, not by the width alone: nothing fades when everything fits.
  assert.match(topBar, /setTabsMore\(!!el && el\.scrollLeft \+ el\.clientWidth < el\.scrollWidth - 2\)/);
  assert.match(topBar, /<nav aria-label="Main" ref=\{tabRowRef\} onScroll=\{measureTabs\}/);
  assert.match(topBar, /\.\.\.\(tabsMore \? \{ WebkitMaskImage: TAB_ROW_FADE, maskImage: TAB_ROW_FADE \} : null\)/);
  // Scrolling, not wrapping, still keeps every tab reachable.
  assert.match(topBar, /overflowX: "auto"/);
});
