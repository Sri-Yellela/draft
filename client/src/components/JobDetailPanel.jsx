import { ATSPanel } from "./ATSPanel.jsx";
import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import PostingPanel from "./PostingPanel.jsx";
import WarmPathsBlock from "./WarmPathsBlock.jsx";
import { api } from "../lib/api.js";
import { useJobBoard } from "../contexts/JobBoardContext.jsx";
import CoverLetterModal from "./CoverLetterModal.jsx";
import CompanyViewModal from "./CompanyViewModal.jsx";
import PanelShell from "./PanelShell.jsx";
import CompanyLink from "./CompanyLink.jsx";
import { companyPath } from "../lib/companySlug.js";   // A157
import CompanyLogo from "./CompanyLogo.jsx";
import { StampLogo } from "./StampLogo.jsx";
import { AtsNumberBox } from "./AtsNumberBox.jsx";
import ResumeList, { RESUME_ICONS } from "./ResumeList.jsx";
import { atsScorePair } from "../../../shared/resumeScores.js";
import "./JobDetailPanel.css";
import { draftButtonState, resumeControlState } from "../lib/jobDecisions.js";
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
// ⭐ D147: the button reads "I applied myself" (it was "I submitted it") and lives under More; its behaviour is unchanged.
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
      {!open && <button type="button" className="pp__btn pp__submitted-btn" onClick={() => setOpen(true)}>I applied myself</button>}
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

