// ⭐ 46y · HOME TO docs/sketches/home-sketch.html (D167 on D146's tracker): the pieces the sketch adds — the line under the
// title, the Needs-you cards, the filter counts (lib/trackerRows.js, pure) — and where Home draws them
// (panels/AutoApplyPanel.jsx): the auto-apply bar with the mode, Pause and Settings; the cards; Applications · Inbox.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";
import { filterCounts, homeSummary, homeNeeds, TRACKER_FILTERS } from "../client/src/lib/trackerRows.js";

const NOW = Date.parse("2026-11-20T15:00:00Z");
const row = (o) => ({ key: o.key, stage: o.stage, filter: o.filter, company: o.company || "Acme", title: o.title || "Engineer",
  status: o.status || "", at: o.at ?? NOW - 3600000, node: o.node || null });
const ROWS = [
  row({ key: "q", stage: "question", filter: "needs", company: "Halcyon", node: { question: { question: "Are you open to relocating?" } } }),
  row({ key: "r", stage: "ready", filter: "needs", company: "Quanta", title: "Data Engineer" }),
  row({ key: "w", stage: "working", filter: "progress" }),
  row({ key: "i", stage: "interview", filter: "replies", company: "Vireo", title: "Platform Engineer", status: "Interview Tue 24 Nov, 2 PM",
    node: { ref: { interview: { ymd: "2026-11-24", time: "14:00" } } } }),
  row({ key: "old", stage: "interview", filter: "replies", node: { ref: { interview: { ymd: "2026-11-02" } } }, at: Date.parse("2026-10-20T12:00:00Z") }),
  row({ key: "s", stage: "sent", filter: "sent" }),
];

test("home46y · filterCounts — every filter's count, All = every row", () => {
  const c = filterCounts(ROWS);
  assert.deepEqual(Object.keys(c), TRACKER_FILTERS.map(([id]) => id));
  assert.deepEqual(c, { all: 6, needs: 2, progress: 1, sent: 1, replies: 2, stopped: 0 });
});

test("home46y · homeSummary — this month · replies · interviews coming up; a 0 part is left out", () => {
  assert.equal(homeSummary(ROWS, NOW), "5 this month · 2 replies · 1 interview coming up");
  assert.equal(homeSummary([], NOW), "");
  assert.equal(homeSummary([ROWS[5]], NOW), "1 this month");
});

test("home46y · homeNeeds — Needs you, the next interview, Ready to send, in the sketch's order and words", () => {
  const n = homeNeeds(ROWS, NOW);
  assert.deepEqual(n.map(x => x.kind), ["need", "interview", "ready"]);
  assert.deepEqual([n[0].eyebrow, n[0].title, n[0].line, n[0].label, n[0].act], ["Needs you", "Halcyon", "One question only you can answer: Are you open to relocating?", "Answer it", "open"]);
  assert.deepEqual([n[1].eyebrow, n[1].title, n[1].label, n[1].act], ["Interview on Tuesday", "Vireo · Platform Engineer", "Prepare in Interview", "interview"]);
  assert.deepEqual([n[2].eyebrow, n[2].title, n[2].line, n[2].label], ["Ready to send", "Quanta · Data Engineer", "Everything is filled. Submit when you're happy.", "Review and submit"]);
  assert.deepEqual(homeNeeds([ROWS[2], ROWS[5]], NOW), [], "nothing needs the person → no cards");
});

test("home46y · Home draws the bar, the cards and the two parts (AutoApplyPanel)", () => {
  const panel = fs.readFileSync("client/src/panels/AutoApplyPanel.jsx", "utf8");
  const head = panel.slice(at(panel, '<header className="dh-head"'), at(panel, "</header>"));
  assert.doesNotMatch(head, /data-mode="ask"/, "the mode left the header");
  assert.doesNotMatch(head, /data-settings-open=""/, "Settings left the header");
  assert.match(head, /data-home-summary=""/);
  const bar = panel.slice(at(panel, 'data-home-auto=""'), at(panel, 'data-home-needs=""'));
  for (const piece of ['data-mode="ask"', 'data-mode="auto"', 'data-stop-everything=""', 'data-settings-open=""', '"Auto-apply is running"', '"Auto-apply is paused"'])
    assert.ok(bar.includes(piece), `the auto-apply bar holds ${piece}`);
  assert.equal(panel.split('data-stop-everything=""').length - 1, 1, "ONE Pause (A93): it moved, it was not copied");
  assert.equal(panel.split('data-settings-open=""').length - 1, 1, "ONE Settings");
  assert.match(panel, /data-home-tab="apps"[\s\S]*data-home-tab="inbox"/);
  assert.match(panel, /<ApplicationInbox theme=\{theme\} onSeen=\{inboxSeen\} \/>/, "the Inbox is Home's second part — the one ApplicationInbox");
  assert.doesNotMatch(panel, /<TrackerCounts/, "the counts row is gone (the filters carry the counts)");
  const css = fs.readFileSync("client/src/components/DraftHouse.css", "utf8");
  assert.match(css, /\.dh-main \{ display: grid; grid-template-columns: minmax\(0, 1fr\) 320px;/, "the sketch's .grid2 320 px aside");
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.dh-live \{ animation: none; \} \}/, "the live dot rests under Reduce motion");
});

test("home46y · the Inbox list: rows open in place, the category as a dot + word, the select only inside", () => {
  const ui = fs.readFileSync("client/src/components/ApplicationInbox.jsx", "utf8").replace(/\r\n/g, "\n");
  assert.match(ui, /<StatusDot ring=\{RING\[m\.category\] \|\| "stop"\} word=\{LABEL\[m\.category\] \|\| m\.category\} \/>/);
  const det = ui.slice(at(ui, "{open && ("), at(ui, "</div>\n              )}"));
  assert.match(det, /File as/, "re-filing lives in the opened row");
  assert.match(ui, /placeholder="Search the Inbox"/);
});
