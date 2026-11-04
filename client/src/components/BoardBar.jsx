import { useState } from "react";
import { X } from "lucide-react";
import UsbSuggest from "./UsbSuggest.jsx";
// The typeahead list's own rules (.usb__suggest*) live with the landing page's bar.
import "./UnifiedSearchBar.css";
import "./FullHouse.css";

// ⭐ D147 (owner 11-03): the bar is the SEARCH alone now — the views moved into the Sort / view control's panel (as
// words) and the sort control moved to the title row (SortWord). D35's account below is the history.
// ── D35 §3 · THE CONDENSED BAR — one row, below the sentence, above the jobs ─────────────────────────
//
//   [ ALL 2626 · ★ 14 · /d 9 · + 3 ]  [ search ———————————— ]  [ ⇅ ]      (D40: + is a view)
//
// header.html's bar. The three views are ONE segmented control, each with its count (GET
// /api/jobs/facets' `views`; no count is drawn without an answer, never a 0 in its place). The search
// field fills the middle — inset, a magnifier, no separate Search button: Enter searches. Sort is the
// sketch's two-arrow glyph in a 40px square (open = filled accent); ADD JOBS is just "+", bold italic
// in the logo face, in the same 40px square, the orange fill — the one creative action in the bar.
//
// Phone (FullHouse.css): two rows, chosen — the views and the two squares, then the search full width.
// These pieces are presentational; App.jsx wires them to the board's context.

/** The views segment. `views` is [[id, label, title]]; counts is { [id]: number | null }. Pure. */
export function ViewSegment({ views, value, counts = {}, onChange }) {
  return (
    <div className="fh-views" role="group" aria-label="Board view">
      {views.map(([id, label, title]) => {
        const n = counts[id];
        return (
          <button key={id} type="button" data-view={id} aria-pressed={value === id}
            title={title} aria-label={n != null ? `${title}, ${n}` : title}
            onClick={() => onChange?.(id)}>
            <span aria-hidden="true">{label}</span>
            {n != null && <span className="fh-ct" aria-hidden="true">{n}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** The search field: the board's keyword, Enter commits it (A74: one press, one search). */
export function BoardSearch({ onSubmit }) {
  const [q, setQ] = useState("");
  const submit = () => onSubmit?.({ query: q });
  return (
    <div className="fh-srch" role="search" aria-label="Job search">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4.3-4.3" /></svg>
      <UsbSuggest field="title" value={q} onChange={setQ}>
        {sugg => (
          <input {...sugg} type="search" enterKeyHint="search"
            placeholder="Job title, company, or anything in the posting…" aria-label="Search jobs"
            onKeyDown={e => { sugg.onKeyDown(e); if (!e.defaultPrevented && e.key === "Enter") submit(); }} />
        )}
      </UsbSuggest>
      {q && (
        <button type="button" className="fh-srch__clear" aria-label="Clear the search"
          onClick={() => { setQ(""); onSubmit?.({ query: "" }); }}>
          <X size={12} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/** The sketch's sort glyph — two arrows, up and down, exactly header.html's path. */
export const SORT_GLYPH_PATH = "M7 4v16M7 20l-3-3M7 4l3 3M17 20V4M17 4l3 3M17 20l-3-3";

/**
 * ⭐ D147 (owner 11-03) · THE ONE SORT / VIEW CONTROL — it was the ⇅ square in the bar; now it is a WORD in the title
 * row: "⇅ Sort: <the order's label>", + " · Saved" when a view other than All jobs is chosen (the views live in its panel).
 * Open = filled accent; a chosen (non-default) order or view holds the accent edge. The same attributes the square had.
 */
export function SortWord({ open = false, chosen = false, label = "", view = null, onPress }) {
  const said = `${label ? `Sort: ${label}` : "Sort"}${view ? ` · ${view}` : ""}`;
  return (
    <button type="button" className="fh-sortw" data-board-icon="sort" data-active={chosen ? "true" : "false"}
      aria-expanded={open} aria-controls={open ? "fh-sort" : undefined}
      aria-label={`${said} — change the order or the view`} title={`${said} — change the order or the view`}
      onClick={() => onPress?.()}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d={SORT_GLYPH_PATH} /></svg>
      <span>{said}</span>
    </button>
  );
}

// ⛔ D40 (owner, 10-06): the + square (AddSquare) is GONE. + is the fourth VIEW — the jobs you imported,
// with the Import jobs button at its head (JobsPanel's ImportedHeader).
