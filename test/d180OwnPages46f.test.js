// ⭐ 46f (owner 11-11: "build a page for feed and messaging into the menu with their own pages and interface fully built,
// build a generic one matching current theme and requirements, no sketch needed for now") · Feed and Messages are their own
// places: dock items beside Network (under the same switch), /app/feed and /app/messages routed in App, each page says
// "This isn't available yet." while the switch is off, Messages draws the list beside the open conversation (?thread=),
// the old ?tab= addresses and the unread notification land on the new pages, and the module manifest lists every file.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const NAV = read("client/src/components/AppNav.jsx");
const APP = read("client/src/App.jsx");
const FEED = read("client/src/pages/network/FeedPage.jsx");
const MSGS = read("client/src/pages/network/MessagesPage.jsx");
const PANE = read("client/src/pages/network/MessagesPane.jsx");
const SWITCH = read("client/src/pages/network/networkSwitch.js");

test("d180OwnPages46f: Feed and Messages join the dock after Network, only while the switch is on; the unread count is Messages'", () => {
  // ⭐ D197 #1: placesOf is unchanged; the dock that drew it is the plate's Dock now (NavItems retired — pin moved on purpose)
  const places = NAV.slice(at(NAV, "function placesOf("), at(NAV, "const initialsOf ="));
  assert.match(places, /if \(network && !list\.some\(\(t\) => t\.id === "network"\)\) \{/, "the same switch as Network");
  assert.match(places, /\{ id: "network", label: "Network" \}, \{ id: "feed", label: "Feed" \},\s*\{ id: "messages", label: "Messages", badge: netUnread \|\| 0,/);
  assert.doesNotMatch(places, /id: "network", label: "Network", badge/, "the badge moved to Messages");
  assert.match(NAV, /export const FEED_PATH = "\/app\/feed";/);
  assert.match(NAV, /export const MESSAGES_PATH = "\/app\/messages";/);
  assert.match(NAV, /if \(id === "feed" \|\| id === "messages"\) \{ navigate\(href \|\| \(id === "feed" \? FEED_PATH : MESSAGES_PATH\)\); return; \}/);
});

test("d180OwnPages46f: App routes /app/feed and /app/messages to their pages", () => {
  assert.match(APP, /"feed", "messages",/, "navigable");
  assert.match(APP, /\{activeTab === "feed" && <AreaErrorBoundary area="feed" \{\.\.\.areaGuard\}><FeedPage\/><\/AreaErrorBoundary>\}/);
  assert.match(APP, /\{activeTab === "messages" && <AreaErrorBoundary area="messages" \{\.\.\.areaGuard\}><MessagesPage\/><\/AreaErrorBoundary>\}/);
});

test("d180OwnPages46f: both pages ask the switch first and say so when off — a failure reads as off", () => {
  assert.match(SWITCH, /api\("\/api\/network\/status"\)\.then\(r => \{ if \(live\) setOn\(!!r\?\.enabled\); \}\)\.catch\(\(\) => \{ if \(live\) setOn\(false\); \}\)/);
  for (const [name, src] of [["Feed", FEED], ["Messages", MSGS]]) {
    assert.match(src, /const on = useNetworkOn\(\);/, name);
    // ⭐ 46q A222 (owner 11-16, changed on purpose): off → the board, never a dead-end page.
    assert.match(src, /if \(!on\) return <Navigate to="\/app\/jobs" replace data-network-off="" \/>;/, `${name}: off goes to the board`);
    assert.doesNotMatch(src, /callModel|anthropic|dangerouslySetInnerHTML/i, name);
  }
});

test("d180OwnPages46f: Feed = the posts column beside What you share; Messages = the list beside the open conversation", () => {
  assert.match(FEED, /<div className="net-cols__main"><FeedPane share=\{false\} \/><\/div>/);
  assert.match(FEED, /<aside className="net-cols__side"[^>]*>\s*<WhatYouShare \/>/);
  assert.match(MSGS, /const open = Number\(new URLSearchParams\(location\.search\)\.get\("thread"\)\) \|\| null;/);
  assert.match(MSGS, /<Inbox box=\{box\} said=\{said\} openId=\{open\} onOpen=\{openThread\} \/>/);
  assert.match(MSGS, /<Thread key=\{open\} id=\{open\}/);
  assert.match(PANE, /export \{ Thread \};/);
  assert.match(PANE, /export function useInbox\(\) \{/);
  assert.match(PANE, /useSyncEvents\(\{ network_message: \(\) => load\(\) \}\);/, "the list stays live");
  assert.match(PANE, /aria-current=\{Number\(openId\) === Number\(t\.id\) \? "true" : undefined\}/, "the open one is marked");
  const css = read("client/src/pages/network/NetworkPage.css");
  assert.match(css, /\.msg-cols--open \.msg-cols__list, \.msg-cols:not\(\.msg-cols--open\) \.msg-cols__thread \{ display: none; \}/, "a phone shows one or the other");
  assert.doesNotMatch(css, /999px/, "D60 (test/d60NoPills.test.js guards the rest)");
});

test("d180OwnPages46f: old addresses and the unread notification reach the new pages; the manifest lists the files", () => {
  assert.match(read("services/notify.js"), /url: "\/app\/messages", defaults: \{ push: false, email: false \}/);
  const net = read("client/src/pages/network/NetworkPage.jsx");
  assert.match(net, /navigate\(`\/app\/messages\?thread=\$\{r\.threadId\}`\)/, "Message from People opens the conversation on Messages");
  const man = read("client/src/modules.manifest.js");
  for (const f of ["FeedPage.jsx", "MessagesPage.jsx", "networkSwitch.js"]) assert.ok(man.includes(`"pages/network/${f}"`), f);
});
