/**
 * Company KB — resume failsafe gate (Task 9.6).
 *
 * Validates a GENERATED resume's claims (companies + teams/orgs + stacks) against the company
 * KB (org layer: company_org_units from Task 9.5; stack layer: company_technographics from
 * Task 5) and returns findings for the user to review. FLAGS, NEVER FABRICATES: this module
 * never rewrites a claim, never auto-changes the resume, and never writes back to the KB — the
 * KB is company/postings ground truth; the resume is the thing being checked, one-directionally.
 * It also never reads base_resume/user_profile/simple_apply_profile to VALIDATE against (only
 * the already-generated html being checked, which is expected input, not a KB write).
 *
 * Extraction reuses services/resumeFormatter.js's buildStructuredResume() — the SAME parser
 * normalizeResumeHtml() already runs on every generated resume — rather than a new HTML
 * scraper or a second LLM call. Org-unit comparison reuses services/kb/orgLayer.js's
 * normalizeOrgUnitKey so a claim and a real unit are compared with the exact same
 * normalization the KB itself uses to cluster postings.
 */

import { buildStructuredResume } from '../resumeFormatter.js';
import { normalizeOrgUnitKey } from './orgLayer.js';
import fs from 'node:fs';
import path from 'node:path';
import { REGISTRY_DIR } from '@draft/ats-scorer';

// A confirmed unit, or a proposed one with reasonable evidence, counts as "real" for checking
// purposes — a barely-proposed unit (thin evidence) must never be used to flag/suggest against,
// per "Low KB confidence or no KB for that company -> NO finding."
const MIN_CONFIDENCE_TO_CHECK_AGAINST = 0.5;

// Token-overlap (Jaccard, over normalizeOrgUnitKey's word sets) thresholds for the org-unit
// comparison — documented, tunable:
//   === 1              exact match -> no finding (corroborated)
//   >= SUGGEST_FIX_MIN_OVERLAP, < 1 -> suggest_fix (garbled articulation of a real unit)
//   <  SUGGEST_FIX_MIN_OVERLAP      -> flag (no real unit resembles this claim)
const SUGGEST_FIX_MIN_OVERLAP = 0.4;

/**
 * How similar the nearest KB unit must be before the flag is willing to NAME it (AH4).
 *
 * The flag used to name `best.org_unit` whatever it scored, and best is chosen by `score >
 * bestScore` starting at -1 — so when every candidate ties at zero, the FIRST unit iterated wins.
 * Measured against Stripe's real KB (14 units clear the confidence gate): "Bangalore",
 * "San Francisco", "Remote" and "Quantum Basket Weaving" all scored EXACTLY 0.000 and all four
 * were reported as closest to the same arbitrary unit. That is not a threshold set too low; it is
 * a suggestion with no similarity behind it at all, and a suggestion no human would make costs
 * trust in every other finding on the page.
 *
 * A genuinely informative near-miss clears this easily: "Payments Infrastructure" against
 * "Payments" scores 0.500. Below the floor the finding still fires — the claim really does not
 * match anything — it just stops inventing a nearest neighbour to name.
 */
const NAME_CLOSEST_MIN_SIMILARITY = 0.2;

const SENIORITY_WORDS = new Set([
  'senior', 'sr', 'junior', 'jr', 'staff', 'principal', 'lead', 'entry', 'associate',
  'ii', 'iii', 'iv', 'i',
]);

/**
 * PLACES ARE NOT TEAMS (AH4).
 *
 * The observed false flag: "Stripe | Payments Infrastructure, Bangalore" produced
 * `'Bangalore' doesn't match any team we've seen in Stripe's job postings`. Bangalore is the
 * LOCATION. extractTeamClaim took the last comma-separated segment, and in the overwhelmingly
 * common "Title, Team, Location" and "Title, Location" shapes the last segment is where the place
 * lives — so the check was systematically aimed at the one part of the line that could never be a
 * team. Worse, in the three-part shape the REAL team was never checked at all, because the
 * location shadowed it.
 *
 * This is the costly error the KB rules name explicitly: a false "this doesn't match" against a
 * claim that is TRUE. The candidate did work in Bangalore.
 *
 * The vocabulary is READ FROM THE DATA WE ALREADY HAVE rather than hand-listed: every distinct
 * scraped_jobs.location, split on the separators those values use. On this corpus that is 147
 * distinct parts from 1,291 postings, and it already contains "bangalore", "bengaluru",
 * "san francisco", "dublin", "singapore" and the rest. A hand-written city list would be a second
 * source of truth that goes stale the first time the board learns a new market.
 *
 * SHAPES cover the tail the corpus cannot: workplace types (scraped_jobs.workplace_type is
 * remote/hybrid/onsite), the "Remote - X" and "US-X" prefixes those values use, and bare
 * two-letter state or country codes.
 */
