// ⭐ D116 · THE TREE (owner 10-31: "alright approved") — Your map, a role page's map and a family page's map, one
// component with a different centre (M7). A radial branching tree in plain SVG (M9: no WebGL): the centre is You (or
// the role / the family); each family a branch; a skill you don't have hangs off the skill of yours in its family it is
// most asked with; distance = closeness; size = postings; coloured in the family's colour = you have it, grey = not
// yet; one ring — green have · orange rises toward senior · blue other — drawn as a progress arc while learning (M8).
// Press a skill → its branch back to the centre lights, dashed links to the other skills of yours it is asked with, the
// view flies to it, the side panel shows the owner's three facts (M5, the server's sentences); press a family tag →
// the family's list beside the map, a row flies to its skill and offers ← Back to the list. Waypoints and Fly my route
// travel; drag / wheel / pinch / + − / ⤢; Escape or the centre = everything. Reduced motion: jumps, no pulse, no unlock
// animation (M10). Every node a real button in the family's list order; the side list is the full text alternative.
// Layout and rules: atlasTreeLayout.js (M2) · atlasTreeModel.js. Colours: AtlasTree.css (tokens only; no pills, D60).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import DepthButton from "../../components/DepthButton.jsx";
import { layoutTree, fitView, viewFor, flight, ease, between, zoomAt, curve, GEOM } from "./atlasTreeLayout.js";
import {
  ariaFor, rowLine, familyList, tabOrder, waypoints, tourOrder, flyRouteLabel, selectionView, newlyLearned, learnedNow,
  LEARNED_KEY, progressArc, familyLabel,
} from "./atlasTreeModel.js";
import "./AtlasTree.css";

const reducedMotion = () => {
  try { return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
};
const vb = (v) => `${v.x} ${v.y} ${v.w} ${v.h}`;

function NodeSquare({ n, p, page, cls, unlocking, onChoose }) {
  const w = p.size;
  const right = Math.cos(p.a) >= -0.15;
  const lx = p.x + (right ? w / 2 + 9 : -w / 2 - 9);
  const arc = n.state === "learning" ? progressArc(n) : null;
  const coloured = n.have || n.learned;
  const ring = n.ring || "none";
  return (
    <g className={`atree__nd atree__nd--${n.state}${cls}${unlocking ? " atree__nd--unlock" : ""}`} role="button" tabIndex={0}
      aria-label={ariaFor(n, page)} data-tree-node={n.slug} data-ring={ring} data-state={n.state}
      onClick={(e) => { e.stopPropagation(); onChoose(n.slug); }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onChoose(n.slug); } }}>
      {ring !== "none" && (
        <rect className={`atree__ring atree__ring--${ring}`} x={p.x - w / 2 - 4} y={p.y - w / 2 - 4} width={w + 8} height={w + 8} rx={w * 0.36}
          {...(arc != null ? { pathLength: 100, strokeDasharray: `${arc} 100`, "data-arc": arc } : {})} />
      )}
      <rect className={`atree__sq ${coloured ? `atree__sq--${n.family}` : "atree__sq--off"}`} x={p.x - w / 2} y={p.y - w / 2} width={w} height={w} rx={w * 0.3} />
      <rect className="atree__gloss" x={p.x - w / 2} y={p.y - w / 2} width={w} height={w * 0.45} rx={w * 0.3} />
      <text className={`atree__nm${coloured || page !== "you" ? "" : " atree__nm--off"}`} x={lx} y={p.y + 1} textAnchor={right ? "start" : "end"}>{n.name}</text>
      <text className="atree__sub" x={lx} y={p.y + 14} textAnchor={right ? "start" : "end"}>{n.sub}</text>
    </g>
  );
}

function ListRows({ items, page, onChoose, onHover }) {
  return (
    <div className="atree__flist" data-tree-list="">
      {items.map(n => (
        <button key={n.slug} type="button" className="dbx-depth atree__frow" data-tree-row={n.slug}
          onClick={() => onChoose(n.slug)} onMouseEnter={() => onHover?.(n.slug)} onMouseLeave={() => onHover?.(null)}>
          <span className={`atree__fsq ${n.have || n.learned ? `atree__sq--${n.family}` : "atree__sq--off"} atree__fsq--${n.ring || "none"}`} aria-hidden="true">{n.name.charAt(0)}</span>
          <span><span className="atree__fn">{n.name}</span><span className="atree__fs">{rowLine(n, page)}</span></span>
        </button>
      ))}
    </div>
  );
}

