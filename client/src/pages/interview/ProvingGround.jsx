// ⭐ D197 Wave 2 #13 · M5 (47m, lane practice; the owner 11-27: "I have reviewed and approved all sketches and mockups") ·
// INTERVIEW AS THE PROVING GROUND, /app/interview/<view or panel> — a plate page (Region VI, Languages & media) built from
// the approved mock (pages/dev/platePages/Interview.jsx) and the board ProvingGround (docs/sketches/final/project/), every
// M1 row of docs/revamp/interview.md kept (D200 Rule 1). It replaces the classic InterviewPage (PlaceNav + .iv__*).
//
//   Views (the shell's area nav — useInterviewAreaNav): Coming up · Prepare · Practise · After = today's four groups; the
//   nine old panel ids stay valid and open their view scrolled to their section (interviewModel.js INTERVIEW_HOMES).
//   ⛔ NOTHING INVENTED (as before): each section draws only what the server holds —
//     Coming up   GET /api/interview/upcoming (the Inbox's interview / assessment mail matched to applications)
//     Prepare     GET /api/interview/questions (the bank by round) · GET|POST /api/interview/stories[/from-profile] ·
//                 D203 (9) "How each company interviews" → the company's survey sheet, its Interviewing here
//     Practise    GET /api/interview/defend (D142 module four — the page's one operable model; nothing recorded) ·
//                 Drills → Atlas's check and the patterns route · the mock interview and the coach (D161, not built)
//     After       GET|POST /api/interview/debriefs (D110 P5 — one question at a time) · Past sessions (not built)
//   The hill (ProvingGroundHill, ported from the board): the five rounds as benches; a bench is lit only by proof — nothing
//   proves a round today, so none is lit and no "you" beacon is drawn (agent's pick, docs/revamp/interview.md "What was
//   built"); the next interview is the flag.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PlateRoot from "../../plate/PlateRoot.jsx";
import { LitSquares, Stamp } from "../../plate/Marks.jsx";
import { StatsStrip, LegHeader } from "../../plate/Plates.jsx";
import { Ticket, QuestionTicket } from "../../plate/Tickets.jsx";
import { Gazetteer, RouteLine } from "../../plate/Lists.jsx";
import { Drawer, ErrorLine, Skeleton } from "../../plate/PlateState.jsx";
import ProvingGroundHill from "../../plate/drawings/ProvingGroundHill.jsx";
import ProvingGroundChair from "../../plate/drawings/ProvingGroundChair.jsx";
import { api } from "../../lib/api.js";
import { companyPath } from "../../lib/companySlug.js";
import { isoWeekOf } from "../../plate/ledgerModel.js";
import "../../plate/practicePlate.css";
import { INTERVIEW_VIEWS, interviewPath, interviewViewOf, interviewSectionOf, TRACKS, bankCounts, whenWords, upcomingHeadline,
  DEFEND_START, defendNext, defendAnotherLine, clockWords } from "./interviewModel.js";

const ROUND_WORDS = { coding: "Coding", system_design: "System design", ml: "Machine learning", behavioural: "Behavioural", other: "Other" };
const WENT_WORDS = { well: "Went well", mixed: "Mixed", poorly: "Went poorly" };
const KIND_WORDS = { interview: "Interview", assessment: "Assessment" };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** One GET, with its loading and error states; `reload` reads it again. */
function useRead(path) {
  const [state, setState] = useState({ status: "loading", data: null, error: "" });
  const reload = useCallback(() => {
    let live = true;
    api(path).then((d) => live && setState({ status: "ready", data: d, error: "" }))
      .catch((e) => live && setState({ status: "error", data: null, error: e?.message || "Could not be reached." }));
    return () => { live = false; };
  }, [path]);
  useEffect(() => reload(), [reload]);
  return [state, reload];
}

