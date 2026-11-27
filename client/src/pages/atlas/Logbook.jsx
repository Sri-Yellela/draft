// ⭐ D197 Wave 2 #11 · M5 (47m, lane practice; the owner 11-27: every mock approved) · THE LOGBOOK — a section of Your map
// (D203 (1) (2) (7) (11)), built from the approved mock (pages/dev/platePages/Logbook.jsx) and the DrawingsAtlas board. It
// replaces the classic Your run page (YourRun.jsx) and the classic League page: /atlas/your-run → your-map#logbook,
// /atlas/league → your-map#standings (AtlasPage). Every M1 row of docs/revamp/atlas-extras.md A2 / A6b / C1 has its place:
//   01 The level and the lit days  GET /api/atlas/run — the level (a compass dial, one tick per tenth), the points line, the
//                                  rule, the streak / best / this week / points strip, the month of lit days (tap a day →
//                                  what lit it), Weekdays only (PUT /api/atlas/prefs), the pod's rank and the live count
//   02 Waypoints                   the day's quests — the day's leg (drawing), a ticket each, the first undone in clay
//   03 Stamps                      a module finished = a stamp (D203 (7)); the next ones with done of total squares
//   04 Practice by skill           GET /api/learn/practice-progress (D203 (11) — it left Today's question's details)
//   05 Standings (Compete)         GET|POST|DELETE /api/atlas/league[/join] — join, the tier as a stamp, the cairn, the rows,
//                                  the promotion line, the gap and its move, the pod's proof, Leave the league
//   06 Runs (Compete)              Challenges stay their own page until Routes carry them (D203 (2)) — an onward ticket
//   07 Onward                      proven skills → Add them to your résumé (+ the unlocks), your passport, See your skills
// Points come ONLY from proof (services/atlas/points.js); nothing here is re-derived. Region IV (Your map's).
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../../lib/api.js";
import { LitSquares, Stamp, LogbookDays, Kickers } from "../../plate/Marks.jsx";
import { StatsStrip, LegHeader } from "../../plate/Plates.jsx";
import { Ticket } from "../../plate/Tickets.jsx";
import { Gazetteer, RouteLine } from "../../plate/Lists.jsx";
import { CompassDial } from "../../plate/Drawings.jsx";
import { Drawer, ErrorLine, Skeleton } from "../../plate/PlateState.jsx";
import LogbookDaysLeg from "../../plate/drawings/LogbookDaysLeg.jsx";
import LogbookSummitCairn from "../../plate/drawings/LogbookSummitCairn.jsx";
import LogbookTierStamp from "../../plate/drawings/LogbookTierStamp.jsx";
import { isoWeekOf } from "../../plate/ledgerModel.js";
import { localDay } from "./BankAnswers.jsx";
import { runLines, questHref } from "./yourRunModel.js";
import { resetWords, moveOf } from "./competeModel.js";
import "../../plate/practicePlate.css";

/** The Today card (and anything else that lights a day) says so; the Logbook reads the run again. */
export const RUN_CHANGED_EVENT = "draft:atlas-run-changed";

const DAY_MS = 86400000;
const isoOf = (d) => new Date(d * DAY_MS).toISOString().slice(0, 10);
const weekdayOf = (d) => (new Date(d * DAY_MS).getUTCDay() + 6) % 7;   // Monday 0
/** The run's month (services/atlas/points.js monthOf: { day, lit, rest, today, off }) as LogbookDays' days. */
export function logbookDays(month = []) {
  return month.map((x) => ({ day: isoOf(x.day), s: x.lit ? "lit" : x.today ? "today" : x.rest ? "rest" : x.off ? "off" : null }));
}
const WHAT_LIT = { lit: "Proof that day — a check passed, an idea explained in your own words, today's question answered, or a build linked.",
  rest: "The week's rest day — it doesn't break your streak.", off: "A weekend — not counted (weekdays only is on).",
  today: "Today — nothing proven yet. One real thing lights it.", none: "Nothing proven that day." };
