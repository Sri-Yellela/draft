// client/src/pages/marketing/AboutPage.jsx — ⭐ 46v 0d (owner 11-18: "yes do the other pages too"): the landing's
// treatment — the frame (components/MarketingFrame.jsx), each section a note card (A233). The words are 46v's corrected
// ones (b13809ef): what draft does, fit on its own rules, and the honest caveat about tailoring.
import { MarketingFrame, MkLink } from "../../components/MarketingFrame.jsx";
import { NoteCard } from "../../components/TextBlocks.jsx";
import { BRAND } from "../../../../shared/brand.js";

const SECTIONS = [
  {
    id: "about-problem", title: "The Problem",
    body: `Applying for jobs is broken. You spend hours tailoring resumes, only to have them filtered out by an ATS before a human ever sees them. ${BRAND} fixes that.`,
  },
  {
    id: "about-built", title: "What We Built",
    body: `${BRAND} finds the jobs that fit you, tailors your résumé to each one and fills in the employer's own application — then waits for you, unless you have told it to apply for you. Fit and the ATS check run on ${BRAND}'s own rules, not an AI model. You spend your time preparing for interviews, not filling in forms.`,
  },
  {
    id: "about-approach", title: "Our Approach",
    body: "Résumés should be honest and strategic. Every résumé we tailor starts from your real experience and puts it in the language the hiring system reads. It will not inflate your years or your seniority, but it can add detail you never stated — so you read every one before anything is sent.",
  },
];

export function AboutPage() {
  return (
    <MarketingFrame eyebrow="About" title="Built for job seekers who are serious about landing"
      actions={<><MkLink primary to="/register">Sign up free</MkLink><MkLink to="/features">What each tool is for</MkLink></>}>
      <div className="mk-stack" data-about-sections="">
        {SECTIONS.map((s) => <NoteCard key={s.id} id={s.id} title={s.title}>{s.body}</NoteCard>)}
      </div>
    </MarketingFrame>
  );
}
