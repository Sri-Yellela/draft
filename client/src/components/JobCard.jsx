// SCRAPING — SCHEDULED FOR REMOVAL AFTER MIGRATION
// client/src/components/JobCard.jsx — shared expandable job card
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../styles/theme.jsx";
import CompanyViewModal from "./CompanyViewModal.jsx";
import { useAutoApply } from "../contexts/AutoApplyContext.jsx";
import { boardApplicationChip } from "../lib/applyObstacles.js";
import { DECISIONS, commitDecision } from "../lib/jobDecisions.js";
import { SaveButton, DraftButton } from "./DecisionButtons.jsx";
import { jobDetailHref } from "../lib/jobUrl.js";
import CompanyLogo from "./CompanyLogo.jsx";
import CompanyLink from "./CompanyLink.jsx";
import { atsBandFor, atsBandLabel } from "../../../shared/atsBands.js";
import { applyLine } from "../../../shared/postingLevel.js";
import { ghostLine } from "../../../shared/ghostScore.js";
import { salaryLabel } from "../../../shared/postingFacts.js";
import { markStyle, bandMarkStyle } from "../styles/mark.js";
import { C } from "../styles/colorTokens.js";
import { glass } from "../styles/glass.js";
import { api } from "../lib/api.js";
import { openPosting } from "../lib/openPosting.js";
import { useAtlasSlugs, atlasHref, useAtlasTerms } from "../lib/atlasLinks.js";
import { AtlasText } from "./AtlasTerm.jsx";

// AH2: a job's title is a LINK to that job's own address.
//
// The detail panel used to be React state and nothing else — there was no URL that named a job, so
// no card could offer "open in a new tab" and no two job details could be on screen at once. Now
// that /app/jobs?job=<id> resolves a specific posting, the title carries it, and the browser's own
// affordances (ctrl/cmd-click, middle-click, the context menu) work with no extra icon on an
// already dense card.
//
// A PLAIN left-click is deliberately not handled: it only suppresses the browser's navigation and
// then keeps bubbling to the card's own onClick, so opening a detail in the current tab behaves
// exactly as it did. A MODIFIED click stops there — the browser is opening a new tab, and selecting
// the job in THIS tab too would be a second thing the user did not ask for.
function JobTitleLink({ job, isLoggedOut, style, children }) {
  const href = jobDetailHref(job.jobId || job.id);
  if (isLoggedOut || !href) return <div style={style}>{children}</div>;
  return (
    <a href={href}
      title={`${job.title} — ctrl/cmd-click to open in a new tab`}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) { e.stopPropagation(); return; }
        e.preventDefault();
      }}
      style={{ color: "inherit", textDecoration: "none", display: "block", ...style }}>
      {children}
    </a>
  );
}

