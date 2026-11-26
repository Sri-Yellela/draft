import { useEffect, useMemo, useRef, useState } from "react";
import {
  sentenceClauses, isOpenSet, isWordPanel, panelKey, panelRows, panelPress, panelNote, addRows,
  BOARD_PANEL, facetsUsable, TECHNOLOGY,
} from "../lib/filterSentenceModel.js";
import { SENTENCE_ID, PANEL_ID, ALL_FILTERS_ID } from "./BoardHeadline.jsx";
// ⛔ 47j w1-market (D197 Wave 1 #2): drawn as a plate piece — the frame is plate/MarketControls.jsx MarketPanel, the
// options `.pl-mk-op` (plate/plate.css, the cartouche's chip family). FullHouse.css's .fh-pan / .fh-op look is retired.
// The logic (one panel, focus in, Escape / Close giving focus back, the counts, the dimmed zeros) is unchanged.
import { MarketPanel } from "../plate/MarketControls.jsx";

/** A145: how many technologies the panel shows before the find box is used. */
export const TECH_SHOWN = 40;

// ── D35 · THE ONE PANEL A FILTER WORD OPENS — directly beneath the sentence ──────────────────────────
//
// Replaces D30's six always-visible dials (FilterDials.jsx, deleted) and the filter icon's drawer
// panel. The sentence's words ARE the dials now: pressing one opens its options HERE, pressing it
// again closes it, and only one is ever open — `open` is the board's single panel value.
//
// header.html's panel: the clause's key and "Close ×", its options as boxed pills with their counts,
// and one line of coverage beneath — every figure LIVE from GET /api/jobs/facets (panelNote).
//   ⛔ A zero-count option is DIMMED AND NOT SELECTABLE, NEVER HIDDEN (aria-disabled: still reached by
//      the keyboard, still read out, its 0 still shown).
//   ⛔ Location's first pill IS the floor, the United States: there is no "anywhere" to choose.
//   ⚠ Domain and location are OPEN sets (D30): a find box, and a list that scrolls inside the panel.
//
// ⛔ D35 §6 · KEYBOARD. The panel follows the sentence in the DOM, so tab order is reading order. On
// opening, focus moves INTO the panel (the find box, else the chosen option, else the first one a
// press can change), so it is reachable from the word that opened it; Escape and "Close ×" close it
// and give focus back to that word.
//
// Props: open, params, facets, facetsStatus, defaultDomain, otherFilterCount, onPatch(patch), onOpen(key),
//        onClose(), onMoreFilters()
export default function WordPanel(props) {
  if (!isWordPanel(props.open)) return null;
  return <PanelBody key={props.open} {...props} />;
}

/** The element focus moves to when a panel opens. Exported so a test can hold the rule. */
export function panelFocusTarget(root) {
  if (!root?.querySelector) return null;
  return root.querySelector("input")
    || root.querySelector('.pl-mk-op[aria-checked="true"]:not([aria-disabled="true"])')
    || root.querySelector('.pl-mk-op:not([aria-disabled="true"])')
    || root.querySelector("button");
}

/** The word that opened `open` — its own token, or "+ add" for a clause not yet in the sentence. */
export function openerSlot(open, doc = typeof document !== "undefined" ? document : null) {
  const sentence = doc?.getElementById?.(SENTENCE_ID);
  if (open === BOARD_PANEL.ALL) return doc?.getElementById?.(ALL_FILTERS_ID) || null;   // A146: outside the sentence
  return sentence?.querySelector?.(`[data-slot="${open}"]`)
    || sentence?.querySelector?.(`[data-slot="${BOARD_PANEL.MORE}"]`) || null;
}

/** Escape closes the panel (and the caller returns focus). Exported so a test can press it. */
export function panelKeyDown(e, close) {
  if (e.key === "Escape") { e.preventDefault?.(); e.stopPropagation?.(); close(); }
}

