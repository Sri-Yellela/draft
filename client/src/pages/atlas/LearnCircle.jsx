// client/src/pages/atlas/LearnCircle.jsx — ⭐ D117 · LEARN AS A CIRCLE (owner 10-31: "it can be tweaked to be a full circle,
// kinda like the movie arrival … one can start it from the beginning and go all the way … but also begin somewhere and
// go backwards to make sense of stuff they dont understand or forwards to progress"). Approved on learn-circle.html with
// C8: "make a progress bar the user may not mark themselves complete".
//
//   C3  THE CIRCLE — all 108 pieces as rounded squares on one ring, in path order, the 8 parts as coloured arcs with
//       their names; filled = finished, half = started, open = not yet (the bar decides). Choosing a piece draws chords
//       inside the ring: orange to what it builds on, blue to what it opens; its title and "Piece n of 108 · …" in the
//       centre. A route is ONE ink stroke through its pieces, numbered (reduced motion: drawn at once). Step 1 is just one
//       place on the ring.
//   C4  THE PIECE — where it sits · title · goal · THE BAR · Before this (each with its state; drafted links marked
//       "draft") + "Go back to understand: <the first unfinished piece it builds on, at any depth>" · After this · the
//       items by kind, each a LINK (opening it from here is what counts — "opened", never "done") · each checkpoint's
//       box for the user's own explanation · the build's link where a Build / Project is required · "Finishing this
//       unlocks on your map: …" (D116 M8) → on finishing "Unlocked on your map: …", the chips fill.
//   C5  GUIDED ROUTES — data (the stored routes + "From your map"), closed over "Before this" and started at the first
//       unfinished piece, with Previous / Next; "Make sense of…" builds a route to any concept on the spot.
//   C6  ENTRY FROM ANYWHERE — LearnView passes the #step-<id> it was opened with: that piece opens, never Step 1.
// ⛔ C8: no checkbox, no "done" button, no "I explained it" — nothing a user can press says "complete".
import { useMemo, useState } from "react";
import DepthButton from "../../components/DepthButton.jsx";
import ResourceTile, { ResourceGrid, useLearnThumbs } from "../../components/ResourceTile.jsx";
import LearnWheel from "./LearnWheel.jsx";
import {
  stepState, checkpointId, circleState, circleLayout, pointAt, chordPath, routePath, arcPath, GEO, circleViewBox, partLabelLines, LABEL, needsMap, goBackTo, routeStart, routeClosure,
  routesFor, pieceForConcept, whereLine, pieceOf, barLine, pasteVerdict, wordCount, EXPLAIN_MIN_WORDS,
} from "./learnModel.js";
import { pastelVar } from "../../../../shared/pastel.js";   // ⭐ 46u: a checkpoint is a card in its own pastel
import "./LearnCircle.css";

