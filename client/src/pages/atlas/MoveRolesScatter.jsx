// ⭐ A228 (46r) · "Jobs you could move to" — each role a dot: further right = you already have more of what its jobs want
// (the credit-weighted share of its asks), higher = more open jobs. The role on screen is the accent; the others the chart
// neutral. Labels never overlap (skillMapModel.js nudgeLabels). ⭐ A231 (46t, owner's pick C): the height is a LOG scale
// (logScale), so a role with 20× the open jobs no longer pins every other dot to the floor; exact counts stay in the
// tooltip and the table.
import { ChartFrame, ChartTable, useWidth } from "./SkillMapBits.jsx";
import { fmt, logScale, nudgeLabels, pct } from "./skillMapModel.js";

export default function MoveRolesScatter({ roles = [] }) {
  const [ref, W] = useWidth(900);
  const H = Math.round(Math.max(240, Math.min(340, W * 0.3))), pl = 56, pr = 24, pb = 30;
  const ys = logScale(roles.map(r => r.open));
  const x = (v) => pl + v * (W - pl - pr), y = (v) => H - pb - ys.pos(v) * (H - pb - 14);
  const pts = nudgeLabels([...roles].sort((a, b) => b.open - a.open).map(r => ({ ...r, cx: x(r.coverage), cy: y(r.open) })), W);
  const tag = (r) => (r.isShown ? " · on screen" : r.isAim ? " · your aim" : r.isCurrent ? " · today" : "");
  return (
    <>
      <ChartFrame label="move" frameRef={ref}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Jobs you could move to" data-skm-scatter="">
          {ys.ticks.map(t => (
            <g key={t}>
              <line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} className="skm-grid" />
              <text x={pl - 6} y={y(t) + 4} textAnchor="end" className="skm-t">{fmt(t)}</text>
            </g>
          ))}
          <text x={x(0)} y={H - 8} className="skm-t">you have little of it</text>
          {W > 520 && <text x={x(0.5)} y={H - 8} textAnchor="middle" className="skm-t">half</text>}
          <text x={x(1)} y={H - 8} textAnchor="end" className="skm-t">you have all of it</text>
          {/* 46s: every dot first, then every label — a later dot was drawn over an earlier label ("oftware Engineer") */}
          {pts.map(p => (
            <circle key={`d${p.id}`} data-skm-role={p.slug} cx={p.cx} cy={p.cy} r={p.isShown ? 11 : 8} className={p.isShown ? "skm-dot skm-dot--on" : "skm-dot"} tabIndex={0}
              data-tip={`${p.name}${tag(p)}\n${fmt(p.open)} open jobs · you have ${pct(p.coverage)} of it\n${fmt(p.applicable)} you can apply for now`} />
          ))}
          {pts.map(p => (
            <text key={`l${p.id}`} data-skm-role-label={p.slug} x={p.lx} y={p.ly + 4} textAnchor={p.anchor} className={p.isShown ? "skm-t skm-t--strong" : "skm-t skm-t--ink"}>{p.name}</text>
          ))}
        </svg>
      </ChartFrame>
      <ChartTable head={["Job", "Open jobs", "You have", "You can apply for now"]}
        rows={roles.map(r => [`${r.name}${tag(r)}`, fmt(r.open), pct(r.coverage), fmt(r.applicable)])} />
    </>
  );
}
