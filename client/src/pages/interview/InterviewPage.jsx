// ⭐ D167 (owner 11-06: INTERVIEW "taken as approved" — docs/sketches/Interview.html) · THE INTERVIEW PAGE, /app/interview.
//
// Atlas's pattern (components/PlaceNav.jsx): Coming up · Prepare · Practise · After. ⛔ Only what the server holds is drawn
// (pages/interview/interviewModel.js says which panel reads what); a planned feature says it is coming and points at what
// exists now. Nothing here is sample data — an empty account sees empty states.
//   Coming up       GET /api/interview/upcoming — the Inbox's interview / assessment mail matched to applications (one
//                   Inbox, two views: Home keeps every message; this shows the invites). Prepare opens the application's
//                   own Prep tab (D110: the skills against yours, the likely rounds, the countdown).
//   Tracks by round D110's own question bank (your debriefs' questions, by round) and the story bank.
//   Drills          D142's readiness check (/app/atlas/check: timed, extended time, untimed).
//   Defend          not built (D142 module four) — the honesty check (/tools/honesty) flags the lines to be ready for.
//   Mock / coach    not built in draft (D161) — the mock interview runs today in the user's own Claude via the connector.
//   Debrief         D110 P5: your debriefs, and a new one (private — sharing is not built).
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PlaceNav, { PlaceHead } from "../../components/PlaceNav.jsx";
import { api } from "../../lib/api.js";
import { INTERVIEW_GROUPS, interviewPath, TRACKS, bankCounts, whenWords, upcomingHeadline } from "./interviewModel.js";
import "./InterviewPage.css";

const ROUND_WORDS = { coding: "Coding", system_design: "System design", ml: "Machine learning", behavioural: "Behavioural", other: "Other" };
const WENT_WORDS = { well: "Went well", mixed: "Mixed", poorly: "Went poorly" };
const KIND_WORDS = { interview: "Interview", assessment: "Assessment" };

/** One GET, with its loading and error states; `reload` reads it again. */
function useRead(path) {
  const [state, setState] = useState({ status: "loading", data: null, error: "" });
  const reload = useCallback(() => {
    let live = true;
    api(path).then(d => live && setState({ status: "ready", data: d, error: "" }))
      .catch(e => live && setState({ status: "error", data: null, error: e?.message || "Could not be reached." }));
    return () => { live = false; };
  }, [path]);
  useEffect(() => reload(), [reload]);
  return [state, reload];
}

function Quiet({ children, ...rest }) { return <p className="iv__quiet" {...rest}>{children}</p>; }

function Upcoming() {
  const [s] = useRead("/api/interview/upcoming");
  const items = s.data?.interviews || [];
  return (
    <>
      <PlaceHead eyebrow="Coming up" title={s.status === "ready" ? upcomingHeadline(items) : "Your interviews"}
        lead="Found in your Inbox and matched to your applications." />
      {s.status === "loading" && <Quiet role="status">Loading…</Quiet>}
      {s.status === "error" && <Quiet role="alert">Your interviews could not be loaded: {s.error}</Quiet>}
      {s.status === "ready" && !items.length && (
        <div className="iv__card" data-upcoming-empty="">
          <h3 className="iv__h4">No interview invites yet</h3>
          <p className="iv__p">When an interview or assessment email reaches your Inbox — through Gmail or forwarding — and matches one of your
            applications, it shows here with a Prepare button. Every application email stays in Home's Inbox.</p>
          <div className="iv__row"><Link className="iv__btn" to="/app/profile/connections">Connect your mail</Link></div>
        </div>
      )}
      {items.map(it => {
        const when = whenWords(it.daysLeft);
        return (
          <div key={it.applicationId} className="iv__item" data-upcoming={it.applicationId} data-past={it.daysLeft != null && it.daysLeft < 0 ? "true" : "false"}>
            <div className="iv__item-main">
              <b>{it.company || "An application"}</b>
              <span>{[it.title, KIND_WORDS[it.kind] || "Interview",
                it.date ? `${when}${it.date.ymd ? ` · ${it.date.ymd}` : ""}${it.date.time ? ` ${it.date.time}` : ""}` : "no date yet — add it in Prepare"].filter(Boolean).join(" · ")}</span>
              {it.subject && <small>From your Inbox: “{it.subject}”</small>}
            </div>
            <Link className="iv__btn iv__btn--p" to={`/app/job/${it.applicationId}?tab=prep`} data-prepare={it.applicationId}>Prepare</Link>
          </div>
        );
      })}
    </>
  );
}

function Guides() {
  return (
    <>
      <PlaceHead eyebrow="Company guides" title="Guides are coming"
        lead="How each company interviews, by level: the stages, what people were asked, and where it came from." />
      <div className="iv__card" data-coming="guides">
        <p className="iv__p">Company guides are not built yet — they will be grown from debriefs people choose to share, with their sources and when
          they were checked. Until then, every interview's Prepare reads its posting: the skills it asks for against yours, and the rounds it
          likely has.</p>
        <div className="iv__row"><Link className="iv__btn" to={interviewPath("upcoming")}>Your interviews</Link></div>
      </div>
    </>
  );
}

