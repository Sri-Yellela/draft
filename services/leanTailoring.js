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
import { getSetting } from "./appSettings.js";
import { niceSection } from "./atsCalibration.js";

// D123 (contract 1.8.0): "payload" (P6a + P6g — the job block and the per-employer gists) and "code" (P6d — no model).
export const TAILORINGS = Object.freeze(["full", "lean", "payload", "code"]);
/** The admin's switch (Admin → Ops → Tailoring): an app_settings row that wins over DRAFT_TAILORING, no deploy needed. */
export const TAILORING_KEY = "tailoring_mode";
/**
 * ⛔ Owner 11-07: "keep the A+ … just dropping it from the default path … A+ sonnet would be an override option i can use
 * for testing and this override would be from the admin panel by me". OFF (absent) = an A+ request is served as a
 * Generate with the admin's strategy × model; ON = the full A+ route, as before 11-07. Admin → Ops → Tailoring.
 */
export const APLUS_OVERRIDE_KEY = "tailoring_aplus_override";
export function aPlusOverride(db) {
  try { return String(getSetting(db, APLUS_OVERRIDE_KEY) || "").trim().toLowerCase() === "on"; } catch { return false; }
}
/** The prompt mode a request is SERVED with: A_PLUS only while the owner's override is on. */
export function servedPromptMode(db, tool) {
  return tool === "a_plus_resume" && aPlusOverride(db) ? "A_PLUS" : "GENERATE";
}
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
export function tailoringFor({ db = null, env = process.env, isTrial = false } = {}) {
  // Owner 11-01: "switch the prompt between lean or the payload from the admin panel" — the admin's row first, for
  // everyone (trial accounts included); then the deploy's DRAFT_TAILORING; then the trial default.
  const row = db ? String(getSetting(db, TAILORING_KEY) || "").trim().toLowerCase() : "";
  if (TAILORINGS.includes(row)) return row;
  const set = String(env.DRAFT_TAILORING || "").trim().toLowerCase();
  if (TAILORINGS.includes(set)) return set;
  // ⛔ Owner 11-07: a tailored résumé is a STRATEGY (lean · payload) paired with a model — lean when nothing is set,
  // for everyone (it was "full" outside the trial). `isTrial` no longer changes it.
  void isTrial;
  return "lean";
}

/** For the admin surface: where the mode comes from, so clearing the override is never a guess. */
export function tailoringState(db, env = process.env) {
  const override = getSetting(db, TAILORING_KEY);
  const envRaw = env?.DRAFT_TAILORING ?? null;
  const known = (v) => TAILORINGS.includes(String(v || "").trim().toLowerCase());
  return { mode: tailoringFor({ db, env }), trialMode: tailoringFor({ db, env, isTrial: true }), aPlusOverride: aPlusOverride(db),
           source: known(override) ? "override" : known(envRaw) ? "env" : "default",
           override, envRaw, modes: [...TAILORINGS] };
}

// ── the model (owner 11-01: "or the model being used from the users side") ──────────────────────────────────────
// The tools service serves three per-request choices (contract 1.8.0 options.model). "service" = send none: the tools
// service's own configuration (RM_TAILOR_PROVIDER / RM_TAILOR_MODEL) decides. The admin sets the default and which
// choices a person may pick; a person's pick is honoured only while the admin offers it.
export const MODEL_CHOICES = Object.freeze(["haiku", "sonnet", "open"]);
export const MODEL_LABELS = Object.freeze({ service: "The service's default", haiku: "Claude Haiku (fastest, cheapest)",
  sonnet: "Claude Sonnet (stronger, about 3x the cost)", open: "Open model (the configured provider)" });
export const MODEL_DEFAULT_KEY = "tailoring_model_default";
export const MODELS_OFFERED_KEY = "tailoring_models_offered";
export const DEFAULT_OFFERED = Object.freeze(["haiku", "sonnet"]);

/** { default: "service" | choice, offered: [choice] } — the admin's model settings. */
export function modelSettings(db) {
  const d = String(getSetting(db, MODEL_DEFAULT_KEY) || "").trim();
  const raw = getSetting(db, MODELS_OFFERED_KEY);
  const offered = raw === null ? [...DEFAULT_OFFERED] : String(raw).split(",").map(x => x.trim()).filter(x => MODEL_CHOICES.includes(x));
  return { default: MODEL_CHOICES.includes(d) ? d : "service", offered };
}

