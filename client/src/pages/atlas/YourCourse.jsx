// ⭐ D120 P2 · YOUR COURSE on the Atlas home — the D117 circle (its own CircleSvg, not a redraw) with the reader's earned
// progress, the route from Your map as the ink stroke, and "Continue: <the first unfinished piece on that route>".
// Signed out it is the full circle with no progress (D120: "Signed out: search · Learn (the full circle) · Explore by
// role"). Every piece opens its page on the Learn view (#step-<id>, D117 C6). Reads /api/learn, /api/learn/circle and,
// signed in, /api/learn/earned and /api/learn/circle/my-route — the same answers LearnView reads.
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../lib/api.js";
import { CircleSvg } from "./LearnCircle.jsx";
import { piecesOf, stepState, circleLayout, routesFor, routeStart } from "./learnModel.js";

export default function YourCourse({ base, signedIn = false }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  useEffect(() => {
    let live = true;
    Promise.all([
      api("/api/learn"),
      api("/api/learn/circle").catch(() => ({ pieces: {}, routes: [] })),
      signedIn ? api("/api/learn/earned").catch(() => ({ marks: {} })) : Promise.resolve({ marks: {} }),
      signedIn ? api("/api/learn/circle/my-route").catch(() => null) : Promise.resolve(null),
    ]).then(([learn, circle, earned, myRoute]) => live && setData({ learn, circle, marks: earned?.marks || {}, myRoute }))
      .catch(() => live && setData(false));
    return () => { live = false; };
  }, [signedIn]);
  return data ? <CourseView base={base} signedIn={signedIn} data={data} onOpen={(id) => navigate(`${base}/learn#step-${encodeURIComponent(id)}`)} /> : null;
}

/** The course drawn from its answers — pure (the page's tests render it). data = { learn, circle, marks, myRoute }. */
export function CourseView({ base, signedIn = false, data, onOpen = () => {} }) {
  const pieces = useMemo(() => (data ? piecesOf(data.learn, data.circle) : []), [data]);
  const states = useMemo(() => new Map(pieces.map(p => [p.id, stepState(p, data?.marks || {})])), [pieces, data]);
  const layout = useMemo(() => (pieces.length ? circleLayout(pieces) : null), [pieces]);
  if (!layout) return null;
  const route = routesFor(data.circle, pieces, data.myRoute).find(r => r.id === "my-map") || null;
  const finished = (id) => !!states.get(id)?.complete;
  const next = route ? routeStart(route.list, finished) : (pieces.find(p => !finished(p.id)) || pieces[0]).id;
  const piece = pieces.find(p => p.id === next);
  const done = pieces.filter(p => finished(p.id)).length;
  const started = pieces.filter(p => !finished(p.id) && states.get(p.id).started).length;
  return (
    <section className="atl__section atl-course" data-atlas-course={signedIn ? "you" : "all"} aria-labelledby="atl-course">
      <h2 className="atl__h2" id="atl-course">{signedIn ? "Your course" : "Learn — From silicon to software"}</h2>
      <p className="atl__quiet" data-atlas-course-progress="">
        {signedIn ? `${done} finished · ${started} started · ${pieces.length - done - started} to go` : `${pieces.length} pieces, one circle — start anywhere.`}
        {route ? ` · The ink is your route from your map (${route.list.length} pieces).` : ""}
      </p>
      <div className="atl-course__ring">
        <CircleSvg pieces={pieces} layout={layout} states={states} sel={next} route={route} onSelect={onOpen} />
      </div>
      {piece && (
        <p className="atl-course__next" data-atlas-course-continue={piece.id}>
          {signedIn ? (done || started ? "Continue: " : "Start: ") : "Start here: "}
          <Link to={`${base}/learn#step-${encodeURIComponent(piece.id)}`} className="atl__link">{piece.t}</Link>
        </p>
      )}
    </section>
  );
}
