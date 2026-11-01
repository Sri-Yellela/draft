// ⭐ D123 P2 · draft's half of THE LEAN TAILORING CALL (the tools service's src/generation/tailor.js, contract 1.7.0).
//
// What draft decides, deterministically, before the model sees anything:
//   1. WHICH TEXT — the posting's FULL text (description_full, D84 F3) when the crawl kept one. The audit (11-01) found
//      1,246 of 3,850 active postings in production cut at 5,000 characters while a longer text sat unread; the
//      requirements section is usually what the cut removed.
//   2. THE KEYWORDS — buildJobKeywords over draft's own scorer report on the BASE résumé (no model, D70 Phase 1).
//   3. THE PLACEMENTS (owner 11-01: "truly pushing ats … use our kb to maximise the ats within the scope of the user's
//      experience companies") — a posting term the résumé misses and nobody claimed is still placeable when the KB's
//      company_technographics shows it in the stack of one of the candidate's OWN employers, on at least
//      PLACEMENT_MIN_POSTINGS postings. The tools service lets the model name it only in a bullet of that employer, as
//      part of work the bullet already describes. This amends D70 Phase 1's "missing-and-unclaimed terms are never
//      sent": they are sent exactly when the candidate's employer evidently uses them, and only for that employer.
//
// Pure apart from the KB read; no network, no model.
import { canonicalSkillKey } from "./kb/technographics.js";
import { buildStructuredResume } from "./resumeFormatter.js";
import { buildJobKeywords } from "./jobKeywordContext.js";
import { postingText } from "./jobs/descriptionText.js";

export const TAILORINGS = Object.freeze(["full", "lean"]);
export const PLACEMENT_MIN_POSTINGS = 3;
export const PLACEMENTS_MAX = 30;

/**
 * The ledger name of the lean call. ~14 readers key on purpose = 'resume_generate' — the plan's allowance
 * (limitEnforcer), retry detection, the admin's lift panel — and a lean tailoring IS that résumé generation, so it is
 * recorded under that name (its `model` column says Haiku). The repair keeps its own purpose, so one résumé never
 * counts twice against an allowance.
 */
export const LEAN_LEDGER_RENAME = Object.freeze({ resume_tailor: "resume_generate" });

/**
 * "lean" or "full" for one generation. DRAFT_TAILORING=lean turns it on for everyone; a trial account (D124) is lean
 * by default. Anything else is "full" — the request as it was before D123.
 */
export function tailoringFor({ env = process.env, isTrial = false } = {}) {
  const set = String(env.DRAFT_TAILORING || "").trim().toLowerCase();
  if (set === "lean" || set === "full") return set;
  return isTrial ? "lean" : "full";
}

/** The posting as the lean path reads it: the full text when there is one, else the normalised / stored text. */
export function fullPostingText(job) {
  const full = typeof job?.description_full === "string" ? job.description_full.trim() : "";
  return full || postingText(job) || job?.description || "";
}

const lower = (s) => String(s ?? "").toLowerCase();

/** The header line of every entry in the résumé's EXPERIENCE sections — where an employer's name is. */
export function experienceHeaders(resumeText) {
  const s = buildStructuredResume(resumeText);
  return (s.sections || [])
    .filter(x => x.type === "entries" && /EXPERIENCE/i.test(x.title || ""))
    .flatMap(x => x.entries || [])
    .map(e => [e.company, e.role, e.meta].filter(Boolean).join(" | "));
}

/**
 * The KB companies the candidate worked at: a technographics company whose name appears in an EXPERIENCE entry's
 * header (not anywhere in the text — "Notion" in a skills line is a tool, not an employer).
 */
export function candidateEmployers(db, resumeText) {
  const headers = experienceHeaders(resumeText).map(lower);
  if (!headers.length) return [];
  let companies = [];
  try { companies = db.prepare("SELECT DISTINCT company FROM company_technographics").all().map(r => r.company).filter(Boolean); }
  catch { return []; }
  return companies.filter(c => {
    const name = lower(c).trim();
    if (name.length < 3) return false;
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|[^a-z0-9])${esc}($|[^a-z0-9])`);
    return headers.some(h => re.test(h));
  });
}

/**
 * @returns [{ term, employer }] — each a posting term from `missing` (spelled as the posting spells it) that one of the
 * candidate's employers evidently uses. Terms the candidate claimed are not placements (they travel as `claimed`).
 */
export function kbPlacements(db, { resumeText, missing = [], claimed = [], synonyms = null, minPostings = PLACEMENT_MIN_POSTINGS } = {}) {
  const employers = candidateEmployers(db, resumeText);
  if (!employers.length || !missing.length) return [];
  const claimedKeys = new Set(claimed.map(t => canonicalSkillKey(t, synonyms)).filter(Boolean));
  const out = [], seen = new Set();
  const stack = db.prepare("SELECT skill, posting_count FROM company_technographics WHERE company = ?");
  for (const employer of employers) {
    const have = new Map();
    for (const r of stack.all(employer)) {
      const k = canonicalSkillKey(r.skill, synonyms);
      if (k) have.set(k, (have.get(k) || 0) + (r.posting_count || 0));
    }
    for (const term of missing) {
      const k = canonicalSkillKey(term, synonyms);
      if (!k || claimedKeys.has(k) || seen.has(k)) continue;
      if ((have.get(k) || 0) >= minPostings) {
        seen.add(k);
        out.push({ term: String(term).slice(0, 80), employer: String(employer).slice(0, 120) });
        if (out.length >= PLACEMENTS_MAX) return out;
      }
    }
  }
  return out;
}

/**
 * job.keywords for a lean request: the D70 keywords from the scorer's report on the BASE résumé (scored against the full
 * posting text), plus the KB placements.
 */
export function leanJobKeywords(db, { job, report, claims = null, resumeText, synonyms = null }) {
  const keywords = buildJobKeywords({ job, report, claims: claims || {}, postingText: fullPostingText(job) });
  const placements = kbPlacements(db, { resumeText, missing: report?.tier1_missing || [], claimed: report?.claimed_matches || [], synonyms });
  return placements.length ? { ...keywords, placements } : keywords;
}
