// ⭐ A228 (46r) · the skill map's small shared bits — the chart frame (hover AND focus tooltips, one per page), the
// "Show as a table" view every chart has, the state legend (never colour alone: each state is named, and each mark's
// tooltip says it in words), the hatch for "on your résumé", a skill's mark (its Wikipedia picture, else a letter
// mark) and the width hook the charts redraw on. Theme tokens only (SkillMap.css); no capsules (D60).
import { useEffect, useRef, useState } from "react";
import { monogram, STATE_WORD } from "./skillMapModel.js";
import { ts } from "../../themes/shapes.js";   // A116: inline sizes follow Settings → Text size

/** The box's width, kept current (the charts grow into the width — FULL WIDTH, docs/BRAND.md). */
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
    <div className={`skm-chart ${className}`} ref={frameRef} data-skm-chart={label}
      onPointerMove={(e) => { const m = e.target.closest?.("[data-tip]"); if (m) show(m, e.clientX, e.clientY); else setTip(null); }}
      onPointerLeave={() => setTip(null)}
      onFocus={(e) => { const m = e.target.closest?.("[data-tip]"); if (m) { const r = m.getBoundingClientRect(); show(m, r.right, r.top); } }}
      onBlur={() => setTip(null)}>
      {children}
      {tip && (
        <div className="skm-tip" role="tooltip" style={{
          left: Math.max(8, Math.min((typeof window !== "undefined" ? window.innerWidth : 1200) - 296, tip.x + 14)),
          top: Math.max(8, tip.y + 14) }}>
          <b>{tip.head}</b>
          {tip.rest.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  );
}

/** "Show as a table" — the chart's numbers, for a screen reader and for anyone who wants them. */
export function ChartTable({ head = [], rows = [], label = "Show as a table" }) {
  return (
    <details className="skm-table" data-skm-table="">
      <summary>{label}</summary>
      <div className="skm-table__wrap">
        <table>
          <thead><tr>{head.map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </details>
  );
}

/** The three states, named (proven = solid accent · on your résumé = hatched accent · not yet = a dashed outline). */
export function StateLegend({ extra = null }) {
  return (
    <div className="skm-legend" data-skm-legend="">
      <span><i className="skm-sw skm-sw--proven" aria-hidden="true" />{STATE_WORD.proven}</span>
      <span><i className="skm-sw skm-sw--claimed" aria-hidden="true" />{STATE_WORD.claimed}</span>
      <span><i className="skm-sw skm-sw--missing" aria-hidden="true" />{STATE_WORD.missing}</span>
      {extra && <span className="skm-faint">{extra}</span>}
    </div>
  );
}

/** The SVG hatch "on your résumé" fills with — one per chart (its id from the chart). */
export function HatchDefs({ id }) {
  return (
    <defs>
      <pattern id={id} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="5" height="5" className="skm-hatch__ground" />
        <rect width="2" height="5" className="skm-hatch__line" />
      </pattern>
    </defs>
  );
}

/** A skill's mark in HTML: its Wikipedia picture when Atlas has one, else a letter mark. */
export function SkillMark({ name, thumb = null, size = 26 }) {
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size };
  if (thumb && !failed) {
    return <span className="skm-mark skm-mark--img" style={box} aria-hidden="true"><img src={thumb} alt="" loading="lazy" onError={() => setFailed(true)} /></span>;
  }
  return <span className="skm-mark" style={{ ...box, fontSize: ts(Math.round(size * 0.38)) }} aria-hidden="true">{monogram(name)}</span>;
}
