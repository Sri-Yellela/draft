// ⭐ D172 (2b) (atlas-redesign-sketch.html → Library → the level ladder) · THE GUIDES: the ladder of levels (Foundations ·
// Building blocks · Grow past senior · Lead), each a guide of decks; a guide's page; and the DECK VIEWER — one slide at a
// time, the last slide the check (the bank question, served only when live; until then "waiting for review"). Only
// approved decks exist here (GET /api/learn/guides, /api/learn/deck/:id); a level with none reads "not written yet" and
// is never clickable. A check answer earns no points — points come from proof (Your run).
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api.js";
import DepthButton from "../../components/DepthButton.jsx";
import { slideLabel } from "./libraryModel.js";
import CardPile from "../../components/CardPile.jsx";   // 46u: draft's card for the slides
// ⭐ 46v: the book and the shelf moved to components/BookShelf.jsx (the landing's feature shelf wears them too, A93);
// re-exported here so the Library's readers keep their names.
import { BookSpine, BookShelf } from "../../components/BookShelf.jsx";
import { pastelIndex, pastelVar } from "../../../../shared/pastel.js";
export { BookSpine, BookShelf, bookShape, spineFont } from "../../components/BookShelf.jsx";
import "./LibraryPanel.css";
import { Facts } from "../../components/TextBlocks.jsx";   // A233: meta lines as figures
import DeckPlay from "./DeckPlay.jsx";   // ⭐ D194: Watch / Read
import { MODES } from "./deckPlay.js";

export function useGuides() {
  const [g, setG] = useState(null);
  useEffect(() => { let live = true; api("/api/learn/guides").then(r => live && setG(r.guides || [])).catch(() => live && setG([])); return () => { live = false; }; }, []);
  return g;
}

/** The ladder, on the Library page — the guides by level, as books (46u). */
export function GuideLadder({ base, guides }) {
  if (!guides?.length) return null;
  return (
    <section className="lib-ladder" aria-labelledby="lib-ladder-h" data-guide-ladder="">
      <h2 className="atl__h2" id="lib-ladder-h">Guides, by level</h2>
      <BookShelf as="ol">
        {guides.map((g, i) => (g.written
          ? <BookSpine key={g.id} id={g.id} last={i === guides.length - 1} kind={`Level ${g.level}`} title={g.name} foot={`${g.lessons.length} decks`}
              label={`Level ${g.level}, ${g.name}: ${g.lessons.length} decks — ${g.lessons.slice(0, 4).map(l => l.title).join(", ")}${g.lessons.length > 4 ? " …" : ""}`}
              to={`${base}/library/${g.id}`} data-guide={g.id} data-guide-written="" />
          : <BookSpine key={g.id} id={g.id} last={i === guides.length - 1} size="thin" kind={`Level ${g.level}`} title={g.name} foot="Not written yet"
              label={`Level ${g.level}, ${g.name}: not written yet`} data-guide={g.id} />))}
      </BookShelf>
    </section>
  );
}

/**
 * ⭐ D155 Part C · EVERY PATHWAY — the whole approved plan on the Library page: each role family, its stages and topics.
 * A written (approved) topic opens its deck; the rest say "planned", never a fake link. One pathway open at a time.
 */