// ── Helpers ─────────────────────────────────────────────────────
// Compute elapsed time since posting.
// postedAt is stored as ISO date (e.g. "2024-03-15") after O1 normalization.
// fallbackTs is scraped_at (Unix seconds) — used when postedAt is absent.
function ago(postedAt, scrapedAt) {
  let ms = postedAt ? new Date(postedAt).getTime() : NaN;
  if (isNaN(ms) || ms <= 0) {
    // Fall back to scraped_at (Unix seconds → ms)
    ms = scrapedAt != null ? Number(scrapedAt) * 1000 : NaN;
  }
  if (isNaN(ms) || ms <= 0) return "—";
  const d = Date.now() - ms;
  if (d < 0) return "—";
  if (d < 3600000)  return `${Math.floor(d / 60000)}m`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h`;
  return `${Math.floor(d / 86400000)}d`;
}

// ── LinkedIn "in" logo ──────────────────────────────────────────
function LinkedInLogo({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-label="LinkedIn" role="img">
      <rect width="20" height="20" rx="3" fill={C.PROVIDER_LINKEDIN}/>
      <text x="4" y="15" fontFamily="Georgia,serif" fontWeight="900" fontSize="13" fill={C.ON_PROVIDER}>in</text>
    </svg>
  );
}

function PlatformLogo({ platform, size = 16, theme }) {
  const p = (platform || "").toLowerCase();
  if (p === "linkedin") return <LinkedInLogo size={size}/>;
  return <span style={{ fontSize: size * 0.6, color: "var(--color-text-muted)" }}>◆</span>;
}

// ── Company icon ────────────────────────────────────────────────

// ── Work badge ──────────────────────────────────────────────────
function WorkBadge({ t, theme }) {
  const map = {
    Remote: { bg:C.INFO_QUIET, fg:C.INFO },
    Hybrid: { bg:C.INFO_QUIET, fg:C.INFO },
  };
  const s = map[t] || null;
  if (s) {
    return (
      <span style={markStyle(s.fg)}>
        {t}
      </span>
    );
  }
  return (
    <span style={markStyle(C.INK_FAINT)}>
      {t || "Onsite"}
    </span>
  );
}

// ── Visa/sponsorship badge (FE-1) ────────────────────────────────
// null must render nothing — null means "no signal," never "does not sponsor."
function VisaBadge({ isH1bSponsor, requiresWorkAuth }) {
  if (isH1bSponsor === 1 || isH1bSponsor === true) {
    return (
      <span style={markStyle(C.SUCCESS)}>
        Sponsors H-1B
      </span>
    );
  }
  if (requiresWorkAuth === 1 || requiresWorkAuth === true) {
    return (
      <span style={markStyle(C.INK_FAINT)}>
        US work auth req.
      </span>
    );
  }
  return null;
}

// ── Application-state chip (board <-> pipeline) ───────────────────
// Renders nothing for a job with no application, which is almost all of them — the board must not
// grow a column of empty chips. Reads the join AutoApplyContext already computes from feeds it has
// loaded, so this costs no extra request and cannot disagree with the Auto Apply panel.
function ApplyStateChip({ jobId }) {
  const { applyStateByJobId } = useAutoApply();
  const chip = boardApplicationChip(applyStateByJobId?.[jobId]);
  if (!chip) return null;
  return (
    <span title={chip.title}
      style={markStyle(chip.color)}>
      {chip.label}
    </span>
  );
}

// ── Automation tier chip ─────────────────────────────────────────
// What the candidate will face at the apply destination, known before they queue instead of
// mid-run (services/jobs/automationTier.js; the runtime counterpart is applyAutomation.js's
// classifyFlowState, which only answers once a run is already holding).
//
// `direct` renders NOTHING, and that is the point: it is the default and the overwhelming
// majority of the board, so a chip on it would be noise on every card while telling the user
// nothing they did not already assume. Chip only what changes their expectation.
//
// null and 'unknown' are the SAME rendering, because they mean the same thing to a user — nobody
// has established what this destination demands. It is worded as an open question, never as
// "one-click" and never as "needs an account"; a company careers page might be either, and saying
// so honestly is the whole point of keeping `unknown` out of `manual`.
//
// D60: every badge in this row is a MARK (styles/mark.js) — WorkBadge, VisaBadge, NewPill and this one —
// so the row reads as one set and none of it is a capsule.
const TIER_CHIP = {
  guest:   { label:"Guest apply",  bg:C.INFO_QUIET, fg:C.INFO,
             title:"An account is offered but a guest path exists — autofill can usually complete this." },
  account: { label:"Account req.", bg:C.WARNING_QUIET, fg:C.WARNING,
             title:"This employer requires a self-service account. You sign in once; the resolver fills the form." },
  gated:   { label:"Login + check", bg:C.DANGER_QUIET, fg:C.DANGER,
             title:"Account plus a CAPTCHA or identity check — this one cannot be automated. Apply here yourself." },
  unknown: { label:"Apply path?",  bg:"var(--color-surface-offset)", fg:"var(--color-text-muted)",
             title:"We have not established what this destination asks for. It may apply cleanly, or may need an account." },
};

function TierChip({ tier }) {
  if (tier === "direct") return null;                 // the default — see note above
  const s = TIER_CHIP[tier] || TIER_CHIP.unknown;     // null/unrecognised read as unknown
  return (
    <span title={s.title}
      style={markStyle(s.fg)}>
      {s.label}
    </span>
  );
}

// ── NEW pill (FE-1) — discoveredAt is unix seconds ───────────────
function isNewJob(discoveredAt) {
  if (!discoveredAt) return false;
  const ms = Number(discoveredAt) * 1000;
  return Number.isFinite(ms) && Date.now() - ms < 24 * 3600 * 1000;
}

function NewPill() {
  return (
    <span style={markStyle(C.SUCCESS)}>
      New
    </span>
  );
}

// ── D104 · "Not eligible" — the posting states a requirement that contradicts what THIS user set ──
// The server decides (GET /api/jobs `eligibility`, only when the user set an answer a requirement could
// contradict) and moves the card to the end of its page; the card says so, with the reasons. Never hidden,
// never a guess: absent `eligibility` renders nothing, and "unknown" is never sent as a mark.
// ⭐ D108 P3 · when the reason is sponsorship, the employer's public filings are added to the title as INFORMATION —
// the verdict is the server's and is unchanged by them.
function EligibilityMark({ eligibility, sponsorship }) {
  if (eligibility?.status !== "ineligible") return null;
  const reasons = Array.isArray(eligibility.reasons) ? eligibility.reasons.filter(Boolean) : [];
  const filings = sponsorship?.text && reasons.includes("no visa sponsorship") ? ` The employer's public filings: ${sponsorship.text}.` : "";
  return (
    <span data-eligibility="ineligible" style={markStyle(C.DANGER)}
          title={(reasons.length ? `The posting says: ${reasons.join(" · ")}. From your Application defaults.` : "From your Application defaults.") + filings}>
      Not eligible{reasons.length ? ` · ${reasons[0]}` : ""}
    </span>
  );
}

// ── D107 · a posting that looks never-filled — reposted, or open a long time ──
// The server reads it from the crawl's history (GET /api/jobs `liveness`); the card marks only the two kinds worth a
// second look. "New" already has its own mark; a short "Open 9 days" is said in the posting panel, not here.
function LivenessMark({ liveness }) {
  if (liveness?.kind !== "reposted" && liveness?.kind !== "open_long") return null;
  return (
    <span data-liveness={liveness.kind} style={markStyle(C.WARNING)} title="From what draft's crawl has seen of this posting.">
      {liveness.label}
    </span>
  );
}

// ── D137 · THE GHOST SCORE — the card marks only "Likely not hiring"; its reasons are the mark's title, and the posting
// panel says them in full (with "Uncertain" too). Ranked down, never hidden: the user can still open it and apply.
function GhostMark({ ghost }) {
  if (!(ghost?.level >= 2)) return null;
  return (
    <span data-ghost={ghost.level} style={markStyle(C.WARNING)} title={`${ghostLine(ghost)}. From what draft's crawl and applications have seen.`}>
      {ghost.label}
    </span>
  );
}

