/**
 * services/kb/lcaResolutionTransfer.js — LCA company resolutions by EXPORT → owner → IMPORT
 * (D17, A80 V11).
 *
 * Until 10-05 scripts/al4LcaResolution.mjs asked Haiku, for each AMBIGUOUS company, which of its
 * candidate LCA employers (if any) was its legal entity. D17 confines model calls to résumé
 * generation, so that question now goes to the owner as a file: the script EXPORTS one line per
 * ambiguous company with its candidates, the owner fills `answer`, and the script IMPORTS it.
 *
 * Unchanged, and the reason this is safe: an imported answer lands as 'proposed'. The matcher reads
 * only confirmed rows (services/kb/lcaResolution.js), and --confirm is a separate human act. A
 * wrong confirmation is a false sponsorship claim about a third party.
 *
 * Import guards (any one refuses the WHOLE file and every problem is listed):
 *   invalid_value      not JSON, wrong kind, an answer whose employer_name is not a string or null,
 *                      a confidence outside 0..1, no reason
 *   unknown_company    a company that is not ambiguous on the board now (matched since, or never
 *                      asked about — an unmatched company has no candidates, so it is never exported)
 *   tampered           the line's candidate list no longer matches its fingerprint
 *   invented_employer  the answer names an employer that is not in the candidate list — a name with
 *                      no filings behind it would become a sponsorship claim backed by nothing
 *   duplicate_company  the same company twice
 *   stale              the company's candidate set has changed since the export
 * An empty answer (employer_name null AND no reason) is "not answered yet" and is skipped, so a file
 * can be filled and imported a few companies at a time. "none of these" is employer_name null WITH a
 * reason — a real and often correct answer.
 * Re-importing the same file changes nothing: an identical proposal is counted `unchanged`.
 */

import crypto from "node:crypto";
import { recordResolutionProposal } from "./lcaResolution.js";

export const LCA_RESOLUTION_KIND = "al4_lca_resolution";
export const LCA_INSTRUCTIONS_KIND = "al4_lca_instructions";

export function fingerprintCandidates(candidates) {
  const names = (candidates || []).map(c => c?.name ?? null);
  return crypto.createHash("sha256").update(JSON.stringify(names)).digest("hex").slice(0, 16);
}

/**
 * @param askable  [{ company, candidates: [{ name, certified, periods }] }] — ambiguous companies only
 */
export function buildLcaExport(askable, rules, { exportedAt = new Date().toISOString() } = {}) {
  return [
    { kind: LCA_INSTRUCTIONS_KIND, exportedAt, rules },
    ...askable.map(a => ({
      kind: LCA_RESOLUTION_KIND,
      company: a.company,
      fingerprint: fingerprintCandidates(a.candidates),
      candidates: a.candidates,
      answer: { employer_name: null, confidence: null, reason: "" },
    })),
  ];
}

/**
 * Validates a filled export against the board NOW and the table, and says what an apply would
 * write. Writes nothing.
 *
 * @param currentCandidates  (company) => [{ name, ... }] | null — null when the company is not
 *                           ambiguous on the board any more
 */
export function planLcaImport(db, parsed, currentCandidates, { grader }) {
  const problems = [];
  const bad = (lineNo, code, detail) => problems.push({ lineNo, code, detail });
  const seen = new Set();
  const proposals = [];
  let unchanged = 0, alreadyReviewed = 0, unanswered = 0, lines = 0;
  if (!grader || !String(grader).trim()) bad(0, "invalid_value", "--grader NAME is required: it is the provenance of every answer");

  const prior = db.prepare("SELECT * FROM lca_company_resolutions WHERE company=?");
  for (const { lineNo, value, error } of parsed) {
    if (error) { bad(lineNo, "invalid_value", `not JSON: ${error}`); continue; }
    if (value?.kind === LCA_INSTRUCTIONS_KIND) continue;
    if (value?.kind !== LCA_RESOLUTION_KIND) { bad(lineNo, "invalid_value", `kind is ${JSON.stringify(value?.kind)}`); continue; }
    lines++;
    const company = value.company;
    if (typeof company !== "string" || !company) { bad(lineNo, "invalid_value", "no company"); continue; }
    if (seen.has(company)) { bad(lineNo, "duplicate_company", `${company} appears twice`); continue; }
    seen.add(company);
    if (!Array.isArray(value.candidates) || fingerprintCandidates(value.candidates) !== value.fingerprint) {
      bad(lineNo, "tampered", `${company}'s candidate list was edited after export`); continue;
    }
    const a = value.answer || {};
    const name = a.employer_name;
    const reason = typeof a.reason === "string" ? a.reason.trim() : "";
    if (name !== null && typeof name !== "string") { bad(lineNo, "invalid_value", `${company}: employer_name must be a string or null`); continue; }
    if (name === null && !reason) { unanswered++; continue; }
    if (!reason) { bad(lineNo, "invalid_value", `${company}: an answer needs a reason`); continue; }
    if (a.confidence !== null && a.confidence !== undefined
        && !(typeof a.confidence === "number" && a.confidence >= 0 && a.confidence <= 1)) {
      bad(lineNo, "invalid_value", `${company}: confidence must be 0..1 or null`); continue;
    }
    if (name !== null && !value.candidates.some(c => c?.name === name)) {
      bad(lineNo, "invented_employer", `${company}: "${name}" is not one of its candidates`); continue;
    }
    const now = currentCandidates(company);
    if (!now) { bad(lineNo, "unknown_company", `${company} is not ambiguous on the board now`); continue; }
    if (fingerprintCandidates(now) !== value.fingerprint) {
      bad(lineNo, "stale", `${company}'s candidates changed since the export`); continue;
    }
    const p = prior.get(company);
    if (p && p.status !== "proposed") { alreadyReviewed++; continue; }
    const proposal = {
      company,
      resolvedEmployerName: name,
      candidates: value.candidates.map(c => ({ name: c.name, certified: c.certified })),
      modelConfidence: typeof a.confidence === "number" ? a.confidence : null,
      // The columns are named for the model that used to fill them; the grader is recorded in the
      // reason so a bad import can be traced to who answered it.
      modelReason: `[${String(grader).trim()}] ${reason}`.slice(0, 400),
    };
    if (p && (p.resolved_employer_name ?? null) === (name ?? null) && p.model_reason === proposal.modelReason
        && (p.model_confidence ?? null) === proposal.modelConfidence
        && p.candidates_json === JSON.stringify(proposal.candidates)) { unchanged++; continue; }
    proposals.push(proposal);
  }
  return { ok: problems.length === 0, problems, proposals, unchanged, alreadyReviewed, unanswered, lines };
}

/** Plan and, when clean, write — one transaction, so the plan's reads are the write's table. */
export function applyLcaImport(db, parsed, currentCandidates, opts) {
  let result;
  db.transaction(() => {
    const plan = planLcaImport(db, parsed, currentCandidates, opts);
    result = { ...plan, written: 0 };
    if (!plan.ok) return;
    for (const p of plan.proposals) if (recordResolutionProposal(db, p)) result.written++;
  })();
  return result;
}
