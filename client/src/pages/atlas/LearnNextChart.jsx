// ⭐ A228 (46r) · "Learn next" — the step chart: the jobs you can apply for today, then after each step of the route
// (x = the hours spent so far, y = the jobs you could apply for). Each point says its step in words on hover / focus.
// ⭐ D200 (a) (47h) · Your survey's 03, "The climb to every job": the board's plate (viewBox 960 × 270) — the climb
// filled in region IV's lightest step, today a proven-green point, the next step clay with NEXT: <skill>, the rest open.
// The two ends say the share of the role's open jobs you could apply for (now · after the whole route).
import { PlateFigure } from "./SkillMapBits.jsx";
import { fmt, plateClimb, stepVerb } from "./skillMapModel.js";

export default function LearnNextChart({ applicable = 0, steps = [], open = 0, roleName = "" }) {
  const g = plateClimb(applicable, steps);
  const end = g.pts[g.pts.length - 1];
  const share = (n) => (open > 0 ? `${Math.round((n / open) * 100)} %` : "—");
  const next = g.pts[1];
  return (
    <PlateFigure label="route" caption={`Share of the ${fmt(open)} jobs you could apply for`}
      table={{ head: ["Step", "About", "Jobs you could apply for"], rows: g.pts.map(p => [p.today ? "Today" : stepVerb(p), p.today ? "—" : `${fmt(p.hours)} h in all`, fmt(p.total)]) }}>
      <svg viewBox={`0 0 ${g.W} ${g.H}`} width="100%" role="img" data-skm-route=""
        aria-label={`Learn next: the ${roleName} jobs you could apply for climb from ${fmt(applicable)} now to ${fmt(end.total)} after about ${fmt(end.hours)} hours`}>
        <rect width={g.W} height={g.H} className="ys-ground" />
        <g className="ys-rules">{g.rules.map(y => <line key={y} x1="60" y1={y} x2="900" y2={y} />)}</g>
        {g.pts.length > 1 && <path d={g.area} className="ys-climb__area" />}
        {g.pts.length > 1 && <path d={g.line} pathLength="1" className="ys-climb__line" />}
        {g.pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="8" tabIndex={0} data-skm-point={i}
            className={i === 0 ? "ys-pt ys-pt--now" : i === 1 ? "ys-pt ys-pt--next" : "ys-pt"}
            data-tip={p.today ? `Today\n${fmt(p.total)} jobs you can apply for` : `${stepVerb(p)}\n+${fmt(p.gain)} jobs · then ${fmt(p.total)}`} />
        ))}
        <text x="60" y="258" className="ys-t-mono">NOW · {share(applicable)}</text>
        <text x="900" y="258" textAnchor="end" className="ys-t-mono">≈ {fmt(end.hours)} H · {share(end.total)}</text>
        {next && <text x={next.x + 12} y={next.y - 12} className="ys-t-mono ys-t-clay">NEXT: {String(next.name).toUpperCase()}</text>}
      </svg>
    </PlateFigure>
  );
}
