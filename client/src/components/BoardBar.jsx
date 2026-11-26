import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import UsbSuggest from "./UsbSuggest.jsx";
import { api } from "../lib/api.js";
// The typeahead list's own rules (.usb__suggest*) live with the landing page's bar.
import "./UnifiedSearchBar.css";
// ⛔ 47j w1-market (D197 Wave 1 #2): the search field and Import a job are drawn as plate pieces (plate/plate.css
// .pl-mk-field, plate/MarketControls.jsx MarketPanel + .pl-textarea / .pl-btn); FullHouse.css no longer dresses them.
import { MarketPanel } from "../plate/MarketControls.jsx";

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

// ⛔ 47j R2: the classic market's views segment (ViewSegment — All jobs · Starred · Imported) is deleted; the views are the
// shell's area nav (App.jsx MARKET_AREA_VIEWS).

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
    <div className="pl-mk-field" role="search" aria-label="Job search">
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
        <button type="button" className="pl-mk-field__clear" aria-label="Clear the search"
          onClick={() => { setQ(""); commit(""); }}>
          <X size={12} aria-hidden="true" />
        </button>
      )}
      {children}
    </div>
  );
}


// ⛔ 47j R2: the classic bar's sort icon (SortIcon) is deleted; the sort is the cartouche's MarketSortButton
// (plate/MarketControls.jsx), opening the same one SortPanel.

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
    <MarketPanel id="import-job" label="Import a job" labelId="import-job-key" onClose={onClose} data-import-panel="">
    <form className="pl-mk-import" data-import-box="" onSubmit={submit} aria-labelledby="import-job-key"
      onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); onClose?.(); } }}>
      <textarea className="pl-textarea" value={value} onChange={(e) => setValue(e.target.value)} rows={isLink || !v ? 1 : 4} autoFocus
        placeholder="Paste a link to the posting, or its description" aria-label="A link to the posting, or its description"
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && isLink) submit(e); }} />
      <div className="pl-mk-import__row">
        <button type="submit" className="pl-btn pl-btn--primary" data-import-go="" disabled={!v || busy}>{busy ? "Reading it…" : "Import"}</button>
        {note && <p className="pl-mk-import__note" data-import-note={note.kind} role={note.kind === "error" ? "alert" : "status"}>{note.text}</p>}
      </div>
    </form>
    </MarketPanel>
  );
}

// ⛔ D40 (owner, 10-06): the + square (AddSquare) is GONE. + is the fourth VIEW — the jobs you imported,
// with the Import jobs button at its head (JobsPanel's ImportedHeader).
