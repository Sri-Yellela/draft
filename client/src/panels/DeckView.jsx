// ── Today — the deck (UI steps 3c + 4; the fan, queue 27; the deal and the end, queue 28) ─────
//
// docs/UI_REDESIGN.md §3–§4 and docs/BRAND_OUTLAY_AND_MOTION.md §"THE DECK — DECIDED 2026-09-30".
// One job at a time; position is the fit signal; nothing here submits.
//
//   Draft  (D, →, swipe right)  POST /api/apply/runs { surface:"deck" }, NO approvalMode — the job is
//                               previewed and parked for review. The route refuses approvalMode from
//                               this surface, so the deck physically cannot ask for no review.
//   Pass   (X, ←, swipe left)   PATCH /api/jobs/interact { disliked:true } — saved; never re-dealt
//   Save   (S, button only)     PATCH /api/jobs/interact { starred:true }
//   Undo   (U, the toast)       abort the run job / interact false
//
// THE FAN (lib/fanGeometry.js holds every number). The dealt cards sit on a shallow arc, pulled
// back; the FRONT card is face-up, square-on and full size, the rest face-down. Scroll over the
// stack rotates it (the page does not move), a card reaching the front FLIPS face-up, and clicking
// the front card EXPANDS IT IN PLACE — the expansion is the detail, so there is no detail view to
// route to and the element never changes identity.
//
// ⛔ Scroll capture is an accessibility cost, paid back in full: J/K and ↑/↓ do exactly what the
// wheel does, ‹ › buttons do it for touch and pointer, Enter expands, Esc collapses. The wheel is
// only captured when a rotation is POSSIBLE — at either end, and while expanded, the page scrolls.
// ⛔ Layering by named tier (zLayers.js): --z-fan < --z-content < --z-nav. The fan passes behind the
// header and the action row; only the face-up card rises into the content layer.
// ⛔ No animation gates input (lib/deckState.js): an action commits at once and the fly-out plays on
// the leaving element. ⛔ Every motion honours prefers-reduced-motion — from ONE MotionConfig, so a
// new transition cannot forget it. ⛔ Colours are tokens only; the card shows a band and never a number.
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import StartFromResume from "../components/StartFromResume.jsx";
import { C } from "../styles/colorTokens.js";
import { Z } from "../styles/zLayers.js";
import { glass } from "../styles/glass.js";
import { bandMarkStyle, markStyle } from "../styles/mark.js";
import { ATS_BAND, atsBandLabel } from "../../../shared/atsBands.js";
import { salaryLabel } from "../../../shared/postingFacts.js";
import { DECK_SCROLL_MS } from "../../../shared/trialTour.js";
import { ATSPanel } from "../components/ATSPanel.jsx";
import { AtsBandCard, fromDeckReport } from "../components/AtsReport.jsx";
import PostingPanel from "../components/PostingPanel.jsx";
import { PairLinkProvider } from "../lib/pairLink.js";
import CompanyLogo from "../components/CompanyLogo.jsx";
import CardBack, { CardBackDefs } from "../components/CardBack.jsx";
import { useViewport } from "../hooks/useViewport.js";
import { CHROME_HEIGHT_VAR } from "../hooks/useChromeHeight.js";
import { useAutoApply } from "../contexts/AutoApplyContext.jsx";
import { jobDetailHref } from "../lib/jobUrl.js";
import { TITLE_ATTR, transitionClick } from "../lib/viewTransitions.js";
import { A_PLUS_TOOL, GENERATE_TOOL } from "../lib/applyTools.js";
import { DECISIONS, counts, deckReducer, fanOrder, initialDeck, isFinished, stepTarget } from "../lib/deckState.js";
import { DECISION_SURFACES, DECISION_TOAST_MS, DECISION_VERB, commitDecision, undoDecision } from "../lib/jobDecisions.js";
import DecisionToast from "../components/DecisionToast.jsx";
import { CARD, EXPAND_CLOCK, TWO_PANEL, cardSize, fanTransform, geometryFor, orientationFor, twoPanelColumn, twoPanelFor } from "../lib/fanGeometry.js";
import DeckGeometryControl from "../components/DeckGeometryControl.jsx";
import { useDeckGeometry } from "../hooks/useDeckGeometry.js";
import { readDeckOrder, writeDeckOrder } from "../lib/deckOrder.js";
import { postingClick } from "../lib/openPosting.js";

const SWIPE_COMMIT_PX = 80;          // the same commit distance as Android's SOFT_OFFSET
const TOAST_MS = DECISION_TOAST_MS;
const WHEEL_STEP = 60;               // accumulated wheel delta for one card
const WHEEL_SETTLE_MS = 140;         // one trackpad flick is many events; rotate once per flick
const localDate = () => new Date().toLocaleDateString("en-CA");   // YYYY-MM-DD in the user's zone
// Development only: lets the geometry be swept from the console while looking (queue 27's reach
// sweep). Production reads geometryFor (the user's layout, fitted) and nothing else.
const DEV_FAN = import.meta.env?.DEV ? globalThis.__DECK_FAN__ : null;

// The words, the toast and the calls are the board's too (A53, owner 10-02): lib/jobDecisions.js.
const VERB = DECISION_VERB;

