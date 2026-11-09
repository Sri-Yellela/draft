// ⭐ D172 (4) (owner APPROVED 11-06, docs/sketches/atlas-redesign-sketch.html → Your map) · THE MAP AS A TRACK BOARD: a tinted
// board with a dotted grid, one thick looping track from You to a flag at the goal, the route's skills as stations
// (green ✓ = you have it · the next one pulses in the accent · empty rings ahead), the walked part in the accent, and
// "Start: <next>" under it. Reads GET /api/navigator (D143's route + D172 (4)'s stations). A phone gets the same stations
// as an ordered list. Colours are theme tokens only; reduced motion: no pulse.
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../lib/api.js";
import DepthButton from "../../components/DepthButton.jsx";
import { BOARD, layoutTrack, stationStates, startLine, stationHref, flightPlan, cameraFor } from "./trackModel.js";
import "./TrackBoard.css";

const STATE_WORD = { done: "✓ you have it", next: "next", ahead: "" };
// ⭐ A154 (45o, the D172 sketch's stop card: "an icon tile in that stop's colourway + the skill + one short line (proven /
// next · 2 decks, 1 build)", joined to its station by a dotted stem). The counts are the navigator's real ones (decks that
// teach the skill; its Learn lesson). Pure, so a test reads the line.
export function stopLine(s) {
  if (s.state === "done") return "proven";
  const parts = [s.decks > 0 ? `${s.decks} deck${s.decks === 1 ? "" : "s"}` : null, s.learn ? "1 lesson" : null].filter(Boolean);
  if (s.state === "next") return parts.length ? `next · ${parts.join(", ")}` : "next";
  return parts.join(", ");
}
const CARD = { w: 132, h: 46, gap: 30 };
const short = (t, n = 17) => (String(t).length > n ? `${String(t).slice(0, n - 1)}…` : String(t));
// ⭐ D178 Fly my route: one frame per stop; the last one holds a moment, then the board returns to rest.
const FRAME_MS = 1100, HOLD_MS = 1600;
const reducedMotion = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };

