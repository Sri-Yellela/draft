// D48 (owner, 10-07) — THE POSTING PANEL'S HEADER, ACTIONS AND DECK, and THE BUTTON SWEEP.
//
// Built to posting-header2.html (the file, not the row's prose — D30/D31/D34/D35 drifted from prose):
//   HEADER (scrolls away): [logo]  Company (the one company link, D38)  ····  [ATS number box]  [×]
//   ACTIONS (sticky, through the one StickyBar — D49's second consumer): A labelled boxes at ≥ 600px of PANEL,
//   B icon squares below it — a container query, never the window's.
//   DECK STRIP: Experience · Workstyle · Salary · Posted, the location muted under the workstyle.
// THE SWEEP: "probe the entire site for these Apple-styled buttons and replace them with the latest box-styled
// depth ones." Pills are for non-interactive tags and status; interactive controls are depth boxes. The guard
// below fails when a <button>, a link or a .rm-btn-style class comes back fully rounded.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const jd = read("client/src/components/JobDetailPanel.jsx");
const jdCss = read("client/src/components/JobDetailPanel.css");

test("D48 · the header: logo · company link · ATS number box · × — and no title, chips or keyword chips", () => {
  const hd = jd.slice(at(jd, '<div className="pp__hd" data-posting-header="">'), at(jd, "{(pendingState ==="));
  const order = ['className="pp__logo"', "<CompanyLink", "<AtsNumberBox", 'className="pp__x"'].map(s => hd.indexOf(s));
  assert.ok(order.every(i => i >= 0), "a header piece is missing");
  assert.deepEqual([...order].sort((a, b) => a - b), order, "the header's order is the sketch's");
  assert.doesNotMatch(hd, /selectedJob\.title|WorkBadge|VisaBadge|SkillChips|atsBandLabel|ago\(/, "the old header's chips are back");
  assert.match(jd, /^\s+bare$/m, "the shell's pinned header is not drawn — this header scrolls away");
  assert.match(jdCss, /\.pp__hd \{ display: flex; align-items: center; gap: 12px; padding: 14px 18px; \}/);
});

test("D48 · the box's number and the ATS card's are ONE colour, in both themes (PP_ATS_NUMBER = PAIR_KICKER)", async () => {
  const { C_LIGHT, C_DARK, CONTRAST_PAIRS } = await import("../client/src/styles/colorTokens.js");
  assert.equal(C_LIGHT.PP_ATS_NUMBER, C_LIGHT.PAIR_KICKER);
  assert.equal(C_DARK.PP_ATS_NUMBER, C_DARK.PAIR_KICKER);
  assert.ok(CONTRAST_PAIRS.some(([fg, bg, k]) => fg === "PP_ATS_NUMBER" && bg === "FH_WELL" && k === "large"), "declared, so it is proved");
});

test("D48 · the ATS box: the number in the display face and PP_ATS_NUMBER; no score → dashed, the bars, NO digits", () => {
  const box = jd.slice(at(jd, "export function AtsNumberBox("), at(jd, "function PostingActions("));
  assert.match(box, /const has = ATS_NUMBER_SHOWN && Number\.isFinite\(score\);/);
  // D58: the caption says "tailored" when the number is the tailored résumé's.
  assert.match(box, /\{has\s+\? \(<><b>\{Math\.round\(score\)\}<\/b><small>\{tailored \? "tailored" : "ATS"\}<\/small><\/>\)\s+: <svg/);
  assert.match(box, /className=\{`pp__ats\$\{has \? "" : " pp__ats--none"\}`\}/);
  assert.match(box, /aria-expanded=\{open\}/, "open is shown as an outline, from the ATS card's state");
  assert.match(jdCss, /\.pp__ats b \{ font: 400 26px\/1 var\(--font-display\); color: var\(--c-pp-ats-number\); \}/);
  assert.match(jdCss, /\.pp__ats\[aria-expanded="true"\] \{ outline: 2px solid var\(--c-accent-ink\);/);
  assert.match(jdCss, /\.pp__ats--none \{ border-style: dashed; box-shadow: none; \}/);
  // The open state comes from the board, which knows whether the ATS card is beside the posting.
  assert.match(read("client/src/panels/JobsPanel.jsx"), /atsOpen: !!rightPanelOpen/);
});

test("D48 · owner: \"the ATS number switches colour\" — the ATS card's number is the kicker ink (--atx), not the accent", () => {
  const css = read("client/src/components/AtsReport.css");
  const rule = css.slice(at(css, ".ats-sum__score {"), at(css, ".ats-sum__score small {"));
  assert.match(rule, /color: var\(--c-pair-kicker\);/);
  assert.doesNotMatch(rule, /--c-pair-accent/);
});

test("D48 · the actions: one component, A ≥ 600px of PANEL and B below — a container query, sticky through StickyBar", () => {
  assert.match(jdCss, /\.pp \{ container-type: inline-size; container-name: pp; \}/);
  assert.match(jdCss, /@container pp \(min-width: 600px\) \{ \.pp__a \{ display: flex; \} \}/);
  assert.match(jdCss, /@container pp \(max-width: 599\.98px\) \{ \.pp__b \{ display: flex; \} \.pp__quota \{ display: none; \} \}/);
  assert.doesNotMatch(jdCss, /@media[^{]*width/, "a viewport query decides the panel's rendering");
  assert.match(jd, /<StickyBar top="0px" className="pp__bar" data-posting-actions-bar="">/);
  // D49: ONE module, two consumers — the board's bar and this one.
  const consumers = ["client/src/App.jsx", "client/src/components/JobDetailPanel.jsx"].filter(f => /<StickyBar/.test(read(f)));
  assert.equal(consumers.length, 2);
  const acts = jd.slice(at(jd, "function PostingActions("), at(jd, "export default function JobDetailPanel("));
  // A: Pass · Save · Draft | Résumé · (Preview · PDF) · Cover letter; B: the same as squares, the quota as Draft's badge.
  assert.match(acts, /<div className="pp__a" role="group" aria-label="Actions">/);
  assert.match(acts, /<div className="pp__b" role="group" aria-label="Actions">/);
  assert.match(acts, /<DraftButton logo square [^>]*\n\s+badge=\{slots \? slots\.remaining : null\} \/>/);
  assert.match(acts, /<p className="pp__quota" data-draft-slots/);
});

test("D48 · the deck strip: Workstyle replaces Where; the location is a muted line beneath it", async () => {
  const { deckStrip, workstyleOf } = await import("../shared/postingFacts.js");
  assert.equal(workstyleOf({ tagWorkplace: "onsite" }), "On-site");
  assert.equal(workstyleOf({ workplaceType: "Remote" }), "Remote");
  assert.equal(workstyleOf({}), null, "unknown is not stated, never guessed");
  const cell = deckStrip({ tagWorkplace: "hybrid", location: "New York, NY" })[1];
  assert.deepEqual([cell.label, cell.value, cell.sub], ["Workstyle", "Hybrid", "New York, NY"]);
  assert.match(read("client/src/components/PostingPanel.jsx"), /\{c\.sub && <dd className="posting__sub" data-cell-sub="">\{c\.sub\}<\/dd>\}/);
  // ⚠ Found in the app: a bare .posting__sub lost to `.posting__cell dd` and drew the location in the 20px value
  // serif. The rule must out-rank it.
  assert.match(read("client/src/components/PostingPanel.css"), /\.posting__cell dd\.posting__sub \{[^}]*font-family: var\(--font-body\); font-size: 11px;/);
});

test("owner 10-07 (36) · the posting panel's Draft button IS the logo — the one StampLogo, in the mark's own tokens", () => {
  const db = read("client/src/components/DecisionButtons.jsx");
  const acts = jd.slice(at(jd, "function PostingActions("), at(jd, "export default function JobDetailPanel("));
  assert.match(acts, /<DraftButton logo drafted=/, "A: /draft");
  assert.match(acts, /<DraftButton logo square drafted=/, "B: /d");
  assert.match(db, /import \{ StampLogo \} from "\.\/StampLogo\.jsx";/, "reused, never redrawn");
  const logo = db.slice(at(db, "  if (logo) {"), at(db, "  return <DecisionPill compact={compact} square={square} primary"));
  assert.match(logo, /icon=\{square \? <StampLogo size="md" progress=\{1\} \/> : null\}/);
  assert.match(logo, /\{square \? label : idle \? <StampLogo size="mini" \/> : label\}/);
  assert.doesNotMatch(logo, /primary/, "the mark is not set on the orange fill, where its slash would vanish");
  // D51: named by its sentence, which leads with the state — "Out of drafts — …", "Drafted — view it in
  // Draft House". (Label + title read the state twice; the browser pass caught it.)
  assert.match(logo, /aria-label=\{title\}/, "named Draft / Drafting… / Drafted, not \"/draft\"");
  // The colours are the mark's tokens: orange and ink in light, all orange in dark (D19).
  const t = read("client/src/styles/colorTokens.js");
  assert.match(t, /LOGO_SLASH:\s+"#FD4600",[^\n]*\n\s+LOGO_WORD:\s+"#1E1915"/);
  assert.match(t, /LOGO_SLASH:\s+"#FD4600",[^\n]*\n\s+LOGO_WORD:\s+"#FD4600"/);
});

test("owner 10-07 (36) · the Workstyle cell has no visible heading: Remote / Hybrid / On-site, then the location", async () => {
  const { deckStrip } = await import("../shared/postingFacts.js");
  const both = deckStrip({ tagWorkplace: "remote", location: "Austin, TX" })[1];
  assert.deepEqual([both.value, both.sub, both.labelHidden], ["Remote", "Austin, TX", true]);
  const placeOnly = deckStrip({ location: "Austin, TX" })[1];
  assert.deepEqual([placeOnly.value, placeOnly.sub], ["Austin, TX", null], "no workstyle on file: the location is the value");
  assert.equal(deckStrip({})[1].value, null, "neither: not stated");
  assert.match(read("client/src/components/PostingPanel.jsx"), /<dt className=\{c\.labelHidden \? "posting__k--sr" : undefined\}>\{c\.label\}<\/dt>/);
  const css = read("client/src/components/PostingPanel.css");
  assert.match(css, /\.posting__cell dt\.posting__k--sr \{[^}]*position: absolute; width: 1px; height: 1px;[^}]*clip: rect\(0 0 0 0\);/, "for screen readers only");
  assert.match(css, /\.posting__cell dt\.posting__k--sr \+ dd \{ margin-top: 14\.5px; \}/, "its value stays on the row's line");
});

// ── THE SWEEP ────────────────────────────────────────────────────────────────────────────────────

/** Every opening tag of an interactive element, walked brace- and comment-aware to its closing ">". */
function interactiveTags(src) {
  const out = [];
  const re = /<(button|a|Link|NavLink)\b/g;
  let m;
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length, depth = 0, q = null;
    for (; i < src.length; i++) {
      const c = src[i];
      if (q) { if (c === q && src[i - 1] !== "\\") q = null; continue; }
      if (c === "/" && src[i + 1] === "/") { i = src.indexOf("\n", i); continue; }
      if (c === "/" && src[i + 1] === "*") { i = src.indexOf("*/", i) + 1; continue; }
      if (c === '"' || c === "'" || c === "`") { q = c; continue; }
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) break;
    }
    out.push({ text: src.slice(m.index, i + 1), index: m.index, line: src.slice(0, m.index).split("\n").length });
  }
  return out;
}
const PILL = /borderRadius:\s*(?:"999px"|"9999px"|999\b|9999\b)|glass\(\{[^}]*radius:\s*999/;
// ⛔ The ONE deliberate exception (the row: "the segmented views control"): a segment's options sit inside
// its own well, so they are not free-standing pills. The deck's Dealt / ATS order is that control.
const ALLOW = new Set(["client/src/panels/DeckView.jsx:DeckOrderControl"]);

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else out.push(p.split(path.sep).join("/"));
  }
  return out;
}

