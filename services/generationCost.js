// ⭐ D70 Phase 3 · WHAT A RÉSUMÉ COSTS, SAID BEFORE IT RUNS.
//
// The owner's 13¢ résumé (Phase 0, production 10-06) was not one expensive call — it was TWO
// delivered generations on one job six minutes apart: a Generate (6.67¢) and then an A+ (7.13¢).
// A+ is not an add-on to a Generate; on a job it is the SAME single resume_generate call with the
// a_plus overlay, a second full résumé. So the cheapest lever is the product's own: say what the
// button costs before it is pressed — and say which of the two the button will run, because an
// admin-granted A+ flag (users.aplus_resume) silently turns this user's Generate into A+.
//
// The figure is the MEDIAN cost of recent delivered generations of that kind in this server's own
// ledger (usage_events, every user — it is what a call costs, not what this person spent). With too
// few rows to say, the figure measured in production at Phase 0 is used, and the response says
// which. No model call is made to estimate anything (D17).

/** Phase 0's production measurement (D70, 10-06 21:12Z / 21:18Z), in cents — the fallback. */
export const MEASURED_CENTS = Object.freeze({ GENERATE: 6.67, A_PLUS: 7.13 });

/** The ledger needs at least this many delivered rows of a kind before its median replaces the measurement. */
export const MIN_LEDGER_SAMPLES = 3;
const MAX_LEDGER_SAMPLES = 25;

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * One kind's estimate. Only DELIVERED rows count: success = 1, output written, and no A94
 * `request failed:` marker (a withheld résumé was billed but is not what a delivered one costs).
 */
export function costEstimateFor(db, subtype) {
  const fallback = { cents: MEASURED_CENTS[subtype] ?? null, basis: "measured", samples: 0 };
  try {
    const rows = db.prepare(`
      SELECT cost_usd FROM usage_events
      WHERE purpose = 'resume_generate' AND event_subtype = ? AND success = 1 AND output_tokens > 0
        AND cost_usd > 0 AND (error_text IS NULL OR error_text NOT LIKE '%request failed:%')
      ORDER BY created_at DESC, id DESC LIMIT ${MAX_LEDGER_SAMPLES}
    `).all(subtype);
    if (rows.length < MIN_LEDGER_SAMPLES) return fallback;
    const cents = Math.round(median(rows.map(r => Number(r.cost_usd) * 100)) * 100) / 100;
    return { cents, basis: "ledger", samples: rows.length };
  } catch {
    return fallback;
  }
}

/** "about 7¢" — whole cents; a résumé is never cheaper than a cent. */
export function centsLabel(cents) {
  if (cents == null || !Number.isFinite(cents)) return null;
  return `about ${Math.max(1, Math.round(cents))}¢`;
}

/**
 * What GET /api/generate/cost answers: which tool this person's résumé button will run, and what a
 * Generate and an A+ each cost. `aplusFlag` is users.aplus_resume — the silent upgrade
 * /api/generate applies to a plain Generate.
 */
export function generationCostSummary(db, { aplusFlag = false } = {}) {
  const generate = costEstimateFor(db, "GENERATE");
  const aPlus = costEstimateFor(db, "A_PLUS");
  const runs = aplusFlag ? "a_plus_resume" : "generate";
  const runsCost = runs === "a_plus_resume" ? aPlus : generate;
  return {
    runs,
    runsLabel: runs === "a_plus_resume" ? "A+ Resume" : "Generate",
    generate: { ...generate, label: centsLabel(generate.cents) },
    aPlus: { ...aPlus, label: centsLabel(aPlus.cents) },
    sentence: runs === "a_plus_resume"
      ? `This runs A+ — a full résumé written by the model, ${centsLabel(aPlus.cents)} (a plain Generate is ${centsLabel(generate.cents)}). Each new one is another call.`
      : `A new résumé is one model call — ${centsLabel(generate.cents)}. Each new one is another call.`,
  };
}
