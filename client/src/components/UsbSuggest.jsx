// Typeahead for the search bar's two free-text inputs.
//
// The suggestions come from GET /api/jobs/suggest, which derives them from scraped_jobs rows in the
// caller's active role scope and ranks them by frequency — there is no hand-maintained list of
// roles on either side of the wire. Typing "s" leads with "Software Engineer" because that is the
// most common role on the board, not because anyone wrote it down.
//
// This wraps the input rather than replacing it: the caller still owns the value, still owns
// onChange, and search BEHAVIOUR is untouched — accepting a suggestion only fills the box. What
// happens next is still the bar's double-click local->live pattern.
import { useState, useEffect, useRef, useId, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getAuthContext } from "../lib/api.js";
import { DockPortal } from "./DockPortal.jsx";
import { Z } from "../styles/zLayers.js";

// Same portal, same tokens, as the bar's dropdowns (UsbSelect) — one popup style, not two.
//
// It has to be a portal: .usb__bar is `overflow: hidden` (it clips the inner fields to the bar's
// rounded corners), so an absolutely-positioned list inside it is invisible. Measured that way
// first — the list was in the DOM with all eight rows and a correct 240x280 rect, painting nothing,
// because the ancestor two levels up cut it off. That is precisely what DockPortal's own header
// says it exists to prevent.
const PORTAL_THEME = {
  menuSurface: "var(--bg-card)",
  surface:     "var(--bg-card)",
  border:      "var(--border-glass)",
  shadowLg:    "var(--c-shadow-lg), 0 0 0 1px var(--border-glass)",
};

// Long enough that a fast typist makes one request for a word rather than one per letter, short
// enough to feel immediate. The server also caches per role scope, so bursts cost nothing.
const DEBOUNCE_MS = 180;
const MIN_CHARS   = 1;

/**
 * Deliberately NOT lib/api.js's `api()`.
 *
 * That helper treats ANY 401 as session expiry: it clears the stored auth context and dispatches
 * `rm:session-expired`, which force-logs-out the app shell. Correct for a real request, wrong for
 * this one twice over. UnifiedSearchBar also renders on the PUBLIC landing page, where there is no
 * session at all and every keystroke would have fired that event; and on the board, a lapsed
 * session would have been surfaced by a typeahead rather than by whatever the user was actually
 * doing. A suggestion that cannot be fetched is not an event in the application's life — it is
 * just no suggestion.
 *
 * Returns [] for absolutely everything that is not a clean 200, and reports 401 separately so the
 * caller can stop asking.
 */
async function fetchSuggestions(field, q) {
  const headers = { Accept: "application/json" };
  const token = getAuthContext();
  if (token) headers["x-rm-auth-context"] = token;
  const r = await fetch(
    `/api/jobs/suggest?field=${field}&q=${encodeURIComponent(q)}`,
    { credentials: "include", headers },
  );
  if (r.status === 401) return { unauthorised: true, suggestions: [] };
  if (!r.ok) return { suggestions: [] };
  const d = await r.json().catch(() => ({}));
  return { suggestions: Array.isArray(d?.suggestions) ? d.suggestions : [] };
}

// ⭐ D179 (owner 11-07, override (2)): "no companies page label, it should be a search return as suggestions as a dropdown
// to select from" — the TITLE box suggests, in one list grouped by kind: Companies (with open jobs) · Roles (the taxonomy's
// subcategories) · Technologies · Titles. GET /api/public/suggest answers signed in and signed out alike (no session, no
// 401). A company opens its page; a role or a technology goes to the caller (onPickRole / onPickTech) or, with none,
// fills the box like a title; a title fills the box exactly as before.
async function fetchGrouped(q, scope = null) {
  const r = await fetch(`/api/public/suggest?q=${encodeURIComponent(q)}${scope ? `&kind=${scope}` : ""}`, { headers: { Accept: "application/json" } });
  if (!r.ok) return null;
  return r.json().catch(() => null);
}
// ⭐ 45n: People — public profiles only (services/peopleSearch.js), each with workplace · school so two of one name differ.
const GROUP_WORD = { company: "Companies", person: "People", role: "Roles", tech: "Technologies", title: "Titles" };
// ⭐ A148 (45o, owner 11-08): "a label system that users can click on to ask what they are searching for … say people,
// company, role, stack/skill". The labels head the dropdown from the moment the box has focus; one pressed = the search
// asks the server for ONLY that kind (`kind=`, one query, up to 10 rows; titles are not asked). Pressing it again — or
// Backspace in an empty box — clears it.
export const SEARCH_SCOPES = Object.freeze([["person", "People"], ["company", "Company"], ["role", "Role"], ["tech", "Stack / Skill"]]);
const SCOPE_NOUN = { person: "people", company: "companies", role: "roles", tech: "technologies or skills" };

