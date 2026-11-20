// ⭐ D173 R1 + R2 (46z, docs/D173_EXTENSION_HARDENING.md). R1: the popup-era handlers (no sender since T31; they act on the
// ACTIVE tab) answer only the extension's own pages — a content script's message is refused before any of them runs.
// R2: GATE_SUBMITTED (records Sent) and GATE_BATCH_NEXT (moves the batch on) need the review panel's own click from the
// page's TOP frame, as DOCK_SUBMITTED and GATE_SEND already did; the panel sends the click only when it was trusted.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";
const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const bg = read("extension/background.js"), ov = read("extension/review-overlay.js");

test("D173 R1: every popup-era type is gated on the extension's own origin, first thing in its listener", () => {
  const set = bg.match(/const POPUP_ERA = Object\.freeze\(new Set\(\[([\s\S]*?)\]\)\)/)[1];
  const types = [...set.matchAll(/'([A-Z_]+)'/g)].map(m => m[1]).sort();
  assert.deepEqual(types, ["CAPTURE_ACTIVE_TAB", "COPY_SHEET_PANEL", "DOCK_OPEN", "FILL_ACTIVE_TAB", "POPUP_CONTEXT", "PREPARE_ACTIVE_TAB", "PREVIEW_ACTIVE_TAB", "REPORT_FORM", "SUBMITTED_ACTIVE_TAB"]);
  assert.match(bg, /const fromOwnPage = \(sender\) => typeof sender\?\.url === 'string' && sender\.url\.startsWith\(chrome\.runtime\.getURL\(''\)\)/);
  assert.match(bg, /chrome\.runtime\.onMessage\.addListener\(\(message, sender, sendResponse\) => \{\n  if \(POPUP_ERA\.has\(message\?\.type\) && !fromOwnPage\(sender\)\) \{ sendResponse\(\{ ok: false, reason: 'not_allowed' \}\); return false; \}/);
  assert.match(bg, /if \(msg\?\.type !== 'REPORT_FORM'\) return false;\n  if \(!fromOwnPage\(sender\)\)/);
  // each type the set names is handled in the gated listeners (nothing gated that doesn't exist, nothing missed)
  for (const t of types) assert.ok(bg.includes(`message.type === '${t}'`) || bg.includes(`msg?.type !== '${t}'`), t);
});

test("D173 R2: GATE_SUBMITTED and GATE_BATCH_NEXT need the click from frame 0; the panel sends it only when trusted", () => {
  for (const t of ["GATE_BATCH_NEXT", "GATE_SUBMITTED"]) {
    const from = at(bg, `if (msg?.type === '${t}') {`);
    const body = bg.slice(from, at(bg, "return true;\n  }", from));
    assert.match(body, /if \(msg\.trigger !== 'click' \|\| sender\?\.frameId !== 0\)/, t);
  }
  assert.match(ov, /if \(role === 'next'\) \{\n[^\n]*\n      if \(!ev\.isTrusted\) return;/);
  assert.match(ov, /send\(\{ type: 'GATE_BATCH_NEXT', trigger: 'click' \}\)/);
  assert.match(ov, /if \(answer\.action !== 'yes' \|\| !answer\.trusted\) return;[\s\S]{0,200}send\(\{ type: 'GATE_SUBMITTED', trigger: 'click' \}\)/);
});