// ── small pieces ────────────────────────────────────────────────────────────────────────────
const visuallyHidden = { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" };
const kbd = { fontSize: 11, fontWeight: 700, padding: "1px 6px", borderRadius: 5, border: `1px solid ${C.BORDER_STRONG}`,
              color: C.INK_MUTED, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", lineHeight: "16px" };
const isInteractive = (el) => !!el?.closest?.("a,button,input,textarea,select,[role=button]");

function ago(job) {
  const t = job.postedAt ? Date.parse(job.postedAt) : job.discoveredAt ? job.discoveredAt * 1000 : NaN;
  if (!Number.isFinite(t)) return null;
  const d = Math.max(0, Math.round((Date.now() - t) / 86400000));
  return d === 0 ? "today" : d === 1 ? "yesterday" : `${d}d ago`;
}
function salary(job) {
  // never a range from one bound (SWIPE_FEED_DESIGN §2.2); D71: the shared label otherwise.
  if (job.salaryMin == null || job.salaryMax == null) return null;
  return salaryLabel(job);
}
function workModel(job) {
  const w = String(job.workplaceType || "").toLowerCase();
  if (w === "remote" || job.remote) return "Remote";
  if (w === "hybrid") return "Hybrid";
  if (w === "onsite" || w === "on-site") return "On-site";
  return null;
}
function untilTomorrow() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const m = Math.max(1, Math.round((next - now) / 60000));
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

// The mark is a slash; the deck's progress fills it along its diagonal — drafted ÷ size.
function SlashProgress({ drafted, size, big = false }) {
  const p = size ? drafted / size : 0;
  const px = big ? 64 : 30;
  return (
    <svg width={px} height={px} viewBox="0 0 30 30" aria-hidden="true">
      <line x1="8" y1="26" x2="22" y2="4" stroke={C.BORDER_STRONG} strokeWidth="5" strokeLinecap="round" />
      <motion.line x1="8" y1="26" x2="22" y2="4" stroke={C.ACCENT_INK} strokeWidth="5" strokeLinecap="round"
        // opacity 0 at zero: a round cap on a zero-length path draws a stray dot.
        initial={big ? { pathLength: 0, opacity: 0 } : false} animate={{ pathLength: p, opacity: p > 0 ? 1 : 0 }}
        transition={{ duration: big ? 0.7 : 0.2, delay: big ? 0.25 : 0 }} />
    </svg>
  );
}

function ActionButton({ label, hint, onClick, primary, disabled, ariaKeys, compact }) {
  const [hov, setHov] = useState(false);
  const base = primary
    ? { background: C.ACCENT, color: C.ON_ACCENT, border: `1px solid ${C.ACCENT_INK}`, boxShadow: hov ? C.SHADOW_GLASS_HOVER : C.SHADOW_GLASS }
    : { ...glass({ hover: hov, radius: 16 }), color: C.INK };
  return (
    <motion.button type="button" onClick={onClick} disabled={disabled} aria-keyshortcuts={ariaKeys}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} whileTap={{ scale: 0.96 }}
      style={{ ...base, flex: 1, minHeight: compact ? 48 : 54, borderRadius: 16, fontSize: 16, fontWeight: 800, letterSpacing: "0.02em",
               display: "flex", alignItems: "center", justifyContent: "center", gap: 10, cursor: disabled ? "default" : "pointer",
               opacity: disabled ? 0.5 : 1 }}>
      {label}{!compact && <span style={{ ...kbd, ...(primary ? { borderColor: C.ON_ACCENT, color: C.ON_ACCENT } : null) }}>{hint}</span>}
    </motion.button>
  );
}

function StepButton({ dir, onClick, disabled }) {
  return (
    <button type="button" className="dbx-depth" onClick={onClick} disabled={disabled} aria-keyshortcuts={dir < 0 ? "K ArrowUp" : "J ArrowDown"}
      aria-label={dir < 0 ? "Previous card" : "Next card"}
      style={{ ...glass({ radius: 10 }), width: 32, height: 32, display: "grid", placeItems: "center", padding: 0,
               color: C.INK, fontSize: 16, fontWeight: 800, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.4 : 1 }}>
      {dir < 0 ? "‹" : "›"}
    </button>
  );
}

// ── the expansion (A40, rebuilt 10-02): TWO EQUAL PANELS — the ATS report │ the card ─────────────
// docs/BRAND_OUTLAY_AND_MOTION.md §"THE EXPANDED CARD — DECIDED 2026-10-01" is authoritative. The
// posting stays INSIDE the card, growing downward; the one panel beside it is the FULL ATS report.
// ⛔ The first build (8c38dd2, da73ff9) was three columns — ATS │ card │ posting — and was wrong.
//
// COLLAPSED  logo, company, title and ONE signal line ("Strong match · 9 of 12 matched · tap for the
//            report"). ⛔ No chip rows: the collapsed card is a two-second decision.
// CLICK      four things on ONE clock (--deck-t / --deck-ease, set once on the deck's root) and NO
//            stagger: the grid 0fr → 1fr · the arc riding right with the card's column · the signal
//            collapsing to nothing · the posting growing inside the card. Both height changes are
//            grid-row 0fr ↔ 1fr on the same curve, so they read as ONE continuous change, not two jerks.
// NARROW     (below TWO_PANEL_PX — phones, portrait tablets) the vertical fan stays, the signal line
//            stays on the card, and tapping it opens the report as a SHEET.
const sectionLabel = { fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: C.INK_FAINT, marginBottom: 8 };
const ON_THE_CLOCK = "var(--deck-t) var(--deck-ease)";
// `inert` as an attribute — React 18 has no boolean prop for it. Hidden content takes no focus and no clicks.
const inertIf = (hidden) => (hidden ? { inert: "", "aria-hidden": true } : null);

// The card's ONE line of ATS: the band, how many of the posting's skills the résumé shows (term counts,
// never a score), and the way in to the full report.
// 11-01: a TRIAL account's card carries its score (server.js /api/draft/today) — shown as "86% match" before the counts.
function AtsSignal({ band, why = {}, onOpen, cta, score = null }) {
  const meta = atsBandLabel(band);
  const matched = Number(why.matchedTotal) || 0;
  const total = matched + (Number.isFinite(why.missingTotal) ? why.missingTotal : (why.missing?.length || 0));
  return (
    <button type="button" data-deck-signal onClick={onOpen} aria-controls="deck-ats"
      style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "2px 0", background: "transparent",
               border: "none", cursor: "pointer", textAlign: "left", fontSize: 13.5, color: C.INK_MUTED }}>
      <span style={{ ...bandMarkStyle(band), fontSize: 12.5 }}>{meta.label}</span>
      {Number.isFinite(score) && <span data-deck-score={score} style={{ fontWeight: 700, color: C.INK }}>{Math.round(score)}% match</span>}
      {total > 0 && <span>{matched} of {total} skills</span>}
      {cta && <span style={{ color: C.ACCENT_INK, fontWeight: 700 }}>{cta}</span>}
    </button>
  );
}

// ⭐ THE TRIAL'S MATCH (owner 11-01: "we also need to show the ats matching to help them choose"): a trial account's card
// carries its own stored score (server.js) — the SAME reading the board uses, never a separate trial number — shown as
// a number in a ring, "N of M skills", the top 4 matched skills (green marks) and the top 2 missing (grey).
function TrialMatch({ score, why = {}, onOpen, cta }) {
  const matched = Number(why.matchedTotal) || 0;
  const total = matched + (Number.isFinite(why.missingTotal) ? why.missingTotal : (why.missing?.length || 0));
  const pct = Math.max(0, Math.min(100, Math.round(score)));
  return (
    <button type="button" data-deck-signal data-trial-match onClick={onOpen} aria-controls="deck-ats"
      style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "2px 0", background: "transparent",
               border: "none", cursor: "pointer", textAlign: "left", color: C.INK }}>
      <span data-deck-score={pct} aria-label={`${pct}% match`}
        style={{ width: 60, height: 60, borderRadius: "50%", flex: "none", display: "grid", placeItems: "center",
                 background: `conic-gradient(${C.SUCCESS} ${pct}%, ${C.BORDER} 0)` }}>
        <span style={{ width: 46, height: 46, borderRadius: "50%", background: "var(--color-surface)", display: "grid", placeItems: "center",
                       fontWeight: 800, fontSize: 15 }}>{pct}%</span>
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        <span style={{ fontSize: 13.5 }}>
          {total > 0 && <><b style={{ color: C.SUCCESS }}>{matched} of {total}</b> skills · </>}
          {cta && <span style={{ color: C.ACCENT_INK, fontWeight: 700 }}>{cta}</span>}
        </span>
        <span style={{ display: "flex", gap: 5, flexWrap: "wrap" }} data-trial-chips="">
          {(why.matched || []).slice(0, 4).map(t => <span key={`m-${t}`} data-chip="matched" style={{ ...markStyle(C.SUCCESS), fontSize: 12 }}>{t}</span>)}
          {(why.missing || []).slice(0, 2).map(t => <span key={`x-${t}`} data-chip="missing" style={{ ...markStyle(C.INK_MUTED), fontSize: 12 }}>{t}</span>)}
        </span>
      </span>
    </button>
  );
}

// D32 · THE POSTING HALF OF THE INK PAIR (components/PostingPanel.jsx): the masthead's kicker and deck
// strip, then the employer's own description, formatted plainly. The card's heading above IS the title,
// so the masthead does not print it twice. The Experience cell tints from the frozen report's judgement.
function CardPosting({ card }) {
  const experience = card.report ? fromDeckReport(card.report).experience : null;
  return (
    <PostingPanel job={card.job} experience={experience} showTitle={false}>
      The posting's text is not stored. Open it at the source.
    </PostingPanel>
  );
}

// D32 · THE PHONE'S ANSWER: the sticky score column COLLAPSES ABOVE THE POSTING — its header only (band ·
// "you cover 9 of 12" · the three-segment bar), with the way into the full report as a sheet.
function CollapsedScore({ card, onOpen }) {
  if (!card.report) return null;
  return (
    <div data-pair-collapsed style={{ marginBottom: 14 }}>
      <AtsBandCard report={fromDeckReport(card.report)} band={card.report.scorable ? card.band : ATS_BAND.NOT_ENOUGH_SIGNAL} compact />
      <button type="button" onClick={onOpen} aria-controls="deck-ats"
        style={{ marginTop: 8, padding: 0, background: "transparent", border: "none", cursor: "pointer",
                 fontSize: 13, fontWeight: 700, color: C.ACCENT_INK }}>
        The full report ↑
      </button>
    </div>
  );
}

function PostingLinks({ job, onReport }) {
  return (
    <div style={{ display: "flex", gap: 18, marginTop: 16, flexWrap: "wrap", fontSize: 13.5, fontWeight: 700 }}>
      {(job.applyUrl || job.url) && <a href={job.applyUrl || job.url} target="_blank" rel="noreferrer" onClick={(e) => postingClick(job, e)} style={{ color: C.ACCENT_INK }}>The posting ↗</a>}
      <Link to={jobDetailHref(job.id)} onClick={onReport} style={{ color: C.ACCENT_INK }}>Full report on the board →</Link>
    </div>
  );
}

