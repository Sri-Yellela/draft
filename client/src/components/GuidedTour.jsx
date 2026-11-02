// ⭐ D129 (owner 11-01) · THE GUIDED TOUR — after the résumé is picked, one guided path through every section on the REAL
// pages (never screenshots), then two real Drafts watched end to end, then The Table, then the survey.
//
// ⚠ REBUILT 11-01 to the owner's bug report ("nothing there, no score … obscured and not at the right place"):
//   · the spotlight is a CLEAR CUT-OUT — four dim panels around the target (≤ 40 %), the target at full brightness inside
//     a thin outline, never a filled box over it;
//   · the target is measured only once it is in view and has stopped moving (two equal reads 120 ms apart), and again
//     as the page moves;
//   · the popover never covers its target or the navigation (lib/tourGeometry.js placePopover); on a phone a sheet at
//     the edge that hides the target least;
//   · a step that opens a drawer lights the drawer, in its own step; every caption names what is lit;
//   · the card is three steps (the match WITH ITS SCORE · the facts · Pass / Save / Draft); "your turn" lights the whole
//     deck with a live "Drafted N of 2".
// Each step's time is recorded (shared/trialTour.js's ids; POST /api/trial/event). Progress is per trial account.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import DepthButton from "./DepthButton.jsx";
import { Z } from "../styles/zLayers.js";
import { DECK_SCROLL_MS } from "../../../shared/trialTour.js";
import { placePopover, cutoutPanels } from "../lib/tourGeometry.js";
import TrialDemo from "./TrialDemo.jsx";

export const TOUR_KEY = "draft.tour";

/**
 * The path, in order (pick_resume happened on /try). Each step: the page, the element it lights, its caption and the
 * shorter Faster one; `require` gates Next; `sweep` deals the deck; `expand` opens the top card; `settings` opens Auto
 * settings (and puts them back after); `example` shows Draft House's example; `finish` ends the tour into the survey.
 */
export const TOUR_SCRIPT = Object.freeze([
  { id: "deck", route: "/app/today", target: "[data-deck-stage]", sweep: true,
    text: "These jobs were picked for this résumé from today's live postings. Watch the deck deal: the best match ends on top.",
    short: "Picked for this résumé; the best match ends on top." },
  { id: "deck_match", route: "/app/today", target: "[data-deck-signal-row]",
    text: "The match: how well this résumé fits the job, as a score and as the posting's skills it already shows. Press it for the full report.",
    short: "The match: the score and the skills it shows." },
  { id: "deck_facts", route: "/app/today", target: "[data-fan-offset=\"0\"] [data-posting-masthead]", expand: true,
    text: "The facts, first: the level the job is written for, how fresh the posting is, and the employer's visa record.",
    short: "The level, how fresh it is, the visa record." },
  { id: "deck_actions", route: "/app/today", target: "[data-deck-actions]",
    text: "Pass, Save or Draft. Draft makes a résumé tailored to this job and fills in the application for you.",
    short: "Pass, Save or Draft." },
  { id: "filters", route: "/app/jobs", target: "#fh-sentence",
    require: { kind: "selector", selector: "[data-panel]", press: "[data-slot]", interaction: "filter_tried", label: "Press any word in the sentence to try a filter." },
    text: "Full House is every match, filtered by this one sentence. Press a word to change your field, level, location or remote, or add employers with H-1B filings.",
    short: "Every match, filtered by this sentence. Press a word." },
  { id: "draft_house", route: "/app/auto-apply", target: "[data-draft-tree]", example: true,
    text: "Draft House: every application while draft works on it. This is an example: each tile is a company, its ring says where the application is.",
    short: "Every application, by stage (an example)." },
  { id: "modes", route: "/app/auto-apply", target: ".dh-mode", example: true,
    text: "Ask me first sends nothing until you approve it. Apply for me sends good matches on its own.",
    short: "Ask me first, or Apply for me." },
  { id: "auto_settings", route: "/app/auto-apply", target: "[data-auto-settings]", example: true, settings: true,
    text: "Auto settings: how many a day, when draft looks, and which jobs. Try one if you like; we put them back when you press Next.",
    short: "How many a day, when, which jobs. We put them back." },
  { id: "atlas_map", route: "/app/atlas", target: "[data-your-map]",
    text: "Your map, built from the résumé: coloured skills are the ones it shows, grey ones are the next step up.",
    short: "What the résumé shows, and what's next." },
  { id: "atlas_learn", route: "/app/atlas/learn", target: "[data-learn-wheel]",
    text: "Learn is a course in pieces round a wheel; finishing a piece unlocks skills on your map. Zoom with + and −.",
    short: "Finish pieces, unlock skills.",
    textOtherField: "Learn holds the computing course for now; a course for your field is coming. Your map works for every field today.",
    shortOtherField: "Learn: your field's course is coming." },
  { id: "pick_two", route: "/app/today", target: "[data-deck-clip]", auto: true,
    require: { kind: "drafts", count: 2, interaction: "card_picked", label: "Press Draft on 2 jobs you would send." },
    text: "Your turn. Look through your 10 picks — scroll or use the arrows — and press Draft on the 2 you'd send.",
    short: "Look through your picks; Draft the 2 you'd send." },
  // Owner 11-01: "drafting 2 picks should automatically take them to the survey … show the complete simulation".
  { id: "live_run", route: "/app/auto-apply", target: "[data-trial-demo]", demo: true, noNext: true,
    text: "Here's what draft does for each pick: reads the job, tailors the résumé, fills the application and sends it. This is a demonstration; nothing goes to the employer.",
    short: "A demonstration of each pick, end to end." },
  { id: "table", route: "/app/database", target: "[data-table-split]", noNext: true, autoAfter: 5000, finish: true,
    text: "Every application lands here, with replies as they come in.",
    short: "Every application, and the replies." },
]);