/** The person's stored pick (users.tailoring_model, migration 212), or null — also on a database before 212. */
export function userModelChoice(db, userId) {
  try { return db.prepare("SELECT tailoring_model FROM users WHERE id=?").get(userId)?.tailoring_model || null; }
  catch { return null; }
}

/**
 * The options.model to send for one tailoring, or null (send none). Only lean and payload call a model by choice; a
 * person's pick wins while the admin offers it, else the admin's default.
 */
export function modelFor(db, { userId = null, tailoring = "lean" } = {}) {
  if (tailoring !== "lean" && tailoring !== "payload") return null;
  const s = modelSettings(db);
  const mine = userId ? userModelChoice(db, userId) : null;
  if (mine && s.offered.includes(mine)) return mine;
  return s.default === "service" ? null : s.default;
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

// ── D123 P6a · THE PAYLOAD'S JOB BLOCK ─────────────────────────────────────────────────────────────────────────────
const cap80 = (a, n) => [...new Map(a.filter(Boolean).map(t => String(t).trim()).filter(t => t && t.length <= 80).map(t => [lower(t), t])).values()].slice(0, n);
const escRe = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const countIn = (text, term) => (String(text || "").match(new RegExp(`(?<![\\w+#.])${escRe(term)}(?![\\w+#])`, "gi")) || []).length;

/**
 * Posting terms the résumé lacks that one of its own skills implies, from the Atlas's part_of / requires edges
 * (PyTorch part_of deep learning; Postgres requires SQL): [{ term, from }]. Code places them in Skills (P6d); nothing
 * is implied from a sibling (used_with / alternative_to — P6c asks the person first).
 */
export function broaderTerms(db, { resumeText, missing = [] } = {}) {
  if (!missing.length) return [];
  let stmt;
  try {
    stmt = db.prepare(`SELECT f.name AS from_name, f.term AS from_term FROM atlas_edges e
      JOIN atlas_nodes f ON f.id = e.from_id JOIN atlas_nodes t ON t.id = e.to_id
      WHERE e.type IN ('part_of', 'requires') AND (lower(t.term) = lower(?) OR lower(t.name) = lower(?))`);
  } catch { return []; }
  const out = [];
  for (const term of missing) {
    for (const r of stmt.all(term, term)) {
      const from = [r.from_name, r.from_term].find(x => x && countIn(resumeText, x) > 0);
      if (from) { out.push({ term: String(term).slice(0, 80), from: String(from).slice(0, 80) }); break; }
    }
    if (out.length >= 30) break;
  }
  return out;
}

/**
 * job.keywords for a PAYLOAD (or code) request: the lean keywords, plus the job block — must-have and nice-to-have
 * terms split by where the posting names them (the D125 reading's rule), every verb the posting uses ranked by how often
 * it does, up to 8 responsibilities — and the broader terms. Missing-and-unclaimed must-haves travel here on purpose:
 * they are the job block, and the tools service accepts one in a NEW bullet only where the employer's gist covers it.
 */
/**
 * The posting's terms split must-have / nice-to-have by where it names them (the D125 reading's rule): a term named ONLY
 * in the Preferred / nice-to-have section is a nice-to-have. One rule — payload tailoring and D136's best bets read it.
 */
export function splitMustNice(job, terms) {
  const text = fullPostingText(job);
  const nice = niceSection(text);
  const outside = nice ? text.replace(nice, "") : text;
  const isNice = (t) => !!nice && countIn(nice, t) > 0 && countIn(outside, t) === 0;
  return { must: terms.filter(t => !isNice(t)), nice: terms.filter(isNice) };
}

export function payloadJobKeywords(db, { job, report, claims = null, resumeText, synonyms = null }) {
  const base = leanJobKeywords(db, { job, report, claims, resumeText, synonyms });
  const text = fullPostingText(job);
  const terms = [...(report?.tier1_matched || []), ...(report?.tier1_missing || [])];
  const split = splitMustNice(job, terms);
  const verbs = cap80([...(report?.action_verbs_matched || []), ...(report?.action_verbs_missing || [])], 60)
    .map((v, i) => ({ v, i, n: countIn(text, v) })).sort((a, b) => b.n - a.n || a.i - b.i).map(x => x.v).slice(0, 30);
  const broader = broaderTerms(db, { resumeText, missing: report?.tier1_missing || [] });
  return {
    ...base,
    verbs,
    phrases: (base.phrases || []).slice(0, 8),
    mustHave: cap80(split.must, 40),
    niceToHave: cap80(split.nice, 30),
    ...(broader.length ? { broader } : {}),
  };
}
