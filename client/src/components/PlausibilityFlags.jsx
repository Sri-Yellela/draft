// client/src/components/PlausibilityFlags.jsx — ⭐ D192 (4d) · "DOES THIS ADD UP?" (owner 11-14: "the ATS engine should be able
// to say if something adds up, referring back to the technographics … flag anything that doesn't line up").
//
// A quiet ⚠ beside each bullet that doesn't line up with what draft knows about that employer, its one-line reason, and a
// Dismiss (the person knows better; a dismissed flag stays dismissed across re-scores — POST /api/resume/plausibility/dismiss).
// Warnings only: no score reads them. Drawn by the ATS card (the base résumé — GET /api/resume/plausibility) and Home's held
// review (the tailored résumé — GET /api/resumes/:id/plausibility, so a bullet the tailoring wrote is checked before it is sent).
// Nothing to say → nothing drawn. Tokens only; D60: the Dismiss is a plain text button, no capsule.
import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { ts } from "../themes/shapes.js";

const short = (s, n = 90) => { const t = String(s || "").replace(/\s+/g, " ").trim(); return t.length <= n ? t : `${t.slice(0, n).replace(/\s+\S*$/, "")}…`; };

export function PlausibilityFlags({ src, title = "Does your résumé add up?" }) {
  const [data, setData] = useState(null);
  const [gone, setGone] = useState(() => new Set());
  useEffect(() => {
    if (!src) return undefined;
    let live = true;
    setData(null);
    api(src).then(r => { if (live) setData(r || null); }).catch(() => { if (live) setData(null); });
    return () => { live = false; };
  }, [src]);
  const flags = (data?.entries || []).flatMap(e => (e.flags || []).map(f => ({ ...f, employer: e.employer }))).filter(f => !gone.has(f.key));
  if (!flags.length) return null;
  const dismiss = async (key) => {
    setGone(prev => new Set(prev).add(key));
    try { await api("/api/resume/plausibility/dismiss", { method: "POST", body: JSON.stringify({ key }) }); }
    catch { setGone(prev => { const n = new Set(prev); n.delete(key); return n; }); }
  };
  return (
    <section data-plausibility aria-label={title} style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--color-border)", paddingTop: 12 }}>
      <div style={{ fontSize: ts(14), color: "var(--color-text)" }}>{title} <span style={{ color: "var(--color-text-muted)" }}>· {flags.length} to check</span></div>
      {flags.map(f => (
        <div key={f.key} data-plausibility-flag={f.kind} style={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr) auto", gap: 10, alignItems: "start", fontSize: ts(13) }}>
          <span aria-hidden="true" style={{ color: "var(--color-warning)" }}>⚠</span>
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ color: "var(--color-text)", overflowWrap: "anywhere" }}>{f.reason}</span>
            <span style={{ color: "var(--color-text-muted)", overflowWrap: "anywhere" }}>{f.employer} · “{short(f.bullet)}”</span>
          </div>
          <button type="button" onClick={() => dismiss(f.key)} aria-label={`Dismiss: ${f.reason}`}
            style={{ font: "inherit", fontSize: ts(12.5), color: "var(--color-text-muted)", background: "none", border: 0, padding: "2px 4px", cursor: "pointer" }}>
            Dismiss
          </button>
        </div>
      ))}
    </section>
  );
}

export default PlausibilityFlags;
