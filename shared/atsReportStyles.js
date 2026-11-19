// shared/atsReportStyles.js — ⭐ T9 · THE ATS REPORT'S LOOK, inside the component's shadow root.
//
// This WAS client/src/components/AtsReport.css (D32 · A86 — every value the owner's sketch, pair2.html). It moved
// here, rule for rule, when the report became ONE component drawn by the web app and the extension (T9): a shadow
// root takes no document stylesheet, and the extension cannot import the client's CSS, so the stylesheet travels
// WITH the component as a string. test/pairFidelityA86.test.js and test/inkPairD32.test.js read ATS_REPORT_CSS.
//
// ⛔ TOKENS ONLY. Colours and depth are the pair's tokens (--c-pair-*; "not enough signal" keeps the band tokens),
// fonts the --font-* tokens. Their VALUES are set on :host by atsHostCss() below, from the theme registry
// (shared/atsReportTokens.js, generated from client/src/themes/* by scripts/buildAtsReport.mjs) — so the card is the
// same pixels on every surface for the same theme, whatever page it sits in.
// ⛔ NOTHING HERE ANIMATES: no transition, no keyframes, no minimum width — the card renders the same in the deck's
// panel, the board's panel, the phone's sheet, /tools/ats, the extension's popup and its on-page panel. A hover tints
// a row instantly (D31 forbids motion).
// ⛔ D60: no capsule — the bar corner 1; the key's dots are circles.
// ⭐ D152 (8): option A's look (docs/sketches/ats-options.html) — plain rows, the count as the heading, no depth boxes.
// The sketch's 600 weight is drawn at 500: the faces both products ship are DM Sans 400 / 500 / 700 (extension/fonts).
import { ATS_REPORT_THEMES, ATS_REPORT_DEFAULT_THEMES, ATS_REPORT_FONTS } from "./atsReportTokens.js";

