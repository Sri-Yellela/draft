// A86 (10-05) — THE INK PAIR, BROUGHT TO FIDELITY WITH THE OWNER'S SKETCH (pair2.html).
//
// D32 shipped built from the WORKLOG row's prose, because the sketch was not on the machine. Its type
// and its boxes drifted: the deck strip's values went from the serif to a bold sans, the employer's
// description from Georgia in --tx2 to the body sans in full ink, the headings from ruled uppercase
// labels to small caps, the bullets from accent markers to squares, the band from a heading to a chip,
// the bar from 6px flush to 10px rounded. D34 records the same defect for D30. This file pins the
// sketch's values so the drift cannot recur silently:
//
//   1. THE FACES — the strip's values and the description stay SERIF. A rule that moves either to a
//      sans face fails here, by name.
//   2. THE TOKENS — every PAIR_* value is the sketch's (its translucent tints composited once over the
//      card), except the four that FAIL contrast at the sketch value; each of those is listed with the
//      pair it fails, and the test proves the sketch value really fails and the token really passes.
//   3. THE BOXES AND THE TYPE — the sketch's sizes, weights, spacing and edges, rule by rule.
//   4. The two values no CONTRAST_PAIRS entry can carry: the masthead's orange wash and the kind
//      label's opacity, each computed on every ground it lies on, in both themes.
//
// ⛔ Kept from D31/D32 where the sketch differs (and pinned in inkPairD32.test.js, not here): no motion
// (the sketch eases its boxes over .15s), "not enough signal" dashed and hue-less, the A76 number gate,
// the one component, the only-dark-surface guard, nothing pre-selected, aria-pressed and focus rings,
// and the two folds.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const { C_LIGHT, C_DARK } = await import("../client/src/styles/colorTokens.js");

const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const POSTING_CSS = read("client/src/components/PostingPanel.css");
// T9: the ATS half's stylesheet travels with the one component, inside its shadow root — the same rules, as a string.
const { ATS_REPORT_CSS: ATS_CSS } = await import("../shared/atsReportStyles.js");
const INDEX_CSS = read("client/src/index.css");

/** Every rule in a stylesheet, as [selector, Map(prop → value)] — media blocks flattened. */
export function rules(css) {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, " ");
  const out = [];
  for (const m of src.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const decls = new Map();
    for (const d of m[2].split(";")) {
      const i = d.indexOf(":");
      if (i > 0) decls.set(d.slice(0, i).trim(), d.slice(i + 1).trim().replace(/\s+/g, " "));
    }
    for (const sel of m[1].split(",")) out.push([sel.trim().replace(/\s+/g, " "), decls]);
  }
  return out;
}
const decl = (css, selector, prop) => {
  const hits = rules(css).filter(([s, d]) => s === selector && d.has(prop));
  return hits.length ? hits[0][1].get(prop) : undefined;   // the base rule: a phone override is not the sketch's
};