const QUEST_WORD = { explain: "an explanation", prove: "a check", today: "one review", deck: "a mini-lesson" };
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
const ordinal = (n) => `${n}${[, "ST", "ND", "RD"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] || "TH"}`;

const useGo = () => {
  const navigate = useNavigate();
  return useCallback((href) => (e) => {
    if (!href || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
    e.preventDefault();
    navigate(href);
  }, [navigate]);
};

/** Scroll to #logbook / #standings / #waypoints once the section exists (the forwarded addresses land here). */
function useHashLanding(ready) {
  const { hash } = useLocation();
  useEffect(() => {
    if (!ready || !hash) return undefined;
    const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView?.({ block: "start" }), 0);
    return () => clearTimeout(t);
  }, [ready, hash]);
}

// ── 05 · Standings (behind the Compete switch) ────────────────────────────────────────────────────────────────────────
function Standings({ base, n }) {
  const go = useGo();
  const [league, setLeague] = useState(null);
  const [err, setErr] = useState("");
  const [handle, setHandle] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api("/api/atlas/league").then((l) => { setLeague(l); setErr(""); setHandle((h) => h || l?.suggestion || ""); })
    .catch((e) => setErr(e.message || "The league could not be read.")), []);
  useEffect(() => { load(); }, [load]);
  const join = async () => {
    setBusy(true); setMsg("");
    try { setLeague(await api("/api/atlas/league/join", { method: "POST", body: JSON.stringify({ handle: handle.trim() }) })); }
    catch (e) { setMsg(e.message || "Could not join."); } finally { setBusy(false); }
  };
  const leave = async () => {
    try { await api("/api/atlas/league", { method: "DELETE" }); await load(); } catch (e) { setErr(e.message || "Could not leave."); }
  };
  const me = league?.rows?.find((r) => r.you) || null;
  return (
    <section className="pl-section" aria-labelledby="lb-standings-t" id="standings" data-logbook-section="standings">
      <LegHeader n={n} meta={`COMPETE · OPT-IN · A HANDLE IS ALL ANYONE SEES${league?.resetsIn != null ? ` · ${resetWords(league.resetsIn).toUpperCase()}` : ""}`}
        title={<span id="lb-standings-t">Standings</span>}/>
      {err ? <ErrorLine text={err} onRetry={load}/> : null}
      {!league && !err ? <Skeleton label="Opening the league" height={220}/> : null}
      {league && !league.member ? (
        <Drawer kicker="NOT IN THIS WEEK'S LEAGUE" title={`Join ${league.pod?.name || "your pod"}`} data-league-join="" text={league.rule}
          actions={<>
            <label className="pl-lb__field">Your handle
              <input className="pl-q-input" value={handle} onChange={(e) => setHandle(e.target.value)} maxLength={24} autoComplete="off" spellCheck={false} data-league-handle=""/>
            </label>
            <button type="button" className="pl-btn pl-btn--primary" onClick={join} disabled={busy || !handle.trim()} data-league-join-go="">{busy ? "Joining…" : "Join this week's league"}</button>
            {msg ? <span className="pl-muted pl-lb__meta" role="alert">{msg}</span> : null}
            <span className="pl-muted pl-lb__meta">{resetWords(league.resetsIn)} — Monday 00:00 UTC.</span>
          </>}/>
      ) : null}
      {league?.member ? (
        <div className="pl-lb__split" data-league-pod={league.pod?.size}>
          <div className="pl-lb__main">
            <Kickers parts={[league.pod?.name, league.pod?.size ? `POD OF ${league.pod.size}` : null, league.line].filter(Boolean).map((x) => String(x).toUpperCase())}/>
            <Gazetteer label="This week's league" rowProps={(r) => ({ "data-league-row": r.place, ...(r.you ? { "aria-current": "true", "data-league-you": "" } : {}) })}
              cols={[{ key: "place", label: "#" }, { key: "handle", label: "HANDLE", kind: "title" }, { key: "move", label: "SINCE YESTERDAY" }, { key: "points", label: "POINTS" }]}
              rows={(league.rows || []).map((r) => ({ id: r.handle, place: String(r.place), handle: `${r.handle}${r.you ? " (you)" : ""}`, move: moveOf(r.move).words || "—", points: String(r.points), you: r.you }))}/>
            {league.promotionLine ? <p className="pl-muted pl-lb__meta" data-league-promotion="">The line sits under place {league.promotionLine}: everyone above it moves up to {league.tier?.next} on Monday.</p> : null}
            {league.gap ? (
              <div className="pl-tickets" data-league-gap={league.gap.points}>
                <Ticket kicker={`THE GAP · ${String(league.gap.words).toUpperCase()}`} title={league.gap.move.label} line={`+${league.gap.move.points} points — points come only from proof.`}
                  go="Start →" tone="plain" href={league.gap.move.kind === "check" ? `${base}/your-skills` : `${base}/your-map#waypoints`}
                  onClick={go(league.gap.move.kind === "check" ? `${base}/your-skills` : `${base}/your-map#waypoints`)}/>
                <Ticket kicker="COMPETE · CHALLENGES" title="Challenge someone" line="Beat the bar, time attack or the Friday duel — they earn no points." go="Open the challenges →"
                  href={`${base}/challenges`} onClick={go(`${base}/challenges`)}/>
              </div>
            ) : null}
            {league.feed?.length ? (
              <ul className="pl-body pl-lb__feed" aria-label="Proof in your pod" data-league-feed="">
                {league.feed.map((f, i) => <li key={`${f.handle}-${f.at}-${i}`}><b>{f.handle}</b> {f.words} <span className="pl-label pl-tone-lit">+{f.points}</span></li>)}
              </ul>
            ) : null}
            <p className="pl-muted pl-lb__meta">{league.footer}</p>
            <div className="pl-actions"><button type="button" className="pl-btn" onClick={leave} data-league-leave="">Leave the league</button></div>
          </div>
          <div className="pl-lb__side">
            {league.tier ? <LogbookTierStamp tier={`LEAGUE · TIER ${ROMAN[league.tier.n] || league.tier.n}`} name={league.tier.name} foot={`WEEK ${isoWeekOf()} · ${league.pod?.size || 0} IN THE POD`}
              label={`Your league tier: ${league.tier.name}, week ${isoWeekOf()}`}/> : null}
            <LogbookSummitCairn initials={(league.rows || []).slice(0, 4).map((r) => String(r.handle || "?").slice(0, 2).toUpperCase())}
              kicker={`POD · WEEK ${isoWeekOf()}${me ? ` · YOU ARE ${ordinal(me.place)}` : ""}`}
              label={`The pod's summit cairn: one stone for each of the top four this week${me ? `; you are place ${me.place}` : ""}`}/>
          </div>
        </div>
      ) : null}
    </section>
  );
}

