// ⭐ D172 (3) (owner APPROVED 11-06, docs/sketches/atlas-redesign-sketch.html → Your run) · YOUR RUN: your level as a ring,
// the points to the next one, your streak, this week, and today's quests — about five minutes. Points come ONLY from
// proof (services/atlas/points.js: an idea explained in your own words, a build, a skill checked or built); a quest is
// shown only when its thing exists (no daily question until D154; no deck until the decks are wired; no pod or live
// count until the owner decides the league's networking). Reads GET /api/atlas/run.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api.js";
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
  useEffect(() => {
    let live = true;
    if (!signedIn) return undefined;
    api("/api/atlas/run").then(r => live && setRun(r)).catch(e => live && setError(e.message || "Your run could not be read."));
    return () => { live = false; };
  }, [signedIn]);
  if (!signedIn) return (
    <div className="atl-pan" data-atlas-panel-body="your-run">
      <p className="atl__kicker">Your run</p>
      <p className="atl__quiet" data-run-signed-out="">Sign in to start your run. Points come only from proof — an idea explained in your own words, a build, a skill checked.</p>
    </div>
  );
  if (error) return <div className="atl-pan" data-atlas-panel-body="your-run"><p className="atl__quiet" role="alert">{error}</p></div>;
  if (!run) return <div className="atl-pan" data-atlas-panel-body="your-run"><p className="atl__quiet" role="status">Opening your run…</p></div>;
  const l = runLines(run);
  return (
    <div className="atl-pan run" data-atlas-panel-body="your-run" data-run-total={run.total}>
      <p className="atl__kicker">Your run</p>
      <div className="run-card" data-run-level={run.level.n}>
        <Ring pct={run.level.pct} />
        <div className="run-card__body">
          <h1 className="atl__title run-card__level">{l.level}</h1>
          <p className="run-card__next" data-run-next="">{l.next}</p>
          <p className="atl__quiet" data-run-rule="">{run.rule}</p>
        </div>
        <div className="run-card__stats">
          <p className="run-stat" data-run-streak={run.streak}><b>{run.streak}</b><span>{l.streak}</span></p>
          <p className="run-stat" data-run-week={run.week}><b>+{run.week}</b><span>this week</span></p>
        </div>
      </div>
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
                  <span className="run-quest__pts">{q.done ? "✓ done today" : `+${q.points} points`}</span>
                  {!q.done && <Link className="atl__link run-quest__go" to={questHref(base, q)}>Start →</Link>}
                </li>
              ))}
            </ol>
          )}
      </section>
    </div>
  );
}
