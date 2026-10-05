// D31 (owner, 10-04) — THE ATS CARD IS SIMPLE; THE WEAVE IS DROPPED (reverses D2).
//
// The weave drew threads between two columns. It told the reader nothing a count does not, and it
// bought a thread cap, a replay rule and a layout minimum for zero information. The card is now:
// band · (the score, once A76 earns it) · "9 of 12" · one two-segment bar — the whole summary; then
// "You could claim" as the ONLY open section; "Already on your résumé" and "Generic — not a gap"
// folded. It lives in the ONE report implementation (A52), so the deck's panel, the board's panel,
// the phone's sheet and /tools/ats all draw it. Every D2 constraint survives, and is pinned here.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, " ").replace(/^\s*\/\/.*$/gm, " ");
const JSX = read("client/src/components/AtsReport.jsx");
const CSS = read("client/src/components/AtsReport.css");
const code = strip(JSX);
const css = strip(CSS);
const card = JSX.slice(at(JSX, "export function AtsBandCard(", 0, "band card"), at(JSX, "export function AtsReport(", 0, "end"));
const body = JSX.slice(at(JSX, "export function AtsReport(", 0, "report"), at(JSX, "function TermChips(", 0, "end"));
const chips = JSX.slice(at(JSX, "function TermChips(", 0, "chips"), at(JSX, "function ListSection(", 0, "end"));

test("⛔ the weave is gone: no threads, no columns, no replay store, no on-screen trigger", () => {
  for (const gone of [/AtsWeave/, /weaveLayout/, /threadPath/, /WEAVE_/, /<svg\b/, /<path\b/, /sessionStorage/,
                      /IntersectionObserver/, /What this posting asks/, /What your resume has/, /ScoreCountUp/]) {
    assert.doesNotMatch(code, gone, `the weave is back: ${gone}`);
  }
});

test("⭐ nothing moves and nothing needs a width — so it renders the same on every surface", () => {
  for (const motion of [/transition/i, /@keyframes/, /animation/i, /requestAnimationFrame/, /setInterval/, /setTimeout/]) {
    assert.doesNotMatch(code, motion, `motion in the card: ${motion}`);
    assert.doesNotMatch(css, motion, `motion in the card's stylesheet: ${motion}`);
  }
  assert.doesNotMatch(code, /minWidth|minHeight/, "a layout minimum in the card");
  assert.doesNotMatch(css, /min-width|min-height/, "a layout minimum in the card's stylesheet");
  // One stylesheet, for the one component.
  const users = fs.readdirSync("client/src", { recursive: true }).map(String)
    .filter(f => /\.(jsx?|tsx?)$/.test(f))
    .filter(f => /AtsReport\.css/.test(fs.readFileSync(`client/src/${f}`, "utf8")));
  assert.deepEqual(users.map(f => f.replace(/\\/g, "/")), ["components/AtsReport.jsx"]);
});

