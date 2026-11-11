// client/src/components/ATSPanel.jsx — the ATS report LOADER (A93: moved from panels/ — the deck and the
// ATS panel both mount it, so it is shared, not one page's)
// KEYWORD DATA SOURCE PRIORITY:
// 1. ats_report from generated resume (most accurate)
// 2. ats_only_reports cache (avoid redundant Haiku calls)
// 3. Fresh POST /api/jobs/:id/keywords call (base resume)
// To change keyword display format edit this component.
// To change extraction logic edit ATS_SYSTEM_PROMPT in
// server.js — it is shared between ATS scoring and keyword
// analysis.
import { useState, useEffect } from "react";
import { api } from "../lib/api.js";
import { useSyncEvents } from "../hooks/useSyncEvents.js";
import {
  buildProfileClaimLookup,
  emitProfileSuggestionsUpdated,
  PROFILE_SUGGESTIONS_UPDATED_EVENT,
  setProfileClaim,
} from "../lib/profileSuggestions.js";
import { profileSignalKey } from "../../../shared/profileSignals.js";
import { atsBandFor } from "../../../shared/atsBands.js";
import { AtsReport } from "./AtsReport.jsx";
// ⭐ D169 P2: "That's true of me" on a SKILL opens its quick check (or its proof choice) in place — the same component
// Your skills in Atlas opens. The claim itself behaves as before (counts toward the score); the résumé waits for the proof.
import SkillCheck from "./SkillCheck.jsx";
import { ts } from "../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size