// ── D106 · the level the posting ASKS for, when it is two steps from its title ("Titled Junior · asks for 3+ years…") ──
function LevelMark({ levelRead }) {
  const d = levelRead?.disagreement;
  if (d?.direction !== "asks_more") return null;
  return <span data-level-read={levelRead.read} style={markStyle(C.WARNING)} title="Read from the posting's own words.">{d.text.replace(/\.$/, "")}</span>;
}

// ── D106 P2 · ONE LINE: should I apply — the match, eligibility, liveness and level in one sentence. Information only:
// it may say skip, it never blocks, and the ATS number beside it is the same number (shared/postingLevel.js applyLine).
function ApplyLineNote({ job, score }) {
  const line = applyLine({ score, eligibility: job?.eligibility, liveness: job?.liveness, level: job?.levelRead, sponsorship: job?.sponsorship, ghost: job?.ghost });
  if (!line) return null;
  return <p data-apply-line={line.verdict} style={{ margin:"4px 0 0", fontSize:11, color:"var(--color-text-muted)" }}>{line.text}</p>;
}

// ── Closed pill — a saved job whose listing has expired ──────────
// Only ever rendered on the Saved tab, because that is the only board that returns is_active = 0
// rows. runExpiredJobsCleanup used to hard-DELETE an expired starred job seven days on, taking the
// user's own star with it, so a saved posting simply ceased to exist. It is now retired instead
// (is_active = 0) and kept — and a kept row has to SAY it is closed, or the list quietly promises
// the user they can still apply.
// A62 follow-up — a saved capture the US-only gate held off the shared board is inactive too, but
// it has not closed: the employer still lists it. Saying "no longer listed" would be false.
function OutsideUsPill() {
  return (
    <span title="Still listed by the employer, but outside the US — so it is kept in your Saved jobs and not shown on the board."
          style={markStyle(C.WARNING)}>
      Outside the US
    </span>
  );
}

function ClosedPill() {
  return (
    <span title="This listing was not seen again for 7 days, so it is probably filled or withdrawn. Kept here because you saved it."
          style={markStyle(C.WARNING)}>
      No longer listed
    </span>
  );
}

// ── Skill chips (FE-1) — expanded/detail surfaces only ───────────
// ⭐ D105 P5: a chip whose skill has a PUBLISHED Atlas page links to it — resolved in one request per card, cached for
// the page; no published page, no link (never a dead one).
function SkillChips({ skills, max = 5 }) {
  const shown = (skills || []).slice(0, max);
  const slugs = useAtlasSlugs(shown);
  if (!shown.length) return null;
  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
      {shown.map((s, i) => {
        const slug = slugs[String(s ?? "").trim()];
        const chip = { fontSize:10, color:"var(--color-text-muted)",
                       background:"var(--color-surface-offset)", padding:"2px 7px",
                       borderRadius:4, border:"1px solid var(--border-glass)" };
        return slug
          ? <a key={i} href={atlasHref(slug)} target="_blank" rel="noopener noreferrer" data-atlas-link=""
               title={`About ${s} in the Atlas`} onClick={e => e.stopPropagation()}
               style={{ ...chip, textDecoration:"underline", textUnderlineOffset:2 }}>{s}</a>
          : <span key={i} style={chip}>{s}</span>;
      })}
    </div>
  );
}

// ── The ATS slot on a card ──────────────────────────────────────
// ⛔ CC5 · THERE WAS NO ROUTE TO THE TERM LIST ON A ROW NOBODY HAD SCORED, WHICH WAS ALMOST EVERY
// ROW. The badge below is the only thing on a card that opens the ATS report, and it renders
// nothing without a score — deliberately, because a card must not report an absent score as a
// verdict (see its own note). Two correct decisions composed into a dead end: 0 of 2,458 active
// postings carry a score, so the report — the matched and missing terms, and the chips a candidate
// claims from — was unreachable from the board on 100% of rows.
//
// The fix is not to render a band nobody computed. It is a SECOND, deliberately non-committal
// control that says only "there is an answer here if you ask for it", which is true: the panel it
// opens scores the posting against the caller's own résumé on demand (~7ms, measured over 300 real
// postings) and writes the result to that user's per-profile cache, which is where the badge then
// comes from. So a row heals by being looked at — though not instantly: the badge is part of the
// board response, so it appears on the next board fetch rather than the moment the panel answers.
// That is a deliberately small promise. The term list, which is the thing that was unreachable, is
// on screen immediately.
//
// It is NOT styled as a band: no band colour, no band word, a dashed border and muted text, so it
// cannot be mistaken for the engine having an opinion it does not have. And it only appears when
// there is somewhere to go — no onClick, no chip.
function AtsSlot({ score, onClick }) {
  if (score != null && !Number.isNaN(score)) return <ATSBadge score={score} onClick={onClick}/>;
  if (!onClick) return null;
  return (
    <span title="Score this job against your resume and see which terms match" className="dbx-depth"
      onClick={e => { e.stopPropagation(); onClick(); }}
      style={{ background:"transparent", color:"var(--color-text-muted)",
               padding:"3px 8px", fontSize:10, fontWeight:600,
               cursor:"pointer", border:"1px dashed var(--color-border)",
               whiteSpace:"nowrap", flexShrink:0 }}>
      Check match
    </span>
  );
}

