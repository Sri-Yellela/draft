// client/src/pages/LandingPage.jsx — the signed-out landing at "/".
// ⭐ D197 · 47m (lane public, M5 — the approved mock `landing`, docs/revamp/marketing.md §16a): THE FRONT DOOR, in plate.
//   · the public nav + footer (components/PublicChrome.jsx PublicPage);
//   · the hero: the destination title "10 jobs that fit you, every morning" (82 px serif, clay stop), the lead verbatim,
//     Sign up free = the page's ONE clay point, "Check a résumé, no account" in paper — beside a DeckPile of plate Opening
//     tickets dealt from today's public jobs, the next one every second (paused on hover / focus, still under reduced motion
//     — the one live detail), no match, no résumé marks (a visitor has none; the ticket's stack label says WORKS WITH only);
//     the title opens the posting (lib/openPosting.js — the one way a posting opens); Pass deals the next; Save / Draft →
//     /register (Draft in ink — the clay is Sign up free);
//   · 01 "Everything in draft": the shelf's seven books as REGION PLATES (the mock's answer to marketing.md's shelf-vs-plates
//     question) — each its region's emblem, its name, its one line and its link;
//   · 02 the statement: the figures as a StatsStrip (labels verbatim, PICKS_A_DAY / SOURCE_COUNT pinned), the signpost drawing
//     beside the ruled does / never list (✓ / ✗ in ink — a promise isn't a proof, so no green), and two onward tickets.
// The words are the 46v landing's (marketingClaimsHonest46v, a233RetiredHouseWords). Auth: only ever rendered signed out.
import { useCallback, useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Kickers } from "../plate/Marks.jsx";
import { PageTitle, StatsStrip, LegHeader } from "../plate/Plates.jsx";
import { Opening, DeckPile, Ticket } from "../plate/Tickets.jsx";
import { RegionEmblem } from "../plate/Drawings.jsx";
import { Drawer } from "../plate/PlateState.jsx";
import { DRAWINGS } from "../plate/drawings/index.js";
import { openingFromCard } from "../plate/MarketCardFace.jsx";
import { PublicPage, usePublicGo } from "../components/PublicChrome.jsx";
import { MkLink } from "../components/MarketingFrame.jsx";   // the plate button as a router link, shared with the marketing pages
import { api } from "../lib/api.js";
import { openPosting } from "../lib/openPosting.js";

/** How often the hero deck deals its next card (owner 11-18: "auto scroll … at 1s"). */
export const DEAL_EVERY_MS = 1000;
/** = services/dailyDraft.js DECK_SIZE and the sources registered in services/jobs/aggregator.js (test/landing46v pins both). */
export const PICKS_A_DAY = 10;
export const SOURCE_COUNT = 16;

