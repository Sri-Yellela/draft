import { useEffect, useRef, useState } from "react";
import "./StickyBar.css";

// ── D49 (owner, 10-07) · ONE sticky-at-the-top section, reused ────────────────────────────────────────
//
// "Use the same code modularly … make it a modular section that can be reused." Two implementations of
// one behaviour is how the mark, the cards and the buttons all drifted, so the board's bar and the
// posting panel's action bar (D48) both render THIS.
//
// What it owns:
//   · `position: sticky` at `top` against the NEAREST SCROLL CONTAINER — the page for the board, the
//     panel's own scroll area for the posting. The consumer passes `top`; nothing assumes `window`.
//   · a STUCK state (data-stuck="true") found with an IntersectionObserver on a 1px SENTINEL placed just
//     before the bar — never a scroll listener — so the hairline and shadow appear only when it is
//     actually stuck.
//   · a translucent surface with a blur, so content passes beneath it legibly; the named tier --z-sticky.
//   · prefers-reduced-motion: no transition (StickyBar.css).
//
// ⚠ Sticky fails SILENTLY under an `overflow: hidden` ancestor, and only sticks within its PARENT's box:
// the parent must span the content that scrolls beneath it (the board's bar therefore lives at the top of
// <main>, not in the short header above it — D49's finding).
//
// Props: top (CSS length, default "0px"), as (element, default "div"), className, children, ...rest
export default function StickyBar({ top = "0px", as: Tag = "div", className = "", children, ...rest }) {
  const sentinel = useRef(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    const root = scrollParentOf(el);
    // The bar is stuck exactly when the sentinel has scrolled above the sticky line. The rootMargin pulls
    // the observed area's top down to that line (the consumer's `top`, resolved to px).
    const px = resolveTopPx(el, top);
    let alive = true;
    // ⚠ Measured: on first mount two callbacks land in the same tick, the first taken mid-layout (the
    // sentinel at 22px, "stuck") — so each callback re-reads the sentinel's LIVE position against the
    // sticky line instead of trusting its entry, and a disconnected observer's callback is ignored.
    const check = () => {
      if (!alive) return;
      const line = (root ? root.getBoundingClientRect().top : 0) + resolveTopPx(el, top);
      setStuck(el.getBoundingClientRect().top < line - 0.5);
    };
    const io = new IntersectionObserver(check, { root, rootMargin: `-${px}px 0px 0px 0px`, threshold: [0, 1] });
    io.observe(el);
    const raf = requestAnimationFrame(check);
    return () => { alive = false; cancelAnimationFrame(raf); io.disconnect(); };
  }, [top]);
  return (
    <>
      <span ref={sentinel} className="sticky-bar__sentinel" aria-hidden="true" />
      <Tag className={`sticky-bar${className ? ` ${className}` : ""}`} data-stuck={stuck ? "true" : "false"}
        style={{ "--sticky-top": top }} {...rest}>
        {children}
      </Tag>
    </>
  );
}

/** The nearest ancestor that scrolls vertically, or null for the viewport. Exported for the test. */
export function scrollParentOf(el) {
  for (let p = el?.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if (oy === "auto" || oy === "scroll" || oy === "overlay") return p;
  }
  return null;
}

/** A CSS length (px, or a var() that resolves to one) in px, measured in place. */
function resolveTopPx(el, top) {
  const probe = document.createElement("span");
  probe.style.cssText = `position:absolute;visibility:hidden;height:${top};`;
  el.parentElement?.appendChild(probe);
  const px = probe.getBoundingClientRect().height || 0;
  probe.remove();
  return Math.round(px);
}
