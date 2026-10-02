// ── The landing page's one idea: find → fit → apply (queue 31) ──────────────────────────────
//
// docs/BRAND_OUTLAY_AND_MOTION.md §"The wrapper problem". draft is a wrapper over several products
// and the page advertised one. ⛔ The failure mode is a FEATURE GRID — it replaced exactly that: four
// numbered cards ("AI Resume Generation · ATS Score & Gap Analysis · Cover Letter Generator · Auto
// Apply") and a marquee of feature names, two of which promised the opposite of the product ("AI-
// Powered Writing — Claude rewrites every bullet", "let AI do the heavy lifting").
//
// ⭐ ONE VERB, MANY SURFACES. Every tool is a station on one line, introduced where it belongs, and
// ⛔ written as what it does for a person — never a feature name. A visitor scrolling walks the line
// once and each stop lights as it is reached.
// ⛔ NO PROMISES AS A PITCH (owner, 10-01 — the WORKLOG audit's item 7). "Nothing is submitted until
// you approve it", "it will not claim anything you did not" and the reworded "it will not inflate your
// years or seniority" were all ditched as selling points: the page says what each tool DOES. The
// approval sentence survives only where it is FUNCTIONAL — inside the auto-apply flow and the deck's
// Draft toast, at the moment a user queues something and needs to know what happens next.
// ⛔ Only what a visitor can use today is offered as a link. Grading a posting (R1) has no public route
// and the connectors have no public token policy (OWNER 16c), so the recruiter line says "soon".
// ⛔ Motion: the line draws as you scroll — IntersectionObserver + CSS transitions; content is VISIBLE
// by default and only hidden once the observer is known to work, and never under reduced motion.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import { C } from "../styles/colorTokens.js";
import { glass } from "../styles/glass.js";

export const STATIONS = [
  {
    verb: "find",
    line: "Jobs come to you, ordered by how well they fit your résumé.",
    surfaces: [
      { name: "Today's draft", say: "Ten jobs a day, picked for you. Not a search box.", to: "/register", cta: "Get today's draft" },
      { name: "The board", say: "Every job we track, read against your résumé and ordered by fit. Search it above — no account needed." },
    ],
  },
  {
    verb: "fit",
    line: "See what a machine sees in your résumé, then shape it for one posting — honestly.",
    surfaces: [
      { name: "The ATS check", say: "What an applicant-tracking system sees in your résumé before a human does. Free, no account.", to: "/tools/ats", cta: "Check a résumé" },
      { name: "Tailoring", say: "One résumé, shaped for one posting, from inside that job's card." },
    ],
  },
  {
    verb: "apply",
    line: "The tedious part, done for you. The decision stays yours.",
    surfaces: [
      { name: "Your review queue", say: "Queue an application, see what was filled in, then approve it or don't." },
      { name: "The browser extension", say: "Capture a job from any page, and fill the form you signed in to reach. You submit." },
    ],
  },
];

function useReached(count, reduced) {
  const refs = useRef([]);
  // Visible by default: hidden only once we KNOW the observer will reveal it again.
  const [armed, setArmed] = useState(false);
  const [reached, setReached] = useState(() => new Set());
  useEffect(() => {
    if (reduced || typeof IntersectionObserver === "undefined") return;
    setArmed(true);
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) {
        const i = Number(e.target.dataset.station);
        setReached(prev => (prev.has(i) ? prev : new Set(prev).add(i)));
      }
    }, { rootMargin: "0px 0px -18% 0px" });
    refs.current.slice(0, count).forEach(el => el && io.observe(el));
    return () => io.disconnect();
  }, [count, reduced]);
  return { refs, shown: (i) => !armed || reached.has(i), progress: armed ? reached.size / count : 1 };
}

