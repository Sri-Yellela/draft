// ⭐ D197 Wave 1 #4 (47h) · THE SURVEY SHEET's drawings, drawn from the company's own data — the final `Survey` board's
// SVGs (docs/sketches/final/project/Survey.dc.html) with their numbers, names and positions read from the page's one read
// instead of the board's example. Given the board's example data each draws the board's figure, path for path (F5).
// The v3 ports in drawings/ (SurveyHiringProfile, SurveyRoleLine) are the static example drawings the gallery shows; these
// are the live ones a page mounts. The team plate is plate/TeamDiorama.jsx and the dial plate/Drawings.jsx CompassDial (one each).
import { useId } from "react";

const INK = { stroke: "var(--pl-ink)" };
const mono = { fontFamily: "var(--pl-mono)", fill: "var(--pl-ink)" };
const serif = { fontFamily: "var(--pl-serif)", fill: "var(--pl-ink)" };

function Grid({ w, h, rows = true, cols = true }) {
  const xs = cols ? Array.from({ length: w / 20 + 1 }, (_, i) => i * 20) : [];
  const ys = Array.from({ length: h / 20 + (rows === "inner" ? -1 : 1) }, (_, i) => (rows === "inner" ? (i + 1) * 20 : i * 20));
  return (
    <g strokeWidth="0.5" opacity="0.14" style={INK}>
      {xs.map((x) => <line key={`x${x}`} x1={x} y1="0" x2={x} y2={h}/>)}
      {ys.map((y) => <line key={`y${y}`} x1="0" y1={y} x2={w} y2={y}/>)}
    </g>
  );
}

/** The elevation profile: new postings by month (surveySheet.js hiringProfile's points), the flag on the latest. */
export function HiringProfile({ profile }) {
  const uid = useId().replace(/:/g, "");
  const pts = profile.points;
  const line = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg role="img" aria-label={`New postings by month from ${pts[0].monthWord} to ${last.monthWord}: ${pts.map((p) => p.n).join(", ")}`} viewBox="0 0 640 300" width="100%" style={{ display: "block" }}>
      <defs><linearGradient id={`${uid}svHyp`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: "var(--pl-iv-6)" }}/><stop offset="1" style={{ stopColor: "var(--pl-iv-1)" }}/></linearGradient></defs>
      <rect width="640" height="300" style={{ fill: "var(--pl-paper-warm)" }}/>
      <Grid w={640} h={300} cols={false} rows="inner"/>
      <polygon points={`${pts[0].x},270 ${line} ${last.x},270`} fill={`url(#${uid}svHyp)`} strokeWidth="1.4" strokeLinejoin="round" style={INK}/>
      <polyline className="at-draw" points={line} fill="none" strokeWidth="2.4" strokeLinejoin="round" style={INK}/>
      {pts.map((p) => (
        <g key={p.x}>
          <circle cx={p.x} cy={p.y} r="6" strokeWidth="2" style={{ fill: "var(--pl-card)", ...INK }}/>
          <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize="18" style={serif}>{p.n}</text>
          <text x={p.x} y="290" textAnchor="middle" fontSize="10" fontWeight="700" style={mono}>{p.month}</text>
        </g>
      ))}
      <path d={`M${last.x} ${last.y} L${last.x} ${last.y - 34}`} strokeWidth="2" style={INK}/>
      <path d={`M${last.x} ${last.y - 34} L${last.x + 22} ${last.y - 28} L${last.x} ${last.y - 20} Z`} strokeWidth="1.4" style={{ fill: "var(--pl-clay)", ...INK }}/>
    </svg>
  );
}

/** The company's line: one stop per role, its open count in the stop; yours in clay. Each stop is a link (`href(stop)`). */
export function RoleLine({ stops = [], company, href }) {
  const end = stops.length ? stops[stops.length - 1].x : 50;
  return (
    <svg role="img" aria-label={`${company}'s open roles as a line of stops: ${stops.map((s) => `${s.name} ${s.n}${s.yours ? " (your stop)" : ""}`).join(", ")}`}
      viewBox="0 0 660 140" width="100%" style={{ display: "block", minWidth: 620 }}>
      <path d={`M50 70 L${end} 70`} strokeWidth="16" strokeLinecap="round" style={INK}/>
      <path d={`M50 70 L${end} 70`} strokeWidth="10" strokeLinecap="round" style={{ stroke: "var(--pl-region)" }}/>
      {stops.map((s) => {
        const g = (
          <g>
            <circle cx={s.x} cy="70" r={s.big || s.yours ? 17 : 13} strokeWidth="2" style={{ fill: s.yours ? "var(--pl-clay)" : "var(--pl-card)", ...INK }}/>
            <text x={s.x} y="75" textAnchor="middle" fontSize="11" fontWeight="700" style={{ fontFamily: "var(--pl-mono)", fill: s.yours ? "var(--pl-on-clay)" : "var(--pl-ink)" }}>{s.n}</text>
            <text x={s.x} y="114" textAnchor="middle" fontSize="12.5" fontWeight="600" style={{ fontFamily: "var(--pl-sans)", fill: "var(--pl-ink)" }}>{s.word}</text>
          </g>
        );
        return href ? <a key={s.id} href={href(s)} aria-label={`${s.name}: ${s.n} open — see them on the market`} data-role-stop={s.id}>{g}</a> : <g key={s.id}>{g}</g>;
      })}
    </svg>
  );
}
