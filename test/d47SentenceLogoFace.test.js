// D47 (owner, 10-07) — THE FILTER SENTENCE IS SET IN THE LOGO FACE, AT THE LOGO'S SIZE.
// "Use the same font as the draft logo and the same size."
//
// The mark is artwork (two masked images), so "the logo's face" is the heavy italic geometric sans the
// app sets "in the logo face" (Poppins 800 italic) and "the logo's size" is the app bar mark's height.
// Both now come from ONE module (client/src/styles/brandMark.js) that StampLogo and the sentence read.
// Measured in the app 10-07: 800 italic 30px at 1280 / 1920 (two lines), ~25px at 390 (four lines, no
// overflow), nav mark 30px; prose and tokens share family, size, weight and style.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { MARK_SIZES, LOGO_FACE } from "../client/src/styles/brandMark.js";
import { FULL_HOUSE_TYPE } from "../client/src/styles/type.js";
import { at } from "../test-support/sourceAnchors.js";

test("D47 · the sentence's family, weight and style ARE the logo face; its size IS the mark's", () => {
  assert.equal(FULL_HOUSE_TYPE.SENTENCE_FAMILY, LOGO_FACE.family);
  assert.equal(FULL_HOUSE_TYPE.SENTENCE_WEIGHT, LOGO_FACE.weight);
  assert.equal(FULL_HOUSE_TYPE.SENTENCE_STYLE, LOGO_FACE.style);
  assert.equal(FULL_HOUSE_TYPE.LOGO_FAMILY, LOGO_FACE.family, "one logo face, not two spellings of it");
  assert.equal(FULL_HOUSE_TYPE.SENTENCE_SIZE, `min(${MARK_SIZES.nav}px, 6.4vw)`, "the nav mark's height; steps down on a phone");
  const logo = fs.readFileSync("client/src/components/StampLogo.jsx", "utf8");
  assert.match(logo, /import \{ MARK_SIZES \} from '\.\.\/styles\/brandMark\.js';/);
  assert.match(logo, /const SIZES = MARK_SIZES;/, "the mark draws from the same sizes — the two cannot drift");
  assert.match(fs.readFileSync("client/src/components/TopBar.jsx", "utf8"), /<StampLogo size="nav"\/>/);
});

test("D47 · prose and tokens share it all (D34) — the sentence rule reads every value from the tokens", () => {
  const css = fs.readFileSync("client/src/components/FullHouse.css", "utf8");
  const bh = css.slice(at(css, ".bh {"), at(css, "}", at(css, ".bh {")));
  for (const v of ["font-family: var(--fh-sentence-family)", "font-size: var(--fh-sentence-size)",
                   "font-weight: var(--fh-sentence-weight)", "font-style: var(--fh-sentence-style)",
                   // D93: the calm boxes open the line up by a factor; marked words (the default) keep it at 1.
                   "line-height: calc(var(--fh-sentence-line) * var(--bh-room, 1))"]) {
    assert.ok(bh.includes(v), `.bh lost ${v}`);
  }
  assert.match(css, /\[data-sentence="marked"\] \{\s*--bh-room: 1;/, "the default look keeps the token's line-height exactly");
  assert.match(css, /\.bh \.tok \{\s*font: inherit;/, "the token inherits every one of them");
});
