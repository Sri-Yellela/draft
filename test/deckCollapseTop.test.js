// Queue 39 — Collapse at the TOP of an expanded card as well as the bottom, sticky, and one word.
// Collapse was reachable only at the bottom, so getting out of a card meant scrolling the whole
// posting. Pinned by source (the stickiness was checked in a browser: draft-screenshots/collapse-top/).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const deckSrc = codeOnly(read("client/src/panels/DeckView.jsx"));
const face = deckSrc.slice(at(deckSrc, "function CardFace", 0, "CardFace"), at(deckSrc, "const POSITION_EASE", 0, "end of face"));
const button = deckSrc.slice(at(deckSrc, "function CollapseButton", 0, "CollapseButton"), at(deckSrc, "function CardFace", 0, "CardFace"));

test("⭐ an expanded card has Collapse at its TOP, before anything else on the face", () => {
  const top = at(face, "data-deck-collapse-top", 0, "the top control");
  assert.ok(top < at(face, "<CompanyIcon", 0, "the card's header"), "the top control is not at the top");
  assert.match(face, /\{open && \(\s*<div data-deck-collapse-top/, "shown only while the card is open");
  assert.match(face, /<CollapseButton onCollapse=\{onCollapse\}/);
});

test("⛔ it is STICKY — reachable at any scroll position, just under the fixed top bar — and takes no room", () => {
  const row = face.slice(at(face, "<div data-deck-collapse-top", 0, "row"), at(face, "<CollapseButton", 0, "button"));
  assert.match(row, /position: "sticky"/);
  assert.match(row, /top: `calc\(var\(\$\{CHROME_HEIGHT_VAR\}, 46px\) \+ 10px\)`/, "under the bar's MEASURED height, not a literal");
  assert.match(row, /height: 0/, "a zero-height row: it rides down without pushing the card's content");
  assert.match(deckSrc, /import \{ CHROME_HEIGHT_VAR \} from "\.\.\/hooks\/useChromeHeight\.js";/);
});

test("⛔ the label is \"Collapse\" — one word, at the top and at the bottom, and in the shortcut list", () => {
  assert.match(button, />\s*Collapse\s*<\/button>/, "the top control's label");
  assert.match(face, /\{expanded \? "Collapse" : "Open the posting ↓"\}/, "the bottom control's label");
  assert.match(deckSrc, /\["Esc", "Collapse"\]/, "the keyboard legend");
  assert.doesNotMatch(deckSrc, /click to collapse|collapse the card|Fold the card|Fold it again/i, "a longer label");
});

test("the top control does what Esc does, and says so", () => {
  assert.match(button, /onClick=\{onCollapse\}/);
  assert.match(button, /aria-keyshortcuts="Escape"/);
  assert.match(button, /aria-expanded="true" aria-controls=\{controls\}/);
  assert.match(face, /controls=\{flank \? "deck-ats deck-posting" : "deck-detail"\}/, "it names what it closes, in both layouts");
});
