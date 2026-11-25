// ⭐ D199 C5 + D200 (owner 11-25, 47h) · THE POLITICAL MAP — the market's hero plate (the `Market` board): hand-drawn
// territories with organic borders (not blocks), one per sector, filled from the paper ramp; area = how many openings the
// sector holds for the bearing; hatching = the share of them that fit you strongly; capitals = the companies hiring most;
// you marked where you are, a route to your best match. Explorable: tap a territory (or its button in the legend row) =
// the Role filter (the bearing and the chips follow; tap it again, or "Back to all sectors", lifts it); + / − / ⌖ zoom and
// recenter; drag to pan when zoomed; arrow keys move along the legend row.
// ⛔ DEFECT (c) (d199PlateDrawingsTokensOnly): the drawing takes ONLY the map's own tokens (styles/plate.css --pl-map-*),
// which no theme redefines — so it is the paper ramp in every theme, never Dusk's navy on black.
// Nothing invented (R2): a sector's area comes from its count; a hatch is drawn only where its strong-fit share is known (the
// sector picked: the stats box's own STRONG FIT / FIT figures); capitals only when the page was given them; the route only
// with a best match. What isn't known is said in the side card, never drawn.
import { useCallback, useMemo, useRef, useState } from "react";

/** The five hand-drawn territories (the board's own paths, viewBox 640 × 450), largest slot first. */
export const MAP_SLOTS = Object.freeze([
  { d: "M60 120 C 80 70, 180 50, 260 60 C 300 66, 320 110, 310 160 C 300 210, 330 250, 300 300 C 270 340, 200 350, 150 340 C 100 330, 60 300, 55 250 C 50 200, 45 160, 60 120 Z",
    label: [95, 300], big: true, center: [190, 195], hatch: { x: 60, w: 260, bottom: 350, full: 298 }, capitals: [[210, 124], [108, 228]], you: [172, 192] },
  { d: "M260 60 C 330 50, 420 40, 480 60 C 520 75, 540 110, 520 150 C 500 180, 440 180, 400 175 C 360 170, 320 170, 310 160 C 320 110, 300 66, 260 60 Z",
    label: [350, 92], big: true, center: [400, 110], hatch: { x: 260, w: 280, bottom: 180, full: 135 }, capitals: [[428, 100]], you: [380, 130] },
  { d: "M400 175 C 440 180, 500 180, 520 150 C 560 170, 590 220, 580 270 C 570 310, 520 320, 480 315 C 440 310, 410 280, 400 250 C 395 220, 390 195, 400 175 Z",
    label: [436, 288], big: false, center: [490, 235], hatch: { x: 390, w: 200, bottom: 320, full: 170 }, capitals: [[504, 236]], you: [460, 210] },
  { d: "M300 300 C 330 250, 300 210, 310 160 C 320 170, 360 170, 400 175 C 390 195, 395 220, 400 250 C 410 280, 440 310, 480 315 C 470 360, 420 400, 360 405 C 310 410, 280 380, 270 350 C 265 330, 285 315, 300 300 Z",
    label: [300, 388], big: true, center: [372, 285], hatch: { x: 265, w: 215, bottom: 410, full: 250 }, capitals: [[368, 314]], you: [350, 250] },
  { d: "M150 340 C 200 350, 270 340, 300 300 C 285 315, 265 330, 270 350 C 250 385, 200 400, 165 390 C 140 380, 135 355, 150 340 Z",
    label: [150, 388], big: false, center: [218, 350], hatch: { x: 135, w: 165, bottom: 400, full: 100 }, capitals: [[210, 348]], you: [200, 360] },
]);
// Each slot's drawn share of the five (the board's example counts) — a sector whose share of the openings is smaller than its
// slot's shrinks inside it (area = openings); the board's own data draws every slot whole.
const SLOT_SHARE = (() => { const n = [4812, 2236, 1604, 1415, 588]; const t = n.reduce((a, b) => a + b, 0); return n.map((x) => x / t); })();
const W = 640, H = 450;

/** Pure: a territory's scale for its share of the five sectors' openings (√ of the share against its slot's, 0.55–1). */
export function territoryScale(n, total, slot) {
  if (!Number.isFinite(n) || !Number.isFinite(total) || total <= 0) return 0.55;
  return Math.max(0.55, Math.min(1, Math.sqrt((n / total) / SLOT_SHARE[slot])));
}