export const KIND_ORDER = ["Video", "Playlist", "Article", "Guide", "Book", "Course", "Build", "Project", "Sandbox", "Lab", "Practice", "Exercise", "Game", "Atlas"];
const reducedMotion = () => {
  try { return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
};
// A state is a DOT (owner 10-31: the squares "look like a checkbox", which C8 forbids): filled = finished, half = started,
// a ring = not yet. Never pressable, aria-hidden; the row that holds it says the state in its accessible name.
const Dot = ({ state }) => <span className={`lrc__st lrc__st--${state}`} aria-hidden="true" />;
const STATE_WORDS = { filled: "finished", half: "started", open: "not started" };

/** C3 · the ring. */
export function CircleSvg({ pieces, layout, states, sel, route, onSelect }) {
  const byId = new Map(pieces.map(p => [p.id, p]));
  const s = byId.get(sel);
  const inRoute = route ? new Set(route.list) : null;
  const w = GEO.square;
  const title = s ? wrapTitle(s.t) : [];
  const st = s ? states.get(s.id) : null;
  return (
    <svg className="lrc__svg" viewBox={circleViewBox()} role="group" aria-label={`The course as a circle of ${pieces.length} lessons`} data-learn-circle="">
      <circle cx={GEO.c} cy={GEO.c} r={GEO.r - 24} className="lrc__guide" />
      {layout.parts.map(part => {
        const am = (part.a0 + part.a1) / 2, lr = GEO.r + 40;
        const anchor = Math.abs(Math.cos(am)) < 0.3 ? "middle" : Math.cos(am) > 0 ? "start" : "end";
        return (
          <g key={part.index} className={`lrc__part lrc__part--${part.index}`} data-learn-part={part.index}>
            <path d={arcPath(part)} className="lrc__arc" />
            {/* ⭐ D178-2: wrapped, never cropped (learnModel.js partLabelLines + circleViewBox). */}
            <text x={GEO.c + lr * Math.cos(am)} y={GEO.c + lr * Math.sin(am) + 4 - ((partLabelLines(part.index, part.t).length - 1) * LABEL.lineH) / 2} textAnchor={anchor} className="lrc__ptxt">
              {partLabelLines(part.index, part.t).map((l, i) => <tspan key={i} x={GEO.c + lr * Math.cos(am)} dy={i ? LABEL.lineH : 0}>{l}</tspan>)}
            </text>
          </g>
        );
      })}
      <g className="lrc__chords">
        {s && (s.needs || []).filter(n => byId.has(n.id)).map(n => <path key={`b-${n.id}`} d={chordPath(layout, n.id, s.id)} className={`lrc__chord lrc__chord--before${n.status === "drafted" ? " is-draft" : ""}`} data-chord-before={n.id} />)}
        {s && (s.opens || []).filter(id => byId.has(id)).map(id => <path key={`a-${id}`} d={chordPath(layout, s.id, id)} className="lrc__chord lrc__chord--after" data-chord-after={id} />)}
      </g>
      {route && route.id !== "all" && route.list.length > 1 && (
        <g className="lrc__route" data-learn-route-stroke={route.id}>
          <path d={routePath(layout, route.list)} className="lrc__ink" />
          {route.list.map((id, i) => { const [x, y] = pointAt(layout, id, GEO.r - 30); return (
            <g key={id}><circle cx={x} cy={y} r={8} className="lrc__num-dot" /><text x={x} y={y + 3.5} textAnchor="middle" className="lrc__num">{i + 1}</text></g>
          ); })}
        </g>
      )}
      {pieces.map(p => {
        const [x, y] = pointAt(layout, p.id);
        const cs = circleState(states.get(p.id));
        const dim = inRoute && !inRoute.has(p.id);
        return (
          <g key={p.id} className={`lrc__tick lrc__tick--${cs}${sel === p.id ? " is-sel" : ""}${dim ? " is-dim" : ""} lrc__part--${p.partIndex}`}
            role="button" tabIndex={0} aria-label={`${p.t}, lesson ${p.n} of ${pieces.length}, ${cs === "filled" ? "finished" : cs === "half" ? "started" : "not started"}`}
            aria-pressed={sel === p.id} data-learn-piece={p.id} data-state={cs}
            onClick={() => onSelect(p.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(p.id); } }}>
            <title>{p.t}</title>
            <rect className="lrc__sq" x={x - w / 2} y={y - w / 2} width={w} height={w} rx={3.2} />
            <rect className="lrc__fill" x={x - w / 2} y={y - w / 2} width={cs === "filled" ? w : cs === "half" ? w / 2 : 0} height={w} rx={cs === "filled" ? 3.2 : 1} />
          </g>
        );
      })}
      {s && (
        <g className="lrc__centre" aria-hidden="true">
          {title.map((l, i) => <text key={i} x={GEO.c} y={GEO.c - 14 + (i - (title.length - 1) / 2) * 21} textAnchor="middle" className="lrc__ctitle">{l}</text>)}
          <text x={GEO.c} y={GEO.c + 30 + title.length * 6} textAnchor="middle" className="lrc__csub">
            {pieceOf(s, pieces.length)} · {st.opened}/{st.toOpen} opened · {st.explained}/{st.checkpoints} explained
          </text>
          {route && route.list.includes(s.id) && (
            <text x={GEO.c} y={GEO.c + 50 + title.length * 6} textAnchor="middle" className="lrc__csub lrc__csub--route">Step {route.list.indexOf(s.id) + 1} of {route.list.length} on this route</text>
          )}
        </g>
      )}
    </svg>
  );
}
function wrapTitle(t, n = 22) {
  const lines = []; let cur = "";
  for (const w of String(t).split(" ")) { if (`${cur} ${w}`.trim().length > n) { lines.push(cur.trim()); cur = w; } else cur += ` ${w}`; }
  if (cur.trim()) lines.push(cur.trim());
  return lines.slice(0, 3);
}