export const ATS_REPORT_CSS = `
/* ── the host: nothing inherited from the page it sits in (the extension's on-page panel sits in anyone's page) ── */
:host { all: initial; display: block; font-family: var(--font-body); font-size: 16px; line-height: normal; font-weight: 400;
  color: var(--c-pair-ink); text-align: left; -webkit-font-smoothing: antialiased; }
:host([hidden]) { display: none; }
* { box-sizing: border-box; }

/* D32 · the pair's surface (client/src/styles/inkPair.css declares the same three lines for the posting's half). */
.ink-pair {
  background: var(--c-pair-surface);
  color: var(--c-pair-ink);
  border: 1px solid var(--c-pair-rule);
}

/* ⭐ D152 (8) · ats-options.html OPTION A. On its own (the extension, the deck, the public tool) the report is one block
   on the pair's surface, corner 22, padded 20 (the sketch's .match). In the posting it is :host([bare]) — the
   posting's match block is the surface, so the report draws no card of its own (one block, never a card in a card). */
.ats-card { border-radius: 22px; overflow: hidden; padding: 20px; font-size: 15.5px; line-height: 1.55; }
:host([bare]) .ats-card { background: transparent; border: 0; border-radius: 0; padding: 0; }
.ats-sum { border-radius: 22px; padding: 20px; font-size: 15.5px; line-height: 1.55; }
/* Inside the full report the header is the card's top, not a card of its own. */
.ats-card .ats-sum { border: 0; border-radius: 0; padding: 0; background: transparent; }
.ats-sum[data-compact="true"] { padding: 14px 16px; }

/* ── The header: "28 of 40 things this posting asks for" (the sketch's h3) · one plain sentence · the bar · its key ── */
.ats-sum__count {
  margin: 0 0 8px; font-family: var(--font-body); font-weight: 500; font-size: 30px; line-height: 1.08; letter-spacing: -.03em;
  color: var(--c-pair-ink);
}
.ats-sum[data-compact="true"] .ats-sum__count { font-size: 21px; }
.ats-sum__sub { margin: 0 0 14px; font-size: 15.5px; line-height: 1.55; color: var(--c-pair-ink-muted); }
.ats-sum[data-compact="true"] .ats-sum__sub { font-size: 13.5px; margin-bottom: 10px; }
.ats-sum__notes { margin: 0 0 14px; display: flex; flex-direction: column; gap: 8px; }

/* The bar (.bar): 6px, on the rule's colour (missing) — on your résumé. Corner 1 (D60: never a capsule — d60CompactRadius allows ≤ 30 % of the height; 2 on 6 was 33 %). */
.ats-bar { display: flex; height: 6px; border-radius: 1px; overflow: hidden; background: var(--c-pair-rule); margin: 0 0 6px; box-sizing: border-box; }
.ats-bar__seg { height: 100%; }
.ats-bar__seg--matched { background: var(--c-pair-matched); }
/* ⛔ NOT ENOUGH SIGNAL: every segment loses its colour, the bar is a DASHED outline — never a short Weak bar. */
.ats-bar[data-unknown="true"] { border: 1.5px dashed var(--c-band-unknown-edge); background: transparent; }
.ats-bar[data-unknown="true"] .ats-bar__seg { background: transparent; }
/* The key (.key): two words, each after a 7px dot (a perfect circle). */
.ats-key { display: flex; gap: 14px; flex-wrap: wrap; margin: 0 0 18px; font-size: 12.5px; line-height: 1.5; color: var(--c-pair-ink-faint); }
.ats-key__i::before { content: ""; display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 6px; }
.ats-key__i[data-k="matched"]::before { background: var(--c-pair-matched); }
.ats-key__i[data-k="missing"]::before { background: var(--c-pair-rule); }
.ats-sum[data-compact="true"] .ats-key { margin-bottom: 0; }

.ats-notes { margin: 0; padding-left: 16px; font-size: 13px; line-height: 1.6; color: var(--c-pair-ink-muted); }
.ats-note { font-size: 13px; line-height: 1.6; color: var(--c-pair-ink-muted); }
.ats-note__head { font-weight: 500; color: var(--c-pair-ink); margin-bottom: 2px; }
.ats-note--hard { color: var(--c-pair-missing); }
.ats-note[data-best="reached"] { color: var(--c-pair-matched); }
.ats-note__best { font-weight: 500; }

[hidden] { display: none !important; }

/* ── The body and its sections ─────────────────────────────────────────────────────────────── */
.ats-sec + .ats-sec { margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--c-pair-rule); }
.ats-gh {
  margin: 0 0 6px; display: flex; justify-content: space-between; align-items: baseline; gap: 10px;
  font-family: var(--font-body); font-size: 13.5px; font-weight: 500; line-height: 1.4; color: var(--c-pair-ink-muted);
}
.ats-gh__ct { font-weight: 500; font-size: 12.5px; color: var(--c-pair-ink-faint); }
.ats-sec__sub { font-size: 15.5px; color: var(--c-pair-ink-muted); margin: 0 0 6px; line-height: 1.55; }
.ats-fold .ats-sec__sub { font-size: 13px; }
/* ⭐ D105 P5: the Atlas link — a quiet word beside the term. */
.ats-atlas {
  margin-left: 8px; font-family: var(--font-body); font-size: 12.5px; font-weight: 500;
  color: var(--c-pair-kicker); text-decoration: underline; text-underline-offset: 2px; white-space: nowrap;
}
.ats-atlas:hover { color: var(--c-pair-ink); }
.ats-atlas:focus-visible { outline: 2px solid var(--c-pair-kicker); outline-offset: 2px; border-radius: 3px; }
/* A fold's summary IS its heading; a caret says it opens. */
.ats-fold > summary { cursor: pointer; list-style: none; }
.ats-fold > summary::-webkit-details-marker { display: none; }
.ats-fold > summary .ats-gh__label::before { content: "▸ "; }
.ats-fold[open] > summary .ats-gh__label::before { content: "▾ "; }
.ats-fold:not([open]) > summary { margin-bottom: 0; }
.ats-fold > summary:focus-visible { outline: 2px solid var(--c-pair-kicker); outline-offset: 2px; border-radius: 4px; }

/* ── Experience: its own row, pass/fail — a plain line, the state a word ─────────────────────── */
.ats-exp { display: flex; align-items: baseline; gap: 11px; font-size: 13.5px; line-height: 1.5; color: var(--c-pair-ink-muted); }
.ats-exp__mark { flex: 0 0 auto; white-space: nowrap; font-weight: 500; color: var(--c-pair-ink); }
.ats-exp[data-state="met"] .ats-exp__mark { color: var(--c-pair-matched); }
.ats-exp[data-state="short"] .ats-exp__mark { color: var(--c-pair-missing); }

/* ── The rows (.cl): the term · its kind in small type — read-only (46x: no claims) ─────────── */
.ats-rows { display: grid; gap: 0; }
.ats-cl {
  display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 11px 0;
  border-top: 1px solid var(--c-pair-rule); font-size: 15.5px; line-height: 1.4; color: var(--c-pair-ink);
}
.ats-cl:first-child { border-top: 0; }
.ats-cl__term { min-width: 0; overflow-wrap: anywhere; }
.ats-cl__term b { font-weight: 500; }
.ats-cl__kind { margin-left: 8px; font-size: 12.5px; color: var(--c-pair-ink-faint); }
.ats-cl[data-tone="gen"] { color: var(--c-pair-ink-muted); }
.ats-cl:focus-visible { outline: 2px solid var(--c-pair-kicker); outline-offset: 2px; }
/* ── More about this match ───────────────────────────────────────────────────────────────────── */
.ats-sec__label {
  font-size: 9px; font-weight: 700; letter-spacing: .15em; text-transform: uppercase; color: var(--c-pair-ink-faint);
  margin-bottom: 8px;
}
.ats-more { display: flex; flex-direction: column; gap: 10px; }
.ats-more__verdict { font-size: 12.5px; color: var(--c-pair-ink-muted); font-style: italic; line-height: 1.6; }
.ats-list { display: flex; flex-direction: column; gap: 6px; }
.ats-list__item { display: flex; gap: 8px; font-size: 12.5px; color: var(--c-pair-ink-muted); line-height: 1.6; }

/* ── D91 P4 · SHAPE CUES (moved from client/src/styles/cues.css — a document rule cannot reach into a shadow root).
   A user setting, not a theme: the host carries cues="shape" (the web app sets it from the one stored preference).
   The bar: yours solid · missing the bare track (its edge, below). ⛔ No reflow — a pattern, not a size. */

/* forced-colors (Windows High Contrast): the bar keeps an outline (cues.css P5). */
@media (forced-colors: active) {
  .ats-bar { border: 1px solid CanvasText; }
}
`;

