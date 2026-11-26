// ⭐ A228 (46r) · "How close you are to each job" — every open job of the role, by how much of what it asks you have
// (10 bins). Bins at or past the line are jobs you can apply for; the rest are not yet within reach. Hover / focus a bar
// for its words; "Show as a table" for the numbers.
// ⭐ D200 (a) (47h) · Your survey's 01: the board's plate (viewBox 960 × 280) — region IV's blue for not yet, clay for the
// jobs you can apply for, each bar's count over it in the serif, the dashed reach line, ← NOT YET · YOU CAN APPLY →.
import { PlateFigure } from "./SkillMapBits.jsx";
import { fmt, jobsWord, plateHistogram } from "./skillMapModel.js";

export default function JobsHistogram({ bins = [], threshold = 0.6, roleName = "", open = null, applicable = null }) {
  const g = plateHistogram(bins, threshold);
  const caption = open != null ? `${fmt(open)} open · ${fmt(applicable ?? 0)} you can apply for` : "Jobs by how much of each you have";
  return (
    <PlateFigure label="histogram" caption={caption}
      table={{ head: ["You have", "Jobs"], rows: bins.map((b, i) => [`${i * 10}–${i * 10 + 10}% of it`, fmt(b.jobs)]) }}>
      <svg viewBox={`0 0 ${g.W} ${g.H}`} width="100%" role="img" aria-label={`Every open ${roleName} job by how much of it you have`} data-skm-histogram="">
        <rect width={g.W} height={g.H} className="ys-ground" />
        <g className="ys-rules">{g.rules.map(y => <line key={y} x1="50" y1={y} x2="940" y2={y} />)}</g>
        <line x1="50" y1={g.floor} x2="940" y2={g.floor} className="ys-floor" />
        {g.bars.map(b => (
          <g key={b.i}>
            <rect x={b.x} y={b.y} width={b.w} height={Math.max(0, b.h)} tabIndex={0}
              className={b.ok ? "ys-bar ys-bar--ok" : "ys-bar"} data-bin={b.i} data-reach={b.ok ? "yes" : "no"}
              data-tip={`${jobsWord(b.jobs)}\nYou have ${b.i * 10}–${b.i * 10 + 10}% of what they want${b.ok ? "\nYou can apply" : ""}`} />
            <text x={b.x + b.w / 2} y={b.y - 8} textAnchor="middle" className="ys-t-serif">{fmt(b.jobs)}</text>
            <text x={b.x + b.w / 2} y="252" textAnchor="middle" className="ys-t-mono">{b.i * 10}%</text>
          </g>
        ))}
        <line x1={g.xReach} y1="24" x2={g.xReach} y2="236" className="ys-reach" />
        <text x={g.xReach - 10} y="272" textAnchor="end" className="ys-t-mono ys-t-muted">← NOT YET</text>
        <text x={g.xReach + 10} y="272" className="ys-t-mono ys-t-clay">YOU CAN APPLY →</text>
      </svg>
    </PlateFigure>
  );
}
