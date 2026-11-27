// ⭐ D197 Wave 2 #13 · M3 (47j, lane w2-practice) — INTERVIEW as PROVING GROUND, a mock made only from the plate library
// (client/src/plate/) and the --pl-* tokens, with fixture data (synthetic people and companies). The brief and the M1
// inventory: docs/revamp/interview.md. Served at /dev/plate?page=interview (&w=390; &panel=<view or an old panel id>).
// Nothing here reads the server; nothing here ships to a user. The four views are today's four groups; the nine panels are
// sections inside them. Defend is operable (the page's one model). Region VI (Languages & media); clay = the soonest
// interview's Prepare.
import { useEffect, useState } from "react";
import PlateRoot from "../../../plate/PlateRoot.jsx";
import { AreaNav, Dock } from "../../../plate/Shell.jsx";
import { Kickers, LitSquares, Stamp } from "../../../plate/Marks.jsx";
import { StatsStrip, LegHeader } from "../../../plate/Plates.jsx";
import { Ticket, QuestionTicket } from "../../../plate/Tickets.jsx";
import { Gazetteer, RouteLine } from "../../../plate/Lists.jsx";
import { DrawingToCome } from "../../../plate/Drawings.jsx";
import { Drawer } from "../../../plate/PlateState.jsx";
import { DOCK_ITEMS } from "../../../plate/registry.js";

// ── fixture data (synthetic) ──────────────────────────────────────────────────────────────────────────────────────────
const UPCOMING = [
  { id: "kestrel", company: "Kestrel Payments", title: "Frontend Engineer II, Checkout", kind: "INTERVIEW", when: "TOMORROW · NOV 27 · 10:00", subject: "Next steps: a technical round with the Checkout team" },
  { id: "northwind", company: "Northwind Analytics", title: "Software Engineer, Frontend (Dashboards)", kind: "ASSESSMENT", when: "IN 4 DAYS · NOV 30", subject: "Your take-home assessment" },
  { id: "halcyon", company: "Halcyon Robotics", title: "UI Engineer, Fleet Console", kind: "INTERVIEW", when: "NO DATE YET — ADD IT IN PREPARE", subject: "A chat with our recruiting team" },
];
const RECENT = [{ id: "brightline", company: "Brightline Health", title: "Software Engineer, Design Systems", kind: "INTERVIEW", when: "3 DAYS AGO · NOV 23", subject: "Onsite: system design and behavioural" }];
const ROUNDS = [
  { name: "Recruiter screen", state: "ahead", stage: "start", n: null },
  { name: "Coding", state: "underway", stage: "build", n: 6 },
  { name: "System design", state: "underway", stage: "deepen", n: 2 },
  { name: "Behavioural", state: "next", stage: "deepen", n: 4, stories: 5 },
  { name: "AI-enabled coding", state: "ahead", stage: "master", n: null },
];
const roundWords = (r) => (r.n == null ? "No question bank for this round yet" : r.n ? `${r.n} question${r.n === 1 ? "" : "s"} from your debriefs` : "No questions yet — add them in a debrief");
const STORIES = [
  { id: "s1", title: "Rebuilt the checkout's payment step", themes: "OWNERSHIP · DEADLINES", from: "Toast" },
  { id: "s2", title: "Cut the bundle by a third before Black Friday", themes: "IMPACT · PERFORMANCE", from: "Toast" },
  { id: "s3", title: "Disagreed with a design review, and was wrong", themes: "CONFLICT · LEARNING", from: "Toast" },
  { id: "s4", title: "Onboarded two interns onto the design system", themes: "MENTORING", from: "Toast" },
  { id: "s5", title: "Shipped a11y fixes the audit missed", themes: "QUALITY", from: "Northeastern co-op" },
];
const BULLETS = [
  { id: "b1", employer: "Toast", text: "Rebuilt the checkout's payment step in React and TypeScript, cutting drop-off by 12%.",
    questions: [
      { ask: "How did you know the 12% came from your change and not something else that shipped that month?", because: "A number on a résumé is the first thing an interviewer checks.",
        harder: "If you had to defend that number to a sceptical data scientist, what would you show them?" },
      { ask: "Why React and TypeScript for this, and what would you change if you did it again?", because: "Named technologies invite a why.",
        harder: "Say the team had to drop TypeScript tomorrow. What breaks first?" },
    ] },
  { id: "b2", employer: "Toast", text: "Led the move of 40 components into the shared design system.",
    questions: [{ ask: "What did 'led' mean here — who decided, and who did the work?", because: "Scope words like 'led' are always probed.",
      harder: "Tell me about one component that didn't fit. What did you do with it?" }] },
];
const DEBRIEFS = [
  { id: "d1", round: "System design", for: "Brightline Health · Software Engineer", when: "2026-11-23", went: "Mixed", qs: "2 questions" },
  { id: "d2", round: "Coding", for: "Orbital Works · Web Engineer", when: "2026-11-12", went: "Went well", qs: "3 questions" },
];
const VIEWS = [
  { id: "upcoming", label: "Coming up", href: "#upcoming", icon: "progress" },
  { id: "prepare", label: "Prepare", href: "#prepare", icon: "list" },
  { id: "practise", label: "Practise", href: "#practise", icon: "interview" },
  { id: "after", label: "After", href: "#after", icon: "replies" },
];
// today's nine addresses → the view that holds them (docs/revamp/interview.md I0.3)
const OLD_IDS = { upcoming: "upcoming", guides: "prepare", tracks: "prepare", mock: "practise", coach: "practise", drills: "practise", defend: "practise", past: "after", debrief: "after" };
const viewFromAddress = () => {
  const p = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("panel");
  return OLD_IDS[p] || (VIEWS.some((v) => v.id === p) ? p : "upcoming");
};

