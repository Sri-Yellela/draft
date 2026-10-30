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
// panel, the board's panel, the phone's sheet, /tools/ats, the extension's popup and its on-page panel. A hover lifts
// a box instantly (the sketch eases it over .15s; D31 forbids motion, so it does not).
// ⛔ D60: no capsule — boxes radius 9, the count chip radius 6, the bar square.
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

.ats-card { border-radius: 18px; overflow: hidden; box-shadow: var(--c-pair-card-shadow); }

/* ── The header (.shd): band heading · "you cover 9 of the 12" · (score) — then the flush bar ──────── */
.ats-sum { border-radius: 18px; overflow: hidden; box-shadow: var(--c-pair-card-shadow); }
/* Inside the full report the header is the card's top, not a card of its own. */
.ats-card .ats-sum { border: 0; border-radius: 0; box-shadow: none; }
.ats-sum__head {
  padding: 20px 24px; display: grid; grid-template-columns: 1fr auto; gap: 16px; align-items: center;
  background: linear-gradient(180deg, var(--c-pair-mast-tint), transparent);
}
.ats-sum[data-compact="true"] .ats-sum__head { padding: 14px 16px; }
/* The band IS the heading — the logo face, 800 italic (.bd). */
.ats-sum__band {
  display: inline-block; margin-bottom: 5px;
  font-family: 'Poppins', var(--font-body); font-style: italic; font-weight: 800; font-size: 20px; line-height: 1.1;
  color: var(--c-pair-hi);
}
/* ⛔ NOT ENOUGH SIGNAL is the scorer declining — no hue, a DASHED outline: never a low grade. */
.ats-sum__band[data-unknown="true"] {
  padding: 4px 10px; border-radius: 9px; border: 1.5px dashed var(--c-band-unknown-edge); color: var(--c-band-unknown);
}
.ats-sum__cap { margin-left: 8px; font-size: 11px; color: var(--c-pair-ink-faint); }
.ats-sum__count { margin: 0; font-size: 12.5px; line-height: 1.55; color: var(--c-pair-ink-faint); }
/* D50 · the provisional note under a shown number. */
.ats-sum__note { margin: 6px 0 0; font-size: 11px; line-height: 1.4; font-style: italic; color: var(--c-pair-ink-faint); }
/* The number in SERIF (.n) — the largest element when A76 lets it show. ⭐ D48 (owner, 10-07): "the ATS number
   switches colour" — to the sketch's --atx (PAIR_KICKER: #A33200 on cream, where the logo orange fails as text),
   the same ink as the posting panel's ATS number box. */
.ats-sum__score {
  font-family: var(--font-display); font-weight: 400; font-size: 46px; line-height: 1; text-align: right;
  color: var(--c-pair-kicker);
}
.ats-sum__score small {
  display: block; margin-top: 4px; font-family: var(--font-body); font-size: 7.5px; font-weight: 700; line-height: 1;
  letter-spacing: .16em; text-transform: uppercase; color: var(--c-pair-ink-faint);
}
.ats-sum__notes { padding: 0 24px 16px; display: flex; flex-direction: column; gap: 8px; }
.ats-sum[data-compact="true"] .ats-sum__notes { padding: 0 16px 12px; }

/* The bar (.bar): THREE flush segments, 6px, square — matched · missing · generic (grey: never a gap). */
.ats-bar { display: flex; height: 6px; box-sizing: border-box; }
.ats-bar__seg { height: 100%; }
.ats-bar__seg--matched { background: var(--c-pair-matched); }
.ats-bar__seg--missing { background: var(--c-pair-missing); }
.ats-bar__seg--generic { background: var(--c-pair-generic); }
/* ⛔ NOT ENOUGH SIGNAL: every segment loses its colour, the bar is a DASHED outline — never a short Weak bar. */
.ats-bar[data-unknown="true"] { border: 1.5px dashed var(--c-band-unknown-edge); }
.ats-bar[data-unknown="true"] .ats-bar__seg { background: transparent; }