test("⭐ the summary is band · score · \"9 of 12\" · one two-segment bar — band-first, the number gated on A76", () => {
  const band = card.indexOf("data-ats-band ");
  const score = card.indexOf("data-ats-score");
  const count = card.indexOf("data-ats-count");
  const bar = card.indexOf("<AskBar ");
  assert.ok(band > 0 && score > band && count > score && bar > count, "the summary's order is band, score, count, bar");
  assert.match(card, /<b>\{matched\} of \{total\}<\/b> on your résumé/);
  assert.equal((card.match(/<AskBar /g) || []).length, 1, "ONE bar");
  const askBar = JSX.slice(at(JSX, "function AskBar(", 0, "bar"), at(JSX, "export function AtsBandCard(", 0, "end"));
  assert.equal((askBar.match(/className="ats-bar__seg"/g) || []).length, 2, "the bar has TWO segments");
  // ⛔ A75/A76: the number only once A76's corpus has earned it — and it is still switched off.
  assert.match(card, /\{ATS_NUMBER_SHOWN && !isUnknown && Number\.isFinite\(report\?\.score\) && \(/);
  assert.match(read("shared/atsBands.js"), /export const ATS_NUMBER_SHOWN = false;/, "the number is on before A76");
  // The number is the largest element when it is shown.
  assert.match(css, /\.ats-sum__score \{[^}]*font-size: 40px/);
  // The two segments and the two sections are the same lists — generic language in neither.
  const asks = JSX.slice(at(JSX, "export function reportAsks(", 0, "asks"), at(JSX, "function AskBar(", 0, "end"));
  assert.match(asks, /total: onResume\.length \+ missing/);
  assert.match(asks, /const missing = couldClaimSkills\.length \+ couldClaimVerbs\.length;/);
  const onResumeList = asks.slice(at(asks, "const onResume"), at(asks, "const couldClaimSkills"));
  const claimLists = asks.slice(at(asks, "const couldClaimSkills"), at(asks, "const generic"));
  assert.doesNotMatch(onResumeList + claimLists, /generic/, "generic language counted as an ask");
});

test("⭐ \"You could claim\" is the ONLY open section; résumé and generic fold away", () => {
  const visible = strip(body);
  assert.equal((visible.match(/<section\b/g) || []).length, 1, "one open section");
  assert.match(visible, /<section data-ats-could-claim>\s*<div className="rm-section-label">You could claim/);
  assert.match(visible, /<details data-ats-on-resume className="ats-fold">\s*<summary>Already on your résumé/);
  assert.match(visible, /<details data-ats-generic className="ats-fold">\s*<summary>Generic — not a gap/);
  for (const d of visible.match(/<details\b[^>]*>/g) || []) assert.doesNotMatch(d, /\bopen\b/, `a fold opens by default: ${d}`);
  // No other section heading sits open beside it.
  assert.doesNotMatch(visible, /title="[^"]*(Matched|Missing)"/, "a chip section is back beside the card");
});

test("⛔ the claim copy appears ONCE, beneath the claim chips, where the action is", () => {
  assert.equal((JSX.match(/Claiming a term says it is true of you/g) || []).length, 1);
  const section = body.slice(at(body, "<section data-ats-could-claim>"), at(body, "</section>"));
  assert.ok(section.indexOf("Claiming a term says it is true of you") > section.indexOf("<TermChips"),
    "the claim copy must sit beneath the chips, inside the one open section");
  assert.match(section, /Nothing is ever pre-selected\./);
});

test("⛔ nothing is pre-selected; claim chips have the + affordance and D1's depth", () => {
  // A chip reads as claimed only from what the candidate did: a lock, a claim, or a click in flight.
  assert.match(chips, /const claimed = locked \|\| claimedKeys\.has\(itemKey\) \|\| \(pendingItems \|\| new Set\(\)\)\.has\(`\$\{kind\}:\$\{k\}`\);/);
  assert.doesNotMatch(code, /defaultChecked|useState\(true\)/);
  assert.match(chips, /\{!claimed && <span className="ats-chip__plus" aria-hidden="true">\+<\/span>\}/);
  assert.match(chips, /className="ats-chip ats-chip--claim"/);
  assert.match(css, /\.ats-chip--claim \{[^}]*box-shadow: var\(--c-depth-rest\)/);
  assert.match(css, /\.ats-chip--claim:hover \{[^}]*box-shadow: var\(--c-depth-hover\)/);
  assert.match(css, /\.ats-chip--claim:active \{[^}]*box-shadow: var\(--c-depth-press\)/);
});

test("⛔ \"not enough signal\" is visibly NOT a short Weak bar: dashed, hue-less, and no number", () => {
  assert.match(css, /\.ats-bar\[data-unknown="true"\] \{ border: 1\.5px dashed var\(--c-band-unknown-edge\); \}/);
  const askBar = JSX.slice(at(JSX, "function AskBar(", 0, "bar"), at(JSX, "export function AtsBandCard(", 0, "end"));
  assert.match(askBar, /background: unknown \? `\$\{C\.BAND_UNKNOWN_EDGE\}55` : s\.fg/);
  assert.match(askBar, /background: unknown \? "transparent" : s\.bg/);
  assert.match(card, /\{isUnknown \? "no judgement" : "fit band"\}/);
  assert.match(card, /bandChipStyle\(band/);
});

test("tokens only: the card's stylesheet holds no colour or shadow literal", () => {
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/, "a hex literal");
  assert.doesNotMatch(css, /\brgba?\(|\bhsla?\(/, "an rgb/hsl literal");
  for (const v of css.match(/var\(--[a-z0-9-]+\)/g) || []) {
    assert.match(v, /^var\(--(c|color)-/, `${v} is not a colour/depth token`);
  }
});