const vars = (tokens) => Object.entries(tokens).map(([k, v]) => `--c-${k.toLowerCase().replace(/_/g, "-")}: ${v};`).join(" ");
const fontVars = () => Object.entries(ATS_REPORT_FONTS).map(([k, v]) => `${k}: ${v};`).join(" ");

/**
 * The token VALUES, on :host — per theme, from the registry. With no `theme` attribute the card follows the OS, as
 * the site's "system" preference does (Paper Light / Charcoal Dark) — the extension's own rule (D23). The web app
 * always names the live theme (components/AtsReport.jsx), so its card is the theme the page is in.
 */
export function atsHostCss(themes = ATS_REPORT_THEMES, defaults = ATS_REPORT_DEFAULT_THEMES) {
  const light = themes[defaults.light], dark = themes[defaults.dark];
  const out = [`:host { ${fontVars()} ${vars(light.tokens)} }`,
    `@media (prefers-color-scheme: dark) { :host(:not([theme])) { ${vars(dark.tokens)} } }`];
  for (const [id, t] of Object.entries(themes)) out.push(`:host([theme="${id}"]) { ${vars(t.tokens)} }`);
  return out.join("\n");
}

/** The whole shadow stylesheet: the values, then the design. */
export const ATS_REPORT_SHADOW_CSS = `${atsHostCss()}\n${ATS_REPORT_CSS}`;
