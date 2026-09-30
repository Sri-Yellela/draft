/**
 * draft's entry point to the ATS scorer. The scorer itself lives in @draft/ats-scorer
 * (packages/ats-scorer) since A1; this module is what every draft caller keeps importing.
 *
 * It adds exactly ONE thing: `resume_depth`, the thin-résumé warning. That is draft's
 * PRESENTATION — its thresholds exist to explain a flat all-Weak BAND display, and its copy talks
 * about bands — so by the rule decided 2026-09-27 (the score is a fact, the band is a product
 * decision) it stays product-side with shared/atsBands.js. It is computed from the same basis the
 * package scored against, so the report draft sees is field-for-field what it was before the move.
 *
 * ⛔ Nothing else belongs here. A scoring change made in this wrapper would exist in draft and not
 * in any other consumer of the package — the exact split A1 exists to prevent.
 */
import * as scorer from "@draft/ats-scorer";
import { resumeDepthWarning } from "../shared/atsBands.js";

export * from "@draft/ats-scorer";

export function scoreAtsLocally(args = {}) {
  // Built exactly as the package builds it when no basis is passed — the same three fields and no
  // more. Passing `args` whole would start honouring `claims` on this path, a scoring change.
  // No `= null` defaults: an explicit null overrides the package's own `= {}` and crashed
  // buildRuntimeAtsBasis ("reading 'selected_keywords' of null") for any caller without a basis —
  // found 09-30 by the public ATS tool, the first such caller. Undefined keeps parity.
  const { resumeText = "", signalProfile, domainProfile } = args;
  const basis = args.runtimeBasis || scorer.buildRuntimeAtsBasis({ resumeText, signalProfile, domainProfile });
  const report = scorer.scoreAtsLocally({ ...args, runtimeBasis: basis });
  return { ...report, resume_depth: resumeDepthWarning(basis) };
}