// The deck's frozen report (services/dailyDraft.js deckReport — every section, no number) is converted
// to the report shape by fromDeckReport, which lives WITH the one report implementation
// (components/AtsReport.jsx, A52) — so the deck draws THE SAME report rather than a second one, and no
// file but that one knows a report's field names.

// The FULL report — D31's simple card: band · "9 of 12" · one bar, then "You could claim" open and the
// résumé's terms and generic language folded — the board's ATSPanel, fed the frozen
// report and the card's BAND (never a number). ⛔ A declined report is the scorer saying it cannot
// judge, drawn as "Not enough signal", never as a low band.
function DeckAtsReport({ card, profileId, onReport }) {
  const r = card.report;
  if (!r) {
    // A card dealt before the deck froze the full report. Say where it is — never rebuild one from the
    // six-chip summary, which would be a second, thinner report wearing the first one's name.
    return (
      <div style={{ padding: "4px 16px" }}>
        <AtsSignal band={card.band} why={card.why} cta="" />
        <p style={{ fontSize: 14, color: C.INK_MUTED, lineHeight: 1.6, margin: "14px 0 12px" }}>
          This card was dealt before the deck carried the full report. Tomorrow's will; this one's is on the board.
        </p>
        <Link to={jobDetailHref(card.job.id)} onClick={onReport} style={{ color: C.ACCENT_INK, fontWeight: 700, fontSize: 13.5 }}>Full report on the board →</Link>
      </div>
    );
  }
  return <ATSPanel report={fromDeckReport(r)} band={r.scorable ? card.band : ATS_BAND.NOT_ENOUGH_SIGNAL}
                   jobId={card.job.id} activeProfileId={profileId} />;
}

// A75 · the deck's sort: the dealt order (the board's own — position IS the fit signal) or ATS match. The key and
// the read / write are lib/deckOrder.js (D93: Customise mirrors this control).
function DeckOrderControl({ order, onChoose }) {
  const opt = (value, label) => (
    <button type="button" aria-pressed={order === value} onClick={() => onChoose(value)}
      style={{ border: "none", borderRadius: 7, padding: "5px 11px", fontSize: 12.5, fontWeight: 800, cursor: "pointer",
               background: order === value ? C.INK : "transparent", color: order === value ? C.SURFACE_MENU : C.INK_MUTED }}>
      {label}
    </button>
  );
  return (
    <div role="group" aria-label="Order the deck by" data-deck-order
      style={{ ...glass({ radius: 10 }), display: "flex", gap: 2, padding: 2 }}>
      {opt("dealt", "Dealt")}{opt("ats", "ATS match")}
    </div>
  );
}

// ⛔ The label is "Collapse". One word — not "click to collapse", not "fold the card".
function CollapseButton({ onCollapse, controls }) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" className="dbx-depth" onClick={onCollapse} aria-expanded="true" aria-controls={controls} aria-keyshortcuts="Escape"
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      // The opaque menu surface: it rides over the posting's text as the reader scrolls.
      style={{ ...glass({ hover: hov, radius: 10 }), backgroundImage: "none", backgroundColor: C.SURFACE_MENU,
               padding: "7px 14px", fontSize: 13, fontWeight: 800, color: C.INK, cursor: "pointer" }}>
      Collapse
    </button>
  );
}

// The phone's report: a SHEET from the bottom, opened by the card's signal line. Above everything by
// tier (MODAL over its scrim); Esc, the scrim and Close all dismiss it; focus goes in and comes back.
function AtsSheet({ card, profileId, onClose, onReport }) {
  const ref = useRef(null);
  useEffect(() => {
    const back = document.activeElement;
    ref.current?.focus({ preventScroll: true });
    return () => back?.focus?.({ preventScroll: true });
  }, []);
  return (
    <>
      <motion.div aria-hidden onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ position: "fixed", inset: 0, background: C.SCRIM, zIndex: Z.MODAL_SCRIM }} />
      <motion.div ref={ref} role="dialog" aria-modal="true" aria-label="The ATS report" tabIndex={-1} data-deck-sheet
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        style={{ ...glass({ radius: 24 }), backgroundImage: "none", backgroundColor: C.SURFACE_MENU,
                 position: "fixed", left: 0, right: 0, bottom: 0, margin: "0 auto", maxWidth: 640, maxHeight: "85vh",
                 overflowY: "auto", overscrollBehavior: "contain", borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
                 zIndex: Z.MODAL, outline: "none", padding: "14px 4px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 12px 4px" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={sectionLabel}>The ATS report</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {card.job.title} · {card.job.company}
            </div>
          </div>
          <button type="button" className="dbx-depth" onClick={onClose} aria-keyshortcuts="Escape"
            style={{ ...glass({ radius: 10 }), padding: "7px 14px", fontSize: 13, fontWeight: 800, color: C.INK, cursor: "pointer" }}>
            Close
          </button>
        </div>
        <DeckAtsReport card={card} profileId={profileId} onReport={onReport} />
      </motion.div>
    </>
  );
}

// ── the face-up side ─────────────────────────────────────────────────────────────────────────
// `twoPanel`: the report opens BESIDE the card (so the signal line leaves it on the clock); otherwise
// the signal stays, because it is the way into the sheet.
function CardFace({ card, headingRef, isFront, expanded, onExpand, onCollapse, onReport, onSignal, orientation, twoPanel }) {
  const { job, why = {}, band } = card;
  const meta = [job.location, workModel(job), salary(job), ago(job)].filter(Boolean);
  const titleId = `deck-title-${job.id}`;
  const vertical = orientation === "vertical";
  const open = isFront && expanded;
  // D32: open, the signal line always leaves — beside the report on a wide screen, and on a phone to the
  // collapsed score that heads the posting.
  const signalShown = !open;
  return (
    <div style={{ padding: vertical ? "22px 22px 20px" : "28px 30px 24px" }}>
      {/* ⭐ COLLAPSE AT THE TOP TOO (A39), and STICKY — the bottom one is a whole posting away. A
          zero-height sticky row, so the button rides down with the reader without pushing the card's
          content; it sits just under the fixed top bar (its measured height, published). */}
      {open && (
        <div data-deck-collapse-top style={{ position: "sticky", top: `calc(var(${CHROME_HEIGHT_VAR}, 74px) + 10px)`, height: 0 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", transform: vertical ? "translate(8px, -10px)" : "translate(12px, -14px)" }}>
            <CollapseButton onCollapse={onCollapse} controls="deck-detail" />
          </div>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 14, paddingRight: open ? 104 : 0 }}>
        <CompanyLogo company={job.company} iconUrl={job.companyIconUrl} size={vertical ? 48 : 56} radius={16} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.INK_MUTED }}>{job.company}</div>
          {meta.length > 0 && <div style={{ fontSize: 13, color: C.INK_FAINT, marginTop: 2 }}>{meta.join("  ·  ")}</div>}
        </div>
      </div>

      <h2 id={titleId} ref={isFront ? headingRef : undefined} tabIndex={-1} {...(isFront ? { [TITLE_ATTR]: job.id } : null)}
        // ⭐ The shared element (queue 29): this heading IS the job's title on the board's detail and
        // on the review queue's line — one name, so a navigation moves it instead of cutting.
        style={{ fontFamily: "var(--font-display)", fontWeight: 400, lineHeight: 1.06, letterSpacing: "-0.01em", color: C.INK,
                 fontSize: vertical ? "clamp(28px, 8vw, 36px)" : "clamp(30px, 3.4vw, 46px)", margin: vertical ? "18px 0 18px" : "22px 0 20px",
                 outline: "none",
                 ...(expanded ? null : { display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }) }}>
        {job.title}
      </h2>

      {card.error && (
        <div role="alert" style={{ background: C.DANGER_QUIET, color: C.DANGER, padding: "10px 14px", borderRadius: 12,
                                   fontSize: 13.5, fontWeight: 600, marginBottom: 16 }}>
          {card.error}
        </div>
      )}

      {/* The ONE signal line. On a two-panel screen it collapses to nothing as the report opens beside
          the card — grid-row 1fr → 0fr on the expansion's clock, so it and the posting are one motion. */}
      <div data-deck-signal-row style={{ display: "grid", gridTemplateRows: signalShown ? "1fr" : "0fr", transition: `grid-template-rows ${ON_THE_CLOCK}` }}>
        <div style={{ minHeight: 0, overflow: "hidden" }} {...inertIf(!signalShown)}>
          {Number.isFinite(card.score)
            ? <TrialMatch score={card.score} why={why} onOpen={isFront ? onSignal : undefined} cta={twoPanel ? "open the report" : "tap for the report"} />
            : <AtsSignal band={band} why={why} onOpen={isFront ? onSignal : undefined} cta={twoPanel ? "open the report" : "tap for the report"} />}
        </div>
      </div>

      {/* ⭐ EXPANSION IS THE DETAIL — the same element, grown. The posting grows INSIDE the card
          (grid-row 0fr → 1fr, on the same clock). No modal, no second view, no third column. */}
      {isFront && (
        <div data-deck-posting-row style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", transition: `grid-template-rows ${ON_THE_CLOCK}` }}>
          <section id="deck-detail" aria-label="The posting" style={{ minHeight: 0, overflow: "hidden" }} {...inertIf(!open)}>
            <div style={{ marginTop: 18, paddingTop: 20, borderTop: `1px solid ${C.BORDER}` }}>
              {!twoPanel && <CollapsedScore card={card} onOpen={isFront ? onSignal : undefined} />}
              <CardPosting card={card} />
              <PostingLinks job={job} onReport={onReport} />
            </div>
          </section>
        </div>
      )}

      {isFront && (
        <button type="button" onClick={expanded ? onCollapse : onExpand} aria-expanded={expanded} aria-controls="deck-detail"
          aria-keyshortcuts={expanded ? "Escape" : "Enter"}
          style={{ marginTop: 18, padding: 0, background: "transparent", border: "none", cursor: "pointer",
                   fontSize: 12.5, fontWeight: 700, color: C.INK_FAINT }}>
          {expanded ? "Collapse" : "Open the posting ↓"}
        </button>
      )}
    </div>
  );
}

