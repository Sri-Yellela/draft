// D1 (chosen 10-02) — JOB CARDS AS BUBBLES. "The sketch is the specification": these pin its numbers
// and its rules. Seen in a browser at 1440 (rest + hover), 1920, 820 and 390, light and dark.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const css = read("client/src/components/JobBubble.css");
const jsx = read("client/src/components/JobBubble.jsx");
const panel = read("client/src/panels/JobsPanel.jsx");

// ⛔ 47j A248 (changed on purpose): D1's job bubble — the card (36 px tile, role, company link with no underline / ↗, the
// facts, no band / number on the body), its rail of 52 px squares (ATS · Save · Draft · Send, zero width until hover), the
// depth tokens on them, the skeleton and the rows — is DELETED. R2 retired the classic market, and the market's list is the
// plate Index (plate/MarketIndex.jsx; its RowBubble the Save / Draft squares, held by d196 FIX-7 / FIX-8). The tests that
// described the card are replaced by this deletion pin; the board's column (JobBoardColumns) is what the file keeps.
test("47j A248: D1's job bubble card, rail, skeleton and rows are deleted; only the board's column remains", () => {
  assert.doesNotMatch(jsx, /export default function JobBubble|export function JobBubbleRows|export function JobBubbleSkeleton|export function capturedLine/);
  assert.match(jsx, /export function JobBoardColumns\(\{ children \}\) \{/);
  assert.doesNotMatch(css, /(^|\n)\s*\.jb(?![-\w])|\.jb__|\.jb-rows|\.jb-sk|\.jb-pair/, "no rule for the deleted card");
  assert.match(css, /\.jb-board \{/);
  assert.match(css, /\.jb-board__list \{ min-width: 0; \}/);
});

test("⛔ the logo face is SELF-HOSTED — no third-party font request", () => {
  assert.match(read("client/src/main.jsx"), /import "@fontsource\/poppins\/800-italic\.css";/);
  // Comments stripped: index.html explains, in a comment, the Google Fonts link it no longer has.
  assert.doesNotMatch(read("client/index.html").replace(/<!--[\s\S]*?-->/g, ""), /fonts\.googleapis\.com|fonts\.gstatic\.com/);
});

test("the board renders bubbles in rows; the Database panel keeps JobCard", () => {
  // 47j R2 (changed on purpose): the board's rows are the Index's (MarketIndexTable) — the bubble rows are deleted
  assert.doesNotMatch(panel, /<JobBubbleRows\b|<JobBubble\b/);
  assert.match(panel, /<MarketIndexTable\b/);
  assert.doesNotMatch(panel, /<JobCard\b/);
  assert.match(read("client/src/panels/DatabasePanel.jsx"), /<JobCard/);
  // D149 (11-03): one column — see the first test.
});
