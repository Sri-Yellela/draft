// ⭐ A228 (46r, owner 11-16 "Build it" — docs/A228_SKILL_MAP.md) · YOUR MAP: the skill map as one page.
// ⭐ D200 (a) (47h, owner 11-25 approved the `YourSurvey` board, docs/sketches/final/project/YourSurvey.dc.html) · YOUR
// SURVEY — today's skill map KEPT WHOLE, restyled into the plate system; the page at /atlas/your-map (Atlas's signed-in
// default) IS Your survey. Top to bottom, as the board:
//   the head — the aim line (YOUR SURVEY · ATLAS · <today> → aiming for <aim>), "N jobs you can apply for today", the
//     sentence (Out of N open … Learn X and that grows by N), the levels, the role chips (re-survey another role);
//   01 How close you are to each job — the histogram (JobsHistogram);
//   02 What the jobs want, plot by plot — THE THIRD MAP, the cadastral survey (SkillTreemap: plots, districts, lots;
//      Map / List; proven / on your résumé / not yet); tap a plot → its place in Atlas;
//   03 The climb to every job — Learn next: the step chart (LearnNextChart), each skill's +N jobs / ≈ h / the companies,
//      Start / See these jobs;
//   04 Roles next door — Jobs you could move to: the scatter (MoveRolesScatter) and a card per role (carry over / to
//      learn, Show its map, Aim for this, ⇄ N openings · the market — the interchange to the market, a real count);
//   05 The whole route — your route, step by step (+ the track board and the navigator, handed in by Atlas: routeMore).
// Every chart keeps "Show as a table". Plain words throughout ("jobs", never postings / asks / coverage). Everything comes
// from ONE reading, GET /api/atlas/skill-map (services/atlas/skillMap.js) — counted, no model (D190). Tokens only
// (SkillMap.css, the plate's --pl-* tokens); no capsules (D60).
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../lib/api.js";
import { loginHref } from "../../lib/signInReturn.js";
import DepthButton from "../../components/DepthButton.jsx";
import { NoteCard } from "../../components/TextBlocks.jsx";   // A233
import CompanyLogo from "../../components/CompanyLogo.jsx";
import PlateRoot from "../../plate/PlateRoot.jsx";
import { LegHeader } from "../../plate/Plates.jsx";
import { Kickers } from "../../plate/Marks.jsx";
import JobsHistogram from "./JobsHistogram.jsx";
import SkillTreemap from "./SkillTreemap.jsx";
import LearnNextChart from "./LearnNextChart.jsx";
import MoveRolesScatter from "./MoveRolesScatter.jsx";
import { SkillMark, StateLegend } from "./SkillMapBits.jsx";
import { fmt, jobsWord, LEVEL_WORD, pct, stepVerb } from "./skillMapModel.js";
import { learnStepHref } from "./atlasPanels.js";
import "./SkillMap.css";

/** Where a step's button goes: Prove → its quick check on Your skills; Learn → its Library piece, else its Atlas page. */
export function stepHref(base, s) {
  if (s.kind === "prove") return `${base}/your-skills?prove=${encodeURIComponent(s.name)}`;
  if (s.stepId) return learnStepHref(base, s.stepId);
  return s.published && s.slug ? `${base}/${encodeURIComponent(s.slug)}` : `${base}/library`;
}

/** The hero's sentence — PURE (the tests read it). */
export function heroLine(m) {
  const f = m.route?.steps?.[0];
  const grow = f ? ` ${f.kind === "prove" ? "Prove" : "Learn"} ${f.name} and that grows by ${fmt(f.gain)}.` : "";
  return `Out of ${fmt(m.role.open)} open ${m.role.name} jobs, you have most of what these ask for.${grow}`;
}

/** The market's address for a role — the interchange "⇄ N openings · the market" (the market reads ?search=). */
export const marketHref = (name) => `/app/jobs?search=${encodeURIComponent(name)}`;

const roleTag = (r) => (r.isAim ? " · your aim" : r.isCurrent ? " · today" : "");

