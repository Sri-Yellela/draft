// ⭐ D172 (3) (owner APPROVED 11-06, docs/sketches/atlas-redesign-sketch.html → Your run) · YOUR RUN: your level as a ring,
// the points to the next one, your streak, this week, and today's quests — about five minutes. Points come ONLY from
// proof (services/atlas/points.js: an idea explained in your own words, a build, a skill checked or built); a quest is
// shown only when its thing exists (no daily question until D154; no deck until the decks are wired; the pod's rank and the live
// count only when their switch is on, A154 45s). Reads GET /api/atlas/run.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api.js";
import DepthButton from "../../components/DepthButton.jsx";   // A155: the one-button add
import { runLines, questHref } from "./yourRunModel.js";
import "./YourRun.css";

function Ring({ pct }) {
  const r = 52, c = 2 * Math.PI * r;
  return (
    <svg className="run-ring" viewBox="0 0 128 128" aria-hidden="true" focusable="false">
      <circle cx="64" cy="64" r={r} className="run-ring__track" />
      {pct > 0 && <circle cx="64" cy="64" r={r} className="run-ring__fill" strokeDasharray={`${(c * pct) / 100} ${c}`} transform="rotate(-90 64 64)" />}
      <text x="64" y="72" textAnchor="middle" className="run-ring__pct">{pct}%</text>
    </svg>
  );
}

