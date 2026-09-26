// THE BRAND MARK. ONE IMPLEMENTATION, THREE CALLERS.
// ================================================================================================
//
// ⛔ THERE WERE THREE COPIES OF THIS UNTIL 2026-09-26, AND THE DUPLICATION SHIPPED THE OLD BRAND.
//
// TopBar.jsx carried `AnimatedLucyLogo`, ScrollDock.jsx carried `LucyLogo`, and this file carried
// `StampLogo`. P4's rebrand swept two of them. The third — TopBar's, the mark on every page of the
// authenticated app — spelled the legacy name as two hardcoded spans and was missed, because
// nothing pointed at it and test/brandAndOriginGuard.test.js could not see a name split across
// elements. Production's app nav showed the old brand for days after the sweep was declared
// complete, with the suite green. It was found by screenshotting the real board.
//
// So this is the only one now. A second copy is not a style question here — it is the specific
// mechanism by which a rename half-ships.
//
// ── WHAT THE THREE ACTUALLY DIFFERED ON, and where each landed ─────────────────────────────────
//
//   the accent backdrop   ScrollDock drew a rotated accent rect behind the stamp; the other two
//                         did not. Kept, as an opt-in `accent` prop — a real difference between
//                         the marketing dock and the app bar, not an accident.
//   size                  three scales here, a fourth (initial-only, smaller) in ScrollDock.
//                         Folded into one SIZES table.
//   the collapse          only this file animated it. ScrollDock switched to a separate branch
//                         instead and TopBar's was retired. `progress` covers both.
//   ⛔ box overflow       THE ONE REAL DISAGREEMENT, and TopBar was right. See below.
//
// ⛔ THE BOX MUST NOT CLIP, AND THAT IS MEASURED, NOT PREFERENCE.
//
// TopBar's copy carried the finding: `overflow: hidden` on the stamp box was A/B'd on the running
// app at 1440x900, deviceScaleFactor 6, by forcing the property to `visible` and differencing the
// screenshots — 33 device pixels changed. The box is `rotate(-2deg)` with a border radius, so
// clipping to its own padding box shaves the mark's corner and the italic glyph bearings, which
// sit flush against the content edge.
//
// It is also redundant, which is what makes removing it safe rather than a trade: the only thing
// that needs clipping is the collapsing tail span, and that span carries its own `overflow` below.
// This file had the clip and TopBar did not, so unifying meant choosing — the measurement chooses.
// Every caller now gets the unclipped mark.
//
// ⚠ THIS COMPONENT USED TO SPELL THE OLD NAME STRUCTURALLY, across four spans, so that collapsing
// the two middle ones left the old two-letter initials. A two-word mark with a two-letter collapse
// has no mechanical translation to a one-word mark, so the rebrand could not be a string
// substitution: the markup itself had to change. It is one fixed initial plus one collapsible
// tail, derived, which works for any single-word name.
// ── HISTORY THAT MOVED HERE WITH THE MARK ──────────────────────────────────────────────────────
//
// These were TopBar.jsx's notes about its own copy. They are about the MARK, not about the top
// bar, so they belong with the one implementation — leaving them behind is how the next person
// re-derives a decision that was already made and measured.
//
// THE MARK IS WHITE. W6 made it translucent — `rgba(255,255,255,0.06)` behind a `--border-glass`
// hairline with muted text — reasoning that a solid stamp was "the one element on the surface that
// did not belong to it". That was a regression: the top bar is fully transparent, so a 6%-white
// fill on a dark starfield left the mark with almost no edge of its own. Two things W6 added went
// with the translucency and neither is a feature being dropped: `backdropFilter: blur(8px)`, which
// has nothing to blur behind an opaque fill, and `transition: "background 0.15s, border-color
// 0.15s"`, for a hover lift that was never wired — there is no mouse handler on this element, so
// the transition could not fire. test/topBarChrome.test.js asserts all four stay gone.
//
// ⚠ THE COLLAPSE IS LIVE ON THE MARKETING SURFACES AND RETIRED IN THE APP BAR, which is why
// `progress` still exists. In the app bar it took its value from AppScrollContext, which was
// permanently 0 — its only writer was a PullToRefresh onScroll on a container that never scrolls
// (the WINDOW scrolls) — so the animation never ran once, in any session. Removing it there
// changed no pixel, verified by diffing screenshots. NavBar and LandingPage drive it for real.

