// services/jobs/categoryFunction.js — ⛔⛔ D153 (3) · THE KIND OF WORK FOR A POSTING THE ROLE CLASSIFIER CALLED 'general'.
//
// MEASURED (l44z, 11-05, the 18k copy, read-only): the board's "kind of work" (scraped_jobs.tag_function, the sentence's
// domain clause) came ONLY from the role classifier's bucket (job_role_map.role_key → shared ROLE_TO_FUNCTION), and its
// "matched nothing" bucket 'general' maps to nothing. Every posting the classifier could not bucket therefore had no kind
// of work on file — even when D127's own classifier (professionalScope.categoryOf, a TITLE rule with confidence) had
// already placed it in a category: on the copy 3,259 of the 3,961 untagged active postings were shown in a D127
// category (computing 1,907 · business 820 · engineering 182 · arts / media 130 · management 113 …). Two classifiers,
// and the board's filter read only the narrower one.
//
// THE RULE (pure): a kind of work is derived from D127's verdict ONLY when it is in scope — a held posting (non-
// professional, a held group, low confidence, no title signal) gets NOTHING (D127 P2, the red-flag rule: unknown stays
// unknown, never a guess). Inside a category the function comes from the category (sales, marketing, legal,
// engineering) or, where a category spans functions, from a TITLE word (computing → data | engineering; management →
// product | finance | people | operations; business → finance | people | operations; arts / media → design |
// marketing). A category with no function in the vocabulary (science) and a management / business title with no
// subject word stay NULL — counted as unknown, not filed somewhere plausible.
import { categoryOf } from "./professionalScope.js";

// Data is named by its own words — not by a bare "AI" or "analyst", which on this board are platform engineering
// ("Engineering Manager, AI Platform") and business analysis ("GRC Analyst", "Deal Desk Analyst").
const DATA_WORDS = /\b(?:data|analytics?|machine\s+learning|ML|deep\s+learning|NLP|computer\s+vision|scientist|statistic\w*|actuar\w*|quant\w*|mathematician|business\s+intelligence|BI|insights?)\b/i;
const PRODUCT_WORDS = /\b(?:product|program|programme|project|TPM|scrum\s+master|delivery\s+(?:manager|lead))\b/i;
const FINANCE_WORDS = /\b(?:financ\w*|accountant|accounting|accounts?\s+(?:payable|receivable)|audit\w*|tax|treasury|FP&A|controller|comptroller|bookkeep\w*|credit|loan|lending|underwrit\w*|investment|investor\s+relations|portfolio|wealth|banking|banker|actuar\w*|billing|revenue\s+(?:accounting|operations)|valuation|equity|capital\s+markets|risk|fund|insurance|claims)\b/i;
const PEOPLE_WORDS = /\b(?:recruit\w*|talent|HR|HRBP|HRIS|human\s+resources|people|employee\s+(?:relations|experience)|payroll|compensation|benefits|total\s+rewards|learning\s+(?:and|&)\s+development|L&D|workforce|onboarding|DEI|diversity)\b/i;
const OPERATIONS_WORDS = /\b(?:operations?|ops|logistics|supply\s+chain|procurement|purchasing|buyer|sourcing|sourcer|vendor|planner|planning|inventory|fulfil?ment|facilities|business\s+analyst|process|program\s+coordinator|strategy|strategist|business\s+operations|chief\s+of\s+staff|general\s+manager|compliance|governance|implementation|onboarding\s+specialist|customer\s+(?:operations|support\s+operations)|revenue\s+operations|RevOps|enablement)\b/i;
const DESIGN_WORDS = /\b(?:design\w*|UX|UI|user\s+experience|user\s+research\w*|illustrator|animator|art\s+director|creative\s+director|visual|graphic|motion|3D\s+artist|artist)\b/i;
const MEDIA_WORDS = /\b(?:writer|editor|copywriter|content|communications?|public\s+relations|PR|journalist|producer|videographer|video|photographer|social\s+media|brand|media|storyteller|editorial)\b/i;

/** The functions a category maps to without reading the title. */
const DIRECT = Object.freeze({ engineering: "engineering", sales: "sales", marketing: "marketing", legal: "legal" });

/**
 * A job function (shared JOB_FUNCTIONS value) from D127's in-scope verdict and the title, or null.
 * @param {{ inScope: boolean, category: string|null, soc?: string|null }} verdict  professionalScope.categoryOf's verdict
 * @param {string} title
 */
export function functionForCategory(verdict, title) {
  if (!verdict || !verdict.inScope || !verdict.category) return null;     // ⛔ D127: held / unknown → no kind of work
  const t = String(title || "");
  const c = verdict.category;
  if (DIRECT[c]) return DIRECT[c];
  if (c === "computing") return DATA_WORDS.test(t) ? "data" : "engineering";
  if (c === "management") {
    if (verdict.soc === "11-2021" || PRODUCT_WORDS.test(t)) return "product";
    if (/\bengineering\b/i.test(t)) return "engineering";
    if (FINANCE_WORDS.test(t)) return "finance";
    if (PEOPLE_WORDS.test(t)) return "people";
    if (DESIGN_WORDS.test(t)) return "design";
    if (OPERATIONS_WORDS.test(t)) return "operations";
    return null;
  }
  if (c === "business") {
    if (PEOPLE_WORDS.test(t)) return "people";
    if (FINANCE_WORDS.test(t)) return "finance";
    if (OPERATIONS_WORDS.test(t)) return "operations";
    if (DATA_WORDS.test(t)) return "data";
    return null;
  }
  if (c === "arts_media") {
    if (DESIGN_WORDS.test(t)) return "design";
    if (MEDIA_WORDS.test(t)) return "marketing";
    return null;
  }
  return null;   // science (no function in the vocabulary yet) and anything new: unknown, not guessed
}

/** The fallback the tagger uses for a posting whose role bucket names no function: D127's verdict on its title. */
export function functionFromTitle(title, roleKey = null) {
  if (!title) return null;
  return functionForCategory(categoryOf({ title, roleKey }), title);
}
