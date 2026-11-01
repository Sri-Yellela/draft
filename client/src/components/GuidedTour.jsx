// ⭐ D129 (owner 11-01) · THE GUIDED TOUR — after the résumé is picked, one guided path through every section on the REAL
// pages (never screenshots), then two real Drafts watched end to end, then The Table, then the survey.
//
// Coach-marks: a spotlight on the page's own element, a short caption, Back · Next, "Step N of 11". Some steps ask for
// the one action first (try a filter; Draft 2 jobs) and Next unlocks when it is done. "Faster" shortens every caption
// and quickens the deck's sweep. Reduced motion: no auto-scroll; the deck jumps to the top. Phone: the caption is a
// sheet along the bottom. Each step's time is recorded (shared/trialTour.js's ids; POST /api/trial/event) so the
// funnel in Admin → Trial shows where people slow down or leave. Progress is a per-browser convenience (localStorage).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import DepthButton from "./DepthButton.jsx";
import { Z } from "../styles/zLayers.js";
import { DECK_SCROLL_MS } from "../../../shared/trialTour.js";

export const TOUR_KEY = "draft.tour";

/**
 * The path, in order (pick_resume happened on /try). Each step: the page, the element it lights, its caption and the
 * shorter Faster one; `require` gates Next; `sweep` deals the deck; `finish` ends the tour into the survey.
 */
export const TOUR_SCRIPT = Object.freeze([
  { id: "deck", route: "/app/today", target: "[data-deck-stage]", sweep: true,
    text: "These jobs were picked for this résumé from today's live postings. Watch the deck deal: the best match ends on top.",
    short: "Picked for this résumé; the best match ends on top." },
  { id: "deck_card", route: "/app/today", target: "[data-deck-signal-row]",
    text: "Each card says how well the résumé matches the job. Open it to see the level, how fresh it is and the employer's visa record. Pass, Save and Draft sit at the bottom.",
    short: "The match, then Pass, Save or Draft." },
  { id: "filters", route: "/app/jobs", target: "#fh-sentence",
    require: { kind: "selector", selector: "[data-panel]", press: "[data-slot]", interaction: "filter_tried", label: "Press any word in the sentence to try a filter." },
    text: "Full House is every match, filtered by one sentence. Press a word to change your field, level, location or remote, or add employers with H-1B filings. draft reads every posting so you don't apply to jobs you can't get.",
    short: "Every match, filtered by one sentence. Press a word." },
  { id: "draft_house", route: "/app/auto-apply", target: "[data-draft-tree]",
    text: "Draft House is where every application lives while draft works on it: Needs you, Ready for review, Working, Sent, Replied. Open a branch to see what happened, the answers given, the form as filled and what changed in the résumé.",
    short: "Every application, by stage. Open a branch for the details." },
  { id: "auto_settings", route: "/app/auto-apply", target: ".dh-mode",
    text: "Two modes. Ask me first sends nothing until you approve it. Apply for me sends on its own, within your Auto settings: a daily limit, run times and which jobs. The trial stays on Ask me first.",
    short: "Ask me first, or Apply for me within your limits." },
  { id: "atlas_map", route: "/app/atlas", target: "[data-your-map]",
    text: "Your map, built from the résumé: coloured skills are the ones it shows, grey ones are the next step up. Open a family to see what each skill is worth on today's postings.",
    short: "What the résumé shows, and what's next." },
  { id: "atlas_learn", route: "/app/atlas/learn", target: "[data-learn-wheel]",
    text: "Learn is a course in pieces round a wheel; finishing a piece unlocks skills on your map. Zoom with + and −.",
    short: "Finish pieces, unlock skills.",
    textOtherField: "Learn holds the computing course for now; a course for your field is coming. Your map works for every field today.",
    shortOtherField: "Learn: your field's course is coming." },
  { id: "pick_two", route: "/app/today", target: "[data-deck-actions]",
    require: { kind: "drafts", count: 2, interaction: "card_picked", label: "Press Draft on 2 jobs you would send." },
    text: "Your turn: pick 2 of these jobs and press Draft on each.",
    short: "Draft 2 jobs." },
  { id: "live_run", route: "/app/auto-apply", target: "[data-draft-tree]",
    text: "Watch them run: the résumé tailored to each job, the form filled step by step, then Sent. Drafts from a sample go to draft's practice form, never to the employer, and the consent box is always yours to tick.",
    short: "Tailored, filled, sent: watch it happen." },
  { id: "table", route: "/app/database", target: "[data-table-split]",
    text: "The Table keeps every application you sent. Replies, interviews and rejections land here, and the confirmation is in your Inbox.",
    short: "Every application you sent, and the replies." },
  { id: "survey", route: null, finish: true,
    text: "That's the tour. Two minutes of questions and you're done; they shape what we build next.",
    short: "Last: two minutes of questions." },
]);

