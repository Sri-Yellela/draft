// services/jobs/boardSearch.js — THE BOARD'S SEARCH: ranked, local, whole-word (A72, owner 10-03).
//
// ⛔ WHAT IT REPLACED, MEASURED. The board searched with `title LIKE %q% OR company LIKE %q% OR
// description LIKE %q%` — a SUBSTRING filter that ranked nothing. "ai" matched 2,525 of 2,616
// active postings (96.5%: maint-AI-n, det-AI-ls, av-AI-lable), so searching for it changed
// nothing a user could see. Even the title alone matched 280, mostly "Maintenance" and "Retail".
//
// ⭐ THE OWNER'S RANKING, and the whole of it:
//   1  the title STARTS WITH the term
//   2  the title CONTAINS the term
//   3  another structured field holds it — the company, or a skill extracted at enrichment
//   4  only the description (or the enrichment summary, which is prose about the description)
//   ⛔ anything else is OMITTED — not ranked last, omitted.
// Within a tier: ATS match, descending (the board's fit keys — services/jobs/jobCursor.js).
//
// ⛔ WHOLE WORDS, ON NORMALISED TEXT. Both the term and every field are lower-cased and every run
// of characters outside [a-z0-9+#] becomes one space, then matched with spaces on both sides — so
// "ai" matches "AI", "AI/ML" and "(AI)", and never "maintain". "node.js" and "Node JS" are the
// same text. No regular expression is built from user input.
//
// ⭐ SYNONYMS, EQUAL WEIGHT, FROM THE ONE TABLE. ai ≡ artificial intelligence, ml ≡ machine
// learning (the owner's two, migration 123) come from `skill_synonyms` through
// loadConfirmedSynonyms — the map the scorer already reads since CC3. ⛔ There is no second
// synonym table here: a variant is a peer of the typed term, and a title starting with "Machine
// Learning" is tier 1 for "ml" exactly as "ML Engineer" is.
//
// "requirements": the owner named it as a structured field; no column holds requirements apart
// from the description, so it is searched there (tier 4). Said here rather than implied.
//
// THE COST. The tier is a SQL function so the database filters, orders and pages on it with the
// keyset cursor unchanged. Normalising every description is the expensive part (137 ms cold over
// 2,616 rows, measured); the normalised text is cached per job and re-made only when the row's
// stamp moves, so the count, the list and the cursor projection do not each pay it.

import { normaliseAtsTerm } from "../localAtsScorer.js";

export const SEARCH_TIER = Object.freeze({ TITLE_START: 1, TITLE: 2, STRUCTURED: 3, DESCRIPTION: 4 });

/** At most this many phrases per search: the term and its synonyms. */
const MAX_VARIANTS = 8;
/** Bound on the per-job normalised-text cache (entries, not bytes; ~11 MB at today's board). */
const CACHE_LIMIT = 20000;

