// client/src/pages/marketing/FAQPage.jsx — ⭐ 46v 0d (owner 11-18: "yes do the other pages too"): the landing's treatment —
// the frame (components/MarketingFrame.jsx), the answers grouped (your data · applying · jobs · the extension), each a
// fold (<details>: keyboard and screen readers for free). The answers are 46v's corrected ones (b13809ef).
import { MarketingFrame, MkSection, MkLink } from "../../components/MarketingFrame.jsx";
import { BRAND } from "../../../../shared/brand.js";

const FAQS = [
  { group: "data", q: "Is my resume data private?", a: "Yes. Your resume and job data stay on your account and are never used to train AI models." },
  { group: "extension", q: "Does the extension scrape my LinkedIn profile?", a: "No. It never reads your LinkedIn profile, and on LinkedIn, Indeed and Glassdoor it only acts when you press it. Elsewhere it reads a job page's visible text when you save the job or fill its form — and, if you agree once, it can read and prepare application forms on the job sites it knows. Saving and filling on their own stay off unless you switch them on, site by site." },
  { group: "apply", q: `Does ${BRAND} auto-apply to jobs on my behalf?`, a: `Only if you choose. In Ask me first — the default — ${BRAND} fills the employer's own application from your profile and waits: nothing is sent until you approve it. In Apply for me, which you switch on, ${BRAND} sends applications that match your filters, times and daily limit without asking each time; you can pause everything at any moment. Or open the job from the company name and apply yourself.` },
  { group: "jobs", q: "Where do job listings come from?", a: "From employers themselves: the applicant-tracking systems they post jobs on (Greenhouse, Lever, Ashby, Workday, SmartRecruiters and others), their public careers pages, which draft reads directly, and Google Jobs and Adzuna. Every job links to the employer's own application." },
  { group: "data", q: `What LinkedIn data does ${BRAND} access?`, a: "Only your name and email address, and only when you explicitly click 'Import from LinkedIn' and approve the consent screen. We do not access your connections, work history, or any other LinkedIn data." },
  { group: "jobs", q: "Does this work for non-tech roles?", a: `Yes, for professional roles: software and data, engineering, management, business and finance, science, legal, design and media, sales and marketing. Healthcare, education and office roles are not on the board yet.` },
  { group: "jobs", q: "How does draft judge fit?", a: "It compares your résumé's wording with the job's — skills, keywords and language — and shows how close they are as a band, never a made-up score. It runs on draft's own rules, not an AI model." },
  { group: "apply", q: "Can I use my own resume?", a: "Yes. You upload your résumé once; when you Draft a job, draft tailors a copy of it for that job, and you read it before anything is sent." },
];

export const FAQ_GROUPS = Object.freeze([
  { id: "data", title: "Your data" },
  { id: "apply", title: "Applying" },
  { id: "jobs", title: "The jobs" },
  { id: "extension", title: "The extension" },
]);

export function FAQPage() {
  return (
    <MarketingFrame eyebrow="FAQ" title="Frequently asked questions"
      actions={<MkLink to="/contact">Ask us something else</MkLink>}>
      {FAQ_GROUPS.map((g) => (
        <MkSection key={g.id} id={`faq-${g.id}`} title={g.title} data-faq-group={g.id}>
          <div className="mk-faq">
            {FAQS.filter((f) => f.group === g.id).map((f) => (
              <details key={f.q} data-faq={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>
            ))}
          </div>
        </MkSection>
      ))}
    </MarketingFrame>
  );
}