export default function YourRun({ base = "/app/atlas", signedIn = false }) {
  const [run, setRun] = useState(null);
  const [error, setError] = useState("");
  const [proofPage, setProofPage] = useState(null);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [unlocks, setUnlocks] = useState(null);
  useEffect(() => {
    let live = true;
    if (!signedIn) return undefined;
    api("/api/atlas/run").then(r => live && setRun(r)).catch(e => live && setError(e.message || "Your run could not be read."));
    api("/api/profile/proof-page").then(r => live && setProofPage(r)).catch(() => {});
    return () => { live = false; };
  }, [signedIn]);
  // ⭐ D185-4: what the first proven skill unlocks (one read, on the server's workers).
  const firstProven = run?.proven?.[0]?.name || null;
  useEffect(() => {
    let live = true;
    if (!firstProven) { setUnlocks(null); return undefined; }
    api(`/api/atlas/unlocks?skill=${encodeURIComponent(firstProven)}`).then(r => live && setUnlocks(r)).catch(() => live && setUnlocks(null));
    return () => { live = false; };
  }, [firstProven]);
  if (!signedIn) return (
    <div className="atl-pan" data-atlas-panel-body="your-run">
      <p className="atl__quiet" data-run-signed-out="">Sign in to start your run. Points come only from proof — an idea explained in your own words, a build, a skill checked.</p>
    </div>
  );
  if (error) return <div className="atl-pan" data-atlas-panel-body="your-run"><p className="atl__quiet" role="alert">{error}</p></div>;
  // A155 · the weekdays-only choice (PUT /api/atlas/prefs) and the one-button add of proven skills to the profile's skills.
  const setWeekdays = async (on) => {
    try { await api("/api/atlas/prefs", { method: "PUT", body: JSON.stringify({ weekdaysOnly: on }) }); setRun(await api("/api/atlas/run")); } catch { /* left as it was */ }
  };
  const addProven = async () => {
    setAdding(true);
    try {
      const cur = await api("/api/profile/sections");
      const items = cur?.sections?.skills || [];
      const have = new Set(items.map(x => String(x.name || "").toLowerCase()));
      const more = (run.proven || []).filter(s => !have.has(String(s.name).toLowerCase())).map(s => ({ name: s.name }));
      if (more.length) await api("/api/profile/sections/skills", { method: "PUT", body: JSON.stringify({ items: [...items, ...more] }) });
      setAdded(true); setRun(await api("/api/atlas/run"));
    } catch { /* the button stays */ } finally { setAdding(false); }
  };
  if (!run) return <div className="atl-pan" data-atlas-panel-body="your-run"><p className="atl__quiet" role="status">Opening your run…</p></div>;
  const l = runLines(run);
  return (
    <div className="atl-pan run" data-atlas-panel-body="your-run" data-run-total={run.total}>
      <div className="run-card" data-run-level={run.level.n}>
        <Ring pct={run.level.pct} />
        <div className="run-card__body">
          <h1 className="atl__title run-card__level">{l.level}</h1>
          <p className="run-card__next" data-run-next="">{l.next}</p>
          <p className="atl__quiet" data-run-rule="">{run.rule}</p>
        </div>
        <div className="run-card__stats">
          <p className="run-stat" data-run-streak={run.streak}><b>{run.streak}</b><span>{l.streak}</span></p>
          {run.best > 0 && <p className="run-stat run-stat--best" data-run-best={run.best}><span>Best: {run.best} day{run.best === 1 ? "" : "s"}</span></p>}
          <p className="run-stat" data-run-week={run.week}><b>+{run.week}</b><span>this week</span></p>
        </div>
      </div>
      {/* ⭐ A154 (45s): your pod's rank and the live count — only when their switch is on and they exist (the server sends null
          otherwise: not in the league, or fewer than the minimum practising — never a made-up number). */}
      {(run.pod || run.live) && (
        <div className="run-social" data-run-social="">
          {run.pod && <Link className="atl__link" to={`${base}/league`} data-run-pod={run.pod.place}>{run.pod.line}</Link>}
          {run.live && <p className="atl__quiet run-live" data-run-live={run.live.n}>{run.live.line}</p>}
        </div>
      )}
      {/* ⭐ D178-4 (owner's pick, Idea B): a month of lit squares — a day with proof is lit, the week's rest day dashed, today outlined. */}
      {Array.isArray(run.month) && (
        <section className="run-month" aria-label="The last four weeks" data-run-month="">
          <ol className="run-month__grid">
            {run.month.map(d => <li key={d.day} className={`run-sq${d.lit ? " is-lit" : ""}${d.rest ? " is-rest" : ""}${d.off ? " is-off" : ""}${d.today ? " is-today" : ""}`}
              title={d.lit ? "proof that day" : d.rest ? "the week's rest day" : d.off ? "a weekend — not counted" : d.today ? "today" : ""} data-day={d.day} />)}
          </ol>
          {/* ⭐ A155 (45o, the D178 picks): every real act lights a day — Today's question and a proof link too (one streak). */}
          <p className="atl__quiet">A day lights when you do one real thing — a check passed, an idea explained in your own words, Today's question answered, a build, a proof link added. One rest day a week keeps the streak.</p>
          <label className="run-weekdays" data-run-weekdays={run.weekdaysOnly ? "on" : "off"}>
            <input type="checkbox" checked={!!run.weekdaysOnly} onChange={(e) => setWeekdays(e.target.checked)} /> Weekdays only — weekends never break it
          </label>
        </section>
      )}
      <section className="run-today" aria-labelledby="run-today-h">
        <h2 className="atl__h2" id="run-today-h">{l.today}</h2>
        {run.quests.length === 0
          ? <p className="atl__quiet" data-run-no-quests="">Nothing to do today — add a skill on Your skills, or open the Library.</p>
          : (
            <ol className="run-quests">
              {run.quests.map(q => (
                <li key={q.id} className="run-quest" data-quest={q.id} data-quest-done={q.done ? "" : undefined}>
                  <div className="run-quest__main">
                    <b>{q.title}</b>
                    <span className="atl__quiet">{q.detail}{q.lesson ? ` · ${q.lesson}` : ""}</span>
                  </div>
                  {/* A154: the daily question and a deck earn no points (points come only from proof) — they say what they do. */}
                  <span className="run-quest__pts">{q.done ? "✓ done today" : q.points != null ? `+${q.points} points` : `about ${q.minutes} min`}</span>
                  {!q.done && <Link className="atl__link run-quest__go" to={questHref(base, q)}>Start →</Link>}
                </li>
              ))}
            </ol>
          )}
      </section>
      {/* ⭐ D178-4: the reward that matters most — proven skills go into your tailored résumés (D169's rule). */}
      {run.proven?.length > 0 && (
        <section className="run-proven" data-run-proven="">
          <p><b>Proven:</b> you can add {run.proven.slice(0, 4).map(s => s.name).join(", ")}{run.proven.length > 4 ? ` and ${run.proven.length - 4} more` : ""} to your résumé.</p>
          {/* ⭐ A155 (45o, the D178 picks: "Proven: you can add Kafka to your résumé — with one button"): the button puts them
              in your profile's skills (the résumé's own list); nothing is added that you haven't proven. */}
          <span data-run-add-proven=""><DepthButton primary onClick={addProven} disabled={adding}>{adding ? "Adding…" : `Add ${run.proven.length === 1 ? "it" : "them"} to your résumé`}</DepthButton></span>
          {added && <span className="atl__quiet" role="status"> Added to your profile's skills.</span>}
          {/* ⭐ D185-4 (45q): the reward loop — the open jobs this proven skill moves you up a tier on, before → after. */}
          {unlocks?.total > 0 && (
            <div className="run-unlocks" data-run-unlocks={unlocks.total}>
              <p><b>{unlocks.total} open job{unlocks.total === 1 ? "" : "s"}</b> in your role ask for {unlocks.skill}{unlocks.intoTop ? ` — ${unlocks.intoTop} move into your top matches` : ""}.</p>
              <ul className="run-unlocks__list">
                {unlocks.jobs.map(j => (
                  <li key={j.job_id}><Link className="atl__link" to={`/app/jobs?job=${encodeURIComponent(j.job_id)}`}>{j.title}</Link>
                    <span className="atl__quiet"> · {j.company} · asks for {j.before} → {j.after} of your {j.of} top skills</span></li>
                ))}
              </ul>
            </div>
          )}
          <Link to={`${base}/your-skills`} className="atl__link">See your skills</Link>
        </section>
      )}
      {/* ⭐ D178-4: the proof page — what you finished and proved, with dates, at an address you can link. Never a certificate. */}
      {run.total > 0 && proofPage && (
        <section className="run-proven" data-run-proof-page={proofPage.enabled && proofPage.showLearning ? "on" : "off"}>
          {proofPage.enabled && proofPage.showLearning && proofPage.handle
            // ⭐ A153 (45o): D183 P3 made the public profile the proof page — /p/<handle> redirects to /in/<handle> — so the
            // address and the place to change it are the profile's own.
            ? <p><b>Your public profile</b> lists what you've finished and proven, with dates: <a className="atl__link" href={`/in/${proofPage.handle}`} target="_blank" rel="noopener noreferrer">{`/in/${proofPage.handle}`}</a></p>
            : <p>Want to link what you've proven from an application? Show it on your profile in <Link className="atl__link" to="/app/profile/about">Your profile → Behind your profile</Link>.</p>}
        </section>
      )}
      {/* ⭐ D178-4: marks, earned for wholes — a module finished; the next ones with how far along they are. */}
      {run.marks && (run.marks.earned.length > 0 || run.marks.next.length > 0) && (
        <section className="lrc run-marks" aria-labelledby="run-marks-h" data-run-marks="">
          <h2 className="atl__h2" id="run-marks-h">Marks</h2>
          <ul className="run-marks__shelf">
            {run.marks.earned.map(m => (
              <li key={`e${m.module}`} className={`run-mark is-earned lrc__part--${m.module}`} data-mark={m.module}><span className="run-mark__seal" aria-hidden="true">{m.module}</span><span>{m.title}</span></li>
            ))}
            {run.marks.next.map(m => (
              <li key={`n${m.module}`} className={`run-mark lrc__part--${m.module}`} data-mark-next={m.module}><MarkRing pct={m.pct} /><span>{m.title}</span><small>{m.done} of {m.total}</small></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function MarkRing({ pct }) {
  const r = 16, c = 2 * Math.PI * r;
  return (
    <svg className="run-mark__ring" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <circle cx="20" cy="20" r={r} className="run-mark__track" />
      {pct > 0 && <circle cx="20" cy="20" r={r} className="run-mark__fill" strokeDasharray={`${(c * pct) / 100} ${c}`} transform="rotate(-90 20 20)" />}
    </svg>
  );
}
