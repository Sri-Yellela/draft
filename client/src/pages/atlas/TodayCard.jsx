// ⭐ D197 Wave 2 #11 · M5 (47m, lane practice; the owner 11-27: every mock approved) · THE TODAY CARD on Your map (D203 (3)
// — the practice engine behind entries picks one due for review), built from the approved mock
// (pages/dev/platePages/TodaysQuestion.jsx) and DrawingsAtlas's "today's square on the map". It replaces the classic
// Today's question page (AtlasPanels.jsx TodaysQuestionPanel): /atlas/todays-question → your-map#today (AtlasPage).
//   GET /api/learn/today?day=<local day> picks it (the reason is the card's kicker); POST /api/learn/today/answer answers it
//   (a choice, or a match / order response — BankAnswers.jsx, the one implementation); the answer turns the ticket (right =
//   lit, wrong = struck through + the stronger move), shows the why, the lessons and mini-lessons, and lights today's square
//   in the Logbook (RUN_CHANGED_EVENT). The daily reminder (GET|PUT /api/learn/today/reminder) is kept here as one row —
//   its home is notifications (D203 (3)); it moves when Profile's Notifications carries it (agent's pick — nothing lost).
//   Practice progress went to the Logbook, stack exposure to Your survey (D203 (11)).
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api.js";
import { LitSquares, Stamp } from "../../plate/Marks.jsx";
import { LegHeader } from "../../plate/Plates.jsx";
import { QuestionTicket, Ticket } from "../../plate/Tickets.jsx";
import { Drawer, ErrorLine, Skeleton } from "../../plate/PlateState.jsx";
import TodaySquareInset from "../../plate/drawings/TodaySquareInset.jsx";
import { localDay, MatchAnswer, OrderAnswer } from "./BankAnswers.jsx";
import { learnStepHref } from "./atlasPanels.js";
import { RUN_CHANGED_EVENT } from "./Logbook.jsx";
import "../../plate/practicePlate.css";

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourWord = (h) => new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: "numeric" });
const skillWord = (s) => String(s || "").replace(/-/g, " ");

/** ⭐ D154 P1 · the gentle reminder — OFF until the person turns it on; their own hour (local), notification or email. */
function ReminderRow() {
  const [r, setR] = useState(null);
  const [msg, setMsg] = useState("");
  useEffect(() => { api("/api/learn/today/reminder").then(setR).catch(() => setR(null)); }, []);
  if (!r) return null;
  const save = async (body) => {
    setMsg("");
    try { setR(await api("/api/learn/today/reminder", { method: "PUT", body: JSON.stringify(body) })); }
    catch (e) { setMsg(e.message || "Not saved."); }
  };
  const on = (patch = {}) => save({ on: true, hour: r.hour, tzOffsetMin: new Date().getTimezoneOffset(), channel: r.email && !r.push ? "email" : "push", ...patch });
  return (
    <div className="pl-lb__remind" data-daily-reminder={r.on ? "on" : "off"}>
      <span className="pl-label">NOTIFICATIONS · REMIND ME DAILY</span>
      <label className="pl-lb__check">
        <input type="checkbox" className="pl-check" checked={r.on} onChange={(e) => (e.target.checked ? on() : save({ on: false }))}/> Remind me each day at
        <select className="pl-q-select pl-lb__select" value={r.hour} aria-label="Reminder time" onChange={(e) => (r.on ? on({ hour: Number(e.target.value) }) : setR({ ...r, hour: Number(e.target.value) }))}>
          {HOURS.map((h) => <option key={h} value={h}>{hourWord(h)}</option>)}
        </select> by
        <select className="pl-q-select pl-lb__select" value={r.email && !r.push ? "email" : "push"} aria-label="Reminder by"
          onChange={(e) => (r.on ? save({ on: false }).then(() => on({ channel: e.target.value })) : setR({ ...r, push: e.target.value === "push", email: e.target.value === "email" }))}>
          <option value="push">notification</option>
          <option value="email">email</option>
        </select>
      </label>
      <span className="pl-muted pl-lb__meta">Only on days you haven't answered.{msg ? ` ${msg}` : ""}</span>
    </div>
  );
}

