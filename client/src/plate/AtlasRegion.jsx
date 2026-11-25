// ⭐ D197 Wave 1 #6 (47h, lane atlas) · A REGION OF THE ATLAS — the approved canvas board `Map` (docs/sketches/final/project/
// Map.dc.html): the region plate header (emblem, name, chips, the dial), the next waypoint ticket, and three binder tabs:
//   Terrain  the PHYSICAL map (D200): concentric contour bands rising to the summit — HEIGHT = how far you've climbed,
//            places = lessons, trails between them; drag to explore, tap a place for its field card. ⛔ NO BORDERS: only
//            the market's political map draws borders (D200, test/d200AtlasMapNoBorders) — every closed line here is a
//            contour (data-contour), every band an elevation (data-elevation).
//   Route    the region as a transit line: stops in stage colours on an ink casing, ⇄ interchanges into other regions.
//   Index    the region's gazetteer: grid, place, elevation, checks, field notes, status — a row opens it on the terrain.
// The board's markup in plate classes (plate/atlasPlate.css); the data is the page's (pages/atlas/AtlasVolume.jsx) or the
// F5 fixture's (the board's own).
import { useEffect, useRef, useState } from "react";
import { RegionEmblem } from "./Drawings.jsx";
import "./atlasPlate.css";

const plain = (e) => !(e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey);

/** The region dial: a tick per place (lit green), the needle at lit / total of the way round (the board's 128 px dial). */
export function RegionDial({ lit = 0, total = 1, size = 128 }) {
  const n = Math.max(1, total), k = Math.min(n, Math.max(0, lit)), step = 360 / n;
  return (
    <svg role="img" aria-label={`${k} of ${n} places lit`} width={size} height={size} viewBox="0 0 128 128">
      <circle cx="64" cy="64" r="58" strokeWidth="1.5" style={{ fill: "var(--pl-paper)", stroke: "var(--pl-ink)" }}/>
      <g strokeWidth="5" strokeLinecap="round">
        {Array.from({ length: n }, (_, i) => {
          const a = ((-90 + i * step) * Math.PI) / 180;
          return <line key={i} x1={64 + 44 * Math.cos(a)} y1={64 + 44 * Math.sin(a)} x2={64 + 52 * Math.cos(a)} y2={64 + 52 * Math.sin(a)}
            style={{ stroke: i < k ? "var(--pl-lit)" : "var(--pl-at-dial-off)" }}/>;
        })}
      </g>
      <circle cx="64" cy="64" r="34" strokeWidth="1.2" style={{ fill: "var(--pl-card)", stroke: "var(--pl-ink)" }}/>
      <path d="M64 30 L70 64 L64 98 L58 64 Z" transform={`rotate(${+(k * step).toFixed(4)} 64 64)`} style={{ fill: "var(--pl-ink)" }}/>
      <path d="M64 30 L70 64 L58 64 Z" transform={`rotate(${+(k * step).toFixed(4)} 64 64)`} style={{ fill: "var(--pl-clay)" }}/>
      <circle cx="64" cy="64" r="4" strokeWidth="1.5" style={{ fill: "var(--pl-card)", stroke: "var(--pl-ink)" }}/>
    </svg>
  );
}

/** The region plate header + the next waypoint ticket. `waypoint` = { grid, name, line, href, onClick } or null (all lit). */
export function RegionHeader({ emblem = "net", roman = "IV", volume = "I", name, lead, chips = [], lit = 0, total = 1, waypoint }) {
  return (
    <section className="pl-at-rhead" aria-labelledby="pl-at-region-title">
      <div className="pl-at-rhead__plate">
        <span className="pl-at-rhead__emblem"><RegionEmblem kind={emblem} region={roman} size={150}/></span>
        <div className="pl-at-rhead__text">
          <span className="pl-at-rhead__k">REGION {roman} · PLATE {roman} · VOLUME {volume}</span>
          <h1 className="pl-at-rhead__title" id="pl-at-region-title">{name}</h1>
          {lead ? <p className="pl-at-rhead__lead">{lead}</p> : null}
          <span className="pl-at-rhead__chips">{chips.map((c) => <span key={c} className="pl-at-mchip">{c}</span>)}</span>
        </div>
        <div className="pl-at-rhead__dial">
          <RegionDial lit={lit} total={total}/>
          <span className="pl-at-rhead__lit">{lit} / {total} LIT</span>
        </div>
      </div>
      {waypoint ? (
        <a className="pl-at-waypoint" href={waypoint.href} onClick={(e) => { if (waypoint.onClick && plain(e)) { e.preventDefault(); waypoint.onClick(); } }} data-atlas-waypoint="">
          <span className="pl-at-waypoint__top"><span>NEXT WAYPOINT</span><span>GRID {waypoint.grid}</span></span>
          <span className="pl-at-waypoint__name">{waypoint.name}</span>
          <span className="pl-at-waypoint__tear" aria-hidden="true"/>
          <span className="pl-at-waypoint__foot"><span>{waypoint.line}</span><span className="pl-at-waypoint__go">Set out →</span></span>
        </a>
      ) : (
        <div className="pl-at-waypoint" data-done="">
          <span className="pl-at-waypoint__top"><span>EVERY PLACE LIT</span><span>PLATE {roman}</span></span>
          <span className="pl-at-waypoint__name">Summit reached</span>
          <span className="pl-at-waypoint__tear" aria-hidden="true"/>
          <span className="pl-at-waypoint__foot"><span>{total} of {total} places explained</span></span>
        </div>
      )}
    </section>
  );
}

