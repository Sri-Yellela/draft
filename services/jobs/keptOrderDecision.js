// services/jobs/keptOrderDecision.js — ⭐ A195 leftover (46m) · A PASS OR A SAVE UPDATES THE KEPT BOARD ORDER IN PLACE.
//
// Before: any write by a person dropped every kept board order of theirs (server.js, the write middleware), so the board
// load right after a pass or a star read the person's whole board again (the "cold first load" A195 left: 1–1.5 s of
// read-worker time at 100k). The order (ORDER BY) never reads the person's own flags (starred / disliked) — only WHICH rows
// are on a board changes — so a decision can be applied to the kept ids exactly, and anything that can't be is dropped:
//   PASS (disliked → 1)   the job leaves every board: its id comes out and the total falls by one. Not in the kept ids →
//                         the kept pages can't show it (a page past the kept ids is read fresh), nothing to do.
//   UN-PASS (disliked → 0, it was 1)   it may come back anywhere → dropped (recounted on the next load).
//   SAVE (starred → 1)    the Saved view gains it → that order is dropped; another view already holding it keeps its order
//                         (membership unchanged); one NOT holding it is dropped (a star brings a row into ALL — D41(a)).
//   UNSAVE (starred → 0)  the Saved view loses it (out, total − 1); another view holding it is dropped (it may have been
//                         there only because it was starred); one not holding it is unchanged.
// ⛔ Correctness first: a passed job never reappears from a kept order. Returns the new value, `null` (drop the entry) or
// `undefined` (keep it as it is). Pure.
const SAVED_VIEW = /(?:^|[|&])starred=1(?:&|$)/;

export function keptOrderAfterDecision(key, value, jobId, { wasStarred = false, wasDisliked = false, starred = false, disliked = false } = {}) {
  if (!value || !Array.isArray(value.ids)) return null;
  const id = String(jobId);
  const at = value.ids.findIndex(x => String(x) === id);
  const without = () => { const ids = value.ids.slice(); ids.splice(at, 1); return { ...value, ids, total: Math.max(0, (Number(value.total) || 0) - 1) }; };
  const saved = SAVED_VIEW.test(String(key));
  if (disliked) return at >= 0 ? without() : undefined;
  if (wasDisliked) return null;
  if (starred && !wasStarred) return saved ? null : (at >= 0 ? undefined : null);
  if (!starred && wasStarred) return saved ? (at >= 0 ? without() : undefined) : (at >= 0 ? null : undefined);
  return undefined;
}
