// shared/postingLevel.js — ⭐ D106 (owner 10-30) · THE REAL LEVEL, AND ONE "SHOULD I APPLY" LINE PER POSTING.
//
// Pattern 1: "seniorised" entry-level roles — a junior TITLE over a mid-level ASK. The title is the employer's label;
// the asks are in the text: years of experience, system design, leading or mentoring others, a prior internship, an
// advanced degree. `readLevel` reads the asks → entry | early | mid | senior (null when the text asks nothing that
// says a level), with the reasons in plain words. `levelDisagreement` says it only when the two are two steps apart
// ("Titled Junior · asks for 3+ years and system design."). Pure and shared: the server stores the read
// (scraped_jobs.level_read, services/jobs/levelRead.js), the card and the posting panel say it.
//
// `applyLine` is P2: ONE plain sentence from the ATS band, D104's eligibility, D107's liveness and this level —
// e.g. "Good match · you're eligible · posted 3 days ago, first time." or "Skip: U.S. citizens only." It is allowed
// to say skip. ⛔ Information, never a block — and it never reads or changes the ATS number (d106AtsUnchanged).

import { levelFromTitle } from "./levelMapping.js";
import { atsBandFor, ATS_BAND } from "./atsBands.js";

export const LEVELS_READ = Object.freeze(["entry", "early", "mid", "senior"]);
const RANK = { entry: 0, early: 1, mid: 2, senior: 3 };
// The title's level on the same scale. intern / entry → 0; lead / executive are senior-or-above for this purpose.
const TITLE_RANK = { intern: 0, entry: 0, mid: 2, senior: 3, lead: 3, executive: 3 };