// Exported for test/d164ResumeControls.test.js (rendered alone); `openResume` opens the Résumé group at first render.
export function PostingActions({ job, meta, slots, onCoverLetter, openResume = false }) {
  const { g, done, st, canUseGenerate: canGen, onGenerate, onViewSandbox, onExport, onExportHtml = null, onRegenerate = null, onSave, onPass, onDraft, drafted, drafting,
          draftBlock = null, onViewDraft = null, onExplainDraft = null, companyNotice = null, eligibilityNotice = null,
          genError = null, resumeSources = [], resumeSourceId = null } = meta;
  // D51: the panel knows the slots too — out of drafts is a reason on the button, not a grey box.
  const block = draftBlock || (slots != null && slots.remaining <= 0 ? { code: "out_of_drafts", label: "Out of drafts",
    reason: `Out of drafts — all ${slots.limit} used in the last 24 hours (a Draft or a new résumé uses one).` } : null);
  const selectedJob = job;
  const passed = !!selectedJob.disliked, saved = !!selectedJob.starred;
  const draft = draftButtonState({ drafted: !!drafted, drafting: !!drafting, block, canView: !!onViewDraft, slots });
  const draftClick = draft.action === "draft" ? onDraft : draft.action === "view" ? onViewDraft
    : draft.action === "explain" ? () => onExplainDraft?.(draft.title) : undefined;
  const generateLoading = st === "generate";
  const canApply = !!(selectedJob.applyUrl || selectedJob.url);
  // A63: a NEW résumé uses a slot (a cached one does not, so Regenerate says so too).
  const noSlots = slots != null && slots.remaining <= 0;
  // D57: a résumé stored on an earlier visit (`__exists__`) is just as viewable — the panel fetches it.
  const hasArtifact = done && !!g?.html;
  const ago = hasArtifact ? resumeAgo(g?.generatedAt) : null;
  // ⭐ D164 · WHICH RÉSUMÉ — the job profile whose base résumé is tailored, chosen for THIS posting (the board's active
  // profile by default); every generate and regenerate from here carries it (JobsPanel generateFrom).
  const [sourceId, setSourceId] = useState(resumeSourceId);
  useEffect(() => { setSourceId(resumeSourceId); }, [job?.jobId, resumeSourceId]);
  const genOpts = sourceId != null ? { profileId: sourceId } : undefined;
  const runGenerate = () => onGenerate(false, genOpts);
  const regen = onRegenerate ? () => onRegenerate(genOpts) : () => onGenerate(true, genOpts);
  // ⭐ D164 · the résumé's state in words — Generating… · Ready · Failed — Try again (lib/jobDecisions.js).
  const resState = resumeControlState({ hasArtifact, generating: generateLoading, error: genError, ago });
  const retry = hasArtifact ? regen : runGenerate;
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
  // ⭐ D164 (owner 11-05): Résumé and More each open IN PLACE, one posting at a time. Résumé opens by itself while a résumé
  // is being made or has just failed, so the progress and the retry show; More keeps the cover letter and "I applied myself".
  const [res, setRes] = useState(openResume);
  const [more, setMore] = useState(false);
  useEffect(() => { setRes(false); setMore(false); }, [job?.jobId]);
  useEffect(() => { if (generateLoading || genError) setRes(true); }, [generateLoading, genError]);
  const resId = `pp-res-${job?.jobId ?? "x"}`;
  const moreId = `pp-more-${job?.jobId ?? "x"}`;
  const quota = slots
    ? (noSlots
        ? `You've used your drafts for now — the next one frees up ${freeAt ? `at ${freeAt}` : "within 24 hours"}.`
        : `${slots.remaining} of ${slots.limit} drafts left in the last 24 hours — a Draft or a new résumé uses one.`)
    : null;
  const activeSource = resumeSources.find(s => String(s.id) === String(sourceId)) || null;
  // ⭐ D147 (owner 11-03) · PASS · SAVE · DRAFT · MORE — ⭐ D164 (owner 11-05) · … · RÉSUMÉ · MORE. D147 folded the five
  // icon squares under More, and the résumé went with them: its controls were reachable only behind a word that says
  // nothing about a résumé (docs/D164_ACTIONS.md). The primary Draft stays the one loud button; Résumé is ONE quiet
  // control beside it that opens, in place: Which résumé · Résumé for this job (generate without drafting) / Regenerate ·
  // Preview / edit (panels/SandboxPanel.jsx) · What we changed (D90) · Download PDF · Download HTML. ✉ is the COVER LETTER
  // (measured in the code: ICONS.letter, onCoverLetter; there is no "email it to me" feature) — it and "I applied myself"
  // stay under More. Each keeps its behaviour under its label.
  return (
    <div className="pp__act" data-posting-actions="">
      {/* ⭐ D149 (fullhouse-declutter.html `.ua`): the sketch's plain buttons — Pass · Save on the raised grey, Draft the
          /draft mark, Résumé and More quiet — no glyphs. The same states and calls as DecisionButtons' (Pass and Save SET:
          a decided one says so and is disabled; Draft is draftButtonState's, D51: never a dead end). */}
      <div className="pp__main-acts" role="group" aria-label="Actions" data-d147-actions="">
        {onPass && (
          <button type="button" className="pp__btn" data-decision="pass" disabled={passed} aria-pressed={passed} onClick={onPass}
            title={passed ? "Passed — it won't come back. Undo on the toast to reverse it" : "Pass — it won't come back"}>
            {passed ? "Passed" : "Pass"}
          </button>
        )}
        {onSave && (
          <button type="button" className="pp__btn" data-decision="save" disabled={saved} aria-pressed={saved} onClick={onSave}
            title={saved ? "Saved — to reverse it, Undo on the toast, or Remove it from Saved in Database" : "Save for later"}>
            {saved ? "Saved" : "Save"}
          </button>
        )}
        {/* ⭐ D149 (owner 11-04, "/draft logo"): Draft is the owner's 10-07 logo button again, not the sketch's plain
            word on the accent — at rest the button IS the /draft mark (the one StampLogo, in the mark's own tokens), on
            the raised grey like Pass and Save, never on the accent fill where the slash would vanish; the word comes back
            only for the states (Drafting… · Drafted · out of drafts). Named by its sentence, not "/draft". */}
        {canApply && onDraft && (
          <button type="button" className="pp__btn pp__btn--logo" data-decision="draft" data-draft-state={draft.kind}
            data-draft-logo="" disabled={draft.disabled} aria-disabled={draft.ariaDisabled || undefined} aria-pressed={!!drafted}
            aria-label={draft.kind === "idle" ? "Draft" : undefined} title={draft.title} onClick={draftClick}>
            {draft.kind === "idle" ? <StampLogo size="mini" /> : draft.label}
          </button>
        )}
        <button type="button" className="pp__moreb pp__resb" aria-expanded={res} aria-controls={resId} data-posting-resume-toggle=""
          data-resume-state={resState.kind} onClick={() => setRes(r => !r)}
          title="Your résumé for this job — generate it without drafting, choose which résumé, preview, download">Résumé</button>
        <button type="button" className="pp__moreb" aria-expanded={more} aria-controls={moreId} data-posting-more-toggle=""
          onClick={() => setMore(m => !m)}>More</button>
      </div>
      {res && (
        <div className="pp__more pp__res" id={resId} role="group" aria-label="Résumé for this job" data-posting-resume="">
          {/* Which résumé: each job profile's base résumé; one profile is said, not offered as a choice of one. */}
          {resumeSources.length > 1 ? (
            <label className="pp__src" data-resume-source="">
              <span className="pp__srcl">Which résumé</span>
              <select className="pp__srcs" value={sourceId ?? ""} disabled={!!st} onChange={(e) => setSourceId(e.target.value)}>
                {resumeSources.map(s => (
                  <option key={s.id} value={s.id}>{`${s.name} — base résumé${s.active ? " (this board's)" : ""}`}</option>
                ))}
              </select>
            </label>
          ) : activeSource ? (
            <p className="pp__quota" data-resume-source="">Tailored from the base résumé of {activeSource.name}.</p>
          ) : null}
          {canGen && onGenerate && !hasArtifact && byom.available && split(false, "Résumé for this job", runGenerate)}
          {canGen && onGenerate && !hasArtifact && !byom.available && (
            <button type="button" className="pp__btn" onClick={runGenerate} title={resumeTitle}
              disabled={!!st || noSlots} data-more="resume">
              {generateLoading ? "Generating…" : genError ? "Try again" : "Résumé for this job"}
            </button>
          )}
          {hasArtifact && <button type="button" className="pp__btn" onClick={() => onViewSandbox?.()} title="Preview and edit the résumé" data-more="view">Preview / edit</button>}
          {hasArtifact && <span className="pp__changed" data-more="changes"><WhatWeChangedLink jobId={job?.jobId} jobLabel={[job?.title, job?.company].filter(Boolean).join(" · ")} /></span>}
          {hasArtifact && canGen && onGenerate && byom.available && split(false, "Regenerate", regen)}
          {hasArtifact && canGen && onGenerate && !byom.available && (
            <button type="button" className="pp__btn" onClick={regen} title={resumeTitle} disabled={!!st || noSlots} data-more="regenerate">
              {generateLoading ? "Generating…" : "Regenerate"}
            </button>
          )}
          {hasArtifact && <button type="button" className="pp__btn" onClick={() => onExport?.()} title="Download the résumé as a PDF" data-more="download">Download PDF</button>}
          {hasArtifact && onExportHtml && <button type="button" className="pp__btn" onClick={() => onExportHtml()} title="Download the résumé as an HTML file" data-more="download-html">Download HTML</button>}
          {/* ⭐ D70 Phase 3: the cost, in words, before Generate / Regenerate is pressed. */}
          {canGen && onGenerate && !noSlots && <p className="pp__quota" data-generate-expect="">Takes about 10–20 seconds.</p>}
          {!canGen && <p className="pp__quota" data-generate-plan="">Generating a résumé is not on your plan — Preview and Download work on one you already have.</p>}
        </div>
      )}
      {more && (
        <div className="pp__more" id={moreId} role="group" aria-label="More actions" data-posting-more="">
          <button type="button" className="pp__btn" onClick={onCoverLetter} title="Write a cover letter" data-more="cover-letter">Cover letter</button>
          {/* ⭐ D56 / A105 finding 3: the manual route records its own submission, on every posting. */}
          {job?.jobId && <ManualSubmitted jobId={job.jobId} />}
          {/* A63: the shared allowance — D149: under More (the sketch's row carries no line beneath it); Draft's title
              and an out-of-drafts Draft's own label still say it before a press. */}
          {quota && <p className="pp__quota" data-draft-slots data-empty={noSlots ? "true" : "false"}>{quota}</p>}
        </div>
      )}
      {/* ⭐ D57: the state, in words — "Résumé ready · 2h ago". ⭐ D164: and Generating… / Failed — Try again, said under the
          row whether Résumé is open or not; a failure carries its sentence and a retry, never reads as "no résumé". */}
      {/* ⭐ D90 P2: beside the state, the way into "What we changed" — the tailored résumé against the one it was made from. */}
      {resState.kind === "ready" && <p className="pp__ready" data-resume-ready="" data-resume-state="ready"><span className="mark mark--ok">{ago ? `Résumé ready · ${ago}` : "Résumé ready"}</span>{!res && <> · <WhatWeChangedLink jobId={job?.jobId} jobLabel={[job?.title, job?.company].filter(Boolean).join(" · ")} /></>}</p>}
      {resState.kind === "generating" && <p className="pp__ready pp__ready--busy" data-resume-state="generating" role="status"><span className="mark mark--info">Résumé · Generating…</span></p>}
      {resState.kind === "failed" && (
        <p className="pp__ready pp__ready--failed" data-resume-state="failed" role="alert">
          <span className="mark mark--no">Résumé · Failed —</span>{" "}
          <button type="button" className="pp__retry" onClick={retry} disabled={!!st || noSlots} data-resume-retry="">Try again</button>
          <span className="pp__faildetail"> {resState.detail}</span>
        </p>
      )}
      {/* ⭐ D86: Open → Waiting for your résumé… → Checks → Done, updating itself while the user is in the chat. */}
      <ByomStatus byom={byom} onView={() => onViewSandbox?.()} onDownload={() => onExport?.()} />
      {/* A63: out of drafts is said under the row even with More folded (the allowance itself is under More). */}
      {quota && noSlots && !more && <p className="pp__quota" data-draft-slots data-empty="true">{quota}</p>}
      {/* ⭐ D54: never silent, never a block — the user's other roles at this company, before Draft. */}
      {companyNotice && <p className="pp__quota" data-company-notice="">{companyNotice.replace(" Draft this one too?", "")}</p>}
      {/* ⛔ D59: what the POSTING requires, and whether the profile STATES an answer — never a block, and
          never a verdict on the user's eligibility (D36: the resolver is exact-or-blank). */}
      {eligibilityNotice && <p className="pp__quota" data-eligibility-notice="">{eligibilityNotice}</p>}
    </div>
  );
}

