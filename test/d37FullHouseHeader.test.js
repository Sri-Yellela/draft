// D37 (owner, 10-06) — FULL HOUSE HEADER: the sentence, where it sits, and how wide the bar is.
//
// (1) The sentence, reworded by the owner: "discovering all roles at all career levels and all
//     workstyles in the United States." — lower-case d, the connectives doing the commas' work, each slot
//     a token plus its noun (plural unset, singular when one value is set).
// (2) Centred as a BLOCK — one column for the sentence, the open panel and the bar, sharing their edges.
// (3) The bar content-sized with a ceiling (760px), filling the window on a phone.
// ⭐ Geometry is measured, not asserted from CSS alone: scripts/d37HeaderGeometry.mjs loads the real
//    FullHouse.css headless at 390 / 1280 / 1920 / 2560 (10-06: every width ok — edges equal, margins
//    equal, bar 760 / 358 at 390).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { sentenceText, sentenceParts, SENTENCE_VERB, slotNoun, SENTENCE_CLAUSES } from "../shared/filterSentence.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const clause = (k) => SENTENCE_CLAUSES.find(c => c.key === k);

test("D37(1) · the sentence, verbatim — lower-case d, no commas between the four slots", () => {
  assert.equal(sentenceText({}), "discovering all roles at all career levels and all workstyles in the United States.");
  assert.equal(SENTENCE_VERB.showing, "discovering");
  assert.equal(sentenceText({ job_functions: ["finance"], experience_levels: ["senior"], work_models: ["remote"], places: ["metro:boston"] }),
    "discovering finance roles at senior career level and remote workstyle in Boston.", "the owner's narrowed example");
  // Posted and fit append only when set, after the location.
  assert.equal(sentenceText({ places: ["metro:boston"], ageFilter: "1w", fit_bands: ["strong"] }),
    "discovering all roles at all career levels and all workstyles in Boston, posted this week, strong fits only.");
});

test("D37(1) · each slot is a token PLUS its noun — plural unset, singular with one value", () => {
  assert.equal(slotNoun(clause("level"), {}), "career levels");
  assert.equal(slotNoun(clause("level"), { experience_levels: ["senior"] }), "career level");
  assert.equal(slotNoun(clause("level"), { experience_levels: ["senior", "lead"] }), "career levels");
  assert.equal(slotNoun(clause("where"), { work_models: ["remote"] }), "workstyle");
  assert.equal(slotNoun(clause("domain"), { job_functions: ["data"] }), "roles");
  // ⛔ The location floor stands: it can be narrowed, never cleared.
  assert.ok(sentenceParts({}).slots.some(s => s.key === "location" && s.text === "the United States"));
  // Rendered: only the token is a control; the connective and the noun are prose in the same face.
  const bh = read("client/src/components/BoardHeadline.jsx");
  assert.match(bh, /\{s\.lead\}\s+<button type="button" className="tok"/);
  assert.match(bh, /\{s\.noun \? ` \$\{s\.noun\}` : ""\}/);
});

test("D37(2)(3) · ONE centred column: margin-inline auto, a 760px ceiling, the sentence filling it", () => {
  const css = read("client/src/components/FullHouse.css");
  const fh = css.slice(at(css, ".fh {"), at(css, "}", at(css, ".fh {")));
  assert.match(fh, /max-width: none; margin-inline: 0; padding: 22px var\(--page-gutter\) 0;/, "⭐ 46q FULL WIDTH (owner 11-16, moved on purpose): the column fills the width with the page gutter (was D37's centred 804)");
  const bh = css.slice(at(css, ".bh {"), at(css, "}", at(css, ".bh {")));
  assert.match(bh, /max-width: none;/, "the sentence shares the bar's width, not a narrower 46ch of its own");
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ""), /text-align:\s*center/, "centred as a BLOCK, never as text");
  assert.ok(fs.existsSync("scripts/d37HeaderGeometry.mjs"), "the measured check stays runnable");
});
