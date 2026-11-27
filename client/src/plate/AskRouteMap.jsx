// ⭐ D197 Wave 2 #12 · M5 (47m, lane practice) · ASK DRAFT'S ROUTE CARD — the approved board AskRoute
// (docs/sketches/final/project/AskRoute.dc.html, scripts/sketches47l/ask.mjs miniRoute): a learning answer that names two
// or three Atlas entries is drawn as a small route made on the spot — the question is the start flag, the entries are the
// stops on the physical map (lit ones green), the first unlit stop is the waypoint (clay) with its ticket; Save to my routes
// keeps it (POST /api/atlas/question-routes) and Routes shows it flagged *made from a question*. One entry stays a link and
// more than three point to an existing route — the caller (AppNav's AskDraftPanel) decides which (askRouteKind).
// The board's geometry, drawn from data: the board's three stops sit at (130, 92), (228, 70), (326, 44) after the flag at
// (34, 120); two stops take the first and the last of those. Colours are plate tokens (the board's hexes: the region tint, the
// region ink, the lit green, clay, ink, paper).
// ⚠ 47m: lane gaz builds a shared RouteMap for Routes in parallel; this small map should fold into it after the merge (A93 —
// one route drawing), keeping this card's props.

import "./practicePlate.css";

const FLAG = [34, 120];
const SPOTS = { 2: [[180, 82], [326, 44]], 3: [[130, 92], [228, 70], [326, 44]] };

/** Which kind of answer this is: "link" (one entry), "route" (two or three), "bigger" (more than three), or null. Pure. */
export function askRouteKind(lessons = []) {
  const n = (lessons || []).length;
  return !n ? null : n === 1 ? "link" : n <= 3 ? "route" : "bigger";
}

/** The trail through the points, the board's curve between each pair. Pure. */
export function askRoutePath(points = []) {
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1], [x1, y1] = points[i];
    d += ` C ${x0 + 46} ${y0}, ${x1 - 40} ${y1}, ${x1} ${y1}`;
  }
  return d;
}