const TAB_ICONS = {
  terrain: "M3 18l5-8 4 5 3-4 6 7z M8 6a2 2 0 1 0 0.01 0",
  route: "M5 19V9a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v10 M5 13h14 M8 19v2 M16 19v2",
  index: "M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z M9 9h6 M9 13h6",
};
const STAGE_COLOUR = { start: "var(--pl-stage-start)", build: "var(--pl-stage-build)", deepen: "var(--pl-stage-deepen)", master: "var(--pl-stage-master)" };
const STAGE_TINT = { start: "var(--pl-at-start-tint)", build: "var(--pl-iv-0)", deepen: "var(--pl-clay-tint)", master: "var(--pl-at-master-tint)" };
const STAGE_LABEL = { start: "Start", build: "Build", deepen: "Deepen", master: "Master" };

/** The contour bands of the physical map (the board's four, rising to the summit at 1240 × 150) — elevations, never borders. */
const BANDS = [
  "M1240 150 m-1060 0 c0 -560 520 -760 1060 -720 c600 40 800 420 760 760 c-40 460 -520 640 -1000 600 c-480 -40 -820 -200 -820 -640 z",
  "M1240 150 m-740 0 c0 -380 360 -520 740 -500 c420 20 560 300 530 520 c-30 300 -360 440 -700 420 c-330 -20 -570 -140 -570 -440 z",
  "M1240 150 m-420 0 c0 -220 200 -300 420 -290 c240 10 320 170 300 300 c-20 170 -200 250 -400 240 c-190 -10 -320 -80 -320 -250 z",
  "M1240 150 m-160 0 c0 -90 80 -120 160 -116 c96 4 128 66 120 118 c-8 68 -80 100 -160 96 c-76 -4 -120 -36 -120 -98 z",
];
const CONTOURS = [
  "M1240 150 m-900 0 c0 -470 440 -640 900 -610 c510 30 680 360 645 640 c-35 390 -440 540 -850 510 c-410 -30 -695 -170 -695 -540 z",
  "M1240 150 m-580 0 c0 -300 280 -410 580 -395 c330 15 440 235 415 410 c-25 240 -280 345 -550 330 c-260 -15 -445 -110 -445 -345 z",
  "M1240 150 m-290 0 c0 -150 140 -205 290 -200 c165 5 220 118 205 205 c-15 118 -140 172 -275 165 c-130 -7 -220 -55 -220 -170 z",
];
const HOME = { x: -60, y: -40 };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** The terrain: the bands, the stage names, the grid, the trails, the places; drag to explore, tap a place. */
function Terrain({ places = [], trails = [], selected, onSelect, card, uid = "at" }) {
  const [off, setOff] = useState(HOME);
  const [drag, setDrag] = useState(null);
  const moved = useRef(false);
  const sel = places.find((p) => p.id === selected) || places[0];
  const c = sel ? card(sel) : null;
  const down = (e) => {
    if (e.target.closest?.("a") || (e.target.closest?.("button") && !e.target.closest?.(".pl-at-mk"))) return;
    moved.current = false;
    setDrag({ x: e.clientX, y: e.clientY, ox: off.x, oy: off.y });
  };
  const move = (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) moved.current = true;
    setOff({ x: clamp(drag.ox + dx, -420, 120), y: clamp(drag.oy + dy, -120, 60) });
  };
  const up = () => { if (drag) setDrag(null); setTimeout(() => { moved.current = false; }, 0); };
  const nudge = (dx, dy) => setOff((o) => ({ x: clamp(o.x + dx, -420, 120), y: clamp(o.y + dy, -120, 60) }));
  const keys = (e) => {
    const d = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] }[e.key];
    if (!d || e.target.closest?.("button, a, input")) return;
    e.preventDefault(); nudge(...d);
  };
  return (
    <div className="pl-at-terrain at-in" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} onKeyDown={keys} tabIndex={0}
      role="application" aria-label="The region's terrain: drag or use the arrow keys to explore; each place is a button" data-dragging={drag ? "" : undefined} data-map="physical">
      <div className="pl-at-terrain__host" style={{ transform: `translate(${off.x}px, ${off.y}px)` }} data-easing={drag ? undefined : ""}>
        <svg aria-hidden="true" width="1400" height="720" viewBox="0 0 1400 720" className="pl-at-terrain__svg">
          <defs><pattern id={`${uid}Grid`} width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" strokeWidth=".4" opacity=".14" style={{ stroke: "var(--pl-ink)" }}/></pattern></defs>
          <rect width="1400" height="720" style={{ fill: "var(--pl-paper)" }}/>
          {BANDS.map((d, i) => <path key={i} d={d} strokeWidth="1.4" data-contour="" data-elevation={i + 1} style={{ fill: `var(--pl-at-band-${i})`, stroke: "var(--pl-ink)" }}/>)}
          <g fill="none" strokeWidth=".7" opacity=".35" style={{ stroke: "var(--pl-ink)" }}>{CONTOURS.map((d, i) => <path key={i} d={d} data-contour=""/>)}</g>
          <rect width="1400" height="720" fill={`url(#${uid}Grid)`}/>
          <g fontSize="20" fontStyle="italic" letterSpacing="4" style={{ fontFamily: "var(--pl-serif)", fill: "var(--pl-ink)" }}>
            <text x="70" y="690">LOWLANDS · START</text>
            <text x="300" y="300" transform="rotate(-24 300 300)">FOOTHILLS · BUILD</text>
            <text x="700" y="200" transform="rotate(-18 700 200)">HIGHLANDS · DEEPEN</text>
            <text x="1110" y="60">SUMMIT · MASTER</text>
          </g>
          <g fontSize="10" fontWeight="700" opacity=".55" style={{ fontFamily: "var(--pl-mono)", fill: "var(--pl-ink)" }}>
            {"ABCDEF".split("").map((l, i) => <text key={l} x={180 + i * 200} y="22">{l}</text>)}
            {[1, 2, 3, 4, 5].map((r, i) => <text key={r} x="10" y={80 + i * 140}>{r}</text>)}
          </g>
          <g fill="none" strokeLinecap="round">
            {trails.map((t) => (
              <g key={t.id} data-trail={t.kind}>
                <path d={t.d} strokeWidth={t.kind === "walked" ? 7 : 0} style={{ stroke: "var(--pl-ink)" }}/>
                <path d={t.d} strokeWidth={t.kind === "walked" ? 4 : t.kind === "next" ? 3.5 : 1.8} strokeDasharray={t.kind === "walked" ? "none" : t.kind === "next" ? "8 7" : "2 6"}
                  className={t.kind === "next" ? "at-march" : undefined} style={{ stroke: t.kind === "walked" ? "var(--pl-lit)" : t.kind === "next" ? "var(--pl-clay)" : "var(--pl-ink)" }}/>
              </g>
            ))}
          </g>
        </svg>
        {places.map((p) => {
          const size = p.summit || p.state === "next" ? 30 : 24, isSel = sel && p.id === sel.id;
          return (
            <div key={p.id} className="pl-at-place" style={{ left: p.x, top: p.y }} data-place={p.id} data-state={p.state}>
              {p.state === "next" ? <>
                <span className="pl-at-beacon" aria-hidden="true"/>
                <span className="pl-at-flag" aria-hidden="true"/>
                <span className="pl-at-pole" aria-hidden="true"/>
              </> : null}
              <button type="button" className="pl-at-mk" data-s={p.state} data-summit={p.summit ? "" : undefined} aria-pressed={isSel}
                aria-label={`${p.name}, ${({ lit: "lit", next: "up next", open: "underway", later: "ahead" })[p.state]}`}
                style={p.summit ? { width: size, height: size } : { width: size, height: size, borderRadius: "50%" }}
                onClick={() => { if (!moved.current) onSelect(p.id); }}>{p.state === "lit" ? "✓" : p.summit ? "▲" : ""}</button>
              <span className="pl-at-plabel" data-sel={isSel ? "" : undefined}>{p.name}</span>
            </div>
          );
        })}
      </div>
      {c ? (
        <div className="pl-at-pcard" aria-live="polite" data-atlas-place-card="">
          <div className="pl-at-pcard__strip" style={{ background: STAGE_TINT[c.stage.id] }}><span>GRID {c.grid}</span><span>{c.stage.caps}</span></div>
          <div className="pl-at-pcard__body">
            <span className="pl-at-pcard__name">{c.name}</span>
            <span className="pl-at-pcard__checks">
              {c.checks.squares.map((on, i) => <span key={i} className="pl-at-sq pl-at-sq--16" data-s={on ? "lit" : undefined}/>)}
              <span className="pl-at-pcard__count">{c.checks.done} of {c.checks.total} checks</span>
            </span>
            <span className="pl-at-pcard__status">{c.status}</span>
            <span className="pl-at-pcard__chips"><span className="pl-at-mchip pl-at-mchip--sm">{c.notes} FIELD NOTES</span></span>
            <a className="pl-at-pcard__open" href={c.href} onClick={(e) => { if (c.onOpen && plain(e)) { e.preventDefault(); c.onOpen(); } }}>Open this place →</a>
          </div>
        </div>
      ) : null}
      <div className="pl-at-terrain__foot">
        <span className="pl-at-hint">DRAG TO EXPLORE · TAP A PLACE</span>
        <button type="button" className="pl-at-recenter" onClick={() => setOff(HOME)}>Recenter</button>
      </div>
    </div>
  );
}

