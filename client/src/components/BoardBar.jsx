import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import UsbSuggest from "./UsbSuggest.jsx";
import { api } from "../lib/api.js";
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

/** The search field: the board's keyword, Enter commits it (A74: one press, one search). ⭐ D156 (5): `children` sit
 *  inside the field at its right end — the sort icon. */
export function BoardSearch({ onSubmit, onPickRole, onPickTech, children = null, value = null, placeholder = "Search a company, title or skill" }) {
  const [q, setQ] = useState("");
  // ⛔ (owner 11-06: "after search it doesnt go back to all jobs. its stuck on searched term results") — the board's
  // query is committed on Enter, so emptying the field (deleting the text) left the last search in force. The term
  // that is in force is remembered here; emptying the field while one is in force commits the empty search — all jobs.
  const committed = useRef("");
  const commit = (query) => { committed.current = query.trim(); onSubmit?.({ query }); };
  const submit = () => commit(q);
  const change = (v) => { setQ(v); if (!String(v).trim() && committed.current) commit(""); };
  // ⭐ D199 C2 (47h, M1 caveat (iii)): `value` = the search in force (the board's localSearch). When something else changes it —
  // the plate market's search chip × or Clear all — the box follows, so the field never shows a search that isn't applied.
  useEffect(() => {
    if (value == null) return;
    const v = String(value);
    if (v.trim() === committed.current) return;
    committed.current = v.trim();
    setQ(v);
  }, [value]);
  return (
    <div className="fh-srch" role="search" aria-label="Job search">
      {/* ⭐ D149 (fullhouse-declutter.html `.sbar`): the field alone — no magnifier — and the sketch's words. */}
      <UsbSuggest field="title" value={q} onChange={change} onPickRole={onPickRole} onPickTech={onPickTech}>
        {sugg => (
          <input {...sugg} type="search" enterKeyHint="search"
            placeholder={placeholder} aria-label="Search jobs"
            onKeyDown={e => {
              sugg.onKeyDown(e);
              if (e.defaultPrevented) return;
              if (e.key === "Enter") submit();
              else if (e.key === "Escape" && q) { e.preventDefault(); change(""); }
            }} />
        )}
      </UsbSuggest>
      {q && (
        <button type="button" className="fh-srch__clear" aria-label="Clear the search"
          onClick={() => { setQ(""); commit(""); }}>
          <X size={12} aria-hidden="true" />
        </button>
      )}
      {children}
    </div>
  );
}


/**
 * ⭐ D156 (5) (owner 11-05: "bring back the sort as an icon in the search bar") · THE SORT ICON — inside the search field,
 * at its right end (it was D147's "Sort: For you" word at the top of the column). It opens the one sort panel (SortPanel)
 * as a small menu under the field — For you · Best fit · Newest · Salary · Company, the current one marked; the icon's
 * label says the current sort. A chosen (non-default) order holds the accent. The same attributes the word had.
 */
export function SortIcon({ open = false, chosen = false, label = "", onPress }) {
  const said = label ? `Sort: ${label}` : "Sort";
  return (
    <button type="button" className="fh-sorti" data-board-icon="sort" data-active={chosen ? "true" : "false"}
      aria-haspopup="true" aria-expanded={open} aria-controls={open ? "fh-sort" : undefined}
      aria-label={`${said} — change the order`} title={`${said} — change the order`}
      onClick={() => onPress?.()}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 4v15M3.5 15.5 7 19l3.5-3.5M17 20V5M13.5 8.5 17 5l3.5 3.5" /></svg>
    </button>
  );
}

/**
 * ⭐ D156 (4) (owner 11-05: "the starred and imported has to be there and the import function") · IMPORT A JOB, inline under
 * the search: paste a link or the job's description → POST /api/import/job (the existing import — the extension's capture
 * route: draft reads it deterministically, dedups it, keeps it for you, and it is scored against your résumé like every
 * posting on the board) → it is under Imported. A login-walled link asks for the text instead (the route's
 * needsClientCapture); a refusal says why, in the route's own words.
 */
export function ImportJobBox({ onImported, onClose }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);   // { kind: "ok" | "ask" | "error", text }
  const v = value.trim();
  const isLink = /^https?:\/\/\S+$/i.test(v);
  const submit = async (e) => {
    e?.preventDefault?.();
    if (!v || busy) return;
    setBusy(true); setNote(null);
    try {
      const d = await api("/api/import/job", { method: "POST", body: JSON.stringify(isLink ? { url: v } : { text: v }) });
      if (d?.needsClientCapture) { setNote({ kind: "ask", text: d.message || "That site needs you signed in — paste the job's description instead." }); return; }
      setNote({ kind: "ok", text: d?.capture?.message || d?.message || `${d?.job?.title || "The job"} is under Imported.` });
      setValue("");
      onImported?.(d?.job || null);
    } catch (err) {
      setNote({ kind: "error", text: err?.message || "Could not import this job. Please try again." });
    } finally { setBusy(false); }
  };
  return (
    <form className="fh-import" data-import-box="" onSubmit={submit} aria-label="Import a job"
      onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); onClose?.(); } }}>
      <textarea value={value} onChange={(e) => setValue(e.target.value)} rows={isLink || !v ? 1 : 4} autoFocus
        placeholder="Paste a link to the posting, or its description" aria-label="A link to the posting, or its description"
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && isLink) submit(e); }} />
      <div className="fh-import__row">
        <button type="submit" className="fh-import__go" disabled={!v || busy}>{busy ? "Reading it…" : "Import"}</button>
        <button type="button" className="fh-import__x" onClick={() => onClose?.()}>Close</button>
        {note && <p className="fh-import__note" data-import-note={note.kind} role={note.kind === "error" ? "alert" : "status"}>{note.text}</p>}
      </div>
    </form>
  );
}

// ⛔ D40 (owner, 10-06): the + square (AddSquare) is GONE. + is the fourth VIEW — the jobs you imported,
// with the Import jobs button at its head (JobsPanel's ImportedHeader).
