// D55 (c) · (g) · (l) — the badge, the required-field pre-check, and "this form isn't recognised".
// The page-side behaviour is run in headless Chrome by scripts/d55AutofillWorkday.mjs.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { BADGE_TEXT, BADGE_ID } from "../extension/autofill-badge.js";

const badge = fs.readFileSync("extension/autofill-badge.js", "utf8").replace(/\r\n/g, "\n");
const handoff = fs.readFileSync("extension/gated-handoff.js", "utf8").replace(/\r\n/g, "\n");
const dedent = (s) => s.split("\n").map(l => l.trim()).join("\n");
const anchor = (s, needle) => { const i = s.indexOf(needle); assert.ok(i >= 0, `missing: ${needle}`); return i; };

test("(c) the badge has exactly the three DECIDED states, word for word, plus the refusal", () => {
  // AUTOFILL_TARGET.md §7.6, decided 10-07.
  assert.equal(BADGE_TEXT.progress, "Autofill in progress…");
  assert.equal(BADGE_TEXT.required, "Complete required fields");
  assert.equal(BADGE_TEXT.done, "Filled — review and submit");
  // §8.3: a visible refusal, not a fourth progress state.
  assert.equal(BADGE_TEXT.unrecognised, "This form isn't recognised — nothing was filled");
  // The serialised renderer carries its own copy; it must say the same words.
  const r = badge.slice(anchor(badge, "export function renderBadge("));
  for (const t of Object.values(BADGE_TEXT)) assert.ok(r.includes(JSON.stringify(t).slice(1, -1)) || r.includes(t), t);
});

test("(c) one line in a shadow root, painted only with the site's tokens", () => {
  assert.equal(BADGE_ID, "rm-draft-autofill-badge");
  assert.match(badge, /host\.attachShadow\(\{ mode: 'open' \}\)/);
  assert.match(badge, /--c-\$\{k\.toLowerCase\(\)\.replace\(\/_\/g, '-'\)\}/);
  assert.doesNotMatch(badge, /#[0-9a-f]{3,8}\b(?![\w-])|rgba?\(/i, "no colour literal — the tokens are the only palette");
  // ⭐ T17: the palettes are the account's (overlayTheme — all four themes), and the badge is drawn on the dock
  assert.match(handoff, /const theme = await overlayTheme\(\);\n\s+return \(await drawInDock\(tabId, renderBadge, \[state, \{ \.\.\.meta, theme, dock: await dockMeta\(tabId\) \}\]\)\) \|\| null;/);
});

test("(c) the × dismisses and leaves the stop signal; it never touches the form", () => {
  assert.match(badge, /host\.dataset\.dismissed = '1';/);
  assert.match(badge, /export function badgeDismissed\(\)/);
  assert.doesNotMatch(badge.slice(anchor(badge, "export function renderBadge(")), /\.click\(\)|\.value\s*=|\.checked\s*=/,
    "the badge reads the form; it never writes to it");
});

test("(c) the review overlay stays — the badge is painted after it, as the DOCK's status line (T17), never over it", () => {
  const fill = handoff.slice(anchor(handoff, "async function fillFromPacket("), anchor(handoff, "async function captureFormSchema("));
  assert.ok(anchor(fill, "drawInDock(tab.id, renderOverlay,") < fill.lastIndexOf("showBadge(tab.id,"),
    "the final badge must come after the overlay");
  // ⭐ T17: it no longer floats beside the panel (`right: overlayOpen ? 412 : 16`) — it is the dock's ONE status line,
  // under its header and in its slim bar; a dock not on the page yet opens collapsed for it
  assert.match(badge, /host = dock\.status\(\{ id: ID \}\);/);
  assert.match(badge, /dock\.statusText\(label\);/);
  assert.doesNotMatch(badge, /overlayOpen|position:fixed|position:absolute/);
});
