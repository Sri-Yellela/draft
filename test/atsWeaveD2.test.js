// D2 (chosen 10-02) — THE ATS REPORT AS "THE WEAVE". Built inside the ONE report implementation
// (components/AtsReport.jsx, A52), so the deck, the board, the phone sheet and /tools/ats all draw it.
// Seen in a browser on the deck at 1440 (mid-draw and settled) and 390.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const src = fs.readFileSync("client/src/components/AtsReport.jsx", "utf8").replace(/\r\n/g, "\n");
const weave = src.slice(at(src, "// ── D2 · THE WEAVE", 0, "weave"), at(src, "function TagSection(", 0, "end"));
const body = src.slice(at(src, "export function AtsReport(", 0, "report"), at(src, "// ── D2 · THE WEAVE", 0, "end"));

test("⭐ the skills and competencies are the weave: asks left, résumé right, a thread per pair", () => {
  assert.match(body, /<AtsWeave report=\{report\} claims=\{claims\} \/>/);
  for (const gone of ["✓ Skills Matched", "✗ Skills Missing", "✓ Competencies Matched", "◇ Competencies Missing"]) {
    assert.ok(!body.includes(`title="${gone}"`), `the chip section "${gone}" is back beside the weave`);
  }
  assert.match(weave, /What this posting asks/);
  assert.match(weave, /What your resume has/);
  // Threads leave and arrive FLAT: horizontal control points.
  assert.match(weave, /return `M 0 \$\{y1\} C \$\{w \* 0\.5\} \$\{y1\}, \$\{w \* 0\.5\} \$\{y2\}, \$\{w\} \$\{y2\}`;/);
  // Drawn by stroke-dashoffset to 0, one at a time, ~260 ms apart.
  assert.match(weave, /const WEAVE_STEP_MS = 260;/);
  assert.match(weave, /strokeDashoffset: n < landed \? 0 : 1/);
});

test("⭐ informative at rest: the unmatched asks DANGLE (dashed) once the pairs have landed", () => {
  assert.match(weave, /dangling=\{!a\.matched && settled\}/);
  assert.match(weave, /border: `1\.5px \$\{dangling && !claimed \? "dashed" : "solid"\}/);
});

test("the open questions, answered: a thread cap with a fold, once per session, the number gated on A76", () => {
  assert.match(weave, /const WEAVE_MAX_THREADS = 8;/);
  assert.match(weave, /more \{folded\.length === 1 \? "ask" : "asks"\}/);
  assert.match(weave, /sessionStorage\.setItem\(WEAVE_SEEN_KEY/);
  assert.match(body, /\{ATS_NUMBER_SHOWN && Number\.isFinite\(report\.score\) && <ScoreCountUp value=\{report\.score\} \/>\}/);
});

test("⛔ the constraints that carry over", () => {
  // Reduced motion: the final state, no drawing.
  assert.match(weave, /const still = prefersReducedMotion\(\) \|\| weaveSeen\(key\);/);
  // Generic language FOLDED and labelled NOT A GAP.
  assert.match(body, /<details data-ats-generic>[\s\S]*?Generic language \(\{report\.action_verbs_generic\.length\}\) — not a gap/);
  // The claim copy appears ONCE, and nothing is pre-selected.
  assert.equal((src.match(/Claiming a term says it is true of you/g) || []).length, 1, "the claim copy repeated");
  assert.match(body, /Nothing is ever pre-selected\./);
  // Depth on every claim control.
  assert.match(weave, /boxShadow: C\.DEPTH_REST,/);
  // "Not enough signal" stays distinct from Weak — the band card above the weave is untouched.
  assert.match(src, /\{isUnknown \? "no judgement" : "fit band"\}/);
});

test("the drawing starts when the weave is ON SCREEN, not when the deck mounts it mid-slide", () => {
  assert.match(weave, /new IntersectionObserver\(\(\[e\]\) => \{ if \(e\.intersectionRatio >= 0\.9\) setInView\(true\); \}/);
  assert.match(weave, /if \(still \|\| !inView\) return undefined;/);
});
