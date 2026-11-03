import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PostingPanel from "./PostingPanel.jsx";
import WarmPathsBlock from "./WarmPathsBlock.jsx";
import { api } from "../lib/api.js";
import { useJobBoard } from "../contexts/JobBoardContext.jsx";
import CoverLetterModal from "./CoverLetterModal.jsx";
import CompanyViewModal from "./CompanyViewModal.jsx";
import PanelShell from "./PanelShell.jsx";
import CompanyLink from "./CompanyLink.jsx";
import CompanyLogo from "./CompanyLogo.jsx";
import { AtsNumberBox } from "./AtsNumberBox.jsx";
import { atsScorePair } from "../../../shared/resumeScores.js";
import StickyBar from "./StickyBar.jsx";
import DepthButton, { ICONS } from "./DepthButton.jsx";
import "./JobDetailPanel.css";
import { DraftButton, PassButton, SaveButton } from "./DecisionButtons.jsx";
import ByomResumeChoice, { ByomStatus, useByomFlow } from "./ByomResumeChoice.jsx";
import { WhatWeChangedLink } from "./ResumeChangesPanel.jsx";

// Layout props (slot, width, focused, fullScreen, resizeMode and the three resize callbacks) come
// from usePanelHost via JobsPanel — this panel is one peer in an ordered set now, not the only
// drawer, and its width is allocated from the dock's budget rather than owned here. Escape
// handling, focus-on-open, the overlay surface, the scrim, the animation and the two pinned regions
// all live in PanelShell, which is shared with the PDF and ATS panels.
// ⭐ D48 · the ATS number box is components/AtsNumberBox.jsx — one box for every surface (A93).

/**
 * ⭐ D48 · THE ACTIONS — A and B are ONE component with two renderings, chosen by the PANEL's width (a
 * container query on .pp, never the window's): A, labelled depth boxes at ≥ 600px of panel; B, 48px icon
 * squares with the day's quota as the Draft badge, a tooltip each, and a caption on touch. Pass · Save ·
 * Draft | Résumé · Cover letter — and, once a résumé exists, Preview · PDF beside it.
 */
/**
 * ⭐ D57 · "Résumé ready · 2h ago" — when a résumé is stored for this job, the posting panel SAYS so and
 * offers it: view · download · regenerate. It never offers to generate again while hiding the one that
 * exists (after a reload the stored résumé used to surface only as a "Regenerate" button).
 */