export const readTourProgress = () => { try { return JSON.parse(localStorage.getItem(TOUR_KEY) || "null") || {}; } catch { return {}; } };
const write = (v) => { try { localStorage.setItem(TOUR_KEY, JSON.stringify(v)); } catch { /* storage blocked: the tour still runs */ } };
const reducedMotion = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };
const isPhone = () => (typeof window !== "undefined" && window.innerWidth < 600);
const send = (event, detail) => api("/api/trial/event", { method: "POST", body: JSON.stringify({ event, detail }) }).catch(() => {});

/** The caption a step shows at a speed, for a field (Learn's own line where the course is not that field's). */
export function captionFor(step, { speed = "normal", field = null } = {}) {
  const other = step.textOtherField && field && field !== "computing";
  if (speed === "faster") return other ? step.shortOtherField : step.short;
  return other ? step.textOtherField : step.text;
}

export default function GuidedTour({ state, onFinish, onActive }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const saved = useMemo(readTourProgress, []);
  const [i, setI] = useState(Number.isInteger(saved.i) ? Math.min(saved.i, TOUR_SCRIPT.length - 1) : 0);
  const [speed, setSpeed] = useState(saved.speed === "faster" ? "faster" : "normal");
  const [done, setDone] = useState(!!saved.done);
  const [rect, setRect] = useState(null);
  const [met, setMet] = useState(false);
  const [phone, setPhone] = useState(isPhone);
  const startedAt = useRef(Date.now());
  const step = TOUR_SCRIPT[i];
  const device = phone ? "phone" : "laptop";
  const tour = useCallback((s, phase, ms) => send("tour", { step: s, phase, ms, device, speed }), [device, speed]);

  useEffect(() => { write({ i, speed, done }); }, [i, speed, done]);
  // The trial dock steps aside while the tour is on screen (on a phone the two overlapped).
  useEffect(() => { onActive?.(!done && !state?.locked); return () => onActive?.(false); }, [done, state?.locked]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const r = () => setPhone(isPhone()); window.addEventListener("resize", r); return () => window.removeEventListener("resize", r); }, []);
  // The résumé was picked on /try: the tour's first step is already done when the tour starts.
  useEffect(() => { if (!saved.i && !saved.done) { send("tour", { step: "pick_resume", phase: "completed", ms: 0, device, speed }); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Entering a step: go to its page, record it, deal the deck when the step says so.
  useEffect(() => {
    if (done || !step) return;
    startedAt.current = Date.now();
    setMet(!step.require);
    tour(step.id, "reached", 0);
    if (step.route && pathname !== step.route) navigate(step.route);
  }, [i, done]);   // eslint-disable-line react-hooks/exhaustive-deps

  // The spotlight follows its element (it may render late, move with the page or be missing).
  useEffect(() => {
    if (done || !step?.target) { setRect(null); return; }
    let scrolled = false, misses = 0, reported = false;
    const find = () => {
      const el = document.querySelector(step.target);
      if (!el) {
        if (++misses === 25 && !reported) { reported = true; send("error", { code: "target_missing", step: step.id }); }
        setRect(null); return;
      }
      if (!scrolled) { scrolled = true; el.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" }); }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    find();
    const t = setInterval(find, 200);
    return () => clearInterval(t);
  }, [i, done, pathname]);   // eslint-disable-line react-hooks/exhaustive-deps

  // D129 (1): deal the deck once it is on the page — a card every 0.5 s (quicker when Faster), to the top.
  useEffect(() => {
    if (done || !step?.sweep || !rect) return;
    const t = setTimeout(() => window.dispatchEvent(new CustomEvent("draft:deck-sweep",
      { detail: { every: speed === "faster" ? DECK_SCROLL_MS / 2 : DECK_SCROLL_MS } })), 300);
    return () => clearTimeout(t);
  }, [i, done, !!rect]);   // eslint-disable-line react-hooks/exhaustive-deps

  // A required action: a filter panel opened, or 2 Drafts made (read from the trial's own count).
  useEffect(() => {
    if (done || !step?.require || met) return;
    const r = step.require;
    const check = async () => {
      if (r.kind === "selector" && document.querySelector(r.selector)) { setMet(true); send("interaction", { name: r.interaction, step: step.id }); }
      if (r.kind === "drafts") {
        try {
          const st = await api("/api/trial/state");
          if ((st.draftsUsed ?? 0) >= r.count || (st.sent ?? 0) >= r.count) { setMet(true); send("interaction", { name: r.interaction, step: step.id }); }
        } catch { /* try again */ }
      }
    };
    const t = setInterval(check, r.kind === "drafts" ? 3000 : 400);
    // Pressing the element itself also counts (a phone's tap can open the panel after the check has looked).
    const onPress = (e) => { if (r.press && e.target?.closest?.(r.press)) { setMet(true); send("interaction", { name: r.interaction, step: step.id }); } };
    document.addEventListener("click", onPress, true);
    return () => { clearInterval(t); document.removeEventListener("click", onPress, true); };
  }, [i, done, met]);   // eslint-disable-line react-hooks/exhaustive-deps

  const next = async () => {
    tour(step.id, "completed", Date.now() - startedAt.current);
    if (step.finish) { setDone(true); await onFinish?.(); return; }
    setI(n => Math.min(n + 1, TOUR_SCRIPT.length - 1));
  };
  const back = () => setI(n => Math.max(0, n - 1));
  const skip = () => { tour(step.id, "abandoned", Date.now() - startedAt.current); setDone(true); };
  const toggleSpeed = () => {
    const nextSpeed = speed === "faster" ? "normal" : "faster";
    setSpeed(nextSpeed);
    send("interaction", { name: nextSpeed === "faster" ? "faster_on" : "faster_off", step: step.id });
  };

  if (done || !step || state?.locked) return null;
  const caption = captionFor(step, { speed, field: state?.fieldGuess });
  const pad = 6;
  const below = rect && rect.top + rect.height + 220 < window.innerHeight;
  const card = phone
    ? { left: 8, right: 8, bottom: 8 }
    : rect
      ? { left: Math.max(8, Math.min(rect.left, window.innerWidth - 400)), ...(below ? { top: rect.top + rect.height + pad + 10 } : { top: Math.max(8, rect.top - 210) }) }
      : { left: "50%", top: "40%", transform: "translate(-50%, -50%)" };
  return (
    <>
      {rect && (
        <div aria-hidden="true" data-tour-spotlight=""
          style={{ position: "fixed", top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2,
                   borderRadius: 6, boxShadow: "0 0 0 9999px color-mix(in srgb, var(--color-text) 40%, transparent)",
                   outline: "2px solid var(--color-primary)", pointerEvents: "none", zIndex: Z.TOAST - 2,
                   transition: reducedMotion() ? "none" : "top .2s, left .2s, width .2s, height .2s" }}/>
      )}
      <div role="dialog" aria-label={`Tour step ${i + 1} of ${TOUR_SCRIPT.length}`} data-guided-tour={step.id}
        style={{ position: "fixed", ...card, zIndex: Z.TOAST, boxSizing: "border-box", width: phone ? "auto" : 380, maxWidth: "calc(100vw - 16px)",
                 padding: 14, borderRadius: 6, background: "var(--color-surface)", color: "var(--color-text)",
                 border: "1px solid var(--color-border)", boxShadow: "0 8px 30px color-mix(in srgb, var(--color-text) 25%, transparent)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, color: "var(--color-text-muted)" }}>
          <span data-tour-progress="">Step {i + 1} of {TOUR_SCRIPT.length}</span>
          <label style={{ display: "flex", gap: 4, alignItems: "center", cursor: "pointer" }}>
            <input type="checkbox" checked={speed === "faster"} onChange={toggleSpeed} data-tour-faster=""/> Faster
          </label>
        </div>
        <p style={{ margin: "8px 0", fontSize: 15, lineHeight: 1.45 }}>{caption}</p>
        {step.require && !met && <p role="status" style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600 }} data-tour-require="">{step.require.label}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap", alignItems: "center" }}>
          <DepthButton onClick={skip} data-tour-skip="">Skip the tour</DepthButton>
          <span style={{ display: "flex", gap: 8 }}>
            {i > 0 && <DepthButton onClick={back} data-tour-back="">Back</DepthButton>}
            <DepthButton primary disabled={!met} onClick={next} data-tour-next="">{step.finish ? "To the survey" : "Next"}</DepthButton>
          </span>
        </div>
      </div>
    </>
  );
}
