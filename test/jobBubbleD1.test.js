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
// D149 (11-03) changed the first two tests on purpose: docs/sketches/fullhouse-declutter.html (`.list` / `.jr`) is the
// approved board — ONE column of rows, 8px apart, no growth on hover; the row's own values (pinned below, and in a real
// Chrome by test/fidelityFullHouse.test.js). D1's bubble rows and lib/bubbleColumns.js are gone.
const d149 = css.slice(at(css, "⭐ D149 (owner 11-03) · THE ROW"));

test("⭐ D149: one column of rows, 8px apart — no hovered card grows (D1's rows of 2 / 3 are retired)", () => {
  assert.match(jsx, /<div className="jb-rows" data-columns=\{1\}>\{jobs\.map\(children\)\}<\/div>/);
  assert.match(d149, /\.jb-rows \{ gap: 8px; padding: 0; \}/);
  assert.match(d149, /\.jb:hover, \.jb:focus-within \{ flex-grow: 0; box-shadow: none; background: var\(--c-surface-tint\); \}/);
  assert.match(d149, /padding: 14px 16px; border-radius: 20px; background: var\(--c-surface-solid\); box-shadow: none;/);
  assert.ok(!fs.existsSync("client/src/lib/bubbleColumns.js"));
});

test("D149: the row — a 36px tile (corner 11) · the role 600 15px · company · location 13px · salary · type · workstyle · the match", () => {
  assert.match(jsx, /<CompanyLogo company=\{job\.company\} iconUrl=\{job\.companyIconUrl\} size=\{36\} radius=\{11\} \/>/);
  assert.match(d149, /\.jb__title \{\n  display: block; white-space: normal; font: 600 calc\(15px \* var\(--type-scale, 1\)\)\/1\.25/);
  assert.match(d149, /\.jb__sub \{[^}]*font-size: calc\(13px \* var\(--type-scale, 1\)\); line-height: 1\.55; color: var\(--c-ink-faint\);/);
  assert.match(d149, /\.jb__meta i \{ font-style: normal; font-size: calc\(12\.5px \* var\(--type-scale, 1\)\); color: var\(--c-ink-muted\); \}/);
  assert.match(d149, /\.jb__mt b \{ display: block; font: 500 calc\(22px \* var\(--type-scale, 1\)\)\/1/);
  // The title before the company line, the company line before the meta (the sketch's order).
  assert.ok(at(jsx, 'className="jb__title"') < at(jsx, 'className="jb__sub"') && at(jsx, 'className="jb__sub"') < at(jsx, 'className="jb__meta"'));
});

test("⛔ A78: the company name is a link with NO underline and NO ↗ — and a NON-COLOUR hover cue", () => {
  assert.match(css, /\.jb__company \{[\s\S]*?text-decoration: none;/);
  assert.match(css, /a\.jb__company:hover, a\.jb__company:focus-visible \{ text-decoration: underline; \}/);
  // D38: the card's link IS the shared CompanyLink, and the A63 / A78 rules are asserted on it.
  // D149 (11-03) changed this on purpose: the link sits in the row's quiet "company · location" line, in that line's type.
  assert.match(jsx, /<CompanyLink company=\{job\.company\} jobId=\{id\} size="row" className="jb__company" \/>/);
  const companyLink = read("client/src/components/CompanyLink.jsx");
  assert.doesNotMatch(companyLink, /↗/);
  assert.match(companyLink, /\/api\/applications\/pending/, "A63: opening the posting still tags the job Pending");
});

test("⛔ NO BAND AND NO NUMBER on the card body; the ATS button carries the number only when A76 has earned it", () => {
  // D149 (11-03) changed this on purpose: the sketch (and D147: "the match on the right") puts the match number at the
  // row's right edge (.jb__mt) — the text block itself still carries no score and no band.
  const body = jsx.slice(at(jsx, '<div className="jb__text">', 0, "text"), at(jsx, '<div className="jb__mt"', 0, "match"));
  assert.doesNotMatch(body, /score|band/i, "fit shown in the card's text");
  assert.match(jsx, /\{showNumber \? <><b>\{score\}%<\/b><span>match<\/span><\/> : null\}/, "no score is no number — never a zero");
  assert.match(jsx, /const showNumber = ATS_NUMBER_SHOWN && Number\.isFinite\(score\);/);
  // ⭐ D152 (5), changed on purpose: no ATS button on the card any more — the match on the right is the one number.
  assert.doesNotMatch(jsx, /jb__sq--ats|jb__ats-n|BarMark/);
  const bands = read("shared/atsBands.js");
  // ⭐ D50 (owner, 10-07): ON, provisional — the box's tooltip carries the note.
  assert.match(bands, /export const ATS_NUMBER_SHOWN = true;/, "D50 turned the number on");
  // (the number's note now travels with the report itself — shared/atsReportElement.js, d50AtsNumberShown)
});

// ⭐ D152 (5), changed on purpose: TWO squares (Save · Draft) — the ATS square left the bubbles (home-sketch.html's ☆ · /d).
test("the rail: two 52px squares, zero width until hover / focus-within, one motion; always shown on touch", () => {
  assert.match(css, /\.jb__sq \{\n  width: 52px; height: 52px;/);
  assert.match(css, /max-width: 0; opacity: 0; margin-left: 0;/);
  // T25: visibility rides the reveal, so the collapsed squares are out of the pointer's and the keyboard's reach.
  assert.match(css, /\.jb:hover \.jb__rail, \.jb:focus-within \.jb__rail \{ max-width: 196px; opacity: 1; margin-left: 4px; visibility: visible; transition-delay: 0s; \}/);
  assert.match(css, /transition: max-width \.42s cubic-bezier\(\.3,\.8,\.25,1\)/);
  assert.match(css, /@media \(hover: none\) \{\n  \.jb__rail \{ max-width: 196px; opacity: 1; margin-left: 4px; visibility: visible; \}/);
  // ⛔ GENERATE and APPLY are off the card.
  const rail = jsx.slice(at(jsx, '<div className="jb__rail">', 0, "rail"), at(jsx, "{companyView &&", 0, "end"));
  // Save + Draft always; (11) 45q: a third, D180's Send, only when the caller offers it (the network on — off today).
  assert.equal((rail.match(/<button /g) || []).length, 3);
  assert.match(rail, /\{onSend && \(/, "Send is drawn only when offered");
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
  // (D91: one file per theme — each defines every depth token exactly once.)
  for (const f of ["client/src/themes/paper-light.js", "client/src/themes/charcoal-dark.js"]) {
    const tokens = read(f);
    for (const t of ["DEPTH_REST", "DEPTH_HOVER", "DEPTH_PRESS", "DEPTH_ACCENT", "LOGO_SHADOW"]) {
      assert.equal((tokens.match(new RegExp(`\\b${t}:`, "g")) || []).length, 1, `${t} in ${f}`);
    }
  }
});

test("⛔ the logo face is SELF-HOSTED — no third-party font request", () => {
  assert.match(read("client/src/main.jsx"), /import "@fontsource\/poppins\/800-italic\.css";/);
  // Comments stripped: index.html explains, in a comment, the Google Fonts link it no longer has.
  assert.doesNotMatch(read("client/index.html").replace(/<!--[\s\S]*?-->/g, ""), /fonts\.googleapis\.com|fonts\.gstatic\.com/);
});

test("the board renders bubbles in rows; the Database panel keeps JobCard", () => {
  // ⭐ D152 (5), changed on purpose: two columns (pairs), one beside an open posting.
  assert.match(panel, /<JobBubbleRows jobs=\{jobs\} columns=\{2\}>/);
  assert.doesNotMatch(panel, /<JobCard\b/);
  assert.match(read("client/src/panels/DatabasePanel.jsx"), /<JobCard/);
  // D149 (11-03): one column — see the first test.
});
