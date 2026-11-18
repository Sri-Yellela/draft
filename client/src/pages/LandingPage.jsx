// client/src/pages/LandingPage.jsx — the signed-out landing at "/".
// ⭐ 46v 0d (owner 11-18, from https://claude.ai/artifact/DTSTvRwRUfLpmGjZBXu6p3: "I say A, and instead of the grid type
// feature list, use the shelf leaving the rest as is, and then also use c below it when scrolled down. also put an auto
// scroll scrolling at 1s for the job cards deck and remove text on it like the ats match. use the same card as we use
// inside the site"):
//   A  · the hero — one line, two ways in, and the deck: draft's OWN home card (DeckView's HomeCardStill — the same frame
//        and face as Home), dealt from today's public jobs, the next one every second (paused on hover / focus, still
//        under reduced motion). A public job has no score, so the card shows no match. The deck's own Pass / Save / Draft
//        buttons under it ("Draft", never "/dDraft" — the owner's fix to the sketch).
//   B's shelf · the features as books (components/BookShelf.jsx — the Library's own books); a book opens its note below.
//   C  · facts and promises: one statement, the product in figures, and what draft does and never does.
// The old search bar, job grid and find → fit → apply line left with this; every open job is one link away (/jobs).
// Auth is passed as a prop from App.jsx — the landing is only ever rendered signed out.
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { StampLogo } from "../components/StampLogo.jsx";
import { HomeCardStill, HomeCardBackStill, CardBackDefs, ActionButton } from "../panels/DeckView.jsx";
import { BookShelf, BookSpine } from "../components/BookShelf.jsx";
import { NoteCard, Facts, Promises } from "../components/TextBlocks.jsx";
import { HOME_CARD } from "../lib/fanGeometry.js";
import { api } from "../lib/api.js";
import { openPosting } from "../lib/openPosting.js";
import "./LandingPage.css";

/** How often the hero deck deals its next card (owner 11-18: "auto scroll … at 1s"). */
export const DEAL_EVERY_MS = 1000;
/** = services/dailyDraft.js DECK_SIZE and the sources registered in services/jobs/aggregator.js (test/landing46v pins both). */
export const PICKS_A_DAY = 10;
export const SOURCE_COUNT = 16;

// The shelf: one book per part of draft a visitor can use or sign up for today.
export const SHELF = Object.freeze([
  { id: "feat-picks", kind: "Daily", title: "Today's picks", foot: `${PICKS_A_DAY} a day`,
    say: `Up to ${PICKS_A_DAY} jobs a day that fit your résumé, as a deck. Draft, save or pass each one.`, to: "/register", cta: "Get your picks" },
  { id: "feat-apply", kind: "Apply", title: "Applications", foot: "2 modes",
    say: "Draft a job and draft tailors your résumé and fills the employer's own form. Ask me first waits for your approval; Apply for me sends within the limits you set.",
    to: "/how-it-works", cta: "How applying works" },
  { id: "feat-atlas", kind: "Learn", title: "Atlas", foot: "your map",
    say: "Your map of the skills each role asks for, and a Library of guides and courses to learn them.", to: "/atlas", cta: "Open Atlas" },
  { id: "feat-interview", kind: "Practise", title: "Interview", foot: "coach",
    say: "Company guides, a practice interview and a voice coach.", to: "/register", cta: "Start practising" },
  { id: "feat-extension", kind: "Chrome", title: "The extension", foot: "side panel",
    say: "Save a job from any site and fill its application. It submits only when you press Submit application.", to: "/extension", cta: "Add to Chrome" },
  { id: "feat-ask", kind: "Help", title: "Ask draft", foot: "/d",
    say: "Tell it what to do in plain words. No AI for anything draft already holds.", to: "/register", cta: "Try it" },
  { id: "feat-ats", kind: "Check", title: "ATS check", foot: "free",
    say: "Your résumé against one job, read the way an applicant-tracking system reads it. No account, and nothing is kept.", to: "/tools/ats", cta: "Check a résumé" },
]);

export const FIGURES = Object.freeze([
  { value: String(PICKS_A_DAY), label: "jobs picked for you each morning, at most" },
  { value: String(SOURCE_COUNT), label: "places draft reads jobs from, employers' own boards first" },
  { value: "0", label: "AI models reading your résumé to judge fit" },
  { value: "1", label: "press from you before the extension submits" },
]);
export const PROMISE_ITEMS = Object.freeze([
  { ok: true, text: "Reads every job against your résumé and shows how close you are." },
  { ok: true, text: "Tailors a résumé and fills the employer's own form when you Draft a job." },
  { ok: false, text: "Sends an application in Ask me first before you approve it." },
  { ok: false, text: "Answers a CAPTCHA or guesses an eligibility answer for you." },
  { ok: false, text: "Uses your résumé to train an AI model." },
]);