// ── ATS badge ───────────────────────────────────────────────────
// A BAND, NOT A NUMBER. "ATS 43" claims a precision the engine does not have (rho 0.746 against the
// owner's graded 30, 12.2% of pairs still mis-ordered). The old thresholds here were >=80 green /
// >=60 amber / else red, carried over from v3 — under v4 the board runs median 27 and max 64, so
// every row on the board painted RED and the badge read as "every job is bad" when it was only a
// different scale. Cutpoints now come from shared/atsBands.js, which is also what JobsPanel's copy
// of this badge reads, so the two cannot drift into disagreeing about the same job.
function ATSBadge({ score, onClick }) {
  // NO SCORE RENDERS NOTHING, and this reverses an earlier decision here on purpose.
  //
  // The note this replaces said a null score "IS a band and must render — it is the scorer
  // declining rather than fabricating". That reasoning is sound for the surfaces it was written
  // for and wrong for this one, because on a card `null` does not mean the scorer declined. It
  // means NOBODY EVER SCORED THIS ROW: 1,262 of the board's 1,266 active postings have a NULL
  // ats_score, so "the scorer declined" and "there is no score" arrive here as the same value and
  // the badge cannot tell them apart. Rendering the decline band for both turned a state that
  // shared/atsBands.js measured at 0.1% of the board into a chip on essentially every card —
  // which is not the honest answer made visible, it is one word repeated 1,266 times.
  //
  // It also actively misinformed: clicking the chip opens the ATS panel, which scores the job on
  // demand and shows a real band, so the card said "No signal" about a job the very next click
  // proved it had an opinion on.
  //
  // ⛔ THE FOURTH BAND IS NOT DELETED AND MUST NOT BE. atsBandFor still returns
  // NOT_ENOUGH_SIGNAL for null and ATSPanel still renders it, which is where it belongs: a
  // surface that RAN the scorer and got a decline. This guard only stops a card from reporting an
  // absent score as a scorer's verdict. See test/atsBadgeAbsentWithoutScore.test.js.
  if (score == null || Number.isNaN(score)) return null;
  const band = atsBandFor(score);
  const meta = atsBandLabel(band);
  return (
    <span title={meta.blurb}
      onClick={onClick ? e => { e.stopPropagation(); onClick(); } : undefined}
      style={{ ...bandMarkStyle(band), cursor:onClick?"pointer":"default" }}>
      {meta.short}
    </span>
  );
}

// ── Plain description renderer ───────────────────────────────────
// ⭐ D114: `jobId` — the posting's published Atlas terms are quiet links (components/AtlasTerm.jsx); the text is unchanged.
function DescriptionText({ text, theme, truncate = true, maxChars = 1200, jobId = null }) {
  const terms = useAtlasTerms(text ? jobId : null);
  if (!text) return null;
  const shouldTruncate = truncate && Number.isFinite(maxChars);
  const trimmed = shouldTruncate ? text.slice(0, maxChars) : text;
  return (
    <p style={{ fontSize:11, color:"var(--color-text-muted)", lineHeight:1.7, margin:0, whiteSpace:"pre-wrap" }}>
      <AtlasText text={trimmed} terms={terms} used={new Set()} />
      {shouldTruncate && text.length > maxChars && <span style={{ color:"var(--color-text-faint)" }}> … (truncated)</span>}
    </p>
  );
}

// ── Icon button ─────────────────────────────────────────────────
function IconBtn({
  bg,
  onClick,
  title,
  children,
  disabled = false,
  size = 28,
  theme,
  active = false,
  activeBg = null,
  activeColor = null,
}) {
  const [hov, setHov] = useState(false);
  const preview = hov && !disabled;
  const resolvedActiveBg = activeBg || `${bg}22`;
  const resolvedActiveColor = activeColor || bg;
  return (
    <button className="dbx-depth" title={title} disabled={disabled} onClick={onClick}
      onMouseEnter={() => !disabled && setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width:size, height:size,
        background: disabled
          ? "var(--color-surface-offset)"
          : active
            ? resolvedActiveBg
            : preview
              ? `${bg}18`
              : "var(--color-surface-offset)",
        border:`1px solid ${disabled
          ? "var(--color-border)"
          : active
            ? `${bg}55`
            : preview
              ? `${bg}44`
              : "var(--color-border)"}`,
        display:"flex", alignItems:"center", justifyContent:"center",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize:12,
        color: disabled
          ? "var(--color-text-muted)"
          : active
            ? resolvedActiveColor
            : preview
              ? bg
              : "var(--color-text-muted)",
        opacity: disabled ? 0.4 : 1,
        transition:"all 0.15s ease", flexShrink:0,
        transform: active ? "scale(1.08)" : preview ? "scale(1.08)" : "scale(1)",
        boxShadow: active ? `0 0 0 1px ${bg}22` : "none",
      }}>
      {children}
    </button>
  );
}

// The board's Save and Draft buttons live in components/DecisionButtons.jsx (A53) — shared with
// JobDetailPanel, in the deck's button treatment.