export default function UsbSuggest({
  field,            // "title" | "location"
  value,
  onChange,
  onAccept,         // optional: called after a suggestion is committed
  onPickRole,       // D179: optional ({ id, name, categoryId }) — a role picked from the grouped list
  onPickTech,       // D179: optional ({ name }) — a technology picked from the grouped list
  children,         // render prop: (inputProps) => <input {...inputProps}/>
}) {
  const [items, setItems]   = useState([]);
  const [open, setOpen]     = useState(false);
  // -1 means "nothing highlighted". Tab is only intercepted when this is >= 0, so a user who is
  // tabbing THROUGH the field still gets a plain Tab.
  const [active, setActive] = useState(-1);
  const listId = useId();
  const boxRef = useRef(null);
  // Captured when the list opens, so DockPortal can place itself under the input.
  const [rect, setRect] = useState(null);
  // Set while we are writing the value ourselves, so the fetch effect below can tell "the user
  // typed" from "we just accepted a suggestion" and not immediately reopen the list under them.
  const selfEdit = useRef(false);
  // Monotonic request id. Without it a slow response for "so" can land after a fast one for "soft"
  // and repopulate the list with results for text that is no longer in the box.
  const seq = useRef(0);
  // Set once the endpoint says 401 — i.e. this bar is the logged-out landing page's. There is
  // nothing to suggest and nothing will change that while the component is mounted, so stop
  // asking rather than spending a request per word for the whole visit.
  const unauthorised = useRef(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const grouped = field === "title";
  const [scope, setScope] = useState(null);     // A148: null = every kind
  const focused = useRef(false);

  useEffect(() => {
    if (selfEdit.current) { selfEdit.current = false; return; }
    const q = (value || "").trim();
    // A148: an empty box with focus still shows the labels (the dropdown opens on them).
    if (q.length < MIN_CHARS) { setItems([]); setOpen(grouped && focused.current); setActive(-1); return; }
    if (unauthorised.current && !grouped) return;

    const mine = ++seq.current;
    const timer = setTimeout(async () => {
      try {
        const [d, g] = await Promise.all([
          // A148: a scope asks only the grouped endpoint, for that one kind.
          unauthorised.current || (grouped && scope) ? { suggestions: [] } : fetchSuggestions(field, q),
          grouped && q.length >= 2 ? fetchGrouped(q, scope).catch(() => null) : null,
        ]);
        if (mine !== seq.current) return;               // a newer keystroke already won
        if (d.unauthorised) unauthorised.current = true;
        // Titles: the signed-in board's own (scoped to the person's role) when there are any, else the open board's.
        const titleList = d.suggestions.length ? d.suggestions : (g?.titles || []).map((x) => x.value);
        const next = [
          ...(g?.companies || []).map((x) => ({ kind: "company", key: `c:${x.slug}`, label: x.name, sub: `${x.openJobs} open`, item: x })),
          ...(g?.people || []).map((x) => ({ kind: "person", key: `p:${x.path}`, label: x.name, sub: x.label || "", item: x })),
          ...(g?.roles || []).map((x) => ({ kind: "role", key: `r:${x.id}`, label: x.name, sub: x.category, item: x })),
          ...(g?.technologies || []).map((x) => ({ kind: "tech", key: `t:${x.name}`, label: x.name, item: x })),
          ...titleList.map((s) => ({ kind: "title", key: `s:${s}`, label: s })),
        ].filter((row) => !(grouped && scope) || row.kind === scope);   // 45s: a scope shows ONLY its kind
        setItems(next);
        if (next.length) setRect(boxRef.current?.getBoundingClientRect() || null);
        // Zero suggestions is a normal state: show NOTHING. Not an error, not an empty box.
        // A148: the title box keeps its labels open while it has focus (a scope with no match says so in one line).
        if (grouped && !next.length && focused.current) setRect(boxRef.current?.getBoundingClientRect() || null);
        setOpen(next.length > 0 || (grouped && focused.current));
        setActive(-1);
      } catch {
        // A convenience that cannot answer is a convenience that stays quiet.
        if (mine === seq.current) { setItems([]); setOpen(grouped && focused.current); setActive(-1); }
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, field, scope]);   // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = useCallback(() => { setOpen(false); setActive(-1); }, []);

  // The bar is position:fixed/sticky and swaps with the collapsed pill on scroll. DockPortal places
  // itself from a rect captured at open time and does not follow anything, so close rather than let
  // the list drift away from the input it belongs to. Same call as UsbSelect.
  useEffect(() => {
    if (!open) return;
    const onScroll = () => dismiss();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, dismiss]);

  const accept = (row) => {
    const text = typeof row === "string" ? row : row.label;
    setItems([]);
    setOpen(false);
    setActive(-1);
    if (row.kind === "company") {
      // Inside the app the page opens in the shell; anywhere else, the public page.
      navigate(`${pathname.startsWith("/app") ? "/app" : ""}/companies/${row.item.slug}`);
      return;
    }
    // A person's page is server-rendered (/in/<handle>, D183 P3): a full load, not a client route.
    if (row.kind === "person") { window.location.assign(row.item.path); return; }
    if (row.kind === "role" && onPickRole) { onPickRole(row.item); return; }
    if (row.kind === "tech" && onPickTech) { onPickTech(row.item); return; }
    selfEdit.current = true;
    onChange(text);
    onAccept?.(text);
  };

  function onKeyDown(e) {
    // A148: Backspace in an empty box drops the scope label before anything else.
    if (e.key === "Backspace" && grouped && scope && !(value || "").length) { e.preventDefault(); setScope(null); return; }
    // TAB. Accepts the highlighted suggestion — and ONLY then. With nothing highlighted this does
    // not run at all, so Tab keeps its normal meaning and moves focus to the next field. A
    // typeahead that swallows Tab unconditionally makes the bar impossible to tab through.
    if (e.key === "Tab") {
      if (open && active >= 0 && items[active]) { e.preventDefault(); accept(items[active]); }
      else dismiss();
      return;
    }
    // ⛔ 45s (owner 11-09: "when i search company using the label … i am only expecting the company page to be suggested that
    // leads to the company page"): with a scope label on, Enter never runs the board's text search — it opens the highlighted
    // row, else the first of that kind; with none yet, it does nothing (the hint says there is no match).
    if (e.key === "Enter" && grouped && scope) {
      e.preventDefault();
      const pick = (active >= 0 && items[active]) || items[0];
      if (pick) accept(pick);
      return;
    }
    if (e.key === "Escape") {
      // Dismiss WITHOUT altering the typed text. The user is rejecting the list, not the word they
      // were in the middle of writing.
      if (open) { e.preventDefault(); e.stopPropagation(); dismiss(); }
      return;
    }
    if (!open || items.length === 0) {
      if (e.key === "ArrowDown" && items.length) { e.preventDefault(); setOpen(true); setActive(0); }
      return;
    }
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); setActive(i => (i + 1) % items.length); break;
      case "ArrowUp":   e.preventDefault(); setActive(i => (i <= 0 ? items.length : i) - 1); break;
      case "Home":      e.preventDefault(); setActive(0); break;
      case "End":       e.preventDefault(); setActive(items.length - 1); break;
      case "Enter":
        // Only intercept Enter when the user has actually picked something. Otherwise it falls
        // through to the input's own onKeyDown, which is what runs the search — pressing Enter to
        // search must not be stolen by a list the user was ignoring.
        if (active >= 0 && items[active]) { e.preventDefault(); accept(items[active]); }
        else dismiss();
        break;
      default: break;
    }
  }

  const showList = open && (items.length > 0 || grouped) && !!rect;
  const typed = (value || "").trim();

  return (
    <div className="usb__suggest" ref={boxRef}>
      {children({
        value,
        onChange: e => onChange(e.target.value),
        onKeyDown,
        // Rows commit on pointerdown with preventDefault, so the input never loses focus to them and
        // this cannot close the list out from under a click.
        onBlur: () => { focused.current = false; dismiss(); },
        onFocus: () => {
          focused.current = true;
          if (!items.length && !grouped) return;   // A148: the title box opens on its labels
          setRect(boxRef.current?.getBoundingClientRect() || null);
          setOpen(true);
        },
        "data-search-scope": grouped && scope ? scope : undefined,
        role: "combobox",
        "aria-expanded": showList,
        "aria-controls": showList ? listId : undefined,
        "aria-autocomplete": "list",
        "aria-activedescendant": showList && active >= 0 ? `${listId}-${active}` : undefined,
        autoComplete: "off",
      })}

      {showList && (
        <DockPortal
          anchorRect={rect}
          theme={PORTAL_THEME}
          onClose={dismiss}
          // Same tier as UsbSelect's listbox, and for the same reason — see the note there. One
          // search surface, one dropdown tier.
          tier={Z.SEARCH_DROPDOWN}
          style={{ minWidth: Math.max(240, Math.round(rect.width)), maxWidth: 360, padding: 6 }}
        >
          {grouped && (
            // A148: the scope labels. pointerdown + preventDefault, like the rows: the box keeps focus.
            <div className="usb__scopes" role="group" aria-label="Search for" data-search-scopes="">
              <span className="usb__scopes-lead">Search for</span>
              {SEARCH_SCOPES.map(([k, word]) => (
                <button key={k} type="button" className="usb__scope dbx-depth" aria-pressed={scope === k} data-scope={k}
                  onPointerDown={(e) => { e.preventDefault(); setScope((s) => (s === k ? null : k)); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setScope((s) => (s === k ? null : k)); } }}>
                  {word}
                </button>
              ))}
            </div>
          )}
          {grouped && !items.length && (
            <p className="usb__scopes-hint" data-search-hint="">
              {typed.length >= 2 ? `No ${scope ? SCOPE_NOUN[scope] : "matches"} for “${typed}”.`
                : scope ? `Type a name to search ${SCOPE_NOUN[scope]} only.` : "Pick one to search only that, or just type."}
            </p>
          )}
          <ul className="usb__suggest-list" id={listId} role="listbox" aria-label={
            field === "location" ? "Location suggestions" : "Job title suggestions"
          }>
            {items.map((s, i) => {
              const row = typeof s === "string" ? { kind: "title", key: s, label: s } : s;
              const head = grouped && (i === 0 || (items[i - 1]?.kind || "title") !== row.kind)
                && items.some((x) => (x?.kind || "title") !== "title");
              return [
                head ? <li key={`h:${row.kind}`} role="presentation" className="usb__suggest-group" data-suggest-group={row.kind}>{GROUP_WORD[row.kind]}</li> : null,
                <li
                  key={row.key}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  data-suggest-kind={row.kind}
                  className={"usb__suggest-item" + (i === active ? " usb__suggest-item--active" : "")}
                  // pointerdown, not click: the input's blur fires first on a click and would unmount
                  // the row out from under it.
                  onPointerDown={e => { e.preventDefault(); accept(row); }}
                  onMouseMove={() => setActive(i)}
                >
                  {row.label}{row.sub ? <span className="usb__suggest-sub"> · {row.sub}</span> : null}
                </li>,
              ];
            })}
          </ul>
        </DockPortal>
      )}
    </div>
  );
}