const WORKPLACE_TYPE_WORDS = new Set(['remote', 'hybrid', 'onsite', 'on site', 'in office', 'in person']);

// ⛔ A REGION IN FRONT OF A BUSINESS FUNCTION IS A TEAM, NOT A PLACE (AL4/G4 requirement 2).
//
// The first version of the region rule was /^(us|usa|uk|emea|apac|…)\b/i — "starts with a region
// word" — and it classified `EMEA Marketing`, `APAC Sales` and `UK Enterprise sales team` as
// locations. Those are real Stripe and Figma org units, sitting in company_org_units right now.
// Ten of the 697 stored units matched the old shapes.
//
// The consequence ran the OPPOSITE way to the Bangalore bug and was quieter: extractTeamClaim
// strips trailing segments it thinks are places, so a résumé claiming "Stripe | EMEA Marketing"
// had its team claim silently DELETED and was never checked at all. Bangalore produced a wrong
// finding; this produced no finding, which nothing on any screen can show.
//
// So the region must be the WHOLE segment, or be followed only by another place-ish word
// ("US - Remote", "EMEA HQ"), never by a function word.
const REGION_WORDS = "us|usa|uk|emea|apac|amer|latam|na|eu|anz|mena";
const LOCATION_SHAPES = [
  /^(remote|hybrid|onsite|on-?site|in-?office|in-?person)\b/i,
  /\b(remote|hybrid|onsite)$/i,
  new RegExp(`^(${REGION_WORDS})$`, "i"),
  new RegExp(`^(${REGION_WORDS})[\\s-]+(remote|hybrid|onsite|office|hq|headquarters|region|wide)$`, "i"),
];

// A bare state or country code — CA, NY, UK, IN. Checked against the RAW segment ONLY, never the
// normalised org key: normalizeOrgUnitKey strips a trailing "team"/"org"/"group", so "AI team"
// becomes "ai" and a key-level check reads a real org unit as a country code. Figma's "AI team" is
// in company_org_units and was being classified as a place for exactly that reason.
const BARE_CODE_SHAPE = /^[a-z]{2}$/i;

// ⛔ THE FLOOR, AND WHY IT EXISTS DESPITE THE ARGUMENT ABOVE AGAINST HAND-LISTS.
//
// The comment above says a hand-written city list "would be a second source of truth that goes
// stale the first time the board learns a new market". That reasoning was right, and it silently
// assumed the board would CONTINUE TO EXIST.
//
// It does not. `cleanup_log` id 85 deleted 1288 postings on 2026-09-02, and the distinct-location
// vocabulary fell from **235 to 4**. Measured on the live database afterwards:
//
//     looksLikeLocation(db, "Bangalore")  ->  false
//
// AH4's fix — verified, tested, and correct when it shipped — had regressed to nothing, with no
// error, no warning and no failing test, because its evidence was a table a retention job is free
// to empty. A guard derived entirely from mutable data is a guard that can be deleted by a cron.
//
// So the corpus stays the PRIMARY source and this is a FLOOR beneath it, not a replacement: a
// short list of the places this board has actually hired in, which cannot be purged. It is unioned,
// never substituted, so a new market the corpus learns still works exactly as before.
const SEED_LOCATIONS = new Set([
  'bangalore', 'bengaluru', 'hyderabad', 'pune', 'mumbai', 'delhi', 'gurgaon', 'noida', 'chennai',
  'san francisco', 'new york', 'nyc', 'seattle', 'austin', 'boston', 'chicago', 'denver', 'atlanta',
  'los angeles', 'san jose', 'palo alto', 'mountain view', 'sunnyvale', 'san diego', 'portland',
  'london', 'dublin', 'berlin', 'paris', 'amsterdam', 'madrid', 'barcelona', 'lisbon', 'zurich',
  'stockholm', 'warsaw', 'krakow', 'bucharest', 'tel aviv', 'singapore', 'tokyo', 'sydney',
  'melbourne', 'toronto', 'vancouver', 'montreal', 'mexico city', 'sao paulo', 'buenos aires',
  'dubai', 'bengaluru india', 'united states', 'india', 'ireland', 'germany', 'canada',
]);

