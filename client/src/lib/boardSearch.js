// lib/boardSearch.js — ⭐ 45n · a search started OUTSIDE the jobs page (the dock's search) handed to the board.
//
// The dock (components/AppNav.jsx) lives outside the jobs board's provider, so it cannot call the board's own search.
// It asks here instead: the search is kept for the board (sessionStorage, read once) and announced (an event, for a
// board already on screen); App.jsx's BoardSearchBar applies it — a keyword as the board's query, a role as the
// sentence's role, a technology as "using [technology]". One way in, so the dock never builds a second board search.
export const BOARD_SEARCH_EVENT = "draft:board-search";
const KEY = "draft:pending-board-search";

/** detail: { query } | { role: { id, categoryId } } | { tech: { name } } */
export function requestBoardSearch(detail) {
  try { sessionStorage.setItem(KEY, JSON.stringify(detail)); } catch { /* the event still reaches a mounted board */ }
  window.dispatchEvent(new CustomEvent(BOARD_SEARCH_EVENT, { detail }));
}

/** ⭐ D191 (3): a search handed in by ADDRESS — the extension's search box opens /app/jobs?search=<words> (it cannot reach
 *  this origin's sessionStorage). Read once and taken off the address. */
export const SEARCH_PARAM = "search";

/** The search waiting for the board, once (it is removed as it is read). */
export function takePendingBoardSearch() {
  try {
    const u = new URL(window.location.href);
    const q = (u.searchParams.get(SEARCH_PARAM) || "").trim();
    if (q) {
      u.searchParams.delete(SEARCH_PARAM);
      window.history.replaceState(window.history.state, "", `${u.pathname}${u.search}${u.hash}`);
      try { sessionStorage.removeItem(KEY); } catch { /* nothing waiting */ }
      return { query: q.slice(0, 200) };
    }
  } catch { /* no window (tests) */ }
  try { const v = sessionStorage.getItem(KEY); sessionStorage.removeItem(KEY); return v ? JSON.parse(v) : null; } catch { return null; }
}