export default function JobDetailPanel({
  slot = 0, width, focused = true, fullScreen = false, resizeMode = "dock", closesOnEscape, reserveRight = 0, beside = false,
  // ⭐ D156 (1c): drawn ON THE DECK, in the front card's place (JobsPanel portals it into DeckView's slot) — the card's own
  // corner (26) and "Fold it back" for Close (home-sketch.html's .foldb): the card folds back, nothing closes.
  onDeck = false,
  // ⭐ D168: the posting to draw when it is not (or no longer) the selection — JobsPanel's deckPostJob, which holds the
  // outgoing posting on the deck for the fade-out of the swap (lib/jobUrl.js POST_FADE_MS). Omitted: the selection.
  job: jobOverride,
  onFocus, onResizeStart, onResize, onResizeEnd,
}) {
  const board = useJobBoard();
  const { setSelectedJob } = board;
  const selectedJob = jobOverride !== undefined ? jobOverride : board.selectedJob;
  // The meta (the generated résumé, the résumé text) belongs to the selection; a posting fading out after it keeps the
  // last meta it had, so its content (and so the swap's measured start) does not change under the fade.
  const lastMeta = useRef({ jobId: null, meta: null });
  const metaIsOurs = jobOverride === undefined || String(jobOverride?.jobId) === String(board.selectedJob?.jobId);
  if (metaIsOurs && board.selectedJobMeta) lastMeta.current = { jobId: String(selectedJob?.jobId), meta: board.selectedJobMeta };
  const selectedJobMeta = metaIsOurs ? board.selectedJobMeta
    : (lastMeta.current.jobId === String(selectedJob?.jobId) ? lastMeta.current.meta : null);
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

  // ⭐ D152 (8): the match in the posting — open / folded, and mounted from its first open (a new posting starts folded). Above the
  // early return — hooks run on every render.
  const [matchOpen, setMatchOpen] = useState(false);
  const [matchMounted, setMatchMounted] = useState(false);
  useEffect(() => { setMatchOpen(false); setMatchMounted(false); }, [selectedJob?.jobId]);
  // ⭐ D152 (8) (b): every other opener of the match — the deck's report, a generated résumé, the reuse flow, the phone's
  // ATS button — asks the board to open it HERE (selectedJobMeta.matchAsk, a counter per request) instead of the old
  // ATS panel drawn over the page (AtsReportPanel, deleted). Each ask is acted on once, and only for its own posting.
  const matchAsk = selectedJobMeta?.matchAsk || null;
  const [askDone, setAskDone] = useState(0);
  useEffect(() => {
    if (!matchAsk || matchAsk.n === askDone || !selectedJob) return;
    if (matchAsk.jobId && String(matchAsk.jobId) !== String(selectedJob.jobId)) return;
    setAskDone(matchAsk.n);
    setMatchMounted(true);
    setMatchOpen(true);
  }, [matchAsk?.n, matchAsk?.jobId, selectedJob?.jobId]); // eslint-disable-line react-hooks/exhaustive-deps
  // ⭐ D152 (8) · HISTORY = THIS JOB'S RÉSUMÉ VERSIONS (D62's, moved here from the retired ATS panel), newest first —
  // fetched when the match is first opened, and again after a résumé is generated (genCount).
  const [versions, setVersions] = useState(null);
  const versionsJobId = matchMounted ? jobId : null;
  const genCount = selectedJobMeta?.genCount ?? 0;
  useEffect(() => {
    if (!versionsJobId) { setVersions(null); return undefined; }
    let live = true;
    setVersions(null);
    api(`/api/resumes/${encodeURIComponent(versionsJobId)}/versions`)
      .then(rows => { if (live) setVersions(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (live) setVersions([]); });
    return () => { live = false; };
  }, [versionsJobId, genCount]);
  if (!selectedJob) return null;
  const versionRows = (versions || []).map(v => ({
    key: `${v.job_id}-${v.version}`,
    title: `Version ${v.version}`,
    meta: [v.created_at ? new Date(v.created_at * 1000).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : null,
           Number.isFinite(v.base_ats_score) ? `base ${Math.round(v.base_ats_score)}` : null].filter(Boolean).join(" · "),
    score: Number.isFinite(v.ats_score) ? v.ats_score : null,
    actions: [
      { id: "view", label: `View version ${v.version}`, icon: RESUME_ICONS.view, onClick: () => selectedJobMeta?.onOpenVersion?.(v) },
      { id: "download", label: `Download version ${v.version} as PDF`, icon: RESUME_ICONS.download, onClick: () => selectedJobMeta?.onExportVersion?.(v) },
    ],
  }));
  const matchHistory = (
    <ResumeList loading={versions === null} rows={versionRows} empty="No résumé generated for this job yet — generate one from this posting." />
  );
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
      // ⭐ D149: the sketch's `.panel` — the card, corner 28 (0 on a phone, full screen), no glass edge; beside the list
      // it fills BesideDock's column.
      surfaceClass="pp-shell" radius={onDeck ? 26 : 28} fill={beside}
      // ⭐ D168: on the deck the posting is read by scrolling the PAGE — its body is not a scroll container of its own.
      bodyScrolls={!onDeck}
    >
      {/* ── BODY (the only scrolling region) ───────────────────────────────────────────────────
          The modals below render through their own portals, so their position here is immaterial;
          the apply toast and the automation banner are inline and stay directly above the
          description, which is what they annotate. */}
      <div className="pp" data-jd-panel="" data-full-screen={fullScreen ? "true" : undefined} style={{ display:"flex", flexDirection:"column", minHeight:"100%" }}>

            {/* ⭐ D147 (owner 11-03, fullhouse-declutter.html) · THE HEADER: the company bubble (press = the company's
                hiring data — CompanyViewModal: the stack, the teams hiring, the hiring signal, the sponsorship filings; the
                behaviour it always had) · the company name = the original posting (A63 / D38's ONE CompanyLink, unchanged)
                with the location under it · a small Close at the top right. The match box moved to the facts box's end. */}
            <div className="pp__hd" data-posting-header="">
              <button type="button" className="pp__logo" onClick={() => (companyPath(selectedJob.company, { job: jobId }) ? navigate(companyPath(selectedJob.company, { job: jobId })) : setShowCompanyView(true))} title={`Hiring at ${selectedJob.company}`}
                aria-label={`Hiring at ${selectedJob.company}`} data-company-hiring="">
                <CompanyLogo company={selectedJob.company} iconUrl={selectedJob.companyIconUrl} size={36} radius={11}/>
              </button>
              <div className="pp__who">
                {/* ⭐ A157 (owner 11-09): the name opens the company's page — this job first there, with its Apply link. */}
                <div className="pp__co"><CompanyLink company={selectedJob.company} jobId={jobId} size="panel" /></div>
                {selectedJob.location && <span className="pp__loc" data-posting-location="">{selectedJob.location}</span>}
              </div>
              <span className="pp__sp" />
              <button type="button" className="pp__x" onClick={close} aria-label={onDeck ? "Fold the posting back into its card" : "Close the posting"}
                title={onDeck ? "Fold it back (Esc)" : "Close"} data-posting-close="">{onDeck ? "Fold it back" : "Close"}</button>
            </div>
            {(pendingState === "pending" || pendingState === "recorded") && (
              <button type="button" className="pp__pending" data-pending-tag onClick={() => navigate({ pathname: "/app/auto-apply", search: "?sheet=pending" })}
                title="You may have applied — record when and how, and it moves to Submitted once it verifies.">
                {pendingState === "recorded" ? "Pending · not verified" : "Pending · record it"}
              </button>
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
            <div className="pp__body">
              {/* Y2B — four outcomes, each said plainly. The previous version had one fallback
                  sentence, "No description available.", which was shown for a posting the source
                  never described, for a fetch still in flight, and for a fetch that failed. Three
                  different facts, one of them about us rather than the posting. */}
              {/* D32 · the posting half of the ink pair: the masthead (kicker · title · company · the deck
                  strip, "not stated" where a fact is not on file), then the employer's own description,
                  formatted plainly. What shows when there is no text is the panel's fallback. */}
              {/* ⭐ D138: who the user knows at this company, from their own contacts — beside the pair, not in it. */}
              {/* ⭐ D147: the role · the facts box with the match box at its end · the posting — nothing between. */}
              {/* ⭐ D152 (8): pressing the match box opens the match IN the posting (option A), pressing it again folds it;
                  the content is the one report loader (ATSPanel — its fetch, cache and claims), mounted on first open. */}
              <PostingPanel job={selectedJob} text={description} vtTitle={selectedJob.id} layout="panel"
                // Its height grows and folds by CSS alone (JobDetailPanel.css .pp__matchrow: grid-template-rows 0fr → 1fr,
                // ≤ 350 ms; reduced motion: instant), pushing the posting down — no overlay, no blur; folded, it is inert.
                matchPanel={matchMounted ? (
                  <div className="pp__matchrow" data-posting-match-row="" data-open={matchOpen ? "true" : "false"}
                    {...(matchOpen ? null : { inert: "", "aria-hidden": "true" })}>
                    <div className="pp__matchin" id="posting-match">
                      <section className="pp__matchcard" aria-label="Your résumé against this job" data-posting-match-panel="">
                        <p className="pp__matcheyebrow">Your résumé against this job</p>
                        {/* ⛔ D58 (moved with D152 (8) from the retired ATS panel's header): base → tailored, and a tailored
                            score BELOW the base is SAID — the full sentence its title. */}
                        {scores.base != null && scores.tailored != null && (
                          <p className="pp__matchpair" data-ats-pair="" data-lower={scores.lower ? "true" : undefined} title={scores.line || undefined}>
                            {scores.base} → {scores.tailored}{scores.lower ? " · lower than your base" : ""}
                          </p>
                        )}
                        <ATSPanel report={selectedJobMeta?.atsPayload?.report} score={selectedJobMeta?.atsPayload?.score}
                          jobId={selectedJob.jobId} resumeText={selectedJobMeta?.resumeText || ""}
                          activeProfileId={selectedJobMeta?.activeProfileId ?? null} onReport={selectedJobMeta?.onAtsReport || null}
                          history={matchHistory} bare />
                      </section>
                    </div>
                  </div>
                ) : null}
                matchBox={<AtsNumberBox score={scores.shown} tailored={scores.tailoredShown} base={scores.base} caption="match"
                  open={matchOpen} onOpen={() => { setMatchMounted(true); setMatchOpen(o => !o); }} />}>
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
              {/* ⭐ D138 · who the user knows at this company — after the posting now (D147: nothing between the facts
                  and the description). The applicant count, when a source gives one, is a quiet line beside it. */}
              <WarmPathsBlock jobId={selectedJob.id ?? selectedJob.jobId} />
              {selectedJob.applicantCount != null && (
                <p className="pp__applicants" data-applicant-count="">
                  {selectedJob.applicantCount > 200 ? "200+" : selectedJob.applicantCount} applicants
                </p>
              )}
            </div>

            {/* ⭐ D147 · THE ACTIONS, AT THE BOTTOM — Pass · Save · Draft · More, pinned to the panel's foot while the
                posting scrolls (position: sticky; bottom: 0 in JobDetailPanel.css). */}
            {selectedJobMeta && (
              <div className="pp__foot" data-posting-actions-bar="">
                <PostingActions job={selectedJob} meta={selectedJobMeta} slots={slots}
                  onCoverLetter={() => setShowCoverLetter(true)} />
              </div>
            )}
      </div>
    </PanelShell>
  );
}