/** The hero's deck: the site's own card, dealt from public jobs, one a second. */
function HeroDeck({ jobs }) {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [at, setAt] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = jobs.length;
  const next = useCallback(() => setAt((i) => (n ? (i + 1) % n : 0)), [n]);
  useEffect(() => {
    if (reduced || paused || n < 2) return undefined;
    const t = setInterval(() => { if (!document.hidden) next(); }, DEAL_EVERY_MS);
    return () => clearInterval(t);
  }, [reduced, paused, n, next]);
  const job = n ? jobs[at % n] : null;
  const behind = n > 1 ? [jobs[(at + 1) % n], jobs[(at + 2) % n]].filter(Boolean) : [];
  const open = (j) => () => { void openPosting(j); };   // lib/openPosting.js — the one way a posting opens (the extension hand-off included)
  return (
    <div className="lp2-deck" data-landing-deck="" data-dealing={reduced || paused ? "paused" : "on"}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)} onBlurCapture={() => setPaused(false)}>
      <CardBackDefs />
      <div className="lp2-deck__stack" style={{ width: HOME_CARD.width, height: HOME_CARD.height }}>
        {behind.map((j, i) => (
          <div key={`back-${i}`} className={`lp2-deck__back lp2-deck__back--${i + 1}`}><HomeCardBackStill job={j} /></div>
        ))}
        {!job && <div className="lp2-deck__front"><HomeCardBackStill job={null} /></div>}
        <AnimatePresence initial={false} mode="popLayout">
          {job && (
            <motion.div key={job.id ?? at} className="lp2-deck__front" aria-live="off"
              initial={reduced ? false : { x: 36, rotate: 2, opacity: 0 }} animate={{ x: 0, rotate: 0, opacity: 1 }}
              exit={reduced ? { opacity: 0 } : { x: -360, rotate: -14, opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }}>
              <HomeCardStill card={{ job }} onOpenPost={open(job)} data-landing-card={job.id} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="lp2-deck__acts" style={{ maxWidth: HOME_CARD.width }}>
        <ActionButton label="Pass" onClick={next} />
        <ActionButton label="Save" onClick={() => navigate("/register")} />
        <ActionButton label="Draft" primary onClick={() => navigate("/register")} />
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [jobs, setJobs] = useState([]);
  const [openId, setOpenId] = useState(SHELF[0].id);
  useEffect(() => {
    let live = true;
    api("/api/jobs/generic?page=1&pageSize=12")
      .then((d) => { if (live && d?.success !== false) setJobs((d.jobs || []).filter((j) => j && j.title && j.company)); })
      .catch(() => { /* the deck shows its back */ });
    return () => { live = false; };
  }, []);
  const book = SHELF.find((b) => b.id === openId) || SHELF[0];
  return (
    <div className="lp2" data-landing="">
      {/* A · the hero */}
      <section className="lp2-hero" aria-labelledby="lp2-h1">
        <div className="lp2-hero__text">
          <StampLogo size="sm" />
          <h1 id="lp2-h1" className="lp2-h1">{PICKS_A_DAY} jobs that fit you, every morning</h1>
          <p className="lp2-lede">draft reads every job against your résumé and deals you the best ones. Draft a job and it tailors your résumé and fills the employer's form, then waits for you.</p>
          <div className="lp2-ctas">
            <Link className="lp2-btn lp2-btn--primary" to="/register">Sign up free</Link>
            <Link className="lp2-btn" to="/tools/ats">Check a résumé, no account</Link>
          </div>
        </div>
        <HeroDeck jobs={jobs} />
      </section>

      {/* B's shelf · the features as books */}
      <section className="lp2-sec" aria-labelledby="lp2-shelf-h" data-landing-shelf="">
        <h2 id="lp2-shelf-h" className="lp2-h2">Everything in draft, on one shelf</h2>
        <p className="lp2-quiet">Pick a book. Each one is a part of draft you can use today.</p>
        <BookShelf>
          {SHELF.map((b, i) => (
            <BookSpine key={b.id} id={b.id} last={i === SHELF.length - 1} kind={b.kind} title={b.title} foot={b.foot}
              label={`${b.title}: ${b.say}`} onClick={() => setOpenId(b.id)} data-landing-book={b.id}
              data-open={b.id === openId ? "true" : undefined} />
          ))}
        </BookShelf>
        <NoteCard id={book.id} title={book.title} data-landing-book-open={book.id}
          actions={<Link className="lp2-btn" to={book.to}>{book.cta}</Link>}>
          {book.say}
        </NoteCard>
      </section>

      {/* C · facts and promises */}
      <section className="lp2-sec lp2-sec--c" aria-labelledby="lp2-c-h" data-landing-promises="">
        <h2 id="lp2-c-h" className="lp2-statement">Find the jobs that fit. Apply to them well. Stay in charge of what is sent.</h2>
        <Facts items={FIGURES} />
        <Promises items={PROMISE_ITEMS} />
        <div className="lp2-ctas">
          <Link className="lp2-btn lp2-btn--primary" to="/register">Sign up free</Link>
          <Link className="lp2-btn" to="/jobs">See every open job</Link>
        </div>
      </section>
    </div>
  );
}