.ats-notes { margin: 0; padding-left: 16px; font-size: 11.5px; line-height: 1.6; color: var(--c-pair-ink-muted); }
.ats-note {
  font-size: 11.5px; line-height: 1.6; padding: 8px 11px; border-radius: 9px;
  background: var(--c-pair-raised); color: var(--c-pair-ink-muted); border: 1px solid var(--c-pair-rule);
}
.ats-note__head { font-weight: 700; color: var(--c-pair-ink); margin-bottom: 2px; }
.ats-note--hard { color: var(--c-pair-missing); }
.ats-note[data-best="reached"] { background: var(--c-pair-met-quiet); color: var(--c-pair-matched); border-color: var(--c-pair-matched-edge); }
.ats-note__best { font-weight: 700; }

/* ── The body (.sb) and its sections, each headed by a .gh with a monospace count ─────────────────── */
.ats-sb { padding: 19px 22px 22px; border-top: 1px solid var(--c-pair-rule); }
.ats-sec + .ats-sec { margin-top: 21px; padding-top: 18px; border-top: 1px solid var(--c-pair-rule); }
.ats-gh {
  margin: 0 0 12px; display: flex; justify-content: space-between; align-items: baseline; gap: 10px;
  font-family: var(--font-body); font-size: 9px; font-weight: 700; line-height: 1; letter-spacing: .15em;
  text-transform: uppercase; color: var(--c-pair-ink-faint);
}
.ats-gh__ct {
  font-family: var(--font-count); font-size: 10px; font-weight: 700; line-height: 1; letter-spacing: 0;
  background: var(--c-pair-raised); border: 1px solid var(--c-pair-rule); border-radius: 6px; padding: 3px 7px;
  color: var(--c-pair-ink-faint);
}
.ats-sec__sub { font-size: 11.5px; color: var(--c-pair-ink-faint); margin: -6px 0 12px; line-height: 1.5; }
.ats-boxes { display: flex; flex-wrap: wrap; gap: 8px; }
/* ⭐ D105 P5: a box and its Atlas link, kept together on one line. The link is a quiet word, not a second box. */
.ats-boxwrap { display: inline-flex; align-items: center; gap: 5px; max-width: 100%; }
.ats-atlas {
  font-family: var(--font-body); font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
  color: var(--c-pair-kicker); text-decoration: underline; text-underline-offset: 2px; white-space: nowrap;
}
.ats-atlas:hover { color: var(--c-pair-ink); }
.ats-atlas:focus-visible { outline: 2px solid var(--c-pair-kicker); outline-offset: 2px; border-radius: 3px; }
/* A fold's summary IS its .gh; a caret says it opens. */
.ats-fold > summary { cursor: pointer; list-style: none; }
.ats-fold > summary::-webkit-details-marker { display: none; }
.ats-fold > summary .ats-gh__label::before { content: "▸ "; }
.ats-fold[open] > summary .ats-gh__label::before { content: "▾ "; }
.ats-fold:not([open]) > summary { margin-bottom: 0; }
.ats-fold > summary:focus-visible { outline: 2px solid var(--c-pair-kicker); outline-offset: 2px; border-radius: 4px; }
.ats-claim-note { font-size: 11px; color: var(--c-pair-ink-faint); font-style: italic; line-height: 1.55; margin-top: 11px; }

/* ── Experience (.xp): its own row, pass/fail ────────────────────────────────────────────────── */
.ats-exp {
  display: flex; align-items: center; gap: 11px; padding: 11px 13px; border-radius: 10px;
  background: var(--c-pair-raised); border: 1px solid var(--c-pair-rule); box-shadow: var(--c-pair-lift);
  font-size: 12.5px; line-height: 1.5; color: var(--c-pair-ink-muted);
}
.ats-exp__mark {
  flex: 0 0 auto; white-space: nowrap; color: var(--c-pair-ink);
  font-family: 'Poppins', var(--font-body); font-style: italic; font-weight: 800; font-size: 12.5px; line-height: 1;
}
.ats-exp[data-state="met"] { background: var(--c-pair-met-quiet); border-color: var(--c-pair-matched-edge); color: var(--c-pair-matched); }
.ats-exp[data-state="met"] .ats-exp__mark { color: var(--c-pair-matched); }
.ats-exp[data-state="short"] { background: var(--c-pair-missing-quiet); border-color: var(--c-pair-missing-edge); color: var(--c-pair-missing); }
.ats-exp[data-state="short"] .ats-exp__mark { color: var(--c-pair-missing); }