import { WORDMARK } from '../../../shared/brand.js';

// WORDMARK, not BRAND: this renders the name as a MARK, which is the one place the lowercase
// casing decided on 2026-09-26 applies. `textTransform: uppercase` then sets it as the stamp.
const INITIAL = WORDMARK.slice(0, 1);
const TAIL    = WORDMARK.slice(1);

/**
 * The four scales. `perChar` drives the collapse width and is derived PER CHARACTER rather than
 * per word — the old constants were hand-tuned to two specific strings, which is precisely why the
 * rebrand could not reuse them.
 */
const SIZES = {
  mini: { fontSize: 11, padV: 2, padH: 5,  border: 2,   height: 26, minWidth: 36, perChar: 7.8  },
  sm:   { fontSize: 15, padV: 3, padH: 10, border: 2.5, height: 36, minWidth: 50, perChar: 10.7 },
  md:   { fontSize: 17, padV: 4, padH: 12, border: 2.5, height: 42, minWidth: 50, perChar: 12.3 },
  lg:   { fontSize: 20, padV: 5, padH: 14, border: 2.5, height: 50, minWidth: 50, perChar: 14.7 },
};

/**
 * @param {object} p
 * @param {number} [p.progress] 0 = the full wordmark, 1 = collapsed to its initial only.
 * @param {'mini'|'sm'|'md'|'lg'} [p.size]
 * @param {string|null} [p.accent] when set, draws the rotated accent rect behind the stamp. The
 *   marketing dock uses it; the app bar does not. A COLOUR, not a boolean, so the caller's theme
 *   stays the caller's — this component takes no theme and needs none.
 */
export function StampLogo({ progress = 0, size = 'sm', accent = null }) {
  const s  = SIZES[size] || SIZES.sm;
  const pc = Math.min(Math.max(progress, 0), 1);

  const tailMaxW    = Math.round(s.perChar * TAIL.length);
  const tailW       = Math.round((1 - pc) * tailMaxW);
  const textOpacity = Math.max(0, 1 - pc * 1.8);

  const letterStyle = {
    fontFamily: "'Barlow Condensed','DM Sans',system-ui,sans-serif",
    fontWeight: 800,
    fontSize: s.fontSize,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#0f0f0f',
    fontStyle: 'italic',
    lineHeight: 1,
    whiteSpace: 'nowrap',
  };

  const collapseStyle = {
    ...letterStyle,
    display: 'inline-block',
    // ⛔ THE ONLY overflow IN THIS COMPONENT, and it belongs here rather than on the box: a zero
    // max-width without a clip would let the tail spill instead of collapsing.
    overflow: 'hidden',
    opacity: textOpacity,
    transition: 'max-width 400ms cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 350ms ease',
    verticalAlign: 'bottom',
  };

  return (
    <div style={{
      position: 'relative', display: 'inline-flex', alignItems: 'center',
      justifyContent: 'center', flexShrink: 0, height: s.height, minWidth: s.minWidth,
    }}>
      {accent && (
        <div style={{ position: 'absolute', inset: 0, background: accent,
                      transform: 'rotate(-3deg)', borderRadius: 2 }}/>
      )}
      <div style={{
        position: 'relative', zIndex: 1,
        padding: `${s.padV}px ${s.padH}px`,
        background: '#ffffff',
        border: `${s.border}px solid #0f0f0f`,
        transform: 'rotate(-2deg)',
        borderRadius: 2,
        display: 'flex', alignItems: 'center',
      }}>
        <span style={letterStyle}>{INITIAL}</span>
        <span style={{ ...collapseStyle, maxWidth: tailW + 'px' }}>{TAIL}</span>
      </div>
    </div>
  );
}