/** ' word word ' — lower-case, [a-z0-9+#] runs only, padded so a phrase matches on word edges. */
export function normaliseSearchText(value) {
  const s = String(value ?? "").normalize("NFKC").toLowerCase().replace(/[^a-z0-9+#]+/g, " ").trim();
  return s ? ` ${s} ` : "";
}

/** The phrase form (unpadded) of a term, or "" when nothing searchable is left. */
const phrase = (value) => normaliseSearchText(value).trim();

/**
 * The phrases a search matches, the typed term FIRST, each with equal weight.
 *
 * @param term      what the user typed
 * @param synonyms  Map<normalisedTerm, string[]> — loadConfirmedSynonyms(db), the scorer's own map
 *
 * A synonym of the whole term is a variant ("ml" → "machine learning"); so is the term with one of
 * its words or phrases swapped for a synonym ("ml engineer" → "machine learning engineer").
 */
export function searchVariants(term, synonyms = null) {
  const base = phrase(term);
  if (!base) return [];
  const out = [base];
  const add = (v) => { const p = phrase(v); if (p && !out.includes(p) && out.length < MAX_VARIANTS) out.push(p); };
  if (synonyms instanceof Map && synonyms.size) {
    // The map's keys are the scorer's normalisation; look the whole term up that way first.
    for (const eq of synonyms.get(normaliseAtsTerm(term)) || []) add(eq);
    // Then a synonym for any whole-word part of a longer term.
    for (const [key, eqs] of synonyms) {
      const k = phrase(key);
      if (!k || k === base || !` ${base} `.includes(` ${k} `)) continue;
      for (const eq of eqs) add(` ${base} `.replace(` ${k} `, ` ${phrase(eq)} `));
    }
  }
  return out;
}

function skillNames(skillsJson) {
  if (!skillsJson) return [];
  try {
    const v = JSON.parse(skillsJson);
    if (!Array.isArray(v)) return [];
    return v.map(s => (typeof s === "string" ? s : s?.skill ?? s?.name ?? "")).filter(Boolean);
  } catch { return []; }
}

/**
 * The tier of one posting for these phrases — pure; the SQL function below is this plus a cache.
 * @returns 1 | 2 | 3 | 4 | null   (null = omitted)
 */
export function searchTier({ title, company, skillsJson, summary, description }, variants) {
  if (!variants?.length) return null;
  return tierOfRow(normaliseRow(title, company, skillsJson, summary, description), variants);
}

function normaliseRow(title, company, skillsJson, summary, description) {
  return {
    title: normaliseSearchText(title),
    company: normaliseSearchText(company),
    // Each skill on its own, so the end of one and the start of the next never make a phrase.
    skills: skillNames(skillsJson).map(normaliseSearchText),
    prose: normaliseSearchText(summary) + normaliseSearchText(description),
  };
}

// job_id → the row's fields, normalised once. Re-made when the stamp (updated_at and each field's
// length) moves, so an enriched or re-crawled posting is never matched stale. The function runs up
// to four times per row per request (the count, the filter, the order, the cursor projection), so
// without this each pass re-normalised every description — 1.0 s warm for "ai", measured.
const rowCache = new Map();
function cachedRow(jobId, stamp, title, company, skillsJson, summary, description) {
  const key = String(jobId);
  const len = (v) => String(v ?? "").length;
  const s = `${stamp ?? ""}|${len(title)}|${len(company)}|${len(skillsJson)}|${len(summary)}|${len(description)}`;
  const hit = rowCache.get(key);
  if (hit && hit.stamp === s) return hit;
  if (rowCache.size >= CACHE_LIMIT) rowCache.clear();
  const row = { stamp: s, ...normaliseRow(title, company, skillsJson, summary, description) };
  rowCache.set(key, row);
  return row;
}

/** THE tier rules — searchTier and the SQL function both come here. */
function tierOfRow(row, variants) {
  const w = variants.map(v => ` ${v} `);
  if (w.some(v => row.title.startsWith(v))) return SEARCH_TIER.TITLE_START;
  if (w.some(v => row.title.includes(v))) return SEARCH_TIER.TITLE;
  if (w.some(v => row.company.includes(v))) return SEARCH_TIER.STRUCTURED;
  if (row.skills.some(s => w.some(v => s.includes(v)))) return SEARCH_TIER.STRUCTURED;
  if (w.some(v => row.prose.includes(v))) return SEARCH_TIER.DESCRIPTION;
  return null;
}

export const SEARCH_TIER_FN = "draft_search_tier";

/** Register the tier function on a database handle. Idempotent per handle. */
const registered = new WeakSet();
export function registerBoardSearch(db) {
  if (registered.has(db)) return;
  let lastJson = null, lastVariants = null;   // one search per statement: parse its phrases once
  db.function(SEARCH_TIER_FN, { deterministic: true },
    (jobId, stamp, title, company, skillsJson, summary, description, variantsJson) => {
      if (variantsJson !== lastJson) {
        let v = null;
        try { v = JSON.parse(variantsJson); } catch { v = null; }
        lastJson = variantsJson;
        lastVariants = Array.isArray(v) && v.length && v.every(x => typeof x === "string" && x) ? v : null;
      }
      if (!lastVariants) return null;
      return tierOfRow(cachedRow(jobId, stamp, title, company, skillsJson, summary, description), lastVariants);
    });
  registered.add(db);
}

/**
 * The tier as a SQL expression over the board's `sj` alias, with its one bound parameter.
 * Used as the WHERE predicate (`IS NOT NULL` — the omission) and as the leading ORDER key.
 */
export function boardSearchSql(variants) {
  return {
    sql: `${SEARCH_TIER_FN}(sj.job_id, sj.updated_at, sj.title, sj.company, sj.skills_json, sj.summary, sj.description, ?)`,
    params: [JSON.stringify(variants)],
  };
}
