import "./DraftHouse.css";
import CompanyBubble from "./CompanyBubble.jsx";

// ============================================================
// DraftHouseSide — what matters now (D113 UI U7; owner 10-31)
// ============================================================
// The side column beside the tree (above it below 900 px). Its blocks come from lib/draftHouseTree.js
// sideBlocks, in its order — broken connections, Needs you, Ready for your review, Running, Replies,
// Tidy up — each left out when empty except Needs you, which says so. A row OPENS THE SAME BRANCH in the
// tree and scrolls to it (onOpen). A block's own controls (Review all, the line, Clear older…) are the
// panel's, passed in `extra` by block id.
// ============================================================

const TITLES = { needs: "Needs you", review: "Ready for your review", running: "Running", replies: "Replies", tidy: "Tidy up" };

export default function DraftHouseSide({ blocks = [], onOpen, onFix, extra = {} }) {
  return (
    <aside className="dhs" data-draft-side="" aria-label="What matters now">
      {blocks.map(b => (
        <section key={b.id} className="dhs-blk" data-side-block={b.id}>
          {b.id === "connections" ? b.items.map(c => (
            <div key={c.key} className="dhs-warn" data-connection={c.key}>
              <b>{c.title}</b>
              <span>{c.sub} </span>
              <button type="button" className="dhs-link" onClick={() => onFix?.(c)}>{c.fixLabel || "Fix it"}</button>
            </div>
          )) : (
            <>
              <h2 className="dhs-h">{TITLES[b.id]}{b.id !== "tidy" && <span className="mark-count">{b.items.length}</span>}</h2>
              {b.id === "needs" && b.items.length === 0 && <p className="dhs-quiet" data-side-empty="">Nothing. It's all running.</p>}
              {b.id === "tidy" ? (
                b.count > 0 && <p className="dhs-quiet">{b.count} stopped job{b.count === 1 ? "" : "s"} older than 7 days.</p>
              ) : b.items.map(n => (
                <button key={n.key} type="button" className="dhs-item" data-side-item={n.key} onClick={() => onOpen?.(n)}>
                  <CompanyBubble company={n.company} ring={n.ring} size="sm" />
                  <span className="dhs-item__text">
                    <span className="dhs-item__t">{n.company}{n.title ? ` · ${n.title}` : ""}</span>
                    <span className="dhs-item__s">{n.say}</span>
                  </span>
                </button>
              ))}
              {extra[b.id]}
            </>
          )}
        </section>
      ))}
    </aside>
  );
}