export function resumeAgo(ms, now = Date.now()) {
  if (!Number.isFinite(ms)) return null;
  const s = Math.max(0, (now - ms) / 1000);
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  const d = Math.round(s / 86400);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

/** When the next draft frees up, on the viewer's own clock: "4:12 pm" today, "Tue 4:12 pm" later. */
export function clockLabel(ms, now = Date.now()) {
  if (!Number.isFinite(ms)) return null;
  const at = new Date(ms);
  const time = at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase();
  return at.toDateString() === new Date(now).toDateString() ? time
    : `${at.toLocaleDateString([], { weekday: "short" })} ${time}`;
}

/**
 * ⭐ D56 · "I SUBMITTED" ON THE MANUAL ROUTE. A résumé made by hand and sent by hand still has to land in
 * job_applications, with the tailored score (capturedAtsAtApply reads the job's résumé first). A63's rule
 * stands: nothing is "submitted" on a click alone — one piece of evidence (the confirmation link, the
 * confirmation email's subject, or a reference number) verifies it; without it the record is kept as
 * "recorded, not verified" and the server's sentence says what is missing.
 */
function ManualSubmitted({ jobId }) {
  const [open, setOpen] = useState(false);
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  useEffect(() => { setOpen(false); setEvidence(""); setMsg(null); }, [jobId]);
  const record = async () => {
    const e = evidence.trim();
    const body = { submittedAt: Date.now(), method: "company_site" };
    if (/^https?:\/\//i.test(e)) body.evidenceUrl = e;
    else if (/^[A-Za-z0-9][A-Za-z0-9#._/-]{3,63}$/.test(e) && /\d/.test(e)) body.reference = e;
    else if (e) body.evidenceText = e;
    setBusy(true);
    try {
      const d = await api(`/api/applications/pending/${encodeURIComponent(jobId)}/record`, { method: "POST", body: JSON.stringify(body) });
      setMsg(d.message || (d.verified ? "Recorded." : "Recorded, not verified yet."));
      if (d.verified) setOpen(false);
    } catch (err) { setMsg(err.message || "Could not record it."); }
    finally { setBusy(false); }
  };
  return (
    <div className="pp__submitted" data-manual-submitted="">
      {!open && <button type="button" className="pp__submitted-btn" onClick={() => setOpen(true)}>I submitted it</button>}
      {open && (
        <form onSubmit={(ev) => { ev.preventDefault(); record(); }}>
          <input type="text" value={evidence} onChange={(ev) => setEvidence(ev.target.value)} aria-label="Confirmation link, email subject, or reference number"
            placeholder="Confirmation link, email subject, or reference number" />
          <button type="submit" disabled={busy}>{busy ? "Recording…" : "Record it"}</button>
        </form>
      )}
      {msg && <p className="pp__submitted-msg" role="status">{msg}</p>}
    </div>
  );
}

function PostingActions({ job, meta, slots, onCoverLetter }) {
  const { g, done, st, canUseGenerate: canGen, onGenerate, onViewSandbox, onExport, onRegenerate = null, onSave, onPass, onDraft, drafted, drafting,
          draftBlock = null, onViewDraft = null, onExplainDraft = null, companyNotice = null, eligibilityNotice = null } = meta;
  // D51: the panel knows the slots too — out of drafts is a reason on the button, not a grey box.
  const block = draftBlock || (slots != null && slots.remaining <= 0 ? { code: "out_of_drafts", label: "Out of drafts",
    reason: `Out of drafts — all ${slots.limit} used in the last 24 hours (a Draft or a new résumé uses one).` } : null);
  const draftProps = { block, onView: onViewDraft, onExplain: onExplainDraft, slots };
  const selectedJob = job;
  const generateLoading = st === "generate";
  const canApply = !!(selectedJob.applyUrl || selectedJob.url);
  // A63: a NEW résumé uses a slot (a cached one does not, so Regenerate says so too).
  const noSlots = slots != null && slots.remaining <= 0;
  // D57: a résumé stored on an earlier visit (`__exists__`) is just as viewable — the panel fetches it.
  const hasArtifact = done && !!g?.html;
  const ago = hasArtifact ? resumeAgo(g?.generatedAt) : null;
  const regen = onRegenerate || (() => onGenerate(true));
  // ⛔ Cost visibility (owner, 10-09): a user sees their ALLOWANCE and what to expect — never what a résumé
  // costs, which tool or model runs, or whether it was cached. Those are the admin's (Admin → Costs & quotas).
  const freeAt = noSlots && slots?.nextFreeAt ? clockLabel(slots.nextFreeAt) : null;
  const resumeTitle = noSlots
    ? `You've used your drafts for now — the next one frees up ${freeAt ? `at ${freeAt}` : "within 24 hours"}.`
    : `${done ? "Regenerate" : "Generate"} résumé — uses 1 of your ${slots?.limit ?? 10} drafts (a Draft uses one too). Takes about 10–20 seconds.`;
  // ⭐ D86: while the operator's switch is on, the Résumé (and Regenerate) control is a SPLIT button — the
  // caret chooses draft or the user's own ChatGPT / Claude (plugin-ui.html, tab 2). While it is off, the plain
  // buttons below are drawn exactly as before; the default method is draft's Generate either way.
  const byom = useByomFlow(selectedJob);
  const split = (square, label, onRun) => (
    <ByomResumeChoice byom={byom} square={square} label={label} onGenerate={onRun} disabled={!!st || noSlots} busy={generateLoading} />
  );
  const quota = slots
    ? (noSlots
        ? `You've used your drafts for now — the next one frees up ${freeAt ? `at ${freeAt}` : "within 24 hours"}.`
        : `${slots.remaining} of ${slots.limit} drafts left in the last 24 hours — a Draft or a new résumé uses one.`)
    : null;
  return (
    <div className="pp__act" data-posting-actions="">
      {/* A — labelled boxes, when the panel is wide enough. */}
      <div className="pp__a" role="group" aria-label="Actions">
        {onPass && <PassButton passed={!!selectedJob.disliked} onPass={onPass} />}
        {onSave && <SaveButton saved={!!selectedJob.starred} onSave={onSave} />}
        {canApply && onDraft && <DraftButton logo drafted={!!drafted} drafting={!!drafting} onDraft={onDraft} {...draftProps} />}
        <span className="pp__div" aria-hidden="true" />
        {canGen && onGenerate && !hasArtifact && byom.available && split(false, "Résumé", () => onGenerate(false))}
        {canGen && onGenerate && !hasArtifact && !byom.available && (
          <DepthButton icon={ICONS.resume} onClick={() => onGenerate(false)} title={resumeTitle}
            disabled={!!st || noSlots}>
            {generateLoading ? "Generating…" : "Résumé"}
          </DepthButton>
        )}
        {hasArtifact && <DepthButton icon={ICONS.preview} onClick={() => onViewSandbox?.()} title="View the résumé">View</DepthButton>}
        {hasArtifact && <DepthButton icon={ICONS.pdf} onClick={() => onExport?.()} title="Download the résumé as a PDF">Download</DepthButton>}
        {hasArtifact && canGen && onGenerate && byom.available && split(false, "Regenerate", regen)}
        {hasArtifact && canGen && onGenerate && !byom.available && (
          <DepthButton icon={ICONS.resume} onClick={regen} title={resumeTitle} disabled={!!st || noSlots}>
            {generateLoading ? "Generating…" : "Regenerate"}
          </DepthButton>
        )}
        <DepthButton icon={ICONS.letter} onClick={onCoverLetter} title="Write a cover letter">Cover letter</DepthButton>
      </div>
      {/* B — icon squares, when the panel is condensed. */}
      <div className="pp__b" role="group" aria-label="Actions">
        {onPass && <PassButton square passed={!!selectedJob.disliked} onPass={onPass} />}
        {onSave && <SaveButton square saved={!!selectedJob.starred} onSave={onSave} />}
        {canApply && onDraft && <DraftButton logo square drafted={!!drafted} drafting={!!drafting} onDraft={onDraft} {...draftProps}
          badge={slots ? slots.remaining : null} />}
        <span className="pp__div" aria-hidden="true" />
        {canGen && onGenerate && !hasArtifact && byom.available && split(true, "Résumé", () => onGenerate(false))}
        {canGen && onGenerate && !hasArtifact && !byom.available && (
          <DepthButton size="square" icon={ICONS.resume} onClick={() => onGenerate(false)}
            title={resumeTitle} caption="Résumé" disabled={!!st || noSlots}>Generate résumé</DepthButton>
        )}
        {hasArtifact && <DepthButton size="square" icon={ICONS.preview} onClick={() => onViewSandbox?.()} title="View the résumé" caption="View">View résumé</DepthButton>}
        {hasArtifact && <DepthButton size="square" icon={ICONS.pdf} onClick={() => onExport?.()} title="Download the résumé as a PDF" caption="PDF">Download résumé</DepthButton>}
        {hasArtifact && canGen && onGenerate && byom.available && split(true, "Redo", regen)}
        {hasArtifact && canGen && onGenerate && !byom.available && (
          <DepthButton size="square" icon={ICONS.resume} onClick={regen}
            title={resumeTitle} caption="Redo" disabled={!!st || noSlots}>Regenerate résumé</DepthButton>
        )}
        <DepthButton size="square" icon={ICONS.letter} onClick={onCoverLetter} title="Write a cover letter" caption="Letter">Cover letter</DepthButton>
      </div>
      {/* ⭐ D57: the state, in words — "Résumé ready · 2h ago". */}
      {/* ⭐ D90 P2: beside the state, the way into "What we changed" — the tailored résumé against the one it was made from. */}
      {hasArtifact && <p className="pp__ready" data-resume-ready="">{ago ? `Résumé ready · ${ago}` : "Résumé ready"} · <WhatWeChangedLink jobId={job?.jobId} jobLabel={[job?.title, job?.company].filter(Boolean).join(" · ")} /></p>}
      {/* ⭐ D86: Open → Waiting for your résumé… → Checks → Done, updating itself while the user is in the chat. */}
      <ByomStatus byom={byom} onView={() => onViewSandbox?.()} onDownload={() => onExport?.()} />
      {/* ⭐ D56: the manual route records its own submission, here too — not only the extension. A105 finding 3: on every
          posting, not only once a résumé was generated — applying with the base résumé is applying too. */}
      {job?.jobId && <ManualSubmitted jobId={job.jobId} />}
      {/* A63: the shared allowance, said before anything is pressed — a muted line in A, the badge in B. */}
      {quota && <p className="pp__quota" data-draft-slots data-empty={noSlots ? "true" : "false"}>{quota}</p>}
      {/* ⭐ D70 Phase 3: the cost, in words, before Generate / Regenerate is pressed — a line, never a capsule (D60). */}
      {canGen && onGenerate && !noSlots && <p className="pp__quota" data-generate-expect="">Takes about 10–20 seconds.</p>}
      {/* ⭐ D54: never silent, never a block — the user's other roles at this company, before Draft. */}
      {companyNotice && <p className="pp__quota" data-company-notice="">{companyNotice.replace(" Draft this one too?", "")}</p>}
      {/* ⛔ D59: what the POSTING requires, and whether the profile STATES an answer — never a block, and
          never a verdict on the user's eligibility (D36: the resolver is exact-or-blank). */}
      {eligibilityNotice && <p className="pp__quota" data-eligibility-notice="">{eligibilityNotice}</p>}
    </div>
  );
}

export default function JobDetailPanel({
  slot = 0, width, focused = true, fullScreen = false, resizeMode = "dock", closesOnEscape, reserveRight = 0,
  onFocus, onResizeStart, onResize, onResizeEnd,
}) {
  const { selectedJob, setSelectedJob, selectedJobMeta } = useJobBoard();
  const close = useCallback(() => setSelectedJob(null), [setSelectedJob]);

  const navigate = useNavigate();
  const [showCoverLetter, setShowCoverLetter] = useState(false);
  const [showCompanyView, setShowCompanyView] = useState(false);

  // Reset per-job state when the job changes
  useEffect(() => {
    setShowCoverLetter(false);
    setShowCompanyView(false);
  }, [selectedJob?.jobId]);

  // ── Y2B · FETCH ON OPEN ──────────────────────────────────────────────────
  //
  // SmartRecruiters and Workday postings arrive with no description — their list endpoints carry
  // none. The background enrichment pass buys some each day within its budget; this buys THIS one,
  // because somebody just opened it. One request for a job a person actually cares about, cached
  // permanently server-side.
  //
  // ⛔ THREE STATES, NOT TWO. "loading", "got it" and "could not" are different things, and the
  // old single `{description ? … : "No description available."}` collapsed the last two into a
  // sentence that reads like a fact about the posting when it is often a fact about our fetch.
  // `fetchState` carries the reason so the panel can say which.
  //
  // ⛔ THE LOADING STATE IS NOT DECORATION — IT IS MEASURED. Through the real route against live
  // sources: SmartRecruiters 604ms, Workday 561ms for a first open; 5-6ms once cached. Half a
  // second of a panel showing "No description available." before the text appears would be a
  // panel that told the user something false and then corrected itself, on every first open of
  // every one of these postings. A source with no fetcher answers in 4ms and never flickers.
  const [fetched, setFetched] = useState(null);       // text this panel obtained itself
  const [fetchState, setFetchState] = useState(null); // 'loading' | 'failed' | 'unavailable' | null
  const [fetchMessage, setFetchMessage] = useState(null);
  // Bumped by the Retry link. In the dependency list below, so a retry re-runs the effect rather
  // than needing a second copy of the request logic beside it.
  const [retry, setRetry] = useState(0);

  const jobId = selectedJob?.jobId || selectedJob?.id || null;
  const hasStoredDescription = !!(selectedJob?.description && String(selectedJob.description).trim());

  useEffect(() => {
    // Clear per-job, so opening B never shows A's description or A's error.
    setFetched(null); setFetchState(null); setFetchMessage(null);
    if (!jobId || hasStoredDescription) return;

    let cancelled = false;
    setFetchState("loading");
    api(`/api/jobs/by-id/${encodeURIComponent(jobId)}/description`, { method: "POST" })
      .then(d => {
        if (cancelled) return;
        if (d?.success && d.description) {
          setFetched(d.description);
          setFetchState(null);
        } else {
          // ⛔ A FAILED FETCH SAYS SO. It does not render an empty panel and it does not report
          // success — the route returns success:false with a reason precisely so this branch has
          // something true to display.
          setFetchState(d?.reason === "no_fetcher" ? "unavailable" : "failed");
          setFetchMessage(d?.message || null);
        }
      })
      .catch(err => {
        if (cancelled) return;
        setFetchState("failed");
        setFetchMessage(err?.message || null);
      });
    // Navigating away mid-flight must not write state into an unmounted panel, and must not let a
    // slow response for job A land on job B.
    return () => { cancelled = true; };
  }, [jobId, hasStoredDescription, retry]);

  const description = hasStoredDescription ? selectedJob.description : fetched;

  // ── A63 (owner, O45c): THE DAY'S DRAFT SLOTS, AND PENDING ────────────────────────────────
  //
  // A generated résumé uses one of the day's Draft slots, the same allowance a Draft uses — so the
  // count is shown HERE, before Generate or Draft is pressed, not discovered as a refusal. And a
  // job the user generated for or opened the posting of is PENDING until they record and verify
  // the submission (Database → Pending); nothing becomes "applied" on a click.
  const [slots, setSlots] = useState(null);
  const [pendingState, setPendingState] = useState(null);
  const generating = selectedJobMeta?.st;
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    api("/api/draft/slots").then(d => { if (!cancelled) setSlots(d); }).catch(() => {});
    api("/api/applications/pending").then(d => {
      if (cancelled) return;
      const r = (d?.pending || []).find(x => String(x.jobId) === String(jobId));
      setPendingState(r?.state ?? null);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [jobId, generating, selectedJobMeta?.drafted]);

  // The company name IS the apply link (the old Apply button opened a "browser" that never opened
  // and recorded the job as applied). Opening it tags the job Pending — the user may be applying.
  const postingUrl = selectedJob?.applyUrl || selectedJob?.url || null;
  const openedPosting = useCallback(() => {
    if (!jobId) return;
    api("/api/applications/pending", { method: "POST", body: JSON.stringify({ jobId, origin: "opened_posting" }) })
      .then(d => setPendingState(d?.state ?? "pending")).catch(() => {});
  }, [jobId]);

  if (!selectedJob) return null;
  // ⭐ D58: the score the header's box shows is the board's ONE read (scoresFor in JobsPanel) — the tailored
  // résumé's when it exists, else the stored base. Never a guess, and null shows no digit.
  const g = selectedJobMeta?.g, job = selectedJob;
  const scores = selectedJobMeta?.scores ?? atsScorePair({ base: job?.baseAtsScore, tailored: g?.html ? g?.atsScore : null });

  return (
    <PanelShell
      panelId="jd"
      slot={slot} width={width} focused={focused} fullScreen={fullScreen} closesOnEscape={closesOnEscape} reserveRight={reserveRight}
      resizeMode={resizeMode}
      onClose={close} onFocus={onFocus}
      onResizeStart={onResizeStart} onResize={onResize} onResizeEnd={onResizeEnd}
      bare
    >
      {/* ── BODY (the only scrolling region) ───────────────────────────────────────────────────
          The modals below render through their own portals, so their position here is immaterial;
          the apply toast and the automation banner are inline and stay directly above the
          description, which is what they annotate. */}
      <div className="pp" data-jd-panel="" style={{ display:"flex", flexDirection:"column", minHeight:"100%" }}>

            {/* ⭐ D48 (owner, 10-07 — posting-header2.html, built to the file) · THE HEADER, which SCROLLS AWAY:
                [logo]  Company (the one company link, D38)  ····  [ATS number box]  [×]. The title is the
                masthead's; the chips (workstyle, location, salary, posted, band) and the keyword chips are
                gone — the deck strip and the ATS card carry them. */}
            <div className="pp__hd" data-posting-header="">
              <button type="button" className="pp__logo" onClick={() => setShowCompanyView(true)} title={`View ${selectedJob.company}'s KB profile`}
                aria-label={`View ${selectedJob.company}'s KB profile`}>
                <CompanyLogo company={selectedJob.company} iconUrl={selectedJob.companyIconUrl} size={46} radius={12}/>
              </button>
              {/* ⭐ A63: APPLY IS THE COMPANY NAME — a link to the posting, opened in a new tab. */}
              {/* ⛔ D38: the card's treatment, at last — the ONE company link: the logo face, no underline,
                  no ↗, and a hit area that is the text alone (it was display:block, the whole line). */}
              <div className="pp__co"><CompanyLink company={selectedJob.company} href={postingUrl || null} jobId={jobId} size="panel" onOpen={openedPosting} /></div>
              <span className="pp__sp" />
              <AtsNumberBox score={scores.shown} tailored={scores.tailoredShown} base={scores.base}
                open={!!selectedJobMeta?.atsOpen} onOpen={() => selectedJobMeta?.onAts?.()} />
              <button type="button" className="pp__x" onClick={close} aria-label="Close panel" title="Close">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
              </button>
            </div>
            {(pendingState === "pending" || pendingState === "recorded") && (
              <button type="button" className="pp__pending" data-pending-tag onClick={() => navigate({ pathname: "/app/auto-apply", search: "?sheet=pending" })}
                title="You may have applied — record when and how, and it moves to Submitted once it verifies.">
                {pendingState === "recorded" ? "Pending · not verified" : "Pending · record it"}
              </button>
            )}

            {/* ⭐ D48 · THE ACTIONS, STICKY AT THE TOP of the panel's scroll area — through the ONE StickyBar
                (D49), exactly as the board's bar sticks. × stays in the header (Esc and the backdrop close
                from anywhere) — the row's default. */}
            {selectedJobMeta && (
              <StickyBar top="0px" className="pp__bar" data-posting-actions-bar="">
                <PostingActions job={selectedJob} meta={selectedJobMeta} slots={slots}
                  onCoverLetter={() => setShowCoverLetter(true)} />
              </StickyBar>
            )}

            {/* Company view (FE-4) */}
            {showCompanyView && (
              <CompanyViewModal company={selectedJob.company} onClose={() => setShowCompanyView(false)} />
            )}

            {/* Cover Letter modal */}
            {showCoverLetter && (
              <CoverLetterModal
                resumeText={selectedJobMeta?.resumeText || ""}
                jobDescription={selectedJob.description}
                jobTitle={selectedJob.title}
                company={selectedJob.company}
                onClose={() => setShowCoverLetter(false)}
              />
            )}

            {/* Description. PanelShell's body is the scroll container (property 5), so this is a
                plain padded block — nesting another overflow:auto here would put a second scrollbar
                inside the first. */}
            <div style={{ flex:1, padding:"14px 14px" }}>
              {selectedJob.applicantCount != null && (
                <div style={{ fontSize:11, color:"var(--color-text-faint)", marginBottom:10 }}>
                  👥 {selectedJob.applicantCount > 200 ? "200+" : selectedJob.applicantCount} applicants
                </div>
              )}
              {/* Y2B — four outcomes, each said plainly. The previous version had one fallback
                  sentence, "No description available.", which was shown for a posting the source
                  never described, for a fetch still in flight, and for a fetch that failed. Three
                  different facts, one of them about us rather than the posting. */}
              {/* D32 · the posting half of the ink pair: the masthead (kicker · title · company · the deck
                  strip, "not stated" where a fact is not on file), then the employer's own description,
                  formatted plainly. What shows when there is no text is the panel's fallback. */}
              {/* ⭐ D138: who the user knows at this company, from their own contacts — beside the pair, not in it. */}
              <WarmPathsBlock jobId={selectedJob.id ?? selectedJob.jobId} />
              <PostingPanel job={selectedJob} text={description} vtTitle={selectedJob.id}>
              {fetchState === "loading" ? (
                <p style={{ fontSize:12, color:"var(--color-text-faint)", fontStyle:"italic" }}>
                  Loading the description from the source…
                </p>
              ) : fetchState === "failed" ? (
                <p style={{ fontSize:12, color:"var(--color-text-faint)", fontStyle:"italic" }}>
                  {fetchMessage || "Could not load the description from the source just now."}{" "}
                  <button
                    onClick={() => setRetry(r => r + 1)}
                    style={{ background:"none", border:"none", padding:0, font:"inherit",
                             color:"var(--color-primary-text)", textDecoration:"underline", cursor:"pointer" }}>
                    Retry
                  </button>
                </p>
              ) : fetchState === "unavailable" ? (
                <p style={{ fontSize:12, color:"var(--color-text-faint)", fontStyle:"italic" }}>
                  {fetchMessage || "This source does not publish a description for this posting."}
                </p>
              ) : (
                <p style={{ fontSize:12, color:"var(--color-text-faint)", fontStyle:"italic" }}>No description available.</p>
              )}
              </PostingPanel>
              {/* A63: no second "Apply directly" link here — Apply is the company name in the pinned
                  header, which stays in view however far the posting is scrolled. */}
            </div>
      </div>
    </PanelShell>
  );
}