const YEARS_RE = /\b(\d{1,2})\s*(\+|[-–]\s*\d{1,2}|to\s+\d{1,2})?\s*\+?\s*(?:years?|yrs?)['’]?\s+(?:of\s+)?(?:[\w/-]+\s+){0,4}?(?:experience|exp\b)/gi;

/** The smallest number of years the text asks for ("3+ years, 5 preferred" → 3), or null. */
export function minYearsAsked(text) {
  let min = null;
  for (const m of String(text ?? "").slice(0, 20000).matchAll(YEARS_RE)) {
    const n = Number(m[1]);
    if (n > 25) continue;
    if (min == null || n < min) min = n;
  }
  return min;
}

const yearsLevel = (n) => (n <= 1 ? "entry" : n <= 2 ? "early" : n <= 4 ? "mid" : "senior");

// Each ask, the level it implies at least, and how it is said. Read on the text with "preferred / nice to have /
// bonus" sentences REMOVED — a preferred ask is not an ask.
const ASKS = [
  { key: "system_design", level: "mid", said: "system design",
    re: /\b(system|systems|distributed[- ]systems?)\s+design\b|\bdesign(ing)?\s+(large[- ]scale|scalable|distributed)\s+systems\b/i },
  { key: "leading", level: "mid", said: "leading or mentoring others",
    re: /\b(mentor(ing)?|lead(ing)?)\s+(junior|other|a\s+team\s+of|teams?\s+of|engineers|developers)\b|\btechnical\s+leadership\b|\bexperience\s+(as\s+a\s+)?(tech|team)\s+lead\b/i },
  { key: "internship", level: "early", said: "a prior internship",
    re: /\b(prior|previous|completed|at\s+least\s+one|one\s+or\s+more)\s+(software\s+|engineering\s+|relevant\s+)?internships?\b|\binternship\s+experience\s+(is\s+)?required\b/i },
  { key: "advanced_degree", level: "early", said: "an advanced degree",
    re: /\b(master'?s|m\.?s\.?|ph\.?d\.?|doctorate)\b[^.\n]{0,60}\brequired\b|\brequires?\s+(a\s+)?(master'?s|ph\.?d\.?|doctorate)\b/i },
];

const PREFERRED_SENTENCE = /[^.\n]*\b(preferred|nice[- ]to[- ]have|a\s+plus|bonus|ideally|desired)\b[^.\n]*[.\n]?/gi;

/**
 * The level the posting's text ASKS for.
 * @returns {{ level: string|null, reasons: string[], years: number|null }}
 */
export function readLevel(text) {
  const asked = String(text ?? "").slice(0, 20000).replace(PREFERRED_SENTENCE, " ");
  const reasons = [];
  let rank = -1;
  const years = minYearsAsked(asked);
  if (years != null) {
    rank = Math.max(rank, RANK[yearsLevel(years)]);
    if (years >= 1) reasons.push(`${years}+ year${years === 1 ? "" : "s"}`);
  }
  for (const a of ASKS) {
    if (a.re.test(asked)) { reasons.push(a.said); rank = Math.max(rank, RANK[a.level]); }
  }
  if (years === 0 && rank <= 0) rank = 0;
  return { level: rank < 0 ? null : LEVELS_READ[rank], reasons, years };
}

/** The word in the title that names its level ("Junior", "New Grad", "Senior"), for the sentence. */
function titleWord(title) {
  const m = String(title ?? "").match(/\b(junior|jr\.?|entry[- ]level|new\s+grad(?:uate)?|graduate|early[- ]career|associate|intern(?:ship)?|senior|sr\.?|staff|principal|lead)\b/i);
  if (!m) return null;
  const w = m[1].replace(/\.$/, "");
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

/**
 * "Titled Junior · asks for 3+ years and system design." — only when the title's level and the read are two steps
 * apart (Junior vs 2 years is not news; Junior vs 3+ years is). null otherwise.
 */
export function levelDisagreement(title, read) {
  const t = levelFromTitle(title);
  if (!t || !read?.level || TITLE_RANK[t] == null) return null;
  const diff = RANK[read.level] - TITLE_RANK[t];
  if (Math.abs(diff) < 2) return null;
  const word = titleWord(title) || t.charAt(0).toUpperCase() + t.slice(1);
  if (diff > 0) {
    const r = read.reasons.slice(0, 3);
    const list = r.length > 1 ? `${r.slice(0, -1).join(", ")} and ${r[r.length - 1]}` : r[0];
    return { direction: "asks_more", text: `Titled ${word} · asks for ${list}.` };
  }
  const asked = read.years ? `${read.years}+ year${read.years === 1 ? "" : "s"}` : "no prior experience";
  return { direction: "asks_less", text: `Titled ${word} · asks for ${asked}.` };
}

/** A user's level from their profile — the ranks above, or null. */
export function userLevelRank(level) { return level in RANK ? RANK[level] : null; }

/**
 * ⭐ D106 P2 · the one line. Inputs are what the card already has: the match score (as shown), D104's eligibility,
 * D107's liveness, and the stored level read with its disagreement. Never reads more than it is given.
 */
export function applyLine({ score = null, eligibility = null, liveness = null, level = null } = {}) {
  if (eligibility?.status === "ineligible") {
    const r = Array.isArray(eligibility.reasons) && eligibility.reasons[0];
    return { verdict: "skip", text: `Skip: ${r || "a stated requirement rules you out"}.` };
  }
  const parts = [];
  const band = atsBandFor(Number.isFinite(score) ? score : null);
  if (band === ATS_BAND.STRONG) parts.push("Good match");
  else if (band === ATS_BAND.MODERATE) parts.push("Partial match");
  else if (band === ATS_BAND.WEAK) parts.push("Weak match");
  if (eligibility?.status === "eligible") parts.push("you're eligible");
  if (level?.disagreement?.direction === "asks_more") parts.push(`asks more than its title (${level.disagreement.text.replace(/^Titled [^·]+· asks for /, "").replace(/\.$/, "")})`);
  if (liveness) {
    if (liveness.kind === "reposted") parts.push(liveness.label.charAt(0).toLowerCase() + liveness.label.slice(1));
    else if (liveness.kind === "open_long") parts.push(`open ${liveness.openDays} days`);
    else if (liveness.reposts === 0) parts.push(liveness.openDays <= 1 ? "posted in the last day, first time" : `posted ${liveness.openDays} days ago, first time`);
  }
  if (!parts.length) return null;
  const staleish = liveness && (liveness.kind === "reposted" && liveness.reposts >= 3);
  const verdict = band === ATS_BAND.WEAK || staleish ? "doubtful" : band === ATS_BAND.STRONG ? "apply" : "maybe";
  const text = parts.join(" · ");
  return { verdict, text: text.charAt(0).toUpperCase() + text.slice(1) + "." };
}
