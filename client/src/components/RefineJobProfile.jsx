// ── D112 e2 (owner 10-30 night) · "REFINE YOUR JOB PROFILE" — for a job profile made from a résumé ────────────────
// A104 sets the first job profile up from the résumé (POST /api/domain-profiles/from-resume → made_from_resume = 1).
// This prompt opens THE SAME wizard (DomainProfileWizard, edit mode) with everything it read already filled — every step
// optional. Once the wizard has been opened and SAVED for that profile (PUT { refined: true } → refined_at), the server
// stops sending needs_refine and the prompt is gone. Dismissing the wizard without saving keeps it.
import { useState } from "react";
import DomainProfileWizard from "./DomainProfileWizard.jsx";
import { C } from "../styles/colorTokens.js";

/** The profile the prompt is for: the active one when it needs refining, else the first that does. */
export function profileToRefine(profiles = [], activeId = null) {
  const list = Array.isArray(profiles) ? profiles : [];
  return list.find(p => p?.needs_refine && p.id === activeId) || list.find(p => p?.needs_refine) || null;
}

export default function RefineJobProfile({ profiles, activeId = null, onRefined }) {
  const [open, setOpen] = useState(false);
  const profile = profileToRefine(profiles, activeId);
  if (!profile) return null;
  return (
    <div data-refine-job-profile={profile.id}
      style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: "10px 14px", margin: "0 0 12px",
        borderRadius: 6, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderLeft: `3px solid ${C.ACCENT}` }}>
      <span style={{ flex: 1, minWidth: 200, fontSize: 12.5, color: C.INK, lineHeight: 1.5 }}>
        <b>{profile.profile_name || "Your job profile"}</b> was set up from your résumé. Check the field, level, titles and
        keywords it read — everything is already filled in.
      </span>
      <button type="button" className="dbx-depth" onClick={() => setOpen(true)}
        style={{ border: "none", padding: "8px 14px", background: C.ACCENT, color: C.ON_ACCENT, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
        Refine your job profile
      </button>
      {open && (
        <DomainProfileWizard
          key={`refine-${profile.id}`}
          mode="edit"
          refine
          initialProfile={profile}
          bannerText="Read from your résumé — change anything that is not right. Every step is optional."
          onComplete={(saved) => { setOpen(false); onRefined?.(saved); }}
          onDismiss={() => setOpen(false)}
        />
      )}
    </div>
  );
}
