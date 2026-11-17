// ⭐ A228 (46r) · "How close you are to each job" — every open job of the role, by how much of what it asks you have
// (10 bins). Bins at or past the line are jobs you can apply for (the accent); the rest are not yet within reach (the
// chart neutral, --c-chart-neutral). Hover / focus a bar for its words; "Show as a table" for the numbers.
import { ChartFrame, ChartTable, useWidth } from "./SkillMapBits.jsx";
import { fmt, histogramBars, jobsWord } from "./skillMapModel.js";

export default function JobsHistogram({ bins = [], threshold = 0.6, roleName = "" }) {
  const [ref, W] = useWidth(700);
  const g = histogramBars(bins, threshold, W);
  const narrow = W < 520;
  return (
    <>
      <ChartFrame label="histogram" frameRef={ref}>
        <svg viewBox={`0 0 ${W} ${g.H}`} role="img" aria-label={`${roleName} jobs by how much of each you have`} data-skm-histogram="">
          {g.ticks.map(t => (
            <g key={t}>
              <line x1={g.pl} x2={W} y1={g.y(t)} y2={g.y(t)} className="skm-grid" />
              <text x={g.pl - 6} y={g.y(t) + 4} textAnchor="end" className="skm-t">{fmt(t)}</text>
            </g>
          ))}
          {g.bars.map(b => (
            <g key={b.i}>
              <rect x={b.x} y={b.y} width={b.w} height={Math.max(0, b.h)} rx={Math.min(4, b.h / 2)} tabIndex={0}
                className={b.ok ? "skm-f-proven" : "skm-f-neutral"} data-bin={b.i} data-reach={b.ok ? "yes" : "no"}
                data-tip={`${jobsWord(b.jobs)}\nYou have ${b.i * 10}–${b.i * 10 + 10}% of what they want${b.ok ? "\nYou can apply" : ""}`} />
              {(!narrow || b.i % 2 === 0) && <text x={b.x + b.w / 2} y={g.H - g.pb + 16} textAnchor="middle" className="skm-t">{b.i * 10}%</text>}
            </g>
          ))}
          <line x1={g.xReach} x2={g.xReach} y1={4} y2={g.H - g.pb} className="skm-reach" />
          <text x={g.xReach - 8} y={g.H - 6} textAnchor="end" className="skm-t">← not yet</text>
          <text x={g.xReach + 8} y={g.H - 6} className="skm-t skm-t--ink">you can apply →</text>
        </svg>
      </ChartFrame>
      <ChartTable head={["You have", "Jobs"]} rows={bins.map((b, i) => [`${i * 10}–${i * 10 + 10}% of it`, fmt(b.jobs)])} />
    </>
  );
}