/** C8 (2) · one checkpoint's box: the user's own words, ≥ 25, never a paste of 25+. */
function Explain({ id, question, saved, signedIn, onExplain }) {
  const [text, setText] = useState(saved?.text || "");
  const [pasted, setPasted] = useState(0);
  const [say, setSay] = useState("");
  const words = wordCount(text);
  const tone = { "--book-c": pastelVar(id) };
  if (!signedIn) return <li className="lrc__ck" data-learn-checkpoint={id} style={tone}><span>{question}</span></li>;
  return (
    <li className="lrc__ck" data-learn-checkpoint={id} style={tone}>
      <label className="lrc__ck-q" htmlFor={`exp-${id}`}>{question}</label>
      <textarea id={`exp-${id}`} className="lrc__ck-box" rows={3} value={text} data-learn-explain={id}
        placeholder="Explain it in your own words, as if teaching a friend (25 words or more)"
        onChange={(e) => { setText(e.target.value); setSay(""); }}
        onPaste={(e) => {
          const v = pasteVerdict(e.clipboardData?.getData("text") || "");
          if (v.refused) { e.preventDefault(); setSay(v.message); } else setPasted(p => Math.max(p, v.words));
        }} />
      <div className="lrc__ck-foot">
        <span className="atl__quiet" aria-live="polite">
          {say || (saved ? `Explained ${new Date(saved.updated * 1000).toLocaleDateString()} · ${words} words` : `${words} of ${EXPLAIN_MIN_WORDS} words`)}
        </span>
        <DepthButton size="compact" disabled={words < EXPLAIN_MIN_WORDS || text === saved?.text} data-learn-save={id}
          onClick={async () => { const r = await onExplain(id, text, pasted); setSay(r?.ok ? "Saved." : r?.message || "Could not save it just now."); if (r?.ok) setPasted(0); }}>
          {saved ? "Save my changes" : "Save my explanation"}
        </DepthButton>
      </div>
    </li>
  );
}

/** C8 (3) · the link to what was built — D109's proof link rule on the server. */
function BuildLink({ piece, saved, signedIn, onBuild }) {
  const [url, setUrl] = useState(saved?.url || "");
  const [kind, setKind] = useState(saved?.kind || "repository");
  const [say, setSay] = useState("");
  return (
    <div className="lrc__box" data-learn-build={piece.id}>
      <h3 className="lrc__box-h">What you built</h3>
      <p className="atl__quiet">This lesson asks you to build something. Link it (a repository or a live demo) to finish the lesson.</p>
      {signedIn ? (
        <div className="lrc__build">
          <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="What the link is" className="lrc__input">
            <option value="repository">Repository</option><option value="demo">Live demo</option>
          </select>
          <input type="url" className="lrc__input lrc__input--url" value={url} onChange={(e) => { setUrl(e.target.value); setSay(""); }}
            placeholder="https://github.com/you/your-project" aria-label="The link to what you built" />
          <DepthButton size="compact" disabled={!url.trim() || url === saved?.url} data-learn-build-save=""
            onClick={async () => { const r = await onBuild(piece.id, url.trim(), kind); setSay(r?.ok ? "Linked." : r?.message || "Could not save it just now."); }}>
            Save the link
          </DepthButton>
        </div>
      ) : null}
      {say && <p className="atl__quiet" aria-live="polite">{say}</p>}
    </div>
  );
}

