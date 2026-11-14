// ⭐ A200 (46k, owner 11-13: "the content of the questions is going behind the dock, format it and also use the former font
// and styling. design the chat panel inline with design plan. also collapse the timeline panel when chat is open to make
// space"). Measured in a real Chrome by `scripts/fidelityShots.mjs --styles ask200` (Draft House at 1280 · 1440 · 1920 · 390,
// a synthetic held application's three questions open in Ask draft): nothing of the thread under the dock, the question in
// the held stepper's large type, Yes / No as depth boxes (no pills), the timeline folded while Ask draft is open and back
// after, no sideways scroll. Shots: docs/fidelity-shots/ask200-*.png.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
let probe = null;
function measured(t) {
  if (!probe) probe = JSON.parse(execFileSync(process.execPath, ["scripts/fidelityShots.mjs", "--styles", "ask200"],
    { encoding: "utf8", timeout: 280000, stdio: ["ignore", "pipe", "ignore"] }).trim().split("\n").pop());
  if (probe.skipped) { t.skip(probe.skipped); return null; }
  return probe;
}
const SIZES = ["1280", "1440", "1920", "phone"];

test("⭐ A200 (Chrome): at every width nothing of the questions thread sits under the dock, and nothing scrolls sideways", { timeout: 300000 }, (t) => {
  const p = measured(t); if (!p) return;
  for (const size of SIZES) {
    const n = p[size].node;
    assert.equal(n.first.threadShown, true, `${size}: the thread opened`);
    assert.deepEqual(n.first.underDock, [], `${size}: the first question is clear of the dock`);
    assert.deepEqual(n.draft.underDock, [], `${size}: the written answer and its suggestion are clear of the dock`);
    assert.equal(n.first.sideScroll, false, `${size}: no sideways scroll`);
    assert.match(n.draft.suggestion, /^I built the alerting/, `${size}: draft's suggestion shows in the thread, with its words`);
  }
});

test("⭐ A200 (Chrome): the question is in the stepper's large type; Yes / No are depth boxes, never pills", { timeout: 300000 }, (t) => {
  const p = measured(t); if (!p) return;
  for (const size of SIZES) {
    const n = p[size].node.first;
    assert.equal(n.qSize, 24, `${size}: the question at the stepper's 24 px`);
    assert.equal(n.qWeight, "600");
    assert.ok(n.choices.length === 2 && n.choices.every(c => /\bdbx\b/.test(c.cls) && c.h >= 48), `${size}: two depth boxes, 48 px tall`);
    assert.ok(n.choices.every(c => parseFloat(c.radius) < 20), `${size}: no capsule (D60)`);
  }
});

test("⭐ A200 (Chrome): the auto-apply timeline folds away while Ask draft is open and returns when it closes", { timeout: 300000 }, (t) => {
  const p = measured(t); if (!p) return;
  for (const size of ["1280", "1440", "1920"]) {
    assert.equal(p[size].node.first.timelineShown, false, `${size}: folded while the thread is open`);
    assert.equal(p[size].node.closed.askOpen, "false");
    assert.equal(p[size].node.closed.timelineShown, true, `${size}: back after Ask draft closes`);
  }
});

test("A200: the CSS — the thread's own classes, the dock kept left of the panel, the timeline's fold in Draft House's sheet", () => {
  const css = read("client/src/components/AppNav.css");
  assert.match(css, /\.appnav-ask__q \{ margin: 0; font-size: calc\(24px \* var\(--type-scale, 1\)\); line-height: 1\.25; font-weight: 600;/);
  assert.match(css, /@media \(min-width: 1280px\) \{\n  :root\[data-ask-open="true"\]\[data-dock-place="top"\] \.appnav-dock\[data-nav-dock\] \{\n    left: calc\(\(100vw - var\(--appnav-ask-w\)\) \/ 2\);/);
  // A201: below 1280 px Ask draft is a sheet ABOVE the dock (the phone padding rule it replaced is gone)
  assert.match(css, /@media not all and \(min-width: 1280px\) \{\n  \.appnav-ask \{ --appnav-ask-w: min\(420px, 100vw\); z-index: 256;/);
  const dh = read("client/src/components/DraftHouse.css");
  assert.match(dh, /:root\[data-ask-open="true"\] \.dh-main:not\(\[data-detail="true"\]\) > \.dht \{ display: none; \}/);
  const thread = read("client/src/components/AskDraftThread.jsx");
  assert.match(thread, /import DepthButton from "\.\/DepthButton\.jsx";/);
  assert.doesNotMatch(thread, /className="dh-|className="dht-/, "Draft House's classes stay in Draft House (A93)");
  assert.match(thread, /String\(r\?\.draft \|\| ""\)\.trim\(\) \? \{ state: "ready"/, "an answer with no draft is never an empty suggestion box");
  // ⭐ D190 (46m): the "isn't open yet" notice is gone altogether (T1 / T2 work for everyone), so nothing sits above a thread
  assert.doesNotMatch(read("client/src/components/AppNav.jsx"), /data-ask-draft-closed/);
  assert.match(thread, /String\(r\?\.draft \|\| ""\)\.trim\(\) \? \{ state: "ready"/, "an answer with no draft is never an empty suggestion");
});
