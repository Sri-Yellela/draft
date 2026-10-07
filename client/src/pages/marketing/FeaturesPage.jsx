// client/src/pages/marketing/FeaturesPage.jsx
//
// What each tool is for — the detail behind the landing page's find → fit → apply line
// (components/FindFitApply.jsx; docs/BRAND_OUTLAY_AND_MOTION.md §The tools, and what each is for).
//
// ⛔ NOT A FEATURE GRID (10-01). It was five emoji cards ("Generate · ATS Keyword Analysis · Job
// Discovery · Apply Automation · A+ Resume") under "Everything you need to land the interview", and
// one of them promised what the product does not do: "One click fills the application form at any
// portal". Each tool is now a stop on the line, said as what it does for a person, with the ONE thing
// it will not do — the restraint is the pitch — and the honest limit where there is one.
//
// ⛔ EVERY SENTENCE HERE IS CHECKED AGAINST THE CODE, not the aspiration. In particular tailoring does
// NOT say "it will not claim anything you did not": two of two real generations added material the
// candidate never stated, and the claim guard enforces years and seniority only (WORKLOG, CURRENT
// STATE · Fabrication). It says what the guard does, and tells the reader to read every draft.
//
// THE LEVER. The tier names are kept and shown only when monetisation is on — with it off, every tool
// is available to every account, so a tier label would not merely be a commercial claim, it would be
// false. (Kept rather than deleted so they are not rewritten from memory when the lever turns.)
import { Link } from "react-router-dom";
import ScrollDock from "../../components/ScrollDock.jsx";
import { Footer } from "../../components/Footer.jsx";
import { useMonetisationEnabled } from "../../lib/monetisation.jsx";
import { C } from "../../styles/colorTokens.js";
import { glass } from "../../styles/glass.js";

export const TOOLS = [
  {
    verb: "find",
    line: "Jobs come to you, ordered by how well they fit your résumé.",
    tools: [
      { name: "Today's draft", does: "Ten jobs a day, picked against your résumé and dealt as a deck. Draft one, pass on one, save one for later.",
        wont: "Drafting never sends anything — the application waits for your review.", where: "Today, once you sign in" },
      { name: "The board", tier: "Basic", does: "Every job we track, read against your résumé and ordered by fit, with the reason each one is there.",
        wont: "It shows a fit band — Strong, Moderate, Weak — never a falsely precise score.", where: "Jobs, once you sign in" },
    ],
  },
  {
    verb: "fit",
    line: "See what a machine sees in your résumé, then shape it for one posting.",
    tools: [
      { name: "The ATS check", does: "What an applicant-tracking system reads in your résumé for one posting: the skills it finds, and the ones it does not.",
        wont: "No account, no quota, and no AI model reading your résumé — the same deterministic scorer the board ranks by.",
        to: "/tools/ats", cta: "Check a résumé", limit: "Unlimited, no account" },
      { name: "Tailoring", tier: "Plus", does: "One résumé reshaped for one posting, from inside that job's card on the board.",
        wont: "It will not inflate your years or your seniority past what you told it. It can still add detail you never stated, so read every draft before you approve it.",
        to: "/tools/generate", cta: "Tailor a résumé", limit: "2 resumes a month (sign in required)" },
      { name: "A+ résumé", tier: "Pro", does: "A deeper rewrite driven by the posting, for the roles you care most about.",
        wont: "The same guard and the same rule: you read it before anything is sent.", where: "Inside a job's card, once you sign in" },
    ],
  },
  {
    verb: "apply",
    line: "The tedious part, done for you. The decision stays yours.",
    tools: [
      { name: "Your review queue", does: "Draft an application, see exactly what was filled in and which résumé was used, then approve it or don't.",
        wont: "A review run does not submit by itself: each filled application waits for you. Only a full-auto run, which you switch on, submits.",
        to: "/tools/apply", cta: "Try an application run", limit: "2 runs a month (sign in required)" },
      { name: "The browser extension", does: "Capture a job from any page, and fill the application form you signed in to reach.",
        wont: "It fills; you submit. It never presses the final button for you.", where: "Chrome, from the extension store" },
    ],
  },
];

export function FeaturesPage() {
  const monetisationEnabled = useMonetisationEnabled();
  return (
    <div className="scroll-dock-page" style={{ minHeight: "100vh", display: "flex", flexDirection: "column",
                  background: "transparent", color: C.INK, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <ScrollDock variant="marketing" />
      <main style={{ flex: 1, width: "100%", maxWidth: 920, margin: "0 auto", padding: "64px 16px 80px", boxSizing: "border-box" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: "clamp(40px, 6vw, 68px)", lineHeight: 1,
                     letterSpacing: "-0.01em", margin: "0 0 16px" }}>
          What each tool is for
        </h1>
        <p style={{ fontSize: 17, color: C.INK_MUTED, lineHeight: 1.55, margin: "0 0 56px", maxWidth: 620 }}>
          Everything here is one line — <strong style={{ color: C.INK }}>find</strong>, <strong style={{ color: C.INK }}>fit</strong>,{" "}
          <strong style={{ color: C.INK }}>apply</strong> — and every tool is a stop on it. Each is described by what it
          does for you, and by the one thing it will not do.
        </p>

        {TOOLS.map(station => (
          <section key={station.verb} aria-labelledby={`station-${station.verb}`} style={{ marginBottom: 56 }}>
            <h2 id={`station-${station.verb}`} style={{ fontFamily: "var(--font-display)", fontWeight: 400, fontSize: "clamp(34px, 4.4vw, 50px)",
                                                        lineHeight: 1, margin: "0 0 8px" }}>
              <span style={{ color: C.ACCENT_INK }}>/</span>{station.verb}
            </h2>
            <p style={{ fontSize: 16, color: C.INK_MUTED, margin: "0 0 20px", lineHeight: 1.5 }}>{station.line}</p>
            <div style={{ display: "grid", gap: 14 }}>
              {station.tools.map(t => (
                <article key={t.name} data-tool={t.name} style={{ ...glass({ radius: 18 }), padding: "20px 22px" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{t.name}</h3>
                    {monetisationEnabled && t.tier && (
                      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase",
                                     color: C.ACCENT_INK, background: C.ACCENT_QUIET, padding: "2px 8px", borderRadius: 6 }}>{t.tier}</span>
                    )}
                  </div>
                  <p style={{ fontSize: 15, lineHeight: 1.6, margin: "0 0 8px" }}>{t.does}</p>
                  <p style={{ fontSize: 14, lineHeight: 1.6, margin: 0, color: C.INK_MUTED }}>
                    <strong style={{ color: C.INK }}>It won't: </strong>{t.wont}
                  </p>
                  <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginTop: 12, fontSize: 13.5 }}>
                    {t.to
                      ? <Link to={t.to} style={{ fontWeight: 800, color: C.ACCENT_INK }}>{t.cta} →</Link>
                      : <span style={{ color: C.INK_FAINT }}>{t.where}</span>}
                    {t.limit && <span style={{ color: C.INK_FAINT }}>{t.limit}</span>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}

        <div style={{ textAlign: "center", marginTop: 24 }}>
          <Link className="dbx-depth" to="/register" style={{ display: "inline-block", background: C.ACCENT, color: C.ON_ACCENT, border: `1px solid ${C.ACCENT_INK}`,
                                        padding: "13px 26px", fontWeight: 800, fontSize: 15, textDecoration: "none",
                                        boxShadow: C.SHADOW_GLASS }}>
            Get today's draft
          </Link>
        </div>
      </main>
      <Footer/>
    </div>
  );
}