export default function TodayCard({ base = "/app/atlas", signedIn = false }) {
  const [t, setT] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [tries, setTries] = useState(0);
  const day = localDay();
  useEffect(() => {
    if (!signedIn) return undefined;
    let live = true;
    setErr("");
    api(`/api/learn/today?day=${day}`).then((x) => live && setT(x))
      .catch((e) => live && setErr(e?.status === 401 ? "signedout" : (e.message || "Today's question couldn't load.")));
    return () => { live = false; };
  }, [day, signedIn, tries]);
  const answer = async (i, response = null) => {
    if (busy || t?.result) return;
    setBusy(true);
    try {
      const r = await api("/api/learn/today/answer", { method: "POST", body: JSON.stringify(response ? { day, response } : { day, chosen: i }) });
      setT({ ...t, result: r, streak: r.streak, atlasStreak: r.atlasStreak });
      window.dispatchEvent(new Event(RUN_CHANGED_EVENT));   // A155: one streak — answering lights today in the Logbook
    } catch (e) { setErr(e.message || "That answer didn't save."); } finally { setBusy(false); }
  };
  const q = t?.question, r = t?.result;
  const streak = t?.atlasStreak ?? t?.streak;
  const answeredRight = !!r?.correct;
  let card;
  if (!signedIn || err === "signedout") {
    card = <Drawer text="Sign in to get a question a day, picked from your own gaps." actions={<Link className="pl-btn" to="/login">Get started</Link>}/>;
  } else if (err && !t) {
    card = <ErrorLine text={err} onRetry={() => setTries((x) => x + 1)}/>;
  } else if (!t) {
    card = <Skeleton label="Picking today's question" height={380}/>;
  } else if (!q) {
    card = <Drawer text="Nothing is due today — there's nothing new for you. Come back tomorrow, or open an entry and practise it."
      actions={<Link className="pl-btn" to={`${base}/your-skills`}>Your skills</Link>}/>;
  } else {
    const choices = Array.isArray(q.choices) ? q.choices : null;
    const why = r ? (
      <div className="pl-lb__why" role="status" data-daily-why="">
        {choices ? (
          answeredRight
            ? <p className="pl-body"><b>Right.</b> {r.why?.chosen}</p>
            : <>
                <p className="pl-body"><b>Not quite.</b> <s>{choices[r.chosen]}</s>{r.why?.chosen ? ` — ${r.why.chosen}` : ""}</p>
                {r.why?.right ? <p className="pl-body"><b>The stronger move:</b> {r.why.rightChoice} — {r.why.right}</p> : null}
              </>
        ) : (
          <p className="pl-body"><b>{answeredRight ? "Right." : `${(r.parts || []).filter(Boolean).length} of ${(r.parts || []).length} in place.`}</b>{typeof r.why === "string" ? ` ${r.why}` : ""}</p>
        )}
        {r.lessons?.length ? <p className="pl-body">Go to lesson: {r.lessons.map((l, i) => <span key={l.path}>{i ? " · " : ""}<Link to={learnStepHref(base, l.stepId)}>{l.label}</Link></span>)}</p> : null}
        {r.decks?.length ? <p className="pl-body" data-daily-decks="">Mini-lesson: {r.decks.map((d, i) => <span key={d.id}>{i ? " · " : ""}<Link to={`${base}/library/${d.id}`}>{d.title}</Link></span>)}</p> : null}
        {answeredRight ? <Stamp tone="lit" rotate={-6}>LIT</Stamp> : null}
        <p className="pl-label pl-muted">COME BACK TOMORROW FOR THE NEXT ONE</p>
      </div>
    ) : null;
    const kicker = `TODAY · PICKED FOR YOU${t.reasonWords ? ` · ${String(t.reasonWords).toUpperCase()}` : ""}`;
    const skills = (q.skills || []).map(skillWord).join(" · ").toUpperCase();
    const more = <span className="pl-label pl-muted">ABOUT TWO MINUTES · A REVIEW COMES BACK WHEN YOU MISS ONE</span>;
    const progress = [r ? (answeredRight ? "lit" : null) : "today"];
    card = choices ? (
      <QuestionTicket rootProps={{ "data-daily-question": q.id }} kicker={kicker} n={skills} text={q.stem} kind="yesno" options={choices}
        pressed={r ? choices[r.chosen] ?? null : null} onAnswer={(o) => answer(choices.indexOf(o))} saveLabel={null} progress={progress} more={more}>{why}</QuestionTicket>
    ) : (
      <QuestionTicket rootProps={{ "data-daily-question": q.id }} kicker={kicker} n={skills} text={q.stem} kind="custom" saveLabel={null} progress={progress} more={more}>
        {q.type === "match" ? <MatchAnswer q={q} r={r} busy={busy} onAnswer={(resp) => answer(null, resp)}/> : null}
        {q.type === "order" ? <OrderAnswer q={q} r={r} busy={busy} onAnswer={(resp) => answer(null, resp)}/> : null}
        {why}
      </QuestionTicket>
    );
  }
  const entry = q?.skills?.[0] ? skillWord(q.skills[0]) : "today";
  return (
    <section className="pl-section" aria-labelledby="lb-today-t" id="today" data-today-card="" data-atlas-panel-body="todays-question">
      <LegHeader n={null} meta={streak ? `THE PRACTICE ENGINE · YOUR ATLAS STREAK: ${streak} DAY${streak === 1 ? "" : "S"} — ANSWERING COUNTS FOR TODAY` : "THE PRACTICE ENGINE · ONE QUESTION A DAY"}
        title={<span id="lb-today-t">Today</span>}/>
      <div className="pl-iv__split">
        <div className="pl-iv__main">{card}{err && t ? <p className="pl-muted pl-lb__meta" role="alert">{err}</p> : null}</div>
        <div className="pl-iv__side">
          <div className="pl-iv__frame">
            <TodaySquareInset entry={entry} plate="ATLAS" mark={r ? (answeredRight ? "✓" : "·") : "?"}
              label={`Today's square on the map: today's pick is on ${entry}; ${r ? (answeredRight ? "answered right, the square is lit" : "answered, a review comes back") : "one square waiting to be lit"}`}/>
          </div>
          <span className="pl-label">TODAY · IN THE LOGBOOK</span>
          <LitSquares squares={[r ? (answeredRight ? "lit" : null) : "today"]} size={16} label={r ? "Today's square: answered" : "Today's square: not yet"}/>
        </div>
      </div>
      {signedIn ? (
        <div className="pl-tickets">
          <Ticket kicker="THE LOGBOOK · PRACTICE BY SKILL" title="How you're doing on each skill" line="Three or more answers, the last 20, no curve." go="Open the Logbook →" href="#logbook"/>
        </div>
      ) : null}
      {signedIn && t ? <ReminderRow/> : null}
    </section>
  );
}
