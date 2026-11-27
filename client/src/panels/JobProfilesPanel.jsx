// ⭐ D197 Wave 2 · M5 (47m, lane person) · JOB PROFILES → *YOUR BEARINGS* (docs/revamp/jobprofiles.md — the PROPOSED M2,
// built as proposed: agent's pick, the owner may reverse). A job profile is a BEARING — the market's word for the sentence
// filter — and this page is the drawer of every bearing you keep, the one you travel on (ACTIVE) and what you follow.
// Every M1 row keeps its home (J1–J16): the header + Add a bearing (the wizard) · the status line · the carried résumé (the
// page's one clay point while it exists) · Refine (read from your résumé) · one bearing card per profile (its sentence, its
// base résumé — Upload / Replace / Use <carried>, Include a summary section, Edit · Activate · Delete) · read failed / empty ·
// 02 What you follow (saved searches, companies, tracked pages — Track a page). Plate tokens only; the region is IV.
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";   // D159 T2 (46y): a tracker's Open goes to the board
import { api } from "../lib/api.js";
import { parseResumeFile } from "../lib/parseResumeFile.js";
import { useJobBoard } from "../contexts/JobBoardContext.jsx";
import DomainProfileWizard from "../components/DomainProfileWizard.jsx";
import { profileToRefine } from "../components/RefineJobProfile.jsx";
import { carriedResume, dropCarriedResume } from "../lib/signupCarry.js";
import PlateRoot from "../plate/PlateRoot.jsx";
import { Kickers } from "../plate/Marks.jsx";
import { StatsStrip, LegHeader, PlateHero } from "../plate/Plates.jsx";
import { Ticket, Cartouche } from "../plate/Tickets.jsx";
import { Drawer, ErrorLine, Skeleton } from "../plate/PlateState.jsx";
import { SettingsSheet, LabelledField } from "../plate/Person.jsx";
import BearingsCompassRose from "../plate/drawings/BearingsCompassRose.jsx";
import "../plate/personPages.css";

const LEVEL = { junior: "entry", mid: "mid", senior: "senior", executive: "executive" };
const formatTimestamp = (value) => { if (!value) return ""; try { return new Date(Number(value) * 1000).toLocaleDateString(); } catch { return ""; } };
const plain = (e) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

/** PURE. A job profile as its bearing sentence's parts (each read value a dashed, tappable word — it opens the wizard). */
export function bearingParts(p) {
  const titles = (p.target_titles || []).slice(0, 3);
  return [
    "discovering ", { id: "role", text: p.profile_name || p.role_family || "your field", label: `Field: ${p.profile_name || p.role_family}. Change it` },
    " roles at ", { id: "level", text: `${LEVEL[p.seniority] || p.seniority || "mid"} level`, label: "Level. Change it" },
    ...(titles.length ? [" as ", { id: "titles", text: titles.join(", "), label: "Titles. Change them" }] : []),
    ".",
  ];
}

