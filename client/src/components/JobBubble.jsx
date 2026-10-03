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
import { useEffect, useRef, useState } from "react";
import CompanyIcon from "./ui/CompanyIcon.jsx";
import CompanyViewModal from "./CompanyViewModal.jsx";
import { jobDetailHref } from "../lib/jobUrl.js";
import { api } from "../lib/api.js";
import { atsBandFor, atsBandLabel, ATS_NUMBER_SHOWN } from "../../../shared/atsBands.js";
import { columnsFor } from "../lib/bubbleColumns.js";
import { DraftMark } from "./DraftMark.jsx";
import "./JobBubble.css";


function ago(postedAt, scrapedAt) {
  const t = postedAt ? Date.parse(postedAt) / 1000 : scrapedAt;
  if (!t) return null;
  const d = Math.max(0, Math.floor((Date.now() / 1000 - t) / 86400));
  return d === 0 ? "today" : `${d}d`;
}

function salary(job) {
  const lo = job.salaryMin, hi = job.salaryMax;
  if (lo == null && hi == null) return null;
  const k = (v) => `$${Math.round(v / 1000)}k`;
  return lo != null && hi != null ? `${k(lo)}–${k(hi)}` : k(lo ?? hi);
}

function BarMark() {
  return (
    <svg width="20" height="16" viewBox="0 0 20 16" aria-hidden="true" focusable="false">
      <rect x="1" y="9" width="4" height="6" rx="1.2" fill="currentColor" opacity=".45" />
      <rect x="8" y="5" width="4" height="10" rx="1.2" fill="currentColor" opacity=".7" />
      <rect x="15" y="1" width="4" height="14" rx="1.2" fill="currentColor" />
    </svg>
  );
}

function StarMark({ filled }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3.2l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.2l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"
        fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export default function JobBubble({ job, score = null, selected = false, saved = false, drafted = false, drafting = false,
                                    onOpen, onAts, onSave, onDraft }) {
  const [companyView, setCompanyView] = useState(false);
  const id = job.jobId || job.id;
  const applyHref = job.applyUrl || job.url;
  const band = atsBandFor(score);
  const bandLabel = atsBandLabel(band).label;
  const showNumber = ATS_NUMBER_SHOWN && Number.isFinite(score);
  const status = job.heldOutsideUs ? "Outside the US" : job.isActive === false ? "No longer listed" : null;
  const meta = [status, job.location, job.workType || job.workplaceType, salary(job), ago(job.postedAt, job.scrapedAt)].filter(Boolean);

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
        <CompanyIcon company={job.company} iconUrl={job.companyIconUrl} size={52} radius={13} />
      </button>

      <div className="jb__text">
        {applyHref ? (
          // ⭐ A63: APPLY IS THE COMPANY NAME — opening the posting tags the job Pending.
          <a className="jb__company" href={applyHref} target="_blank" rel="noopener noreferrer" data-apply-link
            title={`Apply at ${job.company} — opens the posting`}
            onClick={(e) => {
              e.stopPropagation();
              api("/api/applications/pending", { method: "POST", body: JSON.stringify({ jobId: id, origin: "opened_posting" }) }).catch(() => {});
            }}>
            {job.company}
          </a>
        ) : <span className="jb__company">{job.company}</span>}
        <a className="jb__title" href={jobDetailHref(id)} style={{ color: "inherit", textDecoration: "none" }}
          onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) { e.stopPropagation(); return; } e.preventDefault(); e.stopPropagation(); onOpen?.(); }}>
          {job.title}
        </a>
        {meta.length > 0 && <div className="jb__meta">{meta.join("  ·  ")}</div>}
      </div>

      <div className="jb__rail">
        <button type="button" className="jb__sq jb__sq--ats" data-score={showNumber ? score : undefined}
          onClick={stop(onAts)}
          aria-label={showNumber ? `ATS report — ${score}, ${bandLabel}` : `ATS report — ${bandLabel}`}
          title={showNumber ? `ATS match ${score} — open the report` : `${bandLabel} — open the ATS report`}>
          {showNumber ? (<><span className="jb__ats-n">{score}</span><span className="jb__ats-cap">ats</span></>) : <BarMark />}
        </button>
        <button type="button" className="jb__sq jb__sq--save" aria-pressed={saved} onClick={stop(saved ? null : onSave)}
          aria-label={saved ? "Saved" : "Save"} title={saved ? "Saved" : "Save"}>
          <StarMark filled={saved} />
        </button>
        {applyHref && (
          <button type="button" className="jb__sq jb__sq--draft" data-done={drafted ? "true" : undefined}
            disabled={drafted || drafting} onClick={stop(onDraft)}
            aria-label={drafted ? "Drafted" : drafting ? "Drafting" : "Draft"}
            title={drafted ? "Drafted — it waits for your review on the Draft tab" : "Draft — queue it for your review. Nothing is sent until you approve it."}>
            <DraftMark />
          </button>
        )}
      </div>
      {companyView && <CompanyViewModal company={job.company} onClose={() => setCompanyView(false)} />}
    </div>
  );
}

/** The board's rows: N per row by the container's width, so a growing card's neighbours share its row. */
export function JobBubbleRows({ jobs, children }) {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  const n = columnsFor(width);
  const rows = [];
  for (let i = 0; i < jobs.length; i += n) rows.push(jobs.slice(i, i + n));
  return (
    <div ref={ref} className="jb-rows" data-columns={n}>
      {rows.map((row, i) => (
        <div className="jb-row" key={i}>
          {row.map(children)}
          {/* A short last row keeps the same card width as the rows above. */}
          {Array.from({ length: n - row.length }, (_, k) => <div key={`pad-${k}`} style={{ flex: "1 1 0" }} aria-hidden="true" />)}
        </div>
      ))}
    </div>
  );
}