function PanelBody({ open, params = {}, facets = null, facetsStatus = "idle", defaultDomain = null,
                     otherFilterCount = 0, onPatch, onOpen, onClose, onMoreFilters }) {
  const ref = useRef(null);
  const [find, setFind] = useState("");
  useEffect(() => { panelFocusTarget(ref.current)?.focus?.(); }, []);
  const close = () => { onClose?.(); openerSlot(open)?.focus?.(); };

  const usable = facetsUsable(facets) && (facetsStatus === "ready" || facetsStatus === "loading") ? facets : null;
  const noCounts = facetsStatus === "unavailable" || facetsStatus === "error";
  const clause = sentenceClauses().find(c => c.key === open) || null;
  const note = panelNote(open, params, usable);
  const noteId = `${PANEL_ID}-note`;

  return (
    <MarketPanel panelRef={ref} id={PANEL_ID} data-panel={open} label={panelKey(open)} labelId={`${PANEL_ID}-key`} onClose={close}
      role="region" aria-labelledby={`${PANEL_ID}-key`} onKeyDown={(e) => panelKeyDown(e, close)}>
        {open === BOARD_PANEL.ALL
          ? <AllFilters params={params} facets={usable} defaultDomain={defaultDomain} onPatch={onPatch}
              otherFilterCount={otherFilterCount} onMoreFilters={() => { onClose?.(); onMoreFilters?.(); }} />
          : clause
          ? <ClauseOptions clause={clause} params={params} facets={usable} defaultDomain={defaultDomain}
              find={find} setFind={setFind} onPatch={onPatch} noteId={note ? noteId : undefined} />
          : <AddOptions params={params} otherFilterCount={otherFilterCount} noteId={note ? noteId : undefined} onOpen={onOpen}
              onMoreFilters={() => { onClose?.(); onMoreFilters?.(); }} />}
        {note && <p className="pl-mk-panel__note" id={noteId}>{note}</p>}
        {noCounts && (clause || open === BOARD_PANEL.ALL) && (
          <p className="pl-mk-panel__note">Counts aren't available right now — these still filter the board.</p>
        )}
        {/* ⭐ D42 (owner, 10-06): "+ add" LEFT THE SENTENCE. What can still be added — posted, fit,
            salary & more — sits here, in the box any filter word opens. */}
        {clause && (
          <div className="pl-mk-panel__sub" data-add-section>
            <span className="pl-label pl-mk-panel__key" id={`${PANEL_ID}-add`}>Add a filter</span>
            <AddOptions params={params} otherFilterCount={otherFilterCount} labelledBy={`${PANEL_ID}-add`}
              exclude={open} onOpen={onOpen} onMoreFilters={() => { onClose?.(); onMoreFilters?.(); }} />
          </div>
        )}
    </MarketPanel>
  );
}

/**
 * ⭐ A146 (45o, the D179 sketch's (b): "the sketch's filter rail becomes All filters — a panel that opens in place from
 * the sentence (same counts, every facet), never a permanent column"). Every clause — the sentence's four, then the
 * optional ones (technology, posted, fit, sponsorship) — each with its own heading and ITS OWN panel's options, so a count
 * here is the same number its word's panel shows (D153 (2): known matches only). Each open set keeps its own find box.
 * Salary & more stays one press away (the drawer it always opened).
 */
export function AllFilters({ params, facets, defaultDomain, onPatch, otherFilterCount = 0, onMoreFilters }) {
  const [finds, setFinds] = useState({});
  return (
    <div className="pl-mk-all" data-all-filters="">
      {sentenceClauses().map(c => (
        <div key={c.key} className="pl-mk-all__sec" data-all-clause={c.key}>
          <span className="pl-label pl-mk-panel__key">{c.label}</span>
          <ClauseOptions clause={c} params={params} facets={facets} defaultDomain={defaultDomain}
            find={finds[c.key] || ""} setFind={(v) => setFinds(f => ({ ...f, [c.key]: v }))} onPatch={onPatch} />
        </div>
      ))}
      <div className="pl-mk-all__sec">
        <button type="button" className="pl-mk-op" data-all-more="" onClick={() => onMoreFilters?.()}>
          {otherFilterCount > 0 ? `Salary & more · ${otherFilterCount} on` : "Salary & more"}
        </button>
      </div>
    </div>
  );
}