function Head({ m, onRole }) {
  const who = m.current && m.aim && m.current.id !== m.aim.id ? `${m.current.name} → aiming for ${m.aim.name}`
    : m.aim ? `Aiming for ${m.aim.name}` : m.current ? `Today: ${m.current.name}` : null;
  // the aim's chip first, then today's, then the rest (the board's order)
  const rank = (r) => (r.isAim ? 0 : r.isCurrent ? 1 : 2);
  const roles = [...m.roles].sort((a, b) => rank(a) - rank(b));
  return (
    <section className="ys-head" data-skm-section="number" aria-labelledby="ys-n">
      <div data-skm-who={who ? "" : undefined}><Kickers parts={["Your survey · Atlas", ...(who ? [who] : [])]} /></div>
      <h1 className="ys-h1" id="ys-n"><span className="ys-num" data-skm-applicable={m.applicable}>{fmt(m.applicable)}</span> jobs you can apply for today</h1>
      <p className="ys-lead">{heroLine(m)}</p>
      {m.levels && (
        <div className="ys-levels" role="list" aria-label="By level" data-skm-levels="">
          {m.levels.map(l => (
            <div key={l.level} role="listitem" data-skm-level={l.level}>
              <span className="ys-levels__n">{fmt(l.applicable)}<span className="ys-levels__of"> of {fmt(l.open)}</span></span>
              <span className="ys-label">{LEVEL_WORD[l.level] || l.level}</span>
            </div>
          ))}
        </div>
      )}
      {(m.skills.proven + m.skills.claimed) === 0 && (
        <p className="ys-note" data-skm-no-skills="">Add your skills (or a résumé) and this number becomes yours.{" "}
          <Link to="/app/atlas/your-skills">Your skills</Link></p>
      )}
      <div className="ys-roles" role="group" aria-label="Roles to survey" data-skm-roles="">
        {roles.map(r => (
          <button key={r.id} type="button" className="ys-chip" aria-pressed={r.id === m.role.id} data-skm-role-btn={r.slug} onClick={() => onRole(r.slug)}>
            {r.name}{roleTag(r)}
          </button>
        ))}
      </div>
    </section>
  );
}

function Leg({ n, id, meta, title, lead, children, section }) {
  return (
    <section className="ys-sec" data-skm-section={section} aria-labelledby={id}>
      <LegHeader n={n} id={id} meta={meta} title={title} />
      {lead && <p className="ys-p">{lead}</p>}
      {children}
    </section>
  );
}

function ClosePanel({ m }) {
  return (
    <Leg n={1} id="close" section="close" meta={`Every open ${m.role.name} job · by how much of it you have`} title="How close you are to each job"
      lead="Each bar is a group of jobs; past the dashed line you have enough to apply.">
      <JobsHistogram bins={m.histogram} threshold={m.threshold} roleName={m.role.name} open={m.role.open} applicable={m.applicable} />
    </Leg>
  );
}

function WantPanel({ m, view, setView, base }) {
  return (
    <Leg n={2} id="want" section="wants" meta={`The survey · What ${m.role.name} jobs want · plots sized by demand`} title="What the jobs want, plot by plot"
      lead="Every skill these jobs ask for, as a plot sized by how many want it. Tap one to open its place in Atlas.">
      <div className="ys-keyrow">
        <StateLegend extra={view === "map" ? "Bigger plot = more jobs want it" : "Longer bar = more jobs want it"} />
        <span className="ys-grow" />
        <span className="ys-seg" role="group" aria-label="View" data-skm-view={view}>
          <button type="button" aria-pressed={view === "map"} onClick={() => setView("map")}>Map</button>
          <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>List</button>
        </span>
      </div>
      <SkillTreemap asks={m.asks} view={view} roleName={m.role.name} base={base} firstPick={m.route?.steps?.[0]?.slug || null} />
    </Leg>
  );
}

