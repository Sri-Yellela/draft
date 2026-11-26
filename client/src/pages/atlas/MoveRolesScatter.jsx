// ⭐ A228 (46r) · "Jobs you could move to" — each role a dot: further right = you already have more of what its jobs want
// (the credit-weighted share of its asks), higher = more open jobs. The role on screen is clay; the others open dots.
// Labels never overlap (skillMapModel.js nudgeLabels). ⭐ A231 (46t, owner's pick C): the height is a LOG scale, so a
// role with 20× the open jobs no longer pins every other dot to the floor; exact counts stay in the tooltip and the table.
// ⭐ D200 (a) (47h) · Your survey's 04, "Roles next door": the board's plate (viewBox 960 × 270), the log scale's top the
// next power of ten (plateScatter), YOU HAVE LITTLE OF IT · HALF · YOU HAVE ALL OF IT under it.
import { PlateFigure } from "./SkillMapBits.jsx";
import { fmt, nudgeLabels, pct, plateScatter } from "./skillMapModel.js";

export default function MoveRolesScatter({ roles = [] }) {
  const g = plateScatter(roles);
  const ys = g.ys;
  const tag = (r) => (r.isAim ? " · your aim" : r.isCurrent ? " · today" : "");
  // the label is the name and its tag ("· your aim"), so the nudge measures what is drawn
  const pts = nudgeLabels([...roles].sort((a, b) => b.open - a.open).map(r => ({ ...r, role: r.name, name: `${r.name}${tag(r)}`, cx: g.x(r.coverage), cy: g.y(r.open) })), g.W, { charW: 6.6, gap: 14, line: 14 });
  const shownTag = (r) => (r.isShown ? " · on screen" : tag(r));
  return (
    <PlateFigure label="move" caption="Open jobs on a log scale"
      table={{ head: ["Job", "Open jobs", "You have", "You can apply for now"], rows: roles.map(r => [`${r.name}${shownTag(r)}`, fmt(r.open), pct(r.coverage), fmt(r.applicable)]) }}>
      <svg viewBox={`0 0 ${g.W} ${g.H}`} width="100%" role="img" data-skm-scatter=""
        aria-label="Jobs you could move to: further right means you already have more of what they want; higher means more open jobs">
        <rect width={g.W} height={g.H} className="ys-ground" />
        <g className="ys-rules">{g.ticks.map(({ t, y }) => <line key={t} x1="60" y1={y} x2="900" y2={y} />)}</g>
        {g.ticks.map(({ t, y }) => <text key={t} x="52" y={y + 4} textAnchor="end" className="ys-t-mono ys-t-sm ys-t-muted">{fmt(t)}</text>)}
        {/* 46s: every dot first, then every label — a later dot was drawn over an earlier label */}
        {pts.map(p => (
          <circle key={`d${p.id}`} data-skm-role={p.slug} cx={p.cx} cy={p.cy} r={p.isShown ? 10 : 7} className={p.isShown ? "ys-dot ys-dot--on" : "ys-dot"} tabIndex={0}
            data-tip={`${p.role}${shownTag(p)}\n${fmt(p.open)} open jobs · you have ${pct(p.coverage)} of it\n${fmt(p.applicable)} you can apply for now`} />
        ))}
        {pts.map(p => (
          <text key={`l${p.id}`} data-skm-role-label={p.slug} x={p.lx} y={p.ly + 4} textAnchor={p.anchor} className={p.isShown ? "ys-t-dot ys-t-dot--on" : "ys-t-dot"}>{p.name}</text>
        ))}
        <text x="60" y="258" className="ys-t-mono ys-t-muted">YOU HAVE LITTLE OF IT</text>
        <text x="480" y="258" textAnchor="middle" className="ys-t-mono ys-t-muted">HALF</text>
        <text x="900" y="258" textAnchor="end" className="ys-t-mono ys-t-muted">YOU HAVE ALL OF IT</text>
      </svg>
    </PlateFigure>
  );
}
