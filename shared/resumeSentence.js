// shared/resumeSentence.js — ⭐ D184 B-7 (45p, owner 11-08) · THE SENTENCE INHERITS THE RÉSUMÉ.
//
// *"this resume update should also lead to the filter sentence change to inherit the resume specific filters … a mid
// frontend swe from boston's sentence would read something like discovering frontend swe roles at mid levels and all
// workstyles in Boston … and this is for every resume change."*
//
// PURE: the placement (B-1) + the résumé's city → the sentence's clause params, in the board's own param names, so the
// board applies them through the SAME setters the sentence's words use (one source — D30):
//   role       = the placement's subcategory (a ".general" placement narrows to its category only)
//   level      = the résumé's level (junior → the board's "entry")
//   workstyles = what the profile says — "all" ([]) when it says nothing
//   location   = the résumé's city as the board's place (Boston → metro:boston; else its state; else the US floor)
// The person's own later edits win until the NEXT résumé change: the board applies this once per placement (placed_at).
import { resolvePlaceText } from "./jobTagVocabulary.js";

export const LEVEL_TO_CLAUSE = Object.freeze({ intern: "intern", junior: "entry", entry: "entry", mid: "mid", senior: "senior", lead: "lead", executive: "executive" });

/** "Boston" / "Boston, MA" / { city, state } → "metro:boston" | "state:MA" | null (the United States floor). */
export function placeFromLocation(loc) {
  if (!loc) return null;
  const city = typeof loc === "object" ? loc.city : String(loc).split(",")[0];
  const state = typeof loc === "object" ? loc.state : String(loc).split(",")[1];
  return resolvePlaceText(city) || resolvePlaceText(String(loc && typeof loc !== "object" ? loc : "")) || resolvePlaceText(state) || null;
}

/** The clause params a résumé's placement writes into the sentence. */
export function sentenceFromResume({ category = "", subcategory = "", level = null, location = null, workModels = [] } = {}) {
  const general = /\.general$/.test(String(subcategory || ""));
  const lvl = LEVEL_TO_CLAUSE[String(level || "").toLowerCase()] || null;
  const place = placeFromLocation(location);
  return {
    category: String(category || ""),
    subcategory: general ? "" : String(subcategory || ""),
    experience_levels: lvl ? [lvl] : [],
    work_models: Array.isArray(workModels) ? workModels.filter(Boolean) : [],
    places: place ? [place] : [],
  };
}
