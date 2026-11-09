// ⭐ D186 (owner 11-09: "one résumé sets up everything … the manual options should still be there") · the Profile page's
// three D186 pieces: the FOUR THINGS a résumé can't tell us (D186-2), the WEIGHTED TERMS that rank the board (D186-4),
// and the choice a résumé from ANOTHER family offers (D186-3). Automatic by default; every value stays the person's to change.
import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import "./ResumeSetup.css";

/** D186-2 · asked once, each skippable; never inferred. Hidden when nothing is left to ask. */
export function FourThingsCard({ onChanged = null }) {
  const [s, setS] = useState(null);
  const [vals, setVals] = useState({});
  const [msg, setMsg] = useState("");
  useEffect(() => { api("/api/profile/four-things").then(setS).catch(() => setS(null)); }, []);
  if (!s?.open) return null;
  const save = async (key, body) => {
    setMsg("");
    try { setS({ ...s, ...(await api("/api/profile/four-things", { method: "PUT", body: JSON.stringify({ key, ...body }) })) }); onChanged?.(); }
    catch (e) { setMsg(e.message || "Could not save that."); }
  };
  const left = s.items.filter(i => !i.set && !i.skipped);
  return (
    <section className="rs-four" data-four-things={left.length} aria-label="Four things your résumé can't tell us">
      <h2 className="rs-four__h">{left.length === 1 ? "One thing your résumé can't tell us" : `${left.length} things your résumé can't tell us`}</h2>
      <p className="rs-four__lead">Everything else came from your résumé. These stay unset until you answer — skip any of them.</p>
      <ul className="rs-four__list">
        {left.map(i => (
          <li key={i.key} data-four-thing={i.key}>
            <label className="rs-four__label">{i.label}{i.why ? <span className="rs-four__why"> — {i.why}</span> : null}
              {i.key === "willing_to_relocate"
                ? <select value={vals[i.key] ?? ""} onChange={(e) => setVals({ ...vals, [i.key]: e.target.value })}><option value="">Choose…</option><option value="yes">Yes</option><option value="no">No</option></select>
                : <input value={vals[i.key] ?? ""} onChange={(e) => setVals({ ...vals, [i.key]: e.target.value })} maxLength={120}
                    type={i.key === "available_start_date" ? "date" : "text"} placeholder={i.key === "desired_salary" ? "e.g. 140000" : ""} />}
            </label>
            <button type="button" className="rs-btn" onClick={() => save(i.key, { value: vals[i.key] })} disabled={!String(vals[i.key] ?? "").trim()}>Save</button>
            <button type="button" className="rs-btn rs-btn--quiet" onClick={() => save(i.key, { skip: true })} data-four-skip={i.key}>Skip</button>
          </li>
        ))}
      </ul>
      {msg && <p className="rs-four__why" role="alert">{msg}</p>}
    </section>
  );
}

const SOURCE_WORD = { exact: "from your résumé", alias: "alias of", related: "related to" };
/** D186-4 · each term with its weight and source, removable (removed stays removed across résumé replaces). */
export function RankingTerms({ profileId }) {
  const [d, setD] = useState(null);
  const load = useCallback(() => { if (profileId) api(`/api/domain-profiles/${profileId}/keywords`).then(setD).catch(() => setD(null)); }, [profileId]);
  useEffect(() => { load(); }, [load]);
  if (!profileId) return <p className="rs-four__why">Upload a résumé and the terms that rank your board appear here.</p>;
  if (!d) return null;
  const flip = async (term, removed) => { try { const r = await api(`/api/domain-profiles/${profileId}/keywords`, { method: "PUT", body: JSON.stringify({ term, removed }) }); setD({ ...d, ...r }); } catch { /* left as it was */ } };
  return (
    <div className="rs-terms" data-ranking-terms={d.terms.length}>
      <p className="rs-four__why">The board ranks by these, strongest first. Related terms only help ranking — they are never added to your skills or your résumé.</p>
      <ul className="rs-terms__list">
        {d.terms.map(t => (
          <li key={t.term} data-term-source={t.source}>
            <b>{t.term}</b> <span className="rs-four__why">· weight {t.weight} · {SOURCE_WORD[t.source]}{t.via ? ` ${t.via}` : ""}</span>
            <button type="button" className="rs-btn rs-btn--quiet" onClick={() => flip(t.term, true)} aria-label={`Remove ${t.term}`}>Remove</button>
          </li>
        ))}
      </ul>
      {d.removed.length > 0 && <p className="rs-four__why" data-ranking-removed={d.removed.length}>Removed (kept out when your résumé changes): {d.removed.map((r, i) => (
        <span key={r}>{i ? ", " : ""}{r} <button type="button" className="rs-btn rs-btn--quiet" onClick={() => flip(r, false)}>Put back</button></span>))}</p>}
    </div>
  );
}

/** D186-3 · a résumé from another family: its own job profile (the default) or a replace of the current one. */
export function SecondFamilyChoice({ preview, busy, onNew, onReplace, onCancel }) {
  const to = [preview.subName, preview.categoryName].filter(Boolean).join(" · ");
  return (
    <section className="rs-four" data-second-family="" role="dialog" aria-label="A résumé for another kind of job">
      <h2 className="rs-four__h">This résumé is for {to || "another kind of job"}</h2>
      <p className="rs-four__lead">Your current job profile is {preview.active?.name || "another family"}. Keep both, or replace it?</p>
      <p>
        <button type="button" className="rs-btn" onClick={onNew} disabled={busy} data-second-family-new="">Make this its own job profile</button>{" "}
        <button type="button" className="rs-btn rs-btn--quiet" onClick={onReplace} disabled={busy} data-second-family-replace="">Replace the current one</button>{" "}
        <button type="button" className="rs-btn rs-btn--quiet" onClick={onCancel} disabled={busy}>Cancel</button>
      </p>
    </section>
  );
}
