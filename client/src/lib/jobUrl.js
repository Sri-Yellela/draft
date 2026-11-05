// client/src/lib/jobUrl.js
//
// AH2: the address of a single job detail, in ONE place.
//
// The detail panel used to be React state with no URL at all, so nothing could link to a job and
// two details could not be open at once. Giving it an address means two sides have to agree on that
// address — JobCard writes the href, JobsPanel reads the param back — and two spellings of "job"
// would be a link that opens the board and nothing else. So neither side spells it.
//
// A query param on the existing console route rather than a new path segment: /app/jobs is already
// the board's route, and /app/jobs/<id> did not work (App.jsx redirects any routeKey that is not a
// known panel back to the bare board). ?job= composes with the board's other URL state instead of
// competing with a route table.

export const JOB_URL_PARAM = "job";

const CONSOLE_PATH = "/app/jobs";

/** The shareable address of one job's detail view, or null when there is no id to name. */
export function jobDetailHref(jobId) {
  if (!jobId) return null;
  return `${CONSOLE_PATH}?${JOB_URL_PARAM}=${encodeURIComponent(jobId)}`;
}

/** The job id a location is asking for, or null. Accepts a search string or defaults to this tab's. */
export function jobIdFromSearch(search) {
  const raw = search ?? (typeof window === "undefined" ? "" : window.location.search);
  try { return new URLSearchParams(raw).get(JOB_URL_PARAM) || null; }
  catch { return null; }
}

// ⭐ D152 (8) (b): "open this job's match" — the deck (Home's left column) asks the board (its right column) to open
// the posting IN PLACE with its match open under the facts (ats-options.html option A), instead of drawing a report
// over the page. One event, named once: the deck dispatches it, JobsPanel listens.
export const OPEN_MATCH_EVENT = "draft:open-match";

/** Ask the board to open job `jobId`'s posting with its match open. A no-op without a window. */
export function openMatchInPosting(jobId, { origin = "deck" } = {}) {
  if (!jobId || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_MATCH_EVENT, { detail: { jobId: String(jobId), origin } }));
}

// ⭐ D156 (1c) (owner 11-05: "doesnt make sense to have a card and then a panel posting of the same thing … the card can turn
// into the long post"): ON HOME THE OPENED POSTING IS DRAWN ON THE DECK, in the front card's place — never in a panel of
// its own beside the list. The posting (JobDetailPanel) stays the board's (JobsPanel owns its data and actions); the deck
// owns the slot it is drawn into. Four events, named once here:
//   OPEN_POSTING_EVENT    the deck → the board: open job `jobId`'s posting (the front card expanding: origin "deck")
//   CLOSE_POSTING_EVENT   the deck → the board: fold it (scroll up at its top, Esc, "Fold it back")
//   POSTING_ON_DECK_EVENT the board → the deck: which posting is drawn in the slot now ({ jobId, origin } or jobId null)
//   DECK_DECIDE_EVENT     the board → the deck: the posting's Pass · Save · Draft on the deck's own card — the deck decides
//                         (one commit, the deck's exits and toast), then the day's next card is in front again.
export const OPEN_POSTING_EVENT = "draft:open-posting";
export const CLOSE_POSTING_EVENT = "draft:close-posting";
export const POSTING_ON_DECK_EVENT = "draft:posting-on-deck";
export const DECK_DECIDE_EVENT = "draft:deck-decide";
/** The element id of the deck's slot the opened posting is drawn into (DeckView renders it on Home). */
export const DECK_POST_SLOT_ID = "deck-post-slot";

const emit = (name, detail) => { if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(name, { detail })); };
/** Ask the board to open job `jobId`'s posting on the deck. */
export function openPostingOnDeck(jobId, { origin = "deck" } = {}) { if (jobId) emit(OPEN_POSTING_EVENT, { jobId: String(jobId), origin }); }
/** Ask the board to fold the posting drawn on the deck. */
export function closePostingOnDeck() { emit(CLOSE_POSTING_EVENT, {}); }
