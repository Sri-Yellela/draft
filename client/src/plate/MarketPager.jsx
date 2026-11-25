// ⭐ D199 C3 (owner 11-25: "use the page system from the older version") · THE PAGER, in the plate style — under the openings
// (Deck · Terrain · Index), the `Market` board's "PAGE 1 OF 469 · 24 PER PAGE · 11,247 OPENINGS" and its bordered mono
// tiles ‹ Prev · 1 2 3 … N · Next ›, the current one white with a 3 px ink shadow. The page size is the code's 50 (owner:
// "use 50"). The tiles follow the classic pager's rule (the first, the current ± 2, the last; lib/boardPaging.js
// pagerTiles). A move goes through the board's own goPage (JobsPanel publishes `goTo`), which writes `?page=` so Back /
// Forward and a reload keep the place; the openings scroll back to their top.
import { pagerTiles, pageLine } from "../lib/boardPaging.js";

export default function MarketPager({ page = 1, totalPages = 0, total = null, pageSize = 50, onGo, loading = false }) {
  const line = pageLine({ page, totalPages, pageSize, total });
  const tiles = pagerTiles(page, totalPages);
  if (!line) return null;
  const go = (p) => {
    if (p === page) return;
    onGo?.(p);
    document.getElementById("openings")?.scrollIntoView?.({ block: "start", behavior: "smooth" });
  };
  return (
    <nav aria-label="Pages" className="pl-mk-pager" data-market-pager="" aria-busy={loading || undefined}>
      <span className="pl-label" data-page-line="">{line}</span>
      {tiles.length ? (
        <div className="pl-mk-pager__tiles">
          {tiles.map((t, i) => (t.kind === "gap"
            ? <span key={`g${i}`} className="pl-mk-tile" data-gap="" aria-hidden="true">…</span>
            : (
              <button key={`${t.kind}${t.page}`} type="button" className="pl-mk-tile" data-tile={t.kind}
                aria-current={t.current ? "page" : undefined} disabled={t.disabled || undefined}
                aria-label={t.kind === "prev" ? "Previous page" : t.kind === "next" ? "Next page" : t.page === totalPages ? `Last page, ${t.page}` : `Page ${t.page}`}
                onClick={() => go(t.page)}>
                {t.kind === "prev" ? "‹ Prev" : t.kind === "next" ? "Next ›" : t.page.toLocaleString("en-US")}
              </button>
            )))}
        </div>
      ) : null}
    </nav>
  );
}
