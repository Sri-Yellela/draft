// ── D104 P2 (owner 10-30) · EVERY FILLED VALUE SAYS WHERE IT CAME FROM — and none came from a model ───
//
// The 10-30 evidence: another product answered self-ratings the candidate never gave ("Moderate" prompt engineering,
// "1 to 5" years). Here every value carries `source`:
//   profile        the candidate's profile / résumé facts / Application defaults
//   saved_answer   an answer the candidate saved (D96)
//   posting        read from the posting itself (e.g. the job's own location)
//   user_now       typed by the candidate in Needs you, this time
// ⛔ There is NO `model` source (D17: only résumé generation calls a model). A value the fill engine GUESSED
// (label_fuzzy, default — services/applyAutomation.js PROVENANCE) has NO source: the engine already holds it below
// AUTO_SUBMIT_MIN_CONFIDENCE, so it reaches Needs you instead of the employer.
export const ANSWER_SOURCES = Object.freeze(["profile", "saved_answer", "posting", "user_now", "user_setting"]);

const OF_PROVENANCE = Object.freeze({
  handler_exact: "profile",
  field_map_exact: "profile",
  label_exact: "profile",
  sponsorship_derived: "profile",
  custom_answer: "saved_answer",
  user_now: "user_now",
  // 10-30: a terms / privacy box the user's own Auto settings (agreeToTerms) let draft tick
  user_consent_setting: "user_setting",
  posting: "posting",
});

/** The source of one answer, from the fill engine's provenance; null for a guess (→ Needs you). */
export function sourceOf(provenance) {
  return OF_PROVENANCE[provenance] ?? null;
}
