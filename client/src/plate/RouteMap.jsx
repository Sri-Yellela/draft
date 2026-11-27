// ⭐ D197 Wave 1 #8 (47m, lane gaz) · D201 (c) · THE ROUTE MAP — a route (a saved order of Gazetteer entries) drawn on Atlas's
// PHYSICAL map: x runs along the route, height = the stop's stage (Start lowlands → Master summit; no borders — only the market's
// map has borders, D200), each region the route crosses tints its stretch of ground. The approved canvas board `Route`
// (docs/sketches/final/project/Route.dc.html, generator scripts/sketches47l/route.mjs) drawn in plate tokens.
//   · RouteMap      — the route on the terrain: walked (lit on this route ✓), lit elsewhere (✓ + a dashed ring: it counts
//                     here too, D201 (2)), you are here (clay + the bobbing tag), ahead (white), the last stop a practice
//                     round or a build (a square), an optional ⇄ interchange onto another route; every stop is a link.
//   · RouteLegend   — the board's key under the map.
//   · ProjectRoute  — a project route (D203 (6)): a straight line of entries in their regions' colours, ending in a build.
// ⭐ SHARED: the practice lane's Ask draft route card (AskRoute) and the Logbook's day's leg reuse RouteMap after merge —
// the one route drawing (A93: built once). Data only through props; nothing here fetches.
import { usePlateMotion } from "./motion.js";

export const ROMAN_N = Object.freeze({ I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8 });
const regionVar = (r) => `var(--pl-r${ROMAN_N[r] || 4})`;
const tintVar = (r) => `var(--pl-r${ROMAN_N[r] || 4}-tint)`;
export const STAGE_CAPS = Object.freeze(["LOWLANDS · START", "FOOTHILLS · BUILD", "HIGHLANDS · DEEPEN", "SUMMIT · MASTER"]);
const BAND_Y = [385, 290, 195, 105];
const BAND_LABEL_Y = [410, 318, 222, 130];

/** The stops' points on the board's 1120 × 470 sheet (pure; the tests read it). */
export function routePoints(stops = [], { width = 1120 } = {}) {
  const n = stops.length;
  return stops.map((s, i) => [Math.round(70 + (n > 1 ? i * ((width - 140) / (n - 1)) : (width - 140) / 2)),
    BAND_Y[Math.max(0, Math.min(3, s.stage | 0))] + (i % 2 ? -14 : 12)]);
}
const curve = (pts) => pts.map((p, i) => {
  if (!i) return `M${p[0]} ${p[1]}`;
  const q = pts[i - 1], mx = (q[0] + p[0]) / 2;
  return `C ${mx} ${q[1]}, ${mx} ${p[1]}, ${p[0]} ${p[1]}`;
}).join(" ");

/** The region stretches: each run of stops in one region, from halfway before its first stop to halfway after its last. */
export function regionRuns(stops = [], pts = routePoints(stops), width = 1120) {
  const runs = [];
  stops.forEach((s, i) => {
    const last = runs[runs.length - 1];
    if (last && last.region === s.region) last.to = i; else runs.push({ region: s.region, name: s.regionName, from: i, to: i });
  });
  return runs.map((r, k) => {
    const x0 = k === 0 ? 0 : Math.round((pts[r.from - 1][0] + pts[r.from][0]) / 2);
    const x1 = k === runs.length - 1 ? width : Math.round((pts[r.to][0] + pts[r.to + 1][0]) / 2);
    return { ...r, x0, x1 };
  });
}

