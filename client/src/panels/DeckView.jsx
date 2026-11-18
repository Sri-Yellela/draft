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
// ⭐ D168 (owner 11-06, concept B): THE WHEEL HAS ONE JOB — over the deck it turns it, one flick one card, and it never
// opens or folds anything; elsewhere (and while a posting is open) it scrolls the page. A press or Enter opens.
// ⛔ Layering by named tier (zLayers.js): --z-fan < --z-content < --z-nav. The fan passes behind the
// header and the action row; only the face-up card rises into the content layer.
// ⛔ No animation gates input (lib/deckState.js): an action commits at once and the fly-out plays on
// the leaving element. ⛔ Every motion honours prefers-reduced-motion — from ONE MotionConfig, so a
// new transition cannot forget it. ⛔ Colours are tokens only; the card shows a band and never a number.
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import { useSyncEvents } from "../hooks/useSyncEvents.js";
import { AnimatePresence, MotionConfig, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { deckWheelHandler } from "../lib/deckWheel.js";
import StartFromResume from "../components/StartFromResume.jsx";
import { useJobBoard } from "../contexts/JobBoardContext.jsx";   // A214: the upload's profile reaches the board
import { C } from "../styles/colorTokens.js";
import { Z } from "../styles/zLayers.js";
import { glass } from "../styles/glass.js";
import { ATS_BAND } from "../../../shared/atsBands.js";
import { AtsBandCard, fromDeckReport } from "../components/AtsReport.jsx";
import PostingPanel from "../components/PostingPanel.jsx";
import { PairLinkProvider } from "../lib/pairLink.js";
import CompanyLogo from "../components/CompanyLogo.jsx";
import { companyPath } from "../lib/companySlug.js";   // D179: the company name opens its page
import CardBack, { CardBackDefs } from "../components/CardBack.jsx";
import { useViewport } from "../hooks/useViewport.js";
import { CHROME_HEIGHT_VAR } from "../hooks/useChromeHeight.js";
import { useAutoApply } from "../contexts/AutoApplyContext.jsx";
import { registerAssistantActions } from "../lib/assistantBridge.js";   // D190: Ask draft decides the front card through the deck
import { DECK_DECIDE_EVENT, DECK_POST_SLOT_ID, POSTING_ON_DECK_EVENT, POST_FADE_MS, closePostingOnDeck, jobDetailHref, openMatchInPosting, openPostingOnDeck, panelOverPosting } from "../lib/jobUrl.js";
import { TITLE_ATTR, transitionClick } from "../lib/viewTransitions.js";
import { A_PLUS_TOOL, GENERATE_TOOL } from "../lib/applyTools.js";
import { DECISIONS, counts, deckReducer, fanOrder, initialDeck, isFinished, stepTarget } from "../lib/deckState.js";
import { DECISION_SURFACES, DECISION_TOAST_MS, DECISION_VERB, commitDecision, undoDecision } from "../lib/jobDecisions.js";
import DecisionToast from "../components/DecisionToast.jsx";
import { NoteCard } from "../components/TextBlocks.jsx";   // A233: the empties as note cards
import { EXPAND_CLOCK, HOME_CARD, HOME_FAN, HOME_FAN_WIDE, HOME_WIDE, cardSize, fanTransform, geometryFor, homeCardSize, homeDeckColumn, homeFanTransform, homeLandscape, orientationFor } from "../lib/fanGeometry.js";
import { useDeckGeometry } from "../hooks/useDeckGeometry.js";
import { readDeckOrder } from "../lib/deckOrder.js";
import { postingClick } from "../lib/openPosting.js";
import { cardFacts } from "../lib/deckCardFacts.js";
import { shape, ts, TYPE_SCALE_VAR } from "../themes/shapes.js";
import SendJobPicker from "../components/SendJobPicker.jsx";   // D180 P2: Send to a connection

const SWIPE_COMMIT_PX = 80;          // the same commit distance as Android's SOFT_OFFSET
const TOAST_MS = DECISION_TOAST_MS;
// ⭐ D156 (1c) (owner 11-05: "retain how the cards flipped and how they behaved … from the previous version of the daily
// deck, we are only changing the content on it"): Home turns its fan exactly as the deck always has — one flick, one card
// (WHEEL_STEP, WHEEL_SETTLE_MS), J / K, ↑ ↓, ‹ ›; swipe right drafts, left passes. (1b)'s per-gesture flip is gone.
// ⛔ D168 (owner 11-06: "the scroll is assigned to too many things"): the scroll down that opened the front card and the
// scroll up that folded the post are GONE — a press / Enter opens, Esc / "Fold it back" folds; an open post is read by
// scrolling the page.
// ⛔ 44p: the deck's request fails at 8 s with a plain message + Try again (deckNeverSpinsForever), and today's last
// good deal in this tab is kept on screen when a refresh fails (precomputeFailureShowsLastGood). In memory only.
const DECK_TIMEOUT_MS = 8000;
const lastGoodDeck = new Map();      // `${date}|${order}` → the last deck the server dealt
// ⛔ D156 (6) (11-05) · d156DeckShowsLastGoodWhileRefreshing: the last good deal also survives a reload in this tab
// (sessionStorage — the session cache of D153 (6)), so a refresh shows those picks with a quiet "Refreshing…" instead of
// "Dealing today's draft…" while the server is slow (production 11-05 02:52Z: /api/draft/today cut off at 8 s twice).
// Storage can be absent or full: every read and write is guarded, and the Map alone still works.
const LAST_GOOD_PREFIX = "draft.deck.lastGood.";
function rememberDeck(key, deck) {
  lastGoodDeck.set(key, deck);
  try { sessionStorage.setItem(LAST_GOOD_PREFIX + key, JSON.stringify(deck)); } catch { /* no storage: memory only */ }
}
function rememberedDeck(key) {
  if (lastGoodDeck.has(key)) return lastGoodDeck.get(key);
  try {
    const raw = sessionStorage.getItem(LAST_GOOD_PREFIX + key);
    const deck = raw ? JSON.parse(raw) : null;
    if (deck && Array.isArray(deck.cards)) { lastGoodDeck.set(key, deck); return deck; }
  } catch { /* unreadable: no last good */ }
  return null;
}
// YYYY-MM-DD in the user's zone, built from its parts. ⛔ 44e: toLocaleDateString("en-CA") is NOT always YYYY-MM-DD — some
// Safari / Chrome builds answer "11/2/2026", the server refused it (400) and a tester's deck dealt nothing.
const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
// Development only: lets the geometry be swept from the console while looking (queue 27's reach
// sweep). Production reads geometryFor (the user's layout, fitted) and nothing else.
const DEV_FAN = import.meta.env?.DEV ? globalThis.__DECK_FAN__ : null;

// The words, the toast and the calls are the board's too (A53, owner 10-02): lib/jobDecisions.js.
const VERB = DECISION_VERB;

// ── small pieces ────────────────────────────────────────────────────────────────────────────
const visuallyHidden = { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" };
const kbd = { fontSize: ts(11), fontWeight: 700, padding: "1px 6px", borderRadius: 5, border: `1px solid ${C.BORDER_STRONG}`,
              color: C.INK_MUTED, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", lineHeight: "16px" };
const isInteractive = (el) => !!el?.closest?.("a,button,input,textarea,select,[role=button]");

// ⭐ D145: the card's facts (salary · type · mode, the time since posted) are lib/deckCardFacts.js — one function.
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

// ⭐ D145: raised neutral buttons, Draft in the accent with its glow; no key hints on them (the keys stay, said by
// aria-keyshortcuts and the "?" legend).
function ActionButton({ label, onClick, primary, disabled, ariaKeys, compact }) {
  const [hov, setHov] = useState(false);
  const base = primary
    ? { background: hov ? C.ACCENT_HOVER : C.ACCENT, color: C.ON_ACCENT, border: "none", boxShadow: C.DEPTH_ACCENT }
    : { background: C.SURFACE_2, color: C.INK, border: "none", boxShadow: hov ? C.DEPTH_HOVER : C.DEPTH_REST };
  return (
    <motion.button type="button" onClick={onClick} disabled={disabled} aria-keyshortcuts={ariaKeys} data-deck-action={label.toLowerCase()}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} whileTap={{ scale: 0.96 }}
      style={{ ...base, flex: primary ? 1.4 : 1, minHeight: compact ? 48 : 54, borderRadius: shape("RADIUS_CONTROL"), fontSize: ts(15.5), fontWeight: 600,
               fontFamily: shape("FONT_UI"), display: "flex", alignItems: "center", justifyContent: "center", cursor: disabled ? "default" : "pointer",
               opacity: disabled ? 0.5 : 1 }}>
      {label}
    </motion.button>
  );
}

// ⭐ D156 (1b) · ‹ › — turn Home's fan one card back or on (a depth box, D60: never a capsule). ⭐ (1c): the keys that do
// the same are J / K and ↓ / ↑ — the arrows ← → decide (X / D), as the deck always had them.
function FlipButton({ dir, disabled, onFlip }) {
  return (
    <button type="button" data-deck-flip={dir > 0 ? "next" : "prev"} disabled={disabled}
      aria-label={dir > 0 ? "Next card" : "Previous card"} aria-keyshortcuts={dir > 0 ? "J ArrowDown" : "K ArrowUp"} onClick={() => onFlip(dir)}
      style={{ width: 34, height: 34, flex: "none", borderRadius: 10, border: "none", background: C.SURFACE_2, color: C.INK, boxShadow: C.DEPTH_REST,
               fontSize: ts(18), lineHeight: 1, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.4 : 1, fontFamily: "inherit" }}>
      <span aria-hidden="true">{dir > 0 ? "›" : "‹"}</span>
    </button>
  );
}


// ── the expansion (A40) ──────────────────────────────────────────────────────────────────────────────────────
// The posting stays INSIDE the card, growing downward (grid-row 0fr ↔ 1fr on ONE clock, --deck-t / --deck-ease, set
// once on the deck's root, no stagger). ⭐ D152 (8) (b): the report beside the card (A40's two equal panels) and the
// phone's sheet are DELETED — the deck lives only on Home, where the match opens in the board's posting, under its
// facts (option A, docs/sketches/ats-options.html), through lib/jobUrl.js openMatchInPosting.
const ON_THE_CLOCK = "var(--deck-t) var(--deck-ease)";
// `inert` as an attribute — React 18 has no boolean prop for it. Hidden content takes no focus and no clicks.
const inertIf = (hidden) => (hidden ? { inert: "", "aria-hidden": true } : null);

// ⭐ THE TRIAL'S MATCH (11-01: a number in a ring, green and grey marks) is REPLACED by D145's match at the card's top
// right — the number over "résumé match", the same stored score (lib/deckCardFacts.js); the skills are in "Why this job".

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
// "you cover 9 of 12" · the three-segment bar), with the way into the full report (D152 (8): the board's posting).
function CollapsedScore({ card, onOpen }) {
  if (!card.report) return null;
  return (
    <div data-pair-collapsed style={{ marginBottom: 14 }}>
      <AtsBandCard report={fromDeckReport(card.report)} band={card.report.scorable ? card.band : ATS_BAND.NOT_ENOUGH_SIGNAL} compact />
      <button type="button" onClick={onOpen}
        style={{ marginTop: 8, padding: 0, background: "transparent", border: "none", cursor: "pointer",
                 fontSize: ts(13), fontWeight: 700, color: C.ACCENT_INK }}>
        The full report ↑
      </button>
    </div>
  );
}

function PostingLinks({ job, onReport }) {
  return (
    <div style={{ display: "flex", gap: 18, marginTop: 16, flexWrap: "wrap", fontSize: ts(13.5), fontWeight: 700 }}>
      {(job.applyUrl || job.url) && <a href={job.applyUrl || job.url} target="_blank" rel="noreferrer" onClick={(e) => postingClick(job, e)} style={{ color: C.ACCENT_INK }}>The posting ↗</a>}
      <Link to={jobDetailHref(job.id)} onClick={onReport} style={{ color: C.ACCENT_INK }}>Full report on the board →</Link>
    </div>
  );
}

// The deck's frozen report (services/dailyDraft.js deckReport — every section, no number) is converted
// to the report shape by fromDeckReport, which lives WITH the one report implementation
// (components/AtsReport.jsx, A52) — so the deck draws THE SAME report rather than a second one, and no
// file but that one knows a report's field names.


// ⛔ The label is "Collapse". One word — not "click to collapse", not "fold the card".
function CollapseButton({ onCollapse, controls }) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" className="dbx-depth" onClick={onCollapse} aria-expanded="true" aria-controls={controls} aria-keyshortcuts="Escape"
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      // The opaque menu surface: it rides over the posting's text as the reader scrolls.
      style={{ ...glass({ hover: hov, radius: 10 }), backgroundImage: "none", backgroundColor: C.SURFACE_MENU,
               padding: "7px 14px", fontSize: ts(13), fontWeight: 800, color: C.INK, cursor: "pointer" }}>
      Collapse
    </button>
  );
}

