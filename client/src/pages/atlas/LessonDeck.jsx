// ⭐ D178-3 (owner's pick 11-07, docs/sketches/Atlas D178 ideas.html → Course A + C) · THE HALF RING AND THE LESSON DECK on a
// course page. The half ring is the course at a glance and the module picker: every lesson a tick in its module's colour,
// lit when earned; the selected module stands out; the wheel over it (the deck gesture, lib/deckWheel.js) turns modules,
// so does ← → on it, and a chip picks one. Under it, the module's lessons are a DECK (the jobs page's card-deck design):
// the wheel, a swipe or ← → turns one card; a card is the lesson — its state, its goal, its links (Read · Watch · Try,
// with their source), Builds on / Opens, Open and Check. Progress is EARNED (the one rule) — nothing here ticks anything.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DepthButton from "../../components/DepthButton.jsx";
import { deckWheelHandler } from "../../lib/deckWheel.js";
import { HALF, halfRingLayout, lessonState, lessonStateLine, linkLine, earnChecklist, wholeModules } from "./libraryModel.js";
import CardPile from "../../components/CardPile.jsx";   // ⭐ 46u: the lessons on draft's card, in the module's pastel
import { pastelVar } from "../../../../shared/pastel.js";

export function HalfRing({ course, marks, progress, module, onModule }) {
  const ticks = useMemo(() => halfRingLayout(course), [course]);
  const ref = useRef(null);
  const n = course.modules.length;
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const onWheel = deckWheelHandler({ canStep: (dir) => module + dir >= 1 && module + dir <= n, step: (dir) => onModule(module + dir) });
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [module, n, onModule]);
  const lit = new Set(course.modules.flatMap(m => m.lessons.filter(l => lessonState(l, marks).complete).map(l => l.id)));
  // ⭐ A155 (45o, the D178 picks: "lighting a whole part animates that arc of the circle once"): a module that became whole
  // since this browser last saw the course draws its arc lighting up, once; then it is remembered (per course, this
  // browser). Reduced motion: no animation (the CSS turns it off).
  const [fresh, setFresh] = useState(() => new Set());
  useEffect(() => {
    const whole = wholeModules(course, marks).map(m => m.n);
    if (!whole.length) return;
    const key = `atlas.wholeSeen.${course.id}`;
    let seen = [];
    try { seen = JSON.parse(localStorage.getItem(key) || "[]"); } catch { seen = []; }
    const now = whole.filter(n => !seen.includes(n));
    if (!now.length) return;
    setFresh(new Set(now));
    try { localStorage.setItem(key, JSON.stringify([...new Set([...seen, ...whole])])); } catch { /* private mode: it may play again */ }
  }, [course, marks]);
  const sel = course.modules.find(m => m.n === module);
  const mp = progress.modules.find(m => m.n === module);
  return (
    <div className="lrc lib-half" ref={ref} tabIndex={0} data-half-ring="" aria-label={`The course at a glance: ${progress.done} of ${progress.total} lessons done. Module ${module} selected; the left and right arrows change it.`}
      onKeyDown={e => { if (e.key === "ArrowRight" && module < n) { e.preventDefault(); onModule(module + 1); } if (e.key === "ArrowLeft" && module > 1) { e.preventDefault(); onModule(module - 1); } }}>
      <svg className="lib-half__svg" viewBox={`0 0 ${HALF.w} ${HALF.h}`} aria-hidden="true" focusable="false">
        {ticks.map(t => (
          <line key={t.id} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            className={`lib-half__tick lrc__part--${t.module}${lit.has(t.id) ? " is-lit" : ""}${t.module === module ? " is-sel" : ""}${fresh.has(t.module) ? " is-new-whole" : ""}`}
            style={fresh.has(t.module) ? { animationDelay: `${(t.i ?? 0) * 40}ms` } : undefined}
            onClick={() => onModule(t.module)} />
        ))}
        <text x={HALF.cx} y={HALF.cy - 70} textAnchor="middle" className="lib-half__big">{progress.done} of {progress.total} done</text>
        <text x={HALF.cx} y={HALF.cy - 40} textAnchor="middle" className="lib-half__sub">Module {module} · {sel?.title} · {mp?.done} of {mp?.total} done</text>
      </svg>
      <div className="lib-half__chips" role="tablist" aria-label="Modules">
        {course.modules.map(m => (
          <button key={m.n} type="button" role="tab" aria-selected={m.n === module} className={`lib-chip lrc__part--${m.n}`} data-module-chip={m.n} onClick={() => onModule(m.n)}>
            <i aria-hidden="true" />{m.n} · {m.title}
          </button>
        ))}
      </div>
    </div>
  );
}

