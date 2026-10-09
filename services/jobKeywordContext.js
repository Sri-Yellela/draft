// services/jobKeywordContext.js — ⭐ D70 Phase 1, draft's half: the KEYWORDS a generation sends instead of the
// posting's text (the tools service's options.jobContext "keywords", contract 1.5.0).
//
// Spec (D70): "What is sent, from draft's own scorer (scoreAtsLocally, zero model calls): the terms the
// résumé EVIDENCES (matched), the terms the candidate CLAIMED, matched and claimed VERBS, the COMPETENCIES,
// and a few SHORT RESPONSIBILITY PHRASES extracted deterministically so the model still knows what the job
// is, plus title, company, seniority and stack. ⛔ What is NEVER sent: missing-and-unclaimed terms (the model
// could only invent them) and generic language. The posting's text is not sent at all."
//
// Pure: no database, no network, no model. The input is the scorer's report on the candidate's BASE résumé
// for this job (packages/ats-scorer: tier1_matched includes terms matched only through a claim; those are
// also in claimed_matches — so evidenced = matched − claimed), the profile's claims, and the posting text.
//
// ⛔ NOT WIRED YET: the tools service in production is contract 1.4.0, which would refuse job.keywords. The
// wiring (services/toolsServiceRequests.js, behind a flag, default "description") lands after 1.5.0 is live.

export const KEYWORD_CAPS = Object.freeze({ matched: 40, claimed: 40, verbs: 24, competencies: 12, phrases: 8, phraseWords: 6, term: 80 });

const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const key = (s) => norm(s).toLowerCase();

/** Case-insensitive dedupe, first spelling wins, bounded, each item ≤ KEYWORD_CAPS.term characters. */
function uniq(list, max) {
  const out = [], seen = new Set();
  for (const raw of list || []) {
    const t = norm(raw);
    if (!t || t.length > KEYWORD_CAPS.term || seen.has(key(t))) continue;
    seen.add(key(t));
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

// A responsibility phrase is a short run of words ending in one of these heads — "payments platform",
// "data pipelines", "developer tooling" — or the literal "on-call". Deterministic, and never a sentence.
const HEADS = ["platform", "platforms", "infrastructure", "pipeline", "pipelines", "service", "services", "system", "systems",
  "api", "apis", "tooling", "product", "products", "marketplace", "backend", "frontend", "stack", "architecture",
  "models", "workflows", "integrations", "experiments", "dashboards", "sdk", "sdks", "clusters"];
const STOP = new Set(["a", "an", "the", "and", "or", "of", "for", "to", "in", "on", "with", "our", "your", "their", "its", "we", "you",
  "will", "be", "is", "are", "that", "this", "these", "those", "new", "across", "large", "scalable", "robust", "high", "own", "build",
  "building", "design", "designing", "develop", "developing", "maintain", "maintaining", "improve", "improving", "work", "working",
  "using", "use", "help", "lead", "drive", "core", "key", "critical", "modern", "complex", "reliable", "distributed", "internal", "external"]);
const BULLET = /^\s*(?:[-•*·▪◦–]|\d+[.)])\s+/;

/**
 * Short phrases from the posting's bullet lines (responsibilities and requirements). Up to two content words
 * before a head noun, lower-cased, deduped, at most KEYWORD_CAPS.phrases.
 */
export function responsibilityPhrases(text) {
  const out = [];
  const lines = String(text ?? "").split(/\r?\n/).filter(l => BULLET.test(l));
  for (const line of lines) {
    const words = line.replace(BULLET, "").toLowerCase().replace(/[^a-z0-9+#/\- ]+/g, " ").split(/\s+/).filter(Boolean);
    if (words.includes("on-call") || /\bon call\b/.test(words.join(" "))) out.push("on-call");
    words.forEach((w, i) => {
      if (!HEADS.includes(w)) return;
      const lead = [];
      for (let j = i - 1; j >= 0 && lead.length < 2; j--) {
        if (STOP.has(words[j]) || /^\d+$/.test(words[j])) break;
        lead.unshift(words[j]);
      }
      if (lead.length) out.push([...lead, w].join(" "));
    });
  }
  return uniq(out, KEYWORD_CAPS.phrases).filter(p => p.split(" ").length <= KEYWORD_CAPS.phraseWords);
}

/**
 * @param {{ job, report, claims?, postingText? }} p
 *   job    — the posting row (title, company, seniority / experience_level used for `seniority`)
 *   report — scoreAtsLocally's report on the BASE résumé for this job
 *   claims — { skills, actionVerbs } (listProfileClaims)
 *   postingText — the normalised posting text (withPostingText(job).description); defaults to job.description
 * @returns {{ matched: string[], claimed: string[], verbs: string[], competencies: string[], phrases: string[], seniority: string|null }}
 */
export function buildJobKeywords({ job = {}, report = {}, claims = {}, postingText } = {}) {
  const claimedSet = new Set((report?.claimed_matches || []).map(key));
  const matched = uniq((report?.tier1_matched || []).filter(t => !claimedSet.has(key(t))), KEYWORD_CAPS.matched);
  // Claimed AND asked for by the posting — the scorer's claimed_matches. A claim the posting does not ask
  // for is noise here; a missing term nobody claimed is never in this list by construction.
  const claimed = uniq(report?.claimed_matches || [], KEYWORD_CAPS.claimed);
  const askedVerbs = new Set([...(report?.action_verbs_matched || []), ...(report?.action_verbs_missing || [])].map(key));
  const verbs = uniq([...(report?.action_verbs_matched || []),
    ...(claims?.actionVerbs || []).filter(v => askedVerbs.has(key(v)))], KEYWORD_CAPS.verbs);
  const competencies = uniq(report?.competencies_matched || [], KEYWORD_CAPS.competencies);
  const phrases = responsibilityPhrases(postingText ?? job?.description ?? "");
  const seniority = norm(job?.seniority || job?.experience_level || job?.level || "") || null;
  return { matched, claimed, verbs, competencies, phrases, seniority: seniority && seniority.length <= 40 ? seniority : null };
}