// ── one card in the fan ─────────────────────────────────────────────────────────────────────
// Four layers, each owning one motion so none fights another:
//   arrival  — framer: the once-a-day deal in, and the exit when a card is decided (rare, short)
//   position — CSS: where on the arc. A transition of transform and opacity only
//   drag     — framer: the front card's swipe, following the finger and tilting
//   flip     — CSS: rotateY — face-up at the front, face-down everywhere else
//
// ⛔ WHY ROTATION AND FLIP ARE CSS, NOT framer (measured, queue 27): framer animates x/y/rotate/scale
// in JavaScript, per card, per frame. On a CPU throttled to a mid-tier phone (4×, production build)
// that dropped 13–26% of frames past 25 ms while the fan turned; removing the logos, the filter, the
// shadows or the 3D changed nothing, and showing fewer cards did. A CSS transition of transform and
// opacity runs on the COMPOSITOR thread, so a busy main thread cannot stall it. See the SESSION LOG.
const POSITION_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const FLIP_EASE = "cubic-bezier(0.34, 1.32, 0.5, 1)";   // a touch of overshoot: the card settles face-up

function FanCard({ entry, orientation, geometry, size, expanded, twoPanel, dimmed, dealing, appear, dealRank, dealTotal, reduced,
                   onDecide, onExpand, onCollapse, onReport, onSignal, onGoto, headingRef, faceRef }) {
  const { card, offset } = entry;
  const isFront = offset === 0;
  // The arc's position. Opening a card does not move it here: the fan lives in the card's grid column,
  // and that column is what moves (A40) — so the arc rides right on the expansion's own clock.
  const t = fanTransform(offset, orientation, geometry);
  const x = useMotionValue(0);
  const tilt = useTransform(x, [-320, 0, 320], [-10, 0, 10]);
  const draftStamp = useTransform(x, [20, SWIPE_COMMIT_PX + 40], [0, 1]);
  const passStamp = useTransform(x, [-SWIPE_COMMIT_PX - 40, -20], [1, 0]);
  const dragged = useRef(false);
  const showFace = Math.abs(offset) <= 1;   // only a card that is, or is about to be, face-up needs one
  const stamp = { position: "absolute", top: 28, right: 26, padding: "6px 14px", borderRadius: 10, fontWeight: 900, fontSize: 22,
                  letterSpacing: "0.12em", border: "3px solid", pointerEvents: "none" };
  // The deal arrives from the pivot's side, face-down, one card at a time; the front turns over last.
  const from = orientation === "horizontal" ? { x: 520, y: 40, rotate: 18 } : { x: 60, y: 520, rotate: 14 };
  const dealDelay = dealing ? 0.08 * dealRank : 0;
  const [held, setHeld] = useState(dealing && isFront && !reduced);
  useEffect(() => {
    if (!held) return;
    const id = setTimeout(() => setHeld(false), (0.08 * dealTotal + 0.25) * 1000);
    return () => clearTimeout(id);
  }, [held, dealTotal]);
  const faceUp = isFront && !held;
  const opacity = t.shown ? t.opacity * (dimmed && !isFront ? 0.35 : 1) : 0;

  return (
    <motion.div data-fan-offset={offset} data-face={faceUp ? "up" : "down"}
      // deal: from the pivot side · first paint of a non-deal visit: already in place · later (an
      // undo, a refusal): fades back into its slot.
      initial={dealing ? { ...from, scale: geometry.zoom, opacity: 0 } : appear ? { opacity: 0 } : false}
      animate={{ x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 }}
      exit="leave"
      variants={{ leave: (d) => d?.variant || { opacity: 0 } }}
      transition={{ type: "spring", stiffness: 260, damping: 32, delay: dealDelay }}
      onClick={!isFront && t.shown ? () => onGoto(entry.i) : undefined}
      style={{ position: "absolute", top: 0, left: "50%", width: size.width, marginLeft: -size.width / 2,
               // Layer by TIER: the face-up card is content; the fan sits under it, nearer cards above farther.
               zIndex: isFront ? Z.CONTENT : Z.FAN - t.depth,
               pointerEvents: t.shown ? "auto" : "none", cursor: isFront ? "default" : "pointer" }}>
      <div data-fan-position style={{
          transform: `translate3d(${t.x}px, ${t.y}px, 0) rotate(${t.rotate}deg) scale(${t.scale})`, opacity,
          transition: reduced ? "none" : `transform 460ms ${POSITION_EASE}, opacity 320ms ease`, willChange: "transform, opacity" }}>
        {/* ⛔ SWIPE IS DISABLED WHEN THE CARD IS EXPANDED (A40, decided 10-01). Collapsed is triage —
            swipe freely; expanded is reading — buttons only. A long posting means heavy vertical
            scrolling, thumbs drift, and a Pass is final: removing the gesture beats tuning a threshold. */}
        <motion.div
          drag={isFront && !expanded ? "x" : false} dragSnapToOrigin dragElastic={0.6}
          onDragStart={() => { dragged.current = true; }}
          onDragEnd={(_, info) => {
            setTimeout(() => { dragged.current = false; }, 0);
            if (info.offset.x > SWIPE_COMMIT_PX) onDecide(DECISIONS.DRAFTED);
            else if (info.offset.x < -SWIPE_COMMIT_PX) onDecide(DECISIONS.PASSED);
          }}
          style={{ x, rotate: tilt, touchAction: "pan-y", cursor: isFront && !expanded ? "grab" : undefined,
                   userSelect: expanded ? "text" : "none" }}>
          <div data-flip
            // ⭐ THE FLIP: a card reaching the front turns face-up as it arrives.
            style={{ position: "relative", transformStyle: "preserve-3d", minHeight: size.height, height: isFront ? "auto" : size.height,
                     transform: `perspective(1800px) rotateY(${faceUp ? 0 : 180}deg)`,
                     transition: reduced ? "none" : `transform 520ms ${FLIP_EASE} 40ms` }}>
            <article ref={isFront ? faceRef : undefined} aria-labelledby={`deck-title-${card.job.id}`} aria-hidden={!isFront}
              onClick={isFront && !expanded ? (e) => { if (!dragged.current && !isInteractive(e.target)) onExpand(); } : undefined}
              style={{ position: "relative", minHeight: size.height, borderRadius: 28, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
                       // OPAQUE, not see-through glass: over a fan, a translucent face shows the backs
                       // through it (Android found the same with the next card's text, 09-30).
                       ...glass({ radius: 28 }), backgroundColor: C.SURFACE_SOLID, backdropFilter: "none", WebkitBackdropFilter: "none",
                       transition: "none", transform: "none",
                       cursor: isFront && !expanded ? "pointer" : "auto", visibility: showFace ? "visible" : "hidden" }}>
              {showFace && <CardFace card={card} headingRef={headingRef} isFront={isFront} expanded={isFront && expanded}
                                     onExpand={onExpand} onCollapse={onCollapse} onReport={onReport} onSignal={onSignal}
                                     orientation={orientation} twoPanel={twoPanel} />}
            </article>
            <div style={{ position: "absolute", inset: 0, transform: "rotateY(180deg)", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
                          borderRadius: 28, maxHeight: size.height }}>
              <CardBack company={card.job.company} iconUrl={card.job.companyIconUrl} />
            </div>
          </div>
          {/* The stamps come AFTER the card in the DOM, so they paint over it with no z-index of their own. */}
          {isFront && <motion.div aria-hidden style={{ ...stamp, color: C.SUCCESS, borderColor: C.SUCCESS, opacity: draftStamp, rotate: 10 }}>DRAFT</motion.div>}
          {isFront && <motion.div aria-hidden style={{ ...stamp, color: C.INK_MUTED, borderColor: C.INK_MUTED, opacity: passStamp, rotate: -10 }}>PASS</motion.div>}
        </motion.div>
      </div>
    </motion.div>
  );
}