export default function FindFitApply() {
  const reduced = useReducedMotion();
  const { refs, shown, progress } = useReached(STATIONS.length, reduced);
  const ease = "cubic-bezier(0.2, 0.8, 0.2, 1)";

  return (
    <section aria-labelledby="ffa-title" data-find-fit-apply
      style={{ maxWidth: 1040, margin: "0 auto", padding: "72px 20px 88px", boxSizing: "border-box", color: C.INK }}>
      <h2 id="ffa-title" style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: "clamp(40px, 6vw, 72px)",
                                    lineHeight: 1, letterSpacing: "-0.01em", margin: "0 0 14px", textAlign: "center" }}>
        find <span style={{ color: C.ACCENT_INK }}>/</span> fit <span style={{ color: C.ACCENT_INK }}>/</span> apply
      </h2>
      <p style={{ fontSize: 17, color: C.INK_MUTED, textAlign: "center", maxWidth: 560, margin: "0 auto 56px", lineHeight: 1.55 }}>
        One line from a job you have not seen yet to an application you chose to send. Every tool here is a stop on it.
      </p>

      <ol style={{ listStyle: "none", padding: 0, margin: 0, position: "relative", display: "grid", gap: 28 }}>
        {/* The line itself: it draws down as each stop is reached. */}
        <span aria-hidden="true" style={{ position: "absolute", left: 27, top: 30, bottom: 30, width: 2, background: C.BORDER, borderRadius: 2 }}>
          <span style={{ position: "absolute", inset: 0, background: C.ACCENT, transformOrigin: "top",
                         transform: `scaleY(${progress})`, transition: reduced ? "none" : `transform 700ms ${ease}` }} />
        </span>
        {STATIONS.map((st, i) => {
          const on = shown(i);
          return (
            <li key={st.verb} ref={el => { refs.current[i] = el; }} data-station={i} data-reached={on ? "yes" : "no"}
              style={{ position: "relative", paddingLeft: 76,
                       opacity: on ? 1 : 0, transform: on ? "none" : "translate3d(0, 28px, 0)",
                       transition: reduced ? "none" : `opacity 500ms ${ease}, transform 600ms ${ease}` }}>
              <span aria-hidden="true" style={{ position: "absolute", left: 14, top: 14, width: 28, height: 28, borderRadius: 999,
                                                background: on ? C.ACCENT : C.SURFACE_SOLID, border: `2px solid ${on ? C.ACCENT_INK : C.BORDER_STRONG}`,
                                                transition: reduced ? "none" : `background 400ms ${ease}` }} />
              <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: "clamp(34px, 4.4vw, 52px)", lineHeight: 1, margin: "0 0 8px" }}>
                {st.verb}
              </h3>
              <p style={{ fontSize: 16.5, color: C.INK_MUTED, margin: "0 0 16px", maxWidth: 620, lineHeight: 1.5 }}>{st.line}</p>
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
                {st.surfaces.map(sf => (
                  <div key={sf.name} style={{ ...glass({ radius: 18 }), padding: "16px 18px" }}>
                    <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.INK_FAINT, marginBottom: 6 }}>
                      {sf.name}
                    </div>
                    <div style={{ fontSize: 15, lineHeight: 1.5, color: C.INK }}>{sf.say}</div>
                    {sf.to && <Link to={sf.to} style={{ display: "inline-block", marginTop: 10, fontSize: 14, fontWeight: 800, color: C.ACCENT_INK }}>{sf.cta} →</Link>}
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ol>

      <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginTop: 72 }}>
        <Link to="/register" style={{ background: C.ACCENT, color: C.ON_ACCENT, border: `1px solid ${C.ACCENT_INK}`, borderRadius: 999,
                                      padding: "13px 26px", fontWeight: 800, fontSize: 15, textDecoration: "none", boxShadow: C.SHADOW_GLASS }}>
          Get today's draft
        </Link>
        <Link to="/tools/ats" style={{ ...glass({ radius: 999 }), padding: "13px 26px", fontWeight: 800, fontSize: 15, color: C.INK, textDecoration: "none" }}>
          Check a résumé — no account
        </Link>
      </div>

      {/* The same line, reversed — the brand's best symmetry, stated honestly as not yet here. */}
      <p style={{ textAlign: "center", fontSize: 13.5, color: C.INK_FAINT, margin: "40px auto 0", maxWidth: 560, lineHeight: 1.55 }}>
        Hiring? The same line runs the other way — find candidates, see the fit, reach out — starting with a free
        grade of your own job posting. Soon.
      </p>
    </section>
  );
}
