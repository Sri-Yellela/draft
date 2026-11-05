// services/boardVisit.js — ⭐ D74 P1 · "NEW SINCE YOUR LAST VISIT", on FIRST SEEN.
//
// D74: "the lens a daily product needs" — what arrived since I last looked, by when the CRAWL first saw it
// (scraped_jobs.discovered_at), never the company's posted date (a re-posted or back-dated posting would
// otherwise read as new, or a genuinely new one as old).
//   · A VISIT is a run of board loads with no gap of VISIT_GAP_SEC or more. Each GET /api/jobs load calls
//     touchBoardVisit: the load stamps board_seen_at; when the gap since the last load is a new visit, the
//     old stamp moves to board_prev_seen_at first. So "since your last visit" holds still for the whole
//     visit, however many times the board reloads.
//   · visitSince answers the cutoff: the previous visit's last load; a first-ever visit has none, and
//     reads the last FIRST_VISIT_SEC (a day) so the option is never empty for a new account.
//   · The facets read visitSince WITHOUT touching — counting is not visiting.
export const VISIT_GAP_SEC = 30 * 60;
export const FIRST_VISIT_SEC = 24 * 3600;

/** A board load. Rolls the previous-visit stamp when this load starts a new visit. Never throws. */
export function touchBoardVisit(db, userId, { now = Math.floor(Date.now() / 1000), gapSec = VISIT_GAP_SEC } = {}) {
  if (userId == null) return null;
  try {
    const u = db.prepare("SELECT board_seen_at, board_prev_seen_at FROM users WHERE id = ?").get(userId);
    if (!u) return null;
    const newVisit = u.board_seen_at != null && now - u.board_seen_at >= gapSec;
    const prev = newVisit ? u.board_seen_at : u.board_prev_seen_at;
    db.prepare("UPDATE users SET board_seen_at = ?, board_prev_seen_at = ? WHERE id = ?").run(now, prev ?? null, userId);
    return { seenAt: now, prevSeenAt: prev ?? null, newVisit };
  } catch {
    return null;                                     // a database before migration 149: no lens, no failure
  }
}

/** ⭐ D156 (6): the STORED visit mark (board_prev_seen_at) or null — what changes only when a visit rolls. The facets
 *  cache keys on it; visitSince's first-visit fallback is relative to now and would make every second a new key. */
export function visitMark(db, userId) {
  try { return db.prepare("SELECT board_prev_seen_at FROM users WHERE id = ?").pluck().get(userId) ?? null; }
  catch { return null; }
}

/** The cutoff for "since your last visit" (epoch seconds). Read-only. */
export function visitSince(db, userId, { now = Math.floor(Date.now() / 1000) } = {}) {
  try {
    const prev = db.prepare("SELECT board_prev_seen_at FROM users WHERE id = ?").pluck().get(userId);
    return prev ?? now - FIRST_VISIT_SEC;
  } catch {
    return now - FIRST_VISIT_SEC;
  }
}

/** The predicate: first seen at or after `since` — the same first-seen expression discovered_after uses. */
export const FIRST_SEEN_SQL = "COALESCE(sj.discovered_at, sj.scraped_at) >= ?";