export default function TrackBoard({ base = "/app/atlas", signedIn = false }) {
  const navigate = useNavigate();
  const [nav, setNav] = useState(null);
  const [fly, setFly] = useState(null);          // null at rest, else the frame index
  const [still, setStill] = useState(false);     // reduced motion: the walk steps, nothing moves
  const timer = useRef(null);
  useEffect(() => {
    let live = true;
    if (!signedIn) return undefined;
    api("/api/navigator").then(r => live && setNav(r)).catch(() => live && setNav({ ready: false }));
    return () => { live = false; };
  }, [signedIn]);
  const route0 = nav?.ready ? nav.route : null;
  const frames = route0?.stations?.length ? flightPlan(layoutTrack(route0.stations), route0.role, route0.openRoles) : [];
  useEffect(() => {
    if (fly == null) return undefined;
    const last = fly >= frames.length - 1;
    timer.current = setTimeout(() => setFly(last ? null : fly + 1), last ? HOLD_MS : FRAME_MS);
    return () => clearTimeout(timer.current);
  }, [fly, frames.length]);
  const startFlight = () => { setStill(reducedMotion()); setFly(0); };
  // ⭐ A155 (45o): arriving with ?fly=1 (Your skills' "Aim here and fly my route") starts the flight once the route is read.
  const flyAsked = useRef(typeof window !== "undefined" && new URLSearchParams(window.location.search).get("fly") === "1");
  useEffect(() => { if (flyAsked.current && frames.length) { flyAsked.current = false; startFlight(); } }, [frames.length]);   // eslint-disable-line react-hooks/exhaustive-deps
  const stopFlight = () => { clearTimeout(timer.current); setFly(null); };
  if (!signedIn || !nav) return null;
  const route = nav.ready ? nav.route : null;
  if (!route || !(route.stations || []).length) {
    return <p className="atl__quiet" data-track-none="">{nav.ready ? "You cover your goal's top skills — apply now, or choose a further goal on Your route." : nav.message || "Add your current or target role to your job profile, and your map appears."}</p>;
  }
  const { start, flag, stops, segments } = layoutTrack(route.stations);
  const go = startLine(route.stations);
  // ⭐ D178: a station's Learn piece opens in the course's circle view (its new home), not through /learn's redirect.
  const hrefOf = (s) => stationHref(base, s);
  const frame = fly == null ? null : frames[fly];
  const camera = frame && !still ? cameraFor(frame.x, frame.y) : undefined;
  return (
    <section className={`trk-board${frame ? " is-flying" : ""}${still ? " is-still" : ""}`} data-track-board="" data-track-flying={frame ? fly : undefined}
      aria-label={`Your map: from you to ${route.role}`}>
      <svg className="trk-board__svg" viewBox={`0 0 ${BOARD.w} ${BOARD.h}`} role="img" aria-hidden="true" focusable="false">
        <defs>
          <pattern id="trk-dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.4" className="trk-board__dot" /></pattern>
        </defs>
        <rect x="0" y="0" width={BOARD.w} height={BOARD.h} rx="18" className="trk-board__wash" />
        <g className="trk-cam" style={camera ? { transform: camera } : undefined} data-track-camera={camera || ""}>
        <rect x="0" y="0" width={BOARD.w} height={BOARD.h} rx="18" fill="url(#trk-dots)" />
        {segments.map((s, i) => <path key={i} d={s.d} className={`trk-board__track${s.walked && !frame ? " trk-board__track--walked" : ""}`} />)}
        {/* ⭐ D178 Fly my route: the track draws itself, segment by segment, up to the stop the camera is on. */}
        {frame && segments.map((s, i) => <path key={`f${i}`} d={s.d} pathLength="1" className={`trk-board__fly${i < frame.drawn ? " is-drawn" : ""}`} data-fly-seg={i < frame.drawn ? "drawn" : ""} />)}
        <g data-track-start="">
          <rect x={start.x - 46} y={start.y - 20} width="92" height="40" rx="12" className="trk-board__you" />
          {/* A154: the sketch's "You" pill carries your years (the profile's own figure, when known). */}
          <text x={start.x} y={start.y + (Number.isFinite(route.youYears) ? 0 : 6)} textAnchor="middle" className="trk-board__you-t">You</text>
          {Number.isFinite(route.youYears) && <text x={start.x} y={start.y + 14} textAnchor="middle" className="trk-board__you-y" data-track-years={route.youYears}>{route.youYears} yr{route.youYears === 1 ? "" : "s"}</text>}
        </g>
        {stops.map(s => (
          <g key={s.slug} className={`trk-stop trk-stop--${s.state}`} data-station={s.slug} data-station-state={s.state}
            onClick={() => navigate(hrefOf(s))} style={{ cursor: "pointer" }}>
            {s.state === "next" && <circle cx={s.x} cy={s.y} r="26" className="trk-stop__pulse" />}
            <circle cx={s.x} cy={s.y} r="16" className="trk-stop__dot" />
            {s.state === "done" && <path d={`M ${s.x - 7} ${s.y} l 5 5 l 9 -10`} className="trk-stop__tick" />}
            {(() => {
              // A154: the stop's card, above a top-row station and below a bottom-row one, on a dotted stem.
              const cy = s.row === "top" ? s.y - 16 - CARD.gap - CARD.h : s.y + 16 + CARD.gap, cx = s.x - CARD.w / 2;
              const line = stopLine(s);
              return (
                <g className={`trk-card${s.state === "next" ? " is-next" : ""}`} data-stop-card={s.slug}>
                  <line x1={s.x} y1={s.row === "top" ? s.y - 16 : s.y + 16} x2={s.x} y2={s.row === "top" ? cy + CARD.h : cy} className="trk-card__stem" />
                  <rect x={cx} y={cy} width={CARD.w} height={CARD.h} rx="10" className="trk-card__box" />
                  <rect x={cx + 8} y={cy + 9} width="28" height="28" rx="8" className="trk-card__tile" />
                  <text x={cx + 22} y={cy + 28} textAnchor="middle" className="trk-card__ini">{String(s.name).trim().charAt(0).toUpperCase()}</text>
                  <text x={cx + 44} y={cy + (line ? 20 : 28)} className="trk-stop__name">{short(s.name)}</text>
                  {line && <text x={cx + 44} y={cy + 36} className="trk-stop__state" data-stop-line="">{line}</text>}
                </g>
              );
            })()}
          </g>
        ))}
        <g data-track-flag="">
          <line x1={flag.x} y1={flag.y} x2={flag.x} y2={flag.y - 54} className="trk-board__pole" />
          <path d={`M ${flag.x} ${flag.y - 54} l 34 10 l -34 10 z`} className="trk-board__flag" />
          <text x={flag.x + 44} y={flag.y - 40} className="trk-board__goal">{route.role}</text>
          {Number.isFinite(route.openRoles) && <text x={flag.x + 44} y={flag.y - 20} className="trk-board__goal-n">{route.openRoles.toLocaleString("en-US")} open roles</text>}
        </g>
        {frame && <circle cx={frame.x} cy={frame.y} r="34" className="trk-board__here" data-fly-here="" />}
        </g>
      </svg>
      {/* The phone (and screen readers): the same stations, in order. */}
      <ol className="trk-board__list" data-track-list="">
        <li data-station-state="start"><b>You</b> · {nav.current?.name}</li>
        {stationStates(route.stations).map(s => (
          <li key={s.slug} data-station-state={s.state} className={frame?.slug === s.slug ? "is-here" : undefined}><Link to={hrefOf(s)} className="atl__link">{s.name}</Link>{STATE_WORD[s.state] ? ` · ${STATE_WORD[s.state]}` : ""}</li>
        ))}
        <li data-station-state="goal"><b>{route.role}</b>{Number.isFinite(route.openRoles) ? ` · ${route.openRoles.toLocaleString("en-US")} open roles` : ""}</li>
      </ol>
      {/* The flight's line, read aloud as it changes (the board itself is hidden from screen readers; the list carries it). */}
      <p className="trk-board__caption" aria-live="polite" data-fly-caption="">{frame ? frame.text : ""}</p>
      <div className="trk-board__foot">
        {fly == null
          ? <DepthButton size="compact" onClick={startFlight} data-track-fly="">Fly my route</DepthButton>
          : <DepthButton size="compact" onClick={stopFlight} data-track-fly-stop="">Stop</DepthButton>}
        {go && <Link className="atl__link trk-board__start" data-track-next="" to={stationHref(base, go)}>{go.text} →</Link>}
        <span className="atl__quiet">Green: you have it · the pulsing stop is next.</span>
      </div>
    </section>
  );
}
