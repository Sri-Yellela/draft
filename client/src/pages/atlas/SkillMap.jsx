// ⭐ A228 (46r, owner 11-16 "Build it" — docs/sketches/A228-ab-combined.html, docs/A228_SKILL_MAP.md) · YOUR MAP: the skill
// map as one page, top to bottom —
//   1 the number: "N jobs you can apply for today" (+ the level tiles where the jobs carry a level), and "How close you
//     are to each job" (JobsHistogram);
//   2 "What <role> jobs want" — the map by family, or the same as a ranked List (SkillTreemap; one view at a time), with
//     buttons that re-size it for another role and "Aim for this";
//   3 "Learn next" — the step chart (LearnNextChart) and the steps, each with the skill's picture, "+N jobs", the hours
//     and the companies it opens (CompanyLogo);
//   4 "Jobs you could move to" — the scatter (MoveRolesScatter) and a card per role.
// Plain words throughout ("jobs", never postings / asks / coverage). Everything comes from ONE reading,
// GET /api/atlas/skill-map (services/atlas/skillMap.js) — counted, no model (D190). Theme tokens only (SkillMap.css).
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../lib/api.js";
import { loginHref } from "../../lib/signInReturn.js";
import DepthButton from "../../components/DepthButton.jsx";
import CompanyLogo from "../../components/CompanyLogo.jsx";
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

function Hero({ m }) {
  const who = m.current && m.aim && m.current.id !== m.aim.id ? `${m.current.name} → aiming for ${m.aim.name}`
    : m.aim ? `Aiming for ${m.aim.name}` : m.current ? `Today: ${m.current.name}` : null;
  return (
    <section className="skm-panel skm-hero" data-skm-section="number" aria-labelledby="skm-n">
      <div className="skm-hero__lead">
        {who && <p className="skm-small" data-skm-who="">{who}</p>}
        <p className="skm-hero__num" id="skm-n"><b className="skm-num" data-skm-applicable={m.applicable}>{fmt(m.applicable)}</b>
          <span className="skm-small">jobs you can apply for today</span></p>
        <p className="skm-hero__line">{heroLine(m)}</p>
        {m.levels && (
          <div className="skm-levels" data-skm-levels="">
            {m.levels.map(l => (
              <div key={l.level} data-skm-level={l.level}>
                <span className="skm-eyebrow">{LEVEL_WORD[l.level] || l.level}</span>
                <b className="skm-num">{fmt(l.applicable)}</b>
                <span className="skm-small">of {jobsWord(l.open)}</span>
              </div>
            ))}
          </div>
        )}
        {(m.skills.proven + m.skills.claimed) === 0 && (
          <p className="skm-small" data-skm-no-skills="">Add your skills (or a résumé) and this number becomes yours.{" "}
            <Link className="atl__link" to="/app/atlas/your-skills">Your skills</Link></p>
        )}
      </div>
      <div className="skm-hero__chart">
        <div className="skm-head"><h2 className="skm-h2">How close you are to each job</h2>
          <span className="skm-small">Every open {m.role.name} job, by how much of it you have</span></div>
        <JobsHistogram bins={m.histogram} threshold={m.threshold} roleName={m.role.name} />
      </div>
    </section>
  );
}

function RoleButtons({ m, onRole }) {
  return (
    <div className="skm-roles" role="group" aria-label="Show the map for a job" data-skm-roles="">
      {m.roles.map(r => (
        <DepthButton key={r.id} pressed={r.id === m.role.id} onClick={() => onRole(r.slug)}>
          <span data-skm-role-btn={r.slug}>{r.name}{r.isCurrent ? <span className="skm-faint"> · today</span> : r.isAim ? <span className="skm-faint"> · your aim</span> : null}</span>
        </DepthButton>
      ))}
    </div>
  );
}

function WantPanel({ m, view, setView, onRole }) {
  return (
    <section className="skm-panel" data-skm-section="wants" aria-labelledby="skm-wants">
      <div className="skm-head">
        <h2 className="skm-h2" id="skm-wants">What {m.role.name} jobs want</h2>
        <div className="skm-seg" role="group" aria-label="View" data-skm-view={view}>
          <button type="button" aria-pressed={view === "map"} onClick={() => setView("map")}>Map</button>
          <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>List</button>
        </div>
      </div>
      <RoleButtons m={m} onRole={onRole} />
      <StateLegend extra={view === "map" ? "Bigger square = more jobs want it" : "Longer bar = more jobs want it"} />
      <SkillTreemap asks={m.asks} view={view} roleName={m.role.name} />
    </section>
  );
}

