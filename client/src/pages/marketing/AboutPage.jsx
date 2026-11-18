// client/src/pages/marketing/AboutPage.jsx
import ScrollDock from "../../components/ScrollDock.jsx";
import { Footer } from "../../components/Footer.jsx";
import { BRAND } from "../../../../shared/brand.js";
import { ts } from "../../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size

const SECTIONS = [
  {
    title: "The Problem",
    body: `Applying for jobs is broken. You spend hours tailoring resumes, only to have them filtered out by an ATS before a human ever sees them. ${BRAND} fixes that.`,
  },
  {
    title: "What We Built",
    body: `${BRAND} finds the jobs that fit you, tailors your résumé to each one and fills in the employer's own application — then waits for you, unless you have told it to apply for you. Fit and the ATS check run on ${BRAND}'s own rules, not an AI model. You spend your time preparing for interviews, not filling in forms.`,
  },
  {
    title: "Our Approach",
    body: "Résumés should be honest and strategic. Every résumé we tailor starts from your real experience and puts it in the language the hiring system reads. It will not inflate your years or your seniority, but it can add detail you never stated — so you read every one before anything is sent.",
  },
];

export function AboutPage() {
  return (
    <div className="scroll-dock-page" style={{ minHeight: "100vh", display: "flex", flexDirection: "column",
                  background: "transparent", color: "var(--color-text)",
                  fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <ScrollDock variant="marketing" />
      <main style={{ flex: 1, maxWidth: 720, margin: "0 auto", padding: "64px 24px" }}>
        <h1 style={{ fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 400,
                      color: "var(--color-text)", marginBottom: 16, lineHeight: 1.1,
                      fontFamily: "var(--font-display)" }}>
          Built for job seekers who are serious about landing
        </h1>
        <div style={{ display: "flex", flexDirection: "column", gap: 40, marginTop: 48 }}>
          {SECTIONS.map((s, i) => (
            <div key={i}>
              <h2 style={{ fontSize: ts(20), fontWeight: 800, color: "var(--color-primary-text)",
                            marginBottom: 12, letterSpacing: "-0.3px" }}>
                {s.title}
              </h2>
              <p style={{ fontSize: ts(15), color: "var(--color-text-muted)", lineHeight: 1.8, margin: 0 }}>
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </main>
      <Footer/>
    </div>
  );
}
