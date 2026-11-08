// shared/metricDefinitions.js — ⭐ D173 (4) (45n) · ONE DEFINITION PER NUMBER (FinanceOS mistakes 3–4; extends D153 (2)).
//
// Every number a person or the owner reads — the match %, the ATS score and band, best bets, the ghost score, readiness,
// the proof level, the small-number share — is DEFINED ONCE: here is its plain definition (the Glossary's words) and the
// ONE module + function that computes it. Every surface reads that function; none recomputes it.
// test/d173OneDefinitionPerMetric.test.js holds this list to the code: each function exists where it says, and no other
// file defines a function by the same name (a second implementation is the defect D153 (2) found — counts that included
// the unknowns on one surface and not another).
export const METRICS = Object.freeze([
  { id: "ats_score", name: "ATS match score", module: "packages/ats-scorer/src/scorer.js", fn: "scoreAtsLocally",
    plain: "How much of what a posting asks for your résumé shows, 0–100, from draft's own scorer — the same number everywhere. (services/localAtsScorer.js only re-exports it with the same three inputs.)" },
  { id: "ats_band", name: "ATS band", module: "shared/atsBands.js", fn: "atsBandFor",
    plain: "Strong (44 and up), Moderate (26 to 43), Weak (under 26) or Not enough signal (the scorer declined) — never a low score for a missing one." },
  { id: "best_bets", name: "Best bets", module: "services/bestBets.js", fn: "bestBetsFor",
    plain: "The few postings where your résumé already fits and the employer is actively hiring — the precision shortlist." },
  { id: "ghost", name: "Likely not hiring", module: "services/jobs/ghostScore.js", fn: "ghostFor",
    plain: "Signs a posting is not being filled (reposted many times, open far past its kind) — shown as a level, never as a verdict on a company." },
  { id: "readiness", name: "Ready for a role", module: "services/atlas/roleReadiness.js", fn: "roleReadiness",
    plain: "The share of a role's demand (weighted by how often each skill appears in its live postings) that you have PROVEN — claims shown apart." },
  { id: "proof_level", name: "Your level", module: "services/learn/practiceProgress.js", fn: "proofLevel",
    plain: "From the skills you have proven (a check passed or something built) — answering more questions never raises it." },
  { id: "share_small_n", name: "A share", module: "services/testersReport.js", fn: "shareText",
    plain: "\"k of n\" until there are 20, then a percentage — a percentage of a handful says more than it knows." },
  { id: "deck_size", name: "Cards a day", module: "services/dailyDraft.js", fn: "deckSizeOf",
    plain: "How many postings today's deck deals — your choice (5, 10, 15 or 20), 10 by default." },
]);
