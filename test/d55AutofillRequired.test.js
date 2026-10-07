// D55 (g) — the required-field pre-check that feeds "Complete required fields".
// AUTOFILL_TARGET.md §8.2 #3: Workday shows its errors on Save and Continue, but Greenhouse validates
// ONLY ON SUBMIT — which the extension never presses — so it must find the empty required fields
// itself. Run for real by scripts/d55AutofillWorkday.mjs (the wizard's stops, and a single page that
// flips from "Complete required fields (1)" to "Filled — review and submit" when answered).

import { test } from "node:test";
import assert from "node:assert/strict";
import { at, lastAt } from "../test-support/sourceAnchors.js";
import fs from "node:fs";

const badge = fs.readFileSync("extension/autofill-badge.js", "utf8").replace(/\r\n/g, "\n");
const handoff = fs.readFileSync("extension/gated-handoff.js", "utf8").replace(/\r\n/g, "\n");
const dedent = (s) => s.split("\n").map(l => l.trim()).join("\n");

const exported = (() => {
  const s = badge.slice(at(badge, "export function findMissingRequired("));
  return s.slice("export ".length, at(s, "\n}\n") + 2);
})();

test("(g) the badge's live copy of the pre-check is byte-identical to the one the fill runs", () => {
  const r = badge.slice(at(badge, "export function renderBadge("));
  const inner = r.slice(at(r, "function findMissingRequired("));
  const innerText = inner.slice(0, at(inner, "\n  }\n") + 4).trimEnd();
  assert.ok(innerText.length > 1000);
  assert.equal(dedent(innerText), dedent(exported));
});

test("(g) required is read three ways: required, aria-required (control or radio group), an asterisked label", () => {
  assert.match(exported, /el\.required === true \|\| el\.getAttribute\('aria-required'\) === 'true'/);
  assert.match(exported, /group\(el\)\?\.getAttribute\('aria-required'\) === 'true'/);
  assert.match(exported, /abbr\[title="required" i\]/);
  assert.match(exported, /\/\\\*\\s\*\$\/\.test\(textOf\(l\)\)/, "a label ending in * is required");
});

test("(g) empty means empty for every widget the fill drives", () => {
  assert.match(exported, /if \(type === 'radio'\) return !root\.querySelector\(`input\[type="radio"\]\[name="\$\{CSS\.escape\(el\.name\)\}"\]:checked`\);/);
  assert.match(exported, /if \(type === 'checkbox'\) return !el\.checked;/);
  assert.match(exported, /file-upload-successful/, "a Workday drop zone that confirmed an upload is not empty");
  assert.match(exported, /\[data-automation-id="selectedItem"\], \[role="listitem"\]/, "a typeahead with a chip is not empty");
  assert.match(exported, /\/\^\(select\|choose\|please\|--\)\/i\.test\(t\)/, "a dropdown still reading 'Select One' is empty");
});

test("(g) it reports LABELS only, never a value, and never our own overlay or badge", () => {
  assert.match(exported, /out\.push\(\{ label: /);
  assert.doesNotMatch(exported, /out\.push\([^)]*value/);
  assert.match(exported, /#rm-gate-review-overlay, #rm-draft-autofill-badge/);
});

test("(g) the final badge is 'required' when anything required is empty — and live on a single page", () => {
  const fill = handoff.slice(at(handoff, "async function fillFromPacket("), at(handoff, "async function captureFormSchema("));
  assert.match(fill, /const badge = await showBadge\(tab\.id, missingAtEnd\.length \? 'required' : 'done',/);
  assert.match(fill, /\{ missing: missingAtEnd, live: !isWizard \|\| wizard\.stoppedAt === 'review' \}/);
  assert.match(badge, /const s = now\.length \? 'required' : 'done';/, "the live badge flips both ways");
});

test("(g) the probe's own required flag counts the asterisk, so schema capture records it too", () => {
  assert.match(handoff, /\/\\\*\\s\*\$\/\.test\(labelFor\(el\)\) \|\|/);
});
