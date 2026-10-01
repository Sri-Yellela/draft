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
import { C } from "../styles/colorTokens.js";
import { Z } from "../styles/zLayers.js";
import { glass } from "../styles/glass.js";
import { bandChipStyle } from "../styles/bandStyle.js";
import { atsBandLabel } from "../../../shared/atsBands.js";
import CompanyIcon from "../components/ui/CompanyIcon.jsx";
import CardBack, { CardBackDefs } from "../components/CardBack.jsx";
import { useViewport } from "../hooks/useViewport.js";
import { CHROME_HEIGHT_VAR } from "../hooks/useChromeHeight.js";
import { useAutoApply } from "../contexts/AutoApplyContext.jsx";
import { jobDetailHref } from "../lib/jobUrl.js";
import { TITLE_ATTR, transitionClick } from "../lib/viewTransitions.js";
import { A_PLUS_TOOL, GENERATE_TOOL } from "../lib/applyTools.js";
import { DECISIONS, counts, deckReducer, fanOrder, initialDeck, isFinished, stepTarget } from "../lib/deckState.js";
import { cardSize, expandedLayout, fanTransform, geometryFor, orientationFor } from "../lib/fanGeometry.js";
import DeckGeometryControl from "../components/DeckGeometryControl.jsx";
import { useDeckGeometry } from "../hooks/useDeckGeometry.js";

const SWIPE_COMMIT_PX = 80;          // the same commit distance as Android's SOFT_OFFSET
const TOAST_MS = 5000;
const WHEEL_STEP = 60;               // accumulated wheel delta for one card
const WHEEL_SETTLE_MS = 140;         // one trackpad flick is many events; rotate once per flick
const localDate = () => new Date().toLocaleDateString("en-CA");   // YYYY-MM-DD in the user's zone
// Development only: lets the geometry be swept from the console while looking (queue 27's reach
// sweep). Production reads geometryFor (the user's layout, fitted) and nothing else.
const DEV_FAN = import.meta.env?.DEV ? globalThis.__DECK_FAN__ : null;

const VERB = { drafted: "Drafted", passed: "Passed", saved: "Saved" };
const AFTER = {
  drafted: "it waits for your review — nothing is sent until you approve it",
  passed: "it won't come back",
  saved: "it's in Saved on the board",
};

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
  const cur = job.salaryCurrency && job.salaryCurrency !== "USD" ? `${job.salaryCurrency} ` : "$";
  const k = (v) => `${cur}${Math.round(v / 1000)}k`;
  if (job.salaryMin != null && job.salaryMax != null) return `${k(job.salaryMin)}–${k(job.salaryMax)}`;
  return null;   // never a range from one bound (SWIPE_FEED_DESIGN §2.2)
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

function Chip({ children, tone = "neutral" }) {
  const tones = {
    good:    { background: C.SUCCESS_QUIET, color: C.SUCCESS, border: `1px solid ${C.SUCCESS}33` },
    neutral: { background: "transparent",   color: C.INK_MUTED, border: `1px solid ${C.BORDER_STRONG}` },
  };
  return <span style={{ ...tones[tone], padding: "4px 10px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap" }}>{children}</span>;
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
    <button type="button" onClick={onClick} disabled={disabled} aria-keyshortcuts={dir < 0 ? "K ArrowUp" : "J ArrowDown"}
      aria-label={dir < 0 ? "Previous card" : "Next card"}
      style={{ ...glass({ radius: 999 }), width: 32, height: 32, display: "grid", placeItems: "center", padding: 0,
               color: C.INK, fontSize: 16, fontWeight: 800, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.4 : 1 }}>
      {dir < 0 ? "‹" : "›"}
    </button>
  );
}