// ── the views ─────────────────────────────────────────────────────────────────────────────────────────────────────────
function InterviewHeader({ kicker, title, cells, lead }) {
  return (
    <section className="pl-hero" aria-label="Proving ground">
      <div className="pl-hero__main">
        <LegHeader meta={kicker} title={title} level={1}/>
        {lead ? <p className="pl-lead">{lead}</p> : null}
        {cells ? <StatsStrip label="Your interviews" cells={cells}/> : null}
      </div>
      <div style={{ flex: "1 1 360px", minWidth: 0, maxWidth: 560 }}>
        <DrawingToCome what="The proving ground: the five rounds as benches up a hill, you beaconed at Behavioural, tomorrow's round flagged in clay"
          aspect="640 / 380" note="VI'S RAMP · THE NEAREST: PLACEELEVATIONPROFILE, RE-INKED"/>
      </div>
    </section>
  );
}

function MockComingUp({ onView }) {
  return (
    <>
      <InterviewHeader kicker="PROVING GROUND · COMING UP · WEEK 48" title="Two interviews to prepare for"
        cells={[{ value: 2, label: "AHEAD", onClick: () => {} }, { value: 12, label: "QUESTIONS IN YOUR BANK", onClick: () => onView("prepare") },
          { value: 5, label: "STORIES", onClick: () => onView("prepare") }, { value: 2, label: "DEBRIEFS", onClick: () => onView("after") }]}/>
      <section className="pl-section" aria-labelledby="iv-up">
        <LegHeader n={1} meta="FOUND IN YOUR INBOX · MATCHED TO YOUR APPLICATIONS" title="Your interviews" id="iv-up"/>
        <div className="pl-tickets">
          {UPCOMING.map((u, i) => (
            <Ticket key={u.id} kicker={`${u.kind} · ${u.when}`} title={u.company} line={`${u.title} · “${u.subject}”`} go="Prepare →" href={`#prep-${u.id}`}
              tone={i === 0 ? "clay-tint" : "plain"}/>
          ))}
        </div>
        <p className="pl-label pl-muted" style={{ marginTop: 22 }}>RECENT</p>
        <div className="pl-tickets" style={{ marginTop: 10 }}>
          {RECENT.map((u) => <Ticket key={u.id} kicker={`${u.kind} · ${u.when}`} title={u.company} line={`${u.title} · “${u.subject}”`} go="Log the round →" href="#after"/>)}
        </div>
      </section>
      <section className="pl-section pl-section--last" aria-label="Onward">
        <LegHeader n={2} meta="ONWARD" title="Before tomorrow"/>
        <div className="pl-tickets">
          <Ticket kicker="SURVEY SHEET · KESTREL PAYMENTS · INTERVIEWING HERE" title="How Kestrel interviews" line="Their stages and what people were asked — being written from shared debriefs." go="Open the survey sheet →" href="#survey"/>
          <Ticket kicker="PRACTISE · DEFEND YOUR RÉSUMÉ" title="Every line you wrote, asked about" line="Two bullets on Toast are most likely to be probed." go="Start →" href="#practise"/>
        </div>
      </section>
    </>
  );
}