function ClauseOptions({ clause, params, facets, defaultDomain, find, setFind, onPatch, noteId }) {
  const openSet = isOpenSet(clause);
  const rows = useMemo(() => {
    const all = panelRows(clause, params, facets, { defaultDomain });
    if (!openSet) return all;
    // An open set: the floor / defaults first, then what is chosen, then the most postings; a zero
    // only sinks and dims, it is never dropped. The find box narrows by the pill's own words.
    const head = all.filter(r => r.kind !== "option" && r.kind !== "strict");
    const tail = all.filter(r => r.kind === "strict");
    const opts = all.filter(r => r.kind === "option")
      .sort((a, b) => (b.selected - a.selected) || ((b.count ?? 0) - (a.count ?? 0)));
    const q = find.trim().toLowerCase();
    // ⭐ A145 (45o): the technologies are ~180 — unsearched, the TECH_SHOWN most-posted (and the chosen one) show; the find
    // box reaches every one. A zero still sinks and dims.
    const found = q ? opts.filter(r => r.label.toLowerCase().includes(q))
      : clause.dim === TECHNOLOGY ? opts.filter((r, i) => r.selected || i < TECH_SHOWN) : opts;
    return [...head, ...found, ...tail];
  }, [clause, params, facets, defaultDomain, openSet, find]);
  const findLabel = clause.key === "location" ? "Find a city or state" : clause.dim === TECHNOLOGY ? "Find a technology" : "Find a kind of work";
  const options = (
    <>
      {openSet && (
        <input className="pl-mk-find" type="search" value={find} onChange={e => setFind(e.target.value)}
          placeholder={findLabel} aria-label={findLabel} />
      )}
      <PanelOptions clause={clause} rows={rows} params={params} onPatch={onPatch} openSet={openSet} noteId={noteId} />
    </>
  );
  // ⭐ A145 (45o, the D179 sketch's (a): "the role part is the Category → Subcategory picker with true counts"): in the
  // domain word's panel the ROLE picker comes first; the older kinds of work stay below it (extends, never replaces).
  if (clause.key === "domain" && (facets?.clauses?.role || []).some(o => o.count > 0)) {
    return (
      <>
        <RolePicker params={params} facets={facets} onPatch={onPatch} />
        <div className="pl-mk-panel__sub" data-domain-kinds="">
          <span className="pl-label pl-mk-panel__key">Or by kind of work</span>
          {options}
        </div>
      </>
    );
  }
  return (
    <>
      {options}
      {clause.key === "domain" && <RolePicker params={params} facets={facets} onPatch={onPatch} />}
    </>
  );
}

/**
 * ⭐ D179 (a) (45l) · THE ROLE — Category → Subcategory with the board's own counts (GET /api/jobs/facets' `role`: a posting
 * counts under a role only when it was classified into it). A category opens its subcategories; picking one sets the
 * board's role and the domain word reads it; "Any role" clears it. Pure but for which category is open.
 */
