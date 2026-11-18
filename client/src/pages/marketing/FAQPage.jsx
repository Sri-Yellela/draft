// client/src/pages/marketing/FAQPage.jsx
import { useState } from "react";
import ScrollDock from "../../components/ScrollDock.jsx";
import { Footer } from "../../components/Footer.jsx";
import { BRAND } from "../../../../shared/brand.js";
import { ts } from "../../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size

const FAQS = [
  { q: "Is my resume data private?", a: "Yes. Your resume and job data stay on your account and are never used to train AI models." },
  { q: "Does the extension scrape my LinkedIn profile?", a: "No. It never reads your LinkedIn profile, and on LinkedIn, Indeed and Glassdoor it only acts when you press it. Elsewhere it reads a job page's visible text when you save the job or fill its form — and, if you agree once, it can read and prepare application forms on the job sites it knows. Saving and filling on their own stay off unless you switch them on, site by site." },
  { q: `Does ${BRAND} auto-apply to jobs on my behalf?`, a: `Only if you choose. In Ask me first — the default — ${BRAND} fills the employer's own application from your profile and waits: nothing is sent until you approve it. In Apply for me, which you switch on, ${BRAND} sends applications that match your filters, times and daily limit without asking each time; you can pause everything at any moment. Or open the job from the company name and apply yourself.` },
  { q: "Where do job listings come from?", a: "From employers themselves: the applicant-tracking systems they post jobs on (Greenhouse, Lever, Ashby, Workday, SmartRecruiters and others), their public careers pages, which draft reads directly, and Google Jobs and Adzuna. Every job links to the employer's own application." },
  { q: `What LinkedIn data does ${BRAND} access?`, a: "Only your name and email address, and only when you explicitly click 'Import from LinkedIn' and approve the consent screen. We do not access your connections, work history, or any other LinkedIn data." },
  { q: "Does this work for non-tech roles?", a: `Yes, for professional roles: software and data, engineering, management, business and finance, science, legal, design and media, sales and marketing. Healthcare, education and office roles are not on the board yet.` },
  { q: "How does draft judge fit?", a: "It compares your résumé's wording with the job's — skills, keywords and language — and shows how close they are as a band, never a made-up score. It runs on draft's own rules, not an AI model." },
  { q: "Can I use my own resume?", a: "Yes. You upload your résumé once; when you Draft a job, draft tailors a copy of it for that job, and you read it before anything is sent." },
];

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border: "1px solid var(--color-border)", borderRadius: 12, overflow: "hidden", marginBottom: 8 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: "100%", padding: "16px 20px", background: "var(--color-surface)",
                  border: "none", cursor: "pointer", display: "flex",
                  justifyContent: "space-between", alignItems: "center",
                  color: "var(--color-text)", fontWeight: 700, fontSize: ts(14), textAlign: "left",
                  fontFamily: "'DM Sans', system-ui" }}>
        {q}
        <span style={{ fontSize: ts(18), color: "var(--color-primary-text)", transform: open ? "rotate(45deg)" : "none",
                         transition: "transform 0.2s", flexShrink: 0, marginLeft: 12 }}>+</span>
      </button>
      {open && (
        <div style={{ padding: "0 20px 18px", fontSize: ts(14), color: "var(--color-text-muted)",
                       lineHeight: 1.7, background: "var(--color-surface)" }}>
          {a}
        </div>
      )}
    </div>
  );
}

export function FAQPage() {
  return (
    <div className="scroll-dock-page" style={{ minHeight: "100vh", display: "flex", flexDirection: "column",
                  background: "transparent", color: "var(--color-text)",
                  fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <ScrollDock variant="marketing" />
      <main style={{ flex: 1, maxWidth: 720, margin: "0 auto", padding: "64px 24px" }}>
        <h1 style={{ fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 400,
                      color: "var(--color-text)", marginBottom: 48, lineHeight: 1.1,
                      fontFamily: "var(--font-display)" }}>
          Frequently asked questions
        </h1>
        {FAQS.map((f, i) => <FAQItem key={i} q={f.q} a={f.a}/>) }
      </main>
      <Footer/>
    </div>
  );
}
