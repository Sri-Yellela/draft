// client/src/lib/jobUrl.js
//
// AH2: the address of a single job, in ONE place.
//
// ⭐ 47m (D199 C7): a job's address IS its opening sheet, /app/jobs/<id> (plate/OpeningSheet.jsx, drawn over the market;
// App.jsx's OPENING_ROUTE). The old ?job=<id> query (the posting drawn in a panel, then on the deck — AH2, D156 (1c)) is
// only READ now, once, so a link made before still lands: JobsPanel redirects it to the sheet. The deck's posting events
// (OPEN_POSTING_EVENT, CLOSE_POSTING_EVENT, POSTING_ON_DECK_EVENT, DECK_DECIDE_EVENT, the slot, the swap's POST_FADE_MS,
// panelOverPosting) are deleted with the posting: the sheet is its one home.

export const JOB_URL_PARAM = "job";

/** The shareable address of one job — its opening sheet — or null when there is no id to name. */
export function jobDetailHref(jobId) {
  if (!jobId) return null;
  return `/app/jobs/${encodeURIComponent(jobId)}`;
}

/** The job id an OLD ?job=<id> address asks for, or null. Accepts a search string or defaults to this tab's. */
export function jobIdFromSearch(search) {
  const raw = search ?? (typeof window === "undefined" ? "" : window.location.search);
  try { return new URLSearchParams(raw).get(JOB_URL_PARAM) || null; }
  catch { return null; }
}
