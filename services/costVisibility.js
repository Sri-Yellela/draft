// services/costVisibility.js — ⛔ COST VISIBILITY (owner, 10-09): what a résumé costs US is the admin's.
//
// A user sees their ALLOWANCE (drafts left in the last 24 hours, when the next one frees up) and what to
// expect ("about 10–20 seconds"). Never a cent figure, which tool or model ran (an admin's silent A+ swap shows
// as Generate), token counts, whether it was cached, or why it was retried. Those are Admin → Costs & quotas.

/** What a user is told to expect, in seconds. */
export const GENERATION_EXPECT_SECONDS = Object.freeze([10, 20]);

/** The keys a non-admin's generation response never carries. */
export const USER_HIDDEN_GENERATION_FIELDS = Object.freeze(["tool", "toolLabel", "retry", "usage", "cost", "costUsd",
  "cost_usd", "tokens", "model", "cache", "cached", "atsCached"]);

/** A generation response as a non-admin may see it — the hidden keys dropped; an admin's is unchanged. */
export function userSafeGeneration(body, { admin = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body) || admin) return body;
  return Object.fromEntries(Object.entries(body).filter(([k]) => !USER_HIDDEN_GENERATION_FIELDS.includes(k)));
}

/** GET /api/generate/cost for a non-admin: the allowance and the expectation, nothing else. */
export function userCostView(allowance) {
  return { allowance, expectSeconds: GENERATION_EXPECT_SECONDS };
}
