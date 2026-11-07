// client/src/pages/atlas/LearnWheel.jsx — ⭐ D117 C10 + C11 (revised) + C12 · THE DECK ROUND THE WHEEL (owner 10-31, final:
// "just plain lines that are only seen when zoomed in. so we can use the mouse scroll to zoom in n out when not hovering over
// the cards and to scroll when hovering over them. and rid off the clock … dont cram the cards deck too much let it use all
// the space it has"). Ported from docs/sketches/learn-circle.html; where it and the WORKLOG's C12 row differ, the row wins.
//
//   · 108 portrait cards fanned round one wheel (geometry: learnWheel.js). Zoomed out: card BACKS show progress — filled =
//     finished, half = started, outlined = not yet (C8's earned bar decides) — part names round the outside, the before /
//     after chords and the route's ink stroke inside the ring.
//   · Zooming (press a card or a part name, Esc / + / −, a pinch, or the scroll wheel ANYWHERE BUT A CARD) brings the chosen
//     card to 3 o'clock face-up — the board card's landscape face, turned upright — its neighbours fanned with depth of field.
//   · The scroll wheel OVER A CARD goes through the cards, one per notch (arrow keys and a vertical swipe too); elsewhere it
//     zooms, settling to the nearer end when the scrolling stops.
//   · NO WATCH FACE (C12): one plain thin line from the centre to the front card, seen only zoomed in. No nav buttons.
//   · Reduced motion: every move is a jump.
// The frame loop writes transforms straight to the DOM (108 cards at 60 fps would not survive a React render a frame).
import { useEffect, useMemo, useRef, useState } from "react";
import { circleState, pieceOf, partLabelLines, clampLabel } from "./learnModel.js";
import { WHEEL, wheelSlots, frameAt, easeInOut, outScale, ringPoint, angAtSlot, slotAt, labelsAsLegend, ringHeight } from "./learnWheel.js";
import "./LearnWheel.css";

const STATE_WORD = { filled: "Finished", half: "Started", open: "Not started" };
const DEFAULT_SIZE = { W: 760, H: 700 };   // the server's render, before the stage is measured

function chordD(a, b, k = 0.7) {
  const [W2, H2] = [a.cx, a.cy];
  const mx = W2 + ((a.p[0] + b.p[0]) / 2 - W2) * k, my = H2 + ((a.p[1] + b.p[1]) / 2 - H2) * k;
  return `M${a.p[0].toFixed(1)} ${a.p[1].toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${b.p[0].toFixed(1)} ${b.p[1].toFixed(1)}`;
}

function Face({ p, st, total, route }) {
  const cs = circleState(st);
  const ri = route ? route.list.indexOf(p.id) : -1;
  return (
    <div className="lwh__land" data-learn-front={p.id}>
      <div className="lwh__fhead"><span className="lwh__ficon" aria-hidden="true">{p.n}</span>
        <div><b>Part {p.partIndex} · {p.part}</b><span>{pieceOf(p, total)}</span></div></div>
      <div className="lwh__ftitle">{p.t}</div>
      <div className="lwh__fchips"><span className={`mark lwh__chipst lwh__chipst--${cs}`}>{STATE_WORD[cs]}</span>
        <span>{st.opened}/{st.toOpen} opened · {st.explained}/{st.checkpoints} explained</span></div>
      <div className="lwh__fbar" aria-hidden="true"><i style={{ width: `${st.bar}%` }} /></div>
      <div className="lwh__fmeta"><span>{(p.needs || []).length} before · {(p.opens || []).length} after{ri >= 0 ? ` · route step ${ri + 1}` : ""}</span>
        <span>open the piece ↓</span></div>
    </div>
  );
}