// ── the expansion's two pieces: the ATS report and the posting (queue 40) ─────────────────────
// ONE definition of each, rendered either INSIDE the card (stacked — below THREE_COL_PX) or in the
// two panels that flank it. The content is what the card already carried: the band and its blurb,
// the matched / missing terms from the same stored report the band came from (dailyDraft's
// whyFromReport), and the posting's own text. Nothing here is new information.
const sectionLabel = { fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: C.INK_FAINT, marginBottom: 8 };

function WhyChips({ why }) {
  return (
    <>
      {why.matched?.length > 0 && (
        <section style={{ marginBottom: 14 }}>
          <div style={sectionLabel}>Why it's here</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {why.matched.map(s => <Chip key={s} tone="good">{s}</Chip>)}
            {why.matchedTotal > why.matched.length && <Chip tone="good">+{why.matchedTotal - why.matched.length} you show</Chip>}
          </div>
        </section>
      )}
      {why.missing?.length > 0 && (
        <section>
          <div style={sectionLabel}>Not on your résumé yet</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {why.missing.map(s => <Chip key={s}>{s}</Chip>)}
          </div>
        </section>
      )}
    </>
  );
}

function BandLine({ band }) {
  const bandMeta = atsBandLabel(band);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
      <span style={{ ...bandChipStyle(band), padding: "4px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 800 }}>{bandMeta.label}</span>
      <span style={{ fontSize: 13, color: C.INK_MUTED }}>{bandMeta.blurb}</span>
    </div>
  );
}

function PostingText({ job }) {
  const text = String(job.description || "").trim();
  return text
    ? <p style={{ fontSize: 14.5, lineHeight: 1.7, color: C.INK, whiteSpace: "pre-wrap", margin: 0 }}>{text}</p>
    : <p style={{ fontSize: 14, color: C.INK_MUTED, margin: 0 }}>The posting's text is not stored. Open it at the source.</p>;
}

function PostingLinks({ job, onReport }) {
  return (
    <div style={{ display: "flex", gap: 18, marginTop: 16, flexWrap: "wrap", fontSize: 13.5, fontWeight: 700 }}>
      {(job.applyUrl || job.url) && <a href={job.applyUrl || job.url} target="_blank" rel="noreferrer" style={{ color: C.ACCENT_INK }}>The posting ↗</a>}
      <Link to={jobDetailHref(job.id)} onClick={onReport} style={{ color: C.ACCENT_INK }}>Full report on the board →</Link>
    </div>
  );
}

// The two flanking panels. The opaque menu surface, so they read over the arc that slides behind the
// right one; each scrolls on its own, so a long posting never makes the page any taller than the
// screen. They grow out from behind the card — transform and opacity only, under the one MotionConfig.
const FLANK_MIN_H = 380;
function FlankPanel({ id, label, side, box, children }) {
  const from = side === "left" ? 40 : -40;
  return (
    <motion.aside id={id} aria-label={label} tabIndex={0} data-deck-flank={side}
      initial={{ opacity: 0, x: from }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: from, transition: { duration: 0.12 } }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      style={{ ...glass({ radius: 24 }), backgroundImage: "none", backgroundColor: C.SURFACE_MENU, position: "absolute", top: 0,
               left: `calc(50% + ${box.x}px)`, width: box.width, boxSizing: "border-box",
               // Ends ABOVE the sticky action row (stage top ~205px + the row's 16 + 54 + its margin):
               // 230 let the posting run underneath Pass / Save / Draft on a 900px screen.
               maxHeight: "calc(100vh - 300px)", minHeight: FLANK_MIN_H, overflowY: "auto", overscrollBehavior: "contain",
               padding: "24px 24px 22px", zIndex: Z.CONTENT, outline: "none" }}>
      {children}
    </motion.aside>
  );
}

// ⛔ The label is "Collapse". One word — not "click to collapse", not "fold the card".
function CollapseButton({ onCollapse, controls }) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" onClick={onCollapse} aria-expanded="true" aria-controls={controls} aria-keyshortcuts="Escape"
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      // The opaque menu surface: it rides over the posting's text as the reader scrolls.
      style={{ ...glass({ hover: hov, radius: 999 }), backgroundImage: "none", backgroundColor: C.SURFACE_MENU,
               padding: "7px 14px", fontSize: 13, fontWeight: 800, color: C.INK, cursor: "pointer" }}>
      Collapse
    </button>
  );
}

