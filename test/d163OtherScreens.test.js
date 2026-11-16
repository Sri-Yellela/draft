// ⭐ D163 · USE THE SPACE, the remaining screens (owner 11-05: "the menu dock, the deck and all are crammed into a corner
// when there is so much space around, whenever there is space they should centered and distributed to use the space to
// look nicer" — "applies to every screen"). The jobs page is test/d163UseTheSpace.test.js; this file holds the others to
// the same rule: the screen's content is one centred group, the free space left of it (from the dock's right edge — the
// dock keeps its own gutter; Admin has no dock, so from the viewport's edge) and right of it equal within 5 % of the
// width, nothing drawn within 8 px of the dock or the viewport's edge, no sideways scroll; on a phone tight, even margins.
// The settings drawer is a sheet on the right edge by design (D149, settings-declutter.html: 520 px at the right edge on a
// computer, the whole screen on a phone) — it is held to even insets inside itself instead.
// Measured in a real Chrome at 1280 / 1440 / 1920 / 2560 and 390 by `scripts/fidelityShots.mjs --styles screens163`
// (which also writes docs/fidelity-shots/screens163-<screen>-<width>.png).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const SHOTS = read("scripts/fidelityShots.mjs");
const INTEG = read("client/src/panels/IntegrationsPanel.jsx");
const WIDTHS = ["1280", "1440", "1920", "2560"];
// ⭐ D167: profile / account / customise / integrations / saved-answers are measured at their Profile panels now, and the
// Interview page joins them (scripts/fidelityShots.mjs screens163).
const SCREENS = ["tracker", "atlas", "profile", "account", "customise", "integrations", "saved-answers", "interview", "admin"];

let probe = null;
function measured(t) {
  if (probe === null) {
    probe = JSON.parse(execFileSync(process.execPath, ["scripts/fidelityShots.mjs", "--styles", "screens163"],
      { encoding: "utf8", timeout: 900000, stdio: ["ignore", "pipe", "ignore"] }).trim().split("\n").pop());
  }
  if (probe.skipped) { t.skip(probe.skipped); return null; }
  return probe;
}

// ── pure ──────────────────────────────────────────────────────────────────────────────────────────────────────────
test("d163 other screens (pure): one probe measures every screen; Integrations paints no slab to the screen's edge", () => {
  assert.match(SHOTS, /screens163: async \(arg\) =>/, "the shared probe");
  for (const s of [...SCREENS, "settings"]) assert.match(SHOTS, new RegExp(`\\n      "?${s}"?: \\{ app: "/(app|admin)`), `${s} is measured`);
  assert.match(SHOTS, /sizes: \{ "1280": \[1280, 800\], "1440": \[1440, 900\], "1920": \[1920, 1080\], "2560": \[2560, 1440\], phone: \[390, 844\] \},\n    routes:/);
  // the wrapper was background: var(--color-bg) (= --bg-page = SURFACE): a lighter slab from the dock to the right edge
  assert.match(INTEG, /<div style=\{\{ flex:1, overflowY:"auto", padding:"28px 24px 44px" \}\}>\n      <div className="page-cards" data-page-width="cards">/); // ⭐ 46q FULL WIDTH
  assert.doesNotMatch(INTEG, /overflowY:"auto", background:"var\(--color-bg\)"/);
});

// ── real Chrome ───────────────────────────────────────────────────────────────────────────────────────────────────
test("d163ContentGroupCentred, the other screens (real Chrome, 1280 · 1440 · 1920 · 2560): free space equal within 5 % of the width", { timeout: 900000 }, (t) => {
  const out = measured(t); if (!out) return;
  for (const s of SCREENS) for (const w of WIDTHS) {
    const m = out[s][w];
    assert.ok(m.group, `${s} ${w}: drew (${m.missing ? `no ${m.missing}` : ""} ${(m.pageErrors || []).join(" | ")})`);
    assert.ok(Math.abs(m.leftFree - m.rightFree) <= 0.05 * m.vw, `${s} ${w}: left ${m.leftFree} vs right ${m.rightFree}`);
  }
  // ⭐ 46q FULL WIDTH (owner 11-16, moved on purpose — was "> 200 free each side at 2560", D163's centred group): every
  // screen fills the width inside the page gutter (clamp(16px, 3vw, 48px)), the dock at the top on a desktop.
  for (const s of SCREENS) for (const w of WIDTHS) {
    const m = out[s][w];
    assert.ok(m.leftFree <= 80 && m.rightFree <= 80, `${s} ${w}: fills the width (${m.leftFree} / ${m.rightFree})`);
    if (s !== "admin") assert.equal(m.place, "top", `${s} ${w}: the dock at the top — the content starts at the gutter`);
  }
});

