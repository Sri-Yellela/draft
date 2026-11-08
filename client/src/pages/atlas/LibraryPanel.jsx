// ⭐ D172 (2) (owner APPROVED 11-06, docs/sketches/atlas-redesign-sketch.html → Library, and a course opened) · THE LIBRARY:
// the courses as a shelf of covers (each with its own drawing, colours from theme tokens), and a COURSE PAGE —
// modules → lessons, each lesson its curated links (Read · Watch · Try, with the source the register names — D176-3) and
// its check; a lesson opens its Learn page (#step-<id>), where the links are opened and the check is answered.
// Honest by construction: one course exists (the owner's path), so the shelf shows one cover — no "Soon" covers for
// courses nobody has planned; no "5 slides" or minutes until a lesson has a deck or a length; progress is EARNED.
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import LearnView from "./LearnView.jsx";
import { api } from "../../lib/api.js";
import { courseProgress, firstOpenModule, lessonState, linkLine } from "./libraryModel.js";
import { GuideLadder, useGuides } from "./LibraryGuides.jsx";
import { HalfRing, LessonDeck } from "./LessonDeck.jsx";
import "./LibraryPanel.css";

export const COURSES = Object.freeze([{ id: "silicon-to-software", title: "From silicon to software", art: "chip" }]);

/** The cover's drawing: a chip whose pins become lines of code. Theme tokens only (d172ShelfCoversFromTokens). */
function ChipArt() {
  const pins = [26, 38, 50, 62, 74];
  return (
    <svg className="lib-cover__art" viewBox="0 0 120 100" aria-hidden="true" focusable="false">
      <rect x="34" y="20" width="44" height="60" rx="5" className="lib-art__body" />
      <rect x="44" y="34" width="24" height="32" rx="3" className="lib-art__core" />
      {pins.map(y => <line key={`l${y}`} x1="22" y1={y} x2="34" y2={y} className="lib-art__pin" />)}
      {pins.map((y, i) => <line key={`r${y}`} x1="78" y1={y} x2={88 + (i % 3) * 8} y2={y} className="lib-art__code" />)}
      <text x="96" y="30" className="lib-art__glyph">{"{ }"}</text>
    </svg>
  );
}

function useCourse(id, signedIn) {
  const [s, setS] = useState({ course: null, marks: {}, error: null });
  useEffect(() => {
    let live = true;
    if (!id) return undefined;
    Promise.all([api(`/api/learn/course/${encodeURIComponent(id)}`),
      signedIn ? api("/api/learn/earned").catch(() => ({ marks: {} })) : Promise.resolve({ marks: {} })])
      .then(([course, earned]) => live && setS({ course, marks: earned?.marks || {}, error: null }))
      .catch(e => live && setS({ course: null, marks: {}, error: e.message || "The course could not be opened." }));
    return () => { live = false; };
  }, [id, signedIn]);
  return s;
}

