// shared/atlasCommonPhrases.js — ⭐ BUG 10-31 (boilerplate counts as skills) · THE ONE LIST of common job-posting
// phrases inside which an Atlas CONCEPT is never matched or linked.
//
// "Attention" (D115's concept — the transformer mechanism) was counted and linked inside "attention to detail" in
// 115 postings of the local board. A concept is a single technical word that English also uses; inside one of these
// phrases it is the English word. Read by the ONE matcher (services/atlas/postingMatcher.js: the board's counts, Your
// map, the role maps, D114's linkable terms) and by D114's span finder (shared/atlasLinks.js), so a phrase added here
// stops both the count and the link.
//
// ⛔ Only phrases, never a single word: a single word here would silence the concept everywhere.
// Matching ignores case, and a hyphen and a space are the same ("data-driven" = "data driven").

export const COMMON_PHRASES = Object.freeze([
  "attention to detail",
  "attention to details",
  // "attention to tolerances / craft / performance": measured 10-31 on the local board, after "attention to detail"
  // the concept still counted in 21 postings and every one outside ML was "attention to …". The transformer's
  // attention is never "attention to"; it is "attention", "self-attention", "Flash Attention", "attention mechanism".
  "attention to",
  "pay attention",
  "draw attention",
  "earn attention",
  "executive attention",
  "detail oriented",
  "detail-oriented",
  "data-driven",
  "data-informed",
  "fast-paced",
  "fast-moving",
  "self-starter",
  "self-motivated",
  "results-driven",
  "results-oriented",
  "mission-driven",
  "customer-obsessed",
  "customer-centric",
  "cross-functional",
  "high-impact",
  "high-quality",
  "first-principles",
  "growth mindset",
  "bias for action",
  "sense of ownership",
  "sense of urgency",
  "problem-solving skills",
  "communication skills",
  "interpersonal skills",
  "team player",
  "hit the ground running",
  "wear many hats",
  "move fast",
  "work-life balance",
  "equal opportunity",
  "equal employment opportunity",
  "reasonable accommodation",
  "reasonable accommodations",
]);

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** One regex for every phrase — whole words, any case, a hyphen or spaces between words. Longest first. */
export const COMMON_PHRASE_RE = new RegExp(
  `(?<![A-Za-z0-9])(?:${[...COMMON_PHRASES].sort((a, b) => b.length - a.length)
    .map(p => p.split(/[\s-]+/).map(escape).join("[\\s\\-‐‑]+")).join("|")})(?![A-Za-z0-9])`,
  "gi",
);

/** The [start, end) spans of every common phrase in `text`. */
export function commonPhraseSpans(text) {
  const s = String(text ?? "");
  const out = [];
  for (const m of s.matchAll(COMMON_PHRASE_RE)) out.push([m.index, m.index + m[0].length]);
  return out;
}

/** The text with every common phrase blanked to spaces (same length, so offsets still hold). */
export function maskCommonPhrases(text) {
  return String(text ?? "").replace(COMMON_PHRASE_RE, (m) => " ".repeat(m.length));
}
