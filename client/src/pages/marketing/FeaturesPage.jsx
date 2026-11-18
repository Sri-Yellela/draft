// client/src/pages/marketing/FeaturesPage.jsx
//
// What each tool is for. ⭐ 46v 0d (owner 11-18: "yes do the other pages too"): the landing's treatment — the frame
// (components/MarketingFrame.jsx); every tool a book on one shelf (components/BookShelf.jsx), its head naming the station
// (/find · /fit · /apply); pressing a book brings its note card into view below, where each station lists its tools.
// (The landing's find → fit → apply line, components/FindFitApply.jsx, left with the old landing in 46v.)
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
import { MarketingFrame, MkSection, MkLink } from "../../components/MarketingFrame.jsx";
import { BookShelf, BookSpine } from "../../components/BookShelf.jsx";
import { NoteCard } from "../../components/TextBlocks.jsx";
import { useMonetisationEnabled } from "../../lib/monetisation.jsx";

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
        wont: "The same guard and the same rule: you read it before anything is sent.", where: "When you Draft a job, on Pro" },
    ],
  },
  {
    verb: "apply",
    line: "The tedious part, done for you. The decision stays yours.",
    tools: [
      { name: "Your review queue", does: "Draft an application, see exactly what was filled in and which résumé was used, then approve it or don't.",
        wont: "In Ask me first, each filled application waits for you. Only Apply for me, which you switch on, sends without asking — within your limits.",
        to: "/tools/apply", cta: "Try an application run", limit: "2 runs a month (sign in required)" },
      { name: "The browser extension", does: "Capture a job from any page, and fill the application form you signed in to reach.",
        wont: "It submits only when you press Submit application in its panel — never on its own.", where: "Chrome, from the extension store" },
    ],
  },
];

const toolId = (t) => `tool-${t.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
const bringIntoView = (id) => () => {
  const el = typeof document === "undefined" ? null : document.getElementById(id);
  if (!el) return;
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
  el.focus?.({ preventScroll: true });
};

export function FeaturesPage() {
  const monetisationEnabled = useMonetisationEnabled();
  const all = TOOLS.flatMap((station) => station.tools.map((t) => ({ ...t, verb: station.verb })));
  return (
    <MarketingFrame eyebrow="Features" title="What each tool is for"
      lede="Everything here is one line — find, fit, apply — and every tool is a stop on it. Each is described by what it does for you, and by the one thing it will not do."
      actions={<MkLink primary to="/register">Get today's draft</MkLink>}>
      <MkSection id="features-shelf" lede="Pick a book to read about it." data-features-shelf="">
        <BookShelf>
          {all.map((t, i) => (
            <BookSpine key={t.name} id={toolId(t)} last={i === all.length - 1} kind={`/${t.verb}`} title={t.name}
              foot={monetisationEnabled && t.tier ? t.tier : (t.to ? "try it" : "")} label={`${t.name}: ${t.does}`}
              onClick={bringIntoView(toolId(t))} data-features-book={t.name} />
          ))}
        </BookShelf>
      </MkSection>
      {TOOLS.map(station => (
        <MkSection key={station.verb} id={`station-${station.verb}`} title={`/${station.verb}`} lede={station.line} className="mk-sec--rule">
          <div className="mk-stack">
            {station.tools.map(t => (
              <div key={t.name} id={toolId(t)} tabIndex={-1} data-tool={t.name}>
                <NoteCard id={toolId(t)} title={<>{t.name}{monetisationEnabled && t.tier && (
                    <span className="mk-eyebrow" style={{ marginLeft: 10 }}>{t.tier}</span>
                  )}</>}
                  actions={t.to ? <MkLink to={t.to}>{t.cta}</MkLink> : null}>
                  <p style={{ margin: 0 }}>{t.does}</p>
                  <p style={{ margin: "6px 0 0" }}><strong>It won't: </strong>{t.wont}</p>
                  {(t.to ? t.limit : t.where) && <p style={{ margin: "6px 0 0", opacity: 0.8 }}>{t.to ? t.limit : t.where}</p>}
                </NoteCard>
              </div>
            ))}
          </div>
        </MkSection>
      ))}
    </MarketingFrame>
  );
}
