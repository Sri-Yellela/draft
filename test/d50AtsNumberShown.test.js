// D50 (owner, 10-07) — THE ATS NUMBER IS SHOWN. "show ats number not band — we will get around tuning it
// by end of day." Recorded as the OWNER'S DECISION to show it now and tune after — NOT validation
// passing (ρ 0.723 over the US-only graded 24; −0.166 on 21 held-out postings) — so it is provisional
// wherever it appears. The posting header's box is D48's and waits on that row's sketch file.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { ATS_NUMBER_SHOWN, ATS_NUMBER_NOTE } from "../shared/atsBands.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("D50 · the number is on, and the provisional note exists once", () => {
  assert.equal(ATS_NUMBER_SHOWN, true);
  assert.equal(ATS_NUMBER_NOTE, "Match score — still being tuned");
  assert.match(read("shared/atsBands.js"), /NOT because validation passed: ρ is 0\.723/, "the record says why it is on");
});

test("D50 · the board card's square and the ATS card show it — beside the note — and only for a real score", () => {
  const bubble = read("client/src/components/JobBubble.jsx");
  assert.match(bubble, /const showNumber = ATS_NUMBER_SHOWN && Number\.isFinite\(score\);/, "no score → no digit");
  // ⭐ D152 (5), changed on purpose: the board card's ATS square is gone — its number is the match on the right (.jb__mt),
  // drawn only for a real score (no score → nothing, never a 0); the note travels with the report (below).
  assert.match(bubble, /\{showNumber \? <><b>\{score\}%<\/b><span>match<\/span><\/> : null\}/, "no score → nothing, never a 0");
  assert.doesNotMatch(bubble, /jb__ats-n|BarMark/);
  // T9: the ATS card is the one shared component (shared/atsReportElement.js) — the web app and the extension draw it.
  const card = read("shared/atsReportElement.js");
  // The band, the count and the number stay together in the card's head; the note follows them.
  const head = card.slice(at(card, 'class: "ats-sum__head"'), at(card, '"data-ats-number-note"'));
  for (const part of ["data-ats-band", "data-ats-count", "data-ats-score"]) assert.ok(head.includes(part), `${part} left the card's head`);
  assert.match(card, /const showNumber = ATS_NUMBER_SHOWN && !isUnknown && Number\.isFinite\(report\?\.score\);/);
  assert.match(card, /showNumber && h\(doc, "div", \{ "data-ats-score": true, class: "ats-sum__score", title: ATS_NUMBER_NOTE \}/);
  assert.match(card, /showNumber && h\(doc, "p", \{ "data-ats-number-note": true/, "the note goes wherever the number goes");
  // "Best fit" stays a word in the sort panel.
  assert.match(read("shared/filterSentence.js"), /label: "Best fit"/);
});

test("D50 · web only — the mobile contract's annotation says so, in the same commit (A75's rule)", () => {
  const contract = read("services/api/mobileContract.js");
  // D50 bumped the contract to 2.2.1 for the annotation; a later additive bump (D59: 2.3.0) keeps it.
  assert.match(contract, / \* 2\.2\.1 — D50 \(10-07\)\. ANNOTATION ONLY/);
  const [major, minor, patch] = /export const CONTRACT_VERSION = "(\d+)\.(\d+)\.(\d+)";/.exec(contract).slice(1).map(Number);
  assert.ok(major > 2 || (major === 2 && (minor > 2 || (minor === 2 && patch >= 1))), "the contract went back before D50's annotation");
  assert.match(contract, /matchScore:\s+\{ type: "number",  nullable: true, description: "SHOWN ON THE WEB, PROVISIONAL — D50/);
  assert.doesNotMatch(read("contract/mobile-api.v1.json"), /"NOT DISPLAYED YET/, "a stale annotation contradicts the product");
});
