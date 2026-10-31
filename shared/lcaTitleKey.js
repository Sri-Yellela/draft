// shared/lcaTitleKey.js — ⭐ D121 P2 · ONE TITLE FAMILY for an LCA's job title and a posting's title.
//
// "37 certified LCAs for Software Engineer titles in FY2025" needs the LCA file's JOB_TITLE ("SR. SOFTWARE ENGINEER II")
// and the board's title ("Senior Software Engineer, Payments") to land on one key. The key is the title lower-cased,
// its punctuation removed, a team / location tail after a comma, dash or parenthesis dropped, and its LEVEL words
// removed (seniority and grade: senior, sr, junior, staff, principal, lead, I–V, 1–5 …) — the level is what the
// prevailing-wage level says, not part of the family. Written by scripts/ingestLca.mjs, read by
// services/kb/sponsorshipSignal.js — the same function both sides, so they cannot drift.

const LEVEL_WORDS = new Set([
  "senior", "sr", "junior", "jr", "staff", "principal", "lead", "chief", "head", "associate", "assoc", "entry", "level",
  "mid", "intern", "graduate", "new", "grad", "distinguished", "fellow",
  "i", "ii", "iii", "iv", "v", "1", "2", "3", "4", "5",
]);

/** @returns {string|null} the family key ("software engineer"), or null when nothing is left. */
export function lcaTitleKey(title) {
  let t = String(title ?? "").toLowerCase();
  if (!t.trim()) return null;
  t = t.split(/\s[-–—|]\s|[,(/]/)[0];               // "Software Engineer, Payments" · "Engineer - Remote" · "(L4)"
  t = t.replace(/&/g, " and ").replace(/[^a-z0-9+#\s]/g, " ");
  const words = t.split(/\s+/).filter(w => w && !LEVEL_WORDS.has(w));
  const key = words.join(" ").slice(0, 60).trim();
  return key || null;
}
