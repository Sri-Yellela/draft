// D32 (owner, 10-04) — THE POSTING AND THE SCORE AS AN INK-ON-DARK PAIR. Narrows D31.
//
// The pair is two halves on ONE surface: the posting (components/PostingPanel.jsx — a masthead from
// columns and D29's tags, then the employer's own description, formatted plainly) and the score
// (components/AtsReport.jsx — band · "you cover 9 of 12" · a three-segment bar · ONE "You could claim"
// block of depth boxes with a `kind` label · Experience as its own row · then the folds).
//
// ⛔ Zero model calls (D17). ⛔ The product's only dark surface, as a RULE — one token set, one place
// that decides it, and the guard below. ⛔ Every D31/D2 constraint survives; D31's test file
// (atsSimpleCardD31, 8) was retired into this one — each of its constraints is re-pinned here, against
// the D32 card, under the same name where the constraint is unchanged.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { at } from "../test-support/sourceAnchors.js";
import { yearsAsked, experienceState, kickerFor, deckStrip, WORD_NUMBERS, NOT_STATED } from "../shared/postingFacts.js";
import { formatPosting, blockWords, markTerm } from "../shared/postingFormat.js";
import { mapJobRow } from "../services/jobs/mapJobRow.js";
import { deckReport } from "../services/dailyDraft.js";

const { C_LIGHT, C_DARK, CONTRAST_PAIRS } = await import("../client/src/styles/colorTokens.js");

const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, " ").replace(/^\s*\/\/.*$/gm, " ");
const JSX = read("client/src/components/AtsReport.jsx");
const CSS = read("client/src/components/AtsReport.css");
const POSTING = read("client/src/components/PostingPanel.jsx");
const POSTING_CSS = read("client/src/components/PostingPanel.css");
const PAIR_CSS = read("client/src/styles/inkPair.css");
const LINK = read("client/src/lib/pairLink.js");
const DECK = read("client/src/panels/DeckView.jsx");
const code = strip(JSX);
const css = strip(CSS);
const card = JSX.slice(at(JSX, "export function AtsBandCard(", 0, "band card"), at(JSX, "const EXPERIENCE_MARK", 0, "end"));
const body = JSX.slice(at(JSX, "export function AtsReport(", 0, "report"), at(JSX, "function TermBox(", 0, "end"));
const box = JSX.slice(at(JSX, "function TermBox(", 0, "box"), at(JSX, "function ListSection(", 0, "end"));
const askBar = JSX.slice(at(JSX, "function AskBar(", 0, "bar"), at(JSX, "export function AtsBandCard(", 0, "end"));
const asks = JSX.slice(at(JSX, "export function reportAsks(", 0, "asks"), at(JSX, "function AskBar(", 0, "end"));

// ════════════════════════════════════════════════════════════════════════════════════════════════
// RE-PINNED FROM D31 (atsSimpleCardD31.test.js, retired) — every constraint survives
// ════════════════════════════════════════════════════════════════════════════════════════════════

test("⛔ the weave is gone: no threads, no columns, no replay store, no on-screen trigger", () => {
  for (const gone of [/AtsWeave/, /weaveLayout/, /threadPath/, /WEAVE_/, /<svg\b/, /<path\b/, /sessionStorage/,
                      /IntersectionObserver/, /What this posting asks/, /What your resume has/, /ScoreCountUp/]) {
    assert.doesNotMatch(code, gone, `the weave is back: ${gone}`);
    assert.doesNotMatch(strip(POSTING), gone, `the weave is back in the posting: ${gone}`);
  }
});

