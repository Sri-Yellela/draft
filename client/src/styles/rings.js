// ── THE BUBBLE STANDARD's ring — seven states, one palette (D113 UI U2, owner 10-31) ─────────────
//
// Wherever a company or a job is shown as a bubble (components/CompanyBubble.jsx), its STAGE is shown
// by ONE ring in the bubble's own rounded-square shape — no lanes, no badge. These are the ring's
// states, each a colour TOKEN (themes/*.js), never a colour: all four themes re-point the tokens, and
// the two contrast themes swap the bubble's shadow for an outline (CompanyBubble.css).
// D102's ladder maps onto these in lib/draftHouseTree.js (LADDER_RING) — every status to exactly one.
export const RINGS = Object.freeze({
  need:   Object.freeze({ label: "Needs you",             token: "ACCENT",    pulse: true }),
  review: Object.freeze({ label: "Ready for your review", token: "WARNING",   pulse: true }),
  pick:   Object.freeze({ label: "Picked",                token: "INK_FAINT", pulse: false }),
  work:   Object.freeze({ label: "Working on it",         token: "INFO",      pulse: true }),
  sent:   Object.freeze({ label: "Sent",                  token: "SUCCESS",   pulse: false }),
  reply:  Object.freeze({ label: "Replied",               token: "VIOLET",    pulse: false }),
  stop:   Object.freeze({ label: "Stopped",               token: "DANGER",    pulse: false }),
});
export const RING_ORDER = Object.freeze(["need", "review", "pick", "work", "sent", "reply", "stop"]);

/** The CSS custom property a ring paints with — the theme's published token (themes/index.js cssVarName). */
export const ringVar = (ring) => (RINGS[ring] ? `var(--c-${RINGS[ring].token.toLowerCase().replace(/_/g, "-")})` : "transparent");
