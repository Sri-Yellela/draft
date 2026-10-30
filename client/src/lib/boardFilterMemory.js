// ── D102 P4 · "Start from my board filters" — the board's last query, without its paging ───────────
//
// JobsPanel builds the board's query in its own closure (buildParams). Each time it loads the board it writes the query
// here, minus the paging and the view keys that say WHERE on the board the user is rather than WHAT they filtered; Auto
// settings reads it back as the starting filters of a FULL AUTO run. A per-viewer convenience in localStorage: it may be
// empty (a private window, cleared data) and nothing breaks — the drawer then says there is nothing to start from.
const KEY = "rm_board_filters_v1";
const NOT_FILTERS = new Set(["page", "pageSize", "cursor", "include_facets", "starred", "imported", "pending"]);

/** Remember the board's filters from one of its query strings. */
export function rememberBoardFilters(qs) {
  try {
    const out = {};
    for (const [k, v] of new URLSearchParams(String(qs || ""))) if (!NOT_FILTERS.has(k) && v) out[k] = v;
    localStorage.setItem(KEY, JSON.stringify(out));
  } catch { /* storage unavailable: nothing to remember */ }
}

/** The board's last filters as { name: value } — {} when there are none or storage is unavailable. */
export function lastBoardFilters() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch { return {}; }
}

/** The filters said as a short line for the drawer ("role backend · location Boston · …"). */
export function filterLine(filters = {}) {
  const words = { role: "role", location: "location", workType: "work type", experience_levels: "level", ageFilter: "posted",
    salary_min_usd: "pay from", work_models: "work model", skills_include: "skills", domain: "domain", sort: "sort" };
  return Object.entries(filters).filter(([k]) => k !== "sort").map(([k, v]) => `${words[k] || k} ${v}`).join(" · ");
}
