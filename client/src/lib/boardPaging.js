/**
 * WHICH PAGING MODE ANSWERS A BOARD NAVIGATION.
 * ================================================================================================
 *
 * THE DEFECT THIS EXISTS TO FIX
 *
 * `LIMIT ? OFFSET ?` assumes a stable result set. The board is not stable: disliking a job removes
 * it from the server's result set, because the default board excludes disliked rows. So pressing
 * Next after disliking four jobs asks for an offset four rows further into a list that is four rows
 * shorter — and four jobs are stepped over and never shown.
 *
 * On THIS board that skip is invisible twice over. The list does not visibly shrink, because
 * JobsPanel re-injects session-disliked rows so they stay on screen (faded); and `total` still
 * counts the skipped rows, so the pager's arithmetic looks right. Nothing reports the loss.
 *
 * WHY BOTH MODES SURVIVE, AND WHY THIS IS A FUNCTION RATHER THAN A REPLACEMENT
 *
 * The web board is a NUMBERED pager: Prev, 1 2 3 …, Next, and a "go to page" box. A keyset cursor
 * cannot answer "page 17" — it has no notion of position, which is precisely the property that
 * makes it correct for stepping. Ripping out offset paging would delete random page access, a
 * working feature, to fix a defect that does not live there.
 *
 * So each mode answers what it is actually good at:
 *
 *   Next / Prev   a STEP      -> cursor.  The board may have shrunk under the reader, and this is
 *                                         the case a cursor can answer.
 *   page 17       a JUMP      -> offset.  The user asked for a POSITION. Nothing else can answer
 *                                         that, and a jump is not where the defect lives.
 *
 * Extracted here, out of a 3,800-line component, because the decision is the whole change and a
 * decision buried in a click handler cannot be tested. See test/boardPagingCursor.test.js.
 */

/**
 * @param {object}   args
 * @param {number}   args.target       the page the user is navigating to
 * @param {number}   args.currentPage  the page on screen
 * @param {?string}  args.nextCursor   cursor the LAST response handed back, or null
 * @param {Array}    args.stack        index (page-1) -> the cursor that fetched that page
 * @returns {{ cursor: ?string, resetChain: boolean, mode: 'cursor'|'offset' }}
 *   `cursor` null means page by offset. `resetChain` asks the caller to discard the chain,
 *   because a jump breaks it and the next step must re-establish it from wherever it lands.
 */
export function planPageFetch({ target, currentPage, nextCursor, stack = [] }) {
  // A STEP NEVER DISCARDS THE CHAIN — not even when it cannot use a cursor.
  //
  // This distinction is worth stating because the obvious implementation gets it wrong. Writing
  // the forward case as `target === currentPage + 1 && nextCursor` makes a Next with no cursor
  // available fall through to the JUMP branch and wipe the chain, purely because it happened to be
  // paging the old way for one request. Nothing breaks, but the chain has to be rebuilt from
  // scratch afterwards, and the reason would be invisible. A step is a step; only a jump is a jump.

  // FORWARD ONE. The common case, and the one the defect lives in. Falls back to offset when no
  // cursor was issued — a last page hands back nextCursor:null, and a board restored from cache has
  // no chain yet. Degrading to the previous behaviour is correct; refusing to navigate is not.
  if (target === currentPage + 1) {
    return nextCursor
      ? { cursor: nextCursor, resetChain: false, mode: "cursor" }
      : { cursor: null, resetChain: false, mode: "offset" };
  }

  // BACK ONE. Re-runs the request that produced the earlier page — which is why no backwards
  // cursor is needed. It stays valid even when the row it was issued from has since been disliked,
  // because a cursor carries sort VALUES, not a reference to a row.
  //
  // `undefined` means "not a page in this chain". `null` is a REAL stack value meaning page 1,
  // which is offset by definition — so this tests against undefined, not falsiness. Getting that
  // wrong would send Prev-to-page-1 down the reset branch and quietly discard a valid chain.
  if (target === currentPage - 1) {
    const remembered = stack[target - 1];
    return remembered !== undefined
      ? { cursor: remembered, resetChain: false, mode: remembered ? "cursor" : "offset" }
      : { cursor: null, resetChain: false, mode: "offset" };
  }

  // STAYING PUT. A refresh of the page on screen is not a navigation and must not discard the
  // chain; the caller re-runs this page's own remembered request.
  if (target === currentPage) {
    return { cursor: null, resetChain: false, mode: "offset" };
  }

  // A JUMP. Offset is the only thing that can answer it, and the chain no longer describes where
  // the user is, so it goes.
  return { cursor: null, resetChain: true, mode: "offset" };
}

/**
 * Record what fetched a page, and what will fetch the one after it.
 *
 * Truncating at `page` is what keeps Prev-then-a-different-Next honest: without it the stack would
 * still hold cursors from the branch the user abandoned, and a later Prev would replay a request
 * belonging to a page they never came from.
 *
 * @returns {Array} the new stack (the input is not mutated)
 */
export function recordPageCursor(stack, page, cursorUsed) {
  const next = stack.slice(0, page);
  next[page - 1] = cursorUsed ?? null;
  return next;
}

// ⭐ D199 C3 (47h) · THE PAGE IN THE ADDRESS, and the pager's tiles. Pure, so the round trip is tested without a browser.
export const PAGE_PARAM = "page";

/** The page an address names (`?page=N`); anything else — absent, 0, junk — is page 1. */
export function readPageParam(search) {
  try {
    const n = Math.floor(Number(new URLSearchParams(search || "").get(PAGE_PARAM)));
    return Number.isFinite(n) && n >= 1 ? n : 1;
  } catch { return 1; }
}

/** The query string with the page written in (page 1 → the param removed); every other param is kept as it was. */
export function pageInSearch(search, page) {
  const params = new URLSearchParams(search || "");
  const n = Math.floor(Number(page) || 1);
  if (n > 1) params.set(PAGE_PARAM, String(n)); else params.delete(PAGE_PARAM);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * The pager's tiles, the classic pager's rule (`buildVisiblePageItems`, D147's removed pager: the first, the current ± 2 and
 * the last, a gap as "…"): [{ kind: "prev" | "page" | "gap" | "next", page, current, disabled }]. Nothing when there is one page.
 */
export function pagerTiles(page, totalPages) {
  const last = Math.max(0, Math.floor(Number(totalPages) || 0));
  if (last <= 1) return [];
  const cur = Math.min(Math.max(1, Math.floor(Number(page) || 1)), last);
  const nums = new Set([1, last]);
  for (let p = cur - 2; p <= cur + 2; p++) if (p >= 1 && p <= last) nums.add(p);
  const sorted = [...nums].sort((a, b) => a - b);
  const out = [{ kind: "prev", page: Math.max(1, cur - 1), disabled: cur <= 1 }];
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1] > 1) out.push({ kind: "gap", page: null });
    out.push({ kind: "page", page: p, current: p === cur });
  });
  out.push({ kind: "next", page: Math.min(last, cur + 1), disabled: cur >= last });
  return out;
}

/** "PAGE 2 OF 47 · 50 PER PAGE · 2,310 OPENINGS" — null until the board has answered with a count. */
export function pageLine({ page, totalPages, pageSize, total } = {}) {
  if (!Number.isFinite(total) || !Number.isFinite(totalPages) || totalPages < 1) return null;
  const n = (x) => Number(x).toLocaleString("en-US");
  return `PAGE ${n(Math.min(Math.max(1, page || 1), totalPages))} OF ${n(totalPages)} · ${pageSize} PER PAGE · ${n(total)} ${total === 1 ? "OPENING" : "OPENINGS"}`;
}