export default function LearnWheel({ pieces, states, sel, route = null, reduced = false, onSelect, onOpenPiece }) {
  const stageRef = useRef(null), wheelRef = useRef(null), lineRef = useRef(null);
  const spokeRefs = useRef(new Map()), cardRefs = useRef(new Map());
  const slots = useMemo(() => wheelSlots(pieces), [pieces]);
  const index = useMemo(() => new Map(pieces.map((p, i) => [p.id, i])), [pieces]);
  const byId = useMemo(() => new Map(pieces.map(p => [p.id, p])), [pieces]);
  const [size, setSize] = useState(DEFAULT_SIZE);
  const [zoomed, setZoomed] = useState(false);
  const A = useRef({ z: 0, zt: 0, f: index.get(sel) ?? 0, ft: index.get(sel) ?? 0, running: false, moved: false, wacc: 0, snap: null });
  const dimmed = useMemo(() => (route && route.id !== "all" ? new Set(pieces.filter(p => !route.list.includes(p.id)).map(p => p.id)) : null), [route, pieces]);
  const N = pieces.length;

  // ── the loop ──
  const frameRef = useRef(null);
  frameRef.current = () => {
    const a = A.current, el = stageRef.current;
    if (!el) { a.running = false; return; }
    // D178-2: in legend mode the ring is laid out above the legend (ringHeight), never under it.
    const W = el.clientWidth || size.W, H = ringHeight(W, el.clientHeight || size.H);
    if (reduced) { a.z = a.zt; a.f = a.ft; }
    else {
      a.z += (a.zt - a.z) * 0.15; a.f += (a.ft - a.f) * 0.24;
      if (Math.abs(a.zt - a.z) < 0.002) a.z = a.zt;
      if (Math.abs(a.ft - a.f) < 0.002) a.f = a.ft;
    }
    const e = easeInOut(a.z);
    const fr = frameAt({ W, H, e, f: a.f, pieces, slots, dimmed });
    if (wheelRef.current) wheelRef.current.style.transform = `translate(${fr.wheel.x}px,${fr.wheel.y}px) scale(${fr.wheel.scale}) rotate(${fr.wheel.rot}deg)`;
    for (const c of fr.cards) {
      const sp = spokeRefs.current.get(c.id), cd = cardRefs.current.get(c.id);
      if (sp) { sp.style.transform = `rotate(${c.ang}deg)`; sp.style.zIndex = String(c.z); }
      if (cd) { cd.style.opacity = String(c.op); cd.style.filter = c.blur > 0.05 ? `blur(${c.blur.toFixed(1)}px)` : "none"; cd.style.pointerEvents = c.op > 0.05 ? "" : "none"; }
    }
    if (lineRef.current) { lineRef.current.style.transform = `rotate(${fr.base}deg)`; lineRef.current.style.opacity = (e * 0.7).toFixed(2); }
    const z = a.z > 0.5;
    setZoomed(prev => (prev === z ? prev : z));
    if (a.z !== a.zt || a.f !== a.ft) requestAnimationFrame(() => frameRef.current());
    else a.running = false;
  };
  const kick = () => { const a = A.current; if (!a.running) { a.running = true; requestAnimationFrame(() => frameRef.current()); } };

  // The selection comes from the page (the panel, the routes, an entry): the deck turns the short way to it.
  useEffect(() => {
    const n = index.get(sel);
    if (n == null) return;
    const a = A.current; let best = n;
    for (const k of [n - N, n, n + N]) if (Math.abs(k - a.ft) < Math.abs(best - a.ft)) best = k;
    a.ft = best; kick();
  }, [sel, index, N]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const measure = () => { setSize({ W: el.clientWidth, H: el.clientHeight }); kick(); };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const zoomTo = (id) => { if (id) onSelect?.(id); A.current.zt = 1; kick(); };
  const zoomOut = () => { A.current.zt = 0; kick(); };
  const turn = (dir) => { const n = index.get(sel) ?? 0; onSelect?.(pieces[((n + dir) % N + N) % N].id); };

  // ── input: the wheel (non-passive, so it can stop the page scrolling), the keys, swipe and pinch ──
  const turnRef = useRef(turn); turnRef.current = turn;
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const onWheel = (ev) => {
      ev.preventDefault();
      const a = A.current;
      if (!(ev.target?.closest && ev.target.closest(".lwh__card"))) {
        a.zt = Math.max(0, Math.min(1, a.zt - ev.deltaY * 0.0025)); kick();
        clearTimeout(a.snap);
        a.snap = setTimeout(() => { a.zt = a.zt > 0.5 ? 1 : 0; kick(); }, 240);
        return;
      }
      a.wacc += Math.abs(ev.deltaY) >= Math.abs(ev.deltaX) ? ev.deltaY : ev.deltaX;
      while (Math.abs(a.wacc) >= 60) { const k = a.wacc > 0 ? 1 : -1; a.wacc -= k * 60; turnRef.current(k); }
    };
    const pts = new Map(); let y0 = null, pinch0 = null;
    const down = (ev) => { pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY }); y0 = ev.clientY; A.current.moved = false;
      if (pts.size === 2) { const [p, q] = [...pts.values()]; pinch0 = { d: Math.hypot(p.x - q.x, p.y - q.y), z: A.current.zt }; } };
    const move = (ev) => { if (!pts.has(ev.pointerId)) return; pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (y0 != null && Math.abs(ev.clientY - y0) > 8) A.current.moved = true;
      if (pts.size === 2 && pinch0) { const [p, q] = [...pts.values()]; A.current.zt = Math.max(0, Math.min(1, pinch0.z + (Math.hypot(p.x - q.x, p.y - q.y) - pinch0.d) / 250)); kick(); } };
    const up = (ev) => {
      if (pts.size < 2 && y0 != null && Math.abs(ev.clientY - y0) > 45 && !pinch0) turnRef.current(ev.clientY < y0 ? 1 : -1);
      if (pinch0 && pts.size <= 2) { A.current.zt = A.current.zt > 0.5 ? 1 : 0; kick(); pinch0 = null; }
      pts.delete(ev.pointerId); y0 = null; setTimeout(() => { A.current.moved = false; }, 0);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", down); el.addEventListener("pointermove", move); el.addEventListener("pointerup", up);
    return () => { el.removeEventListener("wheel", onWheel); el.removeEventListener("pointerdown", down); el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onKey = (ev) => {
    if (/INPUT|TEXTAREA/.test(ev.target?.tagName || "")) return;
    if (ev.key === "ArrowDown" || ev.key === "ArrowRight") { ev.preventDefault(); turn(1); }
    else if (ev.key === "ArrowUp" || ev.key === "ArrowLeft") { ev.preventDefault(); turn(-1); }
    else if (ev.key === "+" || ev.key === "=") zoomTo(sel);
    else if (ev.key === "-" || ev.key === "Escape") zoomOut();
  };
  const press = (id) => {
    if (A.current.moved) return;
    if (!zoomed) zoomTo(id);
    else if (sel !== id) onSelect?.(id);
    else onOpenPiece?.();
  };

  // ── the zoomed-out overlay: part names, chords, the route's ink ──
  const W = size.W, H = ringHeight(size.W, size.H);
  const s0 = outScale(W, H), rOut = (WHEEL.R + WHEEL.CH) * s0 + 24, rIn = WHEEL.R * s0;
  const parts = useMemo(() => {
    const out = [];
    for (const p of pieces) { if (!out.length || out[out.length - 1].index !== p.partIndex) out.push({ index: p.partIndex, t: p.part, ids: [] }); out[out.length - 1].ids.push(p.id); }
    return out;
  }, [pieces]);
  const pt = (id, r) => ({ p: ringPoint(id, slots, W, H, r), cx: W / 2, cy: H / 2 });
  const s = byId.get(sel);
  const routePath = route && route.id !== "all" && route.list.length > 1
    ? route.list.map((id, i) => {
        const p = ringPoint(id, slots, W, H, rIn - 14);
        if (!i) return `M${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
        return chordD(pt(route.list[i - 1], rIn - 14), { p, cx: W / 2, cy: H / 2 }, 0.55).replace(/^M[^Q]+/, "");
      }).join(" ")
    : null;

  return (
    <div className={`lwh${zoomed ? " is-zoomed" : ""}`} ref={stageRef} tabIndex={0} onKeyDown={onKey}
      role="group" aria-label={`The course: ${N} cards in one circle`} data-learn-circle="" data-learn-wheel="">
      <svg className="lwh__chords" viewBox={`0 0 ${W} ${H}`} style={{ height: `${H}px` }} aria-hidden="true">
        {routePath && <path d={routePath} className="lrc__ink" data-learn-route-stroke={route.id} />}
        {s && (s.needs || []).filter(n => byId.has(n.id)).map(n => (
          <path key={`b-${n.id}`} d={chordD(pt(n.id, rIn - 6), pt(s.id, rIn - 6))} className={`lrc__chord lrc__chord--before${n.status === "drafted" ? " is-draft" : ""}`} data-chord-before={n.id} />
        ))}
        {s && (s.opens || []).filter(id => byId.has(id)).map(id => (
          <path key={`a-${id}`} d={chordD(pt(s.id, rIn - 6), pt(id, rIn - 6))} className="lrc__chord lrc__chord--after" data-chord-after={id} />
        ))}
      </svg>
      <div className="lwh__wheel" ref={wheelRef}>
        <div className="lwh__line" ref={lineRef} aria-hidden="true" />
        {pieces.map(p => {
          const st = states.get(p.id), cs = circleState(st), front = zoomed && sel === p.id;
          const ri = route ? route.list.indexOf(p.id) : -1;
          const a0 = angAtSlot(slots.slot.get(p.id), slots.total);
          return (
            <div key={p.id} className="lwh__spoke" style={{ transform: `rotate(${a0}deg)` }} ref={el => { if (el) spokeRefs.current.set(p.id, el); }}>
              <div className={`lwh__card lwh__card--${cs} lrc__part--${p.partIndex}${front ? " is-front" : ""}`} style={{ top: `${-(WHEEL.R + WHEEL.CH)}px` }}
                ref={el => { if (el) cardRefs.current.set(p.id, el); }}
                role="button" tabIndex={front ? 0 : -1} aria-label={`${p.t}, piece ${p.n} of ${N}, ${STATE_WORD[cs].toLowerCase()}`}
                aria-pressed={sel === p.id} data-learn-piece={p.id} data-state={cs}
                onClick={() => press(p.id)} onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); press(p.id); } }}>
                <div className="lwh__back"><span className="lwh__num">{p.n}</span>{ri >= 0 && <span className="lwh__rno">{ri + 1}</span>}</div>
                {front && <div className="lwh__face"><Face p={p} st={st} total={N} route={route} /></div>}
              </div>
            </div>
          );
        })}
      </div>
      <div className={`lwh__labels${labelsAsLegend(W) ? " lwh__labels--legend" : ""}`} data-labels-as={labelsAsLegend(W) ? "legend" : "ring"}>
        {parts.map(part => {
          const a0 = angAtSlot(slots.slot.get(part.ids[0]), slots.total), a1 = angAtSlot(slots.slot.get(part.ids[part.ids.length - 1]), slots.total);
          const am = ((a0 + a1) / 2) * Math.PI / 180 - Math.PI / 2;
          const done = part.ids.filter(id => states.get(id)?.complete).length;
          const first = part.ids.find(id => !states.get(id)?.complete) || part.ids[0];
          // ⭐ D178-2: wrapped, and its box kept inside the wheel — a label is never cropped at an edge.
          const lines = partLabelLines(part.index, part.t);
          const at = clampLabel(W / 2 + rOut * Math.cos(am), H / 2 + rOut * Math.sin(am), lines, W, H);
          return (
            // The NAME is the press (zoom to the part's first unfinished piece); the count is a plain line beside it —
            // ⛔ C8: nothing pressable says "finished".
            <div key={part.index} className={`lwh__plab lrc__part--${part.index}`} data-learn-part={part.index}
              style={labelsAsLegend(W) ? undefined : { left: `${at.x.toFixed(1)}px`, top: `${at.y.toFixed(1)}px` }}>
              <button type="button" className="lwh__pbtn" onClick={() => zoomTo(first)} tabIndex={zoomed ? -1 : 0}>{lines.map((l, i) => <span key={i} className="lwh__pline">{l}</span>)}</button>
              <small>{done} of {part.ids.length} finished</small>
            </div>
          );
        })}
      </div>
      <span className="lwh__hint">{zoomed ? "Scroll over the cards to go through them · scroll anywhere else to zoom out"
        : "Scroll over the cards to go through them · scroll anywhere else to zoom in · or press a card or a part"}</span>
    </div>
  );
}

/** For the tests: where the deck sits for a given selection (a whole card index). */
export const deckIndexOf = (pieces, id) => pieces.findIndex(p => p.id === id);
export { slotAt };