/** Below this, the corpus is not supplying a usable vocabulary and the floor is doing the work. */
const MIN_CORPUS_LOCATIONS = 25;

let _locationVocabulary = null;
let _warnedThinVocabulary = false;
function locationVocabulary(db) {
  if (_locationVocabulary) return _locationVocabulary;
  const vocab = new Set(SEED_LOCATIONS);
  try {
    const rows = db.prepare(
      `SELECT DISTINCT location FROM scraped_jobs WHERE location IS NOT NULL AND TRIM(location) <> ''`
    ).all();
    for (const row of rows) {
      // The same separators the stored values use: "CA • New York", "US - Remote", "Dublin, Ireland".
      for (const part of String(row.location).split(/[,;/|•]|\s+-\s+|\bor\b|\band\b/i)) {
        const key = normalizeOrgUnitKey(part);
        // Single letters and empty fragments would match everything; two characters is the
        // shortest a real place name gets ("NY" is handled by LOCATION_SHAPES anyway).
        if (key && key.length >= 3) vocab.add(key);
      }
    }
  } catch { /* no scraped_jobs, or a schema without location — the shapes still apply */ }

  // LOUD WHEN THE CORPUS STOPS CONTRIBUTING. The regression above was invisible precisely because
  // an empty vocabulary and a healthy one look identical from the call site — both just return
  // false for a city nobody listed. Once per process, so a background pass cannot bury the log.
  const fromCorpus = vocab.size - SEED_LOCATIONS.size;
  if (fromCorpus < MIN_CORPUS_LOCATIONS && !_warnedThinVocabulary) {
    _warnedThinVocabulary = true;
    console.warn(
      `[failsafe] the location vocabulary drew only ${fromCorpus} entries from scraped_jobs ` +
      `(expected 200+). The board has probably been purged by retention — see cleanup_log. ` +
      `Place detection is running on the built-in floor alone, so a location outside it will be ` +
      `read as a team name and produce a false "doesn't match any team" finding.`
    );
  }

  _locationVocabulary = vocab;
  return vocab;
}

/** Test seam — the vocabulary is memoised, and a test that swaps databases needs it rebuilt. */
function resetLocationVocabulary() { _locationVocabulary = null; _warnedThinVocabulary = false; }

/** One place, with no conjunction in it: a workplace type, a corpus location, or a location shape. */
function isLocationAtom(db, key) {
  if (!key) return false;
  return WORKPLACE_TYPE_WORDS.has(key)
    || locationVocabulary(db).has(key)
    || LOCATION_SHAPES.some(re => re.test(key));
}

function looksLikeLocation(db, segment) {
  const raw = String(segment || '').trim();
  const key = normalizeOrgUnitKey(segment);
  if (!key) return false;
  // Shapes are checked against the RAW segment too, because "US - Remote" loses its hyphen to
  // normalisation and the prefix rule is written against what the feeds actually store.
  if (LOCATION_SHAPES.some(re => re.test(raw))) return true;
  // RAW ONLY — see the note at BARE_CODE_SHAPE. "AI team" normalises to "ai" and would otherwise
  // read as a country code.
  if (BARE_CODE_SHAPE.test(raw)) return true;

  // A CONJUNCTION OF PLACES IS STILL A PLACE, and a dangling conjunction is a fragment of one.
  // The board stores "London OR Dublin", "Chicago and NYC", "San Francisco or Seattle" — 16 of the
  // 145 distinct location strings in this corpus are alternatives like that, and after the first
  // pass of this fix all 16 were still being flagged as teams because the vocabulary holds
  // "london" and "dublin" separately and never the phrase.
  //
  // EVERY part must be a place. "Payments or Risk" is two teams, and this must not swallow it.
  // A single part is the ordinary case and falls out of the same rule.
  const parts = key.split(/\b(?:or|and)\b/).map(s => s.trim()).filter(Boolean);
  return parts.length > 0 && parts.every(part => isLocationAtom(db, part));
}

