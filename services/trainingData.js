// services/trainingData.js — ⛔⛔ D162 G4 / G6 · D160 RULE 1: NEVER TRAIN ON CLAUDE'S OUTPUTS.
//
// The one gate every dataset build passes its rows through. A row may enter a TRAINING set only when its `source` says
// it was not made by a Claude call — and a row with no source is refused too, because "we don't know who wrote it" is
// exactly how a Claude output would slip in (draft's existing tailored résumés were largely written by Claude: they may
// EVALUATE a model, never train one).
//
// A source is what the gateway tags every output with (services/modelGateway.js sourceTag): { provider, model, task,
// route, claude }. Human-written rows (the owner's / a curator's examples, a consenting user's own résumé) carry
// { provider: "human" }. Consent and de-identification (D160 rules 1–2, the data register) are D160 P0 and are not
// decided here — this gate answers one question only: could this row be a Claude output?
import { PROVIDERS, isClaudeProvider } from "../shared/modelTasks.js";

/** Providers whose rows are not model outputs at all. */
export const HUMAN_SOURCES = Object.freeze(["human"]);

/** Why a row may not train a model, or null when its source allows it. Fail-closed on anything unrecognised. */
export function trainingRefusal(row) {
  const s = row?.source;
  if (!s || typeof s !== "object") return "no source — an untagged row could be a Claude output";
  if (HUMAN_SOURCES.includes(s.provider)) return null;
  if (s.claude === true) return `source is a Claude call (${s.provider}/${s.model})`;
  if (/^claude[-_]/i.test(String(s.model || ""))) return `the model ${s.model} is Claude's`;
  if (!PROVIDERS[s.provider]) return `unknown provider "${s.provider}"`;
  if (isClaudeProvider(s.provider)) return `provider ${s.provider} is Claude's`;
  return null;
}

/**
 * ⛔ The dataset build's gate. Throws — never filters silently — when any row is refused, naming how many and why, so a
 * build that would have trained on Claude's text fails loudly instead of quietly shrinking. `{ dropRefused: true }`
 * returns { rows, refused } for an explicit, reported split.
 */
export function assertTrainingRows(rows, { dropRefused = false } = {}) {
  const ok = [], refused = [];
  for (const [i, row] of (rows || []).entries()) {
    const why = trainingRefusal(row);
    if (why) refused.push({ index: i, why }); else ok.push(row);
  }
  if (dropRefused) return { rows: ok, refused };
  if (refused.length) {
    const err = new Error(`D160 rule 1: ${refused.length} of ${(rows || []).length} row(s) may not be trained on — ` +
      refused.slice(0, 5).map(r => `#${r.index}: ${r.why}`).join("; "));
    err.code = "training_refuses_claude_rows";
    err.refused = refused;
    throw err;
  }
  return ok;
}
