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
    // ⭐ A241 (47g, walked on the plate market): a bar mounted inside a HIDDEN panel (the plate's Index tab) measures its
    // sticky line as 0 px, so the observer's margin is wrong and it never fires once the tab shows — measured: the bar
    // stuck on screen at y 74 with the page at 1693, data-stuck "false", the stuck frost never drawn, the search field
    // floating over row 5. D49 keeps it a sentinel (never a scroll listener): a ResizeObserver on the bar's parent sees
    // the panel show (its size leaves 0), re-measures the line and re-arms the observer with the right margin.
    let io = null, armedPx = px;
    const arm = (at) => { io?.disconnect(); armedPx = at; io = new IntersectionObserver(check, { root, rootMargin: `-${at}px 0px 0px 0px`, threshold: [0, 1] }); io.observe(el); };
    arm(px);
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => {
      if (!alive) return;
      const now = resolveTopPx(el, top);
      if (now !== armedPx) arm(now);
      check();
    });
    if (el.parentElement) ro?.observe(el.parentElement);
    const raf = requestAnimationFrame(check);
    return () => { alive = false; cancelAnimationFrame(raf); io?.disconnect(); ro?.disconnect(); };
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