/**
 * Pure: the sectors from the facets answer's role options — one per category (the options' `group` / `groupId`), its count
 * the sum of its roles', its three largest roles kept for the side card; the five largest, largest first (one per slot).
 */
export function sectorsFromRoleOptions(options = []) {
  const by = new Map();
  for (const o of options || []) {
    if (!o?.groupId || !Number.isFinite(o.count)) continue;
    const s = by.get(o.groupId) || { id: o.groupId, name: o.group || o.groupId, n: 0, subs: [] };
    s.n += o.count;
    s.subs.push({ label: o.label, n: o.count });
    by.set(o.groupId, s);
  }
  return [...by.values()].filter((s) => s.n > 0).sort((a, b) => b.n - a.n).slice(0, MAP_SLOTS.length)
    .map((s) => ({ ...s, subs: s.subs.sort((a, b) => b.n - a.n).slice(0, 3) }));
}

/** Pure: the viewBox at a zoom step (1.4× each, as the board), centred on `at` (the picked sector) or the middle, panned. */
export function mapViewBox(zoom = 0, at = null, pan = [0, 0]) {
  const w = W / 1.4 ** zoom, h = H / 1.4 ** zoom;
  const [cx, cy] = zoom > 0 && at ? at : [W / 2, H / 2];
  return [Math.round(cx - w / 2 + (zoom > 0 ? pan[0] : 0)), Math.round(cy - h / 2 + (zoom > 0 ? pan[1] : 0)), Math.round(w), Math.round(h)].join(" ");
}

const fmt = (n) => (Number.isFinite(n) ? n.toLocaleString("en-US") : "—");

/**
 * The map. sectors = sectorsFromRoleOptions(...) (+ optional `strong` 0–1 and `capitals` [names] per sector, the fixture's
 * example data); picked = the sector id the Role filter holds; figures = the stats box's own (for the side card and the
 * picked sector's hatch); you = the slot you're marked in; best = the deck's best match; onPick(id | null).
 */
