// D39 (owner, 10-06) — THE PANEL PAIR: rigid positions, and Close closes.
//
// Observed with the posting panel left and the ATS card right: clicking the left panel swapped the two,
// the X swapped them instead of closing, and a background click closed one panel at a time.
//
// FOUND: usePanelHost assigned SLOTS BY FOCUS ORDER — "most recently focused takes slot 0, the
// rightmost" — rendered as CSS `order: -slot`. A pointerdown inside a panel focuses it, so a click
// inside the left panel moved it right; and the X's pointerdown swapped the pair under the pointer
// before its click landed, so the click hit the other panel. Deleted: positions now come from a fixed
// SPATIAL_ORDER (posting · PDF · ATS, left → right). Focus decides only z-order and the keyboard.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { slotsFor, lastOpenedOf, SPATIAL_ORDER } from "../client/src/hooks/usePanelHost.js";

const leftToRight = (focusOrder, capacity = 3) => [...slotsFor(focusOrder, capacity)].reverse();

test("D39 · a click INSIDE either panel moves nothing — the pair is posting LEFT, ATS RIGHT", () => {
  // Focus order is most-recent LAST: the user clicked the posting, then the ATS card, then the posting.
  for (const focus of [["jd", "ats"], ["ats", "jd"]]) {
    assert.deepEqual(leftToRight(focus), ["jd", "ats"], `focus ${focus.join(" → ")} moved a panel`);
  }
  assert.deepEqual(SPATIAL_ORDER, ["jd", "pdf", "ats"]);
});

test("D39 · opening in either order gives the same left / right", () => {
  assert.deepEqual(leftToRight(["jd", "ats"]), leftToRight(["ats", "jd"]));
  assert.deepEqual(leftToRight(["ats", "pdf", "jd"]), ["jd", "pdf", "ats"]);
});

test("D39 · the left X closes only the left; the right panel does not move — and the reverse", () => {
  // Slot 0 is the rightmost. With both open the ATS card is slot 0; with the posting closed it is STILL
  // slot 0 — it does not slide across to fill the gap. A lone posting panel is slot 0 too, but it is
  // the only panel, so the dock is its own width and it sits where a lone panel always has.
  assert.deepEqual(slotsFor(["jd", "ats"], 3), ["ats", "jd"]);
  assert.deepEqual(slotsFor(["ats"], 3), ["ats"], "closing the posting leaves the ATS card at slot 0, unmoved");
  assert.deepEqual(slotsFor(["jd"], 3), ["jd"], "closing the ATS card leaves the posting alone");
  // Each panel's X is wired to ITS OWN close — and the X's press can no longer swap the pair first.
  const jobs = fs.readFileSync("client/src/panels/JobsPanel.jsx", "utf8");
  assert.match(jobs, /<AtsReportPanel key="panel-ats" \{\.\.\.panelProps\("ats"\)\}\s+onClose=\{closeAtsPanel\}/);
  const shell = fs.readFileSync("client/src/components/PanelShell.jsx", "utf8");
  assert.match(shell, /<button onClick=\{onClose\}/, "the X is the panel's own close");
});

test("D39 · the backdrop and Escape close the MOST RECENTLY OPENED first, one at a time", () => {
  assert.equal(lastOpenedOf(["jd", "ats"], ["jd", "ats"]), "ats");
  assert.equal(lastOpenedOf(["ats", "jd"], ["jd", "ats"]), "jd");
  assert.equal(lastOpenedOf(["jd", "ats"], ["jd"]), "jd", "then the one before it");
  const jobs = fs.readFileSync("client/src/panels/JobsPanel.jsx", "utf8");
  assert.match(jobs, /panelDescriptors\.find\(d => d\.id === lastOpenedId\)\?\.close\?\.\(\);/);
  assert.match(jobs, /closesOnEscape: id === lastOpenedId,/);
  for (const f of ["client/src/components/JobDetailPanel.jsx", "client/src/panels/AtsReportPanel.jsx", "client/src/panels/SandboxPanel.jsx"]) {
    assert.match(fs.readFileSync(f, "utf8"), /closesOnEscape=\{closesOnEscape\}/, `${f} drops the Escape rule`);
  }
});

test("D39 · focus returns to what opened the panel", () => {
  const shell = fs.readFileSync("client/src/components/PanelShell.jsx", "utf8");
  assert.match(shell, /const opener = typeof document !== "undefined" \? document\.activeElement : null;/);
  assert.match(shell, /opener\.isConnected\) opener\.focus\?\.\(\{ preventScroll: true \}\)/);
});

test("D39 · a lone panel does NOT slide across — the closed neighbour's space is held (found by the A92 browser pass)", async () => {
  const { reserveAfterClose } = await import("../client/src/hooks/usePanelHost.js");
  const prev = { ids: ["jd", "ats"], widths: { jd: 560, ats: 560 }, reserve: {} };
  // The ATS card (right) closes: the posting keeps its place — 560 + the 12px gap held on its right.
  assert.deepEqual(reserveAfterClose(prev, ["jd"], 12), { jd: 572 });
  // The posting (left) closes: the ATS card is already rightmost — nothing to hold.
  assert.deepEqual(reserveAfterClose(prev, ["ats"], 12), { ats: 0 });
  // The hold lasts while nothing opens…
  assert.deepEqual(reserveAfterClose({ ids: ["jd"], widths: { jd: 560 }, reserve: { jd: 572 } }, ["jd"], 12), { jd: 572 });
  // …and a new open re-divides the dock.
  assert.deepEqual(reserveAfterClose({ ids: ["jd"], widths: { jd: 560 }, reserve: { jd: 572 } }, ["jd", "ats"], 12), { jd: 0, ats: 0 });
  const shell = fs.readFileSync("client/src/components/PanelShell.jsx", "utf8");
  assert.match(shell, /marginRight: fullScreen \? 0 : Math\.round\(reserveRight\),/);
  for (const f of ["client/src/components/JobDetailPanel.jsx", "client/src/panels/AtsReportPanel.jsx", "client/src/panels/SandboxPanel.jsx"]) {
    assert.match(fs.readFileSync(f, "utf8"), /reserveRight=\{reserveRight\}/, `${f} drops the hold`);
  }
});
