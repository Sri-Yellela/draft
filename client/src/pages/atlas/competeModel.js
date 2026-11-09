// client/src/pages/atlas/competeModel.js — ⭐ A154 / D172 (4) (45s) · Compete's words, pure (the numbers are the server's,
// services/atlas/league.js and challenges.js — never re-derived here).

/** "Resets in 2 days 4 hours" · "Resets in 3 hours 10 minutes" · "Resets in 9 minutes". */
export function resetWords(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  const unit = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  if (d) return `Resets in ${unit(d, "day")}${h ? ` ${unit(h, "hour")}` : ""}`;
  if (h) return `Resets in ${unit(h, "hour")}${m ? ` ${unit(m, "minute")}` : ""}`;
  return `Resets in ${unit(Math.max(1, m), "minute")}`;
}

/** Movement since yesterday: { sign: "up" | "down" | "same" | null, words: "▲ 2" | "▼ 1" | "–" | "" }. */
export function moveOf(move) {
  if (move == null) return { sign: null, words: "" };
  if (move > 0) return { sign: "up", words: `▲ ${move}` };
  if (move < 0) return { sign: "down", words: `▼ ${-move}` };
  return { sign: "same", words: "–" };
}

/** A handle's colourway (1–5), stable for the handle, so the same person keeps one colour. */
export function wayOf(handle) {
  let h = 0;
  for (const ch of String(handle || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (h % 5) + 1;
}

/** The share address for a kept audit's score. */
export const barHref = (code) => `/atlas/bar/${encodeURIComponent(code)}`;

/** The mode words, the same three D142 offers. */
export const MODE_WORDS = Object.freeze({ timed: "Timed", extended: "Extended time", untimed: "Untimed" });
