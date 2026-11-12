// shared/flags.js — ⭐ A187 Stage 0 (46i) · THE FLAG REGISTRY: every runtime flag, its meaning, its deploy-time variable
// and its default. services/flags.js resolves a flag in three layers (D162's, services/modelGateway.js): this default →
// the environment variable → the admin's switch (app_settings `flag:<key>`, read at call time, audited). A flag missing
// here cannot be read or set — a typo fails loudly instead of reading "off" forever.
//
// `cohort: true` lets a flag serve a PERCENT of people (a stable bucket per person × flag — the same person never flips);
// a flag about the whole system (storage, a background pass) is all-or-nothing.

export const FLAGS = Object.freeze({
  ats_store_slim: Object.freeze({
    what: "The board's bulk scoring stores only the score; a report is rebuilt (once) when someone opens it.",
    env: "ATS_STORE_SLIM",
    default: "off",
    cohort: false,
    since: "A187 Stage 0 (46i)",
  }),
});

export const FLAG_KEYS = Object.freeze(Object.keys(FLAGS));
export const FLAG_STATES = Object.freeze(["off", "on", "cohort"]);