/** /atlas/library — the shelf. */
export function LibraryShelf({ base, signedIn = false }) {
  const { course, marks } = useCourse(COURSES[0].id, signedIn);
  const p = course ? courseProgress(course, marks) : null;
  const guides = useGuides();
  return (
    <div className="atl-pan" data-atlas-panel-body="library">
      <header className="atl__head">
        <p className="atl__kicker">Library</p>
        <h1 className="atl__title">Guides and courses</h1>
        <p className="atl__lede">Your level's guide first, then the shelf. Each lesson is the best material we found on it and a quick check.</p>
      </header>
      {/* ⭐ D172 (2b): the ladder of guides (approved decks), above the shelf of courses. */}
      <GuideLadder base={base} guides={guides} />
      <h2 className="atl__h2">Courses</h2>
      <ul className="lib-shelf" data-library-shelf="">
        {COURSES.map(c => (
          <li key={c.id} className="lib-cover" data-course={c.id}>
            <Link to={`${base}/library/${c.id}`} className="lib-cover__link">
              <ChipArt />
              <span className="lib-cover__title">{c.title}</span>
              {course && <span className="lib-cover__meta">{course.counts.modules} modules · {course.counts.lessons} lessons</span>}
              {signedIn && p && <span className="lib-cover__meta" data-course-progress={p.pct}>{p.pct}% done</span>}
              <span className="lib-cover__go">{signedIn && p?.done ? "Continue →" : "Open →"}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** /atlas/library/<id> — a course: its modules, one open at a time; each lesson its links and its check. */
export function CoursePage({ base, id, signedIn = false }) {
  const { course, marks, error } = useCourse(id, signedIn);
  const progress = useMemo(() => (course ? courseProgress(course, marks) : null), [course, marks]);
  const [open, setOpen] = useState(null);
  // ⭐ D178-3: the half ring's selected module (the deck below shows its lessons); starts where the list starts.
  const [sel, setSel] = useState(null);
  const [circle, setCircle] = useState(null);
  useEffect(() => { if (course) { const m = firstOpenModule(course, marks); setOpen(m); setSel(s => s ?? m); } }, [course, marks]);
  useEffect(() => { let live = true; api("/api/learn/circle").then(c => live && setCircle(c)).catch(() => {}); return () => { live = false; }; }, []);
  const titles = useMemo(() => new Map((course?.modules || []).flatMap(m => m.lessons.map(l => [l.id, l.title]))), [course]);
  // ⭐ D178: two views of the one course — Modules (the half ring, the deck, the list) and The circle (the whole course at a
  // glance: Learn's circle, its path, patterns and concept index, until each moves to its own home). ?view=circle#step-<id>.
  const location = useLocation();
  const navigate = useNavigate();
  const view = new URLSearchParams(location.search).get("view") === "circle" ? "circle" : "modules";
  const setView = (v) => navigate({ search: v === "circle" ? "?view=circle" : "", hash: location.hash }, { replace: true });
  if (error) return <p className="atl__quiet" role="alert" data-course-missing="">{/no_such_course|404/.test(error) ? "There is no course by that name." : error} <Link to={`${base}/library`} className="atl__link">Back to the library</Link></p>;
  if (!course) return <p className="atl__quiet" role="status">Opening the course…</p>;
  return (
    <article className="lib-course" data-course-page={course.id}>
      {/* ⭐ D178-3 (owner's pick: Idea A's head) — the cover, the title, the course's lit count. */}
      <header className="lib-chead">
        <div className="lib-chead__cover" aria-hidden="true"><ChipArt /></div>
        <div className="lib-chead__body">
          <p className="atl__kicker">Course · {course.counts.modules} modules · {course.counts.lessons} lessons</p>
          <h1 className="atl__title">{course.title}</h1>
          <p className="atl__lede">Each lesson: the best material we found, and a quick check in your own words.</p>
          <div className="lib-chead__bar" role="img" aria-label={`${progress.done} of ${progress.total} lessons lit`}><i style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} /></div>
          <p className="atl__quiet" data-course-lit="">{progress.done} of {progress.total} lit{signedIn ? "" : " · sign in to light them"}</p>
        </div>
      </header>
      <div className="rr-tabs lib-views" role="tablist" aria-label="View the course" data-course-views="">
        <button type="button" role="tab" aria-selected={view === "modules"} aria-pressed={view === "modules"} onClick={() => setView("modules")} data-course-view="modules">Modules</button>
        <button type="button" role="tab" aria-selected={view === "circle"} aria-pressed={view === "circle"} onClick={() => setView("circle")} data-course-view="circle">The circle</button>
      </div>
      {view === "circle" && <div data-course-circle-view=""><LearnView signedIn={signedIn} /></div>}
      {view === "modules" && <>
      {/* ⭐ D178-3 (owner's pick: Idea C) — the half ring picks the module; its lessons are a deck. */}
      {sel != null && <HalfRing course={course} marks={marks} progress={progress} module={sel} onModule={setSel} />}
      {sel != null && (
        <section className="lib-modsel" aria-labelledby="lib-modsel-h" data-module-selected={sel}>
          <h2 className="atl__h2" id="lib-modsel-h">Module {sel} · {course.modules.find(m => m.n === sel)?.title} — {course.modules.find(m => m.n === sel)?.lessons.length} lessons</h2>
          <LessonDeck base={base} lessons={course.modules.find(m => m.n === sel)?.lessons || []} marks={marks} circle={circle} titles={titles} />
        </section>
      )}
      <p className="atl__quiet"><Link to={`${base}/learn`} className="atl__link" data-course-circle="">The whole course as a circle →</Link></p>
      <h2 className="atl__h2">All modules</h2>
      {course.modules.map(m => {
        const mp = progress.modules.find(x => x.n === m.n);
        const isOpen = open === m.n;
        return (
          <section key={m.n} className="lib-module" data-module={m.n}>
            <button type="button" className="lib-module__head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : m.n)}>
              <span className="lib-module__t">Module {m.n} · {m.title}</span>
              <span className="lib-module__n">{signedIn ? `${mp.done} of ${mp.total}` : `${mp.total} lessons`}</span>
            </button>
            {isOpen && (
              <ol className="lib-lessons">
                {m.lessons.map(l => {
                  const st = lessonState(l, marks);
                  return (
                    <li key={l.id} className="lib-lesson" data-lesson={l.id} data-lesson-state={st.complete ? "checked" : st.started ? "started" : "new"}>
                      <div className="lib-lesson__main">
                        <Link to={`${base}/learn#step-${encodeURIComponent(l.id)}`} className="lib-lesson__t">{l.title}</Link>
                        <ul className="lib-links">
                          {l.links.filter(x => !x.optional).map(x => (
                            <li key={x.id} data-link-type={x.type} data-link-source={x.source?.id || ""}>
                              {x.url ? <a href={x.url} target="_blank" rel="noopener noreferrer">{linkLine(x)}</a> : <span>{linkLine(x)}</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <span className="lib-lesson__check" data-lesson-check="">
                        {st.complete
                          ? <span className="mark mark--ok">✓ checked</span>
                          : <Link to={`${base}/learn#step-${encodeURIComponent(l.id)}`} className="atl__link">Check · {l.checks.length} question{l.checks.length === 1 ? "" : "s"}</Link>}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        );
      })}
      </>}
      <p><Link to={`${base}/library`} className="atl__link" data-course-back="">← Back to the library</Link></p>
    </article>
  );
}