const go = (stop, onStop) => (e) => {
  if (!onStop || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  onStop(stop);
};

function Station({ stop, i, x, y, last, onStop }) {
  const ly = y + (i % 2 ? -26 : 34);
  const cap = { fontFamily: "var(--pl-mono)", fill: regionVar(stop.region) };
  let mark;
  if (stop.state === "walked" || stop.state === "elsewhere") {
    mark = (
      <>
        {stop.state === "elsewhere" ? <circle cx={x} cy={y} r="17" fill="none" strokeWidth="2" strokeDasharray="3 3" style={{ stroke: "var(--pl-lit)" }}/> : null}
        <circle cx={x} cy={y} r="13" strokeWidth="2" style={{ fill: "var(--pl-lit)", stroke: "var(--pl-ink)" }}/>
        <path d={`M${x - 6} ${y} l4 4 8-9`} fill="none" strokeWidth="2.4" strokeLinecap="round" style={{ stroke: "var(--pl-on-clay)" }}/>
      </>
    );
  } else if (stop.state === "here") {
    mark = (
      <>
        <circle cx={x} cy={y} r="20" strokeWidth="2.4" style={{ fill: "var(--pl-clay)", stroke: "var(--pl-ink)" }}/>
        <circle cx={x} cy={y} r="6" strokeWidth="1.5" style={{ fill: "var(--pl-card)", stroke: "var(--pl-ink)" }}/>
      </>
    );
  } else if (last && stop.round) {
    mark = (
      <>
        <rect x={x - 14} y={y - 14} width="28" height="28" rx="5" strokeWidth="2" style={{ fill: "var(--pl-card)", stroke: "var(--pl-ink)" }}/>
        <path d={`M${x - 6} ${y + 6} l6-12 6 12z`} style={{ fill: "var(--pl-ink)" }}/>
      </>
    );
  } else {
    mark = <circle cx={x} cy={y} r="13" strokeWidth="2" style={{ fill: "var(--pl-card)", stroke: "var(--pl-ink)" }}/>;
  }
  const body = (
    <g data-route-stop={stop.id} data-s={stop.state}>
      {mark}
      <text x={x} y={ly} textAnchor="middle" fontSize="17" style={{ fontFamily: "var(--pl-serif)", fill: "var(--pl-ink)" }}>{stop.name}</text>
      <text x={x} y={ly + (i % 2 ? -16 : 15)} textAnchor="middle" fontSize="8.5" fontWeight="700" style={cap}>{`PL. ${stop.region} · ${String(i + 1).padStart(2, "0")}`}</text>
    </g>
  );
  return stop.href ? <a href={stop.href} onClick={go(stop, onStop)} aria-label={`Stop ${i + 1}: ${stop.name}`}>{body}</a> : body;
}

/**
 * The route on the physical map. `stops` = [{ id, name, region: "I"…"VIII", regionName, stage: 0–3, state: "walked" |
 * "elsewhere" | "here" | "ahead", round?: the last stop is a practice round / build, href? }]; `interchange` = { at (stop
 * index), label, href } or null; `onStop(stop)` takes a plain click (a new tab stays the browser's). `small` draws the
 * entry rail's short version (no bands, no compass). `label` is what a screen reader hears.
 */
export default function RouteMap({ stops = [], interchange = null, onStop, onInterchange, label, small = false, className = "" }) {
  const motion = usePlateMotion();
  const W = 1120, H = small ? 300 : 470;
  if (!stops.length) return null;
  const pts = routePoints(stops, { width: W }).map(([x, y]) => [x, small ? Math.round(y * 0.62) : y]);
  const runs = regionRuns(stops, pts, W);
  const hereIdx = stops.findIndex((s) => s.state === "here");
  const walkedTo = hereIdx >= 0 ? hereIdx : stops.reduce((a, s, i) => (s.state === "walked" || s.state === "elsewhere" ? i : a), -1);
  const pathD = curve(pts);
  const walkedD = walkedTo > 0 ? curve(pts.slice(0, walkedTo + 1)) : null;
  const here = hereIdx >= 0 ? pts[hereIdx] : null;
  const words = label || `${stops.length} stops on the physical map, from ${stops[0].name} to ${stops[stops.length - 1].name}${hereIdx >= 0 ? `; you are at ${stops[hereIdx].name}, stop ${hereIdx + 1}` : ""}.`;
  const ir = interchange && pts[interchange.at] ? pts[interchange.at] : null;
  return (
    <svg role="img" aria-label={words} viewBox={`0 0 ${W} ${H}`} width="100%" className={`pl-routemap ${className}`.trim()} data-route-map={small ? "small" : "full"}>
      <rect width={W} height={H} style={{ fill: "var(--pl-paper-warm)" }}/>
      {runs.map((r) => <rect key={`${r.region}-${r.from}`} x={r.x0} y="0" width={Math.max(0, r.x1 - r.x0)} height={H} opacity=".7" style={{ fill: tintVar(r.region) }} data-route-region={r.region}/>)}
      {Array.from({ length: small ? 5 : 8 }, (_, k) => {
        const y = (small ? 270 : 430) - k * (small ? 48 : 50);
        return <path key={k} d={`M0 ${y} C 160 ${y - 22 - k * 3}, 300 ${y + 18}, 470 ${y - 10} S 760 ${y - 30 - k * 4}, 900 ${y - 6} S 1060 ${y - 26}, 1120 ${y - 14}`}
          fill="none" strokeWidth="1.2" strokeOpacity={0.18 + k * 0.03} style={{ stroke: regionVar(stops[Math.min(stops.length - 1, hereIdx >= 0 ? hereIdx : 0)].region) }}/>;
      })}
      {runs.map((r) => (
        <text key={`t-${r.region}-${r.from}`} x={r.x0 + 18} y="34" fontSize="10.5" fontWeight="700" letterSpacing="1.4" style={{ fontFamily: "var(--pl-mono)", fill: regionVar(r.region) }}>
          {`PL. ${r.region}${r.name ? ` · ${String(r.name).toUpperCase()}` : ""}`}
        </text>
      ))}
      {small ? null : STAGE_CAPS.map((t, i) => (
        <text key={t} x={W - 14} y={BAND_LABEL_Y[i]} textAnchor="end" fontSize="10" fontWeight="700" letterSpacing="1.2" style={{ fontFamily: "var(--pl-mono)", fill: "var(--pl-muted)" }}>{t}</text>
      ))}
      <path d={pathD} fill="none" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: "var(--pl-ink)" }}/>
      <path d={pathD} fill="none" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: "var(--pl-on-ink)" }}/>
      {walkedD ? <path className={motion ? "at-draw" : undefined} d={walkedD} fill="none" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: "var(--pl-lit)" }}/> : null}
      {ir ? (
        <a href={interchange.href} onClick={(e) => { if (onInterchange && !(e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) { e.preventDefault(); onInterchange(interchange); } }}
          aria-label={`Interchange: ${interchange.label}`} data-route-interchange="">
          <path d={`M${ir[0]} ${ir[1]} L${ir[0] + 18} ${ir[1] - 70}`} strokeWidth="3" strokeDasharray="5 5" style={{ stroke: "var(--pl-r4)" }}/>
          <rect x={ir[0] - 52} y={ir[1] - 98} width="140" height="26" rx="6" strokeWidth="1.5" style={{ fill: "var(--pl-card)", stroke: "var(--pl-ink)" }}/>
          <text x={ir[0] + 18} y={ir[1] - 81} textAnchor="middle" fontSize="9" fontWeight="700" style={{ fontFamily: "var(--pl-mono)", fill: "var(--pl-r4)" }}>{`⇄ ${String(interchange.label).toUpperCase()}`.slice(0, 26)}</text>
        </a>
      ) : null}
      {stops.map((s, i) => <Station key={s.id || i} stop={s} i={i} x={pts[i][0]} y={pts[i][1]} last={i === stops.length - 1} onStop={onStop}/>)}
      {here ? (
        <g className={motion ? "at-bob1" : undefined} aria-hidden="true">
          <rect x={here[0] - 64} y={here[1] - 78} width="128" height="34" rx="6" style={{ fill: "var(--pl-ink)" }}/>
          <text x={here[0]} y={here[1] - 56} textAnchor="middle" fontSize="10.5" fontWeight="700" letterSpacing="1" style={{ fontFamily: "var(--pl-mono)", fill: "var(--pl-on-ink)" }}>YOU ARE HERE</text>
          <path d={`M${here[0] - 6} ${here[1] - 44} l6 8 6-8z`} style={{ fill: "var(--pl-ink)" }}/>
        </g>
      ) : null}
      {small ? null : (
        <g transform={`translate(${W - 70} 52)`} aria-hidden="true">
          <circle r="24" strokeWidth="1.5" style={{ fill: "var(--pl-card)", stroke: "var(--pl-ink)" }}/>
          <path d="M0 -20 L5 0 L0 20 L-5 0 Z" style={{ fill: "var(--pl-ink)" }}/>
          <text y="-28" textAnchor="middle" fontSize="9" fontWeight="700" style={{ fontFamily: "var(--pl-mono)", fill: "var(--pl-ink)" }}>N</text>
        </g>
      )}
    </svg>
  );
}
export { RouteMap };