export function JobProfilesPanel() {
  const navigate = useNavigate();
  const { setActiveProfileId, deleteProfileCache } = useJobBoard() || {};
  const [profiles, setProfiles] = useState([]);
  // ⛔ D156 (6) · "loading" | "ready" | "error": "No job profiles yet" only when the read SUCCEEDED and found none.
  const [profilesState, setProfilesState] = useState("loading");
  const [status, setStatus] = useState("");
  const [said, setSaid] = useState("");   // the one operable model's caption: "Now travelling on …"
  const [wizardMode, setWizardMode] = useState(null);
  const [editingProfile, setEditingProfile] = useState(null);
  const [refining, setRefining] = useState(false);
  const [uploadingProfileId, setUploadingProfileId] = useState(null);
  const [carried, setCarried] = useState(() => carriedResume());
  const [trackers, setTrackers] = useState({ state: "loading", data: null });

  const loadProfiles = useCallback(async () => {
    try {
      const rows = await api("/api/domain-profiles", { timeoutMs: 10000 });
      const next = Array.isArray(rows) ? rows : [];
      setProfiles(next);
      setProfilesState("ready");
      const active = next.find((p) => p.is_active) || next[0];
      if (active) setActiveProfileId?.(active.id);
    } catch (e) {
      setProfilesState((s) => (s === "ready" ? s : "error"));
      setStatus(e.message || "Could not load job profiles");
    }
  }, [setActiveProfileId]);
  const loadTrackers = useCallback(async () => {
    try { setTrackers({ state: "ready", data: await api("/api/trackers", { timeoutMs: 20000 }) }); }
    catch { setTrackers((t) => ({ ...t, state: "error" })); }
  }, []);
  useEffect(() => { loadProfiles(); }, [loadProfiles]);
  useEffect(() => { loadTrackers(); }, [loadTrackers, profiles.length]);

  const activateProfile = async (id) => {
    try {
      await api(`/api/domain-profiles/${id}/activate`, { method: "POST" });
      setProfiles((prev) => prev.map((p) => ({ ...p, is_active: p.id === id ? 1 : 0 })));
      setActiveProfileId?.(id);
      const p = profiles.find((x) => x.id === id);
      setStatus("Active job profile updated");
      setSaid(`Now travelling on ${p?.profile_name || "this bearing"} · ${LEVEL[p?.seniority] || p?.seniority || "mid"}.`);
    } catch (e) { setStatus(e.message || "Could not activate profile"); }
  };
  const deleteProfile = async (profile) => {
    if (!profile || profiles.length <= 1) return;
    if (!confirm(`Delete job profile "${profile.profile_name}"?`)) return;
    try {
      await api(`/api/domain-profiles/${profile.id}`, { method: "DELETE" });
      deleteProfileCache?.(profile.id);
      await loadProfiles();
      setStatus("Job profile deleted");
    } catch (e) { setStatus(e.message || "Could not delete profile"); }
  };
  const openCreate = () => { setEditingProfile(null); setRefining(false); setWizardMode("create"); };
  const openEdit = (profile, refine = false) => { setEditingProfile(profile); setRefining(refine); setWizardMode("edit"); };
  const uploadProfileResume = async (profile, file) => {
    if (!file || !profile?.id) return;
    setUploadingProfileId(profile.id);
    setStatus(`Parsing resume for ${profile.profile_name}...`);
    try {
      const text = await parseResumeFile(file);
      if (!String(text || "").trim()) throw new Error("No text was extracted from that resume");
      await api(`/api/domain-profiles/${profile.id}/base-resume`, { method: "POST", body: JSON.stringify({ content: text, name: file.name }) });
      await loadProfiles();
      setStatus(`Base resume updated for ${profile.profile_name}. Extracted signals were refreshed for this profile only.`);
    } catch (e) { setStatus(e.message || "Could not upload profile resume"); }
    finally { setUploadingProfileId(null); }
  };
  // AI1. The summary toggle — optimistic, then reconciled; on failure the previous value is put back and the reason said.
  const setIncludeSummary = async (profile, next) => {
    const previous = profile.include_summary;
    setProfiles((prev) => prev.map((p) => (p.id === profile.id ? { ...p, include_summary: next } : p)));
    try {
      await api(`/api/domain-profiles/${profile.id}`, { method: "PUT", body: JSON.stringify({ include_summary: next }) });
      setStatus(next
        ? `Summary section on for ${profile.profile_name}. It will appear on resumes generated from now on.`
        : `Summary section off for ${profile.profile_name}. Resumes generated from now on will have no summary.`);
    } catch (e) {
      setProfiles((prev) => prev.map((p) => (p.id === profile.id ? { ...p, include_summary: previous } : p)));
      setStatus(e.message || "Could not change the summary setting");
    }
  };
  const closeWizard = () => { setWizardMode(null); setEditingProfile(null); setRefining(false); };
  const onClick = (e) => {
    const a = e.target.closest?.("a[href]");
    if (!a || e.defaultPrevented || !plain(e) || a.target) return;
    const href = a.getAttribute("href");
    if (!/^\/(app|companies)\b/.test(href || "")) return;
    e.preventDefault(); navigate(href);
  };

  const active = profiles.find((p) => p.is_active) || null;
  const toRefine = profileToRefine(profiles, active?.id ?? null);
  const t = trackers.data;
  const newCount = t ? [...t.searches, ...t.companies].reduce((n, x) => n + (Number(x.newCount) || 0), 0) : null;
  const jump = (id) => () => document.getElementById(id)?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  const needles = profiles.filter((p) => !p.is_active).slice(0, 2).map((p) => p.profile_name || "");

  return (
    <PlateRoot region="IV" className="pl-pp-page" data-job-profiles="" onClick={onClick}>
      <header className="pl-page pl-pp-head">
        <Kickers parts={["THE MARKET", "JOB PROFILES"]} />
        <h1 className="pl-pp-working">Your bearings</h1>
        <p className="pl-lead pl-lead--body">Each bearing keeps its own titles, skills, base résumé and search. The active one is the one the market travels on.</p>
        <StatsStrip label="Your bearings at a glance" cells={[
          { value: profilesState === "ready" ? profiles.length : null, label: "BEARINGS", onClick: jump("bg-bearings") },
          { value: active ? (active.profile_name || "—") : null, label: "ACTIVE", onClick: jump("bg-bearings") },
          { value: t ? t.searches.length : null, label: "SAVED SEARCHES", onClick: jump("bg-follow") },
          { value: t ? t.companies.length : null, label: "COMPANIES FOLLOWED", onClick: jump("bg-follow") },
          { value: newCount, label: "NEW SINCE YOUR LAST VISIT", onClick: jump("bg-follow"), tone: newCount ? "clay" : undefined },
        ]} />
        <div className="pl-actions">
          <button type="button" className="pl-btn pl-btn--ink" onClick={openCreate}>+ Add a bearing</button>
        </div>
        {status ? <p className="pl-pp-note" role="status">{status}</p> : null}
        <p className="pl-label pl-muted" aria-live="polite" data-bearing-caption="">{said}</p>
      </header>

      <div className="pl-page pl-pp-body">
        {/* "Sign up to keep it" (queue 30): the résumé this visitor scored on the signup page, carried in memory. Offered once. */}
        {carried ? (
          <div className="pl-pp-callout" data-carried-resume="">
            <span><b>{carried.file.name}</b> — the résumé you checked before signing up.{" "}
              {carried.from === "honesty" && carried.flagged > 0 ? (
                <span data-carried-honesty="">{`The honesty check flagged ${carried.flagged} line${carried.flagged === 1 ? "" : "s"} you may not be able to defend — open it in the editor from your passport to fix them. `}</span>
              ) : null}
              {profiles.some((p) => !p.has_base_resume) ? "Use it as a bearing's base résumé below." : "Add a bearing and it will be offered as its base résumé."}</span>
            <button type="button" className="pl-btn" onClick={() => { dropCarriedResume(); setCarried(null); }}>Not this one</button>
          </div>
        ) : null}
        {/* D112 e2: a profile made from a résumé asks to be checked until the wizard is saved for it. */}
        {toRefine ? (
          <div data-refine-job-profile={toRefine.id}>
            <SettingsSheet kicker="READ FROM YOUR RÉSUMÉ · CHECK WHAT IT READ" title={toRefine.profile_name || "Your job profile"}
              lead="It was set up from your résumé. Check the field, level, titles and keywords it read — everything is already filled in."
              actions={<button type="button" className={carried ? "pl-btn pl-btn--ink" : "pl-btn pl-btn--primary"} onClick={() => openEdit(toRefine, true)}>Refine your job profile</button>} />
          </div>
        ) : null}
      </div>

      <section className="pl-section" id="bg-bearings" aria-labelledby="bg-bearings-t">
        <LegHeader n={1} meta="EACH BEARING · ITS SENTENCE · ITS BASE RÉSUMÉ" title={<span id="bg-bearings-t">The bearings</span>} />
        <div className="pl-pp-row">
          <div className="pl-pp-main">
            {profilesState === "loading" ? <Skeleton label="Loading your bearings" height={260} lines={4} /> : null}
            {profilesState === "error" && profiles.length === 0 ? (
              <div data-profiles-read-failed="" role="alert">
                <ErrorLine text="We couldn't load your job profiles — draft didn't answer in time. Nothing is lost." onRetry={() => { setProfilesState("loading"); loadProfiles(); }} />
              </div>
            ) : null}
            {profilesState === "ready" && profiles.length === 0 ? (
              <Drawer title="No bearings yet" text="No job profiles yet. Add your first one and draft starts finding jobs that fit it."
                actions={<button type="button" className="pl-btn pl-btn--primary" onClick={openCreate}>+ Add a bearing</button>} />
            ) : null}
            <div className="pl-bg-cards">
              {profiles.map((profile) => (
                <BearingCard key={profile.id} profile={profile} last={profiles.length <= 1} carried={carried} busy={uploadingProfileId === profile.id}
                  onPart={() => openEdit(profile)} onEdit={() => openEdit(profile)} onActivate={() => activateProfile(profile.id)} onDelete={() => deleteProfile(profile)}
                  onUpload={(file) => uploadProfileResume(profile, file)} onSummary={(v) => setIncludeSummary(profile, v)}
                  onUseCarried={() => { const file = carried.file; dropCarriedResume(); setCarried(null); uploadProfileResume(profile, file); }} />
              ))}
            </div>
          </div>
          <div className="pl-pp-side">
            <PlateHero aspect="360 / 220" caption={<span className="pl-label">ONE NEEDLE PER BEARING · THE ACTIVE ONE INKED</span>}>
              <BearingsCompassRose label={`A compass rose, one needle per bearing; the active one, ${active?.profile_name || "none yet"}, is inked`}
                active={active?.profile_name || ""} needle1={needles[0] || ""} needle2={needles[1] || ""} />
            </PlateHero>
          </div>
        </div>
      </section>

      <Trackers id="bg-follow" state={trackers.state} data={t} reload={loadTrackers} onActivate={setActiveProfileId} />

      <section className="pl-section pl-section--last" aria-labelledby="bg-onward-t">
        <LegHeader n={3} meta="ONWARD · FROM YOUR BEARINGS" title={<span id="bg-onward-t">Tickets out</span>} />
        <div className="pl-tickets">
          <Ticket tone={carried || toRefine ? "plain" : "clay-tint"} kicker="THE MARKET" title={active ? `Set out on ${active.profile_name}` : "The market"}
            line="Today's picks and every opening, read against this bearing." go="Open →" href="/app/jobs" />
          <Ticket kicker="YOUR PASSPORT" title="Your page, from your résumé" line="Only you can see it until you choose." go="Open →" href="/app/profile/about" />
        </div>
      </section>

      {wizardMode ? (
        <DomainProfileWizard
          key={editingProfile ? `${refining ? "refine" : "edit"}-${editingProfile.id}` : "create-profile"}
          mode={wizardMode}
          refine={refining || undefined}
          initialProfile={editingProfile}
          onComplete={(profile) => { closeWizard(); loadProfiles().then(() => { if (profile?.id) setActiveProfileId?.(profile.id); }); }}
          onDismiss={closeWizard}
          bannerText={refining ? "Read from your résumé — change anything that is not right. Every step is optional."
            : wizardMode === "edit" ? "Change the roles and skills for this job profile. Your other profiles stay as they are."
            : "Use the guided selector UI from registration to create another profile."}
        />
      ) : null}
    </PlateRoot>
  );
}