function stripSeniority(text) {
  return String(text || '')
    .split(/\s+/)
    .filter(w => !SENIORITY_WORDS.has(w.toLowerCase().replace(/[.,]/g, '')))
    .join(' ')
    .trim();
}

// Derives a team/org claim from an EXPERIENCE entry's role/meta text — the common
// "Senior Engineer, Payments Platform" or "Senior Engineer — Payments Platform" shape. The
// LAST comma/dash-separated segment is the team/org candidate (the title comes first);
// entries with no such separator make no team claim at all (nothing to check — silent).
function extractTeamClaim(entry, db = null) {
  const candidates = [entry?.role, entry?.meta].filter(Boolean);
  for (const text of candidates) {
    let parts = String(text).split(/,| — | – | - /).map(s => s.trim()).filter(Boolean);
    // AH4: drop trailing places before choosing the team. "Title, Team, Location" leaves the team;
    // "Title, Location" leaves only the title, which is NOT a team claim and must produce no
    // finding at all. Only TRAILING segments are dropped — a unit legitimately named after a place
    // ("Bangalore Finance" is a real Stripe org unit) is not at the end and survives.
    if (db) {
      while (parts.length && looksLikeLocation(db, parts[parts.length - 1])) parts = parts.slice(0, -1);
    }
    if (parts.length >= 2) {
      const claim = stripSeniority(parts[parts.length - 1]);
      if (claim && claim.split(/\s+/).length <= 6) return claim;
    }
  }
  return null;
}

function extractStackClaim(entry) {
  if (!entry?.tech) return [];
  return String(entry.tech).split(/,|\||\/|;/).map(s => s.trim()).filter(Boolean);
}

function jaccardOverlap(a, b) {
  const setA = new Set(String(a || '').split(' ').filter(Boolean));
  const setB = new Set(String(b || '').split(' ').filter(Boolean));
  if (!setA.size || !setB.size) return 0;
  let intersection = 0;
  for (const w of setA) if (setB.has(w)) intersection++;
  const union = new Set([...setA, ...setB]).size;
  return union ? intersection / union : 0;
}

function levenshteinDistance(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const row = [i];
    for (let j = 1; j <= n; j++) {
      row[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j - 1], prev[j], row[j - 1]);
    }
    prev = row;
  }
  return prev[n];
}

// Character-level similarity (1 - normalized edit distance) — catches TYPO-level garbling
// ("Platfrom" vs "Platform") that word-set Jaccard misses entirely, since a single-character
// typo makes two words compare as completely non-overlapping at the word level.
function levenshteinSimilarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (!maxLen) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

// A typo is a HIGH character-similarity event. Below this, a character-level score between two
// phrases that share no word at all is coincidence of length and alphabet, not a garbled
// articulation of anything: against Stripe's real KB, "Quantum Basket Weaving" scored 0.409 on
// characters alone (Jaccard 0) against "Growth Marketing" and cleared SUGGEST_FIX_MIN_OVERLAP,
// so an invented team was reported to a recruiter as "may be an imprecise reference to" a real
// one. The more units a company has, the more likely some pair collides by chance — which is why
// this only surfaced once the KB held 271 units for Stripe instead of none.
const TYPO_MIN_CHAR_SIMILARITY = 0.8;

// Combined similarity: word-set overlap catches phrase-level differences (reordering, a
// subset/superset of words); character-level similarity catches typo-level differences within
// otherwise-matching words. A real "garbled articulation" of a KB unit can be either kind, so
// the claim is compared against each candidate both ways and the higher score wins — but the
// character-level signal only counts when it is strong enough to actually mean "typo".
function similarity(a, b) {
  const chars = levenshteinSimilarity(a, b);
  return Math.max(jaccardOverlap(a, b), chars >= TYPO_MIN_CHAR_SIMILARITY ? chars : 0);
}

