// ⭐ D119 P3 · THE TILE — one component for every resource a page lists (Learn's items today; the Atlas's resources and
// Your map's Learn next read the same one). Picture (16:9 a video, 2:3 a book, square a site) · kind badge (a MARK, D60 —
// never a pill) · title · source · optional / new tags · its D117 C8 state ("opened" — never "done"). The whole tile is the
// link: a new tab, and the press records the opening (onOpen). The picture is the server's stored copy
// (GET /api/thumbs/:hash — never hot-linked); without one the tile says what it is in type: "YouTube · search: <query>"
// with a play glyph (no thumbnail is invented for a search), a book's title and author, a site's domain.
// Fluid: a grid that wraps, no fixed widths; lazy images with the title as alt; four themes; contrast themes outline it.
import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import "./ResourceTile.css";

const SHAPE = { Video: "wide", Playlist: "wide", Book: "tall" };
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };

let learnThumbs = null;
/** Learn's stored pictures, fetched once per page load (GET /api/thumbs/learn) → { <item url>: thumb }. */
export function useLearnThumbs() {
  const [t, setT] = useState(learnThumbs || {});
  useEffect(() => {
    if (learnThumbs) return undefined;
    let live = true;
    api("/api/thumbs/learn").then(r => { learnThumbs = r?.thumbs || {}; if (live) setT(learnThumbs); }).catch(() => {});
    return () => { live = false; };
  }, []);
  return t;
}

/** The wrapping grid the tiles sit in (a list: each child an <li>). */
export function ResourceGrid({ children }) { return <ul className="rt-grid">{children}</ul>; }

export default function ResourceTile({ item, thumb = null, opened = false, onOpen, extra = null }) {
  const shape = thumb?.kind === "youtube" || thumb?.kind === "youtube_search" ? "wide" : SHAPE[item.k] || "square";
  const host = hostOf(item.u);
  const search = thumb?.kind === "youtube_search" || /youtube\.com\/results/.test(item.u || "");
  const query = (() => { try { return new URL(item.u).searchParams.get("search_query") || ""; } catch { return ""; } })();
  const fallback = search
    ? <span className="rt__fb rt__fb--video"><span className="rt__play" aria-hidden="true">▶</span><span>YouTube · search: {query}</span></span>
    : item.k === "Book"
      ? <span className="rt__fb rt__fb--book"><b>{item.t}</b>{item.s ? <span>{item.s}</span> : null}</span>
      : <span className="rt__fb rt__fb--site"><b aria-hidden="true">{(host || item.t || "?").charAt(0).toUpperCase()}</b><span>{host}</span></span>;
  const body = (
    <>
      <span className={`rt__pic rt__pic--${shape}`} data-thumb={thumb?.src ? "picture" : search ? "search" : "fallback"}>
        {thumb?.src ? <img src={thumb.src} alt={item.t} loading="lazy" decoding="async" /> : fallback}
      </span>
      <span className="rt__body">
        <span className="rt__tags">
          <span className="mark mark--dim rt__kind">{item.k}</span>
          {item.o ? <span className="mark mark--dim">optional</span> : null}
          {extra}
          {opened ? <span className="mark mark--ok" data-learn-opened={item.id}>opened</span> : null}
        </span>
        <span className="rt__title">{item.t}</span>
        {(item.s || thumb?.attribution) && <span className="rt__src">{[item.s, thumb?.attribution].filter(Boolean).join(" · ")}</span>}
      </span>
    </>
  );
  if (!item.u) return <span className="rt rt--plain" data-resource-tile={item.id || ""}>{body}</span>;
  return (
    <a className="rt" href={item.u} target="_blank" rel="noopener noreferrer" data-resource-tile={item.id || ""} data-learn-open={item.id}
      onClick={() => onOpen?.(item)}>
      {body}
    </a>
  );
}
