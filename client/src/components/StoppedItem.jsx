import "./DraftHouse.css";

// ============================================================
// StoppedItem — one thing that stopped and needs the user (D25)
// ============================================================
// D1's card idiom, the same one The Table uses: depth tokens at rest and on hover, and a RAIL of
// 52 px squares that is zero-width until hover or keyboard focus (always shown where the pointer
// cannot hover). The body is a button that opens the FOLD: what this item needs, then one quiet
// line for everything that needed no attention — exact matches are counted there, never listed.
//
//   item     from lib/draftHouseExceptions.js buildStoppedItems — { key, kind, tone, title, sub, fold }
//   rail     [{ label, glyph, onClick, primary, title }] — at most three, like D1's
//   children rendered inside the fold, under the quiet line (an item's own decision buttons)
// ============================================================

export default function StoppedItem({ item, open = false, onToggle, rail = [], children = null,
                                     selectable = false, selected = false, onSelect = null }) {
  const foldId = `dh-fold-${item.key}`;
  return (
    <article className="dh-item" data-tone={item.tone} data-open={open ? "true" : "false"}
             data-stopped-item={item.kind} data-selected={selected ? "true" : undefined}>
      <div className="dh-item__head">
        {/* D53: multi-select clear — a plain checkbox, labelled by the item's own title. */}
        {selectable && (
          <input type="checkbox" className="dh-item__pick" checked={selected} onChange={() => onSelect?.()}
            aria-label={`Select ${item.title} to clear`} />
        )}
        <button type="button" className="dh-item__main" aria-expanded={open} aria-controls={foldId}
          onClick={() => onToggle?.(item.key)}>
          {/* The shared-element title (viewTransitions): the job a Draft flew in from lands here. */}
          <span className="dh-item__title" data-vt-title={item.jobId || undefined}>{item.title}</span>
          {item.sub && <span className="dh-item__sub">{item.sub}</span>}
        </button>
        {rail.length > 0 && (
          <div className="dh-rail">
            {rail.slice(0, 3).map(a => (
              <button key={a.label} type="button" className="dh-sq" data-primary={a.primary ? "true" : "false"}
                title={a.title || a.label} aria-label={a.title || a.label}
                disabled={a.disabled} onClick={a.onClick}>
                <span aria-hidden="true">{a.glyph}</span>
                <span className="dh-sq__cap">{a.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {open && (
        <div className="dh-fold" id={foldId} data-fold="">
          {item.fold?.needs?.length > 0 && (
            <ul className="dh-fold__needs">
              {item.fold.needs.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          )}
          {item.fold?.quiet && <p className="dh-fold__quiet" data-quiet-line="">{item.fold.quiet}</p>}
          {children}
        </div>
      )}
    </article>
  );
}