function LearnPanel({ m, base }) {
  const navigate = useNavigate();
  const steps = m.route.steps;
  const f = steps[0];
  const meta = steps.length ? `Learn next · about ${fmt(m.route.hours)} hours in all${m.route.estimated ? " (some hours are an estimate)" : ""}` : "Learn next";
  return (
    <Leg n={3} id="learn" section="learn" meta={meta} title="The climb to every job"
      lead="Each step is one skill; the line is how many of these jobs you could apply for after it.">
      <LearnNextChart applicable={m.applicable} steps={steps} open={m.role.open} roleName={m.role.name} />
      <div className="ys-card ys-steps">
        <ol className="ys-steps__list" data-skm-steps="">
          {steps.length === 0 && <li className="ys-step"><span>Prove what's on your résumé to grow this.</span></li>}
          {steps.map(s => (
            <li key={s.id} className="ys-step" data-skm-step={s.slug} data-kind={s.kind}>
              <SkillMark name={s.name} thumb={s.thumb} have={s.kind === "prove"} />
              <Link className="ys-step__name" to={stepHref(base, s)}>{stepVerb(s)}</Link>
              <span className="ys-step__h">about {fmt(s.hours)} h{s.estimated ? " (an estimate)" : ""}</span>
              {s.companies.length > 0 && (
                <span className="ys-cos" aria-label={`Jobs at ${s.companies.map(c => c.name).join(", ")}`}>
                  <span className="ys-cos__logos">
                    {s.companies.map(c => <span key={c.name} title={c.name}><CompanyLogo company={c.name} iconUrl={c.iconUrl} size={24} radius={12} /></span>)}
                  </span>
                  {s.gain > s.companies.reduce((a, c) => a + c.jobs, 0) && <span className="ys-cos__more">and more</span>}
                </span>
              )}
              <span className="ys-step__plus" tabIndex={0} title={`Then ${fmt(s.total)} jobs you can apply for`}>+{jobsWord(s.gain)}</span>
            </li>
          ))}
        </ol>
        <div className="ys-actions">
          {f ? <span data-skm-next="" data-href={stepHref(base, f)}><button type="button" className="ys-btn ys-btn--clay" onClick={() => navigate(stepHref(base, f))}>{f.kind === "prove" ? "Prove" : "Start"} {f.name} · {fmt(f.hours)} h</button></span>
            : <span data-skm-next="" data-href={`${base}/your-skills`}><button type="button" className="ys-btn ys-btn--clay" onClick={() => navigate(`${base}/your-skills`)}>Prove a skill</button></span>}
          <span data-skm-see-jobs=""><button type="button" className="ys-btn" onClick={() => navigate(marketHref(m.role.name))}>See these jobs</button></span>
        </div>
      </div>
    </Leg>
  );
}

function MovePanel({ m, onRole, onAim, aiming }) {
  return (
    <Leg n={4} id="move" section="move" meta="Jobs you could move to · further right = you have more · higher = more open jobs" title="Roles next door"
      lead="Every role your skills carry into, and what each would take.">
      <MoveRolesScatter roles={m.move} />
      <div className="ys-move" data-skm-move="">
        {[...m.move].sort((a, b) => b.coverage - a.coverage).map(r => (
          <article key={r.id} className={`ys-role${r.isShown ? " ys-role--on" : ""}`} data-skm-card={r.slug}>
            <div className="ys-role__top"><b className="ys-role__name">{r.name}{roleTag(r)}</b><span className="ys-role__open">{fmt(r.open)} open</span></div>
            <span className="ys-meter" role="img" aria-label={`You have ${pct(r.coverage)} of it`}><i style={{ width: `${Math.round(r.coverage * 100)}%` }} /></span>
            <span className="ys-role__have">You have <b>{pct(r.coverage)}</b> of it · {jobsWord(r.applicable)} to apply for now</span>
            {r.carries.length > 0 && <div className="ys-role__tiles">{r.carries.map(c => <SkillMark key={c.id} name={c.name} thumb={c.thumb} have />)}<span className="ys-role__note">carry over</span></div>}
            {r.missing.length > 0 && <div className="ys-role__tiles">{r.missing.map(c => <SkillMark key={c.id} name={c.name} thumb={c.thumb} />)}
              <span className="ys-role__note">to learn{r.hoursTo30 ? ` · about ${fmt(r.hoursTo30)} h to apply for 3 in 10` : ""}</span></div>}
            <div className="ys-role__rule" aria-hidden="true" />
            <div className="ys-role__acts">
              {!r.isShown && <button type="button" className="ys-btn ys-btn--sm" onClick={() => onRole(r.slug)}>Show its map</button>}
              {!r.isAim && <button type="button" className="ys-btn ys-btn--sm ys-btn--ink" disabled={aiming} onClick={() => onAim(r.slug)}>Aim for this</button>}
              <Link className="ys-to-market" to={marketHref(r.name)} data-skm-to-market={r.slug}>⇄ {fmt(r.open)} openings · the market</Link>
            </div>
          </article>
        ))}
      </div>
    </Leg>
  );
}

function RoutePanel({ m, routeMore }) {
  const steps = m.route.steps;
  return (
    <Leg n={5} id="route" section="route" meta="Your route, step by step" title="The whole route" lead="Open it to see every step in order.">
      <details open className="ys-card ys-route" data-atlas-route-steps="">
        <summary>Your route, step by step</summary>
        <ol className="ys-route__list" data-skm-route-steps="">
          <li><span className="ys-route__n ys-route__n--done" aria-hidden="true">✓</span><span><b>Your résumé today</b> <span className="ys-route__sub">· {jobsWord(m.applicable)}</span></span></li>
          {steps.map((s, i) => (
            <li key={s.id} data-skm-route-step={s.slug}>
              <span className={`ys-route__n${i === 0 ? " ys-route__n--next" : ""}`} aria-hidden="true">{i + 2}</span>
              <span><b>{stepVerb(s)}</b> <span className="ys-route__sub">· +{jobsWord(s.gain)} · {fmt(s.hours)} h</span></span>
            </li>
          ))}
        </ol>
        {routeMore}
      </details>
    </Leg>
  );
}

/** ⭐ 46u · no map to draw: no role is read from the board's jobs yet (no_roles), or the asked role isn't one (unknown_role). */
export function SkillMapEmpty({ base = "/app/atlas", reason = "no_roles", onBack = null }) {
  const unknown = reason === "unknown_role";
  return (
    <NoteCard id="skill-map-empty" title={unknown ? "That role isn't on the map" : "Your map is on its way"} data-skm-empty={reason}
      actions={unknown && onBack ? <DepthButton primary onClick={onBack}>Back to your role</DepthButton> : <Link to={`${base}/library`}>Open the Library</Link>}>
      {unknown ? "Pick another role, or go back to the one you're aiming for." : "It appears once draft has read enough jobs to know what each role asks for. Meanwhile, start with a guide."}
    </NoteCard>
  );
}

/** The page drawn from GET /api/atlas/skill-map's answer — pure apart from its callbacks (tests render it). */
export function SkillMapView({ m, base = "/app/atlas", view = "map", setView = () => {}, onRole = () => {}, onAim = () => {}, aiming = false, routeMore = null }) {
  return (
    <PlateRoot className="ys" data-skill-map={m.role.slug} data-your-survey="">
      <Head m={m} onRole={onRole} />
      <ClosePanel m={m} />
      <WantPanel m={m} view={view} setView={setView} base={base} />
      <LearnPanel m={m} base={base} />
      <MovePanel m={m} onRole={onRole} onAim={onAim} aiming={aiming} />
      <RoutePanel m={m} routeMore={routeMore} />
    </PlateRoot>
  );
}

export default function SkillMap({ base = "/app/atlas", signedIn = true, routeMore = null }) {
  const [role, setRole] = useState(null);   // null = the aim (the server's default)
  const [view, setView] = useState("map");
  const [state, setState] = useState({ status: "loading", m: null });
  const [aiming, setAiming] = useState(false);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!signedIn) return undefined;
    let live = true;
    setState(s => ({ status: "loading", m: s.m }));
    api(`/api/atlas/skill-map${role ? `?role=${encodeURIComponent(role)}` : ""}`)
      .then(m => live && setState({ status: "done", m }))
      .catch(e => live && setState({ status: "error", m: null, error: e.message, reason: e.status === 404 ? (e.payload?.reason || "no_roles") : null }));
    return () => { live = false; };
  }, [role, signedIn, n]);
  if (!signedIn) return <p className="atl__quiet" data-skm-sign-in="">Sign in with a résumé to see how many jobs you can apply for today. <Link to={loginHref()} className="atl__link">Sign in</Link></p>;
  // ⭐ 46u: Your map is Atlas's first screen now — "no map yet" is a page of its own, never a raw "Request failed (404)".
  if (state.reason || (state.m && !state.m.role)) return <SkillMapEmpty base={base} reason={state.reason || "no_roles"} onBack={role ? () => setRole(null) : null} />;
  if (!state.m) return <p className="atl__quiet" role="status">{state.status === "error" ? `Your map could not be read: ${state.error}` : "Opening…"}</p>;
  // "Aim for this" sets the aim through the navigator's own endpoint (D143), and the map follows it.
  const onAim = async (slug) => {
    setAiming(true);
    try { await api("/api/navigator/aim", { method: "PUT", body: JSON.stringify({ slug }) }); setRole(null); setN(x => x + 1); }
    catch { /* the map stays as it is */ }
    finally { setAiming(false); }
  };
  return <SkillMapView m={state.m} base={base} view={view} setView={setView} onRole={setRole} onAim={onAim} aiming={aiming} routeMore={routeMore} />;
}