function MockPrepare() {
  const roundCols = [{ key: "name", label: "ROUND", kind: "title" }, { key: "words", label: "YOUR BANK" }, { key: "stories", label: "STORIES" }];
  const roundRows = ROUNDS.map((r) => ({ id: r.name, name: r.name, words: roundWords(r), stories: r.stories != null ? `${r.stories} in your bank` : "—" }));
  return (
    <>
      <InterviewHeader kicker="PROVING GROUND · PREPARE" title="Each kind of round"
        lead="What you have for each round so far: the questions from your own debriefs, and your stories for behavioural rounds."/>
      <section className="pl-section" aria-labelledby="iv-rounds">
        <LegHeader n={1} meta="FIVE ROUNDS · YOUR OWN BANK · PRACTICE TRACKS COMING" title="The rounds" id="iv-rounds"/>
        <RouteLine label="The rounds" stops={ROUNDS.map((r) => ({ name: r.name, state: r.state, stage: r.stage }))}/>
        <div style={{ marginTop: 18 }}><Gazetteer label="Your bank by round" cols={roundCols} rows={roundRows}/></div>
        <p className="pl-label pl-muted" style={{ marginTop: 12 }}>PRACTICE TRACKS FOR EACH ROUND ARE COMING; WHAT IS LISTED HERE IS YOUR OWN.</p>
      </section>
      <section className="pl-section" aria-labelledby="iv-stories">
        <LegHeader n={2} meta="SITUATION · TASK · ACTION · RESULT · SHOWN IN EVERY INTERVIEW'S PREP" title="Your story bank" id="iv-stories"/>
        <Gazetteer label="Your stories" cols={[{ key: "title", label: "STORY", kind: "title" }, { key: "themes", label: "THEMES" }, { key: "from", label: "FROM" }]} rows={STORIES}/>
        <div className="pl-actions" style={{ marginTop: 14 }}>
          <button type="button" className="pl-btn">Start from my experience</button>
          <span className="pl-muted" role="status" style={{ alignSelf: "center", fontSize: "var(--pl-t-meta)" }}>5 stories started from your experience.</span>
        </div>
      </section>
      <section className="pl-section pl-section--last" aria-labelledby="iv-guides">
        <LegHeader n={3} meta="D203 (9) · LIVES ON EACH SURVEY SHEET" title="How each company interviews" id="iv-guides"/>
        <div className="pl-tickets">
          {UPCOMING.slice(0, 2).map((u) => (
            <Ticket key={u.id} kicker={`SURVEY SHEET · ${u.company.toUpperCase()} · INTERVIEWING HERE`} title={`How ${u.company.split(" ")[0]} interviews`}
              line="The stages, what people were asked, and where it came from — being written from shared debriefs." go="Open the survey sheet →" href="#survey"/>
          ))}
        </div>
      </section>
    </>
  );
}

