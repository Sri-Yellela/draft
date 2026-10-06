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
import { atsBandFor, atsBandLabel } from "../../../shared/atsBands.js";
import { bandChipStyle } from "../styles/bandStyle.js";
import { C } from "../styles/colorTokens.js";
import { DraftButton, PassButton, SaveButton } from "./DecisionButtons.jsx";

function ago(postedAt, scrapedAt) {
  let ms = postedAt ? new Date(postedAt).getTime() : NaN;
  if (isNaN(ms) || ms <= 0) {
    ms = scrapedAt != null ? Number(scrapedAt) * 1000 : NaN;
  }
  if (isNaN(ms) || ms <= 0) return "—";
  const d = Date.now() - ms;
  if (d < 0) return "—";
  if (d < 3600000)  return `${Math.floor(d / 60000)}m`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h`;
  return `${Math.floor(d / 86400000)}d`;
}

function WorkBadge({ t }) {
  const map = { Remote:{ bg:C.INFO_QUIET, fg:C.INFO }, Hybrid:{ bg:C.INFO_QUIET, fg:C.INFO } };
  const s = map[t] || null;
  if (s) return <span style={{ background:s.bg, color:s.fg, padding:"2px 8px", borderRadius:999, fontSize:10, fontWeight:700 }}>{t}</span>;
  return <span style={{ background:"var(--color-surface-offset)", color:"var(--color-text-muted)", padding:"2px 8px", borderRadius:999, fontSize:10, fontWeight:700 }}>{t || "Onsite"}</span>;
}


// ── FE-1 chips (visa badge, NEW pill, skill chips) — matches JobCard.jsx's styling ──
function VisaBadge({ isH1bSponsor, requiresWorkAuth }) {
  if (isH1bSponsor === 1 || isH1bSponsor === true) {
    return (
      <span style={{ background:C.SUCCESS_QUIET, color:C.SUCCESS, padding:"2px 8px",
                     borderRadius:999, fontSize:10, fontWeight:700, whiteSpace:"nowrap" }}>
        Sponsors H-1B
      </span>
    );
  }
  if (requiresWorkAuth === 1 || requiresWorkAuth === true) {
    return (
      <span style={{ background:"var(--color-surface-offset)", color:"var(--color-text-muted)",
                     padding:"2px 8px", borderRadius:999, fontSize:10, fontWeight:700, whiteSpace:"nowrap" }}>
        US work auth req.
      </span>
    );
  }
  return null;
}

function isNewJob(discoveredAt) {
  if (!discoveredAt) return false;
  const ms = Number(discoveredAt) * 1000;
  return Number.isFinite(ms) && Date.now() - ms < 24 * 3600 * 1000;
}

function NewPill() {
  return (
    <span style={{ fontSize:9, fontWeight:800, color:C.SUCCESS, background:C.SUCCESS_QUIET,
                   padding:"1px 6px", borderRadius:999, whiteSpace:"nowrap", letterSpacing:"0.03em" }}>
      NEW
    </span>
  );
}

function SkillChips({ skills, max = 5 }) {
  if (!skills?.length) return null;
  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:12 }}>
      {skills.slice(0, max).map((s, i) => (
        <span key={i} style={{ fontSize:10, color:"var(--color-text-muted)",
                                background:"var(--color-surface-offset)", padding:"2px 7px",
                                borderRadius:4, border:"1px solid var(--border-glass)" }}>
          {s}
        </span>
      ))}
    </div>
  );
}

function ActionBtn({ onClick, title, children, accent = C.INFO, active, disabled = false }) {
  const [hov, setHov] = useState(false);
  return (
    <button title={title} onClick={disabled ? undefined : onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display:"flex", alignItems:"center", gap:5, minHeight:32, fontFamily:"inherit",
        padding:"6px 12px", borderRadius:999, border:`1px solid ${active || hov ? accent : "var(--color-border)"}`,
        background: active
          ? `color-mix(in srgb, ${accent} 13%, transparent)`
          : hov
            ? `color-mix(in srgb, ${accent} 7%, transparent)`
            : "transparent",
        color: active || hov ? accent : "var(--color-text-muted)",
        cursor: disabled ? "not-allowed" : "pointer", fontSize:12, fontWeight:700,
        opacity: disabled ? 0.55 : 1,
        transition:"all 0.15s", flexShrink:0,
      }}>
      {children}
    </button>
  );
}

// Layout props (slot, width, focused, fullScreen, resizeMode and the three resize callbacks) come
// from usePanelHost via JobsPanel — this panel is one peer in an ordered set now, not the only
// drawer, and its width is allocated from the dock's budget rather than owned here. Escape
// handling, focus-on-open, the overlay surface, the scrim, the animation and the two pinned regions
// all live in PanelShell, which is shared with the PDF and ATS panels.
export default function JobDetailPanel({
  slot = 0, width, focused = true, fullScreen = false, resizeMode = "dock", closesOnEscape,
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

  return (
    <PanelShell
      panelId="jd"
      slot={slot} width={width} focused={focused} fullScreen={fullScreen} closesOnEscape={closesOnEscape}
      resizeMode={resizeMode}
      onClose={close} onFocus={onFocus}
      onResizeStart={onResizeStart} onResize={onResize} onResizeEnd={onResizeEnd}
      header={
        <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
              {/* The KB profile moved to the logo: the company NAME is now the apply link (A63). */}
              <button type="button" onClick={() => setShowCompanyView(true)} title={`View ${selectedJob.company}'s KB profile`}
                aria-label={`View ${selectedJob.company}'s KB profile`}
                style={{ background:"none", border:"none", padding:0, cursor:"pointer", flexShrink:0 }}>
                <CompanyIcon company={selectedJob.company} iconUrl={selectedJob.companyIconUrl} size={44} radius={8}/>
              </button>
              <div style={{ flex:1, minWidth:0 }}>
                {/* ⭐ A63: APPLY IS THE COMPANY NAME — a link to the posting, opened in a new tab. */}
                {/* ⛔ D38: the card's treatment, at last — the ONE company link: the logo face, no underline,
                    no ↗, and a hit area that is the text alone (it was display:block, the whole line). */}
                <div><CompanyLink company={selectedJob.company} href={postingUrl || null} size="panel" onOpen={openedPosting} /></div>
                {/* The shared element (lib/viewTransitions.js): the deck card's title lands here. */}
                <div data-vt-title={selectedJob.id} style={{ fontSize:12, color:"var(--color-text-muted)", marginTop:2,
                              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {selectedJob.title}
                </div>
                {(() => {
                  const job = selectedJob;
                  const hasSalary = job.salaryMin != null || job.salaryMax != null;
                  const salaryStr = hasSalary
                    ? [job.salaryMin, job.salaryMax].filter(Boolean)
                        .map(v => `${job.salaryCurrency || "$"}${(v/1000).toFixed(0)}k`).join("–")
                    : null;
                  const yoeStr = job.expRaw
                    ? job.expRaw
                    : job.minYearsExp != null
                      ? (job.maxYearsExp != null ? `${job.minYearsExp}–${job.maxYearsExp}y` : `${job.minYearsExp}y+`)
                      : null;
                  const g = selectedJobMeta?.g;
                  const atsScore = g?.atsScore ?? job?.baseAtsScore ?? null;
                  // Band, not number — cutpoints and copy from shared/atsBands.js. This was the
                  // third of five copies of the same >=80/>=60 ramp, all of which painted the whole
                  // board red under v4 (median 27, max 64).
                  const atsBand = atsBandFor(atsScore);
                  const atsMeta = atsBandLabel(atsBand);
                  // ⛔ A52 · NO SCORE IS NOT A VERDICT. This chip printed "No signal" for a null score,
                  // and on the board null means "no current stored score" far more often than "the
                  // scorer declined" — so the header read "No signal" while the ATS panel beside it,
                  // scoring the posting fresh, read "Strong match". Same rule as JobCard's AtsSlot: a
                  // score is a band chip; no score is the neutral "Check match" way in, and a decline
                  // is shown where the scorer ran — the report.
                  const atsShown = atsScore != null;
                  const done = selectedJobMeta?.done;
                  const st = selectedJobMeta?.st;
                  return (
                    <div style={{ display:"flex", alignItems:"center", flexWrap:"wrap", gap:5, marginTop:5 }}>
                      <WorkBadge t={job.workType}/>
                      {isNewJob(job.discoveredAt) && <NewPill/>}
                      <VisaBadge isH1bSponsor={job.isH1bSponsor} requiresWorkAuth={job.requiresWorkAuth}/>
                      {job.location && <span style={{ fontSize:10, color:"var(--color-text-faint)" }}>{job.location}</span>}
                      {yoeStr && <span style={{ fontSize:10, color:"var(--color-text-faint)" }}>{yoeStr} exp</span>}
                      {salaryStr && <span style={{ fontSize:10, color:C.SUCCESS, fontWeight:700 }}>{salaryStr}</span>}
                      {!salaryStr && job.compensation && <span style={{ fontSize:10, color:C.SUCCESS, fontWeight:700 }}>{job.compensation}</span>}
                      <span style={{ fontSize:10, color:C.SUCCESS, fontWeight:600 }}>{ago(job.postedAt, job.scrapedAt)}</span>
                      {atsShown ? <span onClick={() => selectedJobMeta?.onAts?.()} title={atsMeta.blurb}
                        style={{ ...bandChipStyle(atsBand), padding:"2px 8px", borderRadius:999,
                                  fontSize:10, fontWeight:700, cursor:"pointer" }}>
                        {atsMeta.short}
                      </span> : <span onClick={() => selectedJobMeta?.onAts?.()}
                        title="Score this job against your resume and see which terms match"
                        style={{ background:"transparent", color:"var(--color-text-muted)", padding:"2px 8px",
                                  borderRadius:999, fontSize:10, fontWeight:600, cursor:"pointer",
                                  border:"1px dashed var(--color-border)" }}>
                        Check match
                      </span>}
                      {(pendingState === "pending" || pendingState === "recorded") && (
                        <span data-pending-tag onClick={() => navigate("/app/database?sheet=pending")}
                          title="You may have applied — record when and how, and it moves to Submitted once it verifies."
                          style={{ background:C.WARNING_QUIET, color:C.WARNING, padding:"2px 8px", borderRadius:999,
                                   fontSize:10, fontWeight:700, cursor:"pointer" }}>
                          {pendingState === "recorded" ? "Pending · not verified" : "Pending · record it"}
                        </span>
                      )}
                      {done && (
                        <span onClick={() => selectedJobMeta?.onResume?.()} style={{ background:C.INFO_QUIET, color:C.INFO,
                          padding:"2px 8px", borderRadius:999, fontSize:10, fontWeight:700, cursor:"pointer" }}>
                          {st==="loading" ? "⏳" : "📄"} Resume
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
        </div>
      }
      actions={selectedJobMeta ? (() => {
              const { g, done, st, canUseGenerate: canGen, onGenerate, onViewSandbox, onExport,
                      onSave, onPass, onDraft, drafted, drafting } = selectedJobMeta;
              // Same orphan as the one removed from JobCard: this action bar has no dedicated A+
              // button, so the `aPlusLoading` flag beside this one was computed and never read.
              // A+ is still a live tool — JobsPanel selects it by apply_mode/plan tier — it just
              // has no button of its own here, and `disabled={!!st}` below already covers the
              // in-flight state for whichever tool is running.
              const generateLoading = st === "generate";
              const canApply = !!(selectedJob.applyUrl || selectedJob.url);
              // A63: a NEW résumé uses a slot (a cached one does not, so Regenerate says so too).
              const noSlots = slots != null && slots.remaining <= 0;
              return (
                <>
                  {/* ── DECIDE: the deck's three, in the deck's order and treatment (A53) ─────────
                      Pass · Save · Draft — the same calls as Today (lib/jobDecisions.js). "Queue
                      Auto" was the old name for Draft, and Save and Pass used to TOGGLE; they SET
                      now, and Undo is the toast. */}
                  <div role="group" aria-label="Decide" style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
                    {onPass && <PassButton passed={!!selectedJob.disliked} onPass={onPass} />}
                    {onSave && <SaveButton saved={!!selectedJob.starred} onSave={onSave} />}
                    {canApply && onDraft && <DraftButton drafted={!!drafted} drafting={!!drafting} onDraft={onDraft} />}
                  </div>
                  {/* ── WORK ON IT YOURSELF: the board's tools, which the deck does not carry ─────
                      Kept on the board (owner question in A53's report): a Draft generates the
                      tailored résumé and cover letter at approval, so these are the manual path. */}
                  <span aria-hidden style={{ width:1, alignSelf:"stretch", background:"var(--border-glass)", margin:"0 4px" }}/>
                  <div role="group" aria-label="Tools" style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
                    {canGen && onGenerate && (
                      <ActionBtn onClick={() => onGenerate(done && g?.html !== "__exists__")}
                        title={noSlots
                          ? "No drafts left in the last 24 hours — a new résumé uses one, like a Draft."
                          : `${done ? "Regenerate" : "Generate"} résumé — uses 1 of your ${slots?.limit ?? 10} drafts (a Draft uses one too)`}
                        accent="var(--color-primary-text)" disabled={!!st || noSlots}>
                        {generateLoading ? "Generating…" : done ? "Regenerate" : "Generate résumé"}
                      </ActionBtn>
                    )}
                    {done && g?.html !== "__exists__" && (
                      <ActionBtn onClick={() => onViewSandbox?.()} title="View in sandbox" accent={C.INFO}>
                        Preview
                      </ActionBtn>
                    )}
                    {done && g?.html !== "__exists__" && (
                      <ActionBtn onClick={() => onExport?.()} title="Export PDF" accent={C.SUCCESS}>
                        PDF
                      </ActionBtn>
                    )}
                    <ActionBtn onClick={() => setShowCoverLetter(true)} title="Write a cover letter" accent={C.VIOLET}>
                      Cover letter
                    </ActionBtn>
                  </div>
                  {/* A63: the shared allowance, said before anything is pressed. */}
                  {slots && (
                    <span data-draft-slots style={{ fontSize:11, color: noSlots ? C.DANGER : "var(--color-text-muted)",
                                                    width:"100%", marginTop:2 }}>
                      {noSlots
                        ? `No drafts left — all ${slots.limit} used in the last 24 hours (a Draft or a new résumé uses one).`
                        : `${slots.remaining} of ${slots.limit} drafts left in the last 24 hours — a Draft or a new résumé uses one.`}
                    </span>
                  )}
                </>
              );
            })() : null}
    >
      {/* ── BODY (the only scrolling region) ───────────────────────────────────────────────────
          The modals below render through their own portals, so their position here is immaterial;
          the apply toast and the automation banner are inline and stay directly above the
          description, which is what they annotate. */}
      <div style={{ display:"flex", flexDirection:"column", minHeight:"100%" }}>

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
              <SkillChips skills={selectedJob.skills}/>
              {/* Y2B — four outcomes, each said plainly. The previous version had one fallback
                  sentence, "No description available.", which was shown for a posting the source
                  never described, for a fetch still in flight, and for a fetch that failed. Three
                  different facts, one of them about us rather than the posting. */}
              {/* D32 · the posting half of the ink pair: the masthead (kicker · title · company · the deck
                  strip, "not stated" where a fact is not on file), then the employer's own description,
                  formatted plainly. What shows when there is no text is the panel's fallback. */}
              <PostingPanel job={selectedJob} text={description}>
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
