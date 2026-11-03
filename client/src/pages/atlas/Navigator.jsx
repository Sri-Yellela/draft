// ⭐ D143 (owner 11-02) · THE NAVIGATOR — first on the Atlas home: a destination, a route, progress and re-routing.
// "Direction, not a menu." GET /api/navigator (services/navigator.js); PUT /api/navigator/aim to keep your own aim.
//
// The D120 direction line is its fallback: shown while the navigator loads, and whenever it cannot point the way yet
// (no current role on the job profile). Once it answers, the next step on the route IS the direction line.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api.js";

export default function Navigator({ base, fallback = null }) {
  const [nav, setNav] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [choosing, setChoosing] = useState(false);

  useEffect(() => {
    let live = true;
    api("/api/navigator").then(r => live && setNav(r)).catch(() => live && setNav(null));
    return () => { live = false; };
  }, []);

  async function aimAt(slug) {
    setBusy(true); setError("");
    try { setNav(await api("/api/navigator/aim", { method: "PUT", body: JSON.stringify({ slug }) })); setChoosing(false); }
    catch (e) { setError(e.message || "Not saved — try again."); }
    finally { setBusy(false); }
  }

  if (!nav?.ready) return fallback;
  const { destination: d, route, bridges, progress, changes, suggest, next, elsewhere = [], changer = null } = nav;
  const options = [...(d.recommended || []), ...(d.alternatives || [])];
  return (
    <section className="atl-nav" data-navigator="" aria-label="Your direction">
      {next && (
        <p className="atl-home__dir" data-atlas-direction={next.slug} data-navigator-next="">
          <span>{next.text}</span>
          {next.learn
            ? <Link className="dbx-depth atl-home__go" to={`${base}${next.learn.path}`} data-atlas-direction-open="">Open the piece</Link>
            : <Link className="dbx-depth atl-home__go" to={`${base}/${encodeURIComponent(next.slug)}`} data-atlas-direction-open="">What it is</Link>}
        </p>
      )}
      <div className="atl-nav__card">
        <h2 className="atl-nav__h">Where you're headed</h2>
        {d.aim && <p className="atl-nav__aim" data-navigator-aim={d.aim.setBy}>{d.aim.line}{d.aim.setBy === "user" ? " · your choice" : ""}</p>}
        {!choosing
          ? <button type="button" className="atl-nav__link" onClick={() => setChoosing(true)} disabled={busy}>
              {d.aim?.setBy === "user" ? "Change your aim" : "Choose another aim"}
            </button>
          : (
            <ol className="atl-nav__options" data-navigator-options="">
              {options.map(o => (
                <li key={o.slug}>
                  <button type="button" className="atl-nav__option" onClick={() => aimAt(o.slug)} disabled={busy}>{o.line}</button>
                </li>
              ))}
              {d.aim?.setBy === "user" && <li><button type="button" className="atl-nav__option" onClick={() => aimAt(null)} disabled={busy}>Follow draft's recommendation</button></li>}
            </ol>
          )}
        {error && <p className="atl__quiet" role="alert">{error}</p>}
      </div>

      {route && (
        <div className="atl-nav__card" data-navigator-route="">
          <h2 className="atl-nav__h">Your route</h2>
          <p className="atl-nav__line">{route.line}</p>
          <ol className="atl-nav__steps">
            {route.skills.map(s => (
              <li key={s.slug} data-route-skill={s.slug}>
                <strong>{s.name}</strong> <span className="atl__quiet">asked in {s.share} % of {route.role} postings</span>
                {s.learn && <> · <Link className="atl__link" to={`${base}${s.learn.path}`}>{s.learn.title}</Link></>}
              </li>
            ))}
          </ol>
          <p className="atl__quiet">≈ weeks are a rough guide, not a measurement.</p>
        </div>
      )}

      {/* ⭐ D139 · a move into another field: what transfers, said in the new field's words; the gaps; the interview's
          first questions. Built only from skills the user has. */}
      {changer && (
        <div className="atl-nav__card" data-navigator-changer="">
          <h2 className="atl-nav__h">Changing fields: {changer.from} → {changer.to}</h2>
          {changer.transferable.length > 0 && <p className="atl-nav__line">What transfers: {changer.transferable.join(", ")}</p>}
          {changer.framing && <p className="atl-nav__line">{changer.framing}</p>}
          {changer.gaps.length > 0 && <p className="atl-nav__line">To close: {changer.gaps.join(", ")}</p>}
          <p className="atl-nav__line">Be ready for:</p>
          <ul className="atl-nav__steps">{changer.interview.map((q, i) => <li key={i}>{q}</li>)}</ul>
        </div>
      )}

      {elsewhere.length > 0 && (
        <div className="atl-nav__card" data-navigator-elsewhere="">
          <h2 className="atl-nav__h">Other fields you could move into</h2>
          <ul className="atl-nav__steps">
            {elsewhere.map(e => (
              <li key={e.slug}>
                {e.line}{e.framing ? <> · <span className="atl__quiet">{e.framing}</span></> : null}{" "}
                <button type="button" className="atl-nav__link" onClick={() => aimAt(e.slug)} disabled={busy}>Aim there</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="atl-nav__card" data-navigator-bridges="">
        <h2 className="atl-nav__h">Apply now, while you learn</h2>
        {bridges.length
          ? <ul className="atl-nav__steps">{bridges.map(b => <li key={b.slug}>{b.line}</li>)}</ul>
          : <p className="atl__quiet">No role is 60 % covered yet — your best bets on the board are still worth a look.</p>}
        <Link className="atl__link" to="/app" data-navigator-best-bets="">See this week's best bets</Link>
      </div>

      <div className="atl-nav__card" data-navigator-progress="">
        <h2 className="atl-nav__h">Progress</h2>
        <p className="atl-nav__line">{progress.line}</p>
        {suggest && (
          <p className="atl-nav__line" data-navigator-suggest="">
            {suggest.text} <button type="button" className="atl-nav__link" onClick={() => aimAt(suggest.slug)} disabled={busy}>Aim there</button>
          </p>
        )}
        {changes?.length > 0 && (
          <ul className="atl-nav__changes" data-navigator-changes="">
            {changes.slice(0, 4).map((c, i) => <li key={i}>{c.text}</li>)}
          </ul>
        )}
      </div>
    </section>
  );
}
