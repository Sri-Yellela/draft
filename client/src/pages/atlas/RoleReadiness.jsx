// ⭐ D178-3 (owner's pick 11-07, docs/sketches/Atlas D178 ideas.html → Your skills: Idea D + C's list) · FOR A ROLE: the goal
// role with its READINESS dial (the share of the role's demand you have PROVEN; a lighter segment = "waiting in skills
// you've claimed"), the tree grown for the role — three branches (must-have · common · nice-to-have), each with its share
// of the role and "you have X of Y", leaves with a demand bar that lights when proven — and "What moves your % most"
// beside it, each skill with what it adds and its next step. Reads GET /api/atlas/readiness. Pick another role → the tree
// regrows. ⛔ Never "expertise", never a guarantee: "ready", from this week's postings, the scope shown.
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DepthButton from "../../components/DepthButton.jsx";   // A155: Aim here and fly my route
import { api } from "../../lib/api.js";
import { dialArcs, TIER_LABEL } from "./roleReadinessModel.js";
import "./RoleReadiness.css";

export function Dial({ ready, waiting }) {
  const a = dialArcs(ready, waiting);
  return (
    <svg className="rr-dial" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <circle cx="60" cy="60" r={a.r} className="rr-dial__track" />
      {a.waiting && <circle cx="60" cy="60" r={a.r} className="rr-dial__wait" strokeDasharray={a.waiting} transform="rotate(-90 60 60)" />}
      {a.ready && <circle cx="60" cy="60" r={a.r} className="rr-dial__fill" strokeDasharray={a.ready} transform="rotate(-90 60 60)" />}
      <text x="60" y="64" textAnchor="middle" className="rr-dial__pct">{ready}%</text>
      <text x="60" y="80" textAnchor="middle" className="rr-dial__lbl">ready</text>
    </svg>
  );
}

export default function RoleReadiness({ base = "/app/atlas" }) {
  const navigate = useNavigate();
  const [role, setRole] = useState("");
  const [asked, setAsked] = useState(null);   // null = the aim on Your route
  const [r, setR] = useState(null);
  const [error, setError] = useState("");
  // ⭐ D179 P6 (45l): the taxonomy's subcategories with enough live postings — each a role to read readiness for.
  const [boardRoles, setBoardRoles] = useState([]);
  useEffect(() => {
    let live = true;
    api("/api/atlas/subcategory-roles").then(x => live && setBoardRoles(x.roles || [])).catch(() => {});
    return () => { live = false; };
  }, []);
  const groups = boardRoles.reduce((m, r) => { (m[r.category] ||= []).push(r); return m; }, {});
  useEffect(() => {
    let live = true;
    setR(null); setError("");
    api(`/api/atlas/readiness${asked ? `?role=${encodeURIComponent(asked)}` : ""}`).then(x => live && setR(x))
      .catch(e => live && setError(e.message || "Readiness could not be read."));
    return () => { live = false; };
  }, [asked]);
  const picker = (
    <form className="rr-pick" onSubmit={e => { e.preventDefault(); if (role.trim()) setAsked(role.trim()); }}>
      <label className="atl__quiet" htmlFor="rr-role">Role</label>
      <input id="rr-role" className="rr-pick__in" value={role} maxLength={80} placeholder={r?.role?.name || "e.g. Data Engineer"} onChange={e => setRole(e.target.value)} />
      <button type="submit" className="atl__link rr-pick__go">Show</button>
      {boardRoles.length > 0 && (
        <select className="rr-pick__in" aria-label="Or a role on the board" data-rr-board-roles="" value={asked && asked.startsWith("sub:") ? asked : ""}
          onChange={e => { if (e.target.value) { setRole(""); setAsked(e.target.value); } }}>
          <option value="">or a role on the board…</option>
          {Object.entries(groups).map(([cat, list]) => (
            <optgroup key={cat} label={cat}>{list.map(r => <option key={r.value} value={r.value}>{r.name} ({r.postings})</option>)}</optgroup>
          ))}
        </select>
      )}
    </form>
  );
  if (error) return <section className="rr" data-role-readiness="">{picker}<p className="atl__quiet" role="status" data-rr-none="">{/no_role|Choose a role/i.test(error) ? "Choose a role to see how ready you are for it." : /unknown_role|404/.test(error) ? "There is no role by that name on the Atlas yet." : error}</p></section>;
  if (!r) return <section className="rr" data-role-readiness="">{picker}<p className="atl__quiet" role="status">Reading the role…</p></section>;
  return (
    <section className="rr" data-role-readiness="" data-rr-role={r.role.slug}>
      {picker}
      <div className="rr-head">
        {!r.thin && <Dial ready={r.ready} waiting={r.waiting} />}
        <div>
          <h3 className="rr-head__role">{r.role.page ? <Link to={`${base}/${encodeURIComponent(r.role.slug)}`} className="atl__link">{r.role.name}</Link> : r.role.name}</h3>
          <p className="rr-head__line" data-rr-line="">{r.line}</p>
          <p className="atl__quiet" data-rr-scope="">{r.thin ? r.scope.line : `${r.scope.line} · only proven skills count — a quick check or a build proves one`}</p>
          {/* ⭐ A155 (45o, the D178 picks: "Fly my route to this role"): the route on Your map is the AIM's — so this says so:
              it makes this role your aim (the navigator's own PUT /aim) and flies the route there. */}
          <p data-rr-fly=""><DepthButton size="compact" onClick={async () => {
            try { await api("/api/navigator/aim", { method: "PUT", body: JSON.stringify({ slug: r.role.slug }) }); } catch { /* the map still opens */ }
            navigate(`${base}/your-map?fly=1`);
          }}>Aim here and fly my route</DepthButton></p>
        </div>
      </div>
      {!r.thin && (
        <div className="rr-body">
          <div className="rr-tree" data-rr-tree="">
            {["must", "common", "nice"].map(t => r.tiers[t].of > 0 && (
              <div key={t} className="rr-branch" data-rr-branch={t}>
                <p className="rr-branch__h"><b>{TIER_LABEL[t]}</b> <span className="atl__quiet">{r.tiers[t].share}% of the role · you have {r.tiers[t].have} of {r.tiers[t].of}</span></p>
                <ul className="rr-leaves">
                  {r.tiers[t].skills.map(s => (
                    <li key={s.slug} className="rr-leaf" data-rr-leaf={s.slug} data-rr-state={s.state}>
                      <span className="rr-leaf__name">{s.name}</span>
                      <span className="rr-leaf__bar" aria-hidden="true"><i style={{ width: `${Math.max(4, s.share)}%` }} /></span>
                      <span className="rr-leaf__share">{s.share}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <aside className="rr-moves" aria-labelledby="rr-moves-h" data-rr-moves="">
            <h3 className="atl__h2" id="rr-moves-h">What moves your % most</h3>
            {r.moves.length === 0 ? <p className="atl__quiet">You've proven every top skill this role asks for.</p> : (
              <ol className="rr-moves__list">
                {r.moves.slice(0, 6).map(m => (
                  <li key={m.slug} data-rr-move={m.slug}>
                    <span><b>{m.name}</b> <span className="rr-moves__add">+{m.adds}%</span></span>
                    {m.action === "prove"
                      ? <Link className="atl__link" to={`${base}/your-skills?prove=${encodeURIComponent(m.name)}`}>Prove it · 5 min</Link>
                      : <Link className="atl__link" to={`${base}/${encodeURIComponent(m.slug)}`}>Learn it</Link>}
                  </li>
                ))}
              </ol>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