// Keyed by the trial account's start, so a second test account in the same browser gets its own tour.
const keyFor = (state) => `${TOUR_KEY}.${state?.startedAt ?? "x"}`;
export const readTourProgress = (state) => { try { return JSON.parse(localStorage.getItem(keyFor(state)) || "null") || {}; } catch { return {}; } };
const write = (state, v) => { try { localStorage.setItem(keyFor(state), JSON.stringify(v)); } catch { /* storage blocked: the tour still runs */ } };
const reducedMotion = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };
const isPhone = () => (typeof window !== "undefined" && window.innerWidth < 600);
const send = (event, detail) => api("/api/trial/event", { method: "POST", body: JSON.stringify({ event, detail }) }).catch(() => {});
const fire = (name, detail) => {
  if (name === "draft:house-example") window.draftTourExample = !!detail.on;   // the page may mount after the event
  window.dispatchEvent(new CustomEvent(name, { detail }));
};
/** The bottom of the top navigation — nothing of the tour is placed over it. */
function navBottom() {
  const nav = document.querySelector('nav[aria-label="Main"]');
  if (!nav) return 0;
  let el = nav;
  while (el && el !== document.body) {
    const pos = getComputedStyle(el).position;
    if (pos === "fixed" || pos === "sticky") return Math.max(0, el.getBoundingClientRect().bottom);
    el = el.parentElement;
  }
  return Math.max(0, nav.getBoundingClientRect().bottom);
}
const same = (a, b) => a && b && Math.abs(a.top - b.top) < 1 && Math.abs(a.left - b.left) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1;

/** The caption a step shows at a speed, for a field (Learn's own line where the course is not that field's). */
export function captionFor(step, { speed = "normal", field = null } = {}) {
  const other = step.textOtherField && field && field !== "computing";
  if (speed === "faster") return other ? step.shortOtherField : step.short;
  return other ? step.textOtherField : step.text;
}