/** The side panel (exported for its test): a family's list, a node's facts, ← Back to the list. */
export function SidePanel({ tree, page, base, state, onChoose, onFamily, onHover }) {
  const { sel, focusFam, special, lastFam } = state;
  const bySlug = new Map(tree.nodes.map(n => [n.slug, n]));
  const aim = tree.user?.aim;
  if (special === "risers") {
    const r = tree.nodes.filter(n => n.rises).sort((a, b) => b.rise - a.rise);
    return (<>
      <div className="atree__k atree__k--rises">Toward senior</div>
      <h2 className="atree__h2">What seniority adds{aim ? ` for ${aim.name}` : ""}</h2>
      {r.length ? <ListRows items={r} page={page} onChoose={onChoose} onHover={onHover} /> : <p className="atree__quiet">Nothing on the tree rises by enough from mid to senior yet.</p>}
    </>);
  }
  if (special === "have") {
    const mine = tree.nodes.filter(n => n.have || n.learned).sort((a, b) => b.postings - a.postings);
    return (<><div className="atree__k atree__k--have">Your skills</div><h2 className="atree__h2">From your résumé</h2>
      <ListRows items={mine} page={page} onChoose={onChoose} onHover={onHover} /></>);
  }
  if (!sel && focusFam) {
    const items = familyList(tree, focusFam);
    const f = tree.families.find(x => x.key === focusFam);
    return (
      <div data-tree-family-list={focusFam}>
        <div className={`atree__k atree__k--${focusFam}`}>Family</div>
        <h2 className="atree__h2">{f?.name}</h2>
        <p className="atree__quiet">You have <b>{(f?.haveCount ?? 0) + (f?.learnedCount ?? 0)} of {f?.total ?? items.length}</b>{f?.learnedCount ? ` (${f.learnedCount} learned)` : ""}. Yours first, then closest to furthest.{f?.more ? ` ${f.more} are in this list only (+${f.more} more).` : ""}</p>
        <ListRows items={items} page={page} onChoose={onChoose} onHover={onHover} />
        {page !== "family" && <div className="atree__acts"><Link className="dbx-depth atree__btn" to={`${base}/family/${encodeURIComponent(focusFam)}`} data-tree-family-page="">The {f?.name} family's page</Link></div>}
      </div>
    );
  }
  if (!sel) {
    if (page === "role") return (<>
      <div className="atree__k">Role · {tree.centre.postings} open postings</div><h2 className="atree__h2">{tree.centre.name}</h2>
      {tree.cover && <div className="atree__fact" data-tree-cover=""><h4>You cover</h4><p>{tree.cover.line}.</p></div>}
      <div className="atree__fact"><p>Closer to the centre = asked for in more of this role's postings.{tree.signedIn ? " Coloured = you have it." : ""}</p></div>
    </>);
    if (page === "family") return (<>
      <div className="atree__k">Family</div><h2 className="atree__h2">{tree.centre.name}</h2>
      <div className="atree__fact"><p>Closer to the centre = asked for in more of the {tree.centre.postings} postings that ask for any {tree.centre.name} skill.{tree.signedIn ? " Coloured = you have it." : ""}</p></div>
      {tree.more?.length > 0 && <p className="atree__quiet">And {tree.more.length} more: {tree.more.map(m => m.name).join(", ")}.</p>}
    </>);
    return (<>
      <div className="atree__k">Reading the tree</div><h2 className="atree__h2">Your skills, branching out</h2>
      <div className="atree__fact"><p>Each family is a branch from you. <b>Coloured</b> squares are skills you have; <b>grey</b> ones you don't yet. The further out a square sits, the further it is from what you know. Size is how many postings ask for it; an orange ring means it rises toward senior.</p></div>
      <div className="atree__fact"><p>Press a skill to light its branch back to you, or a family to list it here. <b>Fly my route</b> travels the steps in order.</p></div>
    </>);
  }
  const n = bySlug.get(sel);
  if (!n) return null;
  const back = lastFam && n.family === lastFam
    ? <button type="button" className="atree__back" data-tree-back="" onClick={() => onFamily(lastFam)}>← Back to the {familyLabel(lastFam)} list</button> : null;
  const notDrawn = !n.onTree ? <p className="atree__quiet">In the {familyLabel(n.family)} list; not drawn on the tree.</p> : null;
  const page$ = `${base}/${encodeURIComponent(n.slug)}`;
  if (page !== "you") {
    return (<>{back}
      <div className={`atree__k atree__k--${n.ring || "none"}`}>{tree.signedIn ? (n.have ? "You have" : "You don't yet") : "Skill"} · {familyLabel(n.family)}</div>
      <h2 className="atree__h2">{n.name}</h2>
      <div className="atree__fact"><h4>{page === "role" ? "In this role's postings" : "In this family's postings"}</h4>
        <p><b>{n.share} %</b> of them ask for it · {n.postings} postings across the board.</p></div>
      <div className="atree__acts"><Link className="dbx-depth atree__btn"to={page$}>Its page</Link></div>
    </>);
  }
  if (n.have) {
    return (<>{back}
      <div className="atree__k atree__k--have">You have · {familyLabel(n.family)}</div><h2 className="atree__h2">{n.name}</h2>{notDrawn}
      <div className="atree__fact" data-tree-fact="postings"><h4>Postings</h4><p>{n.facts.postings}.</p></div>
      {n.facts.opensToward.length > 0 && <div className="atree__fact" data-tree-fact="opens"><h4>It opens toward</h4>
        <p>{n.facts.opensToward.map((o, i) => <span key={o.slug}>{i ? ", " : ""}<button type="button" className="atree__inline" onClick={() => onChoose(o.slug)}>{o.name}</button></span>)}</p></div>}
      <div className="atree__acts"><Link className="dbx-depth atree__btn"to={page$}>Its page</Link></div>
    </>);
  }
  const f = n.facts;
  return (<>{back}
    <div className={`atree__k atree__k--${n.ring}`}>{n.learned ? "Learned in the course" : n.rises ? "Rises toward senior" : "A skill near you"} · {familyLabel(n.family)}</div>
    <h2 className="atree__h2">{n.name}</h2>{notDrawn}
    {f.closeness && <div className="atree__fact" data-tree-fact="closeness"><h4>Postings, and how close</h4><p>{f.closeness}</p></div>}
    <div className="atree__fact" data-tree-fact="slope">
      <h4>Mid → senior{aim ? `, ${aim.name}` : ""}</h4>
      {f.slope ? (<>
        <p>{f.slope}{n.rises ? " One of the things seniority adds." : ""}</p>
        <div className="atree__slope" aria-hidden="true"><span>mid</span>
          <span className="atree__track"><i style={{ left: `${n.midShare}%`, width: `${Math.max(1, n.rise)}%` }} /><u style={{ left: `${n.midShare}%` }} /></span><span>senior</span></div>
      </>) : tree.noAim ? (
        <p data-tree-no-aim="">{tree.noAim.line}. <Link className="atree__link" to={tree.noAim.path}>{tree.noAim.label}</Link></p>
      ) : <p className="atree__quiet">Not enough postings read at mid and senior to say.</p>}
    </div>
    {(f.route || tree.noAim) && <div className="atree__fact" data-tree-fact="route"><h4>Your route{aim ? ` to senior ${aim.name}` : ""}</h4>
      <p>{f.route || (tree.noAim ? tree.noAim.line + "." : "")}</p></div>}
    {f.progress && <div className="atree__fact" data-tree-fact="progress"><h4>In the course</h4><p>{f.progress}.</p></div>}
    <div className="atree__acts">
      {n.courseStep && <Link className="dbx-depth atree__btn atree__btn--p" to={`${base}/learn#step-${encodeURIComponent(n.courseStep.stepId)}`} data-tree-course="">Enter the course: {n.courseStep.title}</Link>}
      <Link className="dbx-depth atree__btn"to={page$}>Jobs that ask for it</Link>
      {/* ⛔ M8 honesty: learned is never on the Profile by itself — the user adds it, on the Profile. */}
      {f.addToProfile && <Link className="dbx-depth atree__btn"to="/app/profile" data-tree-add-profile="">{f.addToProfile}</Link>}
    </div>
  </>);
}

/**
 * @param tree the server's tree · base the Atlas mount (/atlas or /app/atlas) · request { slug, n } a chip's "open on the
 * tree" (n changes per press)
 */
export default function AtlasTree({ tree, base = "/atlas", request = null }) {
  const page = tree.page || "you";
  const layout = useMemo(() => layoutTree(tree), [tree]);
  const bySlug = useMemo(() => new Map(tree.nodes.map(n => [n.slug, n])), [tree]);
  const order = useMemo(() => tabOrder(tree), [tree]);
  const [state, setState] = useState({ sel: null, focusFam: null, special: null, lastFam: null });
  const [hover, setHover] = useState(null);
  const [touring, setTouring] = useState(false);
  const [unlocking, setUnlocking] = useState(() => new Set());
  const stageRef = useRef(null), svgRef = useRef(null), viewRef = useRef(fitView(layout, 1.6)), animRef = useRef(null), tourRef = useRef(null);
  const reduced = useMemo(reducedMotion, []);

  const aspect = () => { const r = stageRef.current?.getBoundingClientRect(); return r && r.height ? r.width / r.height : 1.6; };
  const apply = (v) => { viewRef.current = v; svgRef.current?.setAttribute("viewBox", vb(v)); };
  const fly = useCallback((target, ms) => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const T = viewFor(target, layout, tree, aspect());
    const f = flight(reduced, ms);
    if (f.jump || typeof requestAnimationFrame === "undefined") { apply(T); return; }
    const S = viewRef.current, t0 = performance.now();
    const step = (now) => { const t = Math.min(1, (now - t0) / f.ms); apply(between(S, T, ease(t))); if (t < 1) animRef.current = requestAnimationFrame(step); };
    animRef.current = requestAnimationFrame(step);
  }, [layout, tree, reduced]);

  const stopTour = useCallback(() => { if (tourRef.current) clearTimeout(tourRef.current); tourRef.current = null; setTouring(false); }, []);
  const choose = useCallback((slug, { keepTour = false } = {}) => {
    if (!keepTour) stopTour();
    setState(s => ({ ...s, sel: slug, special: null, focusFam: null }));
    if (slug) fly({ kind: "node", slug });
  }, [fly, stopTour]);
  const goFamily = useCallback((key) => {
    stopTour();
    setState(s => ({ ...s, sel: null, special: null, focusFam: key, lastFam: key }));
    fly({ kind: "family", key });
  }, [fly, stopTour]);
  const home = useCallback(() => { stopTour(); setState(s => ({ ...s, sel: null, special: null, focusFam: null })); fly({ kind: "fit" }); }, [fly, stopTour]);
  const tour = () => {
    stopTour();
    const r = tourOrder(tree);
    if (!r.length) return;
    setTouring(true);
    let i = 0;
    const next = () => {
      if (i >= r.length) { stopTour(); return; }
      choose(r[i++], { keepTour: true });
      tourRef.current = setTimeout(next, reduced ? GEOM.TOUR_MS_REDUCED : GEOM.TOUR_MS);
    };
    next();
  };
  const goWaypoint = (w) => {
    stopTour();
    if (w.target.kind === "family") return goFamily(w.target.key);
    if (w.target.kind === "node") return choose(w.target.slug);
    setState(s => ({ ...s, sel: null, focusFam: null, special: w.special || null }));
    fly(w.target);
  };

  // The stage's size decides the first view; a resize re-fits.
  useLayoutEffect(() => { apply(fitView(layout, aspect())); }, [layout]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onResize = () => apply(fitView(layout, aspect()));
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); if (animRef.current) cancelAnimationFrame(animRef.current); if (tourRef.current) clearTimeout(tourRef.current); };
  }, [layout]);   // eslint-disable-line react-hooks/exhaustive-deps
  // A chip below the map opens the same node on the tree.
  useEffect(() => { if (request?.slug && bySlug.has(request.slug)) choose(request.slug); }, [request]);   // eslint-disable-line react-hooks/exhaustive-deps
  // ⭐ M8 · the unlock plays once for a node that became learned since this browser last drew the tree.
  useEffect(() => {
    if (page !== "you") return;
    let before = null;
    try { before = JSON.parse(localStorage.getItem(LEARNED_KEY) || "null"); } catch { before = null; }
    const fresh = newlyLearned(tree, before);
    if (fresh.length && !reduced) setUnlocking(new Set(fresh));
    try { localStorage.setItem(LEARNED_KEY, JSON.stringify(learnedNow(tree))); } catch { /* private mode: no unlock memory */ }
  }, [tree, page, reduced]);

  // Drag to pan, wheel / pinch to zoom.
  const ptrs = useRef(new Map()), last = useRef(null), moved = useRef(false), pinch = useRef(null);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      apply(zoomAt(viewRef.current, layout, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, Math.exp(-e.deltaY * 0.0015)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [layout]);   // eslint-disable-line react-hooks/exhaustive-deps
  const onPointerDown = (e) => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
    if (ptrs.current.size === 1) last.current = { x: e.clientX, y: e.clientY };
    if (ptrs.current.size === 2) { const [a, b] = [...ptrs.current.values()]; pinch.current = Math.hypot(a.x - b.x, a.y - b.y); }
  };
  const onPointerMove = (e) => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = stageRef.current.getBoundingClientRect(), v = viewRef.current;
    if (ptrs.current.size === 2 && pinch.current) {
      const [a, b] = [...ptrs.current.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      apply(zoomAt(v, layout, ((a.x + b.x) / 2 - r.left) / r.width, ((a.y + b.y) / 2 - r.top) / r.height, d / pinch.current));
      pinch.current = d; moved.current = true; return;
    }
    if (!last.current) return;
    const dx = e.clientX - last.current.x, dy = e.clientY - last.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 3 || moved.current) {
      moved.current = true;
      apply({ ...v, x: v.x - (dx / r.width) * v.w, y: v.y - (dy / r.height) * v.h });
      last.current = { x: e.clientX, y: e.clientY };
    }
  };
  const onPointerUp = (e) => { ptrs.current.delete(e.pointerId); if (ptrs.current.size < 2) pinch.current = null; if (!ptrs.current.size) last.current = null; };
  const pick = (slug) => { if (!moved.current) choose(slug); };
  const zoomBy = (f) => apply(zoomAt(viewRef.current, layout, 0.5, 0.5, f));

  const view = selectionView(tree, layout, state);
  const wps = waypoints(tree);
  const tagText = (f) => (page === "you" ? f.tag : `${f.name.toUpperCase()} · ${tree.signedIn ? `you have ${f.haveCount} of ${f.total}` : `${f.total} skill${f.total === 1 ? "" : "s"}`}`);
  const centre = page === "you" ? ["You"] : String(tree.centre?.name || "").split(" ");

  return (
    <div className={`atree atree--${page}${reduced ? " atree--still" : ""}`} data-tree-page={page}>
      <div className="atree__waypts" role="group" aria-label="Travel on the tree">
        {wps.map(w => (
          <DepthButton key={w.id} size="compact" className={`atree__wp${w.family ? ` atree__wp--${w.family}` : ""}`} data-waypoint={w.id} onClick={() => goWaypoint(w)}>{w.label}</DepthButton>
        ))}
        {page === "you" && tree.route?.length > 0 && (
          <DepthButton size="compact" primary={!touring} className="atree__wp" data-waypoint="tour"
            onClick={() => (touring ? stopTour() : tour())}>{touring ? "Stop" : flyRouteLabel(tree)}</DepthButton>
        )}
      </div>
      <div className="atree__top">
        <div className="atree__stage" ref={stageRef} tabIndex={0} aria-label="The tree. Drag to move, scroll or pinch to zoom. Escape shows everything."
          onKeyDown={(e) => { if (e.key === "Escape") home(); }}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          <svg ref={svgRef} viewBox={vb(viewRef.current)} role="group" aria-label={page === "you" ? "Your skills as a tree" : `${tree.centre?.name} as a tree`}>
            <g aria-hidden="true">
              {layout.bands.map(([r, label]) => (
                <g key={label}><circle className="atree__band" cx="0" cy="0" r={r} /><text className="atree__bandl" x="6" y={-r - 6}>{label}</text></g>
              ))}
            </g>
            <g aria-hidden="true">
              {layout.edges.map(e => (
                <path key={e.id} d={e.d} data-edge={e.id}
                  className={`atree__br${e.trunk ? ` atree__br--trunk atree__br--${e.family}` : ""}${view.hotEdges.has(e.id) ? " atree__br--hot" : view.dimEdge(e) ? " atree__br--dim" : ""}`} />
              ))}
              {view.links.map(h => { const a = layout.pos.get(h), b = layout.pos.get(state.sel); return <path key={h} className="atree__lk" data-link={h} d={curve([a.x, a.y], [b.x, b.y])} />; })}
            </g>
            <g>
              {order.map(slug => (
                <NodeSquare key={slug} n={bySlug.get(slug)} p={layout.pos.get(slug)} page={page} unlocking={unlocking.has(slug)} onChoose={pick}
                  cls={`${slug === state.sel || slug === hover ? " atree__nd--sel" : ""}${view.dimNode(slug) ? " atree__nd--dim" : ""}`} />
              ))}
              <g className="atree__centre" role="button" tabIndex={0} aria-label={page === "you" ? "You — show everything" : `${tree.centre?.name} — show everything`}
                data-tree-centre="" onClick={(e) => { e.stopPropagation(); home(); }} onKeyDown={(e) => { if (e.key === "Enter") home(); }}>
                <rect className={`atree__csq atree__csq--${page}${page === "family" ? ` atree__sq--${tree.centre.key}` : ""}`} x={-GEOM.CENTRE / 2} y={-GEOM.CENTRE / 2} width={GEOM.CENTRE} height={GEOM.CENTRE} rx="22" />
                {centre.length === 1
                  ? <text className={`atree__ct atree__ct--${page}`} x="0" y="6" textAnchor="middle">{centre[0]}</text>
                  : (<><text className={`atree__ct atree__ct--${page} atree__ct--small`} x="0" y="0" textAnchor="middle">{centre[0]}</text>
                    <text className={`atree__ct atree__ct--${page} atree__ct--small`} x="0" y="15" textAnchor="middle">{centre.slice(1).join(" ")}</text></>)}
              </g>
            </g>
            <g>
              {layout.tags.map(t => {
                const f = tree.families.find(x => x.key === t.key);
                const text = tagText(f), w = text.length * 7.2 + 22;
                return (
                  <g key={t.key} className="atree__tag" role="button" tabIndex={0} aria-label={`${f.name} family — ${text}`} data-tree-tag={t.key}
                    onClick={(e) => { e.stopPropagation(); goFamily(t.key); }} onKeyDown={(e) => { if (e.key === "Enter") goFamily(t.key); }}>
                    <g className="atree__pulse">
                      <rect className={`atree__sq--${t.key}`} x={t.x - w / 2} y={t.y - 14} width={w} height="28" rx="9" />
                      <text className="atree__tagt" x={t.x} y={t.y + 4.5} textAnchor="middle">{text}</text>
                    </g>
                  </g>
                );
              })}
            </g>
          </svg>
          <div className="atree__zoom">
            <DepthButton size="compact" onClick={() => zoomBy(1.4)} aria-label="Zoom in">+</DepthButton>
            <DepthButton size="compact" onClick={() => zoomBy(1 / 1.4)} aria-label="Zoom out">−</DepthButton>
            <DepthButton size="compact" onClick={home} aria-label="Show everything">⤢</DepthButton>
          </div>
          <span className="atree__hint">Drag to move · scroll or pinch to zoom</span>
        </div>
        <aside className="atree__side" aria-live="polite" data-tree-side="">
          <SidePanel tree={tree} page={page} base={base} state={state} onChoose={choose} onFamily={goFamily} onHover={setHover} />
        </aside>
      </div>
      <div className="atree__legend">
        <span><span className="atree__sw atree__sq--ml" />Coloured: {page === "you" ? "you have it" : tree.signedIn ? "you have it" : "the family's colour"}</span>
        {(page === "you" || tree.signedIn) && <span><span className="atree__sw atree__sq--off" />Grey: you don't yet</span>}
        {(page === "you" || tree.signedIn) && <span><span className="atree__sw atree__sw--rises" />Orange ring: rises toward senior</span>}
        {(page === "you" || tree.signedIn) && <span><span className="atree__sw atree__sw--other" />Blue ring: {page === "you" ? "other skills near you" : "others"}</span>}
        <span>Size: postings · Distance from the centre: {page === "you" ? "how close" : "how often its postings ask"}</span>
      </div>
    </div>
  );
}
