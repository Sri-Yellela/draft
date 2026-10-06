import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PostingPanel from "./PostingPanel.jsx";
import { api } from "../lib/api.js";
import { useJobBoard } from "../contexts/JobBoardContext.jsx";
import CoverLetterModal from "./CoverLetterModal.jsx";
import CompanyViewModal from "./CompanyViewModal.jsx";
import PanelShell from "./PanelShell.jsx";
import CompanyLink from "./CompanyLink.jsx";
import CompanyIcon from "./ui/CompanyIcon.jsx";
import { ATS_NUMBER_SHOWN, ATS_NUMBER_NOTE } from "../../../shared/atsBands.js";
import StickyBar from "./StickyBar.jsx";
import DepthButton, { ICONS } from "./DepthButton.jsx";
import "./JobDetailPanel.css";
import { DraftButton, PassButton, SaveButton } from "./DecisionButtons.jsx";

// Layout props (slot, width, focused, fullScreen, resizeMode and the three resize callbacks) come
// from usePanelHost via JobsPanel — this panel is one peer in an ordered set now, not the only
// drawer, and its width is allocated from the dock's budget rather than owned here. Escape
// handling, focus-on-open, the overlay surface, the scrim, the animation and the two pinned regions
// all live in PanelShell, which is shared with the PDF and ATS panels.
/**
 * ⭐ D48 · THE ATS NUMBER BOX — the number, in the ATS card's own display face, with a tiny ATS caption;
 * the colour is PP_ATS_NUMBER — the sketch's --atx (#A33200 in light, where the logo orange fails as text,
 * the orange in dark), the same value as the ATS card's number (PAIR_KICKER), so the two read as one. Click → the ATS card beside the posting (D39); OPEN is an outline. No score → the dashed box with the bars and NO digits — a board row's missing score is "not scored yet"
 * far more often than a decline (A52), so it says so, and the card it opens scores the posting fresh.
 * The number is provisional (D50): its title says so.
 */
