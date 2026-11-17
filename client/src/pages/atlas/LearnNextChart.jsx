// ⭐ A228 (46r) · "Learn next" — the step chart: the jobs you can apply for today, then after each step of the route
// (x = the hours spent so far, y = the jobs you could apply for). Each point says its step in words on hover / focus.
import { ChartFrame, ChartTable, useWidth } from "./SkillMapBits.jsx";
import { fmt, routePoints, stepVerb } from "./skillMapModel.js";

export default function LearnNextChart({ applicable = 0, steps = [] }) {
  const [ref, W] = useWidth(380);
  const pts = routePoints(applicable, steps);
  const hours = pts[pts.length - 1].hours;
  const H = 190, pl = 48, pr = 16, pb = 26;
  const mx = Math.max(...pts.map(p => p.total));
  const unit = mx > 2000 ? 1000 : mx > 800 ? 400 : mx > 200 ? 200 : mx > 40 ? 20 : 5;
  const maxY = Math.max(unit, Math.ceil(mx / unit) * unit), maxX = Math.max(10, hours);
  const x = (v) => pl + (v / maxX) * (W - pl - pr), y = (v) => H - pb - (v / maxY) * (H - pb - 12);
  let d = `M${x(0)},${y(pts[0].total)}`;
  for (let i = 1; i < pts.length; i++) d += ` H${x(pts[i].hours)} V${y(pts[i].total)}`;
  return (
    <>
      <ChartFrame label="route" frameRef={ref}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Jobs you can apply for as you learn each skill" data-skm-route="">
          {[0, 1, 2, 3, 4].map(i => (maxY * i) / 4).map(t => (
            <g key={t}>
              <line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} className="skm-grid" />
              <text x={pl - 6} y={y(t) + 4} textAnchor="end" className="skm-t">{fmt(t)}</text>
            </g>
          ))}
          <text x={pl} y={H - 6} className="skm-t">now</text>
          <text x={W - pr} y={H - 6} textAnchor="end" className="skm-t">{fmt(hours)} h</text>
          <path d={`${d} V${H - pb} H${x(0)} Z`} className="skm-route__area" />
          <path d={d} className="skm-route__line" />
          {pts.map((p, i) => (
            <circle key={i} cx={x(p.hours)} cy={y(p.total)} r={5} className="skm-route__dot" tabIndex={0} data-skm-point={i}
              data-tip={p.today ? `Today\n${fmt(p.total)} jobs you can apply for` : `${stepVerb(p)}\n+${fmt(p.gain)} jobs · then ${fmt(p.total)}`} />
          ))}
        </svg>
      </ChartFrame>
      <ChartTable head={["Step", "About", "Jobs you could apply for"]}
        rows={pts.map(p => [p.today ? "Today" : stepVerb(p), p.today ? "—" : `${fmt(p.hours)} h in all`, fmt(p.total)])} />
    </>
  );
}
