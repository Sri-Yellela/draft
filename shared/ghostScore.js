// shared/ghostScore.js — ⭐ D137 · THE GHOST SCORE (owner 11-02): likely-dead postings scored WITH EVIDENCE.
//
// *"ghost jobs … the problem with this is its guess work, and if we're wrong users lose an opportunity so we have to
// hit the target with this."* Extends D107 (services/jobs/jobHistory.js, the crawl's own first seen / reposts).
//
//   · ⛔ ONLY A PROVABLY CLOSED POSTING IS HIDDEN — and that is not this file: a posting gone from the company's own
//     ATS is already off the board (is_active = 0). Everything scored here stays on the board, RANKED DOWN at most,
//     with its reasons, and the user is free to apply.
//   · THE WEIGHTS AND THRESHOLDS LIVE HERE AND NOWHERE ELSE (the owner tunes them in this one file). Each signal is a
//     plain fact the user can read ("Reposted 4 times since June"), never a bare number.
//   · Conservative on purpose: no single age or repost fact reaches "Likely not hiring" alone — only an evergreen /
//     talent-pool title does, because it says so itself. Anyone who applied through draft and heard back overrides
//     every other signal: the posting was answered.
//   · P2's calibration (services/jobs/ghostScore.js calibrateGhostThreshold) may only RAISE `notHiringMin` — when more
//     than 1 in 20 postings it flags still produce a reply — never lower it.
//
// Pure: signals in, { level, label, points, evidence } out. No database, no clock.

export const GHOST_LEVEL = Object.freeze({ HIRING: 0, UNCERTAIN: 1, NOT_HIRING: 2 });
export const GHOST_LABELS = Object.freeze(["Likely hiring", "Uncertain", "Likely not hiring"]);

/** Points per signal. ⭐ The owner's dial. */
export const GHOST_WEIGHTS = Object.freeze({
  evergreenTitle: 5,        // "Talent Pool", "General Application", "Future Opportunities" — the title says it
  evergreenText: 2,         // "not tied to a current opening", "for future openings as they arise"
  reposts: [0, 1, 2, 3],    // by repost count, capped at the last entry (D107: same company + title + text, after a close)
  open90: 2,                // open (first seen or posted) 90 days or more
  open60: 1,                // open 60–89 days
  massDuplicate: 1,         // the same text open in MASS_LOCATIONS or more locations
  companyNeverCloses: 2,    // watched WATCH_DAYS or more, OPEN_MIN or more open, none closed in 90 days
  userReport: 1,            // each person who marked their application "no reply in 30 days" (The Table's Still nothing)
  userReportCap: 2,
  silentApps: [[5, 2], [3, 1]], // applications through draft past 30 days with no reply: [at least n, points]
});

/** Level cut points. ⭐ The owner's dial; calibration may raise notHiringMin (app setting `ghost_not_hiring_min`). */
export const GHOST_THRESHOLDS = Object.freeze({ uncertainMin: 2, notHiringMin: 5 });

export const MASS_LOCATIONS = 10;
export const WATCH_DAYS = 60;
export const OPEN_MIN = 5;

/** A title that announces no current opening. Matched on the title alone. */
export const EVERGREEN_TITLE_RE = /\b(talent\s+(pool|community|network|pipeline)|general\s+(application|interest)|future\s+(opportunit(y|ies)|openings?|roles?|positions?)|expressions?\s+of\s+interest|evergreen|open\s+application|speculative\s+application|join\s+our\s+talent)\b/i;

/** Text that says the posting is not for a current vacancy. Explicit phrases only, measured on the 11-02 crawl copy:
 *  "build our talent pipeline" (a recruiter's job), "consider you for future opportunities" (Stripe's and IMC's
 *  boilerplate on real roles) and "a pipeline role feeding four areas" (a real opening) are NOT signs. */
