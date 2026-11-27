// ⭐ 47k (errb) · AN AREA THAT FAILS STAYS ONE AREA — the pure half of plate/AreaErrorBoundary.jsx (no React, so a node
// test reads it). Two questions: is this error a lazy chunk that went missing (a deploy swapped the chunk hashes under an
// open tab), and may we reload the page for it once — never in a loop.

/** The three ways a browser says a dynamically imported chunk could not be fetched (webpack's name, Chromium / Vite's
 *  message, Safari's message) plus Vite's CSS preload error. */
const CHUNK_PATTERNS = [
  /ChunkLoadError/i,
  /Loading (?:CSS )?chunk [\w-]+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /error loading dynamically imported module/i,   // Firefox
  /Unable to preload CSS/i,                        // Vite's preload helper
];

export function isChunkLoadError(err) {
  if (!err) return false;
  const name = typeof err === "object" ? String(err.name || "") : "";
  const message = typeof err === "object" ? String(err.message || "") : String(err);
  const text = `${name} ${message}`;
  return CHUNK_PATTERNS.some((re) => re.test(text));
}

export const RELOAD_KEY = "draft.areaFault.reloadedAt";
/** A second chunk failure inside this window means the reload did not help — show the state instead of reloading again. */
export const RELOAD_WINDOW_MS = 60_000;

/**
 * May the page reload itself for a chunk failure now? True at most once per RELOAD_WINDOW_MS, recorded in `storage`
 * (sessionStorage in the browser). Any storage fault answers false: without a working guard a reload could loop.
 */
export function claimAutoReload(storage, now = Date.now()) {
  try {
    if (!storage) return false;
    const last = Number(storage.getItem(RELOAD_KEY));
    if (Number.isFinite(last) && last > 0 && now - last < RELOAD_WINDOW_MS) return false;
    storage.setItem(RELOAD_KEY, String(now));
    return Number(storage.getItem(RELOAD_KEY)) === now;   // the write must have stuck, or the next load cannot see it
  } catch {
    return false;
  }
}

/** sessionStorage, or null where reading it throws (private windows, blocked site data). */
export function sessionStore() {
  try { return typeof window !== "undefined" ? window.sessionStorage : null; } catch { return null; }
}
