// client/src/components/JobBubble.jsx — D1 (chosen 10-02): THE JOBS PAGE CARD AS A BUBBLE.
//
// The sketch (bubbles2.html) is the specification; JobBubble.css carries its geometry and motion.
//   [ logo 52 ] [ company / title / meta ] [ rail: ATS · SAVE · DRAFT — zero width until hover ]
//
// ⛔ NO BAND AND NO NUMBER ON THE CARD BODY. Nothing on the row shows fit, so the SORT ORDER is the
//    signal ("ATS match", A75). The score lives on the ATS button only — and only once A76 has earned
//    it (ATS_NUMBER_SHOWN in shared/atsBands.js); until then the button carries the bar mark.
// ⛔ NO SCORE IS NOT A ZERO. A declined score is the scorer saying it cannot judge — the bar mark.
// ⛔ GENERATE AND APPLY ARE OFF THE CARD. Apply is the company name (A63) — a link with no underline
//    and no ↗ (A78), whose underline returns on hover and focus so the cue is not colour alone.
//    Generate lives on the job's detail panel.
// ⛔ :focus-within, not only :hover — the rail opens for the keyboard as it does for the mouse, and on
//    a touch screen (no hover) it is always shown.
//
// The Database panel and the landing page keep JobCard; D1 replaces the JOBS-PAGE card.
import { useState } from "react";
import CompanyLogo from "./CompanyLogo.jsx";
import CompanyViewModal from "./CompanyViewModal.jsx";
import { jobDetailHref } from "../lib/jobUrl.js";
import CompanyLink from "./CompanyLink.jsx";
import { ATS_NUMBER_SHOWN } from "../../../shared/atsBands.js";
import { salaryLabel, workstyleOf } from "../../../shared/postingFacts.js";
import { ghostLine } from "../../../shared/ghostScore.js";
import { DraftMark } from "./DraftMark.jsx";
import { draftButtonState } from "../lib/jobDecisions.js";
import "./JobBubble.css";


// D71: the shared label.
const salary = salaryLabel;

function StarMark({ filled }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3.2l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.2l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"
        fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

/** (11) 45q · the Send mark — a plain arrow out of a box, drawn in the rail's own ink. */
function SendMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2h5v5" /><path d="M14 2 7 9" /><path d="M12 9.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3.5" />
    </svg>
  );
}

