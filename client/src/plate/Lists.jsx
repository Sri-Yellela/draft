// ⭐ D196 F3 · lists and lines: the gazetteer (index), the register (ledger-ruled, bulk actions, virtualised past 60 rows —
// R2's 500), the trail rail, the route line and the code plate. Wide things scroll inside their own box, never the page.
import { useEffect, useMemo, useRef, useState } from "react";
import { plateState } from "./PlateState.jsx";
import { LetterTile, StatusTag } from "./Marks.jsx";

/** The gazetteer: an ink mono header row, ruled rows; a row with `href` is a link (Enter / click). cols = [{ key, label, kind }].
 *  ⭐ D196 FIX-7 (47f, the market's Index): four optional additions, none of which changes the markup without them —
 *  `c.render(r)` draws a cell itself (a link, a status tag); `onRow` with `rowClick` makes EVERY row open (not only one
 *  with an href); `rowExtra(r)` is drawn inside the row's last cell as an overlay (the row bubble — FIX-8: it never shifts
 *  the row's layout); `rowProps(r)` adds attributes to a row; `windowAfter` windows the rows past that many (R3: the index stays smooth at thousands), the page's
 *  own scroll moving the window. */
export function Gazetteer({ cols = [], rows = [], label = "Index", onRow, rowClick = false, rowExtra, rowProps, windowAfter = 0, rowPx = 49, ...s }) {
  const [win, setWin] = useState({ first: 0, count: windowAfter || rows.length });
  const bodyRef = useRef(null);
  const windowed = windowAfter > 0 && rows.length > windowAfter;
  useEffect(() => {
    if (!windowed || typeof window === "undefined") return undefined;
    const read = () => {
      const el = bodyRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const first = Math.max(0, Math.floor(-top / rowPx) - 40);
      const count = Math.ceil(window.innerHeight / rowPx) + 80;
      setWin((w) => (w.first === first && w.count === count ? w : { first, count }));
    };
    read();
    window.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", read);
    return () => { window.removeEventListener("scroll", read); window.removeEventListener("resize", read); };
  }, [windowed, rowPx, rows.length]);
  const gate = plateState(s, { height: 320, radius: "card", label: `Loading ${label}`, lines: 5 });
  if (gate) return gate;
  const first = windowed ? Math.min(win.first, Math.max(0, rows.length - 1)) : 0;
  const shown = windowed ? rows.slice(first, first + win.count) : rows;
  const above = windowed ? first * rowPx : 0, below = windowed ? Math.max(0, (rows.length - first - shown.length) * rowPx) : 0;
  const last = cols.length - 1;
  const fixed = cols.some((c) => c.width || c.col);
  return (
    <div className="pl-gazetteer" role="region" aria-label={label} tabIndex={0} data-windowed={windowed ? "" : undefined}>
      <table data-fixed={fixed ? "" : undefined}>
        {/* c.width (a share of the table) or c.col (a class that sets one): fixed columns — they never jump as more rows load
            or the window moves */}
        {fixed ? <colgroup>{cols.map((c) => <col key={c.key} className={c.col || undefined} style={c.width ? { width: c.width } : undefined}/>)}</colgroup> : null}
        <thead><tr>{cols.map((c) => <th key={c.key} scope="col">{c.label}</th>)}</tr></thead>
        <tbody ref={bodyRef}>
          {above ? <tr aria-hidden="true" className="pl-gz__spacer"><td colSpan={cols.length} style={{ height: above, padding: 0 }}/></tr> : null}
          {shown.map((r, i) => {
            const opens = rowClick ? !!onRow : !!r.href;
            return (
              <tr key={r.id ?? first + i} data-href={r.href || undefined} data-row-opens={rowClick && onRow ? "" : undefined} {...rowProps?.(r)}
                onClick={opens ? (e) => { if (e.target.closest("a, button")) return; onRow?.(r); } : undefined}>
                {cols.map((c, j) => (
                  <td key={c.key} data-kind={c.kind} className={j === last && rowExtra ? "pl-gz__last" : undefined}>
                    {c.render ? c.render(r)
                      : c.kind === "status" ? <StatusTag>{r[c.key]}</StatusTag>
                      : c.kind === "title" && r.href ? <a href={r.href} style={{ color: "var(--pl-ink)", fontWeight: 700 }}>{r[c.key]}</a>
                        : c.kind === "title" ? <b>{r[c.key]}</b> : r[c.key] ?? "—"}
                    {j === last && rowExtra ? rowExtra(r) : null}
                  </td>
                ))}
              </tr>
            );
          })}
          {below ? <tr aria-hidden="true" className="pl-gz__spacer"><td colSpan={cols.length} style={{ height: below, padding: 0 }}/></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

const ROW_PX = 64;
const WINDOW = 60;
/**
 * The register: every application as it stands. `rows` = [{ id, company, role, logo, region, steps: ["d"|"u"|"y"|"-"], where,
 * status, action: { label, onClick } }]; bulk: Re-run selected · free / Cancel selected. Steps are only what the worker
 * reported (■ done · □ underway · ▧ needs you · ⬚ not yet). Past 60 rows the list windows itself (500 rows stay smooth).
 */
// ⭐ 47h (D197 #3, Home): four optional additions, none of which changes the markup without them — `openId` + `renderOpen(row)`
// draw the row's detail IN PLACE under it (Home's opened row, D146); `barExtra` sits in the ink bar before the bulk buttons
// (the sort); `message` is a line under the bar (what a bulk action did); `a.attrs` lands on the row.
export function Register({ rows = [], onBulk, label = "Applications", openId = null, renderOpen, barExtra = null, message = null, ...s }) {
  const [sel, setSel] = useState(() => new Set());
  const [top, setTop] = useState(0);
  const gate = plateState(s, { height: 360, radius: "card", label: "Loading your applications", lines: 5 });
  const windowed = rows.length > WINDOW;
  const first = windowed ? Math.max(0, Math.floor(top / ROW_PX) - 10) : 0;
  const shown = useMemo(() => (windowed ? rows.slice(first, first + WINDOW) : rows), [rows, windowed, first]);
  if (gate) return gate;
  const all = rows.length > 0 && sel.size === rows.length;
  const toggle = (id) => setSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const stepS = { d: "lit", u: "underway", y: "needs", "-": "ahead" };
  return (
    <div className="pl-register" role="region" aria-label={label}>
      <div className="pl-register__bar">
        <label className="pl-register__selectall pl-label" style={{ color: "var(--pl-on-ink)" }}>
          <input type="checkbox" className="pl-check" style={{ accentColor: "var(--pl-clay)" }} checked={all}
            onChange={() => setSel(all ? new Set() : new Set(rows.map((r) => r.id)))}/>SELECT ALL
        </label>
        <span className="pl-grow"/>
        {barExtra}
        <button type="button" className="pl-register__barbtn" disabled={!sel.size} onClick={() => onBulk?.("rerun", [...sel])}>Re-run selected · free</button>
        <button type="button" className="pl-register__barbtn" data-dashed="" disabled={!sel.size} onClick={() => onBulk?.("cancel", [...sel])}>Cancel selected</button>
        {message ? <span className="pl-register__msg" role="status">{message}</span> : null}
      </div>
      <div className="pl-register__rows" style={windowed ? { "--pl-register-max": `${ROW_PX * 10}px` } : undefined}
        onScroll={windowed ? (e) => setTop(e.currentTarget.scrollTop) : undefined}>
        {windowed ? <div style={{ height: first * ROW_PX }} aria-hidden="true"/> : null}
        {shown.map((a) => {
          const done = (a.steps || []).filter((x) => x === "d").length;
          return (
            <div key={a.id} style={{ display: "contents" }}>
            <div className="pl-register__row" {...a.attrs}>   {/* the sector colour is the tile's only — tags wear the page's region, as on the board */}
              <input type="checkbox" className="pl-check" aria-label={`Select ${a.company}`} checked={sel.has(a.id)} onChange={() => toggle(a.id)}/>
              <LetterTile name={a.company} logo={a.logo} region={a.region} size="sm"/>
              <div className="pl-register__who"><b className="pl-register__company">{a.company}</b><span className="pl-register__role">{a.role}</span></div>
              <span className="pl-squares pl-squares--gap4" role="img" aria-label={`${done} of ${(a.steps || []).length} steps done`}>
                {(a.steps || []).map((x, i) => <span key={i} className="pl-sq pl-sq--14" data-s={stepS[x]}/>)}
              </span>
              <span className="pl-register__where">{a.where}</span>
              <StatusTag>{a.status}</StatusTag>
              {a.action ? <button type="button" className="pl-btn pl-register__act" onClick={a.action.onClick} aria-expanded={renderOpen ? openId === a.id : undefined} {...a.action.attrs}>{a.action.label}</button> : null}
            </div>
            {renderOpen && openId === a.id ? <div className="pl-register__open">{renderOpen(a)}</div> : null}
            </div>
          );
        })}
        {windowed ? <div style={{ height: Math.max(0, rows.length - first - shown.length) * ROW_PX }} aria-hidden="true"/> : null}
      </div>
    </div>
  );
}

/** The register's key line, under it. */
export function RegisterKey() {
  return <p className="pl-register__key">■ DONE (WORKER REPORTED) · □ UNDERWAY · ▧ NEEDS YOU · ⬚ NOT YET</p>;
}

/** The trail rail: legs on a dashed trail, numbered markers, the summit a square; done legs green with ✓ (aria-current on the one you're on). */
export function TrailRail({ legs = [], label = "The walk", ...s }) {
  const gate = plateState(s, { height: 280, radius: "plate", label: "Loading the walk", lines: 5 });
  if (gate) return gate;
  return (
    <ol className="pl-rail" aria-label={label}>
      {legs.map((l, i) => (
        <li key={i} className="pl-rail__leg" data-s={l.state} data-summit={i === legs.length - 1 ? "" : undefined} aria-current={l.state === "current" ? "step" : undefined}>
          <span className="pl-rail__mark" aria-hidden="true">{l.state === "done" ? "✓" : String(i + 1).padStart(2, "0")}</span>
          {l.href ? <a className="pl-rail__name" href={l.href}>{l.name}</a> : <span className="pl-rail__name">{l.name}</span>}
          {l.state === "done" ? <span className="pl-sr"> (done)</span> : l.state === "ahead" ? <span className="pl-sr"> (ahead)</span> : null}
        </li>
      ))}
    </ol>
  );
}

/** The route line: stops in stage colours on an ink casing (lit ✓ in ink, next in clay, ahead dashed), ⇄ interchange chips. */
export function RouteLine({ stops = [], label = "The route", ...s }) {
  const gate = plateState(s, { height: 120, radius: "plate", label: "Loading the route", lines: 2 });
  if (gate) return gate;
  return (
    <div className="pl-route" role="region" aria-label={label} tabIndex={0}>
      <ol className="pl-route__line" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {stops.map((p, i) => (
          <li key={i} className="pl-route__stop" data-s={p.state} style={p.stage ? { "--pl-stage": `var(--pl-stage-${p.stage})` } : undefined}
            aria-current={p.state === "next" ? "step" : undefined}>
            <span className="pl-route__dot" aria-hidden="true">{p.state === "lit" ? "✓" : ""}</span>
            <span className="pl-route__name">{p.name}</span>
            {p.interchange ? <a className="pl-interchange" href={p.interchange.href} data-region={p.interchange.region}>⇄ {p.interchange.label}</a> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** The code plate: a deep navy plate, line numbers, the file name; pins beside the code open and highlight their lines. */
export function CodePlate({ file, lang, code = "", pins = [], onAllOpened, ...s }) {
  const [open, setOpen] = useState(() => new Set());
  const gate = plateState(s, { height: 260, radius: "plate", label: "Loading the code", lines: 5 });
  if (gate) return gate;
  const lines = code.replace(/\r\n/g, "\n").split("\n");
  const hi = new Set(pins.filter((p, i) => open.has(i)).flatMap((p) => p.lines || []));
  const toggle = (i) => setOpen((prev) => {
    const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i);
    if (n.size === pins.length && pins.length) onAllOpened?.();
    return n;
  });
  return (
    <div className="pl-code">
      <div className="pl-code__plate" role="region" aria-label={file || "Code"} tabIndex={0}>
        <div className="pl-code__file"><span>{file}</span>{lang ? <span>{lang}</span> : null}</div>
        <pre className="pl-code__pre"><code>{lines.map((l, i) => (
          <div key={i} className="pl-code__line" data-hi={hi.has(i + 1) ? "" : undefined}><span className="pl-code__ln" aria-hidden="true">{i + 1}</span>{l}</div>
        ))}</code></pre>
      </div>
      {pins.length ? (
        <div className="pl-code__pins">
          {pins.map((p, i) => (
            <button key={i} type="button" className="pl-pin" aria-expanded={open.has(i)} onClick={() => toggle(i)}>
              <span className="pl-label">{String(i + 1).padStart(2, "0")}</span><span>{open.has(i) ? p.text : p.title}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