/** The map: `stops` = [{ name, lit }] (2 or 3); the first unlit stop is the waypoint. */
export function AskRouteMap({ stops = [], label }) {
  const spots = SPOTS[stops.length] || SPOTS[3];
  const pts = [FLAG, ...spots.slice(0, stops.length)];
  const d = askRoutePath(pts);
  const litUpTo = stops.findIndex((s) => !s.lit);   // the waypoint's index (-1 = every stop lit)
  const way = litUpTo < 0 ? null : litUpTo;
  const litD = way === 0 ? null : askRoutePath(pts.slice(0, (way == null ? stops.length : way) + 1));
  const contours = [0, 1, 2, 3, 4].map((k) => `M0 ${150 - k * 26} C 80 ${140 - k * 28}, 170 ${156 - k * 26}, 250 ${138 - k * 27} S 340 ${126 - k * 26}, 380 ${130 - k * 27}`);
  const words = label || `The answer as a route: your question is the start flag; ${stops.map((s) => `${s.name}${s.lit ? " (lit)" : ""}`).join(", ")} are the stops${way != null ? `; the waypoint is ${stops[way].name}` : ""}`;
  return (
    <svg role="img" aria-label={words} viewBox="0 0 380 170" width="100%" style={{ display: "block" }}>
      <rect width="380" height="170" style={{ fill: "var(--pl-region-tint)" }}/>
      {contours.map((c, k) => <path key={k} d={c} fill="none" strokeWidth="1.1" strokeOpacity={0.16 + k * 0.04} style={{ stroke: "var(--pl-region)" }}/>)}
      <path d={d} fill="none" strokeWidth="11" strokeLinecap="round" style={{ stroke: "var(--pl-ink)" }}/>
      <path d={d} fill="none" strokeWidth="6" strokeLinecap="round" style={{ stroke: "var(--pl-paper)" }}/>
      {litD ? <path d={litD} fill="none" strokeWidth="6" strokeLinecap="round" style={{ stroke: "var(--pl-lit)" }}/> : null}
      <g>
        <path d={`M${FLAG[0] - 6} ${FLAG[1] + 12} L${FLAG[0] - 6} ${FLAG[1] - 28}`} strokeWidth="2" style={{ stroke: "var(--pl-ink)" }}/>
        <path d={`M${FLAG[0] - 6} ${FLAG[1] - 28} L${FLAG[0] + 16} ${FLAG[1] - 21} L${FLAG[0] - 6} ${FLAG[1] - 14} Z`} strokeWidth="1.5" style={{ fill: "var(--pl-clay)", stroke: "var(--pl-ink)" }}/>
        <text x={FLAG[0] - 12} y={FLAG[1] + 30} fontSize="8.5" fontWeight="700" style={{ fontFamily: "var(--pl-mono)", fill: "var(--pl-ink)" }}>YOUR QUESTION</text>
      </g>
      {stops.map((s, i) => {
        const [x, y] = spots[i];
        const isWay = i === way;
        return (
          <g key={i}>
            {isWay
              ? <><circle cx={x} cy={y} r="13" strokeWidth="2" style={{ fill: "var(--pl-clay)", stroke: "var(--pl-ink)" }}/><circle cx={x} cy={y} r="4" style={{ fill: "var(--pl-card)" }}/></>
              : <circle cx={x} cy={y} r="10" strokeWidth="2" style={{ fill: s.lit ? "var(--pl-lit)" : "var(--pl-card)", stroke: "var(--pl-ink)" }}/>}
            {s.lit && !isWay ? <path d={`M${x - 5} ${y} l3 3 7-7`} fill="none" strokeWidth="2" strokeLinecap="round" style={{ stroke: "var(--pl-card)" }}/> : null}
            <text x={x} y={y + (isWay ? 34 : 30)} textAnchor="middle" fontSize="15" style={{ fontFamily: "var(--pl-serif)", fill: "var(--pl-ink)" }}>{s.name}</text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * The card under the answer: the strip (THIS ANSWER AS A ROUTE · N STOPS · K LIT), the map, the waypoint ticket (its entry),
 * then Save to my routes (or SAVED · ON YOUR ROUTES) and Open on Your map. `stops` = [{ slug, name, href, lit }].
 */
export function AskRouteCard({ stops = [], saved = false, saving = false, message = null, onSave, onGo, mapHref = "/app/atlas/your-map" }) {
  const lit = stops.filter((s) => s.lit).length;
  const way = stops.find((s) => !s.lit) || null;
  const go = (href) => (e) => { if (!onGo || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return; e.preventDefault(); onGo(href); };
  return (
    <div className="pl-askroute" data-ask-route={stops.length}>
      <div className="pl-askroute__strip">
        <span className="pl-label">{`THIS ANSWER AS A ROUTE · ${stops.length} STOPS`}</span>
        {lit ? <span className="pl-label pl-tone-lit">{`${lit} LIT`}</span> : null}
      </div>
      <AskRouteMap stops={stops}/>
      <div className="pl-askroute__foot">
        {way ? (
          <a className="pl-askroute__way" href={way.href} onClick={go(way.href)} data-ask-route-waypoint={way.slug}>
            <span className="pl-askroute__waytext"><span className="pl-label pl-askroute__waykick">WAYPOINT · NEXT</span><span><b>{way.name}</b> · its Gazetteer entry</span></span>
            <span aria-hidden="true" className="pl-askroute__tear"/>
            <span className="pl-label pl-askroute__go">GO →</span>
          </a>
        ) : <span className="pl-label pl-tone-lit">EVERY STOP LIT</span>}
        <div className="pl-actions">
          {saved ? <span className="pl-label pl-muted" data-ask-route-saved="">SAVED · ON YOUR ROUTES, MADE FROM A QUESTION</span>
            : <button type="button" className="pl-btn" onClick={onSave} disabled={saving} data-ask-route-save="">{saving ? "Saving…" : "Save to my routes"}</button>}
          <a className="pl-btn" href={mapHref} onClick={go(mapHref)}>Open on Your map</a>
        </div>
        {message ? <p className="pl-label pl-muted" role="status">{message}</p> : null}
      </div>
    </div>
  );
}