export function PathwaysPlan({ base, want = null }) {
  const [plan, setPlan] = useState(null);
  const [open, setOpen] = useState("software");
  useEffect(() => { let live = true; api("/api/learn/pathways").then(r => live && setPlan(r)).catch(() => live && setPlan({ pathways: [] })); return () => { live = false; }; }, []);
  // ⭐ A154 (45o): a pathway's cover on the shelf asks for it — open it here and bring it into view.
  useEffect(() => {
    if (!want?.id) return;
    setOpen(want.id);
    setTimeout(() => document.querySelector('[data-pathway="' + want.id + '"]')?.scrollIntoView?.({ behavior: "smooth", block: "start" }), 30);
  }, [want]);
  if (!plan?.pathways?.length) return null;
  const total = plan.written + (plan.drafted || 0) + plan.planned;
  return (
    <section className="lib-plan" aria-labelledby="lib-plan-h" data-pathways-plan="">
      <h2 className="atl__h2" id="lib-plan-h">Every pathway</h2>
      <p className="atl__quiet" data-pathways-count="">{plan.written} of {total} decks written{plan.drafted ? ` · ${plan.drafted} more being written` : ""} · the rest are planned, in this order</p>
      {plan.pathways.map(p => {
        const isOpen = open === p.id;
        const n = p.stages.reduce((a, s) => a + s.topics.length, 0), w = p.stages.reduce((a, s) => a + s.topics.filter(t => t.deck).length, 0);
        return (
          <section key={p.id} className="lib-module" data-pathway={p.id}>
            <button type="button" className="lib-module__head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : p.id)}>
              <span className="lib-module__t">{p.title}{p.later ? " · once these fields are on the board" : ""}</span>
              <span className="lib-module__n">{w} of {n} written</span>
            </button>
            {isOpen && (
              <div className="lib-plan__stages">
                {p.stages.map(s => (
                  <div key={s.id} className="lib-plan__stage" data-stage={s.id}>
                    <h3 className="lib-plan__h">{s.title}</h3>
                    <ul className="lib-plan__topics">
                      {s.topics.map((t, i) => (
                        <li key={i} data-topic-state={t.deck ? "written" : t.drafted ? "drafted" : "planned"}>
                          {t.deck ? <Link className="atl__link" to={`${base}/library/${t.deck}`}>{t.title}</Link> : <span>{t.title}</span>}
                          {!t.deck && <span className="atl__quiet"> · {t.drafted ? "being written" : "planned"}</span>}
                        </li>
                      ))}
                    </ul>
                    {/* ⭐ D154 P8 (45n): the stage's approved BUILDS — proven by a link on the skill (D169 'built'). */}
                    {s.builds?.map(b => (
                      <details key={b.id} className="lib-plan__build" data-build={b.id}>
                        <summary><b>Build it:</b> {b.title}</summary>
                        <p>{b.brief}</p>
                        <ol>{b.steps.map((st, i) => <li key={i}>{st}</li>)}</ol>
                        <p className="atl__quiet"><b>To prove it:</b> {b.show} Add the link as proof on the skill in <Link className="atl__link" to={`${base}/your-skills`}>Your skills</Link> — it then counts as built.</p>
                        {b.decks.length > 0 && <p className="atl__quiet">Read first: {b.decks.map((d, i) => <span key={d}>{i ? " · " : ""}<Link className="atl__link" to={`${base}/library/${d}`}>{d}</Link></span>)}</p>}
                      </details>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </section>
  );
}

/** /atlas/library/<guide> — the guide: its decks in order. */
export function GuidePage({ base, guide }) {
  return (
    <article className="lib-course" data-guide-page={guide.id}>
      <header className="atl__head">
        <p className="atl__kicker">Guide · Level {guide.level}</p>
        <h1 className="atl__title">{guide.name}</h1>
        <p className="atl__lede">Each deck is five slides, ending with a question.</p>
        <Facts items={[{ value: guide.lessons.length, label: "decks" }, { value: 5, label: "slides each" }]} />
      </header>
      {/* ⭐ 46u: each deck in its own pastel — the colour its slides carry. */}
      <ol className="lib-lessons lib-lessons--plain lib-lessons--decks">
        {guide.lessons.map((l, i) => (
          <li key={l.id} className="lib-lesson lib-lesson--deck" data-deck={l.id} style={{ "--book-c": pastelVar(l.id) }}>
            <div className="lib-lesson__main">
              <Link to={`${base}/library/${l.id}`} className="lib-lesson__t">{i + 1}. {l.title}</Link>
              <span className="atl__quiet">{l.slides} slides{l.skills.length ? ` · ${l.skills.join(", ")}` : ""}</span>
            </div>
            {/* ⭐ D194 (6): the ▶ on a deck — it plays (Watch, muted until the person turns the sound on) */}
            <Link to={`${base}/library/${l.id}?play=watch`} className="atl__link lib-lesson__play" data-deck-play-link={l.id} aria-label={`Watch ${l.title}`}>▶ Watch</Link>
          </li>
        ))}
      </ol>
      <p><Link to={`${base}/library`} className="atl__link">← Back to the library</Link></p>
    </article>
  );
}

/** /atlas/library/<deck> — one slide at a time; the last is the check. */
export function DeckPage({ base, id }) {
  const [deck, setDeck] = useState(null);
  const [error, setError] = useState("");
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState(null);
  // ⭐ D194: three modes, one toggle — Watch · Read · Cards. Cards (the static deck below) unless the link asks to play
  // (?play=watch — a course lesson's Open — or ?play=read). Playing never starts with sound.
  const [mode, setMode] = useState(() => { try { const m = new URLSearchParams(window.location.search).get("play"); return MODES.includes(m) ? m : "cards"; } catch { return "cards"; } });
  useEffect(() => {
    let live = true;
    setDeck(null); setI(0); setAnswer(null); setError("");
    api(`/api/learn/deck/${encodeURIComponent(id)}`).then(d => live && setDeck(d)).catch(e => live && setError(e.message || "missing"));
    return () => { live = false; };
  }, [id]);
  if (error) return <p className="atl__quiet" role="alert" data-deck-missing="">There is no deck by that name. <Link to={`${base}/library`} className="atl__link">Back to the library</Link></p>;
  if (!deck) return <p className="atl__quiet" role="status">Opening the deck…</p>;
  const s = deck.slides[i];
  const last = i === deck.slides.length - 1;
  async function choose(chosen) {
    try { setAnswer({ chosen, ...(await api(`/api/learn/deck/${encodeURIComponent(deck.id)}/answer`, { method: "POST", body: JSON.stringify({ chosen }) })) }); }
    catch (e) { setAnswer({ chosen, error: e.message || "That answer was not saved." }); }
  }
  // ⭐ 46u: the slide is draft's card in the deck's pastel (stable per deck id), the slides still to read fanned behind.
  const face = (k) => {
    const sk = deck.slides[k], isLast = k === deck.slides.length - 1;
    return (
      <div className="lib-slide" data-slide-tag={sk.tag}>
        <p className="lib-slide__top"><span className="lib-slide__tag">{slideLabel(k, deck.slides.length, sk.tag)}</span><span className="lib-slide__crumb">{deck.guide?.name || "Library"} · {deck.title}</span></p>
        <h1 className="atl__title lib-slide__title">{sk.title}</h1>
        {!isLast && <ul className="lib-slide__points">{sk.points.map((p, j) => <li key={j}>{p}</li>)}</ul>}
        {isLast && (deck.check.question ? (
          <div className="lib-check" data-deck-check="">
            <p className="lib-check__stem">{deck.check.question.stem}</p>
            <ol className="lib-check__choices">
              {deck.check.question.choices.map((c, j) => (
                <li key={j}><button type="button" className="lib-check__choice" disabled={!!answer} aria-pressed={answer?.chosen === j}
                  data-choice-state={answer ? (j === answer.answer ? "right" : j === answer.chosen ? "wrong" : "") : ""} onClick={() => choose(j)}>{c}</button></li>
              ))}
            </ol>
            {answer && !answer.error && <p className="lib-check__why" role="status">{answer.correct ? "Right." : "Not quite."} {Array.isArray(answer.why) ? answer.why[answer.answer] : answer.why || ""}</p>}
            {answer?.error && <p className="atl__quiet" role="alert">{answer.error}</p>}
          </div>
        ) : <p className="atl__quiet" data-deck-check-waiting="">This deck's question is waiting for review — it appears here once it's approved.</p>)}
      </div>
    );
  };
  return (
    <article className="lib-deck" data-deck-view={deck.id} data-slide={i + 1} data-pastel={pastelIndex(deck.id)} data-deck-mode={mode}>
      <p className="atl__kicker">{deck.guide ? <Link to={`${base}/library/${deck.guide.id}`} className="atl__link">{deck.guide.name}</Link> : "Library"} · {deck.title}</p>
      <div className="lib-modes" role="group" aria-label="How to take this deck" data-deck-modes="">
        {[["watch", "Watch"], ["read", "Read"], ["cards", "Cards"]].map(([m, label]) => (
          <DepthButton key={m} size="compact" pressed={mode === m} primary={mode === m} onClick={() => setMode(m)} data-deck-mode-pick={m}>{label}</DepthButton>
        ))}
      </div>
      {mode === "cards" ? (<>
        <CardPile count={deck.slides.length} at={i} color={pastelVar(deck.id)} flipKey={last && answer ? "answered" : null} renderFace={face} />
        <div className="lib-deck__nav">
          <DepthButton disabled={i === 0} onClick={() => setI(i - 1)}>← Back</DepthButton>
          <span className="atl__quiet" aria-live="polite">{i + 1} of {deck.slides.length}</span>
          {!last && <DepthButton primary onClick={() => setI(i + 1)}>Next →</DepthButton>}
        </div>
      </>) : <DeckPlay deck={deck} mode={mode} onMode={setMode} renderCheck={() => face(deck.slides.length - 1)} />}
    </article>
  );
}

/** /atlas/library/<id> — a guide or a deck (a course has its own page). */
export function LibraryItem({ base, id }) {
  const g = useGuides();
  if (!g) return <p className="atl__quiet" role="status">Opening…</p>;
  const guide = g.find(x => x.id === id && x.written);
  return guide ? <GuidePage base={base} guide={guide} /> : <DeckPage base={base} id={id} />;
}
