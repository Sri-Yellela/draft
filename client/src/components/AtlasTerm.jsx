// client/src/components/AtlasTerm.jsx — ⭐ D114 P3–P4 · A PUBLISHED ATLAS TERM INSIDE A POSTING: a quiet link and its popup.
//
// AT REST: no mark (the owner's call) — the word reads as the employer's text. Settings → Customise → "Learning links:
// shown" draws a faint dotted underline at rest (the layout option `learning`, data-learning-links on <html>).
// HOVER / FOCUS: a pointer and the faint dotted underline under THIS word; the popup opens after 300 ms of hover, at
// once on keyboard focus, and stays while the pointer is on the word or the popup; leave / Escape closes it. ONE popup
// at a time. TOUCH: a tap opens the popup and does not navigate; the popup's own link navigates.
// Each term is a real <a href="/atlas/<slug>"> in the tab order, so it works with no script at all.
// THE POPUP (~280 px, never clipped by the viewport, D92 surface tokens so all four themes draw it): the term and its
// kind · one or two lines of meaning — the node's definition, else the first sentence of its Wikipedia summary marked
// "From Wikipedia" (CC BY-SA, D105) · "Asked for in N open postings" · signed in: on your profile or not yet · a
// book-mark glyph and "Learn it in the Atlas →" · its first resource when it has one. Read on the first hover only.
// ⛔ Never in documents (résumé, cover letter, PDF) — only the posting surfaces mount it (d114NeverInDocuments).
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { linkSegments } from "../../../shared/atlasLinks.js";
import { peekAtlas, atlasLinkEvent, atlasHref } from "../lib/atlasLinks.js";
import ResourceTile from "./ResourceTile.jsx";
import "./AtlasTerm.css";

export const OPEN_DELAY_MS = 300;
const CLOSE_DELAY_MS = 150;
const WIDTH = 280, GUTTER = 12;
let closeOpen = null;   // the one open popup's close — opening another closes it

const KIND = { tool: "tool", skill: "skill", role: "role", stack: "stack", concept: "concept", pattern: "pattern" };

function place(el) {
  const r = el.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight;
  const width = Math.min(WIDTH, vw - 2 * GUTTER);
  const left = Math.max(GUTTER, Math.min(r.left, vw - width - GUTTER));
  const below = r.bottom + 6;
  const above = vh - r.top + 6;
  return r.bottom + 220 > vh && r.top > 220 ? { left, width, bottom: above } : { left, width, top: below };
}