test("⭐ nothing ANIMATES and nothing needs a width — so both halves render the same on every surface", () => {
  // D32 lets a claim box lift on hover (translateY, D1) — instantly. No transition, no loop, no timer.
  for (const [name, src] of [["AtsReport.jsx", code], ["AtsReport.css", css], ["PostingPanel.jsx", strip(POSTING)],
                             ["PostingPanel.css", strip(POSTING_CSS)], ["inkPair.css", strip(PAIR_CSS)], ["pairLink.js", strip(LINK)]]) {
    for (const motion of [/transition/i, /@keyframes/, /animation/i, /requestAnimationFrame/, /setInterval/, /setTimeout/]) {
      assert.doesNotMatch(src, motion, `motion in ${name}: ${motion}`);
    }
    assert.doesNotMatch(src, /minWidth|minHeight|min-height/, `a layout minimum in ${name}`);
  }
  // min-width: 0 is the ABSENCE of a minimum (it lets a grid cell shrink) — the only form allowed.
  for (const src of [css, strip(POSTING_CSS)]) {
    for (const m of src.match(/min-width:[^;]+/g) || []) assert.equal(m.trim(), "min-width: 0", `a layout minimum: ${m}`);
  }
  // One stylesheet per half, each imported by its one component; the pair's surface by both.
  const users = (sheet) => fs.readdirSync("client/src", { recursive: true }).map(String)
    .filter(f => /\.(jsx?|tsx?)$/.test(f))
    .filter(f => new RegExp(`import\\s+["'][^"']*${sheet.replace(".", "\\.")}["']`).test(fs.readFileSync(`client/src/${f}`, "utf8")))
    .map(f => f.replace(/\\/g, "/")).sort();
  assert.deepEqual(users("AtsReport.css"), ["components/AtsReport.jsx"]);
  assert.deepEqual(users("PostingPanel.css"), ["components/PostingPanel.jsx"]);
  assert.deepEqual(users("inkPair.css"), ["components/AtsReport.jsx", "components/PostingPanel.jsx"]);
});

test("⭐ the header is band · score · \"you cover 9 of 12\" · ONE three-segment bar — band-first, the number gated on A76", () => {
  const band = card.indexOf("data-ats-band ");
  const score = card.indexOf("data-ats-score");
  const count = card.indexOf("data-ats-count");
  const bar = card.indexOf("<AskBar ");
  assert.ok(band > 0 && score > band && count > score && bar > count, "the header's order is band, score, count, bar");
  assert.match(card, /You cover <b>\{matched\} of \{total\}<\/b> things this posting asks for/);
  assert.equal((card.match(/<AskBar /g) || []).length, 1, "ONE bar");
  // D32: THREE segments — matched · missing · generic, in that order.
  const segs = askBar.match(/ats-bar__seg--(\w+)/g) || [];
  assert.deepEqual(segs, ["ats-bar__seg--matched", "ats-bar__seg--missing", "ats-bar__seg--generic"]);
  // ⛔ A75/A76: the number only once A76's corpus has earned it — and it is still switched off.
  assert.match(card, /\{ATS_NUMBER_SHOWN && !isUnknown && Number\.isFinite\(report\?\.score\) && \(/);
  assert.match(read("shared/atsBands.js"), /export const ATS_NUMBER_SHOWN = false;/, "the number is on before A76");
  // The number is the largest element when it is shown — in SERIF ACCENT.
  assert.match(css, /\.ats-sum__score \{[^}]*font-family: var\(--font-display\);[^}]*font-size: 46px;[^}]*color: var\(--c-pair-accent\);/);
  // ⛔ Generic language is drawn but NOT counted: "9 of 12" is matched over matched + missing only.
  assert.match(asks, /total: onResume\.length \+ missing/);
  assert.match(asks, /const missing = couldClaim\.length;/);
  const lists = asks.slice(at(asks, "const onResume"), at(asks, "const generic"));
  assert.doesNotMatch(lists, /generic/, "generic language counted as an ask");
});

test("⭐ \"You could claim\" is the ONLY open section; \"Already yours\" and generic fold away", () => {
  const visible = strip(body);
  assert.equal((visible.match(/<section\b/g) || []).length, 1, "one open section");
  assert.match(visible, /<section data-ats-could-claim>\s*<div className="ats-sec__label">You could claim/);
  assert.match(visible, /<details data-ats-on-resume className="ats-fold">\s*<summary>Already yours/);
  assert.match(visible, /<details data-ats-generic className="ats-fold">\s*<summary>Generic — not a gap/);
  for (const d of visible.match(/<details\b[^>]*>/g) || []) assert.doesNotMatch(d, /\bopen\b/, `a fold opens by default: ${d}`);
  // ⛔ ONE block: no per-kind sections beside it (the old Skills / Verbs / Competencies Missing).
  assert.doesNotMatch(visible, /Skills Missing|Verbs Missing|Competencies Missing|title="[^"]*(Matched|Missing)"/);
  assert.equal((visible.match(/data-ats-could-claim/g) || []).length, 1);
});