// The shelf: one plate per part of draft a visitor can use or sign up for today (emblem kind + region: the mock's).
export const SHELF = Object.freeze([
  { id: "feat-picks", kind: "net", region: "IV", title: "Today's picks", foot: `${PICKS_A_DAY} a day`,
    say: `Up to ${PICKS_A_DAY} jobs a day that fit your résumé, as a deck. Draft, save or pass each one.`, to: "/register", cta: "Get your picks" },
  { id: "feat-apply", kind: "lock", region: "V", title: "Applications", foot: "2 modes",
    say: "Draft a job and draft tailors your résumé and fills the employer's own form. Ask me first waits for your approval; Apply for me sends within the limits you set.",
    to: "/how-it-works", cta: "How applying works" },
  { id: "feat-atlas", kind: "found", region: "I", title: "Atlas", foot: "your map",
    say: "Your map of the skills each role asks for, and a Library of guides and courses to learn them.", to: "/atlas", cta: "Open Atlas" },
  { id: "feat-interview", kind: "mind", region: "VIII", title: "Interview", foot: "coach",
    say: "Company guides, a practice interview and a voice coach.", to: "/register", cta: "Start practising" },
  { id: "feat-extension", kind: "code", region: "VI", title: "The extension", foot: "side panel",
    say: "Save a job from any site and fill its application. It submits only when you press Submit application.", to: "/extension", cta: "Add to Chrome" },
  { id: "feat-ask", kind: "world", region: "VII", title: "Ask draft", foot: "/d",
    say: "Tell it what to do in plain words. No AI for anything draft already holds.", to: "/register", cta: "Try it" },
  { id: "feat-ats", kind: "bits", region: "II", title: "ATS check", foot: "free",
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

/** A public job as the plate ticket: no match, no résumé marks (signed out), the company's survey sheet linked. */
export function publicOpening(job) {
  const o = openingFromCard({ job });
  return { ...o, match: null, signedOut: true, stack: (o.stack || []).map((t) => ({ ...t, yours: false })) };
}

/** The hero's deck: plate Opening tickets, dealt from public jobs, one a second. */
function HeroDeck({ jobs }) {
  const go = usePublicGo();
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
  const open = (j) => () => { void openPosting(j); };   // lib/openPosting.js — the one way a posting opens (the extension hand-off included)
  return (
    <div style={{ flex: "1 1 340px", minWidth: 0, maxWidth: 560 }} data-landing-deck="" data-dealing={reduced || paused ? "paused" : "on"}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)} onBlurCapture={() => setPaused(false)}>
      {job ? (
        <DeckPile>
          <Opening opening={publicOpening(job)} rootProps={{ "data-landing-card": job.id }}
            titleProps={{ role: "link", tabIndex: 0, style: { cursor: "pointer" }, onClick: open(job),
              onKeyDown: (e) => { if (e.key === "Enter") open(job)(); } }}
            actions={<>
              <button type="button" className="pl-btn" onClick={next}>Pass</button>
              <a className="pl-btn" href="/register" onClick={(e) => { e.preventDefault(); go("/register"); }}>Save</a>
              <span className="pl-grow"/>
              <a className="pl-btn pl-btn--ink" href="/register" onClick={(e) => { e.preventDefault(); go("/register"); }}>Draft</a>
            </>}/>
        </DeckPile>
      ) : <Drawer kicker="NOT YET" text="Today's jobs are on their way." action={{ label: "See every open job", href: "/jobs" }}/>}
    </div>
  );
}

export default function LandingPage() {
  const go = usePublicGo();
  const [jobs, setJobs] = useState([]);
  useEffect(() => {
    let live = true;
    api("/api/jobs/generic?page=1&pageSize=12")
      .then((d) => { if (live && d?.success !== false) setJobs((d.jobs || []).filter((j) => j && j.title && j.company)); })
      .catch(() => { /* the deck shows its drawer */ });
    return () => { live = false; };
  }, []);
  const Signpost = DRAWINGS.PlaceSignpost;
  const ticketGo = (href) => (e) => { if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); go(href); };
  return (
    <PublicPage region="I" data-landing="">
      <main className="pl-page" style={{ display: "flex", flexDirection: "column", gap: 56, paddingTop: 32 }}>
        {/* the hero: the title page of the atlas — the front door */}
        <section className="pl-hero" style={{ padding: 0 }} aria-labelledby="lp2-h1">
          <div className="pl-hero__main" style={{ flex: "999 1 420px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
            <Kickers parts={["DRAFT", "FIND · FIT · APPLY"]}/>
            <PageTitle id="lp2-h1">{PICKS_A_DAY} jobs that fit you, every morning</PageTitle>
            <p className="pl-lead">draft reads every job against your résumé and deals you the best ones. Draft a job and it tailors your résumé and fills the employer's form, then waits for you.</p>
            <div className="pl-actions">
              <MkLink primary to="/register">Sign up free</MkLink>
              <MkLink to="/tools/ats">Check a résumé, no account</MkLink>
            </div>
          </div>
          <HeroDeck jobs={jobs}/>
        </section>

        {/* 01 · every part of draft as a region plate (the shelf's seven books) */}
        <section aria-labelledby="lp2-shelf-h" data-landing-shelf="">
          <LegHeader n={1} id="lp2-shelf-h" meta="EACH ONE IS A PART OF DRAFT YOU CAN USE TODAY" title="Everything in draft"/>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20, marginTop: 18 }}>
            {SHELF.map((b) => (
              <article key={b.id} id={b.id} className="pl-card" data-region={b.region} data-landing-book={b.id}>
                <div className="pl-card__strip"><span className="pl-label">{b.title.toUpperCase()}</span><span className="pl-label pl-muted">{b.foot.toUpperCase()}</span></div>
                <div style={{ display: "flex", justifyContent: "center", padding: 12, background: "var(--pl-region-tint)", borderBottom: "var(--pl-border)" }}>
                  <RegionEmblem kind={b.kind} region={b.region} size={96} label={`${b.title}: the ${b.kind} emblem`}/>
                </div>
                <div className="pl-card__body">
                  <p className="pl-body">{b.say}</p>
                  <a href={b.to} onClick={ticketGo(b.to)} style={{ fontWeight: 700, color: "var(--pl-ink)" }}>{b.cta} →</a>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* 02 · the statement, the figures, what it does and never does */}
        <section aria-labelledby="lp2-c-h" data-landing-promises="" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <LegHeader n={2} id="lp2-c-h" meta="THE PRODUCT IN FIGURES · WHAT IT DOES, AND NEVER DOES" title="Find the jobs that fit. Apply to them well. Stay in charge of what is sent."/>
          <StatsStrip label="draft in figures" cells={FIGURES.map((f) => ({ value: Number(f.value), label: f.label.toUpperCase() }))}/>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 22, alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 280px", minWidth: 0 }} className="pl-platehero">
              <div className="pl-platehero__frame" style={{ "--pl-aspect": "640 / 520" }}>{Signpost ? <Signpost/> : null}</div>
            </div>
            <ul className="pl-card" style={{ flex: "999 1 420px", minWidth: 0, listStyle: "none", margin: 0, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }} aria-label="What draft does, and never does">
              {PROMISE_ITEMS.map(({ ok, text }) => (
                <li key={text} className="pl-card__item" data-promise={ok ? "does" : "never"}>
                  {/* ✓ / ✗ in ink, never the lit green: green means proven (a promise isn't a proof) */}
                  <span aria-hidden="true" className="pl-label" style={{ minWidth: 14 }}>{ok ? "✓" : "✗"}</span>
                  <span><b>{ok ? "Does" : "Never"}</b> · {text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="pl-tickets">
            <Ticket tone="clay-tint" kicker="FREE · NO CARD" title="Sign up free" line="Your first ten picks tomorrow morning." go="Sign up →" href="/register" onClick={ticketGo("/register")}/>
            <Ticket kicker="THE MARKET · OPEN TO EVERYONE" title="See every open job" line="Read any of them before you sign up." go="Open jobs →" href="/jobs" onClick={ticketGo("/jobs")}/>
          </div>
        </section>
      </main>
    </PublicPage>
  );
}
