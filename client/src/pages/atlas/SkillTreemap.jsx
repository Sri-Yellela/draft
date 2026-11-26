// ⭐ A228 (46r) · "What <role> jobs want" — the role's most-asked skills as ONE picture, two views of the same data (one
// on screen at a time): MAP and LIST (the same skills as ranked bars).
// ⭐ D200 (a) (47h) · THE THIRD MAP — the cadastral (plot) survey (docs/sketches/final/project/YourSurvey.dc.html, 02):
// each skill a plot sized by the share of the role's jobs that want it, grouped into districts by area (INFRA ·
// DISTRICT A …), squarified so plots stay near-square (never strips; skillMapModel.js plotLayout), numbered as lots,
// labels only where they fit (plotWords). Owned = proven (green) · claimed = on your résumé (a solid outline) · unclaimed
// = not yet (hatched, dashed). Only Your survey uses plots (the market uses borders, Atlas uses height). Hover / focus a
// plot and the strip under the plate says it; tap it and you're at its place in Atlas (the interchange to Atlas).
import { useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HatchDefs, PlateFigure } from "./SkillMapBits.jsx";
import { fit, fmt, jobsWord, lotWord, monogram, pct, plotLayout, plotPath, plotWords, STATE_WORD } from "./skillMapModel.js";

const tipFor = (a, roleName) => `${a.name}\n${pct(a.share)} of ${roleName} jobs want it · ${jobsWord(a.jobs)}\nYou: ${STATE_WORD[a.state]}`;
/** A skill's place in Atlas (its Gazetteer entry): the node page under this Atlas's base. */
export const placeHref = (base, a) => `${base}/${encodeURIComponent(a.slug)}`;
const stateWord = (s) => (s === "proven" ? "proven" : s === "claimed" ? "on your résumé" : "not yet");

function Plot({ p, hatch, onPick, onOpen }) {
  const w = plotWords(p);
  const d = plotPath(p, p.lot);
  const x = p.x + 8, y = p.y;
  const on = p.state === "proven";
  return (
    <g data-skm-tile={p.slug} data-state={p.state} data-lot={p.lot}>
      <path d={d} tabIndex={0} role="link" aria-label={`${p.name}, ${lotWord(p.lot).toLowerCase()}: in ${pct(p.share)} of these jobs, ${stateWord(p.state)}. Open its place in Atlas`}
        className={`ys-plot ys-plot--${p.state}`} data-tip={p.tip}
        onMouseEnter={() => onPick(p)} onFocus={() => onPick(p)} onClick={() => onOpen(p)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(p); } }} />
      {p.state === "missing" && <path d={d} fill={`url(#${hatch})`} className="ys-nohit" />}
      {w.lot && <text x={x} y={y + 18} className={`ys-nohit ys-plot__lot${on ? " ys-plot__t--on" : ""}`}>{lotWord(p.lot)}{w.mono ? ` · ${monogram(p.name)}` : ""}</text>}
      {w.name && <text x={x} y={y + 38} className={`ys-nohit ys-plot__name${on ? " ys-plot__t--on" : ""}`} style={{ fontSize: `calc(${w.size}px * var(--pl-scale, 1))` }}>{p.name}</text>}
      {w.share && <text x={x} y={y + (w.shareRow === 2 ? 56 : 38)} className={`ys-nohit ys-plot__share${on ? " ys-plot__t--on" : ""}`}>{w.share}</text>}
    </g>
  );
}

function MapView({ asks, roleName, hatch, base, picked, setPicked }) {
  const navigate = useNavigate();
  const L = plotLayout(asks);
  const open = (p) => navigate(placeHref(base, p));
  return (
    <svg viewBox={`0 0 ${L.W} ${L.H}`} width="100%" role="img" data-skm-treemap="map" data-skm-plots=""
      aria-label={`What ${roleName} jobs want, surveyed as plots: each skill a plot sized by the share of jobs that want it, grouped into districts`}>
      <HatchDefs id={hatch} />
      <rect width={L.W} height={L.H} className="ys-ground" />
      {L.districts.map(dd => (
        <g key={dd.name} data-skm-family={dd.name} data-skm-district={dd.label}>
          <rect x={dd.x} y={dd.y} width={dd.w} height={dd.h} rx="10" className="ys-district" />
          <text x={dd.x + 6} y={dd.y - 6} className="ys-district__t">{fit(dd.label, dd.w - 8, 7.3)}</text>
          {dd.plots.map(p => <Plot key={p.id ?? p.slug} p={{ ...p, tip: tipFor(p, roleName) }} hatch={hatch} onPick={setPicked} onOpen={open} />)}
        </g>
      ))}
      {picked && <PickedOutline layout={L} slug={picked.slug} />}
    </svg>
  );
}

