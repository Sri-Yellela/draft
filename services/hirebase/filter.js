// services/hirebase/filter.js — ⭐ HB-8 (D187 HB-INFRA): every Hirebase search body is BUILT from draft's own files, never
// typed by hand — content/taxonomy/hirebase-category-map.json (which of Hirebase's categories map to draft's non-held
// categories; `never` is never sent) and content/taxonomy/hirebase-boards.json (the boards draft already crawls →
// `exclude_job_board` when skipOurBoards is on). US only, agencies hidden, incomplete listings KEPT (owner 11-10), the RAW
// description requested (draft's scoring, tailoring and schema reader read the full ATS text, not the summary).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
export const CATEGORY_MAP_FILE = "content/taxonomy/hirebase-category-map.json";
export const BOARDS_FILE = "content/taxonomy/hirebase-boards.json";

export function categoryMap() { return readJson(CATEGORY_MAP_FILE); }
export function boardsConfig() { return readJson(BOARDS_FILE); }

/** The Hirebase categories draft may request — the map's keys, minus anything on `never`. */
export function requestableCategories(map = categoryMap()) {
  const never = new Set(map.never || []);
  return Object.keys(map.map || {}).filter(c => !never.has(c));
}

/**
 * A search body. `categories` (Hirebase names) default to every requestable one; a name on `never` or not in the map
 * throws — the filter cannot be widened by a caller. `skipOurBoards` defaults to the boards file's switch.
 */
export function buildSearchBody({ categories = null, daysAgo = null, datePosted = null, ingestedAfter = null, sortBy = "date_posted",
  sortOrder = "desc", page = 1, limit = 100, skipOurBoards = null, visa = null } = {}, { map = categoryMap(), boards = boardsConfig() } = {}) {
  const allowed = new Set(requestableCategories(map));
  const cats = categories == null ? [...allowed] : categories;
  for (const c of cats) if (!allowed.has(c)) throw new Error(`hirebase filter: "${c}" is not a requestable category (content/taxonomy/hirebase-category-map.json)`);
  const skip = skipOurBoards == null ? !!boards.skipOurBoards : !!skipOurBoards;
  return {
    job_category: cats,
    geo_locations: [{ country: "United States" }],
    hide_recruiting_agencies: "true",
    // OWNER 11-10 (46d): incomplete listings ARE requested — filter_incomplete_jobs removed ~97 % of the market in the free
    // estimates (one day of US SWE 2,061 → 65); draft's own pipeline judges completeness, level and category.
    filter_incomplete_jobs: "false",
    return_raw_description: "true",
    ...(skip && Array.isArray(boards.ourBoards) && boards.ourBoards.length ? { exclude_job_board: [...boards.ourBoards] } : {}),
    ...(daysAgo != null ? { days_ago: Number(daysAgo) } : {}),
    ...(datePosted ? { date_posted: String(datePosted) } : {}),
    ...(ingestedAfter ? { ingested_after: String(ingestedAfter) } : {}),
    ...(visa != null ? { visa: visa ? "true" : "false" } : {}),
    sort_by: sortBy, sort_order: sortOrder, page, limit: Math.min(100, Math.max(1, Number(limit) || 100)),
  };
}