function LearnPanel({ m, base }) {
  const navigate = useNavigate();
  const steps = m.route.steps;
  const f = steps[0];
  return (
    <section className="skm-panel" data-skm-section="learn" aria-labelledby="skm-learn">
      <div className="skm-head"><h2 className="skm-h2" id="skm-learn">Learn next</h2>
        {steps.length > 0 && <span className="skm-small">about {fmt(m.route.hours)} hours in all{m.route.estimated ? " (some hours are an estimate)" : ""}</span>}</div>
      <LearnNextChart applicable={m.applicable} steps={steps} />
      <ol className="skm-steps" data-skm-steps="">
        {steps.length === 0 && <li className="skm-step"><span /><span>Prove what's on your résumé to grow this.</span><span /></li>}
        {steps.map(s => (
          <li key={s.id} className="skm-step" data-skm-step={s.slug} data-kind={s.kind}>
            <SkillMark name={s.name} thumb={s.thumb} size={30} />
            <Link className="skm-step__name" to={stepHref(base, s)}>{stepVerb(s)}</Link>
            <span className="skm-step__plus" tabIndex={0} title={`Then ${fmt(s.total)} jobs you can apply for`}>+{jobsWord(s.gain)}</span>
            <span className="skm-step__sub">
              <span>about {fmt(s.hours)} h{s.estimated ? " (an estimate)" : ""}</span>
              {s.companies.length > 0 && (
                <span className="skm-cos" aria-label={`Jobs at ${s.companies.map(c => c.name).join(", ")}`}>
                  {s.companies.map(c => <span key={c.name} title={c.name}><CompanyLogo company={c.name} iconUrl={c.iconUrl} size={26} radius={6} /></span>)}
                  {s.gain > s.companies.reduce((a, c) => a + c.jobs, 0) && <span>and more</span>}
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>
      <div className="skm-actions">
        {f ? <span data-skm-next="" data-href={stepHref(base, f)}><DepthButton primary onClick={() => navigate(stepHref(base, f))}>{f.kind === "prove" ? "Prove" : "Start"} {f.name} · {fmt(f.hours)} h</DepthButton></span>
          : <span data-skm-next="" data-href={`${base}/your-skills`}><DepthButton primary onClick={() => navigate(`${base}/your-skills`)}>Prove a skill</DepthButton></span>}
        <span data-skm-see-jobs=""><DepthButton onClick={() => navigate(`/app/jobs?search=${encodeURIComponent(m.role.name)}`)}>See these jobs</DepthButton></span>
      </div>
    </section>
  );
}

function MovePanel({ m, onRole, onAim, aiming }) {
  return (
    <section className="skm-panel" data-skm-section="move" aria-labelledby="skm-move">
      <div className="skm-head"><h2 className="skm-h2" id="skm-move">Jobs you could move to</h2>
        <span className="skm-small">Further right = you already have more of what they want. Higher = more open jobs.</span></div>
      <MoveRolesScatter roles={m.move} />
      <div className="skm-move" data-skm-move="">
        {[...m.move].sort((a, b) => b.coverage - a.coverage).map(r => (
          <div key={r.id} className="skm-card" data-skm-card={r.slug}>
            <div className="skm-head"><b>{r.name}{r.isCurrent ? " · today" : r.isAim ? " · your aim" : ""}</b><span className="skm-small skm-num">{fmt(r.open)} open</span></div>
            <div className="skm-meter" role="img" aria-label={`You have ${pct(r.coverage)} of it`}><i style={{ width: `${Math.round(r.coverage * 100)}%` }} /></div>
            <div className="skm-small">You have {pct(r.coverage)} of it · {jobsWord(r.applicable)} to apply for now</div>
            {r.carries.length > 0 && <div className="skm-cos">{r.carries.map(c => <span key={c.id} title={c.name}><SkillMark name={c.name} thumb={c.thumb} size={22} /></span>)}<span className="skm-small">carry over</span></div>}
            {r.missing.length > 0 && <div className="skm-cos">{r.missing.map(c => <span key={c.id} title={c.name}><SkillMark name={c.name} thumb={c.thumb} size={22} /></span>)}
              <span className="skm-small">to learn{r.hoursTo30 ? ` · about ${fmt(r.hoursTo30)} h to apply for 3 in 10` : ""}</span></div>}
            <div className="skm-actions">
              {!r.isShown && <DepthButton onClick={() => onRole(r.slug)}>Show its map</DepthButton>}
              {!r.isAim && <DepthButton disabled={aiming} onClick={() => onAim(r.slug)}>Aim for this</DepthButton>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** The page drawn from GET /api/atlas/skill-map's answer — pure apart from its callbacks (tests render it). */
export function SkillMapView({ m, base = "/app/atlas", view = "map", setView = () => {}, onRole = () => {}, onAim = () => {}, aiming = false }) {
  return (
    <div className="skm" data-skill-map={m.role.slug}>
      <Hero m={m} />
      <div className="skm-main">
        <WantPanel m={m} view={view} setView={setView} onRole={onRole} />
        <LearnPanel m={m} base={base} />
      </div>
      <MovePanel m={m} onRole={onRole} onAim={onAim} aiming={aiming} />
    </div>
  );
}

export default function SkillMap({ base = "/app/atlas", signedIn = true }) {
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
      .catch(e => live && setState({ status: "error", m: null, error: e.message }));
    return () => { live = false; };
  }, [role, signedIn, n]);
  if (!signedIn) return <p className="atl__quiet" data-skm-sign-in="">Sign in with a résumé to see how many jobs you can apply for today. <Link to={loginHref()} className="atl__link">Sign in</Link></p>;
  if (!state.m) return <p className="atl__quiet" role="status">{state.status === "error" ? `Your map could not be read: ${state.error}` : "Opening…"}</p>;
  // "Aim for this" sets the aim through the navigator's own endpoint (D143), and the map follows it.
  const onAim = async (slug) => {
    setAiming(true);
    try { await api("/api/navigator/aim", { method: "PUT", body: JSON.stringify({ slug }) }); setRole(null); setN(x => x + 1); }
    catch { /* the map stays as it is */ }
    finally { setAiming(false); }
  };
  return <SkillMapView m={state.m} base={base} view={view} setView={setView} onRole={setRole} onAim={onAim} aiming={aiming} />;
}