/** The one operable model: DefendWalk — ask → out loud (a clock) or typed → the harder follow-up → next. Nothing recorded. */
function MockDefendWalk() {
  const [pos, setPos] = useState({ line: 0, q: 0, stage: "ask", mode: null });
  const [typed, setTyped] = useState("");
  const [sec, setSec] = useState(0);
  const [done, setDone] = useState(() => new Set());
  const b = BULLETS[pos.line], q = b.questions[pos.q];
  const talking = pos.stage === "answering" && pos.mode === "voice";
  useEffect(() => {
    if (!talking) return undefined;
    setSec(0);
    const t = setInterval(() => setSec((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [talking, pos.line, pos.q]);
  const next = () => {
    if (pos.stage === "answering") { setPos({ ...pos, stage: "harder" }); return; }
    setDone((d) => new Set(d).add(`${pos.line}:${pos.q}`));
    setTyped("");
    setPos(pos.q + 1 < b.questions.length ? { line: pos.line, q: pos.q + 1, stage: "ask", mode: null } : { line: (pos.line + 1) % BULLETS.length, q: 0, stage: "ask", mode: null });
  };
  const another = () => { setTyped(""); setPos({ line: (pos.line + 1) % BULLETS.length, q: 0, stage: "ask", mode: null }); };
  const squares = BULLETS.flatMap((x, li) => x.questions.map((_, qi) => (done.has(`${li}:${qi}`) ? "lit" : li === pos.line && qi === pos.q ? "today" : null)));
  const clock = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  const where = `LINE ${pos.line + 1} OF ${BULLETS.length} · ${b.employer.toUpperCase()} · QUESTION ${pos.q + 1} OF ${b.questions.length}`;
  const quote = <p className="pl-body" style={{ fontStyle: "italic" }}>“{b.text}”</p>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
      <div style={{ flex: "999 1 520px", minWidth: 0 }}>
        {pos.stage === "harder" ? (
          <QuestionTicket kicker="THEN THE INTERVIEWER PUSHES" n={where} text={q.harder} kind="yesno" options={[pos.q + 1 < b.questions.length ? "Next question" : "Next line"]}
            pressed={null} onAnswer={next} saveLabel={null} progress={squares}>{quote}</QuestionTicket>
        ) : pos.stage === "answering" && pos.mode === "typed" ? (
          <QuestionTicket kicker="THE INTERVIEWER ASKS" n={where} text={q.ask} kind="draft" value={typed} onChange={setTyped} saveLabel={null}
            onNext={next} nextLabel="Done" canNext={!!typed.trim()} progress={squares}
            more={<span className="pl-label pl-muted">STAYS ON THIS PAGE — NOTHING IS SENT OR KEPT</span>}>{quote}</QuestionTicket>
        ) : pos.stage === "answering" ? (
          <QuestionTicket kicker="THE INTERVIEWER ASKS" n={where} text={q.ask} kind="yesno" options={["Done"]} pressed={null} onAnswer={next} saveLabel={null} progress={squares}>
            {quote}
            <p style={{ margin: 0, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "baseline" }}>
              <span className="pl-stats__num" role="timer" aria-live="off">{clock}</span>
              <span className="pl-muted" style={{ fontSize: "var(--pl-t-meta)" }}>Say it out loud, as in the room. Nothing is recorded.</span>
            </p>
          </QuestionTicket>
        ) : (
          <QuestionTicket kicker="THE INTERVIEWER ASKS" n={where} text={q.ask} kind="yesno" options={["Answer out loud", "Type it"]} pressed={null} saveLabel={null}
            onAnswer={(o) => setPos({ ...pos, stage: "answering", mode: o === "Type it" ? "typed" : "voice" })} progress={squares}
            more={BULLETS.length > 1 ? <button type="button" className="pl-btn" onClick={another}>Another line</button> : null}>
            {quote}<p className="pl-label pl-muted">WHY IT’S ASKED · {q.because.toUpperCase()}</p>
          </QuestionTicket>
        )}
        <p className="pl-muted" style={{ fontSize: "var(--pl-t-meta)", marginTop: 12 }}>Lines most likely to be probed come first. To compare a tailored résumé with your original, <a href="#honesty">run the honesty check</a>.</p>
      </div>
      <div style={{ flex: "1 1 260px", minWidth: 0, maxWidth: 360, display: "flex", flexDirection: "column", gap: 12 }}>
        <DrawingToCome what="The interviewer's chair across the table, your bullet pinned on the wall" aspect="4 / 3" note="VI'S RAMP · FROM THE DESIGN DOC"/>
        <span className="pl-label">THIS SESSION</span>
        <LitSquares squares={squares} size={16} label={`${done.size} of ${squares.length} follow-ups answered to the harder question`}/>
        <p className="pl-muted" style={{ margin: 0, fontSize: "var(--pl-t-meta)" }}>A square lights when you've answered the harder follow-up — never for opening a line.</p>
      </div>
    </div>
  );
}

function MockPractise() {
  return (
    <>
      <InterviewHeader kicker="PROVING GROUND · PRACTISE" title="Every line you wrote, asked about"
        lead="The coach picks a bullet and asks the follow-ups an interviewer would."/>
      <section className="pl-section" aria-labelledby="iv-defend">
        <LegHeader n={1} meta="FROM YOUR BASE RÉSUMÉ · TEMPLATES, NO MODEL · NOTHING RECORDED" title="Defend your résumé" id="iv-defend"/>
        <MockDefendWalk/>
      </section>
      <section className="pl-section" aria-labelledby="iv-drills">
        <LegHeader n={2} meta="TIMED · EXTENDED TIME · UNTIMED — NEVER COUNTS AGAINST YOU" title="Drills" id="iv-drills"/>
        <div className="pl-tickets">
          <Ticket kicker="ATLAS · A QUICK CHECK" title="Check a skill in a few minutes" line="Timed, with extended time, or untimed practice." go="Start a check →" href="#check" tone="plain"/>
          <Ticket kicker="ATLAS · A ROUTE · 14 PATTERNS" title="Coding interview patterns" line="The idea, how to spot it, and problems to practise." go="Open the route →" href="#patterns"/>
        </div>
      </section>
      <section className="pl-section pl-section--last" aria-labelledby="iv-mock">
        <LegHeader n={3} meta="D161 · NOT BUILT IN DRAFT YET" title="Mock interview and the coach" id="iv-mock"/>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
          <div style={{ flex: "1 1 300px", minWidth: 0 }}>
            <Drawer text="draft's own mock interview, with voice, is coming. Today you can run one in your own Claude: connect draft under Connections, and your Claude gets the posting, your experience and your own past questions."
              action={{ label: "Set it up", href: "#connections" }}/>
            <p style={{ margin: "8px 0 0" }}><a href="#docs-claude">How it works</a></p>
          </div>
          <div style={{ flex: "1 1 300px", minWidth: 0 }}>
            <Drawer text="Ask the coach — coming. It will answer from your own résumé, each answer labelled as an example, never a claim you could not make yourself."/>
          </div>
        </div>
      </section>
    </>
  );
}

/** Debrief, one question at a time (every field of today's form, in its order). */
function MockDebriefSteps() {
  const steps = [
    { kind: "choice", text: "Which application was it for?", options: ["No application", ...UPCOMING.map((u) => `${u.company} · ${u.title}`), `${RECENT[0].company} · ${RECENT[0].title}`] },
    { kind: "choice", text: "Which round?", options: ["Coding", "System design", "Machine learning", "Behavioural", "Other"] },
    { kind: "text", text: "When was it?" },
    { kind: "yesno", text: "How did it go?", options: ["Went well", "Mixed", "Went poorly"] },
    { kind: "draft", text: "Questions you remember (one a line)" },
    { kind: "draft", text: "Notes" },
  ];
  const [i, setI] = useState(0);
  const [vals, setVals] = useState({});
  const [saved, setSaved] = useState(false);
  const st = steps[i];
  const progress = steps.map((_, k) => (k < i ? "lit" : k === i ? "today" : null));
  const set = (v) => setVals((x) => ({ ...x, [i]: v }));
  const last = i === steps.length - 1;
  const go = () => {
    if (!last) { setI(i + 1); return; }
    setSaved(true); setI(0); setVals({});
  };
  return (
    <QuestionTicket kicker="TWO MINUTES WHILE IT’S FRESH · PRIVATE TO YOU" n={`QUESTION ${i + 1} OF ${steps.length}`} text={st.text} kind={st.kind} options={st.options}
      pressed={st.kind === "yesno" ? vals[i] ?? null : undefined} onAnswer={(o) => { set(o); go(); }} value={vals[i] ?? ""} onChange={set} saveLabel={null}
      onNext={st.kind === "yesno" ? undefined : go} nextLabel={last ? "Save the debrief" : "Next"} canNext onBack={i ? () => setI(i - 1) : undefined} backDisabled={!i}
      progress={progress}>
      {saved ? <p className="pl-label pl-tone-lit" role="status">SAVED. ITS QUESTIONS ARE IN YOUR BANK, UNDER ITS ROUND.</p> : null}
    </QuestionTicket>
  );
}

function MockAfter() {
  return (
    <>
      <InterviewHeader kicker="PROVING GROUND · AFTER" title="Two minutes while it's fresh" lead="What each round asked and how it went. Kept private to you — nothing here is shared."/>
      <section className="pl-section" aria-labelledby="iv-debrief">
        <LegHeader n={1} meta="ITS QUESTIONS GO INTO YOUR BANK, UNDER ITS ROUND" title="Debrief" id="iv-debrief"/>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
          <div style={{ flex: "999 1 520px", minWidth: 0 }}><MockDebriefSteps/></div>
          <div style={{ flex: "1 1 260px", minWidth: 0, maxWidth: 360 }}>
            <DrawingToCome what="A ruled logbook page, the round's questions written in" aspect="4 / 3" note="VI'S RAMP · FROM THE DESIGN DOC"/>
          </div>
        </div>
        <div style={{ marginTop: 22 }}>
          <Gazetteer label="Your debriefs" cols={[{ key: "round", label: "ROUND", kind: "title" }, { key: "for", label: "FOR" }, { key: "when", label: "WHEN" }, { key: "went", label: "HOW IT WENT" }, { key: "qs", label: "QUESTIONS" }]}
            rows={DEBRIEFS}/>
        </div>
      </section>
      <section className="pl-section pl-section--last" aria-labelledby="iv-past">
        <LegHeader n={2} meta="EACH MOCK INTERVIEW WILL LEAVE A REPORT HERE" title="Past sessions" id="iv-past"/>
        <Drawer text="Nothing is recorded until the mock interview runs in draft. Pace, filler words, structure and what to work on will show here. Your debriefs are above."
          action={{ label: "Your debriefs", href: "#iv-debrief" }}/>
        <div style={{ marginTop: 16 }}><Stamp tone="ink" rotate={-4}>NOT YET · D161</Stamp></div>
      </section>
    </>
  );
}

export default function InterviewMock({ width = 1280 }) {
  const phone = width < 600;
  const [view, setView] = useState(viewFromAddress);
  const onGo = (id) => { if (VIEWS.some((v) => v.id === id)) setView(id); };
  const nav = (
    <AreaNav area="Interview" views={VIEWS.map((v) => ({ ...v, label: v.id === "upcoming" ? `${v.label} · 2` : v.label }))} current={view} onGo={onGo} phone={phone}
      home={{ href: "#home", label: "draft — the market" }} search={{ placeholder: "Company or round…", onOpen: () => {} }}/>
  );
  const body = (
    <div data-interview-view={view} style={{ paddingBottom: phone ? 96 : 0 }}>
      <div className="pl-page" style={{ paddingTop: 18 }}><Kickers parts={["MOCK · D197 WAVE 2 #13", "EXAMPLE DATA", "NOTHING HERE IS LIVE"]}/></div>
      {view === "upcoming" ? <MockComingUp onView={setView}/> : view === "prepare" ? <MockPrepare/> : view === "practise" ? <MockPractise/> : <MockAfter/>}
    </div>
  );
  const dock = DOCK_ITEMS.map((d) => ({ ...d, href: "#" }));
  return (
    <PlateRoot region="VI" style={{ minHeight: "100vh" }} data-plate-page="interview">
      {phone ? (
        <>
          {nav}{body}
          <div style={{ position: "sticky", bottom: 0 }}><Dock items={dock} current="interview" bar/></div>
        </>
      ) : (
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          <div style={{ position: "sticky", top: 14, padding: 14 }}><Dock items={dock} ask={{ href: "#ask" }} current="interview"/></div>
          <div style={{ flex: "1 1 auto", minWidth: 0 }}>{nav}{body}</div>
        </div>
      )}
    </PlateRoot>
  );
}