export function AtsNumberBox({ score, open = false, onOpen }) {
  const has = ATS_NUMBER_SHOWN && Number.isFinite(score);
  return (
    <button type="button" className={`pp__ats${has ? "" : " pp__ats--none"}`} data-ats-box="" aria-expanded={open}
      onClick={() => onOpen?.()}
      title={has ? `ATS match ${Math.round(score)} — ${ATS_NUMBER_NOTE}` : "No ATS score yet — open the ATS card to score this posting"}
      aria-label={has ? `ATS match ${Math.round(score)}. ${ATS_NUMBER_NOTE}. Open the ATS card` : "No ATS score yet. Open the ATS card"}>
      {has
        ? (<><b>{Math.round(score)}</b><small>ATS</small></>)
        : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9m5 10V5m5 14v-7m5 7V8"/></svg>}
    </button>
  );
}

/**
 * ⭐ D48 · THE ACTIONS — A and B are ONE component with two renderings, chosen by the PANEL's width (a
 * container query on .pp, never the window's): A, labelled depth boxes at ≥ 600px of panel; B, 48px icon
 * squares with the day's quota as the Draft badge, a tooltip each, and a caption on touch. Pass · Save ·
 * Draft | Résumé · Cover letter — and, once a résumé exists, Preview · PDF beside it.
 */
function PostingActions({ job, meta, slots, onCoverLetter }) {
  const { g, done, st, canUseGenerate: canGen, onGenerate, onViewSandbox, onExport, onSave, onPass, onDraft, drafted, drafting } = meta;
  const selectedJob = job;
  const generateLoading = st === "generate";
  const canApply = !!(selectedJob.applyUrl || selectedJob.url);
  // A63: a NEW résumé uses a slot (a cached one does not, so Regenerate says so too).
  const noSlots = slots != null && slots.remaining <= 0;
  const hasArtifact = done && g?.html !== "__exists__";
  const resumeTitle = noSlots
    ? "No drafts left in the last 24 hours — a new résumé uses one, like a Draft."
    : `${done ? "Regenerate" : "Generate"} résumé — uses 1 of your ${slots?.limit ?? 10} drafts (a Draft uses one too)`;
  const quota = slots
    ? (noSlots
        ? `No drafts left — all ${slots.limit} used in the last 24 hours (a Draft or a new résumé uses one).`
        : `${slots.remaining} of ${slots.limit} drafts left in the last 24 hours — a Draft or a new résumé uses one.`)
    : null;
  return (
    <div className="pp__act" data-posting-actions="">
      {/* A — labelled boxes, when the panel is wide enough. */}
      <div className="pp__a" role="group" aria-label="Actions">
        {onPass && <PassButton passed={!!selectedJob.disliked} onPass={onPass} />}
        {onSave && <SaveButton saved={!!selectedJob.starred} onSave={onSave} />}
        {canApply && onDraft && <DraftButton drafted={!!drafted} drafting={!!drafting} onDraft={onDraft} />}
        <span className="pp__div" aria-hidden="true" />
        {canGen && onGenerate && (
          <DepthButton icon={ICONS.resume} onClick={() => onGenerate(done && g?.html !== "__exists__")} title={resumeTitle}
            disabled={!!st || noSlots}>
            {generateLoading ? "Generating…" : done ? "Regenerate" : "Résumé"}
          </DepthButton>
        )}
        {hasArtifact && <DepthButton icon={ICONS.preview} onClick={() => onViewSandbox?.()} title="View the résumé">Preview</DepthButton>}
        {hasArtifact && <DepthButton icon={ICONS.pdf} onClick={() => onExport?.()} title="Export PDF">PDF</DepthButton>}
        <DepthButton icon={ICONS.letter} onClick={onCoverLetter} title="Write a cover letter">Cover letter</DepthButton>
      </div>
      {/* B — icon squares, when the panel is condensed. */}
      <div className="pp__b" role="group" aria-label="Actions">
        {onPass && <PassButton square passed={!!selectedJob.disliked} onPass={onPass} />}
        {onSave && <SaveButton square saved={!!selectedJob.starred} onSave={onSave} />}
        {canApply && onDraft && <DraftButton square drafted={!!drafted} drafting={!!drafting} onDraft={onDraft}
          badge={slots ? slots.remaining : null} />}
        <span className="pp__div" aria-hidden="true" />
        {canGen && onGenerate && (
          <DepthButton size="square" icon={ICONS.resume} onClick={() => onGenerate(done && g?.html !== "__exists__")}
            title={resumeTitle} caption="Résumé" disabled={!!st || noSlots}>{done ? "Regenerate résumé" : "Generate résumé"}</DepthButton>
        )}
        {hasArtifact && <DepthButton size="square" icon={ICONS.preview} onClick={() => onViewSandbox?.()} title="View the résumé" caption="Preview">Preview</DepthButton>}
        {hasArtifact && <DepthButton size="square" icon={ICONS.pdf} onClick={() => onExport?.()} title="Export PDF" caption="PDF">PDF</DepthButton>}
        <DepthButton size="square" icon={ICONS.letter} onClick={onCoverLetter} title="Write a cover letter" caption="Letter">Cover letter</DepthButton>
      </div>
      {/* A63: the shared allowance, said before anything is pressed — a muted line in A, the badge in B. */}
      {quota && <p className="pp__quota" data-draft-slots data-empty={noSlots ? "true" : "false"}>{quota}</p>}
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
  // The score the header's box shows: this résumé's report, else the stored base report — never a guess.
  const g = selectedJobMeta?.g, job = selectedJob;
  const atsScore = g?.atsScore ?? job?.baseAtsScore ?? null;

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
                <CompanyIcon company={selectedJob.company} iconUrl={selectedJob.companyIconUrl} size={46} radius={12}/>
              </button>
              {/* ⭐ A63: APPLY IS THE COMPANY NAME — a link to the posting, opened in a new tab. */}
              {/* ⛔ D38: the card's treatment, at last — the ONE company link: the logo face, no underline,
                  no ↗, and a hit area that is the text alone (it was display:block, the whole line). */}
              <div className="pp__co"><CompanyLink company={selectedJob.company} href={postingUrl || null} size="panel" onOpen={openedPosting} /></div>
              <span className="pp__sp" />
              <AtsNumberBox score={atsScore}
                open={!!selectedJobMeta?.atsOpen} onOpen={() => selectedJobMeta?.onAts?.()} />
              <button type="button" className="pp__x" onClick={close} aria-label="Close panel" title="Close">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
              </button>
            </div>
            {(pendingState === "pending" || pendingState === "recorded") && (
              <button type="button" className="pp__pending" data-pending-tag onClick={() => navigate("/app/database?sheet=pending")}
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