// ── the face-up side: the card that shipped, plus the expansion ─────────────────────────────
// `detail` says where the expansion goes: "inline" grows the card downward (the stacked fallback),
// "flank" keeps the card's face and lets the two panels beside it carry the rest.
function CardFace({ card, headingRef, isFront, expanded, onExpand, onCollapse, onReport, orientation, detail = "inline" }) {
  const { job, why = {}, band } = card;
  const meta = [job.location, workModel(job), salary(job), ago(job)].filter(Boolean);
  const titleId = `deck-title-${job.id}`;
  const vertical = orientation === "vertical";
  const flank = isFront && expanded && detail === "flank";
  const open = isFront && expanded;
  return (
    <div style={{ padding: vertical ? "22px 22px 20px" : "28px 30px 24px" }}>
      {/* ⭐ COLLAPSE AT THE TOP TOO (queue 39), and STICKY — the bottom one is a whole posting away.
          A zero-height sticky row, so the button rides down with the reader without pushing the
          card's content; it sits just under the fixed top bar (its measured height, published). */}
      {open && (
        <div data-deck-collapse-top style={{ position: "sticky", top: `calc(var(${CHROME_HEIGHT_VAR}, 46px) + 10px)`, height: 0 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", transform: vertical ? "translate(8px, -10px)" : "translate(12px, -14px)" }}>
            <CollapseButton onCollapse={onCollapse} controls={flank ? "deck-ats deck-posting" : "deck-detail"} />
          </div>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 14, paddingRight: open ? 104 : 0 }}>
        <CompanyIcon company={job.company} iconUrl={job.companyIconUrl} size={vertical ? 48 : 56} radius={16} />
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

      {/* Flanked, the evidence has MOVED to the ATS panel on the left — rearranged, not repeated. */}
      {!flank && <WhyChips why={why} />}

      {/* ⭐ EXPANSION IS THE DETAIL — the same element, grown. No modal, no second view. Stacked
          below THREE_COL_PX; above it the same pieces flank the card instead (queue 40). */}
      {isFront && expanded && detail === "inline" && (
        <motion.section id="deck-detail" aria-label="The posting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}
          style={{ marginTop: 22, paddingTop: 20, borderTop: `1px solid ${C.BORDER}` }}>
          <BandLine band={band} />
          <PostingText job={job} />
          <PostingLinks job={job} onReport={onReport} />
        </motion.section>
      )}

      {isFront && (
        <button type="button" onClick={expanded ? onCollapse : onExpand} aria-expanded={expanded}
          aria-controls={expanded ? (flank ? "deck-ats deck-posting" : "deck-detail") : undefined}
          aria-keyshortcuts={expanded ? "Escape" : "Enter"}
          style={{ marginTop: 20, padding: 0, background: "transparent", border: "none", cursor: "pointer",
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

function FanCard({ entry, orientation, geometry, size: baseSize, expanded, flank, dimmed, dealing, appear, dealRank, dealTotal, reduced,
                   onDecide, onExpand, onCollapse, onReport, onGoto, headingRef, faceRef }) {
  const { card, offset } = entry;
  const isFront = offset === 0;
  // Flanked (queue 40): the front card narrows to its column and shifts right, and the backs slide
  // right with the arc, behind the posting — through the SAME transform the rotation uses.
  const t = fanTransform(offset, orientation, geometry, flank);
  // Its evidence moved to the ATS panel, so it is as tall as what is left on it, not the resting 380.
  const size = isFront && flank ? { width: flank.card.width, height: 0 } : baseSize;
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
                                     onExpand={onExpand} onCollapse={onCollapse} onReport={onReport} orientation={orientation}
                                     detail={flank ? "flank" : "inline"} />}
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
              <CompanyIcon company={c.job.company} iconUrl={c.job.companyIconUrl} size={28} radius={8} />
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
        <Link to="/app/jobs" onClick={transitionClick(navigate, "/app/jobs")} style={{ ...glass({ radius: 14 }), padding: "12px 20px", fontWeight: 800, color: C.INK, textDecoration: "none" }}>All jobs</Link>
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
  const [flankH, setFlankH] = useState(0);
  const [stageBox, setStageBox] = useState(null);   // { vw: the layout width, cx: the stage's centre }
  const headingRef = useRef(null);
  const faceRef = useRef(null);
  const stageRef = useRef(null);
  const counterRef = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
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
  const size = cardSize(orientation, vw);
  // Three columns only when expanded, horizontal and wide enough; otherwise null and the card stacks.
  const flank = expanded && orientation === "horizontal" && stageBox ? expandedLayout(stageBox.vw, stageBox.cx) : null;

  const fetchDeck = useCallback(async () => {
    setLoad({ status: "loading", error: null });
    try {
      const deck = await api(`/api/draft/today?date=${encodeURIComponent(localDate())}`);
      dispatch({ type: "__replace", state: initialDeck(deck) });
      // ⛔ The deal plays on the day's FIRST open only — the server says whether this request dealt.
      // Once per day, not per navigation, or the signal that today's draft is new means nothing.
      setDealing(!!deck.dealtNow);
      setLoad({ status: "ready", error: null });
    } catch (e) {
      setLoad({ status: "error", error: e.message || "The deck could not be dealt." });
    }
  }, []);
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
  const tool = canUseAPlusResume ? A_PLUS_TOOL : GENERATE_TOOL;
  const canPrev = stepTarget(s, -1) != null;
  const canNext = stepTarget(s, 1) != null;

  const commit = useCallback(async (card, decision) => {
    const id = card.job.id;
    try {
      if (decision === DECISIONS.DRAFTED) {
        const r = await api("/api/apply/runs", { method: "POST",
          body: JSON.stringify({ jobIds: [id], mode: "auto", tool, surface: "deck" }) });
        dispatch({ type: "settled", jobId: id, runId: r.runId });
      } else {
        await api("/api/jobs/interact", { method: "PATCH",
          body: JSON.stringify(decision === DECISIONS.PASSED ? { jobId: id, disliked: true } : { jobId: id, starred: true }) });
        dispatch({ type: "settled", jobId: id });
      }
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

  const undo = useCallback(async () => {
    const t = toast;
    if (!t) return;
    setToast(null);
    const card = stateRef.current.cards.find(c => c.job.id === t.jobId);
    try {
      if (t.decision === DECISIONS.DRAFTED) {
        const runId = card?.runId;
        if (runId) {
          const run = await api(`/api/apply/runs/${runId}`);
          const rj = (run.jobs || run.run?.jobs || []).find(j => (j.jobId ?? j.job_id) === t.jobId);
          if (rj) await api(`/api/apply/run-jobs/${rj.id}/abort`, { method: "POST" });
        }
      } else {
        await api("/api/jobs/interact", { method: "PATCH",
          body: JSON.stringify(t.decision === DECISIONS.PASSED ? { jobId: t.jobId, disliked: false } : { jobId: t.jobId, starred: false }) });
      }
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

  // Where the stage's centre is, in the LAYOUT width — clientWidth, because a scrollbar is not page,
  // and a panel laid out against innerWidth runs under it and scrolls the page sideways.
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const box = { vw: document.documentElement.clientWidth, cx: Math.round(r.left + r.width / 2) };
    setStageBox(b => (b && b.vw === box.vw && b.cx === box.cx ? b : box));
  }, [vw, expanded, load.status]);
  // The flanking panels scroll on their own; the stage is as tall as the taller of them and the card.
  const flanked = !!flank;
  useLayoutEffect(() => {
    if (!flanked) { setFlankH(0); return; }
    const els = [...(stageRef.current?.querySelectorAll("[data-deck-flank]") || [])];
    if (!els.length || typeof ResizeObserver === "undefined") return;
    const measure = () => setFlankH(Math.max(0, ...els.map(e => e.offsetHeight)));
    const ro = new ResizeObserver(measure);
    els.forEach(e => ro.observe(e));
    measure();
    return () => ro.disconnect();
  }, [flanked, current?.job.id]);

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
      else if (k === "Escape") { setExpanded(false); setLegend(false); }
      else if (k === "?") setLegend(v => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decide, undo, step]);

  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const vertical = orientation === "vertical";
  const stageH = Math.max(size.height, frontH || 0, flankH || 0);
  const dealTotal = Math.min(order.length, geometry.visible + 1);

  return (
    <MotionConfig reducedMotion="user">
      {/* ⛔ The fan runs past the screen's edge on purpose, and must never scroll the page sideways.
          Measured: expanded at 1440 the arc sliding right made the page 1820px wide (1667 at 1280),
          and the resting fan at 1100 was 1px over. `clip`, not `hidden`: clip makes no scroll
          container, so the sticky action row and the sticky Collapse keep working. Full width, so
          the panels that flank the card (outside the centred column) are not cut. */}
      <div data-deck-clip style={{ overflowX: "clip" }}>
      {/* isolation: the fan's tiers are below CONTENT, and this keeps them above the page itself. */}
      <div data-deck-orientation={orientation}
        style={{ maxWidth: vertical ? 560 : 760, margin: "0 auto", padding: vertical ? "20px 16px 120px" : "28px 16px 140px",
                 position: "relative", isolation: "isolate", overflowX: vertical ? "clip" : "visible" }}>
        <CardBackDefs />
        <div aria-live="polite" style={visuallyHidden}>{live}</div>

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
                style={{ ...glass({ radius: 999 }), padding: "6px 12px", fontSize: 13, fontWeight: 800, color: C.INK, display: "inline-block" }}>
                Drafted {tally.drafted}
              </motion.span>
            </div>
          )}
        </header>

        {load.status === "loading" && (
          <div style={{ ...glass({ radius: 28 }), padding: 40, minHeight: 340, display: "grid", placeItems: "center", color: C.INK_MUTED }}>
            Dealing today's draft…
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
            no_profile: ["Let's set up your first job profile.",
              "Today's draft is dealt from jobs ranked against a profile — the roles you want and the résumé you'd send. Set one up and your first draft is dealt straight away.",
              [["/app/job-profiles", "Set up a job profile →"]]],
            no_resume: ["Add your résumé to get today's draft.",
              "Fit is judged against your résumé, so there is nothing to rank until it's there. It takes a minute, and nothing is sent anywhere.",
              [["/app/job-profiles", "Add your résumé →"], ["/app/jobs", "All jobs"]]],
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
            </div>
          );
        })()}

        {load.status === "ready" && s.size > 0 && isFinished(s) && (
          <EndOfDeck s={s} tally={tally} needsReview={needsAttentionCount} onUndo={toast ? undo : null} />
        )}

        {load.status === "ready" && (current || order.length > 0) && !isFinished(s) && (
          <>
            <div ref={stageRef} data-deck-stage
              // The stage is the face-up card's box; the fan overflows it on purpose, behind the
              // header above and the action row below.
              style={{ position: "relative", height: stageH, transition: "height 220ms ease" }}>
              {/* EVERY undecided card stays mounted, the far ones invisible: only a DECISION may
                  remove a card, so only a decided card ever plays an exit. */}
              <AnimatePresence initial custom={leave}>
                {order.map((e) => (
                  <FanCard key={e.card.job.id} entry={e} orientation={orientation} geometry={geometry} size={size}
                    expanded={expanded} flank={flank} dimmed={expanded} dealing={dealing} appear={!firstPaint.current} reduced={!!reduced} dealRank={Math.max(0, dealTotal - 1 - Math.abs(e.offset))}
                    dealTotal={dealTotal} onDecide={decide} onExpand={() => setExpanded(true)} onCollapse={() => setExpanded(false)}
                    onReport={transitionClick(navigate, jobDetailHref(e.card.job.id), { awaitTitle: e.card.job.id })} onGoto={(i) => dispatch({ type: "goto", index: i })} headingRef={headingRef} faceRef={faceRef} />
                ))}
              </AnimatePresence>
              {/* ⭐ THE FLANKS (queue 40): the ATS report LEFT, the posting RIGHT, beside the card that
                  expanded and inside its stage — part of the expansion, not a view of their own. */}
              <AnimatePresence>
                {flank && current && !current.decision && [
                  <FlankPanel key="ats" id="deck-ats" label="The ATS report" side="left" box={flank.left}>
                    <div style={sectionLabel}>The ATS report</div>
                    <BandLine band={current.band} />
                    <WhyChips why={current.why || {}} />
                  </FlankPanel>,
                  <FlankPanel key="posting" id="deck-posting" label="The posting" side="right" box={flank.right}>
                    <div style={sectionLabel}>The posting</div>
                    <PostingText job={current.job} />
                    <PostingLinks job={current.job} onReport={transitionClick(navigate, jobDetailHref(current.job.id), { awaitTitle: current.job.id })} />
                  </FlankPanel>,
                ]}
              </AnimatePresence>
            </div>

            {/* ⛔ The action row STICKS: an expanded card is tall, and Pass / Save / Draft must stay
                reachable without scrolling back. It is above the fan by tier. */}
            <div data-deck-actions style={{ position: "sticky", bottom: 16, zIndex: Z.NAV, display: "flex", gap: 12,
                                            marginTop: vertical ? 18 : 22, maxWidth: size.width, marginLeft: "auto", marginRight: "auto" }}>
              <ActionButton label="Pass" hint="X" ariaKeys="X ArrowLeft" compact={vertical} onClick={() => decide(DECISIONS.PASSED)} />
              <ActionButton label="Save" hint="S" ariaKeys="S" compact={vertical} onClick={() => decide(DECISIONS.SAVED)} />
              <ActionButton label="Draft" hint="D" ariaKeys="D ArrowRight" compact={vertical} primary onClick={() => decide(DECISIONS.DRAFTED)} />
            </div>
          </>
        )}

        <AnimatePresence>
          {toast && (
            <motion.div key={toast.at} role="status" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
              // A toast must read over anything, so it is the opaque menu surface, not see-through glass.
              style={{ ...glass({ radius: 16 }), backgroundImage: "none", backgroundColor: C.SURFACE_MENU,
                       // Centred by margins, not left:50% + translate — that shrink-wraps the toast
                       // to HALF the viewport and wrapped it to eight lines on a phone.
                       position: "fixed", left: 0, right: 0, margin: "0 auto", width: "fit-content", bottom: 96, zIndex: Z.NAV,
                       padding: "12px 16px", display: "flex", alignItems: "center", gap: 14, maxWidth: "calc(100vw - 32px)",
                       fontSize: 14, color: C.INK }}>
              <span><strong>{VERB[toast.decision]}</strong> {toast.company} — {AFTER[toast.decision]}</span>
              <button type="button" onClick={undo} style={{ background: "transparent", border: "none", color: C.ACCENT_INK,
                fontWeight: 800, cursor: "pointer", display: "flex", gap: 6, alignItems: "center" }}>
                Undo <span style={kbd}>U</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

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
  );
}