/** C4 · the piece — readable alone. */
export function PieceBody({ piece, pieces, states, marks = {}, explanations = {}, builds = {}, signedIn = false, onSelect, onOpen, onExplain, onBuild, compact = false }) {
  const byId = new Map(pieces.map(p => [p.id, p]));
  const thumbs = useLearnThumbs();
  const st = states.get(piece.id);
  const finished = (id) => !!states.get(id)?.complete;
  const back = goBackTo(needsMap(pieces), pieces.map(p => p.id), piece.id, finished);
  const groups = new Map();
  for (const it of piece.items || []) { if (!groups.has(it.k)) groups.set(it.k, []); groups.get(it.k).push(it); }
  const kinds = [...KIND_ORDER.filter(k => groups.has(k)), ...[...groups.keys()].filter(k => !KIND_ORDER.includes(k))];
  const nb = (id, extra = null) => {
    const x = byId.get(id);
    if (!x) return null;
    return (
      <li key={id}><button type="button" className="lrc__nb" onClick={() => onSelect?.(id)} data-learn-go={id}
        aria-label={`${x.t}, ${STATE_WORDS[circleState(states.get(id))]}${extra ? ", a drafted link" : ""}`}>
        <Dot state={circleState(states.get(id))} /><span className="lrc__nb-t">{x.t}{extra}</span>
      </button></li>
    );
  };
  return (
    <div className="lrc__piece-body" data-learn-piece-body={piece.id}>
      {!compact && <>
        <p className="lrc__crumb" data-learn-where="">{whereLine(piece)} · <b>{pieceOf(piece, pieces.length)}</b></p>
        <h2 className="lrc__title">{piece.t}</h2>
        {piece.g && <p className="lrc__goal">{piece.g}</p>}
      </>}
      <div className="lrc__prog" data-learn-bar={st.bar}>
        <div className="lrc__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={st.bar} aria-label={`${piece.t}: ${st.bar} %`}>
          <i style={{ width: `${st.bar}%` }} />
        </div>
        <span className="atl__quiet">{st.bar} % · {barLine(st)}</span>
      </div>
      {!compact && (
        <div className="lrc__twin">
          <div className="lrc__box lrc__box--before">
            <h3 className="lrc__box-h">Before this · what it builds on</h3>
            {(piece.needs || []).length ? (
              <ul className="lrc__nbs">{piece.needs.map(n => nb(n.id, n.status === "drafted" ? <span className="mark mark--dim lrc__draft" data-learn-draft={n.id} title="A drafted link, waiting for review">draft</span> : null))}</ul>
            ) : <p className="atl__quiet">Nothing: you can start here.</p>}
            {back ? <DepthButton size="compact" wrap className="lrc__goback" onClick={() => onSelect?.(back)} data-learn-goback={back}>Go back to understand: {byId.get(back)?.t}</DepthButton>
              : (piece.needs || []).length ? <p className="atl__quiet">Everything it builds on is finished.</p> : null}
          </div>
          <div className="lrc__box lrc__box--after">
            <h3 className="lrc__box-h">After this · what it opens</h3>
            {(piece.opens || []).length ? <ul className="lrc__nbs">{piece.opens.map(id => nb(id))}</ul>
              : <p className="atl__quiet">It doesn't lead to another lesson; it rounds off its part.</p>}
          </div>
        </div>
      )}
      <div className="lrc__items">
        {kinds.map(k => (
          <div key={k} className="lrc__kind">
            <h4 className="lrc__kind-h">{k}</h4>
            {/* ⭐ D119: each item is a ResourceTile — its stored picture (or what it is, in type), the whole tile the link;
                the tile's press is what records the opening (D117 C8: "opened", never "done"). */}
            <ResourceGrid>
              {groups.get(k).map(it => (
                <li key={it.id} className="lrc__item" data-learn-item={it.id}>
                  <ResourceTile item={it} thumb={thumbs[it.u] || null} opened={!!marks[it.id]} onOpen={() => onOpen?.(it, piece)}
                    extra={it.p5 ? <span className="mark mark--accent" data-learn-p5={it.id}>new</span> : null} />
                  {it.n && <span className="lrc__note">{it.n}</span>}
                </li>
              ))}
            </ResourceGrid>
          </div>
        ))}
      </div>
      {(piece.c || []).length > 0 && (
        <div className="lrc__box lrc__box--cks">
          <h3 className="lrc__box-h">Checkpoints · answer as if teaching a friend</h3>
          <ul className="lrc__list">
            {piece.c.map((q, i) => { const id = checkpointId(piece.id, i); return <Explain key={id} id={id} question={q} saved={explanations[id]} signedIn={signedIn} onExplain={onExplain} />; })}
          </ul>
          {signedIn && <p className="atl__quiet">Private: only you read what you write here. Nothing grades it.</p>}
        </div>
      )}
      {st.build && <BuildLink piece={piece} saved={builds[piece.id]} signedIn={signedIn} onBuild={onBuild} />}
      {!signedIn && <p className="atl__quiet" data-learn-signin="">Sign in and the bar fills as you open, explain and build.</p>}
      {!compact && (
        <div className="lrc__box" data-learn-unlocks={st.complete ? "done" : "todo"}>
          <h3 className="lrc__box-h">{st.complete ? "Unlocked on your map" : "Finishing this unlocks on your map"}</h3>
          {(piece.teaches || []).length ? (
            <ul className="lrc__chips">{piece.teaches.map(t => <li key={t.term} className={`lrc__chip${st.complete ? " is-on" : ""}`} data-learn-teaches={t.slug || t.term}><i aria-hidden="true" />{t.name || t.term}</li>)}</ul>
          ) : <p className="atl__quiet">No Atlas entries linked yet.</p>}
          <p className="atl__quiet">Unlocked skills colour in on Your map. They go on your Profile only if you add them.</p>
        </div>
      )}
    </div>
  );
}

/**
 * The circle, the routes and the piece. @param earned { marks, explanations, builds } (signed in) · notice: the toast's
 * words after a finishing write · initialSel: the piece an entry opened (C6).
 */
export default function LearnCircle({ learn, pieces, circle, earned, signedIn = false, initialSel = null, myRoute = null, notice = "",
  onOpen, onExplain, onBuild, onWantMyRoute }) {
  const marks = earned?.marks || {};
  const states = useMemo(() => new Map(pieces.map(p => [p.id, stepState(p, marks)])), [pieces, marks]);
  const routes = useMemo(() => routesFor(circle, pieces, myRoute), [circle, pieces, myRoute]);
  const [sel, setSel] = useState(() => (initialSel && pieces.some(p => p.id === initialSel) ? initialSel : pieces[0]?.id));
  const [routeId, setRouteId] = useState(null);
  const [custom, setCustom] = useState(null);
  const [q, setQ] = useState("");
  const [qSay, setQSay] = useState("");
  const reduced = useMemo(reducedMotion, []);
  const route = custom || routes.find(r => r.id === routeId) || null;
  const piece = pieces.find(p => p.id === sel) || pieces[0];
  if (!piece) return null;
  const finished = (id) => !!states.get(id)?.complete;
  const choose = (r) => {
    setCustom(null);
    if (!r) { setRouteId(null); return; }
    setRouteId(r.id);
    setSel(routeStart(r.list, finished));
  };
  const makeSense = () => {
    const id = pieceForConcept(q, pieces, learn?.INDEX);
    if (!id) { setQSay(`No lesson teaches “${q.trim()}” yet.`); return; }
    const list = routeClosure(needsMap(pieces), pieces.map(p => p.id), [id]);
    setQSay("");
    setRouteId(null);
    setCustom({ id: "custom", name: `Make sense of ${q.trim()}`, list });
    setSel(routeStart(list, finished));
  };
  const done = pieces.filter(p => states.get(p.id).complete).length, started = pieces.filter(p => !states.get(p.id).complete && states.get(p.id).started).length;
  const ri = route ? route.list.indexOf(piece.id) : -1;
  return (
    <div className={`lrc${reduced ? " lrc--still" : ""}`} data-learn-circle-view="">
      <p className="lrc__overall" aria-live="polite"><b>{done}</b> finished · <b>{started}</b> started · {pieces.length - done - started} to go</p>
      <div className="lrc__routes" role="group" aria-label="Guided routes">
        <span className="atl__quiet">Guided routes:</span>
        {routes.map(r => <DepthButton key={r.id} size="compact" primary={route?.id === r.id} pressed={route?.id === r.id} onClick={() => choose(route?.id === r.id ? null : r)} data-learn-route={r.id}>{r.name}</DepthButton>)}
        {signedIn && !myRoute && onWantMyRoute && <DepthButton size="compact" onClick={onWantMyRoute} data-learn-route="my-map">From your map</DepthButton>}
        {route && <DepthButton size="compact" onClick={() => choose(null)} data-learn-route="">Clear</DepthButton>}
        <span className="lrc__q">
          <input className="lrc__input" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") makeSense(); }}
            placeholder="Make sense of… (hash table, TLS, attention)" aria-label="Make a route to a concept" data-learn-make-sense="" />
          <DepthButton size="compact" onClick={makeSense}>Make a route</DepthButton>
        </span>
        {qSay && <span className="atl__quiet" role="status">{qSay}</span>}
      </div>
      <div className="lrc__main">
        {/* ⭐ D117 C10 + C12: the deck round the wheel (LearnWheel); the compact ring (CircleSvg) stays for Your course (D120). */}
        <div className="lrc__stage">
          <LearnWheel pieces={pieces} states={states} sel={piece.id} route={route} reduced={reduced} onSelect={setSel}
            onOpenPiece={() => { try { document.querySelector("[data-learn-selected]")?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest" }); } catch { /* no DOM */ } }} />
        </div>
        <section className="lrc__piece" aria-label={`Lesson: ${piece.t}`} data-learn-selected={piece.id}>
          {route && ri >= 0 && (
            <div className="lrc__rnav" data-learn-rnav="">
              <span>Route: <b>{route.name}</b> · step {ri + 1} of {route.list.length}</span>
              <span className="lrc__rnav-btns">
                <DepthButton size="compact" disabled={ri === 0} onClick={() => setSel(route.list[ri - 1])}>← Previous</DepthButton>
                <DepthButton size="compact" primary disabled={ri === route.list.length - 1} onClick={() => setSel(route.list[ri + 1])}>Next →</DepthButton>
              </span>
            </div>
          )}
          <PieceBody piece={piece} pieces={pieces} states={states} marks={marks} explanations={earned?.explanations} builds={earned?.builds}
            signedIn={signedIn} onSelect={setSel} onOpen={onOpen} onExplain={onExplain} onBuild={onBuild} />
        </section>
      </div>
      <ul className="lrc__legend" aria-label="Legend">
        <li><span className="lrc__sw lrc__sw--filled" />Filled: finished</li>
        <li><span className="lrc__sw lrc__sw--half" />Half: started</li>
        <li><span className="lrc__sw lrc__sw--open" />Open: not yet</li>
        <li><span className="lrc__sw lrc__sw--before" />Lines in: what this lesson builds on</li>
        <li><span className="lrc__sw lrc__sw--after" />Lines out: what it opens</li>
        <li><span className="lrc__sw lrc__sw--ink" />The ink stroke: your chosen route</li>
      </ul>
      {notice && <p className="lrc__toast" role="status" data-learn-toast="">{notice}</p>}
    </div>
  );
}