function Tracks() {
  const [q] = useRead("/api/interview/questions");
  const [st, reloadStories] = useRead("/api/interview/stories");
  const [msg, setMsg] = useState("");
  const counts = bankCounts(q.data?.questions || []);
  const stories = st.data?.stories || [];
  const seed = async () => {
    setMsg("");
    try { const r = await api("/api/interview/stories/from-profile", { method: "POST" }); reloadStories(); setMsg(r?.added != null ? `${r.added} stor${r.added === 1 ? "y" : "ies"} started from your experience.` : "Started from your experience."); }
    catch (e) { setMsg(e?.message || "That did not work — nothing changed."); }
  };
  return (
    <>
      <PlaceHead eyebrow="Tracks by round" title="Each kind of round"
        lead="What you have for each round so far: the questions from your own debriefs, and your stories for behavioural rounds." />
      <div className="iv__stages" data-tracks="">
        {TRACKS.map(t => {
          const n = t.bank ? counts[t.bank] || 0 : null;
          return (
            <div key={t.id} className="iv__stage" data-track={t.id}>
              <b>{t.label}</b>
              <span>{n == null ? "No question bank for this round yet"
                : n ? `${n} question${n === 1 ? "" : "s"} from your debriefs` : "No questions yet — add them in a debrief"}
                {t.id === "behavioural" && st.status === "ready" ? ` · ${stories.length} stor${stories.length === 1 ? "y" : "ies"} in your bank` : ""}</span>
            </div>
          );
        })}
      </div>
      <Quiet>Practice tracks for each round are coming; what is listed here is your own.</Quiet>
      <div className="iv__card" data-story-bank="">
        <h3 className="iv__h4">Your story bank</h3>
        {st.status === "ready" && !stories.length && (
          <>
            <p className="iv__p">No stories yet. Start them from your experience — each becomes a story in situation, task, action, result form
              for you to edit.</p>
            <div className="iv__row"><button type="button" className="iv__btn" onClick={seed} data-seed-stories="">Start from my experience</button></div>
          </>
        )}
        {stories.length > 0 && (
          <ul className="iv__list">{stories.slice(0, 12).map(s => <li key={s.id}>{s.title || "A story"}</li>)}</ul>
        )}
        {st.status === "error" && <Quiet role="alert">Your stories could not be loaded: {st.error}</Quiet>}
        {msg && <Quiet role="status">{msg}</Quiet>}
      </div>
    </>
  );
}

function Coming({ id, eyebrow, title, lead, children }) {
  return (
    <>
      <PlaceHead eyebrow={eyebrow} title={title} lead={lead} />
      <div className="iv__card" data-coming={id}>{children}</div>
    </>
  );
}

