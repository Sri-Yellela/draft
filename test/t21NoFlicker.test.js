// T21 (owner report (e), 10-15) · NO FLICKER — "the Fill button flickers while filling".
//
// MEASURED FIRST, in a real Chrome (test-support/walks/fillFlicker.mjs, one Workday step of 13 rows): the dock's own
// "Fill this page" press threw the whole dock frame away and re-made it 4 times, re-made the Fill button 4 times,
// re-mounted the Fill view (a new shadow root — its scroll back at the top) for the step's draw and again for the end,
// and re-painted the status line (its pulsing icon restarting) on every call. Now every view draws its markup and hands
// it to ONE patch (dock.js morph, __draftDock.morph): unchanged nodes are left alone. The bound below is the walk's.
// Synthetic person (Ada Example). The real-Chrome half SKIPS, with its reason, where there is no Chrome.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { findChrome } from "../test-support/extensionBrowser.mjs";
import { runScenario } from "../test-support/walkExtension.mjs";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("⛔ T21: the dock frame, the Fill view and the status line are PATCHED, never thrown away and re-made", () => {
  const dock = read("extension/dock.js");
  const paint = dock.slice(at(dock, "const paint = () => {"), at(dock, "// ── pointer: drag by the header"));
  assert.doesNotMatch(paint, /fr\.innerHTML\s*=/, "the frame is patched (morph), not re-made");
  assert.match(paint, /morph\(fr, /);
  assert.match(dock, /isTop, ensure,\n\s*\/\/ ⭐ T21[^\n]*\n\s*morph,/, "ONE patch, shared with the views");

  const ov = read("extension/review-overlay.js");
  const render = ov.slice(at(ov, "export function renderOverlay("), at(ov, "export function fieldsHeld("));
  assert.match(render, /reuse: runId/, "a later draw of the same fill keeps its view");
  assert.doesNotMatch(render, /panel\.innerHTML\s*=\s*`/, "the panel's rows are patched");
  assert.match(render, /D\.morph\(panel, html\)/);

  const badge = read("extension/autofill-badge.js");
  const rb = badge.slice(at(badge, "export function renderBadge("), at(badge, "export function goToMissingRequired("));
  assert.doesNotMatch(rb, /root\.innerHTML\s*=\s*`/, "the status line is patched");
  assert.match(rb, /DK\.morph\(root, html\)/);
});

test("⛔ T21: ONE fill state — the Fill button holds its width and says how far it got; a same-words status draws nothing", () => {
  const dock = read("extension/dock.js");
  assert.match(dock, /\.btn\[data-role="fill"\] \{ min-width: [\d.]+em;[^}]*tabular-nums/, "a fixed width, tabular digits");
  assert.match(dock, /`Filling… \$\{f\.fillCount\.filled\} of \$\{f\.fillCount\.total\}`/);
  const st = dock.slice(at(dock, "statusText(text) {"), at(dock, "select: (tab) => select(tab, { load: false }),"));
  assert.match(st, /if \(next === frame\.statusText\) return;/);
  const popup = read("extension/popup.js");
  const fill = popup.slice(at(popup, "async function fillActiveTab() {"), at(popup, "let fillAfterCapture = false;"));
  assert.match(fill, /getAttribute\('aria-busy'\) === 'true'\) return;/, "a second press while it runs starts nothing");
  assert.match(fill, /btn\.style\.minWidth = `\$\{btn\.offsetWidth\}px`/, "the popup's button holds its width");
});

const chromeBin = await findChrome();
test("⛔ T21 in a REAL Chrome — through a fill (the popup's and the dock's own press): ≤ 1 frame repaint, 1 Fill view, 1 status repaint, 1 button node; the Fill tab never blank",
  { skip: chromeBin.skip || false, timeout: 400000 }, async () => {
    const lines = [];
    const r = await runScenario("fillFlicker", { log: (l) => lines.push(l) });
    if (r.skipped) return;
    assert.equal(r.failures, 0, lines.filter(l => l.startsWith("FAIL") || l.startsWith("OBSERVED")).join("\n"));
  });
