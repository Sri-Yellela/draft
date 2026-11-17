// ⭐ A228 (46r) · "What <role> jobs want" — the role's most-asked skills as ONE picture, two views of the same data (one
// on screen at a time): MAP, a squarified treemap by family (area = how many of the role's jobs want it), and LIST, the
// same skills as ranked bars. Fill = your state: proven solid accent · on your résumé hatched · not yet a dashed outline.
// Each tile carries the skill's picture (Atlas's cached Wikipedia thumbnail) or a letter mark.
import { useId } from "react";
import { ChartFrame, ChartTable, HatchDefs, useWidth } from "./SkillMapBits.jsx";
import { ts } from "../../themes/shapes.js";   // A116: inline sizes follow Settings → Text size
import { familyGroups, fit, fmt, jobsWord, monogram, pct, squarify, STATE_WORD, treemapHeight } from "./skillMapModel.js";

const fillOf = (state, hatch) => (state === "proven" ? { className: "skm-f-proven" } : state === "claimed" ? { className: "skm-f-claimed", fill: `url(#${hatch})` } : { className: "skm-f-missing" });
const tipFor = (a, roleName) => `${a.name}\n${pct(a.share)} of ${roleName} jobs want it · ${jobsWord(a.jobs)}\nYou: ${STATE_WORD[a.state]}`;

function Logo({ a, x, y, s = 24 }) {
  return (
    <g className="skm-nohit">
      <rect x={x} y={y} width={s} height={s} rx={5} className="skm-logo" />
      {a.thumb
        ? <image href={a.thumb} x={x + 2} y={y + 2} width={s - 4} height={s - 4} preserveAspectRatio="xMidYMid meet" />
        : <text x={x + s / 2} y={y + s / 2 + 3.5} textAnchor="middle" className="skm-logo__t" style={{ fontSize: ts(Math.round(s * 0.38)) }}>{monogram(a.name)}</text>}
    </g>
  );
}

function MapView({ asks, W, roleName, hatch }) {
  const H = treemapHeight(W);
  const fams = squarify(familyGroups(asks), 0, 0, W, H);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Your skills, sized for ${roleName}`} data-skm-treemap="map">
      <HatchDefs id={hatch} />
      {fams.map(f => (
        <g key={f.id} data-skm-family={f.id}>
          {f.w > 80 && <text x={f.x + 6} y={f.y + 14} className="skm-fam">{fit(f.id.toUpperCase(), f.w - 10, 7.4)}</text>}
          {squarify(f.kids, f.x + 3, f.y + 20, Math.max(1, f.w - 6), Math.max(1, f.h - 23)).map(t => {
            const on = t.state === "proven";
            const big = t.w > 150 && t.h > 90;
            return (
              <g key={t.id} data-skm-tile={t.slug} data-state={t.state}>
                <rect x={t.x + 1} y={t.y + 1} width={Math.max(0, t.w - 2)} height={Math.max(0, t.h - 2)} rx={5} tabIndex={0} {...fillOf(t.state, hatch)}
                  data-tip={tipFor(t, roleName)} />
                {t.w > 46 && t.h > 40 && <Logo a={t} x={t.x + 8} y={t.y + 8} />}
                {t.w > 90 && t.h > 62 && (
                  <>
                    <text x={t.x + 8} y={t.y + 50} className={`skm-nohit skm-tile__n${on ? " skm-on-accent" : ""}`} style={{ fontSize: ts(big ? 15 : 12) }}>
                      {fit(t.name, t.w - 14, big ? 8.2 : 6.8)}</text>
                    <text x={t.x + 8} y={t.y + 66} className={`skm-nohit skm-t${on ? " skm-on-accent" : ""}`}>{pct(t.share)} of jobs</text>
                  </>
                )}
              </g>
            );
          })}
        </g>
      ))}
    </svg>
  );
}

function ListView({ asks, W, roleName, hatch }) {
  const row = 30, pl = Math.min(190, W * 0.38), pr = 56, H = asks.length * row + 26;
  const x = (v) => pl + v * (W - pl - pr);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="What the job wants, most-wanted first" data-skm-treemap="list">
      <HatchDefs id={hatch} />
      {[0, 0.5, 1].map(t => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={0} y2={H - 20} className="skm-grid" />
          <text x={x(t)} y={H - 4} textAnchor="middle" className="skm-t">{pct(t)} of jobs</text>
        </g>
      ))}
      {asks.map((a, i) => {
        const y = i * row;
        return (
          <g key={a.id} data-skm-bar={a.slug} data-state={a.state}>
            <Logo a={a} x={0} y={y + 5} s={20} />
            <text x={28} y={y + 19} className={a.state === "missing" ? "skm-t skm-t--strong" : "skm-t skm-t--ink"}>{fit(a.name, pl - 36, 6.8)}</text>
            <rect x={x(0)} y={y + 7} width={Math.max(2, x(a.share) - x(0))} height={row - 14} rx={4} tabIndex={0} {...fillOf(a.state, hatch)} data-tip={tipFor(a, roleName)} />
            <text x={x(a.share) + 6} y={y + 19} className="skm-t">{pct(a.share)}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function SkillTreemap({ asks = [], view = "map", roleName = "" }) {
  const [ref, W] = useWidth(900);
  const hatch = `skm-hatch-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const sorted = [...asks].sort((a, b) => b.share - a.share);
  return (
    <>
      <ChartFrame label={`asks-${view}`} frameRef={ref}>
        {sorted.length === 0
          ? <p className="atl__quiet">No open {roleName} job asks for a skill we can read yet.</p>
          : view === "list" ? <ListView asks={sorted} W={W} roleName={roleName} hatch={hatch} />
            : <MapView asks={sorted} W={W} roleName={roleName} hatch={hatch} />}
      </ChartFrame>
      <ChartTable head={["Skill", "Jobs that want it", "You"]}
        rows={sorted.map(a => [a.name, `${pct(a.share)} · ${fmt(a.jobs)}`, STATE_WORD[a.state]])} />
    </>
  );
}