/** The board's key under the map (colour is never the only signal: each mark has its words). */
export function RouteLegend({ last = "The last stop: a practice round", note = "Higher on the map = a harder stage. Tap any stop to open its entry." }) {
  return (
    <div className="pl-routekey">
      <span className="pl-routekey__i"><span aria-hidden="true" className="pl-routekey__dot" data-s="walked"/>Walked on this route</span>
      <span className="pl-routekey__i"><span aria-hidden="true" className="pl-routekey__dot" data-s="elsewhere"/>Already lit on another route — it counts here</span>
      <span className="pl-routekey__i"><span aria-hidden="true" className="pl-routekey__dot" data-s="here"/>You are here</span>
      <span className="pl-routekey__i"><span aria-hidden="true" className="pl-routekey__dot" data-s="ahead"/>Ahead</span>
      <span className="pl-routekey__i"><span aria-hidden="true" className="pl-routekey__dot" data-s="round"/>{last}</span>
      <span className="pl-grow"/><span className="pl-routekey__note">{note}</span>
    </div>
  );
}

/**
 * A project route (D203 (6)): the entries in a straight line, each leg in its region's colour, ending in a build. `stops` =
 * [{ id, name, region, lit, href }]; `build` = { title, line }; `onStop` as RouteMap's.
 */
