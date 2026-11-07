// ⭐ D178-3 (owner's pick 11-07: Your skills tabs; Idea E) · COMPARE ROLES: up to four roles, one readiness dial each, the
// grid of which skills each role asks for (dot size = the skill's share of that role's postings; filled = you've proven
// it), and the skill that lifts the most roles at once. Starts from the aim on Your route; add or remove a role by name.
// Reads GET /api/atlas/readiness (the aim) and /api/atlas/readiness/compare.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api.js";
import { Dial } from "./RoleReadiness.jsx";

export default function CompareRoles({ base = "/app/atlas" }) {
  const [roles, setRoles] = useState(null);
  const [add, setAdd] = useState("");
  const [c, setC] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {   // the aim first
    let live = true;
    api("/api/atlas/readiness").then(r => live && setRoles(r?.role?.name ? [r.role.name] : [])).catch(() => live && setRoles([]));
    return () => { live = false; };
  }, []);
  useEffect(() => {
    let live = true;
    if (!roles?.length) { setC(null); return undefined; }
    setError("");
    api(`/api/atlas/readiness/compare?roles=${encodeURIComponent(roles.join("|"))}`).then(x => live && setC(x)).catch(e => live && setError(e.message || "The roles could not be compared."));
    return () => { live = false; };
  }, [roles]);
  const ok = (c?.roles || []).filter(r => r.found && !r.thin);
  return (
    <section className="rr rr-cmp" data-compare-roles="">
      <form className="rr-pick" onSubmit={e => { e.preventDefault(); const v = add.trim(); if (v && (roles || []).length < 4) { setRoles([...(roles || []), v]); setAdd(""); } }}>
        <ul className="rr-cmp__chips">
          {(roles || []).map(r => (
            <li key={r}><span>{r}</span><button type="button" className="rr-cmp__x" aria-label={`Remove ${r}`} onClick={() => setRoles(roles.filter(x => x !== r))}>×</button></li>
          ))}
        </ul>
        {(roles || []).length < 4 && (<>
          <input className="rr-pick__in" value={add} maxLength={80} placeholder="Add a role to compare" aria-label="Add a role to compare" onChange={e => setAdd(e.target.value)} />
          <button type="submit" className="atl__link rr-pick__go">Add</button>
        </>)}
      </form>
      {roles && !roles.length && <p className="atl__quiet">Name a role to start — up to four, side by side.</p>}
      {error && <p className="atl__quiet" role="alert">{error}</p>}
      {c && (
        <>
          <div className="rr-cmp__dials">
            {c.roles.map((r, i) => (
              <div key={i} className="rr-cmp__dial" data-compare-role={r.role?.slug || roles[i]}>
                {r.found && !r.thin ? <Dial ready={r.ready} waiting={r.waiting} /> : <div className="rr-cmp__none" />}
                <b>{r.role?.name || roles[i]}</b>
                <span className="atl__quiet">{!r.found ? "not on the Atlas yet" : r.thin ? "not enough postings yet" : `${r.role.postings} postings`}</span>
              </div>
            ))}
          </div>
          {c.lifts && (
            <p className="rr-cmp__lifts" data-compare-lifts={c.lifts.slug}>
              {c.lifts.state === "claimed" ? "Proving" : "Learning"} <b>{c.lifts.name}</b> lifts {c.lifts.roles === c.lifts.of ? (c.lifts.of === 2 ? "both roles" : `all ${c.lifts.of} roles`) : `${c.lifts.roles} of these ${c.lifts.of} roles`}.{" "}
              {c.lifts.state === "claimed" ? <Link className="atl__link" to={`${base}/your-skills?prove=${encodeURIComponent(c.lifts.name)}`}>Prove it · 5 min</Link>
                : <Link className="atl__link" to={`${base}/${encodeURIComponent(c.lifts.slug)}`}>Learn it</Link>}
            </p>
          )}
          {ok.length > 0 && c.grid.length > 0 && (
            <div className="rr-cmp__gridwrap">
              <table className="rr-cmp__grid" data-compare-grid="">
                <thead><tr><th scope="col">Skill</th>{ok.map(r => <th key={r.role.slug} scope="col">{r.role.name}</th>)}</tr></thead>
                <tbody>
                  {c.grid.map(s => (
                    <tr key={s.slug} data-compare-skill={s.slug} data-rr-state={s.state}>
                      <th scope="row">{s.name}</th>
                      {ok.map(r => {
                        const sh = s.shares[r.role.slug];
                        return <td key={r.role.slug}>{sh ? <span className="rr-cmp__dot" style={{ "--s": Math.max(6, Math.round(sh / 5) + 4) }} title={`${sh}% of ${r.role.name} postings`} aria-label={`${sh}%`} /> : <span className="atl__quiet">·</span>}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="atl__quiet">Dot size: the share of that role's postings asking for it. Filled: you've proven it.</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
