// ⭐ A228 (46r) · the skill map's small shared bits — the chart frame (hover AND focus tooltips, one per page), the
// "Show as a table" view every chart has, the state legend (never colour alone: each state is named, and each mark's
// tooltip says it in words), the hatch, a skill's mark and the width hook.
// ⭐ D200 (a) (47h) · YOUR SURVEY: the same bits in the plate system (docs/sketches/final/project/YourSurvey.dc.html) — a
// chart is a plate figure (ink border, 6 px hard shadow, the warm paper inside) with a mono caption strip and its
// "▸ Show as a table" in the strip; the states are the survey's (proven = owned, green · on your résumé = claimed, a solid
// outline · not yet = unclaimed, hatched and dashed); a skill's mark is a 30 px tile. Tokens only (SkillMap.css); no
// capsules (D60).
import { useEffect, useRef, useState } from "react";
import { monogram } from "./skillMapModel.js";
import { ts } from "../../themes/shapes.js";   // A116: inline sizes follow Settings → Text size

/** The box's width, kept current. */
export function useWidth(fallback = 720) {
  const ref = useRef(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const read = () => { const x = Math.round(el.clientWidth); if (x > 0) setW(prev => (Math.abs(prev - x) > 2 ? x : prev)); };
    read();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** A chart: its marks carry data-tip ("Title\nline\nline"); pointer and keyboard focus show it in one tooltip. */
export function ChartFrame({ children, label, frameRef = null, className = "" }) {
  const [tip, setTip] = useState(null);
  const show = (el, x, y) => {
    const t = el?.getAttribute?.("data-tip");
    if (!t) { setTip(null); return; }
    const [head, ...rest] = t.split("\n");
    setTip({ head, rest, x, y });
  };
  return (
    <div className={`ys-chart ${className}`.trim()} ref={frameRef} data-skm-chart={label}
      onPointerMove={(e) => { const m = e.target.closest?.("[data-tip]"); if (m) show(m, e.clientX, e.clientY); else setTip(null); }}
      onPointerLeave={() => setTip(null)}
      onFocus={(e) => { const m = e.target.closest?.("[data-tip]"); if (m) { const r = m.getBoundingClientRect(); show(m, r.right, r.top); } }}
      onBlur={() => setTip(null)}>
      {children}
      {tip && (
        <div className="ys-tip" role="tooltip" style={{
          left: Math.max(8, Math.min((typeof window !== "undefined" ? window.innerWidth : 1200) - 296, tip.x + 14)),
          top: Math.max(8, tip.y + 14) }}>
          <b>{tip.head}</b>
          {tip.rest.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  );
}

/** The chart's numbers as a table — for a screen reader and for anyone who wants them. */
export function ChartTable({ head = [], rows = [] }) {
  return (
    <div className="ys-table" data-skm-table-body="">
      <table>
        <thead><tr>{head.map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

/**
 * A plate figure: the drawing (its marks' words on hover / focus), the caption strip (a mono line, "▸ Show as a table"),
 * the table when asked, and an optional foot (the survey's selected plot).
 */
export function PlateFigure({ label, caption, table = null, children, foot = null, frameRef = null }) {
  const [open, setOpen] = useState(false);
  return (
    <figure className="ys-fig" data-skm-figure={label}>
      <ChartFrame label={label} frameRef={frameRef}>
        <div className="ys-fig__draw">{children}</div>
      </ChartFrame>
      <figcaption className="ys-fig__cap">
        <span className="ys-label">{caption}</span>
        {table && (
          <button type="button" className="ys-fig__toggle" aria-expanded={open} data-skm-table="" onClick={() => setOpen(o => !o)}>
            {open ? "▾ Hide the table" : "▸ Show as a table"}
          </button>
        )}
      </figcaption>
      {table && open && <ChartTable head={table.head} rows={table.rows} />}
      {foot}
    </figure>
  );
}

/** The three states, named (proven = owned · on your résumé = claimed · not yet = unclaimed). */
export function StateLegend({ extra = null }) {
  return (
    <div className="ys-legend" data-skm-legend="">
      <span><i className="ys-sw ys-sw--proven" aria-hidden="true" />Proven (owned)</span>
      <span><i className="ys-sw ys-sw--claimed" aria-hidden="true" />On your résumé (claimed)</span>
      <span><i className="ys-sw ys-sw--missing" aria-hidden="true" />Not yet (unclaimed)</span>
      {extra && <span className="ys-muted">{extra}</span>}
    </div>
  );
}

/** The SVG hatch "not yet" is drawn with — one per chart (its id from the chart). */
export function HatchDefs({ id }) {
  return (
    <defs>
      <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="6" className="ys-hatch" />
      </pattern>
    </defs>
  );
}

/** A skill's tile (30 px): its Wikipedia picture when Atlas has one, else its letters; solid when you have it (proven or on
 *  your résumé), dashed on paper when you don't yet. The tile names the skill (title + the page's words around it). */
export function SkillMark({ name, thumb = null, size = 30, have = false }) {
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size };
  const cls = `ys-tile${have ? "" : " ys-tile--not"}`;
  if (thumb && !failed) {
    return <span className={`${cls} ys-tile--img`} style={box} title={name} aria-hidden="true"><img src={thumb} alt="" loading="lazy" onError={() => setFailed(true)} /></span>;
  }
  return <span className={cls} style={{ ...box, fontSize: ts(9.5) }} title={name} aria-hidden="true">{monogram(name)}</span>;
}
