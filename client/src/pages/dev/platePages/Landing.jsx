// ⭐ D197 · PROPOSED (not in Wave 2's table — owner to place) · M3 (47j, lane w2-public) · the landing "/" — "the front
// door", only from the plate library: the title + Sign up free (the one clay point) beside the deck of today's openings
// (dealt one a second, still under reduced motion, no match), every part of draft as a region plate, then the figures and
// what draft does / never does. M1 / M2: docs/revamp/marketing.md §16a. Served at /dev/plate?page=landing (&w=390).
import { useEffect, useState } from "react";
import { Kickers } from "../../../plate/Marks.jsx";
import { PageTitle, StatsStrip, LegHeader } from "../../../plate/Plates.jsx";
import { Opening, DeckPile, Ticket } from "../../../plate/Tickets.jsx";
import { RegionEmblem } from "../../../plate/Drawings.jsx";
import { usePlateMotion } from "../../../plate/motion.js";
import { DRAWINGS } from "../../../plate/drawings/index.js";
import { PublicFrame, POSTINGS } from "./publicFixtures.jsx";

// marketing.md 16a: the shelf's seven books (LandingPage.jsx SHELF), each a plate with its region's emblem
const PARTS = [
  ["Today's picks", "Up to 10 jobs a day that fit your résumé, as a deck. Draft, save or pass each one.", "Get your picks", "#register", "net", "IV"],
  ["Applications", "Draft a job and draft tailors your résumé and fills the employer's own form. Ask me first waits for your approval.", "How applying works", "#how", "lock", "V"],
  ["Atlas", "Your map of the skills each role asks for, and a Library of guides and courses to learn them.", "Open Atlas", "#atlas", "found", "I"],
  ["Interview", "Company guides, a practice interview and a voice coach.", "Start practising", "#register", "mind", "VIII"],
  ["The extension", "Save a job from any site and fill its application. It submits only when you press Submit application.", "Add to Chrome", "#extension", "code", "VI"],
  ["Ask draft", "Tell it what to do in plain words. No AI for anything draft already holds.", "Try it", "#register", "world", "VII"],
  ["ATS check", "Your résumé against one job, read the way an applicant-tracking system reads it. No account, nothing kept.", "Check a résumé", "#ats", "bits", "II"],
];
const PROMISES = [
  [true, "Reads every job against your résumé and shows how close you are."],
  [true, "Tailors a résumé and fills the employer's own form when you Draft a job."],
  [false, "Sends an application in Ask me first before you approve it."],
  [false, "Answers a CAPTCHA or guesses an eligibility answer for you."],
  [false, "Uses your résumé to train an AI model."],
];

export default function LandingMock({ width }) {
  const motion = usePlateMotion();
  const [at, setAt] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (!motion || paused) return undefined;
    const t = setInterval(() => setAt((i) => i + 1), 1000);
    return () => clearInterval(t);
  }, [motion, paused]);
  const p = POSTINGS[at % POSTINGS.length];
  const Signpost = DRAWINGS.PlaceSignpost;
  return (
    <PublicFrame width={width} region="I">
      <main className="pl-page" style={{ display: "flex", flexDirection: "column", gap: 56, paddingTop: 32 }}>
        <section className="pl-hero" style={{ padding: 0 }} aria-labelledby="ld-title">
          <div className="pl-hero__main" style={{ flex: "999 1 420px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
            <Kickers parts={["DRAFT", "FIND · FIT · APPLY", "EXAMPLE DATA"]}/>
            <PageTitle id="ld-title">10 jobs that fit you, every morning</PageTitle>
            <p className="pl-lead">draft reads every job against your résumé and deals you the best ones. Draft a job and it tailors your résumé and fills the employer's form, then waits for you.</p>
            <div className="pl-actions">
              <a className="pl-btn pl-btn--primary" href="#register">Sign up free</a>
              <a className="pl-btn pl-btn--secondary" href="#ats">Check a résumé, no account</a>
            </div>
          </div>
          <div style={{ flex: "1 1 340px", minWidth: 0, maxWidth: 560 }} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)} onBlurCapture={() => setPaused(false)} data-dealing={motion && !paused ? "on" : "paused"}>
            <DeckPile>
              <Opening opening={{ ...p, match: null, type: "Full-time", posted: p.posted.toUpperCase(), companyHref: "#company" }}
                actions={<>
                  <button type="button" className="pl-btn" onClick={() => setAt(at + 1)}>Pass</button>
                  <a className="pl-btn" href="#register">Save</a><span className="pl-grow"/>
                  <a className="pl-btn pl-btn--ink" href="#register">Draft</a>
                </>}/>
            </DeckPile>
          </div>
        </section>

        <section aria-labelledby="ld-parts">
          <LegHeader n={1} id="ld-parts" meta="EACH ONE IS A PART OF DRAFT YOU CAN USE TODAY" title="Everything in draft"/>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20, marginTop: 18 }}>
            {PARTS.map(([title, say, cta, href, kind, region]) => (
              <article key={title} className="pl-card" data-region={region}>
                <div className="pl-card__strip"><span className="pl-label">{title.toUpperCase()}</span></div>
                <div style={{ display: "flex", justifyContent: "center", padding: 12, background: "var(--pl-region-tint)", borderBottom: "var(--pl-border)" }}>
                  <RegionEmblem kind={kind} region={region} size={96} label={`${title}: the ${kind} emblem`}/>
                </div>
                <div className="pl-card__body">
                  <p className="pl-body">{say}</p>
                  <a href={href} style={{ fontWeight: 700, color: "var(--pl-ink)" }}>{cta} →</a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="ld-c" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <LegHeader n={2} id="ld-c" meta="THE PRODUCT IN FIGURES · WHAT IT DOES, AND NEVER DOES" title="Find the jobs that fit. Apply to them well. Stay in charge of what is sent."/>
          <StatsStrip label="draft in figures" cells={[{ value: 10, label: "JOBS PICKED FOR YOU EACH MORNING, AT MOST" }, { value: 16, label: "PLACES DRAFT READS JOBS FROM" },
            { value: 0, label: "AI MODELS READING YOUR RÉSUMÉ TO JUDGE FIT" }, { value: 1, label: "PRESS FROM YOU BEFORE THE EXTENSION SUBMITS" }]}/>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 22, alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 280px", minWidth: 0 }} className="pl-platehero">
              <div className="pl-platehero__frame" style={{ "--pl-aspect": "640 / 520" }}>{Signpost ? <Signpost/> : null}</div>
            </div>
            <ul className="pl-card" style={{ flex: "999 1 420px", minWidth: 0, listStyle: "none", margin: 0, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }} aria-label="What draft does, and never does">
              {PROMISES.map(([ok, text]) => (
                <li key={text} className="pl-card__item">
                  {/* ✓ / ✗ in ink, never the lit green: green means proven (a promise isn't a proof) */}
                  <span aria-hidden="true" className="pl-label" style={{ minWidth: 14 }}>{ok ? "✓" : "✗"}</span>
                  <span><b>{ok ? "Does" : "Never"}</b> · {text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="pl-tickets">
            <Ticket tone="clay-tint" kicker="FREE · NO CARD" title="Sign up free" line="Your first ten picks tomorrow morning." go="Sign up →" href="#register"/>
            <Ticket kicker="THE MARKET · OPEN TO EVERYONE" title="See every open job" line="Read any of them before you sign up." go="Open jobs →" href="#jobs"/>
          </div>
        </section>
      </main>
    </PublicFrame>
  );
}
