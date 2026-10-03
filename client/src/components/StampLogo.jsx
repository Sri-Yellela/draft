// THE BRAND MARK. ONE IMPLEMENTATION, EVERY CALLER.
// ================================================================================================
//
// ⭐ THE REDESIGNED MARK (owner, 09-30): "/draft" expanded, "/d" condensed — the same artwork the
// extension's icons carry, like for like. Both images are cut from the owner's source art
// (extension/icons/draft logo.jpg: the orange keyed to transparency, the slash and the d separated as
// connected shapes) with the SAME vertical crop, so the "/d" sits pixel-for-pixel on the start of
// "/draft". That is what makes the collapse a like-for-like of the old one: the box narrows from the
// wordmark's width to the monogram's while the rest of the word fades, and the "/d" never moves.
//
// It replaces the white, black-bordered, rotated "DRAFT" text stamp — the mark before the redesign.
// What carries over, because it was measured or decided rather than styled:
//
//   ONE IMPLEMENTATION. There were three copies until 09-26 and the duplication shipped the old
//   brand on the app bar for days with the suite green. Every surface renders this component.
//   THE BOX DOES NOT CLIP. The 33-pixel finding (a clipped rotated box shaved the mark's corner) is
//   kept in spirit: the only overflow is the collapsing tail's, never the mark's own box.
//   THE COLLAPSE IS LIVE ON MARKETING, RETIRED IN THE APP BAR. `progress` stays for NavBar and the
//   landing page; TopBar passes none (its scroll progress was permanently 0).
//
// The mark is artwork, not text, with the WORDMARK as its accessible name.
//
// ⭐ D19 (owner, 10-03): IN LIGHT MODE THE "/" IS THE ORANGE AND "draft" IS INK; dark mode unchanged. A
// TOKEN change, not a per-surface one: the art is drawn as two CSS MASKS — the slash and the letters,
// split from the same PNGs by scripts/d19SplitMark.mjs (a test fails if they are stale) — each filled
// from a token, var(--c-logo-slash) and var(--c-logo-word) (styles/colorTokens.js). Every surface that
// renders this component follows; nothing special-cases a page. `forced-color-adjust: none` keeps the
// mark in Windows high-contrast mode, which would otherwise repaint a mask's background colour.

import { WORDMARK } from '../../../shared/brand.js';
import wordmarkSlash   from '../assets/brand/wordmark-slash.png';
import wordmarkLetters from '../assets/brand/wordmark-letters.png';
import monogramSlash   from '../assets/brand/monogram-slash.png';
import monogramLetters from '../assets/brand/monogram-letters.png';

// One piece of the art: its slash and its letters, stacked, each a mask filled from its token.
function MaskedArt({ slash, letters, width, height }) {
  const layer = (src, token) => (
    <span aria-hidden="true" style={{
      position: 'absolute', inset: 0, background: `var(${token})`, forcedColorAdjust: 'none',
      WebkitMaskImage: `url(${src})`, maskImage: `url(${src})`,
      WebkitMaskSize: '100% 100%', maskSize: '100% 100%',
      WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat' }} />
  );
  return (
    <span style={{ position: 'relative', display: 'block', width, height }}>
      {layer(slash, '--c-logo-slash')}
      {layer(letters, '--c-logo-word')}
    </span>
  );
}

// The two images' aspect ratios (width / height of the shared vertical crop), measured from the art.
const WORDMARK_ASPECT = 1722 / 605;
const MONOGRAM_ASPECT = 670 / 605;

/** Mark height per size. The old stamp's four scales, carried over by its rendered height. */
const SIZES = { mini: 18, sm: 24, md: 28, nav: 30, lg: 34 };  // nav: the app bar's (D10)

/**
 * @param {object} p
 * @param {number} [p.progress] 0 = "/draft", 1 = condensed to "/d".
 * @param {'mini'|'sm'|'md'|'nav'|'lg'} [p.size]
 */
export function StampLogo({ progress = 0, size = 'sm' }) {
  const h  = SIZES[size] || SIZES.sm;
  const pc = Math.min(Math.max(progress, 0), 1);
  const wordW = Math.round(h * WORDMARK_ASPECT);
  const monoW = Math.round(h * MONOGRAM_ASPECT);
  const width = Math.round(wordW - pc * (wordW - monoW));
  const tailOpacity = Math.max(0, 1 - pc * 1.8);

  return (
    <span role="img" aria-label={WORDMARK}
      style={{ position: 'relative', display: 'inline-block', flexShrink: 0, height: h, width,
               transition: 'width 400ms cubic-bezier(0.25, 0.46, 0.45, 0.94)', verticalAlign: 'middle' }}>
      {/* "/d", always: the condensed mark, and the first two glyphs of the expanded one. */}
      <span style={{ position: 'absolute', left: 0, top: 0 }}>
        <MaskedArt slash={monogramSlash} letters={monogramLetters} width={monoW} height={h} />
      </span>
      {/* "/draft" over it, revealed by the box width — ⛔ the ONLY overflow in this component. */}
      <span style={{ position: 'absolute', inset: 0, overflow: 'hidden', opacity: tailOpacity,
                     transition: 'opacity 350ms ease' }}>
        <MaskedArt slash={wordmarkSlash} letters={wordmarkLetters} width={wordW} height={h} />
      </span>
    </span>
  );
}