test("d163NoCornerCramming, the other screens (real Chrome): nothing flush to an edge, no sideways scroll, even phone margins", { timeout: 900000 }, (t) => {
  const out = measured(t); if (!out) return;
  for (const s of SCREENS) for (const w of [...WIDTHS, "phone"]) {
    const m = out[s][w];
    assert.ok(m.group, `${s} ${w}: drew`);
    assert.deepEqual(m.flush, [], `${s} ${w}: nothing within 8 px of the dock or the viewport's edge`);
    assert.ok(m.leftFree >= 8 && m.rightFree >= 8, `${s} ${w}: room on both sides (${m.leftFree} / ${m.rightFree})`);
    assert.equal(m.sideScroll, false, `${s} ${w}: no sideways scroll`);
  }
  for (const s of SCREENS) {
    const p = out[s].phone;
    assert.ok(Math.abs(p.leftFree - p.rightFree) <= 0.05 * p.vw, `${s} phone: even margins (${p.leftFree} / ${p.rightFree})`);
    assert.ok(p.leftFree <= 32 && p.rightFree <= 32, `${s} phone: tight (${p.leftFree} / ${p.rightFree})`);
  }
});

// ⭐ D167 (owner 11-06, "the dock goes where the space is" — changed on purpose): a SIDE dock (where the margin fits it
// open) is vertically centred, left of the content; a TOP dock sits above it. Never over the content.
test("d163DockOwnGutterVerticallyCentred → D167, the other screens (real Chrome): a side dock centred left of the content, a top dock above it", { timeout: 900000 }, (t) => {
  const out = measured(t); if (!out) return;
  for (const s of SCREENS.filter(x => x !== "admin")) for (const w of [...WIDTHS, "phone"]) {
    const m = out[s][w];
    assert.ok(m.dock, `${s} ${w}: the dock is there`);
    if (m.place === "side") {
      assert.ok(Math.abs(m.dockMid - m.vh / 2) <= 2, `${s} ${w}: vertically centred (${m.dockMid} of ${m.vh})`);
      assert.ok(m.dock.left > 0 && m.dock.right <= m.group.left, `${s} ${w}: in the margin, left of the content`);
    } else {
      assert.ok(m.dock.bottom <= m.group.top, `${s} ${w}: above the content (${m.dock.bottom} vs ${m.group.top})`);
    }
  }
  for (const w of WIDTHS) assert.equal(out.admin[w].dock, null, `admin ${w}: no dock (its own header)`);
});

test("d163 the settings drawer (real Chrome): a sheet on the right edge by design, its contents evenly inset", { timeout: 900000 }, (t) => {
  const out = measured(t); if (!out) return;
  for (const w of WIDTHS) {
    const m = out.settings[w];
    assert.ok(m.root && m.leaves, `${w}: the drawer drew`);
    assert.equal(m.rootRightFree, 0, `${w}: on the right edge (D149)`);
    assert.ok(m.root.width <= 520 + 1, `${w}: 520 at most (${m.root.width})`);
    assert.ok(m.insetL >= 16 && m.insetR >= 16 && Math.abs(m.insetL - m.insetR) <= 4, `${w}: even insets (${m.insetL} / ${m.insetR})`);
  }
  const p = out.settings.phone;
  assert.ok(p.insetL >= 16 && p.insetR >= 16 && Math.abs(p.insetL - p.insetR) <= 4, `phone: even insets (${p.insetL} / ${p.insetR})`);
});