test("⛔ the claim copy appears ONCE, beneath the claim boxes, where the action is", () => {
  assert.equal((JSX.match(/Claiming a term says it is true of you/g) || []).length, 1);
  const section = body.slice(at(body, "<section data-ats-could-claim>"), at(body, "</section>"));
  assert.ok(section.indexOf("Claiming a term says it is true of you") > section.indexOf("<TermBox"),
    "the claim copy must sit beneath the boxes, inside the one open section");
  assert.match(section, /Nothing is ever pre-selected\./);
});

test("⛔ nothing is pre-selected; claim boxes have the + affordance and D1's depth, re-derived per theme", () => {
  // A box reads as claimed only from what the candidate did: a lock, a claim, or a click in flight.
  assert.match(box, /const claimed = locked \|\| claimedKeys\.has\(itemKey\) \|\| \(pendingItems \|\| new Set\(\)\)\.has\(`\$\{claimKind\}:\$\{k\}`\);/);
  assert.doesNotMatch(code, /defaultChecked|useState\(true\)/);
  assert.match(box, /\{!claimed && <span className="ats-box__plus" aria-hidden="true">\+<\/span>\}/);
  assert.match(box, /className="ats-box ats-box--claim"/);
  // D32: RECTANGULAR — radius 9 — lift at rest, translateY(-2px) + lift2 on hover, settle on press.
  assert.match(css, /\.ats-box \{[^}]*border-radius: 9px;[^}]*box-shadow: var\(--c-pair-lift\);/);
  assert.match(css, /\.ats-box--claim:hover \{ transform: translateY\(-2px\); box-shadow: var\(--c-pair-lift2\);/);
  assert.match(css, /\.ats-box--claim:active \{ transform: translateY\(0\); box-shadow: var\(--c-pair-press\); \}/);
  assert.doesNotMatch(css, /border-radius: 999px[^}]*\}[^.]*\.ats-box/, "a pill is back");
  // The depth is re-derived per theme, not shared: both themes declare their own three.
  for (const k of ["PAIR_LIFT", "PAIR_LIFT2", "PAIR_PRESS"]) {
    assert.ok(C_LIGHT[k] && C_DARK[k] && C_LIGHT[k] !== C_DARK[k], `${k} is not re-derived for the ink`);
  }
});