export default function GuidedTour({ state, onFinish, onActive, onSkipToSurvey }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const saved = useMemo(() => readTourProgress(state), []);   // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(Number.isInteger(saved.i) ? Math.min(saved.i, TOUR_SCRIPT.length - 1) : 0);
  const [speed, setSpeed] = useState(saved.speed === "faster" ? "faster" : "normal");
  const [done, setDone] = useState(!!saved.done);
  const [rect, setRect] = useState(null);          // the target, once it has stopped moving
  const [met, setMet] = useState(false);
  const [drafted, setDrafted] = useState(0);
  const [phone, setPhone] = useState(isPhone);
  const [view, setView] = useState({ vw: typeof window !== "undefined" ? window.innerWidth : 1280, vh: typeof window !== "undefined" ? window.innerHeight : 800, nav: 0 });
  const [popH, setPopH] = useState(200);
  const [slot, setSlot] = useState(null);      // Draft House's #trial-demo-slot, once the page has mounted
  const popRef = useRef(null);
  const startedAt = useRef(Date.now());
  const step = TOUR_SCRIPT[i];
  const device = phone ? "phone" : "laptop";
  const tour = useCallback((s, phase, ms) => send("tour", { step: s, phase, ms, device, speed }), [device, speed]);

  useEffect(() => { write(state, { i, speed, done }); }, [i, speed, done]);   // eslint-disable-line react-hooks/exhaustive-deps
  // The trial dock steps aside while the tour is on screen (on a phone the two overlapped).
  // Once the trial locks (the 2 sent) only the last step, The Table, may still be on screen — then the survey's pop-up.
  const live = !done && !(state?.locked && !step?.finish);
  useEffect(() => { onActive?.(live); return () => onActive?.(false); }, [live]);   // eslint-disable-line react-hooks/exhaustive-deps   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const r = () => setPhone(isPhone()); window.addEventListener("resize", r); return () => window.removeEventListener("resize", r); }, []);
  // The résumé was picked on /try: the tour's first step is already done when the tour starts.
  useEffect(() => { if (!saved.i && !saved.done) { send("tour", { step: "pick_resume", phase: "completed", ms: 0, device, speed }); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Entering a step: go to its page, record it.
  useEffect(() => {
    if (done || !step) return;
    startedAt.current = Date.now();
    setMet(!step.require);
    setRect(null);
    tour(step.id, "reached", 0);
    if (step.route && pathname !== step.route) navigate(step.route);
  }, [i, done]);   // eslint-disable-line react-hooks/exhaustive-deps

  // What a step asks of its page, undone when the step ends: Draft House's example, Auto settings opened (and put back),
  // the top card opened for its facts.
  useEffect(() => {
    if (done || !step) return undefined;
    if (step.example) fire("draft:house-example", { on: true });
    const t = [];
    if (step.settings) t.push(setTimeout(() => fire("draft:tour-settings", { open: true }), 400));
    if (step.expand) t.push(setTimeout(() => fire("draft:deck-expand", { open: true }), 300));
    return () => {
      t.forEach(clearTimeout);
      if (step.settings) fire("draft:tour-settings", { open: false });
      if (step.expand) fire("draft:deck-expand", { open: false });
      if (step.example) fire("draft:house-example", { on: false });   // the next example step turns it straight back on
    };
  }, [i, done]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => fire("draft:house-example", { on: false }), []);

  // The target: scrolled into view once, then measured until it stops moving (two equal reads), then followed.
  useEffect(() => {
    if (done || !step?.target) { setRect(null); return undefined; }
    let scrolled = false, misses = 0, reported = false, last = null, stable = false, still = 0;
    // A step that OPENS something (the card, the Settings drawer) is measured only once that has opened and settled.
    const startAt = Date.now() + (step.expand || step.settings ? 1100 : 0);
    const read = () => {
      if (Date.now() < startAt) return;
      setView(v => {
        const next = { vw: window.innerWidth, vh: window.innerHeight, nav: navBottom() };
        return v.vw === next.vw && v.vh === next.vh && v.nav === next.nav ? v : next;
      });
      const el = document.querySelector(step.target);
      if (!el || !el.getClientRects().length) {
        if (++misses === 40 && !reported) { reported = true; send("error", { code: "target_missing", step: step.id }); }
        last = null; stable = false; setRect(null); return;
      }
      if (!scrolled) { scrolled = true; el.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" }); return; }
      const r = el.getBoundingClientRect();
      // Only the part on screen: a target taller than the screen (The Table on a phone, still loading below the fold)
      // otherwise never reads the same twice, and its spotlight never shows.
      const top = Math.max(r.top, 0), bottom = Math.min(r.bottom, window.innerHeight);
      const now = { top, left: r.left, width: r.width, height: Math.max(0, bottom - top) };
      // Step 1, the deck being dealt: it moves the whole time, so it is FOLLOWED, never hidden until still — as before
      // 11-01's rebuild (owner: "step 1 of the tour is flickering like crazy … this step was fine in the previous version").
      if (step.sweep) { setRect(prev => (same(prev, now) ? prev : now)); return; }
      still = same(now, last) ? still + 1 : 0;      // stable = three equal reads in a row
      if (still >= 2) { stable = true; setRect(prev => (same(prev, now) ? prev : now)); }
      else if (stable && still === 0) setRect(null); // it started moving again: hide until it settles
      last = now;
    };
    read();
    const t = setInterval(read, 120);
    return () => clearInterval(t);
  }, [i, done, pathname]);   // eslint-disable-line react-hooks/exhaustive-deps

  // The demonstration renders into Draft House's own slot (it mounts after the step navigates there).
  useEffect(() => {
    if (done || !step?.demo) { setSlot(null); return undefined; }
    const find = () => setSlot(document.getElementById("trial-demo-slot"));
    find();
    const t = setInterval(find, 250);
    return () => clearInterval(t);
  }, [i, done, pathname]);   // eslint-disable-line react-hooks/exhaustive-deps

  // The popover's real height, for placing it.
  useEffect(() => { if (popRef.current) setPopH(popRef.current.offsetHeight); });

  // D129 (1): deal the deck once it is on the page — a card every 0.5 s (quicker when Faster), to the top.
  // ONCE per visit to the step: a spotlight that blinked re-dealt the deck from the start every time (the flicker).
  const swept = useRef(-1);
  useEffect(() => {
    if (!step?.sweep) { swept.current = -1; return undefined; }   // Back to step 1 later deals it again
    if (done || !rect || swept.current === i) return undefined;
    const t = setTimeout(() => { swept.current = i; window.dispatchEvent(new CustomEvent("draft:deck-sweep",
      { detail: { every: speed === "faster" ? DECK_SCROLL_MS / 2 : DECK_SCROLL_MS } })); }, 300);
    return () => clearTimeout(t);
  }, [i, done, !!rect]);   // eslint-disable-line react-hooks/exhaustive-deps

  // A required action: a filter tried, or 2 Drafts made (read from the trial's own count — shown live).
  useEffect(() => {
    if (done || !step?.require || met) return undefined;
    const r = step.require;
    const check = async () => {
      if (r.kind === "selector" && document.querySelector(r.selector)) { setMet(true); send("interaction", { name: r.interaction, step: step.id }); }
      if (r.kind === "drafts") {
        try {
          const st = await api("/api/trial/state");
          const n = Math.max(st.draftsUsed ?? 0, st.sent ?? 0);
          setDrafted(n);
          if (n >= r.count) {
            setMet(true); send("interaction", { name: r.interaction, step: step.id });
            if (step.auto) setTimeout(() => { tour(step.id, "completed", Date.now() - startedAt.current); setI(x => x + 1); }, 1200);
          }
        } catch { /* try again */ }
      }
    };
    check();
    const t = setInterval(check, r.kind === "drafts" ? 3000 : 400);
    // Pressing the element itself also counts (a phone's tap can open the panel after the check has looked).
    const onPress = (e) => { if (r.press && e.target?.closest?.(r.press)) { setMet(true); send("interaction", { name: r.interaction, step: step.id }); } };
    document.addEventListener("click", onPress, true);
    return () => { clearInterval(t); document.removeEventListener("click", onPress, true); };
  }, [i, done, met]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (done || !step?.autoAfter) return undefined;
    const t = setTimeout(() => next(), step.autoAfter);
    return () => clearTimeout(t);
  }, [i, done]);   // eslint-disable-line react-hooks/exhaustive-deps

  // The demonstration ended: the two picks are recorded as sent by demonstration (the trial locks into the survey).
  const demoDone = async () => {
    try { await api("/api/trial/demo/complete", { method: "POST" }); } catch { /* the Table step still shows */ }
    tour(step.id, "completed", Date.now() - startedAt.current);
    setI(n => Math.min(n + 1, TOUR_SCRIPT.length - 1));
  };

  const next = async () => {
    tour(step.id, "completed", Date.now() - startedAt.current);
    if (step.finish) { send("tour", { step: "survey", phase: "reached", ms: 0, device, speed }); setDone(true); await onFinish?.(); return; }
    setI(n => Math.min(n + 1, TOUR_SCRIPT.length - 1));
  };
  const back = () => setI(n => Math.max(0, n - 1));
  // 44b (owner 11-02): "remove the skip option entirely; skip should take them to the survey before they can explore the
  // site". Leaving the tour ENDS the trial into the survey — it never leaves a tester in the open app with no guide.
  const skip = () => { tour(step.id, "abandoned", Date.now() - startedAt.current); setDone(true); onSkipToSurvey?.(); };
  // A tour left by the old Skip (its progress says done, the trial is still open): the same road, the survey.
  useEffect(() => { if (saved.done && !state?.locked) onSkipToSurvey?.(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const toggleSpeed = () => {
    const nextSpeed = speed === "faster" ? "normal" : "faster";
    setSpeed(nextSpeed);
    send("interaction", { name: nextSpeed === "faster" ? "faster_on" : "faster_off", step: step.id });
  };

  if (!live || !step) return null;
  const caption = captionFor(step, { speed, field: state?.fieldGuess });
  const waiting = step.target && !rect;
  const place = placePopover({ rect, h: popH, vw: view.vw, vh: view.vh, navBottom: view.nav, phone });
  const dim = "color-mix(in srgb, var(--color-text) 38%, transparent)";
  return (
    <>
      {slot && createPortal(<TrialDemo onDone={demoDone}/>, slot)}
      {rect && cutoutPanels(rect, { vw: view.vw, vh: view.vh }).map((p, k) => (
        <div key={k} aria-hidden="true" data-tour-dim={k}
          style={{ position: "fixed", ...p, background: dim, pointerEvents: "none", zIndex: Z.TOAST - 2 }}/>
      ))}
      {rect && (
        <div aria-hidden="true" data-tour-spotlight="" data-tour-cutout=""
          style={{ position: "fixed", top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12,
                   borderRadius: 8, outline: "2px solid var(--color-primary)", background: "transparent", pointerEvents: "none",
                   zIndex: Z.TOAST - 2 }}/>
      )}
      <div ref={popRef} role="dialog" aria-label={`Tour step ${i + 1} of ${TOUR_SCRIPT.length}`} data-guided-tour={step.id}
        data-tour-target={step.target || ""} data-tour-side={place.side}
        style={{ position: "fixed", top: place.top, left: place.left, width: place.width, zIndex: Z.TOAST, boxSizing: "border-box",
                 padding: 14, borderRadius: 8, background: "var(--c-surface-solid)",   // solid: the page never shows through the caption color: "var(--color-text)",
                 border: "1px solid var(--color-border)", boxShadow: "0 8px 30px color-mix(in srgb, var(--color-text) 25%, transparent)",
                 // waiting for its target: hidden AND not in the way — a see-through popover still caught the presses
                 // under it (the demonstration's 2nd consent box, 11-01)
                 opacity: waiting ? 0 : 1, pointerEvents: waiting ? "none" : "auto", transition: reducedMotion() ? "none" : "opacity .15s" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, color: "var(--color-text-muted)" }}>
          <span data-tour-progress="">Step {i + 1} of {TOUR_SCRIPT.length}</span>
          <label style={{ display: "flex", gap: 4, alignItems: "center", cursor: "pointer" }}>
            <input type="checkbox" checked={speed === "faster"} onChange={toggleSpeed} data-tour-faster=""/> Faster
          </label>
        </div>
        <p style={{ margin: "8px 0", fontSize: 15, lineHeight: 1.45 }}>{caption}</p>
        {step.require?.kind === "drafts" && (
          <p role="status" data-tour-drafted={drafted} style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700 }}>Drafted {Math.min(drafted, 2)} of 2</p>
        )}
        {step.require && !met && <p role="status" style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600 }} data-tour-require="">{step.require.label}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap", alignItems: "center" }}>
          <DepthButton onClick={skip} data-tour-skip="">Skip to the survey</DepthButton>
          <span style={{ display: "flex", gap: 8 }}>
            {i > 0 && <DepthButton onClick={back} data-tour-back="">Back</DepthButton>}
            {!step.noNext && <DepthButton primary disabled={!met} onClick={next} data-tour-next="">Next</DepthButton>}
          </span>
        </div>
      </div>
    </>
  );
}
