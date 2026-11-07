// ⭐ D172 (4) (owner APPROVED 11-06, docs/sketches/atlas-redesign-sketch.html → Your map) · THE MAP AS A TRACK BOARD: a tinted
// board with a dotted grid, one thick looping track from You to a flag at the goal, the route's skills as stations
// (green ✓ = you have it · the next one pulses in the accent · empty rings ahead), the walked part in the accent, and
// "Start: <next>" under it. Reads GET /api/navigator (D143's route + D172 (4)'s stations). A phone gets the same stations
// as an ordered list. Colours are theme tokens only; reduced motion: no pulse.
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../lib/api.js";
import { BOARD, layoutTrack, stationStates, startLine } from "./trackModel.js";
import "./TrackBoard.css";

const STATE_WORD = { done: "✓ you have it", next: "next", ahead: "" };

export default function TrackBoard({ base = "/app/atlas", signedIn = false }) {
  const navigate = useNavigate();
  const [nav, setNav] = useState(null);
  useEffect(() => {
    let live = true;
    if (!signedIn) return undefined;
    api("/api/navigator").then(r => live && setNav(r)).catch(() => live && setNav({ ready: false }));
    return () => { live = false; };
  }, [signedIn]);
  if (!signedIn || !nav) return null;
  const route = nav.ready ? nav.route : null;
  if (!route || !(route.stations || []).length) {
    return <p className="atl__quiet" data-track-none="">{nav.ready ? "You cover your goal's top skills — apply now, or choose a further goal on Your route." : nav.message || "Add your current or target role to your job profile, and your map appears."}</p>;
  }
  const { start, flag, stops, segments } = layoutTrack(route.stations);
  const go = startLine(route.stations);
  const hrefOf = (s) => (s.learn?.path ? `${base}/learn#step-${encodeURIComponent(s.learn.stepId)}` : `${base}/${encodeURIComponent(s.slug)}`);
  return (
    <section className="trk-board" data-track-board="" aria-label={`Your map: from you to ${route.role}`}>
      <svg className="trk-board__svg" viewBox={`0 0 ${BOARD.w} ${BOARD.h}`} role="img" aria-hidden="true" focusable="false">
        <defs>
          <pattern id="trk-dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.4" className="trk-board__dot" /></pattern>
        </defs>
        <rect x="0" y="0" width={BOARD.w} height={BOARD.h} rx="18" className="trk-board__wash" />
        <rect x="0" y="0" width={BOARD.w} height={BOARD.h} rx="18" fill="url(#trk-dots)" />
        {segments.map((s, i) => <path key={i} d={s.d} className={`trk-board__track${s.walked ? " trk-board__track--walked" : ""}`} />)}
        <g data-track-start="">
          <rect x={start.x - 46} y={start.y - 20} width="92" height="40" rx="12" className="trk-board__you" />
          <text x={start.x} y={start.y + 6} textAnchor="middle" className="trk-board__you-t">You</text>
        </g>
        {stops.map(s => (
          <g key={s.slug} className={`trk-stop trk-stop--${s.state}`} data-station={s.slug} data-station-state={s.state}
            onClick={() => navigate(hrefOf(s))} style={{ cursor: "pointer" }}>
            {s.state === "next" && <circle cx={s.x} cy={s.y} r="26" className="trk-stop__pulse" />}
            <circle cx={s.x} cy={s.y} r="16" className="trk-stop__dot" />
            {s.state === "done" && <path d={`M ${s.x - 7} ${s.y} l 5 5 l 9 -10`} className="trk-stop__tick" />}
            <text x={s.x} y={s.row === "top" ? s.y - 34 : s.y + 46} textAnchor="middle" className="trk-stop__name">{s.name}</text>
            {STATE_WORD[s.state] && <text x={s.x} y={s.row === "top" ? s.y - 52 : s.y + 64} textAnchor="middle" className="trk-stop__state">{STATE_WORD[s.state]}</text>}
          </g>
        ))}
        <g data-track-flag="">
          <line x1={flag.x} y1={flag.y} x2={flag.x} y2={flag.y - 54} className="trk-board__pole" />
          <path d={`M ${flag.x} ${flag.y - 54} l 34 10 l -34 10 z`} className="trk-board__flag" />
          <text x={flag.x + 44} y={flag.y - 40} className="trk-board__goal">{route.role}</text>
          {Number.isFinite(route.openRoles) && <text x={flag.x + 44} y={flag.y - 20} className="trk-board__goal-n">{route.openRoles.toLocaleString("en-US")} open roles</text>}
        </g>
      </svg>
      {/* The phone (and screen readers): the same stations, in order. */}
      <ol className="trk-board__list" data-track-list="">
        <li data-station-state="start"><b>You</b> · {nav.current?.name}</li>
        {stationStates(route.stations).map(s => (
          <li key={s.slug} data-station-state={s.state}><Link to={hrefOf(s)} className="atl__link">{s.name}</Link>{STATE_WORD[s.state] ? ` · ${STATE_WORD[s.state]}` : ""}</li>
        ))}
        <li data-station-state="goal"><b>{route.role}</b>{Number.isFinite(route.openRoles) ? ` · ${route.openRoles.toLocaleString("en-US")} open roles` : ""}</li>
      </ol>
      <div className="trk-board__foot">
        {go && <Link className="atl__link trk-board__start" data-track-next="" to={go.learn?.path ? `${base}/learn#step-${encodeURIComponent(go.learn.stepId)}` : `${base}/${encodeURIComponent(go.slug)}`}>{go.text} →</Link>}
        <span className="atl__quiet">Green: you have it · the pulsing stop is next.</span>
      </div>
    </section>
  );
}
