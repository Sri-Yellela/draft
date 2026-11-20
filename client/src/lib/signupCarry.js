// ── "Sign up to keep it" (queue 30) ──────────────────────────────────────────────────────────
//
// The signup page offers the free ATS check first: a résumé PDF and a posting, scored by the same
// deterministic engine as the board, no account, no model call. "Keep it" has to be literal, so the
// résumé the visitor scored is CARRIED into the account they then create — here, in memory, for the
// rest of this page session. Job Profiles offers it as the first profile's base résumé.
//
// ⛔ Memory only: never localStorage/sessionStorage. A résumé is personal data, and a copy that
// outlived the tab would sit on a shared computer after the visitor walked away. A reload drops it,
// which is the safe failure.
let carried = null;

// ⭐ D141 (46y): the honesty check (/tools/honesty) hands off the same way — "sign up to save and fix": the résumé it
// checked is carried here with `from: "honesty"` and how many lines it flagged, so Job Profiles can say what to fix.
// One carry for both public tools (A93): never a second hand-off.

/** Hold the checked résumé (a File) and what it was checked by / against. */
export function carryResume(file, { jobTitle = "", band = null, from = "ats", flagged = null } = {}) {
  carried = file ? { file, jobTitle, band, from, flagged, at: Date.now() } : null;
}

/** What the visitor scored before signing up, or null. */
export const carriedResume = () => carried;

/** Called once the résumé has been used (or declined): it is not offered twice. */
export function dropCarriedResume() { carried = null; }