/** The picked plot drawn once more on top, in a heavier line (where you are on the survey). */
function PickedOutline({ layout, slug }) {
  const p = layout.districts.flatMap(d => d.plots).find(q => q.slug === slug);
  return p ? <path d={plotPath(p, p.lot)} className="ys-plot__picked ys-nohit" /> : null;
}

function ListView({ asks, roleName, hatch }) {
  const W = 1000, row = 30, pl = 220, pr = 60, H = asks.length * row + 30;
  const x = (v) => pl + v * (W - pl - pr);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="What the job wants, most-wanted first" data-skm-treemap="list">
      <HatchDefs id={hatch} />
      <rect width={W} height={H} className="ys-ground" />
      {[0, 0.5, 1].map(t => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={6} y2={H - 22} className="ys-gridv" />
          <text x={x(t)} y={H - 8} textAnchor="middle" className="ys-t-mono ys-t-muted">{pct(t)} OF JOBS</text>
        </g>
      ))}
      {asks.map((a, i) => {
        const y = i * row + 6;
        return (
          <g key={a.id ?? a.slug} data-skm-bar={a.slug} data-state={a.state}>
            <text x={16} y={y + 19} className="ys-t-mono ys-t-muted">{lotWord(i + 1).replace("LOT ", "")}</text>
            <text x={44} y={y + 19} className="ys-t-row">{fit(a.name, pl - 56, 7)}</text>
            <rect x={x(0)} y={y + 6} width={Math.max(2, x(a.share) - x(0))} height={row - 12} tabIndex={0} className={`ys-plot ys-plot--${a.state}`} data-tip={tipFor(a, roleName)} />
            {a.state === "missing" && <rect x={x(0)} y={y + 6} width={Math.max(2, x(a.share) - x(0))} height={row - 12} fill={`url(#${hatch})`} className="ys-nohit" />}
            <text x={x(a.share) + 8} y={y + 19} className="ys-t-mono">{pct(a.share)}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** The strip under the plate: the plot you're on, in words, and its way into Atlas. */
function PickedStrip({ a, base }) {
  const navigate = useNavigate();
  if (!a) return null;
  return (
    <div className="ys-picked" data-skm-picked={a.slug}>
      <b>{a.name}</b>
      <span className="ys-picked__line">{a.lot ? `${lotWord(a.lot)} · ` : ""}in {Math.round(a.share * 100)} % of these jobs · {stateWord(a.state)}</span>
      <span className="ys-grow" />
      <a className="ys-btn ys-btn--sm ys-btn--region" href={placeHref(base, a)} data-skm-to-atlas={a.slug}
        onClick={(e) => { if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); navigate(placeHref(base, a)); } }}>⇄ Its place in Atlas</a>
    </div>
  );
}

export default function SkillTreemap({ asks = [], view = "map", roleName = "", base = "/app/atlas", firstPick = null }) {
  const hatch = `ys-hatch-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const sorted = [...asks].sort((a, b) => b.share - a.share);
  const lots = new Map(plotLayout(sorted).districts.flatMap(d => d.plots).map(p => [p.slug, p.lot]));
  const start = sorted.find(a => a.slug === firstPick) || sorted.find(a => a.state === "missing") || sorted[0] || null;
  const [picked, setPicked] = useState(null);
  const shown = picked || start;
  const withLot = shown ? { ...shown, lot: lots.get(shown.slug) } : null;
  return (
    <PlateFigure label={`asks-${view}`} caption="A plat of the role · districts = skill areas"
      table={{ head: ["Lot", "Skill", "Area", "Jobs that want it", "You"], rows: sorted.map(a => [lotWord(lots.get(a.slug) || 0), a.name, a.familyName || "Other", `${pct(a.share)} · ${fmt(a.jobs)}`, STATE_WORD[a.state]]) }}
      foot={<PickedStrip a={withLot} base={base} />}>
      {sorted.length === 0
        ? <p className="ys-quiet">No open {roleName} job asks for a skill we can read yet.</p>
        : view === "list" ? <ListView asks={sorted} roleName={roleName} hatch={hatch} />
          : <MapView asks={sorted} roleName={roleName} hatch={hatch} base={base} picked={picked} setPicked={setPicked} />}
    </PlateFigure>
  );
}