export function RolePicker({ params = {}, facets = null, onPatch }) {
  const opts = facets?.clauses?.role || [];
  const groups = useMemo(() => {
    const m = new Map();
    for (const o of opts) {
      const g = m.get(o.groupId) || { id: o.groupId, name: o.group, count: 0, subs: [] };
      g.count += o.count || 0;
      g.subs.push(o);
      m.set(o.groupId, g);
    }
    return [...m.values()].filter(g => g.count > 0).sort((a, b) => b.count - a.count)
      .map(g => ({ ...g, subs: g.subs.filter(s => s.count > 0).sort((a, b) => b.count - a.count) }));
  }, [opts]);
  const [openCat, setOpenCat] = useState(params.category || null);
  if (!groups.length) return null;
  const chosen = params.subcategory || "";
  const shown = groups.find(g => g.id === openCat) || null;
  return (
    <div className="pl-mk-role" data-role-picker="">
      <span className="pl-label pl-mk-panel__key" id={`${PANEL_ID}-role`}>By role</span>
      <div className="pl-mk-opts pl-mk-opts--open" role="group" aria-labelledby={`${PANEL_ID}-role`}>
        <button type="button" className="pl-mk-op" aria-checked={!chosen && !params.category} role="radio"
          onClick={() => onPatch?.({ category: "", subcategory: "" })}>Any role</button>
        {groups.map(g => (
          <button key={g.id} type="button" className="pl-mk-op" role="radio" data-role-group={g.id}
            aria-checked={params.category === g.id && !chosen} aria-expanded={shown?.id === g.id}
            onClick={() => setOpenCat(c => (c === g.id ? null : g.id))}>
            {g.name}<span className="pl-mk-op__n">{g.count}</span>
          </button>
        ))}
      </div>
      {shown && (
        <div className="pl-mk-opts pl-mk-opts--open" role="group" aria-label={shown.name} data-role-subs={shown.id}>
          <button type="button" className="pl-mk-op" role="radio" aria-checked={params.category === shown.id && !chosen}
            onClick={() => onPatch?.({ category: shown.id, subcategory: "" })}>All of {shown.name}<span className="pl-mk-op__n">{shown.count}</span></button>
          {shown.subs.map(s => (
            <button key={s.value} type="button" className="pl-mk-op" role="radio" data-role={s.value} aria-checked={chosen === s.value}
              onClick={() => onPatch?.({ category: shown.id, subcategory: s.value })}>
              {s.label}<span className="pl-mk-op__n">{s.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** A clause's pills. Pure — a test renders it and presses its pills directly. */
export function PanelOptions({ clause, rows, params = {}, onPatch, openSet = false, noteId }) {
  const role = clause.dim.multi ? "checkbox" : "radio";
  return (
    <div className={`pl-mk-opts${openSet ? " pl-mk-opts--open" : ""}`} role="group"
      aria-labelledby={`${PANEL_ID}-key`} aria-describedby={noteId}>
      {rows.map(r => (
        <button key={`${r.kind}:${r.value}`} type="button" className={r.kind === "strict" ? "pl-mk-op pl-mk-op--strict" : "pl-mk-op"}
          role={r.kind === "strict" ? "checkbox" : role}
          data-kind={r.kind} data-value={r.value} aria-checked={r.selected}
          aria-disabled={r.disabled ? "true" : undefined}
          title={r.note || undefined}
          onClick={() => { const patch = panelPress(clause, params, r); if (patch) onPatch?.(patch); }}>
          {r.label}
          {r.count != null && <span className="pl-mk-op__n">{r.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** "+ add" — what can be added. Pure, like PanelOptions. */
export function AddOptions({ params = {}, otherFilterCount = 0, onOpen, onMoreFilters, noteId, labelledBy, exclude = null }) {
  return (
    <div className="pl-mk-opts" role="group" aria-labelledby={labelledBy || `${PANEL_ID}-key`}>
      {addRows(params, { otherFilterCount }).filter(r => r.key !== exclude).map(r => (
        <button key={r.key} type="button" className="pl-mk-op" data-add={r.key}
          aria-disabled={r.disabled ? "true" : undefined}
          aria-describedby={r.kind === "employment" ? noteId : undefined}
          onClick={() => {
            if (r.disabled) return;
            if (r.kind === "clause") onOpen?.(r.key);
            else if (r.kind === "drawer") onMoreFilters?.();
          }}>
          {r.label}
        </button>
      ))}
    </div>
  );
}
