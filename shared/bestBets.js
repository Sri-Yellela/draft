// shared/bestBets.js — ⭐ D136 · BEST BETS (owner 11-02): the few jobs to apply to this week, ranked by the chance of a
// real conversation. *"A ranked shortlist, not a firehose … the bottleneck has never been applications. It's qualified
// conversations."*
//
//   · ⛔ HONEST ABOUT WHAT IT IS: until outcomes calibrate it (P3, ≥ CALIBRATED_MIN outcomes), this is a RANKED SCORE
//     BUILT FROM SIGNALS, never called a probability. It is shown as Best bet · Good bet · Long shot with its reasons.
//   · HARD FILTERS FIRST, never ranked, simply out (services/bestBets.js): not eligible by what the user SET (D104 / D121
//     — "won't sponsor" for someone who needs it), outside the user's category (D127 — the board is already scoped),
//     closed (the board shows only open postings; D137's provably closed). Already applied / drafted is out too: this is
//     a list of what to apply to next.
//   · THE SIGNALS, each with a weight in THIS FILE (the owner's dial): fit against the posting's MUST-HAVES (D123 P6a's
//     split — a term named only in the Preferred section is a nice-to-have), the real level (D106) against the user's,
//     freshness (hours since draft first saw it), the ghost score (D137), the company's hiring velocity (postings it
//     closed in 60 days — from the crawl's history), a warm path (D138 — not built: absent, it weighs nothing) and the
//     user's aim (D143 — not built: likewise).
//   · An absent signal is left out of BOTH sides of the sum — the score is the share of the points the KNOWN signals
//     could give — so a posting is never marked down for what draft cannot see.
//
// Pure: signals in, { score, band, label, reasons } out. No database, no clock.

export const BEST_BET_WEIGHTS = Object.freeze({
  mustHaves: 40,   // the share of must-have terms the résumé covers (else the ATS match, as a share of 100)
  level: 10,       // at or below the user's level: all; one step above: half; two or more: none
  freshness: 15,   // ≤ 1 day: all · ≤ 3 days: 80 % · ≤ 7: 55 % · ≤ 14: 25 % · older: none
  ghost: 15,       // D137 Likely hiring: all · Uncertain: a third · Likely not hiring: none (and never above Long shot)
  velocity: 10,    // closed 3+ postings in 60 days: all · 1–2: half · none in 60 days of watching: none
  warmPath: 10,    // D138 — someone the user knows works there
  aim: 10,         // D143 — the posting is on the user's chosen route
});

/** The bands. ⭐ The owner's dial. */
export const BEST_BET_BANDS = Object.freeze({ best: 70, good: 50 });
export const BEST_BET_LABELS = Object.freeze({ best: "Best bet", good: "Good bet", long: "Long shot" });

/** The shortlist: default 5, the user sets 3–20. */
export const SHORTLIST_DEFAULT = 5;
export const SHORTLIST_MIN = 3;
export const SHORTLIST_MAX = 20;

/** P3: below this many recorded outcomes, nothing is shown as a chance — signals only. */
export const CALIBRATED_MIN = 500;

const FRESH_STEPS = [[1, 1], [3, 0.8], [7, 0.55], [14, 0.25]];
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function ago(hours) {
  if (hours < 1) return "posted within the hour";
  if (hours < 24) return `posted ${plural(Math.floor(hours), "hour")} ago`;
  const d = Math.floor(hours / 24);
  return d === 1 ? "posted yesterday" : `posted ${d} days ago`;
}

/** A shortlist size the user asked for, clamped; anything unreadable is the default. */
export function shortlistSize(n) {
  const v = Number(n);
  if (!Number.isInteger(v)) return SHORTLIST_DEFAULT;
  return Math.min(SHORTLIST_MAX, Math.max(SHORTLIST_MIN, v));
}

/**
 * The score.
 * @param {object} s  { eligible, mustHaves: {have, total}|null, atsScore, levelGap (posting rank − user rank)|null,
 *                    hoursSinceFirstSeen|null, ghostLevel (0|1|2)|null, velocity: {watchedDays, closed60}|null,
 *                    warmPath: {text}|null, aim: {text}|null }
 * @returns {{ score: number, band: "best"|"good"|"long", label: string, reasons: string[], points: object }}
 */
export function bestBetOf(s = {}) {
  const W = BEST_BET_WEIGHTS;
  // ⛔ FIT IS REQUIRED (44i walk, 11-03): with no fit known, freshness alone scored 100 % and unscored postings outranked
  // scored ones. A posting not scored yet has no best-bet score — it waits for its fit (the board's precompute).
  const fitKnown = (s.mustHaves && s.mustHaves.total > 0) || Number.isFinite(s.atsScore);
  if (!fitKnown) return { score: null, band: "unscored", label: "Not scored yet", reasons: [], points: {} };
  let got = 0, could = 0;
  const reasons = [];
  const points = {};
  const add = (key, share, reason) => {
    if (share == null) return;
    const p = W[key] * Math.max(0, Math.min(1, share));
    got += p; could += W[key]; points[key] = Math.round(p * 10) / 10;
    if (reason) reasons.push(reason);
  };

  if (s.eligible) reasons.push("you're eligible");

  const mh = s.mustHaves;
  if (mh && mh.total > 0) add("mustHaves", mh.have / mh.total, `${mh.have} of ${mh.total} must-haves`);
  else if (Number.isFinite(s.atsScore)) add("mustHaves", s.atsScore / 100, `${Math.round(s.atsScore)} ATS match`);

  if (Number.isFinite(s.levelGap)) {
    add("level", s.levelGap <= 0 ? 1 : s.levelGap === 1 ? 0.5 : 0,
      s.levelGap <= 0 ? "at your level" : s.levelGap === 1 ? "one step above your level" : "asks well above your level");
  }

  if (Number.isFinite(s.hoursSinceFirstSeen)) {
    const days = s.hoursSinceFirstSeen / 24;
    const step = FRESH_STEPS.find(([d]) => days <= d);
    add("freshness", step ? step[1] : 0, days <= 14 ? ago(s.hoursSinceFirstSeen) : null);
  }

  if (s.ghostLevel != null) {
    add("ghost", s.ghostLevel >= 2 ? 0 : s.ghostLevel === 1 ? 1 / 3 : 1, s.ghostLevel >= 2 ? "likely not hiring" : null);
  }

  const v = s.velocity;
  if (v && v.watchedDays >= 60) {
    add("velocity", v.closed60 >= 3 ? 1 : v.closed60 >= 1 ? 0.5 : 0,
      v.closed60 >= 1 ? `they closed ${plural(v.closed60, "role")} in 60 days` : "no roles closed in 60 days");
  }

  if (s.warmPath) add("warmPath", 1, s.warmPath.text);
  if (s.aim) add("aim", 1, s.aim.text);

  const score = could ? Math.round((got / could) * 100) : 0;
  let band = score >= BEST_BET_BANDS.best ? "best" : score >= BEST_BET_BANDS.good ? "good" : "long";
  if (s.ghostLevel >= 2) band = "long";
  return { score, band, label: BEST_BET_LABELS[band], reasons, points };
}

/** "Best bet: you're eligible · posted 9 hours ago · 13 of 15 must-haves · they closed 6 roles in 60 days" */
export function bestBetLine(bet) {
  if (!bet) return null;
  return bet.reasons?.length ? `${bet.label}: ${bet.reasons.join(" · ")}` : bet.label;
}
