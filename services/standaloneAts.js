// ── The public ATS tool's answer: one résumé × one pasted posting, as a BAND ──────────────────
//
// Same scorer as the board (owner, 09-30): the v4 deterministic scorer, with the term weights and
// confirmed synonyms the ATS panel uses, passed in by the caller so this module stays free of the
// database. It replaced a Haiku call whose own 0–100 sat on a different scale from the product's.
//
// ⛔ NO SCORE IN THE RESULT. ρ = 0.746 supports coarse ordering, not a printed figure (G5), and the
// mobile contract marks the number INTERNAL. A decline is `band: "not_enough_signal"` with its
// reasons — never a low score.
import { scoreAtsLocally } from "./localAtsScorer.js";
import { atsBandFor } from "../shared/atsBands.js";

/**
 * A pasted JD has no title field, but the scorer reads one (the seniority guard, and the role
 * family that picks the term weights). The caller's title wins; otherwise the posting's first
 * non-empty line stands in — for a pasted ad that is usually the title.
 */
export function standaloneJob(jdText, jobTitle) {
  const text = String(jdText || "");
  const title = String(jobTitle || "").trim() ||
    (text.split(/\r?\n/).map(l => l.trim()).find(Boolean) || "").slice(0, 120);
  return { title, description: text };
}

export function standaloneAtsResult({ resumeText, jdText, jobTitle, termWeightsFor = () => null, synonyms = null }) {
  const job = standaloneJob(jdText, jobTitle);
  const report = scoreAtsLocally({ job, resumeText, termWeights: termWeightsFor(job), synonyms });
  return {
    source: report.source,
    band: atsBandFor(report),
    decline_reasons: report.decline_reasons || [],
    matched_skills: report.tier1_matched || [],
    missing_skills: report.tier1_missing || [],
    matched_verbs: report.action_verbs_matched || [],
    missing_verbs: report.action_verbs_missing || [],
    // A52: the rest of the report's term buckets, so the public tool draws the SAME report the board
    // does (client/src/components/AtsReport.jsx) instead of a thinner copy of it. Terms only — still
    // no number. Additive: every field above is unchanged.
    competencies_matched: report.competencies_matched || [],
    competencies_missing: report.competencies_missing || [],
    generic_verbs: report.action_verbs_generic || [],
    experience: report.experience?.summary || null,
    seniority: report.seniority_cap?.applied ? report.seniority_cap.reason : null,
    // Only a SHORT résumé. The warning's other arm, "few_skills", counts the candidate's PROFILE
    // skills — and an anonymous visitor has no profile, so it would fire for every one of them.
    resume_depth: report.resume_depth?.reason === "short_resume" ? report.resume_depth : null,
  };
}