/* ── Boxes (.b). RECTANGULAR (radius 9), D1's depth at rest. A claim box is a CONTROL: it lifts on hover
 * and settles on press. A read-only box is a label: it rests, and never pretends to be pressable. */
.ats-box {
  display: inline-flex; align-items: center; gap: 9px; max-width: 100%; box-sizing: border-box;
  padding: 8px 11px; border-radius: 9px; font: inherit; font-size: 12.5px; font-weight: 400; line-height: 1.35;
  background: var(--c-pair-raised); color: var(--c-pair-ink); border: 1px solid var(--c-pair-rule);
  box-shadow: var(--c-pair-lift); overflow-wrap: anywhere; text-align: left;
}
/* The \`kind\` (.kind): a small label behind a hairline, at the sketch's reduced opacity — raised from .62 to
 * the least that still reads at 4.5:1 on every box (PAIR_KIND_ALPHA, per theme). */
.ats-box__kind {
  font-family: var(--font-body); font-size: 7.5px; font-weight: 700; line-height: 1; letter-spacing: .11em;
  text-transform: uppercase; opacity: var(--c-pair-kind-alpha);
  border-left: 1px solid var(--c-pair-rule); padding-left: 9px; margin-left: 1px;
}
.ats-box[data-tone="ok"] { background: var(--c-pair-met-quiet); border-color: var(--c-pair-matched-edge); color: var(--c-pair-matched); }
.ats-box[data-tone="gen"] { background: var(--c-pair-generic-quiet); border-color: var(--c-pair-generic-edge); color: var(--c-pair-generic); }
.ats-box[data-tone="claim"] { border-color: var(--c-pair-missing-edge); color: var(--c-pair-missing); }
.ats-box:focus-visible { outline: 2px solid var(--c-pair-kicker); outline-offset: 2px; }
.ats-box--claim { cursor: pointer; }
.ats-box--claim:hover { transform: translateY(-2px); box-shadow: var(--c-pair-lift2); }
.ats-box--claim:active { transform: translateY(0); box-shadow: var(--c-pair-press); }
.ats-box--claim[aria-pressed="true"] { background: var(--c-pair-met-quiet); border-color: var(--c-pair-matched-edge); color: var(--c-pair-matched); }
/* The FILLED + square (.p) — the claim box's indicator; a ✓ on the green once claimed. */
.ats-box__plus {
  flex: 0 0 auto; width: 17px; height: 17px; border-radius: 5px; display: grid; place-items: center;
  background: var(--c-pair-missing); color: var(--c-pair-surface);
  font-family: var(--font-body); font-size: 13px; font-weight: 700; line-height: 1;
}
.ats-box--claim[aria-pressed="true"] .ats-box__plus { background: var(--c-pair-matched); }

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
   The pair's three-segment bar: yours solid · missing hatched · generic dotted. ⛔ No reflow — a pattern, not a size. */
:host([cues="shape"]) .ats-bar__seg--missing {
  background-image: repeating-linear-gradient(135deg, transparent 0 2px, var(--c-pair-surface) 2px 3.5px);
}
:host([cues="shape"]) .ats-bar__seg--generic {
  background-image: radial-gradient(var(--c-pair-surface) 0.8px, transparent 1px); background-size: 4px 4px;
}

/* forced-colors (Windows High Contrast) DROPS box-shadow, which is all a depth box has for an edge (cues.css P5). */
@media (forced-colors: active) {
  .ats-box, .ats-exp, .ats-note, .ats-gh__ct { border: 1px solid CanvasText; }
  .ats-box--claim { border-color: ButtonText; }
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
