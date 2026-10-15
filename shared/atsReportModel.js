// shared/atsReportModel.js — ⭐ T9 · WHAT AN ATS REPORT SAYS, for every surface that draws one.
//
// The pure half of THE ATS report (A52 → T9). It was the top of client/src/components/AtsReport.jsx; it moved
// here, unchanged in meaning, when the report became ONE framework-agnostic component (shared/atsReportElement.js,
// `<draft-ats-report>`) drawn by the web app AND the extension (owner 10-14: "the same ATS panel we use on the
// website — same design and everything"). Nothing here touches a DOM, a network or a framework, so the server, the
// web app, the extension's service worker and its pages all read a report the same way.
//
// ⛔ ONE SHAPE. The renderer takes the scorer's own report (tier1_matched, competencies_*, action_verbs_*,
// decline_reasons …) — the JSON the web app's ATS panel already gets from POST /api/jobs/:id/keywords, and the JSON
// the extension's routes now pass through (routes/extensionJob.js `ats.report`). The two other shapes that exist —
// the deck's frozen report and the public route's result — are converted HERE (fromDeckReport,
// fromStandaloneResult), so no other file needs to know a report's field names (test/atsReportOneImplementation).
//
// ⛔ DEPENDENCIES: atsBands.js and profileSignals.js only — the extension bundles this file (scripts/buildAtsReport.mjs),
// and every import is one more file in that bundle.
import { atsBandFor } from "./atsBands.js";
import { profileSignalKey } from "./profileSignals.js";

/** The band a report reads as — the ONE derivation every ATS surface uses. */
export function reportBand(report, knownBand = null) {
  if (knownBand) return knownBand;
  return atsBandFor(report?.score ?? null);
}

/** The deck's frozen report (services/dailyDraft.js deckReport — every section, no number). */
export function fromDeckReport(r) {
  if (!r) return null;
  return {
    source: "local_ats_deck", decline_reasons: r.declineReasons,
    tier1_matched: r.skillsMatched, tier1_missing: r.skillsMissing,
    competencies_matched: r.competenciesMatched, competencies_missing: r.competenciesMissing,
    action_verbs_matched: r.verbsMatched, action_verbs_missing: r.verbsMissing, action_verbs_generic: r.verbsGeneric,
    claimed_matches: r.claimedMatches,
    experience: r.experience ? { summary: r.experience, fit: r.experienceFit !== false, state: r.experienceState ?? null } : null,
    hard_constraint_misses: r.hardConstraintMisses,
    seniority_cap: r.seniorityNote ? { applied: true, reason: r.seniorityNote } : { applied: false },
    resume_depth: r.depthHeadline ? { headline: r.depthHeadline, detail: r.depthDetail || "" } : null,
  };
}

/** The public route's result (services/standaloneAts.js — a band and the term lists, no number). */
export function fromStandaloneResult(r) {
  if (!r) return null;
  return {
    source: r.source || "local_ats_public", decline_reasons: r.decline_reasons || [],
    tier1_matched: r.matched_skills || [], tier1_missing: r.missing_skills || [],
    competencies_matched: r.competencies_matched || [], competencies_missing: r.competencies_missing || [],
    action_verbs_matched: r.matched_verbs || [], action_verbs_missing: r.missing_verbs || [],
    action_verbs_generic: r.generic_verbs || [],
    experience: r.experience ? { summary: r.experience, fit: r.experience_state !== "short", state: r.experience_state ?? null } : null,
    // No profile on the public tool, so the board's "…against this profile" fallback would be untrue.
    verdict: r.experience ? null : "Deterministic local ATS match against this posting.",
    seniority_cap: r.seniority ? { applied: true, reason: r.seniority } : { applied: false },
    resume_depth: r.resume_depth ? { headline: r.resume_depth.headline, detail: r.resume_depth.detail || "" } : null,
  };
}

// ⛔ THE KIND IS THE SCORER'S BUCKET, CARRIED — never re-derived from the word. The scorer keeps
// skills (tier1_*), competencies (competencies_*) and verbs (action_verbs_*) apart; each box says which
// one it came from. `claim` is the route a claim goes through: a competency is claimed as a skill (the
// same reversible call D31 used), a verb as a verb.
export const TERM_KINDS = Object.freeze({
  skill:   { label: "skill",   claim: "skill" },
  quality: { label: "quality", claim: "skill" },
  verb:    { label: "verb",    claim: "action_verb" },
});
const asTerms = (list, kind) => (Array.isArray(list) ? list : []).filter(t => typeof t === "string" && t).map(term => ({ term, kind }));

/**
 * D32: what the card counts. Every real ask the posting makes — skills, competencies (qualities) and
 * its job-specific verbs — is either already on the résumé or something the candidate could claim.
 * Generic language is in NEITHER: it is not a gap, so it is not in the denominator either; the bar
 * draws it as its own third segment so the reader sees it was read and set aside.
 */