// Stack claims NEVER produce a standalone finding (see the plan's design decision #3) — only
// supplementary evidence attached to an org-unit finding that already fired for the same
// entry. A false "this doesn't match" is the costly error the task explicitly warns against,
// and stack data is far more prone to false positives (past roles, legitimately rare tools)
// than "does this team name exist" is.
function checkStackOverlap(db, company, stackClaim) {
  if (!stackClaim.length) return null;
  const rows = db.prepare(`SELECT skill FROM company_technographics WHERE company = ?`).all(company);
  if (!rows.length) return null; // no KB stack data for this company — silent
  const knownSkills = new Set(rows.map(r => r.skill.toLowerCase()));
  const hasOverlap = stackClaim.some(s => knownSkills.has(s.toLowerCase()));
  if (hasOverlap) return null; // some overlap — nothing worth noting
  return `Claimed stack (${stackClaim.join(', ')}) has no overlap with ${company}'s known postings stack.`;
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} html - the generated resume's HTML (already-formatted, as returned to the client)
 * @returns {Array<object>} findings — [] when there is nothing to say (the default/common case,
 *   so most generations are visually unchanged on the client)
 */
function validateResumeClaims(db, html) {
  const findings = [];
  if (!html) return findings;

  let structure;
  try { structure = buildStructuredResume(html); } catch { return findings; }

  const experienceSection = structure.sections?.find(s => s.title === 'EXPERIENCE');
  const entries = experienceSection?.entries || [];

  const getUnitsStmt = db.prepare(`SELECT org_unit, confidence, status FROM company_org_units WHERE company = ?`);

  for (const entry of entries) {
    const company = entry.company?.trim();
    if (!company) continue;

    const teamClaim = extractTeamClaim(entry, db);
    if (!teamClaim) continue; // no team claim in this entry — nothing to check

    const claimKey = normalizeOrgUnitKey(teamClaim);
    if (!claimKey) continue;

    const units = getUnitsStmt.all(company)
      .filter(u => u.status === 'confirmed' || u.confidence >= MIN_CONFIDENCE_TO_CHECK_AGAINST);
    if (!units.length) continue; // no KB signal for this company — silent, never guess

    let best = null, bestScore = -1;
    for (const u of units) {
      const score = similarity(claimKey, normalizeOrgUnitKey(u.org_unit));
      if (score > bestScore) { best = u; bestScore = score; }
    }
    if (bestScore >= 0.999) continue; // exact (or near-float-equal) match — corroborated, no finding

    const stackClaim = extractStackClaim(entry);
    const stackNote = checkStackOverlap(db, company, stackClaim);
    const evidence = stackNote ? [stackNote] : [];

    if (bestScore >= SUGGEST_FIX_MIN_OVERLAP) {
      findings.push({
        type: 'suggest_fix',
        severity: 'info',
        company,
        message: `"${teamClaim}" looks like it may be an imprecise reference to ${company}'s "${best.org_unit}" team.`,
        diff: { from: teamClaim, to: best.org_unit },
        evidence,
      });
    } else {
      // AH4: name the nearest unit only when there IS one. Below the floor the best candidate is
      // whatever happened to be iterated first among a field of zeroes, and "(closest: X)" then
      // reads as a considered judgement about a pairing nothing connects.
      const named = bestScore >= NAME_CLOSEST_MIN_SIMILARITY ? ` (closest: "${best.org_unit}")` : '';
      findings.push({
        type: 'flag',
        severity: 'review',
        company,
        message: `"${teamClaim}" doesn't match any team we've seen in ${company}'s job postings${named}.`,
        evidence,
      });
    }
  }

  return findings;
}

/**
 * Recruiter surface (FE-6): does a CANDIDATE'S pasted resume cohere with a specific company's
 * KB? Reuses validateResumeClaims as-is — same extraction, same comparison, same
 * flag-vs-suggest_fix routing — just scoped to one company and framed as advisory (never a
 * verdict on the person; the KB is public company structure, not a background check).
 * Stateless: takes resumeText as a plain argument and returns a plain result — nothing is
 * persisted, no table is written, the text lives only for the duration of this call.
 * @param {import('better-sqlite3').Database} db
 * @param {string} company
 * @param {string} resumeText
 */
