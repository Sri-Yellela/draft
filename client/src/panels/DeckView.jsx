// ── Today — the deck (UI steps 3c + 4) ───────────────────────────────────────────────────────
//
// docs/UI_REDESIGN.md §3–§4. One job at a time; position is the fit signal; nothing here submits.
//
//   Draft  (D, →, swipe right)  POST /api/apply/runs { surface:"deck" }, NO approvalMode — the job is
//                               previewed and parked for review. The route refuses approvalMode from
//                               this surface, so the deck physically cannot ask for no review.
//   Pass   (X, ←, swipe left)   PATCH /api/jobs/interact { disliked:true } — saved; never re-dealt
//   Save   (S, button only)     PATCH /api/jobs/interact { starred:true }
//   Undo   (U, the toast)       abort the run job / interact false
//
// ⛔ No animation gates input (lib/deckState.js): an action commits at once and the fly-out plays on
// the leaving copy. ⛔ Every motion honours prefers-reduced-motion — from ONE MotionConfig, so a new
// transition cannot forget it. ⛔ Colours are tokens only; the card shows a band on demand and never
// a number.
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion, useMotionValue, useTransform } from "framer-motion";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { C } from "../styles/colorTokens.js";
import { glass } from "../styles/glass.js";
import { bandChipStyle } from "../styles/bandStyle.js";
import { atsBandLabel } from "../../../shared/atsBands.js";
import CompanyIcon from "../components/ui/CompanyIcon.jsx";
import { jobDetailHref } from "../lib/jobUrl.js";
import { A_PLUS_TOOL, GENERATE_TOOL } from "../lib/applyTools.js";
import { DECISIONS, counts, deckReducer, initialDeck, isFinished } from "../lib/deckState.js";

const SWIPE_COMMIT_PX = 80;          // the same commit distance as Android's SOFT_OFFSET
const TOAST_MS = 5000;
const localDate = () => new Date().toLocaleDateString("en-CA");   // YYYY-MM-DD in the user's zone

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

// The mark is a slash; the deck's progress fills it along its diagonal — drafted ÷ size.
function SlashProgress({ drafted, size }) {
  const p = size ? drafted / size : 0;
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
      <line x1="8" y1="26" x2="22" y2="4" stroke={C.BORDER_STRONG} strokeWidth="5" strokeLinecap="round" />
      <motion.line x1="8" y1="26" x2="22" y2="4" stroke={C.ACCENT_INK} strokeWidth="5" strokeLinecap="round"
        // opacity 0 at zero: a round cap on a zero-length path draws a stray dot.
        initial={false} animate={{ pathLength: p, opacity: p > 0 ? 1 : 0 }} transition={{ duration: 0.2 }} />
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

function ActionButton({ label, hint, onClick, primary, disabled, ariaKeys }) {
  const [hov, setHov] = useState(false);
  const base = primary
    ? { background: C.ACCENT, color: C.ON_ACCENT, border: `1px solid ${C.ACCENT_INK}`, boxShadow: hov ? C.SHADOW_GLASS_HOVER : C.SHADOW_GLASS }
    : { ...glass({ hover: hov, radius: 16 }), color: C.INK };
  return (
    <motion.button type="button" onClick={onClick} disabled={disabled} aria-keyshortcuts={ariaKeys}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} whileTap={{ scale: 0.96 }}
      style={{ ...base, flex: 1, minHeight: 54, borderRadius: 16, fontSize: 16, fontWeight: 800, letterSpacing: "0.02em",
               display: "flex", alignItems: "center", justifyContent: "center", gap: 10, cursor: disabled ? "default" : "pointer",
               opacity: disabled ? 0.5 : 1 }}>
      {label}<span style={{ ...kbd, ...(primary ? { borderColor: C.ON_ACCENT, color: C.ON_ACCENT } : null) }}>{hint}</span>
    </motion.button>
  );
}

// ── the card ────────────────────────────────────────────────────────────────────────────────
const cardVariants = {
  enter: (deal) => ({ opacity: 0, y: deal ? 80 : 18, scale: 0.94, rotate: deal ? -2 : 0 }),
  center: { opacity: 1, y: 0, scale: 1, rotate: 0, x: 0 },
  exit: (d) => d === DECISIONS.DRAFTED ? { x: 460, y: -300, rotate: 16, scale: 0.4, opacity: 0, transition: { duration: 0.28, ease: [0.4, 0, 0.9, 0.6] } }
    : d === DECISIONS.PASSED ? { x: -520, rotate: -14, opacity: 0, transition: { duration: 0.22, ease: "easeIn" } }
    : { x: 380, y: -320, scale: 0.3, opacity: 0, transition: { duration: 0.24, ease: "easeIn" } },
};