function Debrief() {
  const [d, reload] = useRead("/api/interview/debriefs");
  const [up] = useRead("/api/interview/upcoming");
  const blank = { applicationId: "", round: "other", heldOn: "", went: "", questions: "", notes: "" };
  const [f, setF] = useState(blank);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const apps = up.data?.interviews || [];
  const nameOf = (id) => { const a = apps.find(x => x.applicationId === id); return a ? [a.company, a.title].filter(Boolean).join(" · ") : null; };
  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg("");
    try {
      await api("/api/interview/debriefs", { method: "POST", body: JSON.stringify({
        applicationId: f.applicationId || null, round: f.round, heldOn: f.heldOn || null, went: f.went || null, notes: f.notes,
        questions: f.questions.split("\n").map(x => x.trim()).filter(Boolean) }) });
      setF(blank); setMsg("Saved. Its questions are in your bank, under its round."); reload();
    } catch (err) { setMsg(err?.message || "It was not saved."); }
    finally { setBusy(false); }
  };
  const list = d.data?.debriefs || [];
  return (
    <>
      <PlaceHead eyebrow="Debrief" title="Two minutes while it's fresh"
        lead="What each round asked and how it went. Kept private to you — nothing here is shared." />
      <form className="iv__card iv__form" onSubmit={save} data-debrief-form="">
        {apps.length > 0 && (
          <label>For<select value={f.applicationId} onChange={e => setF({ ...f, applicationId: e.target.value })}>
            <option value="">No application</option>
            {apps.map(a => <option key={a.applicationId} value={a.applicationId}>{[a.company, a.title].filter(Boolean).join(" · ")}</option>)}
          </select></label>
        )}
        <label>Round<select value={f.round} onChange={e => setF({ ...f, round: e.target.value })}>
          {Object.entries(ROUND_WORDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select></label>
        <label>When<input type="date" value={f.heldOn} onChange={e => setF({ ...f, heldOn: e.target.value })} /></label>
        <label>How it went<select value={f.went} onChange={e => setF({ ...f, went: e.target.value })}>
          <option value="">—</option>{Object.entries(WENT_WORDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select></label>
        <label className="iv__wide">Questions you remember (one a line)<textarea rows={3} value={f.questions} onChange={e => setF({ ...f, questions: e.target.value })} /></label>
        <label className="iv__wide">Notes<textarea rows={2} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></label>
        <div className="iv__row iv__wide"><button type="submit" className="iv__btn iv__btn--p" disabled={busy}>Save the debrief</button>
          {msg && <span className="iv__quiet" role="status">{msg}</span>}</div>
      </form>
      {d.status === "error" && <Quiet role="alert">Your debriefs could not be loaded: {d.error}</Quiet>}
      {d.status === "ready" && !list.length && <Quiet data-debriefs-empty="">No debriefs yet.</Quiet>}
      {list.map(x => (
        <div key={x.id} className="iv__item" data-debrief={x.id}>
          <div className="iv__item-main">
            <b>{ROUND_WORDS[x.round] || x.round}{x.applicationId && nameOf(x.applicationId) ? ` · ${nameOf(x.applicationId)}` : ""}</b>
            <span>{[x.heldOn, WENT_WORDS[x.went], x.questions?.length ? `${x.questions.length} question${x.questions.length === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ")}</span>
            {x.notes && <small>{x.notes}</small>}
          </div>
        </div>
      ))}
    </>
  );
}

export default function InterviewPage({ panel = "upcoming" }) {
  const [up] = useRead("/api/interview/upcoming");
  const ahead = (up.data?.interviews || []).filter(i => !(i.daysLeft != null && i.daysLeft < 0)).length;
  const metas = { upcoming: up.status === "ready" && ahead ? String(ahead) : null };
  const groups = INTERVIEW_GROUPS.map(g => ({ ...g, items: g.items.map(i => ({ ...i, meta: metas[i.id] ?? null })) }));
  useEffect(() => { window.scrollTo?.({ top: 0 }); }, [panel]);

  let body = null;
  if (panel === "upcoming") body = <Upcoming />;
  else if (panel === "guides") body = <Guides />;
  else if (panel === "tracks") body = <Tracks />;
  else if (panel === "mock") body = (
    <Coming id="mock" eyebrow="Mock interview" title="Talk it through, like the real thing"
      lead="draft's own mock interview, with voice, is coming.">
      <p className="iv__p">Today you can run one in your own Claude: connect draft under Connections, and your Claude gets the posting, your
        experience and your own past questions as data to interview you with.</p>
      <div className="iv__row"><Link className="iv__btn" to="/app/profile/connections">Set it up</Link><Link className="iv__btn" to="/docs/claude">How it works</Link></div>
    </Coming>
  );
  else if (panel === "coach") body = (
    <Coming id="coach" eyebrow="Ask the coach" title="Ask a question, hear a strong answer" lead="Coming — not built yet.">
      <p className="iv__p">The coach will answer from your own résumé, each answer labelled as an example, never a claim you could not make yourself.</p>
    </Coming>
  );
  else if (panel === "drills") body = (
    <Coming id="drills" eyebrow="Drills" title="Quick rounds to stay sharp" lead="Check a skill in a few minutes — timed, with extended time, or untimed practice that never counts against you.">
      <div className="iv__row"><Link className="iv__btn iv__btn--p" to="/app/atlas/check" data-open-check="">Start a check</Link></div>
      {/* ⭐ D178: the coding-interview patterns are their own course in the Library (they left Learn's tabs). */}
      <p className="iv__p">For coding rounds: the patterns behind most interview problems — the idea, how to spot it, and problems to practise.</p>
      <div className="iv__row"><Link className="iv__btn" to="/app/atlas/library/coding-interview-patterns" data-open-patterns="">Coding interview patterns</Link></div>
    </Coming>
  );
  else if (panel === "defend") body = (
    <Coming id="defend" eyebrow="Defend your résumé" title="Every line you wrote, asked about" lead="Coming — the follow-up questions for each bullet are not built yet.">
      <p className="iv__p">Today, the honesty check reads your résumé and flags the lines you may not be able to defend in a room.</p>
      <div className="iv__row"><Link className="iv__btn" to="/tools/honesty">Run the honesty check</Link></div>
    </Coming>
  );
  else if (panel === "past") body = (
    <Coming id="past" eyebrow="Past sessions" title="No practice sessions yet" lead="Each mock interview will leave a report here: pace, filler words, structure and what to work on.">
      <p className="iv__p" data-past-empty="">Nothing is recorded until the mock interview runs in draft. Your debriefs are under Debrief.</p>
      <div className="iv__row"><Link className="iv__btn" to={interviewPath("debrief")}>Your debriefs</Link></div>
    </Coming>
  );
  else if (panel === "debrief") body = <Debrief />;

  return (
    <PlaceNav place="interview" name="Interview" eyebrow="Ready for the room" title="Interview" groups={groups} current={panel}
      hrefFor={interviewPath}>
      <div className="iv" data-interview-page={panel}>{body}</div>
    </PlaceNav>
  );
}
