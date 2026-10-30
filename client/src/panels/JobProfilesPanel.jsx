// SCRAPING — SCHEDULED FOR REMOVAL AFTER MIGRATION
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { parseResumeFile } from "../lib/parseResumeFile.js";
import { useTheme } from "../styles/theme.jsx";
import { useJobBoard } from "../contexts/JobBoardContext.jsx";
import DomainProfileWizard from "../components/DomainProfileWizard.jsx";
// AC3: the card idiom below was lifted OUT of this panel into a shared primitive, and this panel
// renders it. Extraction, not duplication — see the note at the top of TileCard.jsx.
import { TileGrid, TileCard, TilePill } from "../components/ui/TileCard.jsx";
import { C } from "../styles/colorTokens.js";
import { TYPE } from "../styles/type.js";
import { carriedResume, dropCarriedResume } from "../lib/signupCarry.js";

export function JobProfilesPanel() {
  const { theme } = useTheme();
  const { setActiveProfileId, deleteProfileCache } = useJobBoard() || {};
  const [profiles, setProfiles] = useState([]);
  const [status, setStatus] = useState("");
  const [wizardMode, setWizardMode] = useState(null);
  const [editingProfile, setEditingProfile] = useState(null);
  const [uploadingProfileId, setUploadingProfileId] = useState(null);
  const [carried, setCarried] = useState(() => carriedResume());

  const formatTimestamp = (value) => {
    if (!value) return "";
    try { return new Date(Number(value) * 1000).toLocaleDateString(); }
    catch { return ""; }
  };

  const loadProfiles = useCallback(async () => {
    try {
      const rows = await api("/api/domain-profiles");
      const next = Array.isArray(rows) ? rows : [];
      setProfiles(next);
      const active = next.find(p => p.is_active) || next[0];
      if (active) setActiveProfileId?.(active.id);
    } catch (e) {
      setStatus(e.message || "Could not load job profiles");
    }
  }, [setActiveProfileId]);

  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  const activateProfile = async (id) => {
    try {
      await api(`/api/domain-profiles/${id}/activate`, { method: "POST" });
      setProfiles(prev => prev.map(p => ({ ...p, is_active: p.id === id ? 1 : 0 })));
      setActiveProfileId?.(id);
      setStatus("Active job profile updated");
    } catch (e) {
      setStatus(e.message || "Could not activate profile");
    }
  };

  const deleteProfile = async (profile) => {
    if (!profile || profiles.length <= 1) return;
    if (!confirm(`Delete job profile "${profile.profile_name}"?`)) return;
    try {
      await api(`/api/domain-profiles/${profile.id}`, { method: "DELETE" });
      deleteProfileCache?.(profile.id);
      await loadProfiles();
      setStatus("Job profile deleted");
    } catch (e) {
      setStatus(e.message || "Could not delete profile");
    }
  };

  const openCreate = () => {
    setEditingProfile(null);
    setWizardMode("create");
  };

  const openEdit = (profile) => {
    setEditingProfile(profile);
    setWizardMode("edit");
  };

  const uploadProfileResume = async (profile, event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !profile?.id) return;
    setUploadingProfileId(profile.id);
    setStatus(`Parsing resume for ${profile.profile_name}...`);
    try {
      const text = await parseResumeFile(file);
      if (!String(text || "").trim()) throw new Error("No text was extracted from that resume");
      await api(`/api/domain-profiles/${profile.id}/base-resume`, {
        method: "POST",
        body: JSON.stringify({ content: text, name: file.name }),
      });
      await loadProfiles();
      setStatus(`Base resume updated for ${profile.profile_name}. Extracted signals were refreshed for this profile only.`);
    } catch (e) {
      setStatus(e.message || "Could not upload profile resume");
    } finally {
      setUploadingProfileId(null);
    }
  };

  // AI1. The summary toggle lives here, beside the base resume, because it is a per-profile RESUME
  // setting and each profile answers it differently — a candidate keeps the summary on the profile
  // where it carries a career pivot and off the one where page one is already full.
  //
  // Optimistic, then reconciled: a checkbox that waits on a round trip before moving reads as
  // broken. On failure the previous value is put back and the reason is said, rather than the
  // control sitting on a setting the server never accepted.
  const setIncludeSummary = async (profile, next) => {
    const previous = profile.include_summary;
    setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, include_summary: next } : p));
    try {
      await api(`/api/domain-profiles/${profile.id}`, {
        method: "PUT",
        body: JSON.stringify({ include_summary: next }),
      });
      setStatus(next
        ? `Summary section on for ${profile.profile_name}. It will appear on resumes generated from now on.`
        : `Summary section off for ${profile.profile_name}. Resumes generated from now on will have no summary.`);
    } catch (e) {
      setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, include_summary: previous } : p));
      setStatus(e.message || "Could not change the summary setting");
    }
  };

  // AL2. Same optimistic-then-revert shape as setIncludeSummary, because it is the same kind of
  // control. What differs is what it costs: turning this ON makes queueing spend money again, so
  // the copy says that in the status line rather than describing it as a scheduling preference.
  const setGenerateAtQueue = async (profile, next) => {
    const previous = profile.generate_at_queue;
    setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, generate_at_queue: next } : p));
    try {
      await api(`/api/domain-profiles/${profile.id}`, {
        method: "PUT",
        body: JSON.stringify({ generate_at_queue: next }),
      });
      setStatus(next
        ? `Resumes for ${profile.profile_name} will be generated when you DRAFT a job. Drafting now costs money — about $0.04 per application, whether or not you approve it.`
        : `Resumes for ${profile.profile_name} are generated when you APPROVE. Drafting is free.`);
    } catch (e) {
      setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, generate_at_queue: previous } : p));
      setStatus(e.message || "Could not change the generation setting");
    }
  };

  const closeWizard = () => {
    setWizardMode(null);
    setEditingProfile(null);
  };

  return (
    // A53: no glass sheet under the page — the leather is the substrate and only the cards are glass
    // (the board's 09-30 fix, which this surface never got).
    <div style={{ flex:1, overflow:"auto", padding:"24px 28px", background:"transparent", color:"var(--color-text)" }}>
      <div style={{ maxWidth:1100, margin:"0 auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16, marginBottom:18 }}>
          <div>
            <div className="rm-section-label">Job Profiles</div>
            <h1 style={{ ...TYPE.PAGE_TITLE, margin:"6px 0 10px" }}>
              Job profiles
            </h1>
            <p style={{ ...TYPE.LEAD, margin:0, maxWidth:640 }}>
              Create, edit, delete, and switch profile-specific search targets. Each job profile keeps its own titles,
              skills, base resume, extracted signals, ATS basis, and search behavior.
            </p>
          </div>
          <button type="button" className="rm-btn rm-btn-primary" onClick={openCreate}>
            + Add Profile
          </button>
        </div>

        {status && (
          <div style={{ marginBottom:14, fontSize:12, color:"var(--color-text-muted)" }}>
            {status}
          </div>
        )}

        {/* "Sign up to keep it" (queue 30): the résumé this visitor scored on the signup page, carried
            in memory into the new account. Offered once; it never touches browser storage. */}
        {carried && (
          <div data-carried-resume style={{ marginBottom:14, padding:"12px 14px", borderRadius:12, background:C.ACCENT_QUIET,
                                            color:C.INK, fontSize:13, lineHeight:1.5, display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
            <span style={{ flex:1, minWidth:220 }}>
              <strong>{carried.file.name}</strong> — the résumé you checked before signing up.{" "}
              {profiles.some(p => !p.has_base_resume)
                ? "Use it as a profile's base résumé below."
                : "Add a profile and it will be offered as that profile's base résumé."}
            </span>
            <button type="button" className="rm-btn rm-btn-sm" onClick={() => { dropCarriedResume(); setCarried(null); }}>
              Not this one
            </button>
          </div>
        )}

        {/* The card idiom this panel established now lives in components/ui/TileCard.jsx, and this
            panel renders it (AC3 requirement 1: reuse the primitive, do not clone it into a second
            implementation). The markup was lifted out and parameterised, not rebuilt — every value
            is the one that was here, so these cards are unchanged. */}
        <TileGrid min={260} gap={14}>
          {profiles.map(profile => {
            const active = !!profile.is_active;
            return (
              <TileCard
                key={profile.id}
                active={active}
                data={{ tile: "profile", profile: profile.id }}
                title={profile.profile_name}
                meta={`${profile.seniority || "mid"} | ${profile.has_base_resume ? "resume linked" : "resume missing"}`}
                pill={active ? <TilePill>Active</TilePill> : null}
                body={(profile.target_titles || []).slice(0, 3).join(", ") || profile.role_family || "No target titles yet"}
                inset={
                  <>
                    <div style={{ display:"flex", justifyContent:"space-between", gap:10, alignItems:"center" }}>
                      <div>
                        <div style={{ fontSize:11, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.06em", color:"var(--color-text)" }}>
                          Base Resume
                        </div>
                        <div style={{ fontSize:11, color:profile.has_base_resume ? C.SUCCESS : C.WARNING, marginTop:3 }}>
                          {profile.has_base_resume
                            ? `Ready${profile.base_resume_updated_at ? ` · ${formatTimestamp(profile.base_resume_updated_at)}` : ""}`
                            : "Required before search, ATS, and enhancement"}
                        </div>
                        <div style={{ fontSize:10, color:"var(--color-text-muted)", marginTop:2 }}>
                          {profile.has_base_resume
                            ? "Extracted metadata ready for this profile only"
                            : "ATS scoring, new scrapes, and enhancement are blocked for this profile"}
                        </div>
                      </div>
                      {carried && !profile.has_base_resume && uploadingProfileId !== profile.id && (
                        <button type="button" className="rm-btn rm-btn-sm rm-btn-primary" style={{ margin:0 }}
                          onClick={() => { const file = carried.file; dropCarriedResume(); setCarried(null);
                                           uploadProfileResume(profile, { target: { files: [file], value: "" } }); }}>
                          Use {carried.file.name}
                        </button>
                      )}
                      <label className="rm-btn rm-btn-sm" style={{ cursor:"pointer", margin:0 }}>
                        {uploadingProfileId === profile.id
                          ? "Parsing..."
                          : profile.has_base_resume ? "Replace" : "Upload"}
                        <input
                          type="file"
                          accept=".txt,.html,.md,.docx,.pdf"
                          onChange={event => uploadProfileResume(profile, event)}
                          style={{ display:"none" }}
                          disabled={uploadingProfileId === profile.id}
                        />
                      </label>
                    </div>
                    <div style={{ marginTop:7, fontSize:10, color:"var(--color-text-muted)", lineHeight:1.4 }}>
                      Stored and extracted only for this profile. Other profiles keep their own resume, signals, ATS basis, and search readiness.
                    </div>
                    {/* AI1. The copy says WHAT IT DOES, not why a summary might help — the
                        candidate is choosing a section, not being sold one. The second line is
                        there because the default changed underneath existing users: every resume
                        generated before this had a summary, and one generated now will not unless
                        this is on. Saying so here is the difference between a default and a
                        surprise. */}
                    <div style={{ marginTop:9, paddingTop:9, borderTop:"1px solid var(--color-border)" }}>
                      <label style={{ display:"flex", gap:8, alignItems:"flex-start", cursor:"pointer", margin:0 }}>
                        <input
                          type="checkbox"
                          checked={!!profile.include_summary}
                          onChange={event => setIncludeSummary(profile, event.target.checked)}
                          style={{ marginTop:2, flexShrink:0 }}
                        />
                        <span>
                          <span style={{ fontSize:11, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.06em", color:"var(--color-text)" }}>
                            Include a summary section
                          </span>
                          <span style={{ display:"block", fontSize:10, color:"var(--color-text-muted)", marginTop:2, lineHeight:1.4 }}>
                            {profile.include_summary
                              ? "Generated resumes for this profile open with a summary."
                              : "Off. Generated resumes for this profile have no summary section — resumes generated before this setting existed did."}
                          </span>
                        </span>
                      </label>
                    </div>
                    {/* AL2. A TESTING SWITCH, and the copy says what it costs rather than what it
                        schedules. Default OFF: queueing is free and the tailored resume is written
                        when the application is approved, so a user who never finds this control is
                        never charged for an application they did not decide to send. Turning it on
                        restores the old behaviour, which is useful for testing generation without
                        walking the approval flow — and expensive for exactly the same reason. */}
                    <div style={{ marginTop:9, paddingTop:9, borderTop:"1px solid var(--color-border)" }}>
                      <label style={{ display:"flex", gap:8, alignItems:"flex-start", cursor:"pointer", margin:0 }}>
                        <input
                          type="checkbox"
                          checked={!!profile.generate_at_queue}
                          onChange={event => setGenerateAtQueue(profile, event.target.checked)}
                          style={{ marginTop:2, flexShrink:0 }}
                        />
                        <span>
                          <span style={{ fontSize:11, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.06em", color:"var(--color-text)" }}>
                            Generate resumes when you draft
                          </span>
                          <span style={{ display:"block", fontSize:10, color:"var(--color-text-muted)", marginTop:2, lineHeight:1.4 }}>
                            {profile.generate_at_queue
                              ? "On. A tailored resume is written as soon as you draft a job — about $0.04 each, spent whether or not you go on to approve it."
                              : "Off. Drafting is free; the tailored resume is written when you approve the application. The approval screen shows your base resume's fit so you are not deciding blind."}
                          </span>
                        </span>
                      </label>
                    </div>
                  </>
                }
                footer={
                  <>
                    <button type="button" className="rm-btn rm-btn-sm" onClick={() => openEdit(profile)}>
                      Edit
                    </button>
                    <button type="button" className="rm-btn rm-btn-sm" onClick={() => activateProfile(profile.id)} disabled={active}>
                      {active ? "Active" : "Switch"}
                    </button>
                    <button
                      type="button"
                      className="rm-btn rm-btn-sm"
                      onClick={() => deleteProfile(profile)}
                      disabled={profiles.length <= 1}
                      style={{ color:profiles.length <= 1 ? "var(--color-text-muted)" : C.DANGER }}
                    >
                      Delete
                    </button>
                  </>
                }
              />
            );
          })}
        </TileGrid>

        {profiles.length === 0 && (
          <div style={{
            border:`1px dashed ${"var(--color-border)"}`,
            background:"var(--color-surface)",
            borderRadius:16,
            padding:"28px",
            textAlign:"center",
            color:"var(--color-text-muted)",
          }}>
            No job profiles yet. Add your first profile to unlock profile-scoped search, ATS, and resume signals.
          </div>
        )}
      </div>

      {wizardMode && (
        <DomainProfileWizard
          key={editingProfile ? `edit-${editingProfile.id}` : "create-profile"}
          mode={wizardMode}
          initialProfile={editingProfile}
          onComplete={(profile) => {
            closeWizard();
            loadProfiles().then(() => {
              if (profile?.id) setActiveProfileId?.(profile.id);
            });
          }}
          onDismiss={closeWizard}
          bannerText={wizardMode === "edit"
            ? "Use the same guided selector UI from registration. Updates stay scoped to this job profile."
            : "Use the guided selector UI from registration to create another profile."}
        />
      )}
    </div>
  );
}