export default function JobBubble({ job, score = null, selected = false, saved = false, drafted = false, drafting = false, resumeReady = false,
                                    onOpen, onSave, onDraft, onViewDraft = null, draftBlocked = null,
                                    onExplainDraft = null, draftSlots = null, onSend = null }) {
  const [companyView, setCompanyView] = useState(false);
  const draft = draftButtonState({ drafted, drafting, block: draftBlocked, canView: !!onViewDraft, slots: draftSlots });
  const id = job.jobId || job.id;
  const applyHref = job.applyUrl || job.url;
  const showNumber = ATS_NUMBER_SHOWN && Number.isFinite(score);
  // ⭐ D137: "Likely not hiring" takes the status slot (no extra label, A109); its reasons are the meta line's title.
  const status = job.heldOutsideUs ? "Outside the US" : job.isActive === false ? "No longer listed" : job.ghost?.level >= 2 ? "Likely not hiring" : null;
  // ⭐ D149 (fullhouse-declutter.html `.jr .meta`): salary · type · workstyle, each its own quiet word; a status first.
  const meta = [status, salary(job), job.contractType || null, workstyleOf(job) || job.workType || job.workplaceType || null].filter(Boolean);

  const open = (e) => {
    if (e.target.closest("a, button")) return;
    onOpen?.();
  };
  const stop = (fn) => (e) => { e.stopPropagation(); fn?.(); };

  return (
    <div className="jb" data-job-bubble={id} data-selected={selected ? "true" : undefined}
      data-dim={job.disliked ? "passed" : job.visited ? "visited" : undefined} onClick={open}>
      <button type="button" className="jb__logo" onClick={stop(() => setCompanyView(true))}
        aria-label={`${job.company} — company profile`}>
        <CompanyLogo company={job.company} iconUrl={job.companyIconUrl} size={36} radius={11} />
      </button>

      {/* ⭐ D149 (owner 11-03, fullhouse-declutter.html `.jr`): the row is the sketch's — the ROLE first (600 15px), then
          "company · location" quiet, then salary · type · workstyle; the match on the right. */}
      <div className="jb__text">
        <a className="jb__title" href={jobDetailHref(id)}
          onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) { e.stopPropagation(); return; } e.preventDefault(); e.stopPropagation(); onOpen?.(); }}>
          {job.title}
        </a>
        <span className="jb__sub">
          {/* ⭐ A63: APPLY IS THE COMPANY NAME — D38: the ONE company link, sized to its text (in the line's own type). */}
          <CompanyLink company={job.company} href={applyHref || null} jobId={id} size="row" className="jb__company" />
          {job.location ? <span className="jb__loc"> · {job.location}</span> : null}
        </span>
        {meta.length > 0 && (
          <div className="jb__meta" title={ghostLine(job.ghost) ? `${ghostLine(job.ghost)}.` : undefined}>
            {meta.map((m, i) => <i key={i}>{m}</i>)}
          </div>
        )}
        {/* ⭐ A109 (owner 11-01): no sponsorship label on each post — it is in the expanded posting panel (SponsorshipBlock) and is a board filter. */}
        {/* D40: on the + view, the one line that differs from ALL — when and from where it was captured. */}
        {job.captured && <div className="jb__meta" data-captured="">{capturedLine(job.captured)}</div>}
        {/* ⭐ D57: a résumé generated for this job is stored — said on the card, so it is never "found nowhere". */}
        {resumeReady && <div className="jb__ready" data-resume-ready="" title="A résumé is ready for this job — open the posting to view, download or regenerate it">résumé ready</div>}
      </div>

      {/* ⭐ D149 · the match on the right (`.mt`: 22px accent, "match" under it) — the same number the ATS square carries. */}
      <div className="jb__mt" data-match={showNumber ? score : undefined} aria-hidden={showNumber ? undefined : "true"}>
        {showNumber ? <><b>{score}%</b><span>match</span></> : null}
      </div>

      {/* The rail (Save · Draft) — revealed on hover / focus, always on touch (D1) — so the row's quick decisions keep
          working; at rest the row is the sketch's. ⛔ D152 (5): the old "86 ats" square is gone from every bubble — the
          match on the right says the same number; the match itself opens in the posting (D152 (8)). */}
      <div className="jb__rail">
        <button type="button" className="jb__sq jb__sq--save" aria-pressed={saved} onClick={stop(saved ? null : onSave)}
          aria-label={saved ? "Saved" : "Save"} title={saved ? "Saved" : "Save"}>
          <StarMark filled={saved} />
        </button>
        {/* ⛔ D51: never a dead end — drafted opens Draft House; refused says why, on a press too. */}
        {applyHref && (
          <button type="button" className="jb__sq jb__sq--draft" data-done={drafted ? "true" : undefined}
            data-draft-state={draft.kind} data-blocked={draft.kind === "blocked" ? "true" : undefined}
            disabled={draft.disabled} aria-disabled={draft.ariaDisabled || undefined}
            onClick={stop(draft.action === "draft" ? onDraft : draft.action === "view" ? onViewDraft
              : draft.action === "explain" ? () => onExplainDraft?.(draft.title) : null)}
            aria-label={draft.title} title={draft.title}>
            <DraftMark />
          </button>
        )}
        {/* ⭐ (11) 45q · D180 Send — only when the caller offers it (the network on, a public page for the posting). */}
        {onSend && (
          <button type="button" className="jb__sq jb__sq--send" data-bubble-send="" onClick={stop(onSend)} aria-label="Send" title="Send to a connection, or copy its link">
            <SendMark />
          </button>
        )}
      </div>
      {companyView && <CompanyViewModal company={job.company} onClose={() => setCompanyView(false)} />}
    </div>
  );
}

