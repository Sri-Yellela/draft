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
// The mark is artwork, not text: an <img> with the WORDMARK as its accessible name.

import { WORDMARK } from '../../../shared/brand.js';
import wordmarkSrc from '../assets/brand/wordmark.png';
import monogramSrc from '../assets/brand/monogram.png';

// The two images' aspect ratios (width / height of the shared vertical crop), measured from the art.
const WORDMARK_ASPECT = 1722 / 605;
const MONOGRAM_ASPECT = 670 / 605;

/** Mark height per size. The old stamp's four scales, carried over by its rendered height. */
const SIZES = { mini: 18, sm: 24, md: 28, lg: 34 };

/**
 * @param {object} p
 * @param {number} [p.progress] 0 = "/draft", 1 = condensed to "/d".
 * @param {'mini'|'sm'|'md'|'lg'} [p.size]
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
      <img src={monogramSrc} alt="" draggable={false}
        style={{ position: 'absolute', left: 0, top: 0, height: h, width: monoW, display: 'block' }} />
      {/* "/draft" over it, revealed by the box width — ⛔ the ONLY overflow in this component. */}
      <span style={{ position: 'absolute', inset: 0, overflow: 'hidden', opacity: tailOpacity,
                     transition: 'opacity 350ms ease' }}>
        <img src={wordmarkSrc} alt="" draggable={false}
          style={{ height: h, width: wordW, maxWidth: 'none', display: 'block' }} />
      </span>
    </span>
  );
}