// ── the Logbook ───────────────────────────────────────────────────────────────────────────────────────────────────────
export default function Logbook({ base = "/app/atlas", signedIn = false, compete = null }) {
  const go = useGo();
  const [run, setRun] = useState(null);
  const [error, setError] = useState("");
  const [proofPage, setProofPage] = useState(null);
  const [practice, setPractice] = useState(null);
  const [unlocks, setUnlocks] = useState(null);
  const [picked, setPicked] = useState(null);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const readRun = useCallback(() => api("/api/atlas/run").then((r) => { setRun(r); setError(""); }).catch((e) => setError(e.message || "Your run could not be read.")), []);
  useEffect(() => {
    if (!signedIn) return undefined;
    let live = true;
    readRun();
    api("/api/profile/proof-page").then((r) => live && setProofPage(r)).catch(() => {});
    const again = () => { readRun(); api(`/api/learn/practice-progress?day=${localDay()}`).then((p) => live && setPractice(p)).catch(() => {}); };
    api(`/api/learn/practice-progress?day=${localDay()}`).then((p) => live && setPractice(p)).catch(() => live && setPractice(null));
    window.addEventListener(RUN_CHANGED_EVENT, again);
    return () => { live = false; window.removeEventListener(RUN_CHANGED_EVENT, again); };
  }, [signedIn, readRun]);
  const firstProven = run?.proven?.[0]?.name || null;
  useEffect(() => {
    let live = true;
    if (!firstProven) { setUnlocks(null); return undefined; }
    api(`/api/atlas/unlocks?skill=${encodeURIComponent(firstProven)}`).then((r) => live && setUnlocks(r)).catch(() => live && setUnlocks(null));
    return () => { live = false; };
  }, [firstProven]);
  useHashLanding(!!run || !signedIn);
  if (!signedIn) {
    return (
      <section className="pl-section" id="logbook" aria-label="The Logbook" data-logbook="">
        <Drawer data-run-signed-out="" text="Sign in to start your run. Points come only from proof — an idea explained in your own words, a build, a skill checked."
          actions={<Link className="pl-btn" to="/login">Get started</Link>}/>
      </section>
    );
  }
  if (error) return <section className="pl-section" id="logbook" aria-label="The Logbook" data-logbook=""><ErrorLine text={error} onRetry={readRun}/></section>;
  if (!run) return <section className="pl-section" id="logbook" aria-label="The Logbook" data-logbook=""><Skeleton label="Opening your run" height={320}/></section>;
  const l = runLines(run);
  const setWeekdays = async (on) => {
    try { await api("/api/atlas/prefs", { method: "PUT", body: JSON.stringify({ weekdaysOnly: on }) }); await readRun(); } catch { /* left as it was */ }
  };
  const addProven = async () => {
    setAdding(true);
    try {
      const cur = await api("/api/profile/sections");
      const items = cur?.sections?.skills || [];
      const have = new Set(items.map((x) => String(x.name || "").toLowerCase()));
      const more = (run.proven || []).filter((s) => !have.has(String(s.name).toLowerCase())).map((s) => ({ name: s.name }));
      if (more.length) await api("/api/profile/sections/skills", { method: "PUT", body: JSON.stringify({ items: [...items, ...more] }) });
      setAdded(true); await readRun();
    } catch { /* the button stays */ } finally { setAdding(false); }
  };
  const month = Array.isArray(run.month) ? run.month : [];
  const days = logbookDays(month);
  const lit = days.filter((d) => d.s === "lit").length;
  const quests = run.quests || [];
  const firstUndone = quests.findIndex((q) => !q.done);
  const marks = run.marks || { earned: [], next: [] };
  const skills = practice?.accuracy?.skills || [];
  let n = 0;
  const next = () => ++n;
  return (
    <div className="pl-lb" data-logbook="" data-run-total={run.total}>
      <section className="pl-section" aria-labelledby="lb-level-t" id="logbook" data-logbook-section="days" data-run-level={run.level.n}>
        <LegHeader n={next()} meta="THE LOGBOOK · POINTS COME ONLY FROM PROOF" title={<span id="lb-level-t">{l.level}</span>}/>
        <div className="pl-lb__row">
          <CompassDial lit={Math.round((run.level.pct || 0) / 10)} total={10} label={`${l.level}: ${l.next} — ${Math.round((run.level.pct || 0) / 10)} of ten ticks lit`}/>
          <div className="pl-lb__col">
            <p className="pl-lead" data-run-next="">{l.next}</p>
            <StatsStrip label="Your run" cells={[
              { value: run.streak, label: run.streak ? "DAY STREAK" : "STREAK", attrs: { "data-run-streak": run.streak }, onClick: () => document.getElementById("lb-days")?.scrollIntoView?.({ behavior: "smooth", block: "center" }) },
              { value: run.best || 0, label: "BEST", attrs: { "data-run-best": run.best } },
              { value: `+${run.week}`, label: "THIS WEEK", attrs: { "data-run-week": run.week }, onClick: () => document.getElementById("waypoints")?.scrollIntoView?.({ behavior: "smooth" }) },
              { value: run.total, label: "POINTS" },
            ]}/>
            <p className="pl-label pl-muted" data-run-rule="">{String(run.rule || "").toUpperCase()}</p>
            {!run.streak ? <p className="pl-muted pl-lb__meta">Prove something today to start a streak.</p> : null}
            {(run.pod || run.live) ? (
              <p className="pl-body" data-run-social="">
                {run.pod ? <Link to={`${base}/your-map#standings`} data-run-pod={run.pod.place}>{run.pod.line}</Link> : null}
                {run.pod && run.live ? " · " : null}
                {run.live ? <span className="pl-muted" data-run-live={run.live.n}>{run.live.line}</span> : null}
              </p>
            ) : null}
          </div>
        </div>
        {month.length ? (
          <div className="pl-lb__row pl-lb__days" id="lb-days" data-run-month="">
            <div className="pl-lb__col pl-lb__col--fit">
              <span className="pl-label">LIT DAYS · THE LAST FOUR WEEKS</span>
              <LogbookDays days={days} offset={weekdayOf(month[0].day)} label={`Your run: ${lit} of the last ${days.length} days lit`} onPick={setPicked} picked={picked}/>
              <label className="pl-lb__check" data-run-weekdays={run.weekdaysOnly ? "on" : "off"}>
                <input type="checkbox" className="pl-check" checked={!!run.weekdaysOnly} onChange={(e) => setWeekdays(e.target.checked)}/> Weekdays only — weekends never break it
              </label>
            </div>
            <div className="pl-lb__col">
              <p className="pl-body" aria-live="polite">
                <b>{picked == null ? "Tap a day" : days[picked]?.day}</b>{" — "}{picked == null ? "to see what lit it." : WHAT_LIT[days[picked]?.s || "none"]}
              </p>
              <p className="pl-muted pl-lb__meta">One real thing a day: a check passed, an idea explained in your own words, today's question answered, or something you built and linked. One rest day a week doesn't break your streak.</p>
            </div>
          </div>
        ) : null}
      </section>

      <section className="pl-section" aria-labelledby="lb-way-t" id="waypoints" data-logbook-section="waypoints">
        <LegHeader n={next()} meta={l.today.toUpperCase()} title={<span id="lb-way-t">Waypoints</span>}/>
        {quests.length ? (
          <>
            <div className="pl-lb__row">
              <div className="pl-lb__leg">
                <LogbookDaysLeg stops={quests.slice(0, 3).map((q) => QUEST_WORD[q.id] || q.title)} firstDone={!!quests[0]?.done}
                  kicker={`TODAY · ${quests.filter((q) => q.done).length} OF ${quests.length}`}
                  label={`Today's ${quests.length} waypoints as stops on a short trail; ${quests.filter((q) => q.done).length} done`}/>
              </div>
              <div className="pl-lb__col">
                <RouteLine label="Today's waypoints" stops={quests.map((q, i) => ({ name: q.title, state: q.done ? "lit" : i === firstUndone ? "next" : "ahead", stage: "build" }))}/>
              </div>
            </div>
            <div className="pl-tickets">
              {quests.map((q, i) => {
                const href = questHref(base, q);
                const pts = q.points != null ? `+${q.points} POINTS` : `ABOUT ${q.minutes} MIN`;
                return (
                  <Ticket key={q.id} kicker={q.done ? "✓ DONE TODAY" : i === firstUndone ? `NEXT WAYPOINT · ${pts}` : pts} title={q.title}
                    line={[q.detail, q.lesson].filter(Boolean).join(" · ")} go={q.done ? null : "Start →"} href={q.done ? undefined : href}
                    onClick={q.done ? undefined : go(href)} tone={!q.done && i === firstUndone ? "clay" : "plain"}/>
                );
              })}
            </div>
          </>
        ) : (
          <Drawer data-run-no-quests="" text="Nothing to do today — add a skill on Your skills, or open the Library."
            actions={<><Link className="pl-btn" to={`${base}/your-skills`}>Your skills</Link><Link className="pl-btn" to={`${base}/library`}>The Library</Link></>}/>
        )}
      </section>

      {(marks.earned.length || marks.next.length) ? (
        <section className="pl-section" aria-labelledby="lb-stamps-t" data-logbook-section="stamps" data-run-marks="">
          <LegHeader n={next()} meta="A STAMP WHEN A ROUTE IS COMPLETE · LATER ON YOUR PASSPORT" title={<span id="lb-stamps-t">Stamps</span>}/>
          <div className="pl-lb__stamps">
            {marks.earned.map((m, i) => <span key={`e${m.module}`} data-mark={m.module}><Stamp tone="lit" rotate={i % 2 ? 4 : -6}>{`ROUTE COMPLETE · ${ROMAN[m.module] || m.module} · ${String(m.title).toUpperCase()}`}</Stamp></span>)}
            {marks.next.map((m) => (
              <div key={`n${m.module}`} className="pl-lb__nextstamp" data-mark-next={m.module}>
                <span className="pl-label pl-muted">{`NEXT · ${ROMAN[m.module] || m.module} · ${String(m.title).toUpperCase()} · ${m.done} OF ${m.total}`}</span>
                <LitSquares squares={Array.from({ length: Math.min(m.total, 30) }, (_, i) => (i < Math.round((m.done / Math.max(1, m.total)) * Math.min(m.total, 30)) ? "lit" : null))} size={12}
                  label={`${m.title}: ${m.done} of ${m.total} done`}/>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {practice?.level ? (
        <section className="pl-section" aria-labelledby="lb-practice-t" data-logbook-section="practice" data-practice-progress="">
          <LegHeader n={next()} meta="THREE OR MORE ANSWERS · THE LAST 20 · NO CURVE" title={<span id="lb-practice-t">Practice by skill</span>}/>
          <p className="pl-body"><b>{practice.level.level}</b> · {practice.level.line}{practice.level.next ? ` · ${practice.level.next.more} more for “${practice.level.next.word}”` : ""}</p>
          {practice.streak?.rests > 0 ? <p className="pl-muted pl-lb__meta">Your streak counts {practice.streak.rests} rest day{practice.streak.rests === 1 ? "" : "s"} — one missed day in any seven doesn't break it.</p> : null}
          <div className="pl-iv__gap">
            {skills.length
              ? <Gazetteer label="Practice by skill" rowProps={(r) => ({ "data-skill-accuracy": r.id })}
                  cols={[{ key: "skill", label: "SKILL", kind: "title" }, { key: "right", label: "RIGHT" }]}
                  rows={skills.slice(0, 12).map((s) => ({ id: s.skill, skill: String(s.skill).replace(/-/g, " "), right: `${s.right} of ${s.answered} right` }))}/>
              : <Drawer text="Answer three questions on a skill to see how you're doing on it."/>}
          </div>
          <p className="pl-muted pl-lb__meta">Your level rises when you prove a skill with a quick check or something you built — answering more never raises it.</p>
        </section>
      ) : null}

      {compete?.league ? <Standings base={base} n={next()}/> : null}

      {compete?.challenges ? (
        <section className="pl-section" aria-labelledby="lb-runs-t" id="challenges" data-logbook-section="runs">
          <LegHeader n={next()} meta="COMPETE · TIMED RUNS · THEY EARN NO POINTS" title={<span id="lb-runs-t">Runs</span>}/>
          <div className="pl-tickets">
            <Ticket kicker="BEAT THE BAR · TIME ATTACK · FRIDAY DUEL" title="The challenges" line="Timed, extended time or untimed — share a score, race five questions, or duel your pod on Friday."
              go="Open the challenges →" href={`${base}/challenges`} onClick={go(`${base}/challenges`)}/>
          </div>
        </section>
      ) : null}

      <section className="pl-section pl-section--last" aria-labelledby="lb-onward-t" data-logbook-section="onward">
        <LegHeader n={next()} meta="ONWARD" title={<span id="lb-onward-t">Where this proof goes</span>}/>
        {run.proven?.length ? (
          <div className="pl-lb__proven" data-run-proven="">
            <p className="pl-body"><b>Proven:</b> you can add {run.proven.slice(0, 4).map((s) => s.name).join(", ")}{run.proven.length > 4 ? ` and ${run.proven.length - 4} more` : ""} to your résumé.</p>
            <div className="pl-actions">
              <button type="button" className="pl-btn pl-btn--primary" onClick={addProven} disabled={adding} data-run-add-proven="">{adding ? "Adding…" : `Add ${run.proven.length === 1 ? "it" : "them"} to your résumé`}</button>
              {added ? <span className="pl-muted pl-lb__meta" role="status">Added to your profile's skills.</span> : null}
            </div>
            {unlocks?.total > 0 ? (
              <div data-run-unlocks={unlocks.total}>
                <p className="pl-body"><b>{unlocks.total} open job{unlocks.total === 1 ? "" : "s"}</b> in your role ask for {unlocks.skill}{unlocks.intoTop ? ` — ${unlocks.intoTop} move into your top matches` : ""}.</p>
                <ul className="pl-body pl-lb__feed">
                  {unlocks.jobs.map((j) => (
                    <li key={j.job_id}><Link to={`/app/jobs?job=${encodeURIComponent(j.job_id)}`}>{j.title}</Link>
                      <span className="pl-muted"> · {j.company} · asks for {j.before} → {j.after} of your {j.of} top skills</span></li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="pl-tickets">
          <Ticket kicker="YOUR SKILLS" title="See your skills" line="What you've listed, what you've proven, and the quick checks." go="Your skills →" href={`${base}/your-skills`} onClick={go(`${base}/your-skills`)}/>
          {run.total > 0 && proofPage ? (proofPage.enabled && proofPage.showLearning && proofPage.handle
            ? <Ticket kicker={`YOUR PASSPORT · /IN/${String(proofPage.handle).toUpperCase()}`} title="What you've proven, with dates" line="Your public profile lists it; link it from an application."
                go="Open your profile →" href={`/in/${proofPage.handle}`}/>
            : <Ticket kicker="YOUR PASSPORT" title="Link what you've proven from an application" line="Show it on your profile in Your profile → Behind your profile."
                go="Your profile →" href="/app/profile/about" onClick={go("/app/profile/about")}/>) : null}
        </div>
      </section>
    </div>
  );
}

/** ⭐ D203 (11) · stack exposure → Your survey: how much the board asks for your stack (services/learn/stackExposure.js) —
 *  it left Today's question's details; drawn under Your survey on Your map. */
export function StackOnTheBoard() {
  const [s, setS] = useState(null);
  useEffect(() => { api("/api/learn/stack-exposure").then(setS).catch(() => setS(null)); }, []);
  if (!s) return null;
  return (
    <section className="pl-section" aria-labelledby="lb-stack-t" data-stack-exposure="">
      <LegHeader meta={`YOUR SURVEY · ${String(s.scope || "").toUpperCase()}`} title={<span id="lb-stack-t">Your stack on the board</span>}/>
      {s.unmatched ? <Drawer text={s.unmatched}/> : (
        <Gazetteer label="Your stack on the board" rowProps={(r) => ({ "data-stack-tech": r.id, "data-trend": r.trend })}
          cols={[{ key: "tech", label: "TECHNOLOGY", kind: "title" }, { key: "open", label: "OPEN" }, { key: "share", label: "SHARE" }, { key: "words", label: "TREND" }]}
          rows={(s.stack || []).map((t) => ({ id: t.tech, tech: t.tech, trend: t.trend, open: Number(t.open || 0).toLocaleString("en-US"), share: `${t.share}%`, words: t.words }))}/>
      )}
      <p className="pl-muted pl-lb__meta">From the jobs draft has read, not the whole market: the last {s.windowDays} days against the {s.windowDays} before.</p>
    </section>
  );
}
