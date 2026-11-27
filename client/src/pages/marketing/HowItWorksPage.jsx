// client/src/pages/marketing/HowItWorksPage.jsx — ⭐ 46v 0d (owner 11-18: "yes do the other pages too"): the landing's
// treatment — the frame (components/MarketingFrame.jsx); the steps are a real sequence, so they are numbered, each a note
// card in its own pastel (A233).
import { MarketingFrame, MkLink, MkSteps, MkNote } from "../../components/MarketingFrame.jsx";   // 47m: the notes and promises on the plate
import { useMonetisationEnabled } from "../../lib/monetisation.jsx";

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
    <MarketingFrame eyebrow="How it works" title="From job listing to submitted application in minutes"
      lede={monetisationEnabled
        ? "Your best jobs each day and applications that wait for you. Upgrades add tools when you need them."
        : "Your best jobs each day, applications that wait for you, and every tool available."}
      actions={<MkLink primary to="/register">Sign up free</MkLink>}>
      <MkSteps data-how-steps="" items={steps.map((s) => ({ key: s.n, body: <MkNote id={`how-step-${s.n}`} title={s.title}>{s.body}</MkNote> }))} />
    </MarketingFrame>
  );
}