export function reportAsks(report) {
  const onResume = [
    ...(report?.tier1_matched || []).map(term => ({ term, kind: "skill" })),
    ...(report?.competencies_matched || []).map(term => ({ term, kind: "quality" })),
    ...(report?.action_verbs_matched || []).map(term => ({ term, kind: "verb" })),
  ];
  const couldClaim = [
    ...(report?.tier1_missing || []).map(term => ({ term, kind: "skill" })),
    ...(report?.action_verbs_missing || []).map(term => ({ term, kind: "verb" })),
    ...(report?.competencies_missing || []).map(term => ({ term, kind: "quality" })),
  ];
  const generic = asTerms(report?.action_verbs_generic, "verb");
  const missing = couldClaim.length;
  return { onResume, couldClaim, generic, matched: onResume.length, missing, total: onResume.length + missing };
}

/** Provenance: what the résumé already evidences — the scorer decided this; nothing is re-derived. */
export function evidencedKeys(report) {
  return new Set([
    ...(report?.tier1_matched || []),
    ...(report?.competencies_matched || []),
    ...(report?.action_verbs_matched || []),
  ].map(profileSignalKey).filter(Boolean));
}

// ── Experience: four states, never inferred from prose (moved from shared/postingFacts.js, which re-exports it) ──
// The scorer's report carries { requiredYears, candidateYears, fit }. ⚠ `fit` is TRUE when the posting
// asks for no years at all — so `fit` alone cannot say "met". Four states, never inferred from prose:
//   met      it asks, and the résumé/profile meets it
//   short    it asks, and the résumé/profile has fewer
//   unknown  it asks, and there is nothing to compare against
//   none     it asks for no years
export const EXPERIENCE_STATES = Object.freeze(["met", "short", "unknown", "none"]);
// A report that carries neither (a deck card frozen before D32) is null — the row prints the scorer's
// sentence with no mark rather than guess one.
export function experienceState(exp) {
  if (!exp || typeof exp !== "object") return null;
  if (EXPERIENCE_STATES.includes(exp.state)) return exp.state;
  if (!("requiredYears" in exp)) return exp.fit === false ? "short" : null;
  if (!Number.isFinite(exp.requiredYears)) return "none";
  if (!Number.isFinite(exp.candidateYears)) return "unknown";
  return exp.candidateYears >= exp.requiredYears ? "met" : "short";
}

/** The Experience row's mark, per state. */
export const EXPERIENCE_MARK = Object.freeze({
  met:     { mark: "✓", word: "Met" },
  short:   { mark: "✕", word: "Short" },
  unknown: { mark: "?", word: "Can't compare" },
  none:    { mark: "–", word: "Not asked" },
});

// ── T9 · cleanReport — the named fields a renderer reads, and nothing else ──────────────────────────────────────
//
// The extension keeps every server answer to named fields (extension/boardJob.js); the web component does the same
// to every report it is handed, on BOTH surfaces — so this is not an extension-only shape, it is the renderer's own
// input contract. Strings only (a term that is an object is dropped, never stringified), lists and strings capped,
// numbers finite or null. The words are rendered as TEXT by the component (textContent), never as markup.
const TERM_MAX = 120, SENTENCE_MAX = 600, LIST_MAX = 200;
const str = (v, max = SENTENCE_MAX) => (typeof v === "string" && v ? v.slice(0, max) : null);
const words = (v, max = TERM_MAX) => (Array.isArray(v) ? v.filter(x => typeof x === "string" && x).slice(0, LIST_MAX).map(x => x.slice(0, max)) : []);
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
export const REPORT_LISTS = Object.freeze(["tier1_matched", "tier1_missing", "competencies_matched", "competencies_missing",
  "action_verbs_matched", "action_verbs_missing", "action_verbs_generic"]);

/** The report as the renderer reads it — or null when it is not a report at all. */
export function cleanReport(report) {
  if (!report || typeof report !== "object" || Array.isArray(report)) return null;
  const out = { source: str(report.source, 60) };
  // `score` keeps its PRESENCE: a declined report says score: null, and the caller's band reads that (A52).
  if (Object.prototype.hasOwnProperty.call(report, "score")) out.score = num(report.score);
  for (const k of REPORT_LISTS) out[k] = words(report[k]);
  out.decline_reasons = words(report.decline_reasons, SENTENCE_MAX);
  out.hard_constraint_misses = words(report.hard_constraint_misses);
  const e = report.experience;
  out.experience = e && typeof e === "object" ? {
    summary: str(e.summary), fit: e.fit === false ? false : e.fit === true ? true : null,
    ...(typeof e.state === "string" ? { state: e.state.slice(0, 20) } : {}),
    ...("requiredYears" in e ? { requiredYears: num(e.requiredYears) } : {}),
    ...("candidateYears" in e ? { candidateYears: num(e.candidateYears) } : {}),
  } : null;
  const s = report.seniority_cap;
  out.seniority_cap = s && typeof s === "object" && s.applied ? { applied: true, reason: str(s.reason) } : { applied: false };
  const d = report.resume_depth;
  out.resume_depth = d && typeof d === "object" && str(d.headline) ? { headline: str(d.headline), detail: str(d.detail) || "" } : null;
  out.best_possible_score = num(report.best_possible_score);
  out.best_possible_reason = str(report.best_possible_reason);
  out.verdict = str(report.verdict);
  out.strengths = words(report.strengths, SENTENCE_MAX);
  out.improvements = words(report.improvements, SENTENCE_MAX);
  return out;
}