// ── the face-up side ─────────────────────────────────────────────────────────────────────────
// ⭐ D145 STEP 3 (owner 11-03, declutter-v7 — docs/sketches/declutter-v7.html). THREE depths:
//   collapsed  the company + location, the résumé match at the top right, the title, ONE info row (salary · type · mode)
//   hover      at most two soft facts and "Why this job? ↓" (pointer over the card, or focus inside it)
//   why        scroll down on the card, or press "Why this job?" — the résumé against the job and the posting's stat
//              cards in the "one screen at a time" type; scroll up at the top of the page folds it
// and the FULL POSTING stays one press away ("The full posting ↓" — the old expansion, unchanged, with the report beside
// it on a wide screen). What each depth says is lib/deckCardFacts.js — one function, nothing said twice.
// ⛔ No coloured labels or boxes on the card (the old band mark, the ring, the green chips); never "ATS".
// ⭐ D179 (45l): exported for the signed-out /jobs deck (pages/jobs/PublicBoardPage.jsx) — the same card, no decisions.
export function CardFace({ card, headingRef, isFront, expanded, why, onWhy, onExpand, onCollapse, onReport, onSignal, orientation }) {
  const { job } = card;
  const facts = cardFacts(card);
  const titleId = `deck-title-${job.id}`;
  const vertical = orientation === "vertical";
  const open = isFront && expanded;
  const deep = isFront && (why || expanded);
  const [hover, setHover] = useState(false);
  const soft = isFront && (hover || deep);
  return (
    <div data-deck-face="" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setHover(false); }}
      // ⭐ D149: declutter-v7.html's card at BOTH widths — 30 / 30 / 26 padding, a 52 px bubble, the 42 px title, a 26 px
      // gap in the info row (the sketch has no phone rule for them; the app used to shrink each on a phone).
      // (Home's card face is HomeCardFace, below — D156.)
      style={{ padding: "30px 30px 26px", fontFamily: shape("FONT_UI") }}>
      {/* ⭐ COLLAPSE AT THE TOP TOO (A39), and STICKY — the bottom one is a whole posting away. */}
      {open && (
        <div data-deck-collapse-top style={{ position: "sticky", top: `calc(var(${CHROME_HEIGHT_VAR}, 74px) + 10px)`, height: 0 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", transform: vertical ? "translate(8px, -10px)" : "translate(12px, -14px)" }}>
            <CollapseButton onCollapse={onCollapse} controls="deck-detail" />
          </div>
        </div>
      )}
      <div data-deck-head="" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, paddingRight: open ? 104 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          <CompanyLogo company={job.company} iconUrl={job.companyIconUrl} size={52} radius={16} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: ts(17), fontWeight: 600, color: C.INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{/* D179: the name opens the company's page */}{companyPath(job.company) ? <Link to={companyPath(job.company)} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
              data-company-link="" style={{ color: "inherit", textDecoration: "none" }}>{job.company}</Link> : job.company}</div>
            {/* ⛔ LOCATION ONLY — "posted … ago" lives in the stats (D145). */}
            {job.location && <div data-deck-location="" style={{ fontSize: ts(14), color: C.INK_MUTED, marginTop: 1 }}>{job.location}</div>}
          </div>
        </div>
        {/* ⭐ THE MATCH, at the top right — "86%" (or the band's word when the card carries no number, G5) over
            "résumé match". It is the way into the full report (D152 (8): the board's posting, its match open);
            data-deck-signal-row keeps the guided tour's match step pointing at it. */}
        {facts.match && (
          <button type="button" data-deck-signal-row="" data-deck-signal="" data-deck-match={facts.match.numeric ? "number" : "band"}
            {...(facts.match.numeric ? { "data-deck-score": parseInt(facts.match.value, 10) } : null)}
            onClick={isFront ? (e) => { e.stopPropagation(); onSignal?.(); } : undefined}
            aria-label={`${facts.match.value} résumé match — open the full report`}
            style={{ flex: "none", textAlign: "right", background: "transparent", border: "none", padding: 0, cursor: isFront ? "pointer" : "default", color: "inherit", fontFamily: "inherit" }}>
            <div style={{ color: C.ACCENT_INK, fontSize: ts(facts.match.numeric ? 34 : 24), fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1 }}>{facts.match.value}</div>
            <div style={{ color: C.INK_MUTED, fontSize: ts(13), marginTop: 4 }}>{facts.match.word}</div>
          </button>
        )}
      </div>

      <h2 id={titleId} ref={isFront ? headingRef : undefined} tabIndex={-1} {...(isFront ? { [TITLE_ATTR]: job.id } : null)}
        // ⭐ The shared element (queue 29): this heading IS the job's title on the board's detail and
        // on the review queue's line — one name, so a navigation moves it instead of cutting.
        style={{ fontFamily: "var(--font-display)", fontWeight: 400, lineHeight: 1.04, letterSpacing: "-0.01em", color: C.INK,
                 fontSize: `calc(42px * var(${TYPE_SCALE_VAR}, 1))`,
                 margin: "16px 0 12px", outline: "none",
                 ...(deep ? null : { display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }) }}>
        {job.title}
      </h2>

      {/* ⭐ ONE minimal info row: each a white value (D182: no label under it — the value says what it is). */}
      {facts.info.length > 0 && (
        <div data-deck-info="" style={{ display: "flex", gap: 26, flexWrap: "wrap", margin: "4px 0 2px" }}>
          {facts.info.map((f) => (
            <div key={f.key} data-deck-info-item={f.key}>
              <b style={{ display: "block", fontWeight: 500, fontSize: ts(18), letterSpacing: "-0.01em", color: C.INK }}>{f.value}</b>
            </div>
          ))}
        </div>
      )}

      {/* ⭐ D179 (owner 11-07): "Works with" — the team's stack, from the posting's own text (useful, new: D182 keeps it). */}
      {job.worksWith?.length > 0 && (
        <div data-works-with="" style={{ color: C.INK_MUTED, fontSize: ts(13), margin: "8px 0 0" }}>Works with {job.worksWith.join(", ")}</div>
      )}

      {card.error && (
        <div role="alert" style={{ background: C.DANGER_QUIET, color: C.DANGER, padding: "10px 14px", borderRadius: 12,
                                   fontSize: ts(13.5), fontWeight: 600, margin: "14px 0 0" }}>
          {card.error}
        </div>
      )}

      {/* HOVER: at most two soft facts, then "Why this job?" — on the expansion's clock. */}
      {isFront && (
        <div data-deck-soft="" style={{ display: "grid", gridTemplateRows: soft ? "1fr" : "0fr", opacity: soft ? 1 : 0,
                                        transition: `grid-template-rows ${ON_THE_CLOCK}, opacity ${ON_THE_CLOCK}` }}>
          <div style={{ minHeight: 0, overflow: "hidden" }}>
            {facts.chips.length > 0 && (
              <div data-deck-chips="" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
                {facts.chips.map((c) => <span key={c} style={{ fontSize: ts(13.5), color: C.INK_MUTED, background: C.SURFACE_2, borderRadius: 10, padding: "5px 11px" }}>{c}</span>)}
              </div>
            )}
            <button type="button" data-deck-why-button="" aria-expanded={!!why} aria-controls="deck-why"
              onClick={(e) => { e.stopPropagation(); onWhy?.(!why); }}
              style={{ marginTop: 16, padding: 0, background: "transparent", border: "none", cursor: "pointer", color: C.ACCENT_INK,
                       fontSize: ts(14), fontWeight: 600, fontFamily: "inherit" }}>
              {why ? "Fold it away ↑" : "Why this job? ↓"}
            </button>
          </div>
        </div>
      )}

      {/* ⭐ WHY THIS JOB — version A's type and stat cards (the sketch's "one screen at a time"). */}
      {isFront && (
        <div data-deck-why-row="" style={{ display: "grid", gridTemplateRows: deep ? "1fr" : "0fr", transition: `grid-template-rows ${ON_THE_CLOCK}` }}>
          <section id="deck-why" aria-label="Why this job" data-deck-why="" style={{ minHeight: 0, overflow: "hidden" }} {...inertIf(!deep)}>
            <div style={{ marginTop: 24, paddingTop: 26, borderTop: `1px solid ${C.BORDER}` }}>
              {facts.why.headline && (
                <>
                  <p style={WHY.eyebrow}>Your résumé against this job</p>
                  <h3 data-deck-why-headline="" style={{ ...WHY.headline, fontSize: vertical ? ts(36) : ts(46) }}>{facts.why.headline}</h3>
                  {(facts.why.matched.length + facts.why.missing.length) > 0 && (
                    <div data-deck-why-chips="" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: facts.why.lead ? 16 : 24 }}>
                      {facts.why.matched.map((t) => <span key={`m-${t}`} data-chip="matched" style={{ ...WHY.chip, color: C.INK, borderColor: C.ACCENT_INK }}>{t}</span>)}
                      {facts.why.missing.map((t) => <span key={`x-${t}`} data-chip="missing" style={WHY.chip}>{t}</span>)}
                    </div>
                  )}
                  {facts.why.lead && <p style={{ ...WHY.lead, fontSize: vertical ? ts(17) : ts(19) }}>{facts.why.lead}</p>}
                </>
              )}
              {facts.stats.length > 0 && (
                <>
                  <p style={WHY.eyebrow}>From the posting</p>
                  <div data-deck-why-stats="" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: "6px 0 20px" }}>
                    {facts.stats.map((st) => (
                      <div key={st.key} data-deck-stat={st.key} style={{ background: C.SURFACE_2, borderRadius: shape("RADIUS_CONTROL"), padding: 20, minWidth: 0 }}>
                        <div style={{ fontSize: ts(34), fontWeight: 500, color: C.ACCENT_INK, letterSpacing: "-0.03em", lineHeight: 1.1, overflowWrap: "anywhere" }}>{st.value}</div>
                        <div style={{ color: C.INK_MUTED, fontSize: ts(14), marginTop: 4 }}>{st.line}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: ts(14), fontWeight: 600 }}>
                <button type="button" onClick={(e) => { e.stopPropagation(); if (expanded) onCollapse(); else onExpand(); }}
                  aria-expanded={!!expanded} aria-controls="deck-detail" data-deck-full-posting="" style={WHY.link}>
                  {expanded ? "Hide the posting ↑" : "The full posting ↓"}
                </button>
                <button type="button" onClick={(e) => { e.stopPropagation(); onSignal?.(); }} style={WHY.link}>The full report</button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* THE FULL POSTING — the old expansion, one press away. The same element, grown. */}
      {isFront && (
        <div data-deck-posting-row style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", transition: `grid-template-rows ${ON_THE_CLOCK}` }}>
          <section id="deck-detail" aria-label="The posting" style={{ minHeight: 0, overflow: "hidden" }} {...inertIf(!open)}>
            <div style={{ marginTop: 18, paddingTop: 20, borderTop: `1px solid ${C.BORDER}` }}>
              <CollapsedScore card={card} onOpen={isFront ? onSignal : undefined} />
              <CardPosting card={card} />
              <PostingLinks job={job} onReport={onReport} />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

// ⭐ D156 (1c) · HOME'S FOLDED CARD (home-sketch.html's .sum — owner 11-05: "use the space on the card wisely, no need to cram
// content and leave space"). A FIXED box — 600 × 372 landscape at ≥ 1440 px, 300 × 420 (5 : 7) narrower, 250 × 350 on a
// phone — and nothing scrolls inside it. The company, location and match; the title, clamped to three lines and CENTRED in
// its column (margin: auto); the info row (known values only); the stats from the old expanded card (lib/deckCardFacts.js
// homeStats — skills matched · experience · level · since posted · sponsorship, at most four) as a 2 × 2 grid, and on the
// landscape card filling the right column as larger cells (22 px values); and "Open the posting", which turns the card
// into the long post IN PLACE (no reason line, no "Why this job", no separate posting panel — D156 (1c)).
const SR_ONLY = { position: "absolute", width: 1, height: 1, margin: -1, padding: 0, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0 };
function HomeCardFace({ card, headingRef, isFront, onSignal, onOpenPost, size, landscape }) {
  const { job } = card;
  const facts = cardFacts(card);
  const titleId = `deck-title-${job.id}`;
  const small = size.width < 280;   // the phone's card
  const pad = landscape ? 26 : small ? 16 : 22;
  const head = (
    <div data-deck-head="" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <CompanyLogo company={job.company} iconUrl={job.companyIconUrl} size={small ? 36 : 42} radius={small ? 11 : 13} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: ts(small ? 14 : 15), fontWeight: 600, color: C.INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{companyPath(job.company) ? <Link to={companyPath(job.company)} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
              data-company-link="" style={{ color: "inherit", textDecoration: "none" }}>{job.company}</Link> : job.company}</div>
          {job.location && <div data-deck-location="" style={{ fontSize: ts(small ? 12 : 13), color: C.INK_MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{job.location}</div>}
        </div>
      </div>
      {facts.match && (
        <button type="button" data-deck-signal-row="" data-deck-signal="" data-deck-match={facts.match.numeric ? "number" : "band"}
          {...(facts.match.numeric ? { "data-deck-score": parseInt(facts.match.value, 10) } : null)}
          onClick={isFront ? (e) => { e.stopPropagation(); onSignal?.(); } : undefined}
          aria-label={`${facts.match.value} résumé match — open the full report`}
          style={{ flex: "none", textAlign: "right", background: "transparent", border: "none", padding: 0, cursor: isFront ? "pointer" : "default", color: "inherit", fontFamily: "inherit" }}>
          <div style={{ color: C.ACCENT_INK, fontSize: ts(small ? 24 : 28), fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 1 }}>{facts.match.value}</div>
          <div style={{ color: C.INK_MUTED, fontSize: ts(11.5) }}>match</div>
        </button>
      )}
    </div>
  );
  const title = (
    <h2 id={titleId} ref={isFront ? headingRef : undefined} tabIndex={-1} {...(isFront ? { [TITLE_ATTR]: job.id } : null)} data-deck-title-line=""
      style={{ fontFamily: "var(--font-display)", fontWeight: 400, lineHeight: 1.08, letterSpacing: "-0.01em", color: C.INK,
               fontSize: `calc(${landscape ? 34 : small ? 22 : 26}px * var(${TYPE_SCALE_VAR}, 1))`,
               // ⭐ centred in the room between the head and the info row — the space used, not left as an empty half.
               margin: "auto 0", outline: "none",
               display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
      {job.title}
    </h2>
  );
  // ⭐ D179: "Works with" under the info row (the team's stack, from the posting's own text).
  const worksWith = job.worksWith?.length > 0 && (
    <div data-works-with="" style={{ color: C.INK_MUTED, fontSize: ts(12), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
      Works with {job.worksWith.join(", ")}</div>
  );
  const infoRow = facts.info.length > 0 && (
    <div data-deck-info="" style={{ display: "flex", gap: small ? 12 : 16, flexWrap: "wrap", overflow: "hidden", maxHeight: small ? 40 : 44 }}>
      {facts.info.map((f) => (
        <div key={f.key} data-deck-info-item={f.key} style={{ flex: "none", minWidth: 0 }}>
          <b style={{ display: "block", fontWeight: 500, fontSize: ts(small ? 13 : 14.5), letterSpacing: "-0.01em", color: C.INK, whiteSpace: "nowrap" }}>{f.value}</b>
        </div>
      ))}
    </div>
  );
  const info = (infoRow || worksWith) ? <>{infoRow}{worksWith}</> : false;
  const stats = facts.homeStats.length > 0 && (
    <dl data-deck-stats="" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: 0,
                                    ...(landscape ? { flex: 1, gridAutoRows: "1fr" } : null) }}>
      {facts.homeStats.map((st) => (
        <div key={st.key} data-deck-stat={st.key} style={{ position: "relative", display: "flex", flexDirection: "column-reverse", justifyContent: "center", background: C.SURFACE_2, borderRadius: 14,
                                                            padding: landscape ? "12px 14px" : small ? "8px 10px" : "10px 12px", minWidth: 0 }}>
          <dt style={st.labelHidden ? SR_ONLY : { margin: 0, fontSize: ts(11.5), color: C.INK_MUTED, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{st.label}</dt>
          <dd style={{ margin: 0, fontSize: ts(landscape ? 22 : small ? 15 : 17), fontWeight: 500, color: C.ACCENT_INK, letterSpacing: "-0.02em", lineHeight: 1.2,
                       whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{st.value}</dd>
        </div>
      ))}
    </dl>
  );
  const open = (
    <button type="button" data-deck-open-posting="" tabIndex={isFront ? undefined : -1} aria-keyshortcuts="Enter"
      onClick={(e) => { e.stopPropagation(); onOpenPost?.(); }}
      style={{ alignSelf: "flex-start", background: "transparent", border: "none", padding: 0, cursor: "pointer", color: C.ACCENT_INK,
               fontSize: ts(13.5), fontWeight: 600, fontFamily: "inherit" }}>
      Open the posting
    </button>
  );
  return (
    <div data-deck-face="" data-deck-home-face={landscape ? "landscape" : "portrait"}
      style={{ boxSizing: "border-box", height: size.height, overflow: "hidden", padding: pad, fontFamily: shape("FONT_UI"),
               display: "flex", flexDirection: landscape ? "row" : "column", gap: landscape ? 24 : small ? 10 : 14 }}>
      <div data-deck-home-left="" style={{ flex: landscape ? 1.15 : 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", gap: small ? 8 : 10 }}>
        {head}{title}{info}
      </div>
      <div data-deck-home-right="" style={{ flex: landscape ? 1 : "none", minWidth: 0, display: "flex", flexDirection: "column", gap: 10,
                                            justifyContent: landscape ? "space-between" : undefined }}>
        {stats}{open}
      </div>
    </div>
  );
}

// The expanded card's type — version A's (the D145 row: the accent eyebrow 14, the large tight headline 46 / 500 /
// −0.035 em (36 on phones), the lead in body grey 19, the stat cards' value 34 in the accent).
const WHY = {
  eyebrow: { color: C.ACCENT_INK, fontSize: ts(14), margin: "0 0 10px" },
  headline: { fontWeight: 500, lineHeight: 1.03, letterSpacing: "-0.035em", margin: "0 0 14px", color: C.INK, fontFamily: shape("FONT_UI") },
  lead: { color: C.INK_MUTED, margin: "0 0 26px", maxWidth: "34ch" },
  chip: { fontSize: ts(13), border: `1px solid ${C.BORDER}`, borderRadius: 9, padding: "3px 9px", color: C.INK_MUTED },
  link: { padding: 0, background: "transparent", border: "none", cursor: "pointer", color: C.ACCENT_INK, fontWeight: 600, fontSize: "inherit", fontFamily: "inherit" },
};

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

function FanCard({ entry, orientation, geometry, size, expanded, dimmed, dealing, appear, dealRank, dealTotal, reduced, home = false, landscape = false,
                   onDecide, onExpand, onCollapse, onReport, onSignal, onGoto, onOpenPost, headingRef, faceRef, why = false, onWhy }) {
  const { card, offset } = entry;
  const isFront = offset === 0;
  // The arc's position. Opening a card does not move it here: the fan lives in the card's grid column,
  // and that column is what moves (A40) — so the arc rides right on the expansion's own clock.
  // ⭐ D152 (2): Home's fan turns each back about the card's lower-left corner (lib/fanGeometry.js homeFanTransform).
  const t = home ? homeFanTransform(offset, geometry) : fanTransform(offset, orientation, geometry);
  const x = useMotionValue(0);
  const tilt = useTransform(x, [-320, 0, 320], [-10, 0, 10]);
  const draftStamp = useTransform(x, [20, SWIPE_COMMIT_PX + 40], [0, 1]);
  const passStamp = useTransform(x, [-SWIPE_COMMIT_PX - 40, -20], [1, 0]);
  const dragged = useRef(false);
  const showFace = Math.abs(offset) <= 1;   // only a card that is, or is about to be, face-up needs one
  const stamp = { position: "absolute", top: 28, right: 26, padding: "6px 14px", borderRadius: 10, fontWeight: 900, fontSize: ts(22),
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
      // D152 (2): on Home the card sits at the column's left, the fan's room to its right.
      style={{ position: "absolute", top: 0, left: home ? 0 : "50%", width: size.width, marginLeft: home ? 0 : -size.width / 2,
               // Layer by TIER: the face-up card is content; the fan sits under it, nearer cards above farther.
               zIndex: isFront ? Z.CONTENT : Z.FAN - t.depth,
               pointerEvents: t.shown ? "auto" : "none", cursor: isFront ? "default" : "pointer" }}>
      <div data-fan-position style={{
          transform: `translate3d(${t.x}px, ${t.y}px, 0) rotate(${t.rotate}deg) scale(${t.scale})`, opacity, transformOrigin: t.origin,
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
            style={{ position: "relative", transformStyle: "preserve-3d", minHeight: size.height, height: isFront && !home ? "auto" : size.height,
                     transform: `perspective(1800px) rotateY(${faceUp ? 0 : 180}deg)`,
                     transition: reduced ? "none" : `transform 520ms ${FLIP_EASE} 40ms` }}>
            <article ref={isFront ? faceRef : undefined} aria-labelledby={`deck-title-${card.job.id}`} aria-hidden={!isFront}
              // ⭐ D156 (1c): a press on Home's front card opens it into the long post (the deck's press opened "Why this job").
              onClick={isFront && !expanded && !why ? (e) => { if (!dragged.current && !isInteractive(e.target)) { if (home) onOpenPost?.(); else onWhy?.(true); } } : undefined}
              // D152 (2): Home's card corner is the sketch's 26. ⭐ D156 (1b): and its box is FIXED — nothing grows or scrolls in it.
              style={{ position: "relative", minHeight: size.height, borderRadius: home ? 26 : 28, ...(home ? { height: size.height, overflow: "hidden" } : null), backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
                       // OPAQUE, not see-through glass: over a fan, a translucent face shows the backs
                       // through it (Android found the same with the next card's text, 09-30).
                       ...glass({ radius: home ? 26 : 28 }), backgroundColor: C.SURFACE_SOLID, backdropFilter: "none", WebkitBackdropFilter: "none",
                       // ⭐ D149: the sketch's card — NO border (no glass rim), its one soft shadow (Dusk's SHADOW_GLASS is the
                       // sketch's 0 30px 70px rgba(0,0,0,.35)).
                       border: "none", boxShadow: C.SHADOW_GLASS,
                       transition: "none", transform: "none",
                       cursor: isFront && !expanded ? "pointer" : "auto", visibility: showFace ? "visible" : "hidden" }}>
              {showFace && home && <HomeCardFace card={card} headingRef={headingRef} isFront={isFront} onSignal={onSignal} onOpenPost={onOpenPost}
                                                 size={size} landscape={landscape} />}
              {showFace && !home && <CardFace card={card} headingRef={headingRef} isFront={isFront} expanded={isFront && expanded}
                                     why={isFront && why} onWhy={onWhy}
                                     onExpand={onExpand} onCollapse={onCollapse} onReport={onReport} onSignal={onSignal}
                                     orientation={orientation} />}
            </article>
            <div style={{ position: "absolute", inset: 0, transform: "rotateY(180deg)", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
                          borderRadius: home ? 26 : 28, maxHeight: size.height }}>
              <CardBack company={card.job.company} iconUrl={card.job.companyIconUrl} />
            </div>
          </div>
          {/* The stamps come AFTER the card in the DOM, so they paint over it with no z-index of their own. */}
          {isFront && <motion.div aria-hidden data-deck-stamp="draft" style={{ ...stamp, color: C.SUCCESS, borderColor: C.SUCCESS, opacity: draftStamp, rotate: 10 }}>DRAFT</motion.div>}
          {isFront && <motion.div aria-hidden data-deck-stamp="pass" style={{ ...stamp, color: C.INK_MUTED, borderColor: C.INK_MUTED, opacity: passStamp, rotate: -10 }}>PASS</motion.div>}
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
          <motion.div {...line(1)} style={{ fontSize: ts(14.5), color: C.INK_MUTED, marginTop: 8 }}>
            {s.size} dealt · {tally.drafted} drafted · {tally.saved} saved · {tally.passed} passed
          </motion.div>
        </div>
      </div>

      {drafted.length > 0 && (
        <motion.ul {...line(2)} aria-label="Drafted today" style={{ listStyle: "none", padding: 0, margin: "0 0 20px", display: "grid", gap: 8 }}>
          {drafted.map(c => (
            <li key={c.job.id} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: ts(14.5), color: C.INK }}>
              <CompanyLogo company={c.job.company} iconUrl={c.job.companyIconUrl} size={28} radius={8} />
              <span style={{ minWidth: 0 }}>
                <strong {...{ [TITLE_ATTR]: c.job.id }} style={{ fontWeight: 700 }}>{c.job.title}</strong>
                <span style={{ color: C.INK_MUTED }}> · {c.job.company}</span>
              </span>
            </li>
          ))}
        </motion.ul>
      )}

      <motion.p {...line(3)} style={{ fontSize: ts(15), color: C.INK_MUTED, lineHeight: 1.6, margin: "0 0 22px" }}>
        {tally.drafted > 0
          ? <>Nothing has been sent. {tally.drafted === 1 ? "That draft waits" : "Each draft waits"} for your review{needsReview > 0 ? <> (<strong style={{ color: C.INK }}>{needsReview}</strong> {needsReview === 1 ? "needs" : "need"} you now)</> : null}.</>
          : <>You drafted nothing today, which is a fine answer when nothing fits.</>}
        {" "}That's it until tomorrow: your next picks arrive in {untilTomorrow()}.
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
// ⭐ D152 (1) · HOME: `home` draws the deck as Home's left column (home-sketch.html's .deckcol, 390 px) — the card-shaped
// vertical layout at every width, never the two-panel report beside it (the column is the deck's whole width).
// ⭐ D156 (2): 640 px at ≥ 1440 for the landscape card (lib/fanGeometry.js homeDeckColumn).
export const HOME_DECK_COLUMN = 390;
// ⭐ D152 (8) (b): on Home a "Full report on the board" link stays a real link (copyable, opens in a new tab) but a plain
// click opens the posting beside the deck with its match open — the board is already on this screen.
const homeReport = (jobId) => (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  openMatchInPosting(jobId);
};

export default function DeckView({ canUseAPlusResume = true, home = false }) {
  const [load, setLoad] = useState({ status: "loading", error: null });
  // "__replace" swaps in a freshly loaded deck; every other action is the pure reducer's.
  const [state, dispatch] = useReducer((st, a) => (a.type === "__replace" ? a.state : deckReducer(st, a)), null, () => initialDeck(null));
  const [dealing, setDealing] = useState(false);
  const [toast, setToast] = useState(null);
  // ⭐ D179 (owner 11-07): the deck's fourth action, SEND — the posting's public page (D128), shared or copied. Sending to
  // a connection inside draft arrives with D180's Network; this is the "Copy public link" half the sketch draws.
  const [sent, setSent] = useState(null);
  // ⭐ D180 P2 (45o): with the network on, Send opens the picker (connections + a note, or Copy public link); off, as before.
  const [networkOn, setNetworkOn] = useState(false);
  const [picking, setPicking] = useState(null);   // the job being sent
  useEffect(() => { let live = true; api("/api/network/status").then(r => live && setNetworkOn(!!r?.enabled)).catch(() => {}); return () => { live = false; }; }, []);
  const sendTop = useCallback(async () => {
    const top = stateRef.current?.cards?.[stateRef.current?.index];
    if (networkOn && top?.job) { setPicking(p => (p ? null : top.job)); return; }
    const path = top?.job?.publicPath;
    if (!path) { setSent("This job has no public page yet"); setTimeout(() => setSent(null), 2500); return; }
    const url = `${window.location.origin}${path}`;
    try {
      if (navigator.share) { await navigator.share({ title: `${top.job.title} — ${top.job.company}`, url }); setSent("Shared"); }
      else { await navigator.clipboard.writeText(url); setSent("Link copied"); }
    } catch { return; }
    setTimeout(() => setSent(null), 2500);
  }, [networkOn]);
  const [live, setLive] = useState("");
  const [legend, setLegend] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // ⭐ D145: "Why this job?" — the layer between the folded card and the full posting.
  const [why, setWhy] = useState(false);
  const [leave, setLeave] = useState(null);
  const [frontH, setFrontH] = useState(0);
  // ⭐ D156 (1c) · THE CARD BECOMES THE LONG POST. On Home the opened posting (the board's JobDetailPanel) is drawn in the
  // deck's slot, in the front card's place; the board says which one (POSTING_ON_DECK_EVENT, lib/jobUrl.js). While it is
  // there the deck is READING: the fan is put away, the column stops being sticky, the page scrolls to read it.
  const [boardPost, setBoardPost] = useState(null);
  const boardPostRef = useRef(null);
  boardPostRef.current = boardPost;
  const postOriginRef = useRef("deck");   // D168: the origin of the post on screen, kept while it fades out
  if (boardPost) postOriginRef.current = boardPost.origin;
  const slotRef = useRef(null);
  const pendingDecision = useRef(null);   // a decision from the posting, made once the deck is on screen again
  // ⭐ D168 · THE SWAP. `boardPost` is where the deck is going; `showPost` is what the stack shows now. Between them the
  // content fades out, swaps and fades in (POST_FADE_MS each way) while the stack's height runs from the height measured
  // before anything changed to the height measured after the swap — never a one-frame jump. `swap.h` is the locked
  // height (null = auto, the resting state every swap ends in).
  const [showPost, setShowPost] = useState(false);
  const [swap, setSwap] = useState({ phase: "idle", h: null });
  const stackRef = useRef(null);
  const stackInnerRef = useRef(null);
  const swapRun = useRef({ target: "deck", timer: 0, watchdog: 0 });
  // A75 (owner, 10-03): "ATS match" as a sort on the daily draft. The deal is frozen; the server reads it
  // back in ATS order when asked (the score itself never reaches the client). Remembered per browser.
  // ⭐ D149: chosen in Settings → Customise (the deck page has no controls row now); read once, here.
  const [deckOrder] = useState(readDeckOrder);
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
  // A214 (46r): the deck's "Start with your résumé" is the newcomer's one set-up card — the board beside it only says
  // its jobs show once the résumé is in — so the profile the upload sets up is handed to the shared active id, and the
  // board (whose profile read re-runs on that id) leaves its empty state on its own.
  const setActiveProfileId = useJobBoard()?.setActiveProfileId;
  // Cards present on the first ready paint are simply THERE (unless this is the deal); a card that
  // arrives later — an undo, a refusal — fades into its slot.
  const firstPaint = useRef(true);

  const { w: viewportW } = useViewport();
  const vw = home ? Math.min(viewportW, HOME_DECK_COLUMN) : viewportW;
  const orientation = home ? "vertical" : orientationFor(vw);
  // The user's layout (queue 38), FITTED to the screen and overridden by reduced motion — geometryFor
  // is the only road from a stored preference to the fan.
  const [deckPref] = useDeckGeometry();
  const landscape = home && homeLandscape(viewportW);
  const geometry = home ? (landscape ? HOME_FAN_WIDE : HOME_FAN) : { ...geometryFor(orientation, deckPref, { reduced: !!reduced }), ...(DEV_FAN?.[orientation] || null) };
  const size = home ? homeCardSize(viewportW) : cardSize(orientation, vw);

  const scoringTries = useRef(0);
  const loadStatusRef = useRef(load.status);
  loadStatusRef.current = load.status;
  const fetchDeck = useCallback(async () => {
    const cacheKey = `${localDate()}|${deckOrder}`;
    // ⛔ D156 (6) · with a last good deal for today, the refresh happens UNDER it: those picks stay on screen
    // ("Refreshing…"), never the "Dealing…" box. Without one it is the first deal of the day, and the box shows.
    const held = rememberedDeck(cacheKey);
    if (held) {
      if (loadStatusRef.current !== "ready") {
        dispatch({ type: "__replace", state: initialDeck(held) });
      }
      setLoad({ status: "ready", error: null, refreshing: true });
    } else {
      setLoad(l => (l.status === "scoring" ? l : { status: "loading", error: null }));
    }
    try {
      // ⛔ 44p (deckNeverSpinsForever): at most DECK_TIMEOUT_MS, then a plain message and Try again — never a spinner
      // for as long as the edge holds the request (30–67 s on production 11-02).
      const deck = await api(`/api/draft/today?date=${encodeURIComponent(localDate())}&order=${deckOrder}`, { timeoutMs: DECK_TIMEOUT_MS });
      // 43y: a new résumé's matches are still being scored — say so and ask again (every 4 s, up to 3 minutes),
      // rather than showing an empty deck the tester takes for "no jobs".
      if (deck.reason === "scoring" && scoringTries.current < 45) {
        scoringTries.current += 1;
        // ⛔ D156 (6): while it scores, a last good deal stays on screen (refreshing), not the scoring box.
        setLoad(held ? { status: "ready", error: null, refreshing: true } : { status: "scoring", error: null });
        setTimeout(() => fetchDeck(), 4000);
        return;
      }
      scoringTries.current = 0;
      const shown = held || lastGoodDeck.get(cacheKey);
      lastGoodDeck.set(cacheKey, deck);
      rememberDeck(cacheKey, deck);
      // ⛔ A126 (9) · NOTHING CHANGED → NOTHING MOVES. A refresh that answers the same cards in the same order keeps the
      // deck exactly as it is (the card you are on, your decisions); before, every refresh re-built the deck from its
      // first card — the "choppy" re-render on every return to Home.
      const sameCards = shown && loadStatusRef.current === "ready" && Array.isArray(shown.cards)
        && shown.cards.length === deck.cards.length && shown.cards.every((c, i) => c?.job?.id === deck.cards[i]?.job?.id);
      if (sameCards) { setLoad({ status: "ready", error: null }); return; }
      dispatch({ type: "__replace", state: initialDeck(deck) });
      // ⛔ The deal plays on the day's FIRST open only — the server says whether this request dealt.
      // Once per day, not per navigation, or the signal that today's draft is new means nothing.
      // ⭐ A126 (9): and when the server RE-DEALT today's undecided cards (a better match landed): the same deal animation —
      // the new cards fly in from the deck, the replaced ones fade out (AnimatePresence) — never a jump cut.
      setDealing(!!deck.dealtNow || !!deck.reshuffled || reshuffleNextRef.current);
      reshuffleNextRef.current = false;
      setLoad({ status: "ready", error: null });
    } catch (e) {
      // ⭐ 44p (precomputeFailureShowsLastGood): today's last good deal, if this tab has one, stays on screen with a
      // quiet line saying it could not be refreshed.
      const last = lastGoodDeck.get(cacheKey);
      if (last) {
        // D156 (6): the picks on screen (and the decisions made on them since) are kept as they are.
        if (loadStatusRef.current !== "ready") {
          dispatch({ type: "__replace", state: initialDeck(last) });
        }
        setLoad({ status: "ready", error: null, stale: e.message || "The deck could not be refreshed." });
        return;
      }
      setLoad({ status: "error", error: e.message || "The deck could not be dealt." });
    }
  }, [deckOrder]);
  useEffect(() => { fetchDeck(); }, [fetchDeck]);
  // ⭐ A126 (9) · LIVE, WHEN READY: the match queue scored more of the board (`board_scored`) — ask for today's deal again
  // (the server re-deals at most every 3 minutes, and only for a better match). Debounced 30 s; never while a card is
  // open or a decision is in flight, so the deck does not change under a gesture — it tries again after.
  const deckBusyRef = useRef(false);
  // The server re-dealt in the background (`deck_reshuffled`): the next answer is a new deal — play the deal for it.
  const reshuffleNextRef = useRef(false);
  const deckRefreshTimer = useRef(null);
  useEffect(() => () => clearTimeout(deckRefreshTimer.current), []);
  const queueDeckRefresh = useCallback(() => {
    clearTimeout(deckRefreshTimer.current);
    deckRefreshTimer.current = setTimeout(() => {
      if (deckBusyRef.current) { queueDeckRefresh(); return; }
      fetchDeck();
    }, 30_000);
  }, [fetchDeck]);
  useSyncEvents({
    board_scored: () => queueDeckRefresh(),
    deck_reshuffled: () => {
      reshuffleNextRef.current = true;
      clearTimeout(deckRefreshTimer.current);
      const go = () => { if (deckBusyRef.current) { deckRefreshTimer.current = setTimeout(go, 2000); return; } fetchDeck(); };
      go();
    },
  });
  // D156 (6): the remembered deal carries the decisions made on it since, so a reload that cannot reach the server
  // never shows a passed or drafted card as undecided.
  useEffect(() => {
    if (load.status !== "ready" || !state.cards.length) return;
    const key = `${localDate()}|${deckOrder}`;
    const base = lastGoodDeck.get(key);
    if (base && base.date === state.date) rememberDeck(key, { ...base, cards: state.cards.map(({ error, pending, ...c }) => c) });
  }, [state.cards, load.status, deckOrder]); // eslint-disable-line react-hooks/exhaustive-deps
  // The deal is an arrival, not a mode: once it has played, later moves are ordinary rotations.
  useEffect(() => {
    if (!dealing) return;
    const id = setTimeout(() => setDealing(false), 2200);
    return () => clearTimeout(id);
  }, [dealing]);

  const s = state;
  deckBusyRef.current = !!expanded || !!s.flight;
  const current = s.cards[s.index];
  const order = useMemo(() => fanOrder(s), [s]);
  const tally = counts(s);
  const tool = canUseAPlusResume ? A_PLUS_TOOL : GENERATE_TOOL;

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

  const decideRef = useRef(null);
  const decide = useCallback((decision) => {
    const cur = stateRef.current.cards[stateRef.current.index];
    if (!cur || cur.decision) return;
    // Where the Drafted counter is, relative to the card — measured now, so the card flies to it.
    let target = null;
    const a = faceRef.current?.getBoundingClientRect?.();
    const b = counterRef.current?.getBoundingClientRect?.();
    if (a && b && a.width > 0) target = { dx: b.left + b.width / 2 - (a.left + a.width / 2), dy: b.top + b.height / 2 - (a.top + a.height / 2) };
    setLeave({ variant: leaveFor(decision, target, geometry) });
    setExpanded(false);
    dispatch({ type: "decide", decision });
    commit(cur, decision);
    const n = counts(stateRef.current).drafted + (decision === DECISIONS.DRAFTED ? 1 : 0);
    setToast({ jobId: cur.job.id, company: cur.job.company, decision, at: Date.now() });
    setLive(`${VERB[decision]} ${cur.job.title} at ${cur.job.company}. ${decision === DECISIONS.DRAFTED ? `${n} drafted.` : ""}`);
  }, [commit, geometry.zoom]);   // eslint-disable-line react-hooks/exhaustive-deps
  decideRef.current = decide;
  // ⭐ D156 (1c): the posting's decision on the deck's own card, made after the post has folded (the commit that shows
  // the fan again has painted), so the card leaves as a decided card always does. ⭐ D168: once the SWAP has put the deck
  // back (showPost false), not merely when the board let go — the fan is display: none until then.
  useEffect(() => {
    if (boardPost || showPost || !pendingDecision.current) return;
    const d = pendingDecision.current;
    pendingDecision.current = null;
    decide(d);
  }, [boardPost, showPost, decide]);

  const step = useCallback((dir) => {
    if (stepTarget(stateRef.current, dir) == null) return false;
    setExpanded(false);
    dispatch({ type: "step", dir });
    return true;
  }, []);

  // ⭐ D156 (1c) · open the front card into its long post / fold it back (the board draws the posting in the slot).
  const openPost = useCallback(() => {
    const cur = stateRef.current.cards[stateRef.current.index];
    if (cur && !cur.decision) openPostingOnDeck(cur.job.id);
  }, []);
  const foldPost = useCallback(() => closePostingOnDeck(), []);
  useEffect(() => {
    if (!home) return undefined;
    const onPost = (e) => setBoardPost(e.detail?.jobId ? { jobId: String(e.detail.jobId), origin: e.detail.origin || "board" } : null);
    // The posting's Pass · Save · Draft on the deck's own card: the deck decides it — the same call, exit and toast as
    // its own buttons (and the posting has folded by then).
    // ⛔ Measured (44v, real Chrome): decided while the post still covers the deck (its content display: none), the card's
    // exit never ran and the passed card stayed on top of the fan. So the post folds first, and the decision is made once
    // the deck is back on screen (the effect below).
    const onDecide = (e) => {
      const cur = stateRef.current.cards[stateRef.current.index];
      if (!cur || String(cur.job.id) !== String(e.detail?.jobId) || !e.detail?.decision) return;
      if (!boardPostRef.current) { decideRef.current?.(e.detail.decision); return; }
      pendingDecision.current = e.detail.decision;
      setBoardPost(null);
    };
    window.addEventListener(POSTING_ON_DECK_EVENT, onPost);
    window.addEventListener(DECK_DECIDE_EVENT, onDecide);
    return () => { window.removeEventListener(POSTING_ON_DECK_EVENT, onPost); window.removeEventListener(DECK_DECIDE_EVENT, onDecide); };
  }, [home]);
  // ⛔ D168: the post has NO wheel listener of its own any more (it folded on a scroll up at its top) — reading it is the
  // page's scroll, and folding is Esc or "Fold it back".
  // ⭐ D168 · THE SWAP, run. (1) The target changes (a press opened a posting, or it folded): the stack's height ON SCREEN
  // is measured before anything moves and locked, and the content fades out. (2) After POST_FADE_MS the content swaps
  // (the newest target wins — a burst of opens and folds just retargets) and (3) the end height is measured on the inner
  // box, which nothing constrains, and the locked height runs to it while the content fades in; a late change to the new
  // content (a description arriving) re-aims it. (4) Then the lock is dropped: the stack is auto-height again. A
  // watchdog drops it anyway — the swap can never stick. Reduced motion swaps at once.
  const postKey = home && boardPost ? `post:${boardPost.jobId}` : "deck";
  useLayoutEffect(() => {
    const run = swapRun.current;
    if (!home || postKey === run.target) return;
    run.target = postKey;
    clearTimeout(run.timer);
    clearTimeout(run.watchdog);
    const stack = stackRef.current;
    if (reduced || !stack) { setShowPost(postKey !== "deck"); setSwap({ phase: "idle", h: null }); return; }
    setSwap({ phase: "out", h: stack.getBoundingClientRect().height });
    run.timer = setTimeout(() => {
      setShowPost(run.target !== "deck");
      setSwap(sw => ({ phase: "swap", h: sw.h }));
    }, POST_FADE_MS);
    run.watchdog = setTimeout(() => { setShowPost(run.target !== "deck"); setSwap({ phase: "idle", h: null }); }, POST_FADE_MS * 2 + 600);
  }, [home, postKey, reduced]);
  useLayoutEffect(() => {
    if (swap.phase !== "swap") return;
    // The end: measured after the swap has committed, before it is shown (opacity is still 0).
    const inner = stackInnerRef.current;
    setSwap({ phase: "in", h: inner ? inner.offsetHeight : null });
  }, [swap.phase]);
  useEffect(() => {
    if (swap.phase !== "in") return undefined;
    const inner = stackInnerRef.current;
    const ro = inner && typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => setSwap(sw => (sw.phase === "in" ? { ...sw, h: inner.offsetHeight } : sw))) : null;
    ro?.observe(inner);
    const done = setTimeout(() => { clearTimeout(swapRun.current.watchdog); setSwap({ phase: "idle", h: null }); }, POST_FADE_MS + 40);
    return () => { ro?.disconnect(); clearTimeout(done); };
  }, [swap.phase]);
  useEffect(() => () => { clearTimeout(swapRun.current.timer); clearTimeout(swapRun.current.watchdog); }, []);
  // Opening scrolls UP to the post when the reader is below it (a bubble far down the list — the sketch's scrollTo);
  // folding returns them to where they were. Nothing else moves the page. ⭐ D168: at the swap (showPost), not the ask.
  const readFromY = useRef(null);
  const reading = showPost;
  useLayoutEffect(() => {
    if (!home) return;
    if (reading) {
      if (readFromY.current == null) readFromY.current = window.scrollY;
      const top = stackRef.current?.getBoundingClientRect().top;
      if (top != null && top < 0) window.scrollTo({ top: Math.max(0, window.scrollY + top - 20), behavior: "auto" });
    } else if (readFromY.current != null) {
      const y = readFromY.current;
      readFromY.current = null;
      window.scrollTo({ top: y, behavior: "auto" });
    }
  }, [home, reading]);

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

  // ⭐ D190 · ASK DRAFT: the deck's front card, decided by the deck's own decide (its exit, its toast, its one commit) and
  // undone as the toast's Undo undoes it (lib/assistantBridge.js).
  useEffect(() => registerAssistantActions("deck", {
    deckJob: () => { const st = stateRef.current; const c = st?.cards?.[st.index]; return c && !c.decision ? { ...c.job, jobId: c.job.jobId ?? c.job.id, why: c.why || null } : null; },
    deckDecide: async (_job, decision) => { decideRef.current?.(decision); },
    deckUndo: async (job, decision) => {
      const id = job?.jobId ?? job?.id;
      const card = stateRef.current.cards.find(c => String(c.job.id) === String(id));
      await undoDecision({ jobId: card?.job.id ?? id, decision: decision || card?.decision, runId: card?.runId, prior: {} });
      dispatch({ type: "undone", jobId: card?.job.id ?? id });
    },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(id);
  }, [toast]);

  // Focus follows the deck: after an action or a rotation the front card's heading takes focus (§3.7).
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, [s.index]);
  useEffect(() => { setExpanded(false); setWhy(false); }, [s.index]);
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


  // ⛔ SCROLL CAPTURE, only when a rotation is possible. One flick, one card.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    // ⭐ D178-3: the gesture is lib/deckWheel.js — one copy, shared with Atlas's lesson deck.
    const onWheel = deckWheelHandler({
      skip: () => !!expandedRef.current || !!boardPostRef.current,   // reading (a card or a posting open): the page scrolls
      // ⭐ D168 (owner 11-06, concept B) · THE WHEEL HAS ONE JOB: over the deck, one flick turns one card — on the front
      // card too, in either direction. It never opens or folds anything (D156 (1c)'s scroll-down-opens and D145's
      // scroll-down "Why this job" are gone: a press or Enter opens). While a posting is open the page scrolls.
      canStep: (dir) => stepTarget(stateRef.current, dir) != null,
      step,
    });
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [step, load.status, isFinished(state)]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || e.target?.isContentEditable) return;
      const k = e.key;
      // ⭐ D156 (1c): reading the long post, the posting's own keys act on it (JobsPanel: S · D · P, Esc folds) — the deck's
      // letters would decide the card hidden under it.
      if (boardPostRef.current) {
        // ⭐ D164: not while the sandbox (or another panel) is open over it — that Escape is the panel's (D39).
        if (k === "Escape") { if (!panelOverPosting()) foldPost(); }
        else if (k === "Enter" && tag !== "button" && tag !== "a") { e.preventDefault(); foldPost(); }
        return;
      }
      if (k === "d" || k === "D" || k === "ArrowRight") { e.preventDefault(); decide(DECISIONS.DRAFTED); }
      else if (k === "x" || k === "X" || k === "ArrowLeft") { e.preventDefault(); decide(DECISIONS.PASSED); }
      else if (k === "s" || k === "S") { e.preventDefault(); decide(DECISIONS.SAVED); }
      else if (k === "u" || k === "U") { e.preventDefault(); undo(); }
      // The keyboard does everything the wheel does. ↑/↓ only while folded — expanded, they read.
      else if (k === "j" || k === "J") { e.preventDefault(); step(1); }
      else if (k === "k" || k === "K") { e.preventDefault(); step(-1); }
      else if ((k === "ArrowDown" || k === "ArrowUp") && !expandedRef.current) { if (step(k === "ArrowDown" ? 1 : -1)) e.preventDefault(); }
      else if (k === "Enter" && tag !== "button" && tag !== "a") { e.preventDefault(); if (home) openPost(); else setWhy(v => !v); }
      else if (k === "Escape") { setExpanded(false); setWhy(false); setLegend(false); }
      else if (k === "?") setLegend(v => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decide, undo, step, home, openPost, foldPost]);

  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const vertical = orientation === "vertical";
  // ⭐ D156 (1b): Home's stage is the card's fixed box — it never follows a growing face.
  const stageH = home ? size.height : Math.max(size.height, frontH || 0);
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
      <div data-deck-orientation={orientation} data-deck-home={home ? "" : undefined} data-deck-reading={home && showPost ? "true" : undefined}
        style={{ maxWidth: home ? homeDeckColumn(viewportW) : vertical ? 560 : 760, margin: "0 auto",
                 // ⭐ D149: the card's top at the sketch's 90 px — the chrome's 74 + 16 (App.jsx gives the deck no main padding).
                 // D152: on Home the column's own padding places it, and the fan's room is above the buttons (HOME_CARD.below).
                 padding: home ? 0 : vertical ? "16px 12px 120px" : "16px 16px 140px",
                 // ⛔ D92: never `clip` here, in either layout. Clipping this 560px column sliced the vertical fan's
                 // outer cards with two hard vertical lines (the "cut out and pasted" deck); the full-width
                 // data-deck-clip above already stops a sideways page scroll, at the SCREEN's edge.
                 position: "relative", isolation: "isolate", overflowX: "visible",
                 // ⭐ THE ONE CLOCK (A40): every rule in the expansion reads these two; none restates a
                 // duration. Reduced motion stops all four movements at once.
                 "--deck-t": reduced ? "0s" : EXPAND_CLOCK.duration, "--deck-ease": EXPAND_CLOCK.ease }}>
        <CardBackDefs />
        <div aria-live="polite" style={visuallyHidden}>{live}</div>
        {/* ⭐ D156 (1c) · THE LONG POST'S PLACE — the board draws the opened posting here (JobsPanel, a portal), in the front
            card's place; the deck's own content steps aside while it is open. Always in the document on Home, so the board
            can find it the moment a posting opens. */}
        {/* ⭐ D168 · THE STACK — the slot and the deck's content, swapped as one: its height is locked only while a swap
            runs (from the measured start to the measured end, clipped vertically so nothing spills), and the inner box's
            opacity carries the fade. At rest it has no height of its own and no transition. */}
        <div ref={stackRef} data-deck-stack="" data-swap={swap.phase}
          style={swap.h != null ? { height: swap.h, overflowY: "clip", transition: `height ${POST_FADE_MS}ms ease-out` } : undefined}>
        <div ref={stackInnerRef} data-deck-stack-inner=""
          style={swap.phase === "idle" ? undefined
            : { opacity: swap.phase === "in" ? 1 : 0, transition: `opacity ${POST_FADE_MS}ms ease`, pointerEvents: "none" }}>
        {home && (
          <div id={DECK_POST_SLOT_ID} ref={slotRef} data-deck-post-slot="" data-open={showPost ? "true" : "false"}
            {...(showPost ? { "data-post-origin": postOriginRef.current } : { hidden: true })} />
        )}
        <div data-deck-content="" style={home && showPost ? { display: "none" } : undefined}>
        {/* The header and every non-deck state keep the deck's resting width; only the deck's grid is wide. */}
        <div style={{ maxWidth: vertical ? 560 : 760, margin: "0 auto" }}>

        {/* ⭐ D149 (owner 11-03): THE PAGE IS THE CARD, as declutter-v7.html draws it — no visible title and no controls row.
            The owner's answer: the order (Dealt / ATS match) and the layout live in Settings → Customise (they always
            had a copy there, D93); browsing without deciding stays on J / K, ↑ / ↓ while folded and the wheel; Pass ·
            Save · Draft advance; "Drafted N" goes. The page keeps its heading for screen readers. */}
        <h1 style={visuallyHidden} data-deck-title="">Today's draft · {dateLabel}</h1>

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
            <div style={{ fontSize: ts(18), fontWeight: 700, color: C.INK, marginBottom: 8 }}>Today's draft could not be dealt.</div>
            <div style={{ fontSize: ts(14), color: C.INK_MUTED, marginBottom: 18 }}>{load.error}</div>
            <button type="button" onClick={fetchDeck} style={{ ...glass({ radius: 12 }), padding: "10px 18px", fontWeight: 800, color: C.INK, cursor: "pointer" }}>Try again</button>
          </div>
        )}

        {load.status === "ready" && load.refreshing && !load.stale && (
          <div role="status" data-deck-refreshing="" style={{ fontSize: ts(13.5), color: C.INK_MUTED, margin: "0 0 12px" }}>Refreshing today's draft…</div>
        )}

        {load.status === "ready" && load.stale && (
          <div role="status" data-deck-stale style={{ fontSize: ts(13.5), color: C.INK_MUTED, margin: "0 0 12px", display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
            <span>Showing today's draft from earlier — {load.stale}</span>
            <button type="button" onClick={fetchDeck} style={{ background: "none", border: 0, padding: 0, fontWeight: 800, color: C.ACCENT_INK, cursor: "pointer" }}>Try again</button>
          </div>
        )}

        {load.status === "ready" && s.size === 0 && (() => {
          // Three different empties, each with its own way forward (§3.6). A brand-new account — a
          // first Google sign-in creates one — has no profile and no résumé: that is set-up, not an error.
          const copy = {
            // A104: the résumé sets the first profile up — one upload, and the deck is dealt.
            no_profile: ["Start with your résumé.",
              "Upload it and draft reads the roles you want and the skills you have, then picks your first jobs straight away.",
              []],
            no_resume: ["Add your résumé to get today's picks.",
              "draft judges fit against your résumé. It takes a minute, and nothing is sent anywhere.",
              [["/app/job-profiles", "Add your résumé →"], ["/app/jobs", "Every job"]]],
            empty: ["Nothing strong enough today.",
              "Today's picks are good and close fits you haven't decided on, and there are none right now. More detail in your résumé changes this most.",
              [["/app/jobs", "All jobs →"], ["/app/job-profiles", "Improve your profile →"]]],
          }[s.reason] || null;
          const [title, body, links] = copy || [null, null, []];
          return (
            // ⭐ A233: each empty is a note card — its title, one line, the way forward (a new account: the upload).
            <NoteCard id={`deck-empty-${s.reason || "empty"}`} title={title || "Nothing strong enough today."} data-deck-empty={s.reason || "empty"}
              style={{ maxWidth: "none" }}
              actions={s.reason === "no_profile"
                ? <StartFromResume onDone={(r) => { fetchDeck(); if (r?.profile?.id) setActiveProfileId?.(r.profile.id); }} onManual={() => navigate("/app/job-profiles")} />
                : links.map(([to, label]) => <Link key={to} to={to} style={{ fontWeight: 800 }}>{label}</Link>)}>
              {body}
            </NoteCard>
          );
        })()}

        {load.status === "ready" && s.size > 0 && isFinished(s) && (
          <EndOfDeck s={s} tally={tally} needsReview={needsAttentionCount} onUndo={toast ? undo : null} />
        )}
        </div>

        {load.status === "ready" && (current || order.length > 0) && !isFinished(s) && (
            <div data-deck-col style={{ minWidth: 0 }}>
              {/* ⭐ D152 (3): home-sketch.html's .count — where you are in today's picks, and in what order. */}
              {/* ⭐ D156 (1b): ‹ › beside it turn the fan one card (as J / K, ↑ ↓ and the wheel do). */}
              {home && (
                <div data-deck-count-row="" style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 10px", maxWidth: size.width }}>
                  <p data-deck-count="" style={{ margin: 0, color: C.INK_MUTED, fontSize: ts(13.5), flex: 1, minWidth: 0 }}>
                    {Math.min(s.index + 1, s.size)} of {s.size} today · {deckOrder === "best" ? "best match first" : deckOrder === "ats" ? "ATS match first" : "as dealt"}
                  </p>
                  <FlipButton dir={-1} disabled={stepTarget(s, -1) == null} onFlip={step} />
                  <FlipButton dir={1} disabled={stepTarget(s, 1) == null} onFlip={step} />
                </div>
              )}
              <div ref={stageRef} data-deck-stage
                // The stage is the face-up card's box; the fan overflows it on purpose, behind the
                // header above and the action row below. Its height FOLLOWS the card (measured each
                // frame as the posting grows) — a transition of its own would lag the clock.
                style={{ position: "relative", height: stageH }}>
                {/* EVERY undecided card stays mounted, the far ones invisible: only a DECISION may
                    remove a card, so only a decided card ever plays an exit. */}
                <AnimatePresence initial custom={leave}>
                  {order.map((e) => (
                    <FanCard key={e.card.job.id} entry={e} orientation={orientation} geometry={geometry} size={size} home={home} landscape={landscape} onOpenPost={openPost}
                      expanded={expanded} dimmed={expanded} dealing={dealing} appear={!firstPaint.current} reduced={!!reduced} dealRank={Math.max(0, dealTotal - 1 - Math.abs(e.offset))}
                      dealTotal={dealTotal} onDecide={decide} onExpand={() => setExpanded(true)} onCollapse={() => setExpanded(false)}
                      why={why} onWhy={(v) => { setWhy(v); if (!v) setExpanded(false); }}
                      // ⭐ D152 (8) (b): the report opens in the board's posting, under its facts (option A) — the sheet
                      // and the report beside the card are deleted; on Home "Full report on the board" goes there too.
                      onSignal={() => openMatchInPosting(e.card.job.id)}
                      onReport={home ? homeReport(e.card.job.id) : transitionClick(navigate, jobDetailHref(e.card.job.id), { awaitTitle: e.card.job.id })} onGoto={(i) => dispatch({ type: "goto", index: i })} headingRef={headingRef} faceRef={faceRef} />
                  ))}
                </AnimatePresence>
              </div>

              {/* ⛔ The action row STICKS: an expanded card is tall, and Pass / Save / Draft must stay
                  reachable without scrolling back. It is above the fan by tier, and in the card's own
                  column, so it travels with the card when the report opens. */}
              <div data-deck-actions style={{ position: "sticky", bottom: "calc(16px + var(--appnav-lift, 0px))", transition: "bottom .3s ease", zIndex: Z.NAV, display: "flex", gap: 12,
                                              // D152 (2) / D153 (1): on Home, under the fan's sweep (HOME_CARD.below), at the card's left.
                                              // ⭐ D156 (1): and NOT sticky there — the card is a fixed box, so the row sits under the
                                              // card and its fan and never rides over the card's content on a short screen.
                                              ...(home ? { position: "relative", bottom: "auto" } : null),
                                              marginTop: home ? (landscape ? HOME_WIDE.below : HOME_CARD.below) : vertical ? 18 : 22, maxWidth: size.width, marginLeft: home ? 0 : "auto", marginRight: "auto" }}>
                <ActionButton label="Pass" ariaKeys="X ArrowLeft" compact={vertical} onClick={() => decide(DECISIONS.PASSED)} />
                <ActionButton label="Save" ariaKeys="S" compact={vertical} onClick={() => decide(DECISIONS.SAVED)} />
                <ActionButton label="Send" compact={vertical} onClick={sendTop} />
                <ActionButton label="Draft" ariaKeys="D ArrowRight" compact={vertical} primary onClick={() => decide(DECISIONS.DRAFTED)} />
                {sent && <span role="status" data-deck-sent="" style={{ alignSelf: "center", fontSize: ts(13), color: C.INK_MUTED }}>{sent}</span>}
              </div>
              {picking && <SendJobPicker job={picking} onClose={() => setPicking(null)} />}
            </div>
        )}

        </div>
        </div>
        </div>
        <DecisionToast toast={toast} onUndo={undo} undoKey="U" />

        {legend && (
          <div role="dialog" aria-label="Keyboard shortcuts" style={{ ...glass({ radius: 18 }), backgroundColor: C.SURFACE_MENU, position: "fixed", right: 24, bottom: 96,
                                                                    zIndex: Z.NAV, padding: "16px 20px", fontSize: ts(13.5), color: C.INK }}>
            {(home
              // ⭐ D156 (1c): on Home Enter opens the card into its long post, and Esc folds it.
              ? [["D  →", "Draft — queue it for your review"], ["X  ←", "Pass — it won't come back"], ["S", "Save for later"],
                 ["U", "Undo the last one"], ["J ↓ / K ↑", "Next / previous card (as the wheel and ‹ › do)"], ["Enter", "Open the posting"],
                 ["Esc", "Fold it back"], ["?", "This list"]]
              : [["D  →", "Draft — queue it for your review"], ["X  ←", "Pass — it won't come back"], ["S", "Save for later"],
              ["U", "Undo the last one"], ["J ↓ / K ↑", "Next / previous card (as the wheel does)"], ["Enter", "Why this job — open or fold it"],
              ["Esc", "Collapse"], ["?", "This list"]]).map(([k, v]) => (
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
