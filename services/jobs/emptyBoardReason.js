/**
 * WHY IS THE BOARD EMPTY? — the one place that question is answered.
 * ================================================================================================
 *
 * ⛔ THIS EXISTS BECAUSE "600 JOBS" BESIDE AN EMPTY LIST IS WORSE THAN EITHER NUMBER ALONE. It
 * asserts data the user cannot reach, it is unfalsifiable from the UI, and it has twice in this
 * project turned out to be a NULL-propagation bug wearing the costume of a filter:
 *
 *   · CC1b — an INNER JOIN on job_role_map hid 277 unmapped postings from every profile.
 *   · The skills facet — `skills_json = '[]'` ranked as MISS rather than UNKNOWN.
 *
 * Both presented as "the board is empty" and neither said so. An empty board that names its own
 * cause is the difference between a bug report and a shrug.
 *
 * ⛔ IT IS A DESCRIPTION, NOT A DECISION. Nothing here filters, re-queries or changes what is
 * returned. It looks at what the query already did and says which of the mutually exclusive
 * reasons applies. A function that could change the result would be a second place the board can
 * be emptied, which is the opposite of the point.
 *
 * The codes are stable and the client may switch on them; the `message` is for humans and may be
 * reworded. Adding a code is fine. Repurposing one is not.
 */

/** Filter params that narrow the board. `q`/`role` are the search box; the rest are the drawer. */
const NARROWING_PARAMS = [
  "q", "role", "location", "employmentType", "workType", "category", "domain", "source",
  "maxApplicants", "ageFilter", "yoe", "minYoe", "visited", "starred", "applied",
  "salaryMin", "salaryMax", "skills", "company", "sponsorship", "clearance", "workplaceType",
];

/**
 * Which narrowing filters the caller actually supplied, in the order listed above.
 * Empty strings, absent keys and `'0'`-valued toggles are not filters — treating them as such
 * would make every request look filtered and the explanation useless.
 */
export function activeFilterNames(query = {}) {
  const out = [];
  for (const key of NARROWING_PARAMS) {
    const v = query[key];
    if (v === undefined || v === null) continue;
    const s = String(Array.isArray(v) ? v.join(",") : v).trim();
    if (!s || s === "0") continue;
    out.push(key);
  }
  return out;
}

/**
 * Describe an empty page, or return null when there is nothing to explain.
 *
 * @param {object} a
 * @param {number} a.total      rows matching the filters, ignoring paging — the COUNT query
 * @param {number} a.returned   rows actually in this response
 * @param {number} a.page       1-based page number (offset paging)
 * @param {number} a.totalPages Math.ceil(total / pageSize)
 * @param {boolean} a.usedCursor whether this request paged by keyset rather than offset
 * @param {string[]} a.activeFilters from activeFilterNames()
 * @returns {{code: string, message: string, [k: string]: unknown} | null}
 */
export function describeEmptyBoard({ total = 0, returned = 0, page = 1, totalPages = 0,
                                     usedCursor = false, activeFilters = [] } = {}) {
  if (returned > 0) return null;              // nothing to explain — the board has rows

  // ── total > 0: the filters match rows, and this PAGE still came back empty ────────────────────
  //
  // This is the shape that prompted the whole file: a count that reports rows the list did not
  // return. It is legitimate at the end of a feed and a defect anywhere else, and the response has
  // to distinguish those rather than leaving both looking identical.
  if (total > 0) {
    if (usedCursor) {
      return {
        code: "cursor_exhausted",
        message: "You have reached the end of this list.",
        total,
      };
    }
    if (page > totalPages) {
      return {
        code: "page_out_of_range",
        message: `Page ${page} is past the end of this list — there ${totalPages === 1 ? "is" : "are"} ${totalPages} page${totalPages === 1 ? "" : "s"}. Go back to the first page.`,
        total, page, totalPages,
      };
    }
    // ⛔ IN RANGE, ROWS EXIST, AND NONE CAME BACK. There is no legitimate way to reach this: the
    // count and the list share one join and one WHERE, so a page inside the range must return
    // rows. Naming it is the point — this is the state that was previously indistinguishable from
    // a normal empty board, and it means the two queries have diverged.
    return {
      code: "count_list_mismatch",
      message: "This page should contain jobs but returned none. This is a bug, not a filter.",
      total, page, totalPages,
      diagnostic: true,
    };
  }

  // ── total === 0: nothing matched. Say what was asked for. ────────────────────────────────────
  if (activeFilters.length) {
    return {
      code: "filters_exclude_all",
      message: `No jobs match the ${activeFilters.length === 1 ? "filter" : "filters"} you applied.`,
      filters: activeFilters,
    };
  }
  return {
    code: "board_empty",
    message: "There are no jobs on the board for this profile yet.",
  };
}