function DeckCard({ card, onDecide, headingRef, dealing }) {
  const { job, why = {} } = card;
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-320, 0, 320], [-10, 0, 10]);
  const draftStamp = useTransform(x, [20, SWIPE_COMMIT_PX + 40], [0, 1]);
  const passStamp = useTransform(x, [-SWIPE_COMMIT_PX - 40, -20], [1, 0]);
  const meta = [job.location, workModel(job), salary(job), ago(job)].filter(Boolean);
  const titleId = `deck-title-${job.id}`;
  const stamp = { position: "absolute", top: 28, padding: "6px 14px", borderRadius: 10, fontWeight: 900, fontSize: 22,
                  letterSpacing: "0.12em", border: "3px solid", pointerEvents: "none" };
  return (
    <motion.article aria-labelledby={titleId}
      custom={dealing} variants={cardVariants} initial="enter" animate="center"
      transition={{ type: "spring", stiffness: 320, damping: 30, delay: dealing ? 0.18 : 0 }}
      drag="x" dragSnapToOrigin dragElastic={0.6} style={{ x, rotate, ...glass({ radius: 28 }), position: "relative",
        padding: "28px 30px 24px", cursor: "grab", touchAction: "pan-y", userSelect: "none" }}
      onDragEnd={(_, info) => {
        if (info.offset.x > SWIPE_COMMIT_PX) onDecide(DECISIONS.DRAFTED);
        else if (info.offset.x < -SWIPE_COMMIT_PX) onDecide(DECISIONS.PASSED);
      }}>
      {/* Both stamps sit top-right, the card's empty corner — only one is ever visible. */}
      <motion.div aria-hidden style={{ ...stamp, right: 26, color: C.SUCCESS, borderColor: C.SUCCESS, opacity: draftStamp, rotate: 10 }}>DRAFT</motion.div>
      <motion.div aria-hidden style={{ ...stamp, right: 26, color: C.INK_MUTED, borderColor: C.INK_MUTED, opacity: passStamp, rotate: -10 }}>PASS</motion.div>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <CompanyIcon company={job.company} iconUrl={job.companyIconUrl} size={56} radius={16} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.INK_MUTED }}>{job.company}</div>
          {meta.length > 0 && <div style={{ fontSize: 13, color: C.INK_FAINT, marginTop: 2 }}>{meta.join("  ·  ")}</div>}
        </div>
      </div>

      <h2 id={titleId} ref={headingRef} tabIndex={-1}
        style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: "clamp(30px, 4.6vw, 48px)", lineHeight: 1.06,
                 letterSpacing: "-0.01em", color: C.INK, margin: "22px 0 22px", outline: "none" }}>
        {job.title}
      </h2>

      {card.error && (
        <div role="alert" style={{ background: C.DANGER_QUIET, color: C.DANGER, padding: "10px 14px", borderRadius: 12,
                                   fontSize: 13.5, fontWeight: 600, marginBottom: 16 }}>
          {card.error}
        </div>
      )}

      {why.matched?.length > 0 && (
        <section style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: C.INK_FAINT, marginBottom: 8 }}>
            Why it's here
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {why.matched.map(s => <Chip key={s} tone="good">{s}</Chip>)}
            {why.matchedTotal > why.matched.length && <Chip tone="good">+{why.matchedTotal - why.matched.length} you show</Chip>}
          </div>
        </section>
      )}
      {why.missing?.length > 0 && (
        <section>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: C.INK_FAINT, marginBottom: 8 }}>
            Not on your résumé yet
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {why.missing.map(s => <Chip key={s}>{s}</Chip>)}
          </div>
        </section>
      )}
      <div style={{ marginTop: 22, fontSize: 12.5, color: C.INK_FAINT }}>Scroll for the posting ↓</div>
    </motion.article>
  );
}

function StackBehind({ cards, dealing }) {
  // The next two cards as glass slabs behind the top one: the deck is visibly a DECK.
  return cards.slice(0, 2).map((c, i) => (
    <motion.div key={c.job.id} aria-hidden
      initial={{ opacity: 0, y: dealing ? 90 : 0, scale: 0.9 }}
      animate={{ opacity: 1 - (i + 1) * 0.22, y: (i + 1) * 13, scale: 1 - (i + 1) * 0.04 }}
      transition={{ type: "spring", stiffness: 260, damping: 28, delay: dealing ? 0.06 * (2 - i) : 0 }}
      // Scaled from the BOTTOM so each slab's lower edge peeks out under the card above it.
      style={{ ...glass({ radius: 28 }), position: "absolute", inset: 0, zIndex: -1 - i, transformOrigin: "50% 100%" }} />
  ));
}