/** One bearing: its sentence (each word opens the wizard), its base résumé, the summary switch, Edit · Activate · Delete. */
function BearingCard({ profile, last, carried, busy, onPart, onEdit, onActivate, onDelete, onUpload, onSummary, onUseCarried }) {
  const file = useRef(null);
  const active = !!profile.is_active;
  return (
    <article className="pl-bg-card" data-tile="profile" data-profile={profile.id} data-active={active ? "" : undefined}>
      <Cartouche kicker={active ? "BEARING · ACTIVE · THE MARKET TRAVELS ON THIS ONE" : "BEARING"} source={profile.role_family ? String(profile.role_family).toUpperCase() : null}
        parts={bearingParts(profile)} onPart={onPart}
        actions={<>
          <button type="button" className="pl-btn" onClick={onEdit}>Edit</button>
          <button type="button" className="pl-btn pl-btn--ink" onClick={onActivate} disabled={active}>{active ? "Active" : "Activate"}</button>
          <button type="button" className="pl-btn pl-btn--dashed" onClick={onDelete} disabled={last} title={last ? "The last bearing can't be deleted" : undefined}>Delete</button>
        </>} />
      <SettingsSheet kicker="BASE RÉSUMÉ · THIS BEARING ONLY" rows={[
        { label: profile.has_base_resume ? `Ready${profile.base_resume_updated_at ? ` · ${formatTimestamp(profile.base_resume_updated_at)}` : ""}` : "Needed before draft can find and score jobs",
          note: profile.has_base_resume ? "Read from your résumé, for this job profile only. Other bearings keep their own résumé, signals, ATS basis and search."
            : "Upload a résumé to start finding and scoring jobs for this bearing.",
          control: <>
            {carried && !profile.has_base_resume && !busy ? <button type="button" className="pl-btn pl-btn--primary" onClick={onUseCarried}>Use {carried.file.name}</button> : null}
            <button type="button" className="pl-btn" disabled={busy} onClick={() => file.current?.click()}>{busy ? "Parsing…" : profile.has_base_resume ? "Replace" : "Upload"}</button>
            <input ref={file} type="file" accept=".txt,.html,.md,.docx,.pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; onUpload(f); }} />
          </> },
        { label: "Include a summary section",
          note: profile.include_summary ? "Generated resumes for this profile open with a summary." : "Off. Generated resumes for this profile have no summary section — resumes generated before this setting existed did.",
          control: <input type="checkbox" className="pl-check" checked={!!profile.include_summary} aria-label="Include a summary section" onChange={(e) => onSummary(e.target.checked)} /> },
      ]} />
    </article>
  );
}

