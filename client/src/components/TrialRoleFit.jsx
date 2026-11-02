// ⭐ A111 P4 step 4 · "WHAT'S ON OFFER, MAPPED TO YOU": on the trial's own-résumé pathway, opening a pick's report shows the
// ROLE against the tester's résumé, under the ATS report the deck already draws (matched, missing, the level line): the
// Atlas reading's own line ("You cover 10 of this role's top 15 — missing …"), each of the role's top skills as a mark
// (have = green, missing = grey; linked to its Atlas page when it has one), the skills that rise at the next level, and
// the role's page. GET /api/trial/role-fit/:jobId → { available, ats, atlas } — `atlas` is A111 P3's roleFitReading shape
// (services/trialRoleFit.js is the seam). atlas.found false → the posting's own ATS terms, said plainly. Renders nothing
// for anyone else (a sample account's answer is { available: false }). Marks, never capsules (D60).
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { C } from "../styles/colorTokens.js";
import { markStyle } from "../styles/mark.js";

const label = { fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: C.INK_FAINT, marginBottom: 8 };
const chip = (have) => ({ ...markStyle(have ? C.SUCCESS : C.INK_MUTED), fontSize: 12, textDecoration: "none" });

function Skill({ s, have }) {
  const body = <span data-role-skill={have ? "have" : "missing"} style={chip(have)}>{s.name}</span>;
  return s.page ? <Link to={s.page} style={{ textDecoration: "none" }}>{body}</Link> : body;
}

export default function TrialRoleFit({ jobId }) {
  const [fit, setFit] = useState(null);
  useEffect(() => {
    let alive = true;
    setFit(null);
    api(`/api/trial/role-fit/${encodeURIComponent(jobId)}`).then(r => { if (alive) setFit(r); }).catch(() => { if (alive) setFit({ available: false }); });
    return () => { alive = false; };
  }, [jobId]);
  if (!fit?.available) return null;
  const a = fit.atlas || { found: false };
  const ats = fit.ats || {};
  const next = (a.nextLevel || []).flatMap(step => step.items || []);
  return (
    <section data-trial-role-fit={jobId} data-role-found={a.found ? "atlas" : "posting"} aria-label="This role, against your résumé"
      style={{ margin: "14px 16px 4px", padding: "12px 14px", borderRadius: 6, border: `1px solid ${C.BORDER}`, borderLeft: `3px solid ${C.ACCENT_INK}` }}>
      <div style={label}>This role, against your résumé</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: C.INK, marginBottom: 4 }}>{a.found ? a.role?.name : fit.role || "This role"}</div>
      {a.found ? (
        <>
          <p data-role-covered={a.covered} style={{ margin: "0 0 8px", fontSize: 14, color: C.INK }}>{a.line}</p>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }} data-role-skills="">
            {(a.top || []).map(s => <Skill key={s.slug || s.name} s={s} have={!!s.have}/>)}
          </div>
        </>
      ) : (
        <>
          <p data-role-covered={(ats.matched || []).length} style={{ margin: "0 0 8px", fontSize: 14, color: C.INK }}>
            Your résumé shows {(ats.matched || []).length} of the {(ats.matched || []).length + (ats.missing || []).length} skills this posting asks for.
          </p>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }} data-role-skills="">
            {(ats.matched || []).map(t => <Skill key={`m-${t}`} s={{ name: t }} have/>)}
            {(ats.missing || []).map(t => <Skill key={`x-${t}`} s={{ name: t }} have={false}/>)}
          </div>
        </>
      )}
      {ats.level && <p style={{ margin: "10px 0 0", fontSize: 13, color: C.INK_MUTED }} data-role-level="">{ats.level}</p>}
      {next.length > 0 && (
        <p style={{ margin: "10px 0 0", fontSize: 13.5, color: C.INK }} data-role-next="">
          <b>To reach the next level:</b> {next.map(i => i.name).join(", ")}
        </p>
      )}
      <p style={{ margin: "10px 0 0", fontSize: 13, color: C.INK_MUTED }}>
        {a.found ? "Read from every open posting for this role, against the skills your résumé shows." : "From this posting's own skills; the Atlas has no page for this role yet."}
        {a.found && a.role?.page && <> <Link to={a.role.page} style={{ color: C.ACCENT_INK, fontWeight: 700 }} data-role-page="">The role in the Atlas →</Link></>}
      </p>
    </section>
  );
}