// ── Main JobCard ─────────────────────────────────────────────────
export default function JobCard({
  job,
  theme: themeProp,
  isLoggedOut = false,
  showApplyButton = true,
  g,                  // generated resume entry
  done,               // has generated resume
  st,                 // loading state string
  applyMode,
  canUseGenerate = applyMode !== "SIMPLE",
  canUseAPlusResume = false,
  onGenerate,
  onAPlusResume,
  onViewSandbox,
  onExport,
  onVisit,
  onSave,             // A53: Save SETS (the deck's call) — a repeat is a no-op
  onUnsave,           // an explicit, labelled reversal — the Saved list's own control
  onPass,             // the board card has no Pass slot; JobDetailPanel carries it
  onDraft,            // Draft — the deck's call (lib/jobDecisions.js); was "Queue Auto"
  drafted = false,    // already drafted (the pipeline's feed, or this session)
  drafting = false,   // a Draft on the wire
  onCardClick,
  onAts,
  onResume,
  onSelect,           // split-view: select this card (replaces expand)
  selected,           // split-view: this card is selected
  compact,            // split-view: tighter layout
  cardTier = 1,       // 1=full, 2=medium (manual resize), 3=condensed (3+ panels open)
}) {
  const { theme: ctxTheme } = useTheme();
  const theme = themeProp ?? ctxTheme;
  const navigate = useNavigate();

  const [hov,      setHov]      = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showCompanyView, setShowCompanyView] = useState(false);

  // Local SAVED state — used when no parent manages it (e.g. a card rendered with no onSave).
  const [starred,  setStarred]  = useState(job._user?.starred  ?? job.starred  ?? false);

  // Sync if job prop changes (e.g. parent re-fetches)
  useEffect(() => {
    setStarred(job._user?.starred  ?? job.starred  ?? false);
  }, [job._user, job.starred]);

  // ── SAVE SETS, IT DOES NOT TOGGLE (A53, owner 10-02) ──────────────────────────────────────
  // This used to flip: a second press on a saved job UN-saved it, so the star was two decisions
  // wearing one button. Save is the deck's Save now — PATCH /api/jobs/interact { starred:true },
  // through lib/jobDecisions.js, never a second copy — and pressing it on a saved job does nothing.
  // Reversal is a separate, labelled control: Undo on the board's toast, or "Remove" on the Saved
  // list (onUnsave). The fallback below (no parent) goes through api() for the per-tab auth
  // context: a bare fetch once wrote a star onto the OTHER signed-in account.
  const handleSave = () => {
    if (starred) return;
    if (onSave) { onSave(); return; }
    setStarred(true);
    commitDecision({ jobId: job.jobId || job.id, decision: DECISIONS.SAVED })
      .catch(e => { setStarred(false); console.warn(`[JobCard] save failed for ${job.jobId || job.id}: ${e.message}`); });
  };

  // ── DRAFT, WHERE "QUEUE AUTO" WAS (AE5's slot) ─────────────────────────────────────────────
  // AE5 gave this slot to the action that moves an application forward, and that stands. What
  // changed (A53, owner 10-02) is that it is now the deck's Draft — one name, one behaviour: an
  // immediate, persisted POST /api/apply/runs, not a client-side basket a reload emptied. Pass is
  // on JobDetailPanel, one click away, and this card still renders a passed job dimmed.
  const queueKey = job.jobId || job.id;
  const canDraft = !!(job.applyUrl || job.url) && !!queueKey && !!onDraft;
  const handleDraft = () => { if (!drafted && !drafting) onDraft?.(); };

  // The glass material (styles/glass.js) — a lit surface, not a pale rectangle (owner, 09-30).
  const material = glass({ hover: hov, radius: 14 });

  const hasDesc    = !!(job.description || job.descriptionHtml);
  // Only `generate` needs its own flag here. There is no dedicated A+ Resume button on this card —
  // nor on JobDetailPanel's action bar, which carried an identical orphan — so the companion flag
  // that used to sit here was computed and never read (§5.14 removed both). A+ itself is live:
  // JobsPanel selects that tool by apply_mode/plan tier, it simply has no button of its own on
  // either surface. Removing the flag changes nothing: while a job is in the a_plus_resume state,
  // `st` is still truthy, so the `disabled={!!st}` / `cursor:st ? …` guards below keep disabling
  // this card's buttons exactly as before.
  const generateLoading = st === "generate";
  // D71: the shared label (this printed "USD144k→USD194k" for every USD salary).
  const salaryStr  = salaryLabel(job);

  const yoeStr = job.expRaw
    ? job.expRaw
    : job.minYearsExp != null
      ? (job.maxYearsExp != null ? `${job.minYearsExp}→${job.maxYearsExp}y` : `${job.minYearsExp}y+`)
      : null;

  const handleCardClick = (e) => {
    if (e.target.closest("a") || e.target.closest("button")) return;
    if (isLoggedOut) {
      void openPosting(job, { url: job.url || job.applyUrl });   // D99 J11
      return;
    }
    if (onSelect) { onSelect(); return; }
    if (onCardClick) { onCardClick(); return; }
    setExpanded(prev => !prev);
  };

  // RESPONSIVE TIERS: driven by open-panel count (see getCardTier in JobsPanel.jsx).
  // Tier 1 (full layout):   A alone or A+B — cardTier=1
  // Tier 2 (medium):        manual drag to 180-279px — cardTier=2
  // Tier 3 (condensed):     3+ panels open (A at 10%) — cardTier=3
  // To change tier triggers, edit getCardTier() in JobsPanel.jsx.
  const tier = cardTier;

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      role={isLoggedOut ? "link" : undefined}
      tabIndex={isLoggedOut ? 0 : undefined}
      aria-label={isLoggedOut ? `${job.title} at ${job.company} — view job` : undefined}
      onKeyDown={isLoggedOut ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); void openPosting(job, { url: job.url || job.applyUrl }); } } : undefined}
      style={{
        ...material,
        // Selection is the one state the orange marks; the rim is the material's otherwise. The
        // ring is ACCENT_INK, not the orange fill (2.96:1 on the paper fails the 3:1 UI bar).
        ...(selected ? { border: `1px solid ${C.ACCENT_INK}` } : null),
        // AE5: the 16px side margin moved onto the listing GRID. Inside a grid cell a per-card
        // margin insets each cell separately, so the two columns ended up with 32px of nothing
        // between them on top of the gap. The bottom margin went too — the grid owns the gap now,
        // and keeping both stacked them.
        margin: 0,
        position: "relative",
        opacity: job.disliked ? 0.3 : job.visited ? 0.75 : 1,
        filter: job.disliked ? "grayscale(0.7)" : "none",
        overflow: "hidden",
        cursor: isLoggedOut ? "pointer" : undefined,
      }}>

      {/* The per-card grey noise overlay (fractalNoise 0.75, "overlay" at 0.12) is gone: it laid a
          static grain over the leather the glass is meant to show through, which is most of what
          read as dated. The substrate is the texture now. */}

      {/* ── TIER_3_CONTENT: condensed narrow mode (< 180px) ── */}
      {tier === 3 && (
        <div onClick={handleCardClick}
          title={`${job.company} — ${job.title}`}
          style={{ padding:"10px 8px 10px", display:"flex", flexDirection:"column",
                   alignItems:"center", gap:5, cursor:"pointer", position:"relative", zIndex:1,
                   minHeight:72 }}>
          {/* Logo — fades in as tier changes */}
          <div style={{ opacity:1, transition:"opacity 0.15s ease 0.05s" }}>
            <CompanyLogo company={job.company} iconUrl={job.companyIconUrl} size={32}/>
          </div>
          {/* Company name */}
          <span style={{ fontSize:10, fontWeight:700, color:"var(--color-text)", textAlign:"center",
                         overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                         width:"100%", maxWidth:110,
                         opacity:1, transition:"opacity 0.15s ease 0.05s" }}>
            {job.company}
          </span>
          {/* Resume badge — only if a resume has been generated */}
          {done && (
            <span style={{ ...markStyle(C.SUCCESS), opacity:1, transition:"opacity 0.2s ease 0.22s" }}>
              ✓ Resume
            </span>
          )}
        </div>
      )}

      {/* ── Tier 2: condensed two-row (180→279px) ── */}
      {tier === 2 && (
        <div onClick={handleCardClick}
          style={{ padding:"10px 12px", display:"flex", alignItems:"center", gap:10,
                   cursor:"pointer", position:"relative", zIndex:1,
                   opacity:1, transition:"opacity 0.15s ease" }}>
          <CompanyLogo company={job.company} iconUrl={job.companyIconUrl} size={36}/>
          <div style={{ flex:1, minWidth:0 }}>
            {/* Row 1: company + age + ATS + star + dislike */}
            <div style={{ display:"flex", alignItems:"center", gap:4, marginBottom:3 }}>
              <span style={{ fontWeight:700, fontSize:12, color:"var(--color-text)",
                              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1, minWidth:0 }}>
                {job.company}
              </span>
              <span style={{ fontSize:10, color:C.SUCCESS, fontWeight:600, flexShrink:0 }}>{ago(job.postedAt, job.scrapedAt)}</span>
              {/* The null guard that used to live here, then was removed, now lives INSIDE
                  the badge — one copy rather than one per call site, so the two rows on this card
                  cannot disagree about when a badge appears. See its note for why a card treats
                  "no score" as nothing to say rather than as a verdict, and AtsSlot's for why the
                  card still has to offer a way IN when there is no score. */}
              {!isLoggedOut && <AtsSlot score={g?.atsScore ?? job?.baseAtsScore ?? null} onClick={onAts}/>}
              {!isLoggedOut && (
                <SaveButton saved={starred} onSave={handleSave} onUnsave={onUnsave} compact />
              )}
              {!isLoggedOut && canDraft && (
                <DraftButton drafted={drafted} drafting={drafting} onDraft={handleDraft} compact />
              )}
            </div>
            {/* Row 2: job title */}
            <JobTitleLink job={job} isLoggedOut={isLoggedOut}
              style={{ fontSize:11, color:"var(--color-text-muted)",
                       overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {job.title}
            </JobTitleLink>
          </div>
        </div>
      )}

      {/* ── Tier 1: full layout (>= 280px) — unchanged ── */}
      {tier === 1 && (
        <div onClick={handleCardClick}
          // A53: the row WRAPS. The decisions are words now (Save, Draft), wider than the glyphs they
          // replaced, and at 390px the old row already clipped its last two icons off the card.
          // Below ~the info's 220px floor the action cluster drops to its own line, right-aligned.
          style={{ padding: compact ? "10px 14px" : "14px 18px", display:"flex", alignItems:"center", flexWrap:"wrap", columnGap:14, rowGap:10, cursor:"pointer", position:"relative", zIndex:1 }}>

          {/* Company icon — the KB profile lives here now; the NAME is the apply link (A63). */}
          <span onClick={e => { e.stopPropagation(); setShowCompanyView(true); }}
            title={`View ${job.company}'s KB profile`} style={{ cursor:"pointer", display:"inline-flex" }}>
            <CompanyLogo company={job.company} iconUrl={job.companyIconUrl} size={48}/>
          </span>

          {/* Center info */}
          <div style={{ flex:"1 1 220px", minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
              {/* ⭐ A63 (owner, O45c): APPLY IS THE COMPANY NAME. The separate Apply link is
                  gone; the name links to the posting and opening it tags the job Pending — it stays
                  Pending until the submission is recorded and verified (Database → Pending). */}
              {/* D38: the ONE company link (CompanyLink.jsx) — no underline, no ↗, sized to its text. */}
              {/* ⭐ A157 (owner 11-09): the name opens the company's page; the Apply link lives there now. */}
              <CompanyLink company={job.company} size="panel" jobId={job.jobId || job.id} inApp={!isLoggedOut} />
              {job.alreadyApplied && (
                <span title="Applied" style={{ fontSize:10, color:C.SUCCESS, fontWeight:700 }}>✓APPLIED</span>
              )}
              {!job.alreadyApplied && job.companyAppliedBefore && (
                <span title="Applied to this company before" style={{ fontSize:10, color:C.WARNING }}>↩prev</span>
              )}
              {job.visited && (
                <span style={markStyle(C.INK_FAINT)}>visited</span>
              )}
            </div>
            <JobTitleLink job={job} isLoggedOut={isLoggedOut}
              style={{ fontSize:12, color:"var(--color-text-muted)", marginBottom:6,
                       overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {job.title}
            </JobTitleLink>
            <div style={{ display:"flex", alignItems:"center", gap:5, flexWrap:"wrap" }}>
              <WorkBadge t={job.workType} theme={theme}/>
              {/* Explicit `=== false`: isActive is absent on live-search results, and absent must
                  not read as closed. Ahead of the NEW pill because "closed" outranks "recent". */}
              {job.heldOutsideUs ? <OutsideUsPill/> : job.isActive === false && <ClosedPill/>}
              {/* A closed listing is never new, whatever discoveredAt says — the two pills side by
                  side ("NO LONGER LISTED" + "NEW") is a contradiction the user has to resolve, and
                  the closed state is the one that changes what they can do about it. */}
              {job.isActive !== false && isNewJob(job.discoveredAt) && <NewPill/>}
              <VisaBadge isH1bSponsor={job.isH1bSponsor} requiresWorkAuth={job.requiresWorkAuth}/>
              <EligibilityMark eligibility={job.eligibility} sponsorship={job.sponsorshipFact}/>
              <LivenessMark liveness={job.liveness}/>
              <GhostMark ghost={job.ghost}/>
              <LevelMark levelRead={job.levelRead}/>
              {/* THE BOARD AND THE PIPELINE STOP BEING SEPARATE WORLDS. A card gave no hint that
                  you had already applied to it, that it was queued, or that it was stuck waiting on
                  you — so the only way to know was to open the other tab and read a list of runs.
                  The label comes from lib/applyObstacles.js, the same vocabulary the Auto Apply
                  panel uses, so the two cannot describe one application differently. */}
              <ApplyStateChip jobId={job.jobId || job.id}/>
              <TierChip tier={job.automationTier}/>
              <span style={{ display:"flex", alignItems:"center", gap:4 }}>
                <PlatformLogo platform={job.sourcePlatform || job.source} size={16} theme={theme}/>
              </span>
              {job.location && (
                <span style={{ fontSize:10, color:"var(--color-text-faint)" }}>{job.location}</span>
              )}
              {yoeStr && (
                <span style={{ fontSize:10, color:"var(--color-text-faint)" }}>{yoeStr} exp</span>
              )}
              {salaryStr && (
                <span style={{ fontSize:10, color:C.SUCCESS, fontWeight:700 }}>{salaryStr}</span>
              )}
              {!salaryStr && job.compensation && (
                <span style={{ fontSize:10, color:C.SUCCESS, fontWeight:700 }}>{job.compensation}</span>
              )}
              {job.applicantCount != null && (
                <span style={{ fontSize:10, color:"var(--color-text-faint)" }}>
                  {job.applicantCount > 200 ? "200+ applicants" : `${job.applicantCount} applicants`}
                </span>
              )}
              {job.source_label && (
                <span style={markStyle(C.INK_FAINT)}>
                  {job.source_label}
                </span>
              )}
              {job.via && (
                <span style={markStyle(C.INK_FAINT)}>
                  {job.via}
                </span>
              )}
            </div>
            {!isLoggedOut && <ApplyLineNote job={job} score={g?.atsScore ?? job?.baseAtsScore ?? null}/>}
          </div>

          {/* Right side */}
          <div style={{ display:"flex", alignItems:"center", gap:5, flexShrink:0, flexWrap:"wrap", justifyContent:"flex-end", marginLeft:"auto" }}>
            {isLoggedOut && hov && (
              <span style={{ fontSize:13, color:"var(--color-primary-text)", fontWeight:700, opacity:0.85 }}>↗</span>
            )}
            <span style={{ fontSize:11, color:C.SUCCESS, fontWeight:600 }}>{ago(job.postedAt, job.scrapedAt)}</span>

            {!isLoggedOut && (
              <AtsSlot score={g?.atsScore ?? job?.baseAtsScore ?? null} onClick={onAts}/>
            )}
            {!isLoggedOut && done && (
              <span onClick={onResume ? e => { e.stopPropagation(); onResume(); } : undefined} className="dbx-depth"
                style={{ background:C.INFO_QUIET, color:C.INFO, padding:"3px 8px",
                         fontSize:10, fontWeight:700, cursor:"pointer",
                         border:`1px solid ${C.INFO}44`, display:"inline-flex", alignItems:"center", gap:3 }}>
                {st==="loading" ? "⏳" : "📄"} Resume
              </span>
            )}

            {/* Save, then Draft — the deck's order (Pass · Save · Draft) with Pass on the detail
                panel, and the deck's button treatment: glass for Save, the orange fill for Draft. */}
            {!isLoggedOut && (
              <SaveButton saved={starred} onSave={handleSave} onUnsave={onUnsave} />
            )}
            {!isLoggedOut && canDraft && (
              <DraftButton drafted={drafted} drafting={drafting} onDraft={handleDraft} />
            )}
            {/* Generate */}
            {!isLoggedOut && canUseGenerate && onGenerate && showApplyButton && (
              <IconBtn bg="var(--color-primary)" title={done ? "Regenerate" : "Generate resume"}
                disabled={!!st} theme={theme} active={done && !generateLoading}
                onClick={e => { e.stopPropagation(); onGenerate(done && g?.html !== "__exists__"); }}>
                {generateLoading ? "⏳" : done ? "↻" : "✦"}
              </IconBtn>
            )}

            {/* View sandbox */}
            {!isLoggedOut && done && g?.html !== "__exists__" && showApplyButton && (
              <IconBtn bg={C.INFO} title="View in sandbox" theme={theme}
                onClick={e => { e.stopPropagation(); onViewSandbox?.(); }}>
                👁
              </IconBtn>
            )}

            {/* Visit URL */}
            {!isLoggedOut && onVisit && showApplyButton && job.url && (
              <IconBtn bg="var(--color-primary)" title="Open job listing" theme={theme}
                onClick={e => { e.stopPropagation(); onVisit(); }}>
                ↗
              </IconBtn>
            )}
          </div>
        </div>
      )}

      {/* ── Expanded section ──────────────────────────────────── */}
      {expanded && (
        <div style={{
          borderTop: "1px solid var(--border-glass)",
          padding: "12px 18px 16px",
          display: "flex", flexDirection: "column", gap: 10,
        }}>
          {/* Description */}
          {job.description && (
            <DescriptionText text={job.description} theme={theme} truncate={false} jobId={job.id}/>
          )}

          {/* Skill chips (FE-1) — expanded surface only, never on the collapsed card */}
          <SkillChips skills={job.skills}/>

          {/* Extra meta row */}
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, alignItems:"center", paddingTop:4 }}>
            {job.source_label && (
              <span style={markStyle(C.INK_FAINT)}>
                {job.source_label}
              </span>
            )}
            {job.via && (
              <span style={markStyle(C.INK_FAINT)}>
                {job.via}
              </span>
            )}
            {salaryStr && (
              <span style={{ fontSize:11, color:C.SUCCESS, fontWeight:700, background:C.SUCCESS_QUIET,
                              padding:"2px 8px", borderRadius:4 }}>
                💰 {salaryStr}
              </span>
            )}
            {yoeStr && (
              <span style={{ fontSize:11, color:"var(--color-text-muted)", background:"var(--color-surface-offset)",
                              padding:"2px 8px", borderRadius:4 }}>
                🎓 {yoeStr} exp required
              </span>
            )}
            {job.applicantCount != null && (
              <span style={{ fontSize:11, color:"var(--color-text-muted)", background:"var(--color-surface-offset)",
                              padding:"2px 8px", borderRadius:4 }}>
                👥 {job.applicantCount > 200 ? "200+" : job.applicantCount} applicants
              </span>
            )}
          </div>

          {/* Recruiter section — coming soon */}
          {!isLoggedOut && canUseGenerate && showApplyButton && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:8, alignItems:"center" }}>
              {canUseGenerate && onGenerate && (
                <button onClick={e => { e.stopPropagation(); onGenerate(done && g?.html !== "__exists__"); }}
                  disabled={!!st}
                  style={{ border:"none", borderRadius:6, padding:"8px 12px",
                           background:"var(--color-primary)", color:C.ON_ACCENT, cursor:st ? "not-allowed" : "pointer",
                           fontSize:12, fontWeight:800 }}>
                  {generateLoading ? "Generating..." : done ? "Regenerate" : "Generate"}
                </button>
              )}
            </div>
          )}

          {/* FE-6: was a "Recruiter (coming soon)" stub implying auto-contact/LinkedIn
              reach-out — replaced with a real link into the Recruiter KB-reference +
              consistency-check surface (companies/roles only, no outreach or scraping). */}
          {!isLoggedOut && (
            <div style={{
              borderTop: "1px dashed var(--border-glass)",
              paddingTop: 8, marginTop: 4,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontSize:10, color:"var(--color-text-faint)", fontWeight:700,
                              textTransform:"uppercase", letterSpacing:"0.06em" }}>
                Recruiter
              </span>
              <button className="dbx-depth"
                onClick={e => { e.stopPropagation(); navigate(`/app/recruiter?company=${encodeURIComponent(job.company)}`); }}
                title={`Open ${job.company}'s KB reference in Recruiter view`}
                style={{ fontSize:10, padding:"1px 8px", fontWeight:700,
                         background:"var(--color-surface-offset)", color:"var(--color-primary-text)",
                         border:"1px solid var(--color-primary)", cursor:"pointer",
                         whiteSpace:"nowrap", letterSpacing:"0.04em" }}>
                View company KB →
              </button>
            </div>
          )}
        </div>
      )}
      {showCompanyView && (
        <CompanyViewModal company={job.company} onClose={() => setShowCompanyView(false)} />
      )}
    </div>
  );
}
