// ⭐ D197 Wave 1 #4 (47h) · THE SURVEY SHEET's drawings, drawn from the company's own data — the final `Survey` board's
// SVGs (docs/sketches/final/project/Survey.dc.html) with their numbers, names and positions read from the page's one read
// instead of the board's example. Given the board's example data each draws the board's figure, path for path (F5).
// The v3 ports in drawings/ (SurveyTeamDiorama, SurveyHiringProfile, SurveyRoleLine, SurveyMatchDial) are the static
// example drawings the gallery shows; these are the live ones a page mounts.
import { useId } from "react";
import { usePlateMotion } from "./motion.js";

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

/**
 * The company as an isometric plate of its three most-named teams (largest on the tall block, then the right, then the
 * front one), a beacon on `beacon` (0–2 — the team of the job you opened; null = none), the HQ along the edge.
 */
export function TeamPlate({ teams = [], beacon = null, hq = "", label }) {
  const uid = useId().replace(/:/g, "");
  const motion = usePlateMotion();
  const word = (i) => (teams[i] ? String(teams[i]).toUpperCase() : "");
  const beaconAt = [[230, 164], [410, 164], [320, 224]][beacon ?? -1];
  return (
    <svg role="img" aria-label={label} viewBox="0 0 640 460" width="100%" height="100%" style={{ display: "block" }}>
      <defs>
        <pattern id={`${uid}svHatch`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" strokeWidth="1" opacity="0.3" style={INK}/>
        </pattern>
      </defs>
      <rect width="640" height="460" style={{ fill: "var(--pl-paper-warm)" }}/>
      <Grid w={640} h={460}/>
      <polygon points="320,110 560,230 320,350 80,230" strokeWidth="1.6" strokeLinejoin="round" style={{ fill: "var(--pl-iv-1)", ...INK }}/>
      <polygon points="80,230 320,350 320,372 80,252" fill={`url(#${uid}svHatch)`} strokeWidth="1.4" style={INK}/>
      <polygon points="560,230 320,350 320,372 560,252" strokeWidth="1.4" style={{ fill: "var(--pl-iv-3)", ...INK }}/>
      <path d="M200 170 L440 290 M440 170 L200 290" strokeWidth="10" style={{ stroke: "var(--pl-paper)" }}/>
      <path d="M200 170 L440 290 M440 170 L200 290" strokeWidth="1" strokeDasharray="6 6" opacity=".55" style={INK}/>
      {teams[0] ? <>
        <polygon points="230,170 270,190 230,210 190,190" strokeWidth="1.5" strokeLinejoin="round" style={{ fill: "var(--pl-iv-4)", ...INK }}/>
        <polygon points="190,190 230,210 230,274 190,254" strokeWidth="1.5" strokeLinejoin="round" style={{ fill: "var(--pl-iv-6)", ...INK }}/>
        <polygon points="270,190 230,210 230,274 270,254" strokeWidth="1.5" strokeLinejoin="round" style={{ fill: "var(--pl-iv-5)", ...INK }}/>
        <text x="230" y="300" textAnchor="middle" fontSize="10" fontWeight="700" letterSpacing="1.2" style={mono}>{word(0)}</text>
      </> : null}
      {teams[1] ? <>
        <polygon points="410,170 450,190 410,210 370,190" strokeWidth="1.5" strokeLinejoin="round" style={{ fill: "var(--pl-iv-2)", ...INK }}/>
        <polygon points="370,190 410,210 410,254 370,234" strokeWidth="1.5" strokeLinejoin="round" style={{ fill: "var(--pl-iv-5)", ...INK }}/>
        <polygon points="450,190 410,210 410,254 450,234" strokeWidth="1.5" strokeLinejoin="round" style={{ fill: "var(--pl-iv-4)", ...INK }}/>
        <text x="410" y="280" textAnchor="middle" fontSize="10" fontWeight="700" letterSpacing="1.2" style={mono}>{word(1)}</text>
      </> : null}
      {teams[2] ? <>
        <polygon points="320,230 360,250 320,270 280,250" strokeWidth="1.5" strokeLinejoin="round" style={{ fill: "var(--pl-card)", ...INK }}/>
        <polygon points="280,250 320,270 320,322 280,302" strokeWidth="1.5" strokeLinejoin="round" style={{ fill: "var(--pl-iv-3)", ...INK }}/>
        <polygon points="360,250 320,270 320,322 360,302" strokeWidth="1.5" strokeLinejoin="round" style={{ fill: "var(--pl-iv-1)", ...INK }}/>
        <text x="320" y="348" textAnchor="middle" fontSize="10" fontWeight="700" letterSpacing="1.2" style={mono}>{word(2)}</text>
      </> : null}
      {!teams.length ? <text x="320" y="236" textAnchor="middle" fontSize="10" fontWeight="700" letterSpacing="1.2" style={mono}>NO TEAMS NAMED IN THEIR POSTINGS</text> : null}
      {beaconAt ? (
        <g transform={`translate(${beaconAt[0]} ${beaconAt[1]})`}>
          <circle r="10" fill="none" strokeWidth="2" style={{ stroke: "var(--pl-clay)" }}>
            {motion && <><animate attributeName="r" values="10;26" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.9;0" dur="2s" repeatCount="indefinite"/></>}
          </circle>
          <circle r="9" strokeWidth="2" style={{ fill: "var(--pl-clay)", ...INK }}/>
        </g>
      ) : null}
      <g fontSize="10" opacity=".58" style={mono}>
        {["A", "B", "C", "D", "E", "F", "G"].map((l, i) => <text key={l} x={40 + i * 90} y="16">{l}</text>)}
      </g>
      {hq ? <text x="24" y="430" fontStyle="italic" fontSize="16" letterSpacing="3" style={serif}>{`${hq.toUpperCase()} · HQ`}</text> : null}
      <g transform="translate(590 410)">
        <circle r="18" strokeWidth="1.4" style={{ fill: "var(--pl-card)", ...INK }}/>
        <path d="M0 -14 L4 0 L0 14 L-4 0 Z" style={{ fill: "var(--pl-ink)" }}/>
        <path d="M0 -14 L4 0 L-4 0 Z" style={{ fill: "var(--pl-clay)" }}/>
      </g>
    </svg>
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

/** The compass dial: `of` ticks, the first `have` lit; the needle at have / of of the way round. */
export function MatchDial({ have, of }) {
  const ticks = Array.from({ length: 12 }, (_, i) => i);
  const lit = Math.round((12 * have) / Math.max(1, of));
  return (
    <svg role="img" aria-label={`Compass dial: you have ${have} of their top ${of} technologies on your résumé`} viewBox="0 0 128 128" width="128" height="128" style={{ flex: "0 0 auto" }}>
      <circle cx="64" cy="64" r="58" strokeWidth="1.5" style={{ fill: "var(--pl-card)", ...INK }}/>
      {ticks.map((i) => <line key={i} x1="64" y1="10" x2="64" y2="20" strokeWidth={i < lit ? 3 : 1.5} style={{ stroke: i < lit ? "var(--pl-lit)" : "var(--pl-ink)" }} transform={`rotate(${i * 30} 64 64)`}/>)}
      <g transform={`rotate(${Math.round((360 * have) / Math.max(1, of))} 64 64)`}>
        <path d="M64 22 L69 64 L64 106 L59 64 Z" style={{ fill: "var(--pl-ink)" }}/>
        <path d="M64 22 L69 64 L59 64 Z" style={{ fill: "var(--pl-clay)" }}/>
      </g>
      <circle cx="64" cy="64" r="5" strokeWidth="1.5" style={{ fill: "var(--pl-card)", ...INK }}/>
    </svg>
  );
}
