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
import { columnsFor } from "../client/src/lib/bubbleColumns.js";

test("⭐ rows of 2, 3 or 4 — 3 by default; a hovered or focused card grows to 1.55 and the NEIGHBOURS give up the width", () => {
  assert.match(css, /\.jb-row  \{ display: flex; gap: 18px;/);
  assert.match(css, /\.jb \{\n  flex: 1 1 0;\n  min-width: 0;/);
  assert.match(css, /\.jb:hover, \.jb:focus-within \{ flex-grow: 1\.55;/);
  assert.match(css, /padding: 16px 20px;/);
  assert.match(css, /\.jb-rows \{ display: flex; flex-direction: column; gap: 18px; padding: 0 28px 8px; \}/);
  assert.doesNotMatch(css, /\.jb-row  \{[^}]*flex-wrap/, "a row that wraps reflows a neighbour to another row");
});

test("the card: logo 52 / radius 13; the text block is 52px tall; company in the logo face; three single lines", () => {
  assert.match(css, /\.jb__logo \{ flex-shrink: 0; width: 52px; height: 52px; border-radius: 13px; box-shadow: var\(--c-logo-shadow\);/);
  assert.match(css, /\.jb__text \{[^}]*height: 52px;[^}]*justify-content: center;/);
  assert.match(css, /font-style: italic; font-weight: 800; font-size: 17px; letter-spacing: -\.015em;/);
  assert.match(css, /\.jb__title \{ font-size: 12\.5px; color: var\(--c-ink-muted\);/);
  assert.match(css, /\.jb__meta  \{ font-size: 11px; color: var\(--c-ink-faint\);/);
  assert.match(css, /\.jb__company, \.jb__title, \.jb__meta \{ white-space: nowrap; overflow: hidden; text-overflow: ellipsis; \}/);
});

test("⛔ A78: the company name is a link with NO underline and NO ↗ — and a NON-COLOUR hover cue", () => {
  assert.match(css, /\.jb__company \{[\s\S]*?text-decoration: none;/);
  assert.match(css, /a\.jb__company:hover, a\.jb__company:focus-visible \{ text-decoration: underline; \}/);
  const companyLink = jsx.slice(at(jsx, '<a className="jb__company"', 0, "company link"), at(jsx, "</a>", 0, "end"));
  assert.doesNotMatch(companyLink, /↗/);
  assert.match(companyLink, /\/api\/applications\/pending/, "A63: opening the posting still tags the job Pending");
});

test("⛔ NO BAND AND NO NUMBER on the card body; the ATS button carries the number only when A76 has earned it", () => {
  const body = jsx.slice(at(jsx, '<div className="jb__text">', 0, "text"), at(jsx, '<div className="jb__rail">', 0, "rail"));
  assert.doesNotMatch(body, /score|band/i, "fit shown on the card body");
  assert.match(jsx, /const showNumber = ATS_NUMBER_SHOWN && Number\.isFinite\(score\);/);
  // No score is the bar mark — never a zero.
  assert.match(jsx, /\{showNumber \? \(<><span className="jb__ats-n">\{score\}<\/span><span className="jb__ats-cap">ats<\/span><\/>\) : <BarMark \/>\}/);
  const bands = read("shared/atsBands.js");
  assert.match(bands, /export const ATS_NUMBER_SHOWN = false;/, "the number is switched on before A76 is complete");
});

test("the rail: three 52px squares, zero width until hover / focus-within, one motion; always shown on touch", () => {
  assert.match(css, /\.jb__sq \{\n  width: 52px; height: 52px;/);
  assert.match(css, /max-width: 0; opacity: 0; margin-left: 0;/);
  assert.match(css, /\.jb:hover \.jb__rail, \.jb:focus-within \.jb__rail \{ max-width: 196px; opacity: 1; margin-left: 4px; \}/);
  assert.match(css, /transition: max-width \.42s cubic-bezier\(\.3,\.8,\.25,1\)/);
  assert.match(css, /@media \(hover: none\) \{\n  \.jb__rail \{ max-width: 196px; opacity: 1; margin-left: 4px; \}/);
  // ⛔ GENERATE and APPLY are off the card.
  const rail = jsx.slice(at(jsx, '<div className="jb__rail">', 0, "rail"), at(jsx, "{companyView &&", 0, "end"));
  assert.equal((rail.match(/<button /g) || []).length, 3);
  assert.doesNotMatch(rail, /Generate|onGenerate|onVisit|↗/);
  // D6: the mark is DraftMark.jsx — the one implementation the top bar's Draft tab renders too.
  assert.match(rail, />\s*<DraftMark \/>\s*<\/button>/, "Draft is the mark");
});

test("⭐ depth on every control, from TOKENS (rest, hover lift, press, the orange-tinted Draft)", () => {
  assert.match(css, /\.jb__sq \{[\s\S]*?box-shadow: var\(--c-depth-rest\);/);
  assert.match(css, /\.jb__sq:hover, \.jb__sq:focus-visible \{ box-shadow: var\(--c-depth-hover\); transform: translateY\(-2px\); \}/);
  assert.match(css, /\.jb__sq:active \{ transform: translateY\(0\); box-shadow: var\(--c-depth-press\); \}/);
  assert.match(css, /\.jb__sq--draft \{ background: var\(--c-accent\); color: var\(--c-on-accent\); box-shadow: var\(--c-depth-accent\);/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(/i, "a colour literal outside the token file");
  const tokens = read("client/src/styles/colorTokens.js");
  for (const t of ["DEPTH_REST", "DEPTH_HOVER", "DEPTH_PRESS", "DEPTH_ACCENT", "LOGO_SHADOW"]) {
    assert.equal((tokens.match(new RegExp(`\\b${t}:`, "g")) || []).length, 2, `${t} in both themes`);
  }
});

test("⛔ the logo face is SELF-HOSTED — no third-party font request", () => {
  assert.match(read("client/src/main.jsx"), /import "@fontsource\/poppins\/800-italic\.css";/);
  // Comments stripped: index.html explains, in a comment, the Google Fonts link it no longer has.
  assert.doesNotMatch(read("client/index.html").replace(/<!--[\s\S]*?-->/g, ""), /fonts\.googleapis\.com|fonts\.gstatic\.com/);
});

test("the board renders bubbles in rows; the Database panel keeps JobCard", () => {
  assert.match(panel, /<JobBubbleRows jobs=\{jobs\}>/);
  assert.doesNotMatch(panel, /<JobCard\b/);
  assert.match(read("client/src/panels/DatabasePanel.jsx"), /<JobCard/);
  assert.equal(columnsFor(0), 3, "3 is the default");
  assert.equal(columnsFor(390), 1);
  assert.equal(columnsFor(820), 2);
  assert.equal(columnsFor(1440), 3);
  assert.equal(columnsFor(1920), 4);
});