// `band` (A40): a caller that holds the BAND and deliberately not the number — the deck — passes it here,
// and the report is drawn from it. Everywhere else the band is derived from the report's own score.
//
// `onReport(jobId, report)` (A52): called when this panel has scored a posting itself, so the board
// can show THIS verdict on the card and the JD header instead of the stored one it loaded earlier —
// one scoring read per screen. Without it a card read "No signal" beside this panel reading
// "Strong match".
// ⭐ D152 (8): `history` (a node — the History switch's content) and `bare` (the host is the card) pass straight through.
export function ATSPanel({ report, score, band: knownBand = null, jobId, resumeText, activeProfileId, onReport = null, history = null, bare = false }) {
  const [localReport, setLocalReport] = useState(null);
  const [kwLoading,   setKwLoading]   = useState(false);
  const [kwError,     setKwError]     = useState(false);
  const [addedItems,  setAddedItems]  = useState(new Set());
  const [profileSuggestions, setProfileSuggestions] = useState(null);
  const [profileSelections, setProfileSelections] = useState({ activeSkills: [], activeVerbs: [] });
  const [proving, setProving] = useState(null);   // D169: the skill just claimed, whose check is open in place

  // Reset local state when the selected job changes — OR the profile does.
  //
  // addedItems is an optimistic echo of claims made in this session, and claims are PER PROFILE.
  // Keyed on jobId alone it survived a profile switch, so terms claimed on one profile rendered as
  // ticked on another that had never claimed them. Only on screen — the store was right, and a
  // reload cleared it — which is exactly the kind of wrong that gets believed.
  //
  // Keyed on the activeProfileId PROP rather than the derived clickableProfileId below: a dep array
  // is evaluated during render, and naming a const declared further down would read it in its
  // temporal dead zone. The prop is what changes when the user switches profile anyway.
  useEffect(() => {
    setLocalReport(null);
    setKwError(false);
    setAddedItems(new Set());
    setProving(null);
  }, [jobId, activeProfileId]);

  // Fetch keyword analysis when no generated-resume report exists
  useEffect(() => {
    if (report) return;              // Priority 1 — generated resume covers this
    if (!jobId || !resumeText) return;
    if (localReport || kwLoading) return;

    let cancelled = false;
    setKwLoading(true);
    setKwError(false);
    api(`/api/jobs/${jobId}/keywords`, {
      method: "POST",
      body: JSON.stringify({ resumeText }),
    })
      .then(data => {
        if (cancelled) return;
        setLocalReport(data);
        if (data && onReport) onReport(jobId, data);
      })
      .catch(() => { if (!cancelled) setKwError(true); })
      .finally(() => { if (!cancelled) setKwLoading(false); });
    return () => { cancelled = true; };
  }, [jobId, resumeText, report]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeReport = report ?? localReport;
  const clickableProfileId = activeProfileId || activeReport?.profileId || activeReport?.domainProfileId || null;
  const loadProfileSuggestions = async (profileId) => {
    if (!profileId) {
      setProfileSuggestions(null);
      setProfileSelections({ activeSkills: [], activeVerbs: [] });
      return;
    }
    try {
      const [next, profiles] = await Promise.all([
        api(`/api/domain-profiles/${profileId}/suggestions`),
        api("/api/domain-profiles"),
      ]);
      setProfileSuggestions(next || null);
      const activeProfile = (Array.isArray(profiles) ? profiles : []).find(profile => Number(profile.id) === Number(profileId));
      setProfileSelections({
        activeSkills: activeProfile?.selected_tools || [],
        activeVerbs: activeProfile?.selected_verbs || [],
      });
    } catch {}
  };

  useEffect(() => {
    loadProfileSuggestions(clickableProfileId);
  }, [clickableProfileId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleSuggestionsUpdated = (event) => {
      if (!clickableProfileId) return;
      if (Number(event.detail?.profileId) !== Number(clickableProfileId)) return;
      if (event.detail?.suggestions) setProfileSuggestions(event.detail.suggestions);
      else loadProfileSuggestions(clickableProfileId);
    };
    window.addEventListener(PROFILE_SUGGESTIONS_UPDATED_EVENT, handleSuggestionsUpdated);
    return () => window.removeEventListener(PROFILE_SUGGESTIONS_UPDATED_EVENT, handleSuggestionsUpdated);
  }, [clickableProfileId]); // eslint-disable-line react-hooks/exhaustive-deps

  useSyncEvents({
    profile_switched: () => {
      if (clickableProfileId) loadProfileSuggestions(clickableProfileId);
    },
  });

  /**
   * The candidate claiming, or withdrawing, a term (AG2).
   *
   * Reversible. The old handler wrote straight into domain_profiles.selected_tools and there was
   * no un-add anywhere in the product, so a misclick was permanent — and a permanent "yes" is not
   * an opt-in. A term already written by that old path (status 'applied') still reads as claimed,
   * because it was a claim; it just cannot be taken back here, which is what `locked` marks.
   */
  const toggleClaim = async (kind, label, claimed) => {
    if (!clickableProfileId || !label) return;
    const key = `${kind}:${label}`;
    if (kind === "skill") setProving(claimed ? label : (p => (p === label ? null : p)));
    setAddedItems(prev => {
      const next = new Set(prev);
      if (claimed) next.add(key); else next.delete(key);
      return next;
    });
    try {
      const next = await setProfileClaim(clickableProfileId, kind, label, claimed);
      setProfileSuggestions(next || null);
      emitProfileSuggestionsUpdated(clickableProfileId, next || null);
    } catch {
      setAddedItems(prev => {
        const next = new Set(prev);
        if (claimed) next.delete(key); else next.add(key);
        return next;
      });
    }
  };

  // No base resume uploaded yet
  if (!activeReport && !resumeText && !kwLoading) {
    return (
      <div style={{ padding:24, display:"flex", flexDirection:"column",
                    alignItems:"center", justifyContent:"center", gap:12,
                    height:"100%", color:"var(--color-text-muted)", fontSize:ts(13), textAlign:"center" }}>
        <div style={{ fontSize:ts(40) }}>📊</div>
        <div>Add a base resume to see keyword analysis for this role.</div>
      </div>
    );
  }

  // Loading skeleton
  if (kwLoading) {
    return (
      <div style={{ padding:24, display:"flex", flexDirection:"column",
                    alignItems:"center", justifyContent:"center", gap:14,
                    height:"100%", color:"var(--color-text-muted)", fontSize:ts(13), textAlign:"center" }}>
        <div style={{ fontSize:ts(28), animation:"spin 1.2s linear infinite" }}>⚙️</div>
        <div style={{ color:"var(--color-text)", fontWeight:600 }}>Analysing keywords...</div>
        <div style={{ fontSize:ts(11) }}>Checking your resume against the job description</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, justifyContent:"center", marginTop:4 }}>
          {[80,60,100,75,55,90,65,85].map((w,i) => (
            <div key={i} style={{ height:22, width:w, borderRadius:4,
              background:"var(--color-surface-offset)", opacity:0.6 }}/>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (kwError) {
    return (
      <div style={{ padding:24, display:"flex", flexDirection:"column",
                    alignItems:"center", justifyContent:"center", gap:12,
                    height:"100%", color:"var(--color-text-muted)", fontSize:ts(13), textAlign:"center" }}>
        <div style={{ fontSize:ts(40) }}>⚠️</div>
        <div>Could not analyse keywords — retry</div>
        <button onClick={() => { setKwError(false); setLocalReport(null); }}
          style={{ marginTop:8, padding:"6px 16px", borderRadius:6, border:"none",
                   background:"var(--color-primary)", color:"var(--color-on-primary)", cursor:"pointer",
                   fontWeight:600, fontSize:ts(12) }}>
          Retry
        </button>
      </div>
    );
  }

  if (!activeReport) return null;

  // ⛔ A52 · ONE READ. When a report is on screen, ITS score governs the band — including a null,
  // which is the scorer declining. `activeReport.score ?? score` let a stored number stand in for a
  // declined report, so the panel could read a band the report beneath it contradicted. The bare
  // `score` prop is used only for a report that carries no score field at all.
  const band = knownBand ?? atsBandFor(
    Object.prototype.hasOwnProperty.call(activeReport, "score") ? activeReport.score : (score ?? null));

  // AG2. CLAIMED, not merely suggested — only what the candidate said counts here. Terms already
  // written into the profile's own lists (the old one-way path) show as locked claims.
  const claims = clickableProfileId ? {
    onToggle: toggleClaim,
    pending: addedItems,
    claimedLookup: buildProfileClaimLookup(profileSuggestions || {}),
    lockedSkills: new Set((profileSelections.activeSkills || []).map(profileSignalKey).filter(Boolean)),
    lockedVerbs: new Set((profileSelections.activeVerbs || []).map(profileSignalKey).filter(Boolean)),
  } : null;

  // THE REPORT ITSELF IS components/AtsReport.jsx — the one implementation every ATS surface draws
  // (A52). This panel only fetches, caches and claims.
  const reportEl = <AtsReport report={activeReport} band={band} claims={claims} history={history} bare={bare} />;
  if (!proving) return reportEl;
  return (
    <>
      {reportEl}
      <div data-ats-claim-check={proving}>
        <SkillCheck key={proving} skill={proving} onClose={() => setProving(null)} />
      </div>
    </>
  );
}
