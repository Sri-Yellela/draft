// services/jobs/tagFilters.js — D29: the SQL every board filter uses to read the board's own tags.
//
// One place, so the list, the facets and the dials read the same expression (the rule jobQuery.js
// states for SKILLS_UNKNOWN_SQL: two copies of a predicate is how two readers come to disagree).
//
// ⛔ A ROW THAT HAS NEVER BEEN TAGGED READS ITS LEGACY COLUMN. `tag_basis IS NULL` means the tag pass
// (jobTags.js tagStaleJobs, at boot and every 10 minutes) has not reached it yet — a posting written
// seconds ago, or a database that predates migration 128. For those rows the old column is the only
// opinion there is, so it is used rather than reading every tag as NULL. Once a row is tagged the
// tag is authoritative, NULL included: a tagged NULL is the tagger saying "unknown" on purpose, and
// that must not fall back to experience_level's 'mid' fallback, which is what D29 exists to stop.
import { parsePlaceValue, METROS } from "../../shared/jobTagVocabulary.js";

export const TAGGED_SQL = "sj.tag_basis IS NOT NULL";
const tagOr = (tag, legacy) => `(CASE WHEN ${TAGGED_SQL} THEN ${tag} ELSE ${legacy} END)`;

export const LEVEL_SQL      = tagOr("sj.tag_level", "sj.experience_level");
export const WORKPLACE_SQL  = tagOr("sj.tag_workplace", "sj.workplace_type");
export const EMPLOYMENT_SQL = tagOr("sj.tag_employment", "sj.employment_type");
// No legacy column: the function tag is new (it reads the role bucket), so an untagged row is unknown.
export const FUNCTION_SQL   = "sj.tag_function";

/**
 * THE LOCATION PREDICATE, over the place SET (job_tag_places), soft-null.
 *
 *   match    some place of the posting is in one of the chosen metros / states
 *   unknown  the posting names no state or metro at all (a bare "United States", a remote role whose
 *            region came from the description, an unparseable field, or a row not yet tagged) — or,
 *            for a metro, it names that metro's STATE but no city at all ("Massachusetts")
 *   else     an EXPLICIT mismatch — it names places, and none is one of these — and is excluded
 *
 * ⛔ NO BOUND PARAMETERS, deliberately: the values are inlined as literals, which is safe ONLY because
 * every one has passed parsePlaceValue — a metro key from METROS or a two-letter state code from the
 * vocabulary, nothing a caller typed. That keeps the fragment spliceable anywhere the other
 * soft-null "unknown" tests go (the A73 order keys, the facets' known counts) without threading a
 * parameter list through each of them.
 *
 * @returns {{ sql: string, unknownSql: string, values: string[] } | null}
 */
export function placesFilterSql(values) {
  const parsed = (values || []).map(parsePlaceValue).filter(Boolean);
  if (!parsed.length) return null;
  const lit = (xs) => xs.map(x => `'${x}'`).join(",");
  const metros = parsed.filter(p => p.kind === "metro").map(p => p.key);
  const states = parsed.filter(p => p.kind === "state").map(p => p.key);
  const metroStates = [...new Set(metros.map(k => METROS.find(m => m.value === k).state))];

  const matchParts = [];
  if (metros.length) matchParts.push(`p.metro IN (${lit(metros)})`);
  if (states.length) matchParts.push(`p.state IN (${lit(states)})`);
  const match = `EXISTS (SELECT 1 FROM job_tag_places p WHERE p.job_id = sj.job_id AND (${matchParts.join(" OR ")}))`;

  const unknownParts = [`NOT EXISTS (SELECT 1 FROM job_tag_places p WHERE p.job_id = sj.job_id AND p.state IS NOT NULL)`];
  if (metroStates.length) {
    unknownParts.push(`(NOT EXISTS (SELECT 1 FROM job_tag_places p WHERE p.job_id = sj.job_id AND p.metro IS NOT NULL)
       AND EXISTS (SELECT 1 FROM job_tag_places p WHERE p.job_id = sj.job_id AND p.state IN (${lit(metroStates)})))`);
  }
  // An untagged row has no place rows, so it lands in "unknown" by the first part — kept, not hidden.
  const unknown = `(${unknownParts.join(" OR ")})`;
  return {
    sql: `(${match} OR ${unknown})`,
    unknownSql: `(NOT ${match} AND ${unknown})`,
    values: parsed.map(p => `${p.kind}:${p.key}`),
  };
}
