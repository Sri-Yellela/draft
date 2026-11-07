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
import "./LibraryPanel.css";

export function useGuides() {
  const [g, setG] = useState(null);
  useEffect(() => { let live = true; api("/api/learn/guides").then(r => live && setG(r.guides || [])).catch(() => live && setG([])); return () => { live = false; }; }, []);
  return g;
}

/** The ladder, on the Library page. */
export function GuideLadder({ base, guides }) {
  if (!guides?.length) return null;
  return (
    <section className="lib-ladder" aria-labelledby="lib-ladder-h" data-guide-ladder="">
      <h2 className="atl__h2" id="lib-ladder-h">Guides, by level</h2>
      <ol className="lib-ladder__rungs">
        {guides.map(g => (
          <li key={g.id} className="lib-rung" data-guide={g.id} data-guide-written={g.written ? "" : undefined}>
            {g.written ? (
              <Link to={`${base}/library/${g.id}`} className="lib-rung__link">
                <span className="lib-rung__level">Level {g.level}</span>
                <span className="lib-rung__name">{g.name}</span>
                <span className="lib-rung__list">{g.lessons.slice(0, 4).map(l => l.title).join(" · ")}{g.lessons.length > 4 ? " …" : ""}</span>
                <span className="lib-rung__meta">{g.lessons.length} decks · open →</span>
              </Link>
            ) : (
              <div className="lib-rung__link lib-rung__link--none" aria-disabled="true">
                <span className="lib-rung__level">Level {g.level}</span>
                <span className="lib-rung__name">{g.name}</span>
                <span className="lib-rung__meta">Not written yet</span>
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** /atlas/library/<guide> — the guide: its decks in order. */
export function GuidePage({ base, guide }) {
  return (
    <article className="lib-course" data-guide-page={guide.id}>
      <header className="atl__head">
        <p className="atl__kicker">Guide · Level {guide.level} · {guide.lessons.length} decks</p>
        <h1 className="atl__title">{guide.name}</h1>
        <p className="atl__lede">Each deck is five slides: what it is, the core ideas, the trade-offs, what you'll see at work, and a question.</p>
      </header>
      <ol className="lib-lessons lib-lessons--plain">
        {guide.lessons.map((l, i) => (
          <li key={l.id} className="lib-lesson" data-deck={l.id}>
            <div className="lib-lesson__main">
              <Link to={`${base}/library/${l.id}`} className="lib-lesson__t">{i + 1}. {l.title}</Link>
              <span className="atl__quiet">{l.slides} slides{l.skills.length ? ` · ${l.skills.join(", ")}` : ""}</span>
            </div>
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
  return (
    <article className="lib-deck" data-deck-view={deck.id} data-slide={i + 1}>
      <p className="atl__kicker">{deck.guide ? <Link to={`${base}/library/${deck.guide.id}`} className="atl__link">{deck.guide.name}</Link> : "Library"} · {deck.title}</p>
      <div className="lib-slide" data-slide-tag={s.tag}>
        <p className="lib-slide__tag">{slideLabel(i, deck.slides.length, s.tag)}</p>
        <h1 className="atl__title lib-slide__title">{s.title}</h1>
        {!last && <ul className="lib-slide__points">{s.points.map((p, k) => <li key={k}>{p}</li>)}</ul>}
        {last && (deck.check.question ? (
          <div className="lib-check" data-deck-check="">
            <p className="lib-check__stem">{deck.check.question.stem}</p>
            <ol className="lib-check__choices">
              {deck.check.question.choices.map((c, k) => (
                <li key={k}><button type="button" className="lib-check__choice" disabled={!!answer} aria-pressed={answer?.chosen === k}
                  data-choice-state={answer ? (k === answer.answer ? "right" : k === answer.chosen ? "wrong" : "") : ""} onClick={() => choose(k)}>{c}</button></li>
              ))}
            </ol>
            {answer && !answer.error && <p className="lib-check__why" role="status">{answer.correct ? "Right." : "Not quite."} {Array.isArray(answer.why) ? answer.why[answer.answer] : answer.why || ""}</p>}
            {answer?.error && <p className="atl__quiet" role="alert">{answer.error}</p>}
          </div>
        ) : <p className="atl__quiet" data-deck-check-waiting="">This deck's question is waiting for review — it appears here once it's approved.</p>)}
      </div>
      <div className="lib-deck__nav">
        <DepthButton disabled={i === 0} onClick={() => setI(i - 1)}>← Back</DepthButton>
        <span className="atl__quiet" aria-live="polite">{i + 1} of {deck.slides.length}</span>
        {!last && <DepthButton primary onClick={() => setI(i + 1)}>Next →</DepthButton>}
      </div>
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