export function MarketMap({ sectors = [], picked = null, figures = {}, you = null, best = null, onPick, caption = null }) {
  const [zoom, setZoom] = useState(0);
  const [pan, setPan] = useState([0, 0]);
  const drag = useRef(null);
  const total = sectors.reduce((a, s) => a + (s.n || 0), 0);
  const pickedIdx = sectors.findIndex((s) => s.id === picked);
  const youIdx = pickedIdx >= 0 ? pickedIdx : Number.isInteger(you) ? you : null;
  const vb = mapViewBox(zoom, pickedIdx >= 0 ? MAP_SLOTS[pickedIdx].center : null, pan);
  const legendRef = useRef(null);
  const pick = useCallback((id) => { setPan([0, 0]); onPick?.(id === picked ? null : id); }, [onPick, picked]);
  const hatchShare = (s, i) => (Number.isFinite(s.strong) ? s.strong
    : i === pickedIdx && Number.isFinite(figures.strong) && Number.isFinite(figures.fit) && figures.fit > 0 ? figures.strong / figures.fit : null);
  const youAt = youIdx != null && MAP_SLOTS[youIdx] ? MAP_SLOTS[youIdx].you : null;
  const bestCap = useMemo(() => {
    if (!best?.company) return null;
    for (let i = 0; i < sectors.length; i++) {
      const k = (sectors[i].capitals || []).findIndex((c) => String(c).toLowerCase() === String(best.company).toLowerCase()
        || String(best.company).toLowerCase().startsWith(String(c).toLowerCase()));
      if (k >= 0 && MAP_SLOTS[i].capitals[k]) return MAP_SLOTS[i].capitals[k];
    }
    return null;
  }, [best, sectors]);
  const routeEnd = best && youAt ? (bestCap || [Math.min(600, youAt[0] + 160), Math.max(40, youAt[1] - 64)]) : null;
  const sec = pickedIdx >= 0 ? sectors[pickedIdx] : null;
  const label = `The market as a political map: territories sized by openings${sectors.some((s, i) => hatchShare(s, i) != null) ? ", hatched for the share that fits you strongly" : ""}${sectors.some((s) => s.capitals?.length) ? ", capitals for the companies hiring most" : ""}${youIdx != null && sectors[youIdx] ? `; you are in ${sectors[youIdx].name}` : ""}${routeEnd ? " with a route to your best match" : ""}. Tap a territory to look only there.`;
  const onKeyLegend = (e) => {
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const btns = [...(legendRef.current?.querySelectorAll("button") || [])];
    const at = btns.indexOf(document.activeElement);
    if (at < 0) return;
    e.preventDefault();
    const next = e.key === "Home" ? 0 : e.key === "End" ? btns.length - 1 : (at + (e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1) + btns.length) % btns.length;
    btns[next]?.focus();
  };
  const onDown = (e) => { if (zoom > 0) drag.current = { x: e.clientX, y: e.clientY, pan, w: e.currentTarget.getBoundingClientRect().width }; };
  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const k = (W / 1.4 ** zoom) / (d.w || W);
    setPan([d.pan[0] - (e.clientX - d.x) * k, d.pan[1] - (e.clientY - d.y) * k]);
  };
  const onUp = () => { drag.current = null; };
  return (
    <figure className="pl-polmap" data-market-map="">
      <div className="pl-polmap__frame">
        <svg role="img" aria-label={label} viewBox={vb} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="pl-polmap__svg"
          data-zoom={zoom} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
          <defs>
            <pattern id="pmHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" className="pl-polmap__hatchline"/>
            </pattern>
            {MAP_SLOTS.map((s, i) => <clipPath key={i} id={`pmClip${i}`}><path d={s.d}/></clipPath>)}
          </defs>
          <rect x="-300" y="-300" width="1240" height="1050" className="pl-polmap__ground"/>
          <g pointer-events="none" className="pl-polmap__waves">
            {Array.from({ length: 13 }, (_, k) => <path key={k} d={`M-60 ${26 + 34 * k} q 40 -6 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0`}/>)}
          </g>
          {sectors.map((s, i) => {
            const slot = MAP_SLOTS[i];
            const k = territoryScale(s.n, total, i);
            const t = k === 1 ? undefined : `translate(${slot.center[0]} ${slot.center[1]}) scale(${k.toFixed(3)}) translate(${-slot.center[0]} ${-slot.center[1]})`;
            return (
              <g key={`glow${s.id}`} transform={t} pointer-events="none">
                <path d={slot.d} className="pl-polmap__glow" data-w="16"/>
                <path d={slot.d} className="pl-polmap__glow" data-w="8"/>
              </g>
            );
          })}
          {sectors.map((s, i) => {
            const slot = MAP_SLOTS[i];
            const k = territoryScale(s.n, total, i);
            const t = k === 1 ? undefined : `translate(${slot.center[0]} ${slot.center[1]}) scale(${k.toFixed(3)}) translate(${-slot.center[0]} ${-slot.center[1]})`;
            const share = hatchShare(s, i);
            const hh = share == null ? 0 : Math.round(Math.max(0, Math.min(1, share)) * slot.hatch.full);
            return (
              <g key={s.id} transform={t} data-sector={s.id} data-area-scale={k.toFixed(3)}>
                <path className="pl-polmap__land" data-slot={i} data-on={s.id === picked ? "true" : "false"} d={slot.d}
                  onClick={() => pick(s.id)}><title>{`${s.name} · ${fmt(s.n)} openings — ${s.id === picked ? "tap to look at every sector" : "tap to look only here"}`}</title></path>
                {hh > 0 ? <rect pointer-events="none" clipPath={`url(#pmClip${i})`} x={slot.hatch.x} y={slot.hatch.bottom - hh} width={slot.hatch.w} height={hh} className="pl-polmap__hatch" data-hatch={s.id}/> : null}
              </g>
            );
          })}
          <path pointer-events="none" d="M540 340 C 570 330, 600 345, 598 375 C 595 400, 560 410, 540 395 C 525 382, 525 350, 540 340 Z" className="pl-polmap__held"/>
          <text x="500" y="425" className="pl-polmap__heldtext">HELD · NOT SURVEYED</text>
          {sectors.map((s, i) => (
            <text key={`n${s.id}`} pointer-events="none" x={MAP_SLOTS[i].label[0]} y={MAP_SLOTS[i].label[1]}
              className="pl-polmap__name" data-big={MAP_SLOTS[i].big && String(s.short || s.name).length <= 20 ? "true" : "false"}>{String(s.short || s.name).toUpperCase()}</text>
          ))}
          {sectors.flatMap((s, i) => (s.capitals || []).slice(0, MAP_SLOTS[i].capitals.length).map((c, k) => {
            const [x, y] = MAP_SLOTS[i].capitals[k];
            return (
              <g key={`c${s.id}${k}`} pointer-events="none" data-capital={c}>
                <rect x={x} y={y} width="8" height="8" className="pl-polmap__cap"/>
                <text x={x + 12} y={y + 7.5} className="pl-polmap__captext">{c}</text>
              </g>
            );
          }))}
          {routeEnd ? <path className="at-march pl-polmap__route" pointer-events="none" d={`M${youAt[0]} ${youAt[1]} C ${youAt[0] + 78} ${youAt[1] - 42}, ${routeEnd[0] - 98} ${routeEnd[1] - 14}, ${routeEnd[0]} ${routeEnd[1]}`}/> : null}
          {youAt ? (
            <g pointer-events="none" transform={`translate(${youAt[0]} ${youAt[1]})`} data-you="">
              <circle r="10" className="pl-polmap__ping"><animate attributeName="r" values="10;24" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.9;0" dur="2s" repeatCount="indefinite"/></circle>
              <circle r="9" className="pl-polmap__you"/>
            </g>
          ) : null}
          <g pointer-events="none" transform="translate(596 52)">
            <circle r="18" className="pl-polmap__compass"/><path d="M0 -14 L4 0 L0 14 L-4 0 Z" className="pl-polmap__needle"/><path d="M0 -14 L4 0 L-4 0 Z" className="pl-polmap__north"/>
          </g>
        </svg>
        <aside aria-live="polite" aria-label="The sector you picked" className="pl-polmap__card pl-hide-sm">
          <div className="pl-polmap__cardstrip" data-region-tint={sec ? pickedIdx : undefined}>
            <span className="pl-label">{sec ? "SECTOR" : "THE WHOLE MARKET"}</span>
          </div>
          <div className="pl-polmap__cardbody">
            <span className="pl-polmap__cardname">{sec ? sec.name : "All sectors"}</span>
            <div className="pl-polmap__cardstats">
              {[["OPENINGS", sec ? sec.n : figures.fit], ["NEW TODAY", figures.newToday], ["FILED H-1B", figures.filed], ["STRONG FIT", figures.strong]].map(([l, v]) => (
                <div key={l} className="pl-polmap__cardstat"><span className="pl-polmap__cardnum">{fmt(v)}</span><span className="pl-polmap__cardlab">{l}</span></div>
              ))}
            </div>
            <span className="pl-polmap__cardsubs">{sec
              ? (sec.subs?.length ? sec.subs.map((x) => `${x.label} ${fmt(x.n)}`).join(" · ") : "No roles counted inside it yet.")
              : "Tap a sector on the plate or in the row below to look only there."}</span>
            {sec ? <button type="button" className="pl-polmap__cta" onClick={() => pick(sec.id)}>Back to all sectors</button>
              : sectors[0] ? <button type="button" className="pl-polmap__cta" onClick={() => pick(sectors[0].id)}>Pick {sectors[0].name}</button> : null}
          </div>
        </aside>
        <div className="pl-polmap__zoom">
          <button type="button" aria-label="Zoom in" disabled={zoom >= 3 || undefined} onClick={() => setZoom((z) => Math.min(3, z + 1))}>+</button>
          <button type="button" aria-label="Zoom out" disabled={zoom <= 0 || undefined} onClick={() => { setZoom((z) => Math.max(0, z - 1)); if (zoom <= 1) setPan([0, 0]); }}>−</button>
          <button type="button" aria-label="Recenter the map" onClick={() => { setZoom(0); setPan([0, 0]); }}>⌖</button>
        </div>
      </div>
      <div className="pl-polmap__key">
        <span className="pl-label">AREA = OPENINGS</span>
        <span className="pl-label">▨ HATCH = STRONG FIT FOR YOU</span>
        {sectors.some((s) => s.capitals?.length) ? <span className="pl-label">■ CAPITAL = HIRES MOST</span> : null}
        {youAt ? <span className="pl-label pl-tone-clay">● YOU{routeEnd ? " · ‒ ‒ TO YOUR BEST MATCH" : ""}</span> : null}
      </div>
      <div role="group" aria-label="Sectors — tap one to filter to it" className="pl-polmap__legend" ref={legendRef} onKeyDown={onKeyLegend} data-map-legend="">
        {sectors.map((s, i) => (
          <button key={s.id} type="button" aria-pressed={s.id === picked} data-slot={i} data-sector-button={s.id} onClick={() => pick(s.id)}>
            <span aria-hidden="true" className="pl-polmap__dot" data-slot={i}/>{s.name}<span className="pl-polmap__n">{fmt(s.n)}</span>
          </button>
        ))}
      </div>
      {caption ? <figcaption className="pl-polmap__figcap">{caption}</figcaption> : null}
    </figure>
  );
}
