// 44b · A LINK PASTED INTO A SENTENCE KEEPS THE SENTENCE'S PUNCTUATION. A tester on Android opened `/try):` — the invite
// read "(jobsviadraft.com/try):" and the messaging app linked the bracket and colon too. The server sent the app shell
// (200), the app had no `/try):` route and drew its 404, so the person saw "Page Not Found" and the HTTP log showed
// nothing wrong. Trailing punctuation no page of ours ends with is stripped and the visitor redirected (301) to the
// clean path, query kept. /api/ is never touched (a client there gets its own answer).

// ) ] } > : . , ; ! ? ' " * and the typographic quotes, ellipsis and dashes a message app substitutes.
const TRAILING = /[)\]}>:.,;!?'"*‘’“”…–—\s]+$/u;

/** The clean path, or null when `rawPath` (as Express gives it, percent-encoded) needs no change. */
export function cleanLinkPath(rawPath) {
  const p = String(rawPath || "");
  if (!p || p === "/" || p.startsWith("/api/")) return null;
  let decoded;
  try { decoded = decodeURIComponent(p); } catch { return null; }
  if (!TRAILING.test(decoded)) return null;
  const clean = decoded.replace(TRAILING, "") || "/";
  return clean === decoded ? null : encodeURI(clean);
}