// How a decided card leaves (queue 29): DRAFT flies to the Drafted counter — you see where it went,
// and the count moves; PASS drops away BEHIND the fan — direction encodes finality; SAVE lifts off.
function leaveFor(decision, target, geometry) {
  if (decision === DECISIONS.DRAFTED) {
    return { x: target?.dx ?? 380, y: target?.dy ?? -300, scale: 0.08, rotate: 10, opacity: 0,
             transition: { duration: 0.42, ease: [0.45, 0, 0.2, 1] } };
  }
  if (decision === DECISIONS.PASSED) {
    return { zIndex: Z.FAN - 20, scale: geometry.zoom * 0.9, y: 70, rotate: -5, opacity: 0,
             transition: { duration: 0.34, ease: "easeIn", zIndex: { duration: 0 } } };
  }
  return { y: -120, scale: 0.9, opacity: 0, transition: { duration: 0.26, ease: "easeIn" } };
}

// ── the end of the deck: a moment, not an empty state (queue 28) ────────────────────────────
function EndOfDeck({ s, tally, needsReview, onUndo }) {
  const navigate = useNavigate();
  const drafted = s.cards.filter(c => c.decision === DECISIONS.DRAFTED);
  const line = (i) => ({ initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.15 + i * 0.09, duration: 0.3 } });
  return (
    <motion.div data-deck-end initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}
      style={{ ...glass({ radius: 28 }), padding: "40px 36px 36px", position: "relative", zIndex: Z.CONTENT }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 18 }}>
        <SlashProgress drafted={tally.drafted} size={s.size} big />
        <div>
          <motion.div {...line(0)} style={{ fontFamily: "var(--font-display)", fontSize: "clamp(34px, 6vw, 46px)", lineHeight: 1, color: C.INK }}>
            That's today's draft.
          </motion.div>
          <motion.div {...line(1)} style={{ fontSize: 14.5, color: C.INK_MUTED, marginTop: 8 }}>
            {s.size} dealt · {tally.drafted} drafted · {tally.saved} saved · {tally.passed} passed
          </motion.div>
        </div>
      </div>

      {drafted.length > 0 && (
        <motion.ul {...line(2)} aria-label="Drafted today" style={{ listStyle: "none", padding: 0, margin: "0 0 20px", display: "grid", gap: 8 }}>
          {drafted.map(c => (
            <li key={c.job.id} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14.5, color: C.INK }}>
              <CompanyLogo company={c.job.company} iconUrl={c.job.companyIconUrl} size={28} radius={8} />
              <span style={{ minWidth: 0 }}>
                <strong {...{ [TITLE_ATTR]: c.job.id }} style={{ fontWeight: 700 }}>{c.job.title}</strong>
                <span style={{ color: C.INK_MUTED }}> · {c.job.company}</span>
              </span>
            </li>
          ))}
        </motion.ul>
      )}

      <motion.p {...line(3)} style={{ fontSize: 15, color: C.INK_MUTED, lineHeight: 1.6, margin: "0 0 22px" }}>
        {tally.drafted > 0
          ? <>Nothing has been sent. {tally.drafted === 1 ? "That draft waits" : "Each draft waits"} for your review{needsReview > 0 ? <> — <strong style={{ color: C.INK }}>{needsReview}</strong> {needsReview === 1 ? "thing needs" : "things need"} you in the queue now</> : null}.</>
          : <>You drafted nothing today, which is a fine answer when nothing fits.</>}
        {" "}That is it until tomorrow: the next draft is dealt in {untilTomorrow()}.
      </motion.p>

      <motion.div {...line(4)} style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        {tally.drafted > 0 && (
          <Link to="/app/auto-apply" onClick={transitionClick(navigate, "/app/auto-apply")} style={{ background: C.ACCENT, color: C.ON_ACCENT, border: `1px solid ${C.ACCENT_INK}`,
            padding: "12px 20px", borderRadius: 14, fontWeight: 800, textDecoration: "none", boxShadow: C.SHADOW_GLASS }}>
            Review your drafts →
          </Link>
        )}
        <Link to="/app/jobs" onClick={transitionClick(navigate, "/app/jobs")} style={{ ...glass({ radius: 14 }), padding: "12px 20px", fontWeight: 800, color: C.INK, textDecoration: "none" }}>Full House</Link>
        {onUndo && (
          <button type="button" onClick={onUndo} style={{ background: "transparent", border: "none", color: C.ACCENT_INK, fontWeight: 800, cursor: "pointer" }}>
            Undo the last one <span style={kbd}>U</span>
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}

// ── the view ────────────────────────────────────────────────────────────────────────────────
export default function DeckView({ canUseAPlusResume = true }) {
  const [load, setLoad] = useState({ status: "loading", error: null });
  // "__replace" swaps in a freshly loaded deck; every other action is the pure reducer's.
  const [state, dispatch] = useReducer((st, a) => (a.type === "__replace" ? a.state : deckReducer(st, a)), null, () => initialDeck(null));
  const [dealing, setDealing] = useState(false);
  const [toast, setToast] = useState(null);
  const [live, setLive] = useState("");
  const [legend, setLegend] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [leave, setLeave] = useState(null);
  const [frontH, setFrontH] = useState(0);
  const [sheet, setSheet] = useState(false);          // the phone's ATS report (A40)
  const [atsMounted, setAtsMounted] = useState(false); // the two-panel report stays mounted while it closes
  const [deckProfileId, setDeckProfileId] = useState(null);
  // A75 (owner, 10-03): "ATS match" as a sort on the daily draft. The deal is frozen; the server reads it
  // back in ATS order when asked (the score itself never reaches the client). Remembered per browser.
  const [deckOrder, setDeckOrder] = useState(readDeckOrder);
  const chooseDeckOrder = useCallback((next) => {
    setDeckOrder(next);
    writeDeckOrder(next);
  }, []);
  const headingRef = useRef(null);
  const faceRef = useRef(null);
  const stageRef = useRef(null);
  const counterRef = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const sheetRef = useRef(false);
  const { needsAttentionCount = 0 } = useAutoApply();
  const reduced = useReducedMotion();   // the CSS-driven motion reads it here; framer's reads MotionConfig
  const navigate = useNavigate();
  // Cards present on the first ready paint are simply THERE (unless this is the deal); a card that
  // arrives later — an undo, a refusal — fades into its slot.
  const firstPaint = useRef(true);

  const { w: vw } = useViewport();
  const orientation = orientationFor(vw);
  // The user's layout (queue 38), FITTED to the screen and overridden by reduced motion — geometryFor
  // is the only road from a stored preference to the fan.
  const [deckPref, chooseDeckPref] = useDeckGeometry();
  const geometry = { ...geometryFor(orientation, deckPref, { reduced: !!reduced }), ...(DEV_FAN?.[orientation] || null) };
  // ⭐ TWO EQUAL PANELS (A40) on a wide horizontal screen: the card is one column wide at rest AND open,
  // so opening never resizes it. Below TWO_PANEL_PX the report is a sheet and the card is as it was.
  const twoPanel = twoPanelFor(vw);
  const size = twoPanel ? { width: twoPanelColumn(vw), height: CARD.horizontal.height } : cardSize(orientation, vw);

  const scoringTries = useRef(0);
  const fetchDeck = useCallback(async () => {
    setLoad(l => (l.status === "scoring" ? l : { status: "loading", error: null }));
    try {
      const deck = await api(`/api/draft/today?date=${encodeURIComponent(localDate())}&order=${deckOrder}`);
      // 43y: a new résumé's matches are still being scored — say so and ask again (every 4 s, up to 3 minutes),
      // rather than showing an empty deck the tester takes for "no jobs".
      if (deck.reason === "scoring" && scoringTries.current < 45) {
        scoringTries.current += 1;
        setLoad({ status: "scoring", error: null });
        setTimeout(() => fetchDeck(), 4000);
        return;
      }
      scoringTries.current = 0;
      dispatch({ type: "__replace", state: initialDeck(deck) });
      setDeckProfileId(deck.profileId ?? null);
      // ⛔ The deal plays on the day's FIRST open only — the server says whether this request dealt.
      // Once per day, not per navigation, or the signal that today's draft is new means nothing.
      setDealing(!!deck.dealtNow);
      setLoad({ status: "ready", error: null });
    } catch (e) {
      setLoad({ status: "error", error: e.message || "The deck could not be dealt." });
    }
  }, [deckOrder]);
  useEffect(() => { fetchDeck(); }, [fetchDeck]);
  // The deal is an arrival, not a mode: once it has played, later moves are ordinary rotations.
  useEffect(() => {
    if (!dealing) return;
    const id = setTimeout(() => setDealing(false), 2200);
    return () => clearTimeout(id);
  }, [dealing]);

  const s = state;
  const current = s.cards[s.index];
  const order = useMemo(() => fanOrder(s), [s]);
  const tally = counts(s);
  // A trial account's cards carry their score (server.js): the deck reads "Best match first · Drafted N of 2".
  const trialDeck = (s.cards || []).some(c => Number.isFinite(c.score));
  const tool = canUseAPlusResume ? A_PLUS_TOOL : GENERATE_TOOL;
  const canPrev = stepTarget(s, -1) != null;
  const canNext = stepTarget(s, 1) != null;

  const commit = useCallback(async (card, decision) => {
    const id = card.job.id;
    try {
      // The board's Draft / Save / Pass make this exact call (lib/jobDecisions.js) — one behaviour.
      const r = await commitDecision({ jobId: id, decision, tool, surface: DECISION_SURFACES.DECK });
      dispatch({ type: "settled", jobId: id, ...(r.runId != null ? { runId: r.runId } : null) });
      // A59: a Draft behind a running one waits in line — the toast says so instead of "waits for
      // your review", which would be true only once it has run.
      if (r.line) setToast(t => (t && t.jobId === id ? { ...t, line: r.line } : t));
    } catch (e) {
      dispatch({ type: "refused", jobId: id, message: e.message });
      setToast(null);
      setLive(`That did not go through: ${e.message}`);
    }
  }, [tool]);

  const decide = useCallback((decision) => {
    const cur = stateRef.current.cards[stateRef.current.index];
    if (!cur || cur.decision) return;
    // Where the Drafted counter is, relative to the card — measured now, so the card flies to it.
    let target = null;
    const a = faceRef.current?.getBoundingClientRect?.();
    const b = counterRef.current?.getBoundingClientRect?.();
    if (a && b) target = { dx: b.left + b.width / 2 - (a.left + a.width / 2), dy: b.top + b.height / 2 - (a.top + a.height / 2) };
    setLeave({ variant: leaveFor(decision, target, geometry) });
    setExpanded(false);
    dispatch({ type: "decide", decision });
    commit(cur, decision);
    const n = counts(stateRef.current).drafted + (decision === DECISIONS.DRAFTED ? 1 : 0);
    setToast({ jobId: cur.job.id, company: cur.job.company, decision, at: Date.now() });
    setLive(`${VERB[decision]} ${cur.job.title} at ${cur.job.company}. ${decision === DECISIONS.DRAFTED ? `${n} drafted.` : ""}`);
  }, [commit, geometry.zoom]);   // eslint-disable-line react-hooks/exhaustive-deps

  const step = useCallback((dir) => {
    if (stepTarget(stateRef.current, dir) == null) return false;
    setExpanded(false);
    dispatch({ type: "step", dir });
    return true;
  }, []);

  // ⭐ D129 (1) · THE TOUR'S SWEEP: the dealt cards shown from the back to the front, one every DECK_SCROLL_MS (or the
  // tour's quicker `every` when it runs Faster), ending on the best match at the top (index 0); reduced motion jumps
  // straight there. The tour asks with a window event and hears "draft:deck-swept" back — the deck owns its state.
  useEffect(() => {
    let timer = null;
    const done = () => window.dispatchEvent(new CustomEvent("draft:deck-swept"));
    const onSweep = (e) => {
      clearInterval(timer);
      const n = stateRef.current?.cards?.length || 0;
      setExpanded(false);
      if (n <= 1 || reduced) { dispatch({ type: "goto", index: 0 }); done(); return; }
      let i = n - 1;
      dispatch({ type: "goto", index: i });
      timer = setInterval(() => {
        i -= 1;
        dispatch({ type: "goto", index: Math.max(i, 0) });
        if (i <= 0) { clearInterval(timer); done(); }
      }, Number(e.detail?.every) || DECK_SCROLL_MS);
    };
    window.addEventListener("draft:deck-sweep", onSweep);
    // D129 (the facts step): the tour opens the top card so its facts can be lit, and closes it after.
    const onExpand = (e) => setExpanded(!!e.detail?.open);
    window.addEventListener("draft:deck-expand", onExpand);
    return () => { window.removeEventListener("draft:deck-sweep", onSweep); window.removeEventListener("draft:deck-expand", onExpand); clearInterval(timer); };
  }, [reduced]);

  const undo = useCallback(async () => {
    const t = toast;
    if (!t) return;
    setToast(null);
    const card = stateRef.current.cards.find(c => c.job.id === t.jobId);
    try {
      // A dealt card is undecided, so nothing was set before: Undo clears exactly the flag it set.
      await undoDecision({ jobId: t.jobId, decision: t.decision, runId: card?.runId, prior: {} });
      dispatch({ type: "undone", jobId: t.jobId });
      setLive(`Undone. ${card?.job.title} is back.`);
    } catch (e) {
      setLive(`Could not undo: ${e.message}`);
    }
  }, [toast]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(id);
  }, [toast]);

  // Focus follows the deck: after an action or a rotation the front card's heading takes focus (§3.7).
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, [s.index]);
  useEffect(() => { setExpanded(false); }, [s.index]);
  useEffect(() => { if (load.status === "ready") firstPaint.current = false; }, [load.status]);

  // The stage is as tall as the face-up card — which is what lets the expansion push the page.
  useLayoutEffect(() => {
    const el = faceRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setFrontH(el.offsetHeight));
    ro.observe(el);
    setFrontH(el.offsetHeight);
    return () => ro.disconnect();
  }, [current?.job.id, load.status]);

  // The two-panel report mounts as the card opens and stays until its column has closed, so it is
  // pushed shut on the clock rather than vanishing. Reduced motion has no transition to wait for.
  useEffect(() => {
    if (expanded && twoPanel) { setAtsMounted(true); return; }
    if (reduced || !twoPanel) setAtsMounted(false);
  }, [expanded, twoPanel, reduced]);
  // The sheet belongs to the card it was opened on, and only to a narrow screen.
  useEffect(() => { setSheet(false); }, [s.index, twoPanel]);

  // ⛔ SCROLL CAPTURE, only when a rotation is possible. One flick, one card.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    let acc = 0, settleUntil = 0;
    const onWheel = (e) => {
      if (expandedRef.current || e.ctrlKey) return;           // reading, or pinch-zoom: the page's
      const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      const dir = d > 0 ? 1 : -1;
      if (stepTarget(stateRef.current, dir) == null) { acc = 0; return; }   // at an end: let the page scroll
      e.preventDefault();
      const now = performance.now();
      if (now < settleUntil) return;
      acc += d * (e.deltaMode === 1 ? 33 : 1);
      if (Math.abs(acc) >= WHEEL_STEP) { acc = 0; settleUntil = now + WHEEL_SETTLE_MS; step(dir); }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [step, load.status, isFinished(state)]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || e.target?.isContentEditable) return;
      const k = e.key;
      if (k === "d" || k === "D" || k === "ArrowRight") { e.preventDefault(); decide(DECISIONS.DRAFTED); }
      else if (k === "x" || k === "X" || k === "ArrowLeft") { e.preventDefault(); decide(DECISIONS.PASSED); }
      else if (k === "s" || k === "S") { e.preventDefault(); decide(DECISIONS.SAVED); }
      else if (k === "u" || k === "U") { e.preventDefault(); undo(); }
      // The keyboard does everything the wheel does. ↑/↓ only while folded — expanded, they read.
      else if (k === "j" || k === "J") { e.preventDefault(); step(1); }
      else if (k === "k" || k === "K") { e.preventDefault(); step(-1); }
      else if ((k === "ArrowDown" || k === "ArrowUp") && !expandedRef.current) { if (step(k === "ArrowDown" ? 1 : -1)) e.preventDefault(); }
      else if (k === "Enter" && tag !== "button" && tag !== "a") { e.preventDefault(); setExpanded(v => !v); }
      else if (k === "Escape") { if (sheetRef.current) setSheet(false); else setExpanded(false); setLegend(false); }
      else if (k === "?") setLegend(v => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decide, undo, step]);

  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const vertical = orientation === "vertical";
  sheetRef.current = sheet;
  const stageH = Math.max(size.height, frontH || 0);
  const dealTotal = Math.min(order.length, geometry.visible + 1);

  return (
    // D32: the pair's two halves — the report and the posting — share one hover link (lib/pairLink.js).
    <PairLinkProvider>
    <MotionConfig reducedMotion="user">
      {/* ⛔ The fan runs past the screen's edge on purpose, and must never scroll the page sideways.
          Measured: expanded at 1440 the arc sliding right made the page 1820px wide (1667 at 1280),
          and the resting fan at 1100 was 1px over. `clip`, not `hidden`: clip makes no scroll
          container, so the sticky action row and the sticky Collapse keep working. Full width, so
          the arc riding right with an open card's column is clipped at the SCREEN's edge. */}
      <div data-deck-clip style={{ overflowX: "clip" }}>
      {/* isolation: the fan's tiers are below CONTENT, and this keeps them above the page itself. */}
      <div data-deck-orientation={orientation} data-deck-two-panel={twoPanel ? "" : undefined}
        style={{ maxWidth: twoPanel ? TWO_PANEL.maxWidth + 2 * TWO_PANEL.pad : vertical ? 560 : 760, margin: "0 auto",
                 padding: vertical ? "20px 16px 120px" : "28px 16px 140px",
                 // ⛔ D92: never `clip` here, in either layout. Clipping this 560px column sliced the vertical fan's
                 // outer cards with two hard vertical lines (the "cut out and pasted" deck); the full-width
                 // data-deck-clip above already stops a sideways page scroll, at the SCREEN's edge.
                 position: "relative", isolation: "isolate", overflowX: "visible",
                 // ⭐ THE ONE CLOCK (A40): every rule in the expansion reads these two; none restates a
                 // duration. Reduced motion stops all four movements at once.
                 "--deck-t": reduced ? "0s" : EXPAND_CLOCK.duration, "--deck-ease": EXPAND_CLOCK.ease }}>
        <CardBackDefs />
        <div aria-live="polite" style={visuallyHidden}>{live}</div>
        {/* The header and every non-deck state keep the deck's resting width; only the deck's grid is wide. */}
        <div style={{ maxWidth: vertical ? 560 : 760, margin: "0 auto" }}>

        <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: vertical ? 18 : 22,
                         flexWrap: "wrap", position: "relative", zIndex: Z.CONTENT }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: "clamp(36px, 5vw, 54px)", lineHeight: 1, margin: 0, color: C.INK }}>
              Today's draft
            </h1>
            <div style={{ fontSize: 14, color: C.INK_MUTED, marginTop: 8 }}>
              {dateLabel}
              {load.status === "ready" && s.reason === "thin" && ` · ${s.size} good ${s.size === 1 ? "one" : "ones"} today`}
            </div>
          </div>
          {load.status === "ready" && s.size > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {!isFinished(s) && <DeckGeometryControl orientation={orientation} pref={deckPref} onChoose={chooseDeckPref} reduced={!!reduced} />}
              {!isFinished(s) && <DeckOrderControl order={deckOrder} onChoose={chooseDeckOrder} />}
              <SlashProgress drafted={tally.drafted} size={s.size} />
              {!isFinished(s) && (
                // The counter is also what makes the fan's clipped edges read as deliberate: it says
                // where you are in a stack that runs past the frame.
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <StepButton dir={-1} onClick={() => step(-1)} disabled={!canPrev} />
                  <div data-deck-counter style={{ fontSize: 14, fontWeight: 700, color: C.INK, minWidth: 44, textAlign: "center" }}>
                    {Math.min(s.index + 1, s.size)} <span style={{ color: C.INK_FAINT, fontWeight: 600 }}>/ {s.size}</span>
                  </div>
                  <StepButton dir={1} onClick={() => step(1)} disabled={!canNext} />
                </div>
              )}
              <motion.span ref={counterRef} key={tally.drafted} initial={{ scale: 1.35 }} animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 18 }}
                style={{ ...glass({ radius: 10 }), padding: "6px 12px", fontSize: 13, fontWeight: 800, color: C.INK, display: "inline-block" }}>
                {trialDeck ? `Best match first · Drafted ${tally.drafted} of 2` : `Drafted ${tally.drafted}`}
              </motion.span>
            </div>
          )}
        </header>

        {(load.status === "loading" || load.status === "scoring") && (
          <div style={{ ...glass({ radius: 28 }), padding: 40, minHeight: 340, display: "grid", placeItems: "center", color: C.INK_MUTED, textAlign: "center" }}
            data-deck-scoring={load.status === "scoring" ? "" : undefined}>
            {load.status === "scoring"
              ? "Reading today's postings against this résumé. Your best matches will be here in a few seconds…"
              : "Dealing today's draft…"}
          </div>
        )}

        {load.status === "error" && (
          <div role="alert" style={{ ...glass({ radius: 28 }), padding: 36 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.INK, marginBottom: 8 }}>Today's draft could not be dealt.</div>
            <div style={{ fontSize: 14, color: C.INK_MUTED, marginBottom: 18 }}>{load.error}</div>
            <button type="button" onClick={fetchDeck} style={{ ...glass({ radius: 12 }), padding: "10px 18px", fontWeight: 800, color: C.INK, cursor: "pointer" }}>Try again</button>
          </div>
        )}

        {load.status === "ready" && s.size === 0 && (() => {
          // Three different empties, each with its own way forward (§3.6). A brand-new account — a
          // first Google sign-in creates one — has no profile and no résumé: that is set-up, not an error.
          const copy = {
            // A104: the résumé sets the first profile up — one upload, and the deck is dealt.
            no_profile: ["Start with your résumé.",
              "Today's draft is dealt from jobs ranked against your résumé. Upload it and draft reads the roles you want and the skills you have, sets up your first job profile, and deals your first draft straight away.",
              []],
            no_resume: ["Add your résumé to get today's draft.",
              "Fit is judged against your résumé, so there is nothing to rank until it's there. It takes a minute, and nothing is sent anywhere.",
              [["/app/job-profiles", "Add your résumé →"], ["/app/jobs", "Full House"]]],
            empty: ["Nothing strong enough today.",
              "Today's draft only deals Strong and Moderate matches you haven't decided yet, and there are none right now. A thin résumé makes most jobs read as weak — adding detail changes this more than anything else.",
              [["/app/jobs", "All jobs →"], ["/app/job-profiles", "Improve your profile →"]]],
          }[s.reason] || null;
          const [title, body, links] = copy || [null, null, []];
          return (
            <div style={{ ...glass({ radius: 28 }), padding: "40px 36px" }} data-deck-empty={s.reason || "empty"}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 34, color: C.INK, marginBottom: 10 }}>{title || "Nothing strong enough today."}</div>
              <p style={{ fontSize: 15, color: C.INK_MUTED, lineHeight: 1.6, margin: "0 0 22px" }}>{body}</p>
              <div style={{ display: "flex", gap: 18, fontWeight: 800, fontSize: 14.5, flexWrap: "wrap" }}>
                {links.map(([to, label]) => <Link key={to} to={to} style={{ color: C.ACCENT_INK }}>{label}</Link>)}
              </div>
              {s.reason === "no_profile" && (
                <StartFromResume onDone={() => fetchDeck()} onManual={() => navigate("/app/job-profiles")} />
              )}
            </div>
          );
        })()}

        {load.status === "ready" && s.size > 0 && isFinished(s) && (
          <EndOfDeck s={s} tally={tally} needsReview={needsAttentionCount} onUndo={toast ? undo : null} />
        )}
        </div>

        {load.status === "ready" && (current || order.length > 0) && !isFinished(s) && (
          // ⭐ THE GRID IS THE TRICK (A40): the report's column goes 0fr → 1fr and PUSHES the card's
          // column right — the card is never animated to a new place, and the fan, living in the card's
          // column, rides right with it. minmax(0, …) so a closed column is truly zero wide.
          <div data-deck-grid onTransitionEnd={(e) => { if (e.target === e.currentTarget && !expanded) setAtsMounted(false); }}
            style={{ display: "grid", alignItems: "start",
                     gridTemplateColumns: twoPanel ? `minmax(0, ${expanded ? 1 : 0}fr) minmax(0, 1fr)` : "minmax(0, 1fr)",
                     columnGap: twoPanel && expanded ? TWO_PANEL.gap : 0,
                     transition: `grid-template-columns ${ON_THE_CLOCK}, column-gap ${ON_THE_CLOCK}` }}>
            {twoPanel && (
              // `clip`, not `hidden`: no scroll container, so the page — not this column — scrolls the report.
              // flex-end: while the column is narrower than the report, the report overflows to the LEFT
              // (start) side and is clipped there — so it is uncovered from behind the card, edge first.
              // (marginLeft: auto cannot do this: an over-wide child's auto margin resolves to 0.)
              // D32: the column STRETCHES to the card's height so the report inside it can be STICKY — the
              // score stays beside the posting as the reader scrolls it.
              <div data-deck-ats-col style={{ minWidth: 0, overflowX: "clip", display: "flex", justifyContent: "flex-end", alignSelf: "stretch" }}>
                {atsMounted && current && !current.decision && (
                  // As wide as its OPEN column from the first frame, pinned to the column's right edge: it
                  // is uncovered from behind the card as the column grows, never reflowed while it does.
                  <aside id="deck-ats" aria-label="The ATS report" {...inertIf(!expanded)}
                    style={{ ...glass({ radius: 24 }), backgroundImage: "none", backgroundColor: C.SURFACE_MENU,
                             width: size.width, flexShrink: 0, boxSizing: "border-box", padding: "18px 6px 10px",
                             // ⭐ D32: STICKY, under the fixed top bar; a report taller than the screen scrolls
                             // inside itself rather than running off the bottom.
                             position: "sticky", top: `calc(var(${CHROME_HEIGHT_VAR}, 74px) + 10px)`, alignSelf: "flex-start",
                             maxHeight: `calc(100vh - var(${CHROME_HEIGHT_VAR}, 74px) - 20px)`, overflowY: "auto",
                             overscrollBehavior: "contain", zIndex: Z.CONTENT }}>
                    <div style={{ ...sectionLabel, padding: "0 16px" }}>The ATS report</div>
                    <DeckAtsReport card={current} profileId={deckProfileId}
                      onReport={transitionClick(navigate, jobDetailHref(current.job.id), { awaitTitle: current.job.id })} />
                  </aside>
                )}
              </div>
            )}

            <div data-deck-col style={{ minWidth: 0 }}>
              <div ref={stageRef} data-deck-stage
                // The stage is the face-up card's box; the fan overflows it on purpose, behind the
                // header above and the action row below. Its height FOLLOWS the card (measured each
                // frame as the posting grows) — a transition of its own would lag the clock.
                style={{ position: "relative", height: stageH }}>
                {/* EVERY undecided card stays mounted, the far ones invisible: only a DECISION may
                    remove a card, so only a decided card ever plays an exit. */}
                <AnimatePresence initial custom={leave}>
                  {order.map((e) => (
                    <FanCard key={e.card.job.id} entry={e} orientation={orientation} geometry={geometry} size={size}
                      expanded={expanded} twoPanel={twoPanel} dimmed={expanded} dealing={dealing} appear={!firstPaint.current} reduced={!!reduced} dealRank={Math.max(0, dealTotal - 1 - Math.abs(e.offset))}
                      dealTotal={dealTotal} onDecide={decide} onExpand={() => setExpanded(true)} onCollapse={() => setExpanded(false)}
                      // The signal line: beside the card on a wide screen (it opens the card), a sheet on a narrow one.
                      onSignal={() => (twoPanel ? setExpanded(true) : setSheet(true))}
                      onReport={transitionClick(navigate, jobDetailHref(e.card.job.id), { awaitTitle: e.card.job.id })} onGoto={(i) => dispatch({ type: "goto", index: i })} headingRef={headingRef} faceRef={faceRef} />
                  ))}
                </AnimatePresence>
              </div>

              {/* ⛔ The action row STICKS: an expanded card is tall, and Pass / Save / Draft must stay
                  reachable without scrolling back. It is above the fan by tier, and in the card's own
                  column, so it travels with the card when the report opens. */}
              <div data-deck-actions style={{ position: "sticky", bottom: 16, zIndex: Z.NAV, display: "flex", gap: 12,
                                              marginTop: vertical ? 18 : 22, maxWidth: size.width, marginLeft: "auto", marginRight: "auto" }}>
                <ActionButton label="Pass" hint="X" ariaKeys="X ArrowLeft" compact={vertical} onClick={() => decide(DECISIONS.PASSED)} />
                <ActionButton label="Save" hint="S" ariaKeys="S" compact={vertical} onClick={() => decide(DECISIONS.SAVED)} />
                <ActionButton label="Draft" hint="D" ariaKeys="D ArrowRight" compact={vertical} primary onClick={() => decide(DECISIONS.DRAFTED)} />
              </div>
            </div>
          </div>
        )}

        {/* The phone's report (A40): a sheet, opened by the card's signal line. */}
        <AnimatePresence>
          {sheet && !twoPanel && current && !current.decision && (
            <AtsSheet key="ats-sheet" card={current} profileId={deckProfileId} onClose={() => setSheet(false)}
              onReport={transitionClick(navigate, jobDetailHref(current.job.id), { awaitTitle: current.job.id })} />
          )}
        </AnimatePresence>

        <DecisionToast toast={toast} onUndo={undo} undoKey="U" />

        {legend && (
          <div role="dialog" aria-label="Keyboard shortcuts" style={{ ...glass({ radius: 18 }), backgroundColor: C.SURFACE_MENU, position: "fixed", right: 24, bottom: 96,
                                                                    zIndex: Z.NAV, padding: "16px 20px", fontSize: 13.5, color: C.INK }}>
            {[["D  →", "Draft — queue it for your review"], ["X  ←", "Pass — it won't come back"], ["S", "Save for later"],
              ["U", "Undo the last one"], ["J ↓ / K ↑", "Next / previous card (as the wheel does)"], ["Enter", "Open the posting in the card"],
              ["Esc", "Collapse"], ["?", "This list"]].map(([k, v]) => (
              <div key={k} style={{ display: "flex", gap: 14, padding: "3px 0" }}><span style={{ ...kbd, minWidth: 64, textAlign: "center" }}>{k}</span>{v}</div>
            ))}
          </div>
        )}
      </div>
      </div>
    </MotionConfig>
    </PairLinkProvider>
  );
}