/** An in-app link for a plate piece's plain anchor: the router moves, the page never reloads. */
const useGo = () => {
  const navigate = useNavigate();
  return useCallback((href) => (e) => {
    if (!href || /^https?:/.test(href) || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
    e.preventDefault();
    navigate(href);
  }, [navigate]);
};

const isPast = (it) => it.daysLeft != null && it.daysLeft < 0;
const whenLine = (it) => (it.date
  ? [whenWords(it.daysLeft), it.date.ymd, it.date.time].filter(Boolean).join(" · ")
  : "no date yet — add it in Prepare").toUpperCase();

/** The area nav's views (the shell's ShellAreaNav draws them): the four views; Coming up carries the count ahead. */
export function useInterviewAreaNav(panel) {
  const navigate = useNavigate();
  const [up] = useRead("/api/interview/upcoming");
  const ahead = (up.data?.interviews || []).filter((i) => !isPast(i)).length;
  const views = INTERVIEW_VIEWS.map((v) => ({ ...v, href: interviewPath(v.id), label: v.id === "upcoming" && ahead ? `${v.label} · ${ahead}` : v.label }));
  return { area: "Interview", views, current: interviewViewOf(panel), placeholder: "Company or round…", onGo: (id) => navigate(interviewPath(id)) };
}

// ── the header: the one-line title (D200 Rule 3), the stats strip, the hill ───────────────────────────────────────────
function Header({ kicker, title, lead, cells, next }) {
  const flag = next ? [`${(next.company || "AN APPLICATION").toUpperCase()} · ${(KIND_WORDS[next.kind] || "Interview").toUpperCase()}`, whenLine(next)] : null;
  const label = `The proving ground: a hill with five rounds as benches, from ${TRACKS[0].label} at the foot to ${TRACKS[TRACKS.length - 1].label} at the top. `
    + (next ? `${next.company || "An application"}'s ${(KIND_WORDS[next.kind] || "interview").toLowerCase()} is flagged: ${whenLine(next).toLowerCase()}.` : "No interview is flagged yet.");
  return (
    <section className="pl-hero" aria-label="Proving ground">
      <div className="pl-hero__main">
        <LegHeader meta={kicker} title={title} level={1}/>
        {lead ? <p className="pl-lead">{lead}</p> : null}
        {cells ? <StatsStrip label="Your interviews" cells={cells}/> : null}
      </div>
      <div className="pl-iv__hero">
        <ProvingGroundHill label={label} names={TRACKS.map((t) => t.label)} lit={0} you={null} flag={flag}/>
      </div>
    </section>
  );
}

// ── Coming up ─────────────────────────────────────────────────────────────────────────────────────────────────────────
export function ComingUp({ up, reload, counts, onView }) {   // exported for the F5 fixture (plate/practiceFixtures.jsx)
  const go = useGo();
  const items = up.data?.interviews || [];
  const ahead = items.filter((i) => !isPast(i)), past = items.filter(isPast);
  const soonest = ahead[0] || null;
  const ticket = (it, primary) => {
    const href = `/app/job/${it.applicationId}?tab=prep`;
    return (
      <Ticket key={it.applicationId} kicker={`${(KIND_WORDS[it.kind] || "Interview").toUpperCase()} · ${whenLine(it)}`} title={it.company || "An application"}
        line={[it.title, it.subject ? `“${it.subject}”` : null].filter(Boolean).join(" · ")} go="Prepare →" href={href} onClick={go(href)}
        tone={primary ? "clay-tint" : "plain"}/>
    );
  };
  const survey = soonest?.company ? companyPath(soonest.company) : null;
  return (
    <>
      <Header kicker={`PROVING GROUND · COMING UP · WEEK ${isoWeekOf()}`} title={up.status === "ready" ? upcomingHeadline(items) : "Your interviews"} next={soonest}
        lead="Found in your Inbox and matched to your applications."
        cells={[
          { value: up.status === "ready" ? ahead.length : null, label: "AHEAD", onClick: () => document.getElementById("iv-up")?.scrollIntoView?.({ behavior: "smooth" }) },
          { value: counts.questions, label: "QUESTIONS IN YOUR BANK", onClick: () => onView("tracks") },
          { value: counts.stories, label: "STORIES", onClick: () => onView("tracks") },
          { value: counts.debriefs, label: "DEBRIEFS", onClick: () => onView("debrief") },
        ]}/>
      <section className="pl-section" aria-labelledby="iv-up-t" data-interview-section="upcoming">
        <LegHeader n={1} meta="FOUND IN YOUR INBOX · MATCHED TO YOUR APPLICATIONS" title={<span id="iv-up-t">Your interviews</span>} id="iv-up"/>
        {up.status === "loading" ? <Skeleton label="Loading your interviews" height={170}/> : null}
        {up.status === "error" ? <ErrorLine text={`Your interviews could not be loaded: ${up.error}`} onRetry={reload}/> : null}
        {up.status === "ready" && !items.length ? (
          <Drawer title="No interview invites yet" data-upcoming-empty=""
            text="When an interview or assessment email reaches your Inbox — through Gmail or forwarding — and matches one of your applications, it shows here with a Prepare button. Every application email stays in Home's Inbox."
            actions={<Link className="pl-btn" to="/app/profile/connections">Connect your mail</Link>}/>
        ) : null}
        {ahead.length ? <div className="pl-tickets" data-upcoming-list="">{ahead.map((it, i) => ticket(it, i === 0))}</div> : null}
        {past.length ? (
          <>
            <p className="pl-label pl-muted pl-iv__sub">RECENT</p>
            <div className="pl-tickets pl-iv__tight" data-upcoming-past="">
              {past.map((it) => (
                <Ticket key={it.applicationId} kicker={`${(KIND_WORDS[it.kind] || "Interview").toUpperCase()} · ${whenLine(it)}`} title={it.company || "An application"}
                  line={[it.title, it.subject ? `“${it.subject}”` : null].filter(Boolean).join(" · ")} go="Prepare →"
                  href={`/app/job/${it.applicationId}?tab=prep`} onClick={go(`/app/job/${it.applicationId}?tab=prep`)}/>
              ))}
            </div>
          </>
        ) : null}
      </section>
      <section className="pl-section pl-section--last" aria-label="Onward">
        <LegHeader n={2} meta="ONWARD" title={soonest ? `Before ${soonest.company || "your next round"}` : "Before your next round"}/>
        <div className="pl-tickets">
          {survey ? <Ticket kicker={`SURVEY SHEET · ${soonest.company.toUpperCase()} · INTERVIEWING HERE`} title={`How ${soonest.company} interviews`}
            line="Their stages and what people were asked — being written from shared debriefs." go="Open the survey sheet →"
            href={`${survey}#interviewing-here`} onClick={go(`${survey}#interviewing-here`)}/> : null}
          <Ticket kicker="PRACTISE · DEFEND YOUR RÉSUMÉ" title="Every line you wrote, asked about" line="The follow-ups an interviewer would ask about your own bullets."
            go="Start →" href={interviewPath("defend")} onClick={go(interviewPath("defend"))}/>
          <Ticket kicker="AFTER · DEBRIEF" title="Log the round" line="Two minutes while it's fresh — its questions go into your bank." go="Debrief →"
            href={interviewPath("debrief")} onClick={go(interviewPath("debrief"))}/>
        </div>
      </section>
    </>
  );
}

// ── Prepare ───────────────────────────────────────────────────────────────────────────────────────────────────────────
function Prepare({ up, questions, stories, reloadStories }) {
  const go = useGo();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const counts = bankCounts(questions.data?.questions || []);
  const list = stories.data?.stories || [];
  const seed = async () => {
    setMsg(""); setBusy(true);
    try { const r = await api("/api/interview/stories/from-profile", { method: "POST" }); reloadStories(); setMsg(r?.added != null ? `${plural(r.added, "story", "stories")} started from your experience.` : "Started from your experience."); }
    catch (e) { setMsg(e?.message || "That did not work — nothing changed."); }
    finally { setBusy(false); }
  };
  const roundWords = (t) => {
    const n = t.bank ? counts[t.bank] || 0 : null;
    return n == null ? "No question bank for this round yet" : n ? `${plural(n, "question")} from your debriefs` : "No questions yet — add them in a debrief";
  };
  // a round's stop is "underway" when your bank holds its questions, else "ahead" — never lit for a count (lit = proven)
  const stops = TRACKS.map((t) => ({ name: t.label, state: t.bank && counts[t.bank] ? "underway" : "ahead" }));
  const rows = TRACKS.map((t) => ({ id: t.id, name: t.label, words: roundWords(t),
    stories: t.id === "behavioural" && stories.status === "ready" ? `${plural(list.length, "story", "stories")} in your bank` : "—" }));
  const companies = [...new Map((up.data?.interviews || []).filter((i) => !isPast(i) && i.company).map((i) => [i.company, i])).values()];
  return (
    <>
      <Header kicker="PROVING GROUND · PREPARE" title="Each kind of round" next={(up.data?.interviews || []).find((i) => !isPast(i)) || null}
        lead="What you have for each round so far: the questions from your own debriefs, and your stories for behavioural rounds."/>
      <section className="pl-section" aria-labelledby="iv-rounds-t" data-interview-section="tracks" data-tracks="">
        <LegHeader n={1} meta="FIVE ROUNDS · YOUR OWN BANK · PRACTICE TRACKS COMING" title={<span id="iv-rounds-t">The rounds</span>} id="iv-rounds"/>
        <RouteLine label="The rounds" stops={stops}/>
        <div className="pl-iv__gap">
          {questions.status === "loading" ? <Skeleton label="Loading your bank" height={200}/>
            : questions.status === "error" ? <ErrorLine text={`Your question bank could not be loaded: ${questions.error}`}/>
            : <Gazetteer label="Your bank by round" rowProps={(r) => ({ "data-track": r.id })}
                cols={[{ key: "name", label: "ROUND", kind: "title" }, { key: "words", label: "YOUR BANK" }, { key: "stories", label: "STORIES" }]} rows={rows}/>}
        </div>
        <p className="pl-label pl-muted pl-iv__sub">PRACTICE TRACKS FOR EACH ROUND ARE COMING; WHAT IS LISTED HERE IS YOUR OWN.</p>
      </section>
      <section className="pl-section" aria-labelledby="iv-stories-t" data-story-bank="">
        <LegHeader n={2} meta="SITUATION · TASK · ACTION · RESULT · SHOWN IN EVERY INTERVIEW'S PREP" title={<span id="iv-stories-t">Your story bank</span>} id="iv-stories"/>
        {stories.status === "loading" ? <Skeleton label="Loading your stories" height={160}/> : null}
        {stories.status === "error" ? <ErrorLine text={`Your stories could not be loaded: ${stories.error}`} onRetry={reloadStories}/> : null}
        {stories.status === "ready" && !list.length ? (
          <Drawer text="No stories yet. Start them from your experience — each becomes a story in situation, task, action, result form for you to edit."
            actions={<button type="button" className="pl-btn" onClick={seed} disabled={busy} data-seed-stories="">Start from my experience</button>}/>
        ) : null}
        {list.length ? (
          <Gazetteer label="Your stories" cols={[{ key: "title", label: "STORY", kind: "title" }, { key: "themes", label: "THEMES" }]}
            rows={list.slice(0, 12).map((s) => ({ id: s.id, title: s.title || "A story", themes: (s.themes || []).join(" · ").toUpperCase() || "—" }))}/>
        ) : null}
        {msg ? <p className="pl-muted pl-iv__meta" role="status">{msg}</p> : null}
      </section>
      <section className="pl-section pl-section--last" aria-labelledby="iv-guides-t" data-interview-section="guides">
        <LegHeader n={3} meta="D203 (9) · LIVES ON EACH SURVEY SHEET" title={<span id="iv-guides-t">How each company interviews</span>} id="iv-guides"/>
        {companies.length ? (
          <div className="pl-tickets">
            {companies.map((c) => {
              const href = companyPath(c.company);
              return href ? <Ticket key={c.company} kicker={`SURVEY SHEET · ${c.company.toUpperCase()} · INTERVIEWING HERE`} title={`How ${c.company} interviews`}
                line="The stages, what people were asked, and where it came from — being written from shared debriefs." go="Open the survey sheet →"
                href={`${href}#interviewing-here`} onClick={go(`${href}#interviewing-here`)}/> : null;
            })}
          </div>
        ) : (
          <Drawer kicker="BUILT FROM SHARED DEBRIEFS, WITH SOURCES" data-coming="guides"
            text="How each company interviews, by level — the stages, what people were asked, and where it came from — lives on its survey sheet. Until then, each interview's Prepare reads its job: the skills it asks for against yours, and the rounds it likely has."
            actions={<Link className="pl-btn" to={interviewPath("upcoming")}>Your interviews</Link>}/>
        )}
      </section>
    </>
  );
}

// ── Practise · Defend (the page's one operable model) ─────────────────────────────────────────────────────────────────
function DefendWalk() {
  const [s] = useRead("/api/interview/defend");
  const bullets = s.data?.bullets || [];
  const [pos, setPos] = useState(DEFEND_START);
  const [typed, setTyped] = useState("");
  const [sec, setSec] = useState(0);
  const [done, setDone] = useState(() => new Set());   // this session only — Defend keeps nothing (agent's pick)
  const talking = pos.stage === "answering" && pos.mode === "voice";
  useEffect(() => {
    if (!talking) return undefined;
    setSec(0);
    const t = setInterval(() => setSec((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [talking, pos.line, pos.q]);
  if (s.status === "loading") return <Skeleton label="Reading your résumé" height={380}/>;
  if (s.status === "error") return <ErrorLine text={`Your résumé could not be read: ${s.error}`}/>;
  if (!s.data?.hasResume) return <Drawer title="No résumé yet" data-defend-empty="no-resume" text="Add your résumé to your Profile and every bullet on it gets the questions an interviewer would ask." actions={<Link className="pl-btn" to="/app/profile">Open your Profile</Link>}/>;
  if (!bullets.length) return <Drawer title="No bullets found" data-defend-empty="no-bullets" text="Your résumé has no bullet lines under its experience. Lines that start with a bullet (•, -, *) are the ones asked about."/>;
  const b = bullets[pos.line] || bullets[0], q = b.questions?.[pos.q] || b.questions?.[0];
  if (!q) return <Drawer text="No follow-ups for this line yet."/>;
  const advance = (next) => { setPos(next); setTyped(""); };
  const finishHarder = () => { setDone((d) => new Set(d).add(`${pos.line}:${pos.q}`)); advance(defendNext(pos, bullets)); };
  const squares = bullets.flatMap((x, li) => (x.questions || []).map((_, qi) => (done.has(`${li}:${qi}`) ? "lit" : li === pos.line && qi === pos.q ? "today" : null)));
  const where = `LINE ${pos.line + 1} OF ${bullets.length}${b.employer ? ` · ${b.employer.toUpperCase()}` : ""} · QUESTION ${pos.q + 1} OF ${b.questions.length}`;
  const quote = <p className="pl-body pl-iv__quote">“{b.text}”</p>;
  const root = { "data-defend-line": b.id, "data-defend-kind": q.kind, "data-defend-stage": pos.stage };
  const another = bullets.length > 1 && pos.stage !== "harder"
    ? <button type="button" className="pl-btn" onClick={() => advance(defendAnotherLine(pos, bullets))} data-defend-another="">Another line</button> : null;
  let ticket;
  if (pos.stage === "harder") {
    ticket = <QuestionTicket rootProps={root} kicker="THEN THE INTERVIEWER PUSHES" n={where} text={q.harder} kind="yesno" saveLabel={null} pressed={null} progress={squares}
      options={[pos.q + 1 < b.questions.length ? "Next question" : "Next line"]} onAnswer={finishHarder}>{quote}</QuestionTicket>;
  } else if (pos.stage === "answering" && pos.mode === "typed") {
    ticket = <QuestionTicket rootProps={root} kicker="THE INTERVIEWER ASKS" n={where} text={q.ask} kind="draft" value={typed} onChange={setTyped} saveLabel={null}
      onNext={() => advance(defendNext(pos, bullets))} nextLabel="Done" canNext={!!typed.trim()} progress={squares} more={another}>
      {quote}<p className="pl-label pl-muted">STAYS ON THIS PAGE — NOTHING IS SENT OR KEPT</p></QuestionTicket>;
  } else if (pos.stage === "answering") {
    ticket = <QuestionTicket rootProps={root} kicker="THE INTERVIEWER ASKS" n={where} text={q.ask} kind="yesno" options={["Done"]} pressed={null} saveLabel={null} progress={squares}
      onAnswer={() => advance(defendNext(pos, bullets))} more={another}>
      {quote}
      <p className="pl-iv__clock" data-defend-clock="">
        <span className="pl-stats__num" role="timer" aria-live="off">{clockWords(sec)}</span>
        <span className="pl-muted pl-iv__meta">Say it out loud, as in the room. Nothing is recorded.</span>
      </p>
    </QuestionTicket>;
  } else {
    ticket = <QuestionTicket rootProps={root} kicker="THE INTERVIEWER ASKS" n={where} text={q.ask} kind="yesno" options={["Answer out loud", "Type it"]} pressed={null} saveLabel={null}
      progress={squares} more={another} onAnswer={(o) => setPos({ ...pos, stage: "answering", mode: o === "Type it" ? "typed" : "voice" })}>
      {quote}{q.because ? <p className="pl-label pl-muted" data-defend-because="">WHY IT’S ASKED · {q.because.toUpperCase()}</p> : null}
    </QuestionTicket>;
  }
  return (
    <div className="pl-iv__split">
      <div className="pl-iv__main">
        {ticket}
        <p className="pl-muted pl-iv__meta">Lines most likely to be probed come first. To compare a tailored résumé with your original, <Link to="/tools/honesty">run the honesty check</Link>.</p>
      </div>
      <div className="pl-iv__side">
        <div className="pl-iv__frame"><ProvingGroundChair/></div>
        <span className="pl-label">THIS SESSION</span>
        <LitSquares squares={squares} size={16} label={`${done.size} of ${squares.length} follow-ups answered to the harder question`}/>
        <p className="pl-muted pl-iv__meta">A square lights when you've answered the harder follow-up — never for opening a line.</p>
      </div>
    </div>
  );
}

function Practise({ up }) {
  const go = useGo();
  return (
    <>
      <Header kicker="PROVING GROUND · PRACTISE" title="Every line you wrote, asked about" next={(up.data?.interviews || []).find((i) => !isPast(i)) || null}
        lead="The coach picks a bullet and asks the follow-ups an interviewer would."/>
      <section className="pl-section" aria-labelledby="iv-defend-t" data-interview-section="defend">
        <LegHeader n={1} meta="FROM YOUR BASE RÉSUMÉ · TEMPLATES, NO MODEL · NOTHING RECORDED" title={<span id="iv-defend-t">Defend your résumé</span>} id="iv-defend"/>
        <DefendWalk/>
      </section>
      <section className="pl-section" aria-labelledby="iv-drills-t" data-interview-section="drills">
        <LegHeader n={2} meta="TIMED · EXTENDED TIME · UNTIMED — NEVER COUNTS AGAINST YOU" title={<span id="iv-drills-t">Drills</span>} id="iv-drills"/>
        <div className="pl-tickets">
          <Ticket kicker="ATLAS · A QUICK CHECK" title="Check a skill in a few minutes" line="Timed, with extended time, or untimed practice." go="Start a check →"
            href="/app/atlas/check" onClick={go("/app/atlas/check")}/>
          <Ticket kicker="ATLAS · CODING INTERVIEW PATTERNS" title="Coding interview patterns" line="The patterns behind most interview problems — the idea, how to spot it, and problems to practise."
            go="Open the patterns →" href="/app/atlas/library/coding-interview-patterns" onClick={go("/app/atlas/library/coding-interview-patterns")}/>
        </div>
      </section>
      <section className="pl-section pl-section--last" aria-labelledby="iv-mock-t" data-interview-section="mock">
        <LegHeader n={3} meta="D161 · NOT BUILT IN DRAFT YET" title={<span id="iv-mock-t">Mock interview and the coach</span>} id="iv-mock"/>
        <div className="pl-iv__pair">
          <Drawer kicker="MOCK INTERVIEW · NOT YET" data-coming="mock" title="Talk it through, like the real thing"
            text="draft's own mock interview, with voice, is coming. Today you can run one in your own Claude: connect draft under Connections, and your Claude gets the posting, your experience and your own past questions as data to interview you with."
            actions={<><Link className="pl-btn" to="/app/profile/connections">Set it up</Link><Link className="pl-btn" to="/docs/claude">How it works</Link></>}/>
          <Drawer kicker="ASK THE COACH · NOT YET" data-coming="coach" title="Ask a question, hear a strong answer"
            text="Coming — not built yet. The coach will answer from your own résumé, each answer labelled as an example, never a claim you could not make yourself."/>
        </div>
      </section>
    </>
  );
}

// ── After · Debrief, one question at a time (every field of the old form, in its order) ───────────────────────────────
const BLANK = { applicationId: "", round: "other", heldOn: "", went: "", questions: "", notes: "" };
function DebriefSteps({ apps, onSaved }) {
  const appLabel = (a) => [a.company, a.title].filter(Boolean).join(" · ");
  const steps = useMemo(() => [
    ...(apps.length ? [{ key: "applicationId", kind: "choice", text: "Which application was it for?", options: ["No application", ...apps.map(appLabel)] }] : []),
    { key: "round", kind: "choice", text: "Which round?", options: Object.values(ROUND_WORDS) },
    { key: "heldOn", kind: "text", text: "When was it? (YYYY-MM-DD)" },
    { key: "went", kind: "yesno", text: "How did it go?", options: Object.values(WENT_WORDS) },
    { key: "questions", kind: "draft", text: "Questions you remember (one a line)" },
    { key: "notes", kind: "draft", text: "Notes" },
  ], [apps]);   // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(0);
  const [f, setF] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const st = steps[Math.min(i, steps.length - 1)];
  const last = i >= steps.length - 1;
  // the form's values are kept in the old body's words; a step shows the readable word
  const shown = st.key === "applicationId" ? (f.applicationId ? appLabel(apps.find((a) => String(a.applicationId) === String(f.applicationId)) || {}) : "")
    : st.key === "round" ? ROUND_WORDS[f.round] : st.key === "went" ? WENT_WORDS[f.went] : f[st.key];
  const set = (v) => setF((x) => {
    if (st.key === "applicationId") { const a = apps.find((y) => appLabel(y) === v); return { ...x, applicationId: a ? a.applicationId : "" }; }
    if (st.key === "round") return { ...x, round: Object.keys(ROUND_WORDS).find((k) => ROUND_WORDS[k] === v) || "other" };
    if (st.key === "went") return { ...x, went: Object.keys(WENT_WORDS).find((k) => WENT_WORDS[k] === v) || "" };
    return { ...x, [st.key]: v };
  });
  const save = async () => {
    setBusy(true); setMsg("");
    try {
      await api("/api/interview/debriefs", { method: "POST", body: JSON.stringify({
        applicationId: f.applicationId || null, round: f.round, heldOn: f.heldOn || null, went: f.went || null, notes: f.notes,
        questions: f.questions.split("\n").map((x) => x.trim()).filter(Boolean) }) });
      setF(BLANK); setI(0); setMsg("Saved. Its questions are in your bank, under its round."); onSaved?.();
    } catch (err) { setMsg(err?.message || "It was not saved."); }
    finally { setBusy(false); }
  };
  const next = () => { if (last) save(); else setI(i + 1); };
  const progress = steps.map((_, k) => (k < i ? "lit" : k === i ? "today" : null));
  return (
    <QuestionTicket rootProps={{ "data-debrief-form": "", "data-debrief-step": st.key }} kicker="TWO MINUTES WHILE IT’S FRESH · PRIVATE TO YOU" n={`QUESTION ${i + 1} OF ${steps.length}`}
      text={st.text} kind={st.kind} options={st.options} pressed={st.kind === "yesno" ? shown ?? null : undefined}
      onAnswer={(o) => { set(o); if (!last) setI(i + 1); }} value={shown ?? ""} onChange={set} saveLabel={null}
      onNext={st.kind === "yesno" ? undefined : next} nextLabel={last ? "Save the debrief" : "Next"} canNext={!busy}
      onBack={i ? () => setI(i - 1) : undefined} backDisabled={!i}
      more={st.kind === "yesno" ? <button type="button" className="pl-btn" onClick={next} disabled={busy}>{last ? "Save the debrief" : "Skip"}</button> : null}
      progress={progress}>
      {msg ? <p className={`pl-label ${/^Saved/.test(msg) ? "pl-tone-lit" : ""}`} role="status">{msg.toUpperCase()}</p> : null}
    </QuestionTicket>
  );
}

function After({ up, debriefs, reloadDebriefs }) {
  const apps = up.data?.interviews || [];
  const nameOf = (id) => { const a = apps.find((x) => String(x.applicationId) === String(id)); return a ? [a.company, a.title].filter(Boolean).join(" · ") : null; };
  const list = debriefs.data?.debriefs || [];
  return (
    <>
      <Header kicker="PROVING GROUND · AFTER" title="Two minutes while it's fresh" next={apps.find((i) => !isPast(i)) || null}
        lead="What each round asked and how it went. Kept private to you — nothing here is shared."/>
      <section className="pl-section" aria-labelledby="iv-debrief-t" data-interview-section="debrief">
        <LegHeader n={1} meta="ITS QUESTIONS GO INTO YOUR BANK, UNDER ITS ROUND" title={<span id="iv-debrief-t">Debrief</span>} id="iv-debrief"/>
        <div className="pl-iv__split">
          <div className="pl-iv__main"><DebriefSteps apps={apps} onSaved={reloadDebriefs}/></div>
        </div>
        <div className="pl-iv__gap">
          {debriefs.status === "loading" ? <Skeleton label="Loading your debriefs" height={160}/> : null}
          {debriefs.status === "error" ? <ErrorLine text={`Your debriefs could not be loaded: ${debriefs.error}`} onRetry={reloadDebriefs}/> : null}
          {debriefs.status === "ready" && !list.length ? <Drawer text="No debriefs yet." data-debriefs-empty=""/> : null}
          {list.length ? (
            <Gazetteer label="Your debriefs" rowProps={(r) => ({ "data-debrief": r.id })}
              cols={[{ key: "round", label: "ROUND", kind: "title" }, { key: "for", label: "FOR" }, { key: "when", label: "WHEN" }, { key: "went", label: "HOW IT WENT" }, { key: "qs", label: "QUESTIONS" }, { key: "notes", label: "NOTES" }]}
              rows={list.map((x) => ({ id: x.id, round: ROUND_WORDS[x.round] || x.round, for: (x.applicationId && nameOf(x.applicationId)) || "—", when: x.heldOn || "—",
                went: WENT_WORDS[x.went] || "—", qs: x.questions?.length ? plural(x.questions.length, "question") : "—", notes: x.notes || "—" }))}/>
          ) : null}
        </div>
      </section>
      <section className="pl-section pl-section--last" aria-labelledby="iv-past-t" data-interview-section="past">
        <LegHeader n={2} meta="EACH MOCK INTERVIEW WILL LEAVE A REPORT HERE" title={<span id="iv-past-t">Past sessions</span>} id="iv-past"/>
        <Drawer data-past-empty="" title="No practice sessions yet"
          text="Nothing is recorded until the mock interview runs in draft. Pace, filler words, structure and what to work on will show here. Your debriefs are above."
          actions={<Link className="pl-btn" to={interviewPath("debrief")}>Your debriefs</Link>}/>
        <div className="pl-iv__gap"><Stamp tone="ink" rotate={-4}>NOT YET · D161</Stamp></div>
      </section>
    </>
  );
}

export default function ProvingGround({ panel = "upcoming" }) {
  const navigate = useNavigate();
  const view = interviewViewOf(panel);
  const section = interviewSectionOf(panel);
  const [up, reloadUp] = useRead("/api/interview/upcoming");
  const [questions] = useRead("/api/interview/questions");
  const [stories, reloadStories] = useRead("/api/interview/stories");
  const [debriefs, reloadDebriefs] = useRead("/api/interview/debriefs");
  const counts = {
    questions: questions.status === "ready" ? (questions.data?.questions || []).length : null,
    stories: stories.status === "ready" ? (stories.data?.stories || []).length : null,
    debriefs: debriefs.status === "ready" ? (debriefs.data?.debriefs || []).length : null,
  };
  // a view change scrolls to the top; an old panel id scrolls to its section (I0.3 / I0.4)
  useEffect(() => {
    if (!section) { window.scrollTo?.({ top: 0 }); return undefined; }
    const t = setTimeout(() => document.getElementById(section)?.scrollIntoView?.({ block: "start" }), 0);
    return () => clearTimeout(t);
  }, [panel, section]);
  const onView = (id) => navigate(interviewPath(id));
  return (
    <PlateRoot region="VI" className="pl-iv" data-plate-page="interview" data-interview-page={panel} data-interview-view={view}>
      {view === "upcoming" ? <ComingUp up={up} reload={reloadUp} counts={counts} onView={onView}/>
        : view === "prepare" ? <Prepare up={up} questions={questions} stories={stories} reloadStories={reloadStories}/>
        : view === "practise" ? <Practise up={up}/>
        : <After up={up} debriefs={debriefs} reloadDebriefs={reloadDebriefs}/>}
    </PlateRoot>
  );
}