function Detail({ card }) {
  const { job, band } = card;
  const meta = atsBandLabel(band);
  const text = String(job.description || "").trim();
  return (
    <section style={{ ...glass({ radius: 22 }), padding: "22px 26px", marginTop: 18 }} aria-label="The posting">
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <span style={{ ...bandChipStyle(band), padding: "4px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 800 }}>{meta.label}</span>
        <span style={{ fontSize: 13, color: C.INK_MUTED }}>{meta.blurb}</span>
      </div>
      {text
        ? <p style={{ fontSize: 14.5, lineHeight: 1.7, color: C.INK, whiteSpace: "pre-wrap", margin: 0 }}>
            {text.length > 1600 ? text.slice(0, 1600).trimEnd() + "…" : text}
          </p>
        : <p style={{ fontSize: 14, color: C.INK_MUTED, margin: 0 }}>The posting's text is not stored. Open it at the source.</p>}
      <div style={{ display: "flex", gap: 18, marginTop: 16, flexWrap: "wrap", fontSize: 13.5, fontWeight: 700 }}>
        {(job.applyUrl || job.url) && <a href={job.applyUrl || job.url} target="_blank" rel="noreferrer" style={{ color: C.ACCENT_INK }}>The posting ↗</a>}
        <Link to={jobDetailHref(job.id)} style={{ color: C.ACCENT_INK }}>Full report on the board →</Link>
      </div>
    </section>
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
  const headingRef = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const fetchDeck = useCallback(async () => {
    setLoad({ status: "loading", error: null });
    try {
      const deck = await api(`/api/draft/today?date=${encodeURIComponent(localDate())}`);
      dispatch({ type: "__replace", state: initialDeck(deck) });
      setDealing(!!deck.dealtNow);   // the deal-in plays on the day's FIRST open only
      setLoad({ status: "ready", error: null });
    } catch (e) {
      setLoad({ status: "error", error: e.message || "The deck could not be dealt." });
    }
  }, []);
  useEffect(() => { fetchDeck(); }, [fetchDeck]);

  const s = state;
  const current = s.cards[s.index];
  const upcoming = useMemo(() => s.cards.slice(s.index + 1).filter(c => !c.decision), [s]);
  const tally = counts(s);
  const tool = canUseAPlusResume ? A_PLUS_TOOL : GENERATE_TOOL;

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
    dispatch({ type: "decide", decision });
    commit(cur, decision);
    const n = counts(stateRef.current).drafted + (decision === DECISIONS.DRAFTED ? 1 : 0);
    setToast({ jobId: cur.job.id, company: cur.job.company, decision, at: Date.now() });
    setLive(`${VERB[decision]} ${cur.job.title} at ${cur.job.company}. ${decision === DECISIONS.DRAFTED ? `${n} drafted.` : ""}`);
  }, [commit]);

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

  // Focus follows the deck: after an action the next card's heading takes focus (§3.7).
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, [s.index]);

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
      else if (k === "j" || k === "J") dispatch({ type: "goto", index: stateRef.current.index + 1 });
      else if (k === "k" || k === "K") dispatch({ type: "goto", index: stateRef.current.index - 1 });
      else if (k === "Enter") document.getElementById("deck-detail")?.scrollIntoView({ behavior: "smooth" });
      else if (k === "?") setLegend(v => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decide, undo]);

  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <MotionConfig reducedMotion="user">
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 16px 140px", position: "relative" }}>
        <div aria-live="polite" style={visuallyHidden}>{live}</div>

        <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 22, flexWrap: "wrap" }}>
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
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <SlashProgress drafted={tally.drafted} size={s.size} />
              <div style={{ fontSize: 14, fontWeight: 700, color: C.INK }}>
                {Math.min(s.index + 1, s.size)} <span style={{ color: C.INK_FAINT, fontWeight: 600 }}>/ {s.size}</span>
              </div>
              <motion.span key={tally.drafted} initial={{ scale: 1.25 }} animate={{ scale: 1 }}
                style={{ ...glass({ radius: 999 }), padding: "6px 12px", fontSize: 13, fontWeight: 800, color: C.INK }}>
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

        {load.status === "ready" && s.size === 0 && (
          <div style={{ ...glass({ radius: 28 }), padding: "40px 36px" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 34, color: C.INK, marginBottom: 10 }}>Nothing strong enough today.</div>
            <p style={{ fontSize: 15, color: C.INK_MUTED, lineHeight: 1.6, margin: "0 0 22px" }}>
              Today's draft only deals Strong and Moderate matches you haven't decided yet, and there are none right now.
              A thin résumé makes most jobs read as weak — adding detail changes this more than anything else.
            </p>
            <div style={{ display: "flex", gap: 18, fontWeight: 800, fontSize: 14.5 }}>
              <Link to="/app/jobs" style={{ color: C.ACCENT_INK }}>All jobs →</Link>
              <Link to="/app/job-profiles" style={{ color: C.ACCENT_INK }}>Improve your profile →</Link>
            </div>
          </div>
        )}

        {load.status === "ready" && s.size > 0 && isFinished(s) && (
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} style={{ ...glass({ radius: 28 }), padding: "44px 36px" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 40, color: C.INK, marginBottom: 10 }}>That's today's draft.</div>
            <p style={{ fontSize: 15, color: C.INK_MUTED, margin: "0 0 24px" }}>
              {tally.drafted} drafted · {tally.saved} saved · {tally.passed} passed.
              {tally.drafted > 0 ? " Nothing has been sent — each draft waits for your review." : " Tomorrow's draft is dealt fresh."}
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {tally.drafted > 0 && (
                <Link to="/app/auto-apply" style={{ background: C.ACCENT, color: C.ON_ACCENT, border: `1px solid ${C.ACCENT_INK}`,
                  padding: "12px 20px", borderRadius: 14, fontWeight: 800, textDecoration: "none", boxShadow: C.SHADOW_GLASS }}>
                  Review your drafts →
                </Link>
              )}
              <Link to="/app/jobs" style={{ ...glass({ radius: 14 }), padding: "12px 20px", fontWeight: 800, color: C.INK, textDecoration: "none" }}>All jobs</Link>
            </div>
          </motion.div>
        )}

        {load.status === "ready" && current && (
          <>
            <div style={{ position: "relative", isolation: "isolate" }}>
              <StackBehind cards={upcoming} dealing={dealing} />
              <AnimatePresence initial={true} mode="popLayout" custom={s.lastAction?.decision}>
                <DeckCard key={current.job.id} card={current} onDecide={decide} headingRef={headingRef} dealing={dealing} />
              </AnimatePresence>
            </div>

            <div style={{ position: "sticky", bottom: 16, zIndex: 5, display: "flex", gap: 12, marginTop: 20 }}>
              <ActionButton label="Pass" hint="X" ariaKeys="X ArrowLeft" onClick={() => decide(DECISIONS.PASSED)} />
              <ActionButton label="Save" hint="S" ariaKeys="S" onClick={() => decide(DECISIONS.SAVED)} />
              <ActionButton label="Draft" hint="D" ariaKeys="D ArrowRight" primary onClick={() => decide(DECISIONS.DRAFTED)} />
            </div>

            <div id="deck-detail"><Detail card={current} /></div>
          </>
        )}

        <AnimatePresence>
          {toast && (
            <motion.div key={toast.at} role="status" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
              // A toast must read over anything, so it is the opaque menu surface, not see-through glass.
              style={{ ...glass({ radius: 16 }), backgroundImage: "none", backgroundColor: C.SURFACE_MENU,
                       position: "fixed", left: "50%", bottom: 96, x: "-50%", zIndex: 30,
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
          <div role="dialog" aria-label="Keyboard shortcuts" style={{ ...glass({ radius: 18 }), position: "fixed", right: 24, bottom: 96, zIndex: 31, padding: "16px 20px", fontSize: 13.5, color: C.INK }}>
            {[["D  →", "Draft — queue it for your review"], ["X  ←", "Pass — it won't come back"], ["S", "Save for later"],
              ["U", "Undo the last one"], ["J / K", "Next / previous"], ["Enter", "Read the posting"], ["?", "This list"]].map(([k, v]) => (
              <div key={k} style={{ display: "flex", gap: 14, padding: "3px 0" }}><span style={{ ...kbd, minWidth: 52, textAlign: "center" }}>{k}</span>{v}</div>
            ))}
          </div>
        )}
      </div>
    </MotionConfig>
  );
}