// ── WCAG 2.x ──────────────────────────────────────────────────────────────────────────────────────
const rgb = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const hex = (a) => "#" + a.map(v => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
const over = (fg, alpha, under) => hex(fg.map((c, i) => c * alpha + rgb(under)[i] * (1 - alpha)));
const parseRgba = (v) => { const m = /^rgba\((\d+),(\d+),(\d+),([0-9.]+)\)$/.exec(v.replace(/\s/g, "")); return m && { rgb: [+m[1], +m[2], +m[3]], a: +m[4] }; };
const ch = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (h) => { const [r, g, b] = rgb(h).map(ch); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const THEMES = [["light", C_LIGHT], ["dark", C_DARK]];

// ════════════════════════════════════════════════════════════════════════════════════════════════
// 1 · THE FACES
// ════════════════════════════════════════════════════════════════════════════════════════════════

/** The ways the posting's serif can be lost. Pure, so a violation can be injected. */
export function serifViolations(postingCss, indexCss) {
  const out = [];
  const face = (name) => (new RegExp(`--${name}:\\s*([^;]+);`).exec(indexCss) || [])[1] || "";
  // A face is a serif when its LAST generic family is `serif` — `sans-serif` is not.
  const isSerif = (stack) => /(^|,)\s*serif\s*$/.test(stack.trim());
  if (!isSerif(face("font-display"))) out.push(`--font-display is not a serif stack: ${face("font-display")}`);
  if (!/^Georgia\b/.test(face("font-reading")) || !isSerif(face("font-reading"))) out.push(`--font-reading is not Georgia, serif: ${face("font-reading")}`);
  // Each element the sketch sets in a serif, and the token its face must be.
  const SERIF = { ".posting__cell dd": "var(--font-display)", ".posting__ns": "var(--font-display)",
    ".posting__title": "var(--font-display)", ".posting__p--lead::first-letter": "var(--font-display)",
    ".posting__body": "var(--font-reading)" };
  for (const [sel, want] of Object.entries(SERIF)) {
    const got = decl(postingCss, sel, "font-family");
    if (got !== want) out.push(`${sel} is set in ${got ?? "an inherited face"}, not ${want}`);
  }
  // Nothing beneath the body or the strip may set another face on the employer's words or the values —
  // a later rule, a media block or a shorthand `font:` would all win over the one above.
  // D48: the Workstyle cell's location line (dd.posting__sub) is NOT a value — posting-header2.html sets it sans
  // (`.dk .sub{font:400 11px/1.35 ui-sans-serif}`), so it alone is outside the serif rule.
  const WORDS = /^\.posting__(body|p|ul)\b(?!.*first-letter)|^\.posting__cell dd(?!\.posting__sub)|^\.posting__strip dd/;
  for (const [sel, d] of rules(postingCss)) {
    if (!WORDS.test(sel)) continue;
    if (d.has("font")) out.push(`${sel} sets the font shorthand`);
    const f = d.get("font-family");
    if (f && f !== SERIF[sel] && f !== "var(--font-reading)" && f !== "var(--font-display)") out.push(`${sel} moves to ${f}`);
  }
  return out;
}

test("⛔ the strip's values and the employer's description stay SERIF — the drift D32 shipped cannot recur silently", () => {
  assert.deepEqual(serifViolations(POSTING_CSS, INDEX_CSS), []);
  // The detector itself: each of D32's shipped forms is caught.
  assert.ok(serifViolations(POSTING_CSS.replace(".posting__cell dd {\n  margin: 0; font-family: var(--font-display);", ".posting__cell dd {\n  margin: 0; font-family: var(--font-body);"), INDEX_CSS).length > 0);
  assert.ok(serifViolations(POSTING_CSS + "\n.posting__p { font-family: var(--font-body); }", INDEX_CSS).length > 0);
  assert.ok(serifViolations(POSTING_CSS + "\n@media (max-width: 1px) { .posting__body { font: 400 14.5px/1.7 var(--font-body); } }", INDEX_CSS).length > 0);
  assert.ok(serifViolations(POSTING_CSS, INDEX_CSS.replace("--font-reading: Georgia, serif;", "--font-reading: Georgia, sans-serif;")).length > 0);
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// 2 · THE TOKENS
// ════════════════════════════════════════════════════════════════════════════════════════════════

// pair2.html's two token sets, as written there. Translucent dark tints are composited over --surf
// (an edge over --surf2, the box it outlines) — the one conversion the contrast test needs.
const SKETCH = {
  light: { surf: "#FBF7F0", surf2: "#F2ECE1", line: "#DED5C4", tx: "#171512", tx2: "#3D362E", dim: "#8A8075", hi: "#0F0D0B",
    accent: "#FD4600", atx: "#A33200", ok: "#1D6B43", okbg: "#DFF0DA", okbd: "#BCDCB4", no: "#8A3B2E", nobg: "#F6E2DB",
    nobd: "#E6CAC1", gen: "#6B6257", genbg: "#EFEAE0", genbd: "#DED5C4",
    lift: "0 3px 8px rgba(0,0,0,0.11), inset 0 1px 0 rgba(255,255,255,0.66)",
    lift2: "0 7px 17px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.72)" },
  dark: { surf: "#191511", surf2: "#221D18", line: "#342C25", tx: "#E8E0D2", tx2: "#CDC4B6", dim: "#A39A8C", hi: "#FBF7F0",
    accent: "#FD4600", atx: "#FD4600", ok: "#7FC79A", okbg: "rgba(127,199,154,.13)", okbd: "rgba(127,199,154,.3)",
    no: "#E8937C", nobg: "rgba(232,147,124,.12)", nobd: "rgba(232,147,124,.3)", gen: "#8A8075",
    genbg: "rgba(138,128,117,.12)", genbd: "rgba(138,128,117,.26)",
    lift: "0 3px 9px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.07)",
    lift2: "0 8px 20px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.11)" },
};
const SKETCH_OF = { PAIR_SURFACE: "surf", PAIR_RAISED: "surf2", PAIR_RULE: "line", PAIR_INK: "tx", PAIR_INK_MUTED: "tx2",
  PAIR_INK_FAINT: "dim", PAIR_HI: "hi", PAIR_ACCENT: "accent", PAIR_KICKER: "atx", PAIR_MATCHED: "ok", PAIR_MET_QUIET: "okbg",
  PAIR_MATCHED_EDGE: "okbd", PAIR_MISSING: "no", PAIR_MISSING_QUIET: "nobg", PAIR_MISSING_EDGE: "nobd", PAIR_GENERIC: "gen",
  PAIR_GENERIC_QUIET: "genbg", PAIR_GENERIC_EDGE: "genbd", PAIR_LIFT: "lift", PAIR_LIFT2: "lift2" };
const sketchValue = (theme, key) => {
  const S = SKETCH[theme]; const v = S[SKETCH_OF[key]];
  const t = parseRgba(v);
  if (!t || /^PAIR_LIFT/.test(key)) return v;
  return over(t.rgb, t.a, key === "PAIR_MISSING_EDGE" ? S.surf2 : S.surf);
};
const wash = (P) => { const t = parseRgba(P.PAIR_MAST_TINT); return over(t.rgb, t.a, P.PAIR_SURFACE); };
/** The worst contrast of `fg` over every ground it is drawn on. */
const worst = (fg, grounds) => Math.min(...grounds.map(g => contrast(fg, g)));
// ⚠ THE ADJUSTMENTS — a sketch value that fails its pair, the pair it fails, and nothing else.
const ADJUSTED = {
  light: {
    PAIR_INK_FAINT: { bg: (P) => [P.PAIR_SURFACE, P.PAIR_RAISED, P.PAIR_MET_QUIET, wash(P)], need: 4.5,
                      why: "--dim as text on --surf, --surf2, --okbg and the wash" },
    PAIR_ACCENT:    { bg: (P) => [P.PAIR_SURFACE, wash(P)], need: 3, why: "the serif score (large) at the top of the orange wash" },
  },
  dark: {
    PAIR_GENERIC:   { bg: (P) => [P.PAIR_SURFACE, P.PAIR_GENERIC_QUIET], need: 4.5, why: "--gen as text on --surf and its own --genbg" },
  },
};

test("⭐ every PAIR_* value is the sketch's — and the only exceptions are the ones that fail contrast at the sketch value", () => {
  for (const [theme, P] of THEMES) {
    for (const key of Object.keys(SKETCH_OF)) {
      const want = sketchValue(theme, key);
      const adj = ADJUSTED[theme][key];
      if (!adj) { assert.equal(P[key].toUpperCase(), want.toUpperCase(), `${theme} ${key} is not the sketch's ${SKETCH_OF[key]}`); continue; }
      // An adjustment must be NECESSARY (the sketch value fails) and SUFFICIENT (the token passes).
      assert.notEqual(P[key], want, `${theme} ${key} is listed as adjusted but is the sketch value`);
      assert.ok(worst(want, adj.bg(P)) < adj.need, `${theme} ${key}: the sketch's ${want} passes ${adj.why} — no adjustment was needed`);
      assert.ok(worst(P[key], adj.bg(P)) >= adj.need, `${theme} ${key} ${P[key]} still fails ${adj.why}`);
    }
    assert.equal(P.PAIR_MAST_TINT, "rgba(253,70,0,0.07)", `${theme}: the wash is the sketch's rgba(253,70,0,.07)`);
    assert.equal(P.PAIR_CARD_SHADOW, "0 12px 34px rgba(0,0,0,0.18)", `${theme}: the card's shadow is the sketch's`);
  }
  // And each adjustment is the MINIMAL one: a step back toward the sketch fails again.
  const back = (h, toward) => hex(rgb(h).map((c, i) => c + Math.sign(rgb(toward)[i] - c) * 3));
  for (const [theme, P] of THEMES) {
    for (const [key, adj] of Object.entries(ADJUSTED[theme])) {
      assert.ok(worst(back(P[key], sketchValue(theme, key)), adj.bg(P)) < adj.need + 0.15,
        `${theme} ${key} moved further from the sketch than ${adj.why} needs`);
    }
  }
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// 3 · THE BOXES AND THE TYPE, rule by rule
// ════════════════════════════════════════════════════════════════════════════════════════════════

// [stylesheet, selector, property, the sketch's value] — the sketch's rule is named after each block.
const P_ = "posting", A_ = "ats";
const FIDELITY = [
  // .card
  [P_, ".posting", "border-radius", "18px"], [P_, ".posting", "box-shadow", "var(--c-pair-card-shadow)"],
  // ⭐ D152 (8) (44t): the report's card is option A's now (22px, no shadow — it sits inside the posting); its rows are below.
  // .mast — the orange wash and the rule under it
  [P_, ".posting__mast", "padding", "26px 30px 22px"], [P_, ".posting__mast", "border-bottom", "1px solid var(--c-pair-rule)"],
  [P_, ".posting__mast", "background", "linear-gradient(180deg, var(--c-pair-mast-tint), transparent)"],
  // .kick
  [P_, ".posting__kicker", "font-size", "9.5px"], [P_, ".posting__kicker", "font-weight", "700"],
  [P_, ".posting__kicker", "letter-spacing", ".17em"], [P_, ".posting__kicker", "color", "var(--c-pair-kicker)"],
  // .mast h2 · .co
  [P_, ".posting__title", "font-size", "36px"], [P_, ".posting__title", "line-height", "1.08"], [P_, ".posting__title", "color", "var(--c-pair-hi)"],
  [P_, ".posting__company", "font-size", "15px"], [P_, ".posting__company", "color", "var(--c-pair-ink-faint)"],
  // .dek · .dk · .k · .vv
  [P_, ".posting__strip", "border-radius", "12px"], [P_, ".posting__cell", "padding", "12px 15px"],
  [P_, ".posting__cell dt", "font-size", "8.5px"], [P_, ".posting__cell dt", "letter-spacing", ".12em"],
  [P_, ".posting__cell dd", "font-size", "20px"], [P_, ".posting__cell dd", "font-weight", "400"], [P_, ".posting__cell dd", "color", "var(--c-pair-ink)"],
  [P_, ".posting__ns", "font-size", "14px"], [P_, ".posting__ns", "font-style", "italic"],
  // .body · .art
  [P_, ".posting__body", "padding", "24px 30px 28px"], [P_, ".posting__body", "font-size", "15.5px"],
  [P_, ".posting__body", "line-height", "1.78"], [P_, ".posting__body", "color", "var(--c-pair-ink-muted)"],
  [P_, ".posting__p--lead::first-letter", "font-size", "50px"], [P_, ".posting__p--lead::first-letter", "line-height", ".82"],
  [P_, ".posting__p--lead::first-letter", "margin", "4px 11px 0 0"],
  [P_, ".posting__h", "font-size", "10px"], [P_, ".posting__h", "letter-spacing", ".14em"], [P_, ".posting__h", "text-transform", "uppercase"],
  [P_, ".posting__h", "padding-bottom", "9px"], [P_, ".posting__h", "margin", "26px 0 12px"],
  [P_, ".posting__ul", "padding-left", "20px"], [P_, ".posting__ul li", "margin", "0 0 8px"],
  [P_, ".posting__ul li::marker", "color", "var(--c-pair-accent)"],
  // ⭐ D152 (8), CHANGED ON PURPOSE (owner 11-04): the ATS half's sketch is now docs/sketches/ats-options.html OPTION A
  // (approved), which replaced pair2.html's .shd / .bd / .n / .b / .p with its .match: the count as an h3, one sentence,
  // the 6px bar and its key, the quiet switches (.tabs) and the plain claim rows (.cl). Its values, rule by rule (the
  // sketch's weight 600 is drawn at 500 — the faces both products ship are DM Sans 400 / 500 / 700).
  [A_, ".ats-card", "border-radius", "22px"], [A_, ".ats-card", "padding", "20px"],
  [A_, ".ats-sum__count", "font-size", "30px"], [A_, ".ats-sum__count", "font-weight", "500"], [A_, ".ats-sum__count", "line-height", "1.08"],
  [A_, ".ats-sum__count", "letter-spacing", "-.03em"], [A_, ".ats-sum__count", "margin", "0 0 8px"],
  [A_, ".ats-sum__sub", "margin", "0 0 14px"], [A_, ".ats-sum__sub", "color", "var(--c-pair-ink-muted)"],
  // .bar — 6px, on the rule's colour; .key — 12.5px, gap 14, the 7px dots
  [A_, ".ats-bar", "height", "6px"], [A_, ".ats-bar", "background", "var(--c-pair-rule)"], [A_, ".ats-bar", "margin", "0 0 6px"],
  [A_, ".ats-bar__seg--matched", "background", "var(--c-pair-matched)"], [A_, ".ats-bar__seg--claimed", "background", "var(--c-pair-kicker)"],
  [A_, ".ats-key", "gap", "14px"], [A_, ".ats-key", "font-size", "12.5px"], [A_, ".ats-key", "margin", "0 0 18px"],
  [A_, ".ats-key__i::before", "width", "7px"], [A_, ".ats-key__i::before", "border-radius", "50%"], [A_, ".ats-key__i::before", "margin-right", "6px"],
  // .tabs
  [A_, ".ats-tabs", "gap", "6px"], [A_, ".ats-tabs", "margin", "0 0 14px"],
  [A_, ".ats-tab", "padding", "7px 12px"], [A_, ".ats-tab", "border-radius", "11px"], [A_, ".ats-tab", "font-size", "13.5px"],
  [A_, ".ats-tab", "background", "var(--c-pair-surface)"], [A_, '.ats-tab[aria-pressed="true"]', "outline", "1px solid var(--c-pair-kicker)"],
  // .cl · its button · .fine
  [A_, ".ats-cl", "grid-template-columns", "minmax(0, 1fr) auto"], [A_, ".ats-cl", "gap", "12px"], [A_, ".ats-cl", "padding", "11px 0"],
  [A_, ".ats-cl", "border-top", "1px solid var(--c-pair-rule)"], [A_, ".ats-cl:first-child", "border-top", "0"],
  [A_, ".ats-cl__term b", "font-weight", "500"], [A_, ".ats-cl__kind", "margin-left", "8px"], [A_, ".ats-cl__kind", "font-size", "12.5px"],
  [A_, ".ats-cl__claim", "padding", "6px 10px"], [A_, ".ats-cl__claim", "border-radius", "10px"], [A_, ".ats-cl__claim", "font-size", "13.5px"],
  [A_, ".ats-cl__claim", "color", "var(--c-pair-kicker)"], [A_, ".ats-cl__claim:hover", "background", "var(--c-pair-surface)"],
  [A_, '.ats-cl__claim[aria-pressed="true"]', "color", "var(--c-pair-ink-faint)"],
  [A_, ".ats-claim-note", "font-size", "12.5px"], [A_, ".ats-claim-note", "margin", "14px 0 0"],
];

test("⭐ the boxes and the type are the sketch's, rule by rule", () => {
  const sheets = { [P_]: POSTING_CSS, [A_]: ATS_CSS };
  const misses = FIDELITY.filter(([s, sel, prop, want]) => decl(sheets[s], sel, prop) !== want)
    .map(([s, sel, prop, want]) => `${sel} { ${prop}: ${decl(sheets[s], sel, prop) ?? "—"} } — the sketch says ${want}`);
  assert.deepEqual(misses, []);
  // D32's drift, by name: none of it is back.
  // ⭐ D152 (8): option A's bar has a small corner (1px — the sketch's 4px on a 6px bar is a capsule, and 2px is 33%, over d60CompactRadius's 30%) and no gap.
  assert.doesNotMatch(ATS_CSS.replace(/\/\*[\s\S]*?\*\//g, ""), /\.ats-bar \{[^}]*gap/, "the bar is gapped");
  assert.match(ATS_CSS, /\.ats-bar \{[^}]*border-radius: 1px;/);
  assert.doesNotMatch(ATS_CSS.replace(/\/\*[\s\S]*?\*\//g, ""), /dashed var\(--c-pair/, "a claim box is dashed again (only \"not enough signal\" is dashed)");
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// 4 · THE WASH AND THE KIND LABEL — computed on every ground they lie on, in both themes
// ════════════════════════════════════════════════════════════════════════════════════════════════

test("⛔ text on the orange wash passes at its strongest (the top edge), in both themes", () => {
  for (const [theme, P] of THEMES) {
    const t = parseRgba(P.PAIR_MAST_TINT);
    const top = over(t.rgb, t.a, P.PAIR_SURFACE);
    for (const [fg, need, what] of [[P.PAIR_KICKER, 4.5, "the kicker"], [P.PAIR_HI, 4.5, "the title / the band"],
                                    [P.PAIR_INK_FAINT, 4.5, "the company / the count"], [P.BAND_UNKNOWN, 4.5, "Not enough signal"],
                                    [P.PAIR_ACCENT, 3, "the serif score (large)"]]) {
      assert.ok(contrast(fg, top) >= need, `${theme}: ${what} ${fg} on the wash ${top} is ${contrast(fg, top).toFixed(2)} < ${need}`);
    }
    assert.ok(contrast(P.BAND_UNKNOWN_EDGE, top) >= 3, `${theme}: the dashed "not enough signal" edge on the wash`);
  }
});

test("⛔ the kind label, at its opacity, reads at 4.5:1 on every box it sits in — the sketch's .62 does not", () => {
  const alphaOf = (P) => +P.PAIR_KIND_ALPHA;
  for (const [theme, P] of THEMES) {
    // [the box's text colour (the label inherits it), the box's fill]
    const boxes = [[P.PAIR_MISSING, P.PAIR_RAISED, "a claim box"], [P.PAIR_MATCHED, P.PAIR_MET_QUIET, "already yours / claimed"],
                   [P.PAIR_INK, P.PAIR_RAISED, "a plain box"]];
    const at = (a) => boxes.map(([fg, bg, what]) => [contrast(over(rgb(fg), a, bg), bg), what]);
    for (const [c, what] of at(alphaOf(P))) assert.ok(c >= 4.5, `${theme}: the kind label in ${what} is ${c.toFixed(2)}`);
    assert.ok(at(0.62).some(([c]) => c < 4.5), `${theme}: the sketch's .62 passes — restore it`);
    assert.ok(at(alphaOf(P) - 0.02).some(([c]) => c < 4.5), `${theme}: PAIR_KIND_ALPHA is higher than it needs to be`);
    assert.ok(alphaOf(P) > 0.62 && alphaOf(P) < 1, `${theme}: PAIR_KIND_ALPHA is not a reduced opacity`);
  }
  // Generic rows carry no kind label (the word alone). ⭐ D152 (8): option A's kind is small type in faint ink at FULL
  // opacity (the sketch's .cl small) — the token above stays proved for any surface that still reads it.
  assert.match(read("shared/atsReportElement.js"), /!generic && h\(doc, "small", \{ class: "ats-cl__kind" \}/);
  assert.doesNotMatch(ATS_CSS, /--c-pair-kind-alpha/);
});