/** The route line: the places in order as stops, 8 to a row, snaking; ⇄ interchanges into other regions. */
function Route({ roman, places = [], onInterchange, interchangeHref }) {
  const per = 8, rows = Math.max(1, Math.ceil(places.length / per));
  const stops = places.map((p, i) => {
    const r = Math.floor(i / per), k = i % per;
    return { ...p, x: r % 2 ? 1120 - k * 150 : 70 + k * 150, y: 80 + 220 * r, row: r };
  });
  const segs = stops.slice(1).map((b, j) => {
    const a = stops[j];
    const d = a.row !== b.row
      ? `M${a.x} ${a.y} C${a.x + (a.row % 2 ? -80 : 80)} ${a.y} ${b.x + (a.row % 2 ? -80 : 80)} ${b.y} ${b.x} ${b.y}`
      : `M${a.x} ${a.y} L${b.x} ${b.y}`;
    return { d, stage: b.stage };
  });
  const height = 210 + 220 * (rows - 1);
  return (
    <div className="pl-at-route at-in">
      <div className="pl-at-route__head">
        <span className="pl-at-route__k">THE {roman} LINE · {places.length} STOPS · LOWLANDS → SUMMIT</span>
        <span className="pl-at-route__key">
          {["start", "build", "deepen", "master"].map((s) => <span key={s} className="pl-at-route__keyi"><span className="pl-at-route__sw" style={{ background: STAGE_COLOUR[s] }}/>{STAGE_LABEL[s]}</span>)}
        </span>
      </div>
      <div className="pl-at-route__scroll" role="region" aria-label={`The ${roman} line, ${places.length} stops`} tabIndex={0}>
        <ol className="pl-at-route__line" style={{ height }}>
          <svg aria-hidden="true" width="1200" height={height} viewBox={`0 0 1200 ${height}`} className="pl-at-route__svg">
            <g fill="none" strokeLinecap="round" strokeLinejoin="round">
              {segs.map((s, i) => <g key={i}><path d={s.d} strokeWidth="16" style={{ stroke: "var(--pl-ink)" }}/><path d={s.d} strokeWidth="10" style={{ stroke: STAGE_COLOUR[s.stage] }}/></g>)}
            </g>
          </svg>
          {stops.map((p) => {
            const size = p.state === "next" || p.summit ? 34 : 26;
            return (
              <li key={p.id} className="pl-at-stop" style={{ left: p.x, top: p.y }} data-s={p.state} aria-current={p.state === "next" ? "step" : undefined}>
                <span className="pl-at-stop__dot" aria-hidden="true" style={{ width: size, height: size, borderRadius: "50%" }}>{p.state === "lit" ? "✓" : p.summit ? "▲" : ""}</span>
                <span className="pl-at-stop__label">
                  <span className="pl-at-stop__name">{p.name}</span>
                  <span className="pl-at-stop__count">{p.checks.done}/{p.checks.total}</span>
                  {p.interchange ? (
                    <a className="pl-at-ichange" href={interchangeHref?.(p.interchange)} data-region={p.interchange.region}
                      onClick={(e) => { if (onInterchange && plain(e)) { e.preventDefault(); onInterchange(p.interchange); } }}>
                      <span className="pl-at-ichange__dot" aria-hidden="true"/>⇄ {p.interchange.roman} · {p.interchange.name}</a>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

const GZ_STATUS = { lit: "lit", next: "next", open: "open", later: "later" };
/** The index: the region's gazetteer — find a place, a row opens it on the terrain. */
function Index({ roman, places = [], statusWord, onOpen }) {
  const [q, setQ] = useState("");
  const rows = [...places].sort((a, b) => (a.grid < b.grid ? -1 : 1)).filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="pl-at-index at-in">
      <div className="pl-at-index__head">
        <span className="pl-at-index__title">Gazetteer of Region {roman}</span>
        <label className="pl-at-index__find">
          <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" style={{ stroke: "var(--pl-ink)" }}><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
          <span className="pl-sr">Find a place</span>
          <input type="search" placeholder="Find a place…" value={q} onChange={(e) => setQ(e.target.value)}/>
        </label>
      </div>
      <div className="pl-at-index__box" role="region" aria-label={`Gazetteer of Region ${roman}`} tabIndex={0}>
        <div className="pl-at-index__table" role="table">
          <div className="pl-at-index__row pl-at-index__row--head" role="row">
            {["GRID", "PLACE", "ELEVATION", "CHECKS", "FIELD NOTES", "STATUS"].map((h) => <span key={h} role="columnheader">{h}</span>)}
          </div>
          {rows.map((p) => (
            <button key={p.id} type="button" className="pl-at-index__row" role="row" onClick={() => onOpen(p.id)} data-place={p.id}>
              <span role="cell" className="pl-at-index__grid">{p.grid}</span>
              <span role="cell" className="pl-at-index__name">{p.name}</span>
              <span role="cell" className="pl-at-index__stage"><span className="pl-at-index__sw" style={{ background: STAGE_COLOUR[p.stage] }}/>{STAGE_LABEL[p.stage]}</span>
              <span role="cell" className="pl-at-sqs pl-at-sqs--nowrap">{p.checks.squares.map((on, i) => <span key={i} className="pl-at-sq pl-at-sq--13" data-s={on ? "lit" : undefined}/>)}</span>
              <span role="cell" className="pl-at-index__notes">{p.notesLabel ?? (p.notes ? `${p.notes} note${p.notes === 1 ? "" : "s"}` : "—")}</span>
              <span role="cell" className="pl-at-stag" data-s={GZ_STATUS[p.state]}>{statusWord[p.state]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** The three views under binder tabs. `card(place)` → the field card's data; `initial` = a place to open on. */
export function RegionViews({ views = [], view = "terrain", onView, roman, places = [], trails = [], card, statusWord, initial, onInterchange, interchangeHref }) {
  const first = (initial && places.some((p) => p.id === initial) && initial) || places.find((p) => p.state === "next")?.id || places[0]?.id;
  const [sel, setSel] = useState(first);
  useEffect(() => { setSel(first); }, [first]);
  const keys = (e, i) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const nx = views[(i + d + views.length) % views.length];
    onView(nx.id);
    document.getElementById(`pl-at-tab-${nx.id}`)?.focus();
  };
  return (
    <div className="pl-at-views">
      <div className="pl-at-tabs" role="tablist" aria-label="How to see this region">
        {views.map((t, i) => (
          <button key={t.id} id={`pl-at-tab-${t.id}`} type="button" role="tab" className="pl-at-tab" aria-selected={view === t.id} aria-controls="pl-at-tabpanel"
            tabIndex={view === t.id ? 0 : -1} onClick={() => onView(t.id)} onKeyDown={(e) => keys(e, i)}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pl-at-tab__icon"><path d={TAB_ICONS[t.id]}/></svg>
            <span className="pl-at-tab__text"><span className="pl-at-tab__label">{t.label}</span><span className="pl-at-tab__sub">{t.sub}</span></span>
          </button>
        ))}
      </div>
      <div className="pl-at-panel" id="pl-at-tabpanel" role="tabpanel" aria-labelledby={`pl-at-tab-${view}`}>
        {view === "terrain" ? <Terrain places={places} trails={trails} selected={sel} onSelect={setSel} card={card}/> : null}
        {view === "route" ? <Route roman={roman} places={places} onInterchange={onInterchange} interchangeHref={interchangeHref}/> : null}
        {view === "index" ? <Index roman={roman} places={places} statusWord={statusWord} onOpen={(id) => { setSel(id); onView("terrain"); }}/> : null}
      </div>
    </div>
  );
}