function checkCandidateConsistency(db, company, resumeText) {
  const findings = validateResumeClaims(db, resumeText).filter(f => f.company === company);

  let mentionsCompany = false;
  try {
    const structure = buildStructuredResume(resumeText);
    const entries = structure.sections?.find(s => s.title === 'EXPERIENCE')?.entries || [];
    mentionsCompany = entries.some(e => (e.company || '').trim().toLowerCase() === company.toLowerCase());
  } catch { /* malformed input — treat as no mention, findings (already []) still returned */ }

  const status = !mentionsCompany ? 'no_claim' : findings.length ? 'flagged' : 'consistent';
  return { company, status, findings };
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// K1 — THE KB SANITY CHECK ON GENERATED OUTPUT (RECRUITER_LAYER_EXECUTION.md §K1)
// ════════════════════════════════════════════════════════════════════════════════════════════════
//
// ⛔ DECOUPLED BY DECISION (OWNER 30, 09-30). Nothing in the generation path calls this. It runs
// on its own — scripts/k1KbSanityCheck.mjs — so it and generation can each be tested before anyone
// decides to wire them together. validateResumeClaims above IS on the generation path and is
// deliberately left exactly as it was: changing it would wire K1 in by the back door.
//
// It EXTENDS this module rather than standing beside it: the same structured extraction
// (buildStructuredResume), the same org-unit key (normalizeOrgUnitKey), the same place detection
// (looksLikeLocation — the Bangalore fix), and the same rule: it FLAGS, never rewrites, never
// blocks, and never writes anything back to the KB.
//
// WHY IT ASKS THE SOURCE AS WELL AS THE KB — measured 09-30, and the reason the obvious design fails
// in BOTH directions:
//  · The G1 fabrications are company-PLAUSIBLE. Stripe's own postings mention Kafka (12) and it has
//    Risk units ("Risk Operations", "Payments and Risk"). "Kafka at Stripe" and "worked with the
//    risk team at Stripe" are TRUE as company facts. A KB-only check cannot flag them, ever.
//  · A KB-only ABSENCE check flags the owner's TRUE résumé. Stripe's KB has no "GCP Pub/Sub" and no
//    "Software Development Engineer" title, and the owner really used one and really held the other.
//    That is the Bangalore error again: a false "does not match" against a true claim.
// So a finding needs BOTH: a company-shaped claim (a team, or a technology the KB knows the company
// uses) at a named employer, AND a source résumé that does not support it. The KB's part is to
// recognise the claim as a company fact and say whether it is plausible there. The source's part is
// to say whether it is the candidate's. A claim the source supports is never flagged, whatever the
// KB says — that is what protects the true claim.
//
// ⛔ WHAT IT CANNOT CATCH — K1_CANNOT_CATCH below, carried on every result so no caller can show
// the findings without the limits.

/** Words that make a team mention generic rather than a claim about a company's structure. */
const GENERIC_TEAM_WORDS = new Set([
  'cross', 'functional', 'cross-functional', 'product', 'engineering', 'engineers', 'partner',
  'partners', 'stakeholder', 'stakeholders', 'internal', 'external', 'other', 'multiple', 'several',
  'downstream', 'upstream', 'client', 'clients', 'customer', 'customers', 'business', 'global',
  'the', 'our', 'my', 'their', 'adjacent', 'peer', 'sister', 'dev', 'development', 'technical',
  'tech', 'leadership', 'executive', 'senior', 'various', 'distributed', 'remote', 'agile',
  'scrum', 'core', 'local', 'regional', 'wider', 'broader', 'larger', 'small', 'large', 'team',
]);

// "with risk and infrastructure teams", "coordinating with the risk team", "alongside
// infrastructure engineers". Up to four words before the noun, then split on and / , / &.
const TEAM_MENTION_RE = /\b(?:with|across|alongside|between|for|from|into|on|to|and)\s+((?:[a-z][\w&/-]*\s+){0,3}?[a-z][\w&/-]*)\s+(?:teams?|engineers|org|organi[sz]ations?|groups?|squads?)\b/gi;

/** Lowercase words, a trailing plural dropped — "payments" is supported by "payment". */
function wordsOf(text) {
  return String(text || '').toLowerCase().split(/[^a-z0-9+#]+/).filter(Boolean)
    .map(w => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w));
}

function sourceSupports(sourceWords, phrase) {
  const words = wordsOf(phrase);
  return words.length > 0 && words.every(w => sourceWords.has(w));
}

/** The team mentions in one entry: its meta line (title already in `role`) and its bullets. */
function teamMentions(db, entry) {
  const found = new Map(); // key -> display
  const add = (raw) => {
    const words = String(raw || '').split(/\s+/).filter(Boolean)
      .filter(w => !GENERIC_TEAM_WORDS.has(w.toLowerCase()));
    const display = words.join(' ').trim();
    const key = normalizeOrgUnitKey(display);
    if (key && !looksLikeLocation(db, display) && !found.has(key)) found.set(key, display);
  };
  // The meta line, which the model uses for "Team, Location" once the title is in entry-role. The
  // place is dropped first, exactly as extractTeamClaim does — Bangalore is where, not who.
  // A TEXT résumé has no meta: "Stripe — Software Development Engineer / Payments Infrastructure,
  // Bangalore" parses with the team line in `role`. Read it there when it is separator-shaped, or
  // the owner's own résumé checks zero teams and its clean result means nothing. Every candidate is
  // still only raised when the source does not support it, so reading more of them costs no precision.
  const teamLine = entry?.role && entry?.meta ? entry.meta
    : (!entry?.meta && /,| — | – | - |\|/.test(entry?.role || '') ? entry.role : null);
  if (teamLine) {
    let parts = String(teamLine).split(/,| — | – | - |\|/).map(s => s.trim()).filter(Boolean);
    while (parts.length && looksLikeLocation(db, parts[parts.length - 1])) parts = parts.slice(0, -1);
    for (const p of parts) if (p.split(/\s+/).length <= 5) add(p);
  }
  for (const text of [...(entry?.bullets || []), entry?.text || '']) {
    for (const m of String(text).matchAll(TEAM_MENTION_RE)) {
      for (const piece of m[1].split(/\s*(?:,|\band\b|&)\s*/i)) add(piece);
    }
  }
  return [...found].map(([key, display]) => ({ key, display }));
}

/**
 * The TOOLS vocabulary — the registry's `tools` lists only, never its `keywords`.
 *
 * company_technographics is not a list of technologies. Stripe's rows include "financial
 * reporting", "payment processing", "APIs" and "infrastructure", and the first run of this check
 * flagged all four as technologies on the G1 document. A finding that calls "financial reporting"
 * a technology the candidate never mentioned is noise that teaches the reader to stop reading. So
 * a technographics row counts only when the registry ALSO calls it a tool (172 of them: Kafka, Go,
 * PostgreSQL, Redis, Excel, Salesforce…).
 */
let _tools = null;
function toolVocabulary() {
  if (_tools) return _tools;
  _tools = new Set();
  try {
    const registry = JSON.parse(fs.readFileSync(path.join(REGISTRY_DIR, 'DOMAIN_METADATA_REGISTRY.json'), 'utf8'));
    for (const domain of Object.values(registry || {})) {
      for (const t of domain?.tools || []) _tools.add(String(t).trim().toLowerCase());
    }
  } catch { /* no registry: no technology findings at all — the narrow failure, not the noisy one */ }
  return _tools;
}

/** KB-known technologies of this company that appear inside this entry. */
function entryTechnologies(entry, companySkills) {
  const tools = toolVocabulary();
  const text = [entry?.role, entry?.meta, entry?.tech, entry?.text, ...(entry?.bullets || [])].join(' \n ');
  const hits = new Map();
  for (const skill of companySkills) {
    const s = String(skill.skill || '').trim();
    if (s.length < 2 || !tools.has(s.toLowerCase())) continue;
    const esc = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Short names ("Go", "R", "C#") are case-SENSITIVE — "go to market" is not the language.
    const re = new RegExp(`(^|[^A-Za-z0-9+#])${esc}(?=$|[^A-Za-z0-9+#])`, s.length <= 3 ? '' : 'i');
    if (re.test(text) && !hits.has(s.toLowerCase())) hits.set(s.toLowerCase(), skill);
  }
  return [...hits.values()];
}

const K1_CANNOT_CATCH = Object.freeze([
  'anything in the skills section — a skills list is not a claim about a company ("Kafka" is not a company fact)',
  "a technology the employer's postings never mention — the KB cannot recognise it, and flagging on absence flags true résumés",
  'responsibilities, metrics and outcomes — none is a company fact',
  "title shape — it would flag true titles (measured on the owner's résumé)",
  'any employer the knowledge base does not hold',
  'a claim the source makes at a different employer — support is checked document-wide, on purpose',
]);

/**
 * K1. Run on its own: NOT called by generation (OWNER 30).
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} html  a generated résumé (HTML or text — the same parser as the failsafe)
 * @param {{ baseResumeText: string }} source  the résumé the generation was made FROM
 * @returns {{ findings: object[], checked: object, cannotCatch: readonly string[], declined?: string }}
 */
function kbSanityCheck(db, html, { baseResumeText = '' } = {}) {
  const result = {
    findings: [], checked: { entries: 0, entriesWithKb: 0, teams: 0, technologies: 0 }, cannotCatch: K1_CANNOT_CATCH,
  };
  if (!html) return result;
  // ⛔ No source, no verdict. Without the résumé the claims came from, every company-shaped claim
  // would look unsupported, and that is a page of false flags against a true résumé.
  if (!String(baseResumeText).trim()) { result.declined = 'no_source_resume'; return result; }

  let structure;
  try { structure = buildStructuredResume(html); } catch { return result; }
  const entries = structure.sections?.find(s => s.title === 'EXPERIENCE')?.entries || [];
  const sourceWords = new Set(wordsOf(baseResumeText));
  const unitsStmt = db.prepare(`SELECT org_unit, confidence, status FROM company_org_units WHERE company = ?`);
  const techStmt = db.prepare(`SELECT skill, posting_count FROM company_technographics WHERE company = ?`);

  for (const entry of entries) {
    result.checked.entries++;
    // A text résumé parses "Stripe — Software Development Engineer" as the company. The employer
    // is the leading segment; without this the owner's own résumé was checked against nothing and
    // "flagged nothing" vacuously — a pass that proves nothing about the false-positive direction.
    const raw = entry.company?.trim();
    if (!raw) continue;
    const company = [raw, raw.split(/\s+[—–-]\s+|\s*\|\s*|,\s*/)[0].trim()]
      .find(name => name && (unitsStmt.all(name).length || techStmt.all(name).length));
    if (!company) continue; // not a company the KB holds — silent
    const units = unitsStmt.all(company);
    const skills = techStmt.all(company);
    result.checked.entriesWithKb++;

    for (const team of teamMentions(db, entry)) {
      result.checked.teams++;
      if (sourceSupports(sourceWords, team.display)) continue; // the candidate said it — never flag
      // The KB's part: is there such a team at this company? ANY confidence counts here, because
      // this only decides how plausible the claim is, never whether to raise it.
      const teamWords = new Set(wordsOf(team.display));
      const similar = units
        .filter(u => wordsOf(u.org_unit).some(w => teamWords.has(w)))
        .sort((a, b) => b.confidence - a.confidence)[0];
      result.findings.push({
        type: 'unsupported_company_claim', kind: 'team', severity: 'review', company, claim: team.display,
        kb: similar ? { plausible: true, unit: similar.org_unit } : { plausible: false },
        message: similar
          ? `"${team.display}" at ${company} is not in your source résumé. ${company}'s postings do show a "${similar.org_unit}" team, so it is plausible — but the source does not say you worked with it.`
          : `"${team.display}" at ${company} is not in your source résumé, and no team like it appears in ${company}'s postings.`,
      });
    }

    for (const tech of entryTechnologies(entry, skills)) {
      result.checked.technologies++;
      if (sourceSupports(sourceWords, tech.skill)) continue;
      result.findings.push({
        type: 'unsupported_company_claim', kind: 'technology', severity: 'review', company, claim: tech.skill,
        kb: { plausible: true, postings: tech.posting_count },
        message: `${tech.skill} at ${company}: ${company}'s postings use it (${tech.posting_count}), but your source résumé never mentions it.`,
      });
    }
  }
  return result;
}

export {
  validateResumeClaims, checkCandidateConsistency, kbSanityCheck, K1_CANNOT_CATCH, extractTeamClaim, extractStackClaim,
  jaccardOverlap, levenshteinSimilarity, similarity,
  looksLikeLocation, resetLocationVocabulary, NAME_CLOSEST_MIN_SIMILARITY,
};
