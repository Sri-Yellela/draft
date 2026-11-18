// client/src/pages/marketing/HowItWorksPage.jsx
import ScrollDock from "../../components/ScrollDock.jsx";
import { Footer } from "../../components/Footer.jsx";
import { useMonetisationEnabled } from "../../lib/monetisation.jsx";
import { ts } from "../../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size

// Step 3 is the only tiered step; the other four describe the product identically either way.
// Both wordings are kept so turning the lever on restores the tier copy exactly, rather than
// obliging someone to reconstruct it.
const STEPS = (monetisationEnabled) => [
  // ⭐ A233: the steps as draft works today (step 2 named a console that is gone; step 4 promised a "match score").
  { n: 1, title: "Upload your résumé",
    body: "draft reads your experience and skills, and reads every job on the board against them." },
  { n: 2, title: "Get your best jobs each day",
    body: "Each morning draft picks the jobs that fit you best. Draft the ones you want and pass the rest." },
  { n: 3, title: monetisationEnabled ? "Use unlocked tools" : "Use the tools",
    body: monetisationEnabled
      ? "Plus tailors your résumé when you Draft a job. Pro uses the A+ résumé, a deeper rewrite from the job description."
      : "When you Draft a job, draft tailors your résumé for it." },
  { n: 4, title: "See how well you fit",
    body: "See which of the job's words your résumé already covers, and which it is missing." },
  { n: 5, title: "Apply",
    body: "draft fills the employer's form and waits for you — nothing is sent until you approve it. Or switch on Apply for me and draft sends within the limits you set." },
];

export function HowItWorksPage() {
  const monetisationEnabled = useMonetisationEnabled();
  const steps = STEPS(monetisationEnabled);
  return (
    <div className="scroll-dock-page" style={{ minHeight: "100vh", display: "flex", flexDirection: "column",
                  background: "transparent", color: "var(--color-text)",
                  fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <ScrollDock variant="marketing" />
      <main style={{ flex: 1, maxWidth: 800, margin: "0 auto", padding: "64px 24px" }}>
        <h1 style={{ fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 400,
                      color: "var(--color-text)", marginBottom: 16, lineHeight: 1.1,
                      fontFamily: "var(--font-display)" }}>
          From job listing to submitted application in minutes
        </h1>
        <p style={{ fontSize: ts(16), color: "var(--color-text-muted)", lineHeight: 1.6, marginBottom: 56, maxWidth: 560 }}>
          {monetisationEnabled
            ? "Your best jobs each day and applications that wait for you. Upgrades add tools when you need them."
            : "Your best jobs each day, applications that wait for you, and every tool available."}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 24, paddingBottom: 40, position: "relative" }}>
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div style={{ position: "absolute", left: 23, top: 52, width: 2, bottom: 0,
                               background: "var(--color-border)" }}/>
              )}
              {/* Step number */}
              <div style={{ width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
                             background: "var(--color-primary-muted)", border: "2px solid var(--color-primary)",
                             display: "flex", alignItems: "center", justifyContent: "center",
                             fontSize: ts(18), fontWeight: 900, color: "var(--color-primary-text)", zIndex: 1 }}>
                {s.n}
              </div>
              <div style={{ paddingTop: 8 }}>
                <h2 style={{ fontSize: ts(18), fontWeight: 800, color: "var(--color-text)", marginBottom: 8 }}>
                  {s.title}
                </h2>
                <p style={{ fontSize: ts(14), color: "var(--color-text-muted)", lineHeight: 1.7, margin: 0, maxWidth: 520 }}>
                  {s.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </main>
      <Footer/>
    </div>
  );
}