test("⛔ \"not enough signal\" is visibly NOT a short Weak bar: dashed, hue-less, and no number", () => {
  assert.match(css, /\.ats-bar\[data-unknown="true"\] \{ border: 1\.5px dashed var\(--c-band-unknown-edge\); \}/);
  assert.match(css, /\.ats-bar\[data-unknown="true"\] \.ats-bar__seg \{ background: transparent; \}/, "a declined bar keeps a hue");
  assert.match(askBar, /data-unknown=\{unknown \? "true" : "false"\}/);
  assert.match(card, /\{isUnknown \? "no judgement" : "fit band"\}/);
  assert.match(card, /bandChipStyle\(band/);
});

test("tokens only: the pair's stylesheets hold no colour or shadow literal, and read only colour/depth/font tokens", () => {
  for (const [name, src] of [["AtsReport.css", css], ["PostingPanel.css", strip(POSTING_CSS)], ["inkPair.css", strip(PAIR_CSS)]]) {
    assert.doesNotMatch(src, /#[0-9a-fA-F]{3,8}\b/, `${name}: a hex literal`);
    assert.doesNotMatch(src, /\brgba?\(|\bhsla?\(/, `${name}: an rgb/hsl literal`);
    for (const v of src.match(/var\(--[a-z0-9-]+\)/g) || []) {
      assert.match(v, /^var\(--(c-pair|c-band|font)-/, `${name}: ${v} is not one of the pair's tokens`);
    }
  }
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// D32 · THE SCORE CARD — the kind is carried, Experience is a row
// ════════════════════════════════════════════════════════════════════════════════════════════════

test("⛔ the `kind` label is the SCORER'S BUCKET, carried — skill · verb · quality — never flattened", () => {
  // Each list is tagged from the bucket it came out of, in reportAsks.
  assert.match(asks, /\.\.\.\(report\?\.tier1_missing \|\| \[\]\)\.map\(term => \(\{ term, kind: "skill" \}\)\)/);
  assert.match(asks, /\.\.\.\(report\?\.action_verbs_missing \|\| \[\]\)\.map\(term => \(\{ term, kind: "verb" \}\)\)/);
  assert.match(asks, /\.\.\.\(report\?\.competencies_missing \|\| \[\]\)\.map\(term => \(\{ term, kind: "quality" \}\)\)/);
  assert.match(asks, /\.\.\.\(report\?\.competencies_matched \|\| \[\]\)\.map\(term => \(\{ term, kind: "quality" \}\)\)/);
  // Every box prints it.
  assert.match(box, /const kindLabel = <span className="ats-box__kind">\{TERM_KINDS\[kind\]\?\.label \|\| kind\}<\/span>;/);
  assert.equal((box.match(/\{kindLabel\}/g) || []).length, 2, "the read-only box and the claim box both carry the kind");
  // The frozen deck report and the public route both keep the buckets apart, so the kind survives there too.
  const r = deckReport({ tier1_missing: ["Kafka"], competencies_missing: ["ownership"], action_verbs_missing: ["Scaled"] });
  assert.deepEqual([r.skillsMissing, r.competenciesMissing, r.verbsMissing], [["Kafka"], ["ownership"], ["Scaled"]]);
  assert.match(read("services/standaloneAts.js"), /competencies_missing: report\.competencies_missing \|\| \[\]/);
});

test("⭐ Experience gets its OWN ROW — pass/fail, between the claim block and the folds", () => {
  const visible = strip(body);
  const claim = visible.indexOf("<section data-ats-could-claim>");
  const exp = visible.indexOf("<ExperienceRow ");
  const yours = visible.indexOf("<details data-ats-on-resume");
  const generic = visible.indexOf("<details data-ats-generic");
  assert.ok(claim > 0 && exp > claim && yours > exp && generic > yours, "claim · experience · already yours · generic");
  // Four states, from the scorer's numbers — never from its prose — and a legacy card is no mark at all.
  assert.equal(experienceState({ requiredYears: 5, candidateYears: 6, fit: true }), "met");
  assert.equal(experienceState({ requiredYears: 5, candidateYears: 2, fit: false }), "short");
  assert.equal(experienceState({ requiredYears: 5, candidateYears: null, fit: false }), "unknown");
  assert.equal(experienceState({ requiredYears: null, candidateYears: 4, fit: true }), "none", "fit:true with no ask is NOT met");
  assert.equal(experienceState({ summary: "Meets 5+.", fit: true }), null, "a pre-D32 deck card guesses nothing");
  assert.equal(experienceState({ summary: "x", fit: true, state: "met" }), "met");
  // ⛔ The deck's frozen report carries it as a WORD — still no number in the card.
  const frozen = deckReport({ experience: { requiredYears: 5, candidateYears: 6, fit: true, summary: "Meets." } });
  assert.equal(frozen.experienceState, "met");
  assert.equal(JSON.stringify(frozen).match(/\d/), null, "a number reached the frozen report");
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// D32 · THE POSTING PANEL — columns, tags, a regex; the employer's words untouched
// ════════════════════════════════════════════════════════════════════════════════════════════════

test("Experience: the row's regex `\\d+\\+?\\s*years?` plus the word-number map — asks only, never \"20 years in business\"", () => {
  assert.equal(yearsAsked("Requirements: 4+ years of backend work.").label, "4+ yrs");
  assert.equal(yearsAsked("You have 5 years of experience with Go.").label, "5+ yrs");
  assert.equal(yearsAsked("3-5 years of experience in data.").label, "3–5 yrs");
  assert.equal(yearsAsked("0-2 years of professional experience").label, "0–2 yrs");
  // ⚠ the bounded gap the row names: written in words.
  assert.equal(yearsAsked("We need a minimum of four years in payments.").label, "4+ yrs");
  assert.equal(yearsAsked("Four (4) years of related experience required.").label, "4+ yrs");
  assert.equal(yearsAsked("2+ years of SQL; 5+ years preferred.").years, 2, "the floor is the smallest ask");
  assert.equal(WORD_NUMBERS.four, 4);
  // Not asks:
  for (const no of ["Paid month off after 4 years & every 2 years thereafter.", "For 10 years, we have led the market.",
                    "A company with 20 years in business.", "", null]) {
    assert.equal(yearsAsked(no), null, `read as an experience ask: ${no}`);
  }
});

test("⭐ thin tags: every deck-strip cell has a fallback — a missing fact is the VALUE \"not stated\", in italic serif", () => {
  const bare = deckStrip({});
  assert.deepEqual(bare.map(c => c.label), ["Experience", "Where", "Salary", "Posted"], "the four cells, in the approved order");
  assert.ok(bare.every(c => c.value === null && !c.met));
  assert.equal(NOT_STATED, "not stated");
  assert.match(POSTING, /<dd>\{c\.value \?\? <span className="posting__ns">\{NOT_STATED\}<\/span>\}<\/dd>/);
  assert.match(POSTING_CSS, /\.posting__ns \{ font-family: var\(--font-display\); font-style: italic;/);
  const full = deckStrip({ description: "4+ years of experience", location: "Boston, MA", salaryMin: 130000, salaryMax: 170000,
                           postedAt: new Date(Date.now() - 3 * 86400000).toISOString() },
                         { experience: { requiredYears: 4, candidateYears: 6, fit: true } });
  assert.deepEqual(full.map(c => c.value), ["4+ yrs", "Boston, MA", "$130k–$170k", "3d ago"]);
  assert.equal(full[0].met, true, "the Experience cell tints when met");
  assert.equal(deckStrip({ description: "4+ years of experience" }, { experience: { requiredYears: null, fit: true } })[0].met, false,
    "no tint for 'no years asked', even though the scorer calls it fit");
  // The kicker is D29's tags, in order, and only the ones on file — NULL is unknown, never printed as a guess.
  assert.deepEqual(kickerFor({ tagFunction: "engineering", tagLevel: "senior", tagWorkplace: "remote" }), ["Engineering", "Senior", "Remote"]);
  assert.deepEqual(kickerFor({ tagFunction: "data", tagLevel: null, tagWorkplace: "hybrid" }), ["Data", "Hybrid"]);
  assert.deepEqual(kickerFor({ tagLevel: "mid-ish" }), [], "a value outside the closed vocabulary is not printed");
  // The board's rows carry the tags (and so the deck's frozen job does too).
  const row = mapJobRow({ tag_function: "design", tag_level: "entry", tag_workplace: "onsite" });
  assert.deepEqual([row.tagFunction, row.tagLevel, row.tagWorkplace], ["design", "entry", "onsite"]);
  assert.deepEqual([mapJobRow({}).tagFunction, mapJobRow({}).tagLevel, mapJobRow({}).tagWorkplace], [null, null, null]);
});

const FIXTURE = [
  "Who we are", "", "About Northwind", "", "Northwind builds payment rails. We are hiring.", "",
  "What you'll do", "", "• Own services end to end", "", "• Design APIs", "  and review them", "•", "",
  "Requirements:", "- 4+ years building backend services", "- SQL; a cloud platform", "",
  "lowercase line that is not a heading", "Benefits", "1. Health", "2) Equity", "",
  "If you are hungry, smart and kind, apply.",
].join("\n");

test("⛔ the description is the EMPLOYER'S: their blocks, their order, every word — no sectioning, no pull quote", () => {
  const blocks = formatPosting(FIXTURE);
  assert.deepEqual(blocks.map(b => b.type), ["h", "h", "p", "h", "ul", "h", "ul", "p", "ul", "p"]);
  assert.deepEqual(blocks[4].items, ["Own services end to end", "Design APIs\nand review them"], "a continuation stays with its bullet");
  assert.equal(blocks[5].text, "Requirements:", "their heading, exactly as written");
  // ⛔ Every word, in order — markers removed, nothing else.
  const want = FIXTURE.replace(/^[ \t]*(?:[•·▪◦‣●○■□*–—-]|\d{1,2}[.)])(?:[ \t]+|$)/gm, "").split(/\s+/).filter(Boolean);
  assert.deepEqual(blockWords(blocks), want);
  // The panel draws THEIR structure only: a drop cap, small-caps rules, accent markers — and nothing of ours.
  assert.match(POSTING_CSS, /\.posting__p--lead::first-letter \{/);
  assert.match(POSTING_CSS, /\.posting__h \{[^}]*font-variant: small-caps;/);
  assert.match(POSTING_CSS, /\.posting__h::after \{ content: ""; flex: 1; height: 1px; background: var\(--c-pair-rule\); \}/);
  assert.match(POSTING_CSS, /\.posting__ul li::before \{[^}]*background: var\(--c-pair-accent\);/);
  const panel = strip(POSTING) + strip(read("shared/postingFormat.js"));
  for (const cut of [/what they need/i, /would be nice/i, /said.not.counted/i, /pull.?quote/i, /blockquote/i, /\.sort\(/, /\.reverse\(/]) {
    assert.doesNotMatch(panel, cut, `the owner cut this: ${cut}`);
  }
});

test("⛔ the ATS content is OUT of the description — the posting reads no report section", () => {
  const posting = strip(POSTING);
  assert.doesNotMatch(posting, /tier1_|competencies_|action_verbs_|decline_reasons|skillsMatched|verbsMissing|AtsReport|AtsBandCard/);
  // It is handed, at most, the scorer's experience judgement — for the Experience cell's tint.
  assert.match(POSTING, /export default function PostingPanel\(\{ job, text = job\?\.description, experience = null, showTitle = true, children = null \}\)/);
});

test("⛔ D17: zero model calls — the masthead is columns, tags and a regex; the body is the stored text", () => {
  for (const f of ["shared/postingFacts.js", "shared/postingFormat.js", "client/src/components/PostingPanel.jsx", "client/src/lib/pairLink.js"]) {
    const src = strip(read(f));
    assert.doesNotMatch(src, /anthropic|openai|groq|messages\.create|fetch\(|\bapi\(|import\s.*lib\/api/i, `${f} reaches for a model or the network`);
  }
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// ⛔ THE PRODUCT'S ONLY DARK SURFACE — a RULE: one token set, one place that decides, this guard
// ════════════════════════════════════════════════════════════════════════════════════════════════

const PAIR_FILES = { surface: "client/src/styles/inkPair.css",
  consumers: ["client/src/styles/inkPair.css", "client/src/components/AtsReport.css", "client/src/components/PostingPanel.css"],
  wearers: ["client/src/components/AtsReport.jsx", "client/src/components/PostingPanel.jsx"] };
const DECIDER = "client/src/styles/colorTokens.js";
// PaperBackground draws the SUBSTRATE (the leather) per theme, from styles/paper.js — not a surface choice.
const SUBSTRATE = "client/src/components/PaperBackground.jsx";

/** Every way a file could pick its own dark surface, or wear the pair's. Pure, so violations can be injected. */
export function darkSurfaceViolations(sources) {
  const out = [];
  for (const [file, raw] of Object.entries(sources)) {
    const src = /\.css$/.test(file) ? raw.replace(/\/\*[\s\S]*?\*\//g, " ") : strip(raw);
    if (file === DECIDER) continue;
    if (/--c-pair-/.test(src) && !PAIR_FILES.consumers.includes(file)) out.push(`${file}: reads the pair's tokens`);
    if (/\bC\.PAIR_|\bPAIR_[A-Z_]+\b/.test(src) && !/\.css$/.test(file)) out.push(`${file}: reads a PAIR_ token in code`);
    if (/["'\s]ink-pair["'\s]/.test(src) && !PAIR_FILES.wearers.includes(file)) out.push(`${file}: wears the pair's surface`);
    if (/\.ink-pair\b/.test(src) && file !== PAIR_FILES.surface) out.push(`${file}: declares the pair's surface`);
    if (/\bC_DARK\b|prefers-color-scheme|color-scheme:\s*dark|colorScheme|data-theme|dataset\.theme/.test(src)) out.push(`${file}: decides a theme`);
    if (/\bTHEME\b/.test(src) && file !== SUBSTRATE) out.push(`${file}: branches on the live theme`);
  }
  return out;
}

const CLIENT = Object.fromEntries(fs.readdirSync("client/src", { recursive: true }).map(String)
  .filter(f => /\.(jsx?|css)$/.test(f)).map(f => path.join("client/src", f).replace(/\\/g, "/"))
  .map(f => [f, read(f)]));

test("⛔ THE ONLY DARK SURFACE IS A RULE: no file but the pair wears it, and no file but colorTokens.js decides a theme", () => {
  assert.ok(Object.keys(CLIENT).length > 100, "the scan found the client");
  assert.deepEqual(darkSurfaceViolations(CLIENT), []);
  // The one place that decides: the palette is resolved ONCE, at load, from the one preference.
  assert.match(read(DECIDER), /export const C = THEME === "dark" \? C_DARK : C_LIGHT;/);
  assert.match(PAIR_CSS, /\.ink-pair \{\s*background: var\(--c-pair-surface\);\s*color: var\(--c-pair-ink\);/);
  // Both halves wear it — the report's card, its band card (the signup hook draws that alone), the posting.
  assert.match(JSX, /<div data-ats-report className="ats-card ink-pair">/);
  assert.match(JSX, /<div data-ats-band-card className="ats-sum ink-pair"/);
  assert.match(POSTING, /<article className="posting ink-pair" data-posting-panel>/);
  // The extension draws no pair, so its generated tokens carry none of the pair's.
  for (const f of ["extension/tokens.css", "extension/tokens.js"]) assert.doesNotMatch(read(f), /PAIR_|--c-pair-/, `${f} carries the pair`);
  assert.match(read("scripts/buildExtensionTokens.mjs"), /const names = Object\.keys\(C_LIGHT\)\.filter\(\(n\) => !n\.startsWith\("PAIR_"\)\);/);
});

test("⛔ ONE token set for both themes: cream in light, the darkest ink in dark — and nothing else dark in light", () => {
  const hex = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const lum = (h) => { const [r, g, b] = hex(h); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const pairKeys = Object.keys(C_LIGHT).filter(k => k.startsWith("PAIR_"));
  assert.ok(pairKeys.length >= 15, "the pair's token set");
  assert.deepEqual(Object.keys(C_DARK).filter(k => k.startsWith("PAIR_")), pairKeys, "one token set, both themes");
  // Light: the pair is cream, and NO opaque surface in the light palette is dark — the dark surface is
  // for dark mode only.
  const surfaces = (P) => Object.entries(P).filter(([k, v]) => /^(CANVAS|SURFACE|PAIR_SURFACE|PAIR_RAISED)/.test(k) && /^#/.test(v));
  for (const [k, v] of surfaces(C_LIGHT)) assert.ok(lum(v) > 0.5, `light ${k} ${v} is a dark surface`);
  // Dark: the ink is the darkest surface the product has — the pair reads as one object on the leather.
  for (const [k, v] of surfaces(C_DARK)) {
    if (k !== "PAIR_SURFACE") assert.ok(lum(C_DARK.PAIR_SURFACE) < lum(v), `dark ${k} is darker than the ink`);
  }
  // ⚠ RE-DERIVED, NOT CONVERTED: the dark greens, reds and blues are their own values.
  for (const k of ["PAIR_MATCHED", "PAIR_MISSING", "PAIR_GENERIC", "PAIR_KICKER", "PAIR_MET_QUIET", "PAIR_LIT"]) {
    assert.notEqual(C_DARK[k], C_LIGHT[k], `${k} was carried across themes unchanged`);
  }
  // Every text/indicator token of the pair is in a declared contrast pair (colorTokens.test.js proves
  // each in BOTH themes) — a pair token nobody measured is a pair token nobody may use.
  const declared = new Set(CONTRAST_PAIRS.flatMap(([fg, bg]) => [fg, bg]));
  for (const k of pairKeys.filter(k => !/^PAIR_(LIFT|LIFT2|PRESS|RULE)$/.test(k))) assert.ok(declared.has(k), `${k} has no declared contrast pair`);
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// D32 · the pair's layout — sticky on a wide screen, collapsed above the posting on a phone — and the link
// ════════════════════════════════════════════════════════════════════════════════════════════════

test("⭐ the score column is STICKY beside the posting; on a phone it COLLAPSES above it", () => {
  const grid = DECK.slice(at(DECK, "<div data-deck-grid", 0, "grid"), at(DECK, "<AtsSheet key=", 0, "sheet"));
  const aside = grid.slice(at(grid, "<aside id=\"deck-ats\"", 0, "aside"), at(grid, "</aside>", 0, "end"));
  assert.match(aside, /position: "sticky", top: `calc\(var\(\$\{CHROME_HEIGHT_VAR\}, 74px\) \+ 10px\)`/);
  assert.match(aside, /maxHeight: `calc\(100vh - var\(\$\{CHROME_HEIGHT_VAR\}, 74px\) - 20px\)`, overflowY: "auto"/);
  // Phone: the header only — band · "you cover" · the bar — heads the posting, and opens the full sheet.
  const collapsed = DECK.slice(at(DECK, "function CollapsedScore(", 0, "collapsed"), at(DECK, "function PostingLinks(", 0, "end"));
  assert.match(collapsed, /<AtsBandCard report=\{fromDeckReport\(card\.report\)\} band=\{card\.report\.scorable \? card\.band : ATS_BAND\.NOT_ENOUGH_SIGNAL\} compact \/>/);
  assert.doesNotMatch(collapsed, /score=/, "a number handed to the collapsed score");
  const face = DECK.slice(at(DECK, "function CardFace", 0, "face"), at(DECK, "const POSITION_EASE", 0, "end"));
  assert.ok(at(face, "<CollapsedScore ") < at(face, "<CardPosting "), "the collapsed score sits ABOVE the posting");
  assert.match(POSTING_CSS, /@media \(max-width: 560px\) \{[\s\S]*?\.posting__strip \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
});

test("⭐ the hover link: a box lights its term in the posting — ONLY on request (hover/focus), never standing", () => {
  // Inside a pair only; outside one the boxes do nothing extra.
  assert.match(box, /const linkProps = link\s*\? \{ onMouseEnter: \(\) => link\.light\(k\), onMouseLeave: \(\) => link\.light\(null\),\s*onFocus: \(\) => link\.light\(k\), onBlur: \(\) => link\.light\(null\)/);
  assert.match(box, /tabIndex=\{link \? 0 : undefined\}/, "a read-only box is reachable by keyboard only inside a pair");
  assert.match(LINK, /const \[lit, setLit\] = useState\(null\);/, "nothing is lit until asked");
  assert.match(DECK, /<PairLinkProvider>\s*<MotionConfig reducedMotion="user">/);
  // One term at a time, whole words, case-insensitive; no term → the text untouched.
  assert.deepEqual(markTerm("Go, golang and GO.", "go"), [
    { text: "Go", lit: true }, { text: ", golang and ", lit: false }, { text: "GO", lit: true }, { text: ".", lit: false }]);
  assert.deepEqual(markTerm("C++ and C", "C++"), [{ text: "C++", lit: true }, { text: " and C", lit: false }]);
  assert.deepEqual(markTerm("anything", null), [{ text: "anything", lit: false }]);
  assert.match(POSTING_CSS, /\.posting__lit \{ background: var\(--c-pair-lit\);/);
});