// ── ⭐ D159 T2–T4 (46y) · TRACKERS → 02 WHAT YOU FOLLOW ─────────────────────────────────────────────────────────────
// A saved search, a followed company and a pasted careers page / board — each with what is NEW since you last looked
// (GET /api/trackers; routes/trackers.js). Open marks it seen. No pills (D60).
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const PAGE_STATUS = {
  pending: "Waiting for review — we'll follow it once its board is added",
  unsupported: "We can't read this page yet — paste the job board link from its Apply button (Greenhouse, Lever, Ashby …)",
};
function Trackers({ id, state, data, reload, onActivate }) {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const openSearch = async (s) => {
    try {
      if (!s.active) { await api(`/api/domain-profiles/${s.profileId}/activate`, { method: "POST" }); onActivate?.(s.profileId); }
      navigate(`/app/jobs?tracker=${s.profileId}`);
    } catch (e) { setNote(e.message || "Could not open that search."); }
  };
  const openCompany = async (c) => {
    try { await api(`/api/trackers/companies/${c.companyId}/seen`, { method: "POST" }); } catch { /* the page still opens */ }
    navigate(`/companies/${c.slug}`);
  };
  const unfollow = async (c) => {
    try { await api(`/api/companies/${c.slug}/follow`, { method: "POST", body: JSON.stringify({ on: false }) }); reload(); }
    catch (e) { setNote(e.message || "Could not unfollow."); }
  };
  const dropPage = async (pg) => {
    try { await api(`/api/trackers/pages/${pg.id}`, { method: "DELETE" }); reload(); }
    catch (e) { setNote(e.message || "Could not remove it."); }
  };
  const track = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy(true); setNote("");
    try {
      const r = await api("/api/trackers/pages", { method: "POST", body: JSON.stringify({ url: url.trim() }) });
      setNote(r.status === "following" ? `Following ${r.company?.name || r.label}. New postings there show here.`
        : r.status === "pending" ? `${r.label || "That board"} isn't on draft yet — it's been sent for review. You'll follow it once it's added.`
        : PAGE_STATUS.unsupported);
      setUrl(""); reload();
    } catch (err) { setNote(err.message || "Could not track that page."); }
    finally { setBusy(false); }
  };
  const fresh = (n) => (n == null ? <span className="pl-pp-note">count unavailable</span>
    : n > 0 ? <b data-tracker-new={n}>{plural(n, "new posting")} since you last looked</b>
    : <span className="pl-pp-note">nothing new since you last looked</span>);
  const empty = data && !data.searches.length && !data.companies.length && !data.pages.length;
  const rows = data ? [
    ...data.searches.map((s) => ({ label: s.label, note: `Saved search · ${s.profileName}`,
      control: <span data-tracker-search={s.profileId} className="pl-actions">{fresh(s.newCount)}<button type="button" className="pl-btn" onClick={() => openSearch(s)}>Open</button></span> })),
    ...data.companies.map((c) => ({ label: c.name, note: "Company you follow",
      control: <span data-tracker-company={c.slug} className="pl-actions">{fresh(c.newCount)}<button type="button" className="pl-btn" onClick={() => openCompany(c)}>Open</button>
        <button type="button" className="pl-btn" onClick={() => unfollow(c)}>Unfollow</button></span> })),
    ...data.pages.map((pg) => ({ label: pg.label || pg.url, note: PAGE_STATUS[pg.status] || pg.status,
      control: <span data-tracker-page={pg.status}><button type="button" className="pl-btn" onClick={() => dropPage(pg)}>Remove</button></span> })),
  ] : [];
  return (
    <section className="pl-section" id={id} data-trackers="" aria-labelledby={`${id}-t`}>
      <LegHeader n={2} meta="SAVED SEARCHES · COMPANIES · CAREERS PAGES" title={<span id={`${id}-t`}>What you follow</span>} />
      <div className="pl-pp-row">
        <div className="pl-pp-main">
          <p className="pl-pp-note">What's new at the searches, companies and job boards you follow. Save a search from the market's filters, press Follow on a company's survey sheet, or paste a careers page or job board link here.</p>
          <form className="pl-pp-inline" onSubmit={track}>
            <LabelledField label="A careers page or job board link" type="url" value={url} onChange={setUrl} placeholder="https://jobs.lever.co/company or a careers page" />
            <button type="submit" className="pl-btn pl-btn--ink" disabled={busy || !url.trim()}>{busy ? "Checking…" : "Track"}</button>
          </form>
          {note ? <p className="pl-pp-note" role="status">{note}</p> : null}
          {state === "loading" ? <Skeleton label="Loading your trackers" height={160} lines={3} /> : null}
          {state === "error" ? <ErrorLine text="Your trackers could not be loaded." onRetry={reload} /> : null}
          {empty ? <Drawer text="Nothing tracked yet." /> : null}
          {rows.length ? <SettingsSheet kicker="WHAT YOU FOLLOW" rows={rows} /> : null}
        </div>
      </div>
    </section>
  );
}
