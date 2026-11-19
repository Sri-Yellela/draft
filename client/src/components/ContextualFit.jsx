// client/src/components/ContextualFit.jsx — ⭐ D192 (4d) · THE CONTEXTUAL ATS SCORE beside the skill-match report.
//
// The owner's pick (11-19): option A — the two numbers, the four parts, then "What fits" and "What to do" — and "the font
// color on the ats number should do it no need for the words": each number is painted in its band's colour
// (styles/bandStyle.js), no band word. The words are shared/contextualView.js's (pure, tested); this file only draws them.
// Read from GET /api/jobs/:id/contextual (the same computation the extension's panel reads). ⛔ It ADDS to the report:
// the skill-match number, the board's ranking and every label that reads it are unchanged (D192 (5)).
// "Learn it" opens the technology's Atlas page only when a published one exists (lib/atlasLinks.js — never a dead link);
// "Add it" opens the résumé (Your profile). D60: no capsule — the bars are 6 px with a 2 px corner.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { contextualView } from "../../../shared/contextualView.js";
import { atsInk } from "./AtsInk.jsx";   // the one band ink (A93)
import { useAtlasSlugs, atlasHref } from "../lib/atlasLinks.js";
// the résumé lives on Your profile (pages/profile/profilePanels.js "about": About you + Your résumés)
const RESUME_HREF = "/app/profile/about";
import { ts } from "../themes/shapes.js";

const card = { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10, padding: 12 };
const ink = atsInk;

export function ContextualFit({ jobId, block: given = null }) {
  const [block, setBlock] = useState(given);
  useEffect(() => {
    if (given || !jobId) return undefined;
    let live = true;
    setBlock(null);
    api(`/api/jobs/${encodeURIComponent(jobId)}/contextual`).then(r => { if (live) setBlock(r?.contextual || null); }).catch(() => { if (live) setBlock(null); });
    return () => { live = false; };
  }, [jobId, given]);
  const view = useMemo(() => contextualView(block), [block]);
  const slugs = useAtlasSlugs(useMemo(() => (view?.todo || []).filter(t => t.kind === "learn").map(t => t.tech), [view]));
  if (!view || view.score == null) return null;

  return (
    <section data-contextual-fit aria-label="In context" style={{ display: "flex", flexDirection: "column", gap: 14, padding: "14px 0", color: "var(--color-text)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        {[["Skill match", view.skill], ["In context", view.score]].map(([label, n]) => (
          <div key={label} style={card} data-contextual-number={label === "In context" ? "contextual" : "skill"}>
            <div style={{ fontSize: ts(12), color: "var(--color-text-muted)" }}>{label}</div>
            <div style={{ fontSize: ts(30), fontWeight: 700, color: n == null ? "var(--color-text-faint)" : ink(n) }}>{n == null ? "—" : `${n}%`}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
        {view.parts.map(p => (
          <div key={p.id} style={{ ...card, display: "flex", flexDirection: "column", gap: 6 }} data-contextual-part={p.id}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: ts(13) }}>
              <span>{p.name}</span><span style={{ fontWeight: 700, color: ink(p.score) }}>{p.score}</span>
            </div>
            <div aria-hidden="true" style={{ height: 6, borderRadius: 2, background: "var(--color-surface-offset)", overflow: "hidden" }}>
              <div style={{ height: 6, width: `${p.score}%`, background: ink(p.score) }} />
            </div>
            {p.why && <div style={{ fontSize: ts(11.5), color: "var(--color-text-muted)" }}>{p.why}</div>}
          </div>
        ))}
      </div>
      {view.fits.length > 0 && (
        <div data-contextual-fits style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h3 style={{ margin: 0, fontSize: ts(14), fontWeight: 600, fontFamily: "inherit", letterSpacing: 0 }}>What fits</h3>
          {view.fits.map(f => (
            <div key={f.label} style={{ fontSize: ts(13), lineHeight: 1.55 }}>
              <span style={{ color: "var(--color-text-muted)" }}>{f.label}</span> · {f.value}
            </div>
          ))}
        </div>
      )}
      {(view.todo.length > 0 || view.notes.length > 0) && (
        <div data-contextual-todo style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: ts(14), fontWeight: 600, fontFamily: "inherit", letterSpacing: 0 }}>What to do</h3>
          {view.todo.map(t => {
            const href = t.kind === "learn" ? (slugs[t.tech] ? atlasHref(slugs[t.tech]) : null) : RESUME_HREF;
            return (
              <div key={`${t.kind}:${t.tech || t.phrase}`} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: ts(13), minWidth: 0 }}>{t.text}</div>
                {href && <Link to={href} style={{ fontSize: ts(13), fontWeight: 600, color: "var(--color-primary-text)", textDecoration: "none", flex: "none" }}>
                  {t.kind === "learn" ? "Learn it →" : "Add it →"}</Link>}
              </div>
            );
          })}
          {view.notes.map(n => <div key={n} style={{ fontSize: ts(12.5), color: "var(--color-text-muted)" }}>{n}</div>)}
        </div>
      )}
    </section>
  );
}