// ⭐ 46u (owner 11-17: "use our card design for these decks in each course"): the module's lessons are draft's card
// (components/CardPile) in the module's pastel (`colorId`, stable), the lessons still ahead fanned behind it; the wheel,
// a swipe or ← → turns one card, Next throws the front off.
export function LessonDeck({ base, lessons, marks, circle, titles, colorId = "lessons" }) {
  const navigate = useNavigate();
  const [i, setI] = useState(0);
  const ref = useRef(null);
  const touch = useRef(null);
  useEffect(() => { setI(0); }, [lessons]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const onWheel = deckWheelHandler({ canStep: (dir) => i + dir >= 0 && i + dir < lessons.length, step: (dir) => setI(x => x + dir) });
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [i, lessons.length]);
  if (!lessons.length) return null;
  const go = (d) => setI(x => Math.max(0, Math.min(lessons.length - 1, x + d)));
  const face = (k) => {
    const l = lessons[k];
    if (!l) return null;
    const st = lessonState(l, marks), line = lessonStateLine(st);
    const piece = circle?.pieces?.[l.id] || {};
    const builds = (piece.needs || []).map(x => titles.get(x.id)).filter(Boolean);
    const opens = (piece.opens || []).map(x => titles.get(x.id ?? x)).filter(Boolean);
    const href = `${base}/learn#step-${encodeURIComponent(l.id)}`;
    return (
      <div className="lib-lcard" data-lesson-card={l.id} data-card-offset={k - i} data-lesson-state={line.state}>
        <p className="lib-lcard__top"><span className={`lib-lcard__state lib-lcard__state--${line.state}`}>{line.text}</span><span className="lib-lcard__num">{k + 1} / {lessons.length}</span></p>
        <h3 className="lib-lcard__t">{l.title}</h3>
        {l.goal && <p className="lib-lcard__goal">{l.goal}</p>}
        {/* ⭐ A155 (45o, the D178 picks): how you earn ✓ — the one rule's own counts. */}
        {earnChecklist(st).length > 0 && (
          <ul className="lib-earn" aria-label="How you earn the check" data-lesson-earn="">
            {earnChecklist(st).map(r => <li key={r.key} className={r.done ? "is-done" : ""} data-earn={r.key}>{r.done ? "✓ " : ""}{r.text}</li>)}
          </ul>
        )}
        <ul className="lib-links">
          {l.links.filter(x => !x.optional).slice(0, 4).map(x => (
            <li key={x.id}>{x.url ? <a href={x.url} target="_blank" rel="noopener noreferrer">{linkLine(x)}</a> : <span>{linkLine(x)}</span>}</li>
          ))}
        </ul>
        {builds.length > 0 && <p className="lib-lcard__rel"><b>Builds on</b> {builds.slice(0, 4).join(" · ")}{builds.length > 4 ? ` · +${builds.length - 4} more` : ""}</p>}
        {opens.length > 0 && <p className="lib-lcard__rel"><b>Opens</b> {opens.slice(0, 4).join(" · ")}{opens.length > 4 ? ` · +${opens.length - 4} more` : ""}</p>}
        <div className="lib-lcard__acts">
          <span data-lesson-open=""><DepthButton primary onClick={() => navigate(href)}>Open</DepthButton></span>
          <Link className="atl__link" to={href}>Check · {l.checks.length} question{l.checks.length === 1 ? "" : "s"}</Link>
        </div>
      </div>
    );
  };
  return (
    <div className="lib-ldeck" ref={ref} tabIndex={0} data-lesson-deck="" aria-roledescription="deck"
      aria-label={`Lessons: ${i + 1} of ${lessons.length}. The left and right arrows turn the deck.`}
      onKeyDown={e => { if (e.key === "ArrowRight") { e.preventDefault(); go(1); } if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); } }}
      onTouchStart={e => { touch.current = e.touches[0]?.clientX ?? null; }}
      onTouchEnd={e => { const x0 = touch.current, x1 = e.changedTouches[0]?.clientX; touch.current = null; if (x0 != null && x1 != null && Math.abs(x1 - x0) > 50) go(x1 < x0 ? 1 : -1); }}>
      <div className="lib-ldeck__nav">
        <span className="atl__quiet" aria-live="polite">{i + 1} of {lessons.length}</span>
        <button type="button" className="lib-ldeck__btn" aria-label="Previous lesson" disabled={i === 0} onClick={() => go(-1)}>‹</button>
        <button type="button" className="lib-ldeck__btn" aria-label="Next lesson" disabled={i === lessons.length - 1} onClick={() => go(1)}>›</button>
      </div>
      <CardPile count={lessons.length} at={i} color={pastelVar(colorId)} renderFace={face} />
    </div>
  );
}