function Bookmark() {
  return (
    <svg className="atl-term__glyph" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3 1.5h6v9L6 8.2 3 10.5z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

function Popup({ slug, name, pos, onEnter, onLeave, id }) {
  const [p, setP] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { let live = true; peekAtlas(slug).then(x => live && setP(x)).catch(() => live && setFailed(true)); return () => { live = false; }; }, [slug]);
  return createPortal(
    <div className="atl-term__pop" role="dialog" aria-label={`${name} — in the Atlas`} id={id} data-atlas-pop={slug}
      style={{ left: pos.left, width: pos.width, ...(pos.top != null ? { top: pos.top } : { bottom: pos.bottom }) }}
      onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <div className="atl-term__head"><b>{p?.name || name}</b>{p?.kind && <span className="atl-term__kind">{KIND[p.kind] || p.kind}</span>}</div>
      {!p && !failed && <p className="atl-term__quiet">Loading…</p>}
      {failed && <p className="atl-term__quiet">Could not read it just now.</p>}
      {p && (
        <>
          {p.meaning && <p className="atl-term__meaning" data-atlas-pop-meaning="">{p.meaning}
            {p.fromWikipedia && <span className="atl-term__src"> — From <a href={p.wikipediaUrl || "https://en.wikipedia.org"} target="_blank" rel="noopener noreferrer">Wikipedia</a> (CC BY-SA)</span>}
          </p>}
          <p className="atl-term__quiet">Asked for in {p.postings} open posting{p.postings === 1 ? "" : "s"}</p>
          {p.you && <p className="atl-term__quiet" data-atlas-pop-you={p.you}>{p.you === "have" ? "You: on your profile" : "Not on your profile yet"}</p>}
          {/* D115 P4(d): to the step of the owner's learning path that teaches it, when there is one; else its page. */}
          <a className="atl-term__learn" href={p.learnStep ? `${atlasHref("learn")}#step-${encodeURIComponent(p.learnStep.stepId)}` : atlasHref(slug)}
            onClick={() => atlasLinkEvent("visit")} data-atlas-pop-learn="" title={p.learnStep ? p.learnStep.label : undefined}>
            <Bookmark /> Learn it in the Atlas →
          </a>
          {/* ⭐ D119: the first resource as the ONE tile, with its stored picture (or what it is, in type). */}
          {p.firstResource && (
            <div className="atl-term__res" data-atlas-pop-resource="">
              <ResourceTile item={{ id: null, k: p.firstResource.format ? p.firstResource.format.charAt(0).toUpperCase() + p.firstResource.format.slice(1) : "Article",
                u: p.firstResource.url, t: p.firstResource.format === "docs" ? "Official docs" : p.firstResource.title, s: "" }}
                thumb={p.firstResource.thumb || null}/>
            </div>
          )}
        </>
      )}
    </div>,
    document.body,
  );
}

export function AtlasTerm({ slug, name, children }) {
  const ref = useRef(null);
  const timer = useRef(null);
  const lastPointer = useRef("mouse");
  const [pos, setPos] = useState(null);
  const id = `atl-pop-${slug}`;
  const clear = () => { clearTimeout(timer.current); timer.current = null; };
  const close = () => { clear(); setPos(null); if (closeOpen === close) closeOpen = null; };
  const open = () => {
    clear();
    if (closeOpen && closeOpen !== close) closeOpen();
    closeOpen = close;
    if (ref.current) { setPos(place(ref.current)); atlasLinkEvent("open"); }
  };
  const later = (fn, ms) => { clear(); timer.current = setTimeout(fn, ms); };
  useEffect(() => {
    if (!pos) return undefined;
    const onKey = (e) => { if (e.key === "Escape") { close(); ref.current?.focus(); } };
    const onAway = () => close();
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onAway, true);
    window.addEventListener("resize", onAway);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("scroll", onAway, true); window.removeEventListener("resize", onAway); };
  }, [pos]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { clear(); if (closeOpen === close) closeOpen = null; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <a ref={ref} className="atl-term" href={atlasHref(slug)} data-atlas-term={slug}
        aria-describedby={pos ? id : undefined} aria-expanded={pos ? "true" : "false"}
        onPointerDown={(e) => { lastPointer.current = e.pointerType || "mouse"; }}
        onMouseEnter={() => { if (lastPointer.current !== "touch") later(open, OPEN_DELAY_MS); }}
        onMouseLeave={() => { if (pos) later(close, CLOSE_DELAY_MS); else clear(); }}
        onFocus={() => open()}
        onBlur={(e) => { if (!document.getElementById(id)?.contains(e.relatedTarget)) later(close, CLOSE_DELAY_MS); }}
        onClick={(e) => {
          // TOUCH: a tap opens (or closes) the popup — it never navigates; the popup's link does.
          if (lastPointer.current === "touch") { e.preventDefault(); if (pos) close(); else open(); return; }
          atlasLinkEvent("visit");
        }}>
        {children}
      </a>
      {pos && <Popup slug={slug} name={name} pos={pos} id={id} onEnter={clear} onLeave={() => later(close, CLOSE_DELAY_MS)} />}
    </>
  );
}

/**
 * A posting's text with its Atlas terms linked. `used` carries "already linked" across the blocks of one posting, so
 * each term links at its FIRST occurrence only; `render` draws the plain pieces (a surface's own highlighting).
 */
export function AtlasText({ text, terms, used, render = (s) => s }) {
  if (!terms?.length) return render(text);
  return linkSegments(text, terms, used).map((seg, i) => {
    if (!seg.slug) return <span key={i}>{render(seg.text)}</span>;
    const t = terms.find(x => x.slug === seg.slug);
    return <AtlasTerm key={i} slug={seg.slug} name={t?.name || seg.text}>{render(seg.text)}</AtlasTerm>;
  });
}