/** The board's rows: N per row by the container's width, so a growing card's neighbours share its row. */
/** D40 · "captured Oct 6 · from jobs.ashbyhq.com" — from the + view's own meta (server.js captureMeta). */
export function capturedLine(c) {
  const day = c?.at ? new Date(c.at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : null;
  return [day ? `captured ${day}` : "captured", c?.from ? `from ${c.from}` : null].filter(Boolean).join(" · ");
}

/**
 * ⛔ D45 (owner, 10-07): LOADING IS NOT EMPTY. While the board for the current view has not answered,
 * this stands in the card's own geometry — the 52px logo, three lines, the same padding and radius —
 * so the first frame is never "nothing here" when the truth is "not here yet". aria-hidden: the
 * board's own busy state is what a screen reader hears.
 */
export function JobBubbleSkeleton() {
  return (
    <div className="jb jb--skeleton" data-skeleton="" aria-hidden="true">
      <span className="jb__logo jb-sk jb-sk--logo" />
      <div className="jb__text">
        <span className="jb-sk jb-sk--line" style={{ width: "42%" }} />
        <span className="jb-sk jb-sk--line" style={{ width: "78%" }} />
        <span className="jb-sk jb-sk--line jb-sk--meta" style={{ width: "58%" }} />
      </div>
    </div>
  );
}

/**
 * ⭐ D149 (owner 11-03, fullhouse-declutter.html `.list`): ONE column of rows, 8px apart — the sketch's list. D1's rows of
 * 2 / 3 growing bubbles (lib/bubbleColumns.js, deleted) are not in the approved design.
 */
/**
 * ⭐ D149 · the board's page column (`.fhw`: 1240 wide, 20px gutters) and, with a posting open on a desktop, its two
 * columns — the list | an empty right column the posting is drawn over (JobsPanel's BesideDock measures `sideRef`).
 */
// ⭐ D152 (6) · the board's column. ⛔ D156 (1c) (owner 11-05: "doesnt make sense to have a card and then a panel posting of
// the same thing … the card can turn into the long post"): the posting no longer opens in place of the list (D152 (6) /
// D153 (1)'s cross-fade, and its scroll keeping, are removed) — it is drawn on the deck, in the front card's place
// (DeckView's slot), and the list beside it never folds. Where the reader was is kept by DeckView (it scrolls up to the
// post and back on fold).
export function JobBoardColumns({ children }) {
  return (
    <div className="jb-board">
      <div className="jb-board__list">{children}</div>
    </div>
  );
}

// ⭐ D152 (5) (owner 11-04: "two bubbles, two columns of job postings that resize to accommodate the others dynamically when
// hovering above them, and it shows the options"): home-sketch.html's `.rows` / `.row` — the postings in PAIRS, each pair
// one line; a hovered or focused bubble grows (1.5) and its neighbour gives way (.75), the line's height unchanged; its
// options (☆ Save · /d Draft) open on hover / focus, always on touch. One column while a posting is open beside the list,
// and on a phone (JobBubble.css). The pairs are laid out by CSS flex alone — nothing measured.
export function JobBubbleRows({ jobs, children, columns = 2 }) {
  if (columns !== 2) return <div className="jb-rows" data-columns={1}>{jobs.map(children)}</div>;
  const pairs = [];
  for (let i = 0; i < jobs.length; i += 2) pairs.push(jobs.slice(i, i + 2));
  return (
    <div className="jb-rows" data-columns={2}>
      {pairs.map((pair, p) => (
        <div className="jb-pair" key={p} data-jb-pair="">{pair.map((job, k) => children(job, p * 2 + k))}</div>
      ))}
    </div>
  );
}