export function ProjectRoute({ stops = [], build = { title: "build it", line: "" }, onStop, label }) {
  if (!stops.length) return null;
  const W = Math.max(620, 150 * stops.length + 160), px = (i) => 60 + i * 150, end = W - 100;
  const words = label || `A project route: ${stops.map((s) => s.name).join(", ")}, ending in a build${build.line ? `: ${build.line.toLowerCase()}` : ""}`;
  return (
    <svg role="img" aria-label={words} viewBox={`0 0 ${W} 150`} width="100%" className="pl-routemap" data-project-route="">
      <rect width={W} height="150" style={{ fill: "var(--pl-paper-warm)" }}/>
      <path d={`M60 60 L${end} 60`} strokeWidth="15" strokeLinecap="round" style={{ stroke: "var(--pl-ink)" }}/>
      {stops.map((s, i) => <path key={`l${i}`} d={`M${px(i)} 60 L${i === stops.length - 1 ? end : px(i + 1)} 60`} strokeWidth="9" style={{ stroke: regionVar(s.region) }}/>)}
      {stops.map((s, i) => {
        const g = (
          <g data-route-stop={s.id}>
            <circle cx={px(i)} cy="60" r="13" strokeWidth="2" style={{ fill: s.lit ? "var(--pl-lit)" : "var(--pl-card)", stroke: "var(--pl-ink)" }}/>
            {s.lit ? <path d={`M${px(i) - 6} 60 l4 4 8-9`} fill="none" strokeWidth="2.4" strokeLinecap="round" style={{ stroke: "var(--pl-on-clay)" }}/> : null}
            <text x={px(i)} y="104" textAnchor="middle" fontSize="16" style={{ fontFamily: "var(--pl-serif)", fill: "var(--pl-ink)" }}>{s.name}</text>
            <text x={px(i)} y="122" textAnchor="middle" fontSize="8.5" fontWeight="700" style={{ fontFamily: "var(--pl-mono)", fill: regionVar(s.region) }}>{`PL. ${s.region}`}</text>
          </g>
        );
        return s.href ? <a key={s.id || i} href={s.href} onClick={go(s, onStop)} aria-label={`Stop ${i + 1}: ${s.name}`}>{g}</a> : <g key={s.id || i}>{g}</g>;
      })}
      <g>
        <rect x={end - 30} y="28" width="64" height="64" rx="8" strokeWidth="2" style={{ fill: "var(--pl-card)", stroke: "var(--pl-ink)" }}/>
        <path d={`M${end - 14} 76 L${end + 2} 44 L${end + 18} 76 Z M${end - 6} 76 L${end - 6} 64 L${end + 10} 64 L${end + 10} 76`} fill="none" strokeWidth="2" strokeLinejoin="round" style={{ stroke: "var(--pl-ink)" }}/>
        <text x={end + 2} y="114" textAnchor="middle" fontSize="16" style={{ fontFamily: "var(--pl-serif)", fill: "var(--pl-ink)" }}>{build.title || "build it"}</text>
        {build.line ? <text x={end + 2} y="132" textAnchor="middle" fontSize="8.5" fontWeight="700" style={{ fontFamily: "var(--pl-mono)", fill: "var(--pl-muted)" }}>{String(build.line).toUpperCase().slice(0, 28)}</text> : null}
      </g>
    </svg>
  );
}
