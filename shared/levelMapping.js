// shared/levelMapping.js — ⛔ D84 F2 · ONE mapping from a role to its experience level, read by the crawler's fallback
// (services/jobs/schema.js) AND the enrichment prompt (shared/enrichmentChunks.js), so the two cannot disagree.
//
// The owner's rehearsal (10-09) found 8 of 20 levels differing from the posting's text — Staff and Principal stored
// as `senior` by the crawler's title heuristic. The owner's mapping:
//   intern · entry (new grad, junior, associate, I, 0–2 yrs) · mid (II, 3–5 yrs) · senior (Senior, 6+)
//   · lead (Staff, Principal, Lead, Manager, Director) · executive (VP, C-level)
// The title rules below are that mapping as patterns; the years are for a reader of the TEXT (the model), since a
// title rarely states them. ⛔ Pure: imported by the server and the browser.

/** The mapping in words — the prompt quotes these lines verbatim. */
export const LEVEL_RULES = [
  "intern — internship, co-op",
  "entry — new grad, junior, associate, level I, or 0–2 years asked",
  "mid — level II, or 3–5 years asked",
  "senior — Senior, or 6+ years asked",
  "lead — Staff, Principal, Lead, Manager, Director, Head of",
  "executive — VP, Vice President, C-level (CEO, CTO, CFO, COO, CPO)",
];

/**
 * A level from the TITLE alone, or null when the title says nothing about level. ⛔ Order matters: the most senior
 * signal wins ("Senior Staff" is lead; "Associate Director" is lead; "VP" beats "Manager").
 */
export function levelFromTitle(title) {
  if (!title) return null;
  const t = String(title).toLowerCase();
  if (/\b(intern(?:ship)?|co.?op)\b/.test(t)) return "intern";
  if (/\b(c-suite|chief\s+\w+\s+officer|ceo|cto|cfo|coo|cpo|vice\s+president|vp|svp|evp)\b/.test(t)) return "executive";
  if (/\b(staff|principal|lead|manager|director|head\s+of|distinguished|fellow)\b/.test(t)) return "lead";
  if (/\b(senior|sr\.?)\b/.test(t) || /\b(iii|iv)\s*$/.test(t)) return "senior";
  if (/\b(junior|jr\.?|entry.?level|new.?grad(uate)?|graduate|associate)\b/.test(t) || /\b(i|1)\s*$/.test(t)) return "entry";
  if (/\b(ii|2)\s*$/.test(t)) return "mid";
  return null;
}