export const EVERGREEN_TEXT_RE = /\b(this\s+(is\s+an?|posting\s+is\s+an?|role\s+is\s+an?)\s+evergreen\s+(role|position|requisition|posting|opening)|(pipeline|evergreen)\s+requisition|not\s+(tied\s+to|for)\s+an?\s+(current|active|specific|open)\s+(opening|position|vacancy|role)|(future|upcoming)\s+(openings|vacancies)\s+(as|when)\s+they\s+(arise|become\s+available|open)|keep\s+your\s+(resume|résumé|application|cv)\s+on\s+file|no\s+(current|immediate)\s+(opening|vacancy|vacancies|openings))\b/i;

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The score.
 * @param {object} s  signals: { title, text, liveness: {openDays, reposts, label}, locations, company: {watchedDays,
 *                    openCount, closed90}, reports, silent, replied }
 * @param {object} [o] { notHiringMin } — the calibrated cut (never below GHOST_THRESHOLDS.notHiringMin)
 * @returns {{ level: number, label: string, points: number, evidence: {key: string, text: string, points: number}[] }}
 */
export function ghostScoreOf(s = {}, { notHiringMin = GHOST_THRESHOLDS.notHiringMin } = {}) {
  const W = GHOST_WEIGHTS;
  const cut = Math.max(GHOST_THRESHOLDS.notHiringMin, Number(notHiringMin) || 0);
  const ev = [];
  const add = (key, points, text) => { if (points > 0) ev.push({ key, text, points }); };

  // ⭐ An answer overrides every guess: someone who applied through draft heard back.
  if ((s.replied ?? 0) > 0) {
    return { level: GHOST_LEVEL.HIRING, label: GHOST_LABELS[0], points: 0,
      evidence: [{ key: "replied", text: `${plural(s.replied, "person", "people")} who applied through draft heard back`, points: 0 }] };
  }

  if (EVERGREEN_TITLE_RE.test(String(s.title ?? ""))) add("evergreenTitle", W.evergreenTitle, "The title says it is a talent pool or future opening, not a current role");
  else if (EVERGREEN_TEXT_RE.test(String(s.text ?? "").slice(0, 20000))) add("evergreenText", W.evergreenText, "The posting says it is not for a current opening");

  const live = s.liveness;
  if (live) {
    const r = Math.max(0, Math.floor(live.reposts ?? 0));
    if (r > 0) add("reposts", W.reposts[Math.min(r, W.reposts.length - 1)], live.kind === "reposted" && live.label ? live.label : `Reposted ${r === 1 ? "once" : `${r} times`}`);
    const d = Math.floor(live.openDays ?? 0);
    if (d >= 90) add("open", W.open90, `Open ${d} days`);
    else if (d >= 60) add("open", W.open60, `Open ${d} days`);
  }

  if ((s.locations ?? 0) >= MASS_LOCATIONS) add("massDuplicate", W.massDuplicate, `The same text is open in ${s.locations} locations`);

  const c = s.company;
  if (c && c.watchedDays >= WATCH_DAYS && c.openCount >= OPEN_MIN && c.closed90 === 0) {
    add("companyNeverCloses", W.companyNeverCloses, `The company has closed none of its ${c.openCount} open postings in the ${c.watchedDays} days draft has watched it`);
  }

  const reports = Math.max(0, Math.floor(s.reports ?? 0));
  if (reports) add("userReport", Math.min(W.userReportCap, reports * W.userReport), `${plural(reports, "person", "people")} who applied marked it "no reply in 30 days"`);

  // Silent applications NOT already counted as a report.
  const silent = Math.max(0, Math.floor((s.silent ?? 0) - reports));
  for (const [n, p] of W.silentApps) if (silent >= n) { add("silentApps", p, `${silent} applications through draft, no reply after 30 days`); break; }

  const points = ev.reduce((a, e) => a + e.points, 0);
  const level = points >= cut ? GHOST_LEVEL.NOT_HIRING : points >= GHOST_THRESHOLDS.uncertainMin ? GHOST_LEVEL.UNCERTAIN : GHOST_LEVEL.HIRING;
  return { level, label: GHOST_LABELS[level], points, evidence: ev };
}

/** The card's and the posting's one line: "Likely not hiring · Reposted 4 times since June · Open 94 days". */
export function ghostLine(ghost) {
  if (!ghost || !(ghost.level >= GHOST_LEVEL.UNCERTAIN)) return null;
  const why = (ghost.evidence ?? []).map(e => (typeof e === "string" ? e : e.text)).filter(Boolean);
  return [GHOST_LABELS[ghost.level], ...why].join(" · ");
}