test("⛔ D48 guard · no interactive element is a pill: every <button>, link and Link with a full radius is a depth box", () => {
  const offenders = [];
  for (const f of walk("client/src").filter(f => /\.jsx?$/.test(f))) {
    const src = read(f);
    for (const t of interactiveTags(src)) {
      if (!PILL.test(t.text)) continue;
      const fn = (src.slice(0, t.index).match(/function (\w+)\s*\(/g) || []).pop()?.match(/function (\w+)/)[1];
      if (ALLOW.has(`${f}:${fn}`)) continue;
      offenders.push(`${f}:${t.line}`);
    }
    // ⚠ Found in the app, not by the tag scan: a style CONSTANT spread into a link ("Continue with Google").
    // A constant named for a button is held to the same rule.
    for (const m of src.matchAll(/const (\w*(?:Button|Btn|Cta|CTA)\w*) = \{([^}]*)\}/g)) {
      if (PILL.test(m[2])) offenders.push(`${f}: const ${m[1]}`);
    }
  }
  assert.deepEqual(offenders, [], "an interactive control in the old pill style — use DepthButton or the .dbx-depth skin");
});

test("⛔ D48 guard · a fully-rounded CSS rule is declared NON-interactive (status, a meter, an input, a scrollbar)", () => {
  // Every selector here is a tag, a status, a meter or a field — never something you press. A new pill rule
  // must be added to this list on purpose, which is the moment to ask whether it is a control.
  const NON_INTERACTIVE = new Set([
    ".ah__search", ".ah__status", ".dh-cap__meter", "::-webkit-scrollbar-thumb",
    ".rm-badge", ".rm-tag",
    ".jb__ready",   // D57: the card's "résumé ready" tag — a status, not a control
  ]);
  const files = [...walk("client/src").filter(f => /\.css$/.test(f)), "client/src/themes/cinematic.js"];
  const offenders = [];
  for (const f of files) {
    // Comments out, and cinematic.js's ${…} interpolations flattened, so their braces do not hide a rule.
    const src = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\$\{[^}]*\}/g, "X");
    for (const m of src.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!/border-radius:\s*(999|9999)px/.test(m[2])) continue;
      for (const sel of m[1].split(",").map(s => s.trim().split(/\s+/).pop())) {
        if (!NON_INTERACTIVE.has(sel)) offenders.push(`${f}: ${sel}`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test("D48 · ONE depth box: DepthButton, its skin for the rest, and the app-wide .rm-btn on the same values", () => {
  const db = read("client/src/components/DepthButton.jsx");
  const dbCss = read("client/src/components/DepthButton.css");
  assert.match(db, /export default function DepthButton\(/);
  assert.match(read("client/src/components/DecisionButtons.jsx"), /<DepthButton size=\{square \? "square" : compact \? "compact" : "box"\}/,
    "Pass · Save · Draft are the depth box everywhere they render");
  assert.match(dbCss, /\.dbx \{[^}]*border-radius: 11px; box-shadow: var\(--c-depth-rest\);/);
  assert.match(dbCss, /\.dbx--p \{[^}]*box-shadow: var\(--c-depth-accent\);/);
  assert.match(dbCss, /\.dbx-depth \{ border-radius: 10px; box-shadow: var\(--c-depth-rest\); \}/);
  assert.match(dbCss, /\.dbx-depth:active:not\(:disabled\) \{ transform: translateY\(0\); box-shadow: var\(--c-depth-press\); \}/);
  assert.match(read("client/src/main.jsx"), /import "\.\/components\/DepthButton\.css";/, "the skin is loaded app-wide");
  const rm = read("client/src/themes/cinematic.js");
  assert.match(rm.slice(at(rm, "        .rm-btn {"), at(rm, "        .rm-btn:disabled")), /border-radius: 11px;[\s\S]*box-shadow: \$\{C\.DEPTH_REST\};/);
});
